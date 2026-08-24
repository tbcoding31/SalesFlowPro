import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { env } from './env';
import { pool } from './db';

const app = express();

// Phase 5: Authorization Abstractions
export const can = (permissions: string[], action: string) => {
  if (permissions.includes('ALL')) return true;
  return permissions.includes(action);
};

export const getAssignableRoles = async (pool: any, actorRoleId: string) => {
  try {
    const [rows]: any = await pool.query('SELECT assignableRoleId as roleId FROM role_assignment_policies WHERE assignerRoleId = ?', [actorRoleId]);
    return rows.map((r: any) => r.roleId);
  } catch (e) {
    console.warn('[AUTH FALLBACK] role_assignment_policies missing. Using fallback logic.');
    // FALLBACK REMOVED
    return [];
  }
};

/**
 * Authoritative user access context resolution.
 * Supports both platform users (global roles with no tenant membership)
 * and tenant users (scoped roles through tenant_users).
 */
export const resolveUserAccessContext = async (pool: any, userId: string) => {
  // 1. Check if user has tenant membership
  const [membershipRows]: any = await pool.query(`
    SELECT tu.tenantId, tu.status as tenantUserStatus, tur.roleId, r.name as roleName, r.scope
    FROM tenant_users tu
    LEFT JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
    LEFT JOIN roles r ON r.id = tur.roleId
    WHERE tu.userId = ? AND tu.isPrimary = true
  `, [userId]);

  let tenantId: string | null = null;
  let roleId: string | null = null;
  let roleName: string | null = null;
  let isPlatformUser = false;

  if (membershipRows.length > 0 && membershipRows[0].tenantId && membershipRows[0].tenantId !== 'SYSTEM') {
    tenantId = membershipRows[0].tenantId;
    roleId = membershipRows[0].roleId;
    roleName = membershipRows[0].roleName;
  } else if (membershipRows.length > 0 && membershipRows[0].tenantId === 'SYSTEM') {
    // Legacy mapping support: treat SYSTEM tenant membership as platform user
    isPlatformUser = true;
    roleId = membershipRows[0].roleId || 'SUPER_ADMIN';
    roleName = membershipRows[0].roleName || 'Super Admin';
    tenantId = null;
  } else {
    // 2. User has no tenant membership: Check for EXPLICIT global role assignment in global_user_roles
    try {
      const [globalUserRoleRows]: any = await pool.query(`
        SELECT gur.roleId, r.name as roleName, r.scope
        FROM global_user_roles gur
        JOIN roles r ON r.id = gur.roleId
        WHERE gur.userId = ?
        LIMIT 1
      `, [userId]);

      if (globalUserRoleRows.length > 0) {
        isPlatformUser = true;
        roleId = globalUserRoleRows[0].roleId;
        roleName = globalUserRoleRows[0].roleName;
        tenantId = null;
      }
    } catch (err: any) {
      // Table might not exist in old schemas during transition
      console.warn('[AUTH] global_user_roles query skipped:', err.message);
    }
  }

  // 3. Resolve permissions
  let permissions: string[] = [];
  if (roleId) {
    try {
      const [permRows]: any = await pool.query('SELECT permission FROM role_permissions WHERE roleId = ?', [roleId]);
      permissions = permRows.map((r: any) => r.permission);
    } catch (e) {
      console.error('[AUTH] DB Error when loading permissions for role:', roleId, e);
    }
  }

  return {
    tenantId,
    roleId,
    roleName,
    permissions,
    isPlatformUser
  };
};

app.use(helmet({
  // Keep CSP off — frontend uses inline scripts/styles (Vite bundled)
  contentSecurityPolicy: false,
  // Keep COEP off — not using SharedArrayBuffer
  crossOriginEmbedderPolicy: false,
  // HSTS: only enable if HTTPS (skip on plain HTTP dev)
  hsts: process.env.HTTPS === 'true'
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
}));

// Safe CORS - restrict to known origins in production
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3100',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3100'
    ];
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy'));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' })); // Request size limit

// AUTH MIDDLEWARE
app.use(async (req, res, next) => {
  // Pass through public routes
  if (
    req.path.startsWith('/api/auth/') ||
    req.path === '/api/health'
  ) {
    return next();
  }

  // Only protect API routes
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    // Return 401 generic for missing tokens
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.replace('Bearer ', '').trim();

  try {
    const [sessions]: any = await pool.query('SELECT * FROM auth_sessions WHERE token = ?', [token]);
    if (sessions.length === 0) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }

    const session = sessions[0];

    // Hydrate User Context (Tenant, Role, Permissions) via authoritative helper
    const userContext = await resolveUserAccessContext(pool, session.userId);

    // Tenant Suspension Check for tenant-scoped users
    if (userContext.tenantId && userContext.tenantId !== 'SYSTEM') {
      const [tenantRows]: any = await pool.query('SELECT status FROM tenants WHERE id = ?', [userContext.tenantId]);
      if (tenantRows.length > 0 && tenantRows[0].status === 'SUSPENDED') {
        return res.status(403).json({ error: 'Tenant is suspended', code: 'TENANT_SUSPENDED' });
      }
    }

    (req as any).userId = session.userId;
    (req as any).userRole = userContext.roleId;
    (req as any).userTenantId = userContext.tenantId;
    (req as any).userPermissions = userContext.permissions;
    (req as any).isPlatformUser = userContext.isPlatformUser;

    // Check session expiration
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return res.status(401).json({ error: 'Unauthorized: Session has expired' });
    }

    next();
  } catch (err: any) {
    console.error('Auth middleware error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SYNC ALL DATA FOR FRONTEND HYDRATION
const SYNC_MAX_PAGE_SIZE = 500;
const SYNC_DEFAULT_PAGE_SIZE = 200;

app.get('/api/sync/all', async (req, res) => {
  try {
    const actorTenant = (req as any).userTenantId;
    const actorRole = (req as any).userRole;
    const isPlatformUser = (req as any).isPlatformUser;
    if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

    // Pagination (bounded, no unbounded fetch)
    const rawPage = parseInt(req.query.page as string, 10);
    const rawSize = parseInt(req.query.pageSize as string, 10);
    const page = (!isNaN(rawPage) && rawPage >= 1) ? rawPage : 1;
    const pageSize = (!isNaN(rawSize) && rawSize >= 1) ? Math.min(rawSize, SYNC_MAX_PAGE_SIZE) : SYNC_DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    let tenantFilter = '';
    let queryArgs: any[] = [];
    if (actorTenant && actorTenant !== 'SYSTEM') {
      tenantFilter = ' WHERE tenantId = ?';
      queryArgs.push(actorTenant);
    } else {
      const requestedTenantId = req.query.tenantId;
      if (requestedTenantId && requestedTenantId !== 'ALL' && requestedTenantId !== 'SYSTEM') {
        tenantFilter = ' WHERE tenantId = ?';
        queryArgs.push(requestedTenantId);
      }
    }

    // Reference tables (small, always fetch all)
    const [dbTenants] = await pool.query('SELECT * FROM tenants' + (actorTenant && actorTenant !== 'SYSTEM' ? ' WHERE id = ?' : tenantFilter ? ' WHERE id = ?' : ''), queryArgs) as any[];
    
    let userQuery = 'SELECT u.* FROM users u';
    if (tenantFilter) {
      userQuery += ' INNER JOIN tenant_users tu ON tu.userId = u.id' + tenantFilter;
    }
    const [dbUsers] = await pool.query(userQuery, queryArgs) as any[]; 

    const [dbTenantUsers] = await pool.query('SELECT * FROM tenant_users' + tenantFilter, queryArgs) as any[];
    let turQuery = 'SELECT tur.* FROM tenant_user_roles tur';
    if (tenantFilter) {
      turQuery += ' INNER JOIN tenant_users tu ON tu.id = tur.tenantUserId' + tenantFilter;
    }
    const [dbTenantUserRoles] = await pool.query(turQuery, queryArgs) as any[];
    let roleQuery = 'SELECT * FROM roles';
    if (actorTenant && actorTenant !== 'SYSTEM') {
      roleQuery += ' WHERE tenantId = ? OR tenantId IS NULL OR tenantId = "SYSTEM"';
    } else if (tenantFilter) {
      roleQuery += ' WHERE tenantId = ? OR tenantId IS NULL OR tenantId = "SYSTEM"';
    }
    const [dbRoles] = await pool.query(roleQuery, queryArgs) as any[];

    // Data tables (paginated — bounded by pageSize / SYNC_MAX_PAGE_SIZE)
    const paginatedArgs = [...queryArgs, pageSize, offset];
    const limitClause = tenantFilter
      ? ` AND 1=1 ORDER BY id LIMIT ? OFFSET ?`
      : ` ORDER BY id LIMIT ? OFFSET ?`;
    const tenantWhere = tenantFilter || '';

    const [dbCustomers] = await pool.query(`SELECT * FROM customers${tenantWhere}${limitClause}`, paginatedArgs) as any[];
    const [dbVisits] = await pool.query(`SELECT * FROM visits${tenantWhere}${limitClause}`, paginatedArgs) as any[];
    const [dbTasks] = await pool.query(`SELECT * FROM tasks${tenantWhere}${limitClause}`, paginatedArgs) as any[];
    const [dbActivities] = await pool.query(`SELECT * FROM activities${tenantWhere}${limitClause}`, paginatedArgs) as any[];
    const [dbSalesTargets] = await pool.query(`SELECT * FROM sales_targets${tenantWhere}${limitClause}`, paginatedArgs) as any[];
    const [dbProjects] = await pool.query(`SELECT * FROM projects${tenantWhere}${limitClause}`, paginatedArgs) as any[];
    
    let auditLogFilter = tenantFilter;
    if (actorTenant !== 'SYSTEM') {
       auditLogFilter = ' WHERE userId IN (SELECT userId FROM tenant_users WHERE tenantId = ?)';
    } else if (req.query.tenantId && req.query.tenantId !== 'ALL') {
       auditLogFilter = ' WHERE userId IN (SELECT userId FROM tenant_users WHERE tenantId = ?)';
    }
    const auditArgs = [...queryArgs, pageSize, offset];
    const [dbAuditLogs] = await pool.query(`SELECT * FROM audit_logs${auditLogFilter} ORDER BY id DESC LIMIT ? OFFSET ?`, auditArgs) as any[];

    // Map to frontend expected formats
    const users = dbUsers.map((u: any) => {
      // Find primary tenant_user mapping (or just first one for simplicity)
      const tu = dbTenantUsers.find((tu: any) => tu.userId === u.id);
      let tenantId = 'TEN-00001';
      let role = 'SALES_REPRESENTATIVE';
      let roleName = 'Sales Representative';

      if (tu) {
        tenantId = tu.tenantId;
        const tur = dbTenantUserRoles.find((tur: any) => tur.tenantUserId === tu.id);
        if (tur) {
          const r = dbRoles.find((r: any) => r.id === tur.roleId);
          if (r) {
            role = r.name;
            roleName = r.description || r.name;
          }
        }
      }

      // Hack for Super Admin to bypass mapping if needed
      if (u.email.includes('super.admin')) {
        role = 'SUPER_ADMIN';
        roleName = 'Super Administrator';
        tenantId = 'SYSTEM';
      }

      const nameParts = u.name ? u.name.split(' ') : ['User'];

      return {
        id: u.id,
        tenantId: tenantId,
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' '),
        name: u.name,
        email: u.email,
        username: u.email.split('@')[0],
        phone: u.phone,
        avatarUrl: u.avatarUrl,
        role: role,
        roleName: roleName,
        department: u.department || 'Sales',
        position: 'Staff', // Just mock a position
        status: u.statusId || 'ACTIVE',
        lastLoginAt: u.lastLogin,
        createdAt: u.lastLogin // Fallback
      };
    });
    const customers = dbCustomers.map((c: any) => {
      const u = dbUsers.find((u: any) => u.id === c.picId);
      return {
        ...c,
        type: c.typeId,
        status: c.statusId,
        picName: u ? u.name : 'Unknown'
      };
    });

    const projects = dbProjects.map((p: any) => {
      const c = dbCustomers.find((c: any) => c.id === p.customerId);
      const u = dbUsers.find((u: any) => u.id === p.picId);
      return {
        id: p.id,
        tenantId: p.tenantId,
        customerId: p.customerId,
        customerName: c ? c.name : 'Unknown',
        customerCode: c ? c.code : '',
        picId: p.picId,
        picName: u ? u.name : 'Unknown',
        picAvatar: u ? u.avatarUrl : null,
        name: p.title || 'Untitled',
        estimatedValue: Number(p.value || 0),
        probability: Number(p.probability || 0),
        expectedCloseDate: p.expectedCloseDate,
        stage: p.stageId || 'LEAD',
        source: p.source,
        description: p.description,
        createdAt: p.createdAt
      };
    });

    const visits = dbVisits.map((v: any) => {
      const c = dbCustomers.find((c: any) => c.id === v.customerId);
      const u = dbUsers.find((u: any) => u.id === v.picId);
      return {
        ...v,
        status: v.statusId,
        purpose: v.purposeId,
        customerName: c ? c.name : 'Unknown',
        customerCode: c ? c.code : '',
        picName: u ? u.name : 'Unknown',
        picAvatar: u ? u.avatarUrl : null
      };
    });

    const tasks = dbTasks.map((t: any) => {
      const c = dbCustomers.find((c: any) => c.id === t.customerId);
      const u = dbUsers.find((u: any) => u.id === t.assigneeId);
      return {
        ...t,
        status: t.statusId,
        customerName: c ? c.name : 'Unknown',
        assigneeName: u ? u.name : 'Unknown',
        assigneeAvatar: u ? u.avatarUrl : null
      };
    });

    const activities = dbActivities.map((a: any) => {
      const c = dbCustomers.find((c: any) => c.id === a.customerId);
      const u = dbUsers.find((u: any) => u.id === a.userId);
      return {
        ...a,
        customerName: c ? c.name : 'Unknown',
        userName: u ? u.name : 'Unknown',
        userAvatar: u ? u.avatarUrl : null
      };
    });

    const salesTargets = dbSalesTargets.map((st: any) => {
      const u = dbUsers.find((u: any) => u.id === st.userId);
      return {
        ...st,
        userName: u ? u.name : 'Unknown'
      };
    });

    res.json({
      tenants: dbTenants,
      users: users,
      customers: customers,
      visits: visits,
      tasks: tasks,
      activities: activities,
      salesTargets: salesTargets,
      auditLogs: dbAuditLogs,
      projects: projects,
      _pagination: {
        page,
        pageSize,
        maxPageSize: SYNC_MAX_PAGE_SIZE,
      }
    });
  } catch (err: any) {
    console.error('Error in /api/sync/all:', err.message);
    res.status(500).json({ error: 'Failed to sync data' });
  }
});

// Helper for sending responses
const sendRes = (res: express.Response, promise: Promise<any>) => {
  promise
    .then(data => res.json(data))
    .catch(err => {
      console.error('[sendRes error]', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    });
};


const criticalTables = ['users', 'tenant_users', 'tenant_user_roles', 'roles', 'tenants', 'role_permissions', 'role_assignment_policies'];
const tenantSpecificTables = [
  'users', 'tenant_users', 'roles', 'departments', 'positions',
  'customers', 'visits', 'tasks', 'projects', 'activities', 'follow_ups', 'sales_targets', 'reports', 'audit_logs', 'notifications'
];

const setupEndpoint = (table: string) => {
  // GET all or by tenant
  app.get(`/api/${table}`, (req, res) => {
    const actorTenant = (req as any).userTenantId;
    
    // Special handling for users table which links to tenant via tenant_users
    if (table === 'users') {
      let query = `
        SELECT u.*, tu.tenantId, tu.isPrimary, r.id as role, r.name as roleName
        FROM users u
        LEFT JOIN tenant_users tu ON tu.userId = u.id AND tu.isPrimary = true
        LEFT JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
        LEFT JOIN roles r ON r.id = tur.roleId
      `;
      const params: any[] = [];
      if (actorTenant !== 'SYSTEM') {
        query += ' WHERE tu.tenantId = ?';
        params.push(actorTenant);
      } else {
        const { tenantId } = req.query;
        if (tenantId && tenantId !== 'ALL' && tenantId !== 'SYSTEM') {
          query += ' WHERE tu.tenantId = ?';
          params.push(tenantId);
        }
      }
      sendRes(res, pool.query(query, params).then(([rows]) => rows));
      return;
    }

    // Special handling for roles table: system roles (tenantId IS NULL or tenantId = 'SYSTEM') like TENANT_ADMIN should always be included
    if (table === 'roles') {
      let query = `SELECT * FROM roles`;
      const params: any[] = [];
      if (actorTenant && actorTenant !== 'SYSTEM') {
        query += ' WHERE tenantId = ? OR tenantId IS NULL OR tenantId = "SYSTEM"';
        params.push(actorTenant);
      } else {
        const { tenantId } = req.query;
        if (tenantId && tenantId !== 'ALL' && tenantId !== 'SYSTEM') {
          query += ' WHERE tenantId = ? OR tenantId IS NULL OR tenantId = "SYSTEM"';
          params.push(tenantId);
        }
      }
      sendRes(res, pool.query(query, params).then(([rows]) => rows));
      return;
    }

    let query = `SELECT * FROM ${table}`;
    const params: any[] = [];
    if (tenantSpecificTables.includes(table)) {
      if (actorTenant !== 'SYSTEM') {
        query += ' WHERE tenantId = ?';
        params.push(actorTenant);
      } else {
        const { tenantId } = req.query;
        if (tenantId && tenantId !== 'ALL' && tenantId !== 'SYSTEM') {
          query += ' WHERE tenantId = ?';
          params.push(tenantId);
        }
      }
    }
    sendRes(res, pool.query(query, params).then(([rows]) => rows));
  });

  const getRequiredPermissions = (table: string) => {
    const map: Record<string, { base: string, own: string | null, ownerCol: string | null }> = {
      'customers': { base: 'MANAGE_CUSTOMERS', own: 'MANAGE_OWN_CUSTOMERS', ownerCol: 'picId' },
      'projects': { base: 'MANAGE_PROJECTS', own: 'MANAGE_OWN_PROJECTS', ownerCol: 'picId' },
      'tasks': { base: 'MANAGE_TASKS', own: 'MANAGE_OWN_TASKS', ownerCol: 'picId' },
      'visits': { base: 'MANAGE_TASKS', own: 'MANAGE_OWN_TASKS', ownerCol: 'picId' },
      'follow_ups': { base: 'MANAGE_TASKS', own: 'MANAGE_OWN_TASKS', ownerCol: 'picId' },
      'activities': { base: 'MANAGE_TASKS', own: 'MANAGE_OWN_TASKS', ownerCol: 'userId' },
      'sales_targets': { base: 'MANAGE_TENANT', own: null, ownerCol: null },
      'departments': { base: 'MANAGE_TENANT', own: null, ownerCol: null },
      'positions': { base: 'MANAGE_TENANT', own: null, ownerCol: null },
      'roles': { base: 'MANAGE_ROLES', own: null, ownerCol: null },
      'users': { base: 'MANAGE_USERS', own: null, ownerCol: null },
      'tenants': { base: 'MANAGE_TENANT', own: null, ownerCol: null },
      'tenant_users': { base: 'MANAGE_USERS', own: null, ownerCol: null },
      'task_priorities': { base: 'MANAGE_TENANT', own: null, ownerCol: null },
      'task_statuses': { base: 'MANAGE_TENANT', own: null, ownerCol: null },
      'project_stages': { base: 'MANAGE_TENANT', own: null, ownerCol: null },
      'visit_purposes': { base: 'MANAGE_TENANT', own: null, ownerCol: null },
      'customer_types': { base: 'MANAGE_TENANT', own: null, ownerCol: null },
      'customer_statuses': { base: 'MANAGE_TENANT', own: null, ownerCol: null },
      'activity_types': { base: 'MANAGE_TENANT', own: null, ownerCol: null }
    };
    return map[table] || { base: null, own: null, ownerCol: null };
  };

  const verifyCapability = (req: any, table: string): { allowed: boolean, restrictToOwn: boolean, ownerCol: string | null, error?: string } => {
    const actorPermissions = req.userPermissions || [];
    if (actorPermissions.includes('ALL')) return { allowed: true, restrictToOwn: false, ownerCol: null };
    
    // TENANT_ADMIN has MANAGE_TENANT, which acts as ALL for tenant-specific tables
    if (tenantSpecificTables.includes(table) && actorPermissions.includes('MANAGE_TENANT')) {
       return { allowed: true, restrictToOwn: false, ownerCol: null };
    }

    const perms = getRequiredPermissions(table);
    if (!perms.base) {
       return { allowed: false, restrictToOwn: false, ownerCol: null, error: 'Unknown table mapping.' };
    }

    if (actorPermissions.includes(perms.base)) {
       return { allowed: true, restrictToOwn: false, ownerCol: null };
    }

    if (perms.own && actorPermissions.includes(perms.own)) {
       return { allowed: true, restrictToOwn: true, ownerCol: perms.ownerCol };
    }

    return { allowed: false, restrictToOwn: false, ownerCol: null, error: `Forbidden. Requires ${perms.base} capability.` };
  };

  // POST (Create)
  app.post(`/api/${table}`, async (req, res) => {
    if (criticalTables.includes(table)) {
      return res.status(403).json({ error: 'Access denied. Critical tables cannot be mutated via dynamic CRUD.' });
    }

    const authZ = verifyCapability(req, table);
    if (!authZ.allowed) {
      return res.status(403).json({ error: authZ.error });
    }

    try {
      const data = req.body;
      const actorTenant = (req as any).userTenantId;

      const actorUserId = (req as any).userId;
      // Force tenant ownership
      if (tenantSpecificTables.includes(table) && actorTenant !== 'SYSTEM') {
        data.tenantId = actorTenant;
      }
      if (authZ.restrictToOwn && authZ.ownerCol) {
        data[authZ.ownerCol] = actorUserId;
      }
      
      // Hash password if inserting into users table
      if (table === 'users' && data.passwordHash) {
        const salt = await bcrypt.genSalt(10);
        data.passwordHash = await bcrypt.hash(data.passwordHash, salt);
      }

      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map(() => '?').join(', ');
      
      const escapedKeys = keys.map(k => mysql.escapeId(k));
      const query = `INSERT INTO ${table} (${escapedKeys.join(', ')}) VALUES (${placeholders})`;
      await pool.query(query, values);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error(`Error POST ${table}:`, err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // PUT (Update)
  app.put(`/api/${table}/:id`, async (req, res) => {
    if (criticalTables.includes(table) && table !== 'tenants') {
      return res.status(403).json({ error: 'Access denied. Critical tables cannot be mutated via dynamic CRUD.' });
    }

    const authZ = verifyCapability(req, table);
    if (!authZ.allowed) {
      return res.status(403).json({ error: authZ.error });
    }

    const actorTenant = (req as any).userTenantId;
    const actorRole = (req as any).userRole;
    try {
      const id = req.params.id;
      const data = req.body;
      
      // Ownership check for BOLA protection
      if (table === 'tenants' && actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM') {
        if (id !== actorTenant) {
          return res.status(403).json({ error: 'Cross-tenant mutation forbidden (BOLA).' });
        }
      } else if (tenantSpecificTables.includes(table) && actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM') {
        const [existing]: any = await pool.query(`SELECT tenantId FROM ${table} WHERE id = ?`, [id]);
        if (existing.length === 0) {
          return res.status(404).json({ error: 'Record not found' });
        }
        if (existing[0].tenantId !== actorTenant) {
          return res.status(403).json({ error: 'Cross-tenant mutation forbidden (BOLA).' });
        }
        data.tenantId = actorTenant; // prevent forging
      }

      // Hash password if updating users table and passwordHash is provided
      if (table === 'users' && data.passwordHash && !data.passwordHash.startsWith('$2a$')) {
        const salt = await bcrypt.genSalt(10);
        data.passwordHash = await bcrypt.hash(data.passwordHash, salt);
      }

      const keys = Object.keys(data).filter(k => k !== 'id');
      const values = keys.map(k => data[k]);
      const setClause = keys.map(k => `${mysql.escapeId(k)} = ?`).join(', ');

      let query = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
      const queryValues = [...values, id];
      
      const actorUserId = (req as any).userId;
      if (tenantSpecificTables.includes(table) && actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM') {
         query += ' AND tenantId = ?';
         queryValues.push(actorTenant);
      }
      if (authZ.restrictToOwn && authZ.ownerCol) {
         query += ` AND ${authZ.ownerCol} = ?`;
         queryValues.push(actorUserId);
         data[authZ.ownerCol] = actorUserId; // force body not to bypass
      }
      
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      try {
        const [result]: any = await connection.query(query, queryValues);
        
        if (table === 'tenants' && data.status === 'SUSPENDED') {
          await connection.query(
            `UPDATE auth_sessions SET expiresAt = NOW() WHERE userId IN (SELECT userId FROM tenant_users WHERE tenantId = ?)`, 
            [id]
          );
        }
        await connection.commit();
        if (result.affectedRows === 0) {
           return res.status(404).json({ error: 'Not found or forbidden' });
        }
        res.json({ success: true, id, data });
      } catch(err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } catch (err: any) {
      console.error(`Error PUT ${table}:`, err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  // DELETE
  app.delete(`/api/${table}/:id`, async (req, res) => {
    if (criticalTables.includes(table)) {
      return res.status(403).json({ error: 'Access denied. Critical tables cannot be mutated via dynamic CRUD.' });
    }

    const authZ = verifyCapability(req, table);
    if (!authZ.allowed) {
      return res.status(403).json({ error: authZ.error });
    }

    const actorTenant = (req as any).userTenantId;
    const actorRole = (req as any).userRole;
    try {
      const id = req.params.id;
      
      // Ownership check for BOLA protection
      if (tenantSpecificTables.includes(table) && actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM') {
        const [existing]: any = await pool.query(`SELECT tenantId FROM ${table} WHERE id = ?`, [id]);
        if (existing.length === 0) {
          return res.status(404).json({ error: 'Record not found' });
        }
        if (existing[0].tenantId !== actorTenant) {
          return res.status(403).json({ error: 'Cross-tenant mutation forbidden (BOLA).' });
        }
      }

      let query = `DELETE FROM ${table} WHERE id = ?`;
      const values = [id];
      const actorUserId = (req as any).userId;
      if (tenantSpecificTables.includes(table) && actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM') {
         query += ' AND tenantId = ?';
         values.push(actorTenant);
      }
      if (authZ.restrictToOwn && authZ.ownerCol) {
         query += ` AND ${authZ.ownerCol} = ?`;
         values.push(actorUserId);
      }

      const [result]: any = await pool.query(query, values);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Not found or forbidden' });
      }
      res.json({ success: true, id });
    } catch (err: any) {
      console.error(`Error DELETE ${table}:`, err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
};

const tables = [
  'tenants', 'users', 'follow_ups', 'notifications',
  'customers', 'projects', 'tasks', 'visits', 'activities', 'sales_targets', 'audit_logs',
  'task_priorities', 'task_statuses', 'project_stages', 'visit_purposes', 'visit_statuses',
  'activity_types', 'customer_types', 'customer_statuses', 'departments', 'positions',
  'roles', 'permissions', 'role_permissions', 'role_data_scopes'
];



// Advanced Tenants Endpoint (Overrides generic GET /api/tenants)
app.get('/api/tenants', async (req, res) => {
  
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;
  
  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  // A global tenant listing requires global capability (e.g. SUPER_ADMIN or ALL)
  // If the actor is TENANT_ADMIN (tenant-scoped), they should only see their own tenant.
  if (actorRole !== 'SUPER_ADMIN' && !actorPermissions.includes('ALL')) {
    // Force them to only query their own tenant
    req.query.search = '';
    req.query.type = 'ALL';
    req.query.status = 'ALL';
  }

  // Prevent aggressive browser caching of JSON responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    let { search, type, status, startDate, endDate, page = '1', pageSize = '10' } = req.query;
    let queryArgs: any[] = [];
    let whereClauses: string[] = ['1=1'];
    
    if (actorRole !== 'SUPER_ADMIN' && !actorPermissions.includes('ALL')) {
       whereClauses.push('id = ?');
       queryArgs.push(actorTenant);
    } else {
      if (search) {
        whereClauses.push('(name LIKE ? OR code LIKE ? OR industry LIKE ?)');
        const like = `%${search}%`;
        queryArgs.push(like, like, like);
      }
      if (type && type !== 'ALL') {
        whereClauses.push('type = ?');
        queryArgs.push(type);
      }
      if (status && status !== 'ALL') {
        whereClauses.push('status = ?');
        queryArgs.push(status);
      }
      if (startDate && endDate) {
        whereClauses.push('createdAt >= ? AND createdAt < DATE_ADD(?, INTERVAL 1 DAY)');
        queryArgs.push(String(startDate), String(endDate));
      }
    }
    
    const whereStr = whereClauses.join(' AND ');
    
    const [countRows]: any = await pool.query(`SELECT COUNT(*) as total FROM tenants WHERE ${whereStr}`, queryArgs);
    const total = countRows[0].total || 0;

    const rawPage = parseInt(page as string, 10);
    const rawSize = parseInt(pageSize as string, 10);
    const pageNum = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const sizeNum = isNaN(rawSize) || rawSize < 1 ? 10 : Math.min(rawSize, 500);
    const offset = (pageNum - 1) * sizeNum;
    
    const [items]: any = await pool.query(`
      SELECT t.*, 
        (SELECT COUNT(DISTINCT userId) FROM tenant_users tu WHERE tu.tenantId = t.id AND tu.status = 'ACTIVE') as userCount
      FROM tenants t
      WHERE ${whereStr}
      ORDER BY t.createdAt DESC, t.id DESC
      LIMIT ? OFFSET ?
    `, [...queryArgs, sizeNum, offset]);
    
    res.json({
      success: true,
      items: items,
      total: total,
      page: pageNum,
      pageSize: sizeNum,
      totalPages: Math.ceil(total / sizeNum)
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// KPI Stats Endpoint (Must be defined BEFORE /api/tenants/:id to avoid route collision)
app.get('/api/tenants/stats', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;
  
  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });
  
  // Global stats are strictly for actors with ALL capability or SUPER_ADMIN role
  if (actorRole !== 'SUPER_ADMIN' && !actorPermissions.includes('ALL')) {
     return res.status(403).json({ error: 'Global statistics require global capabilities.' });
  }

  try {
    const [tenantsCount]: any = await pool.query(`
      SELECT 
        COUNT(*) as total, 
        SUM(CASE WHEN status = "ACTIVE" THEN 1 ELSE 0 END) as active, 
        SUM(CASE WHEN status = "SUSPENDED" THEN 1 ELSE 0 END) as suspended, 
        SUM(CASE WHEN status = "INACTIVE" THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN status = "PENDING" THEN 1 ELSE 0 END) as pending
      FROM tenants
    `);
    
    // Total users and active users from authoritative users table
    const [usersCount]: any = await pool.query(`
      SELECT 
        COUNT(DISTINCT id) as totalUsers,
        COUNT(DISTINCT CASE WHEN status = 'ACTIVE' THEN id END) as activeUsers,
        COUNT(DISTINCT CASE WHEN status = 'INACTIVE' THEN id END) as inactiveUsers,
        COUNT(DISTINCT CASE WHEN status = 'SUSPENDED' THEN id END) as suspendedUsers,
        COUNT(DISTINCT CASE WHEN status IS NULL OR status NOT IN ('ACTIVE', 'INACTIVE', 'SUSPENDED') THEN id END) as unknownUsers
      FROM users
    `);
    
    const totalTenants = parseInt(tenantsCount[0].total || 0, 10);
    const activeTenants = parseInt(tenantsCount[0].active || 0, 10);
    const suspendedTenants = parseInt(tenantsCount[0].suspended || 0, 10);
    const inactiveTenants = parseInt(tenantsCount[0].inactive || 0, 10);
    const pendingTenants = parseInt(tenantsCount[0].pending || 0, 10);

    const totalUsers = parseInt(usersCount[0].totalUsers || 0, 10);
    const activeUsers = parseInt(usersCount[0].activeUsers || 0, 10);
    const inactiveUsers = parseInt(usersCount[0].inactiveUsers || 0, 10);
    const suspendedUsers = parseInt(usersCount[0].suspendedUsers || 0, 10);
    const unknownUsers = parseInt(usersCount[0].unknownUsers || 0, 10);

    // Invariant check: activeUsers must never exceed totalUsers
    if (activeUsers > totalUsers) {
      console.warn(`[WARN /api/tenants/stats] Invariant violated: activeUsers (${activeUsers}) > totalUsers (${totalUsers})`);
    }

    res.json({
      success: true,
      data: {
        total: totalTenants,
        active: activeTenants,
        suspended: suspendedTenants,
        inactive: inactiveTenants,
        pending: pendingTenants,
        totalUsers: totalUsers,
        activeUsers: Math.min(activeUsers, totalUsers),
        inactiveUsers: inactiveUsers,
        suspendedUsers: suspendedUsers,
        unknownUsers: unknownUsers,
        userStatus: {
          ACTIVE: activeUsers,
          INACTIVE: inactiveUsers,
          SUSPENDED: suspendedUsers,
          UNKNOWN: unknownUsers
        }
      }
    });
  } catch (err: any) {
    console.error('Error GET /api/tenants/stats:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Explicit GET Single Tenant Detail by ID
app.get('/api/tenants/:id', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;
  const targetId = req.params.id;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  // Tenant Isolation / BOLA check: Ordinary tenant users can only access their own tenant
  if (actorRole !== 'SUPER_ADMIN' && !actorPermissions.includes('ALL') && actorTenant !== targetId) {
    return res.status(403).json({ error: 'Cross-tenant access forbidden (BOLA).' });
  }

  try {
    const [rows]: any = await pool.query('SELECT * FROM tenants WHERE id = ?', [targetId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tenant Not Found' });
    }
    const tenantRecord = { ...rows[0] };

    // Tenant-scoped User Statistics
    const [userStatsRows]: any = await pool.query(`
      SELECT 
        COUNT(DISTINCT tu.userId) as total,
        COUNT(DISTINCT CASE WHEN tu.status = 'ACTIVE' THEN tu.userId END) as active,
        COUNT(DISTINCT CASE WHEN tu.status = 'SUSPENDED' THEN tu.userId END) as suspended,
        COUNT(DISTINCT CASE WHEN tu.status = 'INACTIVE' THEN tu.userId END) as inactive
      FROM tenant_users tu
      WHERE tu.tenantId = ?
    `, [targetId]);

    const userStats = {
      total: parseInt(userStatsRows[0]?.total || 0, 10),
      active: parseInt(userStatsRows[0]?.active || 0, 10),
      suspended: parseInt(userStatsRows[0]?.suspended || 0, 10),
      inactive: parseInt(userStatsRows[0]?.inactive || 0, 10)
    };

    // Tenant-scoped Organization Statistics
    const [deptRows]: any = await pool.query('SELECT COUNT(*) as count FROM departments WHERE tenantId = ?', [targetId]);
    const [teamRows]: any = await pool.query('SELECT COUNT(*) as count FROM teams WHERE tenantId = ?', [targetId]);
    const [roleRows]: any = await pool.query('SELECT COUNT(*) as count FROM roles WHERE tenantId = ? OR tenantId IS NULL OR tenantId = "SYSTEM"', [targetId]);
    const [salesRepRows]: any = await pool.query(`
      SELECT COUNT(DISTINCT tu.userId) as count 
      FROM tenant_users tu 
      JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id 
      WHERE tu.tenantId = ? AND tur.roleId = 'SALES_REPRESENTATIVE'
    `, [targetId]);

    const organizationStats = {
      departments: parseInt(deptRows[0]?.count || 0, 10),
      teams: parseInt(teamRows[0]?.count || 0, 10),
      roles: parseInt(roleRows[0]?.count || 0, 10),
      salesReps: parseInt(salesRepRows[0]?.count || 0, 10)
    };

    // Tenant-scoped Primary Administrator
    const [adminRows]: any = await pool.query(`
      SELECT u.id, u.name, u.email, u.status, u.lastLoginAt, COALESCE(r.name, 'Tenant Administrator') as role
      FROM tenant_users tu
      JOIN users u ON u.id = tu.userId
      LEFT JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
      LEFT JOIN roles r ON r.id = tur.roleId
      WHERE tu.tenantId = ? AND (tur.roleId = 'TENANT_ADMIN' OR tu.isPrimary = 1)
      LIMIT 1
    `, [targetId]);

    let primaryAdmin = null;
    if (adminRows.length > 0) {
      primaryAdmin = {
        id: adminRows[0].id,
        name: adminRows[0].name,
        email: adminRows[0].email,
        status: adminRows[0].status || 'ACTIVE',
        role: adminRows[0].role || 'Tenant Administrator',
        lastLoginAt: adminRows[0].lastLoginAt
      };
      tenantRecord.primaryAdminId = adminRows[0].id;
      tenantRecord.primaryAdminName = adminRows[0].name;
      tenantRecord.primaryAdminEmail = adminRows[0].email;
    }

    // Tenant-scoped Recent Activity
    const [auditRows]: any = await pool.query(`
      SELECT a.id, a.action, a.module, a.entity, a.entityId, a.description, a.timestamp, u.name as userName
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.userId
      WHERE a.tenantId = ?
      ORDER BY a.timestamp DESC
      LIMIT 5
    `, [targetId]);

    const recentActivity = (auditRows || []).map((a: any) => ({
      id: a.id,
      action: a.action,
      entity: a.entity,
      description: a.description,
      userName: a.userName || 'System',
      timestamp: a.timestamp
    }));

    // Last activity timestamp
    if (recentActivity.length > 0 && recentActivity[0].timestamp) {
      tenantRecord.lastActivityAt = new Date(recentActivity[0].timestamp).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } else {
      tenantRecord.lastActivityAt = 'No recent activity';
    }

    tenantRecord.userStats = userStats;
    tenantRecord.organizationStats = organizationStats;
    tenantRecord.primaryAdmin = primaryAdmin;
    tenantRecord.recentActivity = recentActivity;

    res.json(tenantRecord);
  } catch (err: any) {
    console.error('Error GET /api/tenants/:id:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/api/roles/assignable', async (req, res) => {
  const actorRole = (req as any).userRole;
  if (!actorRole) return res.status(403).json({ error: 'Unauthorized' });

  const assignableRoleIds = await getAssignableRoles(pool, actorRole);
  if (assignableRoleIds.length === 0) return res.json([]);
  
  const placeholders = assignableRoleIds.map(() => '?').join(',');
  try {
    const [roles] = await pool.query(
      `SELECT r.id, r.name, COALESCE(rds.scope, 'TEAM') as scope 
       FROM roles r 
       LEFT JOIN role_data_scopes rds ON r.id = rds.roleId 
       WHERE r.id IN (${placeholders})`, 
      assignableRoleIds
    );
    res.json(roles);
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});


// Declarative Critical Endpoints
app.post('/api/tenant/users', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;
  const { email, password, name, roleId } = req.body;
  
  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });
  
  // Enforce Tenant Isolation (if actor is TENANT scoped, target tenant must be actor's tenant)
  let targetTenant = req.body.tenantId || actorTenant;
  if (actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM' && targetTenant !== actorTenant) {
     return res.status(403).json({ error: 'Cross-tenant user creation forbidden.' });
  }

  const assignable = await getAssignableRoles(pool, actorRole);
  if (!assignable.includes(roleId)) {
    return res.status(403).json({ error: 'Role assignment not permitted by policy.' });
  }
  
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const userId = 'USR-' + Date.now();
    const hash = await bcrypt.hash(password || 'Password123', 10);
    await connection.query('INSERT INTO users (id, email, passwordHash, name) VALUES (?, ?, ?, ?)', [userId, email, hash, name]);
    
    const tenantUserId = 'TU-' + Date.now();
    await connection.query('INSERT INTO tenant_users (id, tenantId, userId, isPrimary) VALUES (?, ?, ?, 1)', [tenantUserId, targetTenant, userId]);
    
    await connection.query('INSERT INTO tenant_user_roles (id, tenantUserId, roleId) VALUES (?, ?, ?)', ['TUR-' + Date.now(), tenantUserId, roleId]);
    
    await connection.commit();
    res.json({ success: true, userId });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ error: 'User creation failed. Please try again.' });
  } finally {
    connection.release();
  }
});

app.put('/api/tenant/users/:id/roles', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const targetUserId = req.params.id;
  const { roleId } = req.body;

  if (!actorRole || !actorTenant) return res.status(401).json({ error: 'Unauthorized' });

  const assignable = await getAssignableRoles(pool, actorRole);
  if (!assignable.includes(roleId)) {
    return res.status(403).json({ error: 'Role assignment not permitted by policy.' });
  }

  // Cross tenant check for actor (Super Admin can do it across all tenants, others restricted to their own tenant)
  if (actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM') {
    const [targetRows]: any = await pool.query('SELECT tenantId FROM tenant_users WHERE userId = ?', [targetUserId]);
    if (targetRows.length === 0 || targetRows[0].tenantId !== actorTenant) {
      return res.status(403).json({ error: 'Cross-tenant role modification forbidden.' });
    }
  }

  // Self escalation check
  if (targetUserId === (req as any).userId) {
     return res.status(403).json({ error: 'Cannot modify own role to escalate privileges.' });
  }

  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const [tuRows]: any = await pool.query('SELECT id FROM tenant_users WHERE userId = ?', [targetUserId]);
    if (tuRows.length > 0) {
       await connection.query('UPDATE tenant_user_roles SET roleId = ? WHERE tenantUserId = ?', [roleId, tuRows[0].id]);
    }
    await connection.commit();
    res.json({ success: true });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    connection.release();
  }
});

tables.forEach(table => setupEndpoint(table));

  // Custom Endpoint for Tenant Onboarding
  app.post('/api/onboarding/tenant', async (req, res) => {
    // Only SUPER_ADMIN (or users with ALL capability) can onboard new tenants
    const perms = (req as any).userPermissions || [];
    if (!perms.includes('ALL') && !perms.includes('MANAGE_TENANT')) {
       return res.status(403).json({ error: 'Access denied. Only system administrators can onboard tenants.' });
    }

    try {
      const { tenant, user, adminPassword } = req.body;
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        // 1. Insert Tenant
        const t = tenant;
        await connection.query(
          `INSERT INTO tenants (id, name, code, status, createdAt, type, trialEndDate, email, industry, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [t.id, t.name, t.code, t.status, t.createdAt, t.type, t.trialEndDate || null, t.email, t.industry, t.phone]
        );

        // 2. Hash Password & Insert User
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(adminPassword, salt);
        const u = user;
        await connection.query(
          `INSERT INTO users (id, email, name, passwordHash, avatar, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [u.id, u.email, u.name, passwordHash, u.avatarUrl || null, 'ACTIVE', u.createdAt]
        );

        // 3. Insert Tenant_User
        const tuId = `TU-${Date.now()}`;
        await connection.query(
          `INSERT INTO tenant_users (id, tenantId, userId, isPrimary, status, joinedAt) VALUES (?, ?, ?, ?, ?, ?)`,
          [tuId, t.id, u.id, true, 'ACTIVE', u.createdAt]
        );

        // 4. Use Canonical Role
        const roleId = 'TENANT_ADMIN';
        const [existingRole]: any = await connection.query('SELECT id FROM roles WHERE id = ?', [roleId]);
        if (existingRole.length === 0) {
          await connection.query('INSERT INTO roles (id, tenantId, name, description, isSystem) VALUES (?, ?, ?, ?)', [roleId, 'SYSTEM', 'Tenant Administrator', 'System Default', true]);
        }

        // 5. Assign Role to User
        await connection.query(
          `INSERT INTO tenant_user_roles (id, tenantUserId, roleId) VALUES (?, ?, ?)`,
          [`TUR-${Date.now()}`, tuId, roleId]
        );

        await connection.commit();
        res.json({ success: true });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } catch (err: any) {
      console.error('Error onboarding tenant:', err);
      res.status(500).json({ error: 'Tenant onboarding failed. Please try again.' });
    }
  });

  // Custom Endpoint for Role Permissions and Scopes Update
  app.post('/api/roles/:id/permissions_scopes', async (req, res) => {
    const targetRoleId = req.params.id;
    const { permissions, dataScope } = req.body;
    const actorRole = (req as any).userRole;
    const actorTenant = (req as any).userTenantId;
    const actorPermissions = (req as any).userPermissions || [];
    
    if (!actorRole || !actorTenant) return res.status(401).json({ error: 'Unauthorized' });
    
    // Privilege Escalation Protection
    if (!actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_ROLES')) {
      return res.status(403).json({ error: 'Forbidden. Requires MANAGE_ROLES capability.' });
    }
    
    // Self Escalation Protection
    if (targetRoleId === actorRole) {
      return res.status(403).json({ error: 'Forbidden. Cannot modify own role permissions.' });
    }

    // Capability Delegation Enforcement (ACTOR AUTHORITY >= DELEGATED AUTHORITY)
    const sensitiveCapabilities = ['ALL', 'MANAGE_TENANT', 'MANAGE_ROLES', 'MANAGE_USERS', 'MANAGE_CUSTOMERS', 'MANAGE_PROJECTS', 'MANAGE_TASKS'];
    if (permissions && Array.isArray(permissions)) {
      for (const p of permissions) {
        if (sensitiveCapabilities.includes(p) && !actorPermissions.includes('ALL') && !actorPermissions.includes(p)) {
          return res.status(403).json({ error: `Forbidden. Cannot delegate capability: ${p} which actor does not possess.` });
        }
      }
    }
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      // Cross-Tenant Role Modification Protection
      const [roleRows]: any = await connection.query('SELECT tenantId FROM roles WHERE id = ?', [targetRoleId]);
      if (roleRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Role not found.' });
      }
      const targetRoleTenant = roleRows[0].tenantId;
      if (targetRoleTenant !== actorTenant) {
         if (actorRole !== 'SUPER_ADMIN' && !actorPermissions.includes('ALL')) {
           await connection.rollback();
           return res.status(403).json({ error: 'Forbidden. Cross-tenant or global role modification requires ALL capability.' });
         }
      }

      // Prevent modifying SUPER_ADMIN unless actor is SUPER_ADMIN (or ALL)
      if (targetRoleId === 'SUPER_ADMIN' && !actorPermissions.includes('ALL')) {
        await connection.rollback();
        return res.status(403).json({ error: 'Forbidden. Cannot modify SUPER_ADMIN.' });
      }

      // 1. Update Permissions
      await connection.query('DELETE FROM role_permissions WHERE roleId = ?', [targetRoleId]);
      if (permissions && permissions.length > 0) {
        for (const p of permissions) {
           await connection.query(`INSERT INTO role_permissions (roleId, permission) VALUES (?, ?)`, [targetRoleId, p]);
        }
      }

      // 2. Update Scope
      await connection.query('DELETE FROM role_data_scopes WHERE roleId = ?', [targetRoleId]);
      if (dataScope) {
        await connection.query(`INSERT INTO role_data_scopes (id, roleId, scope) VALUES (?, ?, ?)`, [`RDS-${Date.now()}`, targetRoleId, dataScope]);
      }

      await connection.commit();
      res.json({ success: true });
    } catch (err: any) {
      await connection.rollback();
      console.error('Error updating role permissions:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } finally {
      connection.release();
    }
  });

// --- AUTHENTICATION ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    
    // 400 Validation
    if (!email || !email.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        code: 'VALIDATION_ERROR'
      });
    }
    
    const [userRows]: any = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim()]);
    if (userRows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    const user = userRows[0];
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Resolve authoritative user context (role, tenantId, permissions)
    const userContext = await resolveUserAccessContext(pool, user.id);

    // Check tenant status before session creation for tenant-scoped users
    if (userContext.tenantId && userContext.tenantId !== 'SYSTEM') {
      const [tenantRows]: any = await pool.query('SELECT status FROM tenants WHERE id = ?', [userContext.tenantId]);
      if (tenantRows.length > 0 && tenantRows[0].status === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          message: 'Account organization is suspended',
          code: 'TENANT_SUSPENDED'
        });
      }
    }
    
    // Create Session
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const sessionId = `SESS-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    await pool.query(
      'INSERT INTO auth_sessions (id, userId, token, ipAddress, userAgent) VALUES (?, ?, ?, ?, ?)',
      [sessionId, user.id, token, req.ip, req.headers['user-agent'] || '']
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, userId, action, module, description) VALUES (?, ?, ?, ?, ?)',
      [`LOG-${Date.now()}`, user.id, 'LOGIN', 'Auth', `User ${user.email} logged in`]
    );
    
    // Hydrate user payload with resolved access context
    user.role = userContext.roleId;
    user.roleName = userContext.roleName;
    user.tenantId = userContext.tenantId;
    user.permissions = userContext.permissions;

    res.json({ success: true, token, user });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '').trim();
      await pool.query('UPDATE auth_sessions SET expiresAt = NOW() WHERE token = ?', [token]);
      // Opportunistic session pruning of expired sessions older than 7 days
      await pool.query('DELETE FROM auth_sessions WHERE expiresAt < DATE_SUB(NOW(), INTERVAL 7 DAY)');
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    console.error('Logout error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const isTest = process.env.APP_ENV === 'test';
    const payload: any = {
      ok: true,
      environment: process.env.APP_ENV || process.env.NODE_ENV || 'development'
    };
    if (isTest) {
      const [rows] = await pool.query('SELECT DATABASE() as db');
      payload.database = (rows as any)[0].db;
      payload.instanceId = process.pid;
    }
    res.json(payload);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: 'Health check failed' });
  }
});

// Startup Guard
if (process.env.APP_ENV === 'test') {
  if (process.env.DB_NAME === 'db_salesflow_pro') {
    console.error('FATAL STARTUP GUARD: Cannot run test backend against db_salesflow_pro');
    process.exit(1);
  }
  if (process.env.DB_NAME !== 'db_salesflow_pro_test') {
    console.error('FATAL STARTUP GUARD: Test backend must use db_salesflow_pro_test');
    process.exit(1);
  }
}

const port = env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`[Startup] Backend started`);
  console.log(`[Startup] Database: ${env.DB_NAME}`);
  console.log(`[Startup] Environment: ${process.env.NODE_ENV || 'development'}`);
});
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

export const getAssignableRoles = async (pool: any, actorRoleId: string, actorTenantId?: string | null, targetTenantId?: string | null) => {
  try {
    // 0. Super Admin has full privilege to assign any tenant role
    if (actorRoleId === 'SUPER_ADMIN') {
      const tenantToQuery = targetTenantId || actorTenantId;
      if (tenantToQuery && tenantToQuery !== 'SYSTEM') {
        const [tenantRoleRows]: any = await pool.query(
          "SELECT id FROM roles WHERE tenantId = ? AND scope = 'TENANT'",
          [tenantToQuery]
        );
        return tenantRoleRows.map((r: any) => r.id);
      }
      const [allTenantRoles]: any = await pool.query("SELECT id FROM roles WHERE scope = 'TENANT'");
      return allTenantRoles.map((r: any) => r.id);
    }

    // 1. Direct match on role_assignment_policies
    const [rows]: any = await pool.query('SELECT assignableRoleId as roleId FROM role_assignment_policies WHERE assignerRoleId = ?', [actorRoleId]);
    let assignableIds = rows.map((r: any) => r.roleId);

    // 2. If actor is Tenant Admin (or has MANAGE_ROLES / MANAGE_USERS capability in tenant), they can assign all TENANT scoped roles in their tenant
    if (actorTenantId && (actorRoleId === 'TENANT_ADMIN' || actorRoleId.endsWith('-TENANT_ADMIN') || actorRoleId.startsWith('ROLE-'))) {
      const [tenantRoleRows]: any = await pool.query(
        "SELECT id FROM roles WHERE tenantId = ? AND scope = 'TENANT'",
        [actorTenantId]
      );
      const tenantRoleIds = tenantRoleRows.map((r: any) => r.id);
      assignableIds = Array.from(new Set([...assignableIds, ...tenantRoleIds]));
    }

    return assignableIds;
  } catch (e) {
    console.warn('[AUTH FALLBACK] role_assignment_policies query error:', e);
    return [];
  }
};

/**
 * Capability-based administrative continuity check.
 * Counts ACTIVE tenant users whose active assigned role contains all three:
 * MANAGE_TENANT, MANAGE_USERS, and MANAGE_ROLES.
 */
export const countActiveTenantAdmins = async (connectionOrPool: any, tenantId: string, excludeUserId?: string): Promise<number> => {
  const params: any[] = [tenantId];
  let query = `
    SELECT COUNT(DISTINCT tu.id) as adminCount
    FROM tenant_users tu
    JOIN users u ON u.id = tu.userId
    JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
    JOIN role_permissions rp1 ON rp1.roleId = tur.roleId AND rp1.permission = 'MANAGE_TENANT'
    JOIN role_permissions rp2 ON rp2.roleId = tur.roleId AND rp2.permission = 'MANAGE_USERS'
    JOIN role_permissions rp3 ON rp3.roleId = tur.roleId AND rp3.permission = 'MANAGE_ROLES'
    WHERE tu.tenantId = ?
      AND tu.status = 'ACTIVE'
      AND u.status = 'ACTIVE'
  `;

  if (excludeUserId) {
    query += ' AND tu.userId != ?';
    params.push(excludeUserId);
  }

  const [rows]: any = await connectionOrPool.query(query, params);
  return rows[0]?.adminCount || 0;
};

/**
 * Authoritative assignable tenant user validation.
 * Verifies that the requested user has an ACTIVE global identity
 * AND an ACTIVE tenant membership within the specified tenantId.
 */
export const validateAssignableTenantUser = async (connectionOrPool: any, tenantId: string, userId: string): Promise<{ valid: boolean, error?: string, code?: string }> => {
  if (!userId) return { valid: false, error: 'User ID is required.', code: 'MISSING_USER_ID' };

  const [rows]: any = await connectionOrPool.query(`
    SELECT u.id, u.status as userGlobalStatus, tu.status as tenantUserStatus, tu.tenantId
    FROM users u
    JOIN tenant_users tu ON tu.userId = u.id
    WHERE u.id = ? AND tu.tenantId = ?
  `, [userId, tenantId]);

  if (rows.length === 0) {
    return {
      valid: false,
      error: 'Selected user is not a member of this organization.',
      code: 'INVALID_PIC_FOR_TENANT'
    };
  }

  const record = rows[0];
  if (record.userGlobalStatus === 'SUSPENDED') {
    return {
      valid: false,
      error: 'Selected user identity is globally suspended.',
      code: 'USER_SUSPENDED'
    };
  }

  if (record.tenantUserStatus === 'SUSPENDED') {
    return {
      valid: false,
      error: 'Selected user membership in this organization is suspended.',
      code: 'MEMBERSHIP_SUSPENDED'
    };
  }

  if (record.tenantUserStatus !== 'ACTIVE' || record.userGlobalStatus !== 'ACTIVE') {
    return {
      valid: false,
      error: 'Selected user is not active in this organization.',
      code: 'USER_NOT_ACTIVE'
    };
  }

  return { valid: true };
};

/**
 * Authoritative user access context resolution.
 * Supports both platform users (global roles with no tenant membership)
 * and tenant users (scoped roles through tenant_users).
 */
export const resolveUserAccessContext = async (pool: any, userId: string) => {
  // 0. Fetch Global Identity
  const [globalUserRows]: any = await pool.query('SELECT id, email, name, status FROM users WHERE id = ?', [userId]);
  const userGlobalStatus = globalUserRows.length > 0 ? (globalUserRows[0].status || 'ACTIVE') : 'ACTIVE';

  // 1. Check if user has tenant membership
  const [membershipRows]: any = await pool.query(`
    SELECT tu.id as tenantUserId, tu.tenantId, tu.status as tenantUserStatus, tur.roleId, r.name as roleName, r.scope
    FROM tenant_users tu
    LEFT JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
    LEFT JOIN roles r ON r.id = tur.roleId
    WHERE tu.userId = ? AND tu.isPrimary = true
  `, [userId]);

  let tenantId: string | null = null;
  let tenantUserId: string | null = null;
  let tenantUserStatus: string = 'ACTIVE';
  let roleId: string | null = null;
  let roleName: string | null = null;
  let isPlatformUser = false;

  if (membershipRows.length > 1) {
    console.error(`[RBAC_INTEGRITY_ERROR] RBAC_ROLE_CARDINALITY_VIOLATION: User ${userId} has ${membershipRows.length} role assignments in primary tenant.`);
  }

  if (membershipRows.length > 0 && membershipRows[0].tenantId && membershipRows[0].tenantId !== 'SYSTEM') {
    tenantId = membershipRows[0].tenantId;
    tenantUserId = membershipRows[0].tenantUserId;
    tenantUserStatus = membershipRows[0].tenantUserStatus || 'ACTIVE';
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

  // 3. Resolve permissions & data scope
  let permissions: string[] = [];
  let dataScope: string = 'OWN';
  if (roleId) {
    try {
      const [permRows]: any = await pool.query('SELECT permission FROM role_permissions WHERE roleId = ?', [roleId]);
      permissions = permRows.map((r: any) => r.permission);

      const [scopeRows]: any = await pool.query('SELECT scope FROM role_data_scopes WHERE roleId = ?', [roleId]);
      if (scopeRows.length > 0) {
        dataScope = scopeRows[0].scope;
      } else {
        dataScope = isPlatformUser ? 'SYSTEM' : 'OWN';
      }
    } catch (e) {
      console.error('[AUTH] DB Error when loading permissions/scope for role:', roleId, e);
    }
  }

  return {
    tenantId,
    tenantUserId,
    userGlobalStatus,
    tenantUserStatus,
    roleId,
    roleName,
    permissions,
    dataScope,
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

    // 1. Global Identity Suspension Check (applies everywhere, including platform users)
    if (userContext.userGlobalStatus === 'SUSPENDED') {
      return res.status(403).json({ error: 'User identity is suspended', code: 'USER_SUSPENDED' });
    }

    // 2. Tenant & Membership Status Checks for tenant-scoped users
    if (userContext.tenantId && userContext.tenantId !== 'SYSTEM') {
      if (userContext.tenantUserStatus === 'SUSPENDED') {
        return res.status(403).json({ error: 'Tenant membership is suspended', code: 'MEMBERSHIP_SUSPENDED' });
      }

      const [tenantRows]: any = await pool.query('SELECT status FROM tenants WHERE id = ?', [userContext.tenantId]);
      if (tenantRows.length > 0 && tenantRows[0].status === 'SUSPENDED') {
        return res.status(403).json({ error: 'Tenant is suspended', code: 'TENANT_SUSPENDED' });
      }
    }

    (req as any).userId = session.userId;
    (req as any).tenantUserId = userContext.tenantUserId;
    (req as any).userRole = userContext.roleId;
    (req as any).userTenantId = userContext.tenantId;
    (req as any).userPermissions = userContext.permissions;
    (req as any).userDataScope = userContext.dataScope;
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

    const [dbTeams] = await pool.query('SELECT * FROM teams' + tenantFilter, queryArgs) as any[];
    const [dbTeamMembers] = await pool.query('SELECT tm.* FROM team_members tm JOIN tenant_users tu ON tu.id = tm.tenantUserId' + tenantFilter, queryArgs) as any[];

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
        teamId: (() => {
          if (!tu) return undefined;
          const tm = dbTeamMembers.find((m: any) => m.tenantUserId === tu.id);
          return tm ? tm.teamId : undefined;
        })(),
        teamName: (() => {
          if (!tu) return undefined;
          const tm = dbTeamMembers.find((m: any) => m.tenantUserId === tu.id);
          if (!tm) return undefined;
          const t = dbTeams.find((team: any) => team.id === tm.teamId);
          return t ? t.name : undefined;
        })(),
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
      const { assignable } = req.query;
      let query = `
        SELECT u.id, u.email, u.name, u.avatar, u.createdAt, u.lastLoginAt,
               u.status as identityStatus,
               COALESCE(tu.status, u.status, 'ACTIVE') as status,
               COALESCE(tu.status, u.status, 'ACTIVE') as membershipStatus,
               tu.id as tenantUserId, tu.tenantId, tu.isPrimary,
               r.id as role, r.name as roleName,
               t.id as teamId, t.name as teamName, tm.role as teamRole
        FROM users u
        LEFT JOIN tenant_users tu ON tu.userId = u.id AND (tu.tenantId = ? OR tu.isPrimary = true)
        LEFT JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
        LEFT JOIN roles r ON r.id = tur.roleId
        LEFT JOIN team_members tm ON tm.tenantUserId = tu.id
        LEFT JOIN teams t ON t.id = tm.teamId
      `;
      const params: any[] = [];
      const tenantForJoin = (actorTenant && actorTenant !== 'SYSTEM') ? actorTenant : (req.query.tenantId || 'SYSTEM');
      params.push(tenantForJoin);

      const whereClauses: string[] = [];
      if (actorTenant !== 'SYSTEM') {
        whereClauses.push('tu.tenantId = ?');
        params.push(actorTenant);
      } else {
        const { tenantId } = req.query;
        if (tenantId && tenantId !== 'ALL' && tenantId !== 'SYSTEM') {
          whereClauses.push('tu.tenantId = ?');
          params.push(tenantId);
        }
      }

      // If assignable filter is requested (for new team/leader/PIC assignments), return only ACTIVE users with ACTIVE membership
      if (assignable === 'true' || assignable === '1') {
        whereClauses.push("u.status = 'ACTIVE'");
        whereClauses.push("tu.status = 'ACTIVE'");
      }

      if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
      }

      query += ' ORDER BY u.name ASC';
      sendRes(res, pool.query(query, params).then(([rows]) => rows));
      return;
    }

    // Special handling for roles table:
    // - Platform user (Super Admin): see platform roles + templates + (optionally specific tenant roles)
    // - Tenant user: see strictly their own tenant-owned roles (WHERE tenantId = actorTenant AND scope = 'TENANT')
    if (table === 'roles') {
      let query = `SELECT * FROM roles`;
      const params: any[] = [];
      if (actorTenant && actorTenant !== 'SYSTEM') {
        query += ' WHERE tenantId = ? AND scope = "TENANT"';
        params.push(actorTenant);
      } else {
        const { tenantId } = req.query;
        if (tenantId && tenantId !== 'ALL' && tenantId !== 'SYSTEM') {
          query += ' WHERE tenantId = ?';
          params.push(tenantId);
        }
      }
      sendRes(res, pool.query(query, params).then(([rows]) => rows));
      return;
    }

    // Special handling for permissions table:
    // - Platform user (Super Admin): see full catalog
    // - Tenant user: see tenant-assignable permissions
    if (table === 'permissions') {
      let query = `SELECT * FROM permissions`;
      const params: any[] = [];
      if (actorTenant && actorTenant !== 'SYSTEM') {
        query += ' WHERE isTenantAssignable = 1 AND status = "ACTIVE"';
      }
      query += ' ORDER BY category, module, name';
      sendRes(res, pool.query(query, params).then(([rows]) => rows));
      return;
    }

    let query = `SELECT * FROM ${table}`;
    const params: any[] = [];
    if (tenantSpecificTables.includes(table)) {
      if (actorTenant !== 'SYSTEM') {
        query += ' WHERE tenantId = ?';
        params.push(actorTenant);

        const actorUserId = (req as any).userId;
        const actorDataScope = (req as any).userDataScope || 'OWN';
        const actorPermissions = (req as any).userPermissions || [];
        const perms = getRequiredPermissions(table);

        // Check if table has resource ownership (picId / userId)
        if (perms.ownerCol && !actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_TENANT')) {
          if (actorDataScope === 'OWN') {
            query += ` AND ${perms.ownerCol} = ?`;
            params.push(actorUserId);
          } else if (actorDataScope === 'TEAM') {
            // Dynamic TEAM scope resolution:
            // Find all active tenant users in the same team as the actor
            query += ` AND ${perms.ownerCol} IN (
              SELECT tu.userId FROM tenant_users tu
              JOIN team_members tm ON tm.tenantUserId = tu.id
              WHERE tm.teamId IN (
                SELECT tm2.teamId FROM team_members tm2
                JOIN tenant_users tu2 ON tu2.id = tm2.tenantUserId
                WHERE tu2.userId = ? AND tu2.tenantId = ? AND tu2.status = 'ACTIVE'
              ) AND tu.tenantId = ? AND tu.status = 'ACTIVE'
            )`;
            params.push(actorUserId, actorTenant, actorTenant);
          } else if (actorDataScope === 'DEPARTMENT') {
            // Fail-safe for DEPARTMENT scope (HOLD state): deny operational records
            query += ` AND 1 = 0 /* DEPARTMENT_SCOPE_NOT_ACTIVE */`;
          }
        }
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

  // GET single record by ID with dataScope and tenant protection
  app.get(`/api/${table}/:id`, async (req, res) => {
    const actorTenant = (req as any).userTenantId;
    const actorRole = (req as any).userRole;
    const actorUserId = (req as any).userId;
    const actorDataScope = (req as any).userDataScope || 'OWN';
    const actorPermissions = (req as any).userPermissions || [];
    const id = req.params.id;

    try {
      let query = `SELECT * FROM ${table} WHERE id = ?`;
      const params: any[] = [id];

      if (tenantSpecificTables.includes(table) && actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM') {
        query += ' AND tenantId = ?';
        params.push(actorTenant);

        const perms = getRequiredPermissions(table);
        if (perms.ownerCol && !actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_TENANT')) {
          if (actorDataScope === 'OWN') {
            query += ` AND ${perms.ownerCol} = ?`;
            params.push(actorUserId);
          } else if (actorDataScope === 'TEAM') {
            query += ` AND ${perms.ownerCol} IN (
              SELECT tu.userId FROM tenant_users tu
              JOIN team_members tm ON tm.tenantUserId = tu.id
              WHERE tm.teamId IN (
                SELECT tm2.teamId FROM team_members tm2
                JOIN tenant_users tu2 ON tu2.id = tm2.tenantUserId
                WHERE tu2.userId = ? AND tu2.tenantId = ? AND tu2.status = 'ACTIVE'
              ) AND tu.tenantId = ? AND tu.status = 'ACTIVE'
            )`;
            params.push(actorUserId, actorTenant, actorTenant);
          } else if (actorDataScope === 'DEPARTMENT') {
            query += ` AND 1 = 0 /* DEPARTMENT_SCOPE_NOT_ACTIVE */`;
          }
        }
      }

      const [rows]: any = await pool.query(query, params);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Record not found or access denied.' });
      }
      res.json(rows[0]);
    } catch (err: any) {
      console.error(`Error GET ${table}/:id:`, err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
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
      'teams': { base: 'MANAGE_USERS', own: null, ownerCol: null },
      'team_members': { base: 'MANAGE_USERS', own: null, ownerCol: null },
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
      
      // Cross-tenant Customer relationship validation & PIC inheritance fallback
      if (data.customerId && tenantSpecificTables.includes(table) && ['projects', 'tasks', 'visits', 'follow_ups'].includes(table)) {
        const targetTenant = data.tenantId || actorTenant;
        const [custRows]: any = await pool.query('SELECT id, tenantId, picId, statusId FROM customers WHERE id = ?', [data.customerId]);
        if (custRows.length === 0) {
          return res.status(400).json({ error: 'Referenced customer does not exist.', code: 'CUSTOMER_NOT_FOUND' });
        }
        if (targetTenant !== 'SYSTEM' && custRows[0].tenantId !== targetTenant) {
          return res.status(403).json({ error: 'Cross-tenant customer reference forbidden.', code: 'CROSS_TENANT_CUSTOMER' });
        }
        // If picId is not explicitly provided on child entity, inherit from Customer PIC
        if (!data.picId && custRows[0].picId) {
          data.picId = custRows[0].picId;
        }
      }

      // Authoritative PIC validation on creation
      if (data.picId) {
        const targetTenant = data.tenantId || actorTenant;
        const picCheck = await validateAssignableTenantUser(pool, targetTenant, data.picId);
        if (!picCheck.valid) {
          return res.status(400).json({ error: picCheck.error, code: picCheck.code });
        }
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
    const actorUserId = (req as any).userId;
    const actorDataScope = (req as any).userDataScope || 'OWN';
    const actorPermissions = (req as any).userPermissions || [];

    try {
      const id = req.params.id;
      const data = req.body;
      
      // Ownership check for BOLA protection
      if (table === 'tenants' && actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM') {
        if (id !== actorTenant) {
          return res.status(403).json({ error: 'Cross-tenant mutation forbidden (BOLA).' });
        }
      } else if (tenantSpecificTables.includes(table) && actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM') {
        const [existing]: any = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
        if (existing.length === 0) {
          return res.status(404).json({ error: 'Record not found' });
        }
        if (existing[0].tenantId !== actorTenant) {
          return res.status(403).json({ error: 'Cross-tenant mutation forbidden (BOLA).' });
        }

        // Authoritative PIC validation on update (only if picId is being modified/reassigned)
        if (data.picId && data.picId !== existing[0].picId) {
          const picCheck = await validateAssignableTenantUser(pool, actorTenant, data.picId);
          if (!picCheck.valid) {
            return res.status(400).json({ error: picCheck.error, code: picCheck.code });
          }
        }

        // Check TEAM data scope on mutation
        const perms = getRequiredPermissions(table);
        if (perms.ownerCol && !actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_TENANT')) {
          const recordOwner = existing[0][perms.ownerCol];
          if (actorDataScope === 'OWN' && recordOwner !== actorUserId) {
            return res.status(403).json({ error: 'Forbidden. You do not own this record.' });
          } else if (actorDataScope === 'TEAM') {
            const [teamMatch]: any = await pool.query(`
              SELECT 1 FROM team_members tm1
              JOIN tenant_users tu1 ON tu1.id = tm1.tenantUserId
              JOIN team_members tm2 ON tm2.teamId = tm1.teamId
              JOIN tenant_users tu2 ON tu2.id = tm2.tenantUserId
              WHERE tu1.userId = ? AND tu2.userId = ? AND tu1.tenantId = ? AND tu2.tenantId = ?
                AND tu1.status = 'ACTIVE' AND tu2.status = 'ACTIVE'
            `, [actorUserId, recordOwner, actorTenant, actorTenant]);

            if (teamMatch.length === 0) {
              return res.status(403).json({ error: 'Forbidden. Record does not belong to an active member of your team.' });
            }
          } else if (actorDataScope === 'DEPARTMENT') {
            return res.status(403).json({ error: 'Forbidden. DEPARTMENT data scope is inactive.', code: 'DEPARTMENT_SCOPE_NOT_ACTIVE' });
          }
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
      
      if (tenantSpecificTables.includes(table) && actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM') {
         query += ' AND tenantId = ?';
         queryValues.push(actorTenant);
      }
      if (authZ.restrictToOwn && authZ.ownerCol && actorDataScope === 'OWN') {
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
    const actorUserId = (req as any).userId;
    const actorDataScope = (req as any).userDataScope || 'OWN';
    const actorPermissions = (req as any).userPermissions || [];

    try {
      const id = req.params.id;
      
      // Ownership check for BOLA protection
      if (tenantSpecificTables.includes(table) && actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM') {
        const [existing]: any = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
        if (existing.length === 0) {
          return res.status(404).json({ error: 'Record not found' });
        }
        if (existing[0].tenantId !== actorTenant) {
          return res.status(403).json({ error: 'Cross-tenant mutation forbidden (BOLA).' });
        }

        // Check TEAM data scope on deletion
        const perms = getRequiredPermissions(table);
        if (perms.ownerCol && !actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_TENANT')) {
          const recordOwner = existing[0][perms.ownerCol];
          if (actorDataScope === 'OWN' && recordOwner !== actorUserId) {
            return res.status(403).json({ error: 'Forbidden. You do not own this record.' });
          } else if (actorDataScope === 'TEAM') {
            const [teamMatch]: any = await pool.query(`
              SELECT 1 FROM team_members tm1
              JOIN tenant_users tu1 ON tu1.id = tm1.tenantUserId
              JOIN team_members tm2 ON tm2.teamId = tm1.teamId
              JOIN tenant_users tu2 ON tu2.id = tm2.tenantUserId
              WHERE tu1.userId = ? AND tu2.userId = ? AND tu1.tenantId = ? AND tu2.tenantId = ?
            `, [actorUserId, recordOwner, actorTenant, actorTenant]);

            if (teamMatch.length === 0) {
              return res.status(403).json({ error: 'Forbidden. Record does not belong to a member of your team.' });
            }
          } else if (actorDataScope === 'DEPARTMENT') {
            return res.status(403).json({ error: 'Forbidden. DEPARTMENT data scope is inactive.', code: 'DEPARTMENT_SCOPE_NOT_ACTIVE' });
          }
        }
      }

      let query = `DELETE FROM ${table} WHERE id = ?`;
      const values = [id];
      if (tenantSpecificTables.includes(table) && actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM') {
         query += ' AND tenantId = ?';
         values.push(actorTenant);
      }
      if (authZ.restrictToOwn && authZ.ownerCol && actorDataScope === 'OWN') {
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
  'permissions', 'role_permissions', 'role_data_scopes'
];



// Explicit GET /api/roles Endpoint
app.get('/api/roles', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  let query = `SELECT * FROM roles`;
  const params: any[] = [];

  if (actorTenant && actorTenant !== 'SYSTEM') {
    query += ' WHERE tenantId = ? AND scope = "TENANT"';
    params.push(actorTenant);
  } else {
    const { tenantId } = req.query;
    if (tenantId && tenantId !== 'ALL' && tenantId !== 'SYSTEM') {
      query += ' WHERE tenantId = ?';
      params.push(tenantId);
    }
  }

  sendRes(res, pool.query(query, params).then(([rows]) => rows));
});

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
  const actorTenant = (req as any).userTenantId;
  if (!actorRole) return res.status(403).json({ error: 'Unauthorized' });

  const assignableRoleIds = await getAssignableRoles(pool, actorRole, actorTenant);
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
  if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required' });
  
  // Enforce Tenant Isolation (if actor is TENANT scoped, target tenant must be actor's tenant)
  let targetTenant = req.body.tenantId || actorTenant;
  if (actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM' && targetTenant !== actorTenant) {
     return res.status(403).json({ error: 'Cross-tenant user creation forbidden.' });
  }

  const assignable = await getAssignableRoles(pool, actorRole, actorTenant, targetTenant);
  if (!assignable.includes(roleId)) {
    return res.status(403).json({ error: 'Role assignment not permitted by policy.' });
  }
  
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const trimmedEmail = email.trim().toLowerCase();

    // 1. Check if user global identity exists
    const [existingUserRows]: any = await connection.query('SELECT * FROM users WHERE email = ? FOR UPDATE', [trimmedEmail]);
    
    let userId: string;
    let isNewIdentity = false;

    if (existingUserRows.length > 0) {
      const existingUser = existingUserRows[0];
      userId = existingUser.id;

      // Check if global identity is suspended
      if (existingUser.status === 'SUSPENDED') {
        await connection.rollback();
        return res.status(403).json({
          error: 'User identity is suspended and cannot be added to an organization.',
          code: 'USER_SUSPENDED'
        });
      }

      // Check if membership already exists in this tenant
      const [existingMembershipRows]: any = await connection.query(
        'SELECT id FROM tenant_users WHERE tenantId = ? AND userId = ?',
        [targetTenant, userId]
      );

      if (existingMembershipRows.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          error: 'User is already a member of this organization.',
          code: 'USER_ALREADY_MEMBER'
        });
      }
    } else {
      // Create new global user identity
      isNewIdentity = true;
      userId = 'USR-' + Date.now();
      const hash = await bcrypt.hash(password || 'Password123', 10);
      await connection.query(
        'INSERT INTO users (id, email, passwordHash, name, status) VALUES (?, ?, ?, ?, "ACTIVE")',
        [userId, trimmedEmail, hash, name || trimmedEmail.split('@')[0]]
      );
    }

    // Determine isPrimary (true if user has no prior memberships)
    const [priorMemberships]: any = await connection.query('SELECT COUNT(*) as cnt FROM tenant_users WHERE userId = ?', [userId]);
    const isPrimary = priorMemberships[0].cnt === 0 ? 1 : 0;

    const tenantUserId = 'TU-' + Date.now();
    await connection.query(
      'INSERT INTO tenant_users (id, tenantId, userId, isPrimary, status) VALUES (?, ?, ?, ?, "ACTIVE")',
      [tenantUserId, targetTenant, userId, isPrimary]
    );
    
    await connection.query('INSERT INTO tenant_user_roles (id, tenantUserId, roleId) VALUES (?, ?, ?)', ['TUR-' + Date.now(), tenantUserId, roleId]);

    // Optional Team Assignment
    const { teamId } = req.body;
    if (teamId) {
      const [teamRows]: any = await connection.query('SELECT id FROM teams WHERE id = ? AND tenantId = ?', [teamId, targetTenant]);
      if (teamRows.length > 0) {
        await connection.query(
          'INSERT INTO team_members (id, teamId, tenantUserId, role) VALUES (?, ?, ?, "MEMBER")',
          [`TM-${Date.now()}`, teamId, tenantUserId]
        );
      }
    }

    // Audit Log
    await connection.query(
      'INSERT INTO audit_logs (id, tenantId, userId, action, module, entity, entityId, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        `LOG-${Date.now()}`,
        targetTenant,
        (req as any).userId,
        isNewIdentity ? 'CREATE' : 'CREATE_MEMBERSHIP',
        'User Management',
        'Tenant User',
        tenantUserId,
        `Added user ${trimmedEmail} (${userId}) to tenant ${targetTenant} with role ${roleId}`
      ]
    );
    
    await connection.commit();
    res.json({ success: true, userId, tenantUserId });
  } catch (err: any) {
    await connection.rollback();
    console.error('Error creating tenant user:', err);
    res.status(500).json({ error: 'User creation failed. Please try again.', details: err.message, sqlMessage: err.sqlMessage });
  } finally {
    connection.release();
  }
});

app.put('/api/tenant/users/:id/roles', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;
  const targetUserId = req.params.id;
  const { roleId } = req.body;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const assignable = await getAssignableRoles(pool, actorRole, actorTenant);
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

  // Self escalation check (Cannot grant self a role with higher/different permissions than assignable)
  if (targetUserId === (req as any).userId && actorRole !== 'SUPER_ADMIN') {
    // Self-modification is only permitted for demotion/reassignment if allowed by assignment policy and Last Admin invariant
    // We proceed to transaction where Last Admin check will evaluate continuity.
  }

  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const [tuRows]: any = await connection.query('SELECT id, tenantId, status FROM tenant_users WHERE userId = ?', [targetUserId]);
    if (tuRows.length > 0) {
      const tuId = tuRows[0].id;
      const targetTenantId = tuRows[0].tenantId;

      // Lock tenant row for transactional concurrency protection
      await connection.query('SELECT id FROM tenants WHERE id = ? FOR UPDATE', [targetTenantId]);

      // Check if target user is currently an active administrator
      const [currPermRows]: any = await connection.query(`
        SELECT rp.permission
        FROM tenant_user_roles tur
        JOIN role_permissions rp ON rp.roleId = tur.roleId
        WHERE tur.tenantUserId = ? AND rp.permission IN ('MANAGE_TENANT', 'MANAGE_USERS', 'MANAGE_ROLES')
      `, [tuId]);
      const currPerms = currPermRows.map((r: any) => r.permission);
      const isTargetCurrentlyAdmin = currPerms.includes('MANAGE_TENANT') && currPerms.includes('MANAGE_USERS') && currPerms.includes('MANAGE_ROLES') && tuRows[0].status === 'ACTIVE';

      // Check if new role preserves full administrator capability
      const [newPermRows]: any = await connection.query(`
        SELECT permission FROM role_permissions WHERE roleId = ? AND permission IN ('MANAGE_TENANT', 'MANAGE_USERS', 'MANAGE_ROLES')
      `, [roleId]);
      const newPerms = newPermRows.map((r: any) => r.permission);
      const willTargetBeAdmin = newPerms.includes('MANAGE_TENANT') && newPerms.includes('MANAGE_USERS') && newPerms.includes('MANAGE_ROLES');

      // If user is losing administrative capability, ensure at least one other active admin exists
      if (isTargetCurrentlyAdmin && !willTargetBeAdmin) {
        const remainingAdmins = await countActiveTenantAdmins(connection, targetTenantId, targetUserId);
        if (remainingAdmins === 0) {
          await connection.rollback();
          return res.status(400).json({
            error: 'The last active administrator cannot be demoted. Assign another administrator first.',
            code: 'LAST_TENANT_ADMIN'
          });
        }
      }

      const [oldRoleRows]: any = await connection.query('SELECT roleId FROM tenant_user_roles WHERE tenantUserId = ?', [tuId]);
      const oldRoleId = oldRoleRows.length > 0 ? oldRoleRows[0].roleId : null;

      // Upsert: replace/update assignment ensuring single-role invariant
      await connection.query('DELETE FROM tenant_user_roles WHERE tenantUserId = ?', [tuId]);
      await connection.query('INSERT INTO tenant_user_roles (id, tenantUserId, roleId) VALUES (?, ?, ?)', [`TUR-${Date.now()}`, tuId, roleId]);

      // Audit Log for role change
      await connection.query(
        'INSERT INTO audit_logs (id, tenantId, userId, action, module, description) VALUES (?, ?, ?, ?, ?, ?)',
        [`LOG-${Date.now()}`, targetTenantId, (req as any).userId, 'ROLE_CHANGE', 'RBAC', `Reassigned user ${targetUserId} role from ${oldRoleId || 'NONE'} to ${roleId}`]
      );
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

// --- MEMBERSHIP STATUS MANAGEMENT ---
app.patch('/api/tenant/users/:id/status', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const targetUserId = req.params.id;
  const { status } = req.body;

  if (!actorRole || !actorTenant) return res.status(401).json({ error: 'Unauthorized' });
  if (!['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value. Must be ACTIVE, SUSPENDED, or INACTIVE.' });
  }

  const actorPermissions = (req as any).userPermissions || [];
  if (!actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_TENANT') && !actorPermissions.includes('MANAGE_USERS')) {
    return res.status(403).json({ error: 'Forbidden. Requires MANAGE_USERS or MANAGE_TENANT capability.' });
  }

  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    // 1. Resolve target tenant_user record (scoped to actorTenant for tenant administrators)
    let tuQuery = 'SELECT id, tenantId, status FROM tenant_users WHERE (id = ? OR userId = ?)';
    const tuParams: any[] = [targetUserId, targetUserId];
    if (actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM') {
      tuQuery += ' AND tenantId = ?';
      tuParams.push(actorTenant);
    }

    const [tuRows]: any = await connection.query(tuQuery, tuParams);
    if (tuRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Tenant membership not found.' });
    }

    const tuRecord = tuRows[0];
    const targetTenantId = tuRecord.tenantId;

    // Cross-tenant BOLA protection
    if (actorRole !== 'SUPER_ADMIN' && actorTenant !== 'SYSTEM' && targetTenantId !== actorTenant) {
      await connection.rollback();
      return res.status(403).json({ error: 'Cross-tenant membership modification forbidden.' });
    }

    // Lock tenant row for transactional concurrency protection
    await connection.query('SELECT id FROM tenants WHERE id = ? FOR UPDATE', [targetTenantId]);

    const oldStatus = tuRecord.status;

    // 2. Last Tenant Administrator Continuity Check on SUSPEND / INACTIVATE
    if (oldStatus === 'ACTIVE' && status !== 'ACTIVE') {
      const remainingAdmins = await countActiveTenantAdmins(connection, targetTenantId, targetUserId);
      if (remainingAdmins === 0) {
        await connection.rollback();
        return res.status(400).json({
          error: 'The last active administrator cannot be suspended. Assign another administrator first.',
          code: 'LAST_TENANT_ADMIN'
        });
      }
    }

    // 3. Update tenant_users.status
    await connection.query('UPDATE tenant_users SET status = ? WHERE id = ?', [status, tuRecord.id]);

    // 4. If suspending or inactivating, revoke active sessions for this user
    if (status !== 'ACTIVE') {
      await connection.query('UPDATE auth_sessions SET expiresAt = NOW() WHERE userId = ?', [targetUserId]);
    }

    // 5. Audit Log
    await connection.query(
      'INSERT INTO audit_logs (id, tenantId, userId, action, module, entity, entityId, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        `LOG-${Date.now()}`,
        targetTenantId,
        (req as any).userId,
        status === 'ACTIVE' ? 'MEMBERSHIP_REACTIVATED' : 'MEMBERSHIP_SUSPENDED',
        'User Management',
        'Tenant User',
        tuRecord.id,
        `Changed tenant membership status of user ${targetUserId} from ${oldStatus} to ${status}`
      ]
    );

    await connection.commit();
    res.json({ success: true, oldStatus, newStatus: status });
  } catch (err: any) {
    await connection.rollback();
    console.error('Error updating tenant user status:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    connection.release();
  }
});

// Alias for PUT /api/tenant/users/:id/status
app.put('/api/tenant/users/:id/status', async (req, res) => {
  req.url = `/api/tenant/users/${req.params.id}/status`;
  return app._router.handle(req, res, () => {});
});

// GLOBAL IDENTITY STATUS (SUPER_ADMIN ONLY)
app.put('/api/users/:id/status', async (req, res) => {
  const actorRole = (req as any).userRole;
  const isPlatformUser = (req as any).isPlatformUser;
  const targetUserId = req.params.id;
  const { status } = req.body;

  if (actorRole !== 'SUPER_ADMIN' && !isPlatformUser) {
    return res.status(403).json({ error: 'Forbidden. Global user identity status modification is reserved for Platform Super Admin.' });
  }
  if (!['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const [userRows]: any = await connection.query('SELECT id, status, email FROM users WHERE id = ?', [targetUserId]);
    if (userRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'User not found.' });
    }

    const oldStatus = userRows[0].status;
    await connection.query('UPDATE users SET status = ? WHERE id = ?', [status, targetUserId]);

    if (status !== 'ACTIVE') {
      await connection.query('UPDATE auth_sessions SET expiresAt = NOW() WHERE userId = ?', [targetUserId]);
    }

    await connection.query(
      'INSERT INTO audit_logs (id, userId, action, module, entity, entityId, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        `LOG-${Date.now()}`,
        (req as any).userId,
        status === 'ACTIVE' ? 'GLOBAL_USER_REACTIVATED' : 'GLOBAL_USER_SUSPENDED',
        'Global Identity',
        'User',
        targetUserId,
        `Changed global user identity status for ${userRows[0].email} from ${oldStatus} to ${status}`
      ]
    );

    await connection.commit();
    res.json({ success: true, oldStatus, newStatus: status });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    connection.release();
  }
});

// --- R38.3 OWNERSHIP IMPACT PREVIEW & OWNERSHIP TRANSFER ---

/**
 * GET /api/tenant/users/:id/ownership-impact
 * Calculates authoritative, real-time database aggregate counts of all operational CRM entities
 * owned by the specified user within the authenticated tenant.
 */
app.get('/api/tenant/users/:id/ownership-impact', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];
  const targetUserId = req.params.id;

  if (!actorRole || (!actorTenant && actorRole !== 'SUPER_ADMIN')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Capability check: User must have MANAGE_TENANT, MANAGE_USERS, or CRM management capability
  const hasAuthZ = actorPermissions.includes('ALL') || 
                   actorPermissions.includes('MANAGE_TENANT') || 
                   actorPermissions.includes('MANAGE_USERS') || 
                   actorPermissions.includes('MANAGE_CUSTOMERS');
  if (!hasAuthZ) {
    return res.status(403).json({ error: 'Forbidden. Requires administrative or CRM management capability.' });
  }

  try {
    // Resolve target tenant
    let targetTenantId = actorTenant;
    if (actorRole === 'SUPER_ADMIN' && req.query.tenantId) {
      targetTenantId = req.query.tenantId as string;
    }

    if (!targetTenantId) {
      // Find tenant from user membership if not explicitly provided
      const [mRows]: any = await pool.query('SELECT tenantId FROM tenant_users WHERE userId = ? LIMIT 1', [targetUserId]);
      if (mRows.length > 0) targetTenantId = mRows[0].tenantId;
    }

    // Cross-tenant BOLA protection
    if (actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM' && targetTenantId !== actorTenant) {
      return res.status(403).json({ error: 'Cross-tenant access forbidden.' });
    }

    // Perform authoritative DB aggregate queries
    const [custRows]: any = await pool.query('SELECT COUNT(*) as count FROM customers WHERE tenantId = ? AND picId = ?', [targetTenantId, targetUserId]);
    const [projRows]: any = await pool.query('SELECT COUNT(*) as count FROM projects WHERE tenantId = ? AND picId = ?', [targetTenantId, targetUserId]);
    const [taskRows]: any = await pool.query('SELECT COUNT(*) as count FROM tasks WHERE tenantId = ? AND picId = ?', [targetTenantId, targetUserId]);
    const [openTaskRows]: any = await pool.query('SELECT COUNT(*) as count FROM tasks WHERE tenantId = ? AND picId = ? AND (completedAt IS NULL OR statusId != "COMPLETED")', [targetTenantId, targetUserId]);
    const [visitRows]: any = await pool.query('SELECT COUNT(*) as count FROM visits WHERE tenantId = ? AND picId = ?', [targetTenantId, targetUserId]);
    const [plannedVisitRows]: any = await pool.query('SELECT COUNT(*) as count FROM visits WHERE tenantId = ? AND picId = ? AND statusId = "PLANNED"', [targetTenantId, targetUserId]);
    const [followUpRows]: any = await pool.query('SELECT COUNT(*) as count FROM follow_ups WHERE tenantId = ? AND picId = ?', [targetTenantId, targetUserId]);
    const [pendingFollowUpRows]: any = await pool.query('SELECT COUNT(*) as count FROM follow_ups WHERE tenantId = ? AND picId = ? AND (status = "PENDING" OR status = "SCHEDULED")', [targetTenantId, targetUserId]);

    const impact = {
      userId: targetUserId,
      tenantId: targetTenantId,
      customers: Number(custRows[0]?.count || 0),
      projects: Number(projRows[0]?.count || 0),
      tasks: Number(taskRows[0]?.count || 0),
      openTasks: Number(openTaskRows[0]?.count || 0),
      visits: Number(visitRows[0]?.count || 0),
      plannedVisits: Number(plannedVisitRows[0]?.count || 0),
      followUps: Number(followUpRows[0]?.count || 0),
      pendingFollowUps: Number(pendingFollowUpRows[0]?.count || 0),
      totalOwnedRecords: Number(custRows[0]?.count || 0) + Number(projRows[0]?.count || 0) + Number(taskRows[0]?.count || 0) + Number(visitRows[0]?.count || 0) + Number(followUpRows[0]?.count || 0)
    };

    res.json(impact);
  } catch (err: any) {
    console.error('Error fetching ownership impact:', err);
    res.status(500).json({ error: 'Failed to calculate ownership impact.' });
  }
});

/**
 * POST /api/tenant/users/:sourceUserId/ownership-transfer
 * Transactionally transfers operational CRM ownership from sourceUserId to targetUserId.
 * Strictly preserves historical activity records (activities, audit logs, completed actions).
 */
app.post('/api/tenant/users/:sourceUserId/ownership-transfer', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const sourceUserId = req.params.sourceUserId;
  const { targetUserId, resources, options } = req.body;

  if (!actorRole || (!actorTenant && actorRole !== 'SUPER_ADMIN')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate request body
  if (!targetUserId) {
    return res.status(400).json({ error: 'Target user ID is required.', code: 'MISSING_TARGET_USER' });
  }

  if (sourceUserId === targetUserId) {
    return res.status(400).json({ error: 'Source and target user cannot be the same.', code: 'SOURCE_EQUALS_TARGET' });
  }

  // Capability authorization: Must have MANAGE_TENANT, MANAGE_USERS, or MANAGE_CUSTOMERS (with ORGANIZATION/TEAM scope)
  const isSuper = actorRole === 'SUPER_ADMIN' || actorPermissions.includes('ALL');
  const isAdmin = actorPermissions.includes('MANAGE_TENANT') || actorPermissions.includes('MANAGE_USERS');
  const isSalesManager = actorPermissions.includes('MANAGE_CUSTOMERS') && actorDataScope === 'ORGANIZATION';
  const isSupervisor = actorPermissions.includes('MANAGE_CUSTOMERS') && actorDataScope === 'TEAM';

  if (!isSuper && !isAdmin && !isSalesManager && !isSupervisor) {
    return res.status(403).json({ error: 'Forbidden. Insufficient authority for ownership transfer.', code: 'INSUFFICIENT_TRANSFER_AUTHORITY' });
  }

  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    // 1. Resolve & validate tenant context
    let targetTenantId = actorTenant;
    if (isSuper && req.body.tenantId) {
      targetTenantId = req.body.tenantId;
    }

    if (!targetTenantId || targetTenantId === 'SYSTEM') {
      const [srcTenantRows]: any = await connection.query('SELECT tenantId FROM tenant_users WHERE userId = ? LIMIT 1', [sourceUserId]);
      if (srcTenantRows.length > 0) targetTenantId = srcTenantRows[0].tenantId;
    }

    if (!targetTenantId) {
      await connection.rollback();
      return res.status(400).json({ error: 'Target tenant context could not be determined.', code: 'MISSING_TENANT_CONTEXT' });
    }

    // BOLA cross-tenant protection
    if (!isSuper && actorTenant && actorTenant !== 'SYSTEM' && targetTenantId !== actorTenant) {
      await connection.rollback();
      return res.status(403).json({ error: 'Cross-tenant ownership transfer forbidden.', code: 'CROSS_TENANT_FORBIDDEN' });
    }

    // Lock tenant row for concurrency protection
    await connection.query('SELECT id FROM tenants WHERE id = ? FOR UPDATE', [targetTenantId]);

    // 2. Validate Source User belongs to this tenant (Source may be ACTIVE or SUSPENDED)
    const [sourceMembership]: any = await connection.query(
      'SELECT id, status FROM tenant_users WHERE tenantId = ? AND userId = ?',
      [targetTenantId, sourceUserId]
    );
    if (sourceMembership.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Source user is not a member of this tenant.', code: 'SOURCE_NOT_MEMBER' });
    }

    // 3. Validate Target User (MUST be ACTIVE identity and ACTIVE membership in this tenant)
    const targetValidation = await validateAssignableTenantUser(connection, targetTenantId, targetUserId);
    if (!targetValidation.valid) {
      await connection.rollback();
      return res.status(400).json({ error: targetValidation.error, code: targetValidation.code });
    }

    // 4. If actor is Supervisor (TEAM scope), verify source and target belong to actor's team
    if (!isSuper && !isAdmin && isSupervisor) {
      const [teamCheck]: any = await connection.query(`
        SELECT COUNT(DISTINCT tu.userId) as memberMatch
        FROM team_members tm1
        JOIN tenant_users tu_actor ON tu_actor.id = tm1.tenantUserId
        JOIN team_members tm2 ON tm2.teamId = tm1.teamId
        JOIN tenant_users tu ON tu.id = tm2.tenantUserId
        WHERE tu_actor.userId = ? AND tu_actor.tenantId = ?
          AND tu.userId IN (?, ?) AND tu.tenantId = ?
      `, [actorUserId, targetTenantId, sourceUserId, targetUserId, targetTenantId]);

      if ((teamCheck[0]?.memberMatch || 0) < 2) {
        await connection.rollback();
        return res.status(403).json({
          error: 'Supervisor can only transfer ownership between active members of their own team.',
          code: 'SUPERVISOR_TEAM_BOUNDARY_VIOLATION'
        });
      }
    }

    // 5. Determine which resources to transfer (default: ALL operational CRM entities)
    const transferResources = Array.isArray(resources) && resources.length > 0 
      ? resources 
      : ['CUSTOMERS', 'PROJECTS', 'TASKS', 'VISITS', 'FOLLOW_UPS'];

    let customersTransferred = 0;
    let projectsTransferred = 0;
    let tasksTransferred = 0;
    let visitsTransferred = 0;
    let followUpsTransferred = 0;

    // A. Transfer Customers
    if (transferResources.includes('CUSTOMERS')) {
      const [custRes]: any = await connection.query(
        'UPDATE customers SET picId = ? WHERE tenantId = ? AND picId = ?',
        [targetUserId, targetTenantId, sourceUserId]
      );
      customersTransferred = custRes.affectedRows || 0;
    }

    // B. Transfer Projects (Active / in-flight projects)
    if (transferResources.includes('PROJECTS')) {
      const [projRes]: any = await connection.query(
        'UPDATE projects SET picId = ? WHERE tenantId = ? AND picId = ?',
        [targetUserId, targetTenantId, sourceUserId]
      );
      projectsTransferred = projRes.affectedRows || 0;
    }

    // C. Transfer Tasks (Transfer open/all operational tasks)
    if (transferResources.includes('TASKS')) {
      let taskQuery = 'UPDATE tasks SET picId = ? WHERE tenantId = ? AND picId = ?';
      if (options?.onlyOpenTasks) {
        taskQuery += ' AND (completedAt IS NULL OR statusId != "COMPLETED")';
      }
      const [taskRes]: any = await connection.query(taskQuery, [targetUserId, targetTenantId, sourceUserId]);
      tasksTransferred = taskRes.affectedRows || 0;
    }

    // D. Transfer Visits (Transfer planned / all operational visits)
    if (transferResources.includes('VISITS')) {
      let visitQuery = 'UPDATE visits SET picId = ? WHERE tenantId = ? AND picId = ?';
      if (options?.onlyPlannedVisits) {
        visitQuery += ' AND statusId = "PLANNED"';
      }
      const [visitRes]: any = await connection.query(visitQuery, [targetUserId, targetTenantId, sourceUserId]);
      visitsTransferred = visitRes.affectedRows || 0;
    }

    // E. Transfer Follow-ups
    if (transferResources.includes('FOLLOW_UPS')) {
      let followUpQuery = 'UPDATE follow_ups SET picId = ? WHERE tenantId = ? AND picId = ?';
      if (options?.onlyPendingFollowUps) {
        followUpQuery += ' AND (status = "PENDING" OR status = "SCHEDULED")';
      }
      const [fuRes]: any = await connection.query(followUpQuery, [targetUserId, targetTenantId, sourceUserId]);
      followUpsTransferred = fuRes.affectedRows || 0;
    }

    // 6. Write Audit Log (Structured metadata; NEVER mutate historical activities table)
    await connection.query(
      'INSERT INTO audit_logs (id, tenantId, userId, action, module, entity, entityId, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        `LOG-${Date.now()}`,
        targetTenantId,
        actorUserId,
        'OWNERSHIP_TRANSFER',
        'CRM Ownership',
        'User',
        sourceUserId,
        JSON.stringify({
          sourceUserId,
          targetUserId,
          customersTransferred,
          projectsTransferred,
          tasksTransferred,
          visitsTransferred,
          followUpsTransferred,
          timestamp: new Date().toISOString()
        })
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      tenantId: targetTenantId,
      sourceUserId,
      targetUserId,
      transferred: {
        customers: customersTransferred,
        projects: projectsTransferred,
        tasks: tasksTransferred,
        visits: visitsTransferred,
        followUps: followUpsTransferred,
        total: customersTransferred + projectsTransferred + tasksTransferred + visitsTransferred + followUpsTransferred
      }
    });
  } catch (err: any) {
    await connection.rollback();
    console.error('Error during ownership transfer:', err);
    res.status(500).json({ error: 'Ownership transfer transaction failed.', details: err.message });
  } finally {
    connection.release();
  }
});

// ==========================================
// R39 CRM DATA-SCOPED OPERATIONAL REPORTS
// ==========================================

const buildReportScopeWhere = (actorTenant: string, actorUserId: string, actorRole: string, actorDataScope: string, actorPermissions: string[], ownerCol: string = 'picId') => {
  let where = 'WHERE tenantId = ?';
  const params: any[] = [actorTenant];

  if (actorRole !== 'SUPER_ADMIN' && !actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_TENANT')) {
    if (actorDataScope === 'OWN') {
      where += ` AND ${ownerCol} = ?`;
      params.push(actorUserId);
    } else if (actorDataScope === 'TEAM') {
      where += ` AND ${ownerCol} IN (
        SELECT tu.userId FROM tenant_users tu
        JOIN team_members tm ON tm.tenantUserId = tu.id
        WHERE tm.teamId IN (
          SELECT tm2.teamId FROM team_members tm2
          JOIN tenant_users tu2 ON tu2.id = tm2.tenantUserId
          WHERE tu2.userId = ? AND tu2.tenantId = ? AND tu2.status = 'ACTIVE'
        ) AND tu.tenantId = ? AND tu.status = 'ACTIVE'
      )`;
      params.push(actorUserId, actorTenant, actorTenant);
    } else if (actorDataScope === 'DEPARTMENT') {
      where += ` AND 1 = 0 /* DEPARTMENT_SCOPE_NOT_ACTIVE */`;
    }
  }

  return { where, params };
};

// GET /api/reports/sales: Authoritative Database Aggregated Sales Performance Report
app.get('/api/reports/sales', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = (actorTenant && actorTenant !== 'SYSTEM') ? actorTenant : (req.query.tenantId as string || 'SYSTEM');

  try {
    const { where, params } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'picId');

    // 1. KPI Aggregates
    const [kpiRows]: any = await pool.query(`
      SELECT 
        COUNT(*) as totalProjects,
        SUM(CASE WHEN stageId = 'WON' THEN 1 ELSE 0 END) as wonProjects,
        SUM(CASE WHEN stageId = 'LOST' THEN 1 ELSE 0 END) as lostProjects,
        SUM(CASE WHEN stageId NOT IN ('WON', 'LOST') THEN 1 ELSE 0 END) as openProjects,
        COALESCE(SUM(value), 0) as pipelineValue,
        COALESCE(SUM(CASE WHEN stageId = 'WON' THEN value ELSE 0 END), 0) as wonValue
      FROM projects
      ${where}
    `, params);

    const totalProjects = parseInt(kpiRows[0]?.totalProjects || 0, 10);
    const wonProjects = parseInt(kpiRows[0]?.wonProjects || 0, 10);
    const lostProjects = parseInt(kpiRows[0]?.lostProjects || 0, 10);
    const openProjects = parseInt(kpiRows[0]?.openProjects || 0, 10);
    const pipelineValue = parseFloat(kpiRows[0]?.pipelineValue || 0);
    const wonValue = parseFloat(kpiRows[0]?.wonValue || 0);
    const conversionRate = totalProjects > 0 ? parseFloat(((wonProjects / totalProjects) * 100).toFixed(1)) : 0;

    // 2. Sales Pipeline by Stage
    const [stageRows]: any = await pool.query(`
      SELECT 
        stageId as stage, 
        COUNT(*) as count, 
        COALESCE(SUM(value), 0) as value
      FROM projects
      ${where}
      GROUP BY stageId
    `, params);

    // 3. Sales By Employee / PIC
    const [picRows]: any = await pool.query(`
      SELECT 
        u.name, 
        COUNT(p.id) as projectsCount,
        COALESCE(SUM(p.value), 0) as sales
      FROM projects p
      LEFT JOIN users u ON u.id = p.picId
      ${where.replace(/WHERE tenantId/g, 'WHERE p.tenantId').replace(/AND picId/g, 'AND p.picId')}
      GROUP BY p.picId, u.name
      ORDER BY sales DESC
    `, params);

    // 4. Scoped Opportunity Table
    const [projectList]: any = await pool.query(`
      SELECT 
        p.id, p.title as name, p.stageId as stage, p.value, p.customerId, p.picId,
        c.name as customer,
        u.name as pic
      FROM projects p
      LEFT JOIN customers c ON c.id = p.customerId
      LEFT JOIN users u ON u.id = p.picId
      ${where.replace(/WHERE tenantId/g, 'WHERE p.tenantId').replace(/AND picId/g, 'AND p.picId')}
      ORDER BY p.id DESC
      LIMIT 50
    `, params);

    res.json({
      kpi: {
        totalProjects,
        wonProjects,
        lostProjects,
        openProjects,
        pipelineValue,
        wonValue,
        conversionRate
      },
      salesPipeline: stageRows.map((r: any) => ({ stage: r.stage, count: parseInt(r.count, 10), value: parseFloat(r.value) })),
      salesByEmployee: picRows.map((r: any) => ({ name: r.name || 'Unassigned', sales: parseFloat(r.sales), count: parseInt(r.projectsCount, 10) })),
      oppConversion: [
        { name: 'Won', value: wonProjects, color: '#10b981' },
        { name: 'Lost', value: lostProjects, color: '#ef4444' },
        { name: 'Open', value: openProjects, color: '#6366f1' }
      ],
      tableData: projectList
    });
  } catch (err: any) {
    console.error('Error GET /api/reports/sales:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/reports/customers: Authoritative Database Aggregated Customer Report
app.get('/api/reports/customers', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = (actorTenant && actorTenant !== 'SYSTEM') ? actorTenant : (req.query.tenantId as string || 'SYSTEM');

  try {
    const { where, params } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'picId');

    // 1. KPI Aggregates
    const [kpiRows]: any = await pool.query(`
      SELECT 
        COUNT(*) as totalCustomers,
        COUNT(*) as activeCustomers
      FROM customers
      ${where}
    `, params);

    const totalCustomers = parseInt(kpiRows[0]?.totalCustomers || 0, 10);
    const activeCustomers = parseInt(kpiRows[0]?.activeCustomers || 0, 10);

    // 2. Customers By PIC
    const [picRows]: any = await pool.query(`
      SELECT 
        u.name, 
        COUNT(c.id) as customers
      FROM customers c
      LEFT JOIN users u ON u.id = c.picId
      ${where.replace(/WHERE tenantId/g, 'WHERE c.tenantId').replace(/AND picId/g, 'AND c.picId')}
      GROUP BY c.picId, u.name
      ORDER BY customers DESC
    `, params);

    // 3. Scoped Customer Table
    const [customerList]: any = await pool.query(`
      SELECT 
        c.id, c.name, c.code, c.picId,
        u.name as pic
      FROM customers c
      LEFT JOIN users u ON u.id = c.picId
      ${where.replace(/WHERE tenantId/g, 'WHERE c.tenantId').replace(/AND picId/g, 'AND c.picId')}
      ORDER BY c.id DESC
      LIMIT 50
    `, params);

    res.json({
      kpi: {
        totalCustomers,
        activeCustomers,
        inactiveCustomers: 0,
        prospects: 0,
        wonCustomers: totalCustomers
      },
      customersByStatus: [
        { name: 'Active', value: totalCustomers, color: '#10b981' }
      ],
      customersByPic: picRows.map((r: any) => ({ name: r.name || 'Unassigned', customers: parseInt(r.customers, 10) })),
      tableData: customerList
    });
  } catch (err: any) {
    console.error('Error GET /api/reports/customers:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// ==========================================
// R40.1 PROJECT COMMERCIAL STAGE TRANSITION
// ==========================================

app.patch('/api/projects/:id/stage', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const projectId = req.params.id;
  const { stageId, notes, reason } = req.body;

  if (!stageId) {
    return res.status(400).json({ error: 'Target stageId is required.', code: 'STAGE_REQUIRED' });
  }

  const validStages = ['LEAD', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
  if (!validStages.includes(stageId)) {
    return res.status(400).json({ error: `Invalid stageId: ${stageId}. Must be one of ${validStages.join(', ')}`, code: 'INVALID_STAGE' });
  }

  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    // 1. Fetch current project record
    const [projRows]: any = await connection.query('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (projRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Project not found.', code: 'PROJECT_NOT_FOUND' });
    }

    const project = projRows[0];
    const projectTenant = project.tenantId;

    // BOLA Check
    if (actorRole !== 'SUPER_ADMIN' && actorTenant && actorTenant !== 'SYSTEM' && projectTenant !== actorTenant) {
      await connection.rollback();
      return res.status(403).json({ error: 'Cross-tenant mutation forbidden (BOLA).' });
    }

    // Permission & Scope Check
    const hasAdminPerms = actorPermissions.includes('ALL') || actorPermissions.includes('MANAGE_TENANT') || actorPermissions.includes('MANAGE_PROJECTS');
    const hasOwnPerm = actorPermissions.includes('MANAGE_OWN_PROJECTS');

    if (!hasAdminPerms && !hasOwnPerm) {
      await connection.rollback();
      return res.status(403).json({ error: 'Forbidden. Requires MANAGE_PROJECTS capability.' });
    }

    if (!hasAdminPerms) {
      if (actorDataScope === 'OWN' && project.picId !== actorUserId) {
        await connection.rollback();
        return res.status(403).json({ error: 'Forbidden. You do not own this project.' });
      } else if (actorDataScope === 'TEAM') {
        const [teamMatch]: any = await connection.query(`
          SELECT 1 FROM team_members tm1
          JOIN tenant_users tu1 ON tu1.id = tm1.tenantUserId
          JOIN team_members tm2 ON tm2.teamId = tm1.teamId
          JOIN tenant_users tu2 ON tu2.id = tm2.tenantUserId
          WHERE tu1.userId = ? AND tu2.userId = ? AND tu1.tenantId = ? AND tu2.tenantId = ?
            AND tu1.status = 'ACTIVE' AND tu2.status = 'ACTIVE'
        `, [actorUserId, project.picId, actorTenant, actorTenant]);

        if (teamMatch.length === 0) {
          await connection.rollback();
          return res.status(403).json({ error: 'Forbidden. Project does not belong to an active member of your team.' });
        }
      } else if (actorDataScope === 'DEPARTMENT') {
        await connection.rollback();
        return res.status(403).json({ error: 'Forbidden. DEPARTMENT data scope is inactive.', code: 'DEPARTMENT_SCOPE_NOT_ACTIVE' });
      }
    }

    const fromStageId = project.stageId || 'LEAD';
    const toStageId = stageId;

    // Determine probability based on target stage
    let targetProbability = project.probability;
    if (toStageId === 'WON') targetProbability = 100;
    else if (toStageId === 'LOST') targetProbability = 0;
    else if (toStageId === 'LEAD') targetProbability = 10;
    else if (toStageId === 'QUALIFICATION') targetProbability = 30;
    else if (toStageId === 'PROPOSAL') targetProbability = 60;
    else if (toStageId === 'NEGOTIATION') targetProbability = 80;

    // 2. Update Project stage and probability
    await connection.query(
      'UPDATE projects SET stageId = ?, probability = ? WHERE id = ?',
      [toStageId, targetProbability, projectId]
    );

    // 3. Record Project Stage History
    const historyId = `PSH-${Date.now()}-${Math.random().toString(36).slice(-4)}`;
    await connection.query(
      'INSERT INTO project_stage_histories (id, projectId, fromStageId, toStageId, changedById, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [historyId, projectId, fromStageId, toStageId, actorUserId, notes || reason || `Stage changed from ${fromStageId} to ${toStageId}`]
    );

    // 4. Customer Activation Rule on WON:
    // If target stage is WON and customer status is PROSPECT, activate customer to ACTIVE
    let customerActivated = false;
    if (toStageId === 'WON' && project.customerId) {
      const [custRows]: any = await connection.query('SELECT statusId FROM customers WHERE id = ?', [project.customerId]);
      if (custRows.length > 0 && (custRows[0].statusId === 'PROSPECT' || custRows[0].statusId === 'INACTIVE')) {
        await connection.query('UPDATE customers SET statusId = "ACTIVE" WHERE id = ?', [project.customerId]);
        customerActivated = true;
      }
    }

    await connection.commit();

    res.json({
      success: true,
      projectId,
      fromStageId,
      toStageId,
      probability: targetProbability,
      customerActivated
    });
  } catch (err: any) {
    await connection.rollback();
    console.error('Error in PATCH /api/projects/:id/stage:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  } finally {
    connection.release();
  }
});

// Alias for PUT /api/projects/:id/stage
app.put('/api/projects/:id/stage', async (req, res) => {
  req.url = `/api/projects/${req.params.id}/stage`;
  return app._router.handle(req, res, () => {});
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
        const now = new Date();
        const formatDate = (d: any) => {
          if (!d) return null;
          const dt = new Date(d);
          return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 19).replace('T', ' ');
        };
        const tCreatedAt = formatDate(t.createdAt) || formatDate(now);
        const tTrialEndDate = formatDate(t.trialEndDate);

        await connection.query(
          `INSERT INTO tenants (id, name, code, status, createdAt, type, trialEndDate, email, industry, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [t.id, t.name, t.code, t.status, tCreatedAt, t.type || 'Professional', tTrialEndDate, t.email || null, t.industry || null, t.phone || null]
        );

        // 2. Hash Password & Insert User
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(adminPassword, salt);
        const u = user;
        const uCreatedAt = formatDate(u.createdAt) || formatDate(now);
        await connection.query(
          `INSERT INTO users (id, email, name, passwordHash, avatar, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [u.id, u.email, u.name, passwordHash, u.avatarUrl || null, 'ACTIVE', uCreatedAt]
        );

        // 3. Insert Tenant_User
        const tuId = `TU-${Date.now()}`;
        await connection.query(
          `INSERT INTO tenant_users (id, tenantId, userId, isPrimary, status, joinedAt) VALUES (?, ?, ?, ?, ?, ?)`,
          [tuId, t.id, u.id, true, 'ACTIVE', uCreatedAt]
        );

        // 4. Clone all enabled Tenant Role Templates into tenant-owned roles
        const [templates]: any = await connection.query(`
          SELECT * FROM roles WHERE scope = 'TEMPLATE' AND isSystem = 1
        `);

        let adminRoleId = `ROLE-${t.id}-TENANT_ADMIN`;

        for (const tmpl of templates) {
          const shortTmpl = tmpl.id.replace('TEMPLATE_', '').replace('REPRESENTATIVE', 'REP');
          const clonedRoleId = `ROLE-${t.id}-${shortTmpl}`;
          await connection.query(`
            INSERT INTO roles (id, tenantId, name, description, isSystem, scope)
            VALUES (?, ?, ?, ?, 1, 'TENANT')
            ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)
          `, [clonedRoleId, t.id, tmpl.name, tmpl.description]);

          // Copy permissions from template
          const [tmplPerms]: any = await connection.query('SELECT permission FROM role_permissions WHERE roleId = ?', [tmpl.id]);
          await connection.query('DELETE FROM role_permissions WHERE roleId = ?', [clonedRoleId]);
          for (const tp of tmplPerms) {
            await connection.query('INSERT IGNORE INTO role_permissions (roleId, permission) VALUES (?, ?)', [clonedRoleId, tp.permission]);
          }

          // Copy data scope from template
          const [tmplScopes]: any = await connection.query('SELECT scope FROM role_data_scopes WHERE roleId = ?', [tmpl.id]);
          const scopeVal = tmplScopes.length > 0 ? tmplScopes[0].scope : 'ORGANIZATION';
          const rdsId = `RDS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          await connection.query(`
            INSERT INTO role_data_scopes (id, roleId, scope)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE scope = VALUES(scope)
          `, [rdsId, clonedRoleId, scopeVal]);

          if (tmpl.id === 'TEMPLATE_TENANT_ADMIN') {
            adminRoleId = clonedRoleId;
          }
        }

        // 5. Assign Cloned Tenant Administrator Role to Initial User
        await connection.query(
          `INSERT INTO tenant_user_roles (id, tenantUserId, roleId) VALUES (?, ?, ?)`,
          [`TUR-${Date.now()}`, tuId, adminRoleId]
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
      res.status(500).json({ error: 'Tenant onboarding failed. Please try again.', details: err.message });
    }
  });

  // Custom Endpoint for Role Permissions and Scopes Update
  app.post('/api/roles/:id/permissions_scopes', async (req, res) => {
    const targetRoleId = req.params.id;
    const { permissions, dataScope } = req.body;
    const actorRole = (req as any).userRole;
    const actorTenant = (req as any).userTenantId;
    const actorPermissions = (req as any).userPermissions || [];
    const isPlatformUser = (req as any).isPlatformUser;
    
    if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });
    
    // Privilege Escalation Protection
    if (!actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_ROLES')) {
      return res.status(403).json({ error: 'Forbidden. Requires MANAGE_ROLES capability.' });
    }
    
    // Self Escalation Protection
    if (targetRoleId === actorRole) {
      return res.status(403).json({ error: 'Forbidden. Cannot modify own role permissions.' });
    }

    // Authoritative Permission Catalog Validation
    if (permissions && Array.isArray(permissions)) {
      if (permissions.length > 0) {
        const placeholders = permissions.map(() => '?').join(',');
        const [validRows]: any = await pool.query(
          `SELECT code, isTenantAssignable FROM permissions WHERE code IN (${placeholders})`,
          permissions
        );
        const validCodes = validRows.map((r: any) => r.code);
        const unknownCodes = permissions.filter(p => !validCodes.includes(p));

        if (unknownCodes.length > 0) {
          return res.status(400).json({
            error: `Invalid permission code(s): ${unknownCodes.join(', ')}. All permissions must exist in the authoritative catalog.`
          });
        }

        // Data-driven Privilege Ceiling: Check if tenant admin is assigning platform-only (isTenantAssignable = false) permissions
        if (actorRole !== 'SUPER_ADMIN' && !actorPermissions.includes('ALL')) {
          const nonAssignable = validRows.filter((r: any) => !r.isTenantAssignable).map((r: any) => r.code);
          if (nonAssignable.length > 0) {
            return res.status(403).json({
              error: `Forbidden. The following permissions are platform-only and cannot be assigned to tenant roles: ${nonAssignable.join(', ')}`
            });
          }
        }
      }

      // Capability Delegation Enforcement (ACTOR AUTHORITY >= DELEGATED AUTHORITY)
      const sensitiveCapabilities = ['ALL', 'MANAGE_TENANT', 'MANAGE_ROLES', 'MANAGE_USERS', 'MANAGE_CUSTOMERS', 'MANAGE_PROJECTS', 'MANAGE_TASKS'];
      for (const p of permissions) {
        if (p === 'ALL' && actorRole !== 'SUPER_ADMIN') {
          return res.status(403).json({ error: 'Forbidden. ALL permission can only be assigned by Super Admin.' });
        }
        if (sensitiveCapabilities.includes(p) && !actorPermissions.includes('ALL') && !actorPermissions.includes(p)) {
          return res.status(403).json({ error: `Forbidden. Cannot delegate capability: ${p} which actor does not possess.` });
        }
      }
    }

      // Data Scope Ceiling & Active Scope Validation:
      // Only Super Admin can assign SYSTEM data scope
      if (dataScope === 'SYSTEM' && actorRole !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Forbidden. SYSTEM data scope is restricted to platform roles.' });
      }

      // Department scope is currently in HOLD / RESERVED state
      if (dataScope === 'DEPARTMENT' && actorRole !== 'SUPER_ADMIN') {
        return res.status(403).json({
          error: 'Forbidden. DEPARTMENT data scope is currently reserved and inactive in this release.',
          code: 'DEPARTMENT_SCOPE_NOT_ACTIVE'
        });
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

  // Dedicated POST /api/roles: Create custom tenant role
  app.post('/api/roles', async (req, res) => {
    const actorRole = (req as any).userRole;
    const actorTenant = (req as any).userTenantId;
    const actorPermissions = (req as any).userPermissions || [];
    const isPlatformUser = (req as any).isPlatformUser;

    if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });
    if (!actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_ROLES')) {
      return res.status(403).json({ error: 'Forbidden. Requires MANAGE_ROLES capability.' });
    }

    try {
      const { id, name, description, scope, isSystem } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Role name is required.' });
      }

      const roleId = id || `ROLE-${actorTenant}-${Date.now()}`;
      const roleTenant = isPlatformUser ? (req.body.tenantId || null) : actorTenant;
      const roleScope = isPlatformUser ? (scope || 'TENANT') : 'TENANT';
      const roleIsSystem = isPlatformUser ? Boolean(isSystem) : false;

      // Duplicate check within tenant
      const [existing]: any = await pool.query(
        'SELECT id FROM roles WHERE name = ? AND ((tenantId = ? AND scope = "TENANT") OR (tenantId IS NULL AND scope = "TEMPLATE"))',
        [name.trim(), roleTenant]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: `A role named "${name.trim()}" already exists in this organization.` });
      }

      await pool.query(
        'INSERT INTO roles (id, tenantId, name, description, isSystem, scope) VALUES (?, ?, ?, ?, ?, ?)',
        [roleId, roleTenant, name.trim(), description || '', roleIsSystem, roleScope]
      );

      res.json({ success: true, id: roleId });
    } catch (err: any) {
      console.error('Error creating role:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Dedicated PUT /api/roles/:id: Update role name/description
  app.put('/api/roles/:id', async (req, res) => {
    const targetRoleId = req.params.id;
    const actorRole = (req as any).userRole;
    const actorTenant = (req as any).userTenantId;
    const actorPermissions = (req as any).userPermissions || [];
    const isPlatformUser = (req as any).isPlatformUser;

    if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });
    if (!actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_ROLES')) {
      return res.status(403).json({ error: 'Forbidden. Requires MANAGE_ROLES capability.' });
    }

    try {
      const [roleRows]: any = await pool.query('SELECT * FROM roles WHERE id = ?', [targetRoleId]);
      if (roleRows.length === 0) return res.status(404).json({ error: 'Role not found.' });

      const targetRole = roleRows[0];
      if (targetRole.tenantId !== actorTenant && !actorPermissions.includes('ALL')) {
        return res.status(403).json({ error: 'Forbidden. Cannot edit another tenant role.' });
      }

      const { name, description } = req.body;
      const updates: string[] = [];
      const params: any[] = [];

      if (name && name.trim()) {
        updates.push('name = ?');
        params.push(name.trim());
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }

      if (updates.length > 0) {
        params.push(targetRoleId);
        await pool.query(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`, params);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('Error updating role:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Dedicated DELETE /api/roles/:id: Delete custom tenant role
  app.delete('/api/roles/:id', async (req, res) => {
    const targetRoleId = req.params.id;
    const actorRole = (req as any).userRole;
    const actorTenant = (req as any).userTenantId;
    const actorPermissions = (req as any).userPermissions || [];
    const isPlatformUser = (req as any).isPlatformUser;

    if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });
    if (!actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_ROLES')) {
      return res.status(403).json({ error: 'Forbidden. Requires MANAGE_ROLES capability.' });
    }

    try {
      const [roleRows]: any = await pool.query('SELECT * FROM roles WHERE id = ?', [targetRoleId]);
      if (roleRows.length === 0) return res.status(404).json({ error: 'Role not found.' });

      const targetRole = roleRows[0];
      if (targetRole.tenantId !== actorTenant && !actorPermissions.includes('ALL')) {
        return res.status(403).json({ error: 'Forbidden. Cannot delete another tenant role.' });
      }

      // Safety check: Cannot delete system/protected roles
      if (targetRole.isSystem || targetRole.scope === 'SYSTEM' || targetRole.scope === 'TEMPLATE' || targetRoleId === 'SUPER_ADMIN' || targetRoleId === 'TENANT_ADMIN') {
        return res.status(403).json({ error: 'Forbidden. System default and platform roles cannot be deleted.' });
      }

      // Check assigned members
      const [memberRows]: any = await pool.query('SELECT id FROM tenant_user_roles WHERE roleId = ?', [targetRoleId]);
      if (memberRows.length > 0) {
        return res.status(400).json({ error: `Cannot delete role: ${memberRows.length} user(s) are currently assigned to this role.` });
      }

      await pool.query('DELETE FROM role_permissions WHERE roleId = ?', [targetRoleId]);
      await pool.query('DELETE FROM role_data_scopes WHERE roleId = ?', [targetRoleId]);
      await pool.query('DELETE FROM roles WHERE id = ?', [targetRoleId]);

      res.json({ success: true });
    } catch (err: any) {
      console.error('Error deleting role:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // ==========================================
  // --- TEAMS & TEAM MEMBERS API (R38.2) ---
  // ==========================================

  // GET /api/teams: List teams within tenant
  app.get('/api/teams', async (req, res) => {
    const actorRole = (req as any).userRole;
    const actorTenant = (req as any).userTenantId;
    const isPlatformUser = (req as any).isPlatformUser;

    if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

    try {
      let query = `
        SELECT 
          t.id, t.tenantId, t.name, t.description, t.leaderId,
          u.name as leaderName, u.email as leaderEmail,
          COUNT(DISTINCT tm.tenantUserId) as memberCount
        FROM teams t
        LEFT JOIN tenant_users lu ON lu.id = t.leaderId
        LEFT JOIN users u ON u.id = lu.userId
        LEFT JOIN team_members tm ON tm.teamId = t.id
      `;
      const params: any[] = [];

      if (actorTenant && actorTenant !== 'SYSTEM') {
        query += ' WHERE t.tenantId = ? GROUP BY t.id, t.tenantId, t.name, t.description, t.leaderId, u.name, u.email ORDER BY t.name ASC';
        params.push(actorTenant);
      } else {
        const { tenantId } = req.query;
        if (tenantId && tenantId !== 'ALL' && tenantId !== 'SYSTEM') {
          query += ' WHERE t.tenantId = ? GROUP BY t.id, t.tenantId, t.name, t.description, t.leaderId, u.name, u.email ORDER BY t.name ASC';
          params.push(tenantId);
        } else {
          query += ' GROUP BY t.id, t.tenantId, t.name, t.description, t.leaderId, u.name, u.email ORDER BY t.name ASC';
        }
      }

      const [teams]: any = await pool.query(query, params);
      res.json(teams);
    } catch (err: any) {
      console.error('Error GET /api/teams:', err);
      res.status(500).json({ error: 'Internal Server Error', message: err.message, details: err.sqlMessage || err });
    }
  });

  // GET /api/teams/:id: Get team details with active members
  app.get('/api/teams/:id', async (req, res) => {
    const teamId = req.params.id;
    const actorTenant = (req as any).userTenantId;
    const actorRole = (req as any).userRole;
    const isPlatformUser = (req as any).isPlatformUser;

    if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const [teamRows]: any = await pool.query(`
        SELECT 
          t.id, t.tenantId, t.name, t.description, t.leaderId,
          lu.userId as leaderUserId, u.name as leaderName, u.email as leaderEmail
        FROM teams t
        LEFT JOIN tenant_users lu ON lu.id = t.leaderId
        LEFT JOIN users u ON u.id = lu.userId
        WHERE t.id = ?
      `, [teamId]);

      if (teamRows.length === 0) return res.status(404).json({ error: 'Team not found.' });

      const team = teamRows[0];
      if (team.tenantId !== actorTenant && !isPlatformUser && actorRole !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Forbidden. Cross-tenant access denied.' });
      }

      // Fetch team members
      const [memberRows]: any = await pool.query(`
        SELECT 
          tm.id, tm.teamId, tm.tenantUserId, tm.role as teamRole, tm.joinedAt,
          tu.tenantId, tu.userId, tu.status as membershipStatus,
          u.name as userName, u.email as userEmail,
          r.name as roleName
        FROM team_members tm
        JOIN tenant_users tu ON tu.id = tm.tenantUserId
        JOIN users u ON u.id = tu.userId
        LEFT JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
        LEFT JOIN roles r ON r.id = tur.roleId
        WHERE tm.teamId = ?
        ORDER BY u.name ASC
      `, [teamId]);

      team.members = memberRows;
      team.memberCount = memberRows.length;
      res.json(team);
    } catch (err: any) {
      console.error('Error GET /api/teams/:id:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // POST /api/teams: Create a new team
  app.post('/api/teams', async (req, res) => {
    const actorRole = (req as any).userRole;
    const actorTenant = (req as any).userTenantId;
    const actorPermissions = (req as any).userPermissions || [];
    const isPlatformUser = (req as any).isPlatformUser;

    if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });
    if (!actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_TENANT') && !actorPermissions.includes('MANAGE_USERS')) {
      return res.status(403).json({ error: 'Forbidden. Requires MANAGE_USERS or MANAGE_TENANT capability.' });
    }

    try {
      const { name, description, leaderId } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Team name is required.' });
      }

      const targetTenant = isPlatformUser ? (req.body.tenantId || actorTenant) : actorTenant;
      if (!targetTenant) {
        return res.status(400).json({ error: 'Tenant context is required.' });
      }

      // Check duplicate team name in tenant
      const [existing]: any = await pool.query('SELECT id FROM teams WHERE tenantId = ? AND name = ?', [targetTenant, name.trim()]);
      if (existing.length > 0) {
        return res.status(400).json({ error: `A team named "${name.trim()}" already exists in this organization.`, code: 'DUPLICATE_TEAM_NAME' });
      }

      // Validate leader if provided (must be ACTIVE tenant_user of same tenant)
      let validLeaderId = null;
      if (leaderId) {
        // leaderId can be tenant_users.id or users.id
        const [tuRows]: any = await pool.query(
          'SELECT id, tenantId, status FROM tenant_users WHERE (id = ? OR userId = ?) AND tenantId = ?',
          [leaderId, leaderId, targetTenant]
        );
        if (tuRows.length === 0) {
          return res.status(400).json({ error: 'Selected team leader does not belong to this organization.' });
        }
        if (tuRows[0].status === 'SUSPENDED') {
          return res.status(400).json({ error: 'Cannot assign a suspended user as team leader.' });
        }
        validLeaderId = tuRows[0].id;
      }

      const teamId = `TEAM-${targetTenant}-${Date.now()}`;
      await pool.query(
        'INSERT INTO teams (id, tenantId, name, description, leaderId) VALUES (?, ?, ?, ?, ?)',
        [teamId, targetTenant, name.trim(), description || '', validLeaderId]
      );

      // If leader was assigned, ensure leader is also in team_members with unique guard
      if (validLeaderId) {
        await pool.query(
          'INSERT INTO team_members (id, teamId, tenantUserId, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE teamId = VALUES(teamId), role = "LEADER"',
          [`TM-${Date.now()}`, teamId, validLeaderId, 'LEADER']
        );
      }

      // Audit Log
      await pool.query(
        'INSERT INTO audit_logs (id, tenantId, userId, action, module, entity, entityId, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [`LOG-${Date.now()}`, targetTenant, (req as any).userId, 'CREATE', 'Organization', 'Team', teamId, `Created team "${name.trim()}" (${teamId})`]
      );

      res.json({ success: true, id: teamId, teamId: teamId });
    } catch (err: any) {
      console.error('Error creating team:', err);
      res.status(500).json({ error: 'Internal Server Error', message: err.message, details: err.sqlMessage || err });
    }
  });

  // PUT /api/teams/:id: Update team name, description, or leader
  app.put('/api/teams/:id', async (req, res) => {
    const teamId = req.params.id;
    const actorRole = (req as any).userRole;
    const actorTenant = (req as any).userTenantId;
    const actorPermissions = (req as any).userPermissions || [];
    const isPlatformUser = (req as any).isPlatformUser;

    if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });
    if (!actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_TENANT') && !actorPermissions.includes('MANAGE_USERS')) {
      return res.status(403).json({ error: 'Forbidden. Requires MANAGE_USERS or MANAGE_TENANT capability.' });
    }

    try {
      const [teamRows]: any = await pool.query('SELECT * FROM teams WHERE id = ?', [teamId]);
      if (teamRows.length === 0) return res.status(404).json({ error: 'Team not found.' });

      const team = teamRows[0];
      if (team.tenantId !== actorTenant && !isPlatformUser && actorRole !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Forbidden. Cross-tenant mutation denied.' });
      }

      const { name, description, leaderId } = req.body;
      const updates: string[] = [];
      const params: any[] = [];

      if (name && name.trim()) {
        // Duplicate name check
        const [dupRows]: any = await pool.query(
          'SELECT id FROM teams WHERE tenantId = ? AND name = ? AND id != ?',
          [team.tenantId, name.trim(), teamId]
        );
        if (dupRows.length > 0) {
          return res.status(400).json({ error: `A team named "${name.trim()}" already exists in this organization.` });
        }
        updates.push('name = ?');
        params.push(name.trim());
      }

      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }

      if (leaderId !== undefined) {
        if (leaderId === null || leaderId === '') {
          updates.push('leaderId = NULL');
        } else {
          const [tuRows]: any = await pool.query(
            'SELECT id, tenantId, status FROM tenant_users WHERE (id = ? OR userId = ?) AND tenantId = ?',
            [leaderId, leaderId, team.tenantId]
          );
          if (tuRows.length === 0) {
            return res.status(400).json({ error: 'Selected team leader does not belong to this organization.' });
          }
          if (tuRows[0].status === 'SUSPENDED') {
            return res.status(400).json({ error: 'Cannot assign a suspended user as team leader.' });
          }
          updates.push('leaderId = ?');
          params.push(tuRows[0].id);

          // Update/Insert team_members for leader
          await pool.query(
            'INSERT INTO team_members (id, teamId, tenantUserId, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE teamId = VALUES(teamId), role = "LEADER"',
            [`TM-${Date.now()}`, teamId, tuRows[0].id, 'LEADER']
          );
        }
      }

      if (updates.length > 0) {
        params.push(teamId);
        await pool.query(`UPDATE teams SET ${updates.join(', ')} WHERE id = ?`, params);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('Error updating team:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // DELETE /api/teams/:id: Delete team with safety check for active members
  app.delete('/api/teams/:id', async (req, res) => {
    const teamId = req.params.id;
    const actorRole = (req as any).userRole;
    const actorTenant = (req as any).userTenantId;
    const actorPermissions = (req as any).userPermissions || [];
    const isPlatformUser = (req as any).isPlatformUser;

    if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });
    if (!actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_TENANT') && !actorPermissions.includes('MANAGE_USERS')) {
      return res.status(403).json({ error: 'Forbidden. Requires MANAGE_USERS or MANAGE_TENANT capability.' });
    }

    try {
      const [teamRows]: any = await pool.query('SELECT * FROM teams WHERE id = ?', [teamId]);
      if (teamRows.length === 0) return res.status(404).json({ error: 'Team not found.' });

      const team = teamRows[0];
      if (team.tenantId !== actorTenant && !isPlatformUser && actorRole !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Forbidden. Cross-tenant mutation denied.' });
      }

      // Safety check: Cannot delete team with active members
      const [memberRows]: any = await pool.query('SELECT id FROM team_members WHERE teamId = ?', [teamId]);
      if (memberRows.length > 0) {
        return res.status(400).json({
          error: `Cannot delete team: ${memberRows.length} member(s) are currently assigned. Please reassign or remove members first.`,
          code: 'TEAM_HAS_MEMBERS'
        });
      }

      await pool.query('DELETE FROM teams WHERE id = ?', [teamId]);

      // Audit Log
      await pool.query(
        'INSERT INTO audit_logs (id, tenantId, userId, action, module, entity, entityId, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [`LOG-${Date.now()}`, team.tenantId, (req as any).userId, 'DELETE', 'Organization', 'Team', teamId, `Deleted team "${team.name}" (${teamId})`]
      );

      res.json({ success: true });
    } catch (err: any) {
      console.error('Error deleting team:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // POST /api/teams/:id/members: Assign a member to a team (1 active team per membership)
  app.post('/api/teams/:id/members', async (req, res) => {
    const teamId = req.params.id;
    const actorRole = (req as any).userRole;
    const actorTenant = (req as any).userTenantId;
    const actorPermissions = (req as any).userPermissions || [];
    const isPlatformUser = (req as any).isPlatformUser;

    if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });
    if (!actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_TENANT') && !actorPermissions.includes('MANAGE_USERS')) {
      return res.status(403).json({ error: 'Forbidden. Requires MANAGE_USERS or MANAGE_TENANT capability.' });
    }

    try {
      const [teamRows]: any = await pool.query('SELECT * FROM teams WHERE id = ?', [teamId]);
      if (teamRows.length === 0) return res.status(404).json({ error: 'Team not found.' });

      const team = teamRows[0];
      if (team.tenantId !== actorTenant && !isPlatformUser && actorRole !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Forbidden. Cross-tenant mutation denied.' });
      }

      const { userId, tenantUserId, role } = req.body;
      const targetIdentifier = tenantUserId || userId;
      if (!targetIdentifier) {
        return res.status(400).json({ error: 'User identifier (userId or tenantUserId) is required.' });
      }

      // Find tenant_user record
      const [tuRows]: any = await pool.query(
        'SELECT id, tenantId, userId, status FROM tenant_users WHERE (id = ? OR userId = ?) AND tenantId = ?',
        [targetIdentifier, targetIdentifier, team.tenantId]
      );

      if (tuRows.length === 0) {
        return res.status(400).json({ error: 'User is not an active member of this organization.' });
      }

      const targetTu = tuRows[0];
      if (targetTu.status === 'SUSPENDED') {
        return res.status(400).json({ error: 'Cannot assign a suspended user to a team.' });
      }

      // Check and enforce 1 active team per membership invariant
      const memberRole = role || 'MEMBER';
      const memberId = `TM-${Date.now()}-${Math.random().toString(36).slice(-4)}`;

      // Upsert: update team assignment if already in another team, or insert new
      await pool.query(
        `INSERT INTO team_members (id, teamId, tenantUserId, role, joinedAt)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE teamId = VALUES(teamId), role = VALUES(role), joinedAt = NOW()`,
        [memberId, teamId, targetTu.id, memberRole]
      );

      // Audit log
      await pool.query(
        'INSERT INTO audit_logs (id, tenantId, userId, action, module, entity, entityId, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [`LOG-${Date.now()}`, team.tenantId, (req as any).userId, 'ASSIGN', 'Organization', 'TeamMember', memberId, `Assigned user ${targetTu.userId} to team ${team.name} as ${memberRole}`]
      );

      res.json({ success: true });
    } catch (err: any) {
      console.error('Error adding team member:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // DELETE /api/teams/:id/members/:tenantUserId: Remove member from team
  app.delete('/api/teams/:id/members/:targetId', async (req, res) => {
    const { id: teamId, targetId } = req.params;
    const actorRole = (req as any).userRole;
    const actorTenant = (req as any).userTenantId;
    const actorPermissions = (req as any).userPermissions || [];
    const isPlatformUser = (req as any).isPlatformUser;

    if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });
    if (!actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_TENANT') && !actorPermissions.includes('MANAGE_USERS')) {
      return res.status(403).json({ error: 'Forbidden. Requires MANAGE_USERS or MANAGE_TENANT capability.' });
    }

    try {
      const [teamRows]: any = await pool.query('SELECT * FROM teams WHERE id = ?', [teamId]);
      if (teamRows.length === 0) return res.status(404).json({ error: 'Team not found.' });

      const team = teamRows[0];
      if (team.tenantId !== actorTenant && !isPlatformUser && actorRole !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Forbidden. Cross-tenant mutation denied.' });
      }

      // Delete member record
      const [delRes]: any = await pool.query(
        `DELETE FROM team_members 
         WHERE teamId = ? AND (tenantUserId = ? OR tenantUserId IN (SELECT id FROM tenant_users WHERE userId = ?))`,
        [teamId, targetId, targetId]
      );

      if (delRes.affectedRows === 0) {
        return res.status(404).json({ error: 'Member not found in this team.' });
      }

      // If removed member was the leader, clear leaderId
      if (team.leaderId === targetId) {
        await pool.query('UPDATE teams SET leaderId = NULL WHERE id = ?', [teamId]);
      }

      // Audit log
      await pool.query(
        'INSERT INTO audit_logs (id, tenantId, userId, action, module, entity, entityId, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [`LOG-${Date.now()}`, team.tenantId, (req as any).userId, 'DELETE', 'Organization', 'TeamMember', targetId, `Removed member ${targetId} from team ${team.name}`]
      );

      res.json({ success: true });
    } catch (err: any) {
      console.error('Error removing team member:', err);
      res.status(500).json({ error: 'Internal Server Error' });
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

    // 1. Global Identity Suspension Check
    if (userContext.userGlobalStatus === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        message: 'Account identity is globally suspended',
        code: 'USER_SUSPENDED'
      });
    }

    // 2. Tenant & Membership Status Checks for tenant-scoped users
    if (userContext.tenantId && userContext.tenantId !== 'SYSTEM') {
      if (userContext.tenantUserStatus === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          message: 'Your membership in this organization is suspended',
          code: 'MEMBERSHIP_SUSPENDED'
        });
      }

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
    user.dataScope = userContext.dataScope;

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
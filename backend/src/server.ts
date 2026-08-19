import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { env } from './env';
import { pool } from './db';

const app = express();
app.use(cors());
app.use(express.json());

// SYNC ALL DATA FOR FRONTEND HYDRATION
app.get('/api/sync/all', async (req, res) => {
  try {
    const tenantId = req.query.tenantId; // optionally filter by tenant later
    
    // Fetch all core tables needed by frontend
    const [dbTenants] = await pool.query('SELECT * FROM tenants') as any[];
    const [dbUsers] = await pool.query('SELECT * FROM users') as any[]; 
    const [dbCustomers] = await pool.query('SELECT * FROM customers') as any[];
    const [dbVisits] = await pool.query('SELECT * FROM visits') as any[];
    const [dbTasks] = await pool.query('SELECT * FROM tasks') as any[];
    const [dbActivities] = await pool.query('SELECT * FROM activities') as any[];
    const [dbSalesTargets] = await pool.query('SELECT * FROM sales_targets') as any[];
    const [dbAuditLogs] = await pool.query('SELECT * FROM audit_logs') as any[];
    const [dbProjects] = await pool.query('SELECT * FROM projects') as any[];
    
    const [dbTenantUsers] = await pool.query('SELECT * FROM tenant_users') as any[];
    const [dbTenantUserRoles] = await pool.query('SELECT * FROM tenant_user_roles') as any[];
    const [dbRoles] = await pool.query('SELECT * FROM roles') as any[];

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
    .catch(err => res.status(500).json({ error: err.message }));
};

const tenantSpecificTables = [
  'users', 'tenant_users', 'roles', 'departments', 'positions',
  'customers', 'visits', 'tasks', 'opportunities', 'reports', 'audit_logs', 'notifications'
];

const setupEndpoint = (table: string) => {
  // GET all or by tenant
  app.get(`/api/${table}`, (req, res) => {
    const { tenantId } = req.query;
    let query = `SELECT * FROM ${table}`;
    const params: any[] = [];
    if (tenantId && tenantId !== 'ALL' && tenantId !== 'SYSTEM' && tenantSpecificTables.includes(table)) {
      query += ' WHERE tenantId = ?';
      params.push(tenantId);
    }
    sendRes(res, pool.query(query, params).then(([rows]) => rows));
  });

  // POST (Create)
  app.post(`/api/${table}`, async (req, res) => {
    try {
      const data = req.body;
      
      // Hash password if inserting into users table
      if (table === 'users' && data.passwordHash) {
        const salt = await bcrypt.genSalt(10);
        data.passwordHash = await bcrypt.hash(data.passwordHash, salt);
      }

      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map(() => '?').join(', ');
      
      const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
      await pool.query(query, values);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error(`Error POST ${table}:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // PUT (Update)
  app.put(`/api/${table}/:id`, async (req, res) => {
    try {
      const id = req.params.id;
      const data = req.body;

      // Hash password if updating users table and passwordHash is provided
      if (table === 'users' && data.passwordHash && !data.passwordHash.startsWith('$2a$')) {
        const salt = await bcrypt.genSalt(10);
        data.passwordHash = await bcrypt.hash(data.passwordHash, salt);
      }

      const keys = Object.keys(data).filter(k => k !== 'id');
      const values = keys.map(k => data[k]);
      const setClause = keys.map(k => `${k} = ?`).join(', ');

      const query = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
      await pool.query(query, [...values, id]);
      res.json({ success: true, id, data });
    } catch (err: any) {
      console.error(`Error PUT ${table}:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE
  app.delete(`/api/${table}/:id`, async (req, res) => {
    try {
      const id = req.params.id;
      await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
      res.json({ success: true, id });
    } catch (err: any) {
      console.error(`Error DELETE ${table}:`, err.message);
      res.status(500).json({ error: err.message });
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

tables.forEach(table => setupEndpoint(table));

  // Custom Endpoint for Role Permissions and Scopes Update
  app.post('/api/roles/:id/permissions_scopes', async (req, res) => {
    const roleId = req.params.id;
    const { permissions, dataScope } = req.body;
    
    try {
      // 1. Update Permissions
      await pool.query('DELETE FROM role_permissions WHERE roleId = ?', [roleId]);
      if (permissions && permissions.length > 0) {
        const permValues = permissions.map((p: string) => `('RP-${Date.now()}-${Math.floor(Math.random()*1000)}', '${roleId}', '${p}')`).join(', ');
        await pool.query(`INSERT INTO role_permissions (id, roleId, permissionId) VALUES ${permValues}`);
      }

      // 2. Update Scope
      await pool.query('DELETE FROM role_data_scopes WHERE roleId = ?', [roleId]);
      if (dataScope) {
        await pool.query(`INSERT INTO role_data_scopes (id, roleId, scope) VALUES ('RDS-${Date.now()}', ?, ?)`, [roleId, dataScope]);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('Error updating role permissions:', err);
      res.status(500).json({ error: err.message });
    }
  });

// --- AUTHENTICATION ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const query = `
      SELECT u.*, tu.tenantId, r.id as role, r.name as roleName
      FROM users u
      LEFT JOIN tenant_users tu ON tu.userId = u.id AND tu.isPrimary = true
      LEFT JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
      LEFT JOIN roles r ON r.id = tur.roleId
      WHERE u.email = ?
    `;
    const [userRows]: any = await pool.query(query, [email]);
    if (userRows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = userRows[0];
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    // Create Session
    const token = `jwt-token-${Date.now()}`;
    const sessionId = `SESS-${Date.now()}`;
    
    await pool.query(
      'INSERT INTO auth_sessions (id, userId, token, ipAddress, userAgent) VALUES (?, ?, ?, ?, ?)',
      [sessionId, user.id, token, req.ip, req.headers['user-agent'] || '']
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, userId, action, module, description) VALUES (?, ?, ?, ?, ?)',
      [`LOG-${Date.now()}`, user.id, 'LOGIN', 'Auth', `User ${user.email} logged in`]
    );

    res.json({ success: true, token, user });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const port = env.PORT;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

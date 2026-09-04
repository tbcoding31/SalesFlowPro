import { Router } from 'express';
import { pool } from '../db';
import { buildReportScopeWhere, validateTargetTenant } from '../utils/scope';
import { getBusinessDate } from '../utils/date';

export const tenantsRoutes = Router();

// Advanced Tenants Endpoint (Overrides generic GET /api/tenants)
tenantsRoutes.get('/', async (req, res) => {
  
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
tenantsRoutes.get('/stats', async (req, res) => {
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
tenantsRoutes.get('/:id', async (req, res) => {
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
    const [roleRows]: any = await pool.query('SELECT COUNT(*) as count FROM roles WHERE tenantId = ? OR tenantId IS NULL ', [targetId]);
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


tenantsRoutes.put('/:id', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;
  
  const targetTenantId = req.params.id;

  if (!actorRole) return res.status(401).json({ error: 'Unauthorized' });

  // Authorization: Super Admin OR (Tenant Admin of their own tenant)
  if (actorRole !== 'SUPER_ADMIN' && !actorPermissions.includes('ALL')) {
    if (actorRole !== 'TENANT_ADMIN' || actorTenant !== targetTenantId) {
      return res.status(403).json({ error: 'Access denied to edit this tenant configuration.' });
    }
  }

  // Editable whitelist (no ID, code, status, dates allowed)
  const { name, email, phone, industry, region, address, description, type } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ error: 'Organization name is required.' });

  try {
    // Note: 'type' is not updated here based on the requirement 'trial-related fields backend authoritative'
    // Actually the prompt says: "If existing product policy does not support subscription changes yet, keep the field read-only and report: SUBSCRIPTION_EDIT_POLICY = NOT_IMPLEMENTED"
    // I will let it be read-only on the frontend and backend will ignore it.

    const [result]: any = await pool.query(
      'UPDATE tenants SET name = ?, email = ?, phone = ?, industry = ?, region = ?, address = ?, description = ? WHERE id = ?',
      [name, email || null, phone || null, industry || null, region || null, address || null, description || null, targetTenantId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error updating tenant:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

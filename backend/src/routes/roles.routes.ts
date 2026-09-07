import { Router } from 'express';
import { pool } from '../db';
import { validateTargetTenant } from '../utils/scope';

export const rolesRoutes = Router();

const getAssignableRoles = async (pool: any, actorRoleId: string, actorTenantId?: string | null, targetTenantId?: string | null) => {
  try {
    // 0. Super Admin has full privilege to assign any tenant role
    if (actorRoleId === 'SUPER_ADMIN') {
      const tenantToQuery = targetTenantId || actorTenantId;
      if (tenantToQuery) {
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
    // We get their permissions first
    const [permRows]: any = await pool.query(`
      SELECT p.code as name 
          FROM role_permissions rp
      JOIN permissions p ON p.code = rp.permission
      WHERE rp.roleId = ?
    `, [actorRoleId]);
    
    const permissions = permRows.map((r: any) => r.name);
    
    if (permissions.includes('ALL') || permissions.includes('MANAGE_ROLES') || permissions.includes('MANAGE_USERS') || actorRoleId === 'TENANT_ADMIN') {
      if (actorTenantId) {
        const [tenantScopedRoles]: any = await pool.query("SELECT id FROM roles WHERE tenantId = ? AND scope = 'TENANT'", [actorTenantId]);
        assignableIds = assignableIds.concat(tenantScopedRoles.map((r: any) => r.id));
      }
    }

    // De-duplicate
    return Array.from(new Set(assignableIds));
  } catch (err: any) {
    console.error('Error in getAssignableRoles:', err.message);
    return [];
  }
};

rolesRoutes.get('/assignable', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Authoritatively validate the target tenant
  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const assignableRoleIds = await getAssignableRoles(pool, actorRole, actorTenant, targetTenant);
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
    console.error('Database error fetching roles:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

rolesRoutes.get('/platform', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  if (actorRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const [rows]: any = await pool.query(`
      SELECT r.id, r.name, r.description, r.scope, r.isSystem,
        (SELECT COUNT(*) FROM role_permissions rp WHERE rp.roleId = r.id) as permissionCount,
        rds.scope as dataScope,
        (SELECT COUNT(*) FROM global_user_roles gur WHERE gur.roleId = r.id) as assignedUserCount
      FROM roles r
      LEFT JOIN role_data_scopes rds ON r.id = rds.roleId
      WHERE r.scope IN ('PLATFORM', 'SYSTEM')
    `);
    
    // Fetch permissions array for each role
    for (let role of rows) {
      const [perms]: any = await pool.query(`
        SELECT p.code as name 
          FROM role_permissions rp 
        JOIN permissions p ON p.code = rp.permission 
        WHERE rp.roleId = ?
      `, [role.id]);
      role.permissions = perms.map((p: any) => p.name);
    }
    
    res.json({ success: true, items: rows });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

rolesRoutes.get('/templates', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  if (actorRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const [rows]: any = await pool.query(`
      SELECT r.id, r.name, r.description, r.scope, r.isSystem,
        (SELECT COUNT(*) FROM role_permissions rp WHERE rp.roleId = r.id) as permissionCount,
        rds.scope as dataScope
      FROM roles r
      LEFT JOIN role_data_scopes rds ON r.id = rds.roleId
      WHERE r.scope = 'TEMPLATE'
    `);
    
    for (let role of rows) {
      const [perms]: any = await pool.query(`
        SELECT p.code as name 
          FROM role_permissions rp 
        JOIN permissions p ON p.code = rp.permission 
        WHERE rp.roleId = ?
      `, [role.id]);
      role.permissions = perms.map((p: any) => p.name);
      
      const [policyRows]: any = await pool.query(`
        SELECT assignableRoleId FROM role_assignment_policies WHERE assignerRoleId = ?
      `, [role.id]);
      role.assignmentPolicy = policyRows.map((p: any) => p.assignableRoleId);
    }
    
    res.json(rows);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/roles/tenant - Retrieve aggregated roles for authenticated tenant
rolesRoutes.get('/tenant', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];

  if (!actorRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Target tenant determination:
  // Super Admin can pass ?tenantId=...
  // Tenant users can only ever query their own tenant (actorTenant)
  let targetTenant = actorTenant;
  if (actorRole === 'SUPER_ADMIN') {
    targetTenant = req.query.tenantId || actorTenant;
  } else {
    // If non-superadmin tries to pass a different tenantId in query -> 403 Forbidden
    if (req.query.tenantId && req.query.tenantId !== actorTenant) {
      return res.status(403).json({ error: 'Cross-tenant access forbidden' });
    }
  }

  if (!targetTenant) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  // Authorization check: Actor must be SUPER_ADMIN or have MANAGE_ROLES / ALL or be TENANT_ADMIN
  const isAuthorized = actorRole === 'SUPER_ADMIN' ||
    actorRole === 'TENANT_ADMIN' ||
    actorPermissions.includes('ALL') ||
    actorPermissions.includes('MANAGE_ROLES');

  if (!isAuthorized) {
    return res.status(403).json({ error: 'Access denied: insufficient RBAC privileges' });
  }

  try {
    const [rows]: any = await pool.query(`
      SELECT r.id, r.code, r.name, r.description, r.scope, r.isSystem, r.tenantId,
        (SELECT COUNT(*) FROM role_permissions rp WHERE rp.roleId = r.id) as permissionCount,
        COALESCE(rds.scope, 'TEAM') as dataScope,
        (SELECT COUNT(*) FROM tenant_user_roles tur WHERE tur.roleId = r.id) as memberCount
      FROM roles r
      LEFT JOIN role_data_scopes rds ON r.id = rds.roleId
      WHERE r.tenantId = ?
      ORDER BY r.isSystem DESC, r.name ASC
    `, [targetTenant]);

    for (let role of rows) {
      const [perms]: any = await pool.query(`
        SELECT p.code as name
        FROM role_permissions rp
        JOIN permissions p ON p.code = rp.permission
        WHERE rp.roleId = ?
      `, [role.id]);
      const permNames = perms.map((p: any) => p.name);
      role.permissions = permNames;
      role.assignedPermissions = permNames;
      role.role = role.id;
      role.roleName = role.name;
    }

    res.json({ success: true, items: rows });
  } catch (err: any) {
    console.error('Error fetching tenant roles:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/roles/tenant/:roleId/permissions - Update permissions and data scope for a tenant role
rolesRoutes.post('/tenant/:roleId/permissions', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];
  const roleId = req.params.roleId;
  const { permissions, dataScope } = req.body;

  if (!actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const isAuthorized = actorRole === 'SUPER_ADMIN' ||
    actorRole === 'TENANT_ADMIN' ||
    actorPermissions.includes('ALL') ||
    actorPermissions.includes('MANAGE_ROLES');

  if (!isAuthorized) return res.status(403).json({ error: 'Access denied' });

  // Verify role belongs to actorTenant (unless SUPER_ADMIN)
  const [roleRows]: any = await pool.query('SELECT * FROM roles WHERE id = ?', [roleId]);
  if (roleRows.length === 0) return res.status(404).json({ error: 'Role not found' });

  const role = roleRows[0];
  if (actorRole !== 'SUPER_ADMIN' && role.tenantId !== actorTenant) {
    return res.status(403).json({ error: 'Cross-tenant access forbidden' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (dataScope) {
      await connection.query('DELETE FROM role_data_scopes WHERE roleId = ?', [roleId]);
      const rdsId = `RDS-${Date.now()}-${Math.random().toString(36).substring(2,8)}`;
      await connection.query('INSERT INTO role_data_scopes (id, roleId, scope) VALUES (?, ?, ?)', [rdsId, roleId, dataScope]);
    }

    if (Array.isArray(permissions)) {
      await connection.query('DELETE FROM role_permissions WHERE roleId = ?', [roleId]);
      for (const perm of permissions) {
        await connection.query('INSERT INTO role_permissions (roleId, permission) VALUES (?, ?)', [roleId, perm]);
      }
    }

    await connection.commit();
    res.json({ success: true, message: 'Permissions and scope updated successfully' });
  } catch (err: any) {
    await connection.rollback();
    console.error('Error updating role permissions:', err);
    res.status(500).json({ error: 'Failed to update permissions' });
  } finally {
    connection.release();
  }
});

// POST /api/roles/tenant - Create custom tenant role
rolesRoutes.post('/tenant', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];

  if (!actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const isAuthorized = actorRole === 'SUPER_ADMIN' ||
    actorRole === 'TENANT_ADMIN' ||
    actorPermissions.includes('ALL') ||
    actorPermissions.includes('MANAGE_ROLES');

  if (!isAuthorized) return res.status(403).json({ error: 'Access denied' });

  const targetTenant = actorRole === 'SUPER_ADMIN' ? (req.body.tenantId || actorTenant) : actorTenant;
  if (!targetTenant) return res.status(400).json({ error: 'Tenant ID required' });

  const { name, code, description, dataScope, permissions } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Role name is required' });

  const roleCode = (code || name).trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const roleId = req.body.id || `ROLE-${targetTenant}-${roleCode}-${Date.now().toString().slice(-4)}`;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(`
      INSERT INTO roles (id, tenantId, code, name, description, isSystem, scope)
      VALUES (?, ?, ?, ?, ?, 0, 'TENANT')
    `, [roleId, targetTenant, roleCode, name.trim(), description || `Custom role ${name.trim()}`]);

    const scopeToSet = dataScope || 'TEAM';
    const rdsId = `RDS-${Date.now()}-${Math.random().toString(36).substring(2,8)}`;
    await connection.query('INSERT INTO role_data_scopes (id, roleId, scope) VALUES (?, ?, ?)', [rdsId, roleId, scopeToSet]);

    if (Array.isArray(permissions)) {
      for (const perm of permissions) {
        await connection.query('INSERT INTO role_permissions (roleId, permission) VALUES (?, ?)', [roleId, perm]);
      }
    }

    await connection.commit();
    res.status(201).json({ success: true, id: roleId, code: roleCode, name: name.trim() });
  } catch (err: any) {
    await connection.rollback();
    console.error('Error creating custom role:', err);
    res.status(500).json({ error: 'Failed to create role' });
  } finally {
    connection.release();
  }
});

// PUT /api/roles/tenant/:roleId - Rename custom role
rolesRoutes.put('/tenant/:roleId', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];
  const roleId = req.params.roleId;
  const { name, description } = req.body;

  if (!actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const isAuthorized = actorRole === 'SUPER_ADMIN' ||
    actorRole === 'TENANT_ADMIN' ||
    actorPermissions.includes('ALL') ||
    actorPermissions.includes('MANAGE_ROLES');

  if (!isAuthorized) return res.status(403).json({ error: 'Access denied' });

  const [roleRows]: any = await pool.query('SELECT * FROM roles WHERE id = ?', [roleId]);
  if (roleRows.length === 0) return res.status(404).json({ error: 'Role not found' });

  const role = roleRows[0];
  if (actorRole !== 'SUPER_ADMIN' && role.tenantId !== actorTenant) {
    return res.status(403).json({ error: 'Cross-tenant access forbidden' });
  }

  if (role.isSystem) {
    return res.status(400).json({ error: 'System default roles cannot be renamed' });
  }

  await pool.query('UPDATE roles SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?', [
    name ? name.trim() : null,
    description ? description.trim() : null,
    roleId
  ]);

  res.json({ success: true, message: 'Role updated successfully' });
});

// DELETE /api/roles/tenant/:roleId - Delete custom role
rolesRoutes.delete('/tenant/:roleId', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];
  const roleId = req.params.roleId;

  if (!actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const isAuthorized = actorRole === 'SUPER_ADMIN' ||
    actorRole === 'TENANT_ADMIN' ||
    actorPermissions.includes('ALL') ||
    actorPermissions.includes('MANAGE_ROLES');

  if (!isAuthorized) return res.status(403).json({ error: 'Access denied' });

  const [roleRows]: any = await pool.query('SELECT * FROM roles WHERE id = ?', [roleId]);
  if (roleRows.length === 0) return res.status(404).json({ error: 'Role not found' });

  const role = roleRows[0];
  if (actorRole !== 'SUPER_ADMIN' && role.tenantId !== actorTenant) {
    return res.status(403).json({ error: 'Cross-tenant access forbidden' });
  }

  if (role.isSystem) {
    return res.status(400).json({ error: 'System default roles cannot be deleted' });
  }

  const [assignedUsers]: any = await pool.query('SELECT COUNT(*) as count FROM tenant_user_roles WHERE roleId = ?', [roleId]);
  if (assignedUsers[0].count > 0) {
    return res.status(400).json({ error: `Cannot delete role: ${assignedUsers[0].count} active user(s) assigned` });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM role_permissions WHERE roleId = ?', [roleId]);
    await connection.query('DELETE FROM role_data_scopes WHERE roleId = ?', [roleId]);
    await connection.query('DELETE FROM roles WHERE id = ?', [roleId]);
    await connection.commit();
    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (err: any) {
    await connection.rollback();
    console.error('Error deleting role:', err);
    res.status(500).json({ error: 'Failed to delete role' });
  } finally {
    connection.release();
  }
});

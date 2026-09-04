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
      SELECT p.name 
      FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permissionId
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

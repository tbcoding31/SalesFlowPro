import { Router } from 'express';
import { pool } from '../db';
import { validateTargetTenant } from '../utils/scope';

export const usersRoutes = Router();

usersRoutes.get('/', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Use validateTargetTenant to ensure cross-tenant is blocked unless SUPER_ADMIN
  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return; // response already sent in validateTargetTenant (403/404)

  try {
    const { assignable } = req.query;

    let query = `
      SELECT 
        u.id, 
        u.email, 
        u.name, 
        u.avatar as avatarUrl,
        u.avatar, 
        u.createdAt, 
        u.lastLoginAt,
        u.status AS identityStatus,
        COALESCE(tu.status, u.status, 'ACTIVE') AS status,
        COALESCE(tu.status, u.status, 'ACTIVE') AS membershipStatus,
        tu.id AS tenantUserId, 
          tu.tenantId, 
          (
            SELECT COUNT(tasks.id) 
            FROM tasks 
            LEFT JOIN task_statuses ts ON ts.id = tasks.statusId
            WHERE tasks.tenantId = tu.tenantId 
            AND tasks.picId = u.id 
            AND (ts.code NOT IN ('TSK_COMPLETED', 'TSK_CANCELLED') OR ts.code IS NULL)
            AND tasks.statusId NOT IN ('COMPLETED', 'CANCELLED', 'TS-3', 'TS-4')
          ) AS taskCount,
          (
            SELECT COUNT(tasks.id) 
            FROM tasks 
            LEFT JOIN task_statuses ts ON ts.id = tasks.statusId
            WHERE tasks.tenantId = tu.tenantId 
            AND tasks.picId = u.id 
            AND (ts.code NOT IN ('TSK_COMPLETED', 'TSK_CANCELLED') OR ts.code IS NULL)
            AND tasks.statusId NOT IN ('COMPLETED', 'CANCELLED', 'TS-3', 'TS-4')
          ) AS activeTasksCount, 
        tu.isPrimary,
        r.id AS role, 
        r.name AS roleName,
        rds.scope AS dataScope,
        t.id AS teamId, 
        t.name AS teamName, 
        tm.role AS teamRole
      FROM tenant_users tu
      JOIN users u ON u.id = tu.userId
      LEFT JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
      LEFT JOIN roles r ON r.id = tur.roleId
      LEFT JOIN role_data_scopes rds ON rds.roleId = r.id
      LEFT JOIN team_members tm ON tm.tenantUserId = tu.id
      LEFT JOIN teams t ON t.id = tm.teamId
      WHERE tu.tenantId = ?
    `;

    const params: any[] = [targetTenant];

    if (assignable === 'true' || assignable === '1') {
      query += ` AND u.status = 'ACTIVE' AND tu.status = 'ACTIVE'`;
    }

    query += ' ORDER BY u.name ASC';

    const [rows]: any = await pool.query(query, params);

    res.json(rows);
  } catch (err: any) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

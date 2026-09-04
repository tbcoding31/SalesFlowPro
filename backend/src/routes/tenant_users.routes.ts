import { Router } from 'express';
import { pool } from '../db';
import { validateTargetTenant } from '../utils/scope';
import bcrypt from 'bcryptjs';

export const tenantUsersRoutes = Router();

// Re-use the getAssignableRoles logic (simplified to query here or imported if exported)
// Actually we can just query it here directly for the POST logic to keep it modular.
const isRoleAssignable = async (pool: any, actorRoleId: string, actorTenantId: string | null, targetTenantId: string, roleId: string) => {
  if (actorRoleId === 'SUPER_ADMIN') {
    const [tenantRoleRows]: any = await pool.query("SELECT id FROM roles WHERE tenantId = ? AND scope = 'TENANT'", [targetTenantId]);
    const validRoles = tenantRoleRows.map((r: any) => r.id);
    return validRoles.includes(roleId);
  }

  // Check policy
  const [rows]: any = await pool.query('SELECT assignableRoleId as roleId FROM role_assignment_policies WHERE assignerRoleId = ?', [actorRoleId]);
  let assignableIds = rows.map((r: any) => r.roleId);

  // Check MANAGE_USERS / MANAGE_ROLES capability
  const [permRows]: any = await pool.query(`
    SELECT p.name 
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permissionId
    WHERE rp.roleId = ?
  `, [actorRoleId]);
  const permissions = permRows.map((r: any) => r.name);
  
  if (permissions.includes('ALL') || permissions.includes('MANAGE_ROLES') || permissions.includes('MANAGE_USERS') || actorRoleId === 'TENANT_ADMIN') {
    if (actorTenantId && actorTenantId === targetTenantId) {
      const [tenantScopedRoles]: any = await pool.query("SELECT id FROM roles WHERE tenantId = ? AND scope = 'TENANT'", [actorTenantId]);
      assignableIds = assignableIds.concat(tenantScopedRoles.map((r: any) => r.id));
    }
  }

  return assignableIds.includes(roleId);
};

tenantUsersRoutes.post('/', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;
  const { email, password, name, roleId, teamId } = req.body;
  
  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });
  if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required' });
  if (!password || password.trim().length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  
  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const roleAssignable = await isRoleAssignable(pool, actorRole, actorTenant, targetTenant, roleId);
  if (!roleAssignable) {
    return res.status(403).json({ error: 'Role assignment not permitted by policy.' });
  }

  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const trimmedEmail = email.trim().toLowerCase();
    const [existingUserRows]: any = await connection.query('SELECT * FROM users WHERE email = ? FOR UPDATE', [trimmedEmail]);
    
    let userId: string;

    if (existingUserRows.length > 0) {
      const existingUser = existingUserRows[0];
      userId = existingUser.id;

      if (existingUser.status === 'SUSPENDED') {
        await connection.rollback();
        return res.status(403).json({ error: 'User identity is suspended and cannot be added to an organization.', code: 'USER_SUSPENDED' });
      }

      const [existingMembershipRows]: any = await connection.query(
        'SELECT id FROM tenant_users WHERE tenantId = ? AND userId = ?',
        [targetTenant, userId]
      );

      if (existingMembershipRows.length > 0) {
        await connection.rollback();
        return res.status(409).json({ error: 'User is already a member of this tenant.', code: 'USER_ALREADY_MEMBER' });
      }
    } else {
      userId = `USR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const passwordHash = await bcrypt.hash(password, 10);
      
      await connection.query(
        'INSERT INTO users (id, email, passwordHash, name, status, createdAt) VALUES (?, ?, ?, ?, ?, NOW())',
        [userId, trimmedEmail, passwordHash, name, 'ACTIVE']
      );
    }

    const tenantUserId = `TU-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    await connection.query(
      'INSERT INTO tenant_users (id, tenantId, userId, isPrimary, status, joinedAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [tenantUserId, targetTenant, userId, existingUserRows.length === 0, 'ACTIVE']
    );

    const tenantUserRoleId = `TUR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    await connection.query(
      'INSERT INTO tenant_user_roles (id, tenantUserId, roleId) VALUES (?, ?, ?)',
      [tenantUserRoleId, tenantUserId, roleId]
    );

    let resolvedTeamName = undefined;
    if (teamId) {
      const [teamRows]: any = await connection.query('SELECT id, name FROM teams WHERE id = ? AND tenantId = ?', [teamId, targetTenant]);
      if (teamRows.length === 0) {
        await connection.rollback();
        return res.status(400).json({ error: 'Invalid team selected.' });
      }
      resolvedTeamName = teamRows[0].name;
      
      const teamMemberId = `TM-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      await connection.query(
        'INSERT INTO team_members (id, teamId, tenantUserId, role, joinedAt) VALUES (?, ?, ?, ?, NOW())',
        [teamMemberId, teamId, tenantUserId, 'MEMBER']
      );
    }

    const [roleRows]: any = await connection.query('SELECT name FROM roles WHERE id = ?', [roleId]);
    const roleName = roleRows[0]?.name || '';

    await connection.commit();

    res.status(201).json({
      success: true,
      user: {
        id: userId,
        email: trimmedEmail,
        name,
        tenantId: targetTenant,
        tenantUserId,
        role: roleId,
        roleName,
        teamId: teamId || undefined,
        teamName: resolvedTeamName,
        status: 'ACTIVE'
      }
    });
  } catch (err: any) {
    await connection.rollback();
    console.error('Error in POST /api/tenant/users:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    connection.release();
  }
});

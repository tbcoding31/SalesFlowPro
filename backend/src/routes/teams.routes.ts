import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { validateTargetTenant } from '../utils/scope';
import { normalizeSemanticRole } from './navigation.routes';

export const teamsRoutes = Router();

// Helper to extract and normalize actor context
function getActorContext(req: any) {
  const rawRole = req.userRoleCode || req.userRole;
  const isPlatformUser = Boolean(req.isPlatformUser);
  const actorRole = normalizeSemanticRole(rawRole, isPlatformUser);
  const actorTenant = req.userTenantId;
  const actorUserId = req.userId;
  return { actorRole, actorTenant, isPlatformUser, actorUserId };
}

// Helper to resolve actor tenantUserId
async function getActorTenantUserId(userId: string, tenantId: string): Promise<string | null> {
  if (!userId || !tenantId) return null;
  const [rows]: any = await pool.query(
    'SELECT id FROM tenant_users WHERE userId = ? AND tenantId = ? AND status = "ACTIVE"',
    [userId, tenantId]
  );
  return rows[0]?.id || null;
}

// ─────────────────────────────────────────────────────────────
// 1. GET /api/teams — List Teams
// ─────────────────────────────────────────────────────────────
teamsRoutes.get('/', async (req: any, res: any) => {
  const { actorRole, actorTenant, isPlatformUser } = getActorContext(req);

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  try {
    const query = `
      SELECT 
        t.id, t.tenantId, t.name, t.description, t.leaderId,
        u.name as leaderName, u.email as leaderEmail,
        lu.status as leaderStatus, lu.userId as leaderUserId,
        COUNT(DISTINCT tm.tenantUserId) as memberCount
      FROM teams t
      LEFT JOIN tenant_users lu ON lu.id = t.leaderId
      LEFT JOIN users u ON u.id = lu.userId
      LEFT JOIN team_members tm ON tm.teamId = t.id
      WHERE t.tenantId = ?
      GROUP BY t.id, t.tenantId, t.name, t.description, t.leaderId, u.name, u.email, lu.status, lu.userId
      ORDER BY t.name ASC
    `;

    const [rows]: any = await pool.query(query, [targetTenant]);
    res.json(rows);
  } catch (err: any) {
    console.error('Error fetching teams:', err.message);
    res.status(500).json({ error: 'Internal Server Error', code: 'SERVER_ERROR' });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. GET /api/teams/:id — Team Detail & Members
// ─────────────────────────────────────────────────────────────
teamsRoutes.get('/:id', async (req: any, res: any) => {
  const { actorRole, actorTenant, isPlatformUser } = getActorContext(req);
  const teamId = req.params.id;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  try {
    const teamQuery = `
      SELECT 
        t.id, t.tenantId, t.name, t.description, t.leaderId,
        u.name as leaderName, u.email as leaderEmail,
        lu.status as leaderStatus, lu.userId as leaderUserId,
        COUNT(DISTINCT tm.tenantUserId) as memberCount
      FROM teams t
      LEFT JOIN tenant_users lu ON lu.id = t.leaderId
      LEFT JOIN users u ON u.id = lu.userId
      LEFT JOIN team_members tm ON tm.teamId = t.id
      WHERE t.id = ? AND t.tenantId = ?
      GROUP BY t.id, t.tenantId, t.name, t.description, t.leaderId, u.name, u.email, lu.status, lu.userId
    `;
    const [teamRows]: any = await pool.query(teamQuery, [teamId, targetTenant]);
    if (teamRows.length === 0) {
      return res.status(404).json({ error: 'Team not found', code: 'NOT_FOUND' });
    }

    const membersQuery = `
      SELECT 
        tm.id, tm.teamId, tm.tenantUserId, tu.userId,
        u.name, u.email,
        COALESCE(r.name, tur.roleId, 'MEMBER') as role,
        COALESCE(tm.role, 'MEMBER') as teamRole,
        tu.status, tm.joinedAt
      FROM team_members tm
      JOIN tenant_users tu ON tu.id = tm.tenantUserId
      JOIN users u ON u.id = tu.userId
      LEFT JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
      LEFT JOIN roles r ON r.id = tur.roleId
      WHERE tm.teamId = ? AND tu.tenantId = ?
      ORDER BY CASE WHEN tm.role = 'LEADER' THEN 0 ELSE 1 END, u.name ASC
    `;
    const [membersRows]: any = await pool.query(membersQuery, [teamId, targetTenant]);

    const team = {
      ...teamRows[0],
      members: membersRows
    };

    res.json(team);
  } catch (err: any) {
    console.error('Error fetching team detail:', err.message);
    res.status(500).json({ error: 'Internal Server Error', code: 'SERVER_ERROR' });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. POST /api/teams — Create Team
// ─────────────────────────────────────────────────────────────
teamsRoutes.post('/', async (req: any, res: any) => {
  const { actorRole, actorTenant, isPlatformUser } = getActorContext(req);

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  // Permission Guard: Only TENANT_ADMIN and SUPER_ADMIN may create teams
  if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'TENANT_ADMIN') {
    return res.status(403).json({
      error: 'Forbidden: Insufficient permissions to create team',
      code: 'FORBIDDEN'
    });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { name, description, leaderId } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Team name is required', code: 'VALIDATION_ERROR' });
  }

  const trimmedName = name.trim();
  const trimmedDesc = description ? description.trim() : null;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    // 1. Check duplicate team name in this tenant
    const [existing]: any = await conn.query(
      'SELECT id FROM teams WHERE tenantId = ? AND LOWER(name) = LOWER(?)',
      [targetTenant, trimmedName]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        error: 'A team with this name already exists in this organization.',
        code: 'DUPLICATE_TEAM_NAME'
      });
    }

    let validLeaderTenantUserId: string | null = null;
    if (leaderId) {
      // Validate leader belongs to same tenant and is active
      const [leaderRows]: any = await conn.query(
        'SELECT id, status, tenantId FROM tenant_users WHERE (id = ? OR userId = ?) AND tenantId = ?',
        [leaderId, leaderId, targetTenant]
      );

      if (leaderRows.length === 0) {
        await conn.rollback();
        return res.status(400).json({
          error: 'Assigned leader does not belong to this tenant',
          code: 'INVALID_LEADER'
        });
      }

      if (leaderRows[0].status !== 'ACTIVE') {
        await conn.rollback();
        return res.status(400).json({
          error: 'Assigned leader user is not active',
          code: 'LEADER_INACTIVE'
        });
      }

      validLeaderTenantUserId = leaderRows[0].id;
    }

    const newTeamId = crypto.randomUUID();

    // 2. Insert team
    await conn.query(
      'INSERT INTO teams (id, tenantId, name, description, leaderId) VALUES (?, ?, ?, ?, ?)',
      [newTeamId, targetTenant, trimmedName, trimmedDesc, validLeaderTenantUserId]
    );

    // 3. If leader specified, sync into team_members
    if (validLeaderTenantUserId) {
      const [memberCheck]: any = await conn.query(
        'SELECT id FROM team_members WHERE tenantUserId = ?',
        [validLeaderTenantUserId]
      );

      if (memberCheck.length > 0) {
        // User was in another team or existing membership; reassign to this team as LEADER
        await conn.query(
          'UPDATE team_members SET teamId = ?, role = "LEADER", joinedAt = NOW() WHERE tenantUserId = ?',
          [newTeamId, validLeaderTenantUserId]
        );
      } else {
        const newMemberId = crypto.randomUUID();
        await conn.query(
          'INSERT INTO team_members (id, teamId, tenantUserId, role, joinedAt) VALUES (?, ?, ?, "LEADER", NOW())',
          [newMemberId, newTeamId, validLeaderTenantUserId]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ success: true, teamId: newTeamId });
  } catch (err: any) {
    await conn.rollback();
    console.error('Error creating team:', err.message);
    res.status(500).json({ error: 'Internal Server Error', code: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────
// 4. PUT /api/teams/:id — Update Team Details & Leader
// ─────────────────────────────────────────────────────────────
teamsRoutes.put('/:id', async (req: any, res: any) => {
  const { actorRole, actorTenant, isPlatformUser } = getActorContext(req);
  const teamId = req.params.id;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  // Permission Guard: Only TENANT_ADMIN and SUPER_ADMIN may update team metadata and leaders
  if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'TENANT_ADMIN') {
    return res.status(403).json({
      error: 'Forbidden: Insufficient permissions to update team',
      code: 'FORBIDDEN'
    });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { name, description, leaderId } = req.body || {};

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    // 1. Verify team exists in this tenant
    const [teamRows]: any = await conn.query(
      'SELECT id, name, description, leaderId FROM teams WHERE id = ? AND tenantId = ?',
      [teamId, targetTenant]
    );

    if (teamRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Team not found', code: 'NOT_FOUND' });
    }

    const currentTeam = teamRows[0];
    let updatedName = currentTeam.name;
    let updatedDesc = currentTeam.description;
    let updatedLeaderId = currentTeam.leaderId;

    // 2. Validate name if changing
    if (name !== undefined) {
      if (!name || !name.trim()) {
        await conn.rollback();
        return res.status(400).json({ error: 'Team name cannot be empty', code: 'VALIDATION_ERROR' });
      }
      const trimmedName = name.trim();
      const [duplicate]: any = await conn.query(
        'SELECT id FROM teams WHERE tenantId = ? AND LOWER(name) = LOWER(?) AND id != ?',
        [targetTenant, trimmedName, teamId]
      );
      if (duplicate.length > 0) {
        await conn.rollback();
        return res.status(409).json({
          error: 'A team with this name already exists in this organization.',
          code: 'DUPLICATE_TEAM_NAME'
        });
      }
      updatedName = trimmedName;
    }

    if (description !== undefined) {
      updatedDesc = description ? description.trim() : null;
    }

    // 3. Handle leader assignment change
    if (leaderId !== undefined) {
      if (leaderId === null || leaderId === '') {
        // Demote existing leader in team_members if any
        if (currentTeam.leaderId) {
          await conn.query(
            'UPDATE team_members SET role = "MEMBER" WHERE teamId = ? AND tenantUserId = ?',
            [teamId, currentTeam.leaderId]
          );
        }
        updatedLeaderId = null;
      } else {
        // Validate new leader
        const [leaderRows]: any = await conn.query(
          'SELECT id, status FROM tenant_users WHERE (id = ? OR userId = ?) AND tenantId = ?',
          [leaderId, leaderId, targetTenant]
        );

        if (leaderRows.length === 0) {
          await conn.rollback();
          return res.status(400).json({
            error: 'Assigned leader does not belong to this tenant',
            code: 'INVALID_LEADER'
          });
        }

        if (leaderRows[0].status !== 'ACTIVE') {
          await conn.rollback();
          return res.status(400).json({
            error: 'Assigned leader user is not active',
            code: 'LEADER_INACTIVE'
          });
        }

        const newLeaderTenantUserId = leaderRows[0].id;

        // If different leader, demote old leader
        if (currentTeam.leaderId && currentTeam.leaderId !== newLeaderTenantUserId) {
          await conn.query(
            'UPDATE team_members SET role = "MEMBER" WHERE teamId = ? AND tenantUserId = ?',
            [teamId, currentTeam.leaderId]
          );
        }

        // Sync new leader in team_members
        const [memberCheck]: any = await conn.query(
          'SELECT id FROM team_members WHERE tenantUserId = ?',
          [newLeaderTenantUserId]
        );

        if (memberCheck.length > 0) {
          await conn.query(
            'UPDATE team_members SET teamId = ?, role = "LEADER", joinedAt = NOW() WHERE tenantUserId = ?',
            [teamId, newLeaderTenantUserId]
          );
        } else {
          const newMemberId = crypto.randomUUID();
          await conn.query(
            'INSERT INTO team_members (id, teamId, tenantUserId, role, joinedAt) VALUES (?, ?, ?, "LEADER", NOW())',
            [newMemberId, teamId, newLeaderTenantUserId]
          );
        }

        updatedLeaderId = newLeaderTenantUserId;
      }
    }

    // 4. Update team row
    await conn.query(
      'UPDATE teams SET name = ?, description = ?, leaderId = ? WHERE id = ? AND tenantId = ?',
      [updatedName, updatedDesc, updatedLeaderId, teamId, targetTenant]
    );

    await conn.commit();
    res.json({ success: true, teamId });
  } catch (err: any) {
    await conn.rollback();
    console.error('Error updating team:', err.message);
    res.status(500).json({ error: 'Internal Server Error', code: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────
// 5. DELETE /api/teams/:id — Delete Team
// ─────────────────────────────────────────────────────────────
teamsRoutes.delete('/:id', async (req: any, res: any) => {
  const { actorRole, actorTenant, isPlatformUser } = getActorContext(req);
  const teamId = req.params.id;
  const force = req.query.force === 'true';

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  // Permission Guard: Only TENANT_ADMIN and SUPER_ADMIN may delete teams
  if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'TENANT_ADMIN') {
    return res.status(403).json({
      error: 'Forbidden: Insufficient permissions to delete team',
      code: 'FORBIDDEN'
    });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [teamRows]: any = await conn.query(
      'SELECT id, name FROM teams WHERE id = ? AND tenantId = ?',
      [teamId, targetTenant]
    );

    if (teamRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Team not found', code: 'NOT_FOUND' });
    }

    const [memberRows]: any = await conn.query(
      'SELECT COUNT(*) as memberCount FROM team_members WHERE teamId = ?',
      [teamId]
    );
    const memberCount = memberRows[0]?.memberCount || 0;

    if (memberCount > 0 && !force) {
      await conn.rollback();
      return res.status(400).json({
        error: 'This team still has active members. Move or remove all members before deleting the team.',
        code: 'TEAM_HAS_MEMBERS'
      });
    }

    // Safe deletion inside transaction
    await conn.query('DELETE FROM team_members WHERE teamId = ?', [teamId]);
    await conn.query('DELETE FROM teams WHERE id = ? AND tenantId = ?', [teamId, targetTenant]);

    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Error deleting team:', err.message);
    res.status(500).json({ error: 'Internal Server Error', code: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────
// 6. POST /api/teams/:id/members — Add Team Member
// ─────────────────────────────────────────────────────────────
teamsRoutes.post('/:id/members', async (req: any, res: any) => {
  const { actorRole, actorTenant, isPlatformUser, actorUserId } = getActorContext(req);
  const teamId = req.params.id;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    // 1. Verify team exists in this tenant
    const [teamRows]: any = await conn.query(
      'SELECT id, leaderId FROM teams WHERE id = ? AND tenantId = ?',
      [teamId, targetTenant]
    );

    if (teamRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Team not found', code: 'NOT_FOUND' });
    }

    const currentTeam = teamRows[0];

    // 2. Role Guard:
    // SUPER_ADMIN & TENANT_ADMIN: allowed
    // SUPERVISOR: allowed only for their own team, and cannot assign role='LEADER'
    // SALES_MANAGER & SALES_REP: forbidden
    if (actorRole === 'SUPERVISOR') {
      const supervisorTenantUserId = await getActorTenantUserId(actorUserId, targetTenant);
      if (!supervisorTenantUserId || currentTeam.leaderId !== supervisorTenantUserId) {
        await conn.rollback();
        return res.status(403).json({
          error: 'Forbidden: Supervisors can only manage members in their assigned team',
          code: 'FORBIDDEN'
        });
      }
      if (req.body?.role === 'LEADER') {
        await conn.rollback();
        return res.status(403).json({
          error: 'Forbidden: Supervisors cannot assign team leaders',
          code: 'FORBIDDEN'
        });
      }
    } else if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'TENANT_ADMIN') {
      await conn.rollback();
      return res.status(403).json({
        error: 'Forbidden: Insufficient permissions to add team members',
        code: 'FORBIDDEN'
      });
    }

    const { tenantUserId, role } = req.body || {};
    if (!tenantUserId) {
      await conn.rollback();
      return res.status(400).json({ error: 'tenantUserId is required', code: 'VALIDATION_ERROR' });
    }

    const assignedRole = role === 'LEADER' ? 'LEADER' : 'MEMBER';

    // 3. Verify user belongs to same tenant and is active
    const [userRows]: any = await conn.query(
      'SELECT id, tenantId, status FROM tenant_users WHERE (id = ? OR userId = ?) AND tenantId = ?',
      [tenantUserId, tenantUserId, targetTenant]
    );

    if (userRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        error: 'User does not belong to this tenant',
        code: 'CROSS_TENANT_USER_DENIED'
      });
    }

    const targetUser = userRows[0];
    if (targetUser.status !== 'ACTIVE') {
      await conn.rollback();
      return res.status(400).json({
        error: 'Cannot add inactive user to team',
        code: 'USER_INACTIVE'
      });
    }

    const actualTenantUserId = targetUser.id;

    // 4. Check if user is already a member of THIS team
    const [existingThisTeam]: any = await conn.query(
      'SELECT id FROM team_members WHERE teamId = ? AND tenantUserId = ?',
      [teamId, actualTenantUserId]
    );

    if (existingThisTeam.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        error: 'User is already a member of this team',
        code: 'DUPLICATE_TEAM_MEMBER'
      });
    }

    // 5. Handle single active team membership constraint
    const [existingAnyTeam]: any = await conn.query(
      'SELECT id, teamId FROM team_members WHERE tenantUserId = ?',
      [actualTenantUserId]
    );

    let memberId: string;
    if (existingAnyTeam.length > 0) {
      // Reassign to new team
      memberId = existingAnyTeam[0].id;
      await conn.query(
        'UPDATE team_members SET teamId = ?, role = ?, joinedAt = NOW() WHERE tenantUserId = ?',
        [teamId, assignedRole, actualTenantUserId]
      );
    } else {
      memberId = crypto.randomUUID();
      await conn.query(
        'INSERT INTO team_members (id, teamId, tenantUserId, role, joinedAt) VALUES (?, ?, ?, ?, NOW())',
        [memberId, teamId, actualTenantUserId, assignedRole]
      );
    }

    // If assigned as leader, update team leader
    if (assignedRole === 'LEADER') {
      await conn.query(
        'UPDATE teams SET leaderId = ? WHERE id = ? AND tenantId = ?',
        [actualTenantUserId, teamId, targetTenant]
      );
    }

    await conn.commit();
    res.status(201).json({ success: true, memberId });
  } catch (err: any) {
    await conn.rollback();
    console.error('Error adding team member:', err.message);
    res.status(500).json({ error: 'Internal Server Error', code: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────
// 7. DELETE /api/teams/:id/members/:targetId — Remove Member
// ─────────────────────────────────────────────────────────────
teamsRoutes.delete('/:id/members/:targetId', async (req: any, res: any) => {
  const { actorRole, actorTenant, isPlatformUser, actorUserId } = getActorContext(req);
  const teamId = req.params.id;
  const targetId = req.params.targetId;
  const allowLeaderRemoval = req.query.allowLeaderRemoval === 'true';

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    // 1. Verify team exists in this tenant
    const [teamRows]: any = await conn.query(
      'SELECT id, leaderId FROM teams WHERE id = ? AND tenantId = ?',
      [teamId, targetTenant]
    );

    if (teamRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Team not found', code: 'NOT_FOUND' });
    }

    const currentTeam = teamRows[0];

    // 2. Role Guard:
    if (actorRole === 'SUPERVISOR') {
      const supervisorTenantUserId = await getActorTenantUserId(actorUserId, targetTenant);
      if (!supervisorTenantUserId || currentTeam.leaderId !== supervisorTenantUserId) {
        await conn.rollback();
        return res.status(403).json({
          error: 'Forbidden: Supervisors can only manage members in their assigned team',
          code: 'FORBIDDEN'
        });
      }
    } else if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'TENANT_ADMIN') {
      await conn.rollback();
      return res.status(403).json({
        error: 'Forbidden: Insufficient permissions to remove team members',
        code: 'FORBIDDEN'
      });
    }

    // 3. Find member in this team
    const [memberRows]: any = await conn.query(
      `SELECT tm.id, tm.tenantUserId, tm.role 
       FROM team_members tm
       JOIN tenant_users tu ON tu.id = tm.tenantUserId
       WHERE tm.teamId = ? AND tu.tenantId = ? AND (tm.id = ? OR tm.tenantUserId = ? OR tu.userId = ?)`,
      [teamId, targetTenant, targetId, targetId, targetId]
    );

    if (memberRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Team member not found', code: 'NOT_FOUND' });
    }

    const memberToDelete = memberRows[0];

    // 4. Leader removal business rule
    const isLeader = memberToDelete.tenantUserId === currentTeam.leaderId || memberToDelete.role === 'LEADER';
    if (isLeader && !allowLeaderRemoval) {
      await conn.rollback();
      return res.status(400).json({
        error: 'Cannot remove team leader without reassigning leadership. Please assign a new leader first.',
        code: 'CANNOT_REMOVE_LEADER'
      });
    }

    // If leader removal is explicitly allowed, clear leaderId on teams table
    if (isLeader) {
      await conn.query(
        'UPDATE teams SET leaderId = NULL WHERE id = ? AND tenantId = ?',
        [teamId, targetTenant]
      );
    }

    // Delete membership
    await conn.query('DELETE FROM team_members WHERE id = ?', [memberToDelete.id]);

    await conn.commit();
    res.json({ success: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Error removing team member:', err.message);
    res.status(500).json({ error: 'Internal Server Error', code: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});

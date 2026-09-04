import { Router } from 'express';
import { pool } from '../db';
import { validateTargetTenant } from '../utils/scope';

export const teamsRoutes = Router();

teamsRoutes.get('/', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Use validateTargetTenant to enforce proper access control
  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return; // validateTargetTenant handles the error response

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
      WHERE t.tenantId = ?
      GROUP BY t.id, t.tenantId, t.name, t.description, t.leaderId, u.name, u.email
      ORDER BY t.name ASC
    `;

    const params: any[] = [targetTenant];
    const [rows]: any = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) {
    console.error('Error fetching teams:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

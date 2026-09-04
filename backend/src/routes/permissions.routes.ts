import { Router } from 'express';
import { pool } from '../db';

export const permissionsRoutes = Router();

permissionsRoutes.get('/catalog', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  if (actorRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const [rows]: any = await pool.query(`
      SELECT p.id, p.code, p.name as displayName, p.name, p.description, p.module, p.category, p.isTenantAssignable, p.status 
      FROM permissions p
    `);
    res.json(rows);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

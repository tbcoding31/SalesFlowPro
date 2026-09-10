import { Router } from 'express';
import { pool } from '../db';
import { buildReportScopeWhere, validateTargetTenant } from '../utils/scope';

export const genericRoutes = Router();

genericRoutes.get('/activities', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { where, params } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'userId');

  try {
    const [rows]: any = await pool.query(`SELECT * FROM activities ${where.replace(/WHERE tenantId/g, 'WHERE tenantId')} ORDER BY occurredAt DESC`, params);
    res.json(rows);
  } catch (err: any) {
    console.error('GET /api/activities error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

genericRoutes.get('/customer_contacts', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const customerId = req.query.customerId;
  if (!customerId) return res.json([]);
  try {
    const [rows]: any = await pool.query(`
      SELECT cc.* 
      FROM customer_contacts cc
      JOIN customers c ON c.id = cc.customerId
      WHERE cc.customerId = ? AND c.tenantId = ?
      ORDER BY cc.isPrimary DESC, cc.createdAt ASC
    `, [customerId, targetTenant]);
    res.json(rows);
  } catch (err: any) {
    console.error('GET /api/customer_contacts error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

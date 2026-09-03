import { Router } from 'express';
import { pool } from '../db';
import { buildReportScopeWhere, validateTargetTenant } from '../utils/scope';

export const customersRoutes = Router();

customersRoutes.get('/', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { where, params } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'picId');

  try {
    const [rows]: any = await pool.query(`SELECT * FROM customers ${where.replace(/WHERE tenantId/g, 'WHERE tenantId')} ORDER BY createdAt DESC`, params);
    res.json(rows);
  } catch (err: any) {
    console.error('GET /api/customers error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

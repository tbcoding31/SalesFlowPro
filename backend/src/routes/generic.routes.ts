import { Router } from 'express';
import crypto from 'crypto';
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

genericRoutes.post('/customer_contacts', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const data = req.body || {};
  const customerId = data.customerId;
  if (!customerId) {
    return res.status(400).json({ error: 'customerId is required', code: 'VALIDATION_ERROR' });
  }

  try {
    const [custRows]: any = await pool.query('SELECT id FROM customers WHERE id = ? AND tenantId = ?', [customerId, targetTenant]);
    if (custRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found or access denied', code: 'CUSTOMER_NOT_FOUND' });
    }

    if (!data.name || !String(data.name).trim()) {
      return res.status(400).json({ error: 'Contact name is required', code: 'VALIDATION_ERROR' });
    }

    const contactId = 'CON-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    await pool.query(
      `INSERT INTO customer_contacts (id, tenantId, customerId, name, position, email, phone, isPrimary, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        contactId,
        targetTenant,
        customerId,
        String(data.name).trim(),
        data.position ? String(data.position).trim() : 'Contact',
        data.email ? String(data.email).trim() : null,
        data.phone ? String(data.phone).trim() : null,
        data.isPrimary ? 1 : 0
      ]
    );

    res.status(201).json({ success: true, id: contactId });
  } catch (err: any) {
    console.error('POST /api/customer_contacts error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

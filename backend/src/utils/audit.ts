
import { pool } from '../db';
import crypto from 'crypto';

export async function logAudit(
  tenantId: string | null,
  userId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  description: string,
  ipAddress: string | null = null,
  module: string = 'TENANT'
) {
  try {
    const id = 'AUD-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    await pool.query(
      `INSERT INTO audit_logs (id, tenantId, userId, action, module, entity, entityId, description, ipAddress)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, userId, action, module, entity, entityId, description, ipAddress]
    );
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

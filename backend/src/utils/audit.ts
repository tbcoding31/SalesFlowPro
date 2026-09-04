
import { pool } from '../db';
import crypto from 'crypto';

const normalizeIp = (ip: string | null) => { if (!ip) return ip; if (ip.startsWith('::ffff:')) return ip.substring(7); if (ip === '::1') return '127.0.0.1'; return ip; };

export async function logAudit(
  tenantId: string | null,
  userId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  description: string,
  ipAddress: string | null = null,
  userAgent: string | null = null,
  module: string = 'TENANT'
) {
  try {
    const id = 'AUD-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    await pool.query(
      `INSERT INTO audit_logs (id, tenantId, userId, action, module, entity, entityId, description, ipAddress, userAgent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, userId, action, module, entity, entityId, description, normalizeIp(ipAddress), userAgent]
    );
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

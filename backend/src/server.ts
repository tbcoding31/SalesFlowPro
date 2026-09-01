import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { env } from './env';
import { pool } from './db';


// --- Canonical Tenant Resolver ---
async function validateTargetTenant(req: any, res: any, pool: any, actorTenant: string | null): Promise<string | false> {
  const requestedTenant = req.query.tenantId || req.body?.tenantId || req.params?.tenantId || null;
  const targetTenant = actorTenant !== null ? actorTenant : (requestedTenant as string | null);
  
  if (!targetTenant) {
    res.status(400).json({ error: 'TARGET_TENANT_REQUIRED' });
    return false;
  }
  
  if (actorTenant === null) {
    const [tCheck]: any = await pool.query('SELECT id FROM tenants WHERE id = ?', [targetTenant]);
    if (tCheck.length === 0) {
      res.status(404).json({ error: 'TENANT_NOT_FOUND' });
      return false;
    }
  }
  
  return targetTenant as string;
}
// ---------------------------------

const app = express();

// Phase 5: Authorization Abstractions
export const can = (permissions: string[], action: string) => {
  if (permissions.includes('ALL')) return true;
  return permissions.includes(action);
};

export const getAssignableRoles = async (pool: any, actorRoleId: string, actorTenantId?: string | null, targetTenantId?: string | null) => {
  try {
    // 0. Super Admin has full privilege to assign any tenant role
    if (actorRoleId === 'SUPER_ADMIN') {
      const tenantToQuery = targetTenantId || actorTenantId;
      if (tenantToQuery ) {
        const [tenantRoleRows]: any = await pool.query(
          "SELECT id FROM roles WHERE tenantId = ? AND scope = 'TENANT'",
          [tenantToQuery]
        );
        return tenantRoleRows.map((r: any) => r.id);
      }
      const [allTenantRoles]: any = await pool.query("SELECT id FROM roles WHERE scope = 'TENANT'");
      return allTenantRoles.map((r: any) => r.id);
    }

    // 1. Direct match on role_assignment_policies
    const [rows]: any = await pool.query('SELECT assignableRoleId as roleId FROM role_assignment_policies WHERE assignerRoleId = ?', [actorRoleId]);
    let assignableIds = rows.map((r: any) => r.roleId);

    // 2. If actor is Tenant Admin (or has MANAGE_ROLES / MANAGE_USERS capability in tenant), they can assign all TENANT scoped roles in their tenant
    if (actorTenantId && (actorRoleId === 'TENANT_ADMIN' || actorRoleId.endsWith('-TENANT_ADMIN') || actorRoleId.startsWith('ROLE-'))) {
      const [tenantRoleRows]: any = await pool.query(
        "SELECT id FROM roles WHERE tenantId = ? AND scope = 'TENANT'",
        [actorTenantId]
      );
      const tenantRoleIds = tenantRoleRows.map((r: any) => r.id);
      assignableIds = Array.from(new Set([...assignableIds, ...tenantRoleIds]));
    }

    return assignableIds;
  } catch (e) {
    console.warn('[AUTH FALLBACK] role_assignment_policies query error:', e);
    return [];
  }
};

/**
 * Capability-based administrative continuity check.
 * Counts ACTIVE tenant users whose active assigned role contains all three:
 * MANAGE_TENANT, MANAGE_USERS, and MANAGE_ROLES.
 */
export const countActiveTenantAdmins = async (connectionOrPool: any, tenantId: string, excludeUserId?: string): Promise<number> => {
  const params: any[] = [tenantId];
  let query = `
    SELECT COUNT(DISTINCT tu.id) as adminCount
    FROM tenant_users tu
    JOIN users u ON u.id = tu.userId
    JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
    JOIN role_permissions rp1 ON rp1.roleId = tur.roleId AND rp1.permission = 'MANAGE_TENANT'
    JOIN role_permissions rp2 ON rp2.roleId = tur.roleId AND rp2.permission = 'MANAGE_USERS'
    JOIN role_permissions rp3 ON rp3.roleId = tur.roleId AND rp3.permission = 'MANAGE_ROLES'
    WHERE tu.tenantId = ?
      AND tu.status = 'ACTIVE'
      AND u.status = 'ACTIVE'
  `;

  if (excludeUserId) {
    query += ' AND tu.userId != ?';
    params.push(excludeUserId);
  }

  const [rows]: any = await connectionOrPool.query(query, params);
  return rows[0]?.adminCount || 0;
};

/**
 * Authoritative assignable tenant user validation.
 * Verifies that the requested user has an ACTIVE global identity
 * AND an ACTIVE tenant membership within the specified tenantId.
 */
export const validateAssignableTenantUser = async (connectionOrPool: any, tenantId: string, userId: string): Promise<{ valid: boolean, error?: string, code?: string }> => {
  if (!userId) return { valid: false, error: 'User ID is required.', code: 'MISSING_USER_ID' };

  const [rows]: any = await connectionOrPool.query(`
    SELECT u.id, u.status as userGlobalStatus, tu.status as tenantUserStatus, tu.tenantId
    FROM users u
    JOIN tenant_users tu ON tu.userId = u.id
    WHERE u.id = ? AND tu.tenantId = ?
  `, [userId, tenantId]);

  if (rows.length === 0) {
    return {
      valid: false,
      error
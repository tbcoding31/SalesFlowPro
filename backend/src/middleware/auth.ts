import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { resolveUserAccessContext } from '../auth-context';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const [sessions]: any = await pool.query('SELECT * FROM auth_sessions WHERE token = ?', [token]);
    if (sessions.length === 0) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session', code: 'SESSION_REVOKED' });
    }

    const session = sessions[0];
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return res.status(401).json({ error: 'Unauthorized: Session has expired', code: 'SESSION_REVOKED' });
    }

    const userContext = await resolveUserAccessContext(pool, session.userId);

    if (!userContext.exists) {
      return res.status(403).json({ error: 'Principal missing', code: 'USER_MISSING' });
    }

    if (userContext.userGlobalStatus !== 'ACTIVE') {
      return res.status(403).json({ error: 'User identity is suspended or inactive', code: 'USER_SUSPENDED' });
    }

    if (userContext.isOrphan) {
      return res.status(403).json({ error: 'Orphan principal denied', code: 'ORPHAN_DENIED' });
    }

    if (userContext.tenantId) {
      if (userContext.tenantUserStatus !== 'ACTIVE') {
        return res.status(403).json({ error: 'Tenant membership is suspended or inactive', code: 'MEMBERSHIP_SUSPENDED' });
      }

      const [tenantRows]: any = await pool.query('SELECT status FROM tenants WHERE id = ?', [userContext.tenantId]);
      if (tenantRows.length === 0 || tenantRows[0].status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Tenant is suspended or inactive', code: 'TENANT_SUSPENDED' });
      }
    } else if (!userContext.isPlatformUser) {
        return res.status(403).json({ error: 'Invalid platform principal', code: 'INVALID_PLATFORM_PRINCIPAL' });
    }

    (req as any).userId = session.userId;
    (req as any).tenantUserId = userContext.tenantUserId;
    (req as any).userRole = userContext.roleId;
    (req as any).userTenantId = userContext.tenantId;
    (req as any).userPermissions = userContext.permissions;
    (req as any).userDataScope = userContext.dataScope;
    (req as any).isPlatformUser = userContext.isPlatformUser;

    next();
  } catch (err: any) {
    console.error('Auth middleware error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

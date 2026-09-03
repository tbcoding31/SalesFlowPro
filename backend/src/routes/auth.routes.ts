import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../db';
import { resolveUserAccessContext } from '../auth-context';
import { env } from '../env';

export const authRoutes = Router();

authRoutes.post('/login', async (req: any, res: any) => {
  try {
    const { email, password } = req.body || {};
    
    if (!email || !email.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required', code: 'VALIDATION_ERROR' });
    }
    
    const [userRows]: any = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim()]);
    if (userRows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    const user = userRows[0];
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    const userContext = await resolveUserAccessContext(pool, user.id);

    if (!userContext.exists) {
      return res.status(403).json({ success: false, message: 'Principal missing', code: 'USER_MISSING' });
    }

    if (userContext.userGlobalStatus !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Account identity is globally suspended or inactive', code: 'USER_SUSPENDED' });
    }

    if (userContext.isOrphan) {
      return res.status(403).json({ success: false, message: 'Orphan principal denied', code: 'ORPHAN_DENIED' });
    }

    if (userContext.tenantId) {
      if (userContext.tenantUserStatus !== 'ACTIVE') {
        return res.status(403).json({ success: false, message: 'Your membership in this organization is suspended or inactive', code: 'MEMBERSHIP_SUSPENDED' });
      }

      const [tenantRows]: any = await pool.query('SELECT status FROM tenants WHERE id = ?', [userContext.tenantId]);
      if (tenantRows.length === 0 || tenantRows[0].status !== 'ACTIVE') {
        return res.status(403).json({ success: false, message: 'Account organization is suspended or inactive', code: 'TENANT_SUSPENDED' });
      }
    } else if (!userContext.isPlatformUser) {
        return res.status(403).json({ success: false, message: 'Invalid platform principal', code: 'INVALID_PLATFORM_PRINCIPAL' });
    }
    
    const token = crypto.randomBytes(32).toString('hex');
    const sessionId = 'SESS-' + Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    
    const ttlHours = (env as any).AUTH_SESSION_TTL_HOURS;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    
    await pool.query(
      'INSERT INTO auth_sessions (id, userId, token, ipAddress, userAgent, expiresAt) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, user.id, token, req.ip, req.headers['user-agent'] || '', expiresAt]
    );

    const userDto = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar,
      role: userContext.roleId,
      roleName: userContext.roleName,
      tenantId: userContext.tenantId,
      permissions: userContext.permissions,
      dataScope: userContext.dataScope
    };

    res.json({ success: true, user: userDto, token });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

authRoutes.get('/me', async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized: No token provided' });

    const token = authHeader.replace('Bearer ', '').trim();
    const [sessions]: any = await pool.query('SELECT * FROM auth_sessions WHERE token = ?', [token]);
    if (sessions.length === 0) return res.status(401).json({ error: 'Unauthorized: Invalid session', code: 'SESSION_REVOKED' });

    const session = sessions[0];
    if (!session.expiresAt || new Date(session.expiresAt) < new Date()) {
      return res.status(401).json({ error: 'Unauthorized: Session expired', code: 'SESSION_REVOKED' });
    }

    const [userRows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [session.userId]);
    if (userRows.length === 0) return res.status(401).json({ error: 'User not found' });
    const user = userRows[0];

    const userContext = await resolveUserAccessContext(pool, user.id);

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
        return res.status(403).json({ error: 'Membership suspended or inactive', code: 'MEMBERSHIP_SUSPENDED' });
      }
      const [tenantRows]: any = await pool.query('SELECT status FROM tenants WHERE id = ?', [userContext.tenantId]);
      if (tenantRows.length === 0 || tenantRows[0].status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Tenant suspended or inactive', code: 'TENANT_SUSPENDED' });
      }
    } else if (!userContext.isPlatformUser) {
        return res.status(403).json({ error: 'Invalid platform principal', code: 'INVALID_PLATFORM_PRINCIPAL' });
    }

    const userDto = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar,
      role: userContext.roleId,
      roleName: userContext.roleName,
      tenantId: userContext.tenantId,
      permissions: userContext.permissions,
      dataScope: userContext.dataScope
    };

    res.json({ success: true, user: userDto });
  } catch (err: any) {
    console.error('Session verify error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

authRoutes.post('/logout', async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '').trim();
      await pool.query('UPDATE auth_sessions SET expiresAt = NOW() WHERE token = ?', [token]);
      await pool.query('DELETE FROM auth_sessions WHERE expiresAt < DATE_SUB(NOW(), INTERVAL 7 DAY)');
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    console.error('Logout error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

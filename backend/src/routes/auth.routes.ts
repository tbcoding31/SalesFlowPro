import { evaluateTenantAccess, revokeTenantSessions } from '../utils/scope';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../db';
import { resolveUserAccessContext } from '../auth-context';
import { env } from '../env';
import { logAudit, normalizeIp } from '../utils/audit';
import { sendEmail } from '../services/email.service';

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
      await logAudit(null, user.id, 'LOGIN_FAILED', 'User', user.id, 'Invalid credentials provided', req.ip, req.get('User-Agent'), 'AUTH');
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

      
        const entitlement = await evaluateTenantAccess(pool, userContext.tenantId);
        if (!entitlement.allowed) {
          if (entitlement.reason === 'TRIAL_EXPIRED') {
            return res.status(403).json({ 
              success: false, 
              message: 'Trial subscription has expired.', 
              code: 'TRIAL_EXPIRED',
              tenant: { trialEndDate: entitlement.trialEndDate }
            });
          }
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
      await pool.query('UPDATE users SET lastLoginAt = NOW() WHERE id = ?', [user.id]);

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
      
        const entitlement = await evaluateTenantAccess(pool, userContext.tenantId);
        if (!entitlement.allowed) {
          if (entitlement.reason === 'TRIAL_EXPIRED') {
            await revokeTenantSessions(pool, userContext.tenantId);
            return res.status(403).json({ error: 'Tenant trial subscription has expired.', code: 'TRIAL_EXPIRED' });
          }
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

// Configurable rate limiter helper for forgot-password
interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

const forgotPasswordAttempts = new Map<string, number[]>();

export function getForgotPasswordRateLimitConfig(): { windowMs: number; maxRequests: number; windowMinutes: number } {
  const isProd = process.env.NODE_ENV === 'production';
  const defaultWindowMinutes = 15;
  const defaultMaxRequests = isProd ? 5 : 20;

  const envWindow = Number(process.env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES);
  const envMax = Number(process.env.PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS);

  const windowMinutes = (!isNaN(envWindow) && envWindow >= 1 && envWindow <= 1440) ? envWindow : defaultWindowMinutes;
  const maxRequests = (!isNaN(envMax) && envMax >= 1 && envMax <= 1000) ? envMax : defaultMaxRequests;

  return {
    windowMinutes,
    windowMs: windowMinutes * 60 * 1000,
    maxRequests
  };
}

export function checkForgotPasswordRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const { windowMs, maxRequests } = getForgotPasswordRateLimitConfig();
  const attempts = forgotPasswordAttempts.get(ip) || [];
  const recent = attempts.filter(ts => now - ts < windowMs);

  if (recent.length >= maxRequests) {
    const oldest = Math.min(...recent);
    const retryAfterMs = (oldest + windowMs) - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  recent.push(now);
  forgotPasswordAttempts.set(ip, recent);
  return { allowed: true };
}

export function resetForgotPasswordRateLimits(): void {
  forgotPasswordAttempts.clear();
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function getPasswordPolicy(): Promise<{ minLength: number; requireUppercase: boolean; requireNumbers: boolean; requireSpecialChars: boolean }> {
  const [rows]: any = await pool.query('SELECT settingKey, settingValue FROM system_settings WHERE category = "security"');
  const policy = {
    minLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  };
  for (const row of rows) {
    if (row.settingKey === 'requireUppercase') policy.requireUppercase = row.settingValue === 'true';
    if (row.settingKey === 'requireNumbers') policy.requireNumbers = row.settingValue === 'true';
    if (row.settingKey === 'requireSpecialChars') policy.requireSpecialChars = row.settingValue === 'true';
  }
  return policy;
}

// POST /forgot-password
authRoutes.post('/forgot-password', async (req: any, res: any) => {
  try {
    const rawClientIp = req.ip || (req.socket && req.socket.remoteAddress) || '127.0.0.1';
    const clientIp = normalizeIp(rawClientIp) || '127.0.0.1';
    const rateLimitCheck = checkForgotPasswordRateLimit(clientIp);
    if (!rateLimitCheck.allowed) {
      const retryAfter = rateLimitCheck.retryAfterSeconds || 60;
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        code: 'PASSWORD_RESET_RATE_LIMITED',
        message: 'Too many password reset requests. Please try again later.',
        retryAfterSeconds: retryAfter
      });
    }

    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.',
        code: 'INVALID_EMAIL'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail) || normalizedEmail.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address format.',
        code: 'INVALID_EMAIL'
      });
    }

    const publicResponse = {
      success: true,
      message: 'If an account exists for this email, password reset instructions have been sent.'
    };

    // Lookup user in database
    const [userRows]: any = await pool.query('SELECT * FROM users WHERE LOWER(email) = ?', [normalizedEmail]);
    if (userRows.length === 0) {
      // Return identical public response to prevent enumeration
      return res.json(publicResponse);
    }

    const user = userRows[0];

    // Revoke previous active/unused reset tokens for this user
    await pool.query(
      'UPDATE password_reset_tokens SET revokedAt = NOW() WHERE userId = ? AND usedAt IS NULL AND revokedAt IS NULL',
      [user.id]
    );

    // Read expiry setting from system_settings
    const [settingsRows]: any = await pool.query(
      "SELECT settingValue FROM system_settings WHERE settingKey = 'passwordResetTokenExpiryMinutes'"
    );
    let expiryMinutes = 30;
    if (settingsRows.length > 0) {
      const parsed = Number(settingsRows[0].settingValue);
      if (!isNaN(parsed) && parsed >= 5 && parsed <= 1440) {
        expiryMinutes = parsed;
      }
    }

    // Generate cryptographically secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Find tenantId if any
    const [tenantRows]: any = await pool.query('SELECT tenantId FROM tenant_users WHERE userId = ? LIMIT 1', [user.id]);
    const tenantId = tenantRows.length ? tenantRows[0].tenantId : null;

    const tokenId = 'PRT-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    await pool.query(
      `INSERT INTO password_reset_tokens 
       (id, userId, tenantId, tokenHash, expiresAt, requestedIp, requestedUserAgent) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tokenId, user.id, tenantId, tokenHash, expiresAt, clientIp, req.get('User-Agent') || '']
    );

    // Log token creation audit event
    await logAudit(
      tenantId,
      user.id,
      'PASSWORD_RESET_REQUESTED',
      'User',
      user.id,
      'Password reset requested',
      clientIp,
      req.get('User-Agent'),
      'AUTH'
    );

    // Build reset URL from config
    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3100';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    // Send real email via email.service
    try {
      const emailResult = await sendEmail({
        to: user.email,
        subject: 'Password Reset Request - SalesFlow Pro',
        text: `Hello ${user.name || 'there'},\n\nYou requested to reset your password for your SalesFlow Pro account.\nPlease click the link below to set a new password:\n\n${resetUrl}\n\nThis link will expire in ${expiryMinutes} minutes.\n\nIf you did not request this, please ignore this email.\n\nSalesFlow Pro Team`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 28px;">
              <h1 style="color: #4744e5; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">SalesFlow Pro</h1>
              <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Enterprise CRM Password Recovery</p>
            </div>
            <div style="padding: 24px 0; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;">
              <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 12px;">Reset Your Password</h2>
              <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">Hello <strong>${escapeHtml(user.name || 'there')}</strong>,</p>
              <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                We received a request to reset the password for your SalesFlow Pro account. Click the button below to proceed:
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" style="background-color: #4744e5; color: #ffffff; padding: 12px 32px; text-decoration: none; font-weight: 700; font-size: 14px; border-radius: 8px; display: inline-block;">Set New Password</a>
              </div>
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 8px 0;">
                This link is valid for <strong>${expiryMinutes} minutes</strong> and can only be used once.
              </p>
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">
                If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </div>
            <div style="text-align: center; margin-top: 24px; color: #94a3b8; font-size: 11px;">
              <p style="margin: 0;">© SalesFlow Pro Enterprise CRM. All rights reserved.</p>
            </div>
          </div>
        `
      });

      await logAudit(
        tenantId,
        user.id,
        'PASSWORD_RESET_EMAIL_SENT',
        'User',
        user.id,
        `Password reset email sent via SMTP (id: ${emailResult.messageId || 'unknown'}, provider: ${emailResult.response || '250 OK'})`,
        clientIp,
        req.get('User-Agent'),
        'AUTH'
      );
    } catch (emailErr: any) {
      console.error('[Forgot Password] Email delivery failed:', emailErr.message);
      // Revoke token if email delivery failed
      await pool.query('UPDATE password_reset_tokens SET revokedAt = NOW() WHERE id = ?', [tokenId]);
      await logAudit(
        tenantId,
        user.id,
        'PASSWORD_RESET_EMAIL_DELIVERY_FAILED',
        'User',
        user.id,
        `Password reset email delivery failed: ${emailErr.code || 'SMTP_ERROR'}`,
        clientIp,
        req.get('User-Agent'),
        'AUTH'
      );
    }

    return res.json(publicResponse);
  } catch (err: any) {
    console.error('[Forgot Password Error]:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /password-reset/validate
authRoutes.get('/password-reset/validate', async (req: any, res: any) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');

  try {
    const token = req.query.token;
    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({
        valid: false,
        code: 'RESET_TOKEN_INVALID',
        message: 'This password reset link is invalid or has expired.'
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const [rows]: any = await pool.query(
      'SELECT id, userId, expiresAt, usedAt, revokedAt FROM password_reset_tokens WHERE tokenHash = ?',
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        valid: false,
        code: 'RESET_TOKEN_INVALID',
        message: 'This password reset link is invalid or has expired.'
      });
    }

    const record = rows[0];

    if (record.usedAt) {
      return res.status(400).json({
        valid: false,
        code: 'RESET_TOKEN_USED',
        message: 'This password reset link has already been used.'
      });
    }

    if (record.revokedAt) {
      return res.status(400).json({
        valid: false,
        code: 'RESET_TOKEN_REVOKED',
        message: 'This password reset link has been revoked.'
      });
    }

    if (new Date(record.expiresAt) <= new Date()) {
      return res.status(400).json({
        valid: false,
        code: 'RESET_TOKEN_EXPIRED',
        message: 'This password reset link has expired.'
      });
    }

    // Verify user exists
    const [userRows]: any = await pool.query('SELECT id, email, status FROM users WHERE id = ?', [record.userId]);
    if (userRows.length === 0) {
      return res.status(400).json({
        valid: false,
        code: 'RESET_TOKEN_INVALID',
        message: 'This password reset link is invalid or has expired.'
      });
    }

    const passwordPolicy = await getPasswordPolicy();

    res.json({
      valid: true,
      passwordPolicy
    });
  } catch (err: any) {
    console.error('[Validate Reset Token Error]:', err);
    res.status(500).json({ valid: false, error: 'Internal server error' });
  }
});

// POST /reset-password
authRoutes.post('/reset-password', async (req: any, res: any) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');

  const clientIp = normalizeIp(req.ip) || '127.0.0.1';
  const { token, newPassword, confirmPassword } = req.body || {};

  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({
      success: false,
      code: 'RESET_TOKEN_INVALID',
      message: 'Password reset token is required.'
    });
  }

  if (!newPassword || typeof newPassword !== 'string') {
    return res.status(400).json({
      success: false,
      code: 'PASSWORD_REQUIRED',
      message: 'New password is required.'
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      code: 'PASSWORDS_DO_NOT_MATCH',
      message: 'Passwords do not match.'
    });
  }

  // Load password policy from system_settings
  const policy = await getPasswordPolicy();

  if (newPassword.length < policy.minLength) {
    return res.status(400).json({
      success: false,
      code: 'PASSWORD_TOO_SHORT',
      message: `Password must be at least ${policy.minLength} characters.`
    });
  }

  if (policy.requireUppercase && !/[A-Z]/.test(newPassword)) {
    return res.status(400).json({
      success: false,
      code: 'PASSWORD_MISSING_UPPERCASE',
      message: 'Password must contain at least one uppercase letter.'
    });
  }

  if (policy.requireNumbers && !/[0-9]/.test(newPassword)) {
    return res.status(400).json({
      success: false,
      code: 'PASSWORD_MISSING_NUMBER',
      message: 'Password must contain at least one number.'
    });
  }

  if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
    return res.status(400).json({
      success: false,
      code: 'PASSWORD_MISSING_SPECIAL',
      message: 'Password must contain at least one special character.'
    });
  }

  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

  // Begin transaction
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const [tokenRows]: any = await connection.query(
      'SELECT id, userId, tenantId, expiresAt, usedAt, revokedAt FROM password_reset_tokens WHERE tokenHash = ? FOR UPDATE',
      [tokenHash]
    );

    if (tokenRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        code: 'RESET_TOKEN_INVALID',
        message: 'This password reset link is invalid or has expired.'
      });
    }

    const tokenRecord = tokenRows[0];

    if (tokenRecord.usedAt) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        code: 'RESET_TOKEN_USED',
        message: 'This password reset link has already been used.'
      });
    }

    if (tokenRecord.revokedAt) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        code: 'RESET_TOKEN_REVOKED',
        message: 'This password reset link has been revoked.'
      });
    }

    if (new Date(tokenRecord.expiresAt) <= new Date()) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        code: 'RESET_TOKEN_EXPIRED',
        message: 'This password reset link has expired.'
      });
    }

    const userId = tokenRecord.userId;

    // 1. Hash new password with bcrypt
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 2. Update user's password
    await connection.query('UPDATE users SET passwordHash = ? WHERE id = ?', [passwordHash, userId]);

    // 3. Mark current reset token as used
    await connection.query('UPDATE password_reset_tokens SET usedAt = NOW() WHERE id = ?', [tokenRecord.id]);

    // 4. Revoke all remaining unused reset tokens for this user
    await connection.query(
      'UPDATE password_reset_tokens SET revokedAt = NOW() WHERE userId = ? AND id != ? AND revokedAt IS NULL AND usedAt IS NULL',
      [userId, tokenRecord.id]
    );

    // 5. Revoke ALL active sessions for this user
    await connection.query('DELETE FROM auth_sessions WHERE userId = ?', [userId]);

    // Commit transaction
    await connection.commit();
    connection.release();

    // Audit log
    await logAudit(
      tokenRecord.tenantId,
      userId,
      'PASSWORD_RESET_SUCCEEDED',
      'User',
      userId,
      'Password successfully reset and all sessions revoked',
      clientIp,
      req.get('User-Agent'),
      'AUTH'
    );

    res.json({
      success: true,
      message: 'Your password has been changed successfully.'
    });
  } catch (err: any) {
    await connection.rollback();
    connection.release();
    console.error('[Reset Password Transaction Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to reset password. Please try again later.' });
  }
});


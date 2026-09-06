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

// Rate limiter helper for forgot-password: max 5 requests per 15 minutes per IP
const forgotPasswordAttempts = new Map<string, number[]>();

function checkForgotPasswordRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const attempts = forgotPasswordAttempts.get(ip) || [];
  const recent = attempts.filter(ts => now - ts < windowMs);
  if (recent.length >= 5) {
    return false;
  }
  recent.push(now);
  forgotPasswordAttempts.set(ip, recent);
  return true;
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
    const rawClientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const clientIp = normalizeIp(rawClientIp) || '127.0.0.1';
    if (!checkForgotPasswordRateLimit(clientIp)) {
      return res.status(429).json({
        success: false,
        message: 'Too many password reset requests. Please try again later.',
        code: 'RATE_LIMITED'
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

    // Build reset URL from config with production safety enforcement
    const isProd = process.env.NODE_ENV === 'production';
    const rawFrontendUrl = (process.env.FRONTEND_URL || process.env.APP_URL || '').trim();
    if (isProd) {
      if (!rawFrontendUrl || rawFrontendUrl.includes('localhost') || rawFrontendUrl.includes('127.0.0.1') || !rawFrontendUrl.startsWith('https://')) {
        console.error('[Forgot Password] Production safety violation: Unsafe or missing FRONTEND_URL in production:', rawFrontendUrl);
        await pool.query('UPDATE password_reset_tokens SET revokedAt = NOW() WHERE id = ?', [tokenId]);
        await logAudit(
          tenantId,
          user.id,
          'PASSWORD_RESET_CONFIG_ERROR',
          'User',
          user.id,
          'Password reset aborted: FRONTEND_URL must be an HTTPS URL in production',
          clientIp,
          req.get('User-Agent'),
          'AUTH'
        );
        return res.json(publicResponse);
      }
    }
    const frontendUrl = rawFrontendUrl || 'http://localhost:3100';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    // Send real email via email.service
    try {
      const emailResult = await sendEmail({
        to: user.email,
        subject: 'Reset your SalesFlow Pro password',
        text: `Hello ${user.name || 'there'},\n\nWe received a request to reset the password for your SalesFlow Pro account.\n\nTo reset your password, please click the link below or copy and paste it into your browser:\n${resetUrl}\n\nThis link will expire in ${expiryMinutes} minutes and can only be used once.\n\nIf you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.\n\nSecurity Notice: SalesFlow Pro will never ask for your password or credentials via email.\n\n— SalesFlow Pro Team`,
        html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your SalesFlow Pro password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; text-align: left;">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #f1f5f9;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #4338ca; letter-spacing: -0.3px;">SalesFlow Pro</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #0f172a;">Reset your password</h2>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">Hello <strong>${escapeHtml(user.name || 'there')}</strong>,</p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                We received a request to reset the password for your SalesFlow Pro account. You can reset your password by clicking the button below:
              </p>
              <!-- CTA Button -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="border-radius: 6px; background-color: #4338ca;">
                    <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; display: inline-block;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                This link will expire in <strong>${expiryMinutes} minutes</strong> and can only be used once.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
              <!-- Fallback URL -->
              <div style="padding-top: 16px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">If the button above does not work, copy and paste this URL into your web browser:</p>
                <p style="margin: 0; font-size: 12px; word-break: break-all;"><a href="${resetUrl}" style="color: #4338ca; text-decoration: underline;">${resetUrl}</a></p>
              </div>
              <div style="margin-top: 24px; padding: 12px; background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 12px; line-height: 1.4; color: #64748b;"><strong>Security Notice:</strong> SalesFlow Pro will never ask you to disclose your password via email.</p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; SalesFlow Pro. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
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


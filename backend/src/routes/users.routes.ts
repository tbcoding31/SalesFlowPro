import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { validateTargetTenant } from '../utils/scope';
import { resolveUserAccessContext } from '../auth-context';
import { logAudit } from '../utils/audit';

export const usersRoutes = Router();

// Storage directory for uploaded user avatars
const AVATAR_STORAGE_DIR = path.resolve(__dirname, '../../storage/avatars');
if (!fs.existsSync(AVATAR_STORAGE_DIR)) {
  fs.mkdirSync(AVATAR_STORAGE_DIR, { recursive: true });
}

// Magic bytes validation for avatar image uploads
const isValidImageMagicBytes = (buffer: Buffer, mimeType: string): boolean => {
  if (!buffer || buffer.length < 12) return false;
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (mimeType === 'image/webp') {
    const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    return isRiff && isWebp;
  }
  return false;
};

// Multer memory storage configuration (Max 2MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 // 2 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_MIME_TYPE'));
    }
  }
});

const handleAvatarUpload = (req: any, res: any, next: any) => {
  upload.single('avatar')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds 2 MB limit', code: 'FILE_TOO_LARGE' });
      }
      if (err.message === 'INVALID_MIME_TYPE') {
        return res.status(400).json({ error: 'Only JPEG, PNG, and WebP images are allowed', code: 'INVALID_MIME_TYPE' });
      }
      return res.status(400).json({ error: err.message || 'File upload error', code: 'UPLOAD_ERROR' });
    }
    next();
  });
};

// -------------------------------------------------------------------------
// 1. GET /api/users/me/profile - Get current authenticated user profile
// -------------------------------------------------------------------------
usersRoutes.get('/me/profile', async (req: any, res: any) => {
  const actorUserId = (req as any).userId;
  if (!actorUserId) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  try {
    const [userRows]: any = await pool.query(
      `SELECT id, email, name, phone, location, timezone, avatar, status, lastLoginAt, passwordChangedAt, createdAt 
       FROM users 
       WHERE id = ?`,
      [actorUserId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const user = userRows[0];
    const userContext = await resolveUserAccessContext(pool, actorUserId);

    // Department and Position
    let department = 'Sales';
    let position = userContext.roleName || 'Specialist';

    const profile = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone || '',
      location: user.location || 'Jakarta, Indonesia',
      timezone: user.timezone || 'GMT+7 (WIB)',
      avatar: user.avatar || null,
      avatarUrl: user.avatar || null,
      status: user.status,
      role: userContext.roleCode || userContext.roleId,
      roleName: userContext.roleName || userContext.roleCode || 'User',
      tenantId: userContext.tenantId,
      department,
      position,
      lastLoginAt: user.lastLoginAt,
      passwordChangedAt: user.passwordChangedAt,
      createdAt: user.createdAt
    };

    res.json({ success: true, profile });
  } catch (err: any) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// -------------------------------------------------------------------------
// 2. PUT /api/users/me/profile - Update current authenticated user profile
// -------------------------------------------------------------------------
usersRoutes.put('/me/profile', async (req: any, res: any) => {
  const actorUserId = (req as any).userId;
  const actorTenant = (req as any).userTenantId;
  if (!actorUserId) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  try {
    const { name, firstName, lastName, phone, location, timezone, email } = req.body || {};

    let resolvedName = name;
    if (!resolvedName && (firstName || lastName)) {
      resolvedName = `${firstName || ''} ${lastName || ''}`.trim();
    }

    if (!resolvedName || !resolvedName.trim()) {
      return res.status(400).json({ error: 'Name is required', code: 'NAME_REQUIRED' });
    }

    // Verify user exists
    const [existingUserRows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [actorUserId]);
    if (existingUserRows.length === 0) {
      return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    }
    const existingUser = existingUserRows[0];

    // If email is being updated, validate uniqueness
    let targetEmail = existingUser.email;
    if (email && typeof email === 'string' && email.trim() && email.trim().toLowerCase() !== existingUser.email.toLowerCase()) {
      const normalizedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ error: 'Invalid email address format', code: 'INVALID_EMAIL' });
      }

      const [dupRows]: any = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = ? AND id != ?',
        [normalizedEmail, actorUserId]
      );
      if (dupRows.length > 0) {
        return res.status(409).json({ error: 'Email is already in use by another account', code: 'EMAIL_ALREADY_EXISTS' });
      }
      targetEmail = normalizedEmail;
    }

    const cleanPhone = phone !== undefined ? String(phone).trim() : existingUser.phone;
    const cleanLocation = location !== undefined ? String(location).trim() : (existingUser.location || 'Jakarta, Indonesia');
    const cleanTimezone = timezone !== undefined ? String(timezone).trim() : (existingUser.timezone || 'GMT+7 (WIB)');

    await pool.query(
      `UPDATE users 
       SET name = ?, email = ?, phone = ?, location = ?, timezone = ?
       WHERE id = ?`,
      [resolvedName.trim(), targetEmail, cleanPhone, cleanLocation, cleanTimezone, actorUserId]
    );

    await logAudit(
      actorTenant || null,
      actorUserId,
      'USER_PROFILE_UPDATED',
      'User',
      actorUserId,
      'User updated profile information',
      req.ip,
      req.get('User-Agent'),
      'USER'
    );

    // Return updated profile
    const userContext = await resolveUserAccessContext(pool, actorUserId);
    const updatedProfile = {
      id: actorUserId,
      email: targetEmail,
      name: resolvedName.trim(),
      phone: cleanPhone,
      location: cleanLocation,
      timezone: cleanTimezone,
      avatar: existingUser.avatar || null,
      avatarUrl: existingUser.avatar || null,
      status: existingUser.status,
      role: userContext.roleCode || userContext.roleId,
      roleName: userContext.roleName || userContext.roleCode || 'User',
      tenantId: userContext.tenantId,
      lastLoginAt: existingUser.lastLoginAt,
      passwordChangedAt: existingUser.passwordChangedAt,
      createdAt: existingUser.createdAt
    };

    res.json({ success: true, message: 'Profile updated successfully', profile: updatedProfile });
  } catch (err: any) {
    console.error('Error updating user profile:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// -------------------------------------------------------------------------
// 3. POST /api/users/me/avatar - Upload profile avatar picture
// -------------------------------------------------------------------------
usersRoutes.post('/me/avatar', handleAvatarUpload, async (req: any, res: any) => {
  const actorUserId = (req as any).userId;
  const actorTenant = (req as any).userTenantId;
  if (!actorUserId) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No avatar image file provided', code: 'FILE_REQUIRED' });
  }

  // Validate magic bytes for JPEG, PNG, and WebP
  if (!isValidImageMagicBytes(req.file.buffer, req.file.mimetype)) {
    return res.status(400).json({
      error: 'Invalid or corrupted image file. Please upload a genuine JPEG, PNG, or WebP image.',
      code: 'INVALID_IMAGE_FILE'
    });
  }

  try {
    let ext = 'jpg';
    if (req.file.mimetype === 'image/png') ext = 'png';
    else if (req.file.mimetype === 'image/webp') ext = 'webp';

    const safeFilename = `AVT-${crypto.randomBytes(16).toString('hex')}.${ext}`;
    const destinationPath = path.resolve(AVATAR_STORAGE_DIR, safeFilename);

    // Path traversal verification
    if (!destinationPath.startsWith(AVATAR_STORAGE_DIR)) {
      return res.status(400).json({ error: 'Invalid file destination path', code: 'SECURITY_VIOLATION' });
    }

    // Retrieve current avatar for reference check after DB update
    const [userRows]: any = await pool.query('SELECT avatar FROM users WHERE id = ?', [actorUserId]);
    const oldAvatar = userRows.length > 0 ? userRows[0].avatar : null;

    // Write new avatar file to local storage first
    fs.writeFileSync(destinationPath, req.file.buffer);

    // Generate canonical URL
    const avatarUrl = `/api/users/avatar/${safeFilename}`;

    // Update users table
    await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, actorUserId]);

    // Safely cleanup old avatar only if database update succeeded AND no other user references it
    if (oldAvatar && typeof oldAvatar === 'string' && oldAvatar.startsWith('/api/users/avatar/')) {
      try {
        const [otherUsers]: any = await pool.query(
          'SELECT id FROM users WHERE avatar = ? AND id != ? LIMIT 1',
          [oldAvatar, actorUserId]
        );
        if (otherUsers.length === 0) {
          const oldFilename = path.basename(oldAvatar);
          const oldResolved = path.resolve(AVATAR_STORAGE_DIR, oldFilename);
          if (oldResolved.startsWith(AVATAR_STORAGE_DIR) && fs.existsSync(oldResolved)) {
            fs.unlinkSync(oldResolved);
          }
        }
      } catch (cleanErr) {
        console.warn('[Avatar Cleanup] Non-fatal cleanup warning:', cleanErr);
      }
    }

    await logAudit(
      actorTenant || null,
      actorUserId,
      'USER_AVATAR_UPDATED',
      'User',
      actorUserId,
      'Profile avatar picture updated',
      req.ip,
      req.get('User-Agent'),
      'USER'
    );

    res.json({
      success: true,
      message: 'Avatar updated successfully',
      avatarUrl,
      filename: safeFilename
    });
  } catch (err: any) {
    console.error('Error uploading avatar:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// -------------------------------------------------------------------------
// 4. GET /api/users/avatar/:filename - Securely stream avatar images
// -------------------------------------------------------------------------
usersRoutes.get('/avatar/:filename', async (req: any, res: any) => {
  const { filename } = req.params;

  // Strict filename validation to prevent path traversal
  if (!filename || !/^[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp)$/i.test(filename)) {
    return res.status(400).json({ error: 'Invalid avatar filename', code: 'INVALID_FILENAME' });
  }

  const resolvedPath = path.resolve(AVATAR_STORAGE_DIR, filename);

  // Path traversal check
  if (!resolvedPath.startsWith(AVATAR_STORAGE_DIR)) {
    return res.status(403).json({ error: 'Access denied: Directory traversal detected', code: 'SECURITY_VIOLATION' });
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: 'Avatar file not found', code: 'FILE_NOT_FOUND' });
  }

  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  // Cross-tenant avatar isolation check
  const targetAvatarUrl = `/api/users/avatar/${filename}`;
  const [ownerRows]: any = await pool.query(
    `SELECT u.id as userId, tu.tenantId 
     FROM users u 
     LEFT JOIN tenant_users tu ON tu.userId = u.id AND tu.isPrimary = 1
     WHERE u.avatar = ?`,
    [targetAvatarUrl]
  );

  if (ownerRows.length > 0) {
    const ownerTenantId = ownerRows[0].tenantId;
    if (ownerTenantId && actorTenant && ownerTenantId !== actorTenant && actorRole !== 'SUPER_ADMIN' && !isPlatformUser) {
      return res.status(403).json({
        error: 'Access denied: Cannot access avatar from another tenant',
        code: 'CROSS_TENANT_ACCESS_DENIED'
      });
    }
  }

  const ext = path.extname(filename).toLowerCase();
  let contentType = 'image/jpeg';
  if (ext === '.png') contentType = 'image/png';
  else if (ext === '.webp') contentType = 'image/webp';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(resolvedPath);
});

// -------------------------------------------------------------------------
// 5. PUT /api/users/me/change-password - Change current user password
// -------------------------------------------------------------------------
usersRoutes.put('/me/change-password', async (req: any, res: any) => {
  const actorUserId = (req as any).userId;
  const actorTenant = (req as any).userTenantId;
  if (!actorUserId) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  const { currentPassword, newPassword, confirmPassword } = req.body || {};

  if (!currentPassword || typeof currentPassword !== 'string') {
    return res.status(400).json({ error: 'Current password is required', code: 'CURRENT_PASSWORD_REQUIRED' });
  }

  if (!newPassword || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'New password is required', code: 'NEW_PASSWORD_REQUIRED' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'New password and confirmation do not match', code: 'PASSWORDS_DO_NOT_MATCH' });
  }

  // Load password complexity requirements
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long', code: 'PASSWORD_TOO_SHORT' });
  }
  if (!/[A-Z]/.test(newPassword)) {
    return res.status(400).json({ error: 'Password must contain at least one uppercase letter', code: 'PASSWORD_MISSING_UPPERCASE' });
  }
  if (!/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'Password must contain at least one number', code: 'PASSWORD_MISSING_NUMBER' });
  }
  if (!/[!@#$%^&*(),.?":{}|<>\-_+=[\]\\/]/.test(newPassword)) {
    return res.status(400).json({ error: 'Password must contain at least one special character', code: 'PASSWORD_MISSING_SPECIAL' });
  }

  try {
    const [userRows]: any = await pool.query('SELECT id, passwordHash FROM users WHERE id = ?', [actorUserId]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const user = userRows[0];

    // Verify current password
    const isCurrentMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentMatch) {
      return res.status(400).json({ error: 'Current password is incorrect', code: 'INVALID_CURRENT_PASSWORD' });
    }

    // Verify new password is not identical to current password
    const isSameAsOld = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSameAsOld) {
      return res.status(400).json({ error: 'New password cannot be the same as your current password', code: 'PASSWORD_SAME_AS_OLD' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update passwordHash and passwordChangedAt timestamp
    await pool.query(
      'UPDATE users SET passwordHash = ?, passwordChangedAt = NOW() WHERE id = ?',
      [newPasswordHash, actorUserId]
    );

    // Audit log
    await logAudit(
      actorTenant || null,
      actorUserId,
      'PASSWORD_CHANGED',
      'User',
      actorUserId,
      'User successfully changed password',
      req.ip,
      req.get('User-Agent'),
      'AUTH'
    );

    res.json({
      success: true,
      message: 'Password changed successfully',
      passwordChangedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// -------------------------------------------------------------------------
// 6. GET /api/users - List users in target tenant
// -------------------------------------------------------------------------
usersRoutes.get('/', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  try {
    const { assignable } = req.query;

    let query = `
      SELECT 
        u.id, 
        u.email, 
        u.name, 
        u.phone,
        u.location,
        u.timezone,
        u.avatar as avatarUrl,
        u.avatar, 
        u.createdAt, 
        u.lastLoginAt,
        u.passwordChangedAt,
        u.status AS identityStatus,
        COALESCE(tu.status, u.status, 'ACTIVE') AS status,
        COALESCE(tu.status, u.status, 'ACTIVE') AS membershipStatus,
        tu.id AS tenantUserId, 
        tu.tenantId, 
        (
          SELECT COUNT(tasks.id) 
          FROM tasks 
          WHERE tasks.tenantId = tu.tenantId 
          AND tasks.picId = u.id 
        ) AS taskCount,
        (
          SELECT COUNT(tasks.id) 
          FROM tasks 
          LEFT JOIN task_statuses ts ON ts.id = tasks.statusId AND ts.tenantId = tasks.tenantId
          WHERE tasks.tenantId = tu.tenantId 
          AND tasks.picId = u.id 
          AND COALESCE(ts.isTerminal, 0) = 0
          AND (ts.code NOT IN ('COMPLETED', 'CANCELLED', 'TSK_COMPLETED', 'TSK_CANCELLED') OR ts.code IS NULL)
        ) AS activeTasksCount, 
        tu.isPrimary,
        r.id AS role, 
        r.name AS roleName,
        rds.scope AS dataScope,
        t.id AS teamId, 
        t.name AS teamName, 
        tm.role AS teamRole
      FROM tenant_users tu
      JOIN users u ON u.id = tu.userId
      LEFT JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
      LEFT JOIN roles r ON r.id = tur.roleId
      LEFT JOIN role_data_scopes rds ON rds.roleId = r.id
      LEFT JOIN team_members tm ON tm.tenantUserId = tu.id
      LEFT JOIN teams t ON t.id = tm.teamId
      WHERE tu.tenantId = ?
    `;

    const params: any[] = [targetTenant];

    if (assignable === 'true' || assignable === '1') {
      query += ` AND u.status = 'ACTIVE' AND tu.status = 'ACTIVE'`;
    }

    query += ' ORDER BY u.name ASC';

    const [rows]: any = await pool.query(query, params);

    res.json(rows);
  } catch (err: any) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

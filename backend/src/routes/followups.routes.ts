import { Router } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { pool } from '../db';
import { buildReportScopeWhere, validateTargetTenant } from '../utils/scope';
import { logAudit } from '../utils/audit';

export const followupsRoutes = Router();

// Storage directory configuration
const STORAGE_ROOT = path.resolve(__dirname, '../../storage');

const ensureStorageDir = (tenantId: string, followUpId: string): string => {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFollowUp = followUpId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dirPath = path.join(STORAGE_ROOT, 'tenants', safeTenant, 'follow-ups', safeFollowUp);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
};

// Magic bytes validation for image security
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

// Multer memory storage configuration (5MB max)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
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

// Permission checker helper
const checkPermission = (req: any, permissionCode: string): boolean => {
  const actorRole = (req as any).userRoleCode || (req as any).userRole;
  const isPlatformUser = (req as any).isPlatformUser;
  if (actorRole === 'SUPER_ADMIN' || isPlatformUser) return true;
  if (actorRole === 'TENANT_ADMIN') return true;
  const perms = (req as any).userPermissions || [];
  return perms.includes(permissionCode) || perms.includes('ALL') || perms.includes('MANAGE_TENANT');
};

import { normalizeSemanticRole, canAccessAllScope } from './navigation.routes';
export { normalizeSemanticRole, canAccessAllScope };

// -------------------------------------------------------------------------
// 1. GET /api/follow-ups - List follow-ups with filters & pagination
// -------------------------------------------------------------------------
async function handleFollowUpsList(req: any, res: any, forcedScope?: string) {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  if (!checkPermission(req, 'FOLLOW_UP_VIEW')) {
    return res.status(403).json({ error: 'Access denied. Missing FOLLOW_UP_VIEW permission.', code: 'FORBIDDEN' });
  }

  const semanticRole = normalizeSemanticRole(actorRole, isPlatformUser);
  const requestedScope = (forcedScope || req.query.scope || 'my').toLowerCase().trim();

  // Validate Scope Authorization
  let effectiveScope: 'all' | 'my' | 'team' = 'my';
  if (requestedScope === 'all' || requestedScope === 'team') {
    if (semanticRole !== 'TENANT_ADMIN' && semanticRole !== 'SUPERVISOR' && semanticRole !== 'SUPER_ADMIN') {
      return res.status(403).json({
        error: 'Access denied: All Follow-ups scope is restricted to Tenant Admin and Supervisor',
        code: 'SCOPE_ACCESS_DENIED'
      });
    }
    effectiveScope = requestedScope as any;
  } else {
    effectiveScope = 'my';
  }

  // Build Scope WHERE predicate
  let where: string;
  let params: any[];

  if (effectiveScope === 'all' || effectiveScope === 'team') {
    if (effectiveScope === 'all' && (semanticRole === 'SUPER_ADMIN' || semanticRole === 'TENANT_ADMIN' || actorDataScope === 'ORGANIZATION' || actorPermissions.includes('ALL') || actorPermissions.includes('MANAGE_TENANT'))) {
      where = 'WHERE f.tenantId = ?';
      params = [targetTenant];
    } else {
      // Supervisor TEAM Scope
      where = `WHERE f.tenantId = ? AND (
        f.picId IN (
          SELECT tu.userId FROM tenant_users tu
          JOIN team_members tm ON tm.tenantUserId = tu.id
          WHERE tm.teamId IN (
            SELECT tm2.teamId FROM team_members tm2
            JOIN tenant_users tu2 ON tu2.id = tm2.tenantUserId
            WHERE tu2.userId = ? AND tu2.tenantId = ? AND tu2.status = 'ACTIVE'
          ) AND tu.tenantId = ? AND tu.status = 'ACTIVE'
        )
        OR f.createdById IN (
          SELECT tu.userId FROM tenant_users tu
          JOIN team_members tm ON tm.tenantUserId = tu.id
          WHERE tm.teamId IN (
            SELECT tm2.teamId FROM team_members tm2
            JOIN tenant_users tu2 ON tu2.id = tm2.tenantUserId
            WHERE tu2.userId = ? AND tu2.tenantId = ? AND tu2.status = 'ACTIVE'
          ) AND tu.tenantId = ? AND tu.status = 'ACTIVE'
        )
      )`;
      params = [targetTenant, actorUserId, targetTenant, targetTenant, actorUserId, targetTenant, targetTenant];
    }
  } else {
    // MY Follow-ups: PIC is actor OR creator is actor
    where = 'WHERE f.tenantId = ? AND (f.picId = ? OR f.createdById = ?)';
    params = [targetTenant, actorUserId, actorUserId];
  }

  try {
    let extraWhere = '';
    const extraParams: any[] = [];

    const {
      customerId,
      projectId,
      relatedProjectId,
      visitId,
      relatedVisitId,
      taskId,
      relatedTaskId,
      typeId,
      picId,
      status,
      priority,
      search,
      page,
      pageSize,
      dueDateFrom,
      dueDateTo,
      startDate,
      endDate,
      isOverdue,
      isDueToday
    } = req.query;

    if (customerId && customerId !== 'ALL') {
      const [cCheck]: any = await pool.query('SELECT id FROM customers WHERE id = ? AND tenantId = ?', [customerId, targetTenant]);
      if (cCheck.length === 0) {
        return res.status(404).json({ error: 'Customer not found in company.', code: 'CUSTOMER_NOT_FOUND' });
      }
      extraWhere += ' AND f.customerId = ?';
      extraParams.push(customerId);
    }

    const projId = projectId || relatedProjectId;
    if (projId && projId !== 'ALL') {
      const [pCheck]: any = await pool.query('SELECT id FROM projects WHERE id = ? AND tenantId = ?', [projId, targetTenant]);
      if (pCheck.length === 0) {
        return res.status(404).json({ error: 'Project not found in company.', code: 'PROJECT_NOT_FOUND' });
      }
      extraWhere += ' AND f.relatedProjectId = ?';
      extraParams.push(projId);
    }

    const visId = visitId || relatedVisitId;
    if (visId && visId !== 'ALL') {
      const [vCheck]: any = await pool.query('SELECT id FROM visits WHERE id = ? AND tenantId = ?', [visId, targetTenant]);
      if (vCheck.length === 0) {
        return res.status(404).json({ error: 'Visit not found in company.', code: 'VISIT_NOT_FOUND' });
      }
      extraWhere += ' AND f.relatedVisitId = ?';
      extraParams.push(visId);
    }

    const tskId = taskId || relatedTaskId;
    if (tskId && tskId !== 'ALL') {
      const [tCheck]: any = await pool.query('SELECT id FROM tasks WHERE id = ? AND tenantId = ?', [tskId, targetTenant]);
      if (tCheck.length === 0) {
        return res.status(404).json({ error: 'Task not found in company.', code: 'TASK_NOT_FOUND' });
      }
      extraWhere += ' AND f.relatedTaskId = ?';
      extraParams.push(tskId);
    }

    if (typeId && typeId !== 'ALL') {
      extraWhere += ' AND f.typeId = ?';
      extraParams.push(typeId);
    }

    if (picId && picId !== 'ALL') {
      extraWhere += ' AND f.picId = ?';
      extraParams.push(picId);
    }

    if (status && status !== 'ALL') {
      if (typeof status === 'string' && status.includes(',')) {
        const statuses = status.split(',').map((s: string) => s.trim()).filter(Boolean);
        if (statuses.length > 0) {
          extraWhere += ` AND f.status IN (${statuses.map(() => '?').join(',')})`;
          extraParams.push(...statuses);
        }
      } else {
        extraWhere += ' AND f.status = ?';
        extraParams.push(status);
      }
    }

    if (priority && priority !== 'ALL') {
      extraWhere += ' AND f.priorityId = ?';
      extraParams.push(priority);
    }

    const dFrom = dueDateFrom || startDate;
    if (dFrom) {
      extraWhere += ' AND DATE(f.followUpDate) >= DATE(?)';
      extraParams.push(dFrom);
    }

    const dTo = dueDateTo || endDate;
    if (dTo) {
      extraWhere += ' AND DATE(f.followUpDate) <= DATE(?)';
      extraParams.push(dTo);
    }

    if (String(isOverdue) === 'true') {
      extraWhere += " AND f.status IN ('OPEN', 'IN_PROGRESS', 'PENDING', 'SCHEDULED') AND DATE(f.followUpDate) < CURDATE()";
    }

    if (String(isDueToday) === 'true') {
      extraWhere += " AND f.status IN ('OPEN', 'IN_PROGRESS', 'PENDING', 'SCHEDULED') AND DATE(f.followUpDate) = CURDATE()";
    }

    if (search && typeof search === 'string' && search.trim()) {
      extraWhere += ' AND (f.title LIKE ? OR f.notes LIKE ? OR f.outcome LIKE ? OR c.name LIKE ?)';
      const s = `%${search.trim()}%`;
      extraParams.push(s, s, s, s);
    }

    const countSql = `
      SELECT COUNT(f.id) as total
      FROM follow_ups f
      LEFT JOIN follow_up_types ft ON ft.id = f.typeId
      LEFT JOIN customers c ON c.id = f.customerId
      ${where}
      ${extraWhere}
    `;
    const [countRows]: any = await pool.query(countSql, [...params, ...extraParams]);
    const totalItems = countRows[0]?.total || 0;

    const pNum = parseInt(page as string, 10) || 1;
    const pSize = parseInt(pageSize as string, 10) || 20;
    const offset = (pNum - 1) * pSize;
    const paginationClause = ` LIMIT ${pSize} OFFSET ${offset}`;

    const selectSql = `
      SELECT 
        f.*,
        f.priorityId as priority,
        ft.code as typeCode, ft.name as typeName, ft.icon as typeIcon, ft.color as typeColor,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar,
        uc.name as createdByName,
        cu.name as completedByName,
        c.name as customerName, c.code as customerCode,
        p.title as projectName,
        v.title as visitTitle,
        t.title as taskTitle,
        (SELECT COUNT(*) FROM follow_up_evidences fue WHERE fue.followUpId = f.id) as evidenceCount
      FROM follow_ups f
      LEFT JOIN follow_up_types ft ON ft.id = f.typeId
      LEFT JOIN users u ON u.id = f.picId
      LEFT JOIN users uc ON uc.id = f.createdById
      LEFT JOIN users cu ON cu.id = f.completedById
      LEFT JOIN customers c ON c.id = f.customerId
      LEFT JOIN projects p ON p.id = f.relatedProjectId
      LEFT JOIN visits v ON v.id = f.relatedVisitId
      LEFT JOIN tasks t ON t.id = f.relatedTaskId
      ${where}
      ${extraWhere}
      ORDER BY f.followUpDate DESC, f.createdAt DESC
      ${paginationClause}
    `;

    const [rows]: any = await pool.query(selectSql, [...params, ...extraParams]);

    // Compute Summary across the exact same scope & tenant
    const summarySql = `
      SELECT 
        SUM(CASE WHEN f.status IN ('OPEN', 'IN_PROGRESS', 'PENDING', 'SCHEDULED') AND DATE(f.followUpDate) = CURDATE() THEN 1 ELSE 0 END) as totalDueToday,
        SUM(CASE WHEN f.status IN ('OPEN', 'IN_PROGRESS', 'PENDING', 'SCHEDULED') AND DATE(f.followUpDate) < CURDATE() THEN 1 ELSE 0 END) as totalOverdue,
        SUM(CASE WHEN f.status IN ('OPEN', 'IN_PROGRESS', 'PENDING', 'SCHEDULED') AND DATE(f.followUpDate) > CURDATE() THEN 1 ELSE 0 END) as totalUpcoming,
        SUM(CASE WHEN f.status = 'COMPLETED' THEN 1 ELSE 0 END) as totalCompleted
      FROM follow_ups f
      ${where}
    `;
    const [sumRows]: any = await pool.query(summarySql, params);
    const sumRow = sumRows[0] || {};

    const totalPages = Math.ceil(totalItems / pSize) || (totalItems === 0 ? 0 : 1);
    res.json({
      data: rows,
      pagination: {
        page: pNum,
        pageSize: pSize,
        totalItems,
        totalPages
      },
      summary: {
        totalDueToday: Number(sumRow.totalDueToday || 0),
        totalOverdue: Number(sumRow.totalOverdue || 0),
        totalUpcoming: Number(sumRow.totalUpcoming || 0),
        totalCompleted: Number(sumRow.totalCompleted || 0),
        scope: effectiveScope
      }
    });
  } catch (err: any) {
    console.error('GET /api/follow-ups error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

followupsRoutes.get('/my', (req: any, res: any) => handleFollowUpsList(req, res, 'my'));
followupsRoutes.get('/all', (req: any, res: any) => handleFollowUpsList(req, res, 'all'));
followupsRoutes.get('/', (req: any, res: any) => handleFollowUpsList(req, res, req.query.scope));

// -------------------------------------------------------------------------
// 2. GET /api/follow-ups/:id - Single detail with evidences
// -------------------------------------------------------------------------
followupsRoutes.get('/:id', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  if (!checkPermission(req, 'FOLLOW_UP_VIEW')) {
    return res.status(403).json({ error: 'Access denied. Missing FOLLOW_UP_VIEW permission.', code: 'FORBIDDEN' });
  }

  const { id } = req.params;

  try {
    const selectSql = `
      SELECT 
        f.*,
        f.priorityId as priority,
        ft.code as typeCode, ft.name as typeName, ft.icon as typeIcon, ft.color as typeColor,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar,
        uc.name as createdByName,
        cu.name as completedByName,
        c.name as customerName, c.code as customerCode,
        p.title as projectName,
        v.title as visitTitle,
        t.title as taskTitle
      FROM follow_ups f
      LEFT JOIN follow_up_types ft ON ft.id = f.typeId
      LEFT JOIN users u ON u.id = f.picId
      LEFT JOIN users uc ON uc.id = f.createdById
      LEFT JOIN users cu ON cu.id = f.completedById
      LEFT JOIN customers c ON c.id = f.customerId
      LEFT JOIN projects p ON p.id = f.relatedProjectId
      LEFT JOIN visits v ON v.id = f.relatedVisitId
      LEFT JOIN tasks t ON t.id = f.relatedTaskId
      WHERE f.id = ? AND f.tenantId = ?
    `;
    const [rows]: any = await pool.query(selectSql, [id, targetTenant]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Follow-up not found', code: 'FOLLOW_UP_NOT_FOUND' });
    }

    const followUp = rows[0];

    // Fetch evidences
    const [evidences]: any = await pool.query(
      `SELECT 
        fue.id, fue.followUpId, fue.tenantId,
        fue.fileName, fue.fileName as originalFileName,
        fue.storageKey, fue.storageKey as storedFileName,
        fue.mimeType,
        fue.fileSize, fue.fileSize as fileSizeBytes,
        fue.caption, fue.caption as notes,
        fue.uploadedBy, fue.uploadedBy as uploadedById,
        fue.uploadedAt, fue.uploadedAt as createdAt,
        u.name as uploadedByName
       FROM follow_up_evidences fue
       LEFT JOIN users u ON u.id = fue.uploadedBy
       WHERE fue.followUpId = ? AND fue.tenantId = ?
       ORDER BY fue.uploadedAt ASC`,
      [id, targetTenant]
    );

    followUp.evidences = evidences;
    followUp.evidenceCount = evidences.length;

    res.json(followUp);
  } catch (err: any) {
    console.error(`GET /api/follow-ups/${id} error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// -------------------------------------------------------------------------
// 3. POST /api/follow-ups - Create new follow-up
// -------------------------------------------------------------------------
followupsRoutes.post('/', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  if (!checkPermission(req, 'FOLLOW_UP_CREATE')) {
    return res.status(403).json({ error: 'Access denied. Missing FOLLOW_UP_CREATE permission.', code: 'FORBIDDEN' });
  }

  const {
    customerId,
    typeId,
    picId,
    followUpDate,
    title,
    notes,
    priority,
    reminderDate,
    relatedProjectId,
    relatedVisitId,
    relatedTaskId,
    sourceType: clientSourceType
  } = req.body;

  // Validation
  if (!customerId || !String(customerId).trim()) {
    return res.status(400).json({ error: 'Customer ID is required.', code: 'CUSTOMER_REQUIRED' });
  }
  if (!typeId || !String(typeId).trim()) {
    return res.status(400).json({ error: 'Follow-up Type is required.', code: 'FOLLOW_UP_TYPE_REQUIRED' });
  }
  if (!followUpDate || isNaN(Date.parse(followUpDate))) {
    return res.status(400).json({ error: 'Valid Follow-up Date is required.', code: 'FOLLOW_UP_DATE_REQUIRED' });
  }

  const assignedPicId = picId || actorUserId;

  try {
    // 1. Verify customer exists in tenant
    const [custRows]: any = await pool.query('SELECT id, name FROM customers WHERE id = ? AND tenantId = ?', [customerId, targetTenant]);
    if (custRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found in company.', code: 'CUSTOMER_NOT_FOUND' });
    }

    // 2. Verify follow-up type exists in tenant and is active
    const [typeRows]: any = await pool.query(
      'SELECT id, name, code FROM follow_up_types WHERE id = ? AND tenantId = ? AND isActive = 1',
      [typeId, targetTenant]
    );
    if (typeRows.length === 0) {
      return res.status(400).json({ error: 'Follow-up type not found or is inactive.', code: 'INVALID_FOLLOW_UP_TYPE' });
    }

    // 3. Verify PIC exists in tenant
    const [userRows]: any = await pool.query('SELECT id, name FROM users WHERE id = ?', [assignedPicId]);
    if (userRows.length === 0) {
      return res.status(400).json({ error: 'Assigned user (PIC) not found.', code: 'PIC_NOT_FOUND' });
    }

    // 4. Validate contextual relationships
    if (relatedProjectId) {
      const [projRows]: any = await pool.query('SELECT id FROM projects WHERE id = ? AND tenantId = ?', [relatedProjectId, targetTenant]);
      if (projRows.length === 0) {
        return res.status(404).json({ error: 'Related project not found in company.', code: 'PROJECT_NOT_FOUND' });
      }
    }

    if (relatedVisitId) {
      const [visRows]: any = await pool.query('SELECT id FROM visits WHERE id = ? AND tenantId = ?', [relatedVisitId, targetTenant]);
      if (visRows.length === 0) {
        return res.status(404).json({ error: 'Related visit not found in company.', code: 'VISIT_NOT_FOUND' });
      }
    }

    if (relatedTaskId) {
      const [tskRows]: any = await pool.query('SELECT id FROM tasks WHERE id = ? AND tenantId = ?', [relatedTaskId, targetTenant]);
      if (tskRows.length === 0) {
        return res.status(404).json({ error: 'Related task not found in company.', code: 'TASK_NOT_FOUND' });
      }
    }

    // Determine authoritative sourceType
    let derivedSourceType: 'DIRECT' | 'VISIT' | 'PROJECT' | 'TASK' = 'DIRECT';
    if (relatedVisitId) {
      derivedSourceType = 'VISIT';
    } else if (relatedProjectId) {
      derivedSourceType = 'PROJECT';
    } else if (relatedTaskId) {
      derivedSourceType = 'TASK';
    } else if (clientSourceType && ['DIRECT', 'VISIT', 'PROJECT', 'TASK'].includes(clientSourceType)) {
      derivedSourceType = clientSourceType;
    }

    const id = `FU-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const cleanTitle = (title || `${typeRows[0].name} with ${custRows[0].name}`).trim();
    const cleanPriority = (priority || req.body.priorityId || 'MEDIUM').toUpperCase();

    const insertSql = `
      INSERT INTO follow_ups (
        id, tenantId, customerId, relatedProjectId, relatedVisitId, relatedTaskId,
        picId, createdById, followUpDate, typeId, priorityId, title, notes, reminderDate,
        status, sourceType, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, NOW(), NOW())
    `;

    await pool.query(insertSql, [
      id,
      targetTenant,
      customerId,
      relatedProjectId || null,
      relatedVisitId || null,
      relatedTaskId || null,
      assignedPicId,
      actorUserId,
      new Date(followUpDate),
      typeId,
      cleanPriority,
      cleanTitle,
      notes || null,
      reminderDate ? new Date(reminderDate) : null,
      derivedSourceType
    ]);

    await logAudit(
      targetTenant,
      actorUserId,
      'FOLLOW_UP_CREATED',
      'FOLLOW_UP',
      id,
      `Created follow-up '${cleanTitle}' for customer '${custRows[0].name}'`,
      req.ip,
      req.headers['user-agent']
    );

    // Fetch and return the newly created follow-up
    const [newRows]: any = await pool.query(
      `SELECT 
        f.*,
        f.priorityId as priority,
        ft.code as typeCode, ft.name as typeName, ft.icon as typeIcon, ft.color as typeColor,
        u.name as picName,
        uc.name as createdByName,
        c.name as customerName, c.code as customerCode,
        0 as evidenceCount
       FROM follow_ups f
       LEFT JOIN follow_up_types ft ON ft.id = f.typeId
       LEFT JOIN users u ON u.id = f.picId
       LEFT JOIN users uc ON uc.id = f.createdById
       LEFT JOIN customers c ON c.id = f.customerId
       WHERE f.id = ?`,
      [id]
    );

    res.status(201).json({ success: true, data: newRows[0] });
  } catch (err: any) {
    console.error('POST /api/follow-ups error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// -------------------------------------------------------------------------
// 4. PUT /api/follow-ups/:id - Update follow-up
// -------------------------------------------------------------------------
followupsRoutes.put('/:id', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  if (!checkPermission(req, 'FOLLOW_UP_UPDATE')) {
    return res.status(403).json({ error: 'Access denied. Missing FOLLOW_UP_UPDATE permission.', code: 'FORBIDDEN' });
  }

  const { id } = req.params;

  try {
    const [existingRows]: any = await pool.query('SELECT * FROM follow_ups WHERE id = ? AND tenantId = ?', [id, targetTenant]);
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Follow-up not found', code: 'FOLLOW_UP_NOT_FOUND' });
    }
    const current = existingRows[0];

    // Prevent altering terminal records
    if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
      return res.status(400).json({
        error: `Cannot modify follow-up that is already ${current.status}.`,
        code: 'FOLLOW_UP_ALREADY_TERMINAL'
      });
    }

    const {
      title,
      typeId,
      picId,
      followUpDate,
      notes,
      outcome,
      priority,
      status,
      reminderDate,
      rescheduledFromDate,
      rescheduleReason
    } = req.body;

    // Validate typeId if changing
    if (typeId && typeId !== current.typeId) {
      const [typeRows]: any = await pool.query(
        'SELECT id FROM follow_up_types WHERE id = ? AND tenantId = ? AND isActive = 1',
        [typeId, targetTenant]
      );
      if (typeRows.length === 0) {
        return res.status(400).json({ error: 'Invalid or inactive follow-up type.', code: 'INVALID_FOLLOW_UP_TYPE' });
      }
    }

    // Validate picId if changing
    if (picId && picId !== current.picId) {
      const [userRows]: any = await pool.query('SELECT id FROM users WHERE id = ?', [picId]);
      if (userRows.length === 0) {
        return res.status(400).json({ error: 'Assigned PIC not found.', code: 'PIC_NOT_FOUND' });
      }
    }

    // If client attempts to complete via PUT, route to /complete check
    if (status === 'COMPLETED' && current.status !== 'COMPLETED') {
      const [evRows]: any = await pool.query(
        'SELECT COUNT(*) as cnt FROM follow_up_evidences WHERE followUpId = ? AND tenantId = ?',
        [id, targetTenant]
      );
      if (evRows[0].cnt === 0) {
        return res.status(422).json({
          error: 'Follow-up completion requires at least one evidence image.',
          code: 'FOLLOW_UP_EVIDENCE_REQUIRED'
        });
      }
    }

    const updatedTitle = title !== undefined ? title : current.title;
    const updatedTypeId = typeId !== undefined ? typeId : current.typeId;
    const updatedPicId = picId !== undefined ? picId : current.picId;
    const updatedFollowUpDate = followUpDate ? new Date(followUpDate) : current.followUpDate;
    const updatedNotes = notes !== undefined ? notes : current.notes;
    const updatedOutcome = outcome !== undefined ? outcome : current.outcome;
    const updatedPriority = (priority !== undefined ? priority : (req.body.priorityId !== undefined ? req.body.priorityId : current.priorityId));
    const updatedStatus = (status && status !== 'CANCELLED') ? status : current.status;
    const updatedReminderDate = reminderDate !== undefined ? (reminderDate ? new Date(reminderDate) : null) : current.reminderDate;
    const updatedRescheduledFrom = rescheduledFromDate !== undefined ? (rescheduledFromDate ? new Date(rescheduledFromDate) : null) : current.rescheduledFromDate;
    const updatedRescheduleReason = rescheduleReason !== undefined ? rescheduleReason : current.rescheduleReason;

    const updateSql = `
      UPDATE follow_ups SET
        title = ?,
        typeId = ?,
        picId = ?,
        followUpDate = ?,
        notes = ?,
        outcome = ?,
        priorityId = ?,
        status = ?,
        reminderDate = ?,
        completedAt = ?,
        completedById = ?,
        updatedAt = NOW()
      WHERE id = ? AND tenantId = ?
    `;

    const completedAt = updatedStatus === 'COMPLETED' ? (current.completedAt || new Date()) : null;
    const completedById = updatedStatus === 'COMPLETED' ? (current.completedById || actorUserId) : null;

    await pool.query(updateSql, [
      updatedTitle,
      updatedTypeId,
      updatedPicId,
      updatedFollowUpDate,
      updatedNotes,
      updatedOutcome,
      updatedPriority,
      updatedStatus,
      updatedReminderDate,
      completedAt,
      completedById,
      id,
      targetTenant
    ]);

    await logAudit(
      targetTenant,
      actorUserId,
      'FOLLOW_UP_UPDATED',
      'FOLLOW_UP',
      id,
      `Updated follow-up '${updatedTitle}'`,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true, message: 'Follow-up updated successfully.' });
  } catch (err: any) {
    console.error(`PUT /api/follow-ups/${id} error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// -------------------------------------------------------------------------
// 5. POST /api/follow-ups/:id/complete - Complete with evidence check
// -------------------------------------------------------------------------
followupsRoutes.post('/:id/complete', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  if (!checkPermission(req, 'FOLLOW_UP_COMPLETE')) {
    return res.status(403).json({ error: 'Access denied. Missing FOLLOW_UP_COMPLETE permission.', code: 'FORBIDDEN' });
  }

  const { id } = req.params;

  try {
    const [existingRows]: any = await pool.query('SELECT * FROM follow_ups WHERE id = ? AND tenantId = ?', [id, targetTenant]);
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Follow-up not found', code: 'FOLLOW_UP_NOT_FOUND' });
    }
    const current = existingRows[0];

    if (current.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Follow-up is already completed.', code: 'FOLLOW_UP_ALREADY_COMPLETED' });
    }
    if (current.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cannot complete a cancelled follow-up.', code: 'FOLLOW_UP_ALREADY_CANCELLED' });
    }

    // MANDATORY EVIDENCE VERIFICATION
    const [evRows]: any = await pool.query(
      'SELECT COUNT(*) as cnt FROM follow_up_evidences WHERE followUpId = ? AND tenantId = ?',
      [id, targetTenant]
    );
    const evidenceCount = evRows[0]?.cnt || 0;

    if (evidenceCount === 0) {
      return res.status(422).json({
        error: 'Follow-up completion requires at least one evidence image.',
        code: 'FOLLOW_UP_EVIDENCE_REQUIRED'
      });
    }

    const rawOutcome = req.body.outcome !== undefined ? (typeof req.body.outcome === 'string' ? req.body.outcome.trim() : null) : (current.outcome || null);
    const outcome = rawOutcome || null;

    await pool.query(
      `UPDATE follow_ups SET
        status = 'COMPLETED',
        outcome = ?,
        completedAt = NOW(),
        completedById = ?,
        updatedAt = NOW()
       WHERE id = ? AND tenantId = ?`,
      [outcome, actorUserId, id, targetTenant]
    );

    await logAudit(
      targetTenant,
      actorUserId,
      'FOLLOW_UP_COMPLETED',
      'FOLLOW_UP',
      id,
      `Completed follow-up '${current.title}' with ${evidenceCount} evidence file(s).`,
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      message: 'Follow-up marked as completed.',
      data: {
        id,
        status: 'COMPLETED',
        completedAt: new Date(),
        completedById: actorUserId,
        outcome
      }
    });
  } catch (err: any) {
    console.error(`POST /api/follow-ups/${id}/complete error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// -------------------------------------------------------------------------
// 6. POST /api/follow-ups/:id/cancel - Cancel with mandatory reason
// -------------------------------------------------------------------------
followupsRoutes.post('/:id/cancel', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  if (!checkPermission(req, 'FOLLOW_UP_CANCEL')) {
    return res.status(403).json({ error: 'Access denied. Missing FOLLOW_UP_CANCEL permission.', code: 'FORBIDDEN' });
  }

  const { id } = req.params;

  try {
    const [existingRows]: any = await pool.query('SELECT * FROM follow_ups WHERE id = ? AND tenantId = ?', [id, targetTenant]);
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Follow-up not found', code: 'FOLLOW_UP_NOT_FOUND' });
    }
    const current = existingRows[0];

    if (current.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot cancel a completed follow-up.', code: 'CANNOT_CANCEL_COMPLETED_FOLLOW_UP' });
    }
    if (current.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Follow-up is already cancelled.', code: 'FOLLOW_UP_ALREADY_CANCELLED' });
    }

    const reason = (req.body.cancellationReason || req.body.reason || '').trim();
    if (!reason) {
      return res.status(400).json({
        error: 'Cancellation reason is mandatory.',
        code: 'CANCELLATION_REASON_REQUIRED'
      });
    }

    await pool.query(
      `UPDATE follow_ups SET
        status = 'CANCELLED',
        cancellationReason = ?,
        updatedAt = NOW()
       WHERE id = ? AND tenantId = ?`,
      [reason, id, targetTenant]
    );

    await logAudit(
      targetTenant,
      actorUserId,
      'FOLLOW_UP_CANCELLED',
      'FOLLOW_UP',
      id,
      `Cancelled follow-up '${current.title}'. Reason: ${reason}`,
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      message: 'Follow-up cancelled successfully.',
      data: {
        id,
        status: 'CANCELLED',
        cancellationReason: reason
      }
    });
  } catch (err: any) {
    console.error(`POST /api/follow-ups/${id}/cancel error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// -------------------------------------------------------------------------
// 7. Evidence Endpoints
// -------------------------------------------------------------------------

// GET /api/follow-ups/:id/evidences - List evidences
followupsRoutes.get('/:id/evidences', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  if (!checkPermission(req, 'FOLLOW_UP_EVIDENCE_VIEW')) {
    return res.status(403).json({ error: 'Access denied. Missing FOLLOW_UP_EVIDENCE_VIEW permission.', code: 'FORBIDDEN' });
  }

  const { id } = req.params;

  try {
    const [rows]: any = await pool.query(
      `SELECT 
        fue.id, fue.followUpId, fue.tenantId,
        fue.fileName, fue.fileName as originalFileName,
        fue.storageKey, fue.storageKey as storedFileName,
        fue.mimeType,
        fue.fileSize, fue.fileSize as fileSizeBytes,
        fue.caption, fue.caption as notes,
        fue.uploadedBy, fue.uploadedBy as uploadedById,
        fue.uploadedAt, fue.uploadedAt as createdAt,
        u.name as uploadedByName
       FROM follow_up_evidences fue
       LEFT JOIN users u ON u.id = fue.uploadedBy
       WHERE fue.followUpId = ? AND fue.tenantId = ?
       ORDER BY fue.uploadedAt ASC`,
      [id, targetTenant]
    );
    res.json(rows);
  } catch (err: any) {
    console.error(`GET /api/follow-ups/${id}/evidences error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/follow-ups/:id/evidences - Upload evidence image
followupsRoutes.post('/:id/evidences', (req: any, res: any, next: any) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds 5MB limit.', code: 'FILE_TOO_LARGE' });
      }
      if (err.message === 'INVALID_MIME_TYPE') {
        return res.status(400).json({ error: 'Only JPEG, PNG, and WEBP images are allowed.', code: 'INVALID_MIME_TYPE' });
      }
      return res.status(400).json({ error: err.message || 'File upload error', code: 'UPLOAD_ERROR' });
    }
    next();
  });
}, async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  if (!checkPermission(req, 'FOLLOW_UP_EVIDENCE_UPLOAD')) {
    return res.status(403).json({ error: 'Access denied. Missing FOLLOW_UP_EVIDENCE_UPLOAD permission.', code: 'FORBIDDEN' });
  }

  const { id } = req.params;

  try {
    // 1. Verify follow-up exists in tenant
    const [fuRows]: any = await pool.query('SELECT id, status FROM follow_ups WHERE id = ? AND tenantId = ?', [id, targetTenant]);
    if (fuRows.length === 0) {
      return res.status(404).json({ error: 'Follow-up not found', code: 'FOLLOW_UP_NOT_FOUND' });
    }

    // 2. Check maximum 5 evidence files limit
    const [countRows]: any = await pool.query(
      'SELECT COUNT(*) as cnt FROM follow_up_evidences WHERE followUpId = ? AND tenantId = ?',
      [id, targetTenant]
    );
    if (countRows[0].cnt >= 5) {
      return res.status(400).json({
        error: 'Maximum limit of 5 evidence files reached for this follow-up.',
        code: 'MAX_EVIDENCE_LIMIT_REACHED'
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No image file uploaded.', code: 'FILE_REQUIRED' });
    }

    // 3. Cryptographic magic bytes verification
    if (!isValidImageMagicBytes(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({
        error: 'Uploaded file content failed magic byte validation. File must be a valid JPEG, PNG, or WEBP image.',
        code: 'INVALID_IMAGE_FILE'
      });
    }

    // 4. Save to tenant-isolated storage
    const targetDir = ensureStorageDir(targetTenant, id);
    const ext = req.file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const safeStoredName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const destinationPath = path.join(targetDir, safeStoredName);

    // Path traversal check
    if (!destinationPath.startsWith(targetDir)) {
      return res.status(400).json({ error: 'Invalid file destination path.', code: 'SECURITY_VIOLATION' });
    }

    fs.writeFileSync(destinationPath, req.file.buffer);

    // 5. Insert record
    const evidenceId = `FUE-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const insertSql = `
      INSERT INTO follow_up_evidences (
        id, followUpId, tenantId, fileName, storageKey,
        mimeType, fileSize, caption, uploadedBy, uploadedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    await pool.query(insertSql, [
      evidenceId,
      id,
      targetTenant,
      req.file.originalname,
      safeStoredName,
      req.file.mimetype,
      req.file.size,
      req.body.notes || req.body.caption || null,
      actorUserId
    ]);

    await logAudit(
      targetTenant,
      actorUserId,
      'FOLLOW_UP_EVIDENCE_UPLOADED',
      'FOLLOW_UP_EVIDENCE',
      evidenceId,
      `Uploaded evidence '${req.file.originalname}' for follow-up '${id}'`,
      req.ip,
      req.headers['user-agent']
    );

    res.status(201).json({
      success: true,
      data: {
        id: evidenceId,
        followUpId: id,
        tenantId: targetTenant,
        fileName: req.file.originalname,
        originalFileName: req.file.originalname,
        storageKey: safeStoredName,
        storedFileName: safeStoredName,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        fileSizeBytes: req.file.size,
        caption: req.body.notes || req.body.caption || null,
        uploadedBy: actorUserId,
        uploadedById: actorUserId,
        uploadedAt: new Date(),
        createdAt: new Date()
      }
    });
  } catch (err: any) {
    console.error(`POST /api/follow-ups/${id}/evidences error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/follow-ups/:id/evidences/:evidenceId/preview - Stream/preview image
followupsRoutes.get('/:id/evidences/:evidenceId/preview', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  if (!checkPermission(req, 'FOLLOW_UP_EVIDENCE_VIEW')) {
    return res.status(403).json({ error: 'Access denied. Missing FOLLOW_UP_EVIDENCE_VIEW permission.', code: 'FORBIDDEN' });
  }

  const { id, evidenceId } = req.params;

  try {
    const [rows]: any = await pool.query(
      'SELECT * FROM follow_up_evidences WHERE id = ? AND followUpId = ? AND tenantId = ?',
      [evidenceId, id, targetTenant]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Evidence record not found.', code: 'EVIDENCE_NOT_FOUND' });
    }

    const evidence = rows[0];

    // Tenant isolation verification
    const safeTenant = targetTenant.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFollowUp = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const expectedDir = path.join(STORAGE_ROOT, 'tenants', safeTenant, 'follow-ups', safeFollowUp);
    const filename = evidence.storageKey || evidence.storedFileName;
    const resolvedPath = path.resolve(path.join(expectedDir, filename));

    if (!resolvedPath.startsWith(expectedDir)) {
      return res.status(403).json({ error: 'Access denied: Directory traversal detected.', code: 'SECURITY_VIOLATION' });
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Physical evidence file missing on server.', code: 'FILE_NOT_FOUND' });
    }

    const originalName = evidence.fileName || evidence.originalFileName || 'evidence.png';
    res.setHeader('Content-Type', evidence.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalName)}"`);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(resolvedPath);
  } catch (err: any) {
    console.error(`GET /api/follow-ups/${id}/evidences/${evidenceId}/preview error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/follow-ups/:id/evidences/:evidenceId - Delete evidence image
followupsRoutes.delete('/:id/evidences/:evidenceId', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  if (!checkPermission(req, 'FOLLOW_UP_EVIDENCE_DELETE')) {
    return res.status(403).json({ error: 'Access denied. Missing FOLLOW_UP_EVIDENCE_DELETE permission.', code: 'FORBIDDEN' });
  }

  const { id, evidenceId } = req.params;

  try {
    const [fuRows]: any = await pool.query('SELECT id, status FROM follow_ups WHERE id = ? AND tenantId = ?', [id, targetTenant]);
    if (fuRows.length === 0) {
      return res.status(404).json({ error: 'Follow-up not found', code: 'FOLLOW_UP_NOT_FOUND' });
    }
    const followUp = fuRows[0];

    const [evRows]: any = await pool.query(
      'SELECT * FROM follow_up_evidences WHERE id = ? AND followUpId = ? AND tenantId = ?',
      [evidenceId, id, targetTenant]
    );
    if (evRows.length === 0) {
      return res.status(404).json({ error: 'Evidence record not found.', code: 'EVIDENCE_NOT_FOUND' });
    }
    const evidence = evRows[0];

    // If follow-up is completed, prevent deleting the only evidence
    if (followUp.status === 'COMPLETED') {
      const [totalEvRows]: any = await pool.query(
        'SELECT COUNT(*) as cnt FROM follow_up_evidences WHERE followUpId = ? AND tenantId = ?',
        [id, targetTenant]
      );
      if (totalEvRows[0].cnt <= 1) {
        return res.status(400).json({
          error: 'Cannot delete the only remaining evidence for a completed follow-up. Completed follow-ups require at least one evidence.',
          code: 'CANNOT_DELETE_LAST_EVIDENCE_FOR_COMPLETED'
        });
      }
    }

    // Delete file from disk if exists
    try {
      const safeTenant = targetTenant.replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeFollowUp = id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const expectedDir = path.join(STORAGE_ROOT, 'tenants', safeTenant, 'follow-ups', safeFollowUp);
      const filename = evidence.storageKey || evidence.storedFileName;
      const resolvedPath = path.resolve(path.join(expectedDir, filename));
      if (fs.existsSync(resolvedPath)) {
        fs.unlinkSync(resolvedPath);
      }
    } catch (diskErr) {
      console.warn('Failed to delete file from disk:', diskErr);
    }

    // Delete from database
    await pool.query('DELETE FROM follow_up_evidences WHERE id = ? AND tenantId = ?', [evidenceId, targetTenant]);

    const originalName = evidence.fileName || evidence.originalFileName || 'evidence.png';
    await logAudit(
      targetTenant,
      actorUserId,
      'FOLLOW_UP_EVIDENCE_DELETED',
      'FOLLOW_UP_EVIDENCE',
      evidenceId,
      `Deleted evidence '${originalName}' from follow-up '${id}'`,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true, message: 'Evidence file deleted successfully.' });
  } catch (err: any) {
    console.error(`DELETE /api/follow-ups/${id}/evidences/${evidenceId} error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

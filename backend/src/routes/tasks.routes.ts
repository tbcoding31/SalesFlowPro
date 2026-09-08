import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { buildReportScopeWhere, validateTargetTenant } from '../utils/scope';
import { logAudit } from '../utils/audit';

export const tasksRoutes = Router();

// GET /api/tasks - List tasks with pagination, customerId, status, search, relatedProjectId, relatedVisitId, sourceType
tasksRoutes.get('/', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { where, params } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 't.picId');

  try {
    let extraWhere = '';
    const extraParams: any[] = [];

    const { customerId, picId, status, priority, search, page, pageSize, relatedProjectId, relatedVisitId, sourceType } = req.query;

    if (customerId && customerId !== 'ALL') {
      extraWhere += ' AND t.customerId = ?';
      extraParams.push(customerId);
    }

    if (picId && picId !== 'ALL') {
      extraWhere += ' AND t.picId = ?';
      extraParams.push(picId);
    }

    if (status && status !== 'ALL') {
      extraWhere += ' AND (t.statusId = ? OR ts.code = ? OR ts.name = ?)';
      extraParams.push(status, status, status);
    }

    if (priority && priority !== 'ALL') {
      extraWhere += ' AND (t.priorityId = ? OR tp.code = ? OR tp.name = ?)';
      extraParams.push(priority, priority, priority);
    }

    if (relatedProjectId) {
      extraWhere += ' AND t.relatedProjectId = ?';
      extraParams.push(relatedProjectId);
    }

    if (relatedVisitId) {
      extraWhere += ' AND t.relatedVisitId = ?';
      extraParams.push(relatedVisitId);
    }

    if (sourceType) {
      extraWhere += ' AND t.sourceType = ?';
      extraParams.push(sourceType);
    }

    if (search && typeof search === 'string' && search.trim()) {
      extraWhere += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      const s = `%${search.trim()}%`;
      extraParams.push(s, s);
    }

    const countSql = `
      SELECT COUNT(t.id) as total
      FROM tasks t
      LEFT JOIN task_statuses ts ON ts.id = t.statusId
      LEFT JOIN task_priorities tp ON tp.id = t.priorityId
      ${where.replace(/WHERE tenantId/g, 'WHERE t.tenantId')}
      ${extraWhere}
    `;
    const [countRows]: any = await pool.query(countSql, [...params, ...extraParams]);
    const totalItems = countRows[0]?.total || 0;

    let paginationClause = '';
    const pNum = parseInt(page as string, 10);
    const pSize = parseInt(pageSize as string, 10);
    if (!isNaN(pNum) && !isNaN(pSize) && pNum > 0 && pSize > 0) {
      const offset = (pNum - 1) * pSize;
      paginationClause = ` LIMIT ${pSize} OFFSET ${offset}`;
    }

    const selectSql = `
      SELECT 
        t.*,
        ts.code as statusCode, ts.name as statusName, ts.color as statusColor,
        tp.code as priorityCode, tp.name as priorityName, tp.color as priorityColor,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar,
        c.name as customerName, c.code as customerCode
      FROM tasks t
      LEFT JOIN task_statuses ts ON ts.id = t.statusId
      LEFT JOIN task_priorities tp ON tp.id = t.priorityId
      LEFT JOIN users u ON u.id = t.picId
      LEFT JOIN customers c ON c.id = t.customerId
      ${where.replace(/WHERE tenantId/g, 'WHERE t.tenantId')}
      ${extraWhere}
      ORDER BY t.dueDate ASC, t.createdAt DESC
      ${paginationClause}
    `;

    const [rows]: any = await pool.query(selectSql, [...params, ...extraParams]);

    if (!isNaN(pNum) && !isNaN(pSize) && pNum > 0 && pSize > 0) {
      const totalPages = Math.ceil(totalItems / pSize) || 1;
      res.json({
        data: rows,
        pagination: {
          page: pNum,
          pageSize: pSize,
          totalItems,
          totalPages
        }
      });
    } else {
      res.json(rows);
    }
  } catch (err: any) {
    console.error('GET /api/tasks error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/tasks/:id - Single task
tasksRoutes.get('/:id', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;

  try {
    const [rows]: any = await pool.query(`
      SELECT 
        t.*,
        ts.code as statusCode, ts.name as statusName, ts.color as statusColor,
        tp.code as priorityCode, tp.name as priorityName, tp.color as priorityColor,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar,
        c.name as customerName, c.code as customerCode
      FROM tasks t
      LEFT JOIN task_statuses ts ON ts.id = t.statusId
      LEFT JOIN task_priorities tp ON tp.id = t.priorityId
      LEFT JOIN users u ON u.id = t.picId
      LEFT JOIN customers c ON c.id = t.customerId
      WHERE t.id = ? AND t.tenantId = ?
    `, [id, targetTenant]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(rows[0]);
  } catch (err: any) {
    console.error(`GET /api/tasks/${id} error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/tasks - Create manual task
tasksRoutes.post('/', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const data = req.body || {};
  const { title, description, customerId, relatedProjectId, relatedVisitId, priorityId, priority, statusId, status, taskType, dueDate, picId } = data;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Task title is required', code: 'MISSING_TASK_TITLE' });
  }

  // Validate customer if provided
  let resolvedCustomerId: string | null = null;
  if (customerId) {
    const [cRows]: any = await pool.query(
      'SELECT id FROM customers WHERE id = ? AND tenantId = ?',
      [String(customerId).trim(), targetTenant]
    );
    if (cRows.length > 0) resolvedCustomerId = cRows[0].id;
  }

  // Validate PIC if provided
  let resolvedPicId: string | null = null;
  const picCandidate = picId || actorUserId;
  if (picCandidate) {
    const [uRows]: any = await pool.query(`
      SELECT tu.userId FROM tenant_users tu
      JOIN users u ON u.id = tu.userId
      WHERE tu.tenantId = ? AND tu.userId = ? AND tu.status = 'ACTIVE' AND u.status = 'ACTIVE'
      LIMIT 1
    `, [targetTenant, picCandidate]);
    if (uRows.length > 0) resolvedPicId = uRows[0].userId;
  }

  // Resolve statusId
  let resolvedStatusId = 'TS-1';
  const statusCand = statusId || status;
  if (statusCand) {
    const [sRows]: any = await pool.query(
      'SELECT id FROM task_statuses WHERE id = ? OR code = ? OR name = ? LIMIT 1',
      [statusCand, statusCand, statusCand]
    );
    if (sRows.length > 0) resolvedStatusId = sRows[0].id;
  }

  // Resolve priorityId
  let resolvedPriorityId = 'TP-3';
  const priCand = priorityId || priority;
  if (priCand) {
    const [pRows]: any = await pool.query(
      'SELECT id FROM task_priorities WHERE id = ? OR code = ? OR name = ? LIMIT 1',
      [priCand, priCand, priCand]
    );
    if (pRows.length > 0) resolvedPriorityId = pRows[0].id;
  }

  const taskId = data.id && String(data.id).trim()
    ? String(data.id).trim()
    : 'TSK-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');

  const sourceType = data.sourceType || 'MANUAL';
  const taskDesc = description ? String(description).trim() : null;

  try {
    await pool.query(`
      INSERT INTO tasks (
        id, tenantId, title, description, customerId, relatedProjectId, relatedVisitId,
        priorityId, statusId, taskType, dueDate, picId, sourceType, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      taskId, targetTenant, String(title).trim(), taskDesc, resolvedCustomerId,
      relatedProjectId || null, relatedVisitId || null,
      resolvedPriorityId, resolvedStatusId, taskType || 'GENERAL',
      dueDate || null, resolvedPicId, sourceType
    ]);

    await logAudit(
      targetTenant,
      actorUserId,
      'TASK_CREATED',
      'Task',
      taskId,
      `Task '${title}' created`,
      req.ip,
      req.get('User-Agent'),
      'CRM'
    );

    res.status(201).json({
      success: true,
      id: taskId,
      data: {
        id: taskId,
        title,
        statusId: resolvedStatusId,
        priorityId: resolvedPriorityId,
        sourceType
      }
    });
  } catch (err: any) {
    console.error('POST /api/tasks error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/tasks/:id - Update task
tasksRoutes.put('/:id', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;
  const data = req.body || {};

  try {
    const [existing]: any = await pool.query('SELECT * FROM tasks WHERE id = ? AND tenantId = ?', [id, targetTenant]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const current = existing[0];

    const title = data.title !== undefined ? String(data.title).trim() : current.title;
    const description = data.description !== undefined ? data.description : current.description;
    const dueDate = data.dueDate !== undefined ? data.dueDate : current.dueDate;
    const taskType = data.taskType !== undefined ? data.taskType : current.taskType;

    let statusId = current.statusId;
    const statusCand = data.statusId || data.status;
    if (statusCand) {
      const [sRows]: any = await pool.query(
        'SELECT id FROM task_statuses WHERE id = ? OR code = ? OR name = ? LIMIT 1',
        [statusCand, statusCand, statusCand]
      );
      if (sRows.length > 0) statusId = sRows[0].id;
    }

    let priorityId = current.priorityId;
    const priCand = data.priorityId || data.priority;
    if (priCand) {
      const [pRows]: any = await pool.query(
        'SELECT id FROM task_priorities WHERE id = ? OR code = ? OR name = ? LIMIT 1',
        [priCand, priCand, priCand]
      );
      if (pRows.length > 0) priorityId = pRows[0].id;
    }

    let picId = current.picId;
    if (data.picId !== undefined) {
      if (data.picId === null || data.picId === '') {
        picId = null;
      } else {
        const [uRows]: any = await pool.query(`
          SELECT tu.userId FROM tenant_users tu
          JOIN users u ON u.id = tu.userId
          WHERE tu.tenantId = ? AND tu.userId = ? AND tu.status = 'ACTIVE' AND u.status = 'ACTIVE'
          LIMIT 1
        `, [targetTenant, data.picId]);
        if (uRows.length > 0) picId = uRows[0].userId;
      }
    }

    const completedAtVal = (statusId === 'TS-3' || statusId === 'COMPLETED') && !current.completedAt
      ? new Date()
      : current.completedAt;

    await pool.query(`
      UPDATE tasks 
      SET title = ?, description = ?, dueDate = ?, taskType = ?, statusId = ?, priorityId = ?, picId = ?, completedAt = ?, updatedAt = NOW()
      WHERE id = ? AND tenantId = ?
    `, [title, description, dueDate, taskType, statusId, priorityId, picId, completedAtVal, id, targetTenant]);

    await logAudit(
      targetTenant,
      actorUserId,
      'TASK_UPDATED',
      'Task',
      id,
      `Task '${title}' updated`,
      req.ip,
      req.get('User-Agent'),
      'CRM'
    );

    res.json({ success: true, id, data: { id, title, statusId, priorityId, picId } });
  } catch (err: any) {
    console.error(`PUT /api/tasks/${id} error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/tasks/:id - Delete task
tasksRoutes.delete('/:id', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;

  try {
    const [existing]: any = await pool.query('SELECT * FROM tasks WHERE id = ? AND tenantId = ?', [id, targetTenant]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await pool.query('DELETE FROM tasks WHERE id = ? AND tenantId = ?', [id, targetTenant]);

    await logAudit(
      targetTenant,
      actorUserId,
      'TASK_DELETED',
      'Task',
      id,
      `Task '${existing[0].title}' deleted`,
      req.ip,
      req.get('User-Agent'),
      'CRM'
    );

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (err: any) {
    console.error(`DELETE /api/tasks/${id} error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

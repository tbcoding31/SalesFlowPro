import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { buildReportScopeWhere, validateTargetTenant } from '../utils/scope';
import { logAudit } from '../utils/audit';

export const tasksRoutes = Router();

const TASK_JOIN_CLAUSES = `
  LEFT JOIN task_statuses ts ON ts.id = t.statusId AND ts.tenantId = t.tenantId
  LEFT JOIN task_priorities tp ON tp.id = t.priorityId AND tp.tenantId = t.tenantId
  LEFT JOIN users u ON u.id = t.picId
  LEFT JOIN customers c ON c.id = t.customerId AND c.tenantId = t.tenantId
  LEFT JOIN projects p ON p.id = t.relatedProjectId AND p.tenantId = t.tenantId
  LEFT JOIN visits v ON v.id = t.relatedVisitId AND v.tenantId = t.tenantId
`;

const TASK_SELECT_FIELDS = `
  t.id,
  t.tenantId,
  t.title,
  t.description,
  COALESCE(t.sourceType, 'MANUAL') as sourceType,
  t.statusId as statusId,
  ts.code as statusCode,
  ts.name as statusName,
  ts.color as statusColor,
  CASE 
    WHEN ts.code = 'COMPLETED' OR ts.code = 'TSK_COMPLETED' OR ts.isTerminal = 1 THEN 'COMPLETED'
    WHEN ts.code = 'IN_PROGRESS' OR ts.code = 'TSK_INPROGRESS' THEN 'IN_PROGRESS'
    WHEN ts.code = 'CANCELLED' OR ts.code = 'TSK_CANCELLED' THEN 'CANCELLED'
    WHEN ts.code = 'TODO' OR ts.code = 'TSK_TODO' THEN 'TODO'
    WHEN ts.code IS NOT NULL THEN ts.code
    ELSE 'UNKNOWN'
  END as status,
  t.priorityId as priorityId,
  tp.code as priorityCode,
  tp.name as priorityName,
  tp.color as priorityColor,
  CASE
    WHEN tp.code = 'URGENT' OR tp.code = 'PRI_URGENT' THEN 'URGENT'
    WHEN tp.code = 'HIGH' OR tp.code = 'PRI_HIGH' THEN 'HIGH'
    WHEN tp.code = 'LOW' OR tp.code = 'PRI_LOW' THEN 'LOW'
    WHEN tp.code = 'MEDIUM' OR tp.code = 'PRI_MEDIUM' OR tp.code = 'NORMAL' THEN 'MEDIUM'
    WHEN tp.code IS NOT NULL THEN tp.code
    ELSE 'UNKNOWN'
  END as priority,
  t.picId,
  COALESCE(u.name, 'Unassigned') as picName,
  u.email as picEmail,
  u.avatar as picAvatar,
  t.customerId,
  c.name as customerName,
  c.code as customerCode,
  t.relatedProjectId,
  p.title as projectName,
  p.id as projectCode,
  t.relatedVisitId,
  v.title as visitTitle,
  DATE_FORMAT(v.visitDate, '%Y-%m-%d') as visitDate,
  DATE_FORMAT(t.dueDate, '%Y-%m-%d') as dueDate,
  t.taskType,
  t.createdAt,
  t.updatedAt,
  t.completedAt
`;

import { normalizeSemanticRole } from './navigation.routes';

// GET /api/tasks - List tasks with pagination, customerId, status, search, relatedProjectId, relatedVisitId, sourceType, scope
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

  const semanticRole = normalizeSemanticRole(actorRole, isPlatformUser);
  const { customerId, picId, status, priority, search, page, pageSize, relatedProjectId, relatedVisitId, sourceType, dueDate, scope } = req.query;

  // Scope Enforcement (All Tasks vs My Tasks)
  let where: string;
  let params: any[];

  if (scope === 'all') {
    // ONLY TENANT_ADMIN and SUPERVISOR (or SUPER_ADMIN) are permitted
    if (semanticRole !== 'TENANT_ADMIN' && semanticRole !== 'SUPERVISOR' && semanticRole !== 'SUPER_ADMIN') {
      return res.status(403).json({
        error: 'Access denied: All Tasks scope is restricted to Tenant Admin and Supervisor',
        code: 'SCOPE_ACCESS_DENIED'
      });
    }
    // SPECIAL SUPERVISOR OVERRIDE: Tenant-wide visibility
    where = 'WHERE t.tenantId = ?';
    params = [targetTenant];
  } else if (scope === 'my') {
    // MY TASKS: Current authenticated user is assignee
    where = 'WHERE t.tenantId = ? AND t.picId = ?';
    params = [targetTenant, actorUserId];
  } else {
    // If scope is not explicitly provided, use standard report/role-based scoping
    const scoped = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 't.picId');
    where = scoped.where;
    params = scoped.params;
  }

  try {
    let extraWhere = '';
    const extraParams: any[] = [];

    if (customerId && customerId !== 'ALL') {
      extraWhere += ' AND t.customerId = ?';
      extraParams.push(customerId);
    }

    if (picId && picId !== 'ALL') {
      extraWhere += ' AND t.picId = ?';
      extraParams.push(picId);
    }

    if (status && status !== 'ALL') {
      extraWhere += ` AND (
        t.statusId = ? OR ts.code = ? OR ts.name = ?
        OR ( ? = 'COMPLETED' AND (ts.code IN ('COMPLETED', 'TSK_COMPLETED') OR ts.isTerminal = 1) )
        OR ( ? = 'IN_PROGRESS' AND ts.code IN ('IN_PROGRESS', 'TSK_INPROGRESS') )
        OR ( ? = 'CANCELLED' AND ts.code IN ('CANCELLED', 'TSK_CANCELLED') )
        OR ( ? IN ('TODO', 'OPEN', 'PENDING') AND ts.code IN ('TODO', 'OPEN', 'PENDING', 'TSK_TODO') )
      )`;
      extraParams.push(status, status, status, status, status, status, status);
    }

    if (priority && priority !== 'ALL') {
      extraWhere += ` AND (
        t.priorityId = ? OR tp.code = ? OR tp.name = ?
        OR ( ? = 'URGENT' AND tp.code IN ('URGENT', 'PRI_URGENT') )
        OR ( ? = 'HIGH' AND tp.code IN ('HIGH', 'PRI_HIGH') )
        OR ( ? = 'LOW' AND tp.code IN ('LOW', 'PRI_LOW') )
        OR ( ? = 'MEDIUM' AND tp.code IN ('MEDIUM', 'PRI_MEDIUM') )
      )`;
      extraParams.push(priority, priority, priority, priority, priority, priority, priority);
    }

    if (relatedProjectId && relatedProjectId !== 'ALL') {
      extraWhere += ' AND t.relatedProjectId = ?';
      extraParams.push(relatedProjectId);
    }

    if (relatedVisitId && relatedVisitId !== 'ALL') {
      extraWhere += ' AND t.relatedVisitId = ?';
      extraParams.push(relatedVisitId);
    }

    if (sourceType && sourceType !== 'ALL') {
      extraWhere += ' AND t.sourceType = ?';
      extraParams.push(sourceType);
    }

    if (dueDate) {
      extraWhere += ' AND DATE_FORMAT(t.dueDate, "%Y-%m-%d") = ?';
      extraParams.push(dueDate);
    }

    if (search && typeof search === 'string' && search.trim()) {
      extraWhere += ` AND (
        t.title LIKE ? OR t.description LIKE ? OR t.id LIKE ?
        OR c.name LIKE ? OR c.code LIKE ?
        OR p.title LIKE ?
        OR v.title LIKE ?
        OR u.name LIKE ?
      )`;
      const s = `%${search.trim()}%`;
      extraParams.push(s, s, s, s, s, s, s, s);
    }

    const countSql = `
      SELECT COUNT(t.id) as total
      FROM tasks t
      ${TASK_JOIN_CLAUSES}
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
        ${TASK_SELECT_FIELDS}
      FROM tasks t
      ${TASK_JOIN_CLAUSES}
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
        ${TASK_SELECT_FIELDS}
      FROM tasks t
      ${TASK_JOIN_CLAUSES}
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

  // Validate relatedProjectId belongs to targetTenant
  let resolvedProjectId: string | null = null;
  if (relatedProjectId) {
    const [pRows]: any = await pool.query(
      'SELECT id FROM projects WHERE id = ? AND tenantId = ?',
      [String(relatedProjectId).trim(), targetTenant]
    );
    if (pRows.length === 0) {
      return res.status(400).json({
        error: 'Related project not found or does not belong to this tenant',
        code: 'PROJECT_TENANT_MISMATCH'
      });
    }
    resolvedProjectId = pRows[0].id;
  }

  // Validate relatedVisitId belongs to targetTenant
  let resolvedVisitId: string | null = null;
  if (relatedVisitId) {
    const [vRows]: any = await pool.query(
      'SELECT id FROM visits WHERE id = ? AND tenantId = ?',
      [String(relatedVisitId).trim(), targetTenant]
    );
    if (vRows.length === 0) {
      return res.status(400).json({
        error: 'Related visit not found or does not belong to this tenant',
        code: 'VISIT_TENANT_MISMATCH'
      });
    }
    resolvedVisitId = vRows[0].id;
  }

  // Resolve statusId (Only isActive = 1 allowed for new tasks)
  let resolvedStatusId: string | null = null;
  let resolvedStatusCode = 'TODO';
  const statusCand = statusId || status;
  if (statusCand) {
    const [sRows]: any = await pool.query(
      'SELECT id, code, isTerminal FROM task_statuses WHERE tenantId = ? AND isActive = 1 AND (id = ? OR code = ? OR name = ? OR code = CONCAT("TSK_", ?)) LIMIT 1',
      [targetTenant, statusCand, statusCand, statusCand, statusCand]
    );
    if (sRows.length > 0) {
      resolvedStatusId = sRows[0].id;
      resolvedStatusCode = sRows[0].code;
    } else {
      return res.status(400).json({ error: 'Invalid or inactive task status', code: 'INVALID_TASK_STATUS' });
    }
  } else {
    const [defS]: any = await pool.query('SELECT id, code FROM task_statuses WHERE tenantId = ? AND isActive = 1 ORDER BY displayOrder ASC, id ASC LIMIT 1', [targetTenant]);
    if (defS.length === 0) {
      return res.status(500).json({
        error: 'CONFIG_INTEGRITY_ERROR',
        code: 'MISSING_ACTIVE_MASTER_DATA',
        message: `Tenant ${targetTenant} has no active task statuses configured.`
      });
    }
    resolvedStatusId = defS[0].id;
    resolvedStatusCode = defS[0].code;
  }

  // Resolve priorityId (Only isActive = 1 allowed for new tasks)
  let resolvedPriorityId: string | null = null;
  let resolvedPriorityCode = 'MEDIUM';
  const priCand = priorityId || priority;
  if (priCand) {
    const [pRows]: any = await pool.query(
      'SELECT id, code FROM task_priorities WHERE tenantId = ? AND isActive = 1 AND (id = ? OR code = ? OR name = ? OR code = CONCAT("PRI_", ?)) LIMIT 1',
      [targetTenant, priCand, priCand, priCand, priCand]
    );
    if (pRows.length > 0) {
      resolvedPriorityId = pRows[0].id;
      resolvedPriorityCode = pRows[0].code;
    } else {
      return res.status(400).json({ error: 'Invalid or inactive task priority', code: 'INVALID_TASK_PRIORITY' });
    }
  } else {
    const [defP]: any = await pool.query('SELECT id, code FROM task_priorities WHERE tenantId = ? AND isActive = 1 ORDER BY displayOrder ASC, id ASC LIMIT 1', [targetTenant]);
    if (defP.length === 0) {
      return res.status(500).json({
        error: 'CONFIG_INTEGRITY_ERROR',
        code: 'MISSING_ACTIVE_MASTER_DATA',
        message: `Tenant ${targetTenant} has no active task priorities configured.`
      });
    }
    resolvedPriorityId = defP[0].id;
    resolvedPriorityCode = defP[0].code;
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
      resolvedProjectId, resolvedVisitId,
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
        tenantId: targetTenant,
        title,
        statusId: resolvedStatusId,
        status: resolvedStatusCode,
        priorityId: resolvedPriorityId,
        priority: resolvedPriorityCode,
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
    let isCompleted = current.completedAt !== null;
    const statusCand = data.statusId || data.status;
    if (statusCand) {
      const [sRows]: any = await pool.query(
        'SELECT id, code, isTerminal FROM task_statuses WHERE tenantId = ? AND isActive = 1 AND (id = ? OR code = ? OR name = ? OR code = CONCAT("TSK_", ?)) LIMIT 1',
        [targetTenant, statusCand, statusCand, statusCand, statusCand]
      );
      if (sRows.length > 0) {
        statusId = sRows[0].id;
        isCompleted = sRows[0].code === 'COMPLETED' || sRows[0].isTerminal === 1;
      } else {
        return res.status(400).json({ error: 'Invalid or inactive task status', code: 'INVALID_TASK_STATUS' });
      }
    }

    let priorityId = current.priorityId;
    const priCand = data.priorityId || data.priority;
    if (priCand) {
      const [pRows]: any = await pool.query(
        'SELECT id, code FROM task_priorities WHERE tenantId = ? AND isActive = 1 AND (id = ? OR code = ? OR name = ? OR code = CONCAT("PRI_", ?)) LIMIT 1',
        [targetTenant, priCand, priCand, priCand, priCand]
      );
      if (pRows.length > 0) {
        priorityId = pRows[0].id;
      } else {
        return res.status(400).json({ error: 'Invalid or inactive task priority', code: 'INVALID_TASK_PRIORITY' });
      }
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

    const completedAtVal = isCompleted
      ? (current.completedAt || new Date())
      : null;

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

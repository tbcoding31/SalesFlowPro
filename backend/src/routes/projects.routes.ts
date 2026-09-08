import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { buildReportScopeWhere, validateTargetTenant } from '../utils/scope';
import { logAudit } from '../utils/audit';
import { syncProjectAssignmentTasks } from '../services/taskAssignment.service';

export const projectsRoutes = Router();

// GET /api/projects - List projects with role/tenant scoping
projectsRoutes.get('/', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { where, params } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'p.picId');

  try {
    let extraWhere = '';
    const extraParams: any[] = [];
    const { customerId, picId, stageId, search } = req.query;

    if (customerId && customerId !== 'ALL') {
      extraWhere += ' AND p.customerId = ?';
      extraParams.push(customerId);
    }
    if (picId && picId !== 'ALL') {
      extraWhere += ' AND p.picId = ?';
      extraParams.push(picId);
    }
    if (stageId && stageId !== 'ALL') {
      extraWhere += ' AND p.stageId = ?';
      extraParams.push(stageId);
    }
    if (search && typeof search === 'string' && search.trim()) {
      extraWhere += ' AND (p.title LIKE ? OR p.description LIKE ?)';
      const s = `%${search.trim()}%`;
      extraParams.push(s, s);
    }

    const selectSql = `
      SELECT 
        p.*,
        c.name as customerName, c.code as customerCode,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar
      FROM projects p
      LEFT JOIN customers c ON c.id = p.customerId
      LEFT JOIN users u ON u.id = p.picId
      ${where.replace(/WHERE tenantId/g, 'WHERE p.tenantId')}
      ${extraWhere}
      ORDER BY p.createdAt DESC
    `;

    const [rows]: any = await pool.query(selectSql, [...params, ...extraParams]);
    res.json(rows);
  } catch (err: any) {
    console.error('GET /api/projects error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/projects/:id - Retrieve single project
projectsRoutes.get('/:id', async (req: any, res: any) => {
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
        p.*,
        c.name as customerName, c.code as customerCode,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar
      FROM projects p
      LEFT JOIN customers c ON c.id = p.customerId
      LEFT JOIN users u ON u.id = p.picId
      WHERE p.id = ? AND p.tenantId = ?
    `, [id, targetTenant]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(rows[0]);
  } catch (err: any) {
    console.error(`GET /api/projects/${id} error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/projects/:id/summary - Detail summary with tasks, visits, followups
projectsRoutes.get('/:id/summary', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;

  try {
    const [projRows]: any = await pool.query(`
      SELECT 
        p.*,
        c.name as customerName, c.code as customerCode,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar
      FROM projects p
      LEFT JOIN customers c ON c.id = p.customerId
      LEFT JOIN users u ON u.id = p.picId
      WHERE p.id = ? AND p.tenantId = ?
    `, [id, targetTenant]);

    if (projRows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projRows[0];

    // Tasks related to project (both PROJECT_ASSIGNMENT and VISIT_ASSIGNMENT under this project)
    const [taskRows]: any = await pool.query(`
      SELECT 
        t.id, t.tenantId, t.title, t.description,
        COALESCE(t.sourceType, 'MANUAL') as sourceType,
        COALESCE(ts.id, t.statusId) as statusId,
        COALESCE(ts.code, t.statusId) as statusCode,
        COALESCE(ts.name, t.statusId) as statusName,
        ts.color as statusColor,
        CASE 
          WHEN ts.id = 'TS-3' OR t.statusId IN ('COMPLETED', 'TSK_COMPLETED') THEN 'COMPLETED'
          WHEN ts.id = 'TS-2' OR t.statusId IN ('IN_PROGRESS', 'TSK_INPROGRESS') THEN 'IN_PROGRESS'
          WHEN ts.id = 'TS-4' OR t.statusId IN ('CANCELLED', 'TSK_CANCELLED') THEN 'CANCELLED'
          ELSE 'TODO'
        END as status,
        COALESCE(tp.id, t.priorityId) as priorityId,
        COALESCE(tp.code, t.priorityId) as priorityCode,
        COALESCE(tp.name, t.priorityId) as priorityName,
        tp.color as priorityColor,
        CASE
          WHEN tp.id = 'TP-1' OR t.priorityId IN ('URGENT', 'PRI_URGENT') THEN 'URGENT'
          WHEN tp.id = 'TP-2' OR t.priorityId IN ('HIGH', 'PRI_HIGH') THEN 'HIGH'
          WHEN tp.id = 'TP-4' OR t.priorityId IN ('LOW', 'PRI_LOW') THEN 'LOW'
          WHEN tp.id = 'TP-3' OR t.priorityId IN ('MEDIUM', 'PRI_MEDIUM', 'NORMAL') THEN 'MEDIUM'
          ELSE COALESCE(t.priorityId, 'MEDIUM')
        END as priority,
        t.picId,
        COALESCE(u.name, 'Unassigned') as picName,
        u.email as picEmail,
        u.avatar as picAvatar,
        t.customerId,
        c.name as customerName,
        t.relatedProjectId,
        t.relatedVisitId,
        v.title as visitTitle,
        DATE_FORMAT(v.visitDate, '%Y-%m-%d') as visitDate,
        DATE_FORMAT(t.dueDate, '%Y-%m-%d') as dueDate,
        t.taskType,
        t.createdAt,
        t.updatedAt,
        t.completedAt
      FROM tasks t
      LEFT JOIN task_statuses ts ON (
        ts.id = t.statusId 
        OR ts.code = t.statusId 
        OR ts.code = CONCAT('TSK_', t.statusId)
        OR (t.statusId = 'PENDING' AND ts.id = 'TS-1')
        OR (t.statusId = 'TODO' AND ts.id = 'TS-1')
        OR (t.statusId = 'IN_PROGRESS' AND ts.id = 'TS-2')
        OR (t.statusId = 'COMPLETED' AND ts.id = 'TS-3')
        OR (t.statusId = 'CANCELLED' AND ts.id = 'TS-4')
      )
      LEFT JOIN task_priorities tp ON (
        tp.id = t.priorityId
        OR tp.code = t.priorityId
        OR tp.code = CONCAT('PRI_', t.priorityId)
        OR (t.priorityId = 'URGENT' AND tp.id = 'TP-1')
        OR (t.priorityId = 'HIGH' AND tp.id = 'TP-2')
        OR (t.priorityId = 'NORMAL' AND tp.id = 'TP-3')
        OR (t.priorityId = 'MEDIUM' AND tp.id = 'TP-3')
        OR (t.priorityId = 'LOW' AND tp.id = 'TP-4')
      )
      LEFT JOIN users u ON u.id = t.picId
      LEFT JOIN customers c ON c.id = t.customerId
      LEFT JOIN visits v ON v.id = t.relatedVisitId
      WHERE t.tenantId = ? AND t.relatedProjectId = ?
      ORDER BY t.dueDate ASC, t.createdAt DESC
    `, [targetTenant, id]);

    // Visits under this project
    const [visitRows]: any = await pool.query(`
      SELECT 
        v.id, v.title, v.visitDate, v.startTime, v.endTime, v.location, v.statusId,
        vs.code as statusCode, vs.name as statusName,
        u.name as picName, c.name as customerName
      FROM visits v
      LEFT JOIN visit_statuses vs ON vs.id = v.statusId
      LEFT JOIN users u ON u.id = v.picId
      LEFT JOIN customers c ON c.id = v.customerId
      WHERE v.tenantId = ? AND v.relatedProjectId = ?
      ORDER BY v.visitDate DESC
    `, [targetTenant, id]);

    // Followups under this project
    const [followupRows]: any = await pool.query(`
      SELECT f.*, u.name as picName
      FROM follow_ups f
      LEFT JOIN users u ON u.id = f.picId
      WHERE f.tenantId = ? AND f.relatedProjectId = ?
      ORDER BY f.followUpDate DESC
    `, [targetTenant, id]);

    res.json({
      project,
      tasks: taskRows,
      visits: visitRows,
      followups: followupRows
    });
  } catch (err: any) {
    console.error(`GET /api/projects/${id}/summary error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/projects/:id/tasks - Tasks related to this project
projectsRoutes.get('/:id/tasks', async (req: any, res: any) => {
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
        t.id, t.tenantId, t.title, t.description,
        COALESCE(t.sourceType, 'MANUAL') as sourceType,
        COALESCE(ts.id, t.statusId) as statusId,
        COALESCE(ts.code, t.statusId) as statusCode,
        COALESCE(ts.name, t.statusId) as statusName,
        ts.color as statusColor,
        CASE 
          WHEN ts.id = 'TS-3' OR t.statusId IN ('COMPLETED', 'TSK_COMPLETED') THEN 'COMPLETED'
          WHEN ts.id = 'TS-2' OR t.statusId IN ('IN_PROGRESS', 'TSK_INPROGRESS') THEN 'IN_PROGRESS'
          WHEN ts.id = 'TS-4' OR t.statusId IN ('CANCELLED', 'TSK_CANCELLED') THEN 'CANCELLED'
          ELSE 'TODO'
        END as status,
        COALESCE(tp.id, t.priorityId) as priorityId,
        COALESCE(tp.code, t.priorityId) as priorityCode,
        COALESCE(tp.name, t.priorityId) as priorityName,
        tp.color as priorityColor,
        CASE
          WHEN tp.id = 'TP-1' OR t.priorityId IN ('URGENT', 'PRI_URGENT') THEN 'URGENT'
          WHEN tp.id = 'TP-2' OR t.priorityId IN ('HIGH', 'PRI_HIGH') THEN 'HIGH'
          WHEN tp.id = 'TP-4' OR t.priorityId IN ('LOW', 'PRI_LOW') THEN 'LOW'
          WHEN tp.id = 'TP-3' OR t.priorityId IN ('MEDIUM', 'PRI_MEDIUM', 'NORMAL') THEN 'MEDIUM'
          ELSE COALESCE(t.priorityId, 'MEDIUM')
        END as priority,
        t.picId,
        COALESCE(u.name, 'Unassigned') as picName,
        u.email as picEmail,
        u.avatar as picAvatar,
        t.customerId,
        c.name as customerName,
        t.relatedProjectId,
        t.relatedVisitId,
        v.title as visitTitle,
        DATE_FORMAT(v.visitDate, '%Y-%m-%d') as visitDate,
        DATE_FORMAT(t.dueDate, '%Y-%m-%d') as dueDate,
        t.taskType,
        t.createdAt,
        t.updatedAt,
        t.completedAt
      FROM tasks t
      LEFT JOIN task_statuses ts ON (
        ts.id = t.statusId 
        OR ts.code = t.statusId 
        OR ts.code = CONCAT('TSK_', t.statusId)
        OR (t.statusId = 'PENDING' AND ts.id = 'TS-1')
        OR (t.statusId = 'TODO' AND ts.id = 'TS-1')
        OR (t.statusId = 'IN_PROGRESS' AND ts.id = 'TS-2')
        OR (t.statusId = 'COMPLETED' AND ts.id = 'TS-3')
        OR (t.statusId = 'CANCELLED' AND ts.id = 'TS-4')
      )
      LEFT JOIN task_priorities tp ON (
        tp.id = t.priorityId
        OR tp.code = t.priorityId
        OR tp.code = CONCAT('PRI_', t.priorityId)
        OR (t.priorityId = 'URGENT' AND tp.id = 'TP-1')
        OR (t.priorityId = 'HIGH' AND tp.id = 'TP-2')
        OR (t.priorityId = 'NORMAL' AND tp.id = 'TP-3')
        OR (t.priorityId = 'MEDIUM' AND tp.id = 'TP-3')
        OR (t.priorityId = 'LOW' AND tp.id = 'TP-4')
      )
      LEFT JOIN users u ON u.id = t.picId
      LEFT JOIN customers c ON c.id = t.customerId
      LEFT JOIN visits v ON v.id = t.relatedVisitId
      WHERE t.tenantId = ? AND t.relatedProjectId = ?
      ORDER BY t.dueDate ASC, t.createdAt DESC
    `, [targetTenant, id]);

    res.json(rows);
  } catch (err: any) {
    console.error(`GET /api/projects/${id}/tasks error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/projects - Create project and synchronize PROJECT_ASSIGNMENT task
projectsRoutes.post('/', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const data = req.body || {};
  const { title, name, customerId, value, probability, expectedCloseDate, stageId, source, description } = data;

  const projectTitle = (title || name || '').trim();
  if (!projectTitle) {
    return res.status(400).json({ error: 'Project title is required', code: 'MISSING_PROJECT_TITLE' });
  }
  if (!customerId || !String(customerId).trim()) {
    return res.status(400).json({ error: 'Customer ID is required', code: 'MISSING_CUSTOMER_ID' });
  }

  // Validate customer belongs to targetTenant
  const [cRows]: any = await pool.query(
    'SELECT id, name FROM customers WHERE id = ? AND tenantId = ?',
    [String(customerId).trim(), targetTenant]
  );
  if (cRows.length === 0) {
    return res.status(400).json({ error: 'Customer not found or access denied', code: 'CUSTOMER_NOT_FOUND' });
  }
  const customer = cRows[0];

  // Validate PIC assignment belongs to targetTenant
  let resolvedPicId: string | null = null;
  const picCandidate = data.picId || actorUserId;
  if (picCandidate) {
    const [uRows]: any = await pool.query(`
      SELECT tu.userId, u.name
      FROM tenant_users tu
      JOIN users u ON u.id = tu.userId
      WHERE tu.tenantId = ? AND tu.userId = ? AND tu.status = 'ACTIVE' AND u.status = 'ACTIVE'
      LIMIT 1
    `, [targetTenant, picCandidate]);

    if (uRows.length === 0) {
      return res.status(400).json({ error: 'Invalid or cross-tenant Project PIC assigned', code: 'CROSS_TENANT_PIC_DENIED' });
    }
    resolvedPicId = uRows[0].userId;
  }

  const projectId = data.id && String(data.id).trim()
    ? String(data.id).trim()
    : 'PRJ-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');

  const valNum = Number(value) || 0;
  const probNum = Number(probability) || 20;
  const expClose = expectedCloseDate || null;
  const resolvedStage = stageId || 'PS-1';
  const descText = description ? String(description).trim() : null;
  const srcText = source ? String(source).trim() : 'Direct';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`
      INSERT INTO projects (
        id, tenantId, customerId, title, value, probability, expectedCloseDate, stageId, source, description, picId, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      projectId, targetTenant, customer.id, projectTitle, valNum, probNum, expClose, resolvedStage, srcText, descText, resolvedPicId
    ]);

    // Authoritatively synchronize PROJECT_ASSIGNMENT task
    await syncProjectAssignmentTasks(conn, projectId, targetTenant);

    await conn.commit();

    await logAudit(
      targetTenant,
      actorUserId,
      'PROJECT_CREATED',
      'Project',
      projectId,
      `Project '${projectTitle}' created for customer '${customer.name}'`,
      req.ip,
      req.get('User-Agent'),
      'CRM'
    );

    res.status(201).json({
      success: true,
      id: projectId,
      data: {
        id: projectId,
        tenantId: targetTenant,
        customerId: customer.id,
        title: projectTitle,
        value: valNum,
        probability: probNum,
        expectedCloseDate: expClose,
        stageId: resolvedStage,
        picId: resolvedPicId
      }
    });
  } catch (err: any) {
    await conn.rollback();
    console.error('POST /api/projects error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  } finally {
    conn.release();
  }
});

// PUT /api/projects/:id - Update project and synchronize PROJECT_ASSIGNMENT task
projectsRoutes.put('/:id', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;
  const data = req.body || {};

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing]: any = await conn.query('SELECT * FROM projects WHERE id = ? AND tenantId = ? FOR UPDATE', [id, targetTenant]);
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Project not found' });
    }
    const current = existing[0];

    let customerId = current.customerId;
    if (data.customerId) {
      const [cRows]: any = await conn.query(
        'SELECT id, name FROM customers WHERE id = ? AND tenantId = ?',
        [String(data.customerId).trim(), targetTenant]
      );
      if (cRows.length === 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'Customer not found or access denied', code: 'CUSTOMER_NOT_FOUND' });
      }
      customerId = cRows[0].id;
    }

    let picId = current.picId;
    if (data.picId !== undefined) {
      if (data.picId === null || data.picId === '') {
        picId = null;
      } else {
        const [uRows]: any = await conn.query(`
          SELECT tu.userId FROM tenant_users tu
          JOIN users u ON u.id = tu.userId
          WHERE tu.tenantId = ? AND tu.userId = ? AND tu.status = 'ACTIVE' AND u.status = 'ACTIVE'
          LIMIT 1
        `, [targetTenant, data.picId]);
        if (uRows.length === 0) {
          await conn.rollback();
          return res.status(400).json({ error: 'Invalid or cross-tenant Project PIC assigned', code: 'CROSS_TENANT_PIC_DENIED' });
        }
        picId = uRows[0].userId;
      }
    }

    const title = data.title !== undefined ? String(data.title).trim() : (data.name !== undefined ? String(data.name).trim() : current.title);
    const value = data.value !== undefined ? Number(data.value) : current.value;
    const probability = data.probability !== undefined ? Number(data.probability) : current.probability;
    const expectedCloseDate = data.expectedCloseDate !== undefined ? data.expectedCloseDate : current.expectedCloseDate;
    const stageId = data.stageId !== undefined ? data.stageId : current.stageId;
    const description = data.description !== undefined ? data.description : current.description;

    await conn.query(`
      UPDATE projects
      SET customerId = ?, title = ?, value = ?, probability = ?, expectedCloseDate = ?, stageId = ?, description = ?, picId = ?
      WHERE id = ? AND tenantId = ?
    `, [customerId, title, value, probability, expectedCloseDate, stageId, description, picId, id, targetTenant]);

    // Authoritatively synchronize PROJECT_ASSIGNMENT task
    await syncProjectAssignmentTasks(conn, id, targetTenant);

    await conn.commit();

    await logAudit(
      targetTenant,
      actorUserId,
      'PROJECT_UPDATED',
      'Project',
      id,
      `Project '${title}' updated successfully`,
      req.ip,
      req.get('User-Agent'),
      'CRM'
    );

    res.json({
      success: true,
      id,
      data: {
        id,
        tenantId: targetTenant,
        customerId,
        title,
        value,
        probability,
        expectedCloseDate,
        stageId,
        picId
      }
    });
  } catch (err: any) {
    await conn.rollback();
    console.error(`PUT /api/projects/${id} error:`, err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  } finally {
    conn.release();
  }
});

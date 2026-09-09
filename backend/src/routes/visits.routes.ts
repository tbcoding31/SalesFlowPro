import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { buildReportScopeWhere, validateTargetTenant } from '../utils/scope';
import { logAudit } from '../utils/audit';
import { syncVisitAssignmentTasks } from '../services/taskAssignment.service';

import { normalizeSemanticRole } from './navigation.routes';

export const visitsRoutes = Router();

// GET /api/visits - List visits with pagination, customerId, status, search, scope
visitsRoutes.get('/', async (req: any, res: any) => {
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
  const { customerId, picId, status, search, page, pageSize, startDate, endDate, scope } = req.query;

  // Scope Enforcement (All Visits vs My Visits)
  let where: string;
  let params: any[];

  if (scope === 'all') {
    // ONLY TENANT_ADMIN and SUPERVISOR (or SUPER_ADMIN) are permitted
    if (semanticRole !== 'TENANT_ADMIN' && semanticRole !== 'SUPERVISOR' && semanticRole !== 'SUPER_ADMIN') {
      return res.status(403).json({
        error: 'Access denied: All Visits scope is restricted to Tenant Admin and Supervisor',
        code: 'SCOPE_ACCESS_DENIED'
      });
    }
    // SPECIAL SUPERVISOR OVERRIDE: Tenant-wide visibility
    where = 'WHERE v.tenantId = ?';
    params = [targetTenant];
  } else if (scope === 'my') {
    // MY VISITS: Current user is picId OR additional participant
    where = `WHERE v.tenantId = ? AND (
      v.picId = ? 
      OR EXISTS (SELECT 1 FROM visit_participants vp WHERE vp.visitId = v.id AND vp.userId = ?)
    )`;
    params = [targetTenant, actorUserId, actorUserId];
  } else {
    // Contextual fallback:
    if (customerId) {
      const scoped = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'v.picId');
      where = scoped.where;
      params = scoped.params;
    } else {
      // Default fallback is 'my'
      where = `WHERE v.tenantId = ? AND (
        v.picId = ? 
        OR EXISTS (SELECT 1 FROM visit_participants vp WHERE vp.visitId = v.id AND vp.userId = ?)
      )`;
      params = [targetTenant, actorUserId, actorUserId];
    }
  }

  try {
    let extraWhere = '';
    const extraParams: any[] = [];

    if (customerId && customerId !== 'ALL') {
      extraWhere += ' AND v.customerId = ?';
      extraParams.push(customerId);
    }

    if (picId && picId !== 'ALL') {
      extraWhere += ' AND v.picId = ?';
      extraParams.push(picId);
    }

    if (status && status !== 'ALL') {
      extraWhere += ' AND (v.statusId = ? OR vs.code = ? OR vs.name = ?)';
      extraParams.push(status, status, status);
    }

    if (startDate) {
      extraWhere += ' AND v.visitDate >= ?';
      extraParams.push(startDate);
    }

    if (endDate) {
      extraWhere += ' AND v.visitDate <= ?';
      extraParams.push(endDate);
    }

    if (search && typeof search === 'string' && search.trim()) {
      extraWhere += ' AND (v.title LIKE ? OR v.location LIKE ? OR v.result LIKE ? OR p.title LIKE ?)';
      const s = `%${search.trim()}%`;
      extraParams.push(s, s, s, s);
    }

    const countSql = `
      SELECT COUNT(v.id) as total
      FROM visits v
      LEFT JOIN visit_statuses vs ON vs.id = v.statusId
      LEFT JOIN visit_purposes vp ON vp.id = v.purposeId
      LEFT JOIN projects p ON p.id = v.relatedProjectId AND p.tenantId = v.tenantId
      ${where.replace(/WHERE tenantId/g, 'WHERE v.tenantId')}
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
        v.id, v.tenantId, v.title, v.customerId, v.relatedProjectId, v.purposeId, v.statusId,
        DATE_FORMAT(v.visitDate, '%Y-%m-%d') as visitDate,
        TIME_FORMAT(v.startTime, '%H:%i') as startTime,
        TIME_FORMAT(v.endTime, '%H:%i') as endTime,
        v.location, v.notes, v.result, v.cancellationReason, v.nextAction, v.picId,
        v.createdAt, v.updatedAt, v.completedAt,
        vs.code as statusCode, vs.name as statusName,
        vs.code as status,
        vp.code as purposeCode, vp.name as purposeName,
        vp.name as purpose,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar,
        c.name as customerName, c.code as customerCode,
        p.title as projectTitle, p.title as projectName, p.id as projectCode,
        COALESCE(ps.id, p.stageId) as projectStatusId,
        COALESCE(ps.code, p.stageId) as projectStatusCode,
        COALESCE(ps.name, p.stageId) as projectStatusName
      FROM visits v
      LEFT JOIN visit_statuses vs ON vs.id = v.statusId
      LEFT JOIN visit_purposes vp ON vp.id = v.purposeId
      LEFT JOIN users u ON u.id = v.picId
      LEFT JOIN customers c ON c.id = v.customerId
      LEFT JOIN projects p ON p.id = v.relatedProjectId AND p.tenantId = v.tenantId
      LEFT JOIN project_stages ps ON ps.id = p.stageId
      ${where.replace(/WHERE tenantId/g, 'WHERE v.tenantId')}
      ${extraWhere}
      ORDER BY v.visitDate DESC, v.createdAt DESC
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
    console.error('GET /api/visits error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/visits/:id - Single visit detail
visitsRoutes.get('/:id', async (req: any, res: any) => {
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
        v.id, v.tenantId, v.title, v.customerId, v.relatedProjectId, v.purposeId, v.statusId,
        DATE_FORMAT(v.visitDate, '%Y-%m-%d') as visitDate,
        TIME_FORMAT(v.startTime, '%H:%i') as startTime,
        TIME_FORMAT(v.endTime, '%H:%i') as endTime,
        v.location, v.notes, v.result, v.cancellationReason, v.nextAction, v.picId,
        v.createdAt, v.updatedAt, v.completedAt,
        vs.code as statusCode, vs.name as statusName,
        vs.code as status,
        vp.code as purposeCode, vp.name as purposeName,
        vp.name as purpose,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar,
        c.name as customerName, c.code as customerCode,
        (SELECT address FROM customer_addresses ca WHERE ca.customerId = c.id ORDER BY ca.isPrimary DESC LIMIT 1) as customerAddress,
        p.title as projectTitle, p.title as projectName, p.id as projectCode,
        COALESCE(ps.id, p.stageId) as projectStatusId,
        COALESCE(ps.code, p.stageId) as projectStatusCode,
        COALESCE(ps.name, p.stageId) as projectStatusName
      FROM visits v
      LEFT JOIN visit_statuses vs ON vs.id = v.statusId
      LEFT JOIN visit_purposes vp ON vp.id = v.purposeId
      LEFT JOIN users u ON u.id = v.picId
      LEFT JOIN customers c ON c.id = v.customerId
      LEFT JOIN projects p ON p.id = v.relatedProjectId AND p.tenantId = v.tenantId
      LEFT JOIN project_stages ps ON ps.id = p.stageId
      WHERE v.id = ? AND v.tenantId = ?
    `, [id, targetTenant]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    const visit = rows[0];

    // Fetch participants if any
    const [parts]: any = await pool.query(`
      SELECT vp.*, u.name as userName, u.email as userEmail, u.avatar as userAvatar
      FROM visit_participants vp
      LEFT JOIN users u ON u.id = vp.userId
      WHERE vp.visitId = ?
    `, [id]);

    visit.participants = parts;

    res.json(visit);
  } catch (err: any) {
    console.error(`GET /api/visits/${id} error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/visits - Schedule a new visit securely
visitsRoutes.post('/', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  // Tenant is authoritatively derived from the session, never trusting client body
  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const hasPerm = actorRole === 'SUPER_ADMIN' ||
    actorRole === 'TENANT_ADMIN' ||
    actorRole === 'SALES_MANAGER' ||
    actorRole === 'SUPERVISOR' ||
    actorRole === 'SALES_REP' ||
    actorPermissions.includes('MANAGE_TASKS') ||
    actorPermissions.includes('MANAGE_OWN_TASKS') ||
    actorPermissions.includes('ALL');

  if (!hasPerm) {
    return res.status(403).json({ error: 'Access denied: Visit scheduling permission required' });
  }

  const data = req.body || {};
  const { customerId, visitDate, title, startTime, endTime, location, result, nextAction, notes, relatedProjectId, additionalPicIds } = data;

  // Validate required fields
  if (!customerId || !String(customerId).trim()) {
    return res.status(400).json({ error: 'Customer ID is required', code: 'MISSING_CUSTOMER_ID' });
  }
  if (!visitDate) {
    return res.status(400).json({ error: 'Visit date is required', code: 'MISSING_VISIT_DATE' });
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

  // Validate PIC assignment
  const picCandidate = data.picId || actorUserId;
  const [uRows]: any = await pool.query(`
    SELECT tu.userId, u.name
    FROM tenant_users tu
    JOIN users u ON u.id = tu.userId
    WHERE tu.tenantId = ? AND tu.userId = ? AND tu.status = 'ACTIVE' AND u.status = 'ACTIVE'
    LIMIT 1
  `, [targetTenant, picCandidate]);

  if (uRows.length === 0) {
    return res.status(400).json({ error: 'Invalid or unauthorized PIC assigned', code: 'CROSS_TENANT_PIC_DENIED' });
  }
  const resolvedPicId = uRows[0].userId;

  // Role constraint: SALES_REP can only schedule for themselves
  if (actorRole === 'SALES_REP' && resolvedPicId !== actorUserId && !actorPermissions.includes('MANAGE_TASKS') && !actorPermissions.includes('ALL')) {
    return res.status(403).json({ error: 'Sales Rep can only schedule visits for themselves', code: 'DELEGATION_DENIED' });
  }

  // Validate optional project
  let resolvedProjectId: string | null = null;
  const projCandidate = relatedProjectId !== undefined ? relatedProjectId : data.projectId;
  if (projCandidate !== undefined && projCandidate !== null && String(projCandidate).trim() !== '' && String(projCandidate).trim().toLowerCase() !== 'null') {
    const pId = String(projCandidate).trim();
    // Validate project existence and active open stage
    const [pAllRows]: any = await pool.query(
      `SELECT p.id, p.tenantId, p.customerId, p.stageId, ps.lifecycleCategory, ps.isActive
       FROM projects p
       LEFT JOIN project_stages ps ON ps.id = p.stageId
       WHERE p.id = ?`,
      [pId]
    );
    if (pAllRows.length === 0) {
      return res.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' });
    }
    const candidateProj = pAllRows[0];
    if (candidateProj.tenantId !== targetTenant) {
      return res.status(403).json({ error: 'Cross-tenant project assignment denied', code: 'PROJECT_TENANT_MISMATCH' });
    }
    if (candidateProj.customerId !== customer.id) {
      return res.status(400).json({ error: 'Project does not belong to the selected customer', code: 'PROJECT_CUSTOMER_MISMATCH' });
    }
    // Fail-closed check: project must be assigned to an active OPEN stage
    if (!candidateProj.stageId || !candidateProj.isActive || candidateProj.lifecycleCategory !== 'OPEN') {
      return res.status(400).json({ error: 'Completed, lost, inactive, or unassigned project cannot be assigned to a new visit', code: 'PROJECT_NOT_ACTIVE' });
    }
    resolvedProjectId = candidateProj.id;
  }

  // Resolve statusId
  let resolvedStatusId = 'VS-1';
  const statusCandidate = data.statusId || data.status;
  if (statusCandidate) {
    const sVal = String(statusCandidate).trim();
    const [sRows]: any = await pool.query(
      'SELECT id FROM visit_statuses WHERE id = ? OR code = ? OR name = ? LIMIT 1',
      [sVal, sVal, sVal]
    );
    if (sRows.length > 0) resolvedStatusId = sRows[0].id;
  }

  // Resolve purposeId
  let resolvedPurposeId: string | null = null;
  const purposeCandidate = data.purposeId || data.purpose;
  if (purposeCandidate) {
    const pVal = String(purposeCandidate).trim();
    const [pRows]: any = await pool.query(
      'SELECT id FROM visit_purposes WHERE id = ? OR code = ? OR name = ? LIMIT 1',
      [pVal, pVal, pVal]
    );
    if (pRows.length > 0) resolvedPurposeId = pRows[0].id;
  }
  if (!resolvedPurposeId) {
    resolvedPurposeId = 'VP-1';
  }

  const visitId = 'VIS-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
  const visitTitle = (title && String(title).trim()) ? String(title).trim() : `Client Visit - ${customer.name}`;
  const loc = location ? String(location).trim() : null;
  const resText = result ? String(result).trim() : null;
  const notesText = notes ? String(notes).trim() : null;
  const nextAct = nextAction ? String(nextAction).trim() : null;
  const sTime = startTime ? String(startTime).trim() : null;
  const eTime = endTime ? String(endTime).trim() : null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`
      INSERT INTO visits (
        id, tenantId, title, customerId, relatedProjectId, purposeId, statusId,
        visitDate, startTime, endTime, location, notes, result, nextAction, picId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      visitId, targetTenant, visitTitle, customer.id, resolvedProjectId, resolvedPurposeId, resolvedStatusId,
      visitDate, sTime, eTime, loc, notesText, resText, nextAct, resolvedPicId
    ]);

    if (Array.isArray(additionalPicIds) && additionalPicIds.length > 0) {
      for (const pUserId of additionalPicIds) {
        if (pUserId && pUserId !== resolvedPicId) {
          const partId = 'VPART-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
          await conn.query(`
            INSERT INTO visit_participants (id, visitId, userId, role)
            VALUES (?, ?, ?, 'PARTICIPANT')
          `, [partId, visitId, pUserId]);
        }
      }
    }
    await syncVisitAssignmentTasks(conn, visitId, targetTenant);

    await conn.commit();

    await logAudit(
      targetTenant,
      actorUserId,
      'VISIT_CREATED',
      'Visit',
      visitId,
      `Visit '${visitTitle}' scheduled for customer '${customer.name}'`,
      req.ip,
      req.get('User-Agent'),
      'CRM'
    );

    res.status(201).json({
      success: true,
      id: visitId,
      message: 'Visit scheduled successfully',
      statusCode: 'PLANNED',
      statusName: 'Planned',
      visitDate,
      startTime: sTime,
      endTime: eTime,
      title: visitTitle,
      location: loc,
      data: {
        id: visitId,
        tenantId: targetTenant,
        title: visitTitle,
        customerId: customer.id,
        customerName: customer.name,
        picId: resolvedPicId,
        visitDate,
        startTime: sTime,
        endTime: eTime,
        location: loc,
        relatedProjectId: resolvedProjectId,
        statusId: resolvedStatusId,
        statusCode: 'PLANNED',
        statusName: 'Planned'
      }
    });
  } catch (err: any) {
    await conn.rollback();
    console.error('POST /api/visits error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    conn.release();
  }
});

// PUT /api/visits/:id - Update visit
visitsRoutes.put('/:id', async (req: any, res: any) => {
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
    const [existing]: any = await pool.query('SELECT * FROM visits WHERE id = ? AND tenantId = ?', [id, targetTenant]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    const current = existing[0];

    // Status transition enforcement:
    // 1. COMPLETED visits cannot be mutated
    if (current.statusId === 'VS-2') {
      return res.status(400).json({ error: 'Completed visits cannot be modified' });
    }

    // 2. CANCELLED visits cannot be modified via standard PUT (must use /reschedule)
    if (current.statusId === 'VS-3') {
      return res.status(400).json({ error: 'Cancelled visits cannot be edited. Use /reschedule to reactivate this visit.' });
    }

    const title = data.title !== undefined ? String(data.title).trim() : current.title;
    const visitDate = data.visitDate !== undefined ? data.visitDate : current.visitDate;
    const startTime = data.startTime !== undefined ? data.startTime : current.startTime;
    const endTime = data.endTime !== undefined ? data.endTime : current.endTime;
    const location = data.location !== undefined ? data.location : current.location;
    const notes = data.notes !== undefined ? data.notes : current.notes;
    const result = data.result !== undefined ? data.result : current.result;
    const nextAction = data.nextAction !== undefined ? data.nextAction : current.nextAction;

    let customerId = current.customerId;
    if (data.customerId) {
      const [cRows]: any = await pool.query(
        'SELECT id, name FROM customers WHERE id = ? AND tenantId = ?',
        [String(data.customerId).trim(), targetTenant]
      );
      if (cRows.length > 0) {
        customerId = cRows[0].id;
      }
    }

    let resolvedProjectId = current.relatedProjectId;
    if ('relatedProjectId' in data || 'projectId' in data) {
      const projCandidate = data.relatedProjectId !== undefined ? data.relatedProjectId : data.projectId;
      if (projCandidate === null || projCandidate === '' || String(projCandidate).trim().toLowerCase() === 'null') {
        resolvedProjectId = null;
      } else {
        const pId = String(projCandidate).trim();
        const [pAllRows]: any = await pool.query(
          `SELECT p.id, p.tenantId, p.customerId, p.stageId, ps.lifecycleCategory, ps.isActive
           FROM projects p
           LEFT JOIN project_stages ps ON ps.id = p.stageId
           WHERE p.id = ?`,
          [pId]
        );
        if (pAllRows.length === 0) {
          return res.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' });
        }
        const candidateProj = pAllRows[0];
        if (candidateProj.tenantId !== targetTenant) {
          return res.status(403).json({ error: 'Cross-tenant project assignment denied', code: 'PROJECT_TENANT_MISMATCH' });
        }
        if (candidateProj.customerId !== customerId) {
          return res.status(400).json({ error: 'Project does not belong to the selected customer', code: 'PROJECT_CUSTOMER_MISMATCH' });
        }
        // If changing to a DIFFERENT project than the current historical link, enforce active open stage
        if (pId !== current.relatedProjectId) {
          if (!candidateProj.stageId || !candidateProj.isActive || candidateProj.lifecycleCategory !== 'OPEN') {
            return res.status(400).json({ error: 'Completed, lost, inactive, or unassigned project cannot be newly assigned to a visit', code: 'PROJECT_NOT_ACTIVE' });
          }
        }
        resolvedProjectId = candidateProj.id;
      }
    } else if (data.customerId && customerId !== current.customerId) {
      // Customer changed and no project specified: clear project
      resolvedProjectId = null;
    }

    let statusId = current.statusId;
    if (data.statusId || data.status) {
      const sVal = String(data.statusId || data.status).trim();
      const [sRows]: any = await pool.query('SELECT id FROM visit_statuses WHERE id = ? OR code = ? OR name = ? LIMIT 1', [sVal, sVal, sVal]);
      if (sRows.length > 0) {
        const candidateStatusId = sRows[0].id;
        // Do not allow setting CANCELLED via PUT (must use /cancel)
        if (candidateStatusId === 'VS-3' && current.statusId !== 'VS-3') {
          return res.status(400).json({ error: 'To cancel a visit, please use POST /api/visits/:id/cancel' });
        }
        statusId = candidateStatusId;
      }
    }

    let purposeId = current.purposeId;
    if (data.purposeId || data.purpose) {
      const pVal = String(data.purposeId || data.purpose).trim();
      const [pRows]: any = await pool.query('SELECT id FROM visit_purposes WHERE id = ? OR code = ? OR name = ? LIMIT 1', [pVal, pVal, pVal]);
      if (pRows.length > 0) purposeId = pRows[0].id;
    }

    let picId = current.picId;
    if (data.picId) {
      const [uRows]: any = await pool.query(`
        SELECT tu.userId FROM tenant_users tu
        JOIN users u ON u.id = tu.userId
        WHERE tu.tenantId = ? AND tu.userId = ? AND tu.status = 'ACTIVE' AND u.status = 'ACTIVE'
        LIMIT 1
      `, [targetTenant, data.picId]);
      if (uRows.length > 0) picId = uRows[0].userId;
    }

    const completedAtVal = (statusId === 'VS-2' && !current.completedAt) ? new Date() : current.completedAt;

    await pool.query(`
      UPDATE visits
      SET customerId = ?, relatedProjectId = ?, title = ?, visitDate = ?, startTime = ?, endTime = ?, location = ?, notes = ?, result = ?, nextAction = ?, statusId = ?, purposeId = ?, picId = ?, completedAt = ?, updatedAt = NOW()
      WHERE id = ? AND tenantId = ?
    `, [customerId, resolvedProjectId, title, visitDate, startTime, endTime, location, notes, result, nextAction, statusId, purposeId, picId, completedAtVal, id, targetTenant]);

    if (Array.isArray(data.additionalPicIds)) {
      await pool.query('DELETE FROM visit_participants WHERE visitId = ?', [id]);
      for (const pUserId of data.additionalPicIds) {
        if (pUserId && pUserId !== picId) {
          const partId = 'VPART-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
          await pool.query(`
            INSERT INTO visit_participants (id, visitId, userId, role)
            VALUES (?, ?, ?, 'PARTICIPANT')
          `, [partId, id, pUserId]);
        }
      }
    }
    await syncVisitAssignmentTasks(pool, id, targetTenant);

    await logAudit(
      targetTenant,
      actorUserId,
      'VISIT_UPDATED',
      'Visit',
      id,
      `Visit '${title}' updated successfully`,
      req.ip,
      req.get('User-Agent'),
      'CRM'
    );

    res.json({
      success: true,
      id,
      customerId,
      relatedProjectId: resolvedProjectId,
      title,
      location,
      visitDate,
      startTime,
      endTime,
      notes,
      result,
      nextAction,
      purposeId,
      picId,
      statusId
    });
  } catch (err: any) {
    console.error(`PUT /api/visits/${id} error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/visits/:id/cancel - Business cancellation of a visit (never physical delete)
visitsRoutes.post('/:id/cancel', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;
  const reasonText = (req.body && (req.body.reason || req.body.cancellationReason)) || null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows]: any = await conn.query('SELECT * FROM visits WHERE id = ? AND tenantId = ? FOR UPDATE', [id, targetTenant]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Visit not found' });
    }
    const current = rows[0];

    // Transition invariants:
    // 1. Cannot cancel already cancelled visit -> 409 Conflict
    if (current.statusId === 'VS-3') {
      await conn.rollback();
      return res.status(409).json({ error: 'Visit is already cancelled' });
    }

    // 2. Cannot cancel completed visit -> 400 Bad Request
    if (current.statusId === 'VS-2') {
      await conn.rollback();
      return res.status(400).json({ error: 'Completed visits cannot be cancelled' });
    }

    const cancelReasonText = reasonText ? String(reasonText).trim() : null;

    await conn.query(`
      UPDATE visits
      SET statusId = 'VS-3', cancellationReason = ?, updatedAt = NOW()
      WHERE id = ? AND tenantId = ?
    `, [cancelReasonText, id, targetTenant]);

    await logAudit(
      targetTenant,
      actorUserId,
      'VISIT_CANCELLED',
      'Visit',
      id,
      cancelReasonText ? `Visit '${current.title}' cancelled. Reason: ${cancelReasonText}` : `Visit '${current.title}' cancelled.`,
      req.ip,
      req.get('User-Agent'),
      'CRM'
    );

    await syncVisitAssignmentTasks(conn, id, targetTenant);

    await conn.commit();

    res.json({
      success: true,
      id,
      message: 'Visit cancelled successfully',
      statusId: 'VS-3',
      statusCode: 'CANCELLED',
      statusName: 'Cancelled',
      cancellationReason: cancelReasonText
    });
  } catch (err: any) {
    await conn.rollback();
    console.error(`POST /api/visits/${id}/cancel error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    conn.release();
  }
});

// POST /api/visits/:id/reschedule - Reschedule a visit (event-driven, resets cancelled to planned)
visitsRoutes.post('/:id/reschedule', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;
  const { visitDate, startTime, endTime, reason } = req.body || {};

  if (!visitDate) {
    return res.status(400).json({ error: 'New visit date is required', code: 'MISSING_VISIT_DATE' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows]: any = await conn.query(`
      SELECT 
        v.*,
        DATE_FORMAT(v.visitDate, '%Y-%m-%d') as formattedVisitDate
      FROM visits v
      WHERE v.id = ? AND v.tenantId = ?
      FOR UPDATE
    `, [id, targetTenant]);

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Visit not found' });
    }
    const current = rows[0];

    // Transition invariant: Completed visits cannot be rescheduled
    if (current.statusId === 'VS-2') {
      await conn.rollback();
      return res.status(400).json({ error: 'Completed visits cannot be rescheduled' });
    }

    const oldDate = current.formattedVisitDate;
    const oldStart = current.startTime ? String(current.startTime).substring(0, 5) : '';
    const oldEnd = current.endTime ? String(current.endTime).substring(0, 5) : '';

    const newStart = startTime ? String(startTime).trim() : current.startTime;
    const newEnd = endTime ? String(endTime).trim() : current.endTime;
    const rescheduleReasonText = reason ? String(reason).trim() : null;

    // Rescheduling sets statusId = 'VS-1' (PLANNED) and clears cancellationReason
    await conn.query(`
      UPDATE visits
      SET visitDate = ?, startTime = ?, endTime = ?, statusId = 'VS-1', cancellationReason = NULL, updatedAt = NOW()
      WHERE id = ? AND tenantId = ?
    `, [visitDate, newStart, newEnd, id, targetTenant]);

    const auditDesc = `Rescheduled from ${oldDate} (${oldStart}-${oldEnd}) to ${visitDate} (${newStart ? newStart.substring(0, 5) : ''}-${newEnd ? newEnd.substring(0, 5) : ''}). Reason: ${rescheduleReasonText || 'N/A'}`;

    await logAudit(
      targetTenant,
      actorUserId,
      'VISIT_RESCHEDULED',
      'Visit',
      id,
      auditDesc,
      req.ip,
      req.get('User-Agent'),
      'CRM'
    );

    await syncVisitAssignmentTasks(conn, id, targetTenant);

    await conn.commit();

    res.json({
      success: true,
      id,
      message: 'Visit rescheduled successfully',
      statusId: 'VS-1',
      statusCode: 'PLANNED',
      statusName: 'Planned',
      visitDate,
      startTime: newStart,
      endTime: newEnd
    });
  } catch (err: any) {
    await conn.rollback();
    console.error(`POST /api/visits/${id}/reschedule error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    conn.release();
  }
});

// GET /api/visits/:id/history - Activity history from authoritative audit_logs
visitsRoutes.get('/:id/history', async (req: any, res: any) => {
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
        a.id, a.action, a.description, a.timestamp, a.userId,
        u.name as userName, u.email as userEmail, u.avatar as userAvatar
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.userId
      WHERE a.tenantId = ? AND a.entity = 'Visit' AND a.entityId = ?
      ORDER BY a.timestamp DESC
    `, [targetTenant, id]);

    res.json(rows);
  } catch (err: any) {
    console.error(`GET /api/visits/${id}/history error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/visits/:id/tasks - Related tasks
visitsRoutes.get('/:id/tasks', async (req: any, res: any) => {
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
      WHERE t.tenantId = ? AND t.relatedVisitId = ?
      ORDER BY t.dueDate ASC, t.createdAt DESC
    `, [targetTenant, id]);

    res.json(rows);
  } catch (err: any) {
    console.error(`GET /api/visits/${id}/tasks error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/visits/:id/followups - Related follow-ups
visitsRoutes.get('/:id/followups', async (req: any, res: any) => {
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
        f.*,
        ft.name as typeName
      FROM follow_ups f
      LEFT JOIN follow_up_types ft ON ft.id = f.typeId
      WHERE f.tenantId = ? AND f.relatedVisitId = ?
      ORDER BY f.followUpDate ASC, f.createdAt DESC
    `, [targetTenant, id]);

    res.json(rows);
  } catch (err: any) {
    console.error(`GET /api/visits/${id}/followups error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/visits/:id - Delete visit (Administrative removal only, not business cancellation)
visitsRoutes.delete('/:id', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;

  try {
    const [existing]: any = await pool.query('SELECT * FROM visits WHERE id = ? AND tenantId = ?', [id, targetTenant]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    await pool.query('DELETE FROM visit_participants WHERE visitId = ?', [id]);
    await pool.query('DELETE FROM visits WHERE id = ? AND tenantId = ?', [id, targetTenant]);

    await logAudit(
      targetTenant,
      actorUserId,
      'VISIT_DELETED',
      'Visit',
      id,
      `Visit '${existing[0].title}' deleted`,
      req.ip,
      req.get('User-Agent'),
      'CRM'
    );

    res.json({ success: true, message: 'Visit deleted successfully' });
  } catch (err: any) {
    console.error(`DELETE /api/visits/${id} error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


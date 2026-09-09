import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { buildReportScopeWhere, validateTargetTenant } from '../utils/scope';
import { logAudit } from '../utils/audit';
import { syncProjectAssignmentTasks } from '../services/taskAssignment.service';

export const projectsRoutes = Router();

// GET /api/projects - List projects with role/tenant scoping (Canonical { data, pagination } shape)
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
    const { customerId, picId, stageId, search, statusScope, status } = req.query;

    if (customerId && customerId !== 'ALL') {
      extraWhere += ' AND p.customerId = ?';
      extraParams.push(customerId);
    }
    if (picId && picId !== 'ALL') {
      extraWhere += ' AND p.picId = ?';
      extraParams.push(picId);
    }
    if (stageId && stageId !== 'ALL') {
      if (stageId === '_UNASSIGNED' || stageId === 'NULL') {
        extraWhere += ' AND p.stageId IS NULL';
      } else {
        extraWhere += ' AND (p.stageId = ? OR ps.code = ?)';
        extraParams.push(stageId, stageId);
      }
    }
    if (statusScope === 'active' || status === 'active') {
      extraWhere += ` AND p.stageId IS NOT NULL AND ps.isActive = 1 AND ps.isTerminal = 0`;
    }
    if (search && typeof search === 'string' && search.trim()) {
      extraWhere += ' AND (p.title LIKE ? OR p.description LIKE ?)';
      const s = `%${search.trim()}%`;
      extraParams.push(s, s);
    }

    const pNum = parseInt(req.query.page as string, 10);
    const pSize = parseInt(req.query.pageSize as string, 10);
    const hasExplicitPagination = !isNaN(pNum) && !isNaN(pSize) && pNum > 0 && pSize > 0;
    const page = hasExplicitPagination ? pNum : 1;
    const pageSize = hasExplicitPagination ? pSize : 100;

    // Count total items
    const countSql = `
      SELECT COUNT(*) as total
      FROM projects p
      LEFT JOIN project_stages ps ON ps.id = p.stageId
      ${where.replace(/WHERE tenantId/g, 'WHERE p.tenantId')}
      ${extraWhere}
    `;
    const [countRows]: any = await pool.query(countSql, [...params, ...extraParams]);
    const totalItems = countRows[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const offset = (page - 1) * pageSize;

    const selectSql = `
      SELECT 
        p.*,
        p.title as name,
        p.value as estimatedValue,
        COALESCE(ps.code, p.stageId) as stage,
        c.name as customerName, c.code as customerCode,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar,
        ps.name as stageName, ps.code as stageCode,
        ps.phase as stagePhase,
        ps.commercialOutcome as stageCommercialOutcome,
        ps.isActive as stageIsActive,
        ps.isTerminal as stageIsTerminal,
        ps.allowVisits as stageAllowVisits,
        ps.allowNewProject as stageAllowNewProject,
        COALESCE(p.probability, ps.probability, 0) as effectiveProbability
      FROM projects p
      LEFT JOIN customers c ON c.id = p.customerId
      LEFT JOIN users u ON u.id = p.picId
      LEFT JOIN project_stages ps ON ps.id = p.stageId
      ${where.replace(/WHERE tenantId/g, 'WHERE p.tenantId')}
      ${extraWhere}
      ORDER BY p.createdAt DESC
      LIMIT ? OFFSET ?
    `;

    const [rows]: any = await pool.query(selectSql, [...params, ...extraParams, pageSize, offset]);

    res.json({
      data: rows,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages
      }
    });
  } catch (err: any) {
    console.error('GET /api/projects error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/projects/pipeline - Pipeline Kanban grouping & KPI aggregates
projectsRoutes.get('/pipeline', async (req: any, res: any) => {
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
    const [stageRows]: any = await pool.query(`
      SELECT id, code, name, displayOrder, probability, phase, commercialOutcome, isActive, isTerminal, allowVisits, allowNewProject
      FROM project_stages
      WHERE isActive = 1 OR id IN (SELECT DISTINCT stageId FROM projects WHERE tenantId = ? AND stageId IS NOT NULL)
      ORDER BY displayOrder ASC, id ASC
    `, [targetTenant]);

    const selectSql = `
      SELECT 
        p.*,
        p.title as name,
        p.value as estimatedValue,
        COALESCE(ps.code, p.stageId) as stage,
        c.name as customerName, c.code as customerCode,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar,
        ps.name as stageName, ps.code as stageCode,
        ps.phase as stagePhase,
        ps.commercialOutcome as stageCommercialOutcome,
        ps.isActive as stageIsActive,
        ps.isTerminal as stageIsTerminal,
        ps.allowVisits as stageAllowVisits,
        ps.allowNewProject as stageAllowNewProject,
        COALESCE(p.probability, ps.probability, 0) as effectiveProbability
      FROM projects p
      LEFT JOIN customers c ON c.id = p.customerId
      LEFT JOIN users u ON u.id = p.picId
      LEFT JOIN project_stages ps ON ps.id = p.stageId
      ${where.replace(/WHERE tenantId/g, 'WHERE p.tenantId')}
      ORDER BY p.createdAt DESC
    `;

    const [rows]: any = await pool.query(selectSql, params);

    const aggregates: Record<string, { count: number; value: number; stageId?: string; code?: string; name?: string }> = {};

    stageRows.forEach((s: any) => {
      aggregates[s.id] = { count: 0, value: 0, stageId: s.id, code: s.code, name: s.name };
      aggregates[s.code] = aggregates[s.id];
    });

    let totalPipeline = 0;
    let weightedPipeline = 0;
    let totalWon = 0;
    let totalLost = 0;
    let unassignedProjectCount = 0;
    let unassignedProjectValue = 0;

    const stageMap = new Map();
    stageRows.forEach((s: any) => {
      stageMap.set(s.id, s);
      stageMap.set(s.code, s);
    });

    rows.forEach((p: any) => {
      const val = Number(p.value) || 0;
      const prob = Number(p.effectiveProbability) || 0;
      const stageKey = p.stageId;

      // Historical Won single authority: p.commercialWonAt IS NOT NULL
      if (p.commercialWonAt) {
        totalWon += val;
      }

      if (!stageKey || !stageMap.has(stageKey)) {
        unassignedProjectCount++;
        unassignedProjectValue += val;
        return;
      }

      const st = stageMap.get(stageKey);
      const agg = aggregates[st.id];
      if (agg) {
        agg.count++;
        agg.value += val;
      }

      // Open Sales Pipeline: phase = 'SALES' AND commercialOutcome = 'NONE' AND isTerminal = 0
      if (st.phase === 'SALES' && st.commercialOutcome === 'NONE' && st.isTerminal === 0) {
        totalPipeline += val;
        weightedPipeline += (val * prob) / 100;
      } else if (st.commercialOutcome === 'LOST') {
        totalLost += val;
      }
    });

    res.json({
      success: true,
      stages: stageRows,
      data: rows,
      aggregates,
      summary: {
        totalPipeline,
        totalPipelineValue: totalPipeline,
        weightedPipeline,
        totalWon,
        totalLost,
        totalProjects: rows.length,
        unassignedProjectCount,
        unassignedProjectValue
      }
    });
  } catch (err: any) {
    console.error('GET /api/projects/pipeline error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/projects/:id/stage - Transition project commercial stage
projectsRoutes.patch('/:id/stage', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;
  const targetStage = req.body?.stageId || req.body?.stage;
  const { lossReason, cancellationReason, reopenReason, notes } = req.body || {};

  if (!targetStage) {
    return res.status(400).json({ error: 'Stage ID is required', code: 'MISSING_STAGE_ID' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [pRows]: any = await conn.query(`
      SELECT p.*, ps.phase as fromPhase, ps.commercialOutcome as fromOutcome, ps.isTerminal as fromIsTerminal, ps.name as fromStageName
      FROM projects p
      LEFT JOIN project_stages ps ON ps.id = p.stageId
      WHERE p.id = ? AND p.tenantId = ? FOR UPDATE
    `, [id, targetTenant]);

    if (pRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Project not found' });
    }
    const currentProject = pRows[0];

    // Strictly validate and resolve target stage against MySQL project_stages
    const [sRows]: any = await conn.query(
      'SELECT id, code, name, phase, commercialOutcome, isActive, isTerminal, probability FROM project_stages WHERE id = ? OR code = ? LIMIT 1',
      [targetStage, targetStage]
    );

    if (sRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: `Invalid project stage: ${targetStage}`, code: 'INVALID_STAGE' });
    }

    if (!sRows[0].isActive) {
      await conn.rollback();
      return res.status(400).json({ error: 'Target stage is inactive and cannot accept project transitions', code: 'INACTIVE_STAGE' });
    }

    const resolvedStageId = sRows[0].id;
    const resolvedStageCode = sRows[0].code;
    const resolvedStageName = sRows[0].name;
    const targetOutcome = sRows[0].commercialOutcome;
    const targetIsTerminal = sRows[0].isTerminal === 1;
    const fromIsTerminal = currentProject.fromIsTerminal === 1;

    // MANDATORY EXECUTION GATE 2: LOST IS PRE-WIN COMMERCIAL FAILURE ONLY
    if (targetOutcome === 'LOST') {
      if (currentProject.commercialWonAt !== null) {
        await conn.rollback();
        return res.status(400).json({
          error: 'A project that has already been commercially won cannot be marked as LOST. Use CANCELLED instead.',
          code: 'PROJECT_ALREADY_WON_CANNOT_BE_LOST'
        });
      }
      if (currentProject.fromPhase && currentProject.fromPhase !== 'SALES') {
        await conn.rollback();
        return res.status(400).json({
          error: 'LOST stage is only applicable to projects within the pre-win SALES lifecycle.',
          code: 'PROJECT_ALREADY_WON_CANNOT_BE_LOST'
        });
      }
      if (!lossReason || !String(lossReason).trim()) {
        await conn.rollback();
        return res.status(400).json({
          error: 'A business loss reason is mandatory to mark a project as LOST.',
          code: 'LOSS_REASON_REQUIRED'
        });
      }
    }

    // Cancellation Reason Check
    if (targetOutcome === 'CANCELLED') {
      const cReason = cancellationReason || lossReason || notes;
      if (!cReason || !String(cReason).trim()) {
        await conn.rollback();
        return res.status(400).json({
          error: 'A cancellation reason is mandatory to cancel a project.',
          code: 'CANCELLATION_REASON_REQUIRED'
        });
      }
    }

    // Reopen Check: from terminal to non-terminal
    const isReopen = fromIsTerminal && !targetIsTerminal;
    if (isReopen) {
      if (!reopenReason || !String(reopenReason).trim()) {
        await conn.rollback();
        return res.status(400).json({
          error: 'An explicit business reason is required to reopen a project from a terminal stage.',
          code: 'REOPEN_REASON_REQUIRED'
        });
      }
    }

    // Atomic Commercial Won Milestone Recognition: stamp NOW() only if commercialWonAt is NULL
    if (targetOutcome === 'WON' && !currentProject.commercialWonAt) {
      await conn.query(
        'UPDATE projects SET stageId = ?, commercialWonAt = NOW() WHERE id = ? AND tenantId = ?',
        [resolvedStageId, id, targetTenant]
      );
    } else {
      await conn.query(
        'UPDATE projects SET stageId = ? WHERE id = ? AND tenantId = ?',
        [resolvedStageId, id, targetTenant]
      );
    }

    // Record stage transition history
    const historyId = 'PSH-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
    const stageNotes = lossReason 
      ? `Loss Reason: ${lossReason}${notes ? ' | ' + notes : ''}`
      : (cancellationReason ? `Cancellation Reason: ${cancellationReason}${notes ? ' | ' + notes : ''}` 
        : (reopenReason ? `Reopen Reason: ${reopenReason}${notes ? ' | ' + notes : ''}` : (notes || null)));

    await conn.query(`
      INSERT INTO project_stage_histories (id, projectId, fromStageId, toStageId, changedById, changedAt, notes)
      VALUES (?, ?, ?, ?, ?, NOW(), ?)
    `, [historyId, id, currentProject.stageId, resolvedStageId, actorUserId, stageNotes]);

    await conn.commit();

    await logAudit(
      targetTenant,
      actorUserId,
      'PROJECT_STAGE_CHANGED',
      'Project',
      id,
      `Project '${currentProject.title}' transitioned to stage '${resolvedStageName}' (${resolvedStageCode})`,
      req.ip,
      req.get('User-Agent'),
      'CRM'
    );

    res.json({
      success: true,
      id,
      stageId: resolvedStageId,
      stageCode: resolvedStageCode,
      stageName: resolvedStageName,
      currentStage: resolvedStageCode
    });
  } catch (err: any) {
    await conn.rollback();
    console.error(`PATCH /api/projects/${id}/stage error:`, err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  } finally {
    conn.release();
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
        p.title as name,
        p.value as estimatedValue,
        COALESCE(ps.code, p.stageId) as stage,
        c.name as customerName, c.code as customerCode,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar,
        ps.name as stageName, ps.code as stageCode,
        ps.phase as stagePhase,
        ps.commercialOutcome as stageCommercialOutcome,
        ps.isActive as stageIsActive,
        ps.isTerminal as stageIsTerminal,
        ps.allowVisits as stageAllowVisits,
        ps.allowNewProject as stageAllowNewProject,
        COALESCE(p.probability, ps.probability, 0) as effectiveProbability
      FROM projects p
      LEFT JOIN customers c ON c.id = p.customerId
      LEFT JOIN users u ON u.id = p.picId
      LEFT JOIN project_stages ps ON ps.id = p.stageId
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

// GET /api/projects/:id/timeline - Chronological activity and transition history
projectsRoutes.get('/:id/timeline', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;

  try {
    // 1. Establish project existence and tenant authority
    const [projRows]: any = await pool.query(
      'SELECT id, title, createdAt FROM projects WHERE id = ? AND tenantId = ?',
      [id, targetTenant]
    );

    if (projRows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const events: any[] = [];

    // 2. Stage transitions from project_stage_histories (canonical source)
    const [stageHistories]: any = await pool.query(`
      SELECT 
        psh.id, psh.projectId, psh.fromStageId, psh.toStageId, psh.changedById, psh.changedAt, psh.notes,
        psFrom.name as fromStageName, psFrom.code as fromStageCode,
        psTo.name as toStageName, psTo.code as toStageCode,
        u.name as userName, u.email as userEmail, u.avatar as userAvatar
      FROM project_stage_histories psh
      LEFT JOIN project_stages psFrom ON (psFrom.id = psh.fromStageId OR psFrom.code = psh.fromStageId)
      LEFT JOIN project_stages psTo ON (psTo.id = psh.toStageId OR psTo.code = psh.toStageId)
      LEFT JOIN users u ON u.id = psh.changedById
      WHERE psh.projectId = ?
    `, [id]);

    for (const h of stageHistories) {
      const toLabel = h.toStageName || h.toStageCode || h.toStageId;
      const fromLabel = h.fromStageName || h.fromStageCode || h.fromStageId || 'Initial';
      events.push({
        id: `STAGE_HISTORY:${h.id}`,
        stableEventKey: `STAGE_HISTORY:${h.id}`,
        eventType: 'PROJECT_STAGE_CHANGED',
        type: 'PROJECT',
        title: `Stage changed to ${toLabel}`,
        subject: `Stage changed to ${toLabel}`,
        description: h.notes || `Transitioned from ${fromLabel} to ${toLabel}`,
        details: h.notes || `Transitioned from ${fromLabel} to ${toLabel}`,
        occurredAt: h.changedAt,
        eventTimestamp: h.changedAt,
        userId: h.changedById,
        userName: h.userName || 'System',
        userAvatar: h.userAvatar,
        metadata: {
          fromStageId: h.fromStageId,
          toStageId: h.toStageId,
          fromStageName: h.fromStageName,
          toStageName: h.toStageName,
          notes: h.notes
        }
      });
    }

    // 3. Audit logs (excluding duplicate PROJECT_STAGE_CHANGED)
    const [auditRows]: any = await pool.query(`
      SELECT 
        a.id, a.action, a.entity, a.entityId, a.description, a.timestamp, a.userId,
        u.name as userName, u.email as userEmail, u.avatar as userAvatar
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.userId
      WHERE a.tenantId = ? AND a.entity = 'Project' AND a.entityId = ? AND a.action != 'PROJECT_STAGE_CHANGED'
    `, [targetTenant, id]);

    for (const a of auditRows) {
      events.push({
        id: `AUDIT:${a.id}`,
        stableEventKey: `AUDIT:${a.id}`,
        eventType: a.action,
        type: 'AUDIT',
        title: a.description || a.action,
        subject: a.description || a.action,
        description: a.description || a.action,
        details: a.description || a.action,
        occurredAt: a.timestamp,
        eventTimestamp: a.timestamp,
        userId: a.userId,
        userName: a.userName || 'System',
        userAvatar: a.userAvatar
      });
    }

    // 4. Tasks (Created & Completed events)
    const [taskRows]: any = await pool.query(`
      SELECT 
        t.id, t.title, t.description, t.createdAt, t.completedAt, t.picId,
        u.name as picName, u.avatar as picAvatar
      FROM tasks t
      LEFT JOIN users u ON u.id = t.picId
      WHERE t.tenantId = ? AND t.relatedProjectId = ?
    `, [targetTenant, id]);

    for (const t of taskRows) {
      if (t.createdAt) {
        events.push({
          id: `TASK:${t.id}:CREATED`,
          stableEventKey: `TASK:${t.id}:CREATED`,
          eventType: 'TASK_CREATED',
          type: 'TASK',
          title: `Task created: ${t.title}`,
          subject: `Task: ${t.title}`,
          description: t.description || 'Task scheduled for assignment',
          details: t.description,
          occurredAt: t.createdAt,
          eventTimestamp: t.createdAt,
          userId: t.picId,
          userName: t.picName || 'System',
          userAvatar: t.picAvatar
        });
      }
      if (t.completedAt) {
        events.push({
          id: `TASK:${t.id}:COMPLETED`,
          stableEventKey: `TASK:${t.id}:COMPLETED`,
          eventType: 'TASK_COMPLETED',
          type: 'TASK',
          title: `Task completed: ${t.title}`,
          subject: `Task completed: ${t.title}`,
          description: t.description || 'Task marked as completed',
          details: t.description,
          occurredAt: t.completedAt,
          eventTimestamp: t.completedAt,
          userId: t.picId,
          userName: t.picName || 'System',
          userAvatar: t.picAvatar
        });
      }
    }

    // 5. Visits (Scheduled & Completed events)
    const [visitRows]: any = await pool.query(`
      SELECT 
        v.id, v.title, v.visitDate, v.startTime, v.createdAt, v.completedAt, v.picId,
        u.name as picName, u.avatar as picAvatar
      FROM visits v
      LEFT JOIN users u ON u.id = v.picId
      WHERE v.tenantId = ? AND v.relatedProjectId = ?
    `, [targetTenant, id]);

    for (const v of visitRows) {
      const visitOccurred = v.createdAt || v.visitDate;
      events.push({
        id: `VISIT:${v.id}:SCHEDULED`,
        stableEventKey: `VISIT:${v.id}:SCHEDULED`,
        eventType: 'VISIT_SCHEDULED',
        type: 'VISIT',
        title: `Visit scheduled: ${v.title}`,
        subject: `Visit: ${v.title}`,
        description: `Visit scheduled for ${v.visitDate ? new Date(v.visitDate).toISOString().split('T')[0] : 'undated'} ${v.startTime || ''}`.trim(),
        details: v.title,
        occurredAt: visitOccurred,
        eventTimestamp: visitOccurred,
        userId: v.picId,
        userName: v.picName || 'System',
        userAvatar: v.picAvatar
      });

      if (v.completedAt) {
        events.push({
          id: `VISIT:${v.id}:COMPLETED`,
          stableEventKey: `VISIT:${v.id}:COMPLETED`,
          eventType: 'VISIT_COMPLETED',
          type: 'VISIT',
          title: `Visit completed: ${v.title}`,
          subject: `Visit completed: ${v.title}`,
          description: 'Visit completed',
          details: v.title,
          occurredAt: v.completedAt,
          eventTimestamp: v.completedAt,
          userId: v.picId,
          userName: v.picName || 'System',
          userAvatar: v.picAvatar
        });
      }
    }

    // 6. Follow-ups (Created & Completed events)
    const [followUpRows]: any = await pool.query(`
      SELECT 
        f.id, f.title, f.notes, f.createdAt, f.completedAt, f.picId,
        u.name as picName, u.avatar as picAvatar
      FROM follow_ups f
      LEFT JOIN users u ON u.id = f.picId
      WHERE f.tenantId = ? AND f.relatedProjectId = ?
    `, [targetTenant, id]);

    for (const f of followUpRows) {
      if (f.createdAt) {
        events.push({
          id: `FOLLOWUP:${f.id}:CREATED`,
          stableEventKey: `FOLLOWUP:${f.id}:CREATED`,
          eventType: 'FOLLOW_UP_CREATED',
          type: 'FOLLOW_UP',
          title: `Follow-up created: ${f.title}`,
          subject: `Follow-up: ${f.title}`,
          description: f.notes || 'Follow-up created',
          details: f.notes,
          occurredAt: f.createdAt,
          eventTimestamp: f.createdAt,
          userId: f.picId,
          userName: f.picName || 'System',
          userAvatar: f.picAvatar
        });
      }
      if (f.completedAt) {
        events.push({
          id: `FOLLOWUP:${f.id}:COMPLETED`,
          stableEventKey: `FOLLOWUP:${f.id}:COMPLETED`,
          eventType: 'FOLLOW_UP_COMPLETED',
          type: 'FOLLOW_UP',
          title: `Follow-up completed: ${f.title}`,
          subject: `Follow-up completed: ${f.title}`,
          description: f.notes || 'Follow-up marked as completed',
          details: f.notes,
          occurredAt: f.completedAt,
          eventTimestamp: f.completedAt,
          userId: f.picId,
          userName: f.picName || 'System',
          userAvatar: f.picAvatar
        });
      }
    }

    // 7. Activities (Direct project comments / notes)
    const [activityRows]: any = await pool.query(`
      SELECT 
        a.id, a.typeId, a.subject, a.description, a.occurredAt, a.userId,
        u.name as userName, u.avatar as userAvatar
      FROM activities a
      LEFT JOIN users u ON u.id = a.userId
      WHERE a.tenantId = ? AND a.entityType = 'PROJECT' AND a.entityId = ?
    `, [targetTenant, id]);

    for (const a of activityRows) {
      events.push({
        id: `ACTIVITY:${a.id}`,
        stableEventKey: `ACTIVITY:${a.id}`,
        eventType: a.typeId || 'NOTE',
        type: a.typeId === 'NOTE' ? 'NOTE' : 'ACTIVITY',
        title: a.subject || 'Activity Note',
        subject: a.subject || 'Activity Note',
        description: a.description || '',
        details: a.description,
        occurredAt: a.occurredAt,
        eventTimestamp: a.occurredAt,
        userId: a.userId,
        userName: a.userName || 'System',
        userAvatar: a.userAvatar
      });
    }

    // Deduplication check: stableEventKey map
    const dedupMap = new Map<string, any>();
    for (const evt of events) {
      if (!dedupMap.has(evt.stableEventKey)) {
        dedupMap.set(evt.stableEventKey, evt);
      }
    }
    const uniqueEvents = Array.from(dedupMap.values());

    // Deterministic Sort: eventTimestamp DESC, stableEventKey ASC
    uniqueEvents.sort((a, b) => {
      const timeA = new Date(a.eventTimestamp || a.occurredAt || 0).getTime();
      const timeB = new Date(b.eventTimestamp || b.occurredAt || 0).getTime();
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return String(a.stableEventKey).localeCompare(String(b.stableEventKey));
    });

    // Paginate
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize as string) || 25));
    const totalItems = uniqueEvents.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const paginatedData = uniqueEvents.slice(startIndex, startIndex + pageSize);

    res.json({
      data: paginatedData,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
  } catch (err: any) {
    console.error(`GET /api/projects/${id}/timeline error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/projects/:id/next-action - Determine authoritative next scheduled action
projectsRoutes.get('/:id/next-action', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;

  try {
    // 1. Establish project existence and tenant authority
    const [projRows]: any = await pool.query(
      'SELECT id FROM projects WHERE id = ? AND tenantId = ?',
      [id, targetTenant]
    );

    if (projRows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const candidates: any[] = [];

    // 2. Unfinished Tasks candidate
    const [taskRows]: any = await pool.query(`
      SELECT 
        t.id, t.title, DATE_FORMAT(t.dueDate, '%Y-%m-%d') as actionDate,
        'TASK' as type, u.name as picName, t.picId,
        COALESCE(ts.name, 'Pending') as statusName
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
      LEFT JOIN users u ON u.id = t.picId
      WHERE t.tenantId = ? 
        AND t.relatedProjectId = ? 
        AND t.completedAt IS NULL
        AND COALESCE(ts.code, t.statusId) NOT IN ('TSK_COMPLETED', 'TSK_CANCELLED', 'COMPLETED', 'CANCELLED')
        AND t.dueDate IS NOT NULL
        AND t.dueDate >= CURDATE()
      ORDER BY t.dueDate ASC, t.createdAt ASC
      LIMIT 1
    `, [targetTenant, id]);

    if (taskRows.length > 0) {
      candidates.push({
        id: taskRows[0].id,
        title: taskRows[0].title,
        type: 'TASK',
        actionDate: taskRows[0].actionDate,
        actionAt: taskRows[0].actionDate,
        picName: taskRows[0].picName || 'Unassigned',
        statusName: taskRows[0].statusName
      });
    }

    // 3. Upcoming Visits candidate
    const [visitRows]: any = await pool.query(`
      SELECT 
        v.id, v.title, DATE_FORMAT(v.visitDate, '%Y-%m-%d') as actionDate,
        v.startTime, 'VISIT' as type, u.name as picName, v.picId,
        COALESCE(vs.name, 'Planned') as statusName
      FROM visits v
      LEFT JOIN visit_statuses vs ON (vs.id = v.statusId OR vs.code = v.statusId)
      LEFT JOIN users u ON u.id = v.picId
      WHERE v.tenantId = ? 
        AND v.relatedProjectId = ? 
        AND v.completedAt IS NULL
        AND COALESCE(vs.code, v.statusId) NOT IN ('COMPLETED', 'CANCELLED', 'VS-2', 'VS-3')
        AND v.visitDate IS NOT NULL
        AND v.visitDate >= CURDATE()
      ORDER BY v.visitDate ASC, v.startTime ASC, v.createdAt ASC
      LIMIT 1
    `, [targetTenant, id]);

    if (visitRows.length > 0) {
      const timeStr = visitRows[0].startTime ? ` ${visitRows[0].startTime.substring(0, 5)}` : '';
      candidates.push({
        id: visitRows[0].id,
        title: visitRows[0].title,
        type: 'VISIT',
        actionDate: visitRows[0].actionDate,
        actionAt: `${visitRows[0].actionDate}${timeStr}`,
        picName: visitRows[0].picName || 'Unassigned',
        statusName: visitRows[0].statusName
      });
    }

    // 4. Pending Follow-ups candidate
    const [followUpRows]: any = await pool.query(`
      SELECT 
        f.id, f.title, DATE_FORMAT(f.followUpDate, '%Y-%m-%d') as actionDate,
        'FOLLOW_UP' as type, u.name as picName, f.picId,
        'Pending' as statusName
      FROM follow_ups f
      LEFT JOIN users u ON u.id = f.picId
      WHERE f.tenantId = ? 
        AND f.relatedProjectId = ? 
        AND f.completedAt IS NULL
        AND (f.status = 'PENDING' OR f.status IS NULL)
        AND f.followUpDate IS NOT NULL
        AND DATE(f.followUpDate) >= CURDATE()
      ORDER BY f.followUpDate ASC, f.createdAt ASC
      LIMIT 1
    `, [targetTenant, id]);

    if (followUpRows.length > 0) {
      candidates.push({
        id: followUpRows[0].id,
        title: followUpRows[0].title,
        type: 'FOLLOW_UP',
        actionDate: followUpRows[0].actionDate,
        actionAt: followUpRows[0].actionDate,
        picName: followUpRows[0].picName || 'Unassigned',
        statusName: followUpRows[0].statusName
      });
    }

    if (candidates.length === 0) {
      return res.json({ nextAction: null });
    }

    // Sort: Earliest actionDate ASC. Tie-breaker: TASK (1) > VISIT (2) > FOLLOW_UP (3)
    const priorityMap: Record<string, number> = { TASK: 1, VISIT: 2, FOLLOW_UP: 3 };
    candidates.sort((a, b) => {
      const dateDiff = a.actionDate.localeCompare(b.actionDate);
      if (dateDiff !== 0) return dateDiff;
      return (priorityMap[a.type] || 99) - (priorityMap[b.type] || 99);
    });

    return res.json({ nextAction: candidates[0] });
  } catch (err: any) {
    console.error(`GET /api/projects/${id}/next-action error:`, err);
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
        p.title as name,
        p.value as estimatedValue,
        COALESCE(ps.code, p.stageId) as stage,
        c.name as customerName, c.code as customerCode,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar,
        ps.name as stageName, ps.code as stageCode,
        ps.phase as stagePhase,
        ps.commercialOutcome as stageCommercialOutcome,
        ps.isActive as stageIsActive,
        ps.isTerminal as stageIsTerminal,
        ps.allowVisits as stageAllowVisits,
        ps.allowNewProject as stageAllowNewProject,
        COALESCE(p.probability, ps.probability, 0) as effectiveProbability
      FROM projects p
      LEFT JOIN customers c ON c.id = p.customerId
      LEFT JOIN users u ON u.id = p.picId
      LEFT JOIN project_stages ps ON ps.id = p.stageId
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
  let resolvedStage: string | null = null;
  let probNum: number = probability !== undefined && probability !== null && probability !== '' ? Number(probability) : 20;

  if (stageId) {
    const [sRows]: any = await pool.query(
      'SELECT id, code, name, isActive, isTerminal, allowNewProject, probability FROM project_stages WHERE id = ? OR code = ? LIMIT 1',
      [stageId, stageId]
    );
    if (sRows.length === 0) {
      return res.status(400).json({ error: `Invalid project stage: ${stageId}`, code: 'INVALID_STAGE' });
    }
    if (!sRows[0].isActive || sRows[0].isTerminal === 1 || sRows[0].allowNewProject === 0) {
      return res.status(400).json({
        error: 'Cannot create a project directly in an inactive, terminal, or restricted stage',
        code: 'INVALID_INITIAL_STAGE'
      });
    }
    resolvedStage = sRows[0].id;
    if (probability === undefined || probability === null || probability === '') {
      probNum = sRows[0].probability ?? 20;
    }
  } else {
    // Default to first active non-terminal stage ordered by displayOrder
    const [sRows]: any = await pool.query(
      'SELECT id, probability FROM project_stages WHERE isActive = 1 AND isTerminal = 0 AND allowNewProject = 1 ORDER BY displayOrder ASC, id ASC LIMIT 1'
    );
    if (sRows.length > 0) {
      resolvedStage = sRows[0].id;
      if (probability === undefined || probability === null || probability === '') {
        probNum = sRows[0].probability ?? 20;
      }
    }
  }

  const expClose = expectedCloseDate || null;
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

  // Strict Stage Lifecycle Boundary: generic PUT must not mutate stageId
  if (data.stageId !== undefined) {
    return res.status(400).json({
      error: 'Project stage cannot be updated via generic edit. Use PATCH /api/projects/:id/stage instead.',
      code: 'PROJECT_STAGE_REQUIRES_DEDICATED_COMMAND'
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing]: any = await conn.query(`
      SELECT p.*, ps.isTerminal, ps.name as stageName
      FROM projects p
      LEFT JOIN project_stages ps ON ps.id = p.stageId
      WHERE p.id = ? AND p.tenantId = ?
      FOR UPDATE
    `, [id, targetTenant]);
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Project not found' });
    }
    const current = existing[0];

    // Generic Edit Lock: Terminal projects cannot be updated via generic PUT
    if (current.isTerminal === 1) {
      await conn.rollback();
      return res.status(400).json({
        error: `Project is in a terminal stage ('${current.stageName || current.stageId}') and cannot be modified. Reopen the project first to edit.`,
        code: 'PROJECT_TERMINAL_LOCKED'
      });
    }

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
    const description = data.description !== undefined ? data.description : current.description;

    await conn.query(`
      UPDATE projects
      SET customerId = ?, title = ?, value = ?, probability = ?, expectedCloseDate = ?, description = ?, picId = ?
      WHERE id = ? AND tenantId = ?
    `, [customerId, title, value, probability, expectedCloseDate, description, picId, id, targetTenant]);

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
        stageId: current.stageId,
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

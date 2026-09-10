import { Router } from 'express';
import { pool } from '../db';
import { buildReportScopeWhere, validateTargetTenant } from '../utils/scope';
import { getBusinessDate } from '../utils/date';

export const salesRoutes = Router();

salesRoutes.get('/agenda', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
    if (targetTenant === false) return;

  try {
    const todayStr = (req.query.date as string) || getBusinessDate(new Date())!;
    const upcomingDays = parseInt((req.query.upcomingDays as string) || '7', 10);
    const upcomingEnd = getBusinessDate(new Date(Date.parse(todayStr) + (upcomingDays * 86400000)))!;

    const { where: taskWhere, params: taskParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 't.picId');
    const { where: visitWhere, params: visitParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'v.picId');
    const { where: fuWhere, params: fuParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'f.picId');

    // 1. Fetch Authorized Tasks
    const [taskRows]: any = await pool.query(`
      SELECT 
        t.id, t.title, t.description, t.customerId, t.relatedProjectId, t.relatedVisitId,
        t.priorityId as priority, t.statusId as status, t.dueDate, t.picId, t.completedAt,
        ts.code as statusCode, ts.isTerminal as statusIsTerminal,
        c.name as customerName, c.code as customerCode,
        p.title as projectName, p.stageId as projectStage,
        u.name as picName, u.avatar as picAvatar
      FROM tasks t
      LEFT JOIN task_statuses ts ON ts.id = t.statusId AND ts.tenantId = t.tenantId
      LEFT JOIN customers c ON c.id = t.customerId AND c.tenantId = t.tenantId
      LEFT JOIN projects p ON p.id = t.relatedProjectId AND p.tenantId = t.tenantId
      LEFT JOIN users u ON u.id = t.picId
      ${taskWhere.replace(/WHERE tenantId/g, 'WHERE t.tenantId')}
    `, taskParams);

    // 2. Fetch Authorized Visits
    const [visitRows]: any = await pool.query(`
      SELECT 
        v.id, v.title, v.customerId, v.relatedProjectId, v.purposeId as purpose,
        v.statusId as status, v.visitDate, v.startTime, v.endTime, v.location,
        v.result, v.nextAction, v.picId, v.completedAt,
        vs.code as statusCode, vs.isTerminal as statusIsTerminal,
        c.name as customerName, c.code as customerCode,
        p.title as projectName, p.stageId as projectStage,
        u.name as picName, u.avatar as picAvatar
      FROM visits v
      LEFT JOIN visit_statuses vs ON vs.id = v.statusId AND vs.tenantId = v.tenantId
      LEFT JOIN customers c ON c.id = v.customerId AND c.tenantId = v.tenantId
      LEFT JOIN projects p ON p.id = v.relatedProjectId AND p.tenantId = v.tenantId
      LEFT JOIN users u ON u.id = v.picId
      ${visitWhere.replace(/WHERE tenantId/g, 'WHERE v.tenantId')}
    `, visitParams);

    // 3. Fetch Authorized Follow-ups
    const [fuRows]: any = await pool.query(`
      SELECT 
        f.id, f.title, f.customerId, f.typeId, f.relatedVisitId, f.relatedProjectId,
        f.picId, f.followUpDate, f.priorityId as priority, f.notes, f.outcome,
        f.status, f.completedAt,
        c.name as customerName, c.code as customerCode,
        p.title as projectName, p.stageId as projectStage,
        u.name as picName, u.avatar as picAvatar
      FROM follow_ups f
      LEFT JOIN customers c ON c.id = f.customerId
      LEFT JOIN projects p ON p.id = f.relatedProjectId
      LEFT JOIN users u ON u.id = f.picId
      ${fuWhere.replace(/WHERE tenantId/g, 'WHERE f.tenantId')}
    `, fuParams);

    // Helper to format Date or Date-string reliably to 'YYYY-MM-DD' in Asia/Jakarta
    const toLocalDateStr = (val: any) => getBusinessDate(val);

    // 4. Normalized Aggregation
    const overdue: any[] = [];
    const today: any[] = [];
    const upcoming: any[] = [];
    const completedToday: any[] = [];

    // Process Tasks
    taskRows.forEach((t: any) => {
      const isCompleted = t.statusCode === 'COMPLETED' || t.statusCode === 'TSK_COMPLETED' || (t.statusIsTerminal === 1 && t.statusCode !== 'CANCELLED' && t.statusCode !== 'TSK_CANCELLED');
      const isCancelled = t.statusCode === 'CANCELLED' || t.statusCode === 'TSK_CANCELLED';
      const isTerminal = isCompleted || isCancelled || t.statusIsTerminal === 1;
      const actionDate = toLocalDateStr(t.dueDate);
      const completedDate = toLocalDateStr(t.completedAt);

      const item = {
        id: t.id,
        type: 'TASK',
        title: t.title,
        description: t.description,
        customerId: t.customerId,
        customerName: t.customerName,
        customerCode: t.customerCode,
        projectId: t.relatedProjectId,
        projectName: t.projectName,
        projectStage: t.projectStage,
        actionAt: actionDate,
        priority: t.priority || 'MEDIUM',
        status: t.status,
        picId: t.picId,
        picName: t.picName,
        sourceEntity: 'tasks',
        sourceId: t.id
      };

      if (isCompleted) {
        if (completedDate === todayStr) {
          completedToday.push(item);
        }
      } else if (!isTerminal && actionDate) {
        if (actionDate < todayStr) {
          overdue.push(item);
        } else if (actionDate === todayStr) {
          today.push(item);
        } else if (actionDate > todayStr && actionDate <= upcomingEnd) {
          upcoming.push(item);
        }
      }
    });

    // Process Visits
    visitRows.forEach((v: any) => {
      const isCompleted = v.statusCode === 'COMPLETED' || (v.statusIsTerminal === 1 && v.statusCode !== 'CANCELLED');
      const isCancelled = v.statusCode === 'CANCELLED';
      const isTerminal = isCompleted || isCancelled || v.statusIsTerminal === 1;
      const actionDate = toLocalDateStr(v.visitDate);
      const completedDate = toLocalDateStr(v.completedAt);

      const item = {
        id: v.id,
        type: 'VISIT',
        title: v.title,
        description: `${v.purpose ? 'Purpose: ' + v.purpose : ''}${v.location ? ' | Location: ' + v.location : ''}`,
        customerId: v.customerId,
        customerName: v.customerName,
        customerCode: v.customerCode,
        projectId: v.relatedProjectId,
        projectName: v.projectName,
        projectStage: v.projectStage,
        actionAt: actionDate,
        startTime: v.startTime,
        endTime: v.endTime,
        priority: null,
        status: v.status,
        result: v.result,
        nextAction: v.nextAction,
        picId: v.picId,
        picName: v.picName,
        sourceEntity: 'visits',
        sourceId: v.id
      };

      if (isCompleted) {
        if (completedDate === todayStr) {
          completedToday.push(item);
        }
      } else if (!isTerminal && actionDate) {
        if (actionDate < todayStr) {
          overdue.push(item);
        } else if (actionDate === todayStr) {
          today.push(item);
        } else if (actionDate > todayStr && actionDate <= upcomingEnd) {
          upcoming.push(item);
        }
      }
    });

    // Process Follow-ups
    fuRows.forEach((f: any) => {
      const isCompleted = f.status === 'COMPLETED';
      const isCancelled = f.status === 'CANCELLED';
      const isTerminal = isCompleted || isCancelled;
      const actionDate = toLocalDateStr(f.followUpDate);
      const completedDate = toLocalDateStr(f.completedAt);

      const item = {
        id: f.id,
        type: 'FOLLOW_UP',
        title: f.title,
        description: f.notes || f.outcome || '',
        customerId: f.customerId,
        customerName: f.customerName,
        customerCode: f.customerCode,
        projectId: f.relatedProjectId,
        projectName: f.projectName,
        projectStage: f.projectStage,
        actionAt: actionDate,
        priority: f.priority || 'NORMAL',
        status: f.status,
        outcome: f.outcome,
        picId: f.picId,
        picName: f.picName,
        sourceEntity: 'follow_ups',
        sourceId: f.id
      };

      if (isCompleted) {
        if (completedDate === todayStr) {
          completedToday.push(item);
        }
      } else if (!isTerminal && actionDate) {
        if (actionDate < todayStr) {
          overdue.push(item);
        } else if (actionDate === todayStr) {
          today.push(item);
        } else if (actionDate > todayStr && actionDate <= upcomingEnd) {
          upcoming.push(item);
        }
      }
    });

    // Tie-break sorting:
    // 1. actionAt ASC (earliest first)
    // 2. priority (HIGH -> URGENT -> NORMAL -> LOW -> null)
    // 3. type (VISIT -> FOLLOW_UP -> TASK)
    const priorityWeight: Record<string, number> = { 'URGENT': 1, 'HIGH': 2, 'NORMAL': 3, 'MEDIUM': 3, 'LOW': 4 };
    const typeWeight: Record<string, number> = { 'VISIT': 1, 'FOLLOW_UP': 2, 'TASK': 3 };

    const sortAgenda = (a: any, b: any) => {
      const dateA = a.actionAt || '9999-99-99';
      const dateB = b.actionAt || '9999-99-99';
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      const pA = priorityWeight[a.priority] || 5;
      const pB = priorityWeight[b.priority] || 5;
      if (pA !== pB) return pA - pB;

      const tA = typeWeight[a.type] || 5;
      const tB = typeWeight[b.type] || 5;
      return tA - tB;
    };

    overdue.sort(sortAgenda);
    today.sort(sortAgenda);
    upcoming.sort(sortAgenda);
    completedToday.sort((a, b) => (b.actionAt || '').localeCompare(a.actionAt || ''));

    // 5. Compute Needs Attention / Stalled Projects (Open projects with 0 pending actions)
    const { where: projWhere, params: projParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'p.picId');
    const [openProjects]: any = await pool.query(`
      SELECT p.id, p.title, p.stageId, p.value, p.customerId, c.name as customerName, u.name as picName
      FROM projects p
      LEFT JOIN customers c ON c.id = p.customerId AND c.tenantId = p.tenantId
      LEFT JOIN users u ON u.id = p.picId
      LEFT JOIN project_stages ps ON ps.id = p.stageId AND ps.tenantId = p.tenantId
      ${projWhere.replace(/WHERE tenantId/g, 'WHERE p.tenantId')}
      AND (COALESCE(ps.commercialOutcome, 'NONE') NOT IN ('WON', 'LOST', 'CANCELLED') AND COALESCE(ps.isTerminal, 0) = 0)
    `, projParams);

    const pendingProjectIds = new Set([
      ...overdue.filter(i => i.projectId).map(i => i.projectId),
      ...today.filter(i => i.projectId).map(i => i.projectId),
      ...upcoming.filter(i => i.projectId).map(i => i.projectId)
    ]);

    const stalledProjects = openProjects.filter((p: any) => !pendingProjectIds.has(p.id)).map((p: any) => ({
      id: p.id,
      title: p.title,
      stage: p.stageId,
      value: parseFloat(p.value || 0),
      customerId: p.customerId,
      customerName: p.customerName,
      picName: p.picName,
      reason: 'No scheduled Task, Visit, or Follow-up'
    }));

    res.json({
      date: todayStr,
      metrics: {
        overdueCount: overdue.length,
        todayCount: today.length,
        upcomingCount: upcoming.length,
        completedTodayCount: completedToday.length,
        stalledProjectsCount: stalledProjects.length
      },
      overdue,
      today,
      upcoming,
      completedToday,
      stalledProjects
    });
  } catch (err: any) {
    console.error('Error GET /api/sales/agenda:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});


salesRoutes.get('/attention', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;
  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
    if (targetTenant === false) return;
    const todayStr = req.query.date ? String(req.query.date).trim() : getBusinessDate(new Date())!;
    const evaluatedAt = new Date().toISOString();

    // 1. Scoped query for authorized Projects
    const { where: projWhere, params: projParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'p.picId');
    const [projRows]: any = await pool.query(`
      SELECT p.*, c.name as customerName, c.code as customerCode, u.name as picName,
             ps.code as stageCode, ps.commercialOutcome as stageCommercialOutcome, ps.isTerminal as stageIsTerminal
      FROM projects p
      LEFT JOIN project_stages ps ON ps.id = p.stageId AND ps.tenantId = p.tenantId
      LEFT JOIN customers c ON c.id = p.customerId
      LEFT JOIN users u ON u.id = p.picId
      ${projWhere.replace(/WHERE tenantId/g, 'WHERE p.tenantId')}
      ORDER BY p.createdAt DESC
    `, projParams);

    // 2. Scoped query for authorized Customers
    const { where: custWhere, params: custParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'c.picId');
    const [custRows]: any = await pool.query(`
      SELECT c.*, cs.code as statusCode, u.name as picName
      FROM customers c
      LEFT JOIN customer_statuses cs ON cs.id = c.statusId AND cs.tenantId = c.tenantId
      LEFT JOIN users u ON u.id = c.picId
      ${custWhere.replace(/WHERE tenantId/g, 'WHERE c.picId')}
      ORDER BY c.name ASC
    `, custParams);

    // 3. Batch query for unique authorized Overdue Operational Actions (Union to prevent double-counting)
    const { where: taskWhere, params: taskParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 't.picId');
    const { where: visitWhere, params: visitParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'v.picId');
    const { where: fuWhere, params: fuParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'f.picId');

    const [overdueOpsRows]: any = await pool.query(`
      SELECT 'TASK' as opType, t.id, t.customerId, t.relatedProjectId as projectId, t.dueDate as actionDate, t.picId
      FROM tasks t
      LEFT JOIN task_statuses ts ON ts.id = t.statusId AND ts.tenantId = t.tenantId
      ${taskWhere.replace(/WHERE tenantId/g, 'WHERE t.tenantId')}
      AND COALESCE(ts.isTerminal, 0) = 0
      AND (ts.code NOT IN ('COMPLETED', 'CANCELLED', 'TSK_COMPLETED', 'TSK_CANCELLED') OR ts.code IS NULL)
      AND t.dueDate < ?
      UNION ALL
      SELECT 'VISIT' as opType, v.id, v.customerId, v.relatedProjectId as projectId, v.visitDate as actionDate, v.picId
      FROM visits v
      LEFT JOIN visit_statuses vs ON vs.id = v.statusId AND vs.tenantId = v.tenantId
      ${visitWhere.replace(/WHERE tenantId/g, 'WHERE v.tenantId')}
      AND COALESCE(vs.isTerminal, 0) = 0
      AND (vs.code NOT IN ('COMPLETED', 'CANCELLED') OR vs.code IS NULL)
      AND v.visitDate < ?
      UNION ALL
      SELECT 'FOLLOW_UP' as opType, f.id, f.customerId, f.relatedProjectId as projectId, f.followUpDate as actionDate, f.picId
      FROM follow_ups f
      ${fuWhere.replace(/WHERE tenantId/g, 'WHERE f.tenantId')}
      AND f.status NOT IN ('COMPLETED', 'CANCELLED')
      AND f.followUpDate < ?
    `, [...taskParams, todayStr, ...visitParams, todayStr, ...fuParams, todayStr]);

    const uniqueOverdueActionCount = overdueOpsRows.length;

    // Group overdue items by projectId and customerId in memory
    const overdueByProject: Record<string, any[]> = {};
    const overdueByCustomer: Record<string, any[]> = {};
    for (const op of overdueOpsRows) {
      if (op.projectId) {
        if (!overdueByProject[op.projectId]) overdueByProject[op.projectId] = [];
        overdueByProject[op.projectId].push(op);
      }
      if (op.customerId) {
        if (!overdueByCustomer[op.customerId]) overdueByCustomer[op.customerId] = [];
        overdueByCustomer[op.customerId].push(op);
      }
    }

    // 4. Batch query for all open operational actions (for Missing Next Action detection)
    const [openOpsRows]: any = await pool.query(`
      SELECT t.relatedProjectId as projectId 
      FROM tasks t
      LEFT JOIN task_statuses ts ON ts.id = t.statusId AND ts.tenantId = t.tenantId
      WHERE t.tenantId = ? 
        AND COALESCE(ts.isTerminal, 0) = 0
        AND (ts.code NOT IN ('COMPLETED', 'CANCELLED', 'TSK_COMPLETED', 'TSK_CANCELLED') OR ts.code IS NULL)
        AND t.relatedProjectId IS NOT NULL
      UNION ALL
      SELECT v.relatedProjectId as projectId 
      FROM visits v
      LEFT JOIN visit_statuses vs ON vs.id = v.statusId AND vs.tenantId = v.tenantId
      WHERE v.tenantId = ? 
        AND COALESCE(vs.isTerminal, 0) = 0
        AND (vs.code NOT IN ('COMPLETED', 'CANCELLED') OR vs.code IS NULL)
        AND v.relatedProjectId IS NOT NULL
      UNION ALL
      SELECT relatedProjectId as projectId FROM follow_ups WHERE tenantId = ? AND status NOT IN ('COMPLETED', 'CANCELLED') AND relatedProjectId IS NOT NULL
    `, [targetTenant, targetTenant, targetTenant]);

    const projectsWithOpenActions = new Set(openOpsRows.map((r: any) => r.projectId));

    // 5. Batch query for active maintenance cadences in tenant
    const [cadencesRows]: any = await pool.query(`
      SELECT * FROM maintenance_cadences WHERE tenantId = ? AND status = 'ACTIVE'
    `, [targetTenant]);

    const cadencesByProject: Record<string, any[]> = {};
    const cadencesByCustomer: Record<string, any[]> = {};
    for (const cad of cadencesRows) {
      if (cad.projectId) {
        if (!cadencesByProject[cad.projectId]) cadencesByProject[cad.projectId] = [];
        cadencesByProject[cad.projectId].push(cad);
      }
      if (cad.customerId) {
        if (!cadencesByCustomer[cad.customerId]) cadencesByCustomer[cad.customerId] = [];
        cadencesByCustomer[cad.customerId].push(cad);
      }
    }

    // 6. Batch query for active tenant users (for fast PIC validity check)
    const [activeUsersRows]: any = await pool.query(`
      SELECT tu.userId FROM tenant_users tu
      JOIN users u ON u.id = tu.userId
      WHERE tu.tenantId = ? AND tu.status = 'ACTIVE' AND u.status = 'ACTIVE'
    `, [targetTenant]);
    const validTenantUserIds = new Set(activeUsersRows.map((u: any) => u.userId));

    // 7. Assemble Project Signals in memory
    const projectAttentionList: any[] = [];
    let criticalSignalCount = 0;
    let warningSignalCount = 0;

    for (const proj of projRows) {
      const pSignals: any[] = [];
      const isWon = proj.stageCommercialOutcome === 'WON';
      const isLost = proj.stageCommercialOutcome === 'LOST' || proj.stageCommercialOutcome === 'CANCELLED';
      const isOpen = !isWon && !isLost;

      if (isOpen || isWon) {
        // PIC Check
        if (!proj.picId || !validTenantUserIds.has(proj.picId)) {
          pSignals.push({
            code: 'PROJECT_NO_ACTIVE_PIC',
            severity: 'CRITICAL',
            title: proj.picId ? 'Assigned PIC Inactive or Suspended' : 'No Active PIC Assigned',
            reason: proj.picId ? `Assigned PIC (${proj.picId}) is inactive, suspended, or invalid in this tenant.` : 'Project lacks an assigned active PIC.',
            evaluatedAt,
            recommendedAction: 'Assign an active PIC to this project.',
            metadata: { picId: proj.picId }
          });
        }
      }

      if (isOpen) {
        // Expected close overdue
        const expClose = proj.expectedCloseDate ? getBusinessDate(proj.expectedCloseDate) : null;
        if (expClose && expClose < todayStr) {
          pSignals.push({
            code: 'EXPECTED_CLOSE_OVERDUE',
            severity: 'WARNING',
            title: 'Expected Close Date Passed',
            reason: `Target closing date (${expClose}) is past the current business date (${todayStr}).`,
            evaluatedAt,
            recommendedAction: 'Review expected close date or transition project stage.',
            metadata: { expectedCloseDate: expClose, today: todayStr }
          });
        }

        // Missing Next Action
        if (!projectsWithOpenActions.has(proj.id)) {
          pSignals.push({
            code: 'PROJECT_MISSING_NEXT_ACTION',
            severity: 'WARNING',
            title: 'No Next Action Scheduled',
            reason: 'Commercial pipeline project has no pending task, field visit, or follow-up scheduled.',
            evaluatedAt,
            recommendedAction: 'Schedule a task, visit, or follow-up to maintain deal momentum.',
            metadata: { projectId: proj.id }
          });
        }
      }

      if (isOpen || isWon) {
        // Overdue actions
        const projOverdue = overdueByProject[proj.id] || [];
        if (projOverdue.length > 0) {
          const dates = projOverdue.map(o => getBusinessDate(o.actionDate)).filter(Boolean).sort();
          pSignals.push({
            code: 'PROJECT_OVERDUE_ACTION',
            severity: 'WARNING',
            title: `${projOverdue.length} Overdue Action${projOverdue.length > 1 ? 's' : ''}`,
            reason: `Project has ${projOverdue.length} unresolved operational deliverable${projOverdue.length > 1 ? 's' : ''} past deadline.`,
            evaluatedAt,
            recommendedAction: 'Complete or reschedule past-due operational deliverables.',
            metadata: {
              overdueCount: projOverdue.length,
              oldestDueDate: dates[0] || todayStr,
              taskCount: projOverdue.filter(o => o.opType === 'TASK').length,
              visitCount: projOverdue.filter(o => o.opType === 'VISIT').length,
              followUpCount: projOverdue.filter(o => o.opType === 'FOLLOW_UP').length
            }
          });
        }

        // Cadence signals
        const pCads = cadencesByProject[proj.id] || [];
        for (const cad of pCads) {
          if (!proj.picId || !validTenantUserIds.has(proj.picId)) {
            pSignals.push({
              code: 'CADENCE_BLOCKED_INVALID_PIC',
              severity: 'CRITICAL',
              title: 'Cadence Blocked (Invalid PIC)',
              reason: `Active cadence #${cad.id} cannot progress because assigned project PIC is invalid.`,
              evaluatedAt,
              recommendedAction: 'Reassign an active PIC to allow cadence progression.',
              metadata: { cadenceId: cad.id }
            });
          }
        }
      }

      if (pSignals.length > 0) {
        pSignals.forEach(s => {
          if (s.severity === 'CRITICAL') criticalSignalCount++;
          else if (s.severity === 'WARNING') warningSignalCount++;
        });
        projectAttentionList.push({
          id: proj.id,
          title: proj.title || proj.name,
          stage: proj.stageId,
          customerId: proj.customerId,
          customerName: proj.customerName,
          picId: proj.picId,
          picName: proj.picName,
          signals: pSignals
        });
      }
    }

    // 8. Assemble Customer Signals in memory
    const customerAttentionList: any[] = [];
    for (const cust of custRows) {
      const cSignals: any[] = [];
      const isInactive = cust.statusCode === 'INACTIVE';
      const custOverdue = overdueByCustomer[cust.id] || [];

      // Customer PIC Check (Suppressed for INACTIVE customers with zero overdue/open work)
      if (!isInactive || custOverdue.length > 0) {
        if (!cust.picId || !validTenantUserIds.has(cust.picId)) {
          cSignals.push({
            code: 'CUSTOMER_NO_ACTIVE_PIC',
            severity: 'CRITICAL',
            title: cust.picId ? 'Customer PIC Inactive or Suspended' : 'No PIC Assigned to Customer',
            reason: cust.picId ? `Assigned PIC (${cust.picId}) is inactive, suspended, or invalid.` : 'Customer account lacks an assigned account representative.',
            evaluatedAt,
            recommendedAction: 'Assign an active account manager to this customer.',
            metadata: { picId: cust.picId }
          });
        }
      }

      // Customer Overdue Actions
      if (custOverdue.length > 0) {
        const dates = custOverdue.map(o => getBusinessDate(o.actionDate)).filter(Boolean).sort();
        cSignals.push({
          code: 'CUSTOMER_OVERDUE_ACTION',
          severity: 'WARNING',
          title: `${custOverdue.length} Overdue Action${custOverdue.length > 1 ? 's' : ''} in Account`,
          reason: `Customer account has ${custOverdue.length} unresolved operational deliverable${custOverdue.length > 1 ? 's' : ''} past deadline.`,
          evaluatedAt,
          recommendedAction: 'Resolve or reschedule overdue tasks, visits, and follow-ups.',
          metadata: {
            overdueCount: custOverdue.length,
            oldestDueDate: dates[0] || todayStr,
            taskCount: custOverdue.filter(o => o.opType === 'TASK').length,
            visitCount: custOverdue.filter(o => o.opType === 'VISIT').length,
            followUpCount: custOverdue.filter(o => o.opType === 'FOLLOW_UP').length
          }
        });
      }

      // Customer Cadence Check
      if (!isInactive) {
        const cCads = cadencesByCustomer[cust.id] || [];
        for (const cad of cCads) {
          if (!cust.picId || !validTenantUserIds.has(cust.picId)) {
            cSignals.push({
              code: 'CADENCE_BLOCKED_INVALID_PIC',
              severity: 'CRITICAL',
              title: 'Customer Cadence Blocked (Invalid PIC)',
              reason: `Active cadence #${cad.id} cannot progress because assigned customer PIC is invalid.`,
              evaluatedAt,
              recommendedAction: 'Assign an active PIC to customer account.',
              metadata: { cadenceId: cad.id }
            });
          }
        }
      }

      // Check child projects for this customer
      const childProjAttention = projectAttentionList.filter(p => p.customerId === cust.id);

      if (cSignals.length > 0 || childProjAttention.length > 0) {
        cSignals.forEach(s => {
          if (s.severity === 'CRITICAL') criticalSignalCount++;
          else if (s.severity === 'WARNING') warningSignalCount++;
        });
        customerAttentionList.push({
          id: cust.id,
          name: cust.name,
          code: cust.code,
          status: cust.statusId || cust.status,
          picId: cust.picId,
          picName: cust.picName,
          signals: cSignals,
          projectAttentionSummary: {
            projectsNeedingAttention: childProjAttention.length,
            criticalCount: childProjAttention.reduce((acc, p) => acc + p.signals.filter((s: any) => s.severity === 'CRITICAL').length, 0),
            warningCount: childProjAttention.reduce((acc, p) => acc + p.signals.filter((s: any) => s.severity === 'WARNING').length, 0),
            projects: childProjAttention
          }
        });
      }
    }

    res.json({
      evaluatedAt,
      businessDate: todayStr,
      summary: {
        customersNeedingAttention: customerAttentionList.length,
        projectsNeedingAttention: projectAttentionList.length,
        criticalSignals: criticalSignalCount,
        warningSignals: warningSignalCount,
        overdueActions: uniqueOverdueActionCount
      },
      projects: projectAttentionList,
      customers: customerAttentionList
    });
  } catch (err: any) {
    console.error('Error GET /api/sales/attention:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// Helper: Calculate Percentile for duration metrics
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return Math.round(sorted[lower]);
  const weight = index - lower;
  return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight);
}

// ─────────────────────────────────────────────────────────────
// GET /api/sales/pipeline - Authoritative Pipeline Analytics
// ─────────────────────────────────────────────────────────────
salesRoutes.get('/pipeline', async (req, res) => {
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const actorRole = (req as any).userRole;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  // 1. Strict Capability Check: Requires VIEW_REPORTS, MANAGE_TENANT, ALL, or SUPER_ADMIN
  const canViewReports = actorPermissions.includes('ALL') ||
    actorPermissions.includes('MANAGE_TENANT') ||
    actorPermissions.includes('VIEW_REPORTS') ||
    actorRole === 'SUPER_ADMIN';

  if (!canViewReports) {
    return res.status(403).json({ error: 'Access denied. VIEW_REPORTS permission required.' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const todayStr = getBusinessDate(new Date())!;
  const evaluatedAt = new Date().toISOString();

  try {
    let effectiveScope: 'OWN' | 'TEAM' | 'ORGANIZATION' = actorDataScope;
    if (actorRole === 'SUPER_ADMIN' || actorPermissions.includes('ALL') || actorPermissions.includes('MANAGE_TENANT')) {
      effectiveScope = 'ORGANIZATION';
    }

    const requestedRepId = req.query.repId ? String(req.query.repId).trim() : null;
    const requestedTeamId = req.query.teamId ? String(req.query.teamId).trim() : null;

    // Verify teamId access under TEAM scope
    if (requestedTeamId && effectiveScope === 'TEAM') {
      const [actorTeamRows]: any = await pool.query(`
        SELECT tm.teamId FROM team_members tm
        JOIN tenant_users tu ON tu.id = tm.tenantUserId
        WHERE tu.userId = ? AND tu.tenantId = ? AND tu.status = 'ACTIVE'
      `, [actorUserId, targetTenant]);
      const actorTeamIds = new Set(actorTeamRows.map((t: any) => t.teamId));
      if (!actorTeamIds.has(requestedTeamId)) {
        return res.status(403).json({ error: 'Access denied to requested team (BOLA/Scope violation).' });
      }
    }

    // 2. Resolve authorized reps in scope
    let repListQuery = `
      SELECT 
        u.id as userId, u.name, u.email, tu.status,
        tm.teamId, t.name as teamName, r.name as roleName
      FROM users u
      JOIN tenant_users tu ON tu.userId = u.id AND tu.tenantId = ?
      LEFT JOIN team_members tm ON tm.tenantUserId = tu.id
      LEFT JOIN teams t ON t.id = tm.teamId
      LEFT JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
      LEFT JOIN roles r ON r.id = tur.roleId
      WHERE 1=1
    `;
    const repListParams: any[] = [targetTenant];

    if (effectiveScope === 'OWN') {
      repListQuery += ` AND u.id = ?`;
      repListParams.push(actorUserId);
    } else if (effectiveScope === 'TEAM') {
      repListQuery += ` AND tm.teamId IN (
        SELECT tm2.teamId FROM team_members tm2
        JOIN tenant_users tu2 ON tu2.id = tm2.tenantUserId
        WHERE tu2.userId = ? AND tu2.tenantId = ? AND tu2.status = 'ACTIVE'
      )`;
      repListParams.push(actorUserId, targetTenant);
    }

    if (requestedTeamId) {
      repListQuery += ` AND tm.teamId = ?`;
      repListParams.push(requestedTeamId);
    }

    if (requestedRepId) {
      repListQuery += ` AND u.id = ?`;
      repListParams.push(requestedRepId);
    }

    repListQuery += ` ORDER BY u.name ASC`;
    const [authorizedReps]: any = await pool.query(repListQuery, repListParams);
    const authorizedRepIds = new Set(authorizedReps.map((r: any) => r.userId));

    if (requestedRepId && !authorizedRepIds.has(requestedRepId)) {
      return res.status(403).json({ error: 'Access denied to requested representative (BOLA/Scope violation).' });
    }

    // 3. Fetch dynamic tenant project_stages
    const [stageRows]: any = await pool.query(`
      SELECT id, code, name, phase, commercialOutcome, displayOrder, probability, isTerminal
      FROM project_stages
      WHERE tenantId = ? AND isActive = 1
      ORDER BY displayOrder ASC, name ASC
    `, [targetTenant]);

    const stageMap = new Map<string, any>();
    stageRows.forEach((st: any) => {
      stageMap.set(st.id, st);
      if (st.code) stageMap.set(st.code, st);
    });

    // 4. Fetch scoped projects
    const { where: projWhere, params: projParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'p.picId');
    let baseProjSql = `
      SELECT 
        p.id, p.tenantId, p.customerId, p.title, p.value, p.probability,
        p.expectedCloseDate, p.stageId, p.commercialWonAt, p.source, p.description, p.picId, p.createdAt,
        c.name as customerName, c.code as customerCode,
        u.name as picName, u.email as picEmail,
        ps.code as stageCode, ps.name as stageName, ps.phase as stagePhase,
        ps.commercialOutcome as stageCommercialOutcome, ps.isTerminal as stageIsTerminal
      FROM projects p
      LEFT JOIN project_stages ps ON ps.id = p.stageId AND ps.tenantId = p.tenantId
      LEFT JOIN customers c ON c.id = p.customerId
      LEFT JOIN users u ON u.id = p.picId
      ${projWhere.replace(/WHERE tenantId/g, 'WHERE p.tenantId')}
    `;
    const finalProjParams = [...projParams];

    if (requestedRepId) {
      baseProjSql += ` AND p.picId = ?`;
      finalProjParams.push(requestedRepId);
    }

    const [scopedProjects]: any = await pool.query(baseProjSql, finalProjParams);

    // 5. Batch fetch stage histories for scoped projects
    const projectIds = scopedProjects.map((p: any) => p.id);
    let stageHistories: any[] = [];
    if (projectIds.length > 0) {
      const [shRows]: any = await pool.query(`
        SELECT projectId, fromStageId, toStageId, changedById, changedAt, notes
        FROM project_stage_histories
        WHERE projectId IN (?)
        ORDER BY changedAt ASC
      `, [projectIds]);
      stageHistories = shRows;
    }

    const historiesByProject: Record<string, any[]> = {};
    stageHistories.forEach((sh: any) => {
      if (!historiesByProject[sh.projectId]) historiesByProject[sh.projectId] = [];
      historiesByProject[sh.projectId].push(sh);
    });

    // 6. Metrics calculation without hardcoded fallbacks
    let openProjectsCount = 0;
    let pipelineValueSum = 0;
    let weightedPipelineValueSum = 0;
    let projectsWithProbabilityCount = 0;
    let projectsMissingProbabilityCount = 0;
    let pipelineValueMissingProbabilitySum = 0;

    let wonProjectsCount = 0;
    let wonValueSum = 0;
    let lostProjectsCount = 0;
    let lostValueSum = 0;

    let totalOpenAgeDays = 0;
    let openProjectsWithAgeCount = 0;

    const closedCycleDurations: number[] = [];
    const stageDurations: Record<string, number[]> = {};
    stageRows.forEach((s: any) => {
      stageDurations[s.id] = [];
    });

    const stageSummaryMap: Record<string, { count: number; value: number; weightedValue: number; stage: any }> = {};
    stageRows.forEach((s: any) => {
      stageSummaryMap[s.id] = { count: 0, value: 0, weightedValue: 0, stage: s };
    });

    const repSummaryMap: Record<string, any> = {};
    authorizedReps.forEach((r: any) => {
      repSummaryMap[r.userId] = {
        userId: r.userId,
        name: r.name,
        email: r.email,
        teamId: r.teamId,
        teamName: r.teamName || 'General',
        openProjects: 0,
        pipelineValue: 0,
        weightedPipelineValue: 0,
        wonProjects: 0,
        wonValue: 0,
        lostProjects: 0,
        lostValue: 0
      };
    });

    let overdueForecast = { count: 0, value: 0, weightedValue: 0 };
    let missingCloseDateForecast = { count: 0, value: 0, weightedValue: 0 };
    const monthBucketsMap: Record<string, { projectCount: number; pipelineValue: number; weightedValue: number }> = {};

    let projectsWithExpectedCloseDateCount = 0;
    let projectsWithStageHistoryCount = 0;
    let terminalProjectsMissingTerminalHistoryCount = 0;
    let reopenedProjectsCount = 0;
    let invalidTransitionsCount = 0;

    for (const proj of scopedProjects) {
      const pStageMeta = (proj.stageId && stageMap.get(proj.stageId)) || (proj.stageCode && stageMap.get(proj.stageCode)) || null;
      const outcome = pStageMeta?.commercialOutcome || proj.stageCommercialOutcome || 'NONE';
      const isTerminal = pStageMeta ? Boolean(pStageMeta.isTerminal) : Boolean(proj.stageIsTerminal);

      const isWon = outcome === 'WON';
      const isLost = outcome === 'LOST';
      const isCancelled = outcome === 'CANCELLED';
      const isOpen = !isWon && !isLost && !isCancelled && !isTerminal;

      const pVal = Number(proj.value) || 0;
      const prob = proj.probability !== null && proj.probability !== undefined
        ? Number(proj.probability)
        : (pStageMeta?.probability !== null && pStageMeta?.probability !== undefined ? Number(pStageMeta.probability) : null);

      if (prob !== null && !isNaN(prob)) {
        projectsWithProbabilityCount++;
      } else {
        projectsMissingProbabilityCount++;
        pipelineValueMissingProbabilitySum += pVal;
      }

      const weightedVal = prob !== null && !isNaN(prob) ? (pVal * prob) / 100 : 0;

      // Stage aggregation
      if (proj.stageId && stageSummaryMap[proj.stageId]) {
        stageSummaryMap[proj.stageId].count++;
        stageSummaryMap[proj.stageId].value += pVal;
        stageSummaryMap[proj.stageId].weightedValue += weightedVal;
      }

      // Rep aggregation
      if (proj.picId && repSummaryMap[proj.picId]) {
        const rep = repSummaryMap[proj.picId];
        if (isOpen) {
          rep.openProjects++;
          rep.pipelineValue += pVal;
          rep.weightedPipelineValue += weightedVal;
        } else if (isWon) {
          rep.wonProjects++;
          rep.wonValue += pVal;
        } else if (isLost) {
          rep.lostProjects++;
          rep.lostValue += pVal;
        }
      }

      if (isOpen) {
        openProjectsCount++;
        pipelineValueSum += pVal;
        weightedPipelineValueSum += weightedVal;

        if (proj.createdAt) {
          const createdTime = new Date(proj.createdAt).getTime();
          const nowTime = Date.now();
          if (nowTime >= createdTime) {
            const ageDays = Math.floor((nowTime - createdTime) / (1000 * 60 * 60 * 24));
            totalOpenAgeDays += ageDays;
            openProjectsWithAgeCount++;
          }
        }

        // Expected close date forecasting
        if (proj.expectedCloseDate) {
          projectsWithExpectedCloseDateCount++;
          const closeDateStr = getBusinessDate(proj.expectedCloseDate);
          if (closeDateStr && closeDateStr < todayStr) {
            overdueForecast.count++;
            overdueForecast.value += pVal;
            overdueForecast.weightedValue += weightedVal;
          } else if (closeDateStr) {
            const mKey = closeDateStr.slice(0, 7);
            if (!monthBucketsMap[mKey]) {
              monthBucketsMap[mKey] = { projectCount: 0, pipelineValue: 0, weightedValue: 0 };
            }
            monthBucketsMap[mKey].projectCount++;
            monthBucketsMap[mKey].pipelineValue += pVal;
            monthBucketsMap[mKey].weightedValue += weightedVal;
          }
        } else {
          missingCloseDateForecast.count++;
          missingCloseDateForecast.value += pVal;
          missingCloseDateForecast.weightedValue += weightedVal;
        }
      } else if (isWon) {
        wonProjectsCount++;
        wonValueSum += pVal;
      } else if (isLost) {
        lostProjectsCount++;
        lostValueSum += pVal;
      }

      // Stage history validation & duration calculation
      const pHistories = historiesByProject[proj.id] || [];
      if (pHistories.length > 0) {
        projectsWithStageHistoryCount++;
        let hasTerminalInHistory = false;
        let prevTime: number = proj.createdAt ? new Date(proj.createdAt).getTime() : 0;

        for (let idx = 0; idx < pHistories.length; idx++) {
          const h = pHistories[idx];
          const currTime = new Date(h.changedAt).getTime();
          const toStMeta = stageMap.get(h.toStageId);

          if (toStMeta && toStMeta.isTerminal) {
            hasTerminalInHistory = true;
          }

          if (idx > 0 && currTime < prevTime) {
            invalidTransitionsCount++;
          }

          if (h.fromStageId && h.toStageId && h.fromStageId === h.toStageId) {
            invalidTransitionsCount++;
          }

          if (h.fromStageId && stageDurations[h.fromStageId]) {
            if (currTime >= prevTime) {
              const durDays = Math.max(0, Math.round((currTime - prevTime) / (1000 * 60 * 60 * 24)));
              stageDurations[h.fromStageId].push(durDays);
            }
          }

          prevTime = currTime;
        }

        if (isTerminal && !hasTerminalInHistory) {
          terminalProjectsMissingTerminalHistoryCount++;
        }

        if (isTerminal && pHistories.length > 0) {
          const lastH = pHistories[pHistories.length - 1];
          const startT = proj.createdAt ? new Date(proj.createdAt).getTime() : new Date(pHistories[0].changedAt).getTime();
          const endT = new Date(lastH.changedAt).getTime();
          if (endT >= startT) {
            closedCycleDurations.push(Math.max(0, Math.round((endT - startT) / (1000 * 60 * 60 * 24))));
          }
        }
      } else if (isTerminal) {
        terminalProjectsMissingTerminalHistoryCount++;
      }
    }

    const closedProjectsCount = wonProjectsCount + lostProjectsCount;
    const closedValueSum = wonValueSum + lostValueSum;
    const winRateByCount = closedProjectsCount > 0 ? Math.round((wonProjectsCount / closedProjectsCount) * 1000) / 10 : 0;
    const winRateByValue = closedValueSum > 0 ? Math.round((wonValueSum / closedValueSum) * 1000) / 10 : 0;
    const averageOpenProjectAgeDays = openProjectsWithAgeCount > 0 ? Math.round(totalOpenAgeDays / openProjectsWithAgeCount) : 0;
    const averageSalesCycleDays = closedCycleDurations.length > 0 ? Math.round(closedCycleDurations.reduce((a, b) => a + b, 0) / closedCycleDurations.length) : 0;

    // Stage Distribution output
    const stageDistribution = stageRows.map((s: any) => {
      const sm = stageSummaryMap[s.id] || { count: 0, value: 0, weightedValue: 0 };
      return {
        stage: s.name,
        stageKey: s.id,
        stageCode: s.code,
        displayOrder: s.displayOrder,
        commercialOutcome: s.commercialOutcome,
        isTerminal: Boolean(s.isTerminal),
        projectCount: sm.count,
        pipelineValue: sm.value,
        weightedValue: sm.weightedValue,
        probabilityDefault: s.probability
      };
    });

    // Stage Velocity output
    const stageVelocity = stageRows.map((s: any) => {
      const durs = stageDurations[s.id] || [];
      const avg = durs.length > 0 ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0;
      const med = durs.length > 0 ? calculatePercentile(durs, 50) : 0;
      return {
        stage: s.name,
        stageKey: s.id,
        stageCode: s.code,
        commercialOutcome: s.commercialOutcome,
        averageDays: avg,
        medianDays: med,
        sampleCount: durs.length,
        hasSample: durs.length > 0
      };
    });

    const upcomingMonths = Object.entries(monthBucketsMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, b]) => ({
        month,
        projectCount: b.projectCount,
        pipelineValue: b.pipelineValue,
        weightedValue: b.weightedValue
      }));

    res.json({
      evaluatedAt,
      businessDate: todayStr,
      scope: effectiveScope,
      summary: {
        openProjects: openProjectsCount,
        pipelineValue: pipelineValueSum,
        weightedPipelineValue: weightedPipelineValueSum,
        wonProjects: wonProjectsCount,
        wonValue: wonValueSum,
        lostProjects: lostProjectsCount,
        lostValue: lostValueSum,
        winRateByCount,
        winRateByValue,
        averageSalesCycleDays,
        averageOpenProjectAgeDays
      },
      stageDistribution,
      stageVelocity,
      repPipeline: Object.values(repSummaryMap),
      expectedCloseForecast: {
        overdue: overdueForecast,
        upcomingMonths,
        missingCloseDate: missingCloseDateForecast
      },
      coverage: {
        totalProjects: scopedProjects.length,
        openProjects: openProjectsCount,
        closedProjects: closedProjectsCount,
        projectsWithStageHistory: projectsWithStageHistoryCount,
        projectsWithExpectedCloseDate: projectsWithExpectedCloseDateCount,
        projectsWithProbability: projectsWithProbabilityCount,
        projectsMissingProbability: projectsMissingProbabilityCount,
        pipelineValueMissingProbability: pipelineValueMissingProbabilitySum,
        projectsExcludedFromCycleMetrics: scopedProjects.length - closedCycleDurations.length
      },
      dataQuality: {
        terminalProjectsMissingTerminalHistory: terminalProjectsMissingTerminalHistoryCount,
        reopenedProjects: reopenedProjectsCount,
        invalidTransitions: invalidTransitionsCount
      },
      recentProjects: scopedProjects.slice(0, 50)
    });
  } catch (err: any) {
    console.error('Error GET /api/sales/pipeline:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/sales/pipeline-velocity - Stage Velocity Baselines
// ─────────────────────────────────────────────────────────────
salesRoutes.get('/pipeline-velocity', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const todayStr = getBusinessDate(new Date()) || new Date().toISOString().slice(0, 10);
  const evaluatedAt = new Date().toISOString();

  try {
    const hasReportPerm = actorRole === 'SUPER_ADMIN' ||
      actorPermissions.includes('ALL') ||
      actorPermissions.includes('MANAGE_TENANT') ||
      actorPermissions.includes('VIEW_REPORTS') ||
      actorPermissions.includes('MANAGE_USERS');

    if (!hasReportPerm) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view pipeline velocity reports.' });
    }

    let effectiveScope: 'OWN' | 'TEAM' | 'ORGANIZATION' = actorDataScope;
    if (actorRole === 'SUPER_ADMIN' || actorPermissions.includes('ALL') || actorPermissions.includes('MANAGE_TENANT')) {
      effectiveScope = 'ORGANIZATION';
    }

    // BOLA checks for requested filters
    const requestedTeamId = req.query.teamId ? String(req.query.teamId).trim() : null;
    const requestedRepId = req.query.repId ? String(req.query.repId).trim() : null;

    if (requestedTeamId && effectiveScope === 'TEAM') {
      const [actorTeamRows]: any = await pool.query(`
        SELECT tm.teamId FROM team_members tm
        JOIN tenant_users tu ON tu.id = tm.tenantUserId
        WHERE tu.userId = ? AND tu.tenantId = ? AND tu.status = 'ACTIVE'
      `, [actorUserId, targetTenant]);
      const actorTeamIds = new Set(actorTeamRows.map((t: any) => t.teamId));
      if (!actorTeamIds.has(requestedTeamId)) {
        return res.status(403).json({ error: 'Access denied to requested team (BOLA/Scope violation).' });
      }
    }

    // Dynamic tenant project stages
    const [tenantStages]: any = await pool.query(`
      SELECT id, code, name, phase, commercialOutcome, displayOrder, probability, isTerminal
      FROM project_stages
      WHERE tenantId = ? AND isActive = 1
      ORDER BY displayOrder ASC, name ASC
    `, [targetTenant]);

    const stageMap = new Map<string, any>();
    tenantStages.forEach((s: any) => {
      stageMap.set(s.id, s);
      if (s.code) stageMap.set(s.code, s);
    });

    // 1. Fetch all historical stage transitions in tenant (for Authoritative Baseline calculation)
    const [allHistories]: any = await pool.query(`
      SELECT 
        psh.id, psh.projectId, psh.fromStageId, psh.toStageId, psh.changedAt,
        p.createdAt as projectCreatedAt
      FROM project_stage_histories psh
      JOIN projects p ON p.id = psh.projectId
      WHERE p.tenantId = ?
      ORDER BY psh.projectId ASC, psh.changedAt ASC, psh.id ASC
    `, [targetTenant]);

    // Group histories by projectId
    const historiesByProject: Record<string, any[]> = {};
    for (const h of allHistories) {
      if (!historiesByProject[h.projectId]) historiesByProject[h.projectId] = [];
      historiesByProject[h.projectId].push(h);
    }

    const stageDurations: Record<string, number[]> = {};
    tenantStages.forEach((s: any) => {
      stageDurations[s.id] = [];
    });

    let totalStageIntervals = 0;
    let validStageIntervals = 0;
    let invalidIntervalsExcluded = 0;

    for (const [projId, pHistList] of Object.entries(historiesByProject)) {
      for (let i = 0; i < pHistList.length; i++) {
        totalStageIntervals++;
        const curr = pHistList[i];
        const prevTime = i === 0
          ? (curr.projectCreatedAt ? new Date(curr.projectCreatedAt).getTime() : new Date(curr.changedAt).getTime())
          : new Date(pHistList[i - 1].changedAt).getTime();
        const currTime = new Date(curr.changedAt).getTime();

        // Validate chronological sanity, distinct stages, and non-negative interval
        if (currTime < prevTime || !curr.fromStageId || !curr.toStageId || curr.fromStageId === curr.toStageId) {
          invalidIntervalsExcluded++;
          continue;
        }

        const durationDays = Math.max(0, Math.round((currTime - prevTime) / (1000 * 60 * 60 * 24)));
        const fromStId = curr.fromStageId;
        const matchedStage = stageMap.get(fromStId);

        if (matchedStage && stageDurations[matchedStage.id]) {
          stageDurations[matchedStage.id].push(durationDays);
          validStageIntervals++;
        }
      }
    }

    // Build baselines dynamically per tenant stage
    const baselines: Record<string, any> = {};
    for (const stage of tenantStages) {
      const durs = stageDurations[stage.id] || [];
      const sampleCount = durs.length;
      if (sampleCount === 0) {
        baselines[stage.id] = {
          stageId: stage.id,
          stageName: stage.name,
          stageCode: stage.code,
          commercialOutcome: stage.commercialOutcome,
          isTerminal: Boolean(stage.isTerminal),
          hasBaseline: false,
          sampleCount: 0,
          averageDays: null,
          medianDays: null,
          p75Days: null,
          p90Days: null
        };
      } else {
        const sum = durs.reduce((a, b) => a + b, 0);
        const avg = Math.round((sum / sampleCount) * 10) / 10;
        const median = calculatePercentile(durs, 50);
        const p75 = calculatePercentile(durs, 75);
        const p90 = calculatePercentile(durs, 90);

        baselines[stage.id] = {
          stageId: stage.id,
          stageName: stage.name,
          stageCode: stage.code,
          commercialOutcome: stage.commercialOutcome,
          isTerminal: Boolean(stage.isTerminal),
          hasBaseline: true,
          sampleCount,
          averageDays: avg,
          medianDays: median,
          p75Days: p75,
          p90Days: p90
        };
      }
    }

    // 2. Fetch active projects in scope for current stage duration tracking
    const { where: projWhere, params: projParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'p.picId');
    let activeProjSql = `
      SELECT 
        p.id, p.tenantId, p.customerId, p.title, p.value, p.probability,
        p.stageId, p.picId, p.createdAt,
        c.name as customerName, u.name as picName,
        ps.code as stageCode, ps.name as stageName, ps.commercialOutcome as stageCommercialOutcome, ps.isTerminal as stageIsTerminal
      FROM projects p
      LEFT JOIN project_stages ps ON ps.id = p.stageId AND ps.tenantId = p.tenantId
      LEFT JOIN customers c ON c.id = p.customerId
      LEFT JOIN users u ON u.id = p.picId
      ${projWhere.replace(/WHERE tenantId/g, 'WHERE p.tenantId')}
    `;
    const finalProjParams = [...projParams];

    if (requestedRepId) {
      activeProjSql += ` AND p.picId = ?`;
      finalProjParams.push(requestedRepId);
    }

    const [scopedActiveProjects]: any = await pool.query(activeProjSql, finalProjParams);

    // Active project evaluation against baselines
    const projectVelocities: any[] = [];
    let delayedProjectsCount = 0;
    let normalProjectsCount = 0;
    let fastProjectsCount = 0;
    let unbaselinedProjectsCount = 0;

    const todayTime = new Date(todayStr).getTime();

    for (const p of scopedActiveProjects) {
      const pStageMeta = (p.stageId && stageMap.get(p.stageId)) || (p.stageCode && stageMap.get(p.stageCode)) || null;
      const outcome = pStageMeta?.commercialOutcome || p.stageCommercialOutcome || 'NONE';
      const isTerminal = pStageMeta ? Boolean(pStageMeta.isTerminal) : Boolean(p.stageIsTerminal);

      const isWon = outcome === 'WON';
      const isLost = outcome === 'LOST';
      const isCancelled = outcome === 'CANCELLED';

      // Only evaluate open/active projects
      if (isWon || isLost || isCancelled || isTerminal) continue;

      const pHistList = historiesByProject[p.id] || [];
      const enterTime = pHistList.length > 0
        ? new Date(pHistList[pHistList.length - 1].changedAt).getTime()
        : (p.createdAt ? new Date(p.createdAt).getTime() : todayTime);

      const daysInStage = Math.max(0, Math.round((todayTime - enterTime) / (1000 * 60 * 60 * 24)));
      const baseline = pStageMeta ? baselines[pStageMeta.id] : null;

      let velocityStatus: 'FAST' | 'NORMAL' | 'DELAYED' | 'UNBASELINED' = 'UNBASELINED';
      let delayDays = 0;

      if (baseline && baseline.hasBaseline && baseline.p75Days !== null) {
        if (daysInStage > baseline.p75Days) {
          velocityStatus = 'DELAYED';
          delayDays = daysInStage - baseline.p75Days;
          delayedProjectsCount++;
        } else if (baseline.medianDays !== null && daysInStage < Math.round(baseline.medianDays * 0.5)) {
          velocityStatus = 'FAST';
          fastProjectsCount++;
        } else {
          velocityStatus = 'NORMAL';
          normalProjectsCount++;
        }
      } else {
        unbaselinedProjectsCount++;
      }

      projectVelocities.push({
        projectId: p.id,
        title: p.title,
        customerId: p.customerId,
        customerName: p.customerName,
        picId: p.picId,
        picName: p.picName,
        stageId: p.stageId,
        stageName: pStageMeta?.name || p.stageName || p.stageCode || p.stageId,
        stageCode: pStageMeta?.code || p.stageCode,
        daysInStage,
        expectedDays: baseline?.medianDays ?? null,
        p75ThresholdDays: baseline?.p75Days ?? null,
        velocityStatus,
        delayDays,
        value: Number(p.value) || 0,
        probability: p.probability !== null ? Number(p.probability) : (pStageMeta?.probability ?? null)
      });
    }

    res.json({
      evaluatedAt,
      businessDate: todayStr,
      scope: effectiveScope,
      baselineScope: 'ORGANIZATION',
      comparisonPolicyConfigured: true,
      comparisonMinimumSampleSize: 1,
      baselines,
      baselinesList: Object.values(baselines),
      summary: {
        evaluatedProjects: projectVelocities.length,
        delayedProjects: delayedProjectsCount,
        normalProjects: normalProjectsCount,
        fastProjects: fastProjectsCount,
        unbaselinedProjects: unbaselinedProjectsCount,
        totalStageIntervalsAnalyzed: totalStageIntervals,
        validStageIntervals,
        invalidIntervalsExcluded
      },
      projectVelocities
    });
  } catch (err: any) {
    console.error('Error GET /api/sales/pipeline-velocity:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});



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
        c.name as customerName, c.code as customerCode,
        p.title as projectName, p.stageId as projectStage,
        u.name as picName, u.avatar as picAvatar
      FROM tasks t
      LEFT JOIN customers c ON c.id = t.customerId
      LEFT JOIN projects p ON p.id = t.relatedProjectId
      LEFT JOIN users u ON u.id = t.picId
      ${taskWhere.replace(/WHERE tenantId/g, 'WHERE t.tenantId')}
    `, taskParams);

    // 2. Fetch Authorized Visits
    const [visitRows]: any = await pool.query(`
      SELECT 
        v.id, v.title, v.customerId, v.relatedProjectId, v.purposeId as purpose,
        v.statusId as status, v.visitDate, v.startTime, v.endTime, v.location,
        v.result, v.nextAction, v.picId, v.completedAt,
        c.name as customerName, c.code as customerCode,
        p.title as projectName, p.stageId as projectStage,
        u.name as picName, u.avatar as picAvatar
      FROM visits v
      LEFT JOIN customers c ON c.id = v.customerId
      LEFT JOIN projects p ON p.id = v.relatedProjectId
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
      const isCompleted = t.status === 'COMPLETED';
      const isCancelled = t.status === 'CANCELLED';
      const isTerminal = isCompleted || isCancelled;
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
      const isCompleted = v.status === 'COMPLETED';
      const isCancelled = v.status === 'CANCELLED';
      const isTerminal = isCompleted || isCancelled;
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
      LEFT JOIN customers c ON c.id = p.customerId
      LEFT JOIN users u ON u.id = p.picId
      LEFT JOIN project_stages ps ON ps.id = p.stageId AND ps.tenantId = p.tenantId
      ${projWhere.replace(/WHERE tenantId/g, 'WHERE p.tenantId')}
      AND (ps.commercialOutcome = 'OPEN' OR (ps.commercialOutcome IS NULL AND p.stageId NOT IN ('WON', 'LOST', 'PS-6', 'PS-7')))
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
      SELECT c.*, u.name as picName
      FROM customers c
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
      ${taskWhere.replace(/WHERE tenantId/g, 'WHERE t.tenantId')}
      AND t.statusId NOT IN ('COMPLETED', 'CANCELLED')
      AND t.dueDate < ?
      UNION ALL
      SELECT 'VISIT' as opType, v.id, v.customerId, v.relatedProjectId as projectId, v.visitDate as actionDate, v.picId
      FROM visits v
      ${visitWhere.replace(/WHERE tenantId/g, 'WHERE v.tenantId')}
      AND v.statusId NOT IN ('COMPLETED', 'CANCELLED')
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
      SELECT relatedProjectId as projectId FROM tasks WHERE tenantId = ? AND statusId NOT IN ('COMPLETED', 'CANCELLED') AND relatedProjectId IS NOT NULL
      UNION ALL
      SELECT relatedProjectId as projectId FROM visits WHERE tenantId = ? AND statusId NOT IN ('COMPLETED', 'CANCELLED') AND relatedProjectId IS NOT NULL
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
      const isWon = proj.stageCommercialOutcome === 'WON' || proj.stageId === 'WON';
      const isLost = proj.stageCommercialOutcome === 'LOST' || proj.stageCommercialOutcome === 'CANCELLED' || proj.stageId === 'LOST';
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
      const isInactive = cust.statusId === 'INACTIVE' || cust.status === 'INACTIVE';
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


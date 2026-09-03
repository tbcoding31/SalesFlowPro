import { Router } from 'express';
import { pool } from '../db';
import { buildReportScopeWhere, validateTargetTenant } from '../utils/scope';
import { getBusinessDate } from '../utils/date';

export const managementRoutes = Router();

managementRoutes.get('/control-tower', async (req, res) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;
  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  // 0. Management Capability Enforcement
  const hasMgmtPermission = actorPermissions.includes('ALL') ||
    actorPermissions.includes('MANAGE_TENANT') ||
    actorPermissions.includes('VIEW_ALL_TASKS') ||
    actorPermissions.includes('VIEW_TEAM_TASKS') ||
    actorPermissions.includes('MANAGE_PROJECTS') ||
    actorPermissions.includes('MANAGE_CUSTOMERS') ||
    actorRole === 'SUPER_ADMIN' ||
    actorRole === 'TENANT_ADMIN' ||
    actorRole === 'SALES_MANAGER' ||
    actorRole === 'SUPERVISOR';

  if (!hasMgmtPermission) {
    return res.status(403).json({ error: 'Access denied. Management capability required for Control Tower.' });
  }

  try {
    const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
    if (targetTenant === false) return;
    const todayStr = req.query.date ? String(req.query.date).trim() : getBusinessDate(new Date())!;
    const evaluatedAt = new Date().toISOString();

    // 1. Determine Effective Scope and Filtered Rep/Team parameters
    let effectiveScope = actorDataScope;
    if (actorRole === 'SUPER_ADMIN' || actorPermissions.includes('ALL') || actorPermissions.includes('MANAGE_TENANT')) {
      effectiveScope = 'ORGANIZATION';
    }

    // Build base where clause for operational records based on actor effectiveScope
    const { where: projWhere, params: projParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, effectiveScope, actorPermissions, 'p.picId');
    const { where: taskWhere, params: taskParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, effectiveScope, actorPermissions, 't.picId');
    const { where: visitWhere, params: visitParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, effectiveScope, actorPermissions, 'v.picId');
    const { where: fuWhere, params: fuParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, effectiveScope, actorPermissions, 'f.picId');

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

    // 2. Query Authorized Reps List (from users, tenant_users, teams, roles)
    let repListQuery = `
      SELECT 
        u.id as userId, u.name, u.email, u.avatar as avatarUrl, tu.status,
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
    const [rawAuthorizedReps]: any = await pool.query(repListQuery, repListParams);
    
    // Deduplicate authorized reps by userId (e.g. if user has multiple roles or team entries)
    const seenRepIds = new Set<string>();
    const authorizedReps: any[] = [];
    for (const r of rawAuthorizedReps) {
      if (!seenRepIds.has(r.userId)) {
        seenRepIds.add(r.userId);
        authorizedReps.push(r);
      }
    }
    const authorizedRepIds = new Set(authorizedReps.map((r: any) => r.userId));

    // If a rep was explicitly requested but not in authorized list, deny
    if (requestedRepId && !authorizedRepIds.has(requestedRepId)) {
      return res.status(403).json({ error: 'Access denied to requested representative (BOLA/Scope violation).' });
    }

    // 3. Batch Query 1: Open and Closed Projects with PIC & stage breakdown
    const [scopedProjects]: any = await pool.query(`
      SELECT p.*, c.name as customerName, c.code as customerCode, u.name as picName
      FROM projects p
      LEFT JOIN customers c ON c.id = p.customerId
      LEFT JOIN users u ON u.id = p.picId
      ${projWhere.replace(/WHERE tenantId/g, 'WHERE p.tenantId')}
    `, projParams);

    const filteredProjects = requestedRepId ? scopedProjects.filter((p: any) => p.picId === requestedRepId) : scopedProjects;

    // 4. Batch Query 2: Tasks aggregation
    const [scopedTasks]: any = await pool.query(`
      SELECT t.id, t.title, t.customerId, t.relatedProjectId, t.priorityId, t.statusId, t.dueDate, t.completedAt, t.picId
      FROM tasks t
      ${taskWhere.replace(/WHERE tenantId/g, 'WHERE t.tenantId')}
    `, taskParams);
    const filteredTasks = requestedRepId ? scopedTasks.filter((t: any) => t.picId === requestedRepId) : scopedTasks;

    // 5. Batch Query 3: Visits aggregation
    const [scopedVisits]: any = await pool.query(`
      SELECT v.id, v.title, v.customerId, v.relatedProjectId, v.statusId, v.visitDate, v.completedAt, v.picId
      FROM visits v
      ${visitWhere.replace(/WHERE tenantId/g, 'WHERE v.tenantId')}
    `, visitParams);
    const filteredVisits = requestedRepId ? scopedVisits.filter((v: any) => v.picId === requestedRepId) : scopedVisits;

    // 6. Batch Query 4: Follow-ups aggregation
    const [scopedFollowups]: any = await pool.query(`
      SELECT f.id, f.title, f.customerId, f.relatedProjectId, f.typeId, f.status, f.followUpDate, f.completedAt, f.picId
      FROM follow_ups f
      ${fuWhere.replace(/WHERE tenantId/g, 'WHERE f.tenantId')}
    `, fuParams);
    const filteredFollowups = requestedRepId ? scopedFollowups.filter((f: any) => f.picId === requestedRepId) : scopedFollowups;

    // 7. Batch Query 5: Active Maintenance Cadences in tenant
    const [cadencesRows]: any = await pool.query(`
      SELECT mc.*, c.name as customerName, p.title as projectTitle,
             COALESCE(p.picId, c.picId) as effectivePicId, u.name as picName
      FROM maintenance_cadences mc
      LEFT JOIN customers c ON c.id = mc.customerId
      LEFT JOIN projects p ON p.id = mc.projectId
      LEFT JOIN users u ON u.id = COALESCE(p.picId, c.picId)
      WHERE mc.tenantId = ? AND mc.status = 'ACTIVE'
    `, [targetTenant]);

    // 8. Batch Query 6: Active Tenant Users for PIC validity verification
    const [activeUsersRows]: any = await pool.query(`
      SELECT tu.userId FROM tenant_users tu
      JOIN users u ON u.id = tu.userId
      WHERE tu.tenantId = ? AND tu.status = 'ACTIVE' AND u.status = 'ACTIVE'
    `, [targetTenant]);
    const validTenantUserIds = new Set(activeUsersRows.map((u: any) => u.userId));

    // 9. Evaluate Operational Attention Signals across scoped Projects
    const projectsWithOpenActions = new Set([
      ...filteredTasks.filter((t: any) => t.statusId !== 'COMPLETED' && t.statusId !== 'CANCELLED' && t.relatedProjectId).map((t: any) => t.relatedProjectId),
      ...filteredVisits.filter((v: any) => v.statusId !== 'COMPLETED' && v.statusId !== 'CANCELLED' && v.relatedProjectId).map((v: any) => v.relatedProjectId),
      ...filteredFollowups.filter((f: any) => f.status !== 'COMPLETED' && f.status !== 'CANCELLED' && f.relatedProjectId).map((f: any) => f.relatedProjectId)
    ]);

    const projectsNeedingAttentionList: any[] = [];
    let projectsMissingNextActionCount = 0;
    let expectedCloseOverdueCount = 0;
    let totalCriticalSignals = 0;
    let totalWarningSignals = 0;

    for (const proj of filteredProjects) {
      const pSignals: any[] = [];
      const stage = proj.stageId;
      const isWon = stage === 'WON';
      const isLost = stage === 'LOST';
      const isOpen = !isWon && !isLost;

      if (isOpen || isWon) {
        if (!proj.picId || !validTenantUserIds.has(proj.picId)) {
          pSignals.push({
            code: 'PROJECT_NO_ACTIVE_PIC',
            severity: 'CRITICAL',
            title: proj.picId ? 'Assigned PIC Inactive or Suspended' : 'No Active PIC Assigned',
            reason: proj.picId ? `Assigned PIC (${proj.picId}) is inactive or suspended.` : 'Project lacks an assigned active PIC.',
            evaluatedAt,
            recommendedAction: 'Assign an active PIC to this project.'
          });
        }
      }

      if (isOpen) {
        const expClose = proj.expectedCloseDate ? getBusinessDate(proj.expectedCloseDate) : null;
        if (expClose && expClose < todayStr) {
          expectedCloseOverdueCount++;
          pSignals.push({
            code: 'EXPECTED_CLOSE_OVERDUE',
            severity: 'WARNING',
            title: 'Expected Close Date Passed',
            reason: `Target closing date (${expClose}) is past current date (${todayStr}).`,
            evaluatedAt,
            recommendedAction: 'Review expected close date or transition stage.'
          });
        }

        if (!projectsWithOpenActions.has(proj.id)) {
          projectsMissingNextActionCount++;
          pSignals.push({
            code: 'PROJECT_MISSING_NEXT_ACTION',
            severity: 'WARNING',
            title: 'No Next Action Scheduled',
            reason: 'Open project has no pending task, field visit, or follow-up scheduled.',
            evaluatedAt,
            recommendedAction: 'Schedule a task, visit, or follow-up to maintain deal momentum.'
          });
        }
      }

      // Check overdue work for this project
      const projOverdueTasks = filteredTasks.filter((t: any) => t.relatedProjectId === proj.id && t.statusId !== 'COMPLETED' && t.statusId !== 'CANCELLED' && getBusinessDate(t.dueDate) && getBusinessDate(t.dueDate)! < todayStr);
      const projOverdueVisits = filteredVisits.filter((v: any) => v.relatedProjectId === proj.id && v.statusId !== 'COMPLETED' && v.statusId !== 'CANCELLED' && getBusinessDate(v.visitDate) && getBusinessDate(v.visitDate)! < todayStr);
      const projOverdueFollowups = filteredFollowups.filter((f: any) => f.relatedProjectId === proj.id && f.status !== 'COMPLETED' && f.status !== 'CANCELLED' && getBusinessDate(f.followUpDate) && getBusinessDate(f.followUpDate)! < todayStr);
      const pOverdueCount = projOverdueTasks.length + projOverdueVisits.length + projOverdueFollowups.length;

      if ((isOpen || isWon) && pOverdueCount > 0) {
        pSignals.push({
          code: 'PROJECT_OVERDUE_ACTION',
          severity: 'WARNING',
          title: `${pOverdueCount} Overdue Action${pOverdueCount > 1 ? 's' : ''}`,
          reason: `Project has ${pOverdueCount} unresolved operational item${pOverdueCount > 1 ? 's' : ''} past deadline.`,
          evaluatedAt,
          recommendedAction: 'Complete or reschedule past-due operational deliverables.'
        });
      }

      if (pSignals.length > 0) {
        pSignals.forEach(s => {
          if (s.severity === 'CRITICAL') totalCriticalSignals++;
          else if (s.severity === 'WARNING') totalWarningSignals++;
        });
        projectsNeedingAttentionList.push({
          id: proj.id,
          title: proj.title || proj.name,
          stage: proj.stageId,
          value: Number(proj.value) || 0,
          expectedCloseDate: proj.expectedCloseDate,
          customerId: proj.customerId,
          customerName: proj.customerName,
          picId: proj.picId,
          picName: proj.picName,
          signals: pSignals
        });
      }
    }

    // 10. Assemble Blocked Cadences
    const blockedCadencesList: any[] = [];
    for (const cad of cadencesRows) {
      if (cad.effectivePicId && !authorizedRepIds.has(cad.effectivePicId) && effectiveScope !== 'ORGANIZATION') {
        continue;
      }
      if (!cad.effectivePicId || !validTenantUserIds.has(cad.effectivePicId)) {
        blockedCadencesList.push({
          id: cad.id,
          actionType: cad.actionType,
          targetType: cad.projectId ? 'PROJECT' : 'CUSTOMER',
          targetId: cad.projectId || cad.customerId,
          targetTitle: cad.projectTitle || cad.customerName,
          picId: cad.effectivePicId,
          picName: cad.picName || 'Unassigned / Inactive',
          reason: cad.effectivePicId ? 'Assigned PIC is inactive or suspended' : 'No PIC assigned to target entity',
          severity: 'CRITICAL'
        });
        totalCriticalSignals++;
      }
    }

    // 11. Assemble Unique Overdue Operational Work (1 canonical record = 1 count)
    const overdueWorkList: any[] = [];
    const overdueByRep: Record<string, number> = {};

    filteredTasks.forEach((t: any) => {
      if (t.statusId !== 'COMPLETED' && t.statusId !== 'CANCELLED' && getBusinessDate(t.dueDate) && getBusinessDate(t.dueDate)! < todayStr) {
        overdueWorkList.push({
          id: t.id,
          type: 'TASK',
          title: t.title,
          dueDate: getBusinessDate(t.dueDate),
          picId: t.picId,
          priority: t.priorityId,
          customerId: t.customerId,
          projectId: t.relatedProjectId
        });
        if (t.picId) overdueByRep[t.picId] = (overdueByRep[t.picId] || 0) + 1;
      }
    });

    filteredVisits.forEach((v: any) => {
      if (v.statusId !== 'COMPLETED' && v.statusId !== 'CANCELLED' && getBusinessDate(v.visitDate) && getBusinessDate(v.visitDate)! < todayStr) {
        overdueWorkList.push({
          id: v.id,
          type: 'VISIT',
          title: v.title,
          dueDate: getBusinessDate(v.visitDate),
          picId: v.picId,
          customerId: v.customerId,
          projectId: v.relatedProjectId
        });
        if (v.picId) overdueByRep[v.picId] = (overdueByRep[v.picId] || 0) + 1;
      }
    });

    filteredFollowups.forEach((f: any) => {
      if (f.status !== 'COMPLETED' && f.status !== 'CANCELLED' && getBusinessDate(f.followUpDate) && getBusinessDate(f.followUpDate)! < todayStr) {
        overdueWorkList.push({
          id: f.id,
          type: 'FOLLOW_UP',
          title: f.title,
          dueDate: getBusinessDate(f.followUpDate),
          picId: f.picId,
          customerId: f.customerId,
          projectId: f.relatedProjectId
        });
        if (f.picId) overdueByRep[f.picId] = (overdueByRep[f.picId] || 0) + 1;
      }
    });

    // 12. Calculate Due Today, Completed Today, and Upcoming Work (Next 7 days window matching Agenda)
    let dueTodayCount = 0;
    let completedTodayCount = 0;
    let upcomingWorkCount = 0;

    // Upcoming window: todayStr < date <= todayStr + 7 days
    const todayDateObj = new Date(todayStr);
    const windowEndDateObj = new Date(todayDateObj.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingWindowEnd = getBusinessDate(windowEndDateObj)!;

    const todayTasksByRep: Record<string, number> = {};
    const todayVisitsByRep: Record<string, number> = {};
    const todayFollowupsByRep: Record<string, number> = {};
    const completedTodayByRep: Record<string, number> = {};

    filteredTasks.forEach((t: any) => {
      const d = getBusinessDate(t.dueDate);
      if (d === todayStr && t.statusId !== 'COMPLETED' && t.statusId !== 'CANCELLED') {
        dueTodayCount++;
        if (t.picId) todayTasksByRep[t.picId] = (todayTasksByRep[t.picId] || 0) + 1;
      } else if (d && d > todayStr && d <= upcomingWindowEnd && t.statusId !== 'COMPLETED' && t.statusId !== 'CANCELLED') {
        upcomingWorkCount++;
      }
      if (t.completedAt && getBusinessDate(t.completedAt) === todayStr && t.statusId === 'COMPLETED') {
        completedTodayCount++;
        if (t.picId) completedTodayByRep[t.picId] = (completedTodayByRep[t.picId] || 0) + 1;
      }
    });

    filteredVisits.forEach((v: any) => {
      const d = getBusinessDate(v.visitDate);
      if (d === todayStr && v.statusId !== 'COMPLETED' && v.statusId !== 'CANCELLED') {
        dueTodayCount++;
        if (v.picId) todayVisitsByRep[v.picId] = (todayVisitsByRep[v.picId] || 0) + 1;
      } else if (d && d > todayStr && d <= upcomingWindowEnd && v.statusId !== 'COMPLETED' && v.statusId !== 'CANCELLED') {
        upcomingWorkCount++;
      }
      if (v.completedAt && getBusinessDate(v.completedAt) === todayStr && v.statusId === 'COMPLETED') {
        completedTodayCount++;
        if (v.picId) completedTodayByRep[v.picId] = (completedTodayByRep[v.picId] || 0) + 1;
      }
    });

    filteredFollowups.forEach((f: any) => {
      const d = getBusinessDate(f.followUpDate);
      if (d === todayStr && f.status !== 'COMPLETED' && f.status !== 'CANCELLED') {
        dueTodayCount++;
        if (f.picId) todayFollowupsByRep[f.picId] = (todayFollowupsByRep[f.picId] || 0) + 1;
      } else if (d && d > todayStr && d <= upcomingWindowEnd && f.status !== 'COMPLETED' && f.status !== 'CANCELLED') {
        upcomingWorkCount++;
      }
      if (f.completedAt && getBusinessDate(f.completedAt) === todayStr && f.status === 'COMPLETED') {
        completedTodayCount++;
        if (f.picId) completedTodayByRep[f.picId] = (completedTodayByRep[f.picId] || 0) + 1;
      }
    });

    // 13. Assemble Per-Rep Workload Summaries & Suspended Rep Policy
    const repWorkloads: any[] = [];
    const openProjectsByRep: Record<string, number> = {};
    filteredProjects.forEach((p: any) => {
      if (p.stageId !== 'WON' && p.stageId !== 'LOST' && p.picId) {
        openProjectsByRep[p.picId] = (openProjectsByRep[p.picId] || 0) + 1;
      }
    });

    const openTasksByRep: Record<string, number> = {};
    filteredTasks.forEach((t: any) => {
      if (t.statusId !== 'COMPLETED' && t.statusId !== 'CANCELLED' && t.picId) {
        openTasksByRep[t.picId] = (openTasksByRep[t.picId] || 0) + 1;
      }
    });

    const pendingFollowupsByRep: Record<string, number> = {};
    filteredFollowups.forEach((f: any) => {
      if (f.status !== 'COMPLETED' && f.status !== 'CANCELLED' && f.picId) {
        pendingFollowupsByRep[f.picId] = (pendingFollowupsByRep[f.picId] || 0) + 1;
      }
    });

    const attentionCountByRep: Record<string, number> = {};
    projectsNeedingAttentionList.forEach((p: any) => {
      if (p.picId) {
        attentionCountByRep[p.picId] = (attentionCountByRep[p.picId] || 0) + p.signals.length;
      }
    });

    const blockedCadenceCountByRep: Record<string, number> = {};
    blockedCadencesList.forEach((bc: any) => {
      if (bc.picId) {
        blockedCadenceCountByRep[bc.picId] = (blockedCadenceCountByRep[bc.picId] || 0) + 1;
      }
    });

    let operationalSalesRepCount = 0;

    for (const rep of authorizedReps) {
      const openProj = openProjectsByRep[rep.userId] || 0;
      const openTsk = openTasksByRep[rep.userId] || 0;
      const ovdAct = overdueByRep[rep.userId] || 0;
      const todVis = todayVisitsByRep[rep.userId] || 0;
      const todTsk = todayTasksByRep[rep.userId] || 0;
      const pndFlw = pendingFollowupsByRep[rep.userId] || 0;
      const attSig = attentionCountByRep[rep.userId] || 0;
      const blkCad = blockedCadenceCountByRep[rep.userId] || 0;
      const cmpTod = completedTodayByRep[rep.userId] || 0;

      const totalUnresolvedWork = openProj + openTsk + ovdAct + todVis + todTsk + pndFlw + attSig + blkCad;

      // Suspended/inactive rep policy: Only include if they own unresolved operational work
      if (rep.status !== 'ACTIVE' && totalUnresolvedWork === 0) {
        continue;
      }

      // Operational sales rep count: active reps excluding pure administrative roles
      const isSalesRole = !rep.roleName || (!rep.roleName.includes('Admin') && !rep.roleName.includes('Super Admin'));
      if (rep.status === 'ACTIVE' && isSalesRole) {
        operationalSalesRepCount++;
      }

      repWorkloads.push({
        userId: rep.userId,
        name: rep.name,
        email: rep.email,
        avatarUrl: rep.avatarUrl,
        status: rep.status,
        teamId: rep.teamId,
        teamName: rep.teamName || 'General',
        openProjects: openProj,
        openTasks: openTsk,
        overdueActions: ovdAct,
        todayVisits: todVis,
        todayTasks: todTsk,
        pendingFollowups: pndFlw,
        attentionSignals: attSig,
        blockedCadences: blkCad,
        completedToday: cmpTod
      });
    }

    const openProjectsTotal = filteredProjects.filter((p: any) => p.stageId !== 'WON' && p.stageId !== 'LOST').length;

    res.json({
      businessDate: todayStr,
      evaluatedAt,
      scope: effectiveScope,
      summary: {
        activeSalesReps: requestedRepId ? (repWorkloads.length > 0 && repWorkloads[0].status === 'ACTIVE' ? 1 : 0) : operationalSalesRepCount,
        openProjects: openProjectsTotal,
        projectsNeedingAttention: projectsNeedingAttentionList.length,
        overdueActions: overdueWorkList.length,
        dueToday: dueTodayCount,
        upcomingWork: upcomingWorkCount,
        blockedCadences: blockedCadencesList.length,
        projectsMissingNextAction: projectsMissingNextActionCount,
        expectedCloseOverdue: expectedCloseOverdueCount,
        completedToday: completedTodayCount,
        criticalSignals: totalCriticalSignals,
        warningSignals: totalWarningSignals
      },
      reps: repWorkloads,
      projectsNeedingAttention: projectsNeedingAttentionList,
      overdueWork: overdueWorkList.slice(0, 50),
      blockedCadences: blockedCadencesList
    });
  } catch (err: any) {
    console.error('Error GET /api/management/control-tower:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});


import { Request, Response } from 'express';
import { pool } from '../db';
import { buildReportScopeWhere, validateTargetTenant } from '../utils/scope';
import { getBusinessDate } from '../utils/date';

export const VALID_INTERVENTION_SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'];
export const VALID_INTERVENTION_CONDITION_TYPES = [
  'STALLED_IN_STAGE',
  'MISSING_NEXT_ACTION',
  'OVERDUE_ACTION',
  'EXPECTED_CLOSE_OVERDUE',
  'INVALID_PIC',
  'BLOCKED_CADENCE',
  'ABOVE_HISTORICAL_MEDIAN',
  'ABOVE_HISTORICAL_P75'
];

export function calculatePercentile(values: number[], percentile: number): number {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (upper >= sorted.length) return sorted[sorted.length - 1];
  return Math.round((sorted[lower] * (1 - weight) + sorted[upper] * weight) * 10) / 10;
}

export function getRecommendedActionsForIntervention(conditions: string[]): Array<{ actionType: string; description: string; path: string }> {
  const actions: Array<{ actionType: string; description: string; path: string }> = [];
  if (conditions.includes('MISSING_NEXT_ACTION')) {
    actions.push({ actionType: 'CREATE_ACTION', description: 'Schedule a task, visit, or follow-up to maintain deal velocity.', path: '/tasks' });
  }
  if (conditions.includes('OVERDUE_ACTION')) {
    actions.push({ actionType: 'RESOLVE_OVERDUE', description: 'Execute or reschedule overdue actions for this project.', path: '/tasks' });
  }
  if (conditions.includes('EXPECTED_CLOSE_OVERDUE')) {
    actions.push({ actionType: 'UPDATE_CLOSE_DATE', description: 'Update the project expected close date based on latest customer forecast.', path: '/projects' });
  }
  if (conditions.includes('INVALID_PIC')) {
    actions.push({ actionType: 'REASSIGN_PIC', description: 'Reassign project PIC to an active tenant sales representative.', path: '/projects' });
  }
  if (conditions.includes('BLOCKED_CADENCE')) {
    actions.push({ actionType: 'UNBLOCK_CADENCE', description: 'Review stalled sequence/follow-up blockers with team supervisor.', path: '/follow-ups' });
  }
  if (conditions.includes('ABOVE_HISTORICAL_MEDIAN') || conditions.includes('ABOVE_HISTORICAL_P75')) {
    actions.push({ actionType: 'STAGE_REVIEW', description: 'Conduct management deal review to identify bottlenecks in stage progression.', path: '/reports' });
  }
  return actions;
}

// ─────────────────────────────────────────────────────────────
// 1. GET /project-interventions
// ─────────────────────────────────────────────────────────────
export async function handleGetProjectInterventions(req: Request, res: Response) {
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
    const hasViewPerm = actorRole === 'SUPER_ADMIN' ||
      actorPermissions.includes('ALL') ||
      actorPermissions.includes('MANAGE_TENANT') ||
      actorPermissions.includes('VIEW_REPORTS') ||
      actorPermissions.includes('MANAGE_USERS');

    if (!hasViewPerm) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view project interventions.' });
    }

    let effectiveScope: 'OWN' | 'TEAM' | 'ORGANIZATION' = actorDataScope;
    if (actorRole === 'SUPER_ADMIN' || actorPermissions.includes('ALL') || actorPermissions.includes('MANAGE_TENANT')) {
      effectiveScope = 'ORGANIZATION';
    }

    const requestedTeamId = req.query.teamId ? String(req.query.teamId).trim() : null;
    const requestedRepId = req.query.repId ? String(req.query.repId).trim() : null;

    if (requestedRepId) {
      const [repRow]: any = await pool.query(
        "SELECT tu.id FROM tenant_users tu WHERE tu.userId = ? AND tu.tenantId = ? AND tu.status = 'ACTIVE'",
        [requestedRepId, targetTenant]
      );
      if (repRow.length === 0) {
        return res.status(403).json({ error: 'Access denied: Requested representative does not belong to target tenant.', code: 'BOLA_REPRESENTATIVE_VIOLATION' });
      }
    }

    if (requestedTeamId) {
      const [teamRow]: any = await pool.query(
        'SELECT id FROM teams WHERE id = ? AND tenantId = ?',
        [requestedTeamId, targetTenant]
      );
      if (teamRow.length === 0) {
        return res.status(403).json({ error: 'Access denied: Requested team does not belong to target tenant.', code: 'BOLA_TEAM_VIOLATION' });
      }

      if (effectiveScope === 'TEAM') {
        const [actorTeamRows]: any = await pool.query(
          "SELECT tm.teamId FROM team_members tm JOIN tenant_users tu ON tu.id = tm.tenantUserId WHERE tu.userId = ? AND tu.tenantId = ? AND tu.status = 'ACTIVE'",
          [actorUserId, targetTenant]
        );
        const actorTeamIds = new Set(actorTeamRows.map((t: any) => t.teamId));
        if (!actorTeamIds.has(requestedTeamId)) {
          return res.status(403).json({ error: 'Access denied to requested team (BOLA/Scope violation).' });
        }
      }
    }

    // 1. Fetch Active Intervention Policies for Target Tenant
    const [policies]: any = await pool.query(
      "SELECT p.* FROM project_intervention_policies p WHERE p.tenantId = ? AND p.status = 'ACTIVE' ORDER BY p.createdAt ASC",
      [targetTenant]
    );

    const interventionPolicyConfigured = policies.length > 0;
    const policyIds = policies.map((p: any) => p.id);

    let conditions: any[] = [];
    if (policyIds.length > 0) {
      const [cRows]: any = await pool.query(
        'SELECT * FROM project_intervention_policy_conditions WHERE policyId IN (?)',
        [policyIds]
      );
      conditions = cRows;
    }

    const conditionsByPolicy: Record<string, string[]> = {};
    for (const c of conditions) {
      if (!conditionsByPolicy[c.policyId]) conditionsByPolicy[c.policyId] = [];
      conditionsByPolicy[c.policyId].push(c.conditionType);
    }

    // 2. Fetch Velocity Comparison Policy
    const [velocityPolicyRows]: any = await pool.query(
      "SELECT settingValue FROM tenant_settings WHERE tenantId = ? AND settingKey = 'velocityMinComparisonSampleSize'",
      [targetTenant]
    );

    let velocityComparisonPolicyConfigured = false;
    let velocityMinComparisonSampleSize: number | null = null;
    if (velocityPolicyRows.length > 0 && velocityPolicyRows[0].settingValue) {
      const parsed = parseInt(velocityPolicyRows[0].settingValue, 10);
      if (!isNaN(parsed) && parsed > 0 && String(parsed) === String(velocityPolicyRows[0].settingValue).trim()) {
        velocityComparisonPolicyConfigured = true;
        velocityMinComparisonSampleSize = parsed;
      }
    }

    // 3. Batch Fetch Historical Stage Transitions for Baseline
    const [allHistories]: any = await pool.query(
      'SELECT psh.id, psh.projectId, psh.fromStageId, psh.toStageId, psh.changedAt, p.createdAt as projectCreatedAt FROM project_stage_histories psh JOIN projects p ON p.id = psh.projectId WHERE p.tenantId = ? ORDER BY psh.projectId ASC, psh.changedAt ASC, psh.id ASC',
      [targetTenant]
    );

    const historiesByProject: Record<string, any[]> = {};
    for (const h of allHistories) {
      if (!historiesByProject[h.projectId]) historiesByProject[h.projectId] = [];
      historiesByProject[h.projectId].push(h);
    }

    const [tenantStages]: any = await pool.query(
      'SELECT id, code, name, phase, commercialOutcome, isTerminal FROM project_stages WHERE tenantId = ? AND isActive = 1',
      [targetTenant]
    );

    const stageMap = new Map<string, any>();
    tenantStages.forEach((s: any) => {
      stageMap.set(s.id, s);
      if (s.code) stageMap.set(s.code, s);
    });

    const stageDurations: Record<string, number[]> = {};
    tenantStages.forEach((s: any) => {
      stageDurations[s.id] = [];
    });

    for (const [projId, pHistList] of Object.entries(historiesByProject)) {
      for (let i = 0; i < pHistList.length; i++) {
        const curr = pHistList[i];
        const prevTime = i === 0
          ? (curr.projectCreatedAt ? new Date(curr.projectCreatedAt).getTime() : new Date(curr.changedAt).getTime())
          : new Date(pHistList[i - 1].changedAt).getTime();
        const currTime = new Date(curr.changedAt).getTime();

        if (currTime < prevTime || !curr.fromStageId || !curr.toStageId || curr.fromStageId === curr.toStageId) continue;
        const durationDays = Math.max(0, Math.round((currTime - prevTime) / (1000 * 60 * 60 * 24)));
        const matched = stageMap.get(curr.fromStageId);
        if (matched && stageDurations[matched.id]) {
          stageDurations[matched.id].push(durationDays);
        }
      }
    }

    const baselineMap: Record<string, any> = {};
    for (const st of tenantStages) {
      const arr = stageDurations[st.id] || [];
      const sSorted = [...arr].sort((a, b) => a - b);
      const sampleSize = arr.length;
      const statisticsAvailable = sampleSize > 0;
      const comparisonAvailable = velocityComparisonPolicyConfigured && velocityMinComparisonSampleSize !== null && sampleSize >= velocityMinComparisonSampleSize;
      const medianDays = sampleSize > 0 ? calculatePercentile(sSorted, 50) : null;
      const p75Days = sampleSize > 0 ? calculatePercentile(sSorted, 75) : null;
      baselineMap[st.id] = { stageId: st.id, sampleSize, statisticsAvailable, comparisonAvailable, medianDays, p75Days };
      if (st.code) baselineMap[st.code] = baselineMap[st.id];
    }

    // 4. Batch Fetch Scoped Open Projects
    const { where: projWhere, params: projParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, effectiveScope, actorPermissions, 'p.picId');
    let openProjSql = `
      SELECT 
        p.id, p.title, p.customerId, p.picId, p.stageId, p.value, p.probability, p.expectedCloseDate, p.createdAt,
        c.name as customerName,
        u.name as picName, u.email as picEmail,
        tu.id as picTenantUserId, tu.status as picTenantUserStatus,
        tm.teamId as picTeamId, t.name as picTeamName,
        ps.name as stageName, ps.code as stageCode, ps.commercialOutcome as stageOutcome, ps.isTerminal as stageIsTerminal
      FROM projects p
      LEFT JOIN customers c ON c.id = p.customerId
      LEFT JOIN users u ON u.id = p.picId
      LEFT JOIN tenant_users tu ON tu.userId = p.picId AND tu.tenantId = p.tenantId
      LEFT JOIN team_members tm ON tm.tenantUserId = tu.id
      LEFT JOIN teams t ON t.id = tm.teamId
      LEFT JOIN project_stages ps ON ps.id = p.stageId AND ps.tenantId = p.tenantId
      ${projWhere.replace(/WHERE tenantId/g, 'WHERE p.tenantId')}
    `;
    const openProjParams = [...projParams];

    if (requestedRepId) {
      openProjSql += ' AND p.picId = ?';
      openProjParams.push(requestedRepId);
    }
    if (requestedTeamId) {
      openProjSql += ' AND tm.teamId = ?';
      openProjParams.push(requestedTeamId);
    }

    openProjSql += ' ORDER BY p.id DESC';
    const [scopedOpenProjects]: any = await pool.query(openProjSql, openProjParams);

    // Filter out closed/terminal deals
    const activeProjects = scopedOpenProjects.filter((p: any) => {
      const outcome = p.stageOutcome || 'NONE';
      const isTerminal = Boolean(p.stageIsTerminal);
      return outcome !== 'WON' && outcome !== 'LOST' && outcome !== 'CANCELLED' && !isTerminal && p.stageId !== 'WON' && p.stageId !== 'LOST';
    });

    const scopedProjectIds = activeProjects.map((p: any) => p.id);

    // 5. Batch Fetch Tasks, Visits, Follow-ups
    let openTasks: any[] = [];
    let openVisits: any[] = [];
    let openFollowups: any[] = [];
    let blockedCadencesList: any[] = [];

    if (scopedProjectIds.length > 0) {
      const [tRows]: any = await pool.query(
        "SELECT id, relatedProjectId as projectId, title, dueDate, statusId FROM tasks WHERE tenantId = ? AND relatedProjectId IN (?) AND completedAt IS NULL",
        [targetTenant, scopedProjectIds]
      );
      openTasks = tRows;

      const [vRows]: any = await pool.query(
        "SELECT id, relatedProjectId as projectId, title, visitDate, statusId FROM visits WHERE tenantId = ? AND relatedProjectId IN (?) AND completedAt IS NULL",
        [targetTenant, scopedProjectIds]
      );
      openVisits = vRows;

      const [fRows]: any = await pool.query(
        "SELECT id, relatedProjectId as projectId, title, followUpDate as scheduledAt, status FROM follow_ups WHERE tenantId = ? AND relatedProjectId IN (?) AND (status != 'COMPLETED' OR status IS NULL) AND completedAt IS NULL",
        [targetTenant, scopedProjectIds]
      );
      openFollowups = fRows;

      try {
        const [cadRows]: any = await pool.query(
          'SELECT id, projectId, status, isBlocked FROM sequence_cadences WHERE tenantId = ? AND projectId IN (?) AND isBlocked = 1',
          [targetTenant, scopedProjectIds]
        );
        blockedCadencesList = cadRows;
      } catch {
        blockedCadencesList = [];
      }
    }

    const tasksByProject: Record<string, any[]> = {};
    for (const t of openTasks) {
      if (!tasksByProject[t.projectId]) tasksByProject[t.projectId] = [];
      tasksByProject[t.projectId].push(t);
    }

    const visitsByProject: Record<string, any[]> = {};
    for (const v of openVisits) {
      if (!visitsByProject[v.projectId]) visitsByProject[v.projectId] = [];
      visitsByProject[v.projectId].push(v);
    }

    const followupsByProject: Record<string, any[]> = {};
    for (const f of openFollowups) {
      if (!followupsByProject[f.projectId]) followupsByProject[f.projectId] = [];
      followupsByProject[f.projectId].push(f);
    }

    const blockedCadencesByProject: Record<string, any[]> = {};
    for (const c of blockedCadencesList) {
      if (!blockedCadencesByProject[c.projectId]) blockedCadencesByProject[c.projectId] = [];
      blockedCadencesByProject[c.projectId].push(c);
    }

    // 6. Evaluate Each Project
    let totalProjectsEvaluated = activeProjects.length;
    let projectsWithMatchedInterventions = 0;
    let unknownEvaluationProjectsCount = 0;
    let criticalInterventionsCount = 0;
    let warningInterventionsCount = 0;
    let infoInterventionsCount = 0;

    const evaluatedProjects = activeProjects.map((p: any) => {
      const pHistList = historiesByProject[p.id] || [];
      const stageEnteredAt = pHistList.length > 0
        ? pHistList[pHistList.length - 1].changedAt
        : (p.createdAt || evaluatedAt);

      const daysInCurrentStage = stageEnteredAt
        ? Math.max(0, Math.round((new Date(evaluatedAt).getTime() - new Date(stageEnteredAt).getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      const pTasks = tasksByProject[p.id] || [];
      const pVisits = visitsByProject[p.id] || [];
      const pFollowups = followupsByProject[p.id] || [];
      const pBlockedCadences = blockedCadencesByProject[p.id] || [];

      const hasOpenAction = pTasks.length > 0 || pVisits.length > 0 || pFollowups.length > 0;
      const missingNextAction = !hasOpenAction;

      const hasOverdueTask = pTasks.some((t: any) => t.dueDate && String(t.dueDate).slice(0, 10) < todayStr);
      const hasOverdueVisit = pVisits.some((v: any) => v.visitDate && String(v.visitDate).slice(0, 10) < todayStr);
      const hasOverdueFollowup = pFollowups.some((f: any) => f.scheduledAt && String(f.scheduledAt).slice(0, 10) < todayStr);
      const hasOverdueAction = hasOverdueTask || hasOverdueVisit || hasOverdueFollowup;

      const expectedCloseDateStr = p.expectedCloseDate ? String(p.expectedCloseDate).slice(0, 10) : null;
      const isExpectedCloseOverdue = Boolean(expectedCloseDateStr && expectedCloseDateStr < todayStr);

      const isInvalidPic = !p.picId || !p.picTenantUserId || p.picTenantUserStatus !== 'ACTIVE';
      const isCadenceBlocked = pBlockedCadences.length > 0;

      const base = baselineMap[p.stageId];
      const isAboveMedian = Boolean(base && base.comparisonAvailable && base.medianDays !== null && daysInCurrentStage !== null && daysInCurrentStage > base.medianDays);
      const isAboveP75 = Boolean(base && base.comparisonAvailable && base.p75Days !== null && daysInCurrentStage !== null && daysInCurrentStage > base.p75Days);

      const supportingFacts = {
        daysInCurrentStage,
        hasOpenAction,
        missingNextAction,
        hasOverdueAction,
        expectedCloseDate: expectedCloseDateStr,
        isExpectedCloseOverdue,
        isInvalidPic,
        isCadenceBlocked,
        baselineMedianDays: base?.medianDays ?? null,
        baselineP75Days: base?.p75Days ?? null,
        velocityComparisonAvailable: base?.comparisonAvailable ?? false
      };

      const matchedInterventions: any[] = [];
      const unknownPolicies: any[] = [];

      if (policies.length > 0) {
        for (const pol of policies) {
          const condList: string[] = conditionsByPolicy[pol.id] || [];
          if (condList.length === 0) continue;

          let hasNotMatched = false;
          let hasUnknownCondition = false;
          const conditionEvaluations: any[] = [];

          for (const cond of condList) {
            let condState: 'MATCHED' | 'NOT_MATCHED' | 'UNKNOWN' = 'NOT_MATCHED';
            let condReason: string | null = null;

            if (cond === 'STALLED_IN_STAGE') {
              condState = (daysInCurrentStage !== null && daysInCurrentStage > 14) ? 'MATCHED' : 'NOT_MATCHED';
            } else if (cond === 'MISSING_NEXT_ACTION') {
              condState = missingNextAction ? 'MATCHED' : 'NOT_MATCHED';
            } else if (cond === 'OVERDUE_ACTION') {
              condState = hasOverdueAction ? 'MATCHED' : 'NOT_MATCHED';
            } else if (cond === 'EXPECTED_CLOSE_OVERDUE') {
              condState = isExpectedCloseOverdue ? 'MATCHED' : 'NOT_MATCHED';
            } else if (cond === 'INVALID_PIC') {
              condState = isInvalidPic ? 'MATCHED' : 'NOT_MATCHED';
            } else if (cond === 'BLOCKED_CADENCE') {
              condState = isCadenceBlocked ? 'MATCHED' : 'NOT_MATCHED';
            } else if (cond === 'ABOVE_HISTORICAL_MEDIAN') {
              if (daysInCurrentStage === null) {
                condState = 'UNKNOWN';
                condReason = 'UNKNOWN_STAGE_ENTRY';
              } else if (!velocityComparisonPolicyConfigured) {
                condState = 'UNKNOWN';
                condReason = 'VELOCITY_POLICY_NOT_CONFIGURED';
              } else if (!base || !base.comparisonAvailable) {
                condState = 'UNKNOWN';
                condReason = 'INSUFFICIENT_VELOCITY_SAMPLE';
              } else {
                condState = isAboveMedian ? 'MATCHED' : 'NOT_MATCHED';
              }
            } else if (cond === 'ABOVE_HISTORICAL_P75') {
              if (daysInCurrentStage === null) {
                condState = 'UNKNOWN';
                condReason = 'UNKNOWN_STAGE_ENTRY';
              } else if (!velocityComparisonPolicyConfigured) {
                condState = 'UNKNOWN';
                condReason = 'VELOCITY_POLICY_NOT_CONFIGURED';
              } else if (!base || !base.comparisonAvailable) {
                condState = 'UNKNOWN';
                condReason = 'INSUFFICIENT_VELOCITY_SAMPLE';
              } else {
                condState = isAboveP75 ? 'MATCHED' : 'NOT_MATCHED';
              }
            }

            conditionEvaluations.push({ conditionType: cond, state: condState, reason: condReason });

            if (condState === 'NOT_MATCHED') hasNotMatched = true;
            else if (condState === 'UNKNOWN') hasUnknownCondition = true;
          }

          let policyOutcome: 'MATCHED' | 'NOT_MATCHED' | 'UNKNOWN' = 'NOT_MATCHED';
          if (hasNotMatched) policyOutcome = 'NOT_MATCHED';
          else if (hasUnknownCondition) policyOutcome = 'UNKNOWN';
          else policyOutcome = 'MATCHED';

          if (policyOutcome === 'MATCHED') {
            matchedInterventions.push({
              policyId: pol.id,
              policyCode: pol.code,
              policyName: pol.name,
              severity: pol.severity,
              matchMode: pol.matchMode,
              matchedConditions: condList,
              conditionEvaluations,
              recommendedActions: getRecommendedActionsForIntervention(condList)
            });

            if (pol.severity === 'CRITICAL') criticalInterventionsCount++;
            else if (pol.severity === 'WARNING') warningInterventionsCount++;
            else infoInterventionsCount++;
          } else if (policyOutcome === 'UNKNOWN') {
            unknownPolicies.push({
              policyId: pol.id,
              policyCode: pol.code,
              policyName: pol.name,
              severity: pol.severity,
              matchMode: pol.matchMode,
              conditions: condList,
              conditionEvaluations
            });
          }
        }
      }

      const interventionStatus: 'NONE' | 'MATCHED' | 'UNKNOWN' =
        matchedInterventions.length > 0
          ? 'MATCHED'
          : unknownPolicies.length > 0
          ? 'UNKNOWN'
          : 'NONE';

      if (interventionStatus === 'MATCHED') projectsWithMatchedInterventions++;
      if (interventionStatus === 'UNKNOWN') unknownEvaluationProjectsCount++;

      return {
        projectId: p.id,
        projectTitle: p.title,
        customerId: p.customerId,
        customerName: p.customerName || 'Unknown Customer',
        picId: p.picId,
        picName: p.picName || 'Unassigned',
        picTeamName: p.picTeamName || 'General',
        stageId: p.stageName || p.stageId,
        stageRawId: p.stageId,
        stageName: p.stageName || p.stageId,
        value: p.value !== null ? Number(p.value) : null,
        probability: p.probability !== null ? Number(p.probability) : null,
        expectedCloseDate: expectedCloseDateStr,
        stageEnteredAt,
        daysInCurrentStage,
        supportingFacts,
        interventionStatus,
        interventions: matchedInterventions,
        unknownPolicies
      };
    });

    res.json({
      businessDate: todayStr,
      evaluatedAt,
      scope: effectiveScope,
      interventionPolicyConfigured,
      activePoliciesCount: policies.length,
      summary: {
        totalProjectsEvaluated,
        projectsWithMatchedInterventions,
        unknownEvaluationProjectsCount,
        criticalInterventionsCount,
        warningInterventionsCount,
        infoInterventionsCount
      },
      currentProjects: evaluatedProjects,
      items: evaluatedProjects
    });

  } catch (err: any) {
    console.error('Error in GET /project-interventions:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
// 2. GET /project-intervention-history
// ─────────────────────────────────────────────────────────────
export async function handleGetProjectInterventionHistory(req: Request, res: Response) {
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

  try {
    const hasViewPerm = actorRole === 'SUPER_ADMIN' ||
      actorPermissions.includes('ALL') ||
      actorPermissions.includes('MANAGE_TENANT') ||
      actorPermissions.includes('VIEW_REPORTS') ||
      actorPermissions.includes('MANAGE_USERS');

    if (!hasViewPerm) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view intervention history.' });
    }

    let effectiveScope: 'OWN' | 'TEAM' | 'ORGANIZATION' = actorDataScope;
    if (actorRole === 'SUPER_ADMIN' || actorPermissions.includes('ALL') || actorPermissions.includes('MANAGE_TENANT')) {
      effectiveScope = 'ORGANIZATION';
    }

    const { projectId, policyId, repId, teamId, dateFrom, dateTo } = req.query;

    if (repId) {
      const [repRow]: any = await pool.query(
        "SELECT tu.id FROM tenant_users tu WHERE tu.userId = ? AND tu.tenantId = ? AND tu.status = 'ACTIVE'",
        [String(repId).trim(), targetTenant]
      );
      if (repRow.length === 0) {
        return res.status(403).json({ error: 'Access denied: Requested representative does not belong to target tenant.', code: 'BOLA_REPRESENTATIVE_VIOLATION' });
      }
    }

    if (teamId) {
      const [teamRow]: any = await pool.query(
        'SELECT id FROM teams WHERE id = ? AND tenantId = ?',
        [String(teamId).trim(), targetTenant]
      );
      if (teamRow.length === 0) {
        return res.status(403).json({ error: 'Access denied: Requested team does not belong to target tenant.', code: 'BOLA_TEAM_VIOLATION' });
      }
    }

    let sql = `
      SELECT 
        pie.*,
        p.title as projectTitle,
        p.picId as currentPicId,
        c.name as customerName,
        u.name as picName
      FROM project_intervention_episodes pie
      JOIN projects p ON p.id = pie.projectId
      LEFT JOIN customers c ON c.id = p.customerId
      LEFT JOIN users u ON u.id = p.picId
      LEFT JOIN tenant_users tu ON tu.userId = p.picId AND tu.tenantId = pie.tenantId
      LEFT JOIN team_members tm ON tm.tenantUserId = tu.id
      WHERE pie.tenantId = ?
    `;
    const params: any[] = [targetTenant];

    if (effectiveScope === 'OWN') {
      sql += ' AND p.picId = ?';
      params.push(actorUserId);
    } else if (effectiveScope === 'TEAM') {
      const [actorTeamRows]: any = await pool.query(
        'SELECT tm.teamId FROM team_members tm JOIN tenant_users tu ON tu.id = tm.tenantUserId WHERE tu.userId = ? AND tu.tenantId = ?',
        [actorUserId, targetTenant]
      );
      const teamIds = actorTeamRows.map((r: any) => r.teamId);
      if (teamIds.length > 0) {
        sql += ' AND tm.teamId IN (?)';
        params.push(teamIds);
      } else {
        sql += ' AND p.picId = ?';
        params.push(actorUserId);
      }
    }

    if (projectId) {
      sql += ' AND pie.projectId = ?';
      params.push(projectId);
    }
    if (policyId) {
      sql += ' AND pie.policyId = ?';
      params.push(policyId);
    }
    if (repId) {
      sql += ' AND p.picId = ?';
      params.push(repId);
    }
    if (teamId) {
      sql += ' AND tm.teamId = ?';
      params.push(teamId);
    }
    if (dateFrom) {
      sql += ' AND pie.startedAt >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND pie.startedAt <= ?';
      params.push(dateTo);
    }

    sql += ' ORDER BY pie.startedAt DESC, pie.id DESC';

    const [rows]: any = await pool.query(sql, params);

    const episodes = rows.map((r: any) => {
      const durationHours = r.durationHours !== null ? Number(r.durationHours) : null;
      const durationDays = r.durationDays !== null ? Number(r.durationDays) : null;

      let conds: any = [];
      try {
        conds = typeof r.conditionSnapshot === 'string' ? JSON.parse(r.conditionSnapshot) : (r.conditionSnapshot || []);
      } catch {
        conds = [];
      }

      return {
        id: r.id,
        tenantId: r.tenantId,
        projectId: r.projectId,
        projectTitle: r.projectTitle,
        customerName: r.customerName || 'Unknown Customer',
        currentPicId: r.currentPicId,
        picName: r.picName || 'Unassigned',
        picIdSnapshot: r.picIdSnapshot,
        policyId: r.policyId,
        policyCode: r.policyCodeSnapshot,
        policyName: r.policyNameSnapshot,
        severity: r.severitySnapshot,
        matchMode: r.matchModeSnapshot,
        conditions: conds,
        startReason: r.startReason,
        endReason: r.endReason,
        startProvenance: r.startProvenance || 'TRANSITION_DETECTED',
        startedByEventType: r.startedByEventType,
        endedByEventType: r.endedByEventType,
        startedByUserId: r.startedByUserId,
        endedByUserId: r.endedByUserId,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        durationHours,
        durationDays,
        durationProvenance: r.startProvenance === 'TRANSITION_DETECTED' ? 'EXACT' : 'OBSERVED_PARTIAL',
        isActive: Boolean(r.isActive),
        createdAt: r.createdAt
      };
    });

    const activeEpisodesCount = episodes.filter((e: any) => e.isActive).length;
    const resolvedEpisodesCount = episodes.filter((e: any) => !e.isActive).length;
    const episodesWithExactStart = episodes.filter((e: any) => e.startProvenance === 'TRANSITION_DETECTED').length;
    const episodesWithObservedStart = episodes.filter((e: any) => e.startProvenance !== 'TRANSITION_DETECTED').length;
    const episodesWithExactDuration = episodes.filter((e: any) => !e.isActive && e.durationProvenance === 'EXACT').length;
    const episodesWithPartialObservedDuration = episodes.filter((e: any) => !e.isActive && e.durationProvenance === 'OBSERVED_PARTIAL').length;

    const [earliestRow]: any = await pool.query('SELECT MIN(startedAt) as earliest FROM project_intervention_episodes WHERE tenantId = ?', [targetTenant]);
    const historyCoverageStartAt = earliestRow.length > 0 ? earliestRow[0].earliest : null;

    res.json({
      tenantId: targetTenant,
      evaluatedAt: new Date().toISOString(),
      scope: effectiveScope,
      summary: {
        totalEpisodes: episodes.length,
        activeEpisodesCount,
        resolvedEpisodesCount,
        episodesWithExactStart,
        episodesWithObservedStart,
        episodesWithExactDuration,
        episodesWithPartialObservedDuration,
        historyCoverageStartAt
      },
      episodes,
      items: episodes,
      timeline: episodes
    });

  } catch (err: any) {
    console.error('Error in GET /project-intervention-history:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
// 3. GET /intervention-analytics
// ─────────────────────────────────────────────────────────────
export async function handleGetInterventionAnalytics(req: Request, res: Response) {
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

  try {
    const hasViewPerm = actorRole === 'SUPER_ADMIN' ||
      actorPermissions.includes('ALL') ||
      actorPermissions.includes('MANAGE_TENANT') ||
      actorPermissions.includes('VIEW_REPORTS') ||
      actorPermissions.includes('MANAGE_USERS');

    if (!hasViewPerm) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view intervention analytics.' });
    }

    let effectiveScope: 'OWN' | 'TEAM' | 'ORGANIZATION' = actorDataScope;
    if (actorRole === 'SUPER_ADMIN' || actorPermissions.includes('ALL') || actorPermissions.includes('MANAGE_TENANT')) {
      effectiveScope = 'ORGANIZATION';
    }

    const { projectId, policyId, repId, teamId, dateFrom, dateTo, status } = req.query;

    let sql = `
      SELECT 
        pie.*,
        p.title as projectTitle,
        p.picId as currentPicId,
        c.name as customerName,
        u.name as picName,
        snapU.name as picSnapshotName,
        t.name as teamName
      FROM project_intervention_episodes pie
      JOIN projects p ON p.id = pie.projectId
      LEFT JOIN customers c ON c.id = p.customerId
      LEFT JOIN users u ON u.id = p.picId
      LEFT JOIN users snapU ON snapU.id = pie.picIdSnapshot
      LEFT JOIN tenant_users tu ON tu.userId = p.picId AND tu.tenantId = pie.tenantId
      LEFT JOIN team_members tm ON tm.tenantUserId = tu.id
      LEFT JOIN teams t ON t.id = pie.teamIdSnapshot
      WHERE pie.tenantId = ?
    `;
    const params: any[] = [targetTenant];

    if (effectiveScope === 'OWN') {
      sql += ' AND p.picId = ?';
      params.push(actorUserId);
    } else if (effectiveScope === 'TEAM') {
      const [actorTeamRows]: any = await pool.query(
        'SELECT tm.teamId FROM team_members tm JOIN tenant_users tu ON tu.id = tm.tenantUserId WHERE tu.userId = ? AND tu.tenantId = ?',
        [actorUserId, targetTenant]
      );
      const teamIds = actorTeamRows.map((r: any) => r.teamId);
      if (teamIds.length > 0) {
        sql += ' AND tm.teamId IN (?)';
        params.push(teamIds);
      } else {
        sql += ' AND p.picId = ?';
        params.push(actorUserId);
      }
    }

    if (projectId) {
      sql += ' AND pie.projectId = ?';
      params.push(projectId);
    }
    if (policyId) {
      sql += ' AND pie.policyId = ?';
      params.push(policyId);
    }
    if (repId) {
      sql += ' AND p.picId = ?';
      params.push(repId);
    }
    if (teamId) {
      sql += ' AND tm.teamId = ?';
      params.push(teamId);
    }
    if (status === 'ACTIVE') {
      sql += ' AND pie.isActive = TRUE';
    } else if (status === 'RESOLVED') {
      sql += ' AND pie.isActive = FALSE';
    }
    if (dateFrom) {
      sql += ' AND pie.startedAt >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND pie.startedAt <= ?';
      params.push(dateTo);
    }

    sql += ' ORDER BY pie.projectId ASC, pie.policyId ASC, pie.startedAt ASC';

    const [rows]: any = await pool.query(sql, params);

    const totalEpisodes = rows.length;
    const activeEpisodes = rows.filter((r: any) => r.isActive).length;
    const closedEpisodes = rows.filter((r: any) => !r.isActive).length;
    const businessResolvedEpisodes = rows.filter((r: any) => !r.isActive && r.endReason === 'BUSINESS_STATE_CHANGED').length;
    const exactResolvedEpisodes = rows.filter((r: any) => !r.isActive && r.startProvenance === 'TRANSITION_DETECTED').length;
    const exactBusinessResolvedEpisodes = rows.filter((r: any) => !r.isActive && r.startProvenance === 'TRANSITION_DETECTED' && r.endReason === 'BUSINESS_STATE_CHANGED').length;
    const observedPartialResolvedEpisodes = rows.filter((r: any) => !r.isActive && r.startProvenance !== 'TRANSITION_DETECTED').length;

    const exactDurations = rows
      .filter((r: any) => !r.isActive && r.startProvenance === 'TRANSITION_DETECTED' && r.endReason === 'BUSINESS_STATE_CHANGED' && r.durationHours !== null)
      .map((r: any) => Number(r.durationHours));

    const sampleSize = exactDurations.length;
    const sortedDurations = [...exactDurations].sort((a: number, b: number) => a - b);
    const averageResolutionHours = sampleSize > 0 ? Math.round((exactDurations.reduce((a: number, b: number) => a + b, 0) / sampleSize) * 100) / 100 : null;
    const medianResolutionHours = sampleSize > 0 ? calculatePercentile(sortedDurations, 50) : null;
    const p25ResolutionHours = sampleSize > 0 ? calculatePercentile(sortedDurations, 25) : null;
    const p75ResolutionHours = sampleSize > 0 ? calculatePercentile(sortedDurations, 75) : null;
    const p90ResolutionHours = sampleSize > 0 ? calculatePercentile(sortedDurations, 90) : null;
    const minResolutionHours = sampleSize > 0 ? sortedDurations[0] : null;
    const maxResolutionHours = sampleSize > 0 ? sortedDurations[sampleSize - 1] : null;

    const endReasonBreakdown: Record<string, number> = {};
    for (const r of rows) {
      if (r.endReason) {
        endReasonBreakdown[r.endReason] = (endReasonBreakdown[r.endReason] || 0) + 1;
      }
    }

    const severityBreakdown: Record<string, number> = { INFO: 0, WARNING: 0, CRITICAL: 0 };
    for (const r of rows) {
      if (r.severitySnapshot && severityBreakdown[r.severitySnapshot] !== undefined) {
        severityBreakdown[r.severitySnapshot]++;
      }
    }

    const projectPolicyMap: Record<string, any[]> = {};
    const uniqueProjectIds = new Set<string>();
    const uniquePolicyIds = new Set<string>();

    for (const r of rows) {
      const key = `${r.projectId}::${r.policyId}`;
      if (!projectPolicyMap[key]) projectPolicyMap[key] = [];
      projectPolicyMap[key].push(r);
      uniqueProjectIds.add(r.projectId);
      uniquePolicyIds.add(r.policyId);
    }

    let totalRecurrences = 0;
    const recurringProjectsSet = new Set<string>();
    const repeatIntervals: number[] = [];
    const projectBreakdownMap: Record<string, any> = {};

    for (const [pairKey, epList] of Object.entries(projectPolicyMap)) {
      const pId = epList[0].projectId;
      const polId = epList[0].policyId;
      const epCount = epList.length;
      const recurrenceCount = Math.max(0, epCount - 1);

      if (recurrenceCount > 0) {
        totalRecurrences += recurrenceCount;
        recurringProjectsSet.add(pId);

        for (let i = 1; i < epList.length; i++) {
          const prev = epList[i - 1];
          const curr = epList[i];
          if (prev.endedAt && curr.startedAt) {
            const prevEnd = new Date(prev.endedAt).getTime();
            const currStart = new Date(curr.startedAt).getTime();
            if (currStart >= prevEnd) {
              const intHours = Math.round(((currStart - prevEnd) / (1000 * 60 * 60)) * 100) / 100;
              repeatIntervals.push(intHours);
            }
          }
        }
      }

      if (!projectBreakdownMap[pId]) {
        projectBreakdownMap[pId] = {
          projectId: pId,
          projectTitle: epList[0].projectTitle,
          customerName: epList[0].customerName || 'Unknown Customer',
          currentPicId: epList[0].currentPicId,
          picName: epList[0].picName || 'Unassigned',
          totalEpisodes: 0,
          activeEpisodes: 0,
          resolvedEpisodes: 0,
          recurrenceCount: 0,
          policies: []
        };
      }

      const pObj = projectBreakdownMap[pId];
      pObj.totalEpisodes += epCount;
      pObj.activeEpisodes += epList.filter((e: any) => e.isActive).length;
      pObj.resolvedEpisodes += epList.filter((e: any) => !e.isActive).length;
      pObj.recurrenceCount += recurrenceCount;
      pObj.policies.push({
        policyId: polId,
        policyCode: epList[0].policyCodeSnapshot,
        policyName: epList[0].policyNameSnapshot,
        severity: epList[0].severitySnapshot,
        episodeCount: epCount,
        recurrenceCount,
        hasActive: epList.some((e: any) => e.isActive)
      });
    }

    const sSortedIntervals = [...repeatIntervals].sort((a, b) => a - b);
    const averageRepeatIntervalHours = repeatIntervals.length > 0 ? Math.round((repeatIntervals.reduce((a, b) => a + b, 0) / repeatIntervals.length) * 100) / 100 : null;
    const medianRepeatIntervalHours = repeatIntervals.length > 0 ? calculatePercentile(sSortedIntervals, 50) : null;

    const policyMap: Record<string, any> = {};
    for (const r of rows) {
      if (!policyMap[r.policyId]) {
        policyMap[r.policyId] = {
          policyId: r.policyId,
          policyCode: r.policyCodeSnapshot,
          policyName: r.policyNameSnapshot,
          severity: r.severitySnapshot,
          totalEpisodes: 0,
          activeEpisodes: 0,
          resolvedEpisodes: 0,
          businessResolvedEpisodes: 0,
          exactDurations: [],
          uniqueProjects: new Set<string>(),
          recurringProjects: new Set<string>(),
          endReasons: {
            BUSINESS_STATE_CHANGED: 0,
            POLICY_DEACTIVATED: 0,
            POLICY_CHANGED: 0,
            EVALUATION_BECAME_UNKNOWN: 0,
            PROJECT_BECAME_TERMINAL: 0
          }
        };
      }
      const pol = policyMap[r.policyId];
      pol.totalEpisodes++;
      if (r.isActive) pol.activeEpisodes++;
      else {
        pol.resolvedEpisodes++;
        if (r.endReason === 'BUSINESS_STATE_CHANGED') pol.businessResolvedEpisodes++;
        if (r.startProvenance === 'TRANSITION_DETECTED' && r.endReason === 'BUSINESS_STATE_CHANGED' && r.durationHours !== null) {
          pol.exactDurations.push(Number(r.durationHours));
        }
        if (r.endReason) {
          pol.endReasons[r.endReason] = (pol.endReasons[r.endReason] || 0) + 1;
        }
      }
      pol.uniqueProjects.add(r.projectId);
    }

    for (const [pairKey, epList] of Object.entries(projectPolicyMap)) {
      const polId = epList[0].policyId;
      if (epList.length > 1 && policyMap[polId]) {
        policyMap[polId].recurringProjects.add(epList[0].projectId);
      }
    }

    const policyBreakdown = Object.values(policyMap).map((pol: any) => {
      const sorted = [...pol.exactDurations].sort((a: number, b: number) => a - b);
      const medianHours = sorted.length > 0 ? calculatePercentile(sorted, 50) : null;
      const averageHours = sorted.length > 0 ? Math.round((sorted.reduce((a: number, b: number) => a + b, 0) / sorted.length) * 100) / 100 : null;

      return {
        policyId: pol.policyId,
        policyCode: pol.policyCode,
        policyName: pol.policyName,
        severity: pol.severity,
        totalEpisodes: pol.totalEpisodes,
        activeEpisodes: pol.activeEpisodes,
        resolvedEpisodes: pol.resolvedEpisodes,
        businessResolvedEpisodes: pol.businessResolvedEpisodes,
        uniqueProjectsCount: pol.uniqueProjects.size,
        recurringProjectsCount: pol.recurringProjects.size,
        exactSampleSize: sorted.length,
        medianBusinessResolutionHours: medianHours,
        averageBusinessResolutionHours: averageHours,
        endReasons: pol.endReasons
      };
    });

    const repMap: Record<string, any> = {};
    for (const r of rows) {
      const repKey = r.picIdSnapshot || 'UNASSIGNED';
      if (!repMap[repKey]) {
        repMap[repKey] = {
          picId: r.picIdSnapshot || null,
          picName: r.picSnapshotName || (r.picIdSnapshot ? 'Former Assigned Rep' : 'Unassigned'),
          totalEpisodes: 0,
          activeEpisodes: 0,
          resolvedEpisodes: 0,
          businessResolvedEpisodes: 0,
          exactDurations: []
        };
      }
      const rep = repMap[repKey];
      rep.totalEpisodes++;
      if (r.isActive) rep.activeEpisodes++;
      else {
        rep.resolvedEpisodes++;
        if (r.endReason === 'BUSINESS_STATE_CHANGED') rep.businessResolvedEpisodes++;
        if (r.startProvenance === 'TRANSITION_DETECTED' && r.endReason === 'BUSINESS_STATE_CHANGED' && r.durationHours !== null) {
          rep.exactDurations.push(Number(r.durationHours));
        }
      }
    }

    const repBreakdown = Object.values(repMap).map((rep: any) => {
      const sorted = [...rep.exactDurations].sort((a: number, b: number) => a - b);
      const medianHours = sorted.length > 0 ? calculatePercentile(sorted, 50) : null;
      return {
        picId: rep.picId,
        picName: rep.picName,
        totalEpisodes: rep.totalEpisodes,
        activeEpisodes: rep.activeEpisodes,
        resolvedEpisodes: rep.resolvedEpisodes,
        businessResolvedEpisodes: rep.businessResolvedEpisodes,
        exactSampleSize: sorted.length,
        medianBusinessResolutionHours: medianHours
      };
    });

    const [earliestRow]: any = await pool.query('SELECT MIN(startedAt) as earliest FROM project_intervention_episodes WHERE tenantId = ?', [targetTenant]);
    const historyCoverageStartAt = earliestRow.length > 0 ? earliestRow[0].earliest : null;
    const exactDurationCoveragePercent = closedEpisodes > 0 ? Math.round((exactResolvedEpisodes / closedEpisodes) * 1000) / 10 : null;

    res.json({
      tenantId: targetTenant,
      evaluatedAt: new Date().toISOString(),
      scope: effectiveScope,
      summary: {
        totalEpisodes,
        activeEpisodes,
        closedEpisodes,
        businessResolvedEpisodes,
        exactResolvedEpisodes,
        exactBusinessResolvedEpisodes,
        observedPartialResolvedEpisodes,
        uniqueProjectsWithEpisodes: uniqueProjectIds.size,
        recurringProjectCount: recurringProjectsSet.size,
        totalRecurrences,
        policiesWithEpisodes: uniquePolicyIds.size
      },
      resolutionDuration: {
        metric: 'EXACT_BUSINESS_STATE_CHANGED_HOURS',
        sampleSize,
        averageResolutionHours,
        medianResolutionHours,
        p25ResolutionHours,
        p75ResolutionHours,
        p90ResolutionHours,
        minResolutionHours,
        maxResolutionHours
      },
      recurrence: {
        totalRecurrences,
        recurringProjectCount: recurringProjectsSet.size,
        repeatIntervalsSample: repeatIntervals.length,
        averageRepeatIntervalHours,
        medianRepeatIntervalHours
      },
      endReasonBreakdown,
      severityBreakdown,
      coverage: {
        historyCoverageStartAt,
        exactResolvedEpisodes,
        observedPartialResolvedEpisodes,
        exactDurationCoveragePercent
      },
      policyBreakdown,
      resolution: policyBreakdown,
      episodeHistory: rows.slice(0, 100),
      projectBreakdown: Object.values(projectBreakdownMap),
      repBreakdown
    });

  } catch (err: any) {
    console.error('Error in GET /intervention-analytics:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}

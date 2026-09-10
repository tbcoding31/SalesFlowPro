import { Router } from 'express';
import { pool } from '../db';
import { validateTargetTenant, buildReportScopeWhere } from '../utils/scope';
import { getBusinessDate } from '../utils/date';

export const reportsRoutes = Router();

// ─────────────────────────────────────────────────────────────
// 1. GET /api/reports/customers
// ─────────────────────────────────────────────────────────────
reportsRoutes.get('/customers', async (req: any, res: any) => {
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
    const { where: custWhere, params: custParams } = buildReportScopeWhere(
      targetTenant,
      actorUserId,
      actorRole,
      actorDataScope,
      actorPermissions,
      'c.picId'
    );

    // 1. Fetch Customers with Tenant Master Joins
    const [customers]: any = await pool.query(`
      SELECT 
        c.id, c.code, c.name, c.industry, c.picId, c.createdAt,
        u.name as picName,
        cs.code as statusCode, cs.name as statusName, cs.color as statusColor,
        ct.code as typeCode, ct.name as typeName,
        (SELECT COUNT(p.id) FROM projects p WHERE p.customerId = c.id AND p.tenantId = c.tenantId) as totalProjects,
        (SELECT COUNT(v.id) FROM visits v WHERE v.customerId = c.id AND v.tenantId = c.tenantId) as totalVisits
      FROM customers c
      LEFT JOIN customer_statuses cs ON cs.id = c.statusId AND cs.tenantId = c.tenantId
      LEFT JOIN customer_types ct ON ct.id = c.typeId AND ct.tenantId = c.tenantId
      LEFT JOIN users u ON u.id = c.picId
      ${custWhere.replace(/WHERE tenantId/g, 'WHERE c.tenantId')}
      ORDER BY c.createdAt DESC
    `, custParams);

    // 2. Compute Authoritative KPI
    const totalCustomers = customers.length;
    let activeCustomers = 0;
    let inactiveCustomers = 0;
    let prospects = 0;
    let wonCustomers = 0;

    const statusCounts: Record<string, { count: number; color: string; name: string }> = {};
    const picCounts: Record<string, number> = {};

    for (const c of customers) {
      const sCode = c.statusCode || 'ACTIVE';
      const sName = c.statusName || sCode;
      const sColor = c.statusColor || '#6366F1';

      if (sCode === 'ACTIVE') activeCustomers++;
      else if (sCode === 'INACTIVE') inactiveCustomers++;
      else if (sCode === 'PROSPECT') prospects++;
      else if (sCode === 'WON') wonCustomers++;
      else activeCustomers++;

      if (!statusCounts[sName]) {
        statusCounts[sName] = { count: 0, color: sColor, name: sName };
      }
      statusCounts[sName].count++;

      const pic = c.picName || 'Unassigned';
      picCounts[pic] = (picCounts[pic] || 0) + 1;
    }

    const customersByStatus = Object.values(statusCounts).map(s => ({
      name: s.name,
      value: s.count,
      color: s.color
    }));

    const customersByPic = Object.entries(picCounts).map(([name, count]) => ({
      name,
      count
    }));

    const tableData = customers.map((c: any) => ({
      id: c.id,
      code: c.code || '-',
      name: c.name,
      industry: c.industry || '-',
      type: c.typeName || c.typeCode || 'General',
      status: c.statusName || c.statusCode || 'Active',
      picName: c.picName || 'Unassigned',
      totalProjects: c.totalProjects || 0,
      totalVisits: c.totalVisits || 0
    }));

    res.json({
      kpi: {
        totalCustomers,
        activeCustomers,
        inactiveCustomers,
        prospects,
        wonCustomers
      },
      customersByStatus,
      customersByPic,
      tableData
    });
  } catch (err: any) {
    console.error('GET /api/reports/customers error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. GET /api/reports/tasks
// ─────────────────────────────────────────────────────────────
reportsRoutes.get('/tasks', async (req: any, res: any) => {
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
    const { where: taskWhere, params: taskParams } = buildReportScopeWhere(
      targetTenant,
      actorUserId,
      actorRole,
      actorDataScope,
      actorPermissions,
      't.picId'
    );

    const [tasks]: any = await pool.query(`
      SELECT 
        t.id, t.title, t.dueDate, t.completedAt, t.createdAt, t.picId,
        c.name as customerName,
        u.name as picName,
        ts.code as statusCode, ts.name as statusName, ts.color as statusColor, ts.isTerminal,
        tp.code as priorityCode, tp.name as priorityName, tp.color as priorityColor
      FROM tasks t
      LEFT JOIN task_statuses ts ON ts.id = t.statusId AND ts.tenantId = t.tenantId
      LEFT JOIN task_priorities tp ON tp.id = t.priorityId AND tp.tenantId = t.tenantId
      LEFT JOIN customers c ON c.id = t.customerId
      LEFT JOIN users u ON u.id = t.picId
      ${taskWhere.replace(/WHERE tenantId/g, 'WHERE t.tenantId')}
      ORDER BY t.dueDate ASC, t.createdAt DESC
    `, taskParams);

    const todayStr = getBusinessDate(new Date())!;
    let totalTasks = tasks.length;
    let completed = 0;
    let inProgress = 0;
    let overdue = 0;

    const picMap: Record<string, { tasks: number; completed: number; overdue: number }> = {};
    const priorityMap: Record<string, { value: number; color: string }> = {};

    const tableData = tasks.map((t: any) => {
      const isDone = t.statusCode === 'COMPLETED' || t.statusCode === 'TSK_COMPLETED' || t.isTerminal === 1;
      const dueStr = t.dueDate ? getBusinessDate(t.dueDate) : null;
      const isOver = !isDone && dueStr && dueStr < todayStr;
      const isInProg = t.statusCode === 'IN_PROGRESS' || t.statusCode === 'TSK_INPROGRESS';

      if (isDone) completed++;
      else if (isOver) overdue++;
      else if (isInProg) inProgress++;

      const pic = t.picName || 'Unassigned';
      if (!picMap[pic]) picMap[pic] = { tasks: 0, completed: 0, overdue: 0 };
      picMap[pic].tasks++;
      if (isDone) picMap[pic].completed++;
      if (isOver) picMap[pic].overdue++;

      const pName = t.priorityName || t.priorityCode || 'Medium';
      const pColor = t.priorityColor || '#F59E0B';
      if (!priorityMap[pName]) priorityMap[pName] = { value: 0, color: pColor };
      priorityMap[pName].value++;

      let displayStatus = 'TODO';
      if (isDone) displayStatus = 'COMPLETED';
      else if (isOver) displayStatus = 'OVERDUE';
      else if (isInProg) displayStatus = 'IN_PROGRESS';

      return {
        id: t.id,
        name: t.title,
        customer: t.customerName || 'Direct',
        pic: t.picName || 'Unassigned',
        priority: pName,
        status: displayStatus,
        dueDate: dueStr || '-',
        completedDate: t.completedAt ? getBusinessDate(t.completedAt) : '-'
      };
    });

    const completionRate = totalTasks > 0 ? parseFloat(((completed / totalTasks) * 100).toFixed(1)) : 0;

    const tasksByPicData = Object.entries(picMap).map(([name, data]) => ({
      name,
      tasks: data.tasks,
      completed: data.completed,
      overdue: data.overdue
    }));

    const tasksByPriorityData = Object.entries(priorityMap).map(([name, data]) => ({
      name,
      value: data.value,
      color: data.color
    }));

    // Weekly completion buckets
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayBuckets: Record<string, { completed: number; scheduled: number }> = {};
    daysOfWeek.forEach(d => { dayBuckets[d] = { completed: 0, scheduled: 0 }; });

    tasks.forEach((t: any) => {
      if (t.dueDate) {
        const d = new Date(t.dueDate);
        const dayName = daysOfWeek[d.getDay()];
        if (dayBuckets[dayName]) {
          dayBuckets[dayName].scheduled++;
          if (t.statusCode === 'COMPLETED' || t.statusCode === 'TSK_COMPLETED' || t.isTerminal === 1) {
            dayBuckets[dayName].completed++;
          }
        }
      }
    });

    const taskCompletionData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(name => ({
      name,
      completed: dayBuckets[name]?.completed || 0,
      scheduled: dayBuckets[name]?.scheduled || 0
    }));

    res.json({
      kpi: {
        totalTasks,
        completed,
        inProgress,
        overdue,
        completionRate
      },
      taskCompletionData,
      tasksByPicData,
      tasksByPriorityData,
      tableData
    });
  } catch (err: any) {
    console.error('GET /api/reports/tasks error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. GET /api/reports/visits
// ─────────────────────────────────────────────────────────────
reportsRoutes.get('/visits', async (req: any, res: any) => {
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
    const { where: visitWhere, params: visitParams } = buildReportScopeWhere(
      targetTenant,
      actorUserId,
      actorRole,
      actorDataScope,
      actorPermissions,
      'v.picId'
    );

    const [visits]: any = await pool.query(`
      SELECT 
        v.id, v.title, v.visitDate, v.startTime, v.endTime, v.result, v.completedAt,
        c.name as customerName,
        u.name as picName,
        vs.code as statusCode, vs.name as statusName, vs.color as statusColor, vs.isTerminal,
        vp.code as purposeCode, vp.name as purposeName
      FROM visits v
      LEFT JOIN visit_statuses vs ON vs.id = v.statusId AND vs.tenantId = v.tenantId
      LEFT JOIN visit_purposes vp ON vp.id = v.purposeId AND vp.tenantId = v.tenantId
      LEFT JOIN customers c ON c.id = v.customerId
      LEFT JOIN users u ON u.id = v.picId
      ${visitWhere.replace(/WHERE tenantId/g, 'WHERE v.tenantId')}
      ORDER BY v.visitDate DESC, v.startTime DESC
    `, visitParams);

    const totalVisits = visits.length;
    let completed = 0;
    let cancelled = 0;
    let rescheduled = 0;

    const picMap: Record<string, number> = {};
    const statusMap: Record<string, { value: number; color: string }> = {};
    const purposeMap: Record<string, { value: number; color: string }> = {};
    const purposePalette = ['#6366F1', '#8B5CF6', '#3B82F6', '#14B8A6', '#F59E0B'];

    const tableData = visits.map((v: any) => {
      const sCode = v.statusCode || 'SCHEDULED';
      const sName = v.statusName || sCode;
      const sColor = v.statusColor || '#3B82F6';

      if (sCode === 'COMPLETED') completed++;
      else if (sCode === 'CANCELLED') cancelled++;
      else if (sCode === 'RESCHEDULED') rescheduled++;

      const pic = v.picName || 'Unassigned';
      picMap[pic] = (picMap[pic] || 0) + 1;

      if (!statusMap[sName]) statusMap[sName] = { value: 0, color: sColor };
      statusMap[sName].value++;

      const purp = v.purposeName || v.purposeCode || 'General Visit';
      if (!purposeMap[purp]) {
        const colorIdx = Object.keys(purposeMap).length % purposePalette.length;
        purposeMap[purp] = { value: 0, color: purposePalette[colorIdx] };
      }
      purposeMap[purp].value++;

      let duration = '-';
      if (v.startTime && v.endTime) {
        duration = `${String(v.startTime).substring(0, 5)} - ${String(v.endTime).substring(0, 5)}`;
      }

      return {
        id: v.id,
        date: v.visitDate ? getBusinessDate(v.visitDate) : '-',
        customer: v.customerName || 'Direct',
        pic: v.picName || 'Unassigned',
        purpose: purp,
        status: sCode,
        duration,
        result: v.result || '-'
      };
    });

    const completionRate = totalVisits > 0 ? parseFloat(((completed / totalVisits) * 100).toFixed(1)) : 0;

    const visitsByPicData = Object.entries(picMap).map(([name, count]) => ({
      name,
      visits: count
    }));

    const visitsByStatusData = Object.entries(statusMap).map(([name, data]) => ({
      name,
      value: data.value,
      color: data.color
    }));

    const visitsByPurposeData = Object.entries(purposeMap).map(([name, data]) => ({
      name,
      value: data.value,
      color: data.color
    }));

    res.json({
      kpi: {
        totalVisits,
        completed,
        cancelled,
        rescheduled,
        completionRate
      },
      visitsByPicData,
      visitsByStatusData,
      visitsByPurposeData,
      tableData
    });
  } catch (err: any) {
    console.error('GET /api/reports/visits error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────
// 4. GET /api/reports/performance
// ─────────────────────────────────────────────────────────────
reportsRoutes.get('/performance', async (req: any, res: any) => {
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
    const { where: taskWhere, params: taskParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 't.picId');
    const { where: visitWhere, params: visitParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'v.picId');
    const { where: projWhere, params: projParams } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'p.picId');

    // 1. Tasks
    const [tasks]: any = await pool.query(`
      SELECT t.id, t.picId, t.completedAt, t.dueDate, ts.code as statusCode, ts.isTerminal
      FROM tasks t
      LEFT JOIN task_statuses ts ON ts.id = t.statusId AND ts.tenantId = t.tenantId
      ${taskWhere.replace(/WHERE tenantId/g, 'WHERE t.tenantId')}
    `, taskParams);

    // 2. Visits
    const [visits]: any = await pool.query(`
      SELECT v.id, v.picId, v.completedAt, vs.code as statusCode, vs.isTerminal
      FROM visits v
      LEFT JOIN visit_statuses vs ON vs.id = v.statusId AND vs.tenantId = v.tenantId
      ${visitWhere.replace(/WHERE tenantId/g, 'WHERE v.tenantId')}
    `, visitParams);

    // 3. Projects
    const [projects]: any = await pool.query(`
      SELECT p.id, p.picId, p.value, ps.commercialOutcome, ps.isTerminal
      FROM projects p
      LEFT JOIN project_stages ps ON ps.id = p.stageId AND ps.tenantId = p.tenantId
      ${projWhere.replace(/WHERE tenantId/g, 'WHERE p.tenantId')}
    `, projParams);

    // 4. Users in tenant
    const [users]: any = await pool.query(`
      SELECT u.id, u.name, u.avatar
      FROM tenant_users tu
      JOIN users u ON u.id = tu.userId
      WHERE tu.tenantId = ? AND tu.status = 'ACTIVE' AND u.status = 'ACTIVE'
    `, [targetTenant]);

    const todayStr = getBusinessDate(new Date())!;

    let totalVisits = visits.length;
    let completedVisits = 0;
    visits.forEach((v: any) => {
      if (v.statusCode === 'COMPLETED' || v.isTerminal === 1) completedVisits++;
    });

    let tasksCompleted = 0;
    let overdueTasks = 0;
    tasks.forEach((t: any) => {
      const isDone = t.statusCode === 'COMPLETED' || t.statusCode === 'TSK_COMPLETED' || t.isTerminal === 1;
      if (isDone) tasksCompleted++;
      else if (t.dueDate && getBusinessDate(t.dueDate)! < todayStr) overdueTasks++;
    });

    let wonProjects = 0;
    let lostProjects = 0;
    let openProjects = 0;
    let salesValue = 0;

    projects.forEach((p: any) => {
      const val = parseFloat(p.value || 0);
      if (p.commercialOutcome === 'WON') {
        wonProjects++;
        salesValue += val;
      } else if (p.commercialOutcome === 'LOST') {
        lostProjects++;
      } else {
        openProjects++;
      }
    });

    const totalResolved = wonProjects + lostProjects;
    const conversionRate = totalResolved > 0 ? parseFloat(((wonProjects / totalResolved) * 100).toFixed(1)) : 0;

    // Rep Leaderboard
    const repStats: Record<string, { id: string; name: string; avatar: string; visits: number; tasks: number; projects: number; won: number; salesValue: number }> = {};
    users.forEach((u: any) => {
      repStats[u.id] = {
        id: u.id,
        name: u.name,
        avatar: u.avatar || '',
        visits: 0,
        tasks: 0,
        projects: 0,
        won: 0,
        salesValue: 0
      };
    });

    visits.forEach((v: any) => {
      if (v.picId && repStats[v.picId]) repStats[v.picId].visits++;
    });
    tasks.forEach((t: any) => {
      if (t.picId && repStats[t.picId]) {
        if (t.statusCode === 'COMPLETED' || t.statusCode === 'TSK_COMPLETED' || t.isTerminal === 1) repStats[t.picId].tasks++;
      }
    });
    projects.forEach((p: any) => {
      if (p.picId && repStats[p.picId]) {
        repStats[p.picId].projects++;
        if (p.commercialOutcome === 'WON') {
          repStats[p.picId].won++;
          repStats[p.picId].salesValue += parseFloat(p.value || 0);
        }
      }
    });

    const rankingData = Object.values(repStats)
      .sort((a, b) => b.salesValue - a.salesValue || b.won - a.won)
      .slice(0, 10);

    res.json({
      kpiData: {
        visits: totalVisits,
        completedVisits,
        tasksCompleted,
        overdueTasks,
        wonProjects,
        salesValue,
        conversionRate
      },
      oppConversionData: [
        { name: 'Won', value: wonProjects, color: '#10B981' },
        { name: 'Lost', value: lostProjects, color: '#EF4444' },
        { name: 'Open', value: openProjects, color: '#6366F1' }
      ],
      rankingData
    });
  } catch (err: any) {
    console.error('GET /api/reports/performance error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

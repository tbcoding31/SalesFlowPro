import crypto from 'crypto';

export const TASK_SOURCE_TYPE = {
  MANUAL: 'MANUAL',
  PROJECT_ASSIGNMENT: 'PROJECT_ASSIGNMENT',
  VISIT_ASSIGNMENT: 'VISIT_ASSIGNMENT',
} as const;

export const TASK_STATUS = {
  TODO: 'TS-1',
  IN_PROGRESS: 'TS-2',
  COMPLETED: 'TS-3',
  CANCELLED: 'TS-4',
} as const;

export const TASK_PRIORITY = {
  URGENT: 'TP-1',
  HIGH: 'TP-2',
  MEDIUM: 'TP-3',
  LOW: 'TP-4',
} as const;

export async function resolveTenantTaskDefaults(conn: any, tenantId: string) {
  const [statuses]: any = await conn.query(
    'SELECT id, code, platformMasterId FROM task_statuses WHERE tenantId = ? AND isActive = 1',
    [tenantId]
  );
  const [priorities]: any = await conn.query(
    'SELECT id, code, platformMasterId FROM task_priorities WHERE tenantId = ? AND isActive = 1',
    [tenantId]
  );
  
  const todoStatus = statuses.find((s: any) => s.code === 'TODO' || s.code === 'TSK_TODO' || s.platformMasterId === 'TS-1')?.id;
  const cancelledStatus = statuses.find((s: any) => s.code === 'CANCELLED' || s.code === 'TSK_CANCELLED' || s.platformMasterId === 'TS-4')?.id;
  const completedStatus = statuses.find((s: any) => s.code === 'COMPLETED' || s.code === 'TSK_COMPLETED' || s.platformMasterId === 'TS-3')?.id;
  const mediumPriority = priorities.find((p: any) => p.code === 'MEDIUM' || p.code === 'PRIO_MEDIUM' || p.platformMasterId === 'TP-3')?.id;

  if (!todoStatus || !cancelledStatus || !completedStatus || !mediumPriority) {
    const err: any = new Error(`CONFIG_INTEGRITY_ERROR: Tenant ${tenantId} is missing required active task statuses or priorities.`);
    err.code = 'CONFIG_INTEGRITY_ERROR';
    throw err;
  }

  return { todoStatus, cancelledStatus, completedStatus, mediumPriority };
}

/**
 * Synchronizes PROJECT_ASSIGNMENT tasks for a given project.
 * - Server-side, transactional, tenant-safe, and idempotent.
 * - Project PIC receives exactly ONE active PROJECT_ASSIGNMENT task.
 * - If PIC changes: old PIC's unfinished task becomes inactive/cancelled, new PIC receives an active task.
 * - If PIC is removed: unfinished assignment tasks become cancelled.
 * - Never modifies completed historical tasks or manual tasks.
 */
export async function syncProjectAssignmentTasks(
  conn: any,
  projectId: string,
  tenantId: string
): Promise<void> {
  const [projRows]: any = await conn.query(
    'SELECT id, tenantId, customerId, title, expectedCloseDate, picId FROM projects WHERE id = ? AND tenantId = ?',
    [projectId, tenantId]
  );

  if (projRows.length === 0) return;
  const project = projRows[0];
  const activePicId = project.picId ? String(project.picId).trim() : null;

  const tntDefaults = await resolveTenantTaskDefaults(conn, tenantId);

  // Query existing assignment tasks for this project
  const [existingTasks]: any = await conn.query(
    `SELECT * FROM tasks 
     WHERE tenantId = ? AND relatedProjectId = ? AND sourceType = ? AND relatedVisitId IS NULL`,
    [tenantId, projectId, TASK_SOURCE_TYPE.PROJECT_ASSIGNMENT]
  );

  let activeTaskFound = false;

  for (const task of existingTasks) {
    const isCompleted = task.statusId === tntDefaults.completedStatus || task.statusId === TASK_STATUS.COMPLETED || task.statusId === 'COMPLETED';
    if (isCompleted) {
      // Completed historical tasks are preserved untouched
      continue;
    }

    if (activePicId && task.picId === activePicId) {
      if (!activeTaskFound) {
        // Active assignment for current PIC -> sync metadata and ensure active
        const expectedTitle = `Project Assignment — ${project.title || 'Project'}`;
        const isCancelled = task.statusId === tntDefaults.cancelledStatus || task.statusId === TASK_STATUS.CANCELLED || task.statusId === 'CANCELLED';
        await conn.query(
          `UPDATE tasks 
           SET title = ?, customerId = ?, dueDate = ?, statusId = ?, updatedAt = NOW()
           WHERE id = ?`,
          [
            expectedTitle,
            project.customerId || null,
            project.expectedCloseDate || null,
            isCancelled ? tntDefaults.todoStatus : task.statusId,
            task.id
          ]
        );
        activeTaskFound = true;
      } else {
        // Redundant duplicate task for same PIC -> cancel it
        await conn.query(
          `UPDATE tasks SET statusId = ?, updatedAt = NOW() WHERE id = ?`,
          [tntDefaults.cancelledStatus, task.id]
        );
      }
    } else {
      // Task belongs to previous PIC or PIC was removed -> cancel unfinished task
      const isCancelled = task.statusId === tntDefaults.cancelledStatus || task.statusId === TASK_STATUS.CANCELLED || task.statusId === 'CANCELLED';
      if (!isCancelled) {
        await conn.query(
          `UPDATE tasks SET statusId = ?, updatedAt = NOW() WHERE id = ?`,
          [tntDefaults.cancelledStatus, task.id]
        );
      }
    }
  }

  // If active PIC still needs an active assignment task, create one
  if (activePicId && !activeTaskFound) {
    const taskId = 'TSK-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const taskTitle = `Project Assignment — ${project.title || 'Project'}`;

    await conn.query(
      `INSERT INTO tasks (
        id, tenantId, title, description, customerId, relatedProjectId, relatedVisitId,
        priorityId, statusId, taskType, dueDate, picId, sourceType, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, 'GENERAL', ?, ?, ?, NOW(), NOW())`,
      [
        taskId,
        tenantId,
        taskTitle,
        'Auto-assigned project ownership task. Keep details and customer relationship on schedule.',
        project.customerId || null,
        projectId,
        tntDefaults.mediumPriority,
        tntDefaults.todoStatus,
        project.expectedCloseDate || null,
        activePicId,
        TASK_SOURCE_TYPE.PROJECT_ASSIGNMENT
      ]
    );
  }
}

/**
 * Synchronizes VISIT_ASSIGNMENT tasks for a given visit.
 * - Server-side, transactional, tenant-safe, and idempotent.
 * - Each participant (primary PIC + additional participants) receives exactly ONE active task.
 * - Primary PIC is never duplicated if also present in visit_participants.
 * - If Visit is cancelled: unfinished assignment tasks become cancelled.
 * - If Visit is rescheduled / reactivated: active tasks receive updated dueDate or are reactivated.
 * - If PIC changes or participants are added/removed: synchronizes accordingly.
 * - Never modifies completed historical tasks or manual tasks.
 */
export async function syncVisitAssignmentTasks(
  conn: any,
  visitId: string,
  tenantId: string
): Promise<void> {
  const [visitRows]: any = await conn.query(
    `SELECT id, tenantId, customerId, title, visitDate, statusId, picId, relatedProjectId 
     FROM visits WHERE id = ? AND tenantId = ?`,
    [visitId, tenantId]
  );

  if (visitRows.length === 0) return;
  const visit = visitRows[0];
  const [vStatusRows]: any = await conn.query(
    'SELECT code, isTerminal FROM visit_statuses WHERE id = ? AND tenantId = ?',
    [visit.statusId, tenantId]
  );
  const isVisitCancelled = (vStatusRows.length > 0 && vStatusRows[0].code === 'CANCELLED') || visit.statusId === 'VS-3' || visit.statusId === 'CANCELLED';

  const tntDefaults = await resolveTenantTaskDefaults(conn, tenantId);

  // If visit is CANCELLED: cancel all unfinished auto-generated visit assignment tasks
  if (isVisitCancelled) {
    await conn.query(
      `UPDATE tasks 
       SET statusId = ?, updatedAt = NOW()
       WHERE tenantId = ? AND relatedVisitId = ? AND sourceType = ? 
       AND statusId NOT IN (?, 'COMPLETED')`,
      [tntDefaults.cancelledStatus, tenantId, visitId, TASK_SOURCE_TYPE.VISIT_ASSIGNMENT, tntDefaults.completedStatus]
    );
    return;
  }

  // Visit is active -> Determine desired assignees
  const [participantRows]: any = await conn.query(
    'SELECT userId FROM visit_participants WHERE visitId = ?',
    [visitId]
  );

  const desiredAssigneeIds = new Set<string>();
  if (visit.picId) {
    desiredAssigneeIds.add(String(visit.picId).trim());
  }
  for (const part of participantRows) {
    if (part.userId) {
      desiredAssigneeIds.add(String(part.userId).trim());
    }
  }

  // Query existing assignment tasks for this visit
  const [existingTasks]: any = await conn.query(
    `SELECT * FROM tasks 
     WHERE tenantId = ? AND relatedVisitId = ? AND sourceType = ?`,
    [tenantId, visitId, TASK_SOURCE_TYPE.VISIT_ASSIGNMENT]
  );

  const activeAssigneeSet = new Set<string>();
  const taskTitle = `Visit Assignment — ${visit.title || 'Client Visit'}`;

  for (const task of existingTasks) {
    const isCompleted = task.statusId === tntDefaults.completedStatus || task.statusId === TASK_STATUS.COMPLETED || task.statusId === 'COMPLETED';
    if (isCompleted) {
      continue;
    }

    if (desiredAssigneeIds.has(task.picId)) {
      if (!activeAssigneeSet.has(task.picId)) {
        // Active assignment task for this assignee -> sync metadata
        const isCancelled = task.statusId === tntDefaults.cancelledStatus || task.statusId === TASK_STATUS.CANCELLED || task.statusId === 'CANCELLED';
        const nextStatus = isCancelled ? tntDefaults.todoStatus : task.statusId;

        await conn.query(
          `UPDATE tasks 
           SET title = ?, customerId = ?, relatedProjectId = ?, dueDate = ?, statusId = ?, updatedAt = NOW()
           WHERE id = ?`,
          [
            taskTitle,
            visit.customerId || null,
            visit.relatedProjectId || null,
            visit.visitDate,
            nextStatus,
            task.id
          ]
        );
        activeAssigneeSet.add(task.picId);
      } else {
        // Duplicate active task for same user on this visit -> cancel redundant one
        await conn.query(
          `UPDATE tasks SET statusId = ?, updatedAt = NOW() WHERE id = ?`,
          [tntDefaults.cancelledStatus, task.id]
        );
      }
    } else {
      // User was unassigned from this visit -> cancel unfinished task
      const isCancelled = task.statusId === tntDefaults.cancelledStatus || task.statusId === TASK_STATUS.CANCELLED || task.statusId === 'CANCELLED';
      if (!isCancelled) {
        await conn.query(
          `UPDATE tasks SET statusId = ?, updatedAt = NOW() WHERE id = ?`,
          [tntDefaults.cancelledStatus, task.id]
        );
      }
    }
  }

  // Create tasks for assignees that don't have an active assignment yet
  for (const assigneeId of desiredAssigneeIds) {
    if (!activeAssigneeSet.has(assigneeId)) {
      const taskId = 'TSK-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
      const taskDesc = `Automated visit assignment task for visit: ${visit.title || visit.id}`;

      await conn.query(
        `INSERT INTO tasks (
          id, tenantId, title, description, customerId, relatedProjectId, relatedVisitId,
          priorityId, statusId, taskType, dueDate, picId, sourceType, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'GENERAL', ?, ?, ?, NOW(), NOW())`,
        [
          taskId,
          tenantId,
          taskTitle,
          taskDesc,
          visit.customerId || null,
          visit.relatedProjectId || null,
          visit.id,
          tntDefaults.mediumPriority,
          tntDefaults.todoStatus,
          visit.visitDate,
          assigneeId,
          TASK_SOURCE_TYPE.VISIT_ASSIGNMENT
        ]
      );
      activeAssigneeSet.add(assigneeId);
    }
  }
}

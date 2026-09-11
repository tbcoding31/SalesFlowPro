import { Router } from 'express';
import { pool } from '../db';
import { validateTargetTenant } from '../utils/scope';

export const activitiesRoutes = Router();

import { normalizeSemanticRole, canAccessAllScope } from './navigation.routes';
export { normalizeSemanticRole, canAccessAllScope };

export interface CanonicalActivityEvent {
  eventId: string;
  tenantId: string;
  eventType: string;
  type: 'ACTIVITY';
  entity: 'FOLLOW_UP' | 'VISIT' | 'TASK' | 'PROJECT' | 'CUSTOMER' | 'NOTE';
  entityId: string;
  actorUserId: string | null;
  actorName: string;
  picId: string | null;
  customerId: string | null;
  customerName: string | null;
  projectId: string | null;
  visitId: string | null;
  taskId: string | null;
  followUpId: string | null;
  title: string;
  description: string | null;
  occurredAt: string;
  visibilityScope: 'ORGANIZATION' | 'TEAM' | 'OWN';
}

async function handleActivitiesList(req: any, res: any, forcedScope?: string) {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const semanticRole = normalizeSemanticRole(actorRole, isPlatformUser);
  const requestedScope = (forcedScope || req.query.scope || 'my').toLowerCase().trim();

  // Validate Scope Authorization
  let effectiveScope: 'all' | 'my' = 'my';
  if (requestedScope === 'all') {
    if (semanticRole !== 'TENANT_ADMIN' && semanticRole !== 'SUPERVISOR' && semanticRole !== 'SUPER_ADMIN') {
      return res.status(403).json({
        error: 'Access denied: All Activities scope is restricted to Tenant Admin and Supervisor',
        code: 'SCOPE_ACCESS_DENIED'
      });
    }
    effectiveScope = 'all';
  } else {
    effectiveScope = 'my';
  }

  try {
    const {
      customerId,
      userId,
      picId,
      entityType,
      eventType,
      search,
      page,
      pageSize,
      startDate,
      endDate
    } = req.query;

    // Optional cross-tenant relation verification
    if (customerId && customerId !== 'ALL') {
      const [cCheck]: any = await pool.query('SELECT id FROM customers WHERE id = ? AND tenantId = ?', [customerId, targetTenant]);
      if (cCheck.length === 0) {
        return res.status(404).json({ error: 'Customer not found in tenant', code: 'CUSTOMER_NOT_FOUND' });
      }
    }

    // Resolve supervisor team member user IDs if applicable
    let teamMemberUserIds: string[] = [];
    if (effectiveScope === 'all' && semanticRole === 'SUPERVISOR' && actorDataScope === 'TEAM') {
      const [tmRows]: any = await pool.query(`
        SELECT DISTINCT tu.userId 
        FROM tenant_users tu
        JOIN team_members tm ON tm.tenantUserId = tu.id
        WHERE tm.teamId IN (
          SELECT tm2.teamId 
          FROM team_members tm2
          JOIN tenant_users tu2 ON tu2.id = tm2.tenantUserId
          WHERE tu2.userId = ? AND tu2.tenantId = ? AND tu2.status = 'ACTIVE'
        ) AND tu.tenantId = ? AND tu.status = 'ACTIVE'
      `, [actorUserId, targetTenant, targetTenant]);
      teamMemberUserIds = tmRows.map((r: any) => r.userId).filter(Boolean);
      if (!teamMemberUserIds.includes(actorUserId)) {
        teamMemberUserIds.push(actorUserId);
      }
    }

    // Helper to evaluate whether an event belongs in the effective scope
    const isEventInScope = (evtActorId: string | null, evtPicId: string | null): boolean => {
      if (effectiveScope === 'all') {
        if (semanticRole === 'SUPER_ADMIN' || semanticRole === 'TENANT_ADMIN' || actorDataScope === 'ORGANIZATION') {
          return true;
        }
        if (semanticRole === 'SUPERVISOR' && teamMemberUserIds.length > 0) {
          const inTeam = (evtActorId && teamMemberUserIds.includes(evtActorId)) || (evtPicId && teamMemberUserIds.includes(evtPicId));
          return Boolean(inTeam);
        }
        return true;
      }

      // My Activities scope:
      // Must be performed by the user OR assigned to the user
      if (evtActorId && evtActorId === actorUserId) return true;
      if (evtPicId && evtPicId === actorUserId) return true;
      return false;
    };

    const events: CanonicalActivityEvent[] = [];

    // ─────────────────────────────────────────────────────────────
    // 1. Direct records from `activities` table
    // ─────────────────────────────────────────────────────────────
    const [directActivities]: any = await pool.query(`
      SELECT 
        a.id, a.tenantId, a.customerId, a.userId, a.typeId, a.subject, a.description,
        a.occurredAt, a.entityType, a.entityId,
        u.name as userName,
        c.name as customerName
      FROM activities a
      LEFT JOIN users u ON u.id = a.userId
      LEFT JOIN customers c ON c.id = a.customerId
      WHERE a.tenantId = ?
    `, [targetTenant]);

    for (const a of directActivities) {
      if (!isEventInScope(a.userId, null)) continue;
      const occStr = a.occurredAt ? new Date(a.occurredAt).toISOString() : new Date().toISOString();
      events.push({
        eventId: `ACT:${a.id}`,
        tenantId: targetTenant,
        eventType: a.typeId || 'NOTE_ADDED',
        type: 'ACTIVITY',
        entity: (a.entityType as any) || 'NOTE',
        entityId: a.entityId || a.id,
        actorUserId: a.userId || null,
        actorName: a.userName || 'Unknown',
        picId: a.userId || null,
        customerId: a.customerId || null,
        customerName: a.customerName || null,
        projectId: a.entityType === 'PROJECT' ? a.entityId : null,
        visitId: a.entityType === 'VISIT' ? a.entityId : null,
        taskId: a.entityType === 'TASK' ? a.entityId : null,
        followUpId: a.entityType === 'FOLLOW_UP' ? a.entityId : null,
        title: a.subject || 'Activity Note',
        description: a.description || null,
        occurredAt: occStr,
        visibilityScope: effectiveScope === 'all' ? 'ORGANIZATION' : 'OWN'
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Operational Follow-up events
    // ─────────────────────────────────────────────────────────────
    const [fuRows]: any = await pool.query(`
      SELECT 
        f.id, f.tenantId, f.customerId, f.relatedProjectId, f.relatedVisitId, f.relatedTaskId,
        f.picId, f.createdById, f.followUpDate, f.typeId, f.priorityId, f.title, f.notes,
        f.outcome, f.cancellationReason, f.status, f.createdAt, f.updatedAt, f.completedAt, f.completedById,
        uPic.name as picName,
        uCreator.name as creatorName,
        uCompleted.name as completedByName,
        c.name as customerName
      FROM follow_ups f
      LEFT JOIN users uPic ON uPic.id = f.picId
      LEFT JOIN users uCreator ON uCreator.id = f.createdById
      LEFT JOIN users uCompleted ON uCompleted.id = f.completedById
      LEFT JOIN customers c ON c.id = f.customerId
      WHERE f.tenantId = ?
    `, [targetTenant]);

    for (const f of fuRows) {
      // 2a. FOLLOW_UP_CREATED
      if (f.createdAt) {
        const creatorId = f.createdById || f.picId || null;
        if (isEventInScope(creatorId, f.picId)) {
          events.push({
            eventId: `FOLLOW_UP:CREATED:${f.id}`,
            tenantId: targetTenant,
            eventType: 'FOLLOW_UP_CREATED',
            type: 'ACTIVITY',
            entity: 'FOLLOW_UP',
            entityId: f.id,
            actorUserId: creatorId,
            actorName: f.creatorName || f.picName || 'User',
            picId: f.picId || null,
            customerId: f.customerId || null,
            customerName: f.customerName || null,
            projectId: f.relatedProjectId || null,
            visitId: f.relatedVisitId || null,
            taskId: f.relatedTaskId || null,
            followUpId: f.id,
            title: `Follow-up created: ${f.title || 'Untitled'}`,
            description: f.notes || null,
            occurredAt: new Date(f.createdAt).toISOString(),
            visibilityScope: effectiveScope === 'all' ? 'ORGANIZATION' : 'OWN'
          });
        }
      }

      // 2b. FOLLOW_UP_COMPLETED
      if (f.status === 'COMPLETED' || f.completedAt) {
        const completerId = f.completedById || f.picId || null;
        if (isEventInScope(completerId, f.picId)) {
          events.push({
            eventId: `FOLLOW_UP:COMPLETED:${f.id}`,
            tenantId: targetTenant,
            eventType: 'FOLLOW_UP_COMPLETED',
            type: 'ACTIVITY',
            entity: 'FOLLOW_UP',
            entityId: f.id,
            actorUserId: completerId,
            actorName: f.completedByName || f.picName || 'User',
            picId: f.picId || null,
            customerId: f.customerId || null,
            customerName: f.customerName || null,
            projectId: f.relatedProjectId || null,
            visitId: f.relatedVisitId || null,
            taskId: f.relatedTaskId || null,
            followUpId: f.id,
            title: `Follow-up completed: ${f.title || 'Untitled'}`,
            description: f.outcome || f.notes || null,
            occurredAt: new Date(f.completedAt || f.updatedAt || f.createdAt).toISOString(),
            visibilityScope: effectiveScope === 'all' ? 'ORGANIZATION' : 'OWN'
          });
        }
      }

      // 2c. FOLLOW_UP_CANCELLED
      if (f.status === 'CANCELLED') {
        if (isEventInScope(f.picId, f.picId)) {
          events.push({
            eventId: `FOLLOW_UP:CANCELLED:${f.id}`,
            tenantId: targetTenant,
            eventType: 'FOLLOW_UP_CANCELLED',
            type: 'ACTIVITY',
            entity: 'FOLLOW_UP',
            entityId: f.id,
            actorUserId: f.picId || null,
            actorName: f.picName || 'User',
            picId: f.picId || null,
            customerId: f.customerId || null,
            customerName: f.customerName || null,
            projectId: f.relatedProjectId || null,
            visitId: f.relatedVisitId || null,
            taskId: f.relatedTaskId || null,
            followUpId: f.id,
            title: `Follow-up cancelled: ${f.title || 'Untitled'}`,
            description: f.cancellationReason || null,
            occurredAt: new Date(f.updatedAt || f.createdAt).toISOString(),
            visibilityScope: effectiveScope === 'all' ? 'ORGANIZATION' : 'OWN'
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Follow-up Evidences
    // ─────────────────────────────────────────────────────────────
    const [evidenceRows]: any = await pool.query(`
      SELECT 
        fue.id, fue.followUpId, fue.tenantId, fue.fileName, fue.caption, fue.uploadedBy, fue.uploadedAt,
        u.name as uploaderName,
        f.customerId, f.title as followUpTitle,
        c.name as customerName
      FROM follow_up_evidences fue
      JOIN follow_ups f ON f.id = fue.followUpId
      LEFT JOIN users u ON u.id = fue.uploadedBy
      LEFT JOIN customers c ON c.id = f.customerId
      WHERE fue.tenantId = ?
    `, [targetTenant]);

    for (const fe of evidenceRows) {
      if (isEventInScope(fe.uploadedBy, null)) {
        events.push({
          eventId: `FOLLOW_UP:EVIDENCE:${fe.id}`,
          tenantId: targetTenant,
          eventType: 'FOLLOW_UP_EVIDENCE_UPLOADED',
          type: 'ACTIVITY',
          entity: 'FOLLOW_UP',
          entityId: fe.followUpId,
          actorUserId: fe.uploadedBy || null,
          actorName: fe.uploaderName || 'User',
          picId: null,
          customerId: fe.customerId || null,
          customerName: fe.customerName || null,
          projectId: null,
          visitId: null,
          taskId: null,
          followUpId: fe.followUpId,
          title: `Evidence uploaded for follow-up '${fe.followUpTitle}'`,
          description: fe.caption || fe.fileName || null,
          occurredAt: new Date(fe.uploadedAt).toISOString(),
          visibilityScope: effectiveScope === 'all' ? 'ORGANIZATION' : 'OWN'
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Visit events
    // ─────────────────────────────────────────────────────────────
    const [visitRows]: any = await pool.query(`
      SELECT 
        v.id, v.tenantId, v.customerId, v.relatedProjectId, v.title, v.result, v.notes,
        v.visitDate, v.picId, v.createdAt, v.completedAt,
        u.name as picName,
        c.name as customerName
      FROM visits v
      LEFT JOIN users u ON u.id = v.picId
      LEFT JOIN customers c ON c.id = v.customerId
      WHERE v.tenantId = ?
    `, [targetTenant]);

    for (const v of visitRows) {
      if (isEventInScope(v.picId, v.picId)) {
        if (v.createdAt) {
          events.push({
            eventId: `VISIT:CREATED:${v.id}`,
            tenantId: targetTenant,
            eventType: 'VISIT_CREATED',
            type: 'ACTIVITY',
            entity: 'VISIT',
            entityId: v.id,
            actorUserId: v.picId || null,
            actorName: v.picName || 'User',
            picId: v.picId || null,
            customerId: v.customerId || null,
            customerName: v.customerName || null,
            projectId: v.relatedProjectId || null,
            visitId: v.id,
            taskId: null,
            followUpId: null,
            title: `Visit created: ${v.title || 'Client Visit'}`,
            description: v.notes || null,
            occurredAt: new Date(v.createdAt).toISOString(),
            visibilityScope: effectiveScope === 'all' ? 'ORGANIZATION' : 'OWN'
          });
        }
        if (v.completedAt) {
          events.push({
            eventId: `VISIT:COMPLETED:${v.id}`,
            tenantId: targetTenant,
            eventType: 'VISIT_COMPLETED',
            type: 'ACTIVITY',
            entity: 'VISIT',
            entityId: v.id,
            actorUserId: v.picId || null,
            actorName: v.picName || 'User',
            picId: v.picId || null,
            customerId: v.customerId || null,
            customerName: v.customerName || null,
            projectId: v.relatedProjectId || null,
            visitId: v.id,
            taskId: null,
            followUpId: null,
            title: `Visit completed: ${v.title || 'Client Visit'}`,
            description: v.result || v.notes || null,
            occurredAt: new Date(v.completedAt).toISOString(),
            visibilityScope: effectiveScope === 'all' ? 'ORGANIZATION' : 'OWN'
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Task events
    // ─────────────────────────────────────────────────────────────
    const [taskRows]: any = await pool.query(`
      SELECT 
        t.id, t.tenantId, t.customerId, t.relatedProjectId, t.relatedVisitId, t.title, t.description,
        t.picId, t.createdAt, t.completedAt,
        u.name as picName,
        c.name as customerName
      FROM tasks t
      LEFT JOIN users u ON u.id = t.picId
      LEFT JOIN customers c ON c.id = t.customerId
      WHERE t.tenantId = ?
    `, [targetTenant]);

    for (const t of taskRows) {
      if (isEventInScope(t.picId, t.picId)) {
        if (t.createdAt) {
          events.push({
            eventId: `TASK:CREATED:${t.id}`,
            tenantId: targetTenant,
            eventType: 'TASK_CREATED',
            type: 'ACTIVITY',
            entity: 'TASK',
            entityId: t.id,
            actorUserId: t.picId || null,
            actorName: t.picName || 'User',
            picId: t.picId || null,
            customerId: t.customerId || null,
            customerName: t.customerName || null,
            projectId: t.relatedProjectId || null,
            visitId: t.relatedVisitId || null,
            taskId: t.id,
            followUpId: null,
            title: `Task created: ${t.title || 'Task'}`,
            description: t.description || null,
            occurredAt: new Date(t.createdAt).toISOString(),
            visibilityScope: effectiveScope === 'all' ? 'ORGANIZATION' : 'OWN'
          });
        }
        if (t.completedAt) {
          events.push({
            eventId: `TASK:COMPLETED:${t.id}`,
            tenantId: targetTenant,
            eventType: 'TASK_COMPLETED',
            type: 'ACTIVITY',
            entity: 'TASK',
            entityId: t.id,
            actorUserId: t.picId || null,
            actorName: t.picName || 'User',
            picId: t.picId || null,
            customerId: t.customerId || null,
            customerName: t.customerName || null,
            projectId: t.relatedProjectId || null,
            visitId: t.relatedVisitId || null,
            taskId: t.id,
            followUpId: null,
            title: `Task completed: ${t.title || 'Task'}`,
            description: t.description || null,
            occurredAt: new Date(t.completedAt).toISOString(),
            visibilityScope: effectiveScope === 'all' ? 'ORGANIZATION' : 'OWN'
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Project events
    // ─────────────────────────────────────────────────────────────
    const [projectRows]: any = await pool.query(`
      SELECT 
        p.id, p.tenantId, p.customerId, p.title, p.description, p.picId, p.createdAt,
        u.name as picName,
        c.name as customerName
      FROM projects p
      LEFT JOIN users u ON u.id = p.picId
      LEFT JOIN customers c ON c.id = p.customerId
      WHERE p.tenantId = ?
    `, [targetTenant]);

    for (const p of projectRows) {
      if (isEventInScope(p.picId, p.picId) && p.createdAt) {
        events.push({
          eventId: `PROJECT:CREATED:${p.id}`,
          tenantId: targetTenant,
          eventType: 'PROJECT_CREATED',
          type: 'ACTIVITY',
          entity: 'PROJECT',
          entityId: p.id,
          actorUserId: p.picId || null,
          actorName: p.picName || 'User',
          picId: p.picId || null,
          customerId: p.customerId || null,
          customerName: p.customerName || null,
          projectId: p.id,
          visitId: null,
          taskId: null,
          followUpId: null,
          title: `Project created: ${p.title || 'Project'}`,
          description: p.description || null,
          occurredAt: new Date(p.createdAt).toISOString(),
          visibilityScope: effectiveScope === 'all' ? 'ORGANIZATION' : 'OWN'
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 7. Customer creation events
    // ─────────────────────────────────────────────────────────────
    const [customerRows]: any = await pool.query(`
      SELECT c.id, c.tenantId, c.name, c.picId, c.createdAt, u.name as picName
      FROM customers c
      LEFT JOIN users u ON u.id = c.picId
      WHERE c.tenantId = ?
    `, [targetTenant]);

    for (const c of customerRows) {
      if (isEventInScope(c.picId, c.picId) && c.createdAt) {
        events.push({
          eventId: `CUSTOMER:CREATED:${c.id}`,
          tenantId: targetTenant,
          eventType: 'CUSTOMER_CREATED',
          type: 'ACTIVITY',
          entity: 'CUSTOMER',
          entityId: c.id,
          actorUserId: c.picId || null,
          actorName: c.picName || 'User',
          picId: c.picId || null,
          customerId: c.id,
          customerName: c.name,
          projectId: null,
          visitId: null,
          taskId: null,
          followUpId: null,
          title: `Customer registered: ${c.name || 'Customer'}`,
          description: null,
          occurredAt: new Date(c.createdAt).toISOString(),
          visibilityScope: effectiveScope === 'all' ? 'ORGANIZATION' : 'OWN'
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Deduplication via unique eventId Map
    // ─────────────────────────────────────────────────────────────
    const dedupMap = new Map<string, CanonicalActivityEvent>();
    for (const ev of events) {
      if (!dedupMap.has(ev.eventId)) {
        dedupMap.set(ev.eventId, ev);
      }
    }
    let allFiltered = Array.from(dedupMap.values());

    // Apply In-Memory Query Filters
    if (customerId && customerId !== 'ALL') {
      allFiltered = allFiltered.filter(e => e.customerId === customerId);
    }
    if (userId && userId !== 'ALL') {
      allFiltered = allFiltered.filter(e => e.actorUserId === userId);
    }
    if (picId && picId !== 'ALL') {
      allFiltered = allFiltered.filter(e => e.picId === picId);
    }
    if (entityType && entityType !== 'ALL') {
      allFiltered = allFiltered.filter(e => e.entity === entityType);
    }
    if (eventType && eventType !== 'ALL') {
      allFiltered = allFiltered.filter(e => e.eventType === eventType);
    }
    if (startDate) {
      const sTime = new Date(startDate as string).getTime();
      if (!isNaN(sTime)) {
        allFiltered = allFiltered.filter(e => new Date(e.occurredAt).getTime() >= sTime);
      }
    }
    if (endDate) {
      const eTime = new Date(endDate as string).getTime();
      if (!isNaN(eTime)) {
        allFiltered = allFiltered.filter(e => new Date(e.occurredAt).getTime() <= eTime);
      }
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      allFiltered = allFiltered.filter(e => 
        e.title.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.customerName && e.customerName.toLowerCase().includes(q)) ||
        e.actorName.toLowerCase().includes(q)
      );
    }

    // Deterministic Sort: occurredAt DESC, eventId ASC
    allFiltered.sort((a, b) => {
      const diff = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      if (diff !== 0) return diff;
      return a.eventId.localeCompare(b.eventId);
    });

    const totalItems = allFiltered.length;
    const pNum = parseInt(page as string, 10) || 1;
    const pSize = parseInt(pageSize as string, 10) || 25;
    const totalPages = Math.ceil(totalItems / pSize) || (totalItems === 0 ? 0 : 1);
    const paginatedRows = allFiltered.slice((pNum - 1) * pSize, pNum * pSize);

    res.json({
      data: paginatedRows,
      pagination: {
        page: pNum,
        pageSize: pSize,
        totalItems,
        totalPages
      },
      summary: {
        totalItems,
        scope: effectiveScope
      }
    });
  } catch (err: any) {
    console.error('GET /api/activities error:', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'ACTIVITIES_FETCH_ERROR' });
  }
}

// ─────────────────────────────────────────────────────────────
// Mount Endpoints: Canonical and Alias
// ─────────────────────────────────────────────────────────────
activitiesRoutes.get('/my', (req: any, res: any) => handleActivitiesList(req, res, 'my'));
activitiesRoutes.get('/all', (req: any, res: any) => handleActivitiesList(req, res, 'all'));
activitiesRoutes.get('/', (req: any, res: any) => handleActivitiesList(req, res, req.query.scope));

// GET /api/activities/:id - Single detail
activitiesRoutes.get('/:id', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;

  try {
    let rawId = id;
    if (rawId.startsWith('ACT:')) rawId = rawId.substring(4);

    const [rows]: any = await pool.query(`
      SELECT 
        a.*,
        u.name as userName, u.avatar as userAvatar,
        c.name as customerName
      FROM activities a
      LEFT JOIN users u ON u.id = a.userId
      LEFT JOIN customers c ON c.id = a.customerId
      WHERE a.id = ? AND a.tenantId = ?
    `, [rawId, targetTenant]);

    if (rows.length > 0) {
      return res.json(rows[0]);
    }

    // Check synthetic event prefixes
    if (id.startsWith('FOLLOW_UP:')) {
      const parts = id.split(':');
      const fuId = parts[2];
      const [fRows]: any = await pool.query(`
        SELECT f.*, u.name as userName, u.avatar as userAvatar, c.name as customerName
        FROM follow_ups f
        LEFT JOIN users u ON u.id = f.picId
        LEFT JOIN customers c ON c.id = f.customerId
        WHERE f.id = ? AND f.tenantId = ?
      `, [fuId, targetTenant]);
      if (fRows.length > 0) {
        const f = fRows[0];
        return res.json({
          id,
          tenantId: targetTenant,
          type: 'ACTIVITY',
          subject: `Follow-up: ${f.title || 'Untitled'}`,
          description: f.notes || f.outcome || 'Follow-up touchpoint',
          occurredAt: f.completedAt || f.updatedAt || f.createdAt,
          userId: f.completedById || f.picId,
          userName: f.userName,
          userAvatar: f.userAvatar,
          customerId: f.customerId,
          customerName: f.customerName,
          entityType: 'FOLLOW_UP',
          entityId: f.id,
          metadata: { status: f.status, dueDate: f.followUpDate }
        });
      }
    }

    if (id.startsWith('VISIT:')) {
      const parts = id.split(':');
      const vId = parts[2];
      const [vRows]: any = await pool.query(`
        SELECT v.*, u.name as userName, u.avatar as userAvatar, c.name as customerName
        FROM visits v
        LEFT JOIN users u ON u.id = v.userId
        LEFT JOIN customers c ON c.id = v.customerId
        WHERE v.id = ? AND v.tenantId = ?
      `, [vId, targetTenant]);
      if (vRows.length > 0) {
        const v = vRows[0];
        return res.json({
          id,
          tenantId: targetTenant,
          type: 'ACTIVITY',
          subject: `Visit: ${v.title || v.location || 'Client Visit'}`,
          description: v.notes || v.purpose || 'Client site visit',
          occurredAt: v.checkOutTime || v.checkInTime || v.createdAt,
          userId: v.userId,
          userName: v.userName,
          userAvatar: v.userAvatar,
          customerId: v.customerId,
          customerName: v.customerName,
          entityType: 'VISIT',
          entityId: v.id,
          metadata: { status: v.status }
        });
      }
    }

    if (id.startsWith('TASK:')) {
      const parts = id.split(':');
      const tId = parts[2];
      const [tRows]: any = await pool.query(`
        SELECT t.*, u.name as userName, u.avatar as userAvatar, c.name as customerName
        FROM tasks t
        LEFT JOIN users u ON u.id = t.picId
        LEFT JOIN customers c ON c.id = t.customerId
        WHERE t.id = ? AND t.tenantId = ?
      `, [tId, targetTenant]);
      if (tRows.length > 0) {
        const t = tRows[0];
        return res.json({
          id,
          tenantId: targetTenant,
          type: 'ACTIVITY',
          subject: `Task: ${t.title || 'Untitled Task'}`,
          description: t.description || 'Assigned task',
          occurredAt: t.completedAt || t.updatedAt || t.createdAt,
          userId: t.picId,
          userName: t.userName,
          userAvatar: t.userAvatar,
          customerId: t.customerId,
          customerName: t.customerName,
          entityType: 'TASK',
          entityId: t.id,
          metadata: { status: t.statusId, priority: t.priorityId }
        });
      }
    }

    return res.status(404).json({ error: 'Activity not found', code: 'ACTIVITY_NOT_FOUND' });
  } catch (err: any) {
    console.error('GET /api/activities/:id error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { buildReportScopeWhere, validateTargetTenant } from '../utils/scope';
import { logAudit } from '../utils/audit';

export const customersRoutes = Router();

// GET /api/customers - List customers with search, filter, and pagination support
customersRoutes.get('/', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { where, params } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'c.picId');

  try {
    let extraWhere = '';
    const extraParams: any[] = [];

    const { search, status, picId, page, pageSize, sortBy, sortOrder } = req.query;

    if (search && typeof search === 'string' && search.trim()) {
      extraWhere += ' AND (c.name LIKE ? OR c.code LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)';
      const s = `%${search.trim()}%`;
      extraParams.push(s, s, s, s);
    }

    if (status && status !== 'ALL' && status !== 'All') {
      extraWhere += ' AND (c.statusId = ? OR cs.code = ? OR cs.name = ?)';
      extraParams.push(status, status, status);
    }

    if (picId && picId !== 'ALL' && picId !== 'All') {
      extraWhere += ' AND c.picId = ?';
      extraParams.push(picId);
    }

    // Determine ordering
    const validSortCols: Record<string, string> = {
      name: 'c.name',
      code: 'c.code',
      createdAt: 'c.createdAt',
      status: 'cs.name',
      industry: 'c.industry'
    };
    const sortCol = (sortBy && validSortCols[sortBy as string]) || 'c.createdAt';
    const orderDir = (sortOrder && (sortOrder as string).toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

    // Count total for pagination if page is requested
    const countSql = `
      SELECT COUNT(c.id) as total
      FROM customers c
      LEFT JOIN customer_statuses cs ON cs.id = c.statusId
      ${where.replace(/WHERE tenantId/g, 'WHERE c.tenantId')}
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
        c.id, c.tenantId, c.code, c.name, c.typeId, c.statusId,
        c.industry, c.website, c.phone, c.email, c.notes, c.picId,
        c.createdAt, c.lastVisitAt,
        cs.code as statusCode, cs.name as statusName, cs.color as statusColor,
        ct.code as typeCode, ct.name as typeName,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar,
        (
          SELECT COUNT(t.id) 
          FROM tasks t 
          LEFT JOIN task_statuses ts ON ts.id = t.statusId 
          WHERE t.customerId = c.id 
          AND (ts.code NOT IN ('TSK_COMPLETED', 'TSK_CANCELLED') OR ts.code IS NULL)
        ) as tasksCount
      FROM customers c
      LEFT JOIN customer_statuses cs ON cs.id = c.statusId AND cs.tenantId = c.tenantId
      LEFT JOIN customer_types ct ON ct.id = c.typeId AND ct.tenantId = c.tenantId
      LEFT JOIN users u ON u.id = c.picId
      ${where.replace(/WHERE tenantId/g, 'WHERE c.tenantId')}
      ${extraWhere}
      ORDER BY ${sortCol} ${orderDir}
      ${paginationClause}
    `;

    const [rows]: any = await pool.query(selectSql, [...params, ...extraParams]);

    if (!isNaN(pNum) && !isNaN(pSize) && pNum > 0 && pSize > 0) {
      const totalPages = Math.ceil(totalItems / pSize);
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
    console.error('GET /api/customers error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/customers/:id/summary - Customer overview metrics
customersRoutes.get('/:id/summary', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;

  try {
    const [cRows]: any = await pool.query('SELECT * FROM customers WHERE id = ? AND tenantId = ?', [id, targetTenant]);
    if (cRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const [projStats]: any = await pool.query(`
      SELECT 
        COUNT(id) as totalProjects, 
        COALESCE(SUM(value), 0) as totalValue,
        COUNT(CASE WHEN commercialWonAt IS NOT NULL THEN 1 END) as wonProjects
      FROM projects 
      WHERE customerId = ? AND tenantId = ?
    `, [id, targetTenant]);

    const [visitStats]: any = await pool.query(`
      SELECT COUNT(id) as totalVisits 
      FROM visits 
      WHERE customerId = ? AND tenantId = ?
    `, [id, targetTenant]);

    const [taskStats]: any = await pool.query(`
      SELECT 
        COUNT(t.id) as totalTasks,
        COUNT(CASE WHEN ts.code NOT IN ('TSK_COMPLETED', 'TSK_CANCELLED') OR ts.code IS NULL THEN 1 END) as openTasks
      FROM tasks t
      LEFT JOIN task_statuses ts ON ts.id = t.statusId
      WHERE t.customerId = ? AND t.tenantId = ?
    `, [id, targetTenant]);

    res.json({
      customer: cRows[0],
      metrics: {
        totalProjects: projStats[0]?.totalProjects || 0,
        totalValue: projStats[0]?.totalValue || 0,
        wonProjects: projStats[0]?.wonProjects || 0,
        totalVisits: visitStats[0]?.totalVisits || 0,
        totalTasks: taskStats[0]?.totalTasks || 0,
        openTasks: taskStats[0]?.openTasks || 0
      }
    });
  } catch (err: any) {
    console.error(`GET /api/customers/${id}/summary error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/customers/:id - Single customer details with contacts & addresses
customersRoutes.get('/:id', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;

  try {
    const [cRows]: any = await pool.query(`
      SELECT 
        c.*,
        cs.code as statusCode, cs.name as statusName, cs.color as statusColor,
        ct.code as typeCode, ct.name as typeName,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar
      FROM customers c
      LEFT JOIN customer_statuses cs ON cs.id = c.statusId
      LEFT JOIN customer_types ct ON ct.id = c.typeId
      LEFT JOIN users u ON u.id = c.picId
      WHERE c.id = ? AND c.tenantId = ?
    `, [id, targetTenant]);

    if (cRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = cRows[0];

    // Authoritative created and updated actor resolution from audit_logs
    const [auditRows]: any = await pool.query(`
      SELECT a.action, a.userId, u.name as actorName, a.timestamp
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.userId
      WHERE a.entity = 'Customer' AND a.entityId = ? AND a.tenantId = ?
      ORDER BY a.timestamp DESC
    `, [id, targetTenant]);

    let createdByName: string | null = null;
    let createdById: string | null = null;
    let createdAt = customer.createdAt;
    let updatedByName: string | null = null;
    let updatedById: string | null = null;
    let updatedAt = customer.updatedAt || customer.createdAt;

    const createLog = [...auditRows].reverse().find((l: any) => l.action === 'CUSTOMER_CREATED') || auditRows[auditRows.length - 1];
    if (createLog) {
      createdByName = createLog.actorName;
      createdById = createLog.userId;
      if (!createdAt) createdAt = createLog.timestamp;
    }

    const updateLog = auditRows.find((l: any) => l.action === 'CUSTOMER_UPDATED') || auditRows[0];
    if (updateLog) {
      updatedByName = updateLog.actorName;
      updatedById = updateLog.userId;
      if (!customer.updatedAt) updatedAt = updateLog.timestamp;
    }

    customer.createdAt = createdAt;
    customer.updatedAt = updatedAt;
    customer.createdBy = createdById || customer.picId;
    customer.createdByName = createdByName || customer.picName || 'System';
    customer.updatedBy = updatedById || customer.picId;
    customer.updatedByName = updatedByName || customer.picName || customer.createdByName || 'System';

    const [contacts]: any = await pool.query('SELECT * FROM customer_contacts WHERE customerId = ? ORDER BY isPrimary DESC, createdAt ASC', [id]);
    const [addresses]: any = await pool.query('SELECT * FROM customer_addresses WHERE customerId = ? ORDER BY isPrimary DESC', [id]);

    customer.contacts = contacts;
    customer.addresses = addresses;

    res.json(customer);
  } catch (err: any) {
    console.error(`GET /api/customers/${id} error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/customers/:id/timeline - Customer chronological timeline events
customersRoutes.get('/:id/timeline', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const pageSize = Math.max(1, parseInt(req.query.pageSize as string, 10) || 25);

  try {
    const [cRows]: any = await pool.query('SELECT id, name, code, createdAt FROM customers WHERE id = ? AND tenantId = ?', [id, targetTenant]);
    if (cRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const customer = cRows[0];

    // 1. Visits
    const [visitRows]: any = await pool.query(`
      SELECT v.id, v.title, v.visitDate, v.result, v.nextAction, v.statusId, vp.name as purposeName
      FROM visits v
      LEFT JOIN visit_purposes vp ON vp.id = v.purposeId AND vp.tenantId = v.tenantId
      WHERE v.customerId = ? AND v.tenantId = ?
    `, [id, targetTenant]);

    // 2. Tasks
    const [taskRows]: any = await pool.query(`
      SELECT t.id, t.title, t.description, t.dueDate, t.createdAt, t.taskType, ts.name as statusName
      FROM tasks t
      LEFT JOIN task_statuses ts ON ts.id = t.statusId AND ts.tenantId = t.tenantId
      WHERE t.customerId = ? AND t.tenantId = ?
    `, [id, targetTenant]);

    // 3. Follow-ups
    const [followUpRows]: any = await pool.query(`
      SELECT f.id, f.title, f.notes, f.outcome, f.followUpDate, f.createdAt, ft.name as typeName
      FROM follow_ups f
      LEFT JOIN follow_up_types ft ON ft.id = f.typeId AND ft.tenantId = f.tenantId
      WHERE f.customerId = ? AND f.tenantId = ?
    `, [id, targetTenant]);

    // 4. Projects
    const [projectRows]: any = await pool.query(`
      SELECT p.id, p.title, p.value, p.createdAt, ps.name as stageName
      FROM projects p
      LEFT JOIN project_stages ps ON ps.id = p.stageId AND ps.tenantId = p.tenantId
      WHERE p.customerId = ? AND p.tenantId = ?
    `, [id, targetTenant]);

    // 5. Activities
    const [activityRows]: any = await pool.query(`
      SELECT a.id, a.subject, a.description, a.occurredAt, at.name as typeName
      FROM activities a
      LEFT JOIN activity_types at ON at.id = a.typeId AND at.tenantId = a.tenantId
      WHERE (a.customerId = ? OR (a.entityType = 'CUSTOMER' AND a.entityId = ?)) AND a.tenantId = ?
    `, [id, id, targetTenant]);

    const allEvents: any[] = [];
    const seenKeys = new Set<string>();

    const addEvent = (ev: any) => {
      if (!seenKeys.has(ev.stableEventKey)) {
        seenKeys.add(ev.stableEventKey);
        ev.id = ev.stableEventKey;
        ev.type = ev.eventType;
        ev.subject = ev.title;
        ev.occurredAt = ev.eventTimestamp;
        ev.description = ev.details;
        allEvents.push(ev);
      }
    };

    // Add visits
    for (const v of visitRows) {
      addEvent({
        eventType: 'VISIT',
        sourceId: v.id,
        eventTimestamp: v.visitDate ? new Date(v.visitDate).toISOString() : new Date().toISOString(),
        stableEventKey: `VISIT-${v.id}`,
        title: v.title || 'Client Visit',
        subType: v.purposeName || 'Visit',
        details: v.result || v.nextAction || ''
      });
    }

    // Add tasks
    for (const t of taskRows) {
      addEvent({
        eventType: 'TASK',
        sourceId: t.id,
        eventTimestamp: t.dueDate ? new Date(t.dueDate).toISOString() : (t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString()),
        stableEventKey: `TASK-${t.id}`,
        title: t.title || 'Task',
        subType: t.statusName || t.taskType || 'Task',
        details: t.description || ''
      });
    }

    // Add follow-ups
    for (const f of followUpRows) {
      addEvent({
        eventType: 'FOLLOW_UP',
        sourceId: f.id,
        eventTimestamp: f.followUpDate ? new Date(f.followUpDate).toISOString() : (f.createdAt ? new Date(f.createdAt).toISOString() : new Date().toISOString()),
        stableEventKey: `FOLLOWUP-${f.id}`,
        title: f.title || 'Follow-up',
        subType: f.typeName || 'Follow-up',
        details: f.notes || f.outcome || ''
      });
    }

    // Add projects
    for (const p of projectRows) {
      addEvent({
        eventType: 'PROJECT',
        sourceId: p.id,
        eventTimestamp: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
        stableEventKey: `PROJECT-${p.id}`,
        title: p.title || 'Sales Project',
        subType: p.stageName || 'Project',
        details: p.value ? `Value: Rp ${Number(p.value).toLocaleString('id-ID')}` : ''
      });
    }

    // Add activities
    for (const a of activityRows) {
      addEvent({
        eventType: 'ACTIVITY',
        sourceId: a.id,
        eventTimestamp: a.occurredAt ? new Date(a.occurredAt).toISOString() : new Date().toISOString(),
        stableEventKey: `ACTIVITY-${a.id}`,
        title: a.subject || 'Activity',
        subType: a.typeName || 'Activity',
        details: a.description || ''
      });
    }

    // Add customer creation event
    addEvent({
      eventType: 'CUSTOMER',
      sourceId: customer.id,
      eventTimestamp: customer.createdAt ? new Date(customer.createdAt).toISOString() : new Date().toISOString(),
      stableEventKey: `CUS-CREATE-${customer.id}`,
      title: `${customer.name} Created`,
      subType: 'CREATE',
      details: `Customer account established (${customer.code || customer.id})`
    });

    // Sort descending by timestamp
    allEvents.sort((a, b) => new Date(b.eventTimestamp).getTime() - new Date(a.eventTimestamp).getTime());

    const total = allEvents.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;
    const pagedData = allEvents.slice(offset, offset + pageSize);
    const hasNextPage = page < totalPages;

    res.json({
      data: pagedData,
      pagination: {
        page,
        pageSize,
        total,
        totalItems: total,
        totalPages,
        hasNextPage
      }
    });
  } catch (err: any) {
    console.error(`GET /api/customers/${id}/timeline error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/customers/:id/next-action - Determine next scheduled action for customer
customersRoutes.get('/:id/next-action', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;

  try {
    const [cRows]: any = await pool.query('SELECT id FROM customers WHERE id = ? AND tenantId = ?', [id, targetTenant]);
    if (cRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Check next upcoming task
    const [nextTask]: any = await pool.query(`
      SELECT t.id, t.title, t.dueDate as actionDate, 'TASK' as type, u.name as picName
      FROM tasks t
      LEFT JOIN users u ON u.id = t.picId
      LEFT JOIN task_statuses ts ON ts.id = t.statusId
      WHERE t.customerId = ? AND t.tenantId = ?
        AND (ts.code NOT IN ('TSK_COMPLETED', 'TSK_CANCELLED') OR ts.code IS NULL)
        AND t.dueDate >= CURDATE()
      ORDER BY t.dueDate ASC LIMIT 1
    `, [id, targetTenant]);

    // Check next upcoming follow-up
    const [nextFollowUp]: any = await pool.query(`
      SELECT f.id, f.title, f.followUpDate as actionDate, 'FOLLOW_UP' as type, u.name as picName
      FROM follow_ups f
      LEFT JOIN users u ON u.id = f.picId
      WHERE f.customerId = ? AND f.tenantId = ?
        AND (f.status = 'PENDING' OR f.status IS NULL)
        AND f.followUpDate >= CURDATE()
      ORDER BY f.followUpDate ASC LIMIT 1
    `, [id, targetTenant]);

    // Check next upcoming visit
    const [nextVisit]: any = await pool.query(`
      SELECT v.id, v.title, v.visitDate as actionDate, 'VISIT' as type, u.name as picName
      FROM visits v
      LEFT JOIN users u ON u.id = v.picId
      WHERE v.customerId = ? AND v.tenantId = ?
        AND v.visitDate >= CURDATE()
      ORDER BY v.visitDate ASC LIMIT 1
    `, [id, targetTenant]);

    const candidates = [nextTask[0], nextFollowUp[0], nextVisit[0]].filter(Boolean);
    if (candidates.length > 0) {
      candidates.sort((a, b) => new Date(a.actionDate).getTime() - new Date(b.actionDate).getTime());
      return res.json({ nextAction: candidates[0] });
    }

    res.json({ nextAction: null });
  } catch (err: any) {
    console.error(`GET /api/customers/${id}/next-action error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/customers/:id/contacts - Customer contacts list
customersRoutes.get('/:id/contacts', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;

  try {
    const [custRows]: any = await pool.query('SELECT id FROM customers WHERE id = ? AND tenantId = ?', [id, targetTenant]);
    if (custRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found or access denied', code: 'CUSTOMER_NOT_FOUND' });
    }

    const [contacts]: any = await pool.query(
      'SELECT * FROM customer_contacts WHERE customerId = ? AND tenantId = ? ORDER BY isPrimary DESC, createdAt ASC',
      [id, targetTenant]
    );
    res.json(contacts);
  } catch (err: any) {
    console.error(`GET /api/customers/${id}/contacts error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/customers/:id/contacts - Add contact to customer
customersRoutes.post('/:id/contacts', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;
  const data = req.body || {};

  try {
    const [custRows]: any = await pool.query('SELECT id FROM customers WHERE id = ? AND tenantId = ?', [id, targetTenant]);
    if (custRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found or access denied', code: 'CUSTOMER_NOT_FOUND' });
    }

    if (!data.name || !String(data.name).trim()) {
      return res.status(400).json({ error: 'Contact name is required', code: 'VALIDATION_ERROR' });
    }

    const contactId = 'CON-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    await pool.query(
      `INSERT INTO customer_contacts (id, tenantId, customerId, name, position, email, phone, isPrimary, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        contactId,
        targetTenant,
        id,
        String(data.name).trim(),
        data.position ? String(data.position).trim() : 'Contact',
        data.email ? String(data.email).trim() : null,
        data.phone ? String(data.phone).trim() : null,
        data.isPrimary ? 1 : 0
      ]
    );

    res.status(201).json({ success: true, id: contactId });
  } catch (err: any) {
    console.error(`POST /api/customers/${id}/contacts error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/customers/:id/visits - Customer visits list
customersRoutes.get('/:id/visits', async (req: any, res: any) => {
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
        v.*,
        vs.code as statusCode, vs.name as statusName,
        vp.code as purposeCode, vp.name as purposeName,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar,
        c.name as customerName, c.code as customerCode
      FROM visits v
      LEFT JOIN visit_statuses vs ON vs.id = v.statusId AND vs.tenantId = v.tenantId
      LEFT JOIN visit_purposes vp ON vp.id = v.purposeId AND vp.tenantId = v.tenantId
      LEFT JOIN users u ON u.id = v.picId
      LEFT JOIN customers c ON c.id = v.customerId
      WHERE v.customerId = ? AND v.tenantId = ?
      ORDER BY v.visitDate DESC, v.createdAt DESC
    `, [id, targetTenant]);

    res.json(rows);
  } catch (err: any) {
    console.error(`GET /api/customers/${id}/visits error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/customers/:id/addresses - Customer addresses list
customersRoutes.get('/:id/addresses', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { id } = req.params;

  try {
    const [addresses]: any = await pool.query(
      'SELECT * FROM customer_addresses WHERE customerId = ? ORDER BY isPrimary DESC',
      [id]
    );
    res.json(addresses);
  } catch (err: any) {
    console.error(`GET /api/customers/${id}/addresses error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/customers - Create new customer transactionally
customersRoutes.post('/', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  // Validate tenant context - client body/query tenantId is never trusted to override
  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  // Authorization verification
  const hasPerm = actorRole === 'SUPER_ADMIN' ||
    actorPermissions.includes('MANAGE_CUSTOMERS') ||
    actorPermissions.includes('MANAGE_OWN_CUSTOMERS') ||
    actorPermissions.includes('MANAGE_TENANT') ||
    actorPermissions.includes('ALL');

  if (!hasPerm) {
    return res.status(403).json({ error: 'Access denied: Customer creation permission required' });
  }

  const data = req.body || {};

  // 1. Validation: Customer Name
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    return res.status(400).json({ error: 'Customer name is required' });
  }
  const name = data.name.trim();

  // 2. Validation: Customer Type
  let resolvedTypeId: string | null = null;
  const typeCandidate = data.typeId || data.type;
  if (typeCandidate) {
    const tVal = String(typeCandidate).trim();
    const [tRows]: any = await pool.query(
      'SELECT id FROM customer_types WHERE tenantId = ? AND (id = ? OR code = ? OR name = ?) LIMIT 1',
      [targetTenant, tVal, tVal, tVal]
    );
    if (tRows.length > 0) {
      resolvedTypeId = tRows[0].id;
    } else {
      return res.status(400).json({ error: 'Invalid customer type', code: 'INVALID_CUSTOMER_TYPE' });
    }
  }

  // 3. Validation: Customer Status
  let resolvedStatusId: string | null = null;
  const statusCandidate = data.statusId || data.status;
  if (statusCandidate) {
    const sVal = String(statusCandidate).trim();
    const [sRows]: any = await pool.query(
      'SELECT id FROM customer_statuses WHERE tenantId = ? AND (id = ? OR code = ? OR name = ?) LIMIT 1',
      [targetTenant, sVal, sVal, sVal]
    );
    if (sRows.length > 0) {
      resolvedStatusId = sRows[0].id;
    } else {
      return res.status(400).json({ error: 'Invalid customer status', code: 'INVALID_CUSTOMER_STATUS' });
    }
  }

  // 4. Validation: Assigned PIC
  let resolvedPicId: string | null = null;
  const picCandidate = data.picId || data.assignedPicId;
  if (picCandidate) {
    const pVal = String(picCandidate).trim();
    const [uRows]: any = await pool.query(`
      SELECT tu.userId 
      FROM tenant_users tu
      JOIN users u ON u.id = tu.userId
      WHERE tu.tenantId = ? AND tu.userId = ? AND u.status = 'ACTIVE' AND tu.status = 'ACTIVE'
      LIMIT 1
    `, [targetTenant, pVal]);

    if (uRows.length > 0) {
      resolvedPicId = uRows[0].userId;
    } else {
      return res.status(400).json({ error: 'Invalid or unauthorized PIC assigned', code: 'CROSS_TENANT_PIC_DENIED' });
    }
  } else if (actorRole === 'SALES_REP') {
    resolvedPicId = actorUserId;
  }

  // 5. Validation: Email format if provided
  if (data.email && typeof data.email === 'string' && data.email.trim()) {
    const emailStr = data.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailStr)) {
      return res.status(400).json({ error: 'Invalid email address format', code: 'INVALID_EMAIL' });
    }
  }

  // Generate Authoritative Identifiers Server-Side
  const customerId = 'CUS-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
  const code = (data.code && String(data.code).trim().startsWith('CUS-'))
    ? String(data.code).trim()
    : 'CUS-' + Math.floor(1000 + Math.random() * 9000);

  const industry = data.industry ? String(data.industry).trim() : null;
  const website = data.website ? String(data.website).trim() : null;
  const phone = data.phone ? String(data.phone).trim() : null;
  const email = data.email ? String(data.email).trim() : null;
  const notes = data.notes ? String(data.notes).trim() : null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Insert into customers table
    await conn.query(`
      INSERT INTO customers (
        id, tenantId, code, name, typeId, statusId, industry, website, phone, email, notes, picId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      customerId, targetTenant, code, name, resolvedTypeId, resolvedStatusId, industry, website, phone, email, notes, resolvedPicId
    ]);

    // 2. Insert primary contact if supplied
    if (Array.isArray(data.contacts) && data.contacts.length > 0) {
      for (const c of data.contacts) {
        if (c.name && String(c.name).trim()) {
          const contactId = 'CON-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
          await conn.query(`
            INSERT INTO customer_contacts (
              id, tenantId, customerId, name, position, email, phone, isPrimary, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          `, [
            contactId, targetTenant, customerId, String(c.name).trim(),
            c.position ? String(c.position).trim() : 'Primary Contact',
            c.email ? String(c.email).trim() : null,
            c.phone ? String(c.phone).trim() : null,
            c.isPrimary ? 1 : 0
          ]);
        }
      }
    } else if (data.contactPerson && String(data.contactPerson).trim()) {
      const contactId = 'CON-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
      await conn.query(`
        INSERT INTO customer_contacts (
          id, tenantId, customerId, name, position, email, phone, isPrimary, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
      `, [
        contactId, targetTenant, customerId, String(data.contactPerson).trim(),
        data.contactPosition ? String(data.contactPosition).trim() : 'Primary Contact',
        email, phone
      ]);
    }

    // 3. Insert address if supplied
    if (Array.isArray(data.addresses) && data.addresses.length > 0) {
      for (const a of data.addresses) {
        if (a.address || a.city || a.province) {
          const addrId = 'ADDR-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
          await conn.query(`
            INSERT INTO customer_addresses (
              id, customerId, type, address, city, province, postalCode, country, isPrimary
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            addrId, customerId, a.type ? String(a.type).trim() : 'OFFICE',
            a.address ? String(a.address).trim() : null,
            a.city ? String(a.city).trim() : null,
            a.province ? String(a.province).trim() : null,
            a.postalCode ? String(a.postalCode).trim() : null,
            a.country ? String(a.country).trim() : 'Indonesia',
            a.isPrimary ? 1 : 0
          ]);
        }
      }
    } else if (data.address || data.streetAddress || data.city || data.province) {
      const addrId = 'ADDR-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
      await conn.query(`
        INSERT INTO customer_addresses (
          id, customerId, type, address, city, province, postalCode, country, isPrimary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        addrId, customerId, 'OFFICE',
        data.streetAddress ? String(data.streetAddress).trim() : (data.address ? String(data.address).trim() : null),
        data.city ? String(data.city).trim() : null,
        data.province ? String(data.province).trim() : null,
        data.postalCode ? String(data.postalCode).trim() : null,
        'Indonesia'
      ]);
    }

    // 4. Insert customer assignment if PIC is set
    if (resolvedPicId) {
      const assignId = 'CAS-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
      await conn.query(`
        INSERT INTO customer_assignments (id, customerId, userId, role, assignedAt)
        VALUES (?, ?, ?, 'PRIMARY_PIC', NOW())
      `, [assignId, customerId, resolvedPicId]);
    }

    await conn.commit();

    // 5. Audit Logging
    await logAudit(
      targetTenant,
      actorUserId,
      'CUSTOMER_CREATED',
      'Customer',
      customerId,
      `Customer '${name}' created successfully`,
      req.ip,
      req.get('User-Agent'),
      'CRM'
    );

    res.status(201).json({
      success: true,
      data: {
        id: customerId,
        tenantId: targetTenant,
        code,
        name,
        typeId: resolvedTypeId,
        statusId: resolvedStatusId,
        industry,
        website,
        phone,
        email,
        notes,
        picId: resolvedPicId
      }
    });
  } catch (err: any) {
    await conn.rollback();
    console.error('POST /api/customers transaction error:', err);
    res.status(500).json({ error: 'Internal Server Error saving customer' });
  } finally {
    conn.release();
  }
});

// PUT /api/customers/:id - Update customer transactionally
customersRoutes.put('/:id', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const hasPerm = actorRole === 'SUPER_ADMIN' ||
    actorPermissions.includes('MANAGE_CUSTOMERS') ||
    actorPermissions.includes('MANAGE_OWN_CUSTOMERS') ||
    actorPermissions.includes('MANAGE_TENANT') ||
    actorPermissions.includes('ALL');

  if (!hasPerm) {
    return res.status(403).json({ error: 'Access denied: Customer edit permission required' });
  }

  const { id } = req.params;
  const data = req.body || {};

  const [existing]: any = await pool.query('SELECT * FROM customers WHERE id = ? AND tenantId = ?', [id, targetTenant]);
  if (existing.length === 0) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  let resolvedTypeId = existing[0].typeId;
  if (data.typeId || data.type) {
    const tVal = String(data.typeId || data.type).trim();
    const [tRows]: any = await pool.query(
      'SELECT id FROM customer_types WHERE tenantId = ? AND (id = ? OR code = ? OR name = ?) LIMIT 1',
      [targetTenant, tVal, tVal, tVal]
    );
    if (tRows.length > 0) resolvedTypeId = tRows[0].id;
  }

  let resolvedStatusId = existing[0].statusId;
  if (data.statusId || data.status) {
    const sVal = String(data.statusId || data.status).trim();
    const [sRows]: any = await pool.query(
      'SELECT id FROM customer_statuses WHERE tenantId = ? AND (id = ? OR code = ? OR name = ?) LIMIT 1',
      [targetTenant, sVal, sVal, sVal]
    );
    if (sRows.length > 0) resolvedStatusId = sRows[0].id;
  }

  let resolvedPicId = existing[0].picId;
  if (data.picId || data.assignedPicId) {
    const pVal = String(data.picId || data.assignedPicId).trim();
    const [uRows]: any = await pool.query(`
      SELECT tu.userId FROM tenant_users tu
      JOIN users u ON u.id = tu.userId
      WHERE tu.tenantId = ? AND tu.userId = ? AND u.status = 'ACTIVE' AND tu.status = 'ACTIVE'
    `, [targetTenant, pVal]);
    if (uRows.length > 0) resolvedPicId = uRows[0].userId;
  }

  const name = data.name !== undefined ? String(data.name).trim() : existing[0].name;
  const industry = data.industry !== undefined ? String(data.industry).trim() : existing[0].industry;
  const website = data.website !== undefined ? String(data.website).trim() : existing[0].website;
  const phone = data.phone !== undefined ? String(data.phone).trim() : existing[0].phone;
  const email = data.email !== undefined ? String(data.email).trim() : existing[0].email;
  const notes = data.notes !== undefined ? String(data.notes).trim() : existing[0].notes;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`
      UPDATE customers
      SET name = ?, typeId = ?, statusId = ?, industry = ?, website = ?, phone = ?, email = ?, notes = ?, picId = ?, updatedAt = NOW()
      WHERE id = ? AND tenantId = ?
    `, [name, resolvedTypeId, resolvedStatusId, industry, website, phone, email, notes, resolvedPicId, id, targetTenant]);

    if (data.contactPerson && String(data.contactPerson).trim()) {
      const [exContacts]: any = await conn.query('SELECT id FROM customer_contacts WHERE customerId = ? AND isPrimary = 1', [id]);
      if (exContacts.length > 0) {
        await conn.query(`
          UPDATE customer_contacts
          SET name = ?, email = ?, phone = ?, updatedAt = NOW()
          WHERE id = ?
        `, [String(data.contactPerson).trim(), email, phone, exContacts[0].id]);
      } else {
        const contactId = 'CON-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
        await conn.query(`
          INSERT INTO customer_contacts (id, tenantId, customerId, name, position, email, phone, isPrimary, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 'Primary Contact', ?, ?, 1, NOW(), NOW())
        `, [contactId, targetTenant, id, String(data.contactPerson).trim(), email, phone]);
      }
    }

    if (data.address || data.streetAddress || data.city || data.province || data.postalCode) {
      const addrStr = data.streetAddress ? String(data.streetAddress).trim() : (data.address ? String(data.address).trim() : null);
      const cityStr = data.city ? String(data.city).trim() : null;
      const provStr = data.province ? String(data.province).trim() : null;
      const postStr = data.postalCode ? String(data.postalCode).trim() : null;
      const [exAddr]: any = await conn.query('SELECT id FROM customer_addresses WHERE customerId = ? AND isPrimary = 1', [id]);
      if (exAddr.length > 0) {
        await conn.query(`
          UPDATE customer_addresses
          SET address = ?, city = ?, province = ?, postalCode = ?
          WHERE id = ?
        `, [addrStr, cityStr, provStr, postStr, exAddr[0].id]);
      } else {
        const addrId = 'ADDR-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
        await conn.query(`
          INSERT INTO customer_addresses (id, customerId, type, address, city, province, postalCode, country, isPrimary)
          VALUES (?, ?, 'OFFICE', ?, ?, ?, ?, 'Indonesia', 1)
        `, [addrId, id, addrStr, cityStr, provStr, postStr]);
      }
    }

    if (resolvedPicId && resolvedPicId !== existing[0].picId) {
      const assignId = 'CAS-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
      await conn.query(`
        INSERT INTO customer_assignments (id, customerId, userId, role, assignedAt)
        VALUES (?, ?, ?, 'PRIMARY_PIC', NOW())
      `, [assignId, id, resolvedPicId]);
    }

    await conn.commit();

    await logAudit(
      targetTenant,
      actorUserId,
      'CUSTOMER_UPDATED',
      'Customer',
      id,
      `Customer '${name}' updated successfully`,
      req.ip,
      req.get('User-Agent'),
      'CRM'
    );

    res.json({ success: true, id });
  } catch (err: any) {
    await conn.rollback();
    console.error(`PUT /api/customers/${id} error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    conn.release();
  }
});

// DELETE /api/customers/:id - Delete customer
customersRoutes.delete('/:id', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const hasPerm = actorRole === 'SUPER_ADMIN' ||
    actorPermissions.includes('MANAGE_CUSTOMERS') ||
    actorPermissions.includes('MANAGE_TENANT') ||
    actorPermissions.includes('ALL');

  if (!hasPerm) {
    return res.status(403).json({ error: 'Access denied: Customer deletion permission required' });
  }

  const { id } = req.params;

  const [existing]: any = await pool.query('SELECT * FROM customers WHERE id = ? AND tenantId = ?', [id, targetTenant]);
  if (existing.length === 0) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query('DELETE FROM customer_contacts WHERE customerId = ?', [id]);
    await conn.query('DELETE FROM customer_addresses WHERE customerId = ?', [id]);
    await conn.query('DELETE FROM customer_assignments WHERE customerId = ?', [id]);
    await conn.query('DELETE FROM customers WHERE id = ? AND tenantId = ?', [id, targetTenant]);

    await conn.commit();

    await logAudit(
      targetTenant,
      actorUserId,
      'CUSTOMER_DELETED',
      'Customer',
      id,
      `Customer '${existing[0].name}' deleted`,
      req.ip,
      req.get('User-Agent'),
      'CRM'
    );

    res.json({ success: true, id });
  } catch (err: any) {
    await conn.rollback();
    console.error(`DELETE /api/customers/${id} error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    conn.release();
  }
});


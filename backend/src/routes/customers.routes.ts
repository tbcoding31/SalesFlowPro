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
      LEFT JOIN customer_statuses cs ON cs.id = c.statusId
      LEFT JOIN customer_types ct ON ct.id = c.typeId
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
        COUNT(CASE WHEN stageId = 'WON' OR stageId = 'PS-WON' THEN 1 END) as wonProjects
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
      'SELECT id FROM customer_types WHERE id = ? OR code = ? OR name = ? LIMIT 1',
      [tVal, tVal, tVal]
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
      'SELECT id FROM customer_statuses WHERE id = ? OR code = ? OR name = ? LIMIT 1',
      [sVal, sVal, sVal]
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
        id, tenantId, code, name, typeId, statusId, industry, website, phone, email, notes, picId, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
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
      'SELECT id FROM customer_types WHERE id = ? OR code = ? OR name = ? LIMIT 1',
      [tVal, tVal, tVal]
    );
    if (tRows.length > 0) resolvedTypeId = tRows[0].id;
  }

  let resolvedStatusId = existing[0].statusId;
  if (data.statusId || data.status) {
    const sVal = String(data.statusId || data.status).trim();
    const [sRows]: any = await pool.query(
      'SELECT id FROM customer_statuses WHERE id = ? OR code = ? OR name = ? LIMIT 1',
      [sVal, sVal, sVal]
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
      SET name = ?, typeId = ?, statusId = ?, industry = ?, website = ?, phone = ?, email = ?, notes = ?, picId = ?
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


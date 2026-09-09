import { Router } from 'express';
import { pool } from '../db';
import { validateTargetTenant } from '../utils/scope';
import { logAudit } from '../utils/audit';

export const masterDataRoutes = Router();

const ALLOWED_PLATFORM_CATEGORIES = [
  'activity_types',
  'task_priorities',
  'customer_types',
  'customer_statuses',
  'visit_purposes',
  'visit_statuses',
  'task_statuses',
  'project_stages',
  'departments',
  'positions'
];

// --- SUPER ADMIN PLATFORM MASTER DATA ENDPOINTS ---

masterDataRoutes.get('/platform/:category', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  if (actorRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access denied. Super Admin required.' });
  }

  const category = req.params.category;
  if (!ALLOWED_PLATFORM_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid master data category' });
  }

  try {
    let query = `SELECT * FROM ${category}`;
    // For tenant-scoped tables, return blueprints (tenantId IS NULL)
    if (category === 'departments' || category === 'positions') {
      query += ` WHERE tenantId IS NULL`;
    }
    const [rows]: any = await pool.query(query);
    res.json(rows);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

masterDataRoutes.post('/platform/:category', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  if (actorRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const category = req.params.category;
  if (!ALLOWED_PLATFORM_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid master data category' });
  }

  const data = req.body;
  if (!data.id) return res.status(400).json({ error: 'Missing ID' });

  try {
    let query = '';
    let params = [];

    // Make sure we set tenantId to NULL for tenant-scoped master data
    if (category === 'departments') {
      query = 'INSERT INTO departments (id, tenantId, name, description) VALUES (?, NULL, ?, ?)';
      params = [data.id, data.name, data.description];
    } else if (category === 'positions') {
      query = 'INSERT INTO positions (id, tenantId, name, level) VALUES (?, NULL, ?, ?)';
      params = [data.id, data.name, data.level];
    } else if (category === 'activity_types') {
      query = 'INSERT INTO activity_types (id, code, name, icon, color) VALUES (?, ?, ?, ?, ?)';
      params = [data.id, data.code, data.name, data.icon, data.color];
    } else if (category === 'customer_statuses') {
      query = 'INSERT INTO customer_statuses (id, code, name, color) VALUES (?, ?, ?, ?)';
      params = [data.id, data.code, data.name, data.color];
    } else if (category === 'task_priorities' || category === 'task_statuses') {
      query = `INSERT INTO ${category} (id, code, name, color) VALUES (?, ?, ?, ?)`;
      params = [data.id, data.code, data.name, data.color];
    } else if (category === 'project_stages') {
      const code = String(data.code || '').trim().toUpperCase();
      if (!code) {
        return res.status(400).json({ error: 'Stage code is required and cannot be empty' });
      }
      const [dup]: any = await pool.query('SELECT id FROM project_stages WHERE code = ?', [code]);
      if (dup.length > 0) {
        return res.status(409).json({ error: `Stage code '${code}' already exists` });
      }

      const phase = String(data.phase || 'SALES').toUpperCase();
      if (!['SALES', 'DELIVERY', 'POST_LIVE', 'CLOSED'].includes(phase)) {
        return res.status(400).json({ error: 'Invalid phase. Must be SALES, DELIVERY, POST_LIVE, or CLOSED' });
      }

      const commercialOutcome = String(data.commercialOutcome || 'NONE').toUpperCase();
      if (!['NONE', 'WON', 'LOST', 'CANCELLED'].includes(commercialOutcome)) {
        return res.status(400).json({ error: 'Invalid commercialOutcome. Must be NONE, WON, LOST, or CANCELLED' });
      }

      const isTerminal = data.isTerminal === 1 || data.isTerminal === true || data.isTerminal === '1' ? 1 : 0;
      const allowVisits = data.allowVisits !== undefined ? (data.allowVisits ? 1 : 0) : 1;
      const allowNewProject = data.allowNewProject !== undefined ? (data.allowNewProject ? 1 : 0) : 1;

      // MANDATORY EXECUTION GATE 1: STRICT TERMINAL CONSISTENCY
      const shouldBeTerminal = (phase === 'CLOSED' || ['LOST', 'CANCELLED'].includes(commercialOutcome));
      if (Boolean(isTerminal) !== shouldBeTerminal) {
        return res.status(400).json({
          error: 'Strict Terminal Consistency Violation: isTerminal must be 1 if and only if phase is CLOSED or commercialOutcome is LOST or CANCELLED.',
          code: 'STRICT_TERMINAL_CONSISTENCY_VIOLATION'
        });
      }

      const probability = data.probability !== undefined ? Math.max(0, Math.min(100, Number(data.probability) || 0)) : 0;
      const displayOrder = Number(data.displayOrder) || 0;
      const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1;
      const name = String(data.name || data.label || code).trim();

      query = 'INSERT INTO project_stages (id, code, name, phase, commercialOutcome, displayOrder, probability, isTerminal, allowVisits, allowNewProject, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      params = [data.id, code, name, phase, commercialOutcome, displayOrder, probability, isTerminal, allowVisits, allowNewProject, isActive];
    } else {
      query = `INSERT INTO ${category} (id, code, name) VALUES (?, ?, ?)`;
      params = [data.id, data.code, data.name];
    }

    await pool.query(query, params);
    res.json({ success: true, id: data.id });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

masterDataRoutes.put('/platform/:category/:id', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  if (actorRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const category = req.params.category;
  if (!ALLOWED_PLATFORM_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const id = req.params.id;
  const data = req.body;

  try {
    let query = '';
    let params = [];

    if (category === 'departments') {
      query = 'UPDATE departments SET name = ?, description = ? WHERE id = ? AND tenantId IS NULL';
      params = [data.name, data.description, id];
    } else if (category === 'positions') {
      query = 'UPDATE positions SET name = ?, level = ? WHERE id = ? AND tenantId IS NULL';
      params = [data.name, data.level, id];
    } else if (category === 'activity_types') {
      query = 'UPDATE activity_types SET code = ?, name = ?, icon = ?, color = ? WHERE id = ?';
      params = [data.code, data.name, data.icon, data.color, id];
    } else if (category === 'customer_statuses' || category === 'task_priorities' || category === 'task_statuses') {
      query = `UPDATE ${category} SET code = ?, name = ?, color = ? WHERE id = ?`;
      params = [data.code, data.name, data.color, id];
    } else if (category === 'project_stages') {
      const [existing]: any = await pool.query('SELECT * FROM project_stages WHERE id = ?', [id]);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Project stage not found' });
      }
      const current = existing[0];
      let code = current.code;
      if (data.code !== undefined) {
        code = String(data.code).trim().toUpperCase();
        if (!code) {
          return res.status(400).json({ error: 'Stage code cannot be empty' });
        }
        const [dup]: any = await pool.query('SELECT id FROM project_stages WHERE code = ? AND id != ?', [code, id]);
        if (dup.length > 0) {
          return res.status(409).json({ error: `Stage code '${code}' already exists` });
        }
      }

      const phase = data.phase !== undefined ? String(data.phase).toUpperCase() : current.phase;
      if (!['SALES', 'DELIVERY', 'POST_LIVE', 'CLOSED'].includes(phase)) {
        return res.status(400).json({ error: 'Invalid phase. Must be SALES, DELIVERY, POST_LIVE, or CLOSED' });
      }

      const commercialOutcome = data.commercialOutcome !== undefined ? String(data.commercialOutcome).toUpperCase() : current.commercialOutcome;
      if (!['NONE', 'WON', 'LOST', 'CANCELLED'].includes(commercialOutcome)) {
        return res.status(400).json({ error: 'Invalid commercialOutcome. Must be NONE, WON, LOST, or CANCELLED' });
      }

      const isTerminal = data.isTerminal !== undefined 
        ? (data.isTerminal === 1 || data.isTerminal === true || data.isTerminal === '1' ? 1 : 0)
        : current.isTerminal;
      const allowVisits = data.allowVisits !== undefined ? (data.allowVisits ? 1 : 0) : current.allowVisits;
      const allowNewProject = data.allowNewProject !== undefined ? (data.allowNewProject ? 1 : 0) : current.allowNewProject;

      // MANDATORY EXECUTION GATE 1: STRICT TERMINAL CONSISTENCY
      const shouldBeTerminal = (phase === 'CLOSED' || ['LOST', 'CANCELLED'].includes(commercialOutcome));
      if (Boolean(isTerminal) !== shouldBeTerminal) {
        return res.status(400).json({
          error: 'Strict Terminal Consistency Violation: isTerminal must be 1 if and only if phase is CLOSED or commercialOutcome is LOST or CANCELLED.',
          code: 'STRICT_TERMINAL_CONSISTENCY_VIOLATION'
        });
      }

      const probability = data.probability !== undefined ? Math.max(0, Math.min(100, Number(data.probability) || 0)) : current.probability;
      const displayOrder = data.displayOrder !== undefined ? Number(data.displayOrder) : current.displayOrder;
      const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive;
      const name = data.name !== undefined ? String(data.name).trim() : current.name;

      query = 'UPDATE project_stages SET code = ?, name = ?, phase = ?, commercialOutcome = ?, displayOrder = ?, probability = ?, isTerminal = ?, allowVisits = ?, allowNewProject = ?, isActive = ? WHERE id = ?';
      params = [code, name, phase, commercialOutcome, displayOrder, probability, isTerminal, allowVisits, allowNewProject, isActive, id];
    } else {
      query = `UPDATE ${category} SET code = ?, name = ? WHERE id = ?`;
      params = [data.code, data.name, id];
    }

    await pool.query(query, params);
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

masterDataRoutes.delete('/platform/:category/:id', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  if (actorRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const category = req.params.category;
  if (!ALLOWED_PLATFORM_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const id = req.params.id;

  try {
    if (category === 'project_stages') {
      const [projRows]: any = await pool.query('SELECT COUNT(*) as projectCount FROM projects WHERE stageId = ?', [id]);
      if (projRows[0]?.projectCount > 0) {
        return res.status(409).json({
          error: 'Cannot delete project stage because it is currently assigned to existing projects.',
          code: 'STAGE_IN_USE',
          projectCount: projRows[0].projectCount
        });
      }
      const [histRows]: any = await pool.query('SELECT COUNT(*) as historyCount FROM project_stage_histories WHERE fromStageId = ? OR toStageId = ?', [id, id]);
      if (histRows[0]?.historyCount > 0) {
        return res.status(409).json({
          error: 'Cannot delete project stage because it is referenced in project transition history.',
          code: 'STAGE_IN_USE',
          historyCount: histRows[0].historyCount
        });
      }
    }

    let query = `DELETE FROM ${category} WHERE id = ?`;
    if (category === 'departments' || category === 'positions') {
      query += ' AND tenantId IS NULL';
    }
    await pool.query(query, [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(409).json({ error: 'Cannot delete item because it is referenced by existing data.' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- TENANT-SCOPED MASTER DATA ENDPOINTS ---

const handleTenantGetMasterData = async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const category = req.params.category;
  if (!ALLOWED_PLATFORM_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid master data category' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  try {
    if (category === 'departments' || category === 'positions') {
      const [rows]: any = await pool.query(
        `SELECT * FROM ${category} WHERE tenantId = ? ORDER BY id ASC`,
        [targetTenant]
      );
      return res.json(rows);
    }

    let orderBy = 'id ASC';
    if (category === 'project_stages') {
      orderBy = 'displayOrder ASC, id ASC';
    }
    const [rows]: any = await pool.query(`SELECT * FROM ${category} ORDER BY ${orderBy}`);
    res.json(rows);
  } catch (err: any) {
    console.error(`Error GET /api/master-data/${category}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

masterDataRoutes.get('/tenant/:category', handleTenantGetMasterData);
masterDataRoutes.get('/:category', handleTenantGetMasterData);

const handleTenantPostMasterData = async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const category = req.params.category;
  if (!ALLOWED_PLATFORM_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid master data category' });
  }

  if (category !== 'departments' && category !== 'positions') {
    return res.status(403).json({ error: 'Reference master data can only be modified by platform administrators.' });
  }

  const hasPerm = actorRole === 'SUPER_ADMIN' || actorRole === 'TENANT_ADMIN' || actorPermissions.includes('MANAGE_TENANT');
  if (!hasPerm) {
    return res.status(403).json({ error: 'Access denied. Management capability required.' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const data = req.body;
  if (!data.id) return res.status(400).json({ error: 'Missing ID' });

  try {
    if (category === 'departments') {
      await pool.query(
        'INSERT INTO departments (id, tenantId, name, description) VALUES (?, ?, ?, ?)',
        [data.id, targetTenant, data.name, data.description || null]
      );
    } else if (category === 'positions') {
      await pool.query(
        'INSERT INTO positions (id, tenantId, name, level) VALUES (?, ?, ?, ?)',
        [data.id, targetTenant, data.name, data.level || 1]
      );
    }
    res.status(201).json({ success: true, id: data.id });
  } catch (err: any) {
    console.error(`Error POST /api/master-data/${category}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const handleTenantPutMasterData = async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const category = req.params.category;
  if (!ALLOWED_PLATFORM_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  if (category !== 'departments' && category !== 'positions') {
    return res.status(403).json({ error: 'Reference master data can only be modified by platform administrators.' });
  }

  const hasPerm = actorRole === 'SUPER_ADMIN' || actorRole === 'TENANT_ADMIN' || actorPermissions.includes('MANAGE_TENANT');
  if (!hasPerm) {
    return res.status(403).json({ error: 'Access denied. Management capability required.' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const id = req.params.id;
  const data = req.body;

  try {
    if (category === 'departments') {
      await pool.query(
        'UPDATE departments SET name = ?, description = ? WHERE id = ? AND tenantId = ?',
        [data.name, data.description || null, id, targetTenant]
      );
    } else if (category === 'positions') {
      await pool.query(
        'UPDATE positions SET name = ?, level = ? WHERE id = ? AND tenantId = ?',
        [data.name, data.level || 1, id, targetTenant]
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error(`Error PUT /api/master-data/${category}/${id}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const handleTenantDeleteMasterData = async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const category = req.params.category;
  if (!ALLOWED_PLATFORM_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  if (category !== 'departments' && category !== 'positions') {
    return res.status(403).json({ error: 'Reference master data can only be modified by platform administrators.' });
  }

  const hasPerm = actorRole === 'SUPER_ADMIN' || actorRole === 'TENANT_ADMIN' || actorPermissions.includes('MANAGE_TENANT');
  if (!hasPerm) {
    return res.status(403).json({ error: 'Access denied. Management capability required.' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const id = req.params.id;

  try {
    await pool.query(
      `DELETE FROM ${category} WHERE id = ? AND tenantId = ?`,
      [id, targetTenant]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error(`Error DELETE /api/master-data/${category}/${id}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

masterDataRoutes.post('/tenant/:category', handleTenantPostMasterData);
masterDataRoutes.post('/:category', handleTenantPostMasterData);

masterDataRoutes.put('/tenant/:category/:id', handleTenantPutMasterData);
masterDataRoutes.put('/:category/:id', handleTenantPutMasterData);

masterDataRoutes.delete('/tenant/:category/:id', handleTenantDeleteMasterData);
masterDataRoutes.delete('/:category/:id', handleTenantDeleteMasterData);

// --- SUPER ADMIN VISIT REMINDER PLATFORM DEFAULTS ---
const handleGetVisitReminderDefaults = async (req: any, res: any) => {
  const actorRole = req.userRole;
  if (actorRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access denied. Super Admin required.' });
  }

  try {
    const [rows]: any = await pool.query(
      'SELECT * FROM visit_reminder_defaults WHERE isActive = 1 ORDER BY createdAt DESC LIMIT 1'
    );
    if (rows.length === 0) {
      return res.status(500).json({ error: 'CONFIG_INTEGRITY_ERROR', message: 'No active visit_reminder_defaults found' });
    }
    const def = rows[0];
    res.json({
      id: def.id,
      dashboardReminderEnabled: Boolean(def.dashboardReminderEnabled),
      dashboardReminderDaysBefore: Number(def.dashboardReminderDaysBefore),
      emailReminderEnabled: Boolean(def.emailReminderEnabled),
      emailReminderDaysBefore: Number(def.emailReminderDaysBefore),
      immediateReminderInsideWindowEnabled: Boolean(def.immediateReminderInsideWindowEnabled),
      isActive: Boolean(def.isActive),
      createdAt: def.createdAt,
      updatedAt: def.updatedAt
    });
  } catch (err: any) {
    console.error('Error fetching visit_reminder_defaults:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const handlePutVisitReminderDefaults = async (req: any, res: any) => {
  const actorRole = req.userRole;
  const actorUserId = req.userId;
  if (actorRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access denied. Super Admin required.' });
  }

  const {
    dashboardReminderEnabled,
    dashboardReminderDaysBefore,
    emailReminderEnabled,
    emailReminderDaysBefore,
    immediateReminderInsideWindowEnabled
  } = req.body;

  // Domain boundary validations
  if (typeof dashboardReminderEnabled !== 'boolean') {
    return res.status(400).json({ error: 'INVALID_TYPE', message: 'dashboardReminderEnabled must be boolean' });
  }
  const dashDays = Number(dashboardReminderDaysBefore);
  if (isNaN(dashDays) || !Number.isInteger(dashDays) || dashDays < 0 || dashDays > 30) {
    return res.status(400).json({ error: 'INVALID_RANGE', message: 'dashboardReminderDaysBefore must be an integer between 0 and 30' });
  }

  if (typeof emailReminderEnabled !== 'boolean') {
    return res.status(400).json({ error: 'INVALID_TYPE', message: 'emailReminderEnabled must be boolean' });
  }
  const emailDays = Number(emailReminderDaysBefore);
  if (isNaN(emailDays) || !Number.isInteger(emailDays) || emailDays < 0 || emailDays > 14) {
    return res.status(400).json({ error: 'INVALID_RANGE', message: 'emailReminderDaysBefore must be an integer between 0 and 14' });
  }

  if (typeof immediateReminderInsideWindowEnabled !== 'boolean') {
    return res.status(400).json({ error: 'INVALID_TYPE', message: 'immediateReminderInsideWindowEnabled must be boolean' });
  }

  try {
    const [activeRows]: any = await pool.query(
      'SELECT * FROM visit_reminder_defaults WHERE isActive = 1 ORDER BY createdAt DESC LIMIT 1'
    );
    if (activeRows.length === 0) {
      return res.status(500).json({ error: 'CONFIG_INTEGRITY_ERROR', message: 'No active visit_reminder_defaults found' });
    }
    const current = activeRows[0];

    await pool.query(`
      UPDATE visit_reminder_defaults
      SET dashboardReminderEnabled = ?,
          dashboardReminderDaysBefore = ?,
          emailReminderEnabled = ?,
          emailReminderDaysBefore = ?,
          immediateReminderInsideWindowEnabled = ?,
          updatedById = ?,
          updatedAt = NOW()
      WHERE id = ?
    `, [
      dashboardReminderEnabled,
      dashDays,
      emailReminderEnabled,
      emailDays,
      immediateReminderInsideWindowEnabled,
      actorUserId,
      current.id
    ]);

    await logAudit(
      null,
      actorUserId,
      'UPDATE',
      'VisitReminderDefaults',
      current.id,
      `Super Admin updated platform visit reminder defaults: dashboard=${dashDays}d (${dashboardReminderEnabled}), email=${emailDays}d (${emailReminderEnabled}), immediateInside=${immediateReminderInsideWindowEnabled}`,
      req.ip,
      req.get('User-Agent'),
      'MASTER_DATA'
    );

    res.json({
      success: true,
      message: 'Platform visit reminder defaults updated successfully',
      settings: {
        id: current.id,
        dashboardReminderEnabled,
        dashboardReminderDaysBefore: dashDays,
        emailReminderEnabled,
        emailReminderDaysBefore: emailDays,
        immediateReminderInsideWindowEnabled,
        updatedAt: new Date()
      }
    });
  } catch (err: any) {
    console.error('Error updating visit_reminder_defaults:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

masterDataRoutes.get('/platform/visit-reminder-defaults', handleGetVisitReminderDefaults);
masterDataRoutes.get('/visit-reminder-defaults', handleGetVisitReminderDefaults);
masterDataRoutes.put('/platform/visit-reminder-defaults', handlePutVisitReminderDefaults);
masterDataRoutes.put('/visit-reminder-defaults', handlePutVisitReminderDefaults);


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
  'positions',
  'follow_up_types'
];

const TYPE_B_CATEGORIES = [
  'project_stages',
  'task_statuses',
  'customer_statuses',
  'visit_statuses'
];

// --- SUPER ADMIN PLATFORM MASTER DATA ENDPOINTS ---

masterDataRoutes.get('/platform/:category', async (req: any, res: any) => {
  const actorRole = (req as any).userRoleCode || (req as any).userRole;
  const isPlatform = (req as any).isPlatformUser;
  if (actorRole !== 'SUPER_ADMIN' || !isPlatform) {
    return res.status(403).json({ error: 'Access denied. Super Admin required.' });
  }

  const category = req.params.category;
  if (!ALLOWED_PLATFORM_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid master data category' });
  }

  try {
    let orderBy = 'displayOrder ASC, id ASC';
    if (category === 'positions') orderBy = 'level ASC, id ASC';
    const [rows]: any = await pool.query(`SELECT * FROM ${category} WHERE tenantId IS NULL ORDER BY ${orderBy}`);
    res.json(rows);
  } catch (err: any) {
    console.error(`Error GET /api/master-data/platform/${category}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

masterDataRoutes.post('/platform/:category', async (req: any, res: any) => {
  const actorRole = (req as any).userRoleCode || (req as any).userRole;
  const isPlatform = (req as any).isPlatformUser;
  if (actorRole !== 'SUPER_ADMIN' || !isPlatform) {
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
    let params: any[] = [];

    if (category === 'departments') {
      query = 'INSERT INTO departments (id, tenantId, sourceType, platformMasterId, name, description, isActive, displayOrder) VALUES (?, NULL, \'PLATFORM\', NULL, ?, ?, ?, ?)';
      params = [data.id, data.name, data.description || null, data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1, data.displayOrder || 0];
    } else if (category === 'positions') {
      query = 'INSERT INTO positions (id, tenantId, sourceType, platformMasterId, name, level, isActive) VALUES (?, NULL, \'PLATFORM\', NULL, ?, ?, ?)';
      params = [data.id, data.name, data.level || 1, data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1];
    } else if (category === 'activity_types') {
      query = 'INSERT INTO activity_types (id, tenantId, sourceType, platformMasterId, code, name, icon, color, isActive, displayOrder) VALUES (?, NULL, \'PLATFORM\', NULL, ?, ?, ?, ?, ?, ?)';
      params = [data.id, data.code, data.name, data.icon || null, data.color || null, data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1, data.displayOrder || 0];
    } else if (category === 'follow_up_types') {
      query = 'INSERT INTO follow_up_types (id, tenantId, sourceType, platformMasterId, code, name, description, icon, color, isActive, displayOrder) VALUES (?, NULL, \'PLATFORM\', NULL, ?, ?, ?, ?, ?, ?, ?)';
      params = [data.id, data.code, data.name, data.description || null, data.icon || null, data.color || null, data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1, data.displayOrder || 0];
    } else if (category === 'customer_statuses' || category === 'task_statuses') {
      query = `INSERT INTO ${category} (id, tenantId, sourceType, platformMasterId, code, name, color, isActive, displayOrder) VALUES (?, NULL, 'PLATFORM', NULL, ?, ?, ?, ?, ?)`;
      params = [data.id, data.code, data.name, data.color || null, data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1, data.displayOrder || 0];
    } else if (category === 'task_priorities') {
      query = `INSERT INTO task_priorities (id, tenantId, sourceType, platformMasterId, code, name, color, isActive, displayOrder) VALUES (?, NULL, 'PLATFORM', NULL, ?, ?, ?, ?, ?)`;
      const prioVal = data.icon !== undefined ? data.icon : (data.color !== undefined ? data.color : null);
      params = [data.id, data.code, data.name, prioVal, data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1, data.displayOrder || 0];
    } else if (category === 'customer_types' || category === 'visit_purposes') {
      query = `INSERT INTO ${category} (id, tenantId, sourceType, platformMasterId, code, name, isActive, displayOrder) VALUES (?, NULL, 'PLATFORM', NULL, ?, ?, ?, ?)`;
      params = [data.id, data.code, data.name, data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1, data.displayOrder || 0];
    } else if (category === 'visit_statuses') {
      query = 'INSERT INTO visit_statuses (id, tenantId, sourceType, platformMasterId, code, name, isTerminal, isActive, displayOrder) VALUES (?, NULL, \'PLATFORM\', NULL, ?, ?, ?, ?, ?)';
      params = [data.id, data.code, data.name, data.isTerminal ? 1 : 0, data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1, data.displayOrder || 0];
    } else if (category === 'project_stages') {
      const code = String(data.code || '').trim().toUpperCase();
      if (!code) return res.status(400).json({ error: 'Stage code is required' });

      const phase = String(data.phase || 'SALES').toUpperCase();
      const commercialOutcome = String(data.commercialOutcome || 'NONE').toUpperCase();
      const isTerminal = (phase === 'CLOSED' || ['LOST', 'CANCELLED'].includes(commercialOutcome)) ? 1 : 0;

      query = 'INSERT INTO project_stages (id, tenantId, sourceType, platformMasterId, code, name, phase, commercialOutcome, displayOrder, probability, isTerminal, allowVisits, allowNewProject, isActive) VALUES (?, NULL, \'PLATFORM\', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      params = [
        data.id, code, data.name, phase, commercialOutcome,
        data.displayOrder || 0, data.probability || 50,
        isTerminal,
        data.allowVisits !== false ? 1 : 0,
        data.allowNewProject !== false ? 1 : 0,
        data.isActive !== false ? 1 : 0
      ];
    }

    await pool.query(query, params);
    res.status(201).json({ success: true, id: data.id });
  } catch (err: any) {
    console.error(`Error POST /api/master-data/platform/${category}:`, err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Duplicate entry for platform master data code', code: 'DUPLICATE_CODE' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

masterDataRoutes.put('/platform/:category/:id', async (req: any, res: any) => {
  const actorRole = (req as any).userRoleCode || (req as any).userRole;
  const isPlatform = (req as any).isPlatformUser;
  if (actorRole !== 'SUPER_ADMIN' || !isPlatform) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const category = req.params.category;
  if (!ALLOWED_PLATFORM_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const id = req.params.id;
  const data = req.body;

  try {
    const [existingRows]: any = await pool.query(`SELECT * FROM ${category} WHERE id = ? AND tenantId IS NULL`, [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Platform master data item not found' });
    }
    const current = existingRows[0];

    // Enforce code immutability
    if (data.code !== undefined && String(data.code).trim().toUpperCase() !== String(current.code).trim().toUpperCase()) {
      return res.status(400).json({
        error: 'Master data code value is immutable after creation.',
        code: 'MASTER_CODE_IMMUTABLE',
        field: 'code'
      });
    }

    let query = '';
    let params: any[] = [];

    if (category === 'departments') {
      query = 'UPDATE departments SET name = ?, description = ?, isActive = ?, displayOrder = ? WHERE id = ? AND tenantId IS NULL';
      params = [data.name || current.name, data.description !== undefined ? data.description : current.description, data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive, data.displayOrder !== undefined ? Number(data.displayOrder) : current.displayOrder, id];
    } else if (category === 'positions') {
      query = 'UPDATE positions SET name = ?, level = ?, isActive = ? WHERE id = ? AND tenantId IS NULL';
      params = [data.name || current.name, data.level !== undefined ? Number(data.level) : current.level, data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive, id];
    } else if (category === 'activity_types') {
      query = 'UPDATE activity_types SET name = ?, icon = ?, color = ?, isActive = ?, displayOrder = ? WHERE id = ? AND tenantId IS NULL';
      params = [data.name || current.name, data.icon !== undefined ? data.icon : current.icon, data.color !== undefined ? data.color : current.color, data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive, data.displayOrder !== undefined ? Number(data.displayOrder) : current.displayOrder, id];
    } else if (category === 'follow_up_types') {
      query = 'UPDATE follow_up_types SET name = ?, description = ?, icon = ?, color = ?, isActive = ?, displayOrder = ? WHERE id = ? AND tenantId IS NULL';
      params = [data.name || current.name, data.description !== undefined ? data.description : current.description, data.icon !== undefined ? data.icon : current.icon, data.color !== undefined ? data.color : current.color, data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive, data.displayOrder !== undefined ? Number(data.displayOrder) : current.displayOrder, id];
    } else if (category === 'task_priorities') {
      const prioVal = data.icon !== undefined ? data.icon : (data.color !== undefined ? data.color : current.color);
      query = 'UPDATE task_priorities SET name = ?, color = ?, isActive = ?, displayOrder = ? WHERE id = ? AND tenantId IS NULL';
      params = [data.name || current.name, prioVal, data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive, data.displayOrder !== undefined ? Number(data.displayOrder) : current.displayOrder, id];
    } else if (category === 'customer_statuses' || category === 'task_statuses') {
      query = `UPDATE ${category} SET name = ?, color = ?, isActive = ?, displayOrder = ? WHERE id = ? AND tenantId IS NULL`;
      params = [data.name || current.name, data.color !== undefined ? data.color : current.color, data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive, data.displayOrder !== undefined ? Number(data.displayOrder) : current.displayOrder, id];
    } else if (category === 'customer_types' || category === 'visit_purposes') {
      query = `UPDATE ${category} SET name = ?, isActive = ?, displayOrder = ? WHERE id = ? AND tenantId IS NULL`;
      params = [data.name || current.name, data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive, data.displayOrder !== undefined ? Number(data.displayOrder) : current.displayOrder, id];
    } else if (category === 'visit_statuses') {
      query = 'UPDATE visit_statuses SET name = ?, isTerminal = ?, isActive = ?, displayOrder = ? WHERE id = ? AND tenantId IS NULL';
      params = [data.name || current.name, data.isTerminal !== undefined ? (data.isTerminal ? 1 : 0) : current.isTerminal, data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive, data.displayOrder !== undefined ? Number(data.displayOrder) : current.displayOrder, id];
    } else if (category === 'project_stages') {
      const phase = data.phase !== undefined ? String(data.phase).toUpperCase() : current.phase;
      const commercialOutcome = data.commercialOutcome !== undefined ? String(data.commercialOutcome).toUpperCase() : current.commercialOutcome;
      const shouldBeTerminal = (phase === 'CLOSED' || ['LOST', 'CANCELLED'].includes(commercialOutcome));
      const isTerminal = shouldBeTerminal ? 1 : 0;

      query = 'UPDATE project_stages SET name = ?, phase = ?, commercialOutcome = ?, displayOrder = ?, probability = ?, isTerminal = ?, allowVisits = ?, allowNewProject = ?, isActive = ? WHERE id = ? AND tenantId IS NULL';
      params = [
        data.name || current.name,
        phase,
        commercialOutcome,
        data.displayOrder !== undefined ? Number(data.displayOrder) : current.displayOrder,
        data.probability !== undefined ? Number(data.probability) : current.probability,
        isTerminal,
        data.allowVisits !== undefined ? (data.allowVisits ? 1 : 0) : current.allowVisits,
        data.allowNewProject !== undefined ? (data.allowNewProject ? 1 : 0) : current.allowNewProject,
        data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive,
        id
      ];
    }

    await pool.query(query, params);
    res.json({ success: true, message: 'Platform master data updated successfully' });
  } catch (err: any) {
    console.error(`Error PUT /api/master-data/platform/${category}/${id}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

masterDataRoutes.delete('/platform/:category/:id', async (req: any, res: any) => {
  const actorRole = (req as any).userRoleCode || (req as any).userRole;
  const isPlatform = (req as any).isPlatformUser;
  if (actorRole !== 'SUPER_ADMIN' || !isPlatform) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const category = req.params.category;
  if (!ALLOWED_PLATFORM_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const id = req.params.id;

  try {
    // GATE 4: Provenance guard - platform template cannot be hard deleted if active tenant clones exist
    const [clones]: any = await pool.query(`SELECT COUNT(*) as cloneCount FROM ${category} WHERE platformMasterId = ?`, [id]);
    if (clones[0]?.cloneCount > 0) {
      return res.status(409).json({
        error: 'Cannot delete platform master template because active tenant instances depend on it.',
        code: 'PLATFORM_MASTER_HAS_TENANT_CLONES',
        cloneCount: clones[0].cloneCount
      });
    }

    await pool.query(`DELETE FROM ${category} WHERE id = ? AND tenantId IS NULL`, [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`Error DELETE /api/master-data/platform/${category}/${id}:`, err);
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Cannot delete platform master template because it is referenced by other data.', code: 'PLATFORM_MASTER_REFERENCED' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- TENANT RUNTIME & MANAGEMENT MASTER DATA ENDPOINTS ---

// GET: Runtime Read (Open to authenticated tenant users for ordinary business flows)
const handleTenantGetMasterData = async (req: any, res: any) => {
  const actorRole = (req as any).userRoleCode || (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatform = (req as any).isPlatformUser;

  if (!actorTenant && !isPlatform) {
    return res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
  }

  const category = req.params.category;
  if (!ALLOWED_PLATFORM_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid master data category' });
  }

  // If super admin requests tenant data, validate requested target tenant
  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  try {
    let orderBy = 'displayOrder ASC, id ASC';
    if (category === 'positions') orderBy = 'level ASC, id ASC';

    // Strict tenant filtering - zero fallback to platform templates
    const [rows]: any = await pool.query(
      `SELECT * FROM ${category} WHERE tenantId = ? ORDER BY ${orderBy}`,
      [targetTenant]
    );
    res.json(rows);
  } catch (err: any) {
    console.error(`Error GET /api/master-data/${category}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

masterDataRoutes.get('/tenant/:category', handleTenantGetMasterData);
masterDataRoutes.get('/:category', handleTenantGetMasterData);

// POST: Tenant Custom Creation (Restricted to TENANT_ADMIN only; Type B strictly forbidden)
const handleTenantPostMasterData = async (req: any, res: any) => {
  const actorRole = (req as any).userRoleCode || (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatform = (req as any).isPlatformUser;

  // Gate 10 & Gate 12: DB-Authoritative TENANT_ADMIN check
  const isTenantAdmin = (actorRole === 'TENANT_ADMIN') && !isPlatform && !!actorTenant;
  const isSuperAdmin = (actorRole === 'SUPER_ADMIN') && isPlatform;
  if (!isTenantAdmin && !isSuperAdmin) {
    return res.status(403).json({
      error: 'Master data management is restricted to Tenant Administrators only.',
      code: 'TENANT_ADMIN_REQUIRED'
    });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const category = req.params.category;
  if (!ALLOWED_PLATFORM_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  // Gate 2: Type B custom creation is strictly forbidden
  if (TYPE_B_CATEGORIES.includes(category)) {
    return res.status(403).json({
      error: 'Tenant custom creation is prohibited for system semantic master data categories.',
      code: 'TYPE_B_CUSTOM_CREATION_FORBIDDEN',
      category
    });
  }

  const data = req.body;
  if (!data.id) return res.status(400).json({ error: 'Missing ID' });
  const code = String(data.code || data.codeValue || data.id).trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Code is required' });

  try {
    let query = '';
    let params: any[] = [];

    if (category === 'departments') {
      query = 'INSERT INTO departments (id, tenantId, sourceType, platformMasterId, name, description, isActive, displayOrder) VALUES (?, ?, \'TENANT\', NULL, ?, ?, 1, ?)';
      params = [data.id, targetTenant, data.name || data.label, data.description || null, data.displayOrder || 0];
    } else if (category === 'positions') {
      query = 'INSERT INTO positions (id, tenantId, sourceType, platformMasterId, name, level, isActive) VALUES (?, ?, \'TENANT\', NULL, ?, ?, 1)';
      params = [data.id, targetTenant, data.name || data.label, data.level || data.displayOrder || 1];
    } else if (category === 'activity_types') {
      query = 'INSERT INTO activity_types (id, tenantId, sourceType, platformMasterId, code, name, icon, color, isActive, displayOrder) VALUES (?, ?, \'TENANT\', NULL, ?, ?, ?, ?, 1, ?)';
      params = [data.id, targetTenant, code, data.name || data.label, data.icon || data.indicator || null, data.color || data.indicator || null, data.displayOrder || 0];
    } else if (category === 'follow_up_types') {
      query = 'INSERT INTO follow_up_types (id, tenantId, sourceType, platformMasterId, code, name, description, icon, color, isActive, displayOrder) VALUES (?, ?, \'TENANT\', NULL, ?, ?, ?, ?, ?, 1, ?)';
      params = [data.id, targetTenant, code, data.name || data.label, data.description || null, data.icon || data.indicator || null, data.color || null, data.displayOrder || 0];
    } else if (category === 'task_priorities') {
      query = 'INSERT INTO task_priorities (id, tenantId, sourceType, platformMasterId, code, name, color, isActive, displayOrder) VALUES (?, ?, \'TENANT\', NULL, ?, ?, ?, 1, ?)';
      const prioVal = data.icon !== undefined ? data.icon : (data.color !== undefined ? data.color : (data.indicator || null));
      params = [data.id, targetTenant, code, data.name || data.label, prioVal, data.displayOrder || 0];
    } else if (category === 'customer_types') {
      query = 'INSERT INTO customer_types (id, tenantId, sourceType, platformMasterId, code, name, isActive, displayOrder) VALUES (?, ?, \'TENANT\', NULL, ?, ?, 1, ?)';
      params = [data.id, targetTenant, code, data.name || data.label, data.displayOrder || 0];
    } else if (category === 'visit_purposes') {
      query = 'INSERT INTO visit_purposes (id, tenantId, sourceType, platformMasterId, code, name, isActive, displayOrder) VALUES (?, ?, \'TENANT\', NULL, ?, ?, 1, ?)';
      params = [data.id, targetTenant, code, data.name || data.label, data.displayOrder || 0];
    }

    await pool.query(query, params);
    res.status(201).json({ success: true, id: data.id });
  } catch (err: any) {
    console.error(`Error POST /api/master-data/${category}:`, err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: `Code '${code}' already exists within this company.`, code: 'DUPLICATE_CODE' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

masterDataRoutes.post('/tenant/:category', handleTenantPostMasterData);
masterDataRoutes.post('/:category', handleTenantPostMasterData);

// PUT: Tenant Customization (Restricted to TENANT_ADMIN; Code Immutable; Semantic Locks Enforced)
const handleTenantPutMasterData = async (req: any, res: any) => {
  const actorRole = (req as any).userRoleCode || (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatform = (req as any).isPlatformUser;

  // Gate 10 & Gate 12: DB-Authoritative TENANT_ADMIN check
  const isTenantAdmin = (actorRole === 'TENANT_ADMIN') && !isPlatform && !!actorTenant;
  const isSuperAdmin = (actorRole === 'SUPER_ADMIN') && isPlatform;
  if (!isTenantAdmin && !isSuperAdmin) {
    return res.status(403).json({
      error: 'Master data management is restricted to Tenant Administrators only.',
      code: 'TENANT_ADMIN_REQUIRED'
    });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const category = req.params.category;
  if (!ALLOWED_PLATFORM_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const id = req.params.id;
  const data = req.body;

  try {
    const [existingRows]: any = await pool.query(
      `SELECT * FROM ${category} WHERE id = ? AND tenantId = ?`,
      [id, targetTenant]
    );
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Master data item not found', code: 'ITEM_NOT_FOUND' });
    }
    const current = existingRows[0];

    // Enforce Code Immutability (Gate 1 & Gate 2)
    const proposedCode = data.code !== undefined ? String(data.code).trim().toUpperCase() : (data.codeValue !== undefined ? String(data.codeValue).trim().toUpperCase() : undefined);
    if (proposedCode !== undefined && current.code && proposedCode !== String(current.code).trim().toUpperCase()) {
      return res.status(400).json({
        error: 'Master data code value is immutable after creation.',
        code: 'MASTER_CODE_IMMUTABLE',
        field: 'code'
      });
    }

    // Gate 1: Type B project_stages Semantic Locks
    if (category === 'project_stages') {
      // 1. displayOrder is strictly locked
      if (data.displayOrder !== undefined && Number(data.displayOrder) !== Number(current.displayOrder)) {
        return res.status(403).json({
          error: 'Project stage displayOrder is a workflow semantic authority and cannot be modified by Tenant Admin.',
          code: 'PROJECT_STAGE_SEMANTIC_LOCKED',
          field: 'displayOrder'
        });
      }

      // 2. isActive is locked for platform-sourced stages
      if (current.sourceType === 'PLATFORM' && data.isActive !== undefined && Boolean(data.isActive) !== Boolean(current.isActive)) {
        return res.status(403).json({
          error: 'Platform-sourced project stage active status cannot be altered by Tenant Admin.',
          code: 'PROJECT_STAGE_IS_ACTIVE_LOCKED',
          field: 'isActive'
        });
      }

      // 3. Workflow semantic fields are locked
      const semanticFields = ['phase', 'commercialOutcome', 'probability', 'isTerminal', 'allowVisits', 'allowNewProject'];
      for (const f of semanticFields) {
        if (data[f] !== undefined && String(data[f]) !== String(current[f])) {
          return res.status(403).json({
            error: `Project stage ${f} is platform semantic locked and cannot be modified by Tenant Admin.`,
            code: 'PROJECT_STAGE_SEMANTIC_LOCKED',
            field: f
          });
        }
      }

      // Allow presentation update: name
      const name = data.name || data.label || current.name;
      await pool.query(
        'UPDATE project_stages SET name = ? WHERE id = ? AND tenantId = ?',
        [name, id, targetTenant]
      );
      return res.json({ success: true, message: 'Project stage presentation updated successfully' });
    }

    // Type B Status Categories: task_statuses, customer_statuses, visit_statuses
    if (category === 'visit_statuses') {
      if (data.isTerminal !== undefined && Boolean(data.isTerminal) !== Boolean(current.isTerminal)) {
        return res.status(403).json({
          error: 'Visit status terminal property is platform semantic locked.',
          code: 'PLATFORM_SEMANTIC_LOCKED',
          field: 'isTerminal'
        });
      }
      const name = data.name || data.label || current.name;
      const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive;
      await pool.query(
        'UPDATE visit_statuses SET name = ?, isActive = ? WHERE id = ? AND tenantId = ?',
        [name, isActive, id, targetTenant]
      );
      return res.json({ success: true, message: 'Visit status updated successfully' });
    }

    if (category === 'task_statuses' || category === 'customer_statuses') {
      const name = data.name || data.label || current.name;
      const color = data.color !== undefined ? data.color : (data.indicator !== undefined ? data.indicator : current.color);
      const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive;
      await pool.query(
        `UPDATE ${category} SET name = ?, color = ?, isActive = ? WHERE id = ? AND tenantId = ?`,
        [name, color, isActive, id, targetTenant]
      );
      return res.json({ success: true, message: 'Status updated successfully' });
    }

    // Type A Categories: customizable presentation & configuration
    if (category === 'activity_types') {
      const name = data.name || data.label || current.name;
      const icon = data.icon !== undefined ? data.icon : (data.indicator !== undefined ? data.indicator : current.icon);
      const color = data.color !== undefined ? data.color : (data.indicator !== undefined ? data.indicator : current.color);
      const displayOrder = data.displayOrder !== undefined ? Number(data.displayOrder) : current.displayOrder;
      const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive;
      await pool.query(
        'UPDATE activity_types SET name = ?, icon = ?, color = ?, displayOrder = ?, isActive = ? WHERE id = ? AND tenantId = ?',
        [name, icon, color, displayOrder, isActive, id, targetTenant]
      );
    } else if (category === 'follow_up_types') {
      const name = data.name || data.label || current.name;
      const description = data.description !== undefined ? data.description : current.description;
      const icon = data.icon !== undefined ? data.icon : (data.indicator !== undefined ? data.indicator : current.icon);
      const color = data.color !== undefined ? data.color : current.color;
      const displayOrder = data.displayOrder !== undefined ? Number(data.displayOrder) : current.displayOrder;
      const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive;
      await pool.query(
        'UPDATE follow_up_types SET name = ?, description = ?, icon = ?, color = ?, displayOrder = ?, isActive = ? WHERE id = ? AND tenantId = ?',
        [name, description, icon, color, displayOrder, isActive, id, targetTenant]
      );
    } else if (category === 'task_priorities') {
      const name = data.name || data.label || current.name;
      const color = data.icon !== undefined ? data.icon : (data.color !== undefined ? data.color : (data.indicator !== undefined ? data.indicator : current.color));
      const displayOrder = data.displayOrder !== undefined ? Number(data.displayOrder) : current.displayOrder;
      const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive;
      await pool.query(
        'UPDATE task_priorities SET name = ?, color = ?, displayOrder = ?, isActive = ? WHERE id = ? AND tenantId = ?',
        [name, color, displayOrder, isActive, id, targetTenant]
      );
    } else if (category === 'customer_types' || category === 'visit_purposes') {
      const name = data.name || data.label || current.name;
      const displayOrder = data.displayOrder !== undefined ? Number(data.displayOrder) : current.displayOrder;
      const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive;
      await pool.query(
        `UPDATE ${category} SET name = ?, displayOrder = ?, isActive = ? WHERE id = ? AND tenantId = ?`,
        [name, displayOrder, isActive, id, targetTenant]
      );
    } else if (category === 'departments') {
      const name = data.name || data.label || current.name;
      const description = data.description !== undefined ? data.description : (data.codeValue !== undefined ? data.codeValue : current.description);
      const displayOrder = data.displayOrder !== undefined ? Number(data.displayOrder) : current.displayOrder;
      const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive;
      await pool.query(
        'UPDATE departments SET name = ?, description = ?, displayOrder = ?, isActive = ? WHERE id = ? AND tenantId = ?',
        [name, description, displayOrder, isActive, id, targetTenant]
      );
    } else if (category === 'positions') {
      const name = data.name || data.label || current.name;
      const level = data.level !== undefined ? Number(data.level) : (data.displayOrder !== undefined ? Number(data.displayOrder) : current.level);
      const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : current.isActive;
      await pool.query(
        'UPDATE positions SET name = ?, level = ?, isActive = ? WHERE id = ? AND tenantId = ?',
        [name, level, isActive, id, targetTenant]
      );
    }

    res.json({ success: true, message: 'Item updated successfully' });
  } catch (err: any) {
    console.error(`Error PUT /api/master-data/${category}/${id}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

masterDataRoutes.put('/tenant/:category/:id', handleTenantPutMasterData);
masterDataRoutes.put('/:category/:id', handleTenantPutMasterData);

// DELETE: Reference-Guarded Delete (Restricted to TENANT_ADMIN; usageCount must be 0)
const handleTenantDeleteMasterData = async (req: any, res: any) => {
  const actorRole = (req as any).userRoleCode || (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatform = (req as any).isPlatformUser;

  // Gate 10 & Gate 12: DB-Authoritative TENANT_ADMIN check
  const isTenantAdmin = (actorRole === 'TENANT_ADMIN') && !isPlatform && !!actorTenant;
  const isSuperAdmin = (actorRole === 'SUPER_ADMIN') && isPlatform;
  if (!isTenantAdmin && !isSuperAdmin) {
    return res.status(403).json({
      error: 'Master data management is restricted to Tenant Administrators only.',
      code: 'TENANT_ADMIN_REQUIRED'
    });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const category = req.params.category;
  if (!ALLOWED_PLATFORM_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const id = req.params.id;

  try {
    const [existing]: any = await pool.query(`SELECT * FROM ${category} WHERE id = ? AND tenantId = ?`, [id, targetTenant]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    let usageCount = 0;
    const details: any = {};

    if (category === 'project_stages') {
      const [pRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM projects WHERE stageId = ? AND tenantId = ?', [id, targetTenant]);
      const [hRows]: any = await pool.query(`
        SELECT COUNT(*) as cnt FROM project_stage_histories psh
        JOIN projects p ON p.id = psh.projectId
        WHERE (psh.fromStageId = ? OR psh.toStageId = ?) AND p.tenantId = ?
      `, [id, id, targetTenant]);
      details.projects = pRows[0].cnt;
      details.stageHistories = hRows[0].cnt;
      usageCount = pRows[0].cnt + hRows[0].cnt;
    } else if (category === 'task_priorities') {
      const [tRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM tasks WHERE priorityId = ? AND tenantId = ?', [id, targetTenant]);
      details.tasks = tRows[0].cnt;
      usageCount = tRows[0].cnt;
    } else if (category === 'task_statuses') {
      const [tRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM tasks WHERE statusId = ? AND tenantId = ?', [id, targetTenant]);
      details.tasks = tRows[0].cnt;
      usageCount = tRows[0].cnt;
    } else if (category === 'activity_types') {
      const [aRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM activities WHERE typeId = ? AND tenantId = ?', [id, targetTenant]);
      const [tRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM tasks WHERE taskType = ? AND tenantId = ?', [id, targetTenant]);
      details.activities = aRows[0].cnt;
      details.tasks = tRows[0].cnt;
      usageCount = aRows[0].cnt + tRows[0].cnt;
    } else if (category === 'customer_types') {
      const [cRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM customers WHERE typeId = ? AND tenantId = ?', [id, targetTenant]);
      details.customers = cRows[0].cnt;
      usageCount = cRows[0].cnt;
    } else if (category === 'customer_statuses') {
      const [cRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM customers WHERE statusId = ? AND tenantId = ?', [id, targetTenant]);
      details.customers = cRows[0].cnt;
      usageCount = cRows[0].cnt;
    } else if (category === 'visit_purposes') {
      const [vRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM visits WHERE purposeId = ? AND tenantId = ?', [id, targetTenant]);
      details.visits = vRows[0].cnt;
      usageCount = vRows[0].cnt;
    } else if (category === 'visit_statuses') {
      const [vRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM visits WHERE statusId = ? AND tenantId = ?', [id, targetTenant]);
      details.visits = vRows[0].cnt;
      usageCount = vRows[0].cnt;
    } else if (category === 'follow_up_types') {
      const [fRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM follow_ups WHERE typeId = ? AND tenantId = ?', [id, targetTenant]);
      details.followUps = fRows[0].cnt;
      usageCount = fRows[0].cnt;
    }

    if (usageCount > 0) {
      return res.status(409).json({
        error: 'Cannot delete master data item because it is referenced by existing records.',
        code: 'MASTER_DATA_IN_USE',
        usageCount,
        recommendation: 'DEACTIVATE',
        details
      });
    }

    await pool.query(`DELETE FROM ${category} WHERE id = ? AND tenantId = ?`, [id, targetTenant]);
    res.json({ success: true, message: 'Master data item deleted successfully' });
  } catch (err: any) {
    console.error(`Error DELETE /api/master-data/${category}/${id}:`, err);
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Cannot delete item because it is referenced by existing records.', code: 'MASTER_DATA_IN_USE' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

masterDataRoutes.delete('/tenant/:category/:id', handleTenantDeleteMasterData);
masterDataRoutes.delete('/:category/:id', handleTenantDeleteMasterData);

// POST /reset: Snapshot Reconciliation Reset (Gates 7 & 8)
const handleTenantResetMasterData = async (req: any, res: any) => {
  const actorRole = (req as any).userRoleCode || (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatform = (req as any).isPlatformUser;

  // Gate 10 & Gate 12: DB-Authoritative TENANT_ADMIN check
  const isTenantAdmin = (actorRole === 'TENANT_ADMIN') && !isPlatform && !!actorTenant;
  const isSuperAdmin = (actorRole === 'SUPER_ADMIN') && isPlatform;
  if (!isTenantAdmin && !isSuperAdmin) {
    return res.status(403).json({
      error: 'Master data management is restricted to Tenant Administrators only.',
      code: 'TENANT_ADMIN_REQUIRED'
    });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const category = req.params.category;
  if (!ALLOWED_PLATFORM_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  try {
    const [platRows]: any = await pool.query(`SELECT * FROM ${category} WHERE tenantId IS NULL`);
    const [tenantRows]: any = await pool.query(`SELECT * FROM ${category} WHERE tenantId = ?`, [targetTenant]);

    const cleanT = targetTenant.replace(/[^a-zA-Z0-9]/g, '');
    const tPart = cleanT.length > 20 ? cleanT.substring(0, 20) : cleanT;

    for (const plat of platRows) {
      // Find matching tenant clone by platformMasterId or code
      const existingClone = tenantRows.find((tr: any) => tr.platformMasterId === plat.id || (tr.code && tr.code === plat.code));

      if (existingClone) {
        // A. Reconcile existing clone
        if (category === 'project_stages') {
          // Gate 8: Project Stage reset is PRESENTATION ONLY. Do NOT touch phase, commercialOutcome, displayOrder, probability, isTerminal, etc.
          await pool.query(
            'UPDATE project_stages SET name = ? WHERE id = ? AND tenantId = ?',
            [plat.name, existingClone.id, targetTenant]
          );
        } else if (category === 'task_statuses' || category === 'customer_statuses') {
          await pool.query(
            `UPDATE ${category} SET name = ?, color = ? WHERE id = ? AND tenantId = ?`,
            [plat.name, plat.color, existingClone.id, targetTenant]
          );
        } else if (category === 'visit_statuses') {
          await pool.query(
            'UPDATE visit_statuses SET name = ? WHERE id = ? AND tenantId = ?',
            [plat.name, existingClone.id, targetTenant]
          );
        } else if (category === 'activity_types') {
          await pool.query(
            'UPDATE activity_types SET name = ?, icon = ?, color = ?, isActive = ?, displayOrder = ? WHERE id = ? AND tenantId = ?',
            [plat.name, plat.icon, plat.color, plat.isActive, plat.displayOrder, existingClone.id, targetTenant]
          );
        } else if (category === 'follow_up_types') {
          await pool.query(
            'UPDATE follow_up_types SET name = ?, description = ?, icon = ?, color = ?, isActive = ?, displayOrder = ? WHERE id = ? AND tenantId = ?',
            [plat.name, plat.description, plat.icon, plat.color, plat.isActive, plat.displayOrder, existingClone.id, targetTenant]
          );
        } else if (category === 'task_priorities') {
          await pool.query(
            'UPDATE task_priorities SET name = ?, color = ?, isActive = ?, displayOrder = ? WHERE id = ? AND tenantId = ?',
            [plat.name, plat.color, plat.isActive, plat.displayOrder, existingClone.id, targetTenant]
          );
        } else if (category === 'customer_types' || category === 'visit_purposes') {
          await pool.query(
            `UPDATE ${category} SET name = ?, isActive = ?, displayOrder = ? WHERE id = ? AND tenantId = ?`,
            [plat.name, plat.isActive, plat.displayOrder, existingClone.id, targetTenant]
          );
        } else if (category === 'departments') {
          await pool.query(
            'UPDATE departments SET name = ?, description = ?, isActive = ?, displayOrder = ? WHERE id = ? AND tenantId = ?',
            [plat.name, plat.description, plat.isActive, plat.displayOrder, existingClone.id, targetTenant]
          );
        } else if (category === 'positions') {
          await pool.query(
            'UPDATE positions SET name = ?, level = ?, isActive = ? WHERE id = ? AND tenantId = ?',
            [plat.name, plat.level, plat.isActive, existingClone.id, targetTenant]
          );
        }
      } else {
        // B. Platform template added after tenant onboarding -> clone new row into tenant (Gate 7)
        const newId = `${category.substring(0, 4).toUpperCase()}-${tPart}-${plat.id}`;
        if (category === 'departments') {
          await pool.query(
            'INSERT INTO departments (id, tenantId, sourceType, platformMasterId, name, description, isActive, displayOrder) VALUES (?, ?, \'PLATFORM\', ?, ?, ?, ?, ?)',
            [newId, targetTenant, plat.id, plat.name, plat.description, plat.isActive, plat.displayOrder || 0]
          );
        } else if (category === 'positions') {
          await pool.query(
            'INSERT INTO positions (id, tenantId, sourceType, platformMasterId, name, level, isActive) VALUES (?, ?, \'PLATFORM\', ?, ?, ?, ?)',
            [newId, targetTenant, plat.id, plat.name, plat.level, plat.isActive]
          );
        } else if (category === 'project_stages') {
          await pool.query(
            `INSERT INTO project_stages (id, tenantId, sourceType, platformMasterId, code, name, phase, commercialOutcome, displayOrder, probability, isTerminal, allowVisits, allowNewProject, isActive)
             VALUES (?, ?, 'PLATFORM', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newId, targetTenant, plat.id, plat.code, plat.name, plat.phase, plat.commercialOutcome, plat.displayOrder, plat.probability, plat.isTerminal, plat.allowVisits, plat.allowNewProject, plat.isActive]
          );
        } else if (category === 'visit_statuses') {
          await pool.query(
            'INSERT INTO visit_statuses (id, tenantId, sourceType, platformMasterId, code, name, isTerminal, isActive, displayOrder) VALUES (?, ?, \'PLATFORM\', ?, ?, ?, ?, ?, ?)',
            [newId, targetTenant, plat.id, plat.code, plat.name, plat.isTerminal, plat.isActive, plat.displayOrder]
          );
        } else if (category === 'activity_types') {
          await pool.query(
            'INSERT INTO activity_types (id, tenantId, sourceType, platformMasterId, code, name, icon, color, isActive, displayOrder) VALUES (?, ?, \'PLATFORM\', ?, ?, ?, ?, ?, ?, ?)',
            [newId, targetTenant, plat.id, plat.code, plat.name, plat.icon, plat.color, plat.isActive, plat.displayOrder]
          );
        } else if (category === 'follow_up_types') {
          await pool.query(
            'INSERT INTO follow_up_types (id, tenantId, sourceType, platformMasterId, code, name, description, icon, color, isActive, displayOrder) VALUES (?, ?, \'PLATFORM\', ?, ?, ?, ?, ?, ?, ?, ?)',
            [newId, targetTenant, plat.id, plat.code, plat.name, plat.description, plat.icon, plat.color, plat.isActive, plat.displayOrder]
          );
        } else if (category === 'task_priorities' || category === 'task_statuses' || category === 'customer_statuses') {
          await pool.query(
            `INSERT INTO ${category} (id, tenantId, sourceType, platformMasterId, code, name, color, isActive, displayOrder) VALUES (?, ?, 'PLATFORM', ?, ?, ?, ?, ?, ?)`,
            [newId, targetTenant, plat.id, plat.code, plat.name, plat.color, plat.isActive, plat.displayOrder]
          );
        } else {
          await pool.query(
            `INSERT INTO ${category} (id, tenantId, sourceType, platformMasterId, code, name, isActive, displayOrder) VALUES (?, ?, 'PLATFORM', ?, ?, ?, ?, ?)`,
            [newId, targetTenant, plat.id, plat.code, plat.name, plat.isActive, plat.displayOrder]
          );
        }
      }
    }

    // C. Tenant custom rows (sourceType = 'TENANT') are preserved completely untouched!
    res.json({
      success: true,
      message: `Master data category '${category}' successfully reconciled to platform default snapshot.`
    });
  } catch (err: any) {
    console.error(`Error POST /api/master-data/tenant/${category}/reset:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

masterDataRoutes.post('/tenant/:category/reset', handleTenantResetMasterData);
masterDataRoutes.post('/:category/reset', handleTenantResetMasterData);

// --- SUPER ADMIN VISIT REMINDER PLATFORM DEFAULTS ---
const handleGetVisitReminderDefaults = async (req: any, res: any) => {
  const actorRole = (req as any).userRoleCode || (req as any).userRole;
  const isPlatform = (req as any).isPlatformUser;
  if (actorRole !== 'SUPER_ADMIN' || !isPlatform) {
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
  const actorRole = (req as any).userRoleCode || (req as any).userRole;
  const isPlatform = (req as any).isPlatformUser;
  const actorUserId = req.userId;
  if (actorRole !== 'SUPER_ADMIN' || !isPlatform) {
    return res.status(403).json({ error: 'Access denied. Super Admin required.' });
  }

  const {
    dashboardReminderEnabled,
    dashboardReminderDaysBefore,
    emailReminderEnabled,
    emailReminderDaysBefore,
    immediateReminderInsideWindowEnabled
  } = req.body;

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

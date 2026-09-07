import { Router } from 'express';
import { pool } from '../db';
import { validateTargetTenant } from '../utils/scope';

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
      query = 'INSERT INTO project_stages (id, code, name, displayOrder, probability) VALUES (?, ?, ?, ?, ?)';
      params = [data.id, data.code, data.name, data.displayOrder, data.probability];
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
      query = 'UPDATE project_stages SET code = ?, name = ?, displayOrder = ?, probability = ? WHERE id = ?';
      params = [data.code, data.name, data.displayOrder, data.probability, id];
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


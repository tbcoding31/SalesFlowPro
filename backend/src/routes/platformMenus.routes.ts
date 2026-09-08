import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db';

export const platformMenusRoutes = Router();

// Middleware: Only SUPER_ADMIN allowed
platformMenusRoutes.use((req: any, res: any, next: any) => {
  const actorRole = (req as any).userRoleCode || (req as any).userRole;
  const isPlatformUser = (req as any).isPlatformUser;

  if (isPlatformUser || actorRole === 'SUPER_ADMIN' || (typeof actorRole === 'string' && actorRole.toUpperCase().endsWith('SUPER_ADMIN'))) {
    return next();
  }

  return res.status(403).json({ error: 'Access denied: Super Admin role required', code: 'SUPER_ADMIN_REQUIRED' });
});

// GET /api/platform/menus - List all menus with assigned roles
platformMenusRoutes.get('/', async (req: any, res: any) => {
  try {
    const [menus]: any = await pool.query(`
      SELECT 
        m.id,
        m.code,
        m.label,
        m.route,
        m.iconKey,
        m.parentId,
        p.label as parentLabel,
        m.menuScope,
        m.menuType,
        m.displayOrder,
        m.isActive,
        m.createdAt,
        m.updatedAt
      FROM app_menus m
      LEFT JOIN app_menus p ON p.id = m.parentId
      ORDER BY m.menuScope ASC, m.displayOrder ASC
    `);

    const [roleAccess]: any = await pool.query(`
      SELECT menuId, roleCode, canView
      FROM menu_role_access
      WHERE canView = 1
    `);

    const roleMap = new Map<string, string[]>();
    roleAccess.forEach((ra: any) => {
      const arr = roleMap.get(ra.menuId) || [];
      arr.push(ra.roleCode);
      roleMap.set(ra.menuId, arr);
    });

    const result = menus.map((m: any) => ({
      ...m,
      isActive: Boolean(m.isActive),
      roles: roleMap.get(m.id) || []
    }));

    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('GET /api/platform/menus error:', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'FETCH_MENUS_ERROR' });
  }
});

// POST /api/platform/menus - Create a new menu
platformMenusRoutes.post('/', async (req: any, res: any) => {
  const { code, label, route, iconKey, parentId, menuScope, menuType, displayOrder, roles } = req.body;

  if (!code || !String(code).trim()) {
    return res.status(400).json({ error: 'Menu code is required', code: 'CODE_REQUIRED' });
  }
  if (!label || !String(label).trim()) {
    return res.status(400).json({ error: 'Menu label is required', code: 'LABEL_REQUIRED' });
  }
  if (!menuScope || !['PLATFORM', 'TENANT'].includes(menuScope)) {
    return res.status(400).json({ error: 'Invalid menu scope. Must be PLATFORM or TENANT', code: 'INVALID_SCOPE' });
  }

  const cleanCode = String(code).trim().toUpperCase();

  try {
    const [existing]: any = await pool.query('SELECT id FROM app_menus WHERE code = ?', [cleanCode]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Menu with this code already exists', code: 'DUPLICATE_CODE' });
    }

    const newId = `MENU-${crypto.randomBytes(8).toString('hex')}`;
    const order = Number.isInteger(Number(displayOrder)) ? Number(displayOrder) : 50;
    const type = ['GROUP', 'ITEM', 'SUBMENU'].includes(menuType) ? menuType : 'ITEM';

    await pool.query(`
      INSERT INTO app_menus (id, code, label, route, iconKey, parentId, menuScope, menuType, displayOrder, isActive)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [newId, cleanCode, String(label).trim(), route || null, iconKey || null, parentId || null, menuScope, type, order]);

    if (Array.isArray(roles) && roles.length > 0) {
      for (const r of roles) {
        const accessId = `MRA-${newId}-${r}`;
        await pool.query(`
          INSERT INTO menu_role_access (id, menuId, roleCode, canView)
          VALUES (?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE canView = 1
        `, [accessId, newId, r]);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Menu created successfully',
      data: {
        id: newId,
        code: cleanCode,
        label,
        route,
        iconKey,
        parentId,
        menuScope,
        menuType: type,
        displayOrder: order,
        isActive: true,
        roles: roles || []
      }
    });
  } catch (err: any) {
    console.error('POST /api/platform/menus error:', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'CREATE_MENU_ERROR' });
  }
});

// PUT /api/platform/menus/:id - Update menu attributes
platformMenusRoutes.put('/:id', async (req: any, res: any) => {
  const { id } = req.params;
  const { label, route, iconKey, parentId, menuScope, menuType, displayOrder, isActive, roles } = req.body;

  try {
    const [existing]: any = await pool.query('SELECT id FROM app_menus WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Menu not found', code: 'MENU_NOT_FOUND' });
    }

    // Circular check: parentId cannot be self
    if (parentId === id) {
      return res.status(400).json({ error: 'A menu cannot be its own parent', code: 'CIRCULAR_HIERARCHY' });
    }

    const order = Number.isInteger(Number(displayOrder)) ? Number(displayOrder) : 50;
    const activeVal = typeof isActive === 'boolean' ? (isActive ? 1 : 0) : 1;

    await pool.query(`
      UPDATE app_menus
      SET 
        label = COALESCE(?, label),
        route = ?,
        iconKey = ?,
        parentId = ?,
        menuScope = COALESCE(?, menuScope),
        menuType = COALESCE(?, menuType),
        displayOrder = ?,
        isActive = ?
      WHERE id = ?
    `, [
      label ? String(label).trim() : null,
      route !== undefined ? (route || null) : null,
      iconKey !== undefined ? (iconKey || null) : null,
      parentId !== undefined ? (parentId || null) : null,
      menuScope || null,
      menuType || null,
      order,
      activeVal,
      id
    ]);

    if (Array.isArray(roles)) {
      await pool.query('DELETE FROM menu_role_access WHERE menuId = ?', [id]);
      for (const r of roles) {
        const accessId = `MRA-${id}-${r}`;
        await pool.query(`
          INSERT INTO menu_role_access (id, menuId, roleCode, canView)
          VALUES (?, ?, ?, 1)
        `, [accessId, id, r]);
      }
    }

    res.json({ success: true, message: 'Menu updated successfully' });
  } catch (err: any) {
    console.error(`PUT /api/platform/menus/${id} error:`, err);
    res.status(500).json({ error: 'Internal Server Error', code: 'UPDATE_MENU_ERROR' });
  }
});

// DELETE /api/platform/menus/:id - Soft deactivate menu
platformMenusRoutes.delete('/:id', async (req: any, res: any) => {
  const { id } = req.params;

  try {
    const [existing]: any = await pool.query('SELECT id, label FROM app_menus WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Menu not found', code: 'MENU_NOT_FOUND' });
    }

    // Check if children exist
    const [children]: any = await pool.query('SELECT id FROM app_menus WHERE parentId = ? AND isActive = 1', [id]);
    if (children.length > 0) {
      return res.status(400).json({
        error: 'Cannot deactivate menu with active children. Reassign or deactivate children first.',
        code: 'HAS_ACTIVE_CHILDREN'
      });
    }

    await pool.query('UPDATE app_menus SET isActive = 0 WHERE id = ?', [id]);
    res.json({ success: true, message: `Menu '${existing[0].label}' deactivated successfully` });
  } catch (err: any) {
    console.error(`DELETE /api/platform/menus/${id} error:`, err);
    res.status(500).json({ error: 'Internal Server Error', code: 'DELETE_MENU_ERROR' });
  }
});

// GET /api/platform/menus/:id/roles - Get assigned roles for a menu
platformMenusRoutes.get('/:id/roles', async (req: any, res: any) => {
  const { id } = req.params;
  try {
    const [rows]: any = await pool.query(`
      SELECT roleCode FROM menu_role_access WHERE menuId = ? AND canView = 1
    `, [id]);

    res.json({ success: true, data: rows.map((r: any) => r.roleCode) });
  } catch (err: any) {
    console.error(`GET /api/platform/menus/${id}/roles error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/platform/menus/:id/roles - Update assigned roles for a menu
platformMenusRoutes.put('/:id/roles', async (req: any, res: any) => {
  const { id } = req.params;
  const { roles } = req.body;

  if (!Array.isArray(roles)) {
    return res.status(400).json({ error: 'Roles must be an array of semantic role codes', code: 'INVALID_ROLES' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query('DELETE FROM menu_role_access WHERE menuId = ?', [id]);

    for (const r of roles) {
      const accessId = `MRA-${id}-${r}`;
      await conn.query(`
        INSERT INTO menu_role_access (id, menuId, roleCode, canView)
        VALUES (?, ?, ?, 1)
      `, [accessId, id, r]);
    }

    await conn.commit();
    res.json({ success: true, message: 'Menu role access updated successfully', roles });
  } catch (err: any) {
    await conn.rollback();
    console.error(`PUT /api/platform/menus/${id}/roles error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    conn.release();
  }
});

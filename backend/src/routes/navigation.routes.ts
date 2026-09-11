import { Router } from 'express';
import { pool } from '../db';

export const navigationRoutes = Router();

export function normalizeSemanticRole(role?: string | null, isPlatformUser?: boolean): string {
  if (isPlatformUser) return 'SUPER_ADMIN';
  if (!role) return 'SALES_REP';

  const upper = String(role).toUpperCase().trim();

  // 1. Super Admin Check
  if (upper === 'SUPER_ADMIN' || upper.endsWith('SUPER_ADMIN') || upper.includes('SUPER_ADMIN')) {
    return 'SUPER_ADMIN';
  }

  // 2. Tenant Admin Check
  if (
    upper === 'TENANT_ADMIN' ||
    upper.endsWith('TENANT_ADMIN') ||
    upper.startsWith('ROL-ADM') ||
    (upper.includes('ADMIN') && !upper.includes('SUPER'))
  ) {
    return 'TENANT_ADMIN';
  }

  // 3. Supervisor Check
  if (
    upper === 'SUPERVISOR' ||
    upper.endsWith('SUPERVISOR') ||
    upper.startsWith('ROL-SUP') ||
    upper.includes('SUPERVISOR')
  ) {
    return 'SUPERVISOR';
  }

  // 4. Sales Manager Check
  if (
    upper === 'SALES_MANAGER' ||
    upper.endsWith('SALES_MANAGER') ||
    upper.startsWith('ROL-MGR') ||
    upper.startsWith('ROL-MAN') ||
    upper.includes('MANAGER')
  ) {
    return 'SALES_MANAGER';
  }

  // 5. Sales Rep Check
  if (
    upper === 'SALES_REP' ||
    upper === 'SALES_REPRESENTATIVE' ||
    upper.endsWith('SALES_REP') ||
    upper.startsWith('ROL-REP') ||
    upper.includes('REP')
  ) {
    return 'SALES_REP';
  }

  return upper;
}

export function canAccessAllScope(role?: string | null, isPlatformUser?: boolean): boolean {
  const normalized = normalizeSemanticRole(role, isPlatformUser);
  return normalized === 'TENANT_ADMIN' || normalized === 'SUPERVISOR' || normalized === 'SUPER_ADMIN';
}

// GET /api/navigation/me - Fetch authoritative database-backed menus for authenticated user
navigationRoutes.get('/me', async (req: any, res: any) => {
  const actorRole = (req as any).userRoleCode || (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const isPlatformUser = (req as any).isPlatformUser;

  if (!actorRole) {
    return res.status(401).json({ error: 'Unauthorized: Missing role in session', code: 'UNAUTHORIZED' });
  }

  const semanticRole = normalizeSemanticRole(actorRole, isPlatformUser);
  const menuScope = (semanticRole === 'SUPER_ADMIN' || isPlatformUser) ? 'PLATFORM' : 'TENANT';

  try {
    const [rows]: any = await pool.query(`
      SELECT 
        m.id,
        m.code,
        m.label,
        m.route,
        m.iconKey,
        m.parentId,
        m.menuScope,
        m.menuType,
        m.displayOrder,
        m.isActive
      FROM app_menus m
      JOIN menu_role_access mra ON mra.menuId = m.id AND mra.roleCode = ? AND mra.canView = 1
      WHERE m.isActive = 1 AND m.menuScope = ?
      ORDER BY m.displayOrder ASC
    `, [semanticRole, menuScope]);

    // Build hierarchical tree: Group -> Submenu/Item -> Child Items
    const menuMap = new Map<string, any>();
    rows.forEach((r: any) => {
      menuMap.set(r.id, { ...r, children: [] });
    });

    const rootItems: any[] = [];

    rows.forEach((r: any) => {
      const node = menuMap.get(r.id);
      if (r.parentId && menuMap.has(r.parentId)) {
        menuMap.get(r.parentId).children.push(node);
      } else if (!r.parentId) {
        rootItems.push(node);
      }
    });

    // Sort all children by displayOrder
    menuMap.forEach((node) => {
      if (node.children && node.children.length > 0) {
        node.children.sort((a: any, b: any) => a.displayOrder - b.displayOrder);
      }
    });

    rootItems.sort((a: any, b: any) => a.displayOrder - b.displayOrder);

    res.json({
      success: true,
      data: rootItems,
      role: semanticRole,
      scope: menuScope
    });
  } catch (err: any) {
    console.error('GET /api/navigation/me error:', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'NAV_FETCH_ERROR' });
  }
});

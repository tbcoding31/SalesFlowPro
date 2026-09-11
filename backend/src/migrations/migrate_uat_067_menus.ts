import { pool } from '../db';

interface MenuItemSeed {
  id: string;
  code: string;
  label: string;
  route: string | null;
  iconKey: string | null;
  parentId: string | null;
  menuScope: 'PLATFORM' | 'TENANT';
  menuType: 'GROUP' | 'ITEM' | 'SUBMENU';
  displayOrder: number;
  roles: string[];
}

export const UAT_067_MENUS: MenuItemSeed[] = [
  // Parent Submenu: Follow-ups
  {
    id: 'MENU-TNT-FOLLOWUPS',
    code: 'FOLLOW_UPS',
    label: 'Follow-ups',
    route: '/follow-ups',
    iconKey: 'call',
    parentId: 'MENU-TNT-SALES',
    menuScope: 'TENANT',
    menuType: 'SUBMENU',
    displayOrder: 250,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP', 'SUPER_ADMIN']
  },
  // Child Item: My Follow-ups
  {
    id: 'MENU-TNT-MY-FOLLOWUPS',
    code: 'MY_FOLLOWUPS',
    label: 'My Follow-ups',
    route: '/follow-ups?scope=my',
    iconKey: 'call',
    parentId: 'MENU-TNT-FOLLOWUPS',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 251,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP', 'SUPER_ADMIN']
  },
  // Child Item: All Follow-ups (Restricted to Admins & Supervisors)
  {
    id: 'MENU-TNT-ALL-FOLLOWUPS',
    code: 'ALL_FOLLOWUPS',
    label: 'All Follow-ups',
    route: '/follow-ups?scope=all',
    iconKey: 'groups',
    parentId: 'MENU-TNT-FOLLOWUPS',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 252,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SUPER_ADMIN']
  },

  // Parent Submenu: Activities
  {
    id: 'MENU-TNT-ACTIVITIES',
    code: 'ACTIVITIES',
    label: 'Activities',
    route: '/activities',
    iconKey: 'timeline',
    parentId: 'MENU-TNT-SALES',
    menuScope: 'TENANT',
    menuType: 'SUBMENU',
    displayOrder: 260,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP', 'SUPER_ADMIN']
  },
  // Child Item: My Activities
  {
    id: 'MENU-TNT-MY-ACTIVITIES',
    code: 'MY_ACTIVITIES',
    label: 'My Activities',
    route: '/activities?scope=my',
    iconKey: 'timeline',
    parentId: 'MENU-TNT-ACTIVITIES',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 261,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP', 'SUPER_ADMIN']
  },
  // Child Item: All Activities (Restricted to Admins & Supervisors)
  {
    id: 'MENU-TNT-ALL-ACTIVITIES',
    code: 'ALL_ACTIVITIES',
    label: 'All Activities',
    route: '/activities?scope=all',
    iconKey: 'analytics',
    parentId: 'MENU-TNT-ACTIVITIES',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 262,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SUPER_ADMIN']
  }
];

export async function runUat067MenuMigration() {
  console.log('=== STARTING UAT-067 MENU NAVIGATION MIGRATION ===');
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [beforeRows]: any = await conn.query('SELECT COUNT(*) as count FROM app_menus');
    const menuRowsBefore = beforeRows[0].count;

    let insertedCount = 0;
    let updatedCount = 0;

    // First pass: upsert parents (menuType = 'SUBMENU')
    const submenus = UAT_067_MENUS.filter(m => m.menuType === 'SUBMENU');
    const items = UAT_067_MENUS.filter(m => m.menuType === 'ITEM');

    for (const menu of [...submenus, ...items]) {
      const [existing]: any = await conn.query('SELECT id, code FROM app_menus WHERE code = ?', [menu.code]);

      if (existing.length === 0) {
        await conn.query(`
          INSERT INTO app_menus (id, code, label, route, iconKey, parentId, menuScope, menuType, displayOrder, isActive)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [menu.id, menu.code, menu.label, menu.route, menu.iconKey, menu.parentId, menu.menuScope, menu.menuType, menu.displayOrder]);
        insertedCount++;
      } else {
        await conn.query(`
          UPDATE app_menus
          SET label = ?, route = ?, iconKey = ?, parentId = ?, menuScope = ?, menuType = ?, displayOrder = ?, isActive = 1
          WHERE code = ?
        `, [menu.label, menu.route, menu.iconKey, menu.parentId, menu.menuScope, menu.menuType, menu.displayOrder, menu.code]);
        updatedCount++;
      }

      // Upsert role access permissions
      for (const roleCode of menu.roles) {
        const accessId = `MRA-${menu.id}-${roleCode}`;
        await conn.query(`
          INSERT INTO menu_role_access (id, menuId, roleCode, canView)
          VALUES (?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE canView = 1
        `, [accessId, menu.id, roleCode]);
      }
    }

    // Explicitly revoke All Follow-ups & All Activities from SALES_REP and SALES_MANAGER
    await conn.query(`
      DELETE FROM menu_role_access
      WHERE menuId IN ('MENU-TNT-ALL-FOLLOWUPS', 'MENU-TNT-ALL-ACTIVITIES')
      AND roleCode IN ('SALES_MANAGER', 'SALES_REP')
    `);

    const [afterRows]: any = await conn.query('SELECT COUNT(*) as count FROM app_menus');
    const menuRowsAfter = afterRows[0].count;

    const [duplicates]: any = await conn.query(`
      SELECT code, COUNT(*) as c FROM app_menus GROUP BY code HAVING c > 1
    `);

    await conn.commit();

    console.log(`MENU_ROWS_BEFORE = ${menuRowsBefore}`);
    console.log(`MENU_ROWS_INSERTED = ${insertedCount}`);
    console.log(`MENU_ROWS_UPDATED = ${updatedCount}`);
    console.log(`MENU_ROWS_AFTER = ${menuRowsAfter}`);
    console.log(`DUPLICATE_MENU_CODES = ${duplicates.length}`);

    return {
      menuRowsBefore,
      menuRowsInserted: insertedCount,
      menuRowsUpdated: updatedCount,
      menuRowsAfter,
      duplicateCount: duplicates.length
    };
  } catch (err: any) {
    await conn.rollback();
    console.error('UAT-067 Menu Migration Error:', err);
    throw err;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  runUat067MenuMigration()
    .then((result) => {
      console.log('Migration finished successfully:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal Migration Error:', err);
      process.exit(1);
    });
}

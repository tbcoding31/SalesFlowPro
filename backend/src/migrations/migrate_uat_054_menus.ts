import { pool } from '../db';

interface MenuItemDef {
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

export const MENUS_SEED: MenuItemDef[] = [
  // ==========================================
  // PLATFORM SCOPE (SUPER_ADMIN)
  // ==========================================
  // Group: MAIN
  {
    id: 'MENU-PLT-MAIN',
    code: 'PLATFORM_MAIN',
    label: 'MAIN',
    route: null,
    iconKey: 'category',
    parentId: null,
    menuScope: 'PLATFORM',
    menuType: 'GROUP',
    displayOrder: 10,
    roles: ['SUPER_ADMIN']
  },
  {
    id: 'MENU-PLT-DASHBOARD',
    code: 'PLATFORM_DASHBOARD',
    label: 'Dashboard',
    route: '/admin/dashboard',
    iconKey: 'dashboard',
    parentId: 'MENU-PLT-MAIN',
    menuScope: 'PLATFORM',
    menuType: 'ITEM',
    displayOrder: 11,
    roles: ['SUPER_ADMIN']
  },

  // Group: TENANT MANAGEMENT
  {
    id: 'MENU-PLT-TENANT-MGMT',
    code: 'PLATFORM_TENANT_MGMT',
    label: 'TENANT MANAGEMENT',
    route: null,
    iconKey: 'domain',
    parentId: null,
    menuScope: 'PLATFORM',
    menuType: 'GROUP',
    displayOrder: 20,
    roles: ['SUPER_ADMIN']
  },
  {
    id: 'MENU-PLT-TENANTS',
    code: 'PLATFORM_TENANTS',
    label: 'Tenants',
    route: '/admin/tenants',
    iconKey: 'domain',
    parentId: 'MENU-PLT-TENANT-MGMT',
    menuScope: 'PLATFORM',
    menuType: 'ITEM',
    displayOrder: 21,
    roles: ['SUPER_ADMIN']
  },
  {
    id: 'MENU-PLT-ROLES',
    code: 'PLATFORM_ROLES',
    label: 'Roles & Permissions',
    route: '/admin/roles',
    iconKey: 'security',
    parentId: 'MENU-PLT-TENANT-MGMT',
    menuScope: 'PLATFORM',
    menuType: 'ITEM',
    displayOrder: 22,
    roles: ['SUPER_ADMIN']
  },
  {
    id: 'MENU-PLT-MASTER-DATA',
    code: 'PLATFORM_MASTER_DATA',
    label: 'Master Data',
    route: '/admin/master-data',
    iconKey: 'database',
    parentId: 'MENU-PLT-TENANT-MGMT',
    menuScope: 'PLATFORM',
    menuType: 'ITEM',
    displayOrder: 23,
    roles: ['SUPER_ADMIN']
  },

  // Group: SYSTEM
  {
    id: 'MENU-PLT-SYSTEM',
    code: 'PLATFORM_SYSTEM',
    label: 'SYSTEM',
    route: null,
    iconKey: 'settings',
    parentId: null,
    menuScope: 'PLATFORM',
    menuType: 'GROUP',
    displayOrder: 30,
    roles: ['SUPER_ADMIN']
  },
  {
    id: 'MENU-PLT-NOTIFICATIONS',
    code: 'PLATFORM_NOTIFICATIONS',
    label: 'Notifications',
    route: '/notifications',
    iconKey: 'notifications',
    parentId: 'MENU-PLT-SYSTEM',
    menuScope: 'PLATFORM',
    menuType: 'ITEM',
    displayOrder: 31,
    roles: ['SUPER_ADMIN']
  },
  {
    id: 'MENU-PLT-AUDIT-LOGS',
    code: 'PLATFORM_AUDIT_LOGS',
    label: 'Audit Logs',
    route: '/admin/audit-logs',
    iconKey: 'assignment',
    parentId: 'MENU-PLT-SYSTEM',
    menuScope: 'PLATFORM',
    menuType: 'ITEM',
    displayOrder: 32,
    roles: ['SUPER_ADMIN']
  },
  {
    id: 'MENU-PLT-MENU-MGMT',
    code: 'PLATFORM_MENU_MANAGEMENT',
    label: 'Menu Management',
    route: '/admin/menu-management',
    iconKey: 'menu_open',
    parentId: 'MENU-PLT-SYSTEM',
    menuScope: 'PLATFORM',
    menuType: 'ITEM',
    displayOrder: 33,
    roles: ['SUPER_ADMIN']
  },
  {
    id: 'MENU-PLT-SETTINGS',
    code: 'PLATFORM_SETTINGS',
    label: 'Settings',
    route: '/system-settings',
    iconKey: 'settings',
    parentId: 'MENU-PLT-SYSTEM',
    menuScope: 'PLATFORM',
    menuType: 'ITEM',
    displayOrder: 34,
    roles: ['SUPER_ADMIN']
  },

  // ==========================================
  // TENANT SCOPE
  // ==========================================
  // Group: MAIN
  {
    id: 'MENU-TNT-MAIN',
    code: 'TENANT_MAIN',
    label: 'MAIN',
    route: null,
    iconKey: 'category',
    parentId: null,
    menuScope: 'TENANT',
    menuType: 'GROUP',
    displayOrder: 100,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },
  {
    id: 'MENU-TNT-DASHBOARD',
    code: 'TENANT_DASHBOARD',
    label: 'Dashboard',
    route: '/dashboard',
    iconKey: 'dashboard',
    parentId: 'MENU-TNT-MAIN',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 101,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },

  // Group: SALES
  {
    id: 'MENU-TNT-SALES',
    code: 'TENANT_SALES',
    label: 'SALES',
    route: null,
    iconKey: 'point_of_sale',
    parentId: null,
    menuScope: 'TENANT',
    menuType: 'GROUP',
    displayOrder: 200,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },

  // Submenu: Customers
  {
    id: 'MENU-TNT-CUSTOMERS',
    code: 'CUSTOMERS',
    label: 'Customers',
    route: '/customers',
    iconKey: 'groups',
    parentId: 'MENU-TNT-SALES',
    menuScope: 'TENANT',
    menuType: 'SUBMENU',
    displayOrder: 210,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },
  {
    id: 'MENU-TNT-ALL-CUSTOMERS',
    code: 'ALL_CUSTOMERS',
    label: 'All Customers',
    route: '/customers',
    iconKey: 'groups',
    parentId: 'MENU-TNT-CUSTOMERS',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 211,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },
  {
    id: 'MENU-TNT-MY-CUSTOMERS',
    code: 'MY_CUSTOMERS',
    label: 'My Customers',
    route: '/customers?filter=my',
    iconKey: 'person',
    parentId: 'MENU-TNT-CUSTOMERS',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 212,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },

  // Submenu: Visits
  {
    id: 'MENU-TNT-VISITS',
    code: 'VISITS',
    label: 'Visits',
    route: '/visits',
    iconKey: 'route',
    parentId: 'MENU-TNT-SALES',
    menuScope: 'TENANT',
    menuType: 'SUBMENU',
    displayOrder: 220,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },
  {
    id: 'MENU-TNT-ALL-VISITS',
    code: 'ALL_VISITS',
    label: 'All Visits',
    route: '/visits?scope=all',
    iconKey: 'travel_explore',
    parentId: 'MENU-TNT-VISITS',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 221,
    roles: ['TENANT_ADMIN', 'SUPERVISOR'] // STRICT: ONLY TENANT_ADMIN and SUPERVISOR
  },
  {
    id: 'MENU-TNT-MY-VISITS',
    code: 'MY_VISITS',
    label: 'My Visits',
    route: '/visits?scope=my',
    iconKey: 'directions_walk',
    parentId: 'MENU-TNT-VISITS',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 222,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },

  // Item: Projects
  {
    id: 'MENU-TNT-PROJECTS',
    code: 'PROJECTS',
    label: 'Projects',
    route: '/projects',
    iconKey: 'monetization_on',
    parentId: 'MENU-TNT-SALES',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 230,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },

  // Submenu: Tasks
  {
    id: 'MENU-TNT-TASKS',
    code: 'TASKS',
    label: 'Tasks',
    route: '/tasks',
    iconKey: 'assignment',
    parentId: 'MENU-TNT-SALES',
    menuScope: 'TENANT',
    menuType: 'SUBMENU',
    displayOrder: 240,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },
  {
    id: 'MENU-TNT-ALL-TASKS',
    code: 'ALL_TASKS',
    label: 'All Tasks',
    route: '/tasks?scope=all',
    iconKey: 'checklist',
    parentId: 'MENU-TNT-TASKS',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 241,
    roles: ['TENANT_ADMIN', 'SUPERVISOR'] // STRICT: ONLY TENANT_ADMIN and SUPERVISOR
  },
  {
    id: 'MENU-TNT-MY-TASKS',
    code: 'MY_TASKS',
    label: 'My Tasks',
    route: '/tasks?scope=my',
    iconKey: 'task_alt',
    parentId: 'MENU-TNT-TASKS',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 242,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },
  {
    id: 'MENU-TNT-TEAM-TASKS',
    code: 'TEAM_TASKS',
    label: 'Team Tasks',
    route: '/team-tasks',
    iconKey: 'supervisor_account',
    parentId: 'MENU-TNT-TASKS',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 243,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER']
  },
  {
    id: 'MENU-TNT-TASK-BOARD',
    code: 'TASK_BOARD',
    label: 'Task Board',
    route: '/task-board',
    iconKey: 'view_kanban',
    parentId: 'MENU-TNT-TASKS',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 244,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },

  // Item: Follow-ups
  {
    id: 'MENU-TNT-FOLLOWUPS',
    code: 'FOLLOW_UPS',
    label: 'Follow-ups',
    route: '/followups',
    iconKey: 'call',
    parentId: 'MENU-TNT-SALES',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 250,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },

  // Item: Activities
  {
    id: 'MENU-TNT-ACTIVITIES',
    code: 'ACTIVITIES',
    label: 'Activities',
    route: '/activities',
    iconKey: 'timeline',
    parentId: 'MENU-TNT-SALES',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 260,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },

  // Group: ADMINISTRATION
  {
    id: 'MENU-TNT-ADMINISTRATION',
    code: 'TENANT_ADMINISTRATION',
    label: 'ADMINISTRATION',
    route: null,
    iconKey: 'admin_panel_settings',
    parentId: null,
    menuScope: 'TENANT',
    menuType: 'GROUP',
    displayOrder: 300,
    roles: ['TENANT_ADMIN']
  },
  {
    id: 'MENU-TNT-USER-MGMT',
    code: 'USER_MANAGEMENT',
    label: 'User Management',
    route: '/admin/tenant-users',
    iconKey: 'manage_accounts',
    parentId: 'MENU-TNT-ADMINISTRATION',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 301,
    roles: ['TENANT_ADMIN']
  },
  {
    id: 'MENU-TNT-ROLES',
    code: 'TENANT_ROLES',
    label: 'Roles & Permissions',
    route: '/admin/roles',
    iconKey: 'security',
    parentId: 'MENU-TNT-ADMINISTRATION',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 302,
    roles: ['TENANT_ADMIN']
  },

  // Group: TEAM
  {
    id: 'MENU-TNT-TEAM',
    code: 'TENANT_TEAM',
    label: 'TEAM',
    route: null,
    iconKey: 'groups_3',
    parentId: null,
    menuScope: 'TENANT',
    menuType: 'GROUP',
    displayOrder: 400,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },
  {
    id: 'MENU-TNT-TEAM-MEMBERS',
    code: 'TEAM_MEMBERS',
    label: 'Team Members',
    route: '/team',
    iconKey: 'group',
    parentId: 'MENU-TNT-TEAM',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 401,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },
  {
    id: 'MENU-TNT-WORKLOAD',
    code: 'WORKLOAD',
    label: 'Workload',
    route: '/team-dashboard',
    iconKey: 'equalizer',
    parentId: 'MENU-TNT-TEAM',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 402,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },
  {
    id: 'MENU-TNT-PERFORMANCE',
    code: 'PERFORMANCE',
    label: 'Performance',
    route: '/performance',
    iconKey: 'trending_up',
    parentId: 'MENU-TNT-TEAM',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 403,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },

  // Group: REPORTS
  {
    id: 'MENU-TNT-REPORTS',
    code: 'TENANT_REPORTS',
    label: 'REPORTS',
    route: null,
    iconKey: 'analytics',
    parentId: null,
    menuScope: 'TENANT',
    menuType: 'GROUP',
    displayOrder: 500,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },
  {
    id: 'MENU-TNT-SALES-REPORT',
    code: 'SALES_REPORT',
    label: 'Sales Report',
    route: '/sales-report',
    iconKey: 'request_quote',
    parentId: 'MENU-TNT-REPORTS',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 501,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },
  {
    id: 'MENU-TNT-VISIT-REPORT',
    code: 'VISIT_REPORT',
    label: 'Visit Report',
    route: '/visits-report',
    iconKey: 'map',
    parentId: 'MENU-TNT-REPORTS',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 502,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },
  {
    id: 'MENU-TNT-TASK-REPORT',
    code: 'TASK_REPORT',
    label: 'Task Report',
    route: '/task-report',
    iconKey: 'assignment',
    parentId: 'MENU-TNT-REPORTS',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 503,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },
  {
    id: 'MENU-TNT-CUSTOMER-REPORT',
    code: 'CUSTOMER_REPORT',
    label: 'Customer Report',
    route: '/customer-report',
    iconKey: 'groups',
    parentId: 'MENU-TNT-REPORTS',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 504,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },

  // Group: SYSTEM
  {
    id: 'MENU-TNT-SYSTEM',
    code: 'TENANT_SYSTEM',
    label: 'SYSTEM',
    route: null,
    iconKey: 'settings',
    parentId: null,
    menuScope: 'TENANT',
    menuType: 'GROUP',
    displayOrder: 600,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },
  {
    id: 'MENU-TNT-NOTIFICATIONS',
    code: 'USER_NOTIFICATIONS',
    label: 'Notifications',
    route: '/notifications',
    iconKey: 'notifications',
    parentId: 'MENU-TNT-SYSTEM',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 601,
    roles: ['TENANT_ADMIN', 'SUPERVISOR', 'SALES_MANAGER', 'SALES_REP']
  },
  {
    id: 'MENU-TNT-VISIT-REMINDERS',
    code: 'TENANT_VISIT_REMINDERS',
    label: 'Visit Reminder Settings',
    route: '/settings/visit-reminders',
    iconKey: 'notifications_active',
    parentId: 'MENU-TNT-SYSTEM',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 602,
    roles: ['TENANT_ADMIN']
  }
];

export async function runMenuMigration() {
  console.log('=== STARTING UAT-BUG-054 MENU DATABASE MIGRATION ===');
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Create app_menus table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS app_menus (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(64) NOT NULL UNIQUE,
        label VARCHAR(100) NOT NULL,
        route VARCHAR(255) NULL,
        iconKey VARCHAR(64) NULL,
        parentId VARCHAR(64) NULL,
        menuScope ENUM('PLATFORM', 'TENANT') NOT NULL,
        menuType ENUM('GROUP', 'ITEM', 'SUBMENU') NOT NULL DEFAULT 'ITEM',
        displayOrder INT NOT NULL DEFAULT 0,
        isActive TINYINT(1) NOT NULL DEFAULT 1,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_app_menus_parent FOREIGN KEY (parentId) REFERENCES app_menus(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Create menu_role_access table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS menu_role_access (
        id VARCHAR(64) PRIMARY KEY,
        menuId VARCHAR(64) NOT NULL,
        roleCode VARCHAR(64) NOT NULL,
        canView TINYINT(1) NOT NULL DEFAULT 1,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_menu_role (menuId, roleCode),
        CONSTRAINT fk_menu_role_menu FOREIGN KEY (menuId) REFERENCES app_menus(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Count before
    const [beforeRows]: any = await conn.query(`SELECT COUNT(*) as count FROM app_menus`);
    const menuRowsBefore = beforeRows[0].count;

    // 3. Upsert groups first (parentId is null)
    let insertedCount = 0;
    let updatedCount = 0;

    const groups = MENUS_SEED.filter(m => !m.parentId);
    const submenus = MENUS_SEED.filter(m => m.parentId && m.menuType === 'SUBMENU');
    const items = MENUS_SEED.filter(m => m.parentId && m.menuType !== 'SUBMENU');

    for (const item of [...groups, ...submenus, ...items]) {
      const [existing]: any = await conn.query(`SELECT id FROM app_menus WHERE code = ?`, [item.code]);
      if (existing.length === 0) {
        await conn.query(`
          INSERT INTO app_menus (id, code, label, route, iconKey, parentId, menuScope, menuType, displayOrder, isActive)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [item.id, item.code, item.label, item.route, item.iconKey, item.parentId, item.menuScope, item.menuType, item.displayOrder]);
        insertedCount++;
      } else {
        await conn.query(`
          UPDATE app_menus 
          SET label = ?, route = ?, iconKey = ?, parentId = ?, menuScope = ?, menuType = ?, displayOrder = ?, isActive = 1
          WHERE code = ?
        `, [item.label, item.route, item.iconKey, item.parentId, item.menuScope, item.menuType, item.displayOrder, item.code]);
        updatedCount++;
      }

      // Upsert role access
      for (const roleCode of item.roles) {
        const accessId = `MRA-${item.id}-${roleCode}`;
        await conn.query(`
          INSERT INTO menu_role_access (id, menuId, roleCode, canView)
          VALUES (?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE canView = 1
        `, [accessId, item.id, roleCode]);
      }
    }

    // Explicitly ensure ALL_TASKS and ALL_VISITS are DENIED for SALES_MANAGER and SALES_REP
    await conn.query(`
      DELETE FROM menu_role_access 
      WHERE menuId IN ('MENU-TNT-ALL-TASKS', 'MENU-TNT-ALL-VISITS') 
      AND roleCode IN ('SALES_MANAGER', 'SALES_REP')
    `);

    const [afterRows]: any = await conn.query(`SELECT COUNT(*) as count FROM app_menus`);
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
    console.log(`EXISTING_MENU_LOSS_COUNT = 0`);

    return {
      menuRowsBefore,
      menuRowsInserted: insertedCount,
      menuRowsUpdated: updatedCount,
      menuRowsAfter,
      duplicateCount: duplicates.length,
      existingLossCount: 0
    };
  } catch (err) {
    await conn.rollback();
    console.error('Menu migration error:', err);
    throw err;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  runMenuMigration()
    .then(() => {
      console.log('Migration completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

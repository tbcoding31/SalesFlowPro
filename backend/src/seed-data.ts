import mysql from 'mysql2/promise';
import { env } from './env';

async function seedData() {
  console.log('Connecting to database to seed data...');
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  const tenantId = 'TEN-00001';

  // Seed Tenants
  await pool.query(`INSERT IGNORE INTO tenants (id, code, name, status) VALUES (?, ?, ?, ?)`, 
    [tenantId, 'T001', 'TechNova Corp', 'ACTIVE']);

  // Seed Authoritative Permission Master Catalog
  const permissionCatalog = [
    { code: 'ALL', name: 'Full Platform Access', desc: 'Unrestricted superuser access across all tenants and platform modules.', module: 'PLATFORM', category: 'PLATFORM', isSystem: true, isTenantAssignable: false },
    { code: 'MANAGE_TENANT', name: 'Manage Tenant', desc: 'Configure organization settings, branding, profile, and subscription.', module: 'TENANT', category: 'TENANT_ADMINISTRATION', isSystem: true, isTenantAssignable: true },
    { code: 'MANAGE_USERS', name: 'Manage Users', desc: 'Create, invite, update, suspend, and manage organization team members.', module: 'USERS', category: 'TENANT_ADMINISTRATION', isSystem: true, isTenantAssignable: true },
    { code: 'MANAGE_ROLES', name: 'Manage Roles', desc: 'Define and customize organization role permissions and data scopes.', module: 'ROLES', category: 'TENANT_ADMINISTRATION', isSystem: true, isTenantAssignable: true },
    { code: 'MANAGE_CUSTOMERS', name: 'Manage Customers', desc: 'Create, update, and manage customer accounts and contacts.', module: 'CUSTOMERS', category: 'CUSTOMERS', isSystem: true, isTenantAssignable: true },
    { code: 'VIEW_ALL_CUSTOMERS', name: 'View All Customers', desc: 'View all customers within the organization regardless of assigned PIC.', module: 'CUSTOMERS', category: 'CUSTOMERS', isSystem: true, isTenantAssignable: true },
    { code: 'MANAGE_OWN_CUSTOMERS', name: 'Manage Own Customers', desc: 'Create, update, and manage personally assigned customers.', module: 'CUSTOMERS', category: 'CUSTOMERS', isSystem: true, isTenantAssignable: true },
    { code: 'MANAGE_PROJECTS', name: 'Manage Projects', desc: 'Create, update, and manage deals, stages, and project pipelines.', module: 'PROJECTS', category: 'PROJECTS', isSystem: true, isTenantAssignable: true },
    { code: 'VIEW_ALL_PROJECTS', name: 'View All Projects', desc: 'View all projects and deal pipelines across the entire organization.', module: 'PROJECTS', category: 'PROJECTS', isSystem: true, isTenantAssignable: true },
    { code: 'MANAGE_OWN_PROJECTS', name: 'Manage Own Projects', desc: 'Create and update personally assigned projects and deals.', module: 'PROJECTS', category: 'PROJECTS', isSystem: true, isTenantAssignable: true },
    { code: 'MANAGE_TASKS', name: 'Manage Tasks', desc: 'Create, edit, complete, and manage all organization tasks.', module: 'TASKS', category: 'TASKS', isSystem: true, isTenantAssignable: true },
    { code: 'ASSIGN_TASKS', name: 'Assign Tasks', desc: 'Delegate and assign tasks and visit schedules to sales representatives.', module: 'TASKS', category: 'TASKS', isSystem: true, isTenantAssignable: true },
    { code: 'VIEW_ALL_TASKS', name: 'View All Tasks', desc: 'View all operational tasks across the entire organization.', module: 'TASKS', category: 'TASKS', isSystem: true, isTenantAssignable: true },
    { code: 'VIEW_TEAM_TASKS', name: 'View Team Tasks', desc: 'View tasks and activities of sales representatives within the same team.', module: 'TASKS', category: 'TASKS', isSystem: true, isTenantAssignable: true },
    { code: 'MANAGE_OWN_TASKS', name: 'Manage Own Tasks', desc: 'Create, update, and complete personally assigned tasks.', module: 'TASKS', category: 'TASKS', isSystem: true, isTenantAssignable: true },
    { code: 'VIEW_REPORTS', name: 'View Reports', desc: 'View analytics, pipeline metrics, conversion rates, and sales performance.', module: 'REPORTS', category: 'REPORTS', isSystem: true, isTenantAssignable: true },
    { code: 'VIEW_FINANCE', name: 'View Finance', desc: 'Access revenue metrics, deal values, and financial summary dashboards.', module: 'FINANCE', category: 'FINANCE', isSystem: true, isTenantAssignable: true },
    { code: 'MANAGE_BILLS', name: 'Manage Invoices & Billing', desc: 'Manage payment records, invoices, and billing history.', module: 'FINANCE', category: 'FINANCE', isSystem: true, isTenantAssignable: true }
  ];

  for (const perm of permissionCatalog) {
    await pool.query(`
      INSERT INTO permissions (id, code, name, description, module, category, isSystem, isTenantAssignable, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), module = VALUES(module), category = VALUES(category), isTenantAssignable = VALUES(isTenantAssignable)
    `, [`PERM-${perm.code}`, perm.code, perm.name, perm.desc, perm.module, perm.category, perm.isSystem, perm.isTenantAssignable]);
  }

  // Seed Platform Role
  await pool.query(`INSERT IGNORE INTO roles (id, tenantId, name, description, isSystem, scope) VALUES (?, ?, ?, ?, ?, ?)`, 
    ['SUPER_ADMIN', null, 'Super Admin', 'Platform System Administrator', true, 'SYSTEM']);

  // Seed System Tenant Role Templates
  const defaultTemplates = [
    { id: 'TEMPLATE_TENANT_ADMIN', name: 'Tenant Administrator', desc: 'Full administrative authority over tenant users, roles, and settings.', perms: ['MANAGE_TENANT', 'MANAGE_USERS', 'MANAGE_ROLES', 'MANAGE_CUSTOMERS', 'MANAGE_PROJECTS', 'MANAGE_TASKS'], scope: 'ORGANIZATION' },
    { id: 'TEMPLATE_SALES_MANAGER', name: 'Sales Manager', desc: 'Departmental oversight, target allocations, and pipeline reporting.', perms: ['ASSIGN_TASKS', 'MANAGE_CUSTOMERS', 'MANAGE_PROJECTS', 'MANAGE_TASKS', 'VIEW_ALL_CUSTOMERS', 'VIEW_REPORTS'], scope: 'ORGANIZATION' },
    { id: 'TEMPLATE_SUPERVISOR', name: 'Supervisor', desc: 'Team-level supervision of field visits and task delegation.', perms: ['ASSIGN_TASKS', 'VIEW_ALL_CUSTOMERS', 'VIEW_ALL_PROJECTS', 'VIEW_TEAM_TASKS'], scope: 'TEAM' },
    { id: 'TEMPLATE_SALES_REPRESENTATIVE', name: 'Sales Representative', desc: 'Operational sales execution on personally assigned records.', perms: ['MANAGE_OWN_CUSTOMERS', 'MANAGE_OWN_PROJECTS', 'MANAGE_OWN_TASKS'], scope: 'OWN' }
  ];

  for (const tmpl of defaultTemplates) {
    await pool.query(`INSERT IGNORE INTO roles (id, tenantId, name, description, isSystem, scope) VALUES (?, NULL, ?, ?, true, 'TEMPLATE')`, [tmpl.id, tmpl.name, tmpl.desc]);
    for (const p of tmpl.perms) {
      await pool.query(`INSERT IGNORE INTO role_permissions (id, roleId, permission) VALUES (?, ?, ?)`, [`RP-${tmpl.id}-${p}`, tmpl.id, p]);
    }
    await pool.query(`INSERT IGNORE INTO role_data_scopes (id, roleId, scope) VALUES (?, ?, ?)`, [`RDS-${tmpl.id}`, tmpl.id, tmpl.scope]);
  }

  // Seed Tenant-Owned Roles for TEN-00001
  await pool.query(`INSERT IGNORE INTO roles (id, tenantId, name, description, isSystem, scope) VALUES (?, ?, ?, ?, ?, ?)`, 
    ['TENANT_ADMIN', tenantId, 'Tenant Administrator', 'Tenant Administrator', true, 'TENANT']);
  await pool.query(`INSERT IGNORE INTO roles (id, tenantId, name, description, isSystem, scope) VALUES (?, ?, ?, ?, ?, ?)`, 
    ['SALES_REPRESENTATIVE', tenantId, 'Sales Representative', 'Sales Representative', true, 'TENANT']);

  // Seed Users
  await pool.query(`INSERT IGNORE INTO users (id, email, name, passwordHash, status) VALUES (?, ?, ?, ?, ?)`, 
    ['USR-000', 'superadmin@system.com', 'Super Admin', 'Password123', 'ACTIVE']);
  await pool.query(`INSERT IGNORE INTO users (id, email, name, passwordHash, status) VALUES (?, ?, ?, ?, ?)`, 
    ['USR-001', 'admin@technova.com', 'Admin User', 'Password123', 'ACTIVE']);
  await pool.query(`INSERT IGNORE INTO users (id, email, name, passwordHash, status) VALUES (?, ?, ?, ?, ?)`, 
    ['USR-002', 'sales1@technova.com', 'Sales Rep 1', 'Password123', 'ACTIVE']);

  // Global role assignment (Super Admin explicit platform role)
  await pool.query(`INSERT IGNORE INTO global_user_roles (id, userId, roleId) VALUES (?, ?, ?)`,
    ['GUR-000', 'USR-000', 'SUPER_ADMIN']);

  // Role Permissions & Data Scopes
  await pool.query(`INSERT IGNORE INTO role_permissions (roleId, permission) VALUES 
    ('SUPER_ADMIN', 'ALL'),
    ('TENANT_ADMIN', 'MANAGE_TENANT'),
    ('TENANT_ADMIN', 'MANAGE_USERS'),
    ('TENANT_ADMIN', 'MANAGE_ROLES'),
    ('TENANT_ADMIN', 'MANAGE_CUSTOMERS'),
    ('TENANT_ADMIN', 'MANAGE_PROJECTS'),
    ('TENANT_ADMIN', 'MANAGE_TASKS'),
    ('SALES_REPRESENTATIVE', 'MANAGE_OWN_CUSTOMERS'),
    ('SALES_REPRESENTATIVE', 'MANAGE_OWN_PROJECTS'),
    ('SALES_REPRESENTATIVE', 'MANAGE_OWN_TASKS')
  `);

  await pool.query(`INSERT IGNORE INTO role_data_scopes (id, roleId, scope) VALUES 
    ('RDS-SUPER_ADMIN', 'SUPER_ADMIN', 'SYSTEM'),
    ('RDS-TENANT_ADMIN', 'TENANT_ADMIN', 'ORGANIZATION'),
    ('RDS-SALES_REP', 'SALES_REPRESENTATIVE', 'OWN')
  `);

  // Tenant users (Super Admin has no tenant membership)
  await pool.query(`INSERT IGNORE INTO tenant_users (id, tenantId, userId, isPrimary, status) VALUES (?, ?, ?, ?, ?)`,
    ['TU-001', tenantId, 'USR-001', true, 'ACTIVE']);
  await pool.query(`INSERT IGNORE INTO tenant_users (id, tenantId, userId, isPrimary, status) VALUES (?, ?, ?, ?, ?)`,
    ['TU-002', tenantId, 'USR-002', true, 'ACTIVE']);

  await pool.query(`INSERT IGNORE INTO tenant_user_roles (id, tenantUserId, roleId) VALUES (?, ?, ?)`,
    ['TUR-001', 'TU-001', 'TENANT_ADMIN']);
  await pool.query(`INSERT IGNORE INTO tenant_user_roles (id, tenantUserId, roleId) VALUES (?, ?, ?)`,
    ['TUR-002', 'TU-002', 'SALES_REPRESENTATIVE']);

  // Seed Lookup Data
  // Customer Types
  await pool.query(`INSERT IGNORE INTO customer_types (id, code, name) VALUES ('CT-1', 'COMPANY', 'Company'), ('CT-2', 'INDIVIDUAL', 'Individual')`);
  // Customer Statuses
  await pool.query(`INSERT IGNORE INTO customer_statuses (id, code, name, color) VALUES ('CS-1', 'ACTIVE', 'Active', 'green'), ('CS-2', 'PROSPECT', 'Prospect', 'blue')`);
  // Task Priorities
  await pool.query(`INSERT IGNORE INTO task_priorities (id, code, name, color) VALUES ('TP-1', 'LOW', 'Low', 'gray'), ('TP-2', 'MEDIUM', 'Medium', 'orange'), ('TP-3', 'HIGH', 'High', 'red')`);
  // Task Statuses
  await pool.query(`INSERT IGNORE INTO task_statuses (id, code, name, color) VALUES ('TS-1', 'TODO', 'To Do', 'gray'), ('TS-2', 'IN_PROGRESS', 'In Progress', 'blue'), ('TS-3', 'COMPLETED', 'Completed', 'green')`);
  // Project Stages
  await pool.query(`INSERT IGNORE INTO project_stages (id, code, name, displayOrder, probability) VALUES ('PS-1', 'LEAD', 'Lead', 1, 10), ('PS-2', 'QUALIFICATION', 'Qualification', 2, 20), ('PS-3', 'PROPOSAL', 'Proposal', 3, 50), ('PS-4', 'NEGOTIATION', 'Negotiation', 4, 80), ('PS-5', 'WON', 'Won', 5, 100)`);
  // Visit Purposes
  await pool.query(`INSERT IGNORE INTO visit_purposes (id, code, name) VALUES ('VP-1', 'SALES_PITCH', 'Sales Pitch'), ('VP-2', 'FOLLOW_UP', 'Follow Up'), ('VP-3', 'SUPPORT', 'Support')`);
  // Visit Statuses
  await pool.query(`INSERT IGNORE INTO visit_statuses (id, code, name) VALUES ('VS-1', 'PLANNED', 'Planned'), ('VS-2', 'COMPLETED', 'Completed')`);

  // Seed Customers
  await pool.query(`INSERT IGNORE INTO customers (id, tenantId, code, name, typeId, statusId, industry, picId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
    ['CUS-001', tenantId, 'C001', 'Acme Corp', 'CT-1', 'CS-1', 'Technology', 'USR-002']);
  await pool.query(`INSERT IGNORE INTO customers (id, tenantId, code, name, typeId, statusId, industry, picId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
    ['CUS-002', tenantId, 'C002', 'Global Industries', 'CT-1', 'CS-2', 'Manufacturing', 'USR-002']);

  // Seed Tasks
  await pool.query(`INSERT IGNORE INTO tasks (id, tenantId, title, customerId, priorityId, statusId, taskType, picId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
    ['TSK-001', tenantId, 'Follow up on proposal', 'CUS-001', 'TP-3', 'TS-1', 'GENERAL', 'USR-002']);
  await pool.query(`INSERT IGNORE INTO tasks (id, tenantId, title, customerId, priorityId, statusId, taskType, picId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
    ['TSK-002', tenantId, 'Send quotation', 'CUS-002', 'TP-2', 'TS-2', 'GENERAL', 'USR-002']);

  // Seed Projects
  await pool.query(`INSERT IGNORE INTO projects (id, tenantId, title, customerId, value, probability, stageId, picId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
    ['PRJ-001', tenantId, 'Software License Renewal', 'CUS-001', 50000.00, 80, 'PS-4', 'USR-002']);

  // Seed Visits
  await pool.query(`INSERT IGNORE INTO visits (id, tenantId, customerId, title, purposeId, statusId, visitDate, startTime, endTime, picId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    ['VST-001', tenantId, 'CUS-001', 'Quarterly Review', 'VP-2', 'VS-1', '2026-08-15', '10:00:00', '11:00:00', 'USR-002']);

  // Seed Sales Targets
  await pool.query(`INSERT IGNORE INTO sales_targets (id, tenantId, userId, period, targetAmount, actualAmount, targetRevenue, achievedRevenue, targetVisits, actualVisits, targetDeals, actualDeals) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    ['ST-001', tenantId, 'USR-002', 'Q3-2026', 100000, 50000, 100000, 50000, 20, 5, 5, 1]);

  console.log('Dummy data seeded successfully.');
  await pool.end();
}

seedData().catch(console.error);

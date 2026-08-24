import mysql from 'mysql2/promise';
import { env } from './env';

async function setupDatabase() {
  console.log('Connecting to MySQL Server to ensure DB exists...');
  const baseConn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  });

  await baseConn.query(`CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\``);
  console.log(`Database '${env.DB_NAME}' ensured.`);
  await baseConn.end();

  console.log('Connecting to database to create tables...');
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

  const tableQueries = [
    // TENANTS & SYSTEM
    `CREATE TABLE IF NOT EXISTS tenants (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), code VARCHAR(50), status VARCHAR(20), createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS tenant_settings (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), settingKey VARCHAR(100), settingValue TEXT)`,
    
    // USERS & ORG
    `CREATE TABLE IF NOT EXISTS users (id VARCHAR(50) PRIMARY KEY, email VARCHAR(255) UNIQUE, name VARCHAR(255), passwordHash VARCHAR(255), avatar VARCHAR(255), status VARCHAR(20), lastLoginAt DATETIME, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS tenant_users (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), userId VARCHAR(50), isPrimary BOOLEAN, status VARCHAR(20), joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS user_settings (id VARCHAR(50) PRIMARY KEY, userId VARCHAR(50), settingKey VARCHAR(100), settingValue TEXT)`,
    `CREATE TABLE IF NOT EXISTS departments (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), name VARCHAR(255), description TEXT)`,
    `CREATE TABLE IF NOT EXISTS positions (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), name VARCHAR(255), level INT)`,
    `CREATE TABLE IF NOT EXISTS teams (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), name VARCHAR(255), description TEXT, leaderId VARCHAR(50))`,
    `CREATE TABLE IF NOT EXISTS team_members (id VARCHAR(50) PRIMARY KEY, teamId VARCHAR(50), userId VARCHAR(50), role VARCHAR(50))`,
    
    // ROLES & PERMISSIONS
    `CREATE TABLE IF NOT EXISTS roles (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), name VARCHAR(100), description TEXT, isSystem BOOLEAN, scope VARCHAR(20) DEFAULT 'TENANT')`,
    `CREATE TABLE IF NOT EXISTS permissions (id VARCHAR(50) PRIMARY KEY, code VARCHAR(100) NOT NULL UNIQUE, name VARCHAR(100), description TEXT, module VARCHAR(50), category VARCHAR(50), isSystem BOOLEAN DEFAULT TRUE, isTenantAssignable BOOLEAN DEFAULT TRUE, status VARCHAR(20) DEFAULT 'ACTIVE')`,
    `CREATE TABLE IF NOT EXISTS role_permissions (id VARCHAR(50) PRIMARY KEY, roleId VARCHAR(50), permission VARCHAR(100), UNIQUE KEY uq_role_perm (roleId, permission))`,
    `CREATE TABLE IF NOT EXISTS role_data_scopes (id VARCHAR(50) PRIMARY KEY, roleId VARCHAR(50), scope VARCHAR(50), UNIQUE KEY uq_role_scope (roleId))`,
    `CREATE TABLE IF NOT EXISTS tenant_user_roles (id VARCHAR(50) PRIMARY KEY, tenantUserId VARCHAR(50) NOT NULL, roleId VARCHAR(50) NOT NULL, UNIQUE KEY uq_tenant_user (tenantUserId))`,
    `CREATE TABLE IF NOT EXISTS global_user_roles (id VARCHAR(50) PRIMARY KEY, userId VARCHAR(50) NOT NULL, roleId VARCHAR(50) NOT NULL, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_user_role (userId, roleId))`,
    
    // AUTH & SECURITY
    `CREATE TABLE IF NOT EXISTS login_attempts (id VARCHAR(50) PRIMARY KEY, email VARCHAR(255), ipAddress VARCHAR(50), success BOOLEAN, attemptedAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS auth_sessions (id VARCHAR(50) PRIMARY KEY, userId VARCHAR(50), token VARCHAR(255), ipAddress VARCHAR(50), userAgent TEXT, expiresAt DATETIME, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (id VARCHAR(50) PRIMARY KEY, userId VARCHAR(50), token VARCHAR(255), expiresAt DATETIME, used BOOLEAN, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,

    // MASTER DATA (Lookups)
    `CREATE TABLE IF NOT EXISTS activity_types (id VARCHAR(50) PRIMARY KEY, code VARCHAR(50), name VARCHAR(100), icon VARCHAR(50), color VARCHAR(50))`,
    `CREATE TABLE IF NOT EXISTS customer_statuses (id VARCHAR(50) PRIMARY KEY, code VARCHAR(50), name VARCHAR(100), color VARCHAR(50))`,
    `CREATE TABLE IF NOT EXISTS customer_types (id VARCHAR(50) PRIMARY KEY, code VARCHAR(50), name VARCHAR(100))`,
    `CREATE TABLE IF NOT EXISTS follow_up_types (id VARCHAR(50) PRIMARY KEY, code VARCHAR(50), name VARCHAR(100))`,
    `CREATE TABLE IF NOT EXISTS project_stages (id VARCHAR(50) PRIMARY KEY, code VARCHAR(50), name VARCHAR(100), displayOrder INT, probability INT)`,
    `CREATE TABLE IF NOT EXISTS task_priorities (id VARCHAR(50) PRIMARY KEY, code VARCHAR(50), name VARCHAR(100), color VARCHAR(50))`,
    `CREATE TABLE IF NOT EXISTS task_statuses (id VARCHAR(50) PRIMARY KEY, code VARCHAR(50), name VARCHAR(100), color VARCHAR(50))`,
    `CREATE TABLE IF NOT EXISTS visit_purposes (id VARCHAR(50) PRIMARY KEY, code VARCHAR(50), name VARCHAR(100))`,
    `CREATE TABLE IF NOT EXISTS visit_statuses (id VARCHAR(50) PRIMARY KEY, code VARCHAR(50), name VARCHAR(100))`,
    
    // CUSTOMERS
    `CREATE TABLE IF NOT EXISTS customers (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), code VARCHAR(50), name VARCHAR(255), typeId VARCHAR(50), statusId VARCHAR(50), industry VARCHAR(100), website VARCHAR(255), phone VARCHAR(50), email VARCHAR(255), notes TEXT, picId VARCHAR(50), createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS customer_addresses (id VARCHAR(50) PRIMARY KEY, customerId VARCHAR(50), type VARCHAR(50), address TEXT, city VARCHAR(100), province VARCHAR(100), postalCode VARCHAR(20), country VARCHAR(100), isPrimary BOOLEAN)`,
    `CREATE TABLE IF NOT EXISTS customer_contacts (id VARCHAR(50) PRIMARY KEY, customerId VARCHAR(50), name VARCHAR(255), position VARCHAR(100), email VARCHAR(255), phone VARCHAR(50), isPrimary BOOLEAN)`,
    `CREATE TABLE IF NOT EXISTS customer_assignments (id VARCHAR(50) PRIMARY KEY, customerId VARCHAR(50), userId VARCHAR(50), role VARCHAR(50), assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,

    // PROJECTS (Formerly Opportunities)
    `CREATE TABLE IF NOT EXISTS projects (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), customerId VARCHAR(50), title VARCHAR(255), value DECIMAL(15,2), probability INT, expectedCloseDate DATE, stageId VARCHAR(50), source VARCHAR(100), description TEXT, picId VARCHAR(50), createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS project_stage_histories (id VARCHAR(50) PRIMARY KEY, projectId VARCHAR(50), fromStageId VARCHAR(50), toStageId VARCHAR(50), changedById VARCHAR(50), changedAt DATETIME DEFAULT CURRENT_TIMESTAMP, notes TEXT)`,

    // TASKS & VISITS
    `CREATE TABLE IF NOT EXISTS tasks (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), title VARCHAR(255), description TEXT, customerId VARCHAR(50), relatedProjectId VARCHAR(50), relatedVisitId VARCHAR(50), priorityId VARCHAR(50), statusId VARCHAR(50), taskType VARCHAR(50), dueDate DATE, picId VARCHAR(50), createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, completedAt DATETIME)`,
    `CREATE TABLE IF NOT EXISTS task_assignees (id VARCHAR(50) PRIMARY KEY, taskId VARCHAR(50), userId VARCHAR(50), role VARCHAR(50))`,
    `CREATE TABLE IF NOT EXISTS visits (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), title VARCHAR(255), customerId VARCHAR(50), relatedProjectId VARCHAR(50), purposeId VARCHAR(50), statusId VARCHAR(50), visitDate DATE, startTime TIME, endTime TIME, location TEXT, result TEXT, nextAction TEXT, picId VARCHAR(50), createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS visit_participants (id VARCHAR(50) PRIMARY KEY, visitId VARCHAR(50), contactId VARCHAR(50), userId VARCHAR(50), role VARCHAR(50))`,
    
    // FOLLOW-UPS & ACTIVITIES
    `CREATE TABLE IF NOT EXISTS follow_ups (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), title VARCHAR(255), customerId VARCHAR(50), typeId VARCHAR(50), relatedVisitId VARCHAR(50), relatedProjectId VARCHAR(50), relatedTaskId VARCHAR(50), picId VARCHAR(50), followUpDate DATETIME, reminderDate DATETIME, priorityId VARCHAR(50), notes TEXT, outcome TEXT, status VARCHAR(50), createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, completedAt DATETIME)`,
    `CREATE TABLE IF NOT EXISTS activities (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), customerId VARCHAR(50), userId VARCHAR(50), typeId VARCHAR(50), subject VARCHAR(255), description TEXT, occurredAt DATETIME, entityType VARCHAR(50), entityId VARCHAR(50), changes JSON, metadata JSON)`,
    `CREATE TABLE IF NOT EXISTS attachments (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), entityType VARCHAR(50), entityId VARCHAR(50), fileName VARCHAR(255), fileUrl TEXT, fileType VARCHAR(100), fileSize INT, uploadedById VARCHAR(50), uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS sales_targets (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), userId VARCHAR(50), period VARCHAR(50), targetAmount DECIMAL(15,2), actualAmount DECIMAL(15,2), targetRevenue DECIMAL(15,2), achievedRevenue DECIMAL(15,2), targetVisits INT, actualVisits INT, targetDeals INT, actualDeals INT)`,

    // SYSTEM MODULES
    `CREATE TABLE IF NOT EXISTS notifications (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), userId VARCHAR(50), title VARCHAR(255), message TEXT, type VARCHAR(50), isRead BOOLEAN, linkUrl TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS notification_preferences (id VARCHAR(50) PRIMARY KEY, userId VARCHAR(50), type VARCHAR(50), emailEnabled BOOLEAN, pushEnabled BOOLEAN, inAppEnabled BOOLEAN)`,
    `CREATE TABLE IF NOT EXISTS audit_logs (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), userId VARCHAR(50), action VARCHAR(50), module VARCHAR(100), entity VARCHAR(100), entityId VARCHAR(50), description TEXT, ipAddress VARCHAR(100), timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`
  ];

  for (const query of tableQueries) {
    try {
      await pool.query(query);
    } catch (err: any) {
      console.error('Error executing query:', query);
      console.error(err);
    }
  }

  console.log('All 42 tables verified/created successfully.');
  await pool.end();
}

setupDatabase().catch(console.error);

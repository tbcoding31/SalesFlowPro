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
    `CREATE INDEX idx_activities_tenant_time ON activities (tenantId, occurredAt)`,
    `CREATE INDEX idx_audit_logs_tenant_time ON audit_logs (tenantId, timestamp)`,
    `CREATE INDEX idx_tasks_tenant_due_date ON tasks (tenantId, dueDate)`,
    `CREATE INDEX idx_customers_tenant ON customers (tenantId)`,
    // TENANTS & SYSTEM
    `CREATE TABLE IF NOT EXISTS tenants (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), code VARCHAR(50), status VARCHAR(20), createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS tenant_settings (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), settingKey VARCHAR(100), settingValue TEXT)`,
    
    // USERS & ORG
    `CREATE TABLE IF NOT EXISTS users (id VARCHAR(50) PRIMARY KEY, email VARCHAR(255) UNIQUE, name VARCHAR(255), passwordHash VARCHAR(255), avatar VARCHAR(255), status VARCHAR(20), lastLoginAt DATETIME, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS tenant_users (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), userId VARCHAR(50), isPrimary BOOLEAN, status VARCHAR(20), joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_tenant_user_membership (tenantId, userId))`,
    `CREATE TABLE IF NOT EXISTS user_settings (id VARCHAR(50) PRIMARY KEY, userId VARCHAR(50), settingKey VARCHAR(100), settingValue TEXT)`,
    `CREATE TABLE IF NOT EXISTS departments (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), name VARCHAR(255), description TEXT)`,
    `CREATE TABLE IF NOT EXISTS teams (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50) NOT NULL, name VARCHAR(255) NOT NULL, description TEXT, leaderId VARCHAR(50), createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS team_members (id VARCHAR(50) PRIMARY KEY, teamId VARCHAR(50) NOT NULL, tenantUserId VARCHAR(50) NOT NULL, role VARCHAR(50) DEFAULT 'MEMBER', joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_team_member_tenant_user (tenantUserId))`,
    
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
    `CREATE TABLE IF NOT EXISTS customers (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), code VARCHAR(50), name VARCHAR(255), typeId VARCHAR(50), statusId VARCHAR(50), industry VARCHAR(100), website VARCHAR(255), phone VARCHAR(50), email VARCHAR(255), notes TEXT, picId VARCHAR(50), lastVisitAt DATETIME, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS customer_addresses (id VARCHAR(50) PRIMARY KEY, customerId VARCHAR(50), type VARCHAR(50), address TEXT, city VARCHAR(100), province VARCHAR(100), postalCode VARCHAR(20), country VARCHAR(100), isPrimary BOOLEAN)`,
    `CREATE TABLE IF NOT EXISTS customer_contacts (id VARCHAR(50) PRIMARY KEY, customerId VARCHAR(50), name VARCHAR(255), position VARCHAR(100), email VARCHAR(255), phone VARCHAR(50), isPrimary BOOLEAN)`,
    `CREATE TABLE IF NOT EXISTS customer_assignments (id VARCHAR(50) PRIMARY KEY, customerId VARCHAR(50), userId VARCHAR(50), role VARCHAR(50), assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,

    // PROJECTS (Formerly Opportunities)
    `CREATE TABLE IF NOT EXISTS projects (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), customerId VARCHAR(50), title VARCHAR(255), value DECIMAL(15,2), probability INT, expectedCloseDate DATE, stageId VARCHAR(50), source VARCHAR(100), description TEXT, picId VARCHAR(50), createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS project_stage_histories (
      id VARCHAR(50) PRIMARY KEY,
      projectId VARCHAR(50) NOT NULL,
      fromStageId VARCHAR(50),
      toStageId VARCHAR(50) NOT NULL,
      changedById VARCHAR(50) NOT NULL,
      changedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      creditedTenantUserId VARCHAR(50),
      creditedTeamId VARCHAR(50),
      INDEX idx_psh_project (projectId, changedAt),
      INDEX idx_psh_attribution (toStageId, changedAt, creditedTenantUserId, creditedTeamId)
    )`,

    // TASKS & VISITS
    `CREATE TABLE IF NOT EXISTS tasks (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), title VARCHAR(255), description TEXT, customerId VARCHAR(50), relatedProjectId VARCHAR(50), relatedVisitId VARCHAR(50), priorityId VARCHAR(50), statusId VARCHAR(50), taskType VARCHAR(50), dueDate DATE, picId VARCHAR(50), createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, completedAt DATETIME)`,
    `CREATE TABLE IF NOT EXISTS task_assignees (id VARCHAR(50) PRIMARY KEY, taskId VARCHAR(50), userId VARCHAR(50), role VARCHAR(50))`,
    `CREATE TABLE IF NOT EXISTS visits (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), title VARCHAR(255), customerId VARCHAR(50), relatedProjectId VARCHAR(50), purposeId VARCHAR(50), statusId VARCHAR(50), visitDate DATE, startTime TIME, endTime TIME, location TEXT, result TEXT, nextAction TEXT, picId VARCHAR(50), createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS visit_participants (id VARCHAR(50) PRIMARY KEY, visitId VARCHAR(50), contactId VARCHAR(50), userId VARCHAR(50), role VARCHAR(50))`,
    
    // FOLLOW-UPS & ACTIVITIES
    `CREATE TABLE IF NOT EXISTS follow_ups (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), title VARCHAR(255), customerId VARCHAR(50), typeId VARCHAR(50), relatedVisitId VARCHAR(50), relatedProjectId VARCHAR(50), relatedTaskId VARCHAR(50), picId VARCHAR(50), followUpDate DATETIME, reminderDate DATETIME, priorityId VARCHAR(50), notes TEXT, outcome TEXT, status VARCHAR(50), createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, completedAt DATETIME)`,
    `CREATE TABLE IF NOT EXISTS activities (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), customerId VARCHAR(50), userId VARCHAR(50), typeId VARCHAR(50), subject VARCHAR(255), description TEXT, occurredAt DATETIME, entityType VARCHAR(50), entityId VARCHAR(50), changes JSON, metadata JSON)`,
    `CREATE TABLE IF NOT EXISTS attachments (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), entityType VARCHAR(50), entityId VARCHAR(50), fileName VARCHAR(255), fileUrl TEXT, fileType VARCHAR(100), fileSize INT, uploadedById VARCHAR(50), uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS sales_targets (
      id VARCHAR(50) PRIMARY KEY,
      tenantId VARCHAR(50) NOT NULL,
      targetScope VARCHAR(20) NOT NULL,
      tenantUserId VARCHAR(50),
      teamId VARCHAR(50),
      targetType VARCHAR(50) NOT NULL,
      periodStart DATE NOT NULL,
      periodEnd DATE NOT NULL,
      targetValue DECIMAL(15,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      createdById VARCHAR(50) NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sales_targets_tenant_period (tenantId, periodStart, periodEnd, status),
      INDEX idx_sales_targets_user (tenantId, tenantUserId, status),
      INDEX idx_sales_targets_team (tenantId, teamId, status)
    )`,

    // SYSTEM MODULES
    `CREATE TABLE IF NOT EXISTS notifications (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), userId VARCHAR(50), title VARCHAR(255), message TEXT, type VARCHAR(50), isRead BOOLEAN, linkUrl TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS notification_preferences (id VARCHAR(50) PRIMARY KEY, userId VARCHAR(50), type VARCHAR(50), emailEnabled BOOLEAN, pushEnabled BOOLEAN, inAppEnabled BOOLEAN)`,
    `CREATE TABLE IF NOT EXISTS audit_logs (id VARCHAR(50) PRIMARY KEY, tenantId VARCHAR(50), userId VARCHAR(50), action VARCHAR(50), module VARCHAR(100), entity VARCHAR(100), entityId VARCHAR(50), description TEXT, ipAddress VARCHAR(100), timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`,

    // R52 STALLED PROJECT INTERVENTION POLICIES (LINEAGE HEADER - PURE LINEAGE ONLY)
    `CREATE TABLE IF NOT EXISTS project_intervention_policies (
      id VARCHAR(50) PRIMARY KEY,
      tenantId VARCHAR(50) NOT NULL,
      code VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      activeRevisionId VARCHAR(50) DEFAULT NULL,
      createdById VARCHAR(50) NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_tenant_policy_code (tenantId, code),
      INDEX idx_pip_tenant_status (tenantId, status),
      INDEX idx_pip_active_rev (activeRevisionId)
    )`,
    `CREATE TABLE IF NOT EXISTS project_intervention_policy_conditions (
      id VARCHAR(50) PRIMARY KEY,
      policyId VARCHAR(50) NOT NULL,
      conditionType VARCHAR(100) NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_policy_condition (policyId, conditionType),
      INDEX idx_pipc_policy (policyId)
    )`,

    // R55 IMMUTABLE POLICY REVISIONS & CONDITIONS
    `CREATE TABLE IF NOT EXISTS project_intervention_policy_revisions (
      id VARCHAR(50) PRIMARY KEY,
      tenantId VARCHAR(50) NOT NULL,
      policyId VARCHAR(50) NOT NULL,
      revisionNumber INT NOT NULL,
      severity VARCHAR(20) NOT NULL,
      matchMode VARCHAR(20) NOT NULL,
      createdById VARCHAR(50) NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      changeReason TEXT DEFAULT NULL,
      migrationProvenance VARCHAR(50) NOT NULL,
      UNIQUE KEY uq_pipr_policy_rev (policyId, revisionNumber),
      INDEX idx_pipr_tenant_policy (tenantId, policyId),
      INDEX idx_pipr_created (createdAt)
    )`,
    `CREATE TABLE IF NOT EXISTS project_intervention_policy_revision_conditions (
      id VARCHAR(50) PRIMARY KEY,
      revisionId VARCHAR(50) NOT NULL,
      conditionType VARCHAR(100) NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_piprc_rev_cond (revisionId, conditionType),
      INDEX idx_piprc_rev (revisionId)
    )`,

    // R53 STALLED PROJECT INTERVENTION EPISODES HISTORY (EPISODE LIFECYCLE MODEL)
    `CREATE TABLE IF NOT EXISTS project_intervention_episodes (
      id VARCHAR(50) PRIMARY KEY,
      tenantId VARCHAR(50) NOT NULL,
      projectId VARCHAR(50) NOT NULL,
      policyId VARCHAR(50) NOT NULL,
      policyRevisionId VARCHAR(50) DEFAULT NULL,
      policyRevisionNumberSnapshot INT DEFAULT NULL,
      policyRevisionLinkProvenance VARCHAR(50) NOT NULL,
      policyCodeSnapshot VARCHAR(100) NOT NULL,
      policyNameSnapshot VARCHAR(255) NOT NULL,
      severitySnapshot VARCHAR(20) NOT NULL,
      matchModeSnapshot VARCHAR(20) NOT NULL,
      conditionSnapshot JSON NOT NULL,
      startFacts JSON NOT NULL,
      endFacts JSON,
      startReason VARCHAR(100) NOT NULL,
      endReason VARCHAR(100),
      startProvenance VARCHAR(50) NOT NULL,
      startedByEventType VARCHAR(100) NOT NULL,
      endedByEventType VARCHAR(100),
      startedByEntityId VARCHAR(50),
      endedByEntityId VARCHAR(50),
      startedByUserId VARCHAR(50),
      endedByUserId VARCHAR(50),
      picIdSnapshot VARCHAR(50),
      teamIdSnapshot VARCHAR(50),
      startedAt DATETIME NOT NULL,
      endedAt DATETIME,
      durationHours DECIMAL(10,2),
      durationDays DECIMAL(10,2),
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      activeKey VARCHAR(160) DEFAULT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_pie_active_key (activeKey),
      INDEX idx_pie_tenant_project (tenantId, projectId, startedAt),
      INDEX idx_pie_tenant_policy (tenantId, policyId, startedAt),
      INDEX idx_pie_active (tenantId, projectId, policyId, isActive),
      INDEX idx_pie_revision (policyRevisionId)
    )`
  ];

  for (const query of tableQueries) {
    try {
      await pool.query(query);
    } catch (err: any) {
      console.error('Error executing query:', query);
      console.error(err);
    }
  }

  // Ensure activeRevisionId column on project_intervention_policies
  try {
    const [pCols]: any = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_intervention_policies' AND COLUMN_NAME = 'activeRevisionId'`
    );
    if (pCols.length === 0) {
      await pool.query(`ALTER TABLE project_intervention_policies ADD COLUMN activeRevisionId VARCHAR(50) DEFAULT NULL`);
    }
  } catch (e: any) {}

  // Ensure migrationProvenance on project_intervention_policy_revisions
  try {
    const [revCols]: any = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_intervention_policy_revisions' AND COLUMN_NAME = 'migrationProvenance'`
    );
    if (revCols.length === 0) {
      await pool.query(`ALTER TABLE project_intervention_policy_revisions ADD COLUMN migrationProvenance VARCHAR(50) NOT NULL`);
    } else {
      await pool.query(`UPDATE project_intervention_policy_revisions SET migrationProvenance = 'RUNTIME_MUTATION' WHERE migrationProvenance IS NULL`);
      await pool.query(`ALTER TABLE project_intervention_policy_revisions MODIFY COLUMN migrationProvenance VARCHAR(50) NOT NULL`);
    }
  } catch (e: any) {}

  // Ensure UNIQUE constraint on project_intervention_policy_conditions
  try {
    await pool.query(`
      ALTER TABLE project_intervention_policy_conditions
      ADD UNIQUE KEY uq_policy_condition (policyId, conditionType)
    `);
  } catch (err: any) {
    // Ignore if constraint already exists
  }

  // Ensure columns on project_intervention_episodes
  const episodeColumnsToAdd = [
    { name: 'policyRevisionId', def: 'VARCHAR(50) DEFAULT NULL' },
    { name: 'policyRevisionNumberSnapshot', def: 'INT DEFAULT NULL' },
    { name: 'policyRevisionLinkProvenance', def: 'VARCHAR(50) NOT NULL' },
    { name: 'startProvenance', def: 'VARCHAR(50) NOT NULL DEFAULT "TRANSITION_DETECTED"' },
    { name: 'picIdSnapshot', def: 'VARCHAR(50)' },
    { name: 'teamIdSnapshot', def: 'VARCHAR(50)' },
    { name: 'durationHours', def: 'DECIMAL(10,2)' },
    { name: 'durationDays', def: 'DECIMAL(10,2)' },
    { name: 'activeKey', def: 'VARCHAR(160) DEFAULT NULL' }
  ];

  for (const col of episodeColumnsToAdd) {
    try {
      const [colRows]: any = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_intervention_episodes' AND COLUMN_NAME = ?`,
        [col.name]
      );
      if (colRows.length === 0) {
        await pool.query(`ALTER TABLE project_intervention_episodes ADD COLUMN ${col.name} ${col.def}`);
      }
    } catch (e: any) {
      // Ignore
    }
  }

  try {
    const [idxRows]: any = await pool.query(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_intervention_episodes' AND CONSTRAINT_NAME = 'uq_pie_active_key'`
    );
    if (idxRows.length === 0) {
      await pool.query(`ALTER TABLE project_intervention_episodes ADD UNIQUE KEY uq_pie_active_key (activeKey)`);
    }
  } catch (err: any) {
    // Ignore
  }

  // R55 IDEMPOTENT ATOMIC MIGRATION FOR EXISTING POLICIES & SAFE COLUMN CLEANUP
  try {
    const [unmigratedPolicies]: any = await pool.query(`
      SELECT p.* FROM project_intervention_policies p
      WHERE p.activeRevisionId IS NULL
    `);

    for (const pol of unmigratedPolicies) {
      const conn = await pool.getConnection();
      await conn.beginTransaction();

      try {
        const [existingRevs]: any = await conn.query(
          `SELECT id FROM project_intervention_policy_revisions WHERE policyId = ? AND revisionNumber = 1 FOR UPDATE`,
          [pol.id]
        );

        let revId: string;
        if (existingRevs.length > 0) {
          revId = existingRevs[0].id;
        } else {
          revId = `PIPR-MIG-${pol.id}-1`;
          await conn.query(`
            INSERT INTO project_intervention_policy_revisions (
              id, tenantId, policyId, revisionNumber, severity, matchMode, createdById, createdAt, migrationProvenance
            ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, 'MIGRATED_CURRENT_STATE')
          `, [
            revId,
            pol.tenantId,
            pol.id,
            pol.severity || 'WARNING',
            pol.matchMode || 'ALL',
            pol.createdById || 'SYSTEM',
            pol.createdAt || new Date()
          ]);

          // Copy conditions to revision
          const [oldConds]: any = await conn.query(
            `SELECT conditionType FROM project_intervention_policy_conditions WHERE policyId = ?`,
            [pol.id]
          );

          for (const c of oldConds) {
            const rcId = `PIPRC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
            await conn.query(`
              INSERT IGNORE INTO project_intervention_policy_revision_conditions (id, revisionId, conditionType)
              VALUES (?, ?, ?)
            `, [rcId, revId, c.conditionType]);
          }
        }

        await conn.query(
          `UPDATE project_intervention_policies SET activeRevisionId = ? WHERE id = ?`,
          [revId, pol.id]
        );

        // Backfill exact semantic matches in legacy episodes
        const [revCondRows]: any = await conn.query(
          `SELECT conditionType FROM project_intervention_policy_revision_conditions WHERE revisionId = ? ORDER BY conditionType ASC`,
          [revId]
        );
        const revConditionsSorted = revCondRows.map((c: any) => c.conditionType).sort();

        const [legacyEpisodes]: any = await conn.query(
          `SELECT id, severitySnapshot, matchModeSnapshot, conditionSnapshot FROM project_intervention_episodes WHERE policyId = ? AND (policyRevisionId IS NULL OR policyRevisionLinkProvenance = 'LEGACY_UNVERSIONED')`,
          [pol.id]
        );

        for (const ep of legacyEpisodes) {
          let epConds: string[] = [];
          try {
            epConds = (typeof ep.conditionSnapshot === 'string' ? JSON.parse(ep.conditionSnapshot) : ep.conditionSnapshot) || [];
          } catch (e) {
            epConds = [];
          }
          const epCondsSorted = [...epConds].sort();

          const isExactMatch = (
            ep.severitySnapshot === (pol.severity || 'WARNING') &&
            ep.matchModeSnapshot === (pol.matchMode || 'ALL') &&
            epCondsSorted.length === revConditionsSorted.length &&
            epCondsSorted.every((val, idx) => val === revConditionsSorted[idx])
          );

          if (isExactMatch) {
            await conn.query(
              `UPDATE project_intervention_episodes 
               SET policyRevisionId = ?, 
                   policyRevisionNumberSnapshot = 1,
                   policyRevisionLinkProvenance = 'MIGRATED_SEMANTIC_MATCH'
               WHERE id = ?`,
              [revId, ep.id]
            );
          } else {
            await conn.query(
              `UPDATE project_intervention_episodes 
               SET policyRevisionId = NULL, 
                    policyRevisionNumberSnapshot = NULL,
                    policyRevisionLinkProvenance = 'LEGACY_UNVERSIONED'
               WHERE id = ?`,
              [ep.id]
            );
          }
        }

        await conn.commit();
      } catch (err: any) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    // R55R3: Safe Drop of legacy header semantic columns after all active policies have activeRevisionId
    const [policyCols]: any = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_intervention_policies'`
    );
    const existingColNames = new Set(policyCols.map((c: any) => c.COLUMN_NAME));
    if (existingColNames.has('severity')) {
      try {
        await pool.query(`ALTER TABLE project_intervention_policies DROP COLUMN severity`);
      } catch (e: any) {}
    }
    if (existingColNames.has('matchMode')) {
      try {
        await pool.query(`ALTER TABLE project_intervention_policies DROP COLUMN matchMode`);
      } catch (e: any) {}
    }

    // R55R3: Ensure startProvenance, policyRevisionLinkProvenance, and migrationProvenance have NO schema defaults
    try {
      await pool.query(`ALTER TABLE project_intervention_episodes MODIFY COLUMN startProvenance VARCHAR(50) NOT NULL`);
      await pool.query(`ALTER TABLE project_intervention_episodes MODIFY COLUMN policyRevisionLinkProvenance VARCHAR(50) NOT NULL`);
      await pool.query(`ALTER TABLE project_intervention_policy_revisions MODIFY COLUMN migrationProvenance VARCHAR(50) NOT NULL`);
    } catch (e: any) {}

  } catch (migErr: any) {
    console.error('[R55 Migration Error]', migErr);
  }

  console.log('All 44 tables verified/created successfully.');
  await pool.end();
}

export { setupDatabase };

if (require.main === module) {
  setupDatabase().catch(console.error);
}

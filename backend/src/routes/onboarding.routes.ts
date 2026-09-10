import { Router } from 'express';
import { pool } from '../db';
import { logAudit } from '../utils/audit';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export const onboardingRoutes = Router();

onboardingRoutes.post('/tenant', async (req, res) => {
  const actorRole = (req as any).userRole;
  const isPlatformUser = (req as any).isPlatformUser;

  // Platform Authorization (Issue A)
  console.log({isPlatformUser, actorRole});
  if (!isPlatformUser || actorRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access denied. Only system administrators can onboard tenants.' });
  }

  const { organization, primaryAdmin, testOptions } = req.body;

  if (!organization || !primaryAdmin || !primaryAdmin.temporaryPassword) {
    return res.status(400).json({ error: 'Missing required onboarding data or password.' });
  }

  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    // 1. Tenant ID and Code
    
    const tenantId = `TEN-${Date.now()}-${randomUUID().substring(0,6)}`;
    
    // BACKEND AUTHORITATIVE COLLISION-SAFE TENANT CODE GENERATION
    let tenantCode = '';
    let codeIsUnique = false;
    let attempts = 0;
    
    while (!codeIsUnique && attempts < 5) {
      // Generate candidate
      const candidateCode = 'TEN-' + Math.floor(10000 + Math.random() * 90000).toString();
      const [existingTenants]: any = await connection.query('SELECT id FROM tenants WHERE code = ?', [candidateCode]);
      if (existingTenants.length === 0) {
        tenantCode = candidateCode;
        codeIsUnique = true;
      }
      attempts++;
    }
    
    if (!codeIsUnique) {
      await connection.rollback();
      return res.status(500).json({ error: 'Failed to generate a unique tenant code. Please try again.' });
    }


    // Trial Policy Calculation
    const type = organization.type || 'Professional';
    let trialEndDate = null;
    if (type === 'Trial 3 Bulan') {
      if (testOptions?.simulateTrialExpired && process.env.NODE_ENV !== 'production') {
        trialEndDate = new Date('2026-08-01'); // expired
      } else {
        trialEndDate = new Date();
        trialEndDate.setMonth(trialEndDate.getMonth() + 3);
      }
    }

    // Insert Tenant
    await connection.query(
      `INSERT INTO tenants (id, name, code, status, createdAt, type, trialEndDate, email, industry, phone, region, address, description) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, organization.name, tenantCode, 'ACTIVE', type, trialEndDate, organization.email || null, organization.industry || null, organization.phone || null, organization.region || null, organization.address || null, organization.description || null]
    );

    // 2. User Identity Policy
    const [existingUsers]: any = await connection.query('SELECT id FROM users WHERE email = ?', [primaryAdmin.email]);
    let userId = null;
    
    if (existingUsers.length > 0) {
       userId = existingUsers[0].id;
       // Existing user, do we update password? No. 
       // Just reuse identity.
    } else {
       // Insert New User
       userId = `USR-${Date.now()}-${randomUUID().substring(0,6)}`;
       const salt = await bcrypt.genSalt(10);
       const passwordHash = await bcrypt.hash(primaryAdmin.temporaryPassword, salt);
       const fullName = `${primaryAdmin.firstName} ${primaryAdmin.lastName}`.trim();
       
       await connection.query(
         `INSERT INTO users (id, email, name, passwordHash, status, createdAt) VALUES (?, ?, ?, ?, ?, NOW())`,
         [userId, primaryAdmin.email, fullName, passwordHash, 'ACTIVE']
       );
    }

    // 3. Insert Tenant_User (Primary Membership)
    const tuId = `TU-${Date.now()}-${randomUUID().substring(0,6)}`;
    await connection.query(
      `INSERT INTO tenant_users (id, tenantId, userId, isPrimary, status, joinedAt) VALUES (?, ?, ?, ?, ?, NOW())`,
      [tuId, tenantId, userId, true, 'ACTIVE']
    );

    // 4. Role Cloning Integrity
    const [templates]: any = await connection.query(`SELECT * FROM roles WHERE scope = 'TEMPLATE' AND isSystem = 1`);
    
    let adminRoleId = null;

    for (const tmpl of templates) {
      const shortTmpl = tmpl.id.replace('TEMPLATE_', '').replace('REPRESENTATIVE', 'REP');
      const clonedRoleId = `ROLE-${tenantId}-${shortTmpl}`;
      const roleCode = tmpl.code || (shortTmpl === 'TENANT_ADMIN' ? 'TENANT_ADMIN' : shortTmpl);
      
      await connection.query(`
        INSERT INTO roles (id, tenantId, code, name, description, isSystem, scope)
        VALUES (?, ?, ?, ?, ?, 1, 'TENANT')
      `, [clonedRoleId, tenantId, roleCode, tmpl.name, tmpl.description]);

      // Clone Permissions
      const [tmplPerms]: any = await connection.query('SELECT permission FROM role_permissions WHERE roleId = ?', [tmpl.id]);
      for (const tp of tmplPerms) {
        // Need to specify an ID for role_permissions because the schema requires it? Let's check schema later.
        await connection.query('INSERT IGNORE INTO role_permissions (roleId, permission) VALUES (?, ?)', [clonedRoleId, tp.permission]);
      }

      // Clone Data Scopes
      const [tmplScopes]: any = await connection.query('SELECT scope FROM role_data_scopes WHERE roleId = ?', [tmpl.id]);
      if (tmplScopes.length === 0) {
        throw new Error(`MISSING_TEMPLATE_SCOPE: Template role ${tmpl.id} has no data scope defined.`);
      }
      
      const rdsId = `RDS-${Date.now()}-${randomUUID().substring(0,6)}`;
      await connection.query(`
        INSERT INTO role_data_scopes (id, roleId, scope)
        VALUES (?, ?, ?)
      `, [rdsId, clonedRoleId, tmplScopes[0].scope]);

      if (tmpl.id === 'TEMPLATE_TENANT_ADMIN') {
        adminRoleId = clonedRoleId;
      }
    }

    if (!adminRoleId) {
      throw new Error('MISSING_ADMIN_TEMPLATE: TEMPLATE_TENANT_ADMIN not found.');
    }

    // 5. Assign Cloned Tenant Administrator Role
    await connection.query(
      `INSERT INTO tenant_user_roles (id, tenantUserId, roleId) VALUES (?, ?, ?)`,
      [`TUR-${Date.now()}-${randomUUID().substring(0,6)}`, tuId, adminRoleId]
    );

    
      // 6. Clone Master Data Blueprints for All 10 Categories (Two-Tier Snapshot)
      const cleanT = tenantId.replace(/[^a-zA-Z0-9]/g, '');
      const tPart = cleanT.length > 20 ? cleanT.substring(0, 20) : cleanT;

      // 6.1 Departments
      const [blueprintDepts]: any = await connection.query("SELECT * FROM departments WHERE tenantId IS NULL");
      for (const dept of blueprintDepts) {
        const newDeptId = `DEPT-${tPart}-${dept.id}`;
        await connection.query(
          "INSERT INTO departments (id, tenantId, sourceType, platformMasterId, name, description, isActive, displayOrder) VALUES (?, ?, 'PLATFORM', ?, ?, ?, 1, ?)",
          [newDeptId, tenantId, dept.id, dept.name, dept.description, dept.displayOrder || 0]
        );
      }

      // 6.2 Positions
      const [blueprintPos]: any = await connection.query("SELECT * FROM positions WHERE tenantId IS NULL");
      for (const pos of blueprintPos) {
        const newPosId = `POS-${tPart}-${pos.id}`;
        await connection.query(
          "INSERT INTO positions (id, tenantId, sourceType, platformMasterId, name, level, isActive) VALUES (?, ?, 'PLATFORM', ?, ?, ?, 1)",
          [newPosId, tenantId, pos.id, pos.name, pos.level || 1]
        );
      }

      // 6.3 Project Stages
      const [blueprintStages]: any = await connection.query("SELECT * FROM project_stages WHERE tenantId IS NULL");
      for (const ps of blueprintStages) {
        const newId = `PS-${tPart}-${ps.id}`;
        await connection.query(
          `INSERT INTO project_stages (id, tenantId, sourceType, platformMasterId, code, name, phase, commercialOutcome, displayOrder, probability, isTerminal, allowVisits, allowNewProject, isActive)
           VALUES (?, ?, 'PLATFORM', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId, tenantId, ps.id, ps.code, ps.name, ps.phase, ps.commercialOutcome, ps.displayOrder, ps.probability, ps.isTerminal, ps.allowVisits, ps.allowNewProject, ps.isActive]
        );
      }

      // 6.4 Task Priorities
      const [blueprintPrios]: any = await connection.query("SELECT * FROM task_priorities WHERE tenantId IS NULL");
      for (const tp of blueprintPrios) {
        const newId = `TP-${tPart}-${tp.id}`;
        await connection.query(
          `INSERT INTO task_priorities (id, tenantId, sourceType, platformMasterId, code, name, color, isActive, displayOrder)
           VALUES (?, ?, 'PLATFORM', ?, ?, ?, ?, ?, ?)`,
          [newId, tenantId, tp.id, tp.code, tp.name, tp.color, tp.isActive || 1, tp.displayOrder || 0]
        );
      }

      // 6.5 Task Statuses
      const [blueprintTaskStatuses]: any = await connection.query("SELECT * FROM task_statuses WHERE tenantId IS NULL");
      for (const ts of blueprintTaskStatuses) {
        const newId = `TS-${tPart}-${ts.id}`;
        await connection.query(
          `INSERT INTO task_statuses (id, tenantId, sourceType, platformMasterId, code, name, color, isActive, displayOrder)
           VALUES (?, ?, 'PLATFORM', ?, ?, ?, ?, ?, ?)`,
          [newId, tenantId, ts.id, ts.code, ts.name, ts.color, ts.isActive || 1, ts.displayOrder || 0]
        );
      }

      // 6.6 Customer Types
      const [blueprintCustTypes]: any = await connection.query("SELECT * FROM customer_types WHERE tenantId IS NULL");
      for (const ct of blueprintCustTypes) {
        const newId = `CT-${tPart}-${ct.id}`;
        await connection.query(
          `INSERT INTO customer_types (id, tenantId, sourceType, platformMasterId, code, name, isActive, displayOrder)
           VALUES (?, ?, 'PLATFORM', ?, ?, ?, ?, ?)`,
          [newId, tenantId, ct.id, ct.code, ct.name, ct.isActive || 1, ct.displayOrder || 0]
        );
      }

      // 6.7 Customer Statuses
      const [blueprintCustStatuses]: any = await connection.query("SELECT * FROM customer_statuses WHERE tenantId IS NULL");
      for (const cs of blueprintCustStatuses) {
        const newId = `CS-${tPart}-${cs.id}`;
        await connection.query(
          `INSERT INTO customer_statuses (id, tenantId, sourceType, platformMasterId, code, name, color, isActive, displayOrder)
           VALUES (?, ?, 'PLATFORM', ?, ?, ?, ?, ?, ?)`,
          [newId, tenantId, cs.id, cs.code, cs.name, cs.color, cs.isActive || 1, cs.displayOrder || 0]
        );
      }

      // 6.8 Visit Purposes
      const [blueprintVisitPurposes]: any = await connection.query("SELECT * FROM visit_purposes WHERE tenantId IS NULL");
      for (const vp of blueprintVisitPurposes) {
        const newId = `VP-${tPart}-${vp.id}`;
        await connection.query(
          `INSERT INTO visit_purposes (id, tenantId, sourceType, platformMasterId, code, name, isActive, displayOrder)
           VALUES (?, ?, 'PLATFORM', ?, ?, ?, ?, ?)`,
          [newId, tenantId, vp.id, vp.code, vp.name, vp.isActive || 1, vp.displayOrder || 0]
        );
      }

      // 6.9 Visit Statuses
      const [blueprintVisitStatuses]: any = await connection.query("SELECT * FROM visit_statuses WHERE tenantId IS NULL");
      for (const vs of blueprintVisitStatuses) {
        const newId = `VS-${tPart}-${vs.id}`;
        await connection.query(
          `INSERT INTO visit_statuses (id, tenantId, sourceType, platformMasterId, code, name, isTerminal, isActive, displayOrder)
           VALUES (?, ?, 'PLATFORM', ?, ?, ?, ?, ?, ?)`,
          [newId, tenantId, vs.id, vs.code, vs.name, vs.isTerminal, vs.isActive || 1, vs.displayOrder || 0]
        );
      }

      // 6.10 Activity Types
      const [blueprintActTypes]: any = await connection.query("SELECT * FROM activity_types WHERE tenantId IS NULL");
      for (const at of blueprintActTypes) {
        const newId = `AT-${tPart}-${at.id}`;
        await connection.query(
          `INSERT INTO activity_types (id, tenantId, sourceType, platformMasterId, code, name, icon, color, isActive, displayOrder)
           VALUES (?, ?, 'PLATFORM', ?, ?, ?, ?, ?, ?, ?)`,
          [newId, tenantId, at.id, at.code, at.name, at.icon, at.color, at.isActive || 1, at.displayOrder || 0]
        );
      }

      // 7. Atomic Visit Reminder Settings Initialization (Snapshot Copy from Active Platform Default)
      const [defaultRows]: any = await connection.query(
        'SELECT * FROM visit_reminder_defaults WHERE isActive = 1 ORDER BY createdAt DESC LIMIT 1 FOR UPDATE'
      );
      if (defaultRows.length === 0) {
        throw new Error('CONFIG_INTEGRITY_ERROR: No active visit_reminder_defaults found for tenant initialization.');
      }
      const platformDef = defaultRows[0];
      const tvrsId = `TVRS-${Date.now()}-${randomUUID().substring(0, 6)}`;
      await connection.query(
        `INSERT INTO tenant_visit_reminder_settings (
          id, tenantId, dashboardReminderEnabled, dashboardReminderDaysBefore,
          emailReminderEnabled, emailReminderDaysBefore,
          immediateReminderInsideWindowEnabled, createdAt, updatedAt, updatedById
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)`,
        [
          tvrsId,
          tenantId,
          platformDef.dashboardReminderEnabled,
          platformDef.dashboardReminderDaysBefore,
          platformDef.emailReminderEnabled,
          platformDef.emailReminderDaysBefore,
          platformDef.immediateReminderInsideWindowEnabled,
          userId
        ]
      );

      // Audit Log (without credentials)
    

    await connection.commit();

    await logAudit(null, (req as any).userId, 'CREATE', 'Tenant', tenantId, `Created tenant ${tenantId} via onboarding`, req.ip, req.get('User-Agent'), 'ONBOARDING');
    
    res.status(201).json({
      success: true,
      tenant: { id: tenantId, code: tenantCode },
      primaryAdmin: { id: userId, email: primaryAdmin.email }
    });

  } catch (err: any) {
    await connection.rollback();
    console.error('Error onboarding tenant:', err.message);
    
    if (err.message.startsWith('MISSING_TEMPLATE_SCOPE') || err.message.startsWith('MISSING_ADMIN_TEMPLATE')) {
       return res.status(500).json({ error: 'Configuration Error', details: err.message });
    }
    
    res.status(500).json({ error: 'Tenant onboarding failed. Please try again.', details: 'Internal Server Error' });
  } finally {
    connection.release();
  }
});

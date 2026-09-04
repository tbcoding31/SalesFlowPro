import { Router } from 'express';
import { pool } from '../db';
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
      
      await connection.query(`
        INSERT INTO roles (id, tenantId, name, description, isSystem, scope)
        VALUES (?, ?, ?, ?, 1, 'TENANT')
      `, [clonedRoleId, tenantId, tmpl.name, tmpl.description]);

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

    // Audit Log (without credentials)
    await connection.query(
      `INSERT INTO audit_logs (id, tenantId, userId, action, entity, entityId, description, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [`LOG-${Date.now()}`, null, (req as any).userId, 'CREATE', 'Tenant', tenantId, `Created tenant ${tenantId} via onboarding`]
    );

    await connection.commit();
    
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

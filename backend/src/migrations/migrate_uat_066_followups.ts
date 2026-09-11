import { pool } from '../db';

/**
 * UAT-FEATURE-066: Follow-up Feature Migration
 * 
 * Idempotent, deterministic, transactional migration for:
 * 1. Additive columns and indexes on `follow_ups`
 * 2. Status normalization: migrate legacy PENDING/SCHEDULED -> OPEN
 * 3. Additive columns (description, icon, color) on `follow_up_types`
 * 4. Create `follow_up_evidences` table for image verification
 * 5. Canonical platform blueprint templates (11 Follow-up Types)
 * 6. Tenant-scoped master data snapshots with platformMasterId provenance
 * 7. Menu item MENU-TNT-FOLLOWUPS in app_menus & role access
 * 8. Permissions in permissions & role_permissions
 */

export interface MigrationReport {
  success: boolean;
  legacyStatusMigrated: number;
  platformTypesSeeded: number;
  tenantsSnapshotted: number;
  menuCreated: boolean;
  permissionsSeeded: number;
}

export async function runUat066Migration(): Promise<MigrationReport> {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  const report: MigrationReport = {
    success: false,
    legacyStatusMigrated: 0,
    platformTypesSeeded: 0,
    tenantsSnapshotted: 0,
    menuCreated: false,
    permissionsSeeded: 0
  };

  try {
    console.log('=== STARTING UAT-FEATURE-066 FOLLOW-UPS MIGRATION ===');

    // ─────────────────────────────────────────────────────────────
    // 1. ADDITIVE SCHEMA ON `follow_ups`
    // ─────────────────────────────────────────────────────────────
    console.log('1. Checking and updating follow_ups columns...');
    const [fuCols]: any = await conn.query('DESCRIBE follow_ups');
    const fuColNames = fuCols.map((c: any) => c.Field);

    if (!fuColNames.includes('sourceType')) {
      await conn.query("ALTER TABLE follow_ups ADD COLUMN sourceType VARCHAR(50) NOT NULL DEFAULT 'MANUAL' AFTER relatedTaskId");
    }
    if (!fuColNames.includes('cancellationReason')) {
      await conn.query('ALTER TABLE follow_ups ADD COLUMN cancellationReason TEXT NULL AFTER outcome');
    }
    if (!fuColNames.includes('completedById')) {
      await conn.query('ALTER TABLE follow_ups ADD COLUMN completedById VARCHAR(50) NULL AFTER completedAt');
    }
    if (!fuColNames.includes('updatedAt')) {
      await conn.query('ALTER TABLE follow_ups ADD COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER createdAt');
    }

    // Add indexes on follow_ups
    const [fuIndexes]: any = await conn.query('SHOW INDEX FROM follow_ups');
    const fuIndexNames = new Set(fuIndexes.map((i: any) => i.Key_name));

    const desiredFuIndexes: Array<{ name: string; cols: string }> = [
      { name: 'idx_fu_tenant_customer', cols: 'tenantId, customerId' },
      { name: 'idx_fu_tenant_project', cols: 'tenantId, relatedProjectId' },
      { name: 'idx_fu_tenant_visit', cols: 'tenantId, relatedVisitId' },
      { name: 'idx_fu_tenant_task', cols: 'tenantId, relatedTaskId' },
      { name: 'idx_fu_tenant_status', cols: 'tenantId, status' },
      { name: 'idx_fu_tenant_date', cols: 'tenantId, followUpDate' },
      { name: 'idx_fu_tenant_pic', cols: 'tenantId, picId' },
      { name: 'idx_fu_tenant_type', cols: 'tenantId, typeId' }
    ];

    for (const idx of desiredFuIndexes) {
      if (!fuIndexNames.has(idx.name)) {
        await conn.query(`ALTER TABLE follow_ups ADD INDEX ${idx.name} (${idx.cols})`);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. MIGRATE LEGACY STATUSES: PENDING / SCHEDULED -> OPEN
    // ─────────────────────────────────────────────────────────────
    console.log('2. Migrating legacy PENDING and SCHEDULED statuses to OPEN...');
    const [statusMigrateRes]: any = await conn.query(`
      UPDATE follow_ups 
      SET status = 'OPEN' 
      WHERE status IN ('PENDING', 'SCHEDULED')
    `);
    report.legacyStatusMigrated = statusMigrateRes.affectedRows || 0;
    console.log(`   Migrated ${report.legacyStatusMigrated} follow-up rows to 'OPEN'.`);

    // ─────────────────────────────────────────────────────────────
    // 3. ADDITIVE COLUMNS ON `follow_up_types`
    // ─────────────────────────────────────────────────────────────
    console.log('3. Checking and updating follow_up_types columns...');
    const [futCols]: any = await conn.query('DESCRIBE follow_up_types');
    const futColNames = futCols.map((c: any) => c.Field);

    if (!futColNames.includes('description')) {
      await conn.query('ALTER TABLE follow_up_types ADD COLUMN description TEXT NULL AFTER name');
    }
    if (!futColNames.includes('icon')) {
      await conn.query('ALTER TABLE follow_up_types ADD COLUMN icon VARCHAR(50) NULL AFTER description');
    }
    if (!futColNames.includes('color')) {
      await conn.query('ALTER TABLE follow_up_types ADD COLUMN color VARCHAR(50) NULL AFTER icon');
    }

    // Ensure two-tier indexes
    const [futIndexes]: any = await conn.query('SHOW INDEX FROM follow_up_types');
    const futIndexNames = new Set(futIndexes.map((i: any) => i.Key_name));

    if (!futIndexNames.has('uq_follow_up_types_scope_code')) {
      await conn.query('ALTER TABLE follow_up_types ADD CONSTRAINT uq_follow_up_types_scope_code UNIQUE (masterScopeKey, code)');
    }
    if (!futIndexNames.has('idx_follow_up_types_tenant')) {
      await conn.query('ALTER TABLE follow_up_types ADD INDEX idx_follow_up_types_tenant (tenantId)');
    }

    // ─────────────────────────────────────────────────────────────
    // 4. CREATE `follow_up_evidences` TABLE
    // ─────────────────────────────────────────────────────────────
    console.log('4. Ensuring follow_up_evidences table exists...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS follow_up_evidences (
        id VARCHAR(50) PRIMARY KEY,
        tenantId VARCHAR(50) NOT NULL,
        followUpId VARCHAR(50) NOT NULL,
        fileName VARCHAR(255) NOT NULL,
        storageKey VARCHAR(255) NOT NULL,
        mimeType VARCHAR(100) NOT NULL,
        fileSize INT NOT NULL,
        caption VARCHAR(255) NULL,
        uploadedBy VARCHAR(50) NOT NULL,
        uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fue_tenant_followup (tenantId, followUpId),
        INDEX idx_fue_tenant (tenantId),
        INDEX idx_fue_storage (storageKey),
        CONSTRAINT fk_fue_follow_up FOREIGN KEY (followUpId) REFERENCES follow_ups (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ─────────────────────────────────────────────────────────────
    // 5. SEED 11 PLATFORM BLUEPRINT FOLLOW-UP TYPES
    // ─────────────────────────────────────────────────────────────
    console.log('5. Seeding canonical platform blueprint follow_up_types...');
    const canonicalPlatformTypes = [
      { id: 'FT-CALL', code: 'PHONE_CALL', name: 'Phone Call', description: 'Direct voice call with client', icon: 'call', color: '#3B82F6', displayOrder: 1 },
      { id: 'FT-WA', code: 'WHATSAPP', name: 'WhatsApp Chat', description: 'Messaging touchpoint via WhatsApp', icon: 'chat', color: '#10B981', displayOrder: 2 },
      { id: 'FT-MEET-OFF', code: 'MEETING_OFFLINE', name: 'Offline Meeting', description: 'In-person meeting at client location', icon: 'groups', color: '#6366F1', displayOrder: 3 },
      { id: 'FT-MEET-ON', code: 'MEETING_ONLINE', name: 'Online Meeting', description: 'Virtual conference (Zoom/Meet/Teams)', icon: 'video_call', color: '#8B5CF6', displayOrder: 4 },
      { id: 'FT-EMAIL', code: 'EMAIL', name: 'Email Correspondence', description: 'Formal email updates or inquiries', icon: 'mail', color: '#F59E0B', displayOrder: 5 },
      { id: 'FT-VISIT', code: 'VISIT', name: 'Site Visit', description: 'Field inspection or on-site survey', icon: 'directions_walk', color: '#EC4899', displayOrder: 6 },
      { id: 'FT-DOC', code: 'DOCUMENT_SENT', name: 'Document Delivery', description: 'Sending quotation, proposal, or invoice', icon: 'description', color: '#06B6D4', displayOrder: 7 },
      { id: 'FT-SMS', code: 'SMS', name: 'SMS Message', description: 'Short cellular text message', icon: 'sms', color: '#64748B', displayOrder: 8 },
      { id: 'FT-VID', code: 'VIDEO_CALL', name: 'Video Call', description: '1-on-1 direct video discussion', icon: 'videocam', color: '#14B8A6', displayOrder: 9 },
      { id: 'FT-SOC', code: 'SOCIAL_MEDIA', name: 'Social Media', description: 'Interaction via LinkedIn, Instagram, etc.', icon: 'share', color: '#F97316', displayOrder: 10 },
      { id: 'FT-OTHER', code: 'OTHER', name: 'Other Follow-up', description: 'Miscellaneous engagement activity', icon: 'more_horiz', color: '#6B7280', displayOrder: 11 }
    ];

    for (const item of canonicalPlatformTypes) {
      await conn.query(`
        INSERT INTO follow_up_types 
          (id, tenantId, sourceType, platformMasterId, code, name, description, icon, color, isActive, displayOrder)
        VALUES 
          (?, NULL, 'PLATFORM', NULL, ?, ?, ?, ?, ?, 1, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          description = VALUES(description),
          icon = VALUES(icon),
          color = VALUES(color),
          displayOrder = VALUES(displayOrder)
      `, [item.id, item.code, item.name, item.description, item.icon, item.color, item.displayOrder]);
    }
    report.platformTypesSeeded = canonicalPlatformTypes.length;

    // ─────────────────────────────────────────────────────────────
    // 6. SNAPSHOT FOLLOW-UP TYPES TO EXISTING TENANTS
    // ─────────────────────────────────────────────────────────────
    console.log('6. Snapshotting follow_up_types to existing tenants...');
    const [activeTenants]: any = await conn.query('SELECT id FROM tenants');
    let snapshottedCount = 0;

    for (const t of activeTenants) {
      const cleanT = t.id.replace(/[^a-zA-Z0-9]/g, '');
      const tPart = cleanT.length > 20 ? cleanT.substring(0, 20) : cleanT;

      for (const plat of canonicalPlatformTypes) {
        const tenantTypeId = `FT-${tPart}-${plat.id}`;
        await conn.query(`
          INSERT INTO follow_up_types
            (id, tenantId, sourceType, platformMasterId, code, name, description, icon, color, isActive, displayOrder)
          VALUES
            (?, ?, 'PLATFORM', ?, ?, ?, ?, ?, ?, 1, ?)
          ON DUPLICATE KEY UPDATE
            platformMasterId = COALESCE(platformMasterId, VALUES(platformMasterId))
        `, [tenantTypeId, t.id, plat.id, plat.code, plat.name, plat.description, plat.icon, plat.color, plat.displayOrder]);
      }
      snapshottedCount++;
    }
    report.tenantsSnapshotted = snapshottedCount;

    // ─────────────────────────────────────────────────────────────
    // 7. INSERT MENU `FOLLOW_UPS` & ASSIGN ROLE ACCESS
    // ─────────────────────────────────────────────────────────────
    console.log('7. Ensuring MENU-TNT-FOLLOWUPS in app_menus...');
    await conn.query(`
      INSERT INTO app_menus 
        (id, code, label, route, iconKey, parentId, menuScope, menuType, displayOrder, isActive, createdAt, updatedAt)
      VALUES
        ('MENU-TNT-FOLLOWUPS', 'FOLLOW_UPS', 'Follow-ups', '/followups', 'call', 'MENU-TNT-SALES', 'TENANT', 'ITEM', 250, 1, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        label = VALUES(label),
        route = VALUES(route),
        iconKey = VALUES(iconKey),
        parentId = VALUES(parentId),
        displayOrder = VALUES(displayOrder),
        isActive = 1,
        updatedAt = NOW()
    `);
    report.menuCreated = true;

    // Grant access to tenant roles in menu_role_access
    const tenantRoleCodes = ['TENANT_ADMIN', 'SALES_MANAGER', 'SUPERVISOR', 'SALES_REP'];
    for (const roleCode of tenantRoleCodes) {
      const accessId = `MRA-MENU-TNT-FOLLOWUPS-${roleCode}`;
      await conn.query(`
        INSERT INTO menu_role_access (id, menuId, roleCode, canView)
        VALUES (?, 'MENU-TNT-FOLLOWUPS', ?, 1)
        ON DUPLICATE KEY UPDATE canView = 1
      `, [accessId, roleCode]);
    }

    // ─────────────────────────────────────────────────────────────
    // 8. SEED FOLLOW-UP PERMISSIONS & ASSIGN TO ROLES
    // ─────────────────────────────────────────────────────────────
    console.log('8. Seeding follow-up permissions in permissions and role_permissions...');
    const permissionsToSeed = [
      { code: 'FOLLOW_UP_VIEW', name: 'View Follow-ups', module: 'FOLLOW_UPS' },
      { code: 'FOLLOW_UP_CREATE', name: 'Create Follow-ups', module: 'FOLLOW_UPS' },
      { code: 'FOLLOW_UP_UPDATE', name: 'Update Follow-ups', module: 'FOLLOW_UPS' },
      { code: 'FOLLOW_UP_COMPLETE', name: 'Complete Follow-ups', module: 'FOLLOW_UPS' },
      { code: 'FOLLOW_UP_CANCEL', name: 'Cancel Follow-ups', module: 'FOLLOW_UPS' },
      { code: 'FOLLOW_UP_EVIDENCE_UPLOAD', name: 'Upload Follow-up Evidence', module: 'FOLLOW_UPS' },
      { code: 'FOLLOW_UP_EVIDENCE_VIEW', name: 'View Follow-up Evidence', module: 'FOLLOW_UPS' },
      { code: 'FOLLOW_UP_EVIDENCE_DELETE', name: 'Delete Follow-up Evidence', module: 'FOLLOW_UPS' },
      { code: 'FOLLOW_UP_TYPE_MANAGE', name: 'Manage Follow-up Types', module: 'FOLLOW_UPS' }
    ];

    for (const p of permissionsToSeed) {
      const permId = `PERM-${p.code}`;
      await conn.query(`
        INSERT INTO permissions (id, code, name, module, isSystem, isTenantAssignable, status)
        VALUES (?, ?, ?, ?, 1, 1, 'ACTIVE')
        ON DUPLICATE KEY UPDATE name = VALUES(name), module = VALUES(module)
      `, [permId, p.code, p.name, p.module]);
    }
    report.permissionsSeeded = permissionsToSeed.length;

    // Grant all follow-up permissions to TENANT_ADMIN roles and templates
    const allFollowUpPerms = permissionsToSeed.map(p => p.code);
    const [adminRoles]: any = await conn.query(`
      SELECT id FROM roles 
      WHERE code = 'TENANT_ADMIN' OR id = 'TEMPLATE_TENANT_ADMIN'
    `);
    for (const r of adminRoles) {
      for (const perm of allFollowUpPerms) {
        await conn.query(`
          INSERT IGNORE INTO role_permissions (roleId, permission)
          VALUES (?, ?)
        `, [r.id, perm]);
      }
    }

    // Grant operational permissions to SALES_MANAGER, SUPERVISOR, SALES_REP
    const operationalPerms = [
      'FOLLOW_UP_VIEW',
      'FOLLOW_UP_CREATE',
      'FOLLOW_UP_UPDATE',
      'FOLLOW_UP_COMPLETE',
      'FOLLOW_UP_CANCEL',
      'FOLLOW_UP_EVIDENCE_UPLOAD',
      'FOLLOW_UP_EVIDENCE_VIEW'
    ];
    const [opsRoles]: any = await conn.query(`
      SELECT id FROM roles 
      WHERE code IN ('SALES_MANAGER', 'SUPERVISOR', 'SALES_REP')
         OR id IN ('TEMPLATE_SALES_MANAGER', 'TEMPLATE_SUPERVISOR', 'TEMPLATE_SALES_REP')
    `);
    for (const r of opsRoles) {
      for (const perm of operationalPerms) {
        await conn.query(`
          INSERT IGNORE INTO role_permissions (roleId, permission)
          VALUES (?, ?)
        `, [r.id, perm]);
      }
    }

    await conn.commit();
    report.success = true;
    console.log('=== UAT-FEATURE-066 FOLLOW-UPS MIGRATION COMPLETED SUCCESSFULLY ===\n');
    return report;
  } catch (err: any) {
    await conn.rollback();
    console.error('Migration UAT-FEATURE-066 failed, transaction rolled back:', err);
    throw err;
  } finally {
    conn.release();
  }
}

// Allow direct CLI execution: `node -r tsx src/migrations/migrate_uat_066_followups.ts`
if (require.main === module) {
  runUat066Migration()
    .then((report) => {
      console.log('Migration Result:', JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal Migration Error:', err);
      process.exit(1);
    });
}

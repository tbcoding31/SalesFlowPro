import { pool } from '../db';

/**
 * UAT-067: Scopes & Performance Indexes Migration
 * 
 * Idempotent, deterministic, transactional migration for:
 * 1. Additive column `createdById` VARCHAR(50) NULL on `follow_ups`
 * 2. Indexes on `follow_ups`:
 *    - (tenantId, createdById)
 *    - (tenantId, picId)
 *    - (tenantId, status)
 *    - (tenantId, followUpDate)
 * 3. Indexes on `activities`:
 *    - (tenantId, occurredAt)
 *    - (tenantId, userId, occurredAt)
 */

export interface MigrationUat067Report {
  success: boolean;
  columnAdded: boolean;
  createdByIdRowsNull: number;
  followUpIndexesAdded: string[];
  activityIndexesAdded: string[];
  totalRowsEvaluated: number;
}

export async function runUat067Migration(): Promise<MigrationUat067Report> {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  const report: MigrationUat067Report = {
    success: false,
    columnAdded: false,
    createdByIdRowsNull: 0,
    followUpIndexesAdded: [],
    activityIndexesAdded: [],
    totalRowsEvaluated: 0
  };

  try {
    console.log('=== STARTING UAT-067 SCOPES AND INDEXES MIGRATION ===');

    // ─────────────────────────────────────────────────────────────
    // 1. ADDITIVE SCHEMA ON `follow_ups`
    // ─────────────────────────────────────────────────────────────
    console.log('1. Checking and adding createdById on follow_ups...');
    const [fuCols]: any = await conn.query('DESCRIBE follow_ups');
    const fuColNames = fuCols.map((c: any) => c.Field);

    if (!fuColNames.includes('createdById')) {
      await conn.query('ALTER TABLE follow_ups ADD COLUMN createdById VARCHAR(50) NULL AFTER picId');
      report.columnAdded = true;
      console.log('  -> Added column createdById to follow_ups');
    } else {
      console.log('  -> Column createdById already exists on follow_ups');
    }

    // Count rows where createdById is NULL (preserving data integrity, never invent creators)
    const [fuCountRows]: any = await conn.query('SELECT COUNT(*) as total, SUM(CASE WHEN createdById IS NULL THEN 1 ELSE 0 END) as nullCount FROM follow_ups');
    report.totalRowsEvaluated = fuCountRows[0]?.total || 0;
    report.createdByIdRowsNull = fuCountRows[0]?.nullCount || 0;
    console.log(`  -> follow_ups total rows: ${report.totalRowsEvaluated}, with createdById NULL: ${report.createdByIdRowsNull}`);

    // ─────────────────────────────────────────────────────────────
    // 2. PERFORMANCE INDEXES ON `follow_ups`
    // ─────────────────────────────────────────────────────────────
    console.log('2. Checking and creating indexes on follow_ups...');
    const [fuIndexes]: any = await conn.query('SHOW INDEX FROM follow_ups');
    const existingFuIdx = new Set(fuIndexes.map((i: any) => i.Key_name));

    if (!existingFuIdx.has('idx_fu_tenant_creator')) {
      await conn.query('CREATE INDEX idx_fu_tenant_creator ON follow_ups (tenantId, createdById)');
      report.followUpIndexesAdded.push('idx_fu_tenant_creator');
      console.log('  -> Created index idx_fu_tenant_creator (tenantId, createdById)');
    }

    if (!existingFuIdx.has('idx_fu_tenant_pic')) {
      await conn.query('CREATE INDEX idx_fu_tenant_pic ON follow_ups (tenantId, picId)');
      report.followUpIndexesAdded.push('idx_fu_tenant_pic');
      console.log('  -> Created index idx_fu_tenant_pic (tenantId, picId)');
    }

    if (!existingFuIdx.has('idx_fu_tenant_status')) {
      await conn.query('CREATE INDEX idx_fu_tenant_status ON follow_ups (tenantId, status)');
      report.followUpIndexesAdded.push('idx_fu_tenant_status');
      console.log('  -> Created index idx_fu_tenant_status (tenantId, status)');
    }

    if (!existingFuIdx.has('idx_fu_tenant_date')) {
      await conn.query('CREATE INDEX idx_fu_tenant_date ON follow_ups (tenantId, followUpDate)');
      report.followUpIndexesAdded.push('idx_fu_tenant_date');
      console.log('  -> Created index idx_fu_tenant_date (tenantId, followUpDate)');
    }

    // ─────────────────────────────────────────────────────────────
    // 3. PERFORMANCE INDEXES ON `activities`
    // ─────────────────────────────────────────────────────────────
    console.log('3. Checking and creating indexes on activities...');
    const [actIndexes]: any = await conn.query('SHOW INDEX FROM activities');
    const existingActIdx = new Set(actIndexes.map((i: any) => i.Key_name));

    if (!existingActIdx.has('idx_activities_tenant_time')) {
      await conn.query('CREATE INDEX idx_activities_tenant_time ON activities (tenantId, occurredAt)');
      report.activityIndexesAdded.push('idx_activities_tenant_time');
      console.log('  -> Created index idx_activities_tenant_time (tenantId, occurredAt)');
    }

    if (!existingActIdx.has('idx_activities_tenant_user_time')) {
      await conn.query('CREATE INDEX idx_activities_tenant_user_time ON activities (tenantId, userId, occurredAt)');
      report.activityIndexesAdded.push('idx_activities_tenant_user_time');
      console.log('  -> Created index idx_activities_tenant_user_time (tenantId, userId, occurredAt)');
    }

    await conn.commit();
    report.success = true;
    console.log('=== UAT-067 MIGRATION COMPLETED SUCCESSFULLY ===');
    return report;
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed, rolled back:', err);
    throw err;
  } finally {
    conn.release();
  }
}

// Support direct execution via ts-node or node compiled file
if (require.main === module) {
  runUat067Migration()
    .then((rep) => {
      console.log('Migration Result:', JSON.stringify(rep, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration Fatal:', err);
      process.exit(1);
    });
}

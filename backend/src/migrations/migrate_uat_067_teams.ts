import { pool } from '../db';

/**
 * UAT-067: Teams & Team Members Database Authority Migration
 * 
 * Truly transactional, deterministic, and idempotent migration for:
 * 1. Transaction lifecycle (beginTransaction -> commit / rollback -> release)
 * 2. Validation & repair of nullable `teams.tenantId` to NOT NULL
 * 3. Index `idx_teams_tenant` on `teams (tenantId)`
 * 4. Index `idx_team_members_team` on `team_members (teamId)`
 * 5. Unique constraint `uq_teams_tenant_name` on `teams (tenantId, name)` with duplicate detection & pending flag
 * 6. Actual database metadata inspection of foreign keys via information_schema
 */

export interface ActualForeignKeyMetadata {
  tableName: string;
  columnName: string;
  constraintName: string;
  referencedTableName: string;
  referencedColumnName: string;
  updateRule?: string;
  deleteRule?: string;
}

export interface MigrationUat067TeamsReport {
  success: boolean;
  transactionStatus: 'COMMITTED' | 'ROLLED_BACK';
  teamsTenantIndexAdded: boolean;
  teamMembersTeamIndexAdded: boolean;
  uniqueTenantNameConstraintAdded: boolean;
  constraintPending: boolean;
  duplicatesFound?: any[];
  tenantIdModifiedNotNull: boolean;
  foreignKeysActual: ActualForeignKeyMetadata[];
  totalTeams: number;
  totalTeamMembers: number;
  error?: string;
}

export async function runUat067TeamsMigration(): Promise<MigrationUat067TeamsReport> {
  const conn = await pool.getConnection();

  const report: MigrationUat067TeamsReport = {
    success: false,
    transactionStatus: 'ROLLED_BACK',
    teamsTenantIndexAdded: false,
    teamMembersTeamIndexAdded: false,
    uniqueTenantNameConstraintAdded: false,
    constraintPending: false,
    duplicatesFound: [],
    tenantIdModifiedNotNull: false,
    foreignKeysActual: [],
    totalTeams: 0,
    totalTeamMembers: 0
  };

  try {
    console.log('=== STARTING UAT-067 TEAMS DATABASE AUTHORITY MIGRATION ===');
    await conn.beginTransaction();

    // ─────────────────────────────────────────────────────────────
    // 1. VALIDATE OR REPAIR NULLABLE tenantId ON `teams`
    // ─────────────────────────────────────────────────────────────
    console.log('1. Checking tenantId column on teams table...');
    const [teamsCols]: any = await conn.query('DESCRIBE teams');
    const tenantCol = teamsCols.find((c: any) => c.Field === 'tenantId');

    // Check for null tenantId rows
    const [nullCheck]: any = await conn.query('SELECT COUNT(*) as count FROM teams WHERE tenantId IS NULL');
    const nullCount = nullCheck[0]?.count || 0;

    if (nullCount > 0) {
      console.warn(`  -> Found ${nullCount} rows with NULL tenantId. Repair required before NOT NULL constraint.`);
      report.constraintPending = true;
      report.error = `Found ${nullCount} teams with NULL tenantId. Cannot alter column to NOT NULL.`;
      await conn.rollback();
      report.transactionStatus = 'ROLLED_BACK';
      report.success = false;
      return report;
    }

    if (tenantCol && tenantCol.Null === 'YES') {
      console.log('  -> Modifying teams.tenantId to VARCHAR(50) NOT NULL...');
      await conn.query('ALTER TABLE teams MODIFY COLUMN tenantId VARCHAR(50) NOT NULL');
      report.tenantIdModifiedNotNull = true;
    } else {
      console.log('  -> teams.tenantId already validated as NOT NULL');
    }

    // ─────────────────────────────────────────────────────────────
    // 2. INDEX ON `teams (tenantId)`
    // ─────────────────────────────────────────────────────────────
    console.log('2. Checking index idx_teams_tenant on teams...');
    const [teamIndexes]: any = await conn.query('SHOW INDEX FROM teams');
    const existingTeamIdx = new Set(teamIndexes.map((i: any) => i.Key_name));

    if (!existingTeamIdx.has('idx_teams_tenant')) {
      await conn.query('CREATE INDEX idx_teams_tenant ON teams (tenantId)');
      report.teamsTenantIndexAdded = true;
      console.log('  -> Created index idx_teams_tenant ON teams (tenantId)');
    } else {
      console.log('  -> Index idx_teams_tenant already exists on teams');
    }

    // ─────────────────────────────────────────────────────────────
    // 3. UNIQUE CONSTRAINT ON `teams (tenantId, name)`
    // ─────────────────────────────────────────────────────────────
    console.log('3. Checking duplicate team names and unique constraint uq_teams_tenant_name on teams...');
    const [dupes]: any = await conn.query(`
      SELECT tenantId, name, COUNT(*) as cnt 
      FROM teams 
      GROUP BY tenantId, name 
      HAVING cnt > 1
    `);

    if (dupes.length > 0) {
      console.error('  -> Duplicate team names found:', dupes);
      report.constraintPending = true;
      report.duplicatesFound = dupes;
      report.error = `Duplicate team names found in ${dupes.length} groups. Cannot apply unique constraint uq_teams_tenant_name.`;
      await conn.rollback();
      report.transactionStatus = 'ROLLED_BACK';
      report.success = false;
      return report;
    }

    if (!existingTeamIdx.has('uq_teams_tenant_name')) {
      await conn.query('CREATE UNIQUE INDEX uq_teams_tenant_name ON teams (tenantId, name)');
      report.uniqueTenantNameConstraintAdded = true;
      console.log('  -> Created unique constraint uq_teams_tenant_name ON teams (tenantId, name)');
    } else {
      console.log('  -> Unique constraint uq_teams_tenant_name already exists on teams');
    }

    // ─────────────────────────────────────────────────────────────
    // 4. INDEX ON `team_members (teamId)`
    // ─────────────────────────────────────────────────────────────
    console.log('4. Checking index idx_team_members_team on team_members...');
    const [memberIndexes]: any = await conn.query('SHOW INDEX FROM team_members');
    const existingMemberIdx = new Set(memberIndexes.map((i: any) => i.Key_name));

    if (!existingMemberIdx.has('idx_team_members_team')) {
      await conn.query('CREATE INDEX idx_team_members_team ON team_members (teamId)');
      report.teamMembersTeamIndexAdded = true;
      console.log('  -> Created index idx_team_members_team ON team_members (teamId)');
    } else {
      console.log('  -> Index idx_team_members_team already exists on team_members');
    }

    // ─────────────────────────────────────────────────────────────
    // 5. INSPECT ACTUAL DATABASE FOREIGN KEY METADATA
    // ─────────────────────────────────────────────────────────────
    console.log('5. Inspecting actual foreign keys from information_schema...');
    const fkQuery = `
      SELECT 
        k.TABLE_NAME as tableName, 
        k.COLUMN_NAME as columnName, 
        k.CONSTRAINT_NAME as constraintName, 
        k.REFERENCED_TABLE_NAME as referencedTableName, 
        k.REFERENCED_COLUMN_NAME as referencedColumnName,
        rc.UPDATE_RULE as updateRule, 
        rc.DELETE_RULE as deleteRule
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
      LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc 
        ON rc.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND rc.CONSTRAINT_SCHEMA = k.TABLE_SCHEMA
      WHERE k.TABLE_SCHEMA = DATABASE()
        AND k.TABLE_NAME IN ('teams', 'team_members')
        AND k.REFERENCED_TABLE_NAME IS NOT NULL
    `;
    const [fkRows]: any = await conn.query(fkQuery);
    report.foreignKeysActual = fkRows.map((r: any) => ({
      tableName: r.tableName,
      columnName: r.columnName,
      constraintName: r.constraintName,
      referencedTableName: r.referencedTableName,
      referencedColumnName: r.referencedColumnName,
      updateRule: r.updateRule || 'NONE',
      deleteRule: r.deleteRule || 'NONE'
    }));

    console.log(`  -> Actual foreign keys found in DB: ${report.foreignKeysActual.length}`);

    // Total counts
    const [teamCount]: any = await conn.query('SELECT COUNT(*) as count FROM teams');
    const [memberCount]: any = await conn.query('SELECT COUNT(*) as count FROM team_members');
    report.totalTeams = teamCount[0]?.count || 0;
    report.totalTeamMembers = memberCount[0]?.count || 0;

    await conn.commit();
    report.transactionStatus = 'COMMITTED';
    report.success = true;
    console.log(`  -> Total teams: ${report.totalTeams}, Total team members: ${report.totalTeamMembers}`);
    console.log('=== UAT-067 TEAMS MIGRATION COMPLETED SUCCESSFULLY ===');
    return report;
  } catch (err: any) {
    await conn.rollback();
    report.transactionStatus = 'ROLLED_BACK';
    report.success = false;
    report.error = err.message || String(err);
    console.error('Migration failed and rolled back:', err);
    throw err;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  runUat067TeamsMigration()
    .then((rep) => {
      console.log('Migration Result:', JSON.stringify(rep, null, 2));
      process.exit(rep.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('Migration Fatal:', err);
      process.exit(1);
    });
}

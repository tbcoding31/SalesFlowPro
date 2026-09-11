import { pool } from '../db';

/**
 * Migration: User Profile & Security Fields
 * 
 * Note on MariaDB/MySQL DDL Semantics:
 * In MySQL and MariaDB, DDL operations such as ALTER TABLE cause an implicit commit
 * of any open transaction. Therefore, a standard BEGIN TRANSACTION ... ROLLBACK cannot
 * rollback completed ALTER statements.
 * 
 * To guarantee idempotency and safety without risk of DDL failures:
 * 1. We inspect `information_schema.COLUMNS` before performing any ALTER operation.
 * 2. Each column is added only if it does not already exist.
 * 3. The `avatar` column length is inspected and expanded to VARCHAR(500) only if currently smaller.
 * 4. Existing data is completely preserved.
 * 5. The migration can be safely re-run multiple times with identical, idempotent results.
 */

export async function migrateUserProfileSecurity() {
  console.log('[MIGRATION] Starting migrateUserProfileSecurity...');
  const connection = await pool.getConnection();

  try {
    // 1. Get existing columns of table `users`
    const [columns]: any = await connection.query(`
      SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH, DATA_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
    `);

    const colMap = new Map<string, any>();
    for (const c of columns) {
      colMap.set(c.COLUMN_NAME.toLowerCase(), c);
    }

    // 2. Add `phone` if missing
    if (!colMap.has('phone')) {
      console.log('[MIGRATION] Adding column `phone` to `users`...');
      await connection.query(`ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL`);
      console.log('[MIGRATION] Added `phone` successfully.');
    } else {
      console.log('[MIGRATION] Column `phone` already exists.');
    }

    // 3. Add `location` if missing
    if (!colMap.has('location')) {
      console.log('[MIGRATION] Adding column `location` to `users`...');
      await connection.query(`ALTER TABLE users ADD COLUMN location VARCHAR(100) NULL`);
      console.log('[MIGRATION] Added `location` successfully.');
    } else {
      console.log('[MIGRATION] Column `location` already exists.');
    }

    // 4. Add `timezone` if missing
    if (!colMap.has('timezone')) {
      console.log('[MIGRATION] Adding column `timezone` to `users`...');
      await connection.query(`ALTER TABLE users ADD COLUMN timezone VARCHAR(50) NULL`);
      console.log('[MIGRATION] Added `timezone` successfully.');
    } else {
      console.log('[MIGRATION] Column `timezone` already exists.');
    }

    // 5. Add `passwordChangedAt` if missing
    if (!colMap.has('passwordchangedat')) {
      console.log('[MIGRATION] Adding column `passwordChangedAt` to `users`...');
      await connection.query(`ALTER TABLE users ADD COLUMN passwordChangedAt DATETIME NULL`);
      console.log('[MIGRATION] Added `passwordChangedAt` successfully.');
    } else {
      console.log('[MIGRATION] Column `passwordChangedAt` already exists.');
    }

    // 6. Check and expand `avatar` column if needed
    const avatarCol = colMap.get('avatar');
    if (avatarCol) {
      const maxLen = avatarCol.CHARACTER_MAXIMUM_LENGTH;
      if (maxLen && maxLen < 500) {
        console.log(`[MIGRATION] Expanding column \`avatar\` from ${maxLen} to VARCHAR(500)...`);
        await connection.query(`ALTER TABLE users MODIFY COLUMN avatar VARCHAR(500) NULL`);
        console.log('[MIGRATION] Expanded `avatar` successfully.');
      } else {
        console.log(`[MIGRATION] Column \`avatar\` length is already ${maxLen || 'sufficient'}.`);
      }
    }

    console.log('[MIGRATION] migrateUserProfileSecurity finished successfully.');
    return { success: true };
  } catch (err: any) {
    console.error('[MIGRATION] Error in migrateUserProfileSecurity:', err);
    throw err;
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  migrateUserProfileSecurity()
    .then(() => {
      console.log('[MIGRATION] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[MIGRATION] Failed:', err);
      process.exit(1);
    });
}

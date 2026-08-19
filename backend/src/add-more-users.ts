import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { env } from './env';

async function seedMissingUsers() {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  try {
    const tenantId = 'TEN-00001';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Password123', salt);

    // 1. Seed the missing roles first
    await pool.query(`INSERT IGNORE INTO roles (id, tenantId, name, description, isSystem) VALUES (?, ?, ?, ?, ?)`, 
      ['SALES_MANAGER', tenantId, 'SALES_MANAGER', 'Sales Manager', true]);
    await pool.query(`INSERT IGNORE INTO roles (id, tenantId, name, description, isSystem) VALUES (?, ?, ?, ?, ?)`, 
      ['SUPERVISOR', tenantId, 'SUPERVISOR', 'Supervisor', true]);

    // 2. Seed missing users
    const usersToInsert = [
      { id: 'USR-003', email: 'manager@technova.com', name: 'Sales Manager', roleId: 'SALES_MANAGER' },
      { id: 'USR-004', email: 'supervisor@technova.com', name: 'Sales Supervisor', roleId: 'SUPERVISOR' },
      { id: 'USR-005', email: 'sales2@technova.com', name: 'Sales Rep 2', roleId: 'SALES_REPRESENTATIVE' },
    ];

    for (let i = 0; i < usersToInsert.length; i++) {
      const u = usersToInsert[i];
      const tuId = `TU-00${i+3}`;
      const turId = `TUR-00${i+3}`;
      
      // insert into users
      await pool.query(`INSERT IGNORE INTO users (id, email, name, passwordHash, status) VALUES (?, ?, ?, ?, ?)`, 
        [u.id, u.email, u.name, hashedPassword, 'ACTIVE']);
      
      // insert into tenant_users
      await pool.query(`INSERT IGNORE INTO tenant_users (id, tenantId, userId, isPrimary, status) VALUES (?, ?, ?, ?, ?)`,
        [tuId, tenantId, u.id, true, 'ACTIVE']);
        
      // insert into tenant_user_roles
      await pool.query(`INSERT IGNORE INTO tenant_user_roles (id, tenantUserId, roleId) VALUES (?, ?, ?)`,
        [turId, tuId, u.roleId]);
    }

    console.log('Missing roles and users added successfully.');
  } catch (err) {
    console.error('Error adding users:', err);
  } finally {
    await pool.end();
  }
}

seedMissingUsers();

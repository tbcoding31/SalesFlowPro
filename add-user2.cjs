const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function run() {
  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: 'Kontolloyo90909!@#', database: 'db_salesflow_pro' });
  
  // Get tenant ID for TechNova Corp
  const [tenants] = await pool.query('SELECT id FROM tenants WHERE name LIKE "%TechNova%" LIMIT 1');
  const tenantId = tenants.length > 0 ? tenants[0].id : 'TEN-00001';
  
  const id = 'USR-' + Date.now();
  const email = 'tenantadmin@technova.com';
  const name = 'New Tenant Admin';
  const passwordHash = await bcrypt.hash('Password123', 10);
  
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    // 1. Insert into users
    await connection.query(
      'INSERT INTO users (id, email, name, passwordHash, status) VALUES (?, ?, ?, ?, ?)',
      [id, email, name, passwordHash, 'ACTIVE']
    );
    
    // 2. Insert into tenant_users
    const tenantUserId = 'TU-' + Date.now();
    await connection.query(
      'INSERT INTO tenant_users (id, tenantId, userId, isPrimary, status) VALUES (?, ?, ?, ?, ?)',
      [tenantUserId, tenantId, id, 1, 'ACTIVE']
    );
    
    // 3. Insert into tenant_user_roles
    const tenantUserRoleId = 'TUR-' + Date.now();
    await connection.query(
      'INSERT INTO tenant_user_roles (id, tenantUserId, roleId) VALUES (?, ?, ?)',
      [tenantUserRoleId, tenantUserId, 'TENANT_ADMIN']
    );
    
    await connection.commit();
    console.log('Successfully created user: ' + email);
  } catch (err) {
    await connection.rollback();
    console.error('Failed to create user:', err);
  } finally {
    connection.release();
  }
  
  pool.end();
}
run();

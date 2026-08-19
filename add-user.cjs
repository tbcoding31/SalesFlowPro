const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function run() {
  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: 'Kontolloyo90909!@#', database: 'db_salesflow_pro' });
  
  // Get tenant ID for TechNova Corp
  const [tenants] = await pool.query('SELECT id FROM tenants WHERE name LIKE "%TechNova%" LIMIT 1');
  const tenantId = tenants.length > 0 ? tenants[0].id : 'TEN-00001';
  
  // Generate ID and hash password
  const id = 'USR-' + Date.now();
  const email = 'newadmin@technova.com';
  const name = 'New Tenant Admin';
  const roleId = 'TENANT_ADMIN';
  const passwordHash = await bcrypt.hash('Password123', 10);
  
  try {
    await pool.query(
      'INSERT INTO users (id, email, name, passwordHash, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, email, name, passwordHash, roleId, tenantId, 'ACTIVE']
    );
    console.log('User created:', email);
  } catch (err) {
    console.error('Failed to create user:', err);
  }
  
  pool.end();
}
run();

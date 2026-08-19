const mysql = require('mysql2/promise');

async function run() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Kontolloyo90909!@#',
    database: 'db_salesflow_pro'
  });

  try {
    console.log("Checking if columns exist in tenants table...");
    const [cols] = await pool.query('SHOW COLUMNS FROM tenants');
    const colNames = cols.map(c => c.Field);
    
    if (!colNames.includes('type')) {
      await pool.query('ALTER TABLE tenants ADD COLUMN type VARCHAR(50) DEFAULT "BASIC"');
      console.log("Added column type");
    }
    if (!colNames.includes('trialEndDate')) {
      await pool.query('ALTER TABLE tenants ADD COLUMN trialEndDate DATETIME');
      console.log("Added column trialEndDate");
    }
    if (!colNames.includes('email')) {
      await pool.query('ALTER TABLE tenants ADD COLUMN email VARCHAR(255)');
    }
    if (!colNames.includes('industry')) {
      await pool.query('ALTER TABLE tenants ADD COLUMN industry VARCHAR(100)');
    }
    if (!colNames.includes('phone')) {
      await pool.query('ALTER TABLE tenants ADD COLUMN phone VARCHAR(50)');
    }
    
    // Create new Tenant
    const tenantId = 'TEN-TRIAL-1';
    const tenantName = 'Expired Trial Company';
    // expired date 1 month ago
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 1);
    const dateStr = pastDate.toISOString().slice(0, 19).replace('T', ' ');

    console.log("Inserting Tenant...");
    await pool.query(`
      INSERT INTO tenants (id, name, code, status, type, trialEndDate, email, industry)
      VALUES (?, ?, 'EXP', 'ACTIVE', 'TRIAL', ?, 'contact@expiredtrial.com', 'Technology')
      ON DUPLICATE KEY UPDATE type='TRIAL', trialEndDate=?
    `, [tenantId, tenantName, dateStr, dateStr]);

    // Create User for this Tenant
    const userId = 'USR-TRIAL-1';
    const email = 'admin@expiredtrial.com';
    const password = 'Password123'; // Not hashed here, but maybe we should hash it or mock the login
    // wait, I need to hash the password properly using bcrypt if backend uses it.
    // the backend uses bcrypt. I can require bcrypt in this script or let's just use what seed script uses.
    
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);
    
    console.log("Inserting User...");
    await pool.query(`
      INSERT INTO users (id, email, passwordHash, name, status, lastLoginAt)
      VALUES (?, ?, ?, 'Trial Admin', 'ACTIVE', NOW())
      ON DUPLICATE KEY UPDATE passwordHash=?
    `, [userId, email, hash, hash]);

    // Create tenant_users
    const tuId = 'TU-TRIAL-1';
    await pool.query(`
      INSERT INTO tenant_users (id, tenantId, userId, isPrimary, status)
      VALUES (?, ?, ?, true, 'ACTIVE')
      ON DUPLICATE KEY UPDATE tenantId=tenantId
    `, [tuId, tenantId, userId]);

    // Role ID for TENANT_ADMIN might be ROL-00002
    // Let's check roles
    const [roles] = await pool.query('SELECT id FROM roles WHERE name="TENANT_ADMIN"');
    const roleId = roles.length > 0 ? roles[0].id : 'ROL-00002'; // fallback

    await pool.query(`
      INSERT INTO tenant_user_roles (id, tenantUserId, roleId)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE roleId=roleId
    `, ['TUR-TRIAL-1', tuId, roleId]);

    console.log("Successfully registered tenant and user.");
    console.log("Tenant: ", tenantName);
    console.log("User: ", email);
    console.log("Password: ", password);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();

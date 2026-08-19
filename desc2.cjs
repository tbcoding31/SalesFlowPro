const mysql = require('mysql2/promise');
async function run() {
  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: 'Kontolloyo90909!@#', database: 'db_salesflow_pro' });
  const [tu] = await pool.query('DESCRIBE tenant_users');
  console.log('tenant_users:', tu);
  const [tur] = await pool.query('DESCRIBE tenant_user_roles');
  console.log('tenant_user_roles:', tur);
  pool.end();
}
run();

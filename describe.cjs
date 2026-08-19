const mysql = require('mysql2/promise');
async function run() {
  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: 'Kontolloyo90909!@#', database: 'db_salesflow_pro' });
  const [rows] = await pool.query('DESCRIBE users');
  console.log(rows);
  pool.end();
}
run();

import mysql from 'mysql2/promise';
import { env } from './env';

async function updatePasswords() {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  try {
    await pool.query(
      'UPDATE users SET passwordHash = ? WHERE id IN (?, ?)',
      ['Password123', 'USR-001', 'USR-002']
    );
    console.log('Passwords updated successfully for USR-001 and USR-002.');
  } catch (err) {
    console.error('Error updating passwords:', err);
  } finally {
    await pool.end();
  }
}

updatePasswords();

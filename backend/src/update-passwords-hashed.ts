import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
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
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Password123', salt);
    
    await pool.query(
      'UPDATE users SET passwordHash = ? WHERE id IN (?, ?, ?)',
      [hashedPassword, 'USR-000', 'USR-001', 'USR-002']
    );
    console.log('Passwords successfully hashed and updated for Super Admin, Admin, and Sales Rep.');
  } catch (err) {
    console.error('Error updating passwords:', err);
  } finally {
    await pool.end();
  }
}

updatePasswords();

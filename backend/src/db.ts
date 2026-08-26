import mysql from 'mysql2/promise';
import { env } from './env';

// Create an authoritative connection pool to MySQL configured explicitly with Asia/Jakarta (+07:00) timezone
export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  timezone: '+07:00',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

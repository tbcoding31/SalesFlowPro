import mysql from 'mysql2/promise';
import { env } from './env';

async function dropDb() {
  const baseConn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  });
  await baseConn.query(`DROP DATABASE IF EXISTS \`${env.DB_NAME}\``);
  console.log(`Database '${env.DB_NAME}' dropped.`);
  await baseConn.end();
}
dropDb().catch(console.error);

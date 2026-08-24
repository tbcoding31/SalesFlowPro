import dotenv from 'dotenv';
import path from 'path';

// Force dotenv to load from root and backend to ensure no missing vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dbName = process.env.DB_NAME;
if (!dbName || dbName !== 'db_salesflow_pro' && dbName !== 'db_salesflow_pro_test') {
  console.error(`[Startup Error] DB_NAME is required and must be db_salesflow_pro. Current value: ${dbName}`);
  process.exit(1);
}

export const env = {
  PORT: process.env.PORT || 5000,
  DB_HOST: process.env.DB_HOST || '127.0.0.1',
  DB_PORT: Number(process.env.DB_PORT) || 3306,
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: dbName,
};

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { env } from './env';

async function seedExactUsers() {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  try {
    const tenantId = 'TEN-00001';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Password123', salt);

    // Roles to add if not exist
    await pool.query(`INSERT IGNORE INTO roles (id, tenantId, name, description, isSystem) VALUES (?, ?, ?, ?, ?)`, 
      ['EXECUTIVE', tenantId, 'EXECUTIVE', 'Executive', true]);
    await pool.query(`INSERT IGNORE INTO roles (id, tenantId, name, description, isSystem) VALUES (?, ?, ?, ?, ?)`, 
      ['OPERATIONS', tenantId, 'OPERATIONS', 'Operations', true]);

    const usersToInsert = [
      { id: 'USR-IMG-1', email: 'ahmad.ricky@salesflow.pro', name: 'Ahmad Ricky', roleId: 'TENANT_ADMIN', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e' },
      { id: 'USR-IMG-2', email: 'sarah.j@salesflow.co', name: 'Sarah Jenkins', roleId: 'EXECUTIVE', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330' },
      { id: 'USR-IMG-3', email: 'm.rodriguez@salesflow.co', name: 'Michael Rodriguez', roleId: 'SALES_REPRESENTATIVE', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e' },
      { id: 'USR-IMG-4', email: 'dewi.l@salesflow.co', name: 'Dewi Lestari', roleId: 'SALES_REPRESENTATIVE', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80' },
      { id: 'USR-IMG-5', email: 'budi.s@salesflow.co', name: 'Budi Santoso', roleId: 'SALES_REPRESENTATIVE', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d' },
      { id: 'USR-IMG-6', email: 'e.chen@salesflow.co', name: 'Emily Chen', roleId: 'OPERATIONS', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9' }
    ];

    for (let i = 0; i < usersToInsert.length; i++) {
      const u = usersToInsert[i];
      const tuId = `TU-IMG-${i+1}`;
      const turId = `TUR-IMG-${i+1}`;
      
      // insert into users
      await pool.query(`INSERT IGNORE INTO users (id, email, name, passwordHash, status, avatar) VALUES (?, ?, ?, ?, ?, ?)`, 
        [u.id, u.email, u.name, hashedPassword, 'ACTIVE', u.avatar]);
      
      // insert into tenant_users
      await pool.query(`INSERT IGNORE INTO tenant_users (id, tenantId, userId, isPrimary, status) VALUES (?, ?, ?, ?, ?)`,
        [tuId, tenantId, u.id, true, 'ACTIVE']);
        
      // insert into tenant_user_roles
      await pool.query(`INSERT IGNORE INTO tenant_user_roles (id, tenantUserId, roleId) VALUES (?, ?, ?)`,
        [turId, tuId, u.roleId]);
    }

    console.log('Exact image users added successfully.');
  } catch (err) {
    console.error('Error adding users:', err);
  } finally {
    await pool.end();
  }
}

seedExactUsers();

import { Router } from 'express';
import { pool } from '../db';

export const systemRoutes = Router();

// AUDIT LOGS
systemRoutes.get('/audit-logs', async (req: any, res: any) => {
  const actorRole = req.userRole;
  if (actorRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access denied. Super Admin required.' });
  }

  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 25;
  const search = req.query.search || '';
  const offset = (page - 1) * pageSize;

  try {
    let whereClause = '1=1';
    let params: any[] = [];

    if (search) {
      whereClause += ' AND (a.description LIKE ? OR a.action LIKE ? OR a.entity LIKE ? OR a.entityId LIKE ?)';
      const likeQuery = `%${search}%`;
      params.push(likeQuery, likeQuery, likeQuery, likeQuery);
    }

    const [rows]: any = await pool.query(`
      SELECT a.id, a.tenantId, a.userId, a.action, a.module, a.entity, a.entityId, a.description, a.ipAddress, a.timestamp,
        u.name as userName, u.email as userEmail, t.name as tenantName
      FROM audit_logs a
      LEFT JOIN users u ON a.userId = u.id
      LEFT JOIN tenants t ON a.tenantId = t.id
      WHERE ${whereClause}
      ORDER BY a.timestamp DESC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);

    const [countRows]: any = await pool.query(`
      SELECT COUNT(*) as total
      FROM audit_logs a
      WHERE ${whereClause}
    `, params);

    res.json({
      items: rows,
      totalCount: countRows[0].total,
      page,
      pageSize,
      totalPages: Math.ceil(countRows[0].total / pageSize)
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SETTINGS
systemRoutes.get('/settings', async (req: any, res: any) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM system_settings');
    const settings: any = {};
    for (const row of rows) {
      if (row.valueType === 'boolean') settings[row.settingKey] = row.settingValue === 'true';
      else if (row.valueType === 'number') settings[row.settingKey] = Number(row.settingValue);
      else settings[row.settingKey] = row.settingValue;
    }
    res.json(settings);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

systemRoutes.put('/settings', async (req: any, res: any) => {
  const actorRole = req.userRole;
  if (actorRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access denied. Super Admin required.' });
  }

  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    const allowedKeys: Record<string, { type: string, category: string }> = {
      appName: { type: 'string', category: 'general' },
      timezone: { type: 'string', category: 'general' },
      dateFormat: { type: 'string', category: 'general' },
      currency: { type: 'string', category: 'general' },
      supportEmail: { type: 'string', category: 'application' },
      language: { type: 'string', category: 'application' },
      maintenanceMode: { type: 'boolean', category: 'application' },
      defaultTaskPriority: { type: 'string', category: 'sales' },
      defaultVisitDuration: { type: 'number', category: 'sales' },
      projectAutoClose: { type: 'boolean', category: 'sales' },
      emailAlerts: { type: 'boolean', category: 'notifications' },
      pushNotifications: { type: 'boolean', category: 'notifications' },
      dailyDigest: { type: 'boolean', category: 'notifications' },
      sessionTimeout: { type: 'number', category: 'security' },
      requireUppercase: { type: 'boolean', category: 'security' },
      requireNumbers: { type: 'boolean', category: 'security' },
      requireSpecialChars: { type: 'boolean', category: 'security' },
      mfaEnabled: { type: 'boolean', category: 'security' },
      retentionDays: { type: 'number', category: 'audit' },
      logVisits: { type: 'boolean', category: 'audit' },
      logProjects: { type: 'boolean', category: 'audit' },
      logLogins: { type: 'boolean', category: 'audit' }
    };

    for (const key of Object.keys(updates)) {
      if (!allowedKeys[key]) continue;
      const def = allowedKeys[key];
      const val = updates[key];
      
      let strVal = String(val);
      if (def.type === 'boolean') strVal = val ? 'true' : 'false';
      
      await pool.query(
        'INSERT INTO system_settings (settingKey, settingValue, category, valueType) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE settingValue = ?',
        [key, strVal, def.category, def.type, strVal]
      );
    }
    
    // Create Audit Log
    await pool.query(
      `INSERT INTO audit_logs (id, tenantId, userId, action, module, entity, description, timestamp) VALUES (?, NULL, ?, ?, ?, ?, ?, NOW())`,
      [`LOG-${Date.now()}`, req.userId, 'UPDATE', 'System Settings', 'System Settings', `Updated platform settings`]
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

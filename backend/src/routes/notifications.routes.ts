import { Router } from 'express';
import { pool } from '../db';

export const notificationsRoutes = Router();

notificationsRoutes.get('/', async (req: any, res: any) => {
  const actorUserId = req.userId;
  const actorTenantId = req.userTenantId;

  try {
    let query = 'SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50';
    const [rows]: any = await pool.query(query, [actorUserId]);
    res.json(rows);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

notificationsRoutes.get('/unread-count', async (req: any, res: any) => {
  const actorUserId = req.userId;

  try {
    const [rows]: any = await pool.query('SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND isRead = 0', [actorUserId]);
    res.json({ count: rows[0].count });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

notificationsRoutes.put('/:id/read', async (req: any, res: any) => {
  const actorUserId = req.userId;
  const id = req.params.id;

  try {
    await pool.query('UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?', [id, actorUserId]);
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

notificationsRoutes.put('/read-all', async (req: any, res: any) => {
  const actorUserId = req.userId;

  try {
    await pool.query('UPDATE notifications SET isRead = 1 WHERE userId = ? AND isRead = 0', [actorUserId]);
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

import { Router } from 'express';
export const authRoutes = Router();
authRoutes.get('/me', (req, res) => res.status(401).json({ error: 'UNAUTHORIZED' }));
authRoutes.post('/login', (req, res) => res.status(200).json({ success: true }));

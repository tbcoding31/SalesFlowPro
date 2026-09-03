import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env';

import { authRoutes } from './routes/auth.routes';
import { analyticsRoutes } from './routes/analytics.routes';
import { customersRoutes } from './routes/customers.routes';
import { projectsRoutes } from './routes/projects.routes';
import { tasksRoutes } from './routes/tasks.routes';
import { visitsRoutes } from './routes/visits.routes';
import { followupsRoutes } from './routes/followups.routes';
import { timelineRoutes } from './routes/timeline.routes';
import { syncRoutes } from './routes/sync.routes';
import { genericRoutes } from './routes/generic.routes';
import { salesRoutes } from './routes/sales.routes';
import { managementRoutes } from './routes/management.routes';

import { authMiddleware } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.status(200).send('OK'));

app.use('/api/auth', authRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/customers', authMiddleware, tenantMiddleware, customersRoutes);
app.use('/api/projects', authMiddleware, tenantMiddleware, projectsRoutes);
app.use('/api/tasks', authMiddleware, tenantMiddleware, tasksRoutes);
app.use('/api/visits', authMiddleware, tenantMiddleware, visitsRoutes);
app.use('/api/followups', authMiddleware, tenantMiddleware, followupsRoutes);
app.use('/api/timeline', authMiddleware, tenantMiddleware, timelineRoutes);
app.use('/api/sync', authMiddleware, tenantMiddleware, syncRoutes);
app.use('/api/sales', authMiddleware, tenantMiddleware, salesRoutes);
app.use('/api/management', authMiddleware, tenantMiddleware, managementRoutes);
app.use('/api', authMiddleware, genericRoutes);

if (require.main === module) {
  const port = env.PORT || 5000;
  app.listen(port, () => {
    console.log('Server listening on port ' + port);
  });
}

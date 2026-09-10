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
import { masterDataRoutes } from './routes/master_data.routes';
import { systemRoutes } from './routes/system.routes';
import { integrationsRoutes } from './routes/integrations.routes';
import { notificationsRoutes } from './routes/notifications.routes';
import { salesRoutes } from './routes/sales.routes';
import { managementRoutes } from './routes/management.routes';
import { tenantsRoutes } from './routes/tenants.routes';
import { usersRoutes } from './routes/users.routes';
import { rolesRoutes } from './routes/roles.routes';
import { permissionsRoutes } from './routes/permissions.routes';
import { teamsRoutes } from './routes/teams.routes';
import { tenantUsersRoutes } from './routes/tenant_users.routes';
import { onboardingRoutes } from './routes/onboarding.routes';
import { navigationRoutes } from './routes/navigation.routes';
import { platformMenusRoutes } from './routes/platformMenus.routes';
import { reportsRoutes } from './routes/reports.routes';
import { interventionPoliciesRoutes, tenantAnalyticsSettingsRoutes } from './routes/intervention_policies.routes';
import { startVisitReminderScheduler } from './workers/visitReminder.worker';

import { authMiddleware } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';

export const app = express();

// Trust the immediate reverse proxy for correct client IP
app.set('trust proxy', 1);


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
app.use('/api/follow_ups', authMiddleware, tenantMiddleware, followupsRoutes);
app.use('/api/timeline', authMiddleware, tenantMiddleware, timelineRoutes);
app.use('/api/sync', authMiddleware, tenantMiddleware, syncRoutes);
app.use('/api/sales', authMiddleware, tenantMiddleware, salesRoutes);
app.use('/api/management', authMiddleware, tenantMiddleware, managementRoutes);
app.use('/api/onboarding', authMiddleware, onboardingRoutes);
app.use('/api/users', authMiddleware, usersRoutes);
app.use('/api/roles', authMiddleware, rolesRoutes);
app.use('/api/permissions', authMiddleware, permissionsRoutes);
app.use('/api/teams', authMiddleware, teamsRoutes);
app.use('/api/tenant/users', authMiddleware, tenantUsersRoutes);
app.use('/api/tenant/project-intervention-policies', authMiddleware, tenantMiddleware, interventionPoliciesRoutes);
app.use('/api/tenant/analytics-settings', authMiddleware, tenantMiddleware, tenantAnalyticsSettingsRoutes);
app.use('/api/tenants', authMiddleware, tenantsRoutes);
app.use('/api', authMiddleware, genericRoutes);
app.use('/api/master-data', authMiddleware, masterDataRoutes);
app.use('/api/system/integrations', authMiddleware, integrationsRoutes);
app.use('/api/system', authMiddleware, systemRoutes);
app.use('/api/notifications', authMiddleware, notificationsRoutes);
app.use('/api/navigation', authMiddleware, navigationRoutes);
app.use('/api/platform/menus', authMiddleware, platformMenusRoutes);
app.use('/api/reports', authMiddleware, tenantMiddleware, reportsRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint Not Found', path: req.originalUrl }));

app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

if (require.main === module) {
  const port = env.PORT || 5000;
  app.listen(port, () => {
    console.log('Server listening on port ' + port);
    startVisitReminderScheduler();
  });
}

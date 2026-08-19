import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { Agentation } from 'agentation';
import { SyncService } from './services/syncService';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';

// Admin Pages
import { SuperAdminDashboard } from './pages/admin/SuperAdminDashboard';
import { TenantsListPage } from './pages/admin/TenantsListPage';
import { TenantDetailPage } from './pages/admin/TenantDetailPage';
import { CreateTenantPage } from './pages/admin/CreateTenantPage';
import { TenantUsersPage } from './pages/admin/TenantUsersPage';
import { CreateTenantUserPage } from './pages/admin/CreateTenantUserPage';
import { RolesPermissionsPage } from './pages/admin/RolesPermissionsPage';
import { MasterDataPage } from './pages/admin/MasterDataPage';

// Sales CRM Pages
import { TeamDashboard } from './pages/dashboard/TeamDashboard';
import { SalesDashboard } from './pages/dashboard/SalesDashboard';
import { CustomersListPage } from './pages/customers/CustomersListPage';
import { CustomerDetailPage } from './pages/customers/CustomerDetailPage';
import { CreateCustomerPage } from './pages/customers/CreateCustomerPage';
import { EditCustomerPage } from './pages/customers/EditCustomerPage';
import { VisitsPage } from './pages/visits/VisitsPage';
import { CreateVisitPage } from './pages/visits/CreateVisitPage';
import { VisitDetailPage } from './pages/visits/VisitDetailPage';
import { VisitReportPage } from './pages/visits/VisitReportPage';
import { CreateTaskPage } from './pages/tasks/CreateTaskPage';
import { EditTaskPage } from './pages/tasks/EditTaskPage';
import { TasksPage } from './pages/tasks/TasksPage';
import { TeamTasksPage } from './pages/tasks/TeamTasksPage';
import { TaskBoardPage } from './pages/tasks/TaskBoardPage';
import { TaskDetailPage } from './pages/tasks/TaskDetailPage';
import { FollowupsPage } from './pages/followups/FollowupsPage';
import { FollowupDetailPage } from './pages/followups/FollowupDetailPage';
import { ProjectsPage } from './pages/projects/ProjectsPage';
import { CreateProjectPage } from './pages/projects/CreateProjectPage';
import { ProjectDetailPage } from './pages/projects/ProjectDetailPage';
import { ActivitiesPage } from './pages/activities/ActivitiesPage';
import { ActivityDetailPage } from './pages/activities/ActivityDetailPage';
import { TargetsPage } from './pages/targets/TargetsPage';
import { PerformancePage } from './pages/performance/PerformancePage';
import { VisitsReportPage } from './pages/reports/VisitsReportPage';
import { TaskReportPage } from './pages/reports/TaskReportPage';
import { SalesReportPage } from './pages/reports/SalesReportPage';
import { CustomerReportPage } from './pages/reports/CustomerReportPage';

import { UserProfilePage } from './pages/profile/UserProfilePage';
import { NotificationSettingsPage } from './pages/settings/NotificationSettingsPage';
import { NotificationsPage } from './pages/settings/NotificationsPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { TeamMembersPage } from './pages/team/TeamMembersPage';
import { SystemSettingsPage } from './pages/settings/SystemSettingsPage';

// Dynamic Dashboard Resolver component based on user role
const DashboardResolver: React.FC = () => {
  const { currentUser, currentTenant, isLoading } = useAuth();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.tenantId === 'SYSTEM';

  const [isDataSynced, setIsDataSynced] = React.useState(false);

  React.useEffect(() => {
    // Sync with backend on startup
    const tenantId = currentTenant?.id || 'TEN-00001';
    SyncService.syncAll(tenantId).then(() => {
      setIsDataSynced(true);
    });

    // Listen for sync events
    const handleSync = () => setIsDataSynced(true);
    window.addEventListener('sfp_data_synced', handleSync);
    return () => window.removeEventListener('sfp_data_synced', handleSync);
  }, [currentTenant?.id]);

  if (isLoading || !isDataSynced) {
    return <SuperAdminDashboard />;
  }

  if (isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  return <SalesDashboard />;
};

// Protected Route Guard Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: string; allowedRoles?: string[] }> = ({
  children,
  requiredRole,
  allowedRoles,
}) => {
  const { isAuthenticated, currentUser } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.tenantId === 'SYSTEM';

  if (requiredRole === 'SUPER_ADMIN' && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  if (allowedRoles && currentUser && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout>{children}</Layout>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected Main App Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardResolver />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardResolver />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team-dashboard"
            element={
              <ProtectedRoute>
                <TeamDashboard />
              </ProtectedRoute>
            }
          />

          {/* Super Admin Module */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute requiredRole="SUPER_ADMIN">
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tenants"
            element={
              <ProtectedRoute requiredRole="SUPER_ADMIN">
                <TenantsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tenants/create"
            element={
              <ProtectedRoute requiredRole="SUPER_ADMIN">
                <CreateTenantPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tenants/:id"
            element={
              <ProtectedRoute requiredRole="SUPER_ADMIN">
                <TenantDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tenant-users"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN']}>
                <TenantUsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tenant-users/create"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN']}>
                <CreateTenantUserPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tenant-users/new"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN']}>
                <CreateTenantUserPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/roles"
            element={
              <ProtectedRoute>
                <RolesPermissionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/master-data"
            element={
              <ProtectedRoute>
                <MasterDataPage />
              </ProtectedRoute>
            }
          />

          {/* Sales CRM Directory */}
          <Route
            path="/team"
            element={
              <ProtectedRoute>
                <TeamMembersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <CustomersListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers/create"
            element={
              <ProtectedRoute>
                <CreateCustomerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers/new"
            element={
              <ProtectedRoute>
                <CreateCustomerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers/:id"
            element={
              <ProtectedRoute>
                <CustomerDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers/:id/edit"
            element={
              <ProtectedRoute>
                <EditCustomerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/visits"
            element={
              <ProtectedRoute>
                <VisitsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/visits/:id"
            element={
              <ProtectedRoute>
                <VisitDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/visits/:id/report"
            element={
              <ProtectedRoute>
                <VisitReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/visits/schedule"
            element={
              <ProtectedRoute>
                <CreateVisitPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/visits/create"
            element={
              <ProtectedRoute>
                <CreateVisitPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/visits/new"
            element={
              <ProtectedRoute>
                <CreateVisitPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <TasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/new"
            element={
              <ProtectedRoute>
                <CreateTaskPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/:id"
            element={
              <ProtectedRoute>
                <TaskDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/:id/edit"
            element={
              <ProtectedRoute>
                <EditTaskPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team-tasks"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TENANT_ADMIN', 'SALES_MANAGER', 'SUPERVISOR']}>
                <TeamTasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/task-board"
            element={
              <ProtectedRoute>
                <TaskBoardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/followups"
            element={
              <ProtectedRoute>
                <FollowupsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/followups/:id"
            element={
              <ProtectedRoute>
                <FollowupDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <ProjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/new"
            element={
              <ProtectedRoute>
                <CreateProjectPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id"
            element={
              <ProtectedRoute>
                <ProjectDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activities"
            element={
              <ProtectedRoute>
                <ActivitiesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activities/:id"
            element={
              <ProtectedRoute>
                <ActivityDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/targets"
            element={
              <ProtectedRoute>
                <TargetsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/performance"
            element={
              <ProtectedRoute>
                <PerformancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales-report"
            element={
              <ProtectedRoute>
                <SalesReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/visits-report"
            element={
              <ProtectedRoute>
                <VisitsReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/task-report"
            element={
              <ProtectedRoute>
                <TaskReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer-report"

            element={
              <ProtectedRoute>
                <CustomerReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <UserProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notification-settings"
            element={
              <ProtectedRoute>
                <NotificationSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <AuditLogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/system-settings"
            element={
              <ProtectedRoute>
                <SystemSettingsPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Agentation />
    </AuthProvider>
  );
};


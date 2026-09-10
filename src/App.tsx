import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { Agentation } from 'agentation';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';

// Admin Pages
import { SuperAdminDashboard } from './pages/admin/SuperAdminDashboard';
import { TenantsListPage } from './pages/admin/TenantsListPage';
import { TenantDetailPage } from './pages/admin/TenantDetailPage';
import { CreateTenantPage } from './pages/admin/CreateTenantPage';
import { TenantUsersPage } from './pages/admin/TenantUsersPage';
import { CreateTenantUserPage } from './pages/admin/CreateTenantUserPage';
import { RolesPermissionsPage } from './pages/admin/RolesPermissionsPage';
import { MasterDataPage } from './pages/admin/MasterDataPage';
import { MenuManagementPage } from './pages/admin/MenuManagementPage';

// Sales CRM Pages
import { TeamDashboard } from './pages/dashboard/TeamDashboard';
import { SalesDashboard } from './pages/dashboard/SalesDashboard';
import { CustomersListPage } from './pages/customers/CustomersListPage';
import { CustomerDetailPage } from './pages/customers/CustomerDetailPage';
import { CreateCustomerPage } from './pages/customers/CreateCustomerPage';
import { EditCustomerPage } from './pages/customers/EditCustomerPage';
import { VisitsPage } from './pages/visits/VisitsPage';
import { CreateVisitPage } from './pages/visits/CreateVisitPage';
import { EditVisitPage } from './pages/visits/EditVisitPage';
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
import { EditProjectPage } from './pages/projects/EditProjectPage';
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

export const normalizeRole = (role?: string | null): string => {
  if (!role) return '';
  const upper = role.toUpperCase();
  if (upper === 'SUPER_ADMIN' || upper.endsWith('SUPER_ADMIN')) return 'SUPER_ADMIN';
  if (upper === 'TENANT_ADMIN' || upper.endsWith('TENANT_ADMIN') || upper.startsWith('ROL-ADM')) return 'TENANT_ADMIN';
  if (upper === 'SALES_MANAGER' || upper.endsWith('SALES_MANAGER')) return 'SALES_MANAGER';
  if (upper === 'SUPERVISOR' || upper.endsWith('SUPERVISOR') || upper.startsWith('ROL-SUP')) return 'SUPERVISOR';
  if (upper === 'SALES_REP' || upper === 'SALES_REPRESENTATIVE' || upper.endsWith('SALES_REP') || upper.startsWith('ROL-REP')) return 'SALES_REP';
  return role;
};

// Dynamic Dashboard Resolver component based on user role
const DashboardResolver: React.FC = () => {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-[#4744e5] animate-spin">
            progress_activity
          </span>
          <span className="text-xs font-semibold text-[#464555]">Loading Dashboard...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const normalizedRole = normalizeRole(currentUser.role);

  switch (normalizedRole) {
    case 'SUPER_ADMIN':
      return <SuperAdminDashboard />;
    case 'TENANT_ADMIN':
    case 'SALES_MANAGER':
    case 'SUPERVISOR':
      return <TeamDashboard />;
    case 'SALES_REP':
    case 'SALES_REPRESENTATIVE':
      return <SalesDashboard />;
    default:
      return (
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="text-center text-rose-600">
            <span className="material-symbols-outlined text-4xl mb-2">block</span>
            <p className="font-semibold">Unsupported Role</p>
            <p className="text-xs mt-1 text-gray-500">Your role '{currentUser.role}' does not have a designated dashboard.</p>
          </div>
        </div>
      );
  }
};

// Protected Route Guard Wrapper
function ProtectedRoute({
  children,
  requiredPermission,
  requiredPlatformUser,
  requiredRoles
}: {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredPlatformUser?: boolean;
  requiredRoles?: string[];
}) {
  const { isAuthenticated, isLoading, hasPermission, currentUser } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Loading Application...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isSuperAdmin =
    currentUser?.role === 'SUPER_ADMIN' ||
    (currentUser as any)?.roleCode === 'SUPER_ADMIN' ||
    Boolean((currentUser as any)?.isPlatformUser);

  if (requiredPlatformUser && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const role = normalizeRole(currentUser?.role || (currentUser as any)?.roleCode);
    if (!requiredRoles.includes(role) && !isSuperAdmin) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

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
              <ProtectedRoute requiredPermission="MANAGE_TENANT">
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tenants"
            element={
              <ProtectedRoute requiredPermission="MANAGE_TENANT">
                <TenantsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tenants/create"
            element={
              <ProtectedRoute requiredPermission="MANAGE_TENANT">
                <CreateTenantPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tenants/:id"
            element={
              <ProtectedRoute requiredPermission="MANAGE_TENANT">
                <TenantDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tenant-users"
            element={
              <ProtectedRoute requiredPermission="MANAGE_USERS">
                <TenantUsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tenant-users/create"
            element={
              <ProtectedRoute requiredPermission="MANAGE_USERS">
                <CreateTenantUserPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tenant-users/new"
            element={
              <ProtectedRoute requiredPermission="MANAGE_USERS">
                <CreateTenantUserPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/roles"
            element={
              <ProtectedRoute requiredPermission="MANAGE_ROLES">
                <RolesPermissionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/master-data"
            element={
              <ProtectedRoute requiredPermission="MANAGE_TENANT">
                <MasterDataPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/menu-management"
            element={
              <ProtectedRoute requiredPlatformUser>
                <MenuManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/menus"
            element={
              <ProtectedRoute requiredPlatformUser>
                <MenuManagementPage />
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
            path="/visits/:id/edit"
            element={
              <ProtectedRoute>
                <EditVisitPage />
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
              <ProtectedRoute requiredPermission="VIEW_TEAM_TASKS">
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
            path="/projects/:id/edit"
            element={
              <ProtectedRoute>
                <EditProjectPage />
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
            path="/settings/visit-reminders"
            element={
              <ProtectedRoute requiredRoles={['TENANT_ADMIN', 'SUPER_ADMIN']}>
                <NotificationSettingsPage />
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
              <ProtectedRoute requiredPermission="MANAGE_TENANT">
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


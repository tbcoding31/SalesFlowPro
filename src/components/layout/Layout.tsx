import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '../../context/AuthContext';
import { TrialExpiredModal } from '../TrialExpiredModal';
import { AIChat } from '../AIChat';

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated, isLoading, currentUser, currentTenant, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f9f9f9]">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-[#4744e5] animate-spin">
            progress_activity
          </span>
          <span className="text-xs font-semibold text-[#464555]">Loading SalesFlow Pro...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if active tenant has an expired Trial 3 Bulan plan for client users
  const isTrialExpired =
    currentUser &&
    currentUser.role !== 'SUPER_ADMIN' &&
    currentTenant &&
    currentTenant.type === 'Trial 3 Bulan' &&
    (currentTenant.isTrialExpired ||
      (currentTenant.trialEndDate && new Date(currentTenant.trialEndDate) < new Date()));

  return (
    <div className="min-h-screen bg-[#f9f9f9] flex antialiased relative">
      {/* Trial Expired Forced Logout Modal Popup for Client */}
      {isTrialExpired && (
        <TrialExpiredModal
          tenant={currentTenant}
          user={currentUser}
          onLogout={logout}
        />
      )}

      {/* Fixed Left Sidebar */}
      <Sidebar />

      {/* Main Right Workspace */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen min-w-0">
        {/* Fixed Topbar */}
        <Topbar />

        {/* Scrollable Content View */}
        <main className="flex-1 mt-16 p-8 overflow-y-auto max-w-[1440px] w-full mx-auto relative">
          {children || <Outlet />}
        </main>
      </div>
      
      {/* AI Chat Widget */}
      <AIChat />
    </div>
  );
};

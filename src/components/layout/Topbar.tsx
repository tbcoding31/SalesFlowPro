import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { Link } from 'react-router-dom';

interface TopbarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar, isSidebarOpen = false }) => {
  const { currentUser, currentTenant, switchUser, switchTenant } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const allUsers = DataService.getUsers();
  const allTenants = DataService.getTenants();
  const unreadNotifications = DataService.getNotifications(currentUser?.id).filter((n) => !n.isRead);

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-white border-b border-[#E1E1E1] px-4 lg:px-8 flex items-center justify-between z-20 transition-all duration-300">
      {/* Left: Hamburger Button (Mobile/Tablet) + Search Bar */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isSidebarOpen}
          aria-controls="sidebar-navigation"
          className="p-2 text-[#464555] hover:text-[#1a1c1c] hover:bg-[#f3f3f3] rounded-lg lg:hidden transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[24px]">
            {isSidebarOpen ? 'close' : 'menu'}
          </span>
        </button>

        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#767587] text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search customers, visits, tasks, projects..."
            className="w-full pl-9 pr-4 py-1.5 bg-[#f9f9f9] border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5]/20 text-[#1a1c1c] transition-all"
          />
        </div>
      </div>

      {/* Right Controls: Demo Role & Tenant Switcher + Notifications + Profile */}
      <div className="flex items-center gap-4">
        {/* Interactive Demo Switcher Box */}
        <div className="hidden lg:flex items-center gap-2 bg-[#eff4ff] border border-[#c7c4d8] rounded-lg px-2.5 py-1 text-xs">
          <span className="material-symbols-outlined text-[#4744e5] text-[16px]">tune</span>
          <span className="font-semibold text-[#4744e5] text-[11px]">Demo Scope:</span>

          {/* User Role Switcher */}
          <select
            value={currentUser?.id}
            onChange={(e) => switchUser(e.target.value)}
            className="bg-white border border-[#E1E1E1] rounded text-[11px] font-medium px-2 py-0.5 text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
            title="Switch User Role Context"
          >
            {allUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.roleName})
              </option>
            ))}
          </select>

          {/* Tenant Switcher */}
          {currentUser?.tenantId !== 'SYSTEM' && (
            <select
              value={currentTenant?.id}
              onChange={(e) => switchTenant(e.target.value)}
              className="bg-white border border-[#E1E1E1] rounded text-[11px] font-medium px-2 py-0.5 text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
              title="Switch Active Tenant"
            >
              {allTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Notifications Icon Button */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-[#464555] hover:text-[#1a1c1c] hover:bg-[#f3f3f3] rounded-lg relative transition-colors"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {unreadNotifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ba1a1a] rounded-full animate-pulse" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E1E1E1] rounded-xl shadow-lg py-2 z-50">
              <div className="px-4 py-2 border-b border-[#E1E1E1] flex justify-between items-center">
                <span className="font-bold text-xs text-[#1a1c1c]">Notifications</span>
                <span className="text-[10px] bg-[#6161ff]/10 text-[#6161ff] px-2 py-0.5 rounded-full font-bold">
                  {unreadNotifications.length} New
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-[#E1E1E1]">
                {unreadNotifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#767587]">No unread notifications</div>
                ) : (
                  unreadNotifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-3 hover:bg-[#f9f9f9] transition-colors cursor-pointer text-xs"
                      onClick={() => DataService.markNotificationAsRead(n.id)}
                    >
                      <p className="font-semibold text-[#1a1c1c]">{n.title}</p>
                      <p className="text-[#464555] mt-0.5 text-[11px] line-clamp-2">{n.message}</p>
                      <span className="text-[10px] text-[#767587] mt-1 block">{n.createdAt}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="p-2 border-t border-[#E1E1E1] text-center">
                <Link
                  to="/notifications"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-[#4744e5] font-semibold hover:underline"
                >
                  View All Notifications
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1 hover:bg-[#f3f3f3] rounded-lg transition-colors"
          >
            <img
              src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'}
              alt={currentUser?.name}
              className="w-8 h-8 rounded-full object-cover border border-[#E1E1E1]"
            />
            <span className="material-symbols-outlined text-[16px] text-[#767587]">expand_more</span>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white border border-[#E1E1E1] rounded-xl shadow-lg py-2 z-50">
              <div className="px-4 py-2 border-b border-[#E1E1E1]">
                <p className="font-bold text-xs text-[#1a1c1c]">{currentUser?.name}</p>
                <p className="text-[10px] text-[#767587] truncate">{currentUser?.email}</p>
                <p className="text-[10px] text-[#4744e5] font-semibold mt-0.5">{currentUser?.roleName}</p>
              </div>
              <Link
                to="/profile"
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center gap-2 px-4 py-2 text-xs text-[#1a1c1c] hover:bg-[#f9f9f9]"
              >
                <span className="material-symbols-outlined text-[16px]">person</span>
                <span>Profile</span>
              </Link>
              <Link
                to="/notification-settings"
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center gap-2 px-4 py-2 text-xs text-[#1a1c1c] hover:bg-[#f9f9f9]"
              >
                <span className="material-symbols-outlined text-[16px]">notifications_active</span>
                <span>Notification Settings</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

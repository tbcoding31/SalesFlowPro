import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { currentUser, currentTenant, hasPermission, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isSuperAdmin = hasPermission('MANAGE_TENANT');
  const isManagerOrSupervisor = hasPermission('VIEW_TEAM_TASKS');
  const canViewReports = hasPermission('VIEW_REPORTS') || hasPermission('VIEW_FINANCE');
  const isSalesRep = !hasPermission('VIEW_ALL_CUSTOMERS');

  // State to manage open/closed accordion sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    main_admin: true,
    tenant_mgmt: false,
    system_admin: false,
    main_user: true,
    sales: false,
    administration: false,
    team: false,
    reports: false,
    system_user: false,
    customers_submenu: false,
    tasks_submenu: false
  });

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-[#E1E1E1] flex flex-col py-6 z-30 shrink-0 select-none">
      {/* Brand Header */}
      <div className="px-6 mb-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="SalesFlow Logo" className="w-9 h-9 object-contain rounded shadow-sm" />
          <div>
            <h1 className="font-bold text-xl text-[#4744e5] leading-tight font-['Hanken_Grotesk']">SalesFlow Pro</h1>
            <p className="text-[11px] text-[#464555] font-medium">
              {isSuperAdmin ? 'Enterprise CRM Console' : (currentTenant?.name || 'Enterprise CRM')}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-3 space-y-4">
        {/* SUPER ADMIN NAVIGATION */}
        {isSuperAdmin ? (
          <>
            <div>
              <div 
                className="px-3 mb-2 flex items-center justify-between cursor-pointer group"
                onClick={() => toggleSection('main_admin')}
              >
                <div className="text-[10px] font-bold text-[#464555] uppercase tracking-wider group-hover:text-[#1a1c1c]">MAIN</div>
                <span className="material-symbols-outlined text-[14px] text-[#767587] group-hover:text-[#1a1c1c]">
                  {openSections['main_admin'] ? 'expand_less' : 'expand_more'}
                </span>
              </div>
              {openSections['main_admin'] && (
                <div className="space-y-1">
                  <NavLink
                    to="/admin/dashboard"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">dashboard</span>
                    <span>Dashboard</span>
                  </NavLink>
                </div>
              )}
            </div>

            <div>
              <div 
                className="px-3 mb-2 flex items-center justify-between cursor-pointer group"
                onClick={() => toggleSection('tenant_mgmt')}
              >
                <div className="text-[10px] font-bold text-[#464555] uppercase tracking-wider group-hover:text-[#1a1c1c]">TENANT MANAGEMENT</div>
                <span className="material-symbols-outlined text-[14px] text-[#767587] group-hover:text-[#1a1c1c]">
                  {openSections['tenant_mgmt'] ? 'expand_less' : 'expand_more'}
                </span>
              </div>
              {openSections['tenant_mgmt'] && (
                <div className="space-y-1">
                  <NavLink
                    to="/admin/tenants"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">domain</span>
                    <span>Tenants</span>
                  </NavLink>



                  <NavLink
                    to="/admin/roles"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">security</span>
                    <span>Roles & Permissions</span>
                  </NavLink>

                  <NavLink
                    to="/admin/master-data"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">database</span>
                    <span>Master Data</span>
                  </NavLink>
                </div>
              )}
            </div>

            <div>
              <div 
                className="px-3 mb-2 flex items-center justify-between cursor-pointer group"
                onClick={() => toggleSection('system_admin')}
              >
                <div className="text-[10px] font-bold text-[#464555] uppercase tracking-wider group-hover:text-[#1a1c1c]">SYSTEM</div>
                <span className="material-symbols-outlined text-[14px] text-[#767587] group-hover:text-[#1a1c1c]">
                  {openSections['system_admin'] ? 'expand_less' : 'expand_more'}
                </span>
              </div>
              {openSections['system_admin'] && (
                <div className="space-y-1">
                  <NavLink
                    to="/notifications"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">notifications</span>
                    <span>Notifications</span>
                  </NavLink>

                  <NavLink
                    to="/admin/audit-logs"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">assignment</span>
                    <span>Audit Logs</span>
                  </NavLink>

                  <NavLink
                    to="/system-settings"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">settings</span>
                    <span>Settings</span>
                  </NavLink>
                </div>
              )}
            </div>
          </>
        ) : (
          /* TENANT USER NAVIGATION (Admin, Manager, Supervisor, Sales Rep) */
          <>
            <div>
              <div 
                className="px-3 mb-2 flex items-center justify-between cursor-pointer group"
                onClick={() => toggleSection('main_user')}
              >
                <div className="text-[10px] font-bold text-[#464555] uppercase tracking-wider group-hover:text-[#1a1c1c]">MAIN</div>
                <span className="material-symbols-outlined text-[14px] text-[#767587] group-hover:text-[#1a1c1c]">
                  {openSections['main_user'] ? 'expand_less' : 'expand_more'}
                </span>
              </div>
              {openSections['main_user'] && (
                <div className="space-y-1">
                  <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#6161ff] text-white font-semibold'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">dashboard</span>
                    <span>Dashboard</span>
                  </NavLink>
                </div>
              )}
            </div>

            <div>
              <div 
                className="px-3 mb-2 flex items-center justify-between cursor-pointer group"
                onClick={() => toggleSection('sales')}
              >
                <div className="text-[10px] font-bold text-[#464555] uppercase tracking-wider group-hover:text-[#1a1c1c]">SALES</div>
                <span className="material-symbols-outlined text-[14px] text-[#767587] group-hover:text-[#1a1c1c]">
                  {openSections['sales'] ? 'expand_less' : 'expand_more'}
                </span>
              </div>
              {openSections['sales'] && (
                <div className="space-y-1">
                  <div>
                    <div
                      onClick={() => toggleSection('customers_submenu')}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                        location.pathname.startsWith('/customers')
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[20px]">groups</span>
                        <span>Customers</span>
                      </div>
                      <span className="material-symbols-outlined text-[16px]">
                        {openSections['customers_submenu'] ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                    {openSections['customers_submenu'] && (
                      <div className="ml-7 mt-1 space-y-1">
                        <NavLink
                          to="/customers"
                          end
                          className={({ isActive }) =>
                            `block px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              isActive
                                ? 'bg-[#6161ff] text-white'
                                : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                            }`
                          }
                        >
                          All Customers
                        </NavLink>
                        <NavLink
                          to="/customers?filter=my"
                          className="block px-3 py-1.5 rounded-lg text-xs font-semibold text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c] transition-colors"
                        >
                          My Customers
                        </NavLink>
                      </div>
                    )}
                  </div>

                  <NavLink
                    to="/visits"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">route</span>
                    <span>{isSalesRep ? 'My Visits' : 'Visits'}</span>
                  </NavLink>

                  <NavLink
                    to="/projects"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">monetization_on</span>
                    <span>{isSalesRep ? 'My Projects' : 'Projects'}</span>
                  </NavLink>

                  <div>
                    <div
                      onClick={() => toggleSection('tasks_submenu')}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                        (location.pathname.startsWith('/tasks') || location.pathname.startsWith('/team-tasks') || location.pathname.startsWith('/task-board'))
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[20px]">assignment</span>
                        <span>Tasks</span>
                      </div>
                      <span className="material-symbols-outlined text-[16px]">
                        {openSections['tasks_submenu'] ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                    {openSections['tasks_submenu'] && (
                      <div className="ml-7 mt-1 space-y-1">
                        <NavLink
                          to="/tasks"
                          end
                          className={({ isActive }) =>
                            `block px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              isActive
                                ? 'bg-[#6161ff] text-white'
                                : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                            }`
                          }
                        >
                          My Tasks
                        </NavLink>
                        
                        {isManagerOrSupervisor && (
                          <NavLink
                            to="/team-tasks"
                            className={({ isActive }) =>
                              `block px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                isActive
                                  ? 'bg-[#6161ff] text-white'
                                  : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                              }`
                            }
                          >
                            Team Tasks
                          </NavLink>
                        )}

                        <NavLink
                          to="/task-board"
                          className={({ isActive }) =>
                            `block px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              isActive
                                ? 'bg-[#6161ff] text-white'
                                : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                            }`
                          }
                        >
                          Task Board
                        </NavLink>
                      </div>
                    )}
                  </div>

                  <NavLink
                    to="/followups"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">call</span>
                    <span>{isSalesRep ? 'My Follow-ups' : 'Follow-ups'}</span>
                  </NavLink>

                  <NavLink
                    to="/activities"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">timeline</span>
                    <span>{isSalesRep ? 'My Activities' : 'Activities'}</span>
                  </NavLink>
                </div>
              )}
            </div>

            {(hasPermission('MANAGE_USERS') || hasPermission('MANAGE_ROLES') || hasPermission('MANAGE_TENANT')) && (
              <div>
                <div 
                  className="px-3 mb-2 flex items-center justify-between cursor-pointer group"
                  onClick={() => toggleSection('administration')}
                >
                  <div className="text-[10px] font-bold text-[#464555] uppercase tracking-wider group-hover:text-[#1a1c1c]">ADMINISTRATION</div>
                  <span className="material-symbols-outlined text-[14px] text-[#767587] group-hover:text-[#1a1c1c]">
                    {openSections['administration'] ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
                {openSections['administration'] && (
                  <div className="space-y-1">
                    <NavLink
                      to="/admin/tenant-users"
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                            : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                        }`
                      }
                    >
                      <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                      <span>User Management</span>
                    </NavLink>
                  </div>
                )}
              </div>
            )}

            <div>
              <div 
                className="px-3 mb-2 flex items-center justify-between cursor-pointer group"
                onClick={() => toggleSection('team')}
              >
                <div className="text-[10px] font-bold text-[#464555] uppercase tracking-wider group-hover:text-[#1a1c1c]">TEAM</div>
                <span className="material-symbols-outlined text-[14px] text-[#767587] group-hover:text-[#1a1c1c]">
                  {openSections['team'] ? 'expand_less' : 'expand_more'}
                </span>
              </div>
              {openSections['team'] && (
                <div className="space-y-1">
                  <NavLink
                    to="/team"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">group</span>
                    <span>Team Members</span>
                  </NavLink>

                  <NavLink
                    to="/team-dashboard"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">equalizer</span>
                    <span>Workload</span>
                  </NavLink>

                  <NavLink
                    to="/performance"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">trending_up</span>
                    <span>Performance</span>
                  </NavLink>
                </div>
              )}
            </div>

            <div>
              <div 
                className="px-3 mb-2 flex items-center justify-between cursor-pointer group"
                onClick={() => toggleSection('reports')}
              >
                <div className="text-[10px] font-bold text-[#464555] uppercase tracking-wider group-hover:text-[#1a1c1c]">REPORTS</div>
                <span className="material-symbols-outlined text-[14px] text-[#767587] group-hover:text-[#1a1c1c]">
                  {openSections['reports'] ? 'expand_less' : 'expand_more'}
                </span>
              </div>
              {openSections['reports'] && (
                <div className="space-y-1">
                  <NavLink
                    to="/sales-report"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">request_quote</span>
                    <span>Sales Report</span>
                  </NavLink>
                  <NavLink
                    to="/visits-report"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">map</span>
                    <span>Visit Report</span>
                  </NavLink>
                  <NavLink
                    to="/task-report"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">assignment</span>
                    <span>Task Report</span>
                  </NavLink>
                  <NavLink
                    to="/customer-report"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">groups</span>
                    <span>Customer Report</span>
                  </NavLink>
                </div>
              )}
            </div>
            
            <div>
              <div 
                className="px-3 mb-2 flex items-center justify-between cursor-pointer group"
                onClick={() => toggleSection('system_user')}
              >
                <div className="text-[10px] font-bold text-[#464555] uppercase tracking-wider group-hover:text-[#1a1c1c]">SYSTEM</div>
                <span className="material-symbols-outlined text-[14px] text-[#767587] group-hover:text-[#1a1c1c]">
                  {openSections['system_user'] ? 'expand_less' : 'expand_more'}
                </span>
              </div>
              {openSections['system_user'] && (
                <div className="space-y-1">
                  <NavLink
                    to="/notifications"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                          : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px]">notifications</span>
                    <span>Notifications</span>
                  </NavLink>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* User Profile Card at Bottom */}
      <div className="px-4 mt-auto pt-4 border-t border-[#E1E1E1]">
        <div className="flex items-center justify-between p-2 bg-[#f3f3f3] rounded-lg border border-[#E1E1E1]">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'}
              alt={currentUser?.name}
              className="w-9 h-9 rounded-full object-cover shrink-0 border border-[#E1E1E1]"
            />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs text-[#1a1c1c] truncate">{currentUser?.name}</span>
              <span className="text-[10px] text-[#464555] font-medium truncate">{currentUser?.roleName}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-1 text-[#767587] hover:text-[#ba1a1a] transition-colors rounded hover:bg-[#e2e2e2]"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

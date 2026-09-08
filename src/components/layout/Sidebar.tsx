import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { navigationApi } from '../../services/navigationApi';
import { AppMenuItem } from '../../types';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

// Icon key to Material Symbol registry with safe fallback
const ICON_REGISTRY: Record<string, string> = {
  dashboard: 'dashboard',
  category: 'category',
  domain: 'domain',
  security: 'security',
  database: 'database',
  notifications: 'notifications',
  assignment: 'assignment',
  settings: 'settings',
  menu_open: 'menu_open',
  point_of_sale: 'point_of_sale',
  groups: 'groups',
  person: 'person',
  route: 'route',
  travel_explore: 'travel_explore',
  directions_walk: 'directions_walk',
  monetization_on: 'monetization_on',
  checklist: 'checklist',
  task_alt: 'task_alt',
  supervisor_account: 'supervisor_account',
  view_kanban: 'view_kanban',
  call: 'call',
  timeline: 'timeline',
  admin_panel_settings: 'admin_panel_settings',
  manage_accounts: 'manage_accounts',
  groups_3: 'groups_3',
  group: 'group',
  equalizer: 'equalizer',
  trending_up: 'trending_up',
  analytics: 'analytics',
  request_quote: 'request_quote',
  map: 'map'
};

export function resolveIcon(iconKey?: string | null): string {
  if (!iconKey) return 'circle';
  return ICON_REGISTRY[iconKey] || iconKey || 'circle';
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { currentUser, currentTenant, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || (currentUser as any)?.roleCode === 'SUPER_ADMIN';

  const [menuTree, setMenuTree] = useState<AppMenuItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // State to manage open/closed accordion sections and submenus
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const loadNavigation = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await navigationApi.fetchMyNavigation();
      const tree = res.data || [];
      setMenuTree(tree);

      // Auto-open sections containing current route or default first group open
      const initialOpen: Record<string, boolean> = {};
      tree.forEach((group, idx) => {
        // Groups default open if first or active
        if (idx === 0) initialOpen[group.code] = true;

        if (group.children) {
          group.children.forEach(item => {
            if (item.menuType === 'SUBMENU' && item.children) {
              const isChildActive = item.children.some(c => c.route && location.pathname.startsWith(c.route.split('?')[0]));
              if (isChildActive) {
                initialOpen[group.code] = true;
                initialOpen[item.code] = true;
              }
            } else if (item.route && location.pathname.startsWith(item.route.split('?')[0])) {
              initialOpen[group.code] = true;
            }
          });
        }
      });
      setOpenSections(prev => ({ ...initialOpen, ...prev }));
    } catch (err: any) {
      console.error('Failed to load database navigation:', err);
      setLoadError('Failed to load authorized menus. Access denied.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNavigation();
  }, [currentUser?.id, currentUser?.role]);

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    if (onClose) onClose();
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile / Tablet Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-white border-r border-[#E1E1E1] flex flex-col py-6 z-50 shrink-0 select-none transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="px-6 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo.png" alt="SalesFlow Logo" className="w-9 h-9 object-contain rounded shadow-sm shrink-0" />
            <div className="min-w-0">
              <h1 className="font-bold text-xl text-[#4744e5] leading-tight font-['Hanken_Grotesk'] truncate">SalesFlow Pro</h1>
              <p className="text-[11px] text-[#464555] font-medium truncate">
                {isSuperAdmin ? 'Enterprise CRM Console' : (currentTenant?.name || 'Enterprise CRM')}
              </p>
            </div>
          </div>

          {/* Close button on mobile/tablet */}
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="p-1 text-[#767587] hover:text-[#1a1c1c] rounded-lg lg:hidden hover:bg-[#f3f3f3] transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Navigation Scrollable Area */}
        <div className="flex-1 overflow-y-auto px-3 space-y-4">
          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center text-[#767587] space-y-2">
              <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
              <span className="text-xs font-medium">Loading navigation...</span>
            </div>
          ) : loadError ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-2">
              <span className="material-symbols-outlined text-rose-500 text-[24px]">lock</span>
              <p className="text-xs text-rose-700 font-bold">{loadError}</p>
              <button
                onClick={loadNavigation}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : menuTree.length === 0 ? (
            <div className="py-8 text-center text-[#767587] text-xs">
              No authorized menus found.
            </div>
          ) : (
            menuTree.map((group) => {
              const isOpen = openSections[group.code] ?? true;
              return (
                <div key={group.id}>
                  {/* Group Header */}
                  <div
                    className="px-3 mb-2 flex items-center justify-between cursor-pointer group"
                    onClick={() => toggleSection(group.code)}
                  >
                    <div className="text-[10px] font-bold text-[#464555] uppercase tracking-wider group-hover:text-[#1a1c1c]">
                      {group.label}
                    </div>
                    <span className="material-symbols-outlined text-[14px] text-[#767587] group-hover:text-[#1a1c1c]">
                      {isOpen ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>

                  {/* Group Children */}
                  {isOpen && group.children && (
                    <div className="space-y-1">
                      {group.children.map((item) => {
                        // Case A: SUBMENU (e.g. Customers, Visits, Tasks)
                        if (item.menuType === 'SUBMENU' && item.children && item.children.length > 0) {
                          const isSubmenuOpen = openSections[item.code] ?? false;
                          const isParentPathActive = item.route ? location.pathname.startsWith(item.route.split('?')[0]) : false;

                          return (
                            <div key={item.id}>
                              <div
                                onClick={() => toggleSection(item.code)}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                                  isParentPathActive
                                    ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                                    : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="material-symbols-outlined text-[20px]">
                                    {resolveIcon(item.iconKey)}
                                  </span>
                                  <span>{item.label}</span>
                                </div>
                                <span className="material-symbols-outlined text-[16px]">
                                  {isSubmenuOpen ? 'expand_less' : 'expand_more'}
                                </span>
                              </div>

                              {isSubmenuOpen && (
                                <div className="ml-7 mt-1 space-y-1">
                                  {item.children.map((subItem) => {
                                    if (!subItem.route) return null;
                                    const [targetPath, targetQuery] = subItem.route.split('?');
                                    const isPathMatch = location.pathname === targetPath;
                                    let isMatch = isPathMatch;
                                    if (targetQuery) {
                                      const params = new URLSearchParams(targetQuery);
                                      params.forEach((v, k) => {
                                        if (new URLSearchParams(location.search).get(k) !== v) {
                                          isMatch = false;
                                        }
                                      });
                                    } else if (location.search && isPathMatch) {
                                      // If subItem has no query but current has query e.g. /customers vs /customers?filter=my
                                      // If target is exact /customers without query, check if other child has matching query
                                      const siblingHasQuery = item.children?.some(c => c.route && c.route.includes('?') && c.route.startsWith(targetPath));
                                      if (siblingHasQuery && location.search.length > 1) {
                                        isMatch = false;
                                      }
                                    }

                                    return (
                                      <NavLink
                                        key={subItem.id}
                                        to={subItem.route}
                                        onClick={onClose}
                                        className={`block px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                          isMatch
                                            ? 'bg-[#6161ff] text-white'
                                            : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                                        }`}
                                      >
                                        {subItem.label}
                                      </NavLink>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Case B: Standard NavLink Item
                        if (!item.route) return null;

                        return (
                          <NavLink
                            key={item.id}
                            to={item.route}
                            onClick={onClose}
                            className={({ isActive }) =>
                              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                isActive
                                  ? 'bg-[#e1dfff] text-[#09006b] font-semibold border-l-4 border-[#4744e5]'
                                  : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                              }`
                            }
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              {resolveIcon(item.iconKey)}
                            </span>
                            <span>{item.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
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
                <span className="text-[10px] text-[#464555] font-medium truncate">{currentUser?.roleName || currentUser?.role}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1 text-[#767587] hover:text-[#ba1a1a] transition-colors rounded hover:bg-[#e2e2e2] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

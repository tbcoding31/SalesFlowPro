import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { navigationApi } from '../../services/navigationApi';
import { AppMenuItem } from '../../types';

interface MenuFormData {
  id?: string;
  code: string;
  label: string;
  route: string;
  iconKey: string;
  parentId: string;
  menuScope: 'PLATFORM' | 'TENANT';
  menuType: 'GROUP' | 'ITEM' | 'SUBMENU' | 'MENU' | 'DIVIDER';
  displayOrder: number;
  isActive: boolean;
  roles: string[];
}

const ALL_ROLES = [
  { code: 'SUPER_ADMIN', label: 'Super Admin', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { code: 'TENANT_ADMIN', label: 'Tenant Admin', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { code: 'SUPERVISOR', label: 'Supervisor', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { code: 'SALES_MANAGER', label: 'Sales Manager', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { code: 'SALES_REP', label: 'Sales Rep', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
];

export const MenuManagementPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [menus, setMenus] = useState<AppMenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'PLATFORM' | 'TENANT'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'MENU' | 'SUBMENU' | 'ITEM' | 'DIVIDER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Notification Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Active item for editing
  const [editingMenu, setEditingMenu] = useState<AppMenuItem | null>(null);
  const [menuToDelete, setMenuToDelete] = useState<AppMenuItem | null>(null);

  // Form State
  const [formData, setFormData] = useState<MenuFormData>({
    code: '',
    label: '',
    route: '',
    iconKey: 'circle',
    parentId: '',
    menuScope: 'TENANT',
    menuType: 'ITEM',
    displayOrder: 10,
    isActive: true,
    roles: ['TENANT_ADMIN'],
  });

  // Role Access Modal State
  const [selectedMenuForRoles, setSelectedMenuForRoles] = useState<AppMenuItem | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadMenus = async () => {
    setIsLoading(true);
    try {
      const data = await navigationApi.fetchPlatformMenus();
      setMenus(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load menu list', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMenus();
  }, []);

  // Filtered Menus
  const filteredMenus = useMemo(() => {
    return menus.filter((m) => {
      if (scopeFilter !== 'ALL' && m.menuScope !== scopeFilter) return false;
      if (typeFilter !== 'ALL' && m.menuType !== typeFilter) return false;
      if (statusFilter === 'ACTIVE' && !m.isActive) return false;
      if (statusFilter === 'INACTIVE' && m.isActive) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = m.code.toLowerCase().includes(q);
        const labelMatch = m.label.toLowerCase().includes(q);
        const routeMatch = (m.route || '').toLowerCase().includes(q);
        const iconMatch = (m.iconKey || '').toLowerCase().includes(q);
        if (!codeMatch && !labelMatch && !routeMatch && !iconMatch) return false;
      }

      return true;
    });
  }, [menus, scopeFilter, typeFilter, statusFilter, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = menus.length;
    const platform = menus.filter((m) => m.menuScope === 'PLATFORM').length;
    const tenant = menus.filter((m) => m.menuScope === 'TENANT').length;
    const active = menus.filter((m) => m.isActive).length;
    return { total, platform, tenant, active };
  }, [menus]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingMenu(null);
    setFormData({
      code: '',
      label: '',
      route: '',
      iconKey: 'dashboard',
      parentId: '',
      menuScope: 'TENANT',
      menuType: 'ITEM',
      displayOrder: (menus.length + 1) * 10,
      isActive: true,
      roles: ['TENANT_ADMIN'],
    });
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (menu: AppMenuItem) => {
    setEditingMenu(menu);
    setFormData({
      id: menu.id,
      code: menu.code,
      label: menu.label,
      route: menu.route || '',
      iconKey: menu.iconKey || 'circle',
      parentId: menu.parentId || '',
      menuScope: (menu.menuScope as any) || 'TENANT',
      menuType: (menu.menuType as any) || 'ITEM',
      displayOrder: menu.displayOrder ?? 10,
      isActive: Boolean(menu.isActive),
      roles: menu.roles || [],
    });
    setIsFormModalOpen(true);
  };

  // Open Role Access Modal
  const handleOpenRolesModal = (menu: AppMenuItem) => {
    setSelectedMenuForRoles(menu);
    setSelectedRoles(menu.roles || []);
    setIsRolesModalOpen(true);
  };

  // Save Menu (Create or Update)
  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.label.trim()) {
      showToast('Menu code and label are required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (editingMenu) {
        const res = await navigationApi.updatePlatformMenu(editingMenu.id, {
          label: formData.label.trim(),
          route: formData.route.trim() || undefined,
          iconKey: formData.iconKey.trim() || undefined,
          parentId: formData.parentId ? formData.parentId : null,
          menuScope: formData.menuScope,
          menuType: formData.menuType,
          displayOrder: Number(formData.displayOrder),
          isActive: formData.isActive,
          roles: formData.roles,
        });
        if (!res.success) throw new Error(res.error);
        showToast(`Menu "${formData.label}" updated successfully`);
      } else {
        const res = await navigationApi.createPlatformMenu({
          code: formData.code.trim().toUpperCase(),
          label: formData.label.trim(),
          route: formData.route.trim() || undefined,
          iconKey: formData.iconKey.trim() || undefined,
          parentId: formData.parentId ? formData.parentId : null,
          menuScope: formData.menuScope,
          menuType: formData.menuType,
          displayOrder: Number(formData.displayOrder),
          isActive: formData.isActive,
          roles: formData.roles,
        });
        if (!res.success) throw new Error(res.error);
        showToast(`Menu "${formData.label}" created successfully`);
      }

      setIsFormModalOpen(false);
      await loadMenus();
    } catch (err: any) {
      showToast(err.message || 'Operation failed', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Active Status Directly from row
  const handleToggleStatus = async (menu: AppMenuItem) => {
    try {
      const nextStatus = !menu.isActive;
      const res = await navigationApi.updatePlatformMenu(menu.id, {
        isActive: nextStatus,
      });
      if (!res.success) throw new Error(res.error);
      showToast(`Menu "${menu.label}" is now ${nextStatus ? 'active' : 'inactive'}`);
      await loadMenus();
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  // Save Role Access
  const handleSaveRoles = async () => {
    if (!selectedMenuForRoles) return;
    setIsSaving(true);
    try {
      const res = await navigationApi.updateMenuRoles(selectedMenuForRoles.id, selectedRoles);
      if (!res.success) throw new Error(res.error);
      showToast(`Role access updated for "${selectedMenuForRoles.label}"`);
      setIsRolesModalOpen(false);
      await loadMenus();
    } catch (err: any) {
      showToast(err.message || 'Failed to update role access', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete / Deactivate Menu
  const handleConfirmDelete = async () => {
    if (!menuToDelete) return;
    setIsSaving(true);
    try {
      const res = await navigationApi.deletePlatformMenu(menuToDelete.id);
      if (!res.success) throw new Error(res.error);
      showToast(`Menu "${menuToDelete.label}" deactivated successfully`);
      setIsDeleteModalOpen(false);
      setMenuToDelete(null);
      await loadMenus();
    } catch (err: any) {
      showToast(err.message || 'Failed to deactivate menu', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Parent menu lookup map
  const menuMap = useMemo(() => {
    const map = new Map<string, AppMenuItem>();
    menus.forEach((m) => map.set(m.id, m));
    return map;
  }, [menus]);

  return (
    <div className="space-y-6 font-['Inter',sans-serif] pb-16 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 animate-slide-up ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[11px] font-bold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] mb-1">
            <Link to="/admin/dashboard" className="hover:text-[#4744e5] transition-colors">
              Platform Admin
            </Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-[#1a1c1c]">Menu Management</span>
          </div>

          <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
            Menu & Navigation Management
          </h1>
          <p className="text-xs text-[#767587] mt-0.5">
            Database-authoritative navigation registry and role-based access control policies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadMenus}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Refresh menus from database"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-[#4744e5] hover:bg-[#322fce] text-white text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer font-['Hanken_Grotesk']"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Create Menu</span>
          </button>
        </div>
      </div>

      {/* METRICS / STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
          <span className="text-[10px] font-bold text-[#767587] uppercase tracking-wider">Total Menus</span>
          <div className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">{metrics.total}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Platform Scope</span>
          <div className="text-2xl font-extrabold text-purple-900 font-['Hanken_Grotesk'] mt-1">{metrics.platform}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
          <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Tenant Scope</span>
          <div className="text-2xl font-extrabold text-indigo-900 font-['Hanken_Grotesk'] mt-1">{metrics.tenant}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Active Menus</span>
          <div className="text-2xl font-extrabold text-emerald-900 font-['Hanken_Grotesk'] mt-1">{metrics.active}</div>
        </div>
      </div>

      {/* FILTER TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#767587]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, label, route, icon..."
              className="w-full pl-9 pr-3 py-2 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] placeholder:text-[#a0a0b0] focus:outline-none focus:border-[#4744e5]"
            />
          </div>

          {/* Scope Filter */}
          <div>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] font-medium focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All Scopes</option>
              <option value="PLATFORM">PLATFORM Only</option>
              <option value="TENANT">TENANT Only</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] font-medium focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All Types</option>
              <option value="MENU">MENU</option>
              <option value="SUBMENU">SUBMENU</option>
              <option value="ITEM">ITEM</option>
              <option value="DIVIDER">DIVIDER</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] font-medium focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* MENUS TABLE */}
      <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-4xl text-[#4744e5] animate-spin">progress_activity</span>
            <p className="text-xs text-[#767587] font-semibold">Loading menu configurations from database...</p>
          </div>
        ) : filteredMenus.length === 0 ? (
          <div className="py-16 text-center text-[#767587]">
            <span className="material-symbols-outlined text-4xl text-[#c0c0d0]">menu_open</span>
            <p className="font-semibold text-sm text-[#1a1c1c] mt-2">No menus match your filters</p>
            <p className="text-xs text-[#767587]">Try resetting search or scope filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E1E1E1] bg-[#f8f8fb] text-[#555468] font-bold text-[11px] uppercase tracking-wider font-['Hanken_Grotesk']">
                  <th className="px-4 py-3 text-center w-12">Order</th>
                  <th className="px-4 py-3">Menu Label & Code</th>
                  <th className="px-4 py-3">Route / URL</th>
                  <th className="px-4 py-3">Scope & Type</th>
                  <th className="px-4 py-3">Parent</th>
                  <th className="px-4 py-3">Allowed Roles</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E1E1]">
                {filteredMenus.map((m) => {
                  const parent = m.parentId ? menuMap.get(m.parentId) : null;
                  return (
                    <tr key={m.id} className="hover:bg-[#fcfcfd] transition-colors group">
                      {/* Order */}
                      <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-500">
                        {m.displayOrder ?? 0}
                      </td>

                      {/* Icon + Label + Code */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0 border border-slate-200">
                            <span className="material-symbols-outlined text-[18px]">
                              {m.iconKey || 'circle'}
                            </span>
                          </div>
                          <div>
                            <div className="font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] text-sm">
                              {m.label}
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {m.code}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Route */}
                      <td className="px-4 py-3.5">
                        {m.route ? (
                          <code className="text-[11px] bg-slate-50 text-indigo-700 px-2 py-1 rounded border border-slate-200 font-mono">
                            {m.route}
                          </code>
                        ) : (
                          <span className="text-[#a0a0b0] italic">—</span>
                        )}
                      </td>

                      {/* Scope & Type */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              m.menuScope === 'PLATFORM'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}
                          >
                            {m.menuScope}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            {m.menuType}
                          </span>
                        </div>
                      </td>

                      {/* Parent */}
                      <td className="px-4 py-3.5">
                        {parent ? (
                          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-slate-400">subdirectory_arrow_right</span>
                            {parent.label}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium text-[11px]">Root</span>
                        )}
                      </td>

                      {/* Allowed Roles */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(m.roles || []).length === 0 ? (
                            <span className="text-[11px] text-rose-500 font-semibold">No roles assigned</span>
                          ) : (
                            (m.roles || []).map((rCode) => {
                              const rDef = ALL_ROLES.find((r) => r.code === rCode);
                              return (
                                <span
                                  key={rCode}
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                    rDef?.color || 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {rDef?.label || rCode}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => handleToggleStatus(m)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border cursor-pointer transition-all ${
                            m.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                          }`}
                          title="Click to toggle status"
                        >
                          {m.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenRolesModal(m)}
                            className="p-1.5 text-slate-600 hover:text-[#4744e5] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Manage Role Access"
                          >
                            <span className="material-symbols-outlined text-[18px]">lock_person</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(m)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Menu"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => {
                              setMenuToDelete(m);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Deactivate / Delete Menu"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MENU MODAL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E1E1E1] max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E1E1E1] flex justify-between items-center bg-[#fcfcfd]">
              <div>
                <h3 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  {editingMenu ? 'Edit Menu Item' : 'Create New Menu Item'}
                </h3>
                <p className="text-xs text-[#767587]">
                  {editingMenu
                    ? `Updating menu configuration for ${editingMenu.code}`
                    : 'Register a new database-authoritative menu entry'}
                </p>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveMenu} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                {/* Code */}
                <div>
                  <label className="block text-[#464555] font-semibold mb-1">
                    Menu Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingMenu)}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                    placeholder="e.g. ALL_TASKS"
                    className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl bg-white text-[#1a1c1c] font-mono uppercase focus:outline-none focus:border-[#4744e5] disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                {/* Label */}
                <div>
                  <label className="block text-[#464555] font-semibold mb-1">
                    Label <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="e.g. All Tasks"
                    className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Route */}
                <div>
                  <label className="block text-[#464555] font-semibold mb-1">Route / Path</label>
                  <input
                    type="text"
                    value={formData.route}
                    onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                    placeholder="e.g. /tasks?scope=all"
                    className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl bg-white text-[#1a1c1c] font-mono focus:outline-none focus:border-[#4744e5]"
                  />
                </div>

                {/* Icon Key */}
                <div>
                  <label className="block text-[#464555] font-semibold mb-1">Material Icon Key</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={formData.iconKey}
                      onChange={(e) => setFormData({ ...formData, iconKey: e.target.value })}
                      placeholder="e.g. task_alt"
                      className="flex-1 px-3 py-2 border border-[#E1E1E1] rounded-xl bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
                    />
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">
                        {formData.iconKey || 'circle'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Menu Scope */}
                <div>
                  <label className="block text-[#464555] font-semibold mb-1">Scope</label>
                  <select
                    value={formData.menuScope}
                    onChange={(e) => setFormData({ ...formData, menuScope: e.target.value as any })}
                    className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl bg-white text-[#1a1c1c] font-semibold focus:outline-none focus:border-[#4744e5]"
                  >
                    <option value="TENANT">TENANT</option>
                    <option value="PLATFORM">PLATFORM</option>
                  </select>
                </div>

                {/* Menu Type */}
                <div>
                  <label className="block text-[#464555] font-semibold mb-1">Type</label>
                  <select
                    value={formData.menuType}
                    onChange={(e) => setFormData({ ...formData, menuType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl bg-white text-[#1a1c1c] font-semibold focus:outline-none focus:border-[#4744e5]"
                  >
                    <option value="ITEM">ITEM</option>
                    <option value="MENU">MENU</option>
                    <option value="SUBMENU">SUBMENU</option>
                    <option value="DIVIDER">DIVIDER</option>
                  </select>
                </div>

                {/* Display Order */}
                <div>
                  <label className="block text-[#464555] font-semibold mb-1">Display Order</label>
                  <input
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl bg-white text-[#1a1c1c] font-mono focus:outline-none focus:border-[#4744e5]"
                  />
                </div>
              </div>

              {/* Parent Menu */}
              <div>
                <label className="block text-[#464555] font-semibold mb-1">Parent Menu (Optional)</label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl bg-white text-[#1a1c1c] font-medium focus:outline-none focus:border-[#4744e5]"
                >
                  <option value="">None (Root Item)</option>
                  {menus
                    .filter((m) => !editingMenu || m.id !== editingMenu.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        [{m.menuScope}] {m.label} ({m.code})
                      </option>
                    ))}
                </select>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded text-[#4744e5] focus:ring-[#4744e5]"
                />
                <label htmlFor="isActiveToggle" className="font-semibold text-slate-700 cursor-pointer">
                  Menu is Active & Visible
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 border border-[#E1E1E1] text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-[#4744e5] hover:bg-[#322fce] text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                  <span>{editingMenu ? 'Save Changes' : 'Create Menu'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROLE ACCESS MODAL */}
      {isRolesModalOpen && selectedMenuForRoles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E1E1E1] max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E1E1E1] flex justify-between items-center bg-[#fcfcfd]">
              <div>
                <h3 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Role-Based Menu Permissions
                </h3>
                <p className="text-xs text-[#767587]">
                  Configure visibility for <strong className="text-slate-800">{selectedMenuForRoles.label}</strong>
                </p>
              </div>
              <button
                onClick={() => setIsRolesModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Check each role that should have access to this menu. Unchecked roles will not see or access this route.
              </p>

              <div className="space-y-2">
                {ALL_ROLES.map((r) => {
                  const isChecked = selectedRoles.includes(r.code);
                  return (
                    <label
                      key={r.code}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        isChecked ? 'bg-indigo-50/40 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRoles([...selectedRoles, r.code]);
                            } else {
                              setSelectedRoles(selectedRoles.filter((code) => code !== r.code));
                            }
                          }}
                          className="w-4 h-4 rounded text-[#4744e5] focus:ring-[#4744e5]"
                        />
                        <div>
                          <div className="text-xs font-bold text-[#1a1c1c]">{r.label}</div>
                          <span className="text-[10px] font-mono text-slate-500">{r.code}</span>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${r.color}`}>
                        {isChecked ? 'Allowed' : 'Denied'}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setIsRolesModalOpen(false)}
                  className="px-4 py-2 border border-[#E1E1E1] text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveRoles}
                  className="px-4 py-2 bg-[#4744e5] hover:bg-[#322fce] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                  <span>Save Role Access</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE / DEACTIVATE MODAL */}
      {isDeleteModalOpen && menuToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E1E1E1] max-w-sm w-full p-6 space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[24px]">warning</span>
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Deactivate Menu?
              </h3>
              <p className="text-xs text-[#767587] mt-1">
                Are you sure you want to deactivate <strong className="text-[#1a1c1c]">{menuToDelete.label}</strong>? Users will no longer see this in their navigation bar.
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setMenuToDelete(null);
                }}
                className="px-4 py-2 border border-[#E1E1E1] text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSaving && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                <span>Deactivate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

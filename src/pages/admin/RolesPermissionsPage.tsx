import React, { useState, useEffect, useMemo } from 'react';
import { rolesApi } from '../../services/rolesApi';
import { useAuth } from '../../context/AuthContext';
import { RolePermissions, PermissionDefinition, UserRole } from '../../types';

export const RolesPermissionsPage: React.FC = () => {
  const { currentTenant, currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const tenantId = isSuperAdmin ? 'SYSTEM' : (currentTenant?.id || currentUser?.tenantId || 'TEN-00001');

  // Core Data States
  const [rolesList, setRolesList] = useState<RolePermissions[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('TENANT_ADMIN');
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Tabs for Super Admin & Filter Tabs for Tenant Admin
  const [superAdminTab, setSuperAdminTab] = useState<'PLATFORM' | 'TEMPLATES' | 'CATALOG'>('PLATFORM');
  const [tenantRoleFilter, setTenantRoleFilter] = useState<'ALL' | 'DEFAULT' | 'CUSTOM'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RolePermissions | null>(null);
  const [editingRoleNameObj, setEditingRoleNameObj] = useState<{ roleId: string; currentName: string } | null>(null);

  // Add New Role Form State
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRoleDataScope, setNewRoleDataScope] = useState<'OWN' | 'TEAM' | 'DEPARTMENT' | 'ORGANIZATION'>('TEAM');
  const [newRoleSelectedPerms, setNewRoleSelectedPerms] = useState<string[]>([]);
  const [addFormError, setAddFormError] = useState('');

  // Edit Role Form State
  const [editRoleNameInput, setEditRoleNameInput] = useState('');
  const [editNameError, setEditNameError] = useState('');

  const triggerToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorToast(msg);
      setTimeout(() => setErrorToast(null), 4000);
    } else {
      setSavedToast(msg);
      setTimeout(() => setSavedToast(null), 3500);
    }
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [aggregatedRoles, catalog] = await Promise.all([
        rolesApi.getAggregatedRolePermissions(tenantId),
        rolesApi.fetchPermissions()
      ]);
      setRolesList(aggregatedRoles);
      setPermissionCatalog(catalog);

      if (aggregatedRoles.length > 0) {
        if (!selectedRole || !aggregatedRoles.some(r => r.role === selectedRole)) {
          setSelectedRole(aggregatedRoles[0].role);
        }
      }
    } catch (err: any) {
      triggerToast('Unable to load roles and permission catalog. Please check network connection.', true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [tenantId]);

  // Selected Active Role Record
  const activeRoleData = useMemo(() => {
    return rolesList.find(r => r.role === selectedRole) || rolesList[0];
  }, [rolesList, selectedRole]);

  // Group permission catalog by module
  const catalogByModule = useMemo(() => {
    const map: Record<string, PermissionDefinition[]> = {};
    permissionCatalog.forEach(p => {
      const mod = p.module || 'GENERAL';
      if (!map[mod]) map[mod] = [];
      map[mod].push(p);
    });
    return map;
  }, [permissionCatalog]);

  // Tenant Admin Core Mandatory Permissions (Cannot be revoked)
  const isDefaultTenantAdmin = useMemo(() => {
    if (!activeRoleData) return false;
    return activeRoleData.role === 'TENANT_ADMIN' || activeRoleData.role.endsWith('-TENANT_ADMIN');
  }, [activeRoleData]);

  const mandatoryTenantAdminPerms = ['MANAGE_TENANT', 'MANAGE_USERS', 'MANAGE_ROLES'];

  // Toggle specific permission code for the active role
  const handleTogglePermissionCode = async (permCode: string) => {
    if (!activeRoleData || isSaving) return;

    // Guard: Required Tenant Admin permissions cannot be unchecked
    if (isDefaultTenantAdmin && mandatoryTenantAdminPerms.includes(permCode) && activeRoleData.assignedPermissions?.includes(permCode)) {
      triggerToast('Required administrative permission cannot be removed from default Tenant Administrator.', true);
      return;
    }

    const currentPerms = activeRoleData.assignedPermissions || [];
    const isCurrentlyChecked = currentPerms.includes(permCode);
    const updatedPerms = isCurrentlyChecked
      ? currentPerms.filter(p => p !== permCode)
      : [...currentPerms, permCode];

    // Optimistic state update
    const updatedRolesList = rolesList.map(r => {
      if (r.role !== selectedRole) return r;
      return { ...r, assignedPermissions: updatedPerms };
    });
    setRolesList(updatedRolesList);

    setIsSaving(true);
    const success = await rolesApi.updateRoleDirectPermissions(selectedRole, updatedPerms, activeRoleData.dataScope);
    setIsSaving(false);

    if (success) {
      triggerToast(`Permission "${permCode}" updated successfully.`);
    } else {
      triggerToast('Failed to save permission change to server. Reverting...', true);
      loadAllData();
    }
  };

  // Toggle all permissions within a module
  const handleToggleModuleAll = async (modulePerms: PermissionDefinition[]) => {
    if (!activeRoleData || isSaving) return;

    const currentPerms = activeRoleData.assignedPermissions || [];
    const moduleCodes = modulePerms.map(p => p.code);
    const allChecked = moduleCodes.every(c => currentPerms.includes(c));

    let updatedPerms: string[];
    if (allChecked) {
      // Uncheck all in module (except mandatory if tenant admin)
      updatedPerms = currentPerms.filter(c => {
        if (!moduleCodes.includes(c)) return true;
        if (isDefaultTenantAdmin && mandatoryTenantAdminPerms.includes(c)) return true;
        return false;
      });
    } else {
      // Check all in module
      const toAdd = moduleCodes.filter(c => !currentPerms.includes(c));
      updatedPerms = [...currentPerms, ...toAdd];
    }

    const updatedRolesList = rolesList.map(r => {
      if (r.role !== selectedRole) return r;
      return { ...r, assignedPermissions: updatedPerms };
    });
    setRolesList(updatedRolesList);

    setIsSaving(true);
    const success = await rolesApi.updateRoleDirectPermissions(selectedRole, updatedPerms, activeRoleData.dataScope);
    setIsSaving(false);

    if (success) {
      triggerToast('Module permissions updated successfully.');
    } else {
      triggerToast('Failed to save module permissions.', true);
      loadAllData();
    }
  };

  // Update Data Scope
  const handleScopeChange = async (newScope: 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ORGANIZATION' | 'SYSTEM') => {
    if (!activeRoleData || isSaving) return;
    if (newScope === 'SYSTEM' && !isSuperAdmin) {
      triggerToast('SYSTEM data scope is restricted exclusively to platform superusers.', true);
      return;
    }

    const updatedRolesList = rolesList.map(r => {
      if (r.role !== selectedRole) return r;
      return { ...r, dataScope: newScope };
    });
    setRolesList(updatedRolesList);

    setIsSaving(true);
    const success = await rolesApi.updateRoleDirectPermissions(
      selectedRole,
      activeRoleData.assignedPermissions || [],
      newScope
    );
    setIsSaving(false);

    if (success) {
      triggerToast(`Data access scope updated to ${newScope}.`);
    } else {
      triggerToast('Failed to update data scope.', true);
      loadAllData();
    }
  };

  // Handle Add Role Submit
  const handleAddRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError('');

    if (!newRoleName.trim()) {
      setAddFormError('Role Display Name is required.');
      return;
    }

    const trimmedKey = newRoleKey.trim() || newRoleName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const existing = rolesList.find(r => r.roleName.toLowerCase() === newRoleName.trim().toLowerCase());
    if (existing) {
      setAddFormError(`A role named "${newRoleName.trim()}" already exists in this organization.`);
      return;
    }

    const roleId = `ROLE-${tenantId}-${trimmedKey}-${Date.now().toString().slice(-4)}`;
    setIsSaving(true);

    try {
      const createRes = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: roleId,
          tenantId: isSuperAdmin ? null : tenantId,
          name: newRoleName.trim(),
          description: newRoleDescription.trim() || `Custom organization role for ${newRoleName.trim()}.`,
          isSystem: false,
          scope: 'TENANT'
        })
      });

      if (!createRes.ok) {
        throw new Error('Failed to create role entity.');
      }

      await rolesApi.updateRoleDirectPermissions(
        roleId,
        newRoleSelectedPerms.length > 0 ? newRoleSelectedPerms : ['VIEW_ALL_CUSTOMERS', 'VIEW_REPORTS'],
        newRoleDataScope
      );

      setIsAddModalOpen(false);
      setNewRoleName('');
      setNewRoleKey('');
      setNewRoleDescription('');
      setNewRoleSelectedPerms([]);
      triggerToast(`Custom role "${newRoleName.trim()}" successfully created!`);
      await loadAllData();
      setSelectedRole(roleId);
    } catch (err: any) {
      setAddFormError(err.message || 'Role creation failed.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Edit Role Name
  const handleEditRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditNameError('');

    if (!editingRoleNameObj) return;
    if (!editRoleNameInput.trim()) {
      setEditNameError('Role name cannot be empty.');
      return;
    }

    try {
      const res = await fetch(`/api/roles/${editingRoleNameObj.roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editRoleNameInput.trim() })
      });
      if (!res.ok) throw new Error('Update failed');
      setEditingRoleNameObj(null);
      triggerToast(`Role name updated to "${editRoleNameInput.trim()}".`);
      await loadAllData();
    } catch (err: any) {
      setEditNameError('Unable to update role name.');
    }
  };

  // Handle Role Deletion
  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    if (roleToDelete.isSystem || roleToDelete.role === 'SUPER_ADMIN' || roleToDelete.role === 'TENANT_ADMIN') {
      triggerToast('System default and protected administrative roles cannot be deleted.', true);
      setIsDeleteModalOpen(false);
      return;
    }

    if (roleToDelete.memberCount && roleToDelete.memberCount > 0) {
      triggerToast(`Cannot delete role: ${roleToDelete.memberCount} active user(s) are currently assigned. Reassign them first.`, true);
      setIsDeleteModalOpen(false);
      return;
    }

    try {
      const res = await fetch(`/api/roles/${roleToDelete.role}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Deletion failed');
      setIsDeleteModalOpen(false);
      setRoleToDelete(null);
      triggerToast(`Role "${roleToDelete.roleName}" was successfully removed.`);
      await loadAllData();
    } catch (err) {
      triggerToast('Failed to delete role.', true);
    }
  };

  // Scope Option Definitions with clear visual explanations
  const scopeOptions: {
    key: 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ORGANIZATION' | 'SYSTEM';
    title: string;
    description: string;
    badge: string;
    superAdminOnly?: boolean;
  }[] = [
    {
      key: 'OWN',
      title: 'Own Records',
      description: 'User can only view and manage records they have personally created or are assigned as PIC.',
      badge: 'Individual'
    },
    {
      key: 'TEAM',
      title: 'Team Scope',
      description: "Visibility over records owned by members of the user's immediate assigned team.",
      badge: 'Team Level'
    },
    {
      key: 'DEPARTMENT',
      title: 'Department Scope',
      description: "Broader access across all sales teams and members within the user's department.",
      badge: 'Departmental'
    },
    {
      key: 'ORGANIZATION',
      title: 'Entire Organization',
      description: 'Unrestricted visibility across all departments and records within this tenant organization.',
      badge: 'Tenant-Wide'
    },
    {
      key: 'SYSTEM',
      title: 'Platform System Wide',
      description: 'Complete unrestricted access across all tenants in the SalesFlow Pro cloud platform.',
      badge: 'Platform Only',
      superAdminOnly: true
    }
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-[#767587] h-full min-h-[500px]">
        <span className="material-symbols-outlined text-4xl animate-spin text-[#4744e5]">progress_activity</span>
        <span className="mt-4 text-sm font-semibold font-['Hanken_Grotesk'] text-[#1a1c1c]">Loading RBAC Architecture...</span>
        <span className="text-xs text-[#767587] mt-1">Syncing permissions catalog and role matrices</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-['Inter',sans-serif] pb-16">
      {/* Toast Alerts */}
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-[#00C875] text-white px-5 py-3 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          <span>{savedToast}</span>
        </div>
      )}
      {errorToast && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-[#ba1a1a] text-white px-5 py-3 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{errorToast}</span>
        </div>
      )}

      {/* HEADER BANNER */}
      <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#4744e5]/10 text-[#4744e5] text-[11px] font-bold rounded-md uppercase tracking-wider">
              {isSuperAdmin ? 'Platform RBAC Control' : 'Tenant Security Matrix'}
            </span>
            {isSuperAdmin && (
              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded">
                Super Admin Console
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1.5">
            Roles & Permissions Architecture
          </h1>
          <p className="text-xs text-[#5f6368] mt-0.5 max-w-2xl leading-relaxed">
            {isSuperAdmin
              ? 'Manage platform superusers, blueprint tenant role templates for newly provisioned organizations, and the authoritative master catalog.'
              : 'Configure access levels, feature authorizations, and vertical data visibility scopes for users in your organization.'}
          </p>
        </div>

        {!isSuperAdmin && (
          <button
            onClick={() => {
              setNewRoleName('');
              setNewRoleKey('');
              setNewRoleDescription('');
              setNewRoleDataScope('TEAM');
              setNewRoleSelectedPerms([]);
              setAddFormError('');
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2.5 bg-[#4744e5] hover:bg-[#2c24ce] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 font-['Hanken_Grotesk'] shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Create Custom Role</span>
          </button>
        )}
      </div>

      {/* SEGMENTED NAVIGATION TABS */}
      {isSuperAdmin ? (
        <div className="flex items-center gap-2 border-b border-[#E1E1E1] pb-2">
          <button
            onClick={() => setSuperAdminTab('PLATFORM')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              superAdminTab === 'PLATFORM'
                ? 'bg-[#4744e5] text-white shadow-sm'
                : 'bg-white text-[#464555] hover:bg-[#f3f3f3] border border-[#E1E1E1]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">shield_person</span>
            <span>Platform Roles</span>
          </button>

          <button
            onClick={() => setSuperAdminTab('TEMPLATES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              superAdminTab === 'TEMPLATES'
                ? 'bg-[#4744e5] text-white shadow-sm'
                : 'bg-white text-[#464555] hover:bg-[#f3f3f3] border border-[#E1E1E1]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">dataset</span>
            <span>Tenant Role Templates (Blueprints)</span>
          </button>

          <button
            onClick={() => setSuperAdminTab('CATALOG')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              superAdminTab === 'CATALOG'
                ? 'bg-[#4744e5] text-white shadow-sm'
                : 'bg-white text-[#464555] hover:bg-[#f3f3f3] border border-[#E1E1E1]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">list_alt</span>
            <span>Permission Master Catalog ({permissionCatalog.length})</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            {(['ALL', 'DEFAULT', 'CUSTOM'] as const).map(filterKey => (
              <button
                key={filterKey}
                onClick={() => setTenantRoleFilter(filterKey)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  tenantRoleFilter === filterKey
                    ? 'bg-[#1a1c1c] text-white shadow-sm'
                    : 'bg-white text-[#464555] hover:bg-[#f3f3f3] border border-[#E1E1E1]'
                }`}
              >
                {filterKey === 'ALL' ? 'All Roles' : filterKey === 'DEFAULT' ? 'Default Roles' : 'Custom Roles'}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#767587] text-[18px]">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search roles..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#E1E1E1] rounded-xl text-xs focus:outline-none focus:border-[#4744e5]"
            />
          </div>
        </div>
      )}

      {/* VIEW A: SUPER ADMIN PERMISSION MASTER CATALOG */}
      {isSuperAdmin && superAdminTab === 'CATALOG' && (
        <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#E1E1E1] pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Authoritative Permission Master Catalog
              </h2>
              <p className="text-xs text-[#767587] mt-0.5">
                Every authorization capability registered in SalesFlow Pro. Read-only platform master registry.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#767587] text-[18px]">search</span>
              <input
                type="text"
                value={catalogSearchQuery}
                onChange={e => setCatalogSearchQuery(e.target.value)}
                placeholder="Filter catalog permissions..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#E1E1E1] rounded-xl text-xs focus:outline-none focus:border-[#4744e5]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f9f9f9] text-[#464555] font-bold uppercase border-b border-[#E1E1E1]">
                <tr>
                  <th className="px-4 py-3">Permission Code</th>
                  <th className="px-4 py-3">Display Name</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-3 py-3 text-center">Tenant Assignable</th>
                  <th className="px-3 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E1E1]">
                {permissionCatalog
                  .filter(p => {
                    if (!catalogSearchQuery) return true;
                    const q = catalogSearchQuery.toLowerCase();
                    return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.module.toLowerCase().includes(q);
                  })
                  .map(p => (
                    <tr key={p.code} className="hover:bg-[#f9f9f9] transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#4744e5]">{p.code}</td>
                      <td className="px-4 py-3 font-semibold text-[#1a1c1c]">
                        <div>{p.name}</div>
                        <div className="text-[11px] text-[#767587] font-normal mt-0.5">{p.description}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#464555]">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] uppercase font-bold">{p.module}</span>
                      </td>
                      <td className="px-4 py-3 text-[#464555]">{p.category}</td>
                      <td className="px-3 py-3 text-center">
                        {p.isTenantAssignable ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded">Yes</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded">Platform Only</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded uppercase">{p.status}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW B & C: ROLE EXPLORER (PLATFORM ROLES, TEMPLATES, TENANT ROLES) */}
      {(!isSuperAdmin || superAdminTab !== 'CATALOG') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT PANE: ROLE SELECTOR CARDS */}
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-[11px] font-bold text-[#464555] uppercase tracking-wider block font-['Hanken_Grotesk']">
                {isSuperAdmin
                  ? superAdminTab === 'PLATFORM' ? 'Platform Roles' : 'Tenant Role Templates'
                  : `Organization Roles (${rolesList.length})`}
              </span>
            </div>

            {/* Role List */}
            <div className="space-y-2.5">
              {rolesList
                .filter(r => {
                  if (isSuperAdmin) {
                    if (superAdminTab === 'PLATFORM') return r.scope === 'SYSTEM' || r.role === 'SUPER_ADMIN';
                    if (superAdminTab === 'TEMPLATES') return r.scope === 'TEMPLATE';
                  } else {
                    if (tenantRoleFilter === 'DEFAULT') return r.isSystem;
                    if (tenantRoleFilter === 'CUSTOM') return !r.isSystem;
                    if (searchQuery) {
                      const q = searchQuery.toLowerCase();
                      return r.roleName.toLowerCase().includes(q) || r.role.toLowerCase().includes(q);
                    }
                  }
                  return true;
                })
                .map(r => {
                  const isSelected = r.role === selectedRole;
                  const isPlatform = r.scope === 'SYSTEM' || r.role === 'SUPER_ADMIN';
                  const isTemplate = r.scope === 'TEMPLATE';
                  const isDefault = !isPlatform && !isTemplate && r.isSystem;
                  const isCustom = !isPlatform && !isTemplate && !r.isSystem;

                  return (
                    <div
                      key={r.role}
                      onClick={() => setSelectedRole(r.role)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all relative group ${
                        isSelected
                          ? 'bg-white border-[#4744e5] ring-2 ring-[#4744e5]/10 shadow-sm'
                          : 'bg-white border-[#E1E1E1] hover:border-[#c7c4d8]'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-[#1a1c1c] font-['Hanken_Grotesk']">
                              {r.roleName}
                            </h3>
                            {isPlatform && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 uppercase flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">lock</span>
                                Platform
                              </span>
                            )}
                            {isTemplate && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 uppercase">
                                Template
                              </span>
                            )}
                            {isDefault && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 uppercase">
                                Default
                              </span>
                            )}
                            {isCustom && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 uppercase">
                                Custom
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-[#767587] flex items-center gap-3">
                            <span className="flex items-center gap-1 font-semibold">
                              <span className="material-symbols-outlined text-[14px]">group</span>
                              {r.memberCount || 0} Member{(r.memberCount || 0) === 1 ? '' : 's'}
                            </span>
                            <span>•</span>
                            <span className="font-semibold">
                              {r.assignedPermissions?.length || 0} Permission{(r.assignedPermissions?.length || 0) === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 font-mono ${
                            isSelected ? 'bg-[#4744e5] text-white' : 'bg-[#f3f3f3] text-[#464555]'
                          }`}
                        >
                          {r.dataScope}
                        </span>
                      </div>

                      <p className="text-[11px] text-[#767587] mt-2 line-clamp-2 leading-relaxed">
                        {r.description || (isPlatform ? 'Unrestricted platform superuser capability.' : 'Configured organizational access role.')}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* RIGHT PANE: ROLE DETAIL & PERMISSION MANAGER */}
          <div className="lg:col-span-2 space-y-6">
            {activeRoleData && (
              <>
                {/* Snapshot behavior explanation banner for templates */}
                {activeRoleData.scope === 'TEMPLATE' && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5">info</span>
                    <div>
                      <div className="font-bold font-['Hanken_Grotesk']">Snapshot Template Notice</div>
                      <div className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Changes to this template will apply as default presets to newly provisioned tenants. Existing organizations maintain their independent cloned role instances and will not be altered.
                      </div>
                    </div>
                  </div>
                )}

                {/* Role Header Detail Card */}
                <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E1E1E1] pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                          {activeRoleData.roleName}
                        </h2>
                        {activeRoleData.scope === 'SYSTEM' ? (
                          <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">lock</span>
                            Protected Platform Role
                          </span>
                        ) : activeRoleData.isSystem ? (
                          <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">verified</span>
                            Default Protected Role
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg">
                            Custom Tenant Role
                          </span>
                        )}

                        {/* Edit Role Name for Custom Roles */}
                        {!activeRoleData.isSystem && activeRoleData.scope === 'TENANT' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRoleNameObj({ roleId: activeRoleData.role, currentName: activeRoleData.roleName });
                              setEditRoleNameInput(activeRoleData.roleName);
                              setEditNameError('');
                            }}
                            className="p-1 text-[#767587] hover:text-[#4744e5] hover:bg-[#4744e5]/10 rounded-lg transition-all"
                            title="Edit Role Name"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-[#767587] mt-1 leading-relaxed">
                        {activeRoleData.description || 'Configured role profile for organization users.'}
                      </p>
                    </div>

                    {/* Delete action for custom roles */}
                    {!activeRoleData.isSystem && activeRoleData.scope === 'TENANT' && (
                      <button
                        onClick={() => {
                          setRoleToDelete(activeRoleData);
                          setIsDeleteModalOpen(true);
                        }}
                        className="px-3 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        <span>Delete Role</span>
                      </button>
                    )}
                  </div>

                  {/* Impact Warning */}
                  <div className="flex items-center gap-2 text-[11px] text-[#5f6368] bg-[#f9f9f9] p-3 rounded-xl">
                    <span className="material-symbols-outlined text-[16px] text-[#4744e5]">shield</span>
                    <span>
                      Modifications to permissions or data scope will take effect across <strong>{activeRoleData.memberCount || 0} assigned user(s)</strong> on their next request.
                    </span>
                  </div>
                </div>

                {/* DATA SCOPE CONFIGURATION */}
                <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                        Data Visibility Scope
                      </h3>
                      <p className="text-xs text-[#767587] mt-0.5">
                        Controls vertical boundary of records (own, team, or organization-wide) visible to this role.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {scopeOptions
                      .filter(opt => !opt.superAdminOnly || isSuperAdmin)
                      .map(opt => {
                        const isSelected = activeRoleData.dataScope === opt.key;
                        const isLockedSystem = activeRoleData.role === 'SUPER_ADMIN';

                        return (
                          <div
                            key={opt.key}
                            onClick={() => !isLockedSystem && handleScopeChange(opt.key)}
                            className={`p-4 rounded-xl border transition-all select-none flex items-start gap-3.5 ${
                              isSelected
                                ? 'border-2 border-[#4744e5] bg-[#4744e5]/[0.03] shadow-sm'
                                : 'border-[#E1E1E1] bg-white hover:border-[#b0b0b0]'
                            } ${isLockedSystem ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                isSelected ? 'border-[#4744e5] bg-[#4744e5]' : 'border-[#b0b0b0] bg-white'
                              }`}
                            >
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs sm:text-sm text-[#1a1c1c] font-['Hanken_Grotesk']">
                                  {opt.title}
                                </span>
                                <span className="text-[9px] font-bold px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                                  {opt.badge}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#767587] leading-relaxed mt-1">
                                {opt.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* PERMISSION MATRIX MODULE ACCORDION */}
                <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-sm space-y-5">
                  <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
                    <div>
                      <h3 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                        Assigned Permissions by Functional Module
                      </h3>
                      <p className="text-xs text-[#767587] mt-0.5">
                        Authoritative capabilities assigned from the Permission Master Catalog.
                      </p>
                    </div>
                  </div>

                  {activeRoleData.role === 'SUPER_ADMIN' ? (
                    /* Super Admin Full Platform Capability Card */
                    <div className="p-6 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-indigo-600 text-xl">all_inclusive</span>
                        <span className="font-bold text-sm text-indigo-950 font-['Hanken_Grotesk']">
                          ALL — Full Platform Superuser Privilege
                        </span>
                      </div>
                      <p className="text-xs text-indigo-900/80 leading-relaxed">
                        The Super Administrator persona automatically holds universal platform capability across all system entities, multi-tenant administrative boundaries, and security policies.
                      </p>
                    </div>
                  ) : (
                    /* Module by Module Permission Checkboxes */
                    <div className="space-y-6">
                      {Object.entries(catalogByModule)
                        .filter(([mod]) => isSuperAdmin || mod !== 'PLATFORM')
                        .map(([moduleName, perms]) => {
                          const allChecked = perms.every(p => activeRoleData.assignedPermissions?.includes(p.code));

                          return (
                            <div key={moduleName} className="border border-[#E1E1E1] rounded-2xl p-4.5 space-y-3 bg-[#fafafa]/50">
                              <div className="flex justify-between items-center border-b border-[#E1E1E1]/80 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-[18px] text-[#4744e5]">folder_special</span>
                                  <span className="font-bold text-xs text-[#1a1c1c] uppercase tracking-wider font-['Hanken_Grotesk']">
                                    {moduleName} Module
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-200/70 text-gray-700 rounded-full">
                                    {perms.filter(p => activeRoleData.assignedPermissions?.includes(p.code)).length} / {perms.length} Active
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleToggleModuleAll(perms)}
                                  className="text-[11px] font-bold text-[#4744e5] hover:text-[#2c24ce] hover:underline"
                                >
                                  {allChecked ? 'Deselect All' : 'Select All'}
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {perms.map(p => {
                                  const isChecked = activeRoleData.assignedPermissions?.includes(p.code);
                                  const isMandatory = isDefaultTenantAdmin && mandatoryTenantAdminPerms.includes(p.code);

                                  return (
                                    <div
                                      key={p.code}
                                      onClick={() => !isMandatory && handleTogglePermissionCode(p.code)}
                                      className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 select-none ${
                                        isChecked
                                          ? 'border-[#4744e5]/40 bg-white shadow-2xs'
                                          : 'border-[#E1E1E1] bg-white opacity-70 hover:opacity-100 hover:border-[#c7c4d8]'
                                      } ${isMandatory ? 'cursor-not-allowed bg-amber-50/40 border-amber-200' : 'cursor-pointer'}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        disabled={isMandatory}
                                        onChange={() => handleTogglePermissionCode(p.code)}
                                        className="mt-0.5 w-4 h-4 rounded text-[#4744e5] focus:ring-0 cursor-pointer disabled:cursor-not-allowed"
                                      />

                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-xs text-[#1a1c1c] font-['Hanken_Grotesk']">
                                            {p.name}
                                          </span>
                                          {isMandatory && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded flex items-center gap-0.5">
                                              <span className="material-symbols-outlined text-[10px]">lock</span>
                                              Required
                                            </span>
                                          )}
                                        </div>
                                        <div className="font-mono text-[10px] text-[#4744e5] font-semibold">{p.code}</div>
                                        <p className="text-[11px] text-[#767587] leading-relaxed">
                                          {p.description}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: ADD NEW ROLE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl border border-[#E1E1E1] shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#4744e5]/10 text-[#4744e5] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">add_moderator</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                    Create Custom Organization Role
                  </h3>
                  <p className="text-[11px] text-[#767587]">Define role title, data boundary, and select permitted capabilities.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#767587] hover:text-[#1a1c1c] p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {addFormError && (
              <div className="p-3 bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 rounded-xl text-xs text-[#ba1a1a] font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{addFormError}</span>
              </div>
            )}

            <form onSubmit={handleAddRoleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                  Role Title <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newRoleName}
                  onChange={e => {
                    setNewRoleName(e.target.value);
                    if (!newRoleKey) {
                      setNewRoleKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '_'));
                    }
                  }}
                  placeholder="e.g. Senior Regional Sales Executive"
                  className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-xl text-xs focus:outline-none focus:border-[#4744e5]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                  Default Data Scope Boundary <span className="text-[#ba1a1a]">*</span>
                </label>
                <select
                  value={newRoleDataScope}
                  onChange={e => setNewRoleDataScope(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
                >
                  <option value="OWN">Own Records (Assigned PIC Records Only)</option>
                  <option value="TEAM">Team Scope (Assigned Team Records)</option>
                  <option value="DEPARTMENT">Department Scope (Department-Wide)</option>
                  <option value="ORGANIZATION">Organization Scope (All Tenant Records)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newRoleDescription}
                  onChange={e => setNewRoleDescription(e.target.value)}
                  placeholder="Describe operational responsibilities for this role..."
                  className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-xl text-xs focus:outline-none focus:border-[#4744e5]"
                />
              </div>

              <div className="pt-3 border-t border-[#E1E1E1] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-[#E1E1E1] hover:bg-[#f3f3f3] text-[#1a1c1c] font-bold text-xs rounded-xl transition-all font-['Hanken_Grotesk']"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#4744e5] hover:bg-[#2c24ce] text-white font-bold text-xs rounded-xl shadow-sm transition-all font-['Hanken_Grotesk'] disabled:opacity-50"
                >
                  {isSaving ? 'Creating Role...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT ROLE NAME MODAL */}
      {editingRoleNameObj && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-[#E1E1E1] shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h3 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Rename Role
              </h3>
              <button
                type="button"
                onClick={() => setEditingRoleNameObj(null)}
                className="text-[#767587] hover:text-[#1a1c1c] p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {editNameError && (
              <div className="p-3 bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 rounded-xl text-xs text-[#ba1a1a] font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{editNameError}</span>
              </div>
            )}

            <form onSubmit={handleEditRoleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                  Role Display Name
                </label>
                <input
                  type="text"
                  required
                  value={editRoleNameInput}
                  onChange={e => setEditRoleNameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-xl text-xs focus:outline-none focus:border-[#4744e5]"
                />
              </div>

              <div className="pt-3 border-t border-[#E1E1E1] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRoleNameObj(null)}
                  className="px-4 py-2 border border-[#E1E1E1] hover:bg-[#f3f3f3] text-[#1a1c1c] font-bold text-xs rounded-xl font-['Hanken_Grotesk']"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4744e5] hover:bg-[#2c24ce] text-white font-bold text-xs rounded-xl shadow-sm font-['Hanken_Grotesk']"
                >
                  Save Title
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && roleToDelete && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-[#E1E1E1] shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">warning</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Delete Role "{roleToDelete.roleName}"?
                </h3>
                <p className="text-xs text-[#767587] mt-0.5">
                  Are you sure you want to remove this custom role definition?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 leading-relaxed">
              This action permanently deletes the role configuration. Any permissions attached will be revoked.
            </div>

            <div className="pt-3 border-t border-[#E1E1E1] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 border border-[#E1E1E1] hover:bg-[#f3f3f3] text-[#1a1c1c] font-bold text-xs rounded-xl font-['Hanken_Grotesk']"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRole}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm font-['Hanken_Grotesk']"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

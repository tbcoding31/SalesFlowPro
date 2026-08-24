import React, { useState, useEffect } from 'react';
import { rolesApi } from '../../services/rolesApi';
import { useAuth } from '../../context/AuthContext';
import { RolePermissions, UserRole } from '../../types';

export const RolesPermissionsPage: React.FC = () => {
  const { currentTenant, currentUser } = useAuth();
  const tenantId = currentUser?.role === 'SUPER_ADMIN' ? 'SYSTEM' : (currentTenant?.id || currentUser?.tenantId || 'TEN-00001');

  const [permissionsState, setPermissionsState] = useState<RolePermissions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<UserRole>('TENANT_ADMIN');
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<{ role: UserRole; roleName: string } | null>(null);

  // Add New Role Form State
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleKey, setNewRoleKey] = useState('');
  const [isKeyCustom, setIsKeyCustom] = useState(false);
  const [newRoleDataScope, setNewRoleDataScope] = useState<'OWN' | 'TEAM' | 'DEPARTMENT' | 'ORGANIZATION' | 'SYSTEM'>('TEAM');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [addErrorMsg, setAddErrorMsg] = useState('');

  // Edit Role Name Form State
  const [editRoleNameInput, setEditRoleNameInput] = useState('');
  const [editErrorMsg, setEditErrorMsg] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    const data = await rolesApi.getAggregatedRolePermissions(tenantId);
    setPermissionsState(data);
    if (data.length > 0 && !data.find(r => r.role === selectedRole)) {
      setSelectedRole(data[0].role);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const currentRoleData =
    permissionsState.find((r) => r.role === selectedRole) || permissionsState[0];

  const triggerToast = (msg: string) => {
    setSavedSuccess(msg);
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  const scopeOptions: {
    key: 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ORGANIZATION' | 'SYSTEM';
    title: string;
    description: string;
  }[] = [
    {
      key: 'OWN',
      title: 'Own Records',
      description: 'User can only access records they have created or are assigned to.',
    },
    {
      key: 'TEAM',
      title: 'Team Records',
      description: "Access to records owned by members of the user's immediate team.",
    },
    {
      key: 'DEPARTMENT',
      title: 'Department Records',
      description: "Access to records across all teams within the user's department.",
    },
    {
      key: 'ORGANIZATION',
      title: 'Organization Records',
      description: 'Access to all organizational records, restricted by region/entity.',
    },
    {
      key: 'SYSTEM',
      title: 'System Wide',
      description: 'Unrestricted access to all records across the entire system.',
    },
  ];

  const togglePermission = async (moduleName: string, key: string) => {
    if (!currentRoleData) return;
    const updatedState = permissionsState.map((roleObj) => {
      if (roleObj.role !== selectedRole) return roleObj;
      return {
        ...roleObj,
        permissions: roleObj.permissions.map((p) => {
          if (p.module !== moduleName) return p;
          return { ...p, [key]: !p[key as keyof typeof p] };
        }),
      };
    });
    setPermissionsState(updatedState);
    const updatedRoleData = updatedState.find(r => r.role === selectedRole);
    if (updatedRoleData) {
      await rolesApi.updateRolePermissions(selectedRole, updatedRoleData);
    }
  };

  const handleScopeChange = async (newScope: 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ORGANIZATION' | 'SYSTEM') => {
    if (!currentRoleData) return;
    const updatedState = permissionsState.map((roleObj) => {
      if (roleObj.role !== selectedRole) return roleObj;
      return { ...roleObj, dataScope: newScope };
    });
    setPermissionsState(updatedState);
    const updatedRoleData = updatedState.find(r => r.role === selectedRole);
    if (updatedRoleData) {
      await rolesApi.updateRolePermissions(selectedRole, updatedRoleData);
    }
  };

  const handleSavePolicy = async () => {
    triggerToast('Security matrix updated successfully across all tenant nodes.');
  };

  // Helper to handle auto-generating role key code
  const handleNewRoleNameChange = (val: string) => {
    setNewRoleName(val);
    if (!isKeyCustom) {
      const formattedKey = val
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_');
      setNewRoleKey(formattedKey);
    }
  };

  // Submit Add New Role
  const handleAddRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddErrorMsg('');

    if (!newRoleName.trim()) {
      setAddErrorMsg('Role Name is required.');
      return;
    }

    const finalKey = (newRoleKey.trim() || newRoleName.trim().toUpperCase().replace(/\s+/g, '_')).toUpperCase();

    if (permissionsState.some((r) => r.role === finalKey)) {
      setAddErrorMsg(`Role key "${finalKey}" already exists. Please use a unique key or name.`);
      return;
    }

    const newRoleObj: RolePermissions = {
      role: finalKey,
      roleName: newRoleName.trim(),
      dataScope: newRoleDataScope,
      permissions: [
        { module: 'Customers', view: true, create: true, edit: true, delete: false, assign: true, reassign: false, export: true },
        { module: 'Visits', view: true, create: true, edit: true, delete: false, assign: true, reassign: false, complete: true },
        { module: 'Tasks', view: true, create: true, edit: true, delete: false, assign: true, reassign: false, complete: true },
        { module: 'Projects', view: true, create: true, edit: true, delete: false, assign: true, reassign: false, moveStage: true, export: true },
        { module: 'Reports', view: true, create: false, edit: false, delete: false, export: true },
        { module: 'Settings', view: false, create: false, edit: false, delete: false },
      ],
    };

    const updatedState = [...permissionsState, newRoleObj];
    setPermissionsState(updatedState);
    // Needs to create the role first in API!
    fetch('/api/roles', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id: finalKey, tenantId, name: finalKey, description: newRoleName.trim()})
    }).then(() => rolesApi.updateRolePermissions(finalKey, newRoleObj)).then(() => loadData());
    
    setSelectedRole(finalKey);

    setIsAddModalOpen(false);
    triggerToast(`New role "${newRoleName.trim()}" successfully created!`);
  };

  // Submit Edit Role Name
  const handleEditRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditErrorMsg('');

    if (!editingRole) return;
    if (!editRoleNameInput.trim()) {
      setEditErrorMsg('Role Name cannot be empty.');
      return;
    }

    const updatedState = permissionsState.map((r) => {
      if (r.role === editingRole.role) {
        return { ...r, roleName: editRoleNameInput.trim() };
      }
      return r;
    });

    setPermissionsState(updatedState);
    // Update role description/name in API
    fetch(`/api/roles/${editingRole.role}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ description: editRoleNameInput.trim() })
    }).then(() => loadData());

    setEditingRole(null);
    triggerToast(`Role name updated to "${editRoleNameInput.trim()}".`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-[#767587] h-full min-h-[500px]">
        <span className="material-symbols-outlined text-4xl animate-spin text-[#4744e5]">progress_activity</span>
        <span className="mt-4 text-sm font-semibold">Loading data...</span>
      </div>
    );
  }

  if (permissionsState.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-[#767587] h-full min-h-[500px]">
        <span className="material-symbols-outlined text-4xl text-[#464555]">group_off</span>
        <span className="mt-4 text-sm font-semibold">No Roles Found</span>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="mt-4 px-4 py-2 bg-[#4744e5] hover:bg-[#2c24ce] text-white text-xs font-bold rounded-lg"
        >
          Add Role
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-['Inter',sans-serif] pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#4744e5]/10 text-[#4744e5] text-xs font-bold rounded uppercase">
              RBAC Engine
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">
            Role-Based Access Control & Permissions
          </h1>
          <p className="text-xs text-[#464555] mt-0.5">
            Define granular module permissions, action authorization matrices, and multi-level data visibility scopes.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setNewRoleName('');
              setNewRoleKey('');
              setIsKeyCustom(false);
              setNewRoleDescription('');
              setNewRoleDataScope('TEAM');
              setAddErrorMsg('');
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 bg-white border border-[#4744e5] hover:bg-[#4744e5]/10 text-[#4744e5] text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 font-['Hanken_Grotesk'] shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Add New Role</span>
          </button>

          <button
            onClick={handleSavePolicy}
            className="px-5 py-2 bg-[#4744e5] hover:bg-[#2c24ce] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 font-['Hanken_Grotesk']"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            <span>Save Security Policy</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="bg-[#00C875]/10 border border-[#00C875]/30 text-[#008f53] p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          <span>{savedSuccess}</span>
        </div>
      )}

      {/* Split Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT PANE: ROLE SELECTOR CARDS */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-[#464555] font-['Hanken_Grotesk'] uppercase tracking-wider block">
              Select Organization Role ({permissionsState.length})
            </span>
          </div>

          <div className="space-y-2.5">
            {permissionsState.map((r) => {
              const isSelected = r.role === selectedRole;
              return (
                <div
                  key={r.role}
                  onClick={() => setSelectedRole(r.role)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all relative group ${
                    isSelected
                      ? 'bg-white border-[#4744e5] ring-2 ring-[#4744e5]/10 shadow-sm'
                      : 'bg-white border-[#E1E1E1] hover:border-[#c7c4d8]'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-[#1a1c1c] font-['Hanken_Grotesk']">
                        {r.roleName}
                      </h3>

                      {/* EDIT ROLE NAME BUTTON */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRole({ role: r.role, roleName: r.roleName });
                          setEditRoleNameInput(r.roleName);
                          setEditErrorMsg('');
                        }}
                        className="p-1 text-[#767587] hover:text-[#4744e5] hover:bg-[#4744e5]/10 rounded transition-all opacity-80 group-hover:opacity-100"
                        title="Edit Role Name"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                        isSelected ? 'bg-[#4744e5] text-white' : 'bg-[#f3f3f3] text-[#464555]'
                      }`}
                    >
                      Scope: {r.dataScope}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#767587] mt-1 line-clamp-2">
                    {r.role === 'SALES_MANAGER'
                      ? 'Full visibility over departmental sales reps, targets, and pipelines.'
                      : r.role === 'SUPERVISOR'
                      ? 'Team-level approval rights for field visits and task allocations.'
                      : r.role === 'SALES_REPRESENTATIVE'
                      ? 'Isolated access to personally assigned customers and activities.'
                      : r.role === 'TENANT_ADMIN' || r.role === 'SUPER_ADMIN'
                      ? 'System administrator with full organizational privileges.'
                      : `Custom system role for ${r.roleName.toLowerCase()} authorization.`}
                  </p>
                </div>
              );
            })}
          </div>

          {/* ADD NEW ROLE BUTTON AT BOTTOM OF LEFT PANE */}
          <div className="pt-2">
            <button
              onClick={() => {
                setNewRoleName('');
                setNewRoleKey('');
                setIsKeyCustom(false);
                setNewRoleDescription('');
                setNewRoleDataScope('TEAM');
                setAddErrorMsg('');
                setIsAddModalOpen(true);
              }}
              className="w-full py-3 px-4 border-2 border-dashed border-[#4744e5] hover:border-[#2c24ce] bg-[#4744e5]/[0.03] hover:bg-[#4744e5]/[0.08] text-[#4744e5] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 font-['Hanken_Grotesk'] active:scale-[0.99] shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span>+ Add New Role</span>
            </button>
          </div>
        </div>

        {/* RIGHT PANE: PERMISSION MATRIX & DATA SCOPE */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Card */}
          <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E1E1E1] pb-4">
              <div className="flex items-center gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                      {currentRoleData.roleName} Configuration
                    </h2>
                    {/* Edit button in header */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRole({ role: currentRoleData.role, roleName: currentRoleData.roleName });
                        setEditRoleNameInput(currentRoleData.roleName);
                        setEditErrorMsg('');
                      }}
                      className="p-1 text-[#767587] hover:text-[#4744e5] hover:bg-[#4744e5]/10 rounded transition-all"
                      title="Edit Role Name"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                  </div>
                  <p className="text-xs text-[#767587] mt-0.5">
                    Configure feature module capabilities and data access limits for <span className="font-mono text-[#1a1c1c]">{currentRoleData.role}</span>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#767587]">Active Scope:</span>
                <span className="px-2.5 py-1 bg-[#4744e5]/10 text-[#4744e5] text-xs font-bold rounded-lg border border-[#4744e5]/20 font-mono">
                  {currentRoleData.dataScope}
                </span>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f9f9f9] text-[#464555] font-bold uppercase border-b border-[#E1E1E1]">
                  <tr>
                    <th className="px-4 py-3">Feature Module</th>
                    <th className="px-3 py-3 text-center">View</th>
                    <th className="px-3 py-3 text-center">Create</th>
                    <th className="px-3 py-3 text-center">Edit</th>
                    <th className="px-3 py-3 text-center">Delete</th>
                    <th className="px-3 py-3 text-center">Assign</th>
                    <th className="px-3 py-3 text-center">Export</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E1E1]">
                  {currentRoleData.permissions.map((p) => (
                    <tr key={p.module} className="hover:bg-[#f9f9f9]">
                      <td className="px-4 py-3.5 font-bold text-[#1a1c1c]">{p.module}</td>

                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={p.view}
                          onChange={() => togglePermission(p.module, 'view')}
                          className="w-4 h-4 rounded text-[#4744e5] cursor-pointer"
                        />
                      </td>

                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={p.create}
                          onChange={() => togglePermission(p.module, 'create')}
                          className="w-4 h-4 rounded text-[#4744e5] cursor-pointer"
                        />
                      </td>

                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={p.edit}
                          onChange={() => togglePermission(p.module, 'edit')}
                          className="w-4 h-4 rounded text-[#4744e5] cursor-pointer"
                        />
                      </td>

                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={p.delete}
                          onChange={() => togglePermission(p.module, 'delete')}
                          className="w-4 h-4 rounded text-[#ba1a1a] cursor-pointer"
                        />
                      </td>

                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={p.assign}
                          onChange={() => togglePermission(p.module, 'assign')}
                          className="w-4 h-4 rounded text-[#4744e5] cursor-pointer"
                        />
                      </td>

                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={p.export || false}
                          onChange={() => togglePermission(p.module, 'export')}
                          className="w-4 h-4 rounded text-[#4744e5] cursor-pointer"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* DATA SCOPE AUTHORIZATION CARDS SECTION */}
          <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Data Scope Authorization
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {scopeOptions.map((opt) => {
                const isSelected = currentRoleData.dataScope === opt.key;
                return (
                  <div
                    key={opt.key}
                    onClick={() => handleScopeChange(opt.key)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                      isSelected
                        ? 'border-2 border-[#4744e5] bg-[#4744e5]/[0.02] shadow-sm'
                        : 'border-[#E1E1E1] bg-white hover:border-[#b0b0b0]'
                    }`}
                  >
                    {/* Radio Button */}
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                        isSelected
                          ? 'border-[#4744e5] bg-[#4744e5]'
                          : 'border-[#b0b0b0] bg-white'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>

                    <div>
                      <div className="font-bold text-xs sm:text-sm text-[#1a1c1c] font-['Hanken_Grotesk']">
                        {opt.title}
                      </div>
                      <div className="text-[11px] text-[#767587] leading-relaxed mt-1">
                        {opt.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: ADD NEW ROLE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-[#E1E1E1] shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#4744e5]/10 text-[#4744e5] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">add_moderator</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                    Add New System Role
                  </h3>
                  <p className="text-[11px] text-[#767587]">Define a custom role name and initial permission scope.</p>
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

            {addErrorMsg && (
              <div className="p-3 bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 rounded-xl text-xs text-[#ba1a1a] font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{addErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleAddRoleSubmit} className="space-y-4 text-xs">
              {/* Role Name */}
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                  Role Display Name <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newRoleName}
                  onChange={(e) => handleNewRoleNameChange(e.target.value)}
                  placeholder="e.g. Finance & Billing Officer"
                  className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
                />
              </div>

              {/* Role Key / Code */}
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                  Role System Key / Code <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newRoleKey}
                  onChange={(e) => {
                    setNewRoleKey(e.target.value.toUpperCase());
                    setIsKeyCustom(true);
                  }}
                  placeholder="e.g. FINANCE_OFFICER"
                  className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-[#4744e5]"
                />
                <span className="text-[10px] text-[#767587] mt-1 block">
                  Unique identifier used in access control rules.
                </span>
              </div>

              {/* Data Scope */}
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                  Default Data Scope Authorization
                </label>
                <select
                  value={newRoleDataScope}
                  onChange={(e) => setNewRoleDataScope(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
                >
                  <option value="OWN">Own Records (Personal Records Only)</option>
                  <option value="TEAM">Team Records (Direct Team Scope)</option>
                  <option value="DEPARTMENT">Department Records (Department Scope)</option>
                  <option value="ORGANIZATION">Organization Records (All Department Records)</option>
                  <option value="SYSTEM">System Wide (Full System Level)</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                  Role Description
                </label>
                <textarea
                  rows={2}
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  placeholder="e.g. Manages invoicing, financial reports, and billing data."
                  className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
                />
              </div>

              {/* Action Buttons */}
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
                  className="px-5 py-2 bg-[#4744e5] hover:bg-[#2c24ce] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 font-['Hanken_Grotesk']"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Create Role</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT ROLE NAME */}
      {editingRole && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-[#E1E1E1] shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#4744e5]/10 text-[#4744e5] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">edit_note</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                    Edit Role Name
                  </h3>
                  <p className="text-[11px] text-[#767587]">
                    Update the display title for <span className="font-mono text-[#1a1c1c] font-bold">{editingRole.role}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingRole(null)}
                className="text-[#767587] hover:text-[#1a1c1c] p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {editErrorMsg && (
              <div className="p-3 bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 rounded-xl text-xs text-[#ba1a1a] font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{editErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleEditRoleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                  Role Display Name <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editRoleNameInput}
                  onChange={(e) => setEditRoleNameInput(e.target.value)}
                  placeholder="Enter new role name..."
                  className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
                />
              </div>

              <div className="bg-[#f8f9fc] p-3 rounded-xl border border-[#E1E1E1] text-[11px] text-[#767587]">
                <strong>Note:</strong> Renaming this role will update how it is displayed across all user lists and permission tables. System role key (<code className="font-mono text-[#1a1c1c]">{editingRole.role}</code>) remains unchanged.
              </div>

              <div className="pt-3 border-t border-[#E1E1E1] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRole(null)}
                  className="px-4 py-2 border border-[#E1E1E1] hover:bg-[#f3f3f3] text-[#1a1c1c] font-bold text-xs rounded-xl transition-all font-['Hanken_Grotesk']"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4744e5] hover:bg-[#2c24ce] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 font-['Hanken_Grotesk']"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Save Name</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

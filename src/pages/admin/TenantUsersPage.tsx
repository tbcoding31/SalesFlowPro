import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { DataService } from '../../services/dataService';
import { usersApi } from '../../services/usersApi';
import { User, Tenant, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const TenantUsersPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentTenant, currentUser } = useAuth();
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    currentUser?.tenantId === 'SYSTEM' ? 'ALL' : (currentTenant?.id || 'TEN-00001')
  );
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [roleOptions, setRoleOptions] = useState<{id: string, name: string}[]>([]);
  useEffect(() => {
    fetch('/api/roles/assignable', {
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('sfp_auth_token') || '') }
    }).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setRoleOptions(data);
    }).catch(e => console.error(e));
  }, []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('SALES_REPRESENTATIVE');
  const [department, setDepartment] = useState('Sales');
  const [position, setPosition] = useState('Account Executive');
  const [targetTenantId, setTargetTenantId] = useState(
    selectedTenantId === 'ALL' ? 'TEN-00001' : selectedTenantId
  );

  const tenants: Tenant[] = DataService.getTenants();

  const loadUsers = async (tenantId: string) => {
    setIsLoading(true);
    const data = await usersApi.fetchUsers(tenantId === 'ALL' ? undefined : tenantId);
    setUsers(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadUsers(selectedTenantId);
  }, [selectedTenantId]);

  const handleTenantChange = (tenantId: string) => {
    setSelectedTenantId(tenantId);
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: User = {
      id: `USR-${Date.now().toString().slice(-4)}`,
      tenantId: targetTenantId,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      email,
      username: email.split('@')[0],
      phone: '+62 812 0000 1111',
      avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80`,
      role,
      roleName: roleOptions.find(r => r.id === role)?.name || role,
      department,
      position,
      status: 'ACTIVE',
      createdAt: new Date().toISOString().split('T')[0],
    };

    const result = await usersApi.saveUser(newUser);
    if (result.success) {
      await loadUsers(selectedTenantId);
      setShowAddModal(false);
      // Reset
      setFirstName('');
      setLastName('');
      setEmail('');
    } else {
      alert(result.error || "Failed to create user account");
    }
  };

  // Ownership Transfer State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSourceUser, setTransferSourceUser] = useState<User | null>(null);
  const [transferTargetUserId, setTransferTargetUserId] = useState<string>('');
  const [transferCandidates, setTransferCandidates] = useState<User[]>([]);
  const [ownershipImpact, setOwnershipImpact] = useState<{
    customers: number;
    projects: number;
    tasks: number;
    openTasks: number;
    visits: number;
    plannedVisits: number;
    followUps: number;
    pendingFollowUps: number;
    totalOwnedRecords: number;
  } | null>(null);
  const [isImpactLoading, setIsImpactLoading] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState<{
    success: boolean;
    transferred?: any;
    error?: string;
  } | null>(null);

  const openTransferModal = async (user: User) => {
    setTransferSourceUser(user);
    setTransferTargetUserId('');
    setTransferResult(null);
    setShowTransferModal(true);
    setIsImpactLoading(true);

    // Fetch impact and assignable candidates in parallel directly from DB APIs
    const [impact, candidates] = await Promise.all([
      usersApi.fetchOwnershipImpact(user.id, user.tenantId),
      usersApi.fetchUsers(user.tenantId, true)
    ]);

    setOwnershipImpact(impact);
    // Filter out source user from candidate list
    setTransferCandidates(candidates.filter(c => c.id !== user.id));
    setIsImpactLoading(false);
  };

  const handleExecuteTransfer = async () => {
    if (!transferSourceUser || !transferTargetUserId) return;
    setIsTransferring(true);
    setTransferResult(null);

    const result = await usersApi.transferOwnership(transferSourceUser.id, transferTargetUserId);
    setIsTransferring(false);
    setTransferResult(result);

    if (result.success) {
      // Reload users & refresh impact
      await loadUsers(selectedTenantId);
      const updatedImpact = await usersApi.fetchOwnershipImpact(transferSourceUser.id, transferSourceUser.tenantId);
      setOwnershipImpact(updatedImpact);
    }
  };

  const toggleUserStatus = async (u: User) => {
    const newStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const isPlatform = currentUser?.tenantId === 'SYSTEM';
    const result = await usersApi.updateUserStatus(u.id, newStatus, isPlatform);
    if (result.success) {
      await loadUsers(selectedTenantId);
    } else {
      if (result.code === 'LAST_TENANT_ADMIN') {
        alert("This is the last active administrator for this organization.\n\nAssign another user an administrative role before suspending or demoting this user.");
      } else {
        alert(result.error || "Failed to update membership status.");
      }
    }
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#4744e5]/10 text-[#4744e5] text-xs font-bold rounded uppercase">
              User Management
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">
            System User Accounts & Credentials
          </h1>
          <p className="text-xs text-[#464555] mt-0.5">
            Manage team accounts, assign roles, and enforce security policies across organization tenants.
          </p>
        </div>

        <Link
          to={selectedTenantId && selectedTenantId !== 'ALL' ? `/admin/tenant-users/create?tenantId=${selectedTenantId}` : '/admin/tenant-users/create'}
          className="px-4 py-2 bg-[#4744e5] hover:bg-[#2c24ce] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 font-['Hanken_Grotesk'] shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          <span>Add New User Account</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-sm flex flex-col md:flex-row justify-between gap-4">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#767587] text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by user name, email, department..."
              className="w-full pl-9 pr-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
            />
          </div>

          {currentUser?.tenantId === 'SYSTEM' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-[#464555]">Tenant:</label>
              <select
                value={selectedTenantId}
                onChange={(e) => handleTenantChange(e.target.value)}
                className="border border-[#E1E1E1] rounded-lg text-xs px-2.5 py-1.5 bg-white text-[#1a1c1c] font-semibold focus:outline-none focus:border-[#4744e5]"
              >
                <option value="ALL">All Organizations</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-[#464555]">Role:</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border border-[#E1E1E1] rounded-lg text-xs px-2.5 py-1.5 bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All Roles</option>
              {roleOptions.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-[#767587] self-center">
          Showing <span className="font-bold text-[#1a1c1c]">{filteredUsers.length}</span> user accounts
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1a1c1c]">
            <thead className="bg-[#f9f9f9] text-[#464555] font-bold font-['Hanken_Grotesk'] uppercase border-b border-[#E1E1E1]">
              <tr>
                <th className="px-6 py-3.5">User Details</th>
                <th className="px-6 py-3.5">Assigned Role</th>
                <th className="px-6 py-3.5">Organization Tenant</th>
                <th className="px-6 py-3.5">Department & Position</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Last Login</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E1E1]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#767587] text-xs">
                    No user accounts found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#f9f9f9] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={u.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'}
                          alt={u.name}
                          className="w-9 h-9 rounded-full object-cover border border-[#E1E1E1]"
                        />
                        <div>
                          <div className="font-bold text-sm text-[#1a1c1c] font-['Hanken_Grotesk']">
                            {u.name}
                          </div>
                          <div className="text-[11px] text-[#767587]">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 font-semibold text-[#4744e5]">
                      {u.roleName}
                    </td>

                    <td className="px-6 py-4 text-[#464555] font-medium">
                      {tenants.find((t) => t.id === u.tenantId)?.name || 'System Level'}
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-semibold text-[#1a1c1c]">{u.position}</div>
                      <div className="text-[11px] text-[#767587]">{u.department}</div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.status === 'ACTIVE'
                            ? 'bg-[#00C875]/10 text-[#008f53]'
                            : 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-[#767587] text-[11px]">
                      {u.lastLoginAt || 'Never'}
                    </td>

                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => openTransferModal(u)}
                        title="Transfer CRM Ownership"
                        className="px-2.5 py-1 rounded text-xs font-semibold border border-[#4744e5]/30 text-[#4744e5] hover:bg-[#4744e5]/10 transition-colors flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                        <span>Transfer</span>
                      </button>
                      <button
                        onClick={() => toggleUserStatus(u)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                          u.status === 'ACTIVE'
                            ? 'border-[#ba1a1a]/30 text-[#ba1a1a] hover:bg-[#ba1a1a]/10'
                            : 'border-[#00C875]/30 text-[#008f53] hover:bg-[#00C875]/10'
                        }`}
                      >
                        {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-lg font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Add New User Account
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#767587] hover:text-[#1a1c1c]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs"
                />
              </div>

              {currentUser?.tenantId === 'SYSTEM' && (
                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Organization Tenant</label>
                  <select
                    value={targetTenantId}
                    onChange={(e) => setTargetTenantId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs bg-white"
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Role Permission</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs bg-white font-semibold"
                >
                  <option value="" disabled>Select Role...</option>
                  {roleOptions.length === 0 && <option value="" disabled>Loading roles...</option>}
                  {roleOptions.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Position</label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-[#E1E1E1] text-[#1a1c1c] rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4744e5] text-white rounded text-xs font-bold hover:bg-[#2c24ce]"
                >
                  Create User Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OWNERSHIP TRANSFER MODAL */}
      {showTransferModal && transferSourceUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-lg w-full p-6 space-y-4 font-['Inter',sans-serif]">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#4744e5]/10 text-[#4744e5] rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                    Transfer Operational CRM Ownership
                  </h2>
                  <p className="text-[11px] text-[#767587]">
                    Reassign customer and pipeline responsibilities from {transferSourceUser.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-[#767587] hover:text-[#1a1c1c] p-1"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Impact Preview Section */}
            <div className="bg-[#f9f9f9] border border-[#E1E1E1] rounded-lg p-4 space-y-3">
              <div className="text-xs font-bold text-[#1a1c1c] uppercase tracking-wider font-['Hanken_Grotesk'] flex items-center justify-between">
                <span>Database Ownership Impact Preview</span>
                {isImpactLoading && <span className="text-[10px] text-[#767587] font-normal">Calculating...</span>}
              </div>

              {isImpactLoading ? (
                <div className="text-center py-4 text-xs text-[#767587]">
                  Querying live database records...
                </div>
              ) : ownershipImpact ? (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white p-2.5 rounded border border-[#E1E1E1]">
                    <div className="text-lg font-bold text-[#4744e5] font-['Hanken_Grotesk']">
                      {ownershipImpact.customers}
                    </div>
                    <div className="text-[10px] text-[#767587] font-medium">Customers</div>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-[#E1E1E1]">
                    <div className="text-lg font-bold text-[#4744e5] font-['Hanken_Grotesk']">
                      {ownershipImpact.projects}
                    </div>
                    <div className="text-[10px] text-[#767587] font-medium">Projects</div>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-[#E1E1E1]">
                    <div className="text-lg font-bold text-[#4744e5] font-['Hanken_Grotesk']">
                      {ownershipImpact.tasks}
                    </div>
                    <div className="text-[10px] text-[#767587] font-medium">Tasks</div>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-[#E1E1E1]">
                    <div className="text-lg font-bold text-[#4744e5] font-['Hanken_Grotesk']">
                      {ownershipImpact.visits}
                    </div>
                    <div className="text-[10px] text-[#767587] font-medium">Visits</div>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-[#E1E1E1]">
                    <div className="text-lg font-bold text-[#4744e5] font-['Hanken_Grotesk']">
                      {ownershipImpact.followUps}
                    </div>
                    <div className="text-[10px] text-[#767587] font-medium">Follow-ups</div>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-[#4744e5]/30 bg-[#4744e5]/5">
                    <div className="text-lg font-bold text-[#4744e5] font-['Hanken_Grotesk']">
                      {ownershipImpact.totalOwnedRecords}
                    </div>
                    <div className="text-[10px] text-[#4744e5] font-bold">Total Records</div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[#ba1a1a] text-center py-2">
                  Unable to load database ownership impact.
                </div>
              )}

              <p className="text-[11px] text-[#767587] leading-relaxed italic">
                * Note: Historical activities, audit logs, and completed actions remain permanently attributed to original authors.
              </p>
            </div>

            {/* Target Assignee Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1a1c1c]">
                Select Target Active Assignee (New PIC) *
              </label>
              {transferCandidates.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  No active users found in this organization available for assignment.
                </div>
              ) : (
                <select
                  value={transferTargetUserId}
                  onChange={(e) => setTransferTargetUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white focus:outline-hidden focus:border-[#4744e5]"
                >
                  <option value="">-- Select Active Team Member --</option>
                  {transferCandidates.map((cand) => (
                    <option key={cand.id} value={cand.id}>
                      {cand.name} ({cand.roleName || cand.role}) - {cand.email}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Transfer Result Banner */}
            {transferResult && (
              <div className={`p-3 rounded-lg text-xs ${
                transferResult.success 
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}>
                {transferResult.success ? (
                  <div>
                    <div className="font-bold">Ownership Transfer Completed Successfully!</div>
                    <div className="text-[11px] mt-1">
                      Transferred {transferResult.transferred?.total || 0} total records ({transferResult.transferred?.customers} customers, {transferResult.transferred?.projects} projects, {transferResult.transferred?.tasks} tasks, {transferResult.transferred?.visits} visits, {transferResult.transferred?.followUps} follow-ups).
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-bold">Transfer Failed</div>
                    <div className="text-[11px] mt-0.5">{transferResult.error}</div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 border border-[#E1E1E1] text-[#1a1c1c] rounded-lg text-xs font-semibold hover:bg-[#f9f9f9]"
              >
                {transferResult?.success ? 'Close' : 'Cancel'}
              </button>
              {!transferResult?.success && (
                <button
                  type="button"
                  disabled={!transferTargetUserId || isTransferring || isImpactLoading}
                  onClick={handleExecuteTransfer}
                  className="px-4 py-2 bg-[#4744e5] hover:bg-[#2c24ce] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  {isTransferring ? (
                    <span>Transferring...</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                      <span>Confirm & Transfer Ownership</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

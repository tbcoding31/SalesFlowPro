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
    currentUser?.role === 'SUPER_ADMIN' ? 'ALL' : (currentTenant?.id || 'TEN-00001')
  );
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
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
      roleName:
        role === 'TENANT_ADMIN'
          ? 'Tenant Administrator'
          : role === 'SALES_MANAGER'
          ? 'Sales Manager'
          : role === 'SUPERVISOR'
          ? 'Sales Supervisor'
          : 'Sales Representative',
      department,
      position,
      status: 'ACTIVE',
      createdAt: new Date().toISOString().split('T')[0],
    };

    const success = await usersApi.saveUser(newUser);
    if (success) {
      await loadUsers(selectedTenantId);
      setShowAddModal(false);
      // Reset
      setFirstName('');
      setLastName('');
      setEmail('');
    } else {
      alert("Failed to create user account");
    }
  };

  const toggleUserStatus = async (u: User) => {
    const newStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const success = await usersApi.updateUserStatus(u.id, newStatus);
    if (success) {
      await loadUsers(selectedTenantId);
    } else {
      alert("Failed to update user status");
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

          {currentUser?.role === 'SUPER_ADMIN' && (
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
              <option value="TENANT_ADMIN">Tenant Administrator</option>
              <option value="SALES_MANAGER">Sales Manager</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="SALES_REPRESENTATIVE">Sales Representative</option>
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

                    <td className="px-6 py-4 text-right">
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

              {currentUser?.role === 'SUPER_ADMIN' && (
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
                  {currentUser?.role === 'SUPER_ADMIN' && (
                    <option value="TENANT_ADMIN">Tenant Administrator</option>
                  )}
                  <option value="SALES_MANAGER">Sales Manager</option>
                  <option value="SUPERVISOR">Sales Supervisor</option>
                  <option value="SALES_REPRESENTATIVE">Sales Representative</option>
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
    </div>
  );
};

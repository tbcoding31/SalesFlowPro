import React, { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { DataService } from '../../services/dataService';
import { Tenant, User } from '../../types';

export const TenantDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'users' ? 'users' : 'overview';

  const [tenant, setTenant] = useState<Tenant | undefined>(DataService.getTenantById(id || 'TEN-00001'));
  const [activeTab, setActiveTab] = useState<'overview' | 'users'>(initialTab);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  if (!tenant) {
    return (
      <div className="bg-white p-8 rounded-xl border border-[#E1E1E1] text-center max-w-lg mx-auto my-12">
        <h2 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Tenant Not Found</h2>
        <p className="text-xs text-[#767587] mt-1">The requested organization record could not be found.</p>
        <Link to="/admin/tenants" className="inline-block mt-4 px-4 py-2 bg-[#4744e5] text-white text-xs font-bold rounded-lg">
          Return to Tenants List
        </Link>
      </div>
    );
  }

  const tenantUsers: User[] = DataService.getUsers(tenant.id);
  const auditLogs = DataService.getAuditLogs?.(tenant.id) || [];
  const filteredUsers = tenantUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.department.toLowerCase().includes(userSearch.toLowerCase());

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesDept = deptFilter === 'ALL' || u.department === deptFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesDept && matchesStatus;
  });

  const toggleTenantStatus = () => {
    const newStatus = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const updated = DataService.updateTenantStatus(tenant.id, newStatus);
    if (updated) setTenant({ ...updated });
  };

  const toggleTrialStatus = () => {
    const updated: Tenant = {
      ...tenant,
      isTrialExpired: !tenant.isTrialExpired,
      trialEndDate: !tenant.isTrialExpired ? '2026-08-01' : '2026-11-12'
    };
    DataService.saveTenant(updated);
    setTenant({ ...updated });
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif] bg-[#f8f9fc] min-h-screen p-2 sm:p-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#767587] font-medium">
        <Link to="/admin" className="hover:text-[#1a1c1c]">Administration</Link>
        <span>/</span>
        <Link to="/admin/tenants" className="hover:text-[#1a1c1c]">Tenants</Link>
        <span>/</span>
        <span className="text-[#1a1c1c] font-bold">{tenant.name}</span>
      </div>

      {/* Header Info Block */}
      <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
              {tenant.name}
            </h1>
            <span className="px-2.5 py-0.5 bg-[#4744e5]/10 text-[#4744e5] text-[10px] font-bold rounded-full uppercase">
              {tenant.type}
            </span>
            {tenant.type === 'Trial 3 Bulan' && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                  tenant.isTrialExpired ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                <span className="material-symbols-outlined text-[12px]">timer</span>
                <span>{tenant.isTrialExpired ? 'Trial Expired' : 'Trial Active'}</span>
              </span>
            )}
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                tenant.status === 'ACTIVE' ? 'bg-[#00C875]/10 text-[#008f53]' : 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${tenant.status === 'ACTIVE' ? 'bg-[#00C875]' : 'bg-[#ba1a1a]'}`} />
              <span>{tenant.status}</span>
            </span>
          </div>
          <p className="text-xs text-[#767587] mt-1 font-medium">
            Created: {tenant.createdAt?.substring(0, 10)} &bull; Primary Admin: {tenant.primaryAdminName || 'No Admin Assigned'}
            {tenant.type === 'Trial 3 Bulan' && tenant.trialEndDate && (
              <span className="ml-2 text-amber-700 font-semibold">• Trial Ends: {tenant.trialEndDate}</span>
            )}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {tenant.type === 'Trial 3 Bulan' && (
            <button
              onClick={toggleTrialStatus}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1 ${
                tenant.isTrialExpired
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
              title="Set Trial Status"
            >
              <span className="material-symbols-outlined text-[16px]">timer</span>
              <span>{tenant.isTrialExpired ? 'Set Trial Active' : 'Set Trial Expired'}</span>
            </button>
          )}
          <button className="px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs text-[#1a1c1c] font-bold bg-white hover:bg-[#f3f3f3]">
            Edit Tenant
          </button>
          <Link
            to={`/admin/tenant-users/create?tenantId=${tenant.id}`}
            className="px-3.5 py-2 bg-[#4744e5] hover:bg-[#2c24ce] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Manage Users</span>
          </Link>
          <button
            onClick={toggleTenantStatus}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors ${
              tenant.status === 'ACTIVE'
                ? 'border-[#ba1a1a]/30 text-[#ba1a1a] hover:bg-[#ba1a1a]/10'
                : 'border-[#00C875]/30 text-[#008f53] hover:bg-[#00C875]/10'
            }`}
          >
            {tenant.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-[#E1E1E1] flex gap-8">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-xs font-bold font-['Hanken_Grotesk'] transition-colors relative ${
            activeTab === 'overview' ? 'text-[#4744e5]' : 'text-[#767587] hover:text-[#1a1c1c]'
          }`}
        >
          <span>Overview</span>
          {activeTab === 'overview' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4744e5] rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-xs font-bold font-['Hanken_Grotesk'] transition-colors relative flex items-center gap-2 ${
            activeTab === 'users' ? 'text-[#4744e5]' : 'text-[#767587] hover:text-[#1a1c1c]'
          }`}
        >
          <span>Users</span>
          <span className="px-2 py-0.5 bg-[#f3f3f3] text-[#1a1c1c] text-[10px] font-bold rounded-full">
            {tenantUsers.length > 0 ? tenantUsers.length : 128}
          </span>
          {activeTab === 'users' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4744e5] rounded-full" />
          )}
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column (8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            {/* Tenant Information Card */}
            <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-2xs space-y-4">
              <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Tenant Information
              </h2>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-xs">
                <div>
                  <span className="text-[#767587] font-semibold uppercase text-[10px] block">TENANT NAME</span>
                  <span className="text-[#1a1c1c] font-bold text-sm mt-0.5 block">{tenant.name}</span>
                </div>
                <div>
                  <span className="text-[#767587] font-semibold uppercase text-[10px] block">TENANT CODE</span>
                  <span className="text-[#1a1c1c] font-mono font-bold text-sm mt-0.5 block">{tenant.code}</span>
                </div>
                <div>
                  <span className="text-[#767587] font-semibold uppercase text-[10px] block">TYPE</span>
                  <span className="text-[#1a1c1c] font-bold text-sm mt-0.5 block">{tenant.type}</span>
                </div>
                <div>
                  <span className="text-[#767587] font-semibold uppercase text-[10px] block">STATUS</span>
                  <span className="text-[#008f53] font-bold text-sm mt-0.5 block">{tenant.status}</span>
                </div>
                <div>
                  <span className="text-[#767587] font-semibold uppercase text-[10px] block">CREATED DATE</span>
                  <span className="text-[#1a1c1c] font-semibold text-sm mt-0.5 block">{tenant.createdAt || '12 Jan 2024'}</span>
                </div>
                <div>
                  <span className="text-[#767587] font-semibold uppercase text-[10px] block">LAST ACTIVITY</span>
                  <span className="text-[#1a1c1c] font-semibold text-sm mt-0.5 block">{tenant.lastActivityAt || '2 mins ago'}</span>
                </div>
                {tenant.description && (
                  <div className="col-span-2 border-t border-[#E1E1E1] pt-3">
                    <span className="text-[#767587] font-semibold uppercase text-[10px] block">DESCRIPTION</span>
                    <p className="text-[#1a1c1c] text-xs font-normal mt-0.5 leading-relaxed">{tenant.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Middle Row Cards: User Statistics & Organization Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* User Statistics Card */}
              <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  User Statistics
                </h3>
                <div className="grid grid-cols-2 gap-3 text-center pt-1">
                  <div className="bg-[#f9f9f9] p-3 rounded-lg border border-[#E1E1E1]">
                    <span className="text-xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                      {tenant.userCount || 128}
                    </span>
                    <span className="text-[10px] font-bold text-[#767587] uppercase">Total Users</span>
                  </div>
                  <div className="bg-[#f9f9f9] p-3 rounded-lg border border-[#E1E1E1]">
                    <span className="text-xl font-extrabold text-[#00C875] font-['Hanken_Grotesk'] block">
                      {tenant.activeUserCount || 120}
                    </span>
                    <span className="text-[10px] font-bold text-[#767587] uppercase">Active</span>
                  </div>
                  <div className="bg-[#f9f9f9] p-3 rounded-lg border border-[#E1E1E1]">
                    <span className="text-xl font-extrabold text-[#ffb900] font-['Hanken_Grotesk'] block">
                      4
                    </span>
                    <span className="text-[10px] font-bold text-[#767587] uppercase">Suspended</span>
                  </div>
                  <div className="bg-[#f9f9f9] p-3 rounded-lg border border-[#E1E1E1]">
                    <span className="text-xl font-extrabold text-[#ba1a1a] font-['Hanken_Grotesk'] block">
                      4
                    </span>
                    <span className="text-[10px] font-bold text-[#767587] uppercase">Inactive</span>
                  </div>
                </div>
              </div>

              {/* Organization Stats Card */}
              <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Organization Stats
                </h3>
                <div className="grid grid-cols-2 gap-3 text-center pt-1">
                  <div className="bg-[#f9f9f9] p-3 rounded-lg border border-[#E1E1E1]">
                    <span className="text-xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                      12
                    </span>
                    <span className="text-[10px] font-bold text-[#767587] uppercase">Departments</span>
                  </div>
                  <div className="bg-[#f9f9f9] p-3 rounded-lg border border-[#E1E1E1]">
                    <span className="text-xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                      24
                    </span>
                    <span className="text-[10px] font-bold text-[#767587] uppercase">Teams</span>
                  </div>
                  <div className="bg-[#f9f9f9] p-3 rounded-lg border border-[#E1E1E1]">
                    <span className="text-xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                      8
                    </span>
                    <span className="text-[10px] font-bold text-[#767587] uppercase">Roles</span>
                  </div>
                  <div className="bg-[#f9f9f9] p-3 rounded-lg border border-[#E1E1E1]">
                    <span className="text-xl font-extrabold text-[#4744e5] font-['Hanken_Grotesk'] block">
                      85
                    </span>
                    <span className="text-[10px] font-bold text-[#767587] uppercase">Sales Reps</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            {/* Primary Admin Card */}
            <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-2xs space-y-4">
              <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Primary Admin
              </h2>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#4744e5] text-white font-extrabold text-lg flex items-center justify-center shrink-0">
                  AR
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1a1c1c] font-['Hanken_Grotesk']">
                    {tenant.primaryAdminName || 'Ahmad Ricky'}
                  </h3>
                  <p className="text-xs text-[#767587]">
                    {tenant.primaryAdminEmail || 'ahmad.ricky@salesflow.pro'}
                  </p>
                  <div className="text-[11px] text-[#4744e5] font-bold mt-0.5">Tenant Administrator</div>
                </div>
              </div>

              <div className="border-t border-[#E1E1E1] pt-3 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#767587]">Status:</span>
                  <span className="font-bold text-[#008f53]">Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#767587]">Last Login:</span>
                  <span className="font-semibold text-[#1a1c1c]">Today, 08:30 AM</span>
                </div>
              </div>

              <button className="w-full py-2 bg-white border border-[#E1E1E1] rounded-lg text-xs font-bold text-[#1a1c1c] hover:bg-[#f3f3f3] transition-colors">
                Contact Admin
              </button>
            </div>

            {/* Recent Activity Card */}
            <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-2xs space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Recent Activity
                </h2>
                <Link to={`/admin/audit-logs?tenantId=${tenant.id}`} className="text-xs text-[#4744e5] font-bold hover:underline">View All</Link>
              </div>

              <div className="space-y-3 text-xs">
                {auditLogs.slice(0, 3).length === 0 ? (
                  <div className="text-center text-[#767587] py-2">No recent activity</div>
                ) : (
                  auditLogs.slice(0, 3).map((log) => (
                    <div key={log.id} className="flex gap-3 items-start">
                      <div className="w-6 h-6 rounded-full bg-[#00C875]/10 text-[#00C875] flex items-center justify-center text-xs shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-sm">history</span>
                      </div>
                      <div>
                        <div className="font-semibold text-[#1a1c1c]">{log.action} {log.entity}</div>
                        <div className="text-[11px] text-[#767587]">{log.userName} • {log.createdAt?.substring(0, 10)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USERS */}
      {activeTab === 'users' && (
        <div className="space-y-5">
          {/* Header block */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Tenant Users</h2>
              <p className="text-xs text-[#767587]">Manage users belonging to this tenant.</p>
            </div>

            <Link
              to={`/admin/tenant-users/create?tenantId=${tenant.id}`}
              className="px-4 py-2 bg-[#4744e5] hover:bg-[#2c24ce] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Add User</span>
            </Link>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
              <div className="text-[10px] font-bold text-[#767587] uppercase">TOTAL USERS</div>
              <div className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">{tenantUsers.length}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
              <div className="text-[10px] font-bold text-[#767587] uppercase">ACTIVE USERS</div>
              <div className="text-2xl font-extrabold text-[#00C875] font-['Hanken_Grotesk'] mt-1">{tenantUsers.filter(u => u.status === 'ACTIVE').length}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
              <div className="text-[10px] font-bold text-[#767587] uppercase">SUSPENDED USERS</div>
              <div className="text-2xl font-extrabold text-[#ffb900] font-['Hanken_Grotesk'] mt-1">{tenantUsers.filter(u => u.status === 'SUSPENDED').length}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
              <div className="text-[10px] font-bold text-[#767587] uppercase">INACTIVE USERS</div>
              <div className="text-2xl font-extrabold text-[#ba1a1a] font-['Hanken_Grotesk'] mt-1">{tenantUsers.filter(u => u.status === 'INACTIVE').length}</div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative flex-1 w-full max-w-sm">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#767587] text-[18px]">
                search
              </span>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full pl-9 pr-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="border border-[#E1E1E1] rounded-lg text-xs px-3 py-1.5 bg-white text-[#1a1c1c] font-medium"
              >
                <option value="ALL">All Roles</option>
                <option value="TENANT_ADMIN">Tenant Administrator</option>
                <option value="SALES_MANAGER">Sales Manager</option>
                <option value="SALES_REPRESENTATIVE">Sales Representative</option>
              </select>

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="border border-[#E1E1E1] rounded-lg text-xs px-3 py-1.5 bg-white text-[#1a1c1c] font-medium"
              >
                <option value="ALL">All Departments</option>
                <option value="Executive">Executive</option>
                <option value="Sales West">Sales West</option>
                <option value="Operations">Operations</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-[#E1E1E1] rounded-lg text-xs px-3 py-1.5 bg-white text-[#1a1c1c] font-medium"
              >
                <option value="ALL">Status</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#1a1c1c]">
                <thead className="bg-[#f9f9f9] text-[#767587] font-bold uppercase tracking-wider border-b border-[#E1E1E1]">
                  <tr>
                    <th className="px-6 py-3.5">USER</th>
                    <th className="px-6 py-3.5">EMAIL</th>
                    <th className="px-6 py-3.5">ROLE / DEPT</th>
                    <th className="px-6 py-3.5">STATUS</th>
                    <th className="px-6 py-3.5">TASKS</th>
                    <th className="px-6 py-3.5">LAST LOGIN</th>
                    <th className="px-6 py-3.5 text-right">ACTIONS</th>
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
                      <tr key={u.id} className="hover:bg-[#f9f9f9]">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <img
                              src={u.avatarUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'}
                              alt={u.name}
                              className="w-8 h-8 rounded-full object-cover border border-[#E1E1E1]"
                            />
                            <div>
                              <div className="font-bold text-[#1a1c1c] text-sm">{u.name}</div>
                              <div className="text-[11px] text-[#767587]">{u.department || 'Sales West'}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-3.5 text-[#4744e5] font-medium">{u.email}</td>

                        <td className="px-6 py-3.5">
                          <div className="font-semibold text-[#1a1c1c]">{u.roleName}</div>
                          <div className="text-[11px] text-[#767587]">({u.department})</div>
                        </td>

                        <td className="px-6 py-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                              u.status === 'ACTIVE'
                                ? 'bg-[#00C875]/10 text-[#008f53]'
                                : 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
                            }`}
                          >
                            {u.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                          </span>
                        </td>

                        <td className="px-6 py-3.5 font-bold text-[#1a1c1c]">14</td>

                        <td className="px-6 py-3.5 text-[#767587] font-medium">
                          2023-10-24 09:12
                        </td>

                        <td className="px-6 py-3.5 text-right">
                          <button className="p-1 text-[#767587] hover:text-[#1a1c1c]">
                            <span className="material-symbols-outlined text-[18px]">more_vert</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-[#E1E1E1] flex justify-between items-center text-xs text-[#767587]">
              <div>Showing 1 to {filteredUsers.length} of {filteredUsers.length} results</div>
              <div className="flex items-center gap-1">
                <button className="p-1 rounded hover:bg-[#f3f3f3] text-[#767587]">
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                <button className="p-1 rounded hover:bg-[#f3f3f3] text-[#767587]">
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

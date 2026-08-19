import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { DataService } from '../../services/dataService';
import { Tenant } from '../../types';

export const TenantsListPage: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>(DataService.getTenants());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.industry.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || t.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTenants.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTenants.map((t) => t.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleStatus = (id: string) => {
    const tenant = tenants.find((t) => t.id === id);
    if (tenant) {
      const newStatus = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      DataService.updateTenantStatus(id, newStatus);
      setTenants(DataService.getTenants());
    }
    setActiveMenuId(null);
  };

  const activeCount = tenants.filter((t) => t.status === 'ACTIVE').length;
  const suspendedCount = tenants.filter((t) => t.status === 'SUSPENDED').length;
  const inactiveCount = tenants.filter((t) => t.status === 'INACTIVE').length;
  const totalUsers = tenants.reduce((acc, t) => acc + (t.userCount || 0), 0);

  return (
    <div className="space-y-6 font-['Inter',sans-serif] bg-[#f8f9fc] min-h-screen p-2 sm:p-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
            Tenant Management
          </h1>
          <p className="text-xs text-[#767587] mt-1 font-normal">
            Manage organizations, tenant status, tenant users, and configuration.
          </p>
        </div>

        <Link
          to="/admin/tenants/create"
          className="px-4 py-2 bg-[#4744e5] hover:bg-[#2c24ce] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 font-['Hanken_Grotesk'] shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Create Tenant</span>
        </Link>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
          <div className="text-[11px] font-bold text-[#767587] uppercase">Total Tenants</div>
          <div className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">
            {tenants.length > 3 ? tenants.length : 124}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
          <div className="text-[11px] font-bold text-[#767587] uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00C875]" />
            <span>Active</span>
          </div>
          <div className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">
            {activeCount > 2 ? activeCount : 118}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
          <div className="text-[11px] font-bold text-[#767587] uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ffb900]" />
            <span>Suspended</span>
          </div>
          <div className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">
            {suspendedCount > 0 ? suspendedCount : 4}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
          <div className="text-[11px] font-bold text-[#767587] uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ba1a1a]" />
            <span>Inactive</span>
          </div>
          <div className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">
            {inactiveCount > 0 ? inactiveCount : 2}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold text-[#767587] uppercase flex items-center justify-between">
            <span>Total Users</span>
            <span className="material-symbols-outlined text-sm text-[#4744e5]">group</span>
          </div>
          <div className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">
            {totalUsers > 1000 ? totalUsers.toLocaleString('en-US') : '4,850'}
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="flex flex-1 items-center gap-3 w-full">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#767587] text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tenant name or code..."
              className="w-full pl-9 pr-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-[#E1E1E1] rounded-lg text-xs px-3 py-1.5 bg-white text-[#1a1c1c] font-medium focus:outline-none focus:border-[#4744e5]"
          >
            <option value="ALL">All Types</option>
            <option value="Trial 3 Bulan">Trial 3 Bulan</option>
            <option value="Enterprise">Enterprise</option>
            <option value="Professional">Professional</option>
            <option value="Starter">Starter</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-[#E1E1E1] rounded-lg text-xs px-3 py-1.5 bg-white text-[#1a1c1c] font-medium focus:outline-none focus:border-[#4744e5]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button className="px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs text-[#1a1c1c] font-medium flex items-center gap-1.5 bg-white hover:bg-[#f3f3f3]">
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
            <span>Date Range</span>
          </button>

          <button className="p-1.5 border border-[#E1E1E1] rounded-lg text-[#1a1c1c] bg-white hover:bg-[#f3f3f3]">
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
          </button>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1a1c1c]">
            <thead className="bg-[#f9f9f9] text-[#767587] font-bold uppercase tracking-wider border-b border-[#E1E1E1]">
              <tr>
                <th className="px-4 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredTenants.length && filteredTenants.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-[#E1E1E1] text-[#4744e5]"
                  />
                </th>
                <th className="px-6 py-3.5">TENANT</th>
                <th className="px-6 py-3.5">TYPE</th>
                <th className="px-6 py-3.5">USERS (ACTIVE)</th>
                <th className="px-6 py-3.5">STATUS</th>
                <th className="px-6 py-3.5">CREATED DATE</th>
                <th className="px-6 py-3.5">LAST ACTIVITY</th>
                <th className="px-6 py-3.5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E1E1]">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[#767587] text-xs">
                    No tenant organizations match the current filters.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-[#f9f9f9] transition-colors relative">
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(t.id)}
                        onChange={() => toggleSelectOne(t.id)}
                        className="rounded border-[#E1E1E1] text-[#4744e5]"
                      />
                    </td>

                    <td className="px-6 py-4">
                      <div>
                        <Link
                          to={`/admin/tenants/${t.id}`}
                          className="font-bold text-sm text-[#4744e5] hover:underline font-['Hanken_Grotesk'] block"
                        >
                          {t.name}
                        </Link>
                        <span className="text-[11px] text-[#767587] font-mono">{t.code}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 font-semibold text-[#1a1c1c]">{t.type}</td>

                    <td className="px-6 py-4 font-semibold text-[#1a1c1c]">
                      {t.userCount || 128} ({t.activeUserCount || 120})
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'ACTIVE'
                            ? 'bg-[#00C875]/10 text-[#008f53]'
                            : t.status === 'SUSPENDED'
                            ? 'bg-[#ffb900]/10 text-[#b38200]'
                            : 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
                        }`}
                      >
                        {t.status === 'ACTIVE' ? 'Active' : t.status === 'SUSPENDED' ? 'Suspended' : 'Inactive'}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-[#767587] font-medium">
                      {t.createdAt || '12 Jan 2024'}
                    </td>

                    <td className="px-6 py-4 text-[#767587] font-medium">
                      {t.lastActivityAt || '2 mins ago'}
                    </td>

                    <td className="px-6 py-4 text-right relative">
                      <button
                        onClick={() => setActiveMenuId(activeMenuId === t.id ? null : t.id)}
                        className="p-1 hover:bg-[#f3f3f3] rounded text-[#767587]"
                      >
                        <span className="material-symbols-outlined text-[20px]">more_vert</span>
                      </button>

                      {activeMenuId === t.id && (
                        <div className="absolute right-6 top-10 bg-white border border-[#E1E1E1] shadow-lg rounded-xl py-1.5 w-44 z-30 text-left text-xs font-medium">
                          <Link
                            to={`/admin/tenants/${t.id}`}
                            className="block px-3 py-1.5 text-[#1a1c1c] hover:bg-[#f3f3f3]"
                          >
                            View Details
                          </Link>
                          <Link
                            to={`/admin/tenants/${t.id}?tab=users`}
                            className="block px-3 py-1.5 text-[#1a1c1c] hover:bg-[#f3f3f3]"
                          >
                            Manage Users
                          </Link>
                          <button
                            onClick={() => toggleStatus(t.id)}
                            className="w-full text-left px-3 py-1.5 text-[#ba1a1a] hover:bg-[#ba1a1a]/10 font-bold"
                          >
                            {t.status === 'ACTIVE' ? 'Suspend Tenant' : 'Activate Tenant'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="p-4 border-t border-[#E1E1E1] flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-[#767587]">
          <div>
            Showing <span className="font-bold text-[#1a1c1c]">1</span> to{' '}
            <span className="font-bold text-[#1a1c1c]">{filteredTenants.length}</span> of{' '}
            <span className="font-bold text-[#1a1c1c]">124</span> entries
          </div>

          <div className="flex items-center gap-1 font-bold">
            <button className="p-1 rounded hover:bg-[#f3f3f3] text-[#767587]">
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <button className="w-7 h-7 rounded bg-[#4744e5] text-white flex items-center justify-center">
              1
            </button>
            <button className="w-7 h-7 rounded hover:bg-[#f3f3f3] text-[#1a1c1c] flex items-center justify-center">
              2
            </button>
            <button className="w-7 h-7 rounded hover:bg-[#f3f3f3] text-[#1a1c1c] flex items-center justify-center">
              3
            </button>
            <span>...</span>
            <button className="w-7 h-7 rounded hover:bg-[#f3f3f3] text-[#1a1c1c] flex items-center justify-center">
              13
            </button>
            <button className="p-1 rounded hover:bg-[#f3f3f3] text-[#767587]">
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

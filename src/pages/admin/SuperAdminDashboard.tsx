import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Tenant } from '../../types';

interface TenantStats {
  total: number;
  active: number;
  suspended: number;
  inactive: number;
  pending: number;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers?: number;
  suspendedUsers?: number;
  unknownUsers?: number;
  userStatus?: {
    ACTIVE: number;
    INACTIVE: number;
    SUSPENDED: number;
    UNKNOWN: number;
  };
}

export const SuperAdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<TenantStats>({
    total: 0,
    active: 0,
    suspended: 0,
    inactive: 0,
    pending: 0,
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    suspendedUsers: 0,
    unknownUsers: 0,
    userStatus: {
      ACTIVE: 0,
      INACTIVE: 0,
      SUSPENDED: 0,
      UNKNOWN: 0
    }
  });
  const [recentTenants, setRecentTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDashboardData = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const token = localStorage.getItem('sfp_auth_token') || '';
        const headers: Record<string, string> = {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // 1. Fetch authoritative platform statistics
        const statsRes = await fetch('/api/tenants/stats', { headers });
        if (statsRes.ok) {
          const statsJson = await statsRes.json();
          if (statsJson.success && statsJson.data && isMounted) {
            setStats(statsJson.data);
          }
        } else {
          throw new Error(`Failed to load stats (HTTP ${statsRes.status})`);
        }

        // 2. Fetch recently added tenants (sorted by createdAt DESC, limit 5)
        const tenantsRes = await fetch('/api/tenants?page=1&pageSize=5', { headers });
        if (tenantsRes.ok) {
          const tenantsJson = await tenantsRes.json();
          if (tenantsJson.success && Array.isArray(tenantsJson.items) && isMounted) {
            setRecentTenants(tenantsJson.items);
          }
        }
      } catch (err: any) {
        console.error('[SuperAdminDashboard] Error loading dashboard data:', err);
        if (isMounted) setErrorMsg(err.message || 'Error loading dashboard metrics');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRetry = () => {
    setIsLoading(true);
    setErrorMsg(null);
    const token = localStorage.getItem('sfp_auth_token') || '';
    const headers: Record<string, string> = {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    Promise.all([
      fetch('/api/tenants/stats', { headers }).then(r => r.json()),
      fetch('/api/tenants?page=1&pageSize=5', { headers }).then(r => r.json())
    ]).then(([statsJson, tenantsJson]) => {
      if (statsJson.success && statsJson.data) setStats(statsJson.data);
      if (tenantsJson.success && Array.isArray(tenantsJson.items)) setRecentTenants(tenantsJson.items);
      setIsLoading(false);
    }).catch(err => {
      setErrorMsg(err.message || 'Error loading dashboard metrics');
      setIsLoading(false);
    });
  };

  if (errorMsg && !isLoading && stats.total === 0) {
    return (
      <div className="space-y-6 font-['Inter',sans-serif] bg-[#f8f9fc] min-h-screen p-4">
        <div className="bg-white p-8 rounded-xl border border-[#E1E1E1] text-center max-w-lg mx-auto my-12 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-2xl">error_outline</span>
          </div>
          <h2 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Unable to load platform metrics</h2>
          <p className="text-xs text-[#767587] mt-1">{errorMsg}</p>
          <button
            onClick={handleRetry}
            className="mt-4 px-4 py-2 bg-[#4744e5] text-white text-xs font-bold rounded-lg hover:bg-[#2c24ce] transition-colors"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-['Inter',sans-serif] bg-[#f8f9fc] min-h-screen p-2 sm:p-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
            Super Admin Dashboard
          </h1>
          <p className="text-xs text-[#767587] mt-1 font-normal">
            Monitor and manage the SalesFlow Pro platform, tenants, users, and system activity.
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

      {/* Top 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* TOTAL TENANTS */}
        <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-2xs flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-[#767587] uppercase tracking-wider">
              Total Tenants
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#4744e5]/10 text-[#4744e5] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">domain</span>
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
              {isLoading ? '...' : stats.total}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#00C875] font-bold mt-1">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span>Authoritative System Scope</span>
            </div>
          </div>
        </div>

        {/* ACTIVE TENANTS */}
        <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-2xs flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-[#767587] uppercase tracking-wider">
              Active Tenants
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#00C875]/10 text-[#00C875] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">check_circle</span>
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
              {isLoading ? '...' : stats.active}
            </div>
            <div className="text-[11px] text-[#ba1a1a] font-semibold mt-1">
              {stats.suspended} Suspended
            </div>
          </div>
        </div>

        {/* TOTAL USERS & STATUS BREAKDOWN */}
        <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-2xs flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-[#767587] uppercase tracking-wider">
              Total Users
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#6161ff]/10 text-[#6161ff] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">group</span>
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
              {isLoading ? '...' : stats.totalUsers.toLocaleString('en-US')}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#767587] mt-1 font-semibold">
              <span className="text-[#008f53] font-bold">{stats.activeUsers.toLocaleString('en-US')} Active</span>
              <span>•</span>
              <span className="text-amber-600 font-semibold">{stats.unknownUsers || 0} Unknown</span>
              <span>•</span>
              <span>All tenants</span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Grid: Tenant Status & Distribution + Platform Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Tenant Status & Distribution */}
        <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-2xs space-y-6 flex flex-col justify-between">
          <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
            Tenant Status & Distribution
          </h2>

          {/* Diamond Ring Graph Visualization */}
          <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
            {/* SVG Diamond shape ring */}
            <svg className="w-full h-full transform rotate-45" viewBox="0 0 100 100">
              <rect x="15" y="15" width="70" height="70" fill="none" stroke="#00C875" strokeWidth="12" rx="8" />
              <rect x="15" y="15" width="70" height="70" fill="none" stroke="#ba1a1a" strokeWidth="12" strokeDasharray="30 200" strokeDashoffset="-140" rx="8" />
              <rect x="15" y="15" width="70" height="70" fill="none" stroke="#ffb900" strokeWidth="12" strokeDasharray="15 200" strokeDashoffset="-170" rx="8" />
              <rect x="15" y="15" width="70" height="70" fill="none" stroke="#c7c4d8" strokeWidth="12" strokeDasharray="15 200" strokeDashoffset="-185" rx="8" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
                {isLoading ? '...' : stats.total}
              </span>
              <span className="text-[10px] text-[#767587] font-bold uppercase tracking-wider">
                Total
              </span>
            </div>
          </div>

          {/* Tenant Status Legend Table */}
          <div className="space-y-2 text-xs pt-2 border-t border-[#E1E1E1]">
            <div className="text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-2">TENANT STATUS</div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00C875]" />
                <span className="text-[#1a1c1c] font-medium">Active</span>
              </div>
              <span className="font-bold text-[#1a1c1c]">{stats.active}</span>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ba1a1a]" />
                <span className="text-[#1a1c1c] font-medium">Suspended</span>
              </div>
              <span className="font-bold text-[#1a1c1c]">{stats.suspended}</span>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#c7c4d8]" />
                <span className="text-[#1a1c1c] font-medium">Inactive</span>
              </div>
              <span className="font-bold text-[#1a1c1c]">{stats.inactive}</span>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffb900]" />
                <span className="text-[#1a1c1c] font-medium">Pending</span>
              </div>
              <span className="font-bold text-[#1a1c1c]">{stats.pending}</span>
            </div>
          </div>

          {/* User Status Legend Table */}
          <div className="space-y-2 text-xs pt-3 border-t border-[#E1E1E1]">
            <div className="text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-2">USER STATUS DISTRIBUTION</div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00C875]" />
                <span className="text-[#1a1c1c] font-medium">Active</span>
              </div>
              <span className="font-bold text-[#1a1c1c]">{stats.userStatus?.ACTIVE ?? stats.activeUsers}</span>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#c7c4d8]" />
                <span className="text-[#1a1c1c] font-medium">Inactive</span>
              </div>
              <span className="font-bold text-[#1a1c1c]">{stats.userStatus?.INACTIVE ?? stats.inactiveUsers ?? 0}</span>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ba1a1a]" />
                <span className="text-[#1a1c1c] font-medium">Suspended</span>
              </div>
              <span className="font-bold text-[#1a1c1c]">{stats.userStatus?.SUSPENDED ?? stats.suspendedUsers ?? 0}</span>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-[#1a1c1c] font-medium">Unknown</span>
              </div>
              <span className="font-bold text-[#1a1c1c]">{stats.userStatus?.UNKNOWN ?? stats.unknownUsers ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Right: Platform Growth (Users & Tenants) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
              Platform Growth (Users & Tenants)
            </h2>

            <div className="flex bg-[#f3f3f3] p-1 rounded-lg border border-[#E1E1E1] text-[11px] font-bold text-[#767587]">
              <button className="px-2.5 py-1 rounded text-[#767587]">7D</button>
              <button className="px-2.5 py-1 rounded text-[#767587]">30D</button>
              <button className="px-2.5 py-1 rounded bg-white text-[#4744e5] shadow-xs">3M</button>
              <button className="px-2.5 py-1 rounded text-[#767587]">12M</button>
            </div>
          </div>

          {/* Smooth Curve Area Chart */}
          <div className="relative h-56 w-full bg-[#fcfcfd] rounded-xl border border-[#E1E1E1] p-4 flex flex-col justify-between overflow-hidden">
            <div className="absolute top-4 left-4 bg-white/90 border border-[#E1E1E1] p-2 rounded-lg text-[10px] space-y-1 shadow-2xs z-10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#6161ff]" />
                <span className="font-bold text-[#1a1c1c]">Total Users ({stats.totalUsers})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00C875]" />
                <span className="font-bold text-[#1a1c1c]">Total Tenants ({stats.total})</span>
              </div>
            </div>

            {/* SVG Area Chart Paths */}
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 400 150">
              <defs>
                <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6161ff" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#6161ff" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="tenantGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00C875" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#00C875" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area 1 Users */}
              <path
                d="M 0,130 C 100,100 200,60 400,45 L 400,150 L 0,150 Z"
                fill="url(#userGrad)"
              />
              <path
                d="M 0,130 C 100,100 200,60 400,45"
                fill="none"
                stroke="#6161ff"
                strokeWidth="3.5"
              />

              {/* Area 2 Tenants */}
              <path
                d="M 0,140 C 100,125 200,100 400,80 L 400,150 L 0,150 Z"
                fill="url(#tenantGrad)"
              />
              <path
                d="M 0,140 C 100,125 200,100 400,80"
                fill="none"
                stroke="#00C875"
                strokeWidth="3"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom Table: Recently Added Tenants */}
      <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-[#E1E1E1] flex justify-between items-center">
          <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
            Recently Added Tenants
          </h2>
          <Link
            to="/admin/tenants"
            className="text-xs text-[#4744e5] font-bold hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1a1c1c]">
            <thead className="bg-[#f9f9f9] text-[#767587] font-bold uppercase tracking-wider border-b border-[#E1E1E1]">
              <tr>
                <th className="px-6 py-3.5">TENANT NAME</th>
                <th className="px-6 py-3.5">TENANT ID</th>
                <th className="px-6 py-3.5">USERS</th>
                <th className="px-6 py-3.5">STATUS</th>
                <th className="px-6 py-3.5">CREATED DATE</th>
                <th className="px-6 py-3.5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E1E1]">
              {recentTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#767587]">
                    {isLoading ? 'Loading recently added organizations...' : 'No organizations found.'}
                  </td>
                </tr>
              ) : (
                recentTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-[#f9f9f9] transition-colors">
                    <td className="px-6 py-4 font-bold text-[#4744e5] text-sm">
                      <Link to={`/admin/tenants/${t.id}`}>{t.name}</Link>
                    </td>
                    <td className="px-6 py-4 font-mono text-[#767587] font-medium">{t.code}</td>
                    <td className="px-6 py-4 font-semibold text-[#1a1c1c]">{t.userCount || 0}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'ACTIVE'
                            ? 'bg-[#00C875]/10 text-[#008f53]'
                            : 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
                        }`}
                      >
                        {t.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#767587] font-medium">
                      {typeof t.createdAt === 'string' ? t.createdAt.substring(0, 10) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/admin/tenants/${t.id}`}
                        className="text-[#767587] hover:text-[#1a1c1c] font-bold"
                      >
                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { usersApi } from '../../services/usersApi';
import { Tenant, User } from '../../types';

export const TenantDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'users' ? 'users' : 'overview';

  // --- TOP-LEVEL REACT HOOKS (NEVER CONDITIONAL) ---
  const [tenant, setTenant] = useState<Tenant | undefined>(undefined);
  const [tenantUsers, setTenantUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'users'>(initialTab);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [isSuspending, setIsSuspending] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    const loadTenantData = async () => {
      setTenant(undefined);
      setTenantUsers([]);
      setIsLoading(true);
      setFetchError(null);
      try {
        const token = localStorage.getItem('sfp_auth_token') || '';
        const headers: Record<string, string> = {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // 1. Fetch authoritative tenant detail from API
        const tenantRes = await fetch(`/api/tenants/${id}`, { headers });
        if (tenantRes.ok) {
          const tenantData = await tenantRes.json();
          if (isMounted) {
            // Ensure safe fields
            const normalizedTenant: Tenant = {
              ...tenantData,
              name: tenantData.name || 'Unnamed Organization',
              code: tenantData.code || id,
              status: tenantData.status || 'ACTIVE',
              type: tenantData.type || 'ENTERPRISE',
              createdAt: typeof tenantData.createdAt === 'string' ? tenantData.createdAt : (tenantData.createdAt ? new Date(tenantData.createdAt).toISOString() : new Date().toISOString()),
            };
            setTenant(normalizedTenant);
          }
        } else if (tenantRes.status === 404) {
          if (isMounted) {
            setTenant(undefined);
            setFetchError('Tenant Not Found');
          }
        } else {
          if (isMounted) setFetchError(`HTTP ${tenantRes.status}: Failed to load tenant`);
        }

        // 2. Fetch authoritative tenant users from API
        const usersData = await usersApi.fetchUsers(id);
        if (isMounted) {
          setTenantUsers(Array.isArray(usersData) ? usersData : []);
        }
      } catch (err: any) {
        console.error('[TenantDetailPage] Error fetching tenant details:', err);
        if (isMounted) setFetchError(err.message || 'Network error');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadTenantData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  // --- CONDITIONAL RENDERS AFTER ALL HOOKS ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <span className="material-symbols-outlined animate-spin text-[#4744e5] text-3xl">autorenew</span>
          <span className="text-xs text-[#767587] font-medium">Loading tenant details...</span>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="bg-white p-8 rounded-xl border border-[#E1E1E1] text-center max-w-lg mx-auto my-12 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-2xl">domain_disabled</span>
        </div>
        <h2 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Tenant Not Found</h2>
        <p className="text-xs text-[#767587] mt-1">
          {fetchError || `The requested organization record "${id}" could not be found.`}
        </p>
        <Link to="/admin/tenants" className="inline-block mt-4 px-4 py-2 bg-[#4744e5] text-white text-xs font-bold rounded-lg hover:bg-[#2c24ce] transition-colors">
          Return to Tenants List
        </Link>
      </div>
    );
  }

  const auditLogs: any[] = [];
  const filteredUsers = tenantUsers.filter((u) => {
    const matchesSearch =
      (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.department || '').toLowerCase().includes(userSearch.toLowerCase());

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesDept = deptFilter === 'ALL' || u.department === deptFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesDept && matchesStatus;
  });

  const toggleTenantStatus = async () => {
    const newStatus = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    
    if (newStatus === 'SUSPENDED') {
      const confirmed = window.confirm(
        "Are you sure you want to suspend this organization?\n\nThis will immediately revoke all active sessions for its users, preventing them from accessing the application."
      );
      if (!confirmed) return;
    }

    setIsSuspending(true);
    try {
      const token = localStorage.getItem('sfp_auth_token') || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Direct API call to update status authoritatively
      const res = await fetch(`/api/tenants/${tenant.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!res.ok) {
        throw new Error('Failed to update tenant status');
      }
      
      // Update local state ONLY on success
      const updated = { ...tenant, status: newStatus as any };
      setTenant(updated);
    } catch (err: any) {
      alert("Error updating tenant status: " + err.message);
    } finally {
      setIsSuspending(false);
    }
  };

  const toggleTrialStatus = () => {
    const updated: Tenant = {
      ...tenant,
      isTrialExpired: !tenant.isTrialExpired,
      trialEndDate: !tenant.isTrialExpired ? '2026-08-01' : '2026-11-12'
    };
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
            Created: {typeof tenant.createdAt === 'string' ? tenant.createdAt.substring(0, 10) : 'N/A'} &bull; Primary Admin: {tenant.primaryAdminName || 'No Admin Assigned'}
            {tenant.type === 'Trial 3 Bulan' && tenant.trialEndDate && (
              <span className="ml-2 text-amber-700 font-semibold">• Trial Ends: {typeof tenant.trialEndDate === 'string' ? tenant.trialEndDate.substring(0, 10) : ''}</span>
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
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs text-[#1a1c1c] font-bold bg-white hover:bg-[#f3f3f3]">
            Edit Tenant
          </button>
          <button
            onClick={toggleTenantStatus}
            disabled={isSuspending}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors ${
              tenant.status === 'ACTIVE'
                ? 'border-[#ba1a1a]/30 text-[#ba1a1a] hover:bg-[#ba1a1a]/10'
                : 'border-[#00C875]/30 text-[#008f53] hover:bg-[#00C875]/10'
            } ${isSuspending ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSuspending ? 'Processing...' : (tenant.status === 'ACTIVE' ? 'Suspend' : 'Activate')}
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
            {tenantUsers.length}
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
                  <span className="text-[#1a1c1c] font-semibold text-sm mt-0.5 block">{typeof tenant.createdAt === 'string' ? tenant.createdAt.substring(0, 10) : '12 Jan 2024'}</span>
                </div>
                <div>
                  <span className="text-[#767587] font-semibold uppercase text-[10px] block">LAST ACTIVITY</span>
                  <span className="text-[#1a1c1c] font-semibold text-sm mt-0.5 block">{typeof tenant.lastActivityAt === 'string' ? tenant.lastActivityAt : '2 mins ago'}</span>
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
                        {tenant.userStats?.total ?? tenantUsers.length}
                      </span>
                      <span className="text-[10px] font-bold text-[#767587] uppercase">Total Users</span>
                    </div>
                    <div className="bg-[#f9f9f9] p-3 rounded-lg border border-[#E1E1E1]">
                      <span className="text-xl font-extrabold text-[#00C875] font-['Hanken_Grotesk'] block">
                        {tenant.userStats?.active ?? tenantUsers.filter(u => u.status === 'ACTIVE').length}
                      </span>
                      <span className="text-[10px] font-bold text-[#767587] uppercase">Active</span>
                    </div>
                    <div className="bg-[#f9f9f9] p-3 rounded-lg border border-[#E1E1E1]">
                      <span className="text-xl font-extrabold text-[#ffb900] font-['Hanken_Grotesk'] block">
                        {tenant.userStats?.suspended ?? tenantUsers.filter(u => u.status === 'SUSPENDED').length}
                      </span>
                      <span className="text-[10px] font-bold text-[#767587] uppercase">Suspended</span>
                    </div>
                    <div className="bg-[#f9f9f9] p-3 rounded-lg border border-[#E1E1E1]">
                      <span className="text-xl font-extrabold text-[#ba1a1a] font-['Hanken_Grotesk'] block">
                        {tenant.userStats?.inactive ?? tenantUsers.filter(u => u.status === 'INACTIVE').length}
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
                        {tenant.organizationStats?.departments ?? 0}
                      </span>
                      <span className="text-[10px] font-bold text-[#767587] uppercase">Departments</span>
                    </div>
                    <div className="bg-[#f9f9f9] p-3 rounded-lg border border-[#E1E1E1]">
                      <span className="text-xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                        {tenant.organizationStats?.teams ?? 0}
                      </span>
                      <span className="text-[10px] font-bold text-[#767587] uppercase">Teams</span>
                    </div>
                    <div className="bg-[#f9f9f9] p-3 rounded-lg border border-[#E1E1E1]">
                      <span className="text-xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                        {tenant.organizationStats?.roles ?? 0}
                      </span>
                      <span className="text-[10px] font-bold text-[#767587] uppercase">Roles</span>
                    </div>
                    <div className="bg-[#f9f9f9] p-3 rounded-lg border border-[#E1E1E1]">
                      <span className="text-xl font-extrabold text-[#4744e5] font-['Hanken_Grotesk'] block">
                        {tenant.organizationStats?.salesReps ?? 0}
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

                {tenant.primaryAdmin || tenant.primaryAdminName ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#4744e5] text-white font-extrabold text-lg flex items-center justify-center shrink-0 uppercase">
                        {(tenant.primaryAdmin?.name || tenant.primaryAdminName || 'Admin')
                          .split(' ')
                          .filter(Boolean)
                          .map((n: string) => n[0])
                          .slice(0, 2)
                          .join('') || 'AD'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-[#1a1c1c] font-['Hanken_Grotesk'] truncate">
                          {tenant.primaryAdmin?.name || tenant.primaryAdminName}
                        </h3>
                        <p className="text-xs text-[#767587] truncate">
                          {tenant.primaryAdmin?.email || tenant.primaryAdminEmail || 'No email provided'}
                        </p>
                        <div className="text-[11px] text-[#4744e5] font-bold mt-0.5">
                          {tenant.primaryAdmin?.role || 'Tenant Administrator'}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-[#E1E1E1] pt-3 text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-[#767587]">Status:</span>
                        <span className="font-bold text-[#008f53]">
                          {tenant.primaryAdmin?.status || 'Active'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#767587]">Last Login:</span>
                        <span className="font-semibold text-[#1a1c1c]">
                          {tenant.primaryAdmin?.lastLoginAt ? new Date(tenant.primaryAdmin.lastLoginAt).toLocaleDateString() : 'Never logged in'}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-xs text-[#767587]">
                    <span className="material-symbols-outlined text-3xl text-gray-400 block mb-1">person_off</span>
                    No Admin Assigned
                  </div>
                )}

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
                  {((tenant.recentActivity && tenant.recentActivity.length > 0) ? tenant.recentActivity : auditLogs).slice(0, 3).length === 0 ? (
                    <div className="text-center text-[#767587] py-2">No recent activity</div>
                  ) : (
                    ((tenant.recentActivity && tenant.recentActivity.length > 0) ? tenant.recentActivity : auditLogs).slice(0, 3).map((log: any) => (
                      <div key={log.id} className="flex gap-3 items-start">
                        <div className="w-6 h-6 rounded-full bg-[#00C875]/10 text-[#00C875] flex items-center justify-center text-xs shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-sm">history</span>
                        </div>
                        <div>
                          <div className="font-semibold text-[#1a1c1c]">{log.action} {log.entity || ''}</div>
                          <div className="text-[11px] text-[#767587]">{log.userName || 'System'} • {(log.timestamp || log.createdAt)?.substring(0, 10) || ''}</div>
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
                          <div className="font-semibold text-[#1a1c1c]">{u.roleName || u.role || 'User'}</div>
                          {u.department && <div className="text-[11px] text-[#767587]">({u.department})</div>}
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
      
      {/* Edit Tenant Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit Tenant</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-500 hover:text-black">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const payload = {
                name: formData.get('name'),
                industry: formData.get('industry'),
                phone: formData.get('phone'),
                description: formData.get('description'),
              };
              
              try {
                const token = localStorage.getItem('sfp_auth_token') || '';
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const res = await fetch(`/api/tenants/${tenant.id}`, {
                  method: 'PUT',
                  headers,
                  body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('Failed to update tenant');
                
                const updated = { ...tenant, ...payload } as any;
                setTenant(updated);
                setIsEditModalOpen(false);
              } catch (err: any) {
                alert('Error updating tenant: ' + err.message);
              }
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tenant Name</label>
                  <input name="name" defaultValue={tenant.name} required className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Industry</label>
                  <input name="industry" defaultValue={tenant.industry} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Phone</label>
                  <input name="phone" defaultValue={tenant.phone} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                  <textarea name="description" defaultValue={tenant.description} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm"></textarea>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-bold hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[#4744e5] text-white rounded-lg text-sm font-bold hover:bg-[#2c24ce]">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

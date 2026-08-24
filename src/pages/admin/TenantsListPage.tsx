import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Tenant } from '../../types';

export const TenantsListPage: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    suspended: 0,
    inactive: 0,
    totalUsers: 0
  });

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('sfp_auth_token') || '';
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/tenants/stats', { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setStats(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    const fetchTenants = async () => {
      setIsLoading(true);
      setApiError(null);
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (statusFilter !== 'ALL') params.append('status', statusFilter);
        if (typeFilter !== 'ALL') params.append('type', typeFilter);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        params.append('page', page.toString());
        params.append('pageSize', pageSize.toString());

        const token = localStorage.getItem('sfp_auth_token') || '';
        const headers: Record<string, string> = {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/tenants?${params.toString()}`, {
          signal: abortController.signal,
          headers
        });
        
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setTenants(json.items || []);
            setTotal(json.total || 0);
            setTotalPages(json.totalPages || 0);
          } else {
            setApiError(json.error || 'Unknown API error');
          }
        } else {
          // If not res.ok (e.g. 401, 403, 500)
          let errMsg = `HTTP ${res.status}`;
          try {
             const errJson = await res.json();
             if (errJson.error) errMsg += `: ${errJson.error}`;
          } catch(e) {}
          setApiError(errMsg);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch tenants:', err);
          setApiError(err.message || 'Network error');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchTenants();

    return () => {
      abortController.abort();
    };
  }, [searchQuery, statusFilter, typeFilter, startDate, endDate, page, pageSize]);

  // Reset page to 1 on filter change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, typeFilter, startDate, endDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSelectAll = () => {
    if (selectedIds.length === tenants.length && tenants.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tenants.map((t) => t.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleStatus = async (id: string) => {
    const tenant = tenants.find((t) => t.id === id);
    if (!tenant) return;
    
    const newStatus = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setPage(1);
        fetchStats();
        setTenants(prev => prev.map(t => t.id === id ? { ...t, status: newStatus as any } : t));
      }
    } catch (err) {
      alert("Error updating status");
    }
    setActiveMenuId(null);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const renderPaginationButtons = () => {
    if (totalPages <= 0) return null;
    const buttons = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
        buttons.push(
          <button
            key={i}
            onClick={() => setPage(i)}
            className={`w-7 h-7 rounded flex items-center justify-center font-bold ${
              page === i ? 'bg-[#4744e5] text-white' : 'hover:bg-[#f3f3f3] text-[#1a1c1c]'
            }`}
          >
            {i}
          </button>
        );
      } else if (i === page - 2 || i === page + 2) {
        buttons.push(<span key={i}>...</span>);
      }
    }
    return buttons;
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif] bg-[#f8f9fc] min-h-screen p-2 sm:p-4">
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

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
          <div className="text-[11px] font-bold text-[#767587] uppercase">Total Tenants</div>
          <div className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">
            {stats.total}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
          <div className="text-[11px] font-bold text-[#767587] uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00C875]" />
            <span>Active</span>
          </div>
          <div className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">
            {stats.active}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
          <div className="text-[11px] font-bold text-[#767587] uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ffb900]" />
            <span>Suspended</span>
          </div>
          <div className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">
            {stats.suspended}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
          <div className="text-[11px] font-bold text-[#767587] uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ba1a1a]" />
            <span>Inactive</span>
          </div>
          <div className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">
            {stats.inactive}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold text-[#767587] uppercase flex items-center justify-between">
            <span>Total Users</span>
            <span className="material-symbols-outlined text-sm text-[#4744e5]">group</span>
          </div>
          <div className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">
            {stats.totalUsers.toLocaleString('en-US')}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs flex flex-col lg:flex-row justify-between items-center gap-3">
        <div className="flex flex-1 items-center gap-3 w-full flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
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

        <div className="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap">
          <div className="relative" ref={datePickerRef}>
            <button 
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs text-[#1a1c1c] font-medium flex items-center gap-1.5 bg-white hover:bg-[#f3f3f3]"
            >
              <span className="material-symbols-outlined text-[16px]">calendar_today</span>
              <span>{startDate && endDate ? `${startDate} to ${endDate}` : 'Date Range'}</span>
            </button>
            
            {showDatePicker && (
              <div className="absolute right-0 top-10 bg-white border border-[#E1E1E1] shadow-lg rounded-xl p-3 z-30 w-64">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#767587] uppercase mb-1">Start Date</label>
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)} 
                      className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#767587] uppercase mb-1">End Date</label>
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)} 
                      className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-[#E1E1E1]">
                    <button 
                      onClick={() => { setStartDate(''); setEndDate(''); setShowDatePicker(false); }}
                      className="px-2 py-1 text-xs text-[#767587] hover:text-[#1a1c1c] font-medium"
                    >
                      Clear
                    </button>
                    <button 
                      onClick={() => setShowDatePicker(false)}
                      className="px-2 py-1 bg-[#4744e5] text-white text-xs rounded font-bold"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={clearFilters}
            title="Clear All Filters"
            className="p-1.5 border border-[#E1E1E1] rounded-lg text-[#1a1c1c] bg-white hover:bg-[#f3f3f3] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">filter_alt_off</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto min-h-[300px] relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
              <span className="material-symbols-outlined animate-spin text-[#4744e5] text-3xl">autorenew</span>
            </div>
          )}
          <table className="w-full text-left text-xs text-[#1a1c1c]">
            <thead className="bg-[#f9f9f9] text-[#767587] font-bold uppercase tracking-wider border-b border-[#E1E1E1]">
              <tr>
                <th className="px-4 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === tenants.length && tenants.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-[#E1E1E1] text-[#4744e5]"
                  />
                </th>
                <th className="px-6 py-3.5">TENANT</th>
                <th className="px-6 py-3.5">TYPE</th>
                <th className="px-6 py-3.5">USERS</th>
                <th className="px-6 py-3.5">STATUS</th>
                <th className="px-6 py-3.5">CREATED DATE</th>
                <th className="px-6 py-3.5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E1E1]">
              {apiError ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-red-500 text-xs font-medium">
                    Tenant API Error: {apiError}
                  </td>
                </tr>
              ) : tenants.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#767587] text-xs font-medium">
                    No tenant organizations match the current filters.
                  </td>
                </tr>
              ) : (
                tenants.map((t: any) => (
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
                        <Link to={`/admin/tenants/${t.id}`} className="font-bold text-sm text-[#4744e5] hover:underline font-['Hanken_Grotesk'] block">
                          {t.name}
                        </Link>
                        <span className="text-[11px] text-[#767587] font-mono">{t.code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-[#1a1c1c]">{t.type}</td>
                    <td className="px-6 py-4 font-semibold text-[#1a1c1c]">
                      {t.userCount || 0}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'ACTIVE' ? 'bg-[#00C875]/10 text-[#008f53]' : t.status === 'SUSPENDED' ? 'bg-[#ffb900]/10 text-[#b38200]' : 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
                        }`}>
                        {t.status === 'ACTIVE' ? 'Active' : t.status === 'SUSPENDED' ? 'Suspended' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#767587] font-medium">
                      {t.createdAt ? String(t.createdAt).substring(0,10) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <button onClick={() => setActiveMenuId(activeMenuId === t.id ? null : t.id)} className="p-1 hover:bg-[#f3f3f3] rounded text-[#767587]">
                        <span className="material-symbols-outlined text-[20px]">more_vert</span>
                      </button>
                      {activeMenuId === t.id && (
                        <div className="absolute right-6 top-10 bg-white border border-[#E1E1E1] shadow-lg rounded-xl py-1.5 w-44 z-30 text-left text-xs font-medium">
                          <Link to={`/admin/tenants/${t.id}`} className="block px-3 py-1.5 text-[#1a1c1c] hover:bg-[#f3f3f3]">
                            View Details
                          </Link>
                          <button onClick={() => toggleStatus(t.id)} className="w-full text-left px-3 py-1.5 text-[#ba1a1a] hover:bg-[#ba1a1a]/10 font-bold">
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

        <div className="p-4 border-t border-[#E1E1E1] flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-[#767587]">
          <div>
            Showing <span className="font-bold text-[#1a1c1c]">{total === 0 ? 0 : (page - 1) * pageSize + 1}</span> to{' '}
            <span className="font-bold text-[#1a1c1c]">{Math.min(page * pageSize, total)}</span> of{' '}
            <span className="font-bold text-[#1a1c1c]">{total}</span> entries
          </div>

          {totalPages > 0 && (
            <div className="flex items-center gap-1 font-bold">
              <button 
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-[#f3f3f3] text-[#767587] disabled:opacity-50">
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              
              {renderPaginationButtons()}

              <button 
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-1 rounded hover:bg-[#f3f3f3] text-[#767587] disabled:opacity-50">
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

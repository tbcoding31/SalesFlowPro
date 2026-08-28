import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FollowUp, Customer, User, FollowUpStatus } from '../../types';
import { crmApi } from '../../services/crmApi';
import { usersApi } from '../../services/usersApi';

export const FollowupsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';

  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fList, cList, uList] = await Promise.all([
        crmApi.fetchCollection<FollowUp>('follow_ups', tenantId),
        crmApi.fetchCollection<Customer>('customers', tenantId),
        usersApi.fetchUsers(tenantId)
      ]);
      setFollowups(fList);
      setCustomers(cList);
      setUsers(uList);
    } catch (err) {
      console.error('Failed to load follow-ups from database:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, [tenantId]);

  // Filters
  const [activeTab, setActiveTab] = useState<'ALL' | 'DUE_TODAY' | 'UPCOMING' | 'COMPLETED' | 'OVERDUE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [picFilter, setPicFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const today = new Date().toISOString().split('T')[0];

  // Map derived status
  const enrichedFollowUps = useMemo(() => {
    return followups.map(f => {
      let derivedStatus = f.status as string;
      if (f.status !== 'COMPLETED' && f.status !== 'CANCELLED') {
        if (f.followUpDate < today) derivedStatus = 'OVERDUE';
        else if (f.followUpDate === today) derivedStatus = 'DUE_TODAY';
        else derivedStatus = 'SCHEDULED';
      }
      return { ...f, derivedStatus };
    });
  }, [followups, today]);

  // Filtering
  const filteredData = useMemo(() => {
    return enrichedFollowUps.filter(f => {
      // Tab Filter
      if (activeTab === 'DUE_TODAY' && f.derivedStatus !== 'DUE_TODAY') return false;
      if (activeTab === 'UPCOMING' && f.derivedStatus !== 'SCHEDULED') return false;
      if (activeTab === 'COMPLETED' && f.derivedStatus !== 'COMPLETED') return false;
      if (activeTab === 'OVERDUE' && f.derivedStatus !== 'OVERDUE') return false;

      // Search (Title, Notes, Customer Name)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches = 
          (f.title || '').toLowerCase().includes(q) || 
          (f.notes || '').toLowerCase().includes(q) || 
          f.customerName.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Dropdown Filters
      if (customerFilter !== 'ALL' && f.customerId !== customerFilter) return false;
      if (picFilter !== 'ALL' && f.picId !== picFilter) return false;
      
      // Status Filter
      if (statusFilter !== 'ALL' && f.derivedStatus !== statusFilter) return false;

      // Date Range
      if (dateStart && f.followUpDate < dateStart) return false;
      if (dateEnd && f.followUpDate > dateEnd) return false;

      return true;
    }).sort((a, b) => new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime());
  }, [enrichedFollowUps, activeTab, searchQuery, customerFilter, picFilter, statusFilter, dateStart, dateEnd]);

  const toggleComplete = async (f: FollowUp) => {
    const isCompleted = f.status === 'COMPLETED';
    const updated = { 
      ...f, 
      status: (isCompleted ? 'PENDING' : 'COMPLETED') as FollowUpStatus,
      completedAt: isCompleted ? undefined : new Date().toISOString()
    };
    await crmApi.updateRecord('follow_ups', f.id, updated);
    loadData();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DUE_TODAY':
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-md uppercase tracking-wider border border-amber-200">Due Today</span>;
      case 'OVERDUE':
        return <span className="px-2 py-1 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-md uppercase tracking-wider border border-rose-200">Overdue</span>;
      case 'COMPLETED':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md uppercase tracking-wider border border-emerald-200">Completed</span>;
      case 'CANCELLED':
        return <span className="px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md uppercase tracking-wider border border-slate-200">Cancelled</span>;
      case 'SCHEDULED':
      default:
        return <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-md uppercase tracking-wider border border-indigo-200">Scheduled</span>;
    }
  };

  const tabs = [
    { id: 'ALL', label: 'All' },
    { id: 'DUE_TODAY', label: 'Due Today' },
    { id: 'UPCOMING', label: 'Upcoming' },
    { id: 'COMPLETED', label: 'Completed' },
    { id: 'OVERDUE', label: 'Overdue' }
  ];

  return (
    <div className="space-y-6 font-['Inter',sans-serif] h-full flex flex-col max-w-[1600px] mx-auto pb-6">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
            Follow-ups
          </h1>
          <p className="text-xs text-[#767587] mt-0.5">
            Manage your daily cadences, calls, emails, and client touchpoints.
          </p>
        </div>
        <button
          onClick={() => alert('Navigate to Create Follow-up page')}
          className="px-4 py-2.5 bg-[#4744e5] hover:bg-[#322fce] text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5 font-['Hanken_Grotesk'] shrink-0 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Create Follow-up</span>
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-1 border-b border-[#E1E1E1] overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.id 
                ? 'border-[#4744e5] text-[#4744e5]' 
                : 'border-transparent text-[#767587] hover:text-[#1a1c1c] hover:border-slate-300'
            }`}
          >
            {tab.label}
            <span className="ml-2 px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] text-slate-600 border border-slate-200">
              {tab.id === 'ALL' 
                ? enrichedFollowUps.length
                : enrichedFollowUps.filter(f => {
                    if (tab.id === 'DUE_TODAY') return f.derivedStatus === 'DUE_TODAY';
                    if (tab.id === 'UPCOMING') return f.derivedStatus === 'SCHEDULED';
                    if (tab.id === 'COMPLETED') return f.derivedStatus === 'COMPLETED';
                    if (tab.id === 'OVERDUE') return f.derivedStatus === 'OVERDUE';
                    return false;
                  }).length}
            </span>
          </button>
        ))}
      </div>

      {/* FILTER TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-[#E1E1E1] shadow-2xs flex flex-wrap gap-4 items-end">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-1.5">Search</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              type="text"
              placeholder="Search title, notes, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[#E1E1E1] rounded-xl text-xs focus:outline-none focus:border-[#4744e5]"
            />
          </div>
        </div>

        {/* Customer Filter */}
        <div className="w-full sm:w-[160px]">
          <label className="block text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-1.5">Customer</label>
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs focus:outline-none focus:border-[#4744e5] bg-white"
          >
            <option value="ALL">All Customers</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* PIC Filter */}
        <div className="w-full sm:w-[150px]">
          <label className="block text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-1.5">PIC</label>
          <select
            value={picFilter}
            onChange={(e) => setPicFilter(e.target.value)}
            className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs focus:outline-none focus:border-[#4744e5] bg-white"
          >
            <option value="ALL">All PICs</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-[140px]">
          <label className="block text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-1.5">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs focus:outline-none focus:border-[#4744e5] bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="DUE_TODAY">Due Today</option>
            <option value="OVERDUE">Overdue</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Date Range */}
        <div className="flex gap-2">
          <div>
            <label className="block text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-1.5">Date Range</label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-[120px] px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs focus:outline-none focus:border-[#4744e5] bg-white"
            />
          </div>
          <div className="self-end pb-2.5 text-slate-400">-</div>
          <div className="self-end">
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-[120px] px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs focus:outline-none focus:border-[#4744e5] bg-white"
            />
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-[#E1E1E1] rounded-2xl shadow-2xs overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-[#E1E1E1]">
              <tr>
                <th className="px-5 py-4 text-xs font-bold text-[#464555]">Customer</th>
                <th className="px-5 py-4 text-xs font-bold text-[#464555]">Follow-up Action</th>
                <th className="px-5 py-4 text-xs font-bold text-[#464555]">Related Visit</th>
                <th className="px-5 py-4 text-xs font-bold text-[#464555]">Related Task</th>
                <th className="px-5 py-4 text-xs font-bold text-[#464555]">PIC</th>
                <th className="px-5 py-4 text-xs font-bold text-[#464555]">Due Date</th>
                <th className="px-5 py-4 text-xs font-bold text-[#464555]">Status</th>
                <th className="px-5 py-4 text-xs font-bold text-[#464555] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E1E1]">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">event_busy</span>
                      <h3 className="text-sm font-bold text-[#1a1c1c]">No follow-ups found</h3>
                      <p className="text-xs text-[#767587] mt-1">Try adjusting your filters or create a new follow-up.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50/50 group transition-colors">
                    
                    {/* Customer */}
                    <td className="px-5 py-3">
                      <div className="font-bold text-[#1a1c1c]">{f.customerName}</div>
                      <div className="text-[11px] text-[#767587]">{f.customerCode}</div>
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${
                          f.type === 'CALL' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          f.type === 'EMAIL' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                          f.type === 'MEETING' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          f.type === 'WHATSAPP' ? 'bg-green-50 text-green-700 border-green-200' :
                          'bg-slate-50 text-slate-700 border-slate-200'
                        }`}>
                          {f.type}
                        </span>
                        <span className={`font-bold text-sm ${f.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-[#1a1c1c]'}`}>
                          {f.title || f.type}
                        </span>
                      </div>
                      <div className="text-xs text-[#767587] truncate max-w-[250px]">{f.notes || '-'}</div>
                    </td>

                    {/* Related Visit */}
                    <td className="px-5 py-3">
                      {f.relatedVisitId ? (
                        <div className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">pin_drop</span>
                          {f.relatedVisitId}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>

                    {/* Related Task */}
                    <td className="px-5 py-3">
                      {f.relatedTaskId ? (
                        <div className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">task</span>
                          {f.relatedTaskId}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>

                    {/* PIC */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {f.picAvatar ? (
                          <img src={f.picAvatar} alt={f.picName} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                            {f.picName.charAt(0)}
                          </div>
                        )}
                        <span className="text-xs font-medium text-[#1a1c1c]">{f.picName}</span>
                      </div>
                    </td>

                    {/* Due Date */}
                    <td className="px-5 py-3">
                      <div className={`text-xs font-bold ${
                        f.derivedStatus === 'OVERDUE' ? 'text-rose-600' :
                        f.derivedStatus === 'DUE_TODAY' ? 'text-amber-600' : 'text-[#1a1c1c]'
                      }`}>
                        {new Date(f.followUpDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-5 py-3">
                      {getStatusBadge(f.derivedStatus)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="View"
                          onClick={() => navigate(`/followups/${f.id}`)}
                          className="p-1.5 text-[#767587] hover:text-[#1a1c1c] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button
                          title="Edit"
                          className="p-1.5 text-[#767587] hover:text-[#4744e5] hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          title="Reassign PIC"
                          className="p-1.5 text-[#767587] hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">assignment_ind</span>
                        </button>
                        {f.status !== 'COMPLETED' && (
                          <button
                            title="Complete"
                            onClick={() => toggleComplete(f)}
                            className="p-1.5 text-[#767587] hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                          </button>
                        )}
                      </div>
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

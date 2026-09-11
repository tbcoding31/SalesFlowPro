import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FollowUp, Customer, User } from '../../types';
import { crmApi } from '../../services/crmApi';
import { CreateFollowUpModal } from '../../components/followups/CreateFollowUpModal';
import { CompleteFollowUpModal } from '../../components/followups/CompleteFollowUpModal';
import { CancelFollowUpModal } from '../../components/followups/CancelFollowUpModal';

import { canAccessAllScope } from '../../utils/roleUtils';

export const FollowupsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentTenant, currentUser } = useAuth();
  const tenantId = currentTenant?.id || '';

  // Scope Enforcement (All vs My) with resilient semantic role normalization
  const canAccessAll = canAccessAllScope(currentUser?.role, (currentUser as any)?.isPlatformUser);
  const requestedScope = searchParams.get('scope') || 'my';
  const activeScope = (canAccessAll && requestedScope === 'all') ? 'all' : 'my';

  const handleScopeChange = (newScope: 'my' | 'all') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('scope', newScope);
      return next;
    });
    setCurrentPage(1);
  };

  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [completingFollowUp, setCompletingFollowUp] = useState<FollowUp | null>(null);
  const [cancellingFollowUp, setCancellingFollowUp] = useState<FollowUp | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'ALL' | 'DUE_TODAY' | 'UPCOMING' | 'COMPLETED' | 'OVERDUE'>('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [picFilter, setPicFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const loadData = async (page = currentPage) => {
    setIsLoading(true);
    try {
      const [fRes, cList, uList] = await Promise.all([
        crmApi.fetchFollowUps({
          page,
          pageSize,
          search: searchQuery || undefined,
          tenantId,
          dueDateFrom: dateStart || undefined,
          dueDateTo: dateEnd || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          customerId: customerFilter !== 'ALL' ? customerFilter : undefined,
          picId: picFilter !== 'ALL' ? picFilter : undefined,
          scope: activeScope
        }),
        crmApi.fetchCollection<Customer>('customers', tenantId),
        crmApi.fetchCollection<User>('users', tenantId)
      ]);

      if ((fRes as any).data) {
        setFollowups((fRes as any).data);
        if ((fRes as any).pagination) {
          setTotalItems((fRes as any).pagination.totalItems);
          setTotalPages((fRes as any).pagination.totalPages);
          setCurrentPage((fRes as any).pagination.page);
        } else {
          setTotalItems((fRes as any).data.length);
          setTotalPages(1);
        }
      }
      setCustomers(cList || []);
      setUsers(uList || []);
    } catch (err) {
      console.error('Failed to load follow-ups', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
  }, [tenantId, pageSize, searchQuery, customerFilter, picFilter, statusFilter, dateStart, dateEnd, activeScope]);

  // Derive status presentation
  const enrichedFollowUps = useMemo(() => {
    return followups.map((f) => {
      let derivedStatus = f.status as string;
      const fDate = f.followUpDate ? f.followUpDate.split('T')[0] : '';
      if (f.status !== 'COMPLETED' && f.status !== 'CANCELLED') {
        if (fDate && fDate < today) derivedStatus = 'OVERDUE';
        else if (fDate && fDate === today) derivedStatus = 'DUE_TODAY';
        else derivedStatus = 'SCHEDULED';
      }
      return { ...f, derivedStatus, cleanDate: fDate };
    });
  }, [followups, today]);

  // Tab filtering
  const filteredData = useMemo(() => {
    return enrichedFollowUps.filter((f) => {
      if (activeTab === 'DUE_TODAY' && f.derivedStatus !== 'DUE_TODAY') return false;
      if (activeTab === 'UPCOMING' && f.derivedStatus !== 'SCHEDULED') return false;
      if (activeTab === 'COMPLETED' && f.derivedStatus !== 'COMPLETED') return false;
      if (activeTab === 'OVERDUE' && f.derivedStatus !== 'OVERDUE') return false;
      return true;
    });
  }, [enrichedFollowUps, activeTab]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DUE_TODAY':
        return (
          <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-md uppercase tracking-wider border border-amber-200">
            Due Today
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="px-2 py-1 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-md uppercase tracking-wider border border-rose-200">
            Overdue
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md uppercase tracking-wider border border-emerald-200">
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md uppercase tracking-wider border border-slate-200">
            Cancelled
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md uppercase tracking-wider border border-blue-200">
            In Progress
          </span>
        );
      case 'SCHEDULED':
      case 'OPEN':
      default:
        return (
          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-md uppercase tracking-wider border border-indigo-200">
            Scheduled
          </span>
        );
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
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {canAccessAll && (
            <div className="flex bg-[#f3f3f3] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleScopeChange('my')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeScope === 'my'
                    ? 'bg-white shadow-xs text-[#4744e5]'
                    : 'text-[#767587] hover:text-[#1a1c1c]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">person</span>
                <span>My Follow-ups</span>
              </button>
              <button
                type="button"
                onClick={() => handleScopeChange('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeScope === 'all'
                    ? 'bg-white shadow-xs text-[#4744e5]'
                    : 'text-[#767587] hover:text-[#1a1c1c]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">group</span>
                <span>All Follow-ups</span>
              </button>
            </div>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-[#4744e5] hover:bg-[#322fce] text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5 font-['Hanken_Grotesk'] shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Create Follow-up</span>
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 border-b border-[#E1E1E1] overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
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
                : enrichedFollowUps.filter((f) => {
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
          <label className="block text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-1.5">
            Search
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search title, notes, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[#E1E1E1] rounded-xl text-xs focus:outline-hidden focus:border-[#4744e5]"
            />
          </div>
        </div>

        {/* Customer Filter */}
        <div className="w-full sm:w-[160px]">
          <label className="block text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-1.5">
            Customer
          </label>
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs focus:outline-hidden focus:border-[#4744e5] bg-white"
          >
            <option value="ALL">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* PIC Filter */}
        <div className="w-full sm:w-[160px]">
          <label className="block text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-1.5">
            Assigned PIC
          </label>
          <select
            value={picFilter}
            onChange={(e) => setPicFilter(e.target.value)}
            className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs focus:outline-hidden focus:border-[#4744e5] bg-white"
          >
            <option value="ALL">All PICs</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-[140px]">
          <label className="block text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-1.5">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs focus:outline-hidden focus:border-[#4744e5] bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open / Scheduled</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Date Range */}
        <div className="flex gap-2">
          <div>
            <label className="block text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-1.5">
              Due Date From
            </label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-[130px] px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs focus:outline-hidden focus:border-[#4744e5] bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-1.5">
              Due Date To
            </label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-[130px] px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs focus:outline-hidden focus:border-[#4744e5] bg-white"
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
                <th className="px-5 py-4 text-xs font-bold text-[#464555]">Context Link</th>
                <th className="px-5 py-4 text-xs font-bold text-[#464555]">PIC</th>
                <th className="px-5 py-4 text-xs font-bold text-[#464555]">Due Date</th>
                <th className="px-5 py-4 text-xs font-bold text-[#464555]">Evidence</th>
                <th className="px-5 py-4 text-xs font-bold text-[#464555]">Status</th>
                <th className="px-5 py-4 text-xs font-bold text-[#464555] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E1E1]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-3xl animate-spin mb-2">
                      progress_activity
                    </span>
                    <p className="text-xs">Loading follow-ups...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">
                        event_busy
                      </span>
                      <h3 className="text-sm font-bold text-[#1a1c1c]">No follow-ups found</h3>
                      <p className="text-xs text-[#767587] mt-1">
                        Try adjusting your filters or create a new follow-up.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/50 group transition-colors">
                    {/* Customer */}
                    <td className="px-5 py-3">
                      <div className="font-bold text-[#1a1c1c]">{f.customerName}</div>
                      <div className="text-[11px] text-[#767587]">{f.customerCode}</div>
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="px-1.5 py-0.5 rounded-md border text-[10px] font-bold flex items-center gap-1"
                          style={{
                            backgroundColor: `${f.typeColor || '#4744e5'}15`,
                            borderColor: `${f.typeColor || '#4744e5'}40`,
                            color: f.typeColor || '#4744e5'
                          }}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {f.typeIcon || 'call'}
                          </span>
                          <span>{f.typeName || f.type || 'Follow-up'}</span>
                        </span>
                        <span
                          className={`font-bold text-sm ${
                            f.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-[#1a1c1c]'
                          }`}
                        >
                          {f.title}
                        </span>
                      </div>
                      <div className="text-xs text-[#767587] truncate max-w-[280px]">
                        {f.notes || '-'}
                      </div>
                    </td>

                    {/* Context Link */}
                    <td className="px-5 py-3">
                      {f.relatedVisitId ? (
                        <div
                          onClick={() => navigate(`/visits/${f.relatedVisitId}`)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">directions_walk</span>
                          <span className="truncate max-w-[140px]">{f.visitTitle || f.relatedVisitId}</span>
                        </div>
                      ) : f.relatedProjectId ? (
                        <div
                          onClick={() => navigate(`/projects/${f.relatedProjectId}`)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">monetization_on</span>
                          <span className="truncate max-w-[140px]">{f.projectName || f.relatedProjectId}</span>
                        </div>
                      ) : f.relatedTaskId ? (
                        <div
                          onClick={() => navigate(`/tasks/${f.relatedTaskId}`)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">task_alt</span>
                          <span className="truncate max-w-[140px]">{f.taskTitle || f.relatedTaskId}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Direct</span>
                      )}
                    </td>

                    {/* PIC */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {f.picAvatar ? (
                          <img
                            src={f.picAvatar}
                            alt={f.picName}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                            {(f.picName || 'U').charAt(0)}
                          </div>
                        )}
                        <span className="text-xs font-medium text-[#1a1c1c]">{f.picName || 'Unassigned'}</span>
                      </div>
                    </td>

                    {/* Due Date */}
                    <td className="px-5 py-3">
                      <div
                        className={`text-xs font-bold ${
                          f.derivedStatus === 'OVERDUE'
                            ? 'text-rose-600'
                            : f.derivedStatus === 'DUE_TODAY'
                            ? 'text-amber-600'
                            : 'text-[#1a1c1c]'
                        }`}
                      >
                        {f.cleanDate ? new Date(f.cleanDate).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        }) : '-'}
                      </div>
                    </td>

                    {/* Evidence Indicator */}
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                          (f.evidenceCount || 0) > 0
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {(f.evidenceCount || 0) > 0 ? 'photo_camera' : 'no_photography'}
                        </span>
                        <span>{f.evidenceCount || 0}</span>
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="px-5 py-3">{getStatusBadge(f.derivedStatus)}</td>

                    {/* Actions */}
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="View Details"
                          onClick={() => navigate(`/followups/${f.id}`)}
                          className="p-1.5 text-[#767587] hover:text-[#1a1c1c] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>

                        {f.status !== 'COMPLETED' && f.status !== 'CANCELLED' && (
                          <>
                            <button
                              title="Complete Follow-up"
                              onClick={() => setCompletingFollowUp(f)}
                              className="p-1.5 text-[#767587] hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">check_circle</span>
                            </button>
                            <button
                              title="Cancel Follow-up"
                              onClick={() => setCancellingFollowUp(f)}
                              className="p-1.5 text-[#767587] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">cancel</span>
                            </button>
                          </>
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

      {/* MODALS */}
      {showCreateModal && (
        <CreateFollowUpModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => loadData(1)}
        />
      )}

      {completingFollowUp && (
        <CompleteFollowUpModal
          followUp={completingFollowUp}
          isOpen={!!completingFollowUp}
          onClose={() => setCompletingFollowUp(null)}
          onSuccess={() => {
            setCompletingFollowUp(null);
            loadData(currentPage);
          }}
        />
      )}

      {cancellingFollowUp && (
        <CancelFollowUpModal
          followUp={cancellingFollowUp}
          isOpen={!!cancellingFollowUp}
          onClose={() => setCancellingFollowUp(null)}
          onSuccess={() => {
            setCancellingFollowUp(null);
            loadData(currentPage);
          }}
        />
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Visit, User } from '../../../types';
import { crmApi } from '../../../services/crmApi';
import { useAuth } from '../../../context/AuthContext';

export interface CustomerVisitsTabProps {
  customerId: string;
  tenantUsers: User[];
}

export const CustomerVisitsTab: React.FC<CustomerVisitsTabProps> = ({ customerId, tenantUsers }) => {
  const { currentTenant, currentUser, hasPermission } = useAuth();
  const tenantId = currentTenant?.id;

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [visitsData, setVisitsData] = useState<{data: Visit[], pagination: any}>({ data: [], pagination: {} });
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [viewingVisit, setViewingVisit] = useState<Visit | null>(null);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [reschedulingVisit, setReschedulingVisit] = useState<Visit | null>(null);
  const [cancellingVisit, setCancellingVisit] = useState<Visit | null>(null);

  // Forms state
  const [visitTitle, setVisitTitle] = useState('');
  const [visitPurpose, setVisitPurpose] = useState('Product Presentation & Demo');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:30');
  const [location, setLocation] = useState('Customer Office');

  const [editVisitTitle, setEditVisitTitle] = useState('');
  const [editVisitPurpose, setEditVisitPurpose] = useState('');
  const [editVisitLocation, setEditVisitLocation] = useState('');
  const [editVisitStatus, setEditVisitStatus] = useState<any>('PLANNED');
  const [editVisitResult, setEditVisitResult] = useState('');
  const [editVisitNextAction, setEditVisitNextAction] = useState('');

  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStartTime, setRescheduleStartTime] = useState('10:00');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('11:30');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const [cancelReason, setCancelReason] = useState('');

  // Filters State
  const [visitStartDate, setVisitStartDate] = useState('');
  const [visitEndDate, setVisitEndDate] = useState('');
  const [visitSearch, setVisitSearch] = useState('');
  const [visitPicFilter, setVisitPicFilter] = useState('ALL');
  const [visitStatusFilter, setVisitStatusFilter] = useState('ALL');
  const [visitPurposeFilter, setVisitPurposeFilter] = useState('ALL');

  const fetchVisits = async () => {
    setIsLoading(true);
    try {
      const res = await crmApi.fetchVisits({
        customerId,
        tenantId,
        page,
        pageSize,
        search: visitSearch,
        picId: visitPicFilter,
        status: visitStatusFilter,
      });
      // The backend doesn't support purpose filtering in the DB out-of-the-box, 
      // but for this phase we must adhere to the data contract. If purpose isn't returned, 
      // we filter locally IF needed, but ideally we only use backend pagination.
      setVisitsData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if(customerId) {
        fetchVisits();
    }
  }, [customerId, tenantId, page, visitSearch, visitPicFilter, visitStatusFilter]);

  const refreshVisits = fetchVisits;

  const handleCreateVisit = (e: React.FormEvent) => {
    e.preventDefault();
    const newVisit: Partial<Visit> = {
      tenantId,
      customerId,
      picId: currentUser?.id,
      title: visitTitle,
      purpose: visitPurpose,
      visitDate,
      startTime,
      endTime,
      location,
      status: 'PLANNED',
    };
    crmApi.createRecord('visits', newVisit).then(() => {
      refreshVisits();
      setShowVisitModal(false);
      setVisitTitle('');
    });
  };

  const handleSaveEditVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVisit) return;
    const updated: Partial<Visit> = {
      title: editVisitTitle,
      purpose: editVisitPurpose,
      location: editVisitLocation,
      status: editVisitStatus,
      result: editVisitResult,
      nextAction: editVisitNextAction,
    };
    crmApi.updateRecord('visits', editingVisit.id, updated).then(() => {
      refreshVisits();
      setEditingVisit(null);
    });
  };

  const handleConfirmReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingVisit) return;
    const updated: Partial<Visit> = {
      visitDate: rescheduleDate,
      startTime: rescheduleStartTime,
      endTime: rescheduleEndTime,
      status: 'RESCHEDULED',
      notes: rescheduleReason ? `Rescheduled: ${rescheduleReason}` : reschedulingVisit.notes,
    };
    crmApi.updateRecord('visits', reschedulingVisit.id, updated).then(() => {
      refreshVisits();
      setReschedulingVisit(null);
    });
  };

  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingVisit) return;
    const updated: Partial<Visit> = {
      status: 'CANCELLED',
      notes: cancelReason ? `Cancelled: ${cancelReason}` : cancellingVisit.notes,
    };
    crmApi.updateRecord('visits', cancellingVisit.id, updated).then(() => {
      refreshVisits();
      setCancellingVisit(null);
    });
  };

  const filteredVisits = visitsData.data || [];
  const totalVisitsCount = visitsData.pagination.totalItems || 0;
  const completedVisitsCount = filteredVisits.filter(v => v.status === 'COMPLETED').length;
  const upcomingVisitsCount = filteredVisits.filter(v => v.status === 'PLANNED' || v.status === 'SCHEDULED').length;
  const cancelledVisitsCount = filteredVisits.filter(v => v.status === 'CANCELLED' || v.status === 'RESCHEDULED').length;
  
  return (
    <div className="relative">
      <div className="space-y-6">
          {/* VISITS TAB HEADER & ACTION */}
          <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4744e5]">route</span>
                <h2 className="text-lg font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Customer Visit Records & Schedule</h2>
              </div>
              <p className="text-xs text-[#767587] mt-0.5">
                Complete log of sales presentations, technical site audits, and upcoming client visits for {'Customer'}.
              </p>
            </div>
            <button
              onClick={() => setShowVisitModal(true)}
              className="px-4 py-2 bg-[#4744e5] hover:bg-[#3834d0] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors self-start md:self-auto"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Schedule New Visit</span>
            </button>
          </div>

          {/* VISIT SUMMARY METRICS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-xs">
              <span className="text-[11px] font-semibold text-[#767587] block uppercase tracking-wider">Total Visits</span>
              <span className="text-xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1 block">
                {totalVisitsCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#00C875]/30 shadow-xs bg-[#00C875]/5">
              <span className="text-[11px] font-semibold text-[#008f53] block uppercase tracking-wider">Completed</span>
              <span className="text-xl font-extrabold text-[#008f53] font-['Hanken_Grotesk'] mt-1 block">
                {completedVisitsCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#4744e5]/30 shadow-xs bg-[#4744e5]/5">
              <span className="text-[11px] font-semibold text-[#4744e5] block uppercase tracking-wider">Upcoming</span>
              <span className="text-xl font-extrabold text-[#4744e5] font-['Hanken_Grotesk'] mt-1 block">
                {upcomingVisitsCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#ba1a1a]/30 shadow-xs bg-[#ba1a1a]/5">
              <span className="text-[11px] font-semibold text-[#ba1a1a] block uppercase tracking-wider">Cancelled</span>
              <span className="text-xl font-extrabold text-[#ba1a1a] font-['Hanken_Grotesk'] mt-1 block">
                {cancelledVisitsCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-xs">
              <span className="text-[11px] font-semibold text-[#767587] block uppercase tracking-wider">Last Visit</span>
              <span className="text-xs font-bold text-[#1a1c1c] mt-1 block truncate">
                {""}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-xs">
              <span className="text-[11px] font-semibold text-[#767587] block uppercase tracking-wider">Next Visit</span>
              <span className="text-xs font-bold text-[#4744e5] mt-1 block truncate">
                {""}
              </span>
            </div>
          </div>

          {/* FILTERS SECTION */}
          <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#1a1c1c] uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#767587]">filter_list</span>
                <span>Filter Visit History</span>
              </span>
              {(visitSearch || visitPicFilter !== 'ALL' || visitStatusFilter !== 'ALL' || visitPurposeFilter !== 'ALL' || visitStartDate || visitEndDate) && (
                <button
                  onClick={() => {
                    setVisitSearch('');
                    setVisitPicFilter('ALL');
                    setVisitStatusFilter('ALL');
                    setVisitPurposeFilter('ALL');
                    setVisitStartDate('');
                    setVisitEndDate('');
                  }}
                  className="text-xs text-[#4744e5] hover:underline font-bold cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {/* Search */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#767587] text-[16px]">search</span>
                <input
                  type="text"
                  placeholder="Search visit title, notes..."
                  value={visitSearch}
                  onChange={(e) => setVisitSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-[#E1E1E1] rounded-lg bg-white"
                />
              </div>

              {/* PIC Filter */}
              <div>
                <select
                  value={visitPicFilter}
                  onChange={(e) => setVisitPicFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-medium"
                >
                  <option value="ALL">All Sales PIC</option>
                  {tenantUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={visitStatusFilter}
                  onChange={(e) => setVisitStatusFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PLANNED">Scheduled / Planned</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="RESCHEDULED">Rescheduled</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="NO_SHOW">No Show</option>
                </select>
              </div>

              {/* Purpose Filter */}
              <div>
                <select
                  value={visitPurposeFilter}
                  onChange={(e) => setVisitPurposeFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-medium"
                >
                  <option value="ALL">All Purposes</option>
                  <option value="Product Presentation & Demo">Product Presentation & Demo</option>
                  <option value="Contract Renewal Negotiation">Contract Renewal Negotiation</option>
                  <option value="Routine Checking & Relationship">Routine Checking & Relationship</option>
                  <option value="Price Negotiation">Price Negotiation</option>
                  <option value="Onsite Technical Audit">Onsite Technical Audit</option>
                </select>
              </div>

              {/* Date Range Start & End */}
              <div className="flex gap-1">
                <input
                  type="date"
                  value={visitStartDate}
                  onChange={(e) => setVisitStartDate(e.target.value)}
                  className="w-1/2 px-1.5 py-1.5 border border-[#E1E1E1] rounded-lg text-[11px]"
                  title="From Date"
                />
                <input
                  type="date"
                  value={visitEndDate}
                  onChange={(e) => setVisitEndDate(e.target.value)}
                  className="w-1/2 px-1.5 py-1.5 border border-[#E1E1E1] rounded-lg text-[11px]"
                  title="To Date"
                />
              </div>
            </div>
          </div>

          {/* VISITS ENTERPRISE TABLE */}
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E1E1E1] flex justify-between items-center bg-[#fcfcfc]">
              <span className="text-xs font-bold text-[#1a1c1c]">
                Showing {filteredVisits.length} of {filteredVisits.length} visits
              </span>
              <span className="text-[11px] text-[#767587]">
                Scope: {!hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS') ? 'Own Visits' : hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS') ? 'Team Scope' : 'Organization Scope'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f9f9f9] border-b border-[#E1E1E1] text-[10px] font-extrabold uppercase text-[#767587]">
                  <tr>
                    <th className="py-3 px-4">Visit Date & Time</th>
                    <th className="py-3 px-4">Sales PIC</th>
                    <th className="py-3 px-4">Purpose & Subject</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Result / Notes</th>
                    <th className="py-3 px-4">Next Action</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E1E1]">
                  {filteredVisits.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#767587]">
                        No visits found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredVisits.map((v) => (
                      <tr key={v.id} className="hover:bg-[#fcfcfc] transition-colors">
                        {/* Visit Date & Time */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-bold text-[#1a1c1c] block">{v.visitDate}</span>
                          <span className="text-[11px] text-[#767587] flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[13px]">schedule</span>
                            <span>{v.startTime} - {v.endTime}</span>
                          </span>
                        </td>

                        {/* PIC */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#4744e5]/10 text-[#4744e5] font-bold text-[10px] flex items-center justify-center">
                              {(v.picName || "U").charAt(0)}
                            </div>
                            <span className="font-semibold text-[#1a1c1c]">{v.picName}</span>
                          </div>
                        </td>

                        {/* Purpose & Subject */}
                        <td className="py-3 px-4">
                          <span className="font-bold text-[#1a1c1c] block text-xs">{v.title}</span>
                          <span className="text-[10px] font-bold text-[#4744e5] bg-[#4744e5]/5 px-2 py-0.5 rounded inline-block mt-0.5">
                            {v.purpose}
                          </span>
                          {v.location && (
                            <span className="text-[11px] text-[#767587] flex items-center gap-1 mt-1">
                              <span className="material-symbols-outlined text-[12px]">location_on</span>
                              <span className="truncate max-w-[200px]">{v.location}</span>
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {((v) => <span className="text-xs bg-gray-100 px-2 py-1 rounded">{v}</span>)(v.status)}
                        </td>

                        {/* Result */}
                        <td className="py-3 px-4 max-w-[220px]">
                          {v.result ? (
                            <p className="text-[11px] text-[#1a1c1c] line-clamp-2">{v.result}</p>
                          ) : (
                            <span className="text-[11px] text-[#a0a0a0] italic">No result recorded</span>
                          )}
                        </td>

                        {/* Next Action */}
                        <td className="py-3 px-4 max-w-[180px]">
                          {v.nextAction ? (
                            <span className="text-[11px] text-[#008f53] font-medium block bg-[#00C875]/10 px-2 py-1 rounded">
                              {v.nextAction}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#a0a0a0] italic">N/A</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setViewingVisit(v)}
                              title="View Visit Details"
                              className="p-1.5 hover:bg-[#f0f0f0] rounded text-[#464555] hover:text-[#1a1c1c] cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </button>

                            <button
                              onClick={() => { setEditingVisit(v); setShowVisitModal(false); }}
                              title="Edit Visit"
                              className="p-1.5 hover:bg-[#e1dfff] rounded text-[#4744e5] cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>

                            <button
                              onClick={() => setReschedulingVisit(v)}
                              title="Reschedule Visit"
                              className="p-1.5 hover:bg-[#fef3c7] rounded text-[#d97706] cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">event_repeat</span>
                            </button>

                            {v.status !== 'CANCELLED' && (
                              <button
                                onClick={() => setCancellingVisit(v)}
                                title="Cancel Visit"
                                className="p-1.5 hover:bg-[#fee2e2] rounded text-[#ba1a1a] cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]">block</span>
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
      
      {/* Pagination Controls */}
      <div className="flex justify-between items-center mt-4">
        <span className="text-xs text-gray-500">
          Showing {filteredVisits.length} of {visitsData.pagination.totalItems || 0} visits
        </span>
        <div className="flex gap-2">
          <button 
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-3 py-1 bg-gray-100 rounded text-xs disabled:opacity-50"
          >Previous</button>
          <button 
            disabled={!visitsData.pagination.hasNextPage}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 bg-gray-100 rounded text-xs disabled:opacity-50"
          >Next</button>
        </div>
      </div>
    </div>
  );
};

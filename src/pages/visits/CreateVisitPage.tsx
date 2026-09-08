import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { masterDataApi } from '../../services/masterDataApi';
import { Customer, User, VisitStatus, MasterDataItem } from '../../types';
import { crmApi } from '../../services/crmApi';
import { usersApi } from '../../services/usersApi';
import { resolveVisitOrigin, buildVisitsUrl } from '../../utils/visitNavigation';

interface UserWorkloadInfo {
  user: User;
  activeTasks: number;
  overdueTasks: number;
  workloadLevel: 'Low' | 'Medium' | 'High';
}

export const CreateVisitPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const navContext = useMemo(() => resolveVisitOrigin(searchParams), [searchParams]);
  const visitsUrl = useMemo(() => buildVisitsUrl(navContext), [navContext]);
  const { currentUser } = useAuth();
  const tenantId = currentUser?.tenantId ;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rawUsers, setRawUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [visitDate, setVisitDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('10:30');
  const [location, setLocation] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [title, setTitle] = useState<string>('');

  const [visitPurposes, setVisitPurposes] = useState<MasterDataItem[]>([]);

  // Ownership State
  const [selectedPicId, setSelectedPicId] = useState<string>(currentUser?.id || '');
  const [additionalPicIds, setAdditionalPicIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      crmApi.fetchCustomers({ page: 1, pageSize: 100 }),
      usersApi.fetchUsers(undefined, true),
      masterDataApi.fetchMasterData('visit_purposes', tenantId)
    ]).then(([custRes, usersRes, purposesRes]) => {
      if (!mounted) return;
      const custList = Array.isArray(custRes) ? custRes : (custRes?.data || []);
      setCustomers(custList);

      const userList = Array.isArray(usersRes) ? usersRes : [];
      setRawUsers(userList);

      const purposeList = Array.isArray(purposesRes) ? purposesRes : [];
      setVisitPurposes(purposeList);

      const def = purposeList.find((d: any) => d.isDefault || d.is_default);
      if (def) {
        setPurpose(def.codeValue || (def as any).code_value || '');
      } else if (purposeList.length > 0) {
        setPurpose(purposeList[0].codeValue || (purposeList[0] as any).code_value || '');
      }

      if (userList.length > 0) {
        setSelectedPicId((prev) => {
          if (prev && userList.some((u: any) => u.id === prev)) return prev;
          const matchCurrent = userList.find((u: any) => u.id === currentUser?.id);
          return matchCurrent ? matchCurrent.id : userList[0].id;
        });
      }
      setLoading(false);
    }).catch((err) => {
      console.error('[CreateVisitPage init error]', err);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [tenantId, currentUser?.id]);

  // Compute stats/workload for PIC dropdown results
  const usersWithWorkload = useMemo<UserWorkloadInfo[]>(() => {
    return rawUsers.map((u) => {
      // Authoritative active task count from tasks table
      const activeTasks = u.activeTasksCount ?? (u as any).taskCount ?? 0;
      const overdueTasks = (u as any).overdueTasksCount ?? 0;
      let workloadLevel: 'Low' | 'Medium' | 'High' = 'Medium';
      if (activeTasks > 10) workloadLevel = 'High';
      else if (activeTasks < 5) workloadLevel = 'Low';

      return {
        user: u,
        activeTasks,
        overdueTasks,
        workloadLevel,
      };
    });
  }, [rawUsers]);

  // PIC Searchable Dropdown state
  const [isPicDropdownOpen, setIsPicDropdownOpen] = useState<boolean>(false);
  const [picSearchQuery, setPicSearchQuery] = useState<string>('');
  const picDropdownRef = useRef<HTMLDivElement>(null);

  // Additional Participants Dropdown state
  const [isPartDropdownOpen, setIsPartDropdownOpen] = useState<boolean>(false);
  const [partSearchQuery, setPartSearchQuery] = useState<string>('');
  const partDropdownRef = useRef<HTMLDivElement>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (picDropdownRef.current && !picDropdownRef.current.contains(event.target as Node)) {
        setIsPicDropdownOpen(false);
      }
      if (partDropdownRef.current && !partDropdownRef.current.contains(event.target as Node)) {
        setIsPartDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Customer Selection
  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    const cus = customers.find((c) => c.id === id);
    if (cus) {
      if (!location || location === '') {
        setLocation(cus.address || `${cus.name} Head Office`);
      }
      if (!title) {
        const pLabel = visitPurposes.find(p => (p.codeValue || (p as any).code_value) === purpose)?.label || purpose;
        setTitle(`${pLabel || 'Meeting'} - ${cus.name}`);
      }
    }
  };

  // Selected Customer details
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  // Selected PIC info
  const selectedPicInfo = useMemo<UserWorkloadInfo | null>(
    () => {
      if (usersWithWorkload.length === 0) return null;
      return usersWithWorkload.find((u) => u.user.id === selectedPicId) || usersWithWorkload[0] || null;
    },
    [usersWithWorkload, selectedPicId]
  );

  // Filtered PIC options
  const filteredPics = useMemo(() => {
    if (!picSearchQuery) return usersWithWorkload;
    const q = picSearchQuery.toLowerCase();
    return usersWithWorkload.filter(
      (item) =>
        item.user.name.toLowerCase().includes(q) ||
        (item.user.roleName || '').toLowerCase().includes(q) ||
        (item.user.department || '').toLowerCase().includes(q)
    );
  }, [usersWithWorkload, picSearchQuery]);

  // Selected Additional Participants objects
  const selectedParticipants = useMemo(
    () => rawUsers.filter((u) => additionalPicIds.includes(u.id)),
    [rawUsers, additionalPicIds]
  );

  const toggleParticipant = (userId: string) => {
    if (additionalPicIds.includes(userId)) {
      setAdditionalPicIds(additionalPicIds.filter((id) => id !== userId));
    } else {
      setAdditionalPicIds([...additionalPicIds, userId]);
    }
  };

  // Save / Schedule Handler
  const handleSaveVisit = async (status: VisitStatus) => {
    if (!selectedCustomerId) {
      alert('Please select a customer.');
      return;
    }

    const cus = customers.find((c) => c.id === selectedCustomerId);
    const pic = selectedPicInfo?.user;
    const resolvedPicId = pic?.id || selectedPicId || currentUser?.id;

    if (!resolvedPicId) {
      alert('Please select a Person in Charge (PIC).');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        picId: resolvedPicId,
        title: title || `${purpose || 'Meeting'} - ${cus?.name || 'Customer'}`,
        purpose: purpose,
        visitDate: visitDate,
        startTime: startTime,
        endTime: endTime,
        location: location || cus?.address || 'Client Office',
        status: status,
        notes: notes,
        additionalPicIds: additionalPicIds,
      };

      const res = await crmApi.createVisit(payload);
      if (res.success) {
        setToastMessage(status === 'PLANNED' ? 'Visit draft saved successfully!' : 'Customer visit scheduled successfully!');
        setTimeout(() => {
          navigate(visitsUrl);
        }, 1200);
      } else {
        alert(`Failed to save visit: ${res.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Failed to save visit: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif] pb-16 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#1a1c1c] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <span className="material-symbols-outlined text-emerald-400 text-[20px]">check_circle</span>
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[11px] font-bold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] mb-2">
          <Link to={visitsUrl} className="hover:text-[#4744e5] transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">calendar_month</span>
            <span>Visits</span>
          </Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-[#1a1c1c]">Schedule Visit</span>
        </div>

        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
              Schedule Customer Visit
            </h1>
            <p className="text-xs text-[#767587] mt-0.5">
              Set up a new on-site or virtual customer meeting with assigned representatives and participants.
            </p>
          </div>

          <button
            onClick={() => navigate(visitsUrl)}
            className="px-3.5 py-1.5 border border-[#E1E1E1] text-[#555468] hover:bg-slate-50 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back to Schedule</span>
          </button>
        </div>
      </div>

      {/* TWO-COLUMN FORM LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: VISIT INFORMATION */}
        <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-5">
          <div className="flex items-center gap-2 border-b border-[#f0f0f4] pb-3">
            <span className="material-symbols-outlined text-[#4744e5] text-[20px]">event_note</span>
            <h2 className="text-base font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
              Visit Information
            </h2>
          </div>

          {/* Customer Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center justify-between">
              <span>Customer <span className="text-rose-500">*</span></span>
              {selectedCustomer && (
                <span className="text-[10px] text-[#4744e5] font-semibold">{selectedCustomer.code}</span>
              )}
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => handleSelectCustomer(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium"
            >
              <option value="">-- Select Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code}) — {c.region}
                </option>
              ))}
            </select>
          </div>

          {/* Visit Purpose */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
              Visit Purpose <span className="text-rose-500">*</span>
            </label>
            <select
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value);
                if (selectedCustomer) {
                  const pItem = visitPurposes.find(p => (p.codeValue || (p as any).code_value) === e.target.value);
                  const label = pItem?.label || e.target.value;
                  setTitle(`${label} - ${selectedCustomer.name}`);
                }
              }}
              className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium"
            >
              <option value="">Select Purpose</option>
              {visitPurposes.map(p => {
                const val = p.codeValue || (p as any).code_value || p.id;
                return (
                  <option key={p.id} value={val}>{p.label}</option>
                );
              })}
            </select>
          </div>

          {/* Visit Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
              Visit Title / Subject
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Strategic Review & Tech Modernization"
              className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] placeholder:text-[#a0a0b0] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium"
            />
          </div>

          {/* Visit Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
              Visit Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium"
              />
            </div>
          </div>

          {/* Visit Time Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Start Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                End Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium"
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
              Location / Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#767587]">
                location_on
              </span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Cyber 2 Tower Lt. 15, Jakarta"
                className="w-full pl-9 pr-3.5 py-2.5 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] placeholder:text-[#a0a0b0] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: OWNERSHIP */}
        <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-5">
          <div className="flex items-center gap-2 border-b border-[#f0f0f4] pb-3">
            <span className="material-symbols-outlined text-[#4744e5] text-[20px]">badge</span>
            <h2 className="text-base font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
              Ownership
            </h2>
          </div>

          {/* PIC SELECTOR - SEARCHABLE DROPDOWN WITH WORKLOAD METRICS */}
          <div className="space-y-1.5 relative" ref={picDropdownRef}>
            <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
              PIC (Person in Charge) <span className="text-rose-500">*</span>
            </label>

            {/* Selected PIC Display Trigger */}
            <div
              onClick={() => usersWithWorkload.length > 0 && setIsPicDropdownOpen(!isPicDropdownOpen)}
              className={`w-full p-3 border border-[#E1E1E1] hover:border-[#4744e5] rounded-xl bg-white flex items-center justify-between cursor-pointer transition-all shadow-2xs ${
                usersWithWorkload.length === 0 ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {selectedPicInfo ? (
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={
                      selectedPicInfo.user?.avatarUrl ||
                      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                    }
                    alt={selectedPicInfo.user?.name || 'User'}
                    className="w-9 h-9 rounded-full object-cover border border-[#E1E1E1] shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-[#1a1c1c] font-['Hanken_Grotesk'] truncate">
                        {selectedPicInfo.user?.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-[#555468] font-bold shrink-0">
                        {selectedPicInfo.user?.roleName || selectedPicInfo.user?.position || 'Sales Rep'}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#767587] flex items-center gap-2 mt-0.5">
                      <span>{selectedPicInfo.activeTasks} active tasks</span>
                      <span>•</span>
                      <span className="text-rose-600 font-semibold">{selectedPicInfo.overdueTasks} overdue</span>
                      <span>•</span>
                      <span
                        className={`font-semibold ${
                          selectedPicInfo.workloadLevel === 'High'
                            ? 'text-amber-600'
                            : selectedPicInfo.workloadLevel === 'Low'
                            ? 'text-emerald-600'
                            : 'text-indigo-600'
                        }`}
                      >
                        {selectedPicInfo.workloadLevel} workload
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-[#767587]">
                  <span className="material-symbols-outlined text-[20px]">person</span>
                  <span>{loading ? 'Loading sales representatives...' : 'No assignable sales representatives found'}</span>
                </div>
              )}
              <span className="material-symbols-outlined text-[#767587] text-[20px] shrink-0">
                {isPicDropdownOpen ? 'expand_less' : 'unfold_more'}
              </span>
            </div>

            {/* PIC Dropdown Menu */}
            {isPicDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E1E1E1] rounded-2xl shadow-xl z-30 p-3 space-y-2 max-h-80 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2">
                {/* Search Input Box */}
                <div className="relative shrink-0">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#767587]">
                    search
                  </span>
                  <input
                    type="text"
                    value={picSearchQuery}
                    onChange={(e) => setPicSearchQuery(e.target.value)}
                    placeholder="Search representative name or role..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E1E1E1] rounded-xl focus:outline-none focus:border-[#4744e5] bg-slate-50/60"
                    autoFocus
                  />
                </div>

                {/* Users List with Active/Overdue/Workload Badges */}
                <div className="overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                  {filteredPics.length === 0 ? (
                    <div className="py-4 text-center text-xs text-[#767587]">No sales reps found</div>
                  ) : (
                    filteredPics.map((item) => {
                      const isSelected = item.user.id === selectedPicId;
                      return (
                        <div
                          key={item.user.id}
                          onClick={() => {
                            setSelectedPicId(item.user.id);
                            setIsPicDropdownOpen(false);
                          }}
                          className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-indigo-50/70 border border-indigo-200'
                              : 'hover:bg-slate-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={
                                item.user.avatarUrl ||
                                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                              }
                              alt={item.user.name}
                              className="w-8 h-8 rounded-full object-cover border border-[#E1E1E1] shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs text-[#1a1c1c] font-['Hanken_Grotesk'] truncate">
                                  {item.user.name}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-[#555468] font-bold">
                                  {item.user.position || item.user.roleName || 'Sales Representative'}
                                </span>
                              </div>
                              <div className="text-[10px] text-[#767587] flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="font-medium text-[#1a1c1c]">{item.activeTasks} active tasks</span>
                                <span>•</span>
                                <span className="text-rose-600 font-semibold">{item.overdueTasks} overdue</span>
                                <span>•</span>
                                <span
                                  className={`font-bold ${
                                    item.workloadLevel === 'High'
                                      ? 'text-amber-600'
                                      : item.workloadLevel === 'Low'
                                      ? 'text-emerald-600'
                                      : 'text-indigo-600'
                                  }`}
                                >
                                  {item.workloadLevel} workload
                                </span>
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <span className="material-symbols-outlined text-[#4744e5] text-[18px] shrink-0">
                              check_circle
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ADDITIONAL PARTICIPANTS */}
          <div className="space-y-1.5 relative" ref={partDropdownRef}>
            <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
              Additional Participants
            </label>

            {/* Selected Chips */}
            <div
              onClick={() => setIsPartDropdownOpen(!isPartDropdownOpen)}
              className="w-full min-h-[42px] p-2 border border-[#E1E1E1] hover:border-[#4744e5] rounded-xl bg-white flex flex-wrap items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
            >
              {selectedParticipants.length === 0 ? (
                <span className="text-xs text-[#a0a0b0] px-1 font-medium">Select accompanying team members...</span>
              ) : (
                selectedParticipants.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 bg-slate-100 text-[#1a1c1c] text-[11px] font-bold px-2.5 py-1 rounded-lg border border-[#E1E1E1]"
                  >
                    <img
                      src={
                        p.avatarUrl ||
                        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                      }
                      alt={p.name}
                      className="w-4 h-4 rounded-full object-cover"
                    />
                    <span>{p.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleParticipant(p.id);
                      }}
                      className="hover:text-rose-600 text-[#767587]"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Additional Participants Dropdown Menu */}
            {isPartDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E1E1E1] rounded-2xl shadow-xl z-30 p-3 space-y-2 max-h-60 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2">
                <input
                  type="text"
                  value={partSearchQuery}
                  onChange={(e) => setPartSearchQuery(e.target.value)}
                  placeholder="Search team member..."
                  className="w-full px-3 py-1.5 text-xs border border-[#E1E1E1] rounded-xl focus:outline-none focus:border-[#4744e5] bg-slate-50/60"
                  autoFocus
                />
                <div className="overflow-y-auto space-y-1 pr-1">
                  {rawUsers
                    .filter(
                      (u) =>
                        u.id !== selectedPicId &&
                        (!partSearchQuery || u.name.toLowerCase().includes(partSearchQuery.toLowerCase()))
                    )
                    .map((u) => {
                      const isChecked = additionalPicIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleParticipant(u.id)}
                          className="p-2 rounded-xl hover:bg-slate-50 flex items-center justify-between cursor-pointer text-xs font-medium"
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={
                                u.avatarUrl ||
                                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                              }
                              alt={u.name}
                              className="w-6 h-6 rounded-full object-cover border border-[#E1E1E1]"
                            />
                            <span className="text-[#1a1c1c] font-bold">{u.name}</span>
                            <span className="text-[10px] text-[#767587]">({u.roleName || u.department})</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded text-[#4744e5] focus:ring-[#4744e5] w-3.5 h-3.5 border-[#E1E1E1]"
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* NOTES */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
              Notes / Agenda Preparation
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Enter meeting objectives, key discussion points, or preparation requirements..."
              className="w-full p-3 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] placeholder:text-[#a0a0b0] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium resize-none"
            />
          </div>
        </div>
      </div>

      {/* VISIT SUMMARY CARD */}
      <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#f0f0f4] pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4744e5] text-[20px]">fact_check</span>
            <h2 className="text-base font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
              Visit Summary
            </h2>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-[#4744e5]">
            {visitPurposes.find(p => (p.codeValue || (p as any).code_value) === purpose)?.label || purpose || 'Planned'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 bg-[#f8f8fb] p-4 rounded-xl border border-[#E1E1E1]">
          {/* Summary Item: Customer */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block">
              Customer
            </span>
            <p className="text-xs font-extrabold text-[#1a1c1c] truncate font-['Hanken_Grotesk']">
              {selectedCustomer ? selectedCustomer.name : '— Not selected —'}
            </p>
            {selectedCustomer && (
              <p className="text-[10px] text-[#767587] font-medium">{selectedCustomer.code}</p>
            )}
          </div>

          {/* Summary Item: Date */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block">
              Date
            </span>
            <p className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
              {visitDate
                ? new Date(visitDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '— Not specified —'}
            </p>
          </div>

          {/* Summary Item: Time */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block">
              Time
            </span>
            <p className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
              {startTime && endTime ? `${startTime} - ${endTime}` : '— Not specified —'}
            </p>
          </div>

          {/* Summary Item: Location */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block">
              Location
            </span>
            <p className="text-xs font-extrabold text-[#1a1c1c] truncate font-['Hanken_Grotesk']">
              {location || '— Not specified —'}
            </p>
          </div>

          {/* Summary Item: PIC */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block">
              PIC
            </span>
            <div className="flex items-center gap-1.5">
              {selectedPicInfo ? (
                <>
                  <img
                    src={
                      selectedPicInfo.user?.avatarUrl ||
                      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                    }
                    alt={selectedPicInfo.user?.name || 'User'}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                  <p className="text-xs font-extrabold text-[#1a1c1c] truncate font-['Hanken_Grotesk']">
                    {selectedPicInfo.user?.name}
                  </p>
                </>
              ) : (
                <p className="text-xs font-medium text-[#767587] truncate font-['Hanken_Grotesk']">
                  — Not assigned —
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ACTIONS BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => navigate(visitsUrl)}
          className="w-full sm:w-auto px-5 py-2.5 border border-[#E1E1E1] hover:bg-slate-100 text-[#555468] text-xs font-bold rounded-xl transition-all cursor-pointer font-['Hanken_Grotesk'] text-center"
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleSaveVisit('PLANNED')}
          className="w-full sm:w-auto px-5 py-2.5 border border-[#4744e5] text-[#4744e5] hover:bg-indigo-50 disabled:opacity-50 text-xs font-bold rounded-xl transition-all cursor-pointer font-['Hanken_Grotesk'] text-center"
        >
          {isSubmitting ? 'Saving...' : 'Save Draft'}
        </button>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleSaveVisit('CONFIRMED')}
          className="w-full sm:w-auto px-6 py-2.5 bg-[#4744e5] hover:bg-[#322fce] disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer font-['Hanken_Grotesk'] flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[18px]">send</span>
          <span>{isSubmitting ? 'Scheduling...' : 'Schedule Visit'}</span>
        </button>
      </div>
    </div>
  );
};

export default CreateVisitPage;

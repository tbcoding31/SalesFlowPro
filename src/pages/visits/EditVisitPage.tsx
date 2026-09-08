import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { masterDataApi } from '../../services/masterDataApi';
import { Customer, User, MasterDataItem, Visit } from '../../types';
import { crmApi } from '../../services/crmApi';
import { usersApi } from '../../services/usersApi';
import { formatDate } from '../../utils/formatters';
import { resolveVisitOrigin, buildVisitsUrl, buildVisitDetailUrl } from '../../utils/visitNavigation';

interface UserWorkloadInfo {
  user: User;
  activeTasks: number;
  overdueTasks: number;
  workloadLevel: 'Low' | 'Medium' | 'High';
}

export const EditVisitPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const navContext = useMemo(() => resolveVisitOrigin(searchParams), [searchParams]);
  const visitsUrl = useMemo(() => buildVisitsUrl(navContext), [navContext]);
  const detailUrl = useMemo(() => buildVisitDetailUrl(id || '', navContext), [id, navContext]);
  const { currentUser } = useAuth();
  const tenantId = currentUser?.tenantId;

  const [visit, setVisit] = useState<Visit | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rawUsers, setRawUsers] = useState<User[]>([]);
  const [visitPurposes, setVisitPurposes] = useState<MasterDataItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [visitDate, setVisitDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('10:30');
  const [location, setLocation] = useState<string>('');
  const [purposeId, setPurposeId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [selectedPicId, setSelectedPicId] = useState<string>('');
  const [additionalPicIds, setAdditionalPicIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');

  // Dropdown states
  const [isPicDropdownOpen, setIsPicDropdownOpen] = useState<boolean>(false);
  const [picSearchQuery, setPicSearchQuery] = useState<string>('');
  const picDropdownRef = useRef<HTMLDivElement>(null);

  const [isPartDropdownOpen, setIsPartDropdownOpen] = useState<boolean>(false);
  const [partSearchQuery, setPartSearchQuery] = useState<string>('');
  const partDropdownRef = useRef<HTMLDivElement>(null);

  // Validation Errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

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

  // Concurrent loading & Authoritative Hydration
  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);

    Promise.all([
      crmApi.fetchVisitById(id),
      crmApi.fetchCustomers({ page: 1, pageSize: 200 }),
      usersApi.fetchUsers(undefined, true),
      masterDataApi.fetchMasterData('visit_purposes', tenantId)
    ])
      .then(([visitData, custRes, usersRes, purposesRes]) => {
        if (!mounted) return;

        if (!visitData) {
          setErrorMessage(`Visit '${id}' not found or access denied.`);
          setLoading(false);
          return;
        }

        const custList = Array.isArray(custRes) ? custRes : (custRes?.data || []);
        const userList = Array.isArray(usersRes) ? usersRes : [];
        const purposeList = Array.isArray(purposesRes) ? purposesRes : [];

        setCustomers(custList);
        setRawUsers(userList);
        setVisitPurposes(purposeList);
        setVisit(visitData);

        // Map purposeId reliably: resolve to matching masterData ID if available
        let matchedPurposeId = visitData.purposeId || '';
        if (!matchedPurposeId && (visitData.purposeCode || visitData.purpose)) {
          const match = purposeList.find(
            (p: any) =>
              p.code === visitData.purposeCode ||
              p.name === visitData.purpose ||
              p.codeValue === visitData.purposeCode ||
              p.label === visitData.purpose
          );
          if (match) matchedPurposeId = match.id;
        }
        if (!matchedPurposeId && purposeList.length > 0) {
          matchedPurposeId = purposeList[0].id;
        }

        // Hydrate form state exactly once
        setSelectedCustomerId(visitData.customerId || '');
        setVisitDate(visitData.visitDate || '');
        setStartTime(visitData.startTime ? String(visitData.startTime).slice(0, 5) : '09:00');
        setEndTime(visitData.endTime ? String(visitData.endTime).slice(0, 5) : '10:30');
        setLocation(visitData.location || '');
        setPurposeId(matchedPurposeId);
        setTitle(visitData.title || '');
        setSelectedPicId(visitData.picId || (userList.length > 0 ? userList[0].id : ''));
        
        // Hydrate participants from visit.participants
        const partIds = Array.isArray(visitData.participants)
          ? visitData.participants.map((p: any) => p.userId).filter(Boolean)
          : [];
        setAdditionalPicIds(partIds);

        setNotes(visitData.notes || '');
        setIsHydrated(true);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[EditVisitPage init error]', err);
        if (mounted) {
          setErrorMessage(err.message || 'Failed to load visit details');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [id, tenantId]);

  // Compute workload for users
  const usersWithWorkload = useMemo<UserWorkloadInfo[]>(() => {
    return rawUsers.map((u, index) => {
      const activeTasks = u.activeTasksCount ?? (index === 0 ? 8 : (index * 5 + 3) % 15);
      const overdueTasks = index === 0 ? 2 : (index * 2) % 4;
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

  // Filtered users for PIC searchable dropdown
  const filteredUsers = useMemo(() => {
    if (!picSearchQuery.trim()) return usersWithWorkload;
    const q = picSearchQuery.toLowerCase();
    return usersWithWorkload.filter(
      (info) =>
        info.user.name?.toLowerCase().includes(q) ||
        info.user.email?.toLowerCase().includes(q) ||
        info.user.role?.toLowerCase().includes(q)
    );
  }, [usersWithWorkload, picSearchQuery]);

  // Filtered users for Additional Participants searchable dropdown
  const filteredParticipants = useMemo(() => {
    const available = usersWithWorkload.filter((info) => info.user.id !== selectedPicId);
    if (!partSearchQuery.trim()) return available;
    const q = partSearchQuery.toLowerCase();
    return available.filter(
      (info) =>
        info.user.name?.toLowerCase().includes(q) ||
        info.user.email?.toLowerCase().includes(q)
    );
  }, [usersWithWorkload, selectedPicId, partSearchQuery]);

  const selectedPicInfo = useMemo(() => {
    return usersWithWorkload.find((u) => u.user.id === selectedPicId);
  }, [usersWithWorkload, selectedPicId]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const selectedPurposeItem = useMemo(() => {
    return visitPurposes.find((p) => p.id === purposeId || (p as any).code === purposeId || p.codeValue === purposeId || (p as any).code_value === purposeId);
  }, [visitPurposes, purposeId]);

  const handleToggleParticipant = (userId: string) => {
    setAdditionalPicIds((prev) =>
      prev.includes(userId) ? prev.filter((uid) => uid !== userId) : [...prev, userId]
    );
  };

  // Validation
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!selectedCustomerId) newErrors.customerId = 'Customer is required';
    if (!purposeId) newErrors.purpose = 'Visit Purpose is required';
    if (!visitDate) newErrors.visitDate = 'Visit Date is required';
    if (!startTime) newErrors.startTime = 'Start Time is required';
    if (!endTime) newErrors.endTime = 'End Time is required';
    if (startTime && endTime && startTime >= endTime) {
      newErrors.endTime = 'End Time must be after Start Time';
    }
    if (!selectedPicId) newErrors.picId = 'PIC is required';
    if (!location.trim()) newErrors.location = 'Location / Address is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save handler
  const handleSaveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !visit) return;

    // Invariant checks
    const currentStatus = (visit.statusCode || visit.status || '').toUpperCase();
    if (currentStatus === 'COMPLETED') {
      alert('Completed visits cannot be modified.');
      return;
    }
    if (currentStatus === 'CANCELLED') {
      alert('Cancelled visits cannot be modified. Please use the Reschedule action to reactivate this visit.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        customerId: selectedCustomerId,
        title: title.trim() || (selectedCustomer ? `Client Visit - ${selectedCustomer.name}` : visit.title),
        visitDate,
        startTime,
        endTime,
        location: location.trim(),
        purposeId,
        purpose: selectedPurposeItem?.label || (selectedPurposeItem as any)?.name || undefined,
        picId: selectedPicId,
        additionalPicIds,
        notes: notes.trim(),
      };

      const res = await crmApi.updateVisit(id, payload);
      if (!res.success) {
        throw new Error(res.error || 'Failed to update visit');
      }

      setToastMessage('Visit updated successfully!');
      setTimeout(() => {
        navigate(detailUrl);
      }, 500);
    } catch (err: any) {
      console.error('[EditVisitPage save error]', err);
      alert(err.message || 'Failed to save changes');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && !isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-[#4744e5] animate-spin">
            progress_activity
          </span>
          <span className="text-xs font-bold text-[#767587]">Loading visit data...</span>
        </div>
      </div>
    );
  }

  if (errorMessage && !visit) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-rose-200 shadow-sm max-w-lg mx-auto text-center space-y-4 my-8">
        <span className="material-symbols-outlined text-4xl text-rose-500">error</span>
        <h2 className="text-lg font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Cannot Edit Visit</h2>
        <p className="text-xs text-[#767587]">{errorMessage}</p>
        <button
          onClick={() => navigate(visitsUrl)}
          className="px-4 py-2 bg-[#4744e5] text-white text-xs font-bold rounded-xl hover:bg-[#3834d0]"
        >
          Back to Visits
        </button>
      </div>
    );
  }

  const visitStatus = (visit?.statusCode || visit?.status || 'PLANNED').toUpperCase();
  const isTerminalStatus = visitStatus === 'COMPLETED' || visitStatus === 'CANCELLED';

  return (
    <div className="space-y-6 font-['Inter',sans-serif] pb-12 max-w-5xl mx-auto">
      {/* TOAST ALERT */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#1a1c1c] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-5">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] mb-1">
              <Link to={visitsUrl} className="hover:text-[#4744e5] transition-colors">
                Visits
              </Link>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <Link to={detailUrl} className="hover:text-[#4744e5] transition-colors">
                {id}
              </Link>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-[#1a1c1c]">Edit Visit</span>
            </div>

            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
                Edit Customer Visit
              </h1>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  visitStatus === 'COMPLETED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : visitStatus === 'CANCELLED'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : visitStatus === 'CONFIRMED'
                    ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}
              >
                {visit?.statusName || visitStatus}
              </span>
            </div>
            <p className="text-xs text-[#767587] mt-0.5">
              Update the scheduled visit information and ownership.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(detailUrl)}
              className="px-4 py-2 border border-[#E1E1E1] hover:bg-slate-50 text-[#1a1c1c] text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 font-['Hanken_Grotesk'] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Back to Visit</span>
            </button>
          </div>
        </div>
      </div>

      {/* LIFECYCLE WARNING BANNER */}
      {isTerminalStatus && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
          visitStatus === 'COMPLETED'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <span className="material-symbols-outlined text-[24px]">
            {visitStatus === 'COMPLETED' ? 'task_alt' : 'block'}
          </span>
          <div className="text-xs">
            <p className="font-bold">
              {visitStatus === 'COMPLETED'
                ? 'This visit is marked as Completed.'
                : 'This visit has been Cancelled.'}
            </p>
            <p className="text-[11px] opacity-90 mt-0.5">
              {visitStatus === 'COMPLETED'
                ? 'Completed visits are archived and cannot be modified.'
                : 'Cancelled visits cannot be directly edited. Use the Reschedule action on the Visit Detail page to reactivate with a new date.'}
            </p>
          </div>
        </div>
      )}

      {/* MAIN TWO-COLUMN FORM */}
      <form onSubmit={handleSaveVisit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* LEFT COLUMN: VISIT INFORMATION */}
          <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-5">
            <div className="flex items-center gap-2 border-b border-[#f0f0f4] pb-3">
              <span className="material-symbols-outlined text-[#4744e5] text-[20px]">calendar_add_on</span>
              <h2 className="text-base font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Visit Information
              </h2>
            </div>

            {/* Customer Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                Customer Account <span className="text-rose-500">*</span>
              </label>
              <select
                disabled={isTerminalStatus}
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  if (errors.customerId) setErrors({ ...errors, customerId: '' });
                }}
                className={`w-full px-3.5 py-2.5 border rounded-xl text-xs bg-white font-medium text-[#1a1c1c] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] ${
                  errors.customerId ? 'border-rose-400' : 'border-[#E1E1E1]'
                }`}
              >
                <option value="">-- Select Customer Account --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
              {errors.customerId && (
                <p className="text-[11px] text-rose-500 font-medium">{errors.customerId}</p>
              )}
            </div>

            {/* Visit Purpose */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                Visit Purpose <span className="text-rose-500">*</span>
              </label>
              <select
                disabled={isTerminalStatus}
                value={purposeId}
                onChange={(e) => {
                  setPurposeId(e.target.value);
                  if (errors.purpose) setErrors({ ...errors, purpose: '' });
                }}
                className={`w-full px-3.5 py-2.5 border rounded-xl text-xs bg-white font-medium text-[#1a1c1c] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] ${
                  errors.purpose ? 'border-rose-400' : 'border-[#E1E1E1]'
                }`}
              >
                <option value="">-- Select Purpose --</option>
                {visitPurposes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label || (p as any).name || p.codeValue}
                  </option>
                ))}
              </select>
              {errors.purpose && (
                <p className="text-[11px] text-rose-500 font-medium">{errors.purpose}</p>
              )}
            </div>

            {/* Visit Title / Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                Visit Title / Subject
              </label>
              <input
                type="text"
                disabled={isTerminalStatus}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={selectedCustomer ? `Client Visit - ${selectedCustomer.name}` : 'e.g. Q3 Commercial Discussion'}
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] placeholder:text-[#a0a0b0] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium"
              />
            </div>

            {/* Visit Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                Visit Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                disabled={isTerminalStatus}
                value={visitDate}
                onChange={(e) => {
                  setVisitDate(e.target.value);
                  if (errors.visitDate) setErrors({ ...errors, visitDate: '' });
                }}
                className={`w-full px-3.5 py-2.5 border rounded-xl text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium ${
                  errors.visitDate ? 'border-rose-400' : 'border-[#E1E1E1]'
                }`}
              />
              {errors.visitDate && (
                <p className="text-[11px] text-rose-500 font-medium">{errors.visitDate}</p>
              )}
            </div>

            {/* Visit Time Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                  Start Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  disabled={isTerminalStatus}
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    if (errors.startTime) setErrors({ ...errors, startTime: '' });
                  }}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium ${
                    errors.startTime ? 'border-rose-400' : 'border-[#E1E1E1]'
                  }`}
                />
                {errors.startTime && (
                  <p className="text-[11px] text-rose-500 font-medium">{errors.startTime}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                  End Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  disabled={isTerminalStatus}
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    if (errors.endTime) setErrors({ ...errors, endTime: '' });
                  }}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium ${
                    errors.endTime ? 'border-rose-400' : 'border-[#E1E1E1]'
                  }`}
                />
                {errors.endTime && (
                  <p className="text-[11px] text-rose-500 font-medium">{errors.endTime}</p>
                )}
              </div>
            </div>

            {/* Location / Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                Location / Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#767587]">
                  location_on
                </span>
                <input
                  type="text"
                  disabled={isTerminalStatus}
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    if (errors.location) setErrors({ ...errors, location: '' });
                  }}
                  placeholder="e.g. Cyber 2 Tower Lt. 15, Jakarta"
                  className={`w-full pl-9 pr-3.5 py-2.5 border rounded-xl text-xs bg-white text-[#1a1c1c] placeholder:text-[#a0a0b0] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium ${
                    errors.location ? 'border-rose-400' : 'border-[#E1E1E1]'
                  }`}
                />
              </div>
              {errors.location && (
                <p className="text-[11px] text-rose-500 font-medium">{errors.location}</p>
              )}
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

            {/* PIC Selector */}
            <div className="space-y-1.5 relative" ref={picDropdownRef}>
              <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                PIC (Person in Charge) <span className="text-rose-500">*</span>
              </label>

              <div
                onClick={() => !isTerminalStatus && usersWithWorkload.length > 0 && setIsPicDropdownOpen(!isPicDropdownOpen)}
                className={`w-full p-3 border rounded-xl bg-white flex items-center justify-between cursor-pointer transition-all shadow-2xs ${
                  isTerminalStatus ? 'opacity-60 cursor-not-allowed' : 'hover:border-[#4744e5]'
                } ${errors.picId ? 'border-rose-400' : 'border-[#E1E1E1]'}`}
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
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                            selectedPicInfo.workloadLevel === 'High'
                              ? 'bg-rose-50 text-rose-600 border border-rose-200'
                              : selectedPicInfo.workloadLevel === 'Medium'
                              ? 'bg-amber-50 text-amber-600 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          }`}
                        >
                          {selectedPicInfo.workloadLevel} Load
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[#767587] font-medium mt-0.5">
                        <span>{selectedPicInfo.user?.email}</span>
                        <span>•</span>
                        <span>{selectedPicInfo.activeTasks} Active Tasks</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-[#767587]">— Select PIC —</span>
                )}
                <span className="material-symbols-outlined text-[#767587] text-[18px]">
                  {isPicDropdownOpen ? 'expand_less' : 'expand_more'}
                </span>
              </div>

              {/* Searchable PIC Dropdown Popup */}
              {isPicDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E1E1E1] rounded-xl shadow-xl z-50 p-2 space-y-2 max-h-64 overflow-y-auto">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-[#767587]">
                      search
                    </span>
                    <input
                      type="text"
                      value={picSearchQuery}
                      onChange={(e) => setPicSearchQuery(e.target.value)}
                      placeholder="Search PIC by name or role..."
                      className="w-full pl-8 pr-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
                    />
                  </div>

                  <div className="space-y-1">
                    {filteredUsers.map((info) => (
                      <div
                        key={info.user.id}
                        onClick={() => {
                          setSelectedPicId(info.user.id);
                          setIsPicDropdownOpen(false);
                          if (errors.picId) setErrors({ ...errors, picId: '' });
                        }}
                        className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                          selectedPicId === info.user.id
                            ? 'bg-[#4744e5]/10 border border-[#4744e5]/30'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={
                              info.user.avatarUrl ||
                              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                            }
                            alt={info.user.name}
                            className="w-7 h-7 rounded-full object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-[#1a1c1c] block truncate">
                              {info.user.name}
                            </span>
                            <span className="text-[10px] text-[#767587] block truncate">
                              {info.user.role || 'Sales Rep'} • {info.user.email}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            info.workloadLevel === 'High'
                              ? 'bg-rose-50 text-rose-600'
                              : info.workloadLevel === 'Medium'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          {info.workloadLevel} ({info.activeTasks})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Additional Participants */}
            <div className="space-y-1.5 relative" ref={partDropdownRef}>
              <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                Additional Participants
              </label>

              <div
                onClick={() => !isTerminalStatus && setIsPartDropdownOpen(!isPartDropdownOpen)}
                className={`w-full p-2.5 border border-[#E1E1E1] rounded-xl bg-white flex items-center justify-between cursor-pointer transition-all ${
                  isTerminalStatus ? 'opacity-60 cursor-not-allowed' : 'hover:border-[#4744e5]'
                }`}
              >
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  {additionalPicIds.length === 0 ? (
                    <span className="text-xs text-[#767587]">No additional participants selected</span>
                  ) : (
                    additionalPicIds.map((uid) => {
                      const u = rawUsers.find((user) => user.id === uid);
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#4744e5]/10 text-[#4744e5] text-[11px] font-bold rounded-md"
                        >
                          <span>{u?.name || uid}</span>
                          {!isTerminalStatus && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleParticipant(uid);
                              }}
                              className="material-symbols-outlined text-[12px] hover:text-rose-500 cursor-pointer"
                            >
                              close
                            </span>
                          )}
                        </span>
                      );
                    })
                  )}
                </div>
                <span className="material-symbols-outlined text-[#767587] text-[18px]">
                  {isPartDropdownOpen ? 'expand_less' : 'expand_more'}
                </span>
              </div>

              {/* Searchable Participants Dropdown Popup */}
              {isPartDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E1E1E1] rounded-xl shadow-xl z-50 p-2 space-y-2 max-h-56 overflow-y-auto">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-[#767587]">
                      search
                    </span>
                    <input
                      type="text"
                      value={partSearchQuery}
                      onChange={(e) => setPartSearchQuery(e.target.value)}
                      placeholder="Search users..."
                      className="w-full pl-8 pr-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
                    />
                  </div>

                  <div className="space-y-1">
                    {filteredParticipants.map((info) => {
                      const isChecked = additionalPicIds.includes(info.user.id);
                      return (
                        <div
                          key={info.user.id}
                          onClick={() => handleToggleParticipant(info.user.id)}
                          className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                            isChecked ? 'bg-[#4744e5]/10' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded text-[#4744e5] focus:ring-[#4744e5]"
                            />
                            <span className="text-xs font-semibold text-[#1a1c1c]">
                              {info.user.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#767587]">{info.user.role || 'Member'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Notes / Agenda Preparation */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                Notes / Agenda Preparation
              </label>
              <textarea
                disabled={isTerminalStatus}
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Key talking points, client concerns, product deck to prepare..."
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] placeholder:text-[#a0a0b0] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium"
              />
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: VISIT SUMMARY */}
        <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4744e5] text-[18px]">summarize</span>
            <h3 className="text-xs font-extrabold text-[#1a1c1c] uppercase tracking-wider font-['Hanken_Grotesk']">
              Visit Summary
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 bg-[#f8f8fb] p-4 rounded-xl border border-[#E1E1E1]">
            {/* Customer */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block">
                Customer
              </span>
              <p className="text-xs font-extrabold text-[#1a1c1c] truncate font-['Hanken_Grotesk']">
                {selectedCustomer ? selectedCustomer.name : '— Not selected —'}
              </p>
              {selectedCustomer?.code && (
                <p className="text-[10px] text-[#767587] font-medium">{selectedCustomer.code}</p>
              )}
            </div>

            {/* Purpose */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block">
                Purpose
              </span>
              <p className="text-xs font-extrabold text-[#1a1c1c] truncate font-['Hanken_Grotesk']">
                {selectedPurposeItem?.label || (selectedPurposeItem as any)?.name || '— Not selected —'}
              </p>
            </div>

            {/* Date */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block">
                Date
              </span>
              <p className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
                {visitDate ? formatDate(visitDate) : '— Not specified —'}
              </p>
            </div>

            {/* Time */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block">
                Time
              </span>
              <p className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
                {startTime && endTime ? `${startTime} - ${endTime}` : '— Not specified —'}
              </p>
            </div>

            {/* Location */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block">
                Location
              </span>
              <p className="text-xs font-extrabold text-[#1a1c1c] truncate font-['Hanken_Grotesk']">
                {location || '— Not specified —'}
              </p>
            </div>

            {/* PIC */}
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

        {/* FOOTER ACTIONS */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(detailUrl)}
            className="w-full sm:w-auto px-5 py-2.5 border border-[#E1E1E1] hover:bg-slate-100 text-[#555468] text-xs font-bold rounded-xl transition-all cursor-pointer font-['Hanken_Grotesk'] text-center"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting || isTerminalStatus}
            className="w-full sm:w-auto px-6 py-2.5 bg-[#4744e5] hover:bg-[#322fce] disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer font-['Hanken_Grotesk'] flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            <span>{isSubmitting ? 'Saving Changes...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditVisitPage;

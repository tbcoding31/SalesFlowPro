  const [searchQuery, setSearchQuery] = useState('');
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Visit, Customer, User, VisitStatus } from '../../types';
import { crmApi } from '../../services/crmApi';
import { usersApi } from '../../services/usersApi';

export const VisitsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentTenant, currentUser } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';

  // Data state
  const [visits, setVisits] = useState<Visit[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  
  const loadData = async (page = currentPage) => {
    setIsLoading(true);
    try {
      const [vRes, cList, pList] = await Promise.all([
        crmApi.fetchVisits({ page, pageSize, search: searchQuery || undefined, tenantId }),
        crmApi.fetchCollection('customers', tenantId),
        crmApi.fetchCollection('projects', tenantId)
      ]);
      if ((vRes as any).data) {
        setVisits((vRes as any).data);
        setTotalItems((vRes as any).pagination.totalItems);
        setTotalPages((vRes as any).pagination.totalPages);
        setCurrentPage((vRes as any).pagination.page);
      }
      setCustomers(cList as any);
      setVisits(pList as any);
    } catch (err) {
      console.error('Failed to load visits', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData(1);
  }, [tenantId, pageSize, searchQuery]);


  React.useEffect(() => {
    loadData();
  }, [tenantId]);

  // View state
  const [activeView, setActiveView] = useState<'list' | 'calendar'>('list');

  // Filter toolbar states
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [picFilter, setPicFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [purposeFilter, setPurposeFilter] = useState('ALL');

  // Modal / Drawer states
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [viewingVisit, setViewingVisit] = useState<Visit | null>(null);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [reschedulingVisit, setReschedulingVisit] = useState<Visit | null>(null);
  const [cancellingVisit, setCancellingVisit] = useState<Visit | null>(null);

  // Form states for New / Edit Visit
  const [formCustomerId, setFormCustomerId] = useState(customers[0]?.id || 'CUS-001');
  const [formTitle, setFormTitle] = useState('');
  const [formPurpose, setFormPurpose] = useState('Executive Product Briefing');
  const [formVisitDate, setFormVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStartTime, setFormStartTime] = useState('09:30');
  const [formEndTime, setFormEndTime] = useState('11:00');
  const [formLocation, setFormLocation] = useState('');
  const [formPicId, setFormPicId] = useState(currentUser?.id || 'USR-005');
  const [formStatus, setFormStatus] = useState<VisitStatus>('PLANNED');
  const [formNotes, setFormNotes] = useState('');

  // Reschedule Form state
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStartTime, setRescheduleStartTime] = useState('');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  // Cancel Form state
  const [cancelReason, setCancelReason] = useState('');

  // Calendar Month Navigation & Selected Date
  const [calendarCurrentDate, setCalendarCurrentDate] = useState(new Date(2026, 7, 1)); // August 2026
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>('2026-08-11');

  // Calendar specific sidebar filters
  const [calStatusFilter, setCalStatusFilter] = useState<{ [key: string]: boolean }>({
    COMPLETED: true,
    CONFIRMED: true,
    PLANNED: true,
    IN_PROGRESS: true,
    RESCHEDULED: true,
    CANCELLED: false,
  });

  const [calPicFilter, setCalPicFilter] = useState<{ [key: string]: boolean }>({});
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');

  // List of unique purposes for filter dropdown
  const uniquePurposes = useMemo(() => {
    const set = new Set<string>();
    visits.forEach((v) => {
      if (v.purpose) set.add(v.purpose);
    });
    return Array.from(set);
  }, [visits]);

  // Refresh helper
  const reloadVisits = () => {
    loadData();
  };

  // Mini calendar days calculation
  const miniCalendarDays = useMemo(() => {
    const year = calendarCurrentDate.getFullYear();
    const month = calendarCurrentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();

    const days: { dayNumber: number; dateStr: string; isCurrentMonth: boolean }[] = [];

    // Padding prev month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const monthStr = String(prevMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      days.push({ dayNumber: d, dateStr: `${prevYear}-${monthStr}-${dayStr}`, isCurrentMonth: false });
    }

    // Days of current month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      days.push({ dayNumber: d, dateStr: `${year}-${monthStr}-${dayStr}`, isCurrentMonth: true });
    }

    // Padding next month days
    const totalCells = days.length > 35 ? 42 : 35;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const monthStr = String(nextMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      days.push({ dayNumber: d, dateStr: `${nextYear}-${monthStr}-${dayStr}`, isCurrentMonth: false });
    }

    return days;
  }, [calendarCurrentDate]);

  // Calendar board filtered visits
  const calendarBoardVisits = useMemo(() => {
    return visits.filter((v) => {
      // Status filter
      if (calStatusFilter[v.status] === false) return false;

      // PIC filter
      const activePicKeys = Object.keys(calPicFilter).filter((k) => calPicFilter[k]);
      if (activePicKeys.length > 0 && !calPicFilter[v.picId]) return false;

      return true;
    });
  }, [visits, calStatusFilter, calPicFilter]);

  // Main board week rows (Monday to Friday)
  const calendarBoardWeeks = useMemo(() => {
    const year = calendarCurrentDate.getFullYear();
    const month = calendarCurrentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const dayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon ...
    const diffToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
    const startDate = new Date(year, month, 1 + diffToMonday);

    const weeks = [];
    let currMonday = new Date(startDate);

    for (let w = 0; w < 5; w++) {
      const weekDays = [];
      for (let d = 0; d < 5; d++) {
        const dayDate = new Date(currMonday);
        dayDate.setDate(currMonday.getDate() + d);

        const mStr = String(dayDate.getMonth() + 1).padStart(2, '0');
        const dStr = String(dayDate.getDate()).padStart(2, '0');
        const dateStr = `${dayDate.getFullYear()}-${mStr}-${dStr}`;

        const dayVisits = calendarBoardVisits.filter((v) => v.visitDate === dateStr);

        weekDays.push({
          dayNumber: dayDate.getDate(),
          dateStr,
          isCurrentMonth: dayDate.getMonth() === month,
          visits: dayVisits,
        });
      }

      if (weekDays.some((d) => d.isCurrentMonth)) {
        weeks.push(weekDays);
      }

      currMonday.setDate(currMonday.getDate() + 7);
    }

    return weeks;
  }, [calendarCurrentDate, calendarBoardVisits]);

  // Filtered visits calculation
  const filteredVisits = useMemo(() => {
    return visits.filter((v) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = v.title?.toLowerCase().includes(q);
        const matchesCustomer = v.customerName?.toLowerCase().includes(q) || v.customerCode?.toLowerCase().includes(q);
        const matchesLocation = v.location?.toLowerCase().includes(q);
        const matchesPurpose = v.purpose?.toLowerCase().includes(q);
        const matchesPic = v.picName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCustomer && !matchesLocation && !matchesPurpose && !matchesPic) {
          return false;
        }
      }

      // Customer filter
      if (customerFilter !== 'ALL' && v.customerId !== customerFilter) {
        return false;
      }

      // PIC filter
      if (picFilter !== 'ALL' && v.picId !== picFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && v.status !== statusFilter) {
        return false;
      }

      // Purpose filter
      if (purposeFilter !== 'ALL' && v.purpose !== purposeFilter) {
        return false;
      }

      // Date Range filter
      if (dateRangeFilter === 'TODAY') {
        const todayStr = new Date().toISOString().split('T')[0];
        if (v.visitDate !== todayStr) return false;
      } else if (dateRangeFilter === 'WEEK') {
        // Simple 7-day range check
        const today = new Date();
        const vDate = new Date(v.visitDate);
        const diffDays = (vDate.getTime() - today.getTime()) / (1000 * 3600 * 24);
        if (diffDays < -1 || diffDays > 7) return false;
      } else if (dateRangeFilter === 'MONTH') {
        if (!v.visitDate.startsWith('2026-08')) return false;
      } else if (dateRangeFilter === 'CUSTOM' && customStartDate && customEndDate) {
        if (v.visitDate < customStartDate || v.visitDate > customEndDate) return false;
      }

      return true;
    });
  }, [
    visits,
    searchQuery,
    customerFilter,
    picFilter,
    statusFilter,
    purposeFilter,
    dateRangeFilter,
    customStartDate,
    customEndDate,
  ]);

  // Handler: Open Schedule Visit Modal
  const handleOpenScheduleModal = (defaultDate?: string) => {
    setFormCustomerId(customers[0]?.id || 'CUS-001');
    setFormTitle('');
    setFormPurpose('Executive Product Briefing');
    setFormVisitDate(defaultDate || new Date().toISOString().split('T')[0]);
    setFormStartTime('09:30');
    setFormEndTime('11:00');
    setFormLocation('HQ Client Office');
    setFormPicId(currentUser?.id || 'USR-005');
    setFormStatus('PLANNED');
    setFormNotes('');
    setShowScheduleModal(true);
  };

  // Handler: Save New Visit
  const handleCreateVisit = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === formCustomerId);
    const assignedUser = users.find((u) => u.id === formPicId);

    const newVisit: Partial<Visit> = {
      id: `VIS-${Date.now().toString().slice(-4)}`,
      tenantId,
      customerId: formCustomerId,
      customerName: cust?.name || 'Unknown Client',
      customerCode: cust?.code || 'CUS-000',
      picId: formPicId,
      picName: assignedUser?.name || 'Ahmad Ricky',
      picAvatar: assignedUser?.avatarUrl,
      title: formTitle,
      purpose: formPurpose,
      visitDate: formVisitDate,
      startTime: formStartTime,
      endTime: formEndTime,
      location: formLocation || cust?.address || 'Client Office',
      status: formStatus,
      notes: formNotes,
      createdAt: new Date().toISOString().split('T')[0],
    };

    crmApi.createRecord('visits', newVisit).then(() => {
      reloadVisits();
      setShowScheduleModal(false);
    });
  };

  // Handler: Open Edit Visit Modal
  const handleOpenEditModal = (visit: Visit) => {
    setEditingVisit(visit);
    setFormCustomerId(visit.customerId);
    setFormTitle(visit.title);
    setFormPurpose(visit.purpose);
    setFormVisitDate(visit.visitDate);
    setFormStartTime(visit.startTime);
    setFormEndTime(visit.endTime);
    setFormLocation(visit.location);
    setFormPicId(visit.picId);
    setFormStatus(visit.status);
    setFormNotes(visit.notes || '');
  };

  // Handler: Save Edit Visit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVisit) return;

    const cust = customers.find((c) => c.id === formCustomerId);
    const assignedUser = users.find((u) => u.id === formPicId);

    const updatedVisit: Partial<Visit> = {
      ...editingVisit,
      customerId: formCustomerId,
      customerName: cust?.name || editingVisit.customerName,
      customerCode: cust?.code || editingVisit.customerCode,
      picId: formPicId,
      picName: assignedUser?.name || editingVisit.picName,
      picAvatar: assignedUser?.avatarUrl || editingVisit.picAvatar,
      title: formTitle,
      purpose: formPurpose,
      visitDate: formVisitDate,
      startTime: formStartTime,
      endTime: formEndTime,
      location: formLocation,
      status: formStatus,
      notes: formNotes,
    };

    crmApi.updateRecord('visits', editingVisit.id, updatedVisit).then(() => {
      reloadVisits();
      setEditingVisit(null);
    });
  };

  // Handler: Open Reschedule Modal
  const handleOpenRescheduleModal = (visit: Visit) => {
    setReschedulingVisit(visit);
    setRescheduleDate(visit.visitDate);
    setRescheduleStartTime(visit.startTime);
    setRescheduleEndTime(visit.endTime);
    setRescheduleReason('');
  };

  // Handler: Submit Reschedule
  const handleConfirmReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingVisit) return;

    const updatedVisit: Partial<Visit> = {
      ...reschedulingVisit,
      visitDate: rescheduleDate,
      startTime: rescheduleStartTime,
      endTime: rescheduleEndTime,
      status: 'RESCHEDULED',
      notes: reschedulingVisit.notes
        ? `${reschedulingVisit.notes}\n[Rescheduled to ${rescheduleDate}]: ${rescheduleReason}`
        : `[Rescheduled to ${rescheduleDate}]: ${rescheduleReason}`,
    };

    crmApi.updateRecord('visits', reschedulingVisit.id, updatedVisit).then(() => {
      reloadVisits();
      setReschedulingVisit(null);
    });
  };

  // Handler: Open Cancel Modal
  const handleOpenCancelModal = (visit: Visit) => {
    setCancellingVisit(visit);
    setCancelReason('');
  };

  // Handler: Submit Cancel
  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingVisit) return;

    const updatedVisit: Partial<Visit> = {
      ...cancellingVisit,
      status: 'CANCELLED',
      notes: cancellingVisit.notes
        ? `${cancellingVisit.notes}\n[Cancelled]: ${cancelReason}`
        : `[Cancelled]: ${cancelReason}`,
    };

    crmApi.updateRecord('visits', cancellingVisit.id, updatedVisit).then(() => {
      reloadVisits();
      setCancellingVisit(null);
    });
  };

  // Helper: Status Badge Styling
  const renderStatusBadge = (status: VisitStatus) => {
    switch (status) {
      case 'PLANNED':
        return (
          <span className="inline-flex items-center gap-1.2 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            Planned
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.2 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Confirmed
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.2 px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            In Progress
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.2 px-2.5 py-1 rounded-md text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">
            <span className="material-symbols-outlined text-[13px] text-green-600">check_circle</span>
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.2 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Cancelled
          </span>
        );
      case 'RESCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.2 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="material-symbols-outlined text-[13px] text-amber-600">update</span>
            Rescheduled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  // Reset filter toolbar
  const isFilterActive =
    searchQuery !== '' ||
    dateRangeFilter !== 'ALL' ||
    customerFilter !== 'ALL' ||
    picFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    purposeFilter !== 'ALL';

  const resetFilters = () => {
    setSearchQuery('');
    setDateRangeFilter('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setCustomerFilter('ALL');
    setPicFilter('ALL');
    setStatusFilter('ALL');
    setPurposeFilter('ALL');
  };

  // Calendar calculation
  const calendarDays = useMemo(() => {
    const year = calendarCurrentDate.getFullYear();
    const month = calendarCurrentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const days: { dayNumber: number | null; dateStr: string | null; visits: Visit[] }[] = [];

    // Empty padding cells
    for (let i = 0; i < firstDay; i++) {
      days.push({ dayNumber: null, dateStr: null, visits: [] });
    }

    // Days of the month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;

      const dayVisits = filteredVisits.filter((v) => v.visitDate === dateStr);
      days.push({ dayNumber: d, dateStr, visits: dayVisits });
    }

    return days;
  }, [calendarCurrentDate, filteredVisits]);

  return (
    <div className="space-y-6 font-['Inter',sans-serif] pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[11px] font-bold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] mb-1">
            <Link to="/" className="hover:text-[#4744e5] transition-colors">
              Home
            </Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-[#1a1c1c]">Visits</span>
          </div>

          <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
            Visit Schedule
          </h1>
          <p className="text-xs text-[#767587] mt-0.5">
            Manage and track customer on-site visits across regions.
          </p>
        </div>

        {/* Primary Action & View Switcher Container */}
        <div className="flex items-center gap-3">
          {/* View Switcher */}
          <div className="flex items-center p-1 bg-[#f4f4f6] rounded-xl border border-[#E1E1E1]">
            <button
              onClick={() => setActiveView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'list'
                  ? 'bg-white text-[#1a1c1c] shadow-2xs'
                  : 'text-[#767587] hover:text-[#1a1c1c]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
              <span>List</span>
            </button>
            <button
              onClick={() => setActiveView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'calendar'
                  ? 'bg-white text-[#1a1c1c] shadow-2xs'
                  : 'text-[#767587] hover:text-[#1a1c1c]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">calendar_month</span>
              <span>Calendar</span>
            </button>
          </div>

          {/* Primary Schedule Visit Button */}
          <button
            onClick={() => navigate('/visits/schedule')}
            className="px-4 py-2 bg-[#4744e5] hover:bg-[#322fce] text-white text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer font-['Hanken_Grotesk']"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>+ Schedule Visit</span>
          </button>
        </div>
      </div>

      {/* FILTER TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* 1. Search */}
          <div className="relative col-span-1 sm:col-span-2 lg:col-span-2">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#767587]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, customer, location, PIC..."
              className="w-full pl-9 pr-3 py-2 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] placeholder:text-[#a0a0b0] focus:outline-none focus:border-[#4744e5]"
            />
          </div>

          {/* 2. Date Range */}
          <div>
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs bg-white font-semibold text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All Dates</option>
              <option value="TODAY">Today</option>
              <option value="WEEK">This Week</option>
              <option value="MONTH">This Month (Aug 2026)</option>
              <option value="CUSTOM">Custom Date Range</option>
            </select>
          </div>

          {/* 3. Customer */}
          <div>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs bg-white font-semibold text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. PIC */}
          <div>
            <select
              value={picFilter}
              onChange={(e) => setPicFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs bg-white font-semibold text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All PICs</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Status */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs bg-white font-semibold text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All Statuses</option>
              <option value="PLANNED">Planned</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="RESCHEDULED">Rescheduled</option>
            </select>
          </div>
        </div>

        {/* Second Row: Purpose & Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#f0f0f4]">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-[#767587] uppercase font-['Hanken_Grotesk']">
              Purpose:
            </span>
            <select
              value={purposeFilter}
              onChange={(e) => setPurposeFilter(e.target.value)}
              className="px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs bg-white font-medium text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All Purposes</option>
              {uniquePurposes.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {dateRangeFilter === 'CUSTOM' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2 py-1 border border-[#E1E1E1] rounded-lg text-xs"
                />
                <span className="text-xs text-[#767587]">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2 py-1 border border-[#E1E1E1] rounded-lg text-xs"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-[#767587]">
            <span>
              Showing <strong className="text-[#1a1c1c]">{filteredVisits.length}</strong> of{' '}
              {visits.length} visits
            </span>
            {isFilterActive && (
              <button
                onClick={resetFilters}
                className="text-[#4744e5] hover:underline font-semibold cursor-pointer text-xs"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* VIEW CONTENT AREA */}
      {activeView === 'list' ? (
        /* DESKTOP DATA TABLE (PRIMARY EXPERIENCE) */
        <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1a1c1c] border-collapse">
              <thead className="bg-[#f8f8fb] text-[#555468] font-bold uppercase tracking-wider text-[10px] border-b border-[#E1E1E1] font-['Hanken_Grotesk']">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Time</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Purpose</th>
                  <th className="px-5 py-3.5">PIC</th>
                  <th className="px-5 py-3.5">Location</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E1E1]">
                {filteredVisits.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-[#767587]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[36px] text-[#c0c0d0]">
                          event_busy
                        </span>
                        <p className="font-semibold text-sm text-[#1a1c1c]">No customer visits found</p>
                        <p className="text-xs text-[#767587]">
                          Try adjusting your search query or filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredVisits.map((v) => (
                    <tr key={v.id} className="hover:bg-[#fcfcfd] transition-colors group">
                      {/* 1. Date */}
                      <td className="px-5 py-4 whitespace-nowrap font-medium text-[#1a1c1c]">
                        <Link to={`/visits/${v.id}`} className="block hover:opacity-80 transition-opacity group/link">
                          <div className="font-semibold group-hover/link:text-[#4744e5] transition-colors">{v.visitDate}</div>
                          <div className="text-[10px] text-[#767587] font-mono group-hover/link:text-[#4744e5] transition-colors">{v.id}</div>
                        </Link>
                      </td>

                      {/* 2. Time */}
                      <td className="px-5 py-4 whitespace-nowrap text-[#1a1c1c] font-medium">
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-[#767587]">
                            schedule
                          </span>
                          <span>
                            {v.startTime} - {v.endTime}
                          </span>
                        </div>
                      </td>

                      {/* 3. Customer */}
                      <td className="px-5 py-4">
                        <Link
                          to={`/customers/${v.customerId}`}
                          className="font-bold text-[#4744e5] hover:underline block font-['Hanken_Grotesk'] text-sm"
                        >
                          {v.customerName}
                        </Link>
                        <span className="text-[10px] text-[#767587] font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                          {v.customerCode}
                        </span>
                      </td>

                      {/* 4. Purpose */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[#1a1c1c]">{v.title}</div>
                        <div className="text-[11px] text-[#767587] mt-0.5">{v.purpose}</div>
                      </td>

                      {/* 5. PIC */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <img
                            src={
                              v.picAvatar ||
                              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                            }
                            alt={v.picName}
                            className="w-6 h-6 rounded-full object-cover border border-[#E1E1E1]"
                          />
                          <span className="font-semibold text-xs text-[#1a1c1c]">{v.picName}</span>
                        </div>
                      </td>

                      {/* 6. Location */}
                      <td className="px-5 py-4 max-w-xs">
                        <div className="flex items-start gap-1 text-[#464555] text-xs">
                          <span className="material-symbols-outlined text-[15px] text-[#767587] shrink-0 mt-0.5">
                            location_on
                          </span>
                          <span className="truncate" title={v.location}>
                            {v.location}
                          </span>
                        </div>
                      </td>

                      {/* 7. Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {renderStatusBadge(v.status)}
                      </td>

                      {/* 8. Actions */}
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View */}
                          <button
                            onClick={() => navigate(`/visits/${v.id}`)}
                            title="View Details"
                            className="p-1.5 text-[#767587] hover:text-[#4744e5] hover:bg-[#f4f4ff] rounded-lg transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEditModal(v)}
                            title="Edit Visit"
                            className="p-1.5 text-[#767587] hover:text-[#4744e5] hover:bg-[#f4f4ff] rounded-lg transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>

                          {/* Reschedule */}
                          <button
                            onClick={() => handleOpenRescheduleModal(v)}
                            title="Reschedule Visit"
                            className="p-1.5 text-[#767587] hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">calendar_clock</span>
                          </button>

                          {/* Cancel */}
                          {v.status !== 'CANCELLED' && v.status !== 'COMPLETED' && (
                            <button
                              onClick={() => handleOpenCancelModal(v)}
                              title="Cancel Visit"
                              className="p-1.5 text-[#767587] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">cancel</span>
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
      ) : (
        /* CALENDAR VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start font-['Inter',sans-serif]">
          {/* LEFT SIDEBAR (Col 1) */}
          <div className="lg:col-span-1 space-y-5">
            {/* CARD 1: MINI CALENDAR PICKER WIDGET */}
            <div className="bg-white border border-[#E1E1E1] rounded-2xl p-5 shadow-2xs space-y-4">
              {/* Month Navigation Header */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() =>
                    setCalendarCurrentDate(
                      new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth() - 1, 1)
                    )
                  }
                  className="p-1 hover:bg-slate-100 rounded-lg text-[#767587] hover:text-[#1a1c1c] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <h3 className="font-extrabold text-sm text-[#1a1c1c] font-['Hanken_Grotesk']">
                  {calendarCurrentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                  onClick={() =>
                    setCalendarCurrentDate(
                      new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth() + 1, 1)
                    )
                  }
                  className="p-1 hover:bg-slate-100 rounded-lg text-[#767587] hover:text-[#1a1c1c] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>

              {/* Weekday Labels */}
              <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[#767587] font-['Hanken_Grotesk']">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Mini Calendar Grid */}
              <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
                {miniCalendarDays.map((item, idx) => {
                  const isSelected = item.dateStr === selectedCalendarDate;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedCalendarDate(item.dateStr)}
                      className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#4744e5] text-white shadow-xs font-bold'
                          : item.isCurrentMonth
                          ? 'text-[#1a1c1c] hover:bg-slate-100'
                          : 'text-[#c0c0d0]'
                      }`}
                    >
                      {item.dayNumber}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CARD 2: FILTER CARD */}
            <div className="bg-white border border-[#E1E1E1] rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#f0f0f4] pb-3">
                <h3 className="font-extrabold text-sm text-[#1a1c1c] font-['Hanken_Grotesk']">Filter</h3>
                <button
                  onClick={() => {
                    setCalStatusFilter({
                      COMPLETED: true,
                      CONFIRMED: true,
                      PLANNED: true,
                      IN_PROGRESS: true,
                      RESCHEDULED: true,
                      CANCELLED: true,
                    });
                    setCalPicFilter({});
                    setTeamSearchQuery('');
                  }}
                  className="text-xs font-bold text-[#4744e5] hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>

              {/* STATUS SECTION */}
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block">
                  Status
                </span>
                <div className="space-y-2 text-xs text-[#1a1c1c]">
                  <label className="flex items-center gap-2.5 cursor-pointer font-medium hover:text-[#4744e5] transition-colors">
                    <input
                      type="checkbox"
                      checked={calStatusFilter['COMPLETED'] ?? true}
                      onChange={(e) => setCalStatusFilter({ ...calStatusFilter, COMPLETED: e.target.checked })}
                      className="rounded text-[#4744e5] focus:ring-[#4744e5] w-3.5 h-3.5 border-[#E1E1E1]"
                    />
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>Completed</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer font-medium hover:text-[#4744e5] transition-colors">
                    <input
                      type="checkbox"
                      checked={calStatusFilter['CONFIRMED'] ?? true}
                      onChange={(e) => setCalStatusFilter({ ...calStatusFilter, CONFIRMED: e.target.checked })}
                      className="rounded text-[#4744e5] focus:ring-[#4744e5] w-3.5 h-3.5 border-[#E1E1E1]"
                    />
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
                    <span>Confirmed</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer font-medium hover:text-[#4744e5] transition-colors">
                    <input
                      type="checkbox"
                      checked={calStatusFilter['PLANNED'] ?? true}
                      onChange={(e) => setCalStatusFilter({ ...calStatusFilter, PLANNED: e.target.checked })}
                      className="rounded text-[#4744e5] focus:ring-[#4744e5] w-3.5 h-3.5 border-[#E1E1E1]"
                    />
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                    <span>Pending / Planned</span>
                  </label>
                </div>
              </div>

              {/* PIC SECTION */}
              <div className="border-t border-[#f0f0f4] pt-3 space-y-3">
                <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block">
                  PIC
                </span>

                {/* Search Team Box */}
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#767587]">
                    search
                  </span>
                  <input
                    type="text"
                    value={teamSearchQuery}
                    onChange={(e) => setTeamSearchQuery(e.target.value)}
                    placeholder="Search team..."
                    className="w-full pl-8 pr-2.5 py-1.5 border border-[#E1E1E1] rounded-xl text-xs bg-slate-50/70 focus:bg-white text-[#1a1c1c] placeholder:text-[#a0a0b0] focus:outline-none focus:border-[#4744e5]"
                  />
                </div>

                {/* PIC List */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {users
                    .filter(
                      (u) => !teamSearchQuery || u.name.toLowerCase().includes(teamSearchQuery.toLowerCase())
                    )
                    .map((u) => {
                      const isChecked = calPicFilter[u.id] ?? true;
                      return (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#1a1c1c] hover:text-[#4744e5] transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => setCalPicFilter({ ...calPicFilter, [u.id]: e.target.checked })}
                            className="rounded text-[#4744e5] focus:ring-[#4744e5] w-3.5 h-3.5 border-[#E1E1E1]"
                          />
                          <img
                            src={
                              u.avatarUrl ||
                              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                            }
                            alt={u.name}
                            className="w-5 h-5 rounded-full object-cover border border-[#E1E1E1]"
                          />
                          <span className="truncate">{u.name}</span>
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT MAIN CALENDAR BOARD (Col 2-4) */}
          <div className="lg:col-span-3 bg-white border border-[#E1E1E1] rounded-2xl p-5 shadow-2xs space-y-4">
            {/* Weekday Header Columns */}
            <div className="grid grid-cols-5 gap-px bg-[#E1E1E1] rounded-xl overflow-hidden border border-[#E1E1E1]">
              {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].map((day) => (
                <div
                  key={day}
                  className="bg-[#f8f8fb] text-center font-extrabold py-3 text-[#555468] text-[11px] tracking-wider font-['Hanken_Grotesk'] uppercase"
                >
                  {day}
                </div>
              ))}

              {/* Week Rows */}
              {calendarBoardWeeks.map((week, wIdx) => (
                <React.Fragment key={wIdx}>
                  {week.map((cell) => {
                    const isSelected = cell.dateStr === selectedCalendarDate;
                    return (
                      <div
                        key={cell.dateStr}
                        onClick={() => setSelectedCalendarDate(cell.dateStr)}
                        className={`bg-white min-h-[160px] p-2.5 flex flex-col justify-start border-b border-r border-[#E1E1E1] transition-colors relative ${
                          isSelected ? 'bg-indigo-50/20' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        {/* Date Number Badge */}
                        <div className="flex items-center justify-between mb-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenScheduleModal(cell.dateStr);
                            }}
                            className="text-[#a0a0b0] hover:text-[#4744e5] p-0.5 rounded cursor-pointer"
                            title="Schedule visit on this date"
                          >
                            <span className="material-symbols-outlined text-[14px]">add</span>
                          </button>
                          <span
                            className={`text-xs font-bold font-['Hanken_Grotesk'] ${
                              isSelected
                                ? 'w-6 h-6 rounded-full bg-[#4744e5] text-white flex items-center justify-center shadow-xs font-extrabold'
                                : cell.isCurrentMonth
                                ? 'text-[#1a1c1c]'
                                : 'text-[#c0c0d0]'
                            }`}
                          >
                            {cell.dayNumber}
                          </span>
                        </div>

                        {/* Visit Cards inside Day Cell */}
                        <div className="space-y-2 flex-1">
                          {cell.visits.map((v) => (
                            <div
                              key={v.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/visits/${v.id}`);
                              }}
                              className="bg-white border border-[#E1E1E1] hover:border-[#4744e5] hover:shadow-md transition-all rounded-xl p-3 text-left shadow-2xs relative cursor-pointer group space-y-1"
                            >
                              {/* Top Row: Status Dot + Time */}
                              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#767587]">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    v.status === 'COMPLETED'
                                      ? 'bg-emerald-500'
                                      : v.status === 'CONFIRMED'
                                      ? 'bg-indigo-600'
                                      : v.status === 'IN_PROGRESS'
                                      ? 'bg-[#4744e5]'
                                      : 'bg-amber-500'
                                  }`}
                                />
                                <span>
                                  {v.startTime} - {v.endTime}
                                </span>
                              </div>

                              {/* Customer Name */}
                              <div className="font-extrabold text-xs text-[#1a1c1c] group-hover:text-[#4744e5] transition-colors leading-tight font-['Hanken_Grotesk']">
                                {v.customerName}
                              </div>

                              {/* Purpose */}
                              <div className="text-[11px] text-[#767587] font-medium leading-tight">
                                {v.purpose || v.title}
                              </div>

                              {/* PIC Avatar */}
                              <div className="pt-1 flex items-center justify-between">
                                <img
                                  src={
                                    v.picAvatar ||
                                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                                  }
                                  alt={v.picName}
                                  className="w-5 h-5 rounded-full object-cover border border-[#E1E1E1]"
                                  title={`PIC: ${v.picName}`}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: SCHEDULE VISIT MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <div>
                <h2 className="text-lg font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Schedule New Visit
                </h2>
                <p className="text-xs text-[#767587]">Create a scheduled meeting with a customer account</p>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-[#767587] hover:text-[#1a1c1c] p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateVisit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Target Customer Account *</label>
                <select
                  value={formCustomerId}
                  onChange={(e) => {
                    setFormCustomerId(e.target.value);
                    const selected = customers.find((c) => c.id === e.target.value);
                    if (selected && selected.address) {
                      setFormLocation(selected.address);
                    }
                  }}
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl bg-white font-semibold text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Visit Subject / Title *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Q3 Sales Contract Renewal & Architecture Pitch"
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Purpose *</label>
                  <select
                    value={formPurpose}
                    onChange={(e) => setFormPurpose(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
                  >
                    <option value="Executive Product Briefing">Executive Product Briefing</option>
                    <option value="System Upgrade Presentation">System Upgrade Presentation</option>
                    <option value="Technical Alignment">Technical Alignment</option>
                    <option value="Contract Expansion">Contract Expansion</option>
                    <option value="Product Training">Product Training</option>
                    <option value="Contract Renewal">Contract Renewal</option>
                    <option value="Security & Compliance">Security & Compliance</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Assigned PIC *</label>
                  <select
                    value={formPicId}
                    onChange={(e) => setFormPicId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.roleName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Visit Date *</label>
                  <input
                    type="date"
                    required
                    value={formVisitDate}
                    onChange={(e) => setFormVisitDate(e.target.value)}
                    className="w-full px-2 py-2 border border-[#E1E1E1] rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Start Time *</label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-2 py-2 border border-[#E1E1E1] rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">End Time *</label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-2 py-2 border border-[#E1E1E1] rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Location Address *</label>
                <input
                  type="text"
                  required
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="e.g. Cyber 2 Tower Lt 18, Kuningan, Jakarta"
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Preparation Notes / Agenda</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Additional instructions or meeting objectives..."
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 border border-[#E1E1E1] hover:bg-slate-50 text-[#1a1c1c] rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4744e5] hover:bg-[#322fce] text-white rounded-xl font-bold cursor-pointer"
                >
                  Schedule Visit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VIEW VISIT DETAILS */}
      {viewingVisit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-[#E1E1E1] pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {renderStatusBadge(viewingVisit.status)}
                  <span className="text-[10px] text-[#767587] font-mono">{viewingVisit.id}</span>
                </div>
                <h2 className="text-lg font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  {viewingVisit.title}
                </h2>
              </div>
              <button
                onClick={() => setViewingVisit(null)}
                className="text-[#767587] hover:text-[#1a1c1c] p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#1a1c1c]">
              <div className="bg-slate-50 p-3 rounded-xl border border-[#E1E1E1] grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-[#767587] uppercase">Customer Account</span>
                  <Link
                    to={`/customers/${viewingVisit.customerId}`}
                    className="block font-bold text-[#4744e5] hover:underline"
                  >
                    {viewingVisit.customerName}
                  </Link>
                  <span className="text-[10px] text-[#767587]">{viewingVisit.customerCode}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#767587] uppercase">Assigned PIC</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <img
                      src={
                        viewingVisit.picAvatar ||
                        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                      }
                      alt={viewingVisit.picName}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <span className="font-semibold">{viewingVisit.picName}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-[#767587] uppercase block">Date & Time</span>
                  <div className="font-semibold">{viewingVisit.visitDate}</div>
                  <div className="text-[11px] text-[#767587]">
                    {viewingVisit.startTime} - {viewingVisit.endTime}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#767587] uppercase block">Purpose</span>
                  <div className="font-semibold">{viewingVisit.purpose}</div>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-[#767587] uppercase block">Location</span>
                <div className="flex items-start gap-1 font-medium mt-0.5 text-[#464555]">
                  <span className="material-symbols-outlined text-[16px] text-[#767587] shrink-0">
                    location_on
                  </span>
                  <span>{viewingVisit.location}</span>
                </div>
              </div>

              {viewingVisit.notes && (
                <div>
                  <span className="text-[10px] font-bold text-[#767587] uppercase block">Notes & Activity Logs</span>
                  <p className="mt-1 p-2.5 bg-slate-50 border border-[#E1E1E1] rounded-xl text-[11px] text-[#464555] whitespace-pre-line">
                    {viewingVisit.notes}
                  </p>
                </div>
              )}

              {viewingVisit.result && (
                <div>
                  <span className="text-[10px] font-bold text-[#767587] uppercase block text-emerald-700">
                    Meeting Result & Outcome
                  </span>
                  <p className="mt-1 p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 font-medium">
                    {viewingVisit.result}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E1E1E1]">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const v = viewingVisit;
                    setViewingVisit(null);
                    handleOpenEditModal(v);
                  }}
                  className="px-3 py-1.5 border border-[#E1E1E1] hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const v = viewingVisit;
                    setViewingVisit(null);
                    handleOpenRescheduleModal(v);
                  }}
                  className="px-3 py-1.5 border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">update</span>
                  <span>Reschedule</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewingVisit(null)}
                className="px-4 py-1.5 bg-[#4744e5] text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT VISIT */}
      {editingVisit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-lg font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Edit Visit Details
              </h2>
              <button
                onClick={() => setEditingVisit(null)}
                className="text-[#767587] hover:text-[#1a1c1c] p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Customer Account</label>
                <select
                  value={formCustomerId}
                  onChange={(e) => setFormCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c]"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Visit Title *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Purpose</label>
                  <input
                    type="text"
                    value={formPurpose}
                    onChange={(e) => setFormPurpose(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as VisitStatus)}
                    className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs bg-white font-semibold"
                  >
                    <option value="PLANNED">Planned</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="RESCHEDULED">Rescheduled</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Date</label>
                  <input
                    type="date"
                    value={formVisitDate}
                    onChange={(e) => setFormVisitDate(e.target.value)}
                    className="w-full px-2 py-2 border border-[#E1E1E1] rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-2 py-2 border border-[#E1E1E1] rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">End Time</label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-2 py-2 border border-[#E1E1E1] rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Location Address</label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Assigned PIC</label>
                <select
                  value={formPicId}
                  onChange={(e) => setFormPicId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs bg-white"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setEditingVisit(null)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4744e5] text-white rounded-xl font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RESCHEDULE VISIT */}
      {reschedulingVisit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <div>
                <h2 className="text-lg font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Reschedule Visit
                </h2>
                <p className="text-xs text-[#767587]">Update meeting date and notify customer</p>
              </div>
              <button
                onClick={() => setReschedulingVisit(null)}
                className="text-[#767587] hover:text-[#1a1c1c] p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmReschedule} className="space-y-3 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-0.5">
                <div className="font-bold text-amber-900">{reschedulingVisit.title}</div>
                <div className="text-[11px] text-amber-800">{reschedulingVisit.customerName}</div>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">New Visit Date *</label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">New Start Time *</label>
                  <input
                    type="time"
                    required
                    value={rescheduleStartTime}
                    onChange={(e) => setRescheduleStartTime(e.target.value)}
                    className="w-full px-2 py-2 border border-[#E1E1E1] rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">New End Time *</label>
                  <input
                    type="time"
                    required
                    value={rescheduleEndTime}
                    onChange={(e) => setRescheduleEndTime(e.target.value)}
                    className="w-full px-2 py-2 border border-[#E1E1E1] rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Reason for Rescheduling</label>
                <textarea
                  rows={2}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Client requested postponement due to executive conflict..."
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setReschedulingVisit(null)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Confirm Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: CANCEL VISIT */}
      {cancellingVisit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <div>
                <h2 className="text-lg font-bold text-rose-600 font-['Hanken_Grotesk'] flex items-center gap-1.5">
                  <span className="material-symbols-outlined">warning</span>
                  <span>Cancel Visit</span>
                </h2>
                <p className="text-xs text-[#767587]">Are you sure you want to cancel this visit?</p>
              </div>
              <button
                onClick={() => setCancellingVisit(null)}
                className="text-[#767587] hover:text-[#1a1c1c] p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} className="space-y-3 text-xs">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-0.5">
                <div className="font-bold text-rose-900">{cancellingVisit.title}</div>
                <div className="text-[11px] text-rose-800">Customer: {cancellingVisit.customerName}</div>
                <div className="text-[11px] text-rose-700">Scheduled: {cancellingVisit.visitDate}</div>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Cancellation Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Cancelled by customer due to internal budget review freeze..."
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setCancellingVisit(null)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded-xl font-bold cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Confirm Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

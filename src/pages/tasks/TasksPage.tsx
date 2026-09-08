import React, { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { masterDataApi } from '../../services/masterDataApi';
import { Task, Customer, Project, MasterDataItem, User } from '../../types';
import { crmApi } from '../../services/crmApi';
import { usersApi } from '../../services/usersApi';
import { formatDate } from '../../utils/formatters';

export function formatTaskSourceType(sourceType?: string | null): string {
  const s = String(sourceType || '').toUpperCase();
  if (s === 'PROJECT_ASSIGNMENT') return 'Project Assignment';
  if (s === 'VISIT_ASSIGNMENT') return 'Visit Assignment';
  return 'Manual Task';
}

export function getTaskSourceBadgeClass(sourceType?: string | null): string {
  const s = String(sourceType || '').toUpperCase();
  if (s === 'PROJECT_ASSIGNMENT') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (s === 'VISIT_ASSIGNMENT') return 'bg-teal-50 text-teal-700 border-teal-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export function getTaskStatusLabel(task: Partial<Task>): string {
  if (task.statusName) return task.statusName;
  const s = String(task.status || task.statusId || '').toUpperCase();
  if (s === 'COMPLETED' || s === 'TS-3' || s === 'TSK_COMPLETED') return 'Completed';
  if (s === 'IN_PROGRESS' || s === 'TS-2' || s === 'TSK_INPROGRESS') return 'In Progress';
  if (s === 'CANCELLED' || s === 'TS-4' || s === 'TSK_CANCELLED') return 'Cancelled';
  if (s === 'REVIEW') return 'Review';
  return 'To Do';
}

export function getTaskStatusBadgeClass(task: Partial<Task>): string {
  const s = String(task.status || task.statusId || '').toUpperCase();
  if (s === 'COMPLETED' || s === 'TS-3' || s === 'TSK_COMPLETED') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (s === 'IN_PROGRESS' || s === 'TS-2' || s === 'TSK_INPROGRESS') {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  if (s === 'CANCELLED' || s === 'TS-4' || s === 'TSK_CANCELLED') {
    return 'bg-slate-100 text-slate-600 border-slate-300';
  }
  if (s === 'REVIEW') {
    return 'bg-purple-50 text-purple-700 border-purple-200';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export function getTaskPriorityLabel(task: Partial<Task>): string {
  if (task.priorityName) return task.priorityName;
  const p = String(task.priority || task.priorityId || '').toUpperCase();
  if (p === 'URGENT' || p === 'TP-1' || p === 'PRI_URGENT') return 'Urgent';
  if (p === 'HIGH' || p === 'TP-2' || p === 'PRI_HIGH') return 'High';
  if (p === 'LOW' || p === 'TP-4' || p === 'PRI_LOW') return 'Low';
  if (p === 'MEDIUM' || p === 'NORMAL' || p === 'TP-3' || p === 'PRI_MEDIUM') return 'Medium';
  return p ? p : '—';
}

export function getTaskPriorityBadgeClass(task: Partial<Task>): string {
  const p = String(task.priority || task.priorityId || '').toUpperCase();
  if (p === 'URGENT' || p === 'TP-1' || p === 'PRI_URGENT') {
    return 'bg-rose-100 text-rose-700';
  }
  if (p === 'HIGH' || p === 'TP-2' || p === 'PRI_HIGH') {
    return 'bg-amber-100 text-amber-800';
  }
  if (p === 'LOW' || p === 'TP-4' || p === 'PRI_LOW') {
    return 'bg-slate-100 text-slate-600';
  }
  if (p === 'MEDIUM' || p === 'NORMAL' || p === 'TP-3' || p === 'PRI_MEDIUM') {
    return 'bg-blue-100 text-blue-700';
  }
  return 'bg-slate-100 text-slate-700';
}

export const TasksPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentTenant, currentUser } = useAuth();
  const tenantId = currentTenant?.id;
  const [searchParams, setSearchParams] = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [picFilter, setPicFilter] = useState('ALL');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('ALL');
  const [dueDateFilter, setDueDateFilter] = useState('');
  
  // Quick Filters (Tabs)
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'COMPLETED'>('ALL');

  // Pagination & Server Filter State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Main Categories from URL
  const activeCategory = searchParams.get('category') || 'ALL';
  const activeProject = searchParams.get('project') || 'ALL';

  // Permissions & Scope
  const canAccessAll = currentUser?.role === 'TENANT_ADMIN' || currentUser?.role === 'SUPERVISOR' || currentUser?.role === 'SUPER_ADMIN';
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

  const loadData = async (page = currentPage) => {
    setIsLoading(true);
    try {
      const [tRes, cList, pList, uList] = await Promise.all([
        crmApi.fetchTasks({
          page,
          pageSize,
          search: searchQuery || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
          customerId: customerFilter !== 'ALL' ? customerFilter : undefined,
          picId: picFilter !== 'ALL' ? picFilter : undefined,
          sourceType: sourceTypeFilter !== 'ALL' ? sourceTypeFilter : undefined,
          dueDate: dueDateFilter || undefined,
          tenantId,
          scope: activeScope
        }),
        crmApi.fetchCollection<Customer>('customers', tenantId),
        crmApi.fetchCollection<Project>('projects', tenantId),
        usersApi.fetchUsers(tenantId, true).catch(() => [])
      ]);
      setTasks(tRes.data || []);
      setTotalItems(tRes.pagination?.totalItems || 0);
      setTotalPages(tRes.pagination?.totalPages || 0);
      setCustomers(cList || []);
      setProjects(pList || []);
      setAssignableUsers(uList || []);
    } catch (err) {
      console.error('Failed to load tasks from database:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData(currentPage);
  }, [tenantId, currentPage, pageSize, searchQuery, statusFilter, priorityFilter, customerFilter, picFilter, sourceTypeFilter, dueDateFilter, activeScope]);

  const [taskStatuses, setTaskStatuses] = useState<MasterDataItem[]>([]);
  const [taskPriorities, setTaskPriorities] = useState<MasterDataItem[]>([]);

  React.useEffect(() => {
    masterDataApi.fetchMasterData('task_statuses', tenantId).then(setTaskStatuses).catch(() => []);
    masterDataApi.fetchMasterData('task_priorities', tenantId).then(setTaskPriorities).catch(() => []);
  }, [tenantId]);

  const handleCategoryChange = (cat: string) => {
    setSearchParams({ category: cat, project: 'ALL' });
  };
  const handleProjectChange = (oppId: string) => {
    setSearchParams({ category: activeCategory, project: oppId });
  };

  const [showAddModal, setShowAddModal] = useState(false);

  // Form State for new task
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('HIGH');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);

  // Date helpers
  const today = new Date().toISOString().split('T')[0];

  // Calculated Metrics
  const metrics = useMemo(() => {
    let overdue = 0;
    let dueToday = 0;
    let inProgress = 0;
    let completed = 0;

    tasks.forEach((t) => {
      const isCompleted = t.status === 'COMPLETED' || t.statusId === 'TS-3';
      const isInProgress = t.status === 'IN_PROGRESS' || t.statusId === 'TS-2';
      const isCancelled = t.status === 'CANCELLED' || t.statusId === 'TS-4';

      if (isCompleted) {
        completed++;
      } else if (!isCancelled) {
        if (isInProgress) inProgress++;
        if (t.dueDate && t.dueDate < today) overdue++;
        if (t.dueDate && t.dueDate === today) dueToday++;
      }
    });

    return { total: totalItems || tasks.length, overdue, dueToday, inProgress, completed };
  }, [tasks, totalItems, today]);

  // Filtering Logic
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Category logic: ALL vs VISIT vs PROJECT vs MANUAL
      if (activeCategory === 'VISIT') {
        const isVisitTask = t.sourceType === 'VISIT_ASSIGNMENT' || Boolean(t.relatedVisitId) || t.taskType === 'Visit';
        if (!isVisitTask) return false;
      } else if (activeCategory === 'PROJECT') {
        const isProjectTask = t.sourceType === 'PROJECT_ASSIGNMENT' || Boolean(t.relatedProjectId) || t.taskType === 'Project';
        if (!isProjectTask) return false;
        
        // Sub-filter by project
        if (activeProject !== 'ALL' && t.relatedProjectId !== activeProject) return false;
      } else if (activeCategory === 'MANUAL') {
        const isManualOnly = (t.sourceType === 'MANUAL' || !t.sourceType) && !t.relatedProjectId && !t.relatedVisitId;
        if (!isManualOnly) return false;
      }
      
      // 1. Search Query
      if (searchQuery) {
        const q = searchQuery.trim().toLowerCase();
        const combined = [
          t.title,
          t.id,
          t.picName,
          t.customerName,
          t.customerCode,
          t.projectName,
          t.visitTitle,
          t.sourceType,
          t.statusName,
          t.priorityName
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!combined.includes(q)) return false;
      }
      
      // 2. Status
      if (statusFilter !== 'ALL') {
        const sMatch = t.statusId === statusFilter || t.statusCode === statusFilter || t.status === statusFilter;
        if (!sMatch) return false;
      }
      
      // 3. Priority
      if (priorityFilter !== 'ALL') {
        const pMatch = t.priorityId === priorityFilter || t.priorityCode === priorityFilter || t.priority === priorityFilter;
        if (!pMatch) return false;
      }

      // 4. Source Type
      if (sourceTypeFilter !== 'ALL' && t.sourceType !== sourceTypeFilter) {
        return false;
      }

      // 5. PIC / Assignee
      if (picFilter !== 'ALL' && t.picId !== picFilter) {
        return false;
      }
      
      // 6. Customer
      if (customerFilter !== 'ALL' && t.customerId !== customerFilter) return false;
      
      // 7. Due Date
      if (dueDateFilter && t.dueDate !== dueDateFilter) return false;

      // 8. Quick Filters
      const isCompleted = t.status === 'COMPLETED' || t.statusId === 'TS-3';
      const isCancelled = t.status === 'CANCELLED' || t.statusId === 'TS-4';

      if (quickFilter === 'OVERDUE') {
        if (isCompleted || isCancelled || !t.dueDate || t.dueDate >= today) return false;
      }
      if (quickFilter === 'DUE_TODAY') {
        if (isCompleted || isCancelled || !t.dueDate || t.dueDate !== today) return false;
      }
      if (quickFilter === 'UPCOMING') {
        if (isCompleted || isCancelled || !t.dueDate || t.dueDate <= today) return false;
      }
      if (quickFilter === 'COMPLETED') {
        if (!isCompleted) return false;
      }

      return true;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter, sourceTypeFilter, picFilter, customerFilter, dueDateFilter, quickFilter, today, activeCategory, activeProject]);

  const toggleTaskComplete = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const isCurrentlyCompleted = task.status === 'COMPLETED' || task.statusId === 'TS-3';
      const newStatus = isCurrentlyCompleted ? 'TODO' : 'COMPLETED';
      const newStatusId = isCurrentlyCompleted ? 'TS-1' : 'TS-3';
      const res = await crmApi.updateRecord('tasks', taskId, {
        status: newStatus,
        statusId: newStatusId,
        completedAt: isCurrentlyCompleted ? null : new Date().toISOString()
      });
      if (res.success) {
        loadData();
      }
    }
  };
  
  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      const res = await crmApi.deleteRecord('tasks', id);
      if (res.success) {
        if (tasks.length === 1 && currentPage > 1) {
          setCurrentPage(prev => prev - 1);
        } else {
          loadData(currentPage);
        }
      } else {
        console.error('Failed to delete task:', res.error);
        loadData(currentPage);
      }
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === selectedCustomerId);
    const newTask: Partial<Task> = {
      id: `TSK-${Date.now().toString().slice(-4)}`,
      tenantId,
      title,
      customerId: selectedCustomerId,
      customerName: cust?.name || 'Unknown Client',
      customerCode: cust?.code || 'CUS-000',
      picId: currentUser?.id || 'USR-001',
      picName: currentUser?.name || 'Sales Rep',
      picAvatar: currentUser?.avatarUrl,
      priority,
      status: 'TODO',
      dueDate,
      createdAt: new Date().toISOString().split('T')[0],
    };

    const res = await crmApi.createRecord('tasks', newTask);
    if (res.success) {
      setCurrentPage(1);
      loadData(1);
      setShowAddModal(false);
      setTitle('');
    } else {
      console.error('Failed to create task:', res.error);
      loadData(currentPage);
    }
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif] pb-16 max-w-7xl mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
              {activeScope === 'all' ? 'All Tasks' : 'My Tasks'}
            </h1>
            {canAccessAll && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
                {activeScope === 'all' ? 'Tenant Wide' : 'Personal Scope'}
              </span>
            )}
          </div>
          <p className="text-xs text-[#767587] mt-0.5">
            {activeScope === 'all'
              ? 'Manage and monitor all tasks across your organization.'
              : 'Manage your personal sales activities, follow-ups, and deliverables.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Scope Switcher (Tenant Admin & Supervisor only) */}
          {canAccessAll && (
            <div className="flex bg-[#f3f3f3] p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => handleScopeChange('my')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeScope === 'my'
                    ? 'bg-white shadow-xs text-[#4744e5]'
                    : 'text-[#767587] hover:text-[#1a1c1c]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">person</span>
                <span>My Tasks</span>
              </button>
              <button
                onClick={() => handleScopeChange('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeScope === 'all'
                    ? 'bg-white shadow-xs text-[#4744e5]'
                    : 'text-[#767587] hover:text-[#1a1c1c]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">group</span>
                <span>All Tasks</span>
              </button>
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="flex bg-[#f3f3f3] p-1 rounded-xl">
            <button 
              className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-white shadow-sm text-[#4744e5]"
            >
              <span className="material-symbols-outlined text-[16px]">list</span>
              List
            </button>
            <button 
              onClick={() => navigate('/task-board' + location.search)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 text-[#767587] hover:text-[#1a1c1c] hover:bg-[#e1e1e1] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">view_kanban</span>
              Board
            </button>
          </div>

          <button
            onClick={() => navigate('/tasks/new')}
            className="px-4 py-2 bg-[#4744e5] hover:bg-[#322fce] text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5 font-['Hanken_Grotesk'] shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* CATEGORIES & SUB-CATEGORIES */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-[#E1E1E1] overflow-x-auto">
          <button
            onClick={() => handleCategoryChange('ALL')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeCategory === 'ALL'
                ? 'border-[#4744e5] text-[#4744e5]'
                : 'border-transparent text-[#767587] hover:text-[#1a1c1c]'
            }`}
          >
            All Tasks
          </button>
          <button
            onClick={() => handleCategoryChange('VISIT')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeCategory === 'VISIT'
                ? 'border-[#4744e5] text-[#4744e5]'
                : 'border-transparent text-[#767587] hover:text-[#1a1c1c]'
            }`}
          >
            Visit Tasks
          </button>
          <button
            onClick={() => handleCategoryChange('PROJECT')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeCategory === 'PROJECT'
                ? 'border-[#4744e5] text-[#4744e5]'
                : 'border-transparent text-[#767587] hover:text-[#1a1c1c]'
            }`}
          >
            Project Tasks
          </button>
          <button
            onClick={() => handleCategoryChange('MANUAL')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeCategory === 'MANUAL'
                ? 'border-[#4744e5] text-[#4744e5]'
                : 'border-transparent text-[#767587] hover:text-[#1a1c1c]'
            }`}
          >
            Manual Tasks
          </button>
        </div>

        {activeCategory === 'PROJECT' && projects.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-[#464555]">Project Filter:</label>
            <select
              value={activeProject}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="px-3 py-2 bg-white border border-[#E1E1E1] rounded-lg text-sm text-[#1a1c1c] font-medium focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All Projects</option>
              {projects.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#E1E1E1] shadow-2xs flex flex-col justify-between">
          <div className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] mb-2">
            Total Tasks
          </div>
          <div className="text-2xl font-extrabold text-[#1a1c1c]">{metrics.total}</div>
        </div>
        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 shadow-2xs flex flex-col justify-between">
          <div className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wider font-['Hanken_Grotesk'] mb-2">
            Overdue
          </div>
          <div className="text-2xl font-extrabold text-rose-700">{metrics.overdue}</div>
        </div>
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 shadow-2xs flex flex-col justify-between">
          <div className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider font-['Hanken_Grotesk'] mb-2">
            Due Today
          </div>
          <div className="text-2xl font-extrabold text-amber-700">{metrics.dueToday}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 shadow-2xs flex flex-col justify-between">
          <div className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider font-['Hanken_Grotesk'] mb-2">
            In Progress
          </div>
          <div className="text-2xl font-extrabold text-blue-700">{metrics.inProgress}</div>
        </div>
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-2xs flex flex-col justify-between">
          <div className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider font-['Hanken_Grotesk'] mb-2">
            Completed
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">{metrics.completed}</div>
        </div>
      </div>

      {/* FILTERS & TABS CONTAINER */}
      <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs p-4 space-y-4">
        
        {/* Quick Filters (Tabs) */}
        <div className="flex items-center gap-2 border-b border-[#f0f0f4] pb-4 overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Tasks' },
            { id: 'OVERDUE', label: 'Overdue' },
            { id: 'DUE_TODAY', label: 'Due Today' },
            { id: 'UPCOMING', label: 'Upcoming' },
            { id: 'COMPLETED', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setQuickFilter(tab.id as any)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all font-['Hanken_Grotesk'] cursor-pointer ${
                quickFilter === tab.id
                  ? 'bg-[#1a1c1c] text-white'
                  : 'bg-white text-[#767587] hover:bg-slate-50 border border-transparent hover:border-[#E1E1E1]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a0b0] text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[#E1E1E1] rounded-xl text-xs font-medium focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5]"
            />
          </div>

          {/* Status */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs font-medium bg-white focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All Status</option>
              {taskStatuses.map(s => (
                <option key={s.id} value={s.code_value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs font-medium bg-white focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All Priorities</option>
              {taskPriorities.map(p => (
                <option key={p.id} value={p.code_value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Source Type */}
          <div>
            <select
              value={sourceTypeFilter}
              onChange={(e) => setSourceTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs font-medium bg-white focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All Sources</option>
              <option value="MANUAL">Manual Task</option>
              <option value="PROJECT_ASSIGNMENT">Project Assignment</option>
              <option value="VISIT_ASSIGNMENT">Visit Assignment</option>
            </select>
          </div>

          {/* PIC / Assignee */}
          <div>
            <select
              value={picFilter}
              onChange={(e) => setPicFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs font-medium bg-white focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All Assignees</option>
              {assignableUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Customer */}
          <div>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs font-medium bg-white focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Due Date */}
          <div>
            <input
              type="date"
              value={dueDateFilter}
              onChange={(e) => setDueDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs font-medium bg-white focus:outline-none focus:border-[#4744e5]"
            />
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#fcfcfd] border-b border-[#f0f0f4]">
              <tr>
                <th className="px-5 py-4 w-10 text-center font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] text-[10px]">
                  Done
                </th>
                <th className="px-5 py-4 font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] text-[10px]">
                  Task
                </th>
                <th className="px-5 py-4 font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] text-[10px]">
                  Source
                </th>
                <th className="px-5 py-4 font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] text-[10px]">
                  Customer
                </th>
                <th className="px-5 py-4 font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] text-[10px]">
                  Project / Visit
                </th>
                <th className="px-5 py-4 font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] text-[10px]">
                  Priority
                </th>
                <th className="px-5 py-4 font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] text-[10px]">
                  Status
                </th>
                <th className="px-5 py-4 font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] text-[10px]">
                  Due Date
                </th>
                <th className="px-5 py-4 font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] text-[10px]">
                  Assignee
                </th>
                <th className="px-5 py-4 w-20 text-right font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] text-[10px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f4]">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center text-[#a0a0b0] space-y-2">
                      <span className="material-symbols-outlined text-[48px] opacity-20">inventory_2</span>
                      <p className="text-sm font-medium">No tasks found matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => {
                  const isCompleted = t.status === 'COMPLETED' || t.statusId === 'TS-3';
                  const isOverdue = Boolean(t.dueDate && t.dueDate < today && !isCompleted);
                  const formattedDueDate = t.dueDate 
                    ? (new Date(t.dueDate).toString() !== 'Invalid Date' 
                        ? new Date(t.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) 
                        : t.dueDate) 
                    : '—';

                  return (
                    <tr key={t.id} className={`hover:bg-[#fcfcfd] transition-colors group ${isCompleted ? 'bg-slate-50/50' : ''}`}>
                      {/* Done Checkbox */}
                      <td className="px-5 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={() => toggleTaskComplete(t.id)}
                          className="w-4 h-4 rounded text-[#4744e5] border-[#E1E1E1] focus:ring-[#4744e5] cursor-pointer"
                        />
                      </td>

                      {/* Task */}
                      <td className="px-5 py-4">
                        <Link to={`/tasks/${t.id}`} className={`font-semibold hover:text-[#4744e5] hover:underline transition-colors ${isCompleted ? 'line-through text-[#a0a0b0]' : 'text-[#1a1c1c]'}`}>
                          {t.title || 'Untitled Task'}
                        </Link>
                        <div className="text-[10px] text-[#767587] font-mono mt-0.5">{t.id}</div>
                      </td>

                      {/* Source */}
                      <td className="px-5 py-4">
                        <span className={getTaskSourceBadgeClass(t.sourceType)}>
                          {formatTaskSourceType(t.sourceType)}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-4">
                        {t.customerName ? (
                          t.customerId ? (
                            <Link to={`/customers/${t.customerId}`} className="font-semibold text-[#1a1c1c] hover:text-[#4744e5] hover:underline">
                              {t.customerName}
                            </Link>
                          ) : (
                            <span className="font-semibold text-[#1a1c1c]">{t.customerName}</span>
                          )
                        ) : (
                          <span className="text-[#a0a0b0]">—</span>
                        )}
                      </td>

                      {/* Project / Visit */}
                      <td className="px-5 py-4">
                        {t.relatedProjectId ? (
                          <Link to={`/projects/${t.relatedProjectId}`} className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">folder</span>
                            <span className="truncate max-w-[140px]">{t.projectName || t.projectCode || t.relatedProjectId}</span>
                          </Link>
                        ) : t.relatedVisitId ? (
                          <Link to={`/visits/${t.relatedVisitId}`} className="font-semibold text-sky-600 hover:text-sky-800 hover:underline flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                            <span className="truncate max-w-[140px]">{t.visitTitle || t.relatedVisitId}</span>
                          </Link>
                        ) : (
                          <span className="text-[#a0a0b0]">—</span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="px-5 py-4">
                        <span className={getTaskPriorityBadgeClass(t)}>
                          {getTaskPriorityLabel(t)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className={getTaskStatusBadgeClass(t)}>
                          {getTaskStatusLabel(t)}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="px-5 py-4">
                        <div className={`font-semibold ${isOverdue ? 'text-rose-600' : 'text-[#1a1c1c]'}`}>
                          {formattedDueDate}
                        </div>
                        {isOverdue && (
                          <div className="text-[10px] font-bold text-rose-500 mt-0.5 uppercase tracking-wider">Overdue</div>
                        )}
                      </td>

                      {/* Assignee / PIC */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {t.picAvatar ? (
                            <img
                              src={t.picAvatar}
                              alt={t.picName || 'PIC'}
                              className="w-6 h-6 rounded-full object-cover border border-[#E1E1E1]"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-200 text-[#464555] font-bold text-[10px] flex items-center justify-center border border-[#E1E1E1]">
                              {(t.picName || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-[#1a1c1c]">{t.picName || 'Unassigned'}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="Edit Task"
                            onClick={() => navigate(`/tasks/${t.id}/edit`)}
                            className="p-1.5 text-[#767587] hover:text-[#4744e5] hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            title="Delete Task"
                            onClick={() => handleDelete(t.id)}
                            className="p-1.5 text-[#767587] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="p-4 bg-white border-t border-[#E1E1E1] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#767587]">
          <div>
            Showing {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalItems)} of {totalItems}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1 || totalPages === 0}
              className="w-8 h-8 flex items-center justify-center text-[#767587] hover:bg-[#f3f3f3] rounded disabled:opacity-30 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center cursor-pointer ${
                  currentPage === p ? 'bg-[#4744e5] text-white shadow-2xs' : 'text-[#1a1c1c] hover:bg-[#f3f3f3]'
                }`}
              >
                {p}
              </button>
            ))}

            {totalPages > 5 && (
              <>
                <span className="px-1 text-[#767587]">...</span>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center cursor-pointer ${
                    currentPage === totalPages ? 'bg-[#4744e5] text-white shadow-2xs' : 'text-[#1a1c1c] hover:bg-[#f3f3f3]'
                  }`}
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="w-8 h-8 flex items-center justify-center text-[#767587] hover:bg-[#f3f3f3] rounded disabled:opacity-30 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* CREATE TASK MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-[#E1E1E1] shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-[#f0f0f4] pb-3">
              <h2 className="text-base font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Create New Task
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-[#767587] hover:text-[#1a1c1c] cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Target Customer Account <span className="text-rose-500">*</span></label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E1E1E1] rounded-xl bg-white font-medium focus:outline-none focus:border-[#4744e5]"
                  required
                >
                  <option value="" disabled>Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Task Title <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Send revised SLA proposal"
                  className="w-full px-3 py-2.5 border border-[#E1E1E1] rounded-xl font-medium focus:outline-none focus:border-[#4744e5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2.5 border border-[#E1E1E1] rounded-xl bg-white font-medium focus:outline-none focus:border-[#4744e5]"
                  >
                    {taskPriorities.map(p => (
                      <option key={p.id} value={p.code_value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-[#E1E1E1] rounded-xl font-medium focus:outline-none focus:border-[#4744e5]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#f0f0f4]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-[#E1E1E1] text-[#1a1c1c] rounded-xl font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4744e5] hover:bg-[#322fce] text-white rounded-xl font-extrabold cursor-pointer transition-colors"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;

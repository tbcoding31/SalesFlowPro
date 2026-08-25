import React, { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { masterDataApi } from '../../services/masterDataApi';
import { Task, Customer, Project, MasterDataItem } from '../../types';
import { crmApi } from '../../services/crmApi';

export const TasksPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentTenant, currentUser } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';
  const [searchParams, setSearchParams] = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tList, cList, pList] = await Promise.all([
        crmApi.fetchCollection<Task>('tasks', tenantId),
        crmApi.fetchCollection<Customer>('customers', tenantId),
        crmApi.fetchCollection<Project>('projects', tenantId)
      ]);
      setTasks(tList);
      setCustomers(cList);
      setProjects(pList);
    } catch (err) {
      console.error('Failed to load tasks from database:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, [tenantId]);

  const [taskStatuses, setTaskStatuses] = useState<MasterDataItem[]>([]);
  const [taskPriorities, setTaskPriorities] = useState<MasterDataItem[]>([]);

  React.useEffect(() => {
    masterDataApi.fetchMasterData('task_statuses', tenantId).then(setTaskStatuses);
    masterDataApi.fetchMasterData('task_priorities', tenantId).then(setTaskPriorities);
  }, [tenantId]);

  // Main Categories
  const activeCategory = searchParams.get('category') || 'VISIT';
  const activeProject = searchParams.get('project') || 'ALL';

  const handleCategoryChange = (cat: string) => {
    setSearchParams({ category: cat, project: 'ALL' });
  };
  const handleProjectChange = (oppId: string) => {
    setSearchParams({ category: activeCategory, project: oppId });
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [dueDateFilter, setDueDateFilter] = useState('');
  
  // Quick Filters (Tabs)
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'COMPLETED'>('ALL');

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
      if (t.status === 'COMPLETED') {
        completed++;
      } else {
        if (t.status === 'IN_PROGRESS') inProgress++;
        if (t.dueDate < today) overdue++;
        if (t.dueDate === today) dueToday++;
      }
    });

    return { total: tasks.length, overdue, dueToday, inProgress, completed };
  }, [tasks, today]);

  // Filtering Logic
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 0. Only show tasks assigned to me
      if (t.picId !== currentUser?.id) return false;
      
      // Category logic: VISIT vs PROJECT
      if (activeCategory === 'VISIT') {
        // Show tasks mapped from visits OR linked to visits OR taskType === 'Visit'
        // For simplicity, any task not linked to an project might be considered Visit or just normal task,
        // but let's strictly filter:
        if (!t.relatedVisitId && t.taskType !== 'Visit') return false;
      } else if (activeCategory === 'PROJECT') {
        if (!t.relatedProjectId && t.taskType !== 'Project') return false;
        
        // Sub-filter by project
        if (activeProject !== 'ALL' && t.relatedProjectId !== activeProject) return false;
      }
      
      // 1. Search Query
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      
      // 2. Status
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      
      // 3. Priority
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      
      // 4. Customer
      if (customerFilter !== 'ALL' && t.customerId !== customerFilter) return false;
      
      // 5. Due Date
      if (dueDateFilter && t.dueDate !== dueDateFilter) return false;

      // 6. Quick Filters
      if (quickFilter === 'OVERDUE') {
        if (t.status === 'COMPLETED' || t.dueDate >= today) return false;
      }
      if (quickFilter === 'DUE_TODAY') {
        if (t.status === 'COMPLETED' || t.dueDate !== today) return false;
      }
      if (quickFilter === 'UPCOMING') {
        if (t.status === 'COMPLETED' || t.dueDate <= today) return false;
      }
      if (quickFilter === 'COMPLETED') {
        if (t.status !== 'COMPLETED') return false;
      }

      return true;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter, customerFilter, dueDateFilter, quickFilter, today, currentUser?.id, activeCategory, activeProject]);

  const toggleTaskComplete = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const updated: Task = {
        ...task,
        status: task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED',
        completedAt: task.status === 'COMPLETED' ? undefined : new Date().toISOString().split('T')[0],
      };
      DataService.saveTask(updated);
      setTasks(DataService.getTasks(tenantId));
    }
  };
  
  const deleteTask = (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      const stored = localStorage.getItem(`tasks_${tenantId}`);
      if (stored) {
        const allTasks: Task[] = JSON.parse(stored);
        const newTasks = allTasks.filter(t => t.id !== taskId);
        localStorage.setItem(`tasks_${tenantId}`, JSON.stringify(newTasks));
        setTasks(newTasks);
      }
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === selectedCustomerId);
    const newTask: Task = {
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

    DataService.saveTask(newTask);
    setTasks(DataService.getTasks(tenantId));
    setShowAddModal(false);
    setTitle('');
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif] pb-16 max-w-7xl mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
            My Tasks
          </h1>
          <p className="text-xs text-[#767587] mt-0.5">
            Manage your daily sales activities, follow-ups, and deliverables.
          </p>
        </div>

        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-2 border-b border-[#E1E1E1]">
          <button
            onClick={() => handleCategoryChange('VISIT')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
              activeCategory === 'VISIT'
                ? 'border-[#4744e5] text-[#4744e5]'
                : 'border-transparent text-[#767587] hover:text-[#1a1c1c]'
            }`}
          >
            Visit Tasks
          </button>
          <button
            onClick={() => handleCategoryChange('PROJECT')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
              activeCategory === 'PROJECT'
                ? 'border-[#4744e5] text-[#4744e5]'
                : 'border-transparent text-[#767587] hover:text-[#1a1c1c]'
            }`}
          >
            Project Tasks
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
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
                  Customer
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
                  Related Visit
                </th>
                <th className="px-5 py-4 font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] text-[10px]">
                  Created By
                </th>
                <th className="px-5 py-4 w-20 text-right font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] text-[10px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f4]">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center text-[#a0a0b0] space-y-2">
                      <span className="material-symbols-outlined text-[48px] opacity-20">inventory_2</span>
                      <p className="text-sm font-medium">No tasks found matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => {
                  const isOverdue = t.dueDate < today && t.status !== 'COMPLETED';
                  const isCompleted = t.status === 'COMPLETED';

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
                          {t.title}
                        </Link>
                        <div className="text-[10px] text-[#767587] font-mono mt-0.5">{t.id}</div>
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[#1a1c1c]">{t.customerName || '-'}</div>
                      </td>

                      {/* Priority */}
                      <td className="px-5 py-4">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${
                            t.priority === 'URGENT' ? 'bg-rose-100 text-rose-700'
                            : t.priority === 'HIGH' ? 'bg-amber-100 text-amber-800'
                            : t.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                            t.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : t.status === 'REVIEW' ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : t.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="px-5 py-4">
                        <div className={`font-semibold ${isOverdue ? 'text-rose-600' : 'text-[#1a1c1c]'}`}>
                          {new Date(t.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        {isOverdue && (
                          <div className="text-[10px] font-bold text-rose-500 mt-0.5 uppercase tracking-wider">Overdue</div>
                        )}
                      </td>

                      {/* Related Visit */}
                      <td className="px-5 py-4 text-[#767587]">
                        -
                      </td>

                      {/* Created By */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <img
                            src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'}
                            alt={currentUser?.name || 'User'}
                            className="w-6 h-6 rounded-full object-cover border border-[#E1E1E1]"
                          />
                          <span className="font-medium text-[#1a1c1c]">{currentUser?.name || 'You'}</span>
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
                            onClick={() => deleteTask(t.id)}
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

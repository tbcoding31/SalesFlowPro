import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Task, Customer } from '../../types';
import { crmApi } from '../../services/crmApi';

export const TeamTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentTenant, currentUser } = useAuth();
  const tenantId = currentTenant?.id ;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tList, cList] = await Promise.all([
        crmApi.fetchCollection<Task>('tasks', tenantId),
        crmApi.fetchCollection<Customer>('customers', tenantId)
      ]);
      setTasks(tList);
      setCustomers(cList);
    } catch (err) {
      console.error('Error loading team tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [picFilter, setPicFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [dueDateFilter, setDueDateFilter] = useState('');
  
  // Selection
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  // Date helpers
  const today = new Date().toISOString().split('T')[0];

  // Calculated Metrics
  const metrics = useMemo(() => {
    let overdue = 0;
    let dueToday = 0;
    let completed = 0;

    tasks.forEach((t) => {
      if (t.status === 'COMPLETED') {
        completed++;
      } else {
        if (t.dueDate < today) overdue++;
        if (t.dueDate === today) dueToday++;
      }
    });

    return { total: tasks.length, overdue, dueToday, completed };
  }, [tasks, today]);

  // Unique PICs for filter
  const uniquePics = useMemo(() => {
    const pics = new Map();
    tasks.forEach(t => {
      if (!pics.has(t.picId)) {
        pics.set(t.picId, { id: t.picId, name: t.picName, avatar: t.picAvatar });
      }
    });
    return Array.from(pics.values());
  }, [tasks]);

  // Filtering Logic
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (searchQuery && !(t.title || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (picFilter !== 'ALL' && t.picId !== picFilter) return false;
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      if (customerFilter !== 'ALL' && t.customerId !== customerFilter) return false;
      if (dueDateFilter && t.dueDate !== dueDateFilter) return false;
      return true;
    });
  }, [tasks, searchQuery, picFilter, statusFilter, priorityFilter, customerFilter, dueDateFilter]);

  const toggleTaskSelection = (id: string) => {
    const next = new Set(selectedTasks);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedTasks(next);
  };

  const toggleAll = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const handleBulkAssign = () => {
    alert(`Assigning ${selectedTasks.size} tasks to new PIC...`);
    setSelectedTasks(new Set());
  };

  const handleBulkPriority = () => {
    alert(`Changing priority for ${selectedTasks.size} tasks...`);
    setSelectedTasks(new Set());
  };

  const handleBulkStatus = () => {
    alert(`Changing status for ${selectedTasks.size} tasks...`);
    setSelectedTasks(new Set());
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif] pb-16 max-w-7xl mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
            Team Tasks
          </h1>
          <p className="text-xs text-[#767587] mt-0.5">
            Monitor and manage tasks across the sales team.
          </p>
        </div>

        <button
          onClick={() => alert("Viewing team workload...")}
          className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[#4744e5] text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 font-['Hanken_Grotesk'] shrink-0 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">bar_chart</span>
          <span>View Team Workload</span>
        </button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-2xs flex flex-col justify-between">
          <div className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider font-['Hanken_Grotesk'] mb-2">
            Completed
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">{metrics.completed}</div>
        </div>
      </div>

      {/* BULK ACTIONS (Conditional) */}
      {selectedTasks.size > 0 && (
        <div className="bg-[#1a1c1c] p-3 rounded-2xl shadow-lg flex items-center justify-between text-white animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3 px-2">
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              {selectedTasks.size}
            </span>
            <span className="text-sm font-bold font-['Hanken_Grotesk']">
              Tasks Selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleBulkAssign} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors">
              Assign PIC
            </button>
            <button onClick={handleBulkPriority} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors">
              Change Priority
            </button>
            <button onClick={handleBulkStatus} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors">
              Change Status
            </button>
            <div className="w-px h-5 bg-white/20 mx-1" />
            <button onClick={() => setSelectedTasks(new Set())} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Clear selection">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* FILTERS TOOLBAR */}
      <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a0b0] text-[16px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[#E1E1E1] rounded-xl text-xs font-medium focus:outline-none focus:border-[#4744e5]"
            />
          </div>

          {/* PIC */}
          <div>
            <select
              value={picFilter}
              onChange={(e) => setPicFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs font-medium bg-white focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All PICs</option>
              {uniquePics.map(pic => (
                <option key={pic.id} value={pic.id}>{pic.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs font-medium bg-white focus:outline-none focus:border-[#4744e5]"
            >
              <option value="ALL">All Status</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="REVIEW">Review</option>
              <option value="COMPLETED">Completed</option>
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
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
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
                <th className="px-5 py-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredTasks.length > 0 && selectedTasks.size === filteredTasks.length}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded text-[#4744e5] border-[#E1E1E1] focus:ring-[#4744e5] cursor-pointer"
                  />
                </th>
                <th className="px-5 py-4 font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] text-[10px]">
                  Task
                </th>
                <th className="px-5 py-4 font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] text-[10px]">
                  Customer
                </th>
                <th className="px-5 py-4 font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] text-[10px] w-48">
                  PIC
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
                      <span className="material-symbols-outlined text-[48px] opacity-20">group</span>
                      <p className="text-sm font-medium">No team tasks found matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => {
                  const isOverdue = t.dueDate < today && t.status !== 'COMPLETED';
                  const isCompleted = t.status === 'COMPLETED';
                  const isSelected = selectedTasks.has(t.id);

                  return (
                    <tr 
                      key={t.id} 
                      className={`transition-colors group ${
                        isSelected ? 'bg-indigo-50/50' : 
                        isCompleted ? 'bg-slate-50/50' : 'hover:bg-[#fcfcfd]'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-5 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTaskSelection(t.id)}
                          className="w-4 h-4 rounded text-[#4744e5] border-[#E1E1E1] focus:ring-[#4744e5] cursor-pointer"
                        />
                      </td>

                      {/* Task */}
                      <td className="px-5 py-4">
                        <Link to={`/tasks/${t.id}`} className={`font-semibold hover:text-[#4744e5] hover:underline transition-colors ${isCompleted ? 'text-[#a0a0b0]' : 'text-[#1a1c1c]'}`}>
                          {t.title}
                        </Link>
                        <div className="text-[10px] text-[#767587] font-mono mt-0.5">{t.id}</div>
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[#1a1c1c]">{t.customerName || '-'}</div>
                      </td>

                      {/* PIC (Prominent) */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 w-fit">
                          <img
                            src={t.picAvatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'}
                            alt={t.picName}
                            className="w-6 h-6 rounded-full object-cover shadow-sm"
                          />
                          <span className="font-bold text-[#1a1c1c] text-[11px] font-['Hanken_Grotesk'] tracking-wide">
                            {t.picName}
                          </span>
                        </div>
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
                          {(t.status || 'TODO').replace('_', ' ')}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="px-5 py-4">
                        <div className={`font-semibold ${isOverdue ? 'text-rose-600' : 'text-[#1a1c1c]'}`}>
                          {t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </div>
                        {isOverdue && (
                          <div className="text-[10px] font-bold text-rose-500 mt-0.5 uppercase tracking-wider">Overdue</div>
                        )}
                      </td>

                      {/* Created By */}
                      <td className="px-5 py-4 text-[#767587]">
                        {currentUser?.name || 'System'}
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
    </div>
  );
};

export default TeamTasksPage;

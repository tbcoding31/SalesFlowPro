import React, { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { Task, Customer, TaskStatus, Project } from '../../types';
import { crmApi } from '../../services/crmApi';

export const TaskBoardPage: React.FC = () => {
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
      console.error('Error loading task board data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
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

  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [picFilter, setPicFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [dueDateFilter, setDueDateFilter] = useState('');

  // Extract unique PICs from tasks
  const uniquePics = useMemo(() => {
    const pics = new Map();
    tasks.forEach(t => {
      if (!pics.has(t.picId)) {
        pics.set(t.picId, { id: t.picId, name: t.picName, avatar: t.picAvatar });
      }
    });
    return Array.from(pics.values());
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Category logic: VISIT vs PROJECT
      if (activeCategory === 'VISIT') {
        if (!t.relatedVisitId && t.taskType !== 'Visit') return false;
      } else if (activeCategory === 'PROJECT') {
        if (!t.relatedProjectId && t.taskType !== 'Project') return false;
        if (activeProject !== 'ALL' && t.relatedProjectId !== activeProject) return false;
      }

      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (customerFilter !== 'ALL' && t.customerId !== customerFilter) return false;
      if (picFilter !== 'ALL' && t.picId !== picFilter) return false;
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      if (dueDateFilter && t.dueDate !== dueDateFilter) return false;
      return true;
    });
  }, [tasks, searchQuery, customerFilter, picFilter, priorityFilter, dueDateFilter, activeCategory, activeProject]);

  // Group tasks into columns
  const columns: { id: TaskStatus; title: string }[] = [
    { id: 'TODO', title: 'TODO' },
    { id: 'IN_PROGRESS', title: 'IN PROGRESS' },
    { id: 'REVIEW', title: 'REVIEW' },
    { id: 'COMPLETED', title: 'COMPLETED' },
  ];

  const tasksByStatus = useMemo(() => {
    const grouped = {
      TODO: [] as Task[],
      IN_PROGRESS: [] as Task[],
      REVIEW: [] as Task[],
      COMPLETED: [] as Task[],
    };
    filteredTasks.forEach(t => {
      if (grouped[t.status as keyof typeof grouped]) {
        grouped[t.status as keyof typeof grouped].push(t);
      } else if (t.status === 'CANCELLED') {
        // Optionally handle cancelled, but board doesn't show it based on requirements
      }
    });
    return grouped;
  }, [filteredTasks]);

  // Drag and Drop State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    
    // Create a ghost image if desired, or just let default happen
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const taskToMove = tasks.find(t => t.id === taskId);
    if (taskToMove && taskToMove.status !== newStatus) {
      const oldStatus = taskToMove.status;
      const updatedTask = { ...taskToMove, status: newStatus };
      
      // Update locally
      const updatedTasks = tasks.map(t => t.id === taskId ? updatedTask : t);
      setTasks(updatedTasks);
      
      // Save to database via API
      crmApi.updateRecord('tasks', updatedTask.id, { status: newStatus, statusId: newStatus }).then(res => {
        if (!res.success) {
          console.error('Failed to update task status in DB:', res.error);
          loadData(); // Revert on failure
        }
      });
      
      // Add Activity to database
      crmApi.createRecord('activities', {
        id: `ACT-${Date.now()}`,
        tenantId,
        customerId: updatedTask.customerId,
        userId: currentUser?.id || 'SYSTEM',
        type: 'TASK',
        subject: 'Task Status Updated',
        description: `Moved task "${updatedTask.title}" from ${oldStatus.replace('_', ' ')} to ${newStatus.replace('_', ' ')}`
      });
    }
    setDraggedTaskId(null);
  };

  const handleAddTask = (status: TaskStatus) => {
    // We could pass the initial status if we support query params, 
    // for now we just navigate to the new task page.
    navigate('/tasks/new');
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif] h-full flex flex-col max-w-[1600px] mx-auto pb-6">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
            Task Board
          </h1>
          <p className="text-xs text-[#767587] mt-0.5">
            Visualize and manage tasks across your team workflow.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-[#f3f3f3] p-1 rounded-xl">
            <button 
              onClick={() => navigate('/tasks' + location.search)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 text-[#767587] hover:text-[#1a1c1c] hover:bg-[#e1e1e1] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">list</span>
              List
            </button>
            <button 
              className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-white shadow-sm text-[#4744e5]"
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
      <div className="space-y-4 shrink-0">
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

      {/* FILTERS TOOLBAR */}
      <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs p-4 shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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

          {/* Due Date */}
          <div>
            <input
              type="date"
              value={dueDateFilter}
              onChange={(e) => setDueDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[#E1E1E1] rounded-xl text-xs font-medium bg-white focus:outline-none focus:border-[#4744e5]"
            />
          </div>
          
          {/* Search (Extra) */}
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
        </div>
      </div>

      {/* KANBAN BOARD */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex gap-6 h-full items-start w-max px-1">
          {columns.map((col) => {
            const colTasks = tasksByStatus[col.id as keyof typeof tasksByStatus] || [];
            return (
              <div
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
                className="w-80 h-full flex flex-col bg-slate-50/50 rounded-2xl border border-slate-200/60"
              >
                {/* Column Header */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200/60 bg-slate-100/50 rounded-t-2xl">
                  <h3 className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-wide">
                    {col.title}
                  </h3>
                  <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-500">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Body (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar min-h-[400px]">
                  {colTasks.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, t.id)}
                      className={`bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing group ${
                        draggedTaskId === t.id ? 'opacity-50 border-indigo-400' : ''
                      }`}
                    >
                      {/* Priority Tag */}
                      <div className="flex items-start justify-between mb-2">
                        <span
                          className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md ${
                            t.priority === 'URGENT' ? 'bg-rose-100 text-rose-700'
                            : t.priority === 'HIGH' ? 'bg-amber-100 text-amber-800'
                            : t.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {t.priority}
                        </span>
                        
                        {/* More options mock */}
                        <button className="text-slate-400 hover:text-[#4744e5] transition-colors">
                          <span className="material-symbols-outlined text-[16px]">more_horiz</span>
                        </button>
                      </div>

                      {/* Title */}
                      <Link to={`/tasks/${t.id}`} className="block text-sm font-bold text-[#1a1c1c] leading-tight mb-1 hover:text-[#4744e5] hover:underline transition-colors">
                        {t.title}
                      </Link>
                      
                      {/* Customer */}
                      {t.customerName && (
                        <div className="text-xs font-medium text-[#767587] mb-3 truncate">
                          {t.customerName}
                        </div>
                      )}

                      {/* Related (Optional) */}
                      {t.relatedVisitId && (
                        <div className="flex items-center gap-1.5 text-[10px] text-[#767587] bg-slate-50 px-2 py-1 rounded-md mb-3 w-fit border border-slate-100">
                          <span className="material-symbols-outlined text-[12px]">store</span>
                          <span className="truncate max-w-[150px]">Visit — Product Presentation</span>
                        </div>
                      )}

                      {/* Footer: Date & Avatar */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 text-[#767587]">
                          <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                          <span className={`text-[10px] font-semibold ${
                            t.dueDate < new Date().toISOString().split('T')[0] && t.status !== 'COMPLETED' ? 'text-rose-600' : ''
                          }`}>
                            {new Date(t.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        
                        {/* PIC Avatar */}
                        {t.picAvatar && (
                          <div className="flex items-center gap-1.5" title={t.picName}>
                            <span className="text-[10px] font-medium text-[#767587] hidden group-hover:block transition-all">
                              {t.picName.split(' ')[0]}
                            </span>
                            <img
                              src={t.picAvatar}
                              alt={t.picName}
                              className="w-6 h-6 rounded-full object-cover border border-white shadow-sm ring-1 ring-slate-100"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {colTasks.length === 0 && (
                    <div className="h-24 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-medium">
                      Drop tasks here
                    </div>
                  )}
                </div>

                {/* Column Footer */}
                <div className="p-3 border-t border-slate-200/60 bg-slate-50 rounded-b-2xl">
                  <button 
                    onClick={() => handleAddTask(col.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-slate-500 hover:text-[#4744e5] hover:bg-white rounded-lg text-xs font-bold transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Add Task
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default TaskBoardPage;

import React, { useState, useEffect } from 'react';
import { crmApi } from '../../../services/crmApi';
import type { Task, TaskPriority, TaskStatus, PaginatedResponse, User } from '../../../types';

interface CustomerTasksTabProps {
  customerId: string;
  tenantUsers: User[];
  projects: any[];
}

export function CustomerTasksTab({ customerId, tenantUsers, projects: _ignoredProjects }: CustomerTasksTabProps) {
    const [localProjects, setLocalProjects] = useState<any[]>([]);
  useEffect(() => {
    crmApi.fetchCustomerProjects(customerId).then(setLocalProjects).catch(() => {});
  }, [customerId]);

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [tasksResponse, setTasksResponse] = useState<PaginatedResponse<Task> | null>(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<any>('HIGH');
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskPicId, setTaskPicId] = useState('');
  const [taskRelatedOppId, setTaskRelatedOppId] = useState('');

  const [creatingTask, setCreatingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [reassigningTask, setReassigningTask] = useState<Task | null>(null);

  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDescription, setEditTaskDescription] = useState('');
  const [editTaskPriority, setEditTaskPriority] = useState<any>('HIGH');
  const [editTaskStatus, setEditTaskStatus] = useState<any>('TODO');
  const [editTaskDueDate, setEditTaskDueDate] = useState('');
  const [editTaskRelatedOppId, setEditTaskRelatedOppId] = useState('');
  const [reassignTaskPicId, setReassignTaskPicId] = useState('');

  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('ALL');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('ALL');
  const [taskPicFilter, setTaskPicFilter] = useState('ALL');
  const [taskDueDateFilter, setTaskDueDateFilter] = useState('');
  const [taskOppFilter, setTaskOppFilter] = useState('ALL');

    const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasksData = async () => {
    try {
      if (!customerId) return;
      setIsLoading(true);
      setError(null);
      const res = await crmApi.fetchTasks({ 
        customerId, 
        page, 
        pageSize,
        search: taskSearch,
        status: taskStatusFilter,
        priority: taskPriorityFilter,
        picId: taskPicFilter,
        dueDate: taskDueDateFilter,
        projectId: taskOppFilter
      });
      setTasksResponse(res);
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      setError(err.message || 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasksData();
  }, [customerId, page, taskSearch, taskStatusFilter, taskPriorityFilter, taskPicFilter, taskDueDateFilter, taskOppFilter]);

  const tasksList = tasksResponse?.data || [];
  const tasksTotalItems = tasksResponse?.pagination.totalItems || 0;
  const tasksTotalPages = tasksResponse?.pagination.totalPages || 1;

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle || !taskPicId) return;

    const newTask = {
      customerId,
      title: taskTitle,
      description: taskDescription,
      priority: taskPriority,
      status: 'TODO',
      dueDate: taskDueDate,
      picId: taskPicId,
      relatedProjectId: taskRelatedOppId || null,
    };

    try {
      await crmApi.createRecord('tasks', newTask);
      setCreatingTask(false);
      
      setTaskTitle('');
      setTaskDescription('');
      setTaskPriority('HIGH');
      setTaskDueDate(new Date().toISOString().split('T')[0]);
      setTaskPicId('');
      setTaskRelatedOppId('');
      
      fetchTasksData();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTaskTitle) return;

    const updated = {
      ...editingTask,
      title: editTaskTitle,
      description: editTaskDescription,
      priority: editTaskPriority,
      status: editTaskStatus,
      dueDate: editTaskDueDate,
      relatedProjectId: editTaskRelatedOppId || null,
    };

    try {
      await crmApi.updateRecord('tasks', editingTask.id, updated);
      setEditingTask(null);
      fetchTasksData();
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleToggleCompleteTask = async (t: Task) => {
    const isCompleted = t.status === 'COMPLETED' || t.status === 'COMPLETED';
    const updatedStatus = isCompleted ? 'TODO' : 'COMPLETED';
    const updated = {
      ...t,
      status: updatedStatus,
      completedAt: isCompleted ? undefined : new Date().toISOString().split('T')[0],
    };
    try {
      await crmApi.updateRecord('tasks', t.id, updated);
      fetchTasksData();
    } catch (error) {
      console.error('Failed to toggle task completion:', error);
    }
  };

  const handleReassignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassigningTask || !reassignTaskPicId) return;

    const updated = {
      ...reassigningTask,
      picId: reassignTaskPicId,
    };
    try {
      await crmApi.updateRecord('tasks', reassigningTask.id, updated);
      setReassigningTask(null);
      fetchTasksData();
    } catch (error) {
      console.error('Failed to reassign task:', error);
    }
  };

  const openEditTaskModal = (t: Task) => {
    setEditingTask(t);
    setEditTaskTitle(t.title);
    setEditTaskDescription(t.description || '');
    setEditTaskPriority(t.priority || 'HIGH');
    setEditTaskStatus(t.status || 'TODO');
    setEditTaskDueDate(t.dueDate || '');
    setEditTaskRelatedOppId(t.relatedProjectId || '');
  };

  const openReassignTaskModal = (t: Task) => {
    setReassigningTask(t);
    setReassignTaskPicId(t.picId || '');
  };

  return (
    <div className="space-y-4">
      {error && (
  <div className="mb-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex justify-between items-center">
    <div>
      <h3 className="font-bold">Error Loading Tasks</h3>
      <p className="text-sm">{error}</p>
    </div>
    <button onClick={fetchTasksData} className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded font-medium text-sm">Retry</button>
  </div>
)}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#1a1c1c]">Tasks</h2>
          <p className="text-sm text-[#767587]">Manage actionable items and to-dos.</p>
        </div>
        <button
          onClick={() => setCreatingTask(true)}
          className="px-4 py-2 bg-[#1a1c1c] text-white rounded-lg text-sm font-bold shadow-xs hover:bg-[#2d3131]"
        >
          + Add Task
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-50 p-3 rounded-lg border border-[#E1E1E1] space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2 text-[#767587] text-lg">search</span>
              <input
                type="text"
                placeholder="Search tasks..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs bg-white"
              />
            </div>
          </div>
          <select
            value={taskStatusFilter}
            onChange={(e) => setTaskStatusFilter(e.target.value)}
            className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded-lg bg-white text-xs text-[#1a1c1c]"
          >
            <option value="ALL">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="WAITING">Waiting</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={taskPriorityFilter}
            onChange={(e) => setTaskPriorityFilter(e.target.value)}
            className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded-lg bg-white text-xs text-[#1a1c1c]"
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select
            value={taskPicFilter}
            onChange={(e) => setTaskPicFilter(e.target.value)}
            className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded-lg bg-white text-xs text-[#1a1c1c]"
          >
            <option value="ALL">All PICs</option>
            {tenantUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select
            value={taskOppFilter}
            onChange={(e) => setTaskOppFilter(e.target.value)}
            className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded-lg bg-white text-xs text-[#1a1c1c]"
          >
            <option value="ALL">All Projects</option>
            <option value="NONE">Unassigned</option>
            {localProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name || p.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {error ? null : isLoading ? (
  <div className="flex justify-center items-center py-12 text-[#767587]">
    <span className="material-symbols-outlined animate-spin text-3xl">sync</span>
  </div>
) : tasksList.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-lg border border-[#E1E1E1] border-dashed">
            <span className="material-symbols-outlined text-4xl text-[#767587] mb-2">task</span>
            <h3 className="text-sm font-bold text-[#1a1c1c]">No Tasks Found</h3>
            <p className="text-xs text-[#767587] mt-1">Create a new task to get started.</p>
          </div>
        ) : (
          tasksList.map(t => {
            const isCompleted = t.status === 'COMPLETED' || t.status === 'COMPLETED';
            const isOverdue = t.dueDate && t.dueDate < new Date().toISOString().split('T')[0] && !isCompleted && (t.status || t.status) !== 'CANCELLED';
            
            let statusColor = 'bg-slate-100 text-slate-700';
            const sId = t.status || t.status;
            if (isCompleted) statusColor = 'bg-green-100 text-green-700';
            else if (sId === 'IN_PROGRESS') statusColor = 'bg-blue-100 text-blue-700';
            else if (sId === 'WAITING') statusColor = 'bg-amber-100 text-amber-700';
            else if (sId === 'CANCELLED') statusColor = 'bg-red-100 text-red-700';
            else if (isOverdue) statusColor = 'bg-red-100 text-red-700 font-bold border border-red-200';

            const pColor = t.priority === 'HIGH' ? 'text-red-600 bg-red-50' : t.priority === 'MEDIUM' ? 'text-amber-600 bg-amber-50' : 'text-slate-600 bg-slate-50';

            return (
              <div key={t.id} className={`bg-white rounded-lg border ${isOverdue ? 'border-red-200 shadow-sm shadow-red-100' : 'border-[#E1E1E1]'} p-4 flex flex-col sm:flex-row gap-4 hover:border-[#1a1c1c] transition-colors`}>
                <div className="pt-1">
                  <button 
                    onClick={() => handleToggleCompleteTask(t)}
                    className={`w-5 h-5 rounded border flex items-center justify-center ${isCompleted ? 'bg-[#1a1c1c] border-[#1a1c1c] text-white' : 'border-[#C4C3D0] hover:border-[#1a1c1c] bg-white'}`}
                  >
                    {isCompleted && <span className="material-symbols-outlined text-[14px]">check</span>}
                  </button>
                </div>
                
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className={`text-sm font-bold ${isCompleted ? 'text-[#767587] line-through' : 'text-[#1a1c1c]'}`}>{t.title}</h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${statusColor}`}>
                      {isOverdue && !isCompleted ? 'OVERDUE' : (t.status || t.status)}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${pColor}`}>
                      {t.priority}
                    </span>
                  </div>
                  
                  {t.description && (
                    <p className="text-xs text-[#767587] mb-3 line-clamp-2">{t.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[#767587]">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                      <span className={isOverdue ? 'text-red-600 font-bold' : ''}>{t.dueDate}</span>
                    </div>
                    {t.picName && (
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">person</span>
                        {t.picName}
                      </div>
                    )}
                    {t.relatedProjectId && (
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">work</span>
                        {localProjects.find(p => p.id === t.relatedProjectId)?.name || 'Project'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:self-start">
                  <button onClick={() => setViewingTask(t)} className="p-1.5 text-[#767587] hover:text-[#1a1c1c] hover:bg-slate-100 rounded" title="View Details">
                    <span className="material-symbols-outlined text-sm">visibility</span>
                  </button>
                  <button onClick={() => openEditTaskModal(t)} className="p-1.5 text-[#767587] hover:text-[#1a1c1c] hover:bg-slate-100 rounded" title="Edit">
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button onClick={() => openReassignTaskModal(t)} className="p-1.5 text-[#767587] hover:text-[#1a1c1c] hover:bg-slate-100 rounded" title="Reassign">
                    <span className="material-symbols-outlined text-sm">manage_accounts</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {tasksTotalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#E1E1E1] pt-4">
          <div className="text-xs text-[#767587]">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, tasksTotalItems)} of {tasksTotalItems} tasks
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 text-[#767587] hover:text-[#1a1c1c] disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">chevron_left</span>
            </button>
            <span className="text-xs font-bold text-[#1a1c1c]">Page {page} of {tasksTotalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(tasksTotalPages, p + 1))}
              disabled={page === tasksTotalPages}
              className="p-1 text-[#767587] hover:text-[#1a1c1c] disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">chevron_right</span>
            </button>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {creatingTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c]">New Task</h2>
              <button onClick={() => setCreatingTask(false)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Title *</label>
                <input type="text" required value={taskTitle} onChange={e => setTaskTitle(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg" />
              </div>
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Description</label>
                <textarea rows={3} value={taskDescription} onChange={e => setTaskDescription(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Due Date *</label>
                  <input type="date" required value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg" />
                </div>
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Priority *</label>
                  <select value={taskPriority} onChange={e => setTaskPriority(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg">
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Assignee (PIC) *</label>
                  <select required value={taskPicId} onChange={e => setTaskPicId(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg">
                    <option value="">Select PIC...</option>
                    {tenantUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Related Project</label>
                  <select value={taskRelatedOppId} onChange={e => setTaskRelatedOppId(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg">
                    <option value="">None</option>
                    {localProjects.map(p => <option key={p.id} value={p.id}>{p.name || p.title}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setCreatingTask(false)} className="px-4 py-2 border rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[#1a1c1c] text-white font-bold rounded-lg">Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c]">Edit Task</h2>
              <button onClick={() => setEditingTask(null)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleUpdateTask} className="space-y-4">
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Title *</label>
                <input type="text" required value={editTaskTitle} onChange={e => setEditTaskTitle(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg" />
              </div>
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Description</label>
                <textarea rows={3} value={editTaskDescription} onChange={e => setEditTaskDescription(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Due Date *</label>
                  <input type="date" required value={editTaskDueDate} onChange={e => setEditTaskDueDate(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg" />
                </div>
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Status *</label>
                  <select value={editTaskStatus} onChange={e => setEditTaskStatus(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg">
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="WAITING">Waiting</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Priority *</label>
                  <select value={editTaskPriority} onChange={e => setEditTaskPriority(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg">
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Related Project</label>
                  <select value={editTaskRelatedOppId} onChange={e => setEditTaskRelatedOppId(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg">
                    <option value="">None</option>
                    {localProjects.map(p => <option key={p.id} value={p.id}>{p.name || p.title}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setEditingTask(null)} className="px-4 py-2 border rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[#1a1c1c] text-white font-bold rounded-lg">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing Task Modal */}
      {viewingTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c]">Task Details</h2>
              <button onClick={() => setViewingTask(null)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-[#1a1c1c]">Title</h3>
                <p>{viewingTask.title}</p>
              </div>
              <div>
                <h3 className="font-bold text-[#1a1c1c]">Description</h3>
                <p>{viewingTask.description || 'No description'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-bold text-[#1a1c1c]">Status</h3>
                  <p>{viewingTask.status || viewingTask.status}</p>
                </div>
                <div>
                  <h3 className="font-bold text-[#1a1c1c]">Priority</h3>
                  <p>{viewingTask.priority}</p>
                </div>
                <div>
                  <h3 className="font-bold text-[#1a1c1c]">Due Date</h3>
                  <p>{viewingTask.dueDate}</p>
                </div>
                <div>
                  <h3 className="font-bold text-[#1a1c1c]">Assignee</h3>
                  <p>{viewingTask.picName || 'Unassigned'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Task Modal */}
      {reassigningTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c]">Reassign Task</h2>
              <button onClick={() => setReassigningTask(null)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleReassignTask} className="space-y-4">
              <div className="p-3 bg-slate-50 border rounded-lg">
                <div className="font-bold text-[#1a1c1c]">{reassigningTask.title}</div>
                <div className="text-slate-500 mt-1">Currently assigned to: {reassigningTask.picName || 'Unassigned'}</div>
              </div>
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">New Assignee *</label>
                <select required value={reassignTaskPicId} onChange={e => setReassignTaskPicId(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg">
                  <option value="">Select new PIC...</option>
                  {tenantUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setReassigningTask(null)} className="px-4 py-2 border rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[#1a1c1c] text-white font-bold rounded-lg">Reassign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

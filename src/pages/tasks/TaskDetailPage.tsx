import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { Task, Activity, User } from '../../types';
import { crmApi } from '../../services/crmApi';
import { usersApi } from '../../services/usersApi';

export const TaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant, currentUser } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';

  const [task, setTask] = useState<Task | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [comment, setComment] = useState('');

  // Reassign Modal State
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [picSearch, setPicSearch] = useState('');
  const [newPicId, setNewPicId] = useState<string>('');
  
  const [users, setUsers] = useState<User[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);

  const today = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    if (!id) return;
    const [taskData, taskList, userList, allActs] = await Promise.all([
      crmApi.fetchRecordById<Task>('tasks', id),
      crmApi.fetchCollection<Task>('tasks', tenantId),
      usersApi.fetchUsers(tenantId),
      crmApi.fetchCollection<Activity>('activities', tenantId)
    ]);
    if (taskData) setTask(taskData);
    setAllTasks(taskList);
    setUsers(userList);
    setActivities(allActs.filter(a => a.entityType === 'TASK' && a.entityId === id));
  };

  useEffect(() => {
    loadData();
  }, [id, tenantId]);

  const enrichedUsers = useMemo(() => {
    return users.map(user => {
      const userTasks = allTasks.filter(t => t.picId === user.id && t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
      const overdueTasks = userTasks.filter(t => t.dueDate < today);
      const activeCount = userTasks.length;
      const overdueCount = overdueTasks.length;
      
      let workload = 'Normal';
      let workloadColor = 'text-emerald-600 bg-emerald-50 border-emerald-200';
      if (activeCount > 8) {
        workload = 'High';
        workloadColor = 'text-rose-600 bg-rose-50 border-rose-200';
      } else if (activeCount > 4) {
        workload = 'Medium';
        workloadColor = 'text-amber-600 bg-amber-50 border-amber-200';
      }

      return {
        ...user,
        activeTasks: activeCount,
        overdueTasks: overdueCount,
        workload,
        workloadColor
      };
    });
  }, [users, allTasks, today]);

  const filteredUsers = useMemo(() => {
    if (!picSearch) return enrichedUsers;
    const lower = picSearch.toLowerCase();
    return enrichedUsers.filter(u => u.name.toLowerCase().includes(lower) || (u.role && u.role.toLowerCase().includes(lower)));
  }, [enrichedUsers, picSearch]);

  const currentPic = enrichedUsers.find(u => u.id === task?.picId);
  const selectedNewPic = enrichedUsers.find(u => u.id === newPicId);

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">assignment_late</span>
        <h2 className="text-lg font-bold text-slate-700">Task Not Found</h2>
        <p className="text-sm text-slate-500 mb-4">The task you are looking for does not exist or you do not have permission to view it.</p>
        <button onClick={() => navigate('/tasks')} className="px-4 py-2 bg-[#4744e5] text-white rounded-lg text-sm font-semibold">
          Back to Tasks
        </button>
      </div>
    );
  }

  const handleReassign = async () => {
    if (!newPicId || !selectedNewPic || !task) return;

    const oldPicName = task.picName;

    await crmApi.updateRecord('tasks', task.id, {
      picId: selectedNewPic.id
    });

    await crmApi.createRecord('activities', {
      tenantId,
      customerId: task.customerId,
      userId: currentUser?.id || 'SYSTEM',
      typeId: 'TASK',
      subject: 'PIC Reassigned',
      description: `Reassigned task from ${oldPicName || 'previous PIC'} to ${selectedNewPic.name}`,
      entityType: 'TASK',
      entityId: task.id
    });

    setShowReassignModal(false);
    setNewPicId('');
    setPicSearch('');
    loadData();
  };

  const handleComplete = async () => {
    await crmApi.updateRecord('tasks', task.id, {
      statusId: 'COMPLETED',
      status: 'COMPLETED',
      completedAt: new Date().toISOString()
    });
    
    await crmApi.createRecord('activities', {
      tenantId,
      customerId: task.customerId,
      userId: currentUser?.id || 'SYSTEM',
      typeId: 'TASK',
      subject: 'Task Completed',
      description: `Marked task "${task.title}" as completed`,
      entityType: 'TASK',
      entityId: task.id
    });
    
    loadData();
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    
    await crmApi.createRecord('activities', {
      tenantId,
      customerId: task.customerId,
      userId: currentUser?.id || 'SYSTEM',
      typeId: 'NOTE',
      subject: 'Comment Added',
      description: comment,
      entityType: 'TASK',
      entityId: task.id
    });
    
    setComment('');
    loadData();
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif] h-full flex flex-col max-w-[1200px] mx-auto pb-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <nav className="flex items-center text-xs text-[#767587] mb-2 font-medium">
            <Link to="/tasks" className="hover:text-[#4744e5] transition-colors">Tasks</Link>
            <span className="mx-2">/</span>
            <span className="text-[#1a1c1c] truncate max-w-[200px] sm:max-w-[300px]">{task.title}</span>
          </nav>
          <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
            {task.title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/tasks/${task.id}/edit`)} className="px-4 py-2 bg-white border border-[#E1E1E1] text-[#464555] rounded-xl text-xs font-bold hover:bg-[#f3f3f3] transition-colors flex items-center gap-2 cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">edit</span>
            Edit
          </button>
          
          <button onClick={() => setShowReassignModal(true)} className="px-4 py-2 bg-white border border-[#E1E1E1] text-[#464555] rounded-xl text-xs font-bold hover:bg-[#f3f3f3] transition-colors flex items-center gap-2 cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">assignment_ind</span>
            Reassign PIC
          </button>

          {task.status !== 'COMPLETED' && (
            <button 
              onClick={handleComplete}
              className="px-4 py-2 bg-[#4744e5] text-white rounded-xl text-xs font-bold shadow-md shadow-[#4744e5]/20 hover:bg-[#3b38c6] transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Complete
            </button>
          )}

          <button className="px-3 py-2 bg-white border border-[#E1E1E1] text-[#464555] rounded-xl text-xs font-bold hover:bg-[#f3f3f3] transition-colors flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px]">more_vert</span>
          </button>
        </div>
      </div>

      {/* TWO COLUMN LAYOUT */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* MAIN CONTENT (LEFT) */}
        <div className="flex-1 space-y-6">
          
          {/* Details Card */}
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs overflow-hidden">
            <div className="p-6">
              <h3 className="text-sm font-bold text-[#1a1c1c] mb-4">Description</h3>
              <p className="text-sm text-[#464555] leading-relaxed whitespace-pre-wrap">
                {task.description || 'No description provided for this task.'}
              </p>
            </div>
            
            {(task.customerId || task.relatedVisitId || task.relatedProjectId) && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                {task.customerId && (
                  <div>
                    <span className="text-[10px] font-bold text-[#767587] uppercase tracking-wider block mb-1">Customer</span>
                    <Link to={`/customers/${task.customerId}`} className="text-sm font-medium text-[#4744e5] hover:underline flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">business</span>
                      {task.customerName}
                    </Link>
                  </div>
                )}
                {task.taskType && (
                  <div>
                    <span className="text-[10px] font-bold text-[#767587] uppercase tracking-wider block mb-1">Task Type</span>
                    <div className="text-sm font-medium text-[#1a1c1c] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">label</span>
                      {task.taskType}
                    </div>
                  </div>
                )}
                {task.relatedVisitId && (
                  <div>
                    <span className="text-[10px] font-bold text-[#767587] uppercase tracking-wider block mb-1">Related Visit</span>
                    <Link to={`/visits/${task.relatedVisitId}`} className="text-sm font-medium text-[#4744e5] hover:underline flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">store</span>
                      {task.relatedVisitId}
                    </Link>
                  </div>
                )}
                {task.relatedProjectId && (
                  <div>
                    <span className="text-[10px] font-bold text-[#767587] uppercase tracking-wider block mb-1">Related Project</span>
                    <Link to={`/projects/${task.relatedProjectId}`} className="text-sm font-medium text-[#4744e5] hover:underline flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">monetization_on</span>
                      {task.relatedProjectId}
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs p-6">
            <h3 className="text-sm font-bold text-[#1a1c1c] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#767587]">forum</span>
              Comments
            </h3>
            
            <div className="flex gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                {currentUser?.firstName?.[0] || 'U'}
              </div>
              <div className="flex-1">
                <textarea 
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment or note..."
                  className="w-full px-4 py-3 border border-[#E1E1E1] rounded-xl text-sm focus:outline-none focus:border-[#4744e5] resize-none h-20 bg-slate-50 hover:bg-white transition-colors"
                ></textarea>
                <div className="mt-2 flex justify-end">
                  <button 
                    onClick={handleAddComment}
                    disabled={!comment.trim()}
                    className="px-4 py-1.5 bg-[#1a1c1c] text-white rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black transition-colors"
                  >
                    Post Comment
                  </button>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              {activities.filter(a => a.type === 'NOTE').map((note) => (
                <div key={note.id} className="flex gap-3 pt-4 border-t border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">
                    {note.userName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-[#1a1c1c]">{note.userName}</span>
                      <span className="text-[10px] text-[#767587]">
                        {new Date(note.occurredAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-[#464555]">{note.description}</p>
                  </div>
                </div>
              ))}
              {activities.filter(a => a.type === 'NOTE').length === 0 && (
                <div className="text-center py-4 text-sm text-[#767587]">No comments yet.</div>
              )}
            </div>
          </div>
          
          {/* Activity History */}
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs p-6">
            <h3 className="text-sm font-bold text-[#1a1c1c] mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#767587]">history</span>
              Activity History
            </h3>
            
            <div className="relative pl-4 border-l border-slate-200 space-y-6">
              {activities.filter(a => a.type !== 'NOTE').map((activity) => (
                <div key={activity.id} className="relative">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-white"></div>
                  <div className="mb-0.5">
                    <span className="text-xs font-bold text-[#1a1c1c] mr-1">{activity.subject}</span>
                    <span className="text-xs text-[#464555]">{activity.description}</span>
                  </div>
                  <div className="text-[10px] text-[#767587] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[10px]">schedule</span>
                    {new Date(activity.occurredAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} 
                    <span className="mx-1">•</span> 
                    by {activity.userName}
                  </div>
                </div>
              ))}
              
              {/* Fallback original creation if no activities */}
              <div className="relative">
                <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#4744e5] ring-4 ring-white"></div>
                <div className="mb-0.5">
                  <span className="text-xs font-bold text-[#1a1c1c] mr-1">Task Created</span>
                </div>
                <div className="text-[10px] text-[#767587] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[10px]">schedule</span>
                  {new Date(task.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} 
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT SIDEBAR */}
        <div className="w-full lg:w-[320px] shrink-0 space-y-6">
          
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xs font-extrabold text-[#1a1c1c] uppercase tracking-wider">Properties</h3>
            </div>
            
            <div className="p-5 space-y-5">
              
              {/* STATUS */}
              <div>
                <span className="text-[10px] font-bold text-[#767587] uppercase tracking-wider block mb-2">Status</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border ${
                  task.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : task.status === 'REVIEW' ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : task.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}>
                  <span className="material-symbols-outlined text-[14px]">
                    {task.status === 'COMPLETED' ? 'check_circle' 
                     : task.status === 'REVIEW' ? 'visibility'
                     : task.status === 'IN_PROGRESS' ? 'pending' 
                     : 'radio_button_unchecked'}
                  </span>
                  {(task.status || 'TODO').replace('_', ' ')}
                </span>
              </div>

              {/* PRIORITY */}
              <div>
                <span className="text-[10px] font-bold text-[#767587] uppercase tracking-wider block mb-2">Priority</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border ${
                  task.priority === 'URGENT' ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : task.priority === 'HIGH' ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : task.priority === 'MEDIUM' ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}>
                  <span className="material-symbols-outlined text-[14px]">flag</span>
                  {task.priority}
                </span>
              </div>

              {/* PIC - VISUALLY PROMINENT */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-2">PIC (Person In Charge)</span>
                <div className="flex items-center gap-3">
                  {task.picAvatar ? (
                    <img src={task.picAvatar} alt={task.picName} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-lg shadow-sm">
                      {(task.picName || 'U').charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-bold text-[#1a1c1c]">{task.picName}</div>
                    <div className="text-[10px] text-indigo-600 font-medium cursor-pointer hover:underline">View Profile</div>
                  </div>
                </div>
              </div>

              {/* DUE DATE */}
              <div>
                <span className="text-[10px] font-bold text-[#767587] uppercase tracking-wider block mb-2">Due Date</span>
                <div className="flex items-center gap-2 text-sm font-medium text-[#1a1c1c]">
                  <span className="material-symbols-outlined text-[#767587]">calendar_today</span>
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                </div>
              </div>

              <div className="pt-5 border-t border-slate-100 space-y-4">
                {/* CREATED BY */}
                <div>
                  <span className="text-[10px] font-bold text-[#767587] uppercase tracking-wider block mb-1">Created By</span>
                  <div className="text-xs font-medium text-[#1a1c1c]">Budi Santoso</div>
                </div>

                {/* CREATED DATE */}
                <div>
                  <span className="text-[10px] font-bold text-[#767587] uppercase tracking-wider block mb-1">Created Date</span>
                  <div className="text-xs font-medium text-[#1a1c1c]">
                    {task.createdAt ? new Date(task.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* REASSIGN PIC MODAL */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 font-['Inter',sans-serif]">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <h2 className="text-base font-bold text-[#1a1c1c]">Reassign PIC</h2>
              <button 
                onClick={() => setShowReassignModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-8 bg-slate-50/50">
              
              {/* CURRENT ASSIGNMENT */}
              <div>
                <h3 className="text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-3">Current Assignment</h3>
                {currentPic && (
                  <div className="bg-white border border-[#E1E1E1] rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {currentPic.avatar ? (
                        <img src={currentPic.avatar} alt={currentPic.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
                          {currentPic.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-bold text-[#1a1c1c] leading-tight">{currentPic.name}</div>
                        <div className="text-[10px] text-[#767587]">{currentPic.role.replace('_', ' ')}</div>
                      </div>
                    </div>
                    <div className="flex gap-4 text-right">
                      <div>
                        <div className="text-sm font-bold text-[#1a1c1c] leading-tight">{currentPic.activeTasks}</div>
                        <div className="text-[10px] text-[#767587] font-medium">Active</div>
                      </div>
                      <div className="w-px h-8 bg-slate-200"></div>
                      <div>
                        <div className={`text-sm font-bold leading-tight ${currentPic.overdueTasks > 0 ? 'text-rose-600' : 'text-[#1a1c1c]'}`}>
                          {currentPic.overdueTasks}
                        </div>
                        <div className={`text-[10px] font-medium ${currentPic.overdueTasks > 0 ? 'text-rose-600' : 'text-[#767587]'}`}>Overdue</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SELECT NEW PIC */}
              <div>
                <h3 className="text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-3">Select New PIC</h3>
                
                {/* Search */}
                <div className="relative mb-4">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                  <input
                    type="text"
                    placeholder="Search team members..."
                    value={picSearch}
                    onChange={(e) => setPicSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E1E1E1] rounded-xl text-sm focus:outline-none focus:border-[#4744e5]"
                  />
                </div>

                {/* Users List */}
                <div className="space-y-2">
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-4 text-sm text-[#767587]">No users found matching "{picSearch}".</div>
                  )}
                  {filteredUsers.map(user => (
                    <label 
                      key={user.id}
                      onClick={() => setNewPicId(user.id)}
                      className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border ${
                        newPicId === user.id 
                          ? 'bg-[#4744e5]/5 border-[#4744e5] ring-1 ring-[#4744e5]' 
                          : 'bg-white border-[#E1E1E1] hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          newPicId === user.id ? 'border-[#4744e5]' : 'border-slate-300'
                        }`}>
                          {newPicId === user.id && <div className="w-2 h-2 rounded-full bg-[#4744e5]"></div>}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
                              {user.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-bold text-[#1a1c1c] leading-tight">{user.name}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${user.workloadColor}`}>
                                {user.workload}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#767587]">{user.role.replace('_', ' ')}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-4 text-right pl-4">
                        <div>
                          <div className="text-sm font-bold text-[#1a1c1c] leading-tight">{user.activeTasks}</div>
                          <div className="text-[10px] text-[#767587] font-medium">Active</div>
                        </div>
                        <div className="w-px h-8 bg-slate-200"></div>
                        <div>
                          <div className={`text-sm font-bold leading-tight ${user.overdueTasks > 0 ? 'text-rose-600' : 'text-[#1a1c1c]'}`}>
                            {user.overdueTasks}
                          </div>
                          <div className={`text-[10px] font-medium ${user.overdueTasks > 0 ? 'text-rose-600' : 'text-[#767587]'}`}>Overdue</div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* CONFIRMATION BLOCK */}
              {selectedNewPic && currentPic && selectedNewPic.id !== currentPic.id && (
                <div className="mt-6 p-5 bg-slate-100 rounded-xl border border-slate-200 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <p className="text-sm font-medium text-[#464555] mb-4">
                    Are you sure you want to reassign this task from <strong className="text-[#1a1c1c]">{currentPic.name}</strong> to <strong className="text-[#1a1c1c]">{selectedNewPic.name}</strong>?
                  </p>
                  
                  <div className="flex items-center justify-center gap-8">
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-1">Current</div>
                      <div className="text-sm font-bold text-[#1a1c1c]">{currentPic.name}</div>
                      <div className="text-xs text-[#767587]">{currentPic.activeTasks} tasks</div>
                    </div>
                    
                    <span className="material-symbols-outlined text-[#4744e5] text-[24px]">arrow_forward</span>
                    
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-[#767587] uppercase tracking-wider mb-1">New</div>
                      <div className="text-sm font-bold text-[#1a1c1c]">{selectedNewPic.name}</div>
                      <div className="text-xs text-[#767587]">{selectedNewPic.activeTasks} tasks</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => {
                  setShowReassignModal(false);
                  setNewPicId('');
                  setPicSearch('');
                }}
                className="px-5 py-2.5 text-sm font-bold text-[#464555] bg-white border border-[#E1E1E1] rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReassign}
                disabled={!selectedNewPic || selectedNewPic.id === currentPic?.id}
                className="px-6 py-2.5 text-sm font-bold text-white bg-[#4744e5] rounded-xl shadow-md shadow-[#4744e5]/20 hover:bg-[#3b38c6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Reassign PIC
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { masterDataApi } from '../../services/masterDataApi';
import { User, Customer, Visit, Project, TaskPriority, MasterDataItem } from '../../types';
import { crmApi } from '../../services/crmApi';
import { usersApi } from '../../services/usersApi';

export const CreateTaskPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentTenant, currentUser } = useAuth();
  const tenantId = currentTenant?.id ;

  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [relatedVisitId, setRelatedVisitId] = useState('');
  const [relatedProjectId, setRelatedProjectId] = useState('');
  
  const [picId, setPicId] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [taskTypes, setTaskTypes] = useState<MasterDataItem[]>([]);
  const [taskPriorities, setTaskPriorities] = useState<MasterDataItem[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  
  const [users, setUsers] = useState<User[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);

  const [isPicDropdownOpen, setIsPicDropdownOpen] = useState(false);
  const [picSearch, setPicSearch] = useState('');
  const picDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    crmApi.fetchCollection<Customer>('customers', tenantId).then(setCustomers);
    usersApi.fetchUsers(tenantId).then(setUsers);
    crmApi.fetchCollection('tasks', tenantId).then(setAllTasks);

    masterDataApi.fetchMasterData('task_types', tenantId).then(setTaskTypes);
    masterDataApi.fetchMasterData('task_priorities', tenantId).then(data => {
      setTaskPriorities(data);
      const defaultPri = data.find(d => d.isDefault);
      if (defaultPri) setPriority(defaultPri.codeValue);
      else if (data.length > 0) setPriority(data[0].codeValue);
    });
  }, [tenantId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (picDropdownRef.current && !picDropdownRef.current.contains(event.target as Node)) {
        setIsPicDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter visits and projects based on customer selection
  useEffect(() => {
    if (customerId) {
      Promise.all([
        crmApi.fetchCollection<Visit>('visits', tenantId),
        crmApi.fetchCollection<Project>('projects', tenantId)
      ]).then(([vList, pList]) => {
        setVisits(vList.filter(v => v.customerId === customerId));
        setProjects(pList.filter(p => p.customerId === customerId));
      });
    } else {
      setVisits([]);
      setProjects([]);
    }
    setRelatedVisitId('');
    setRelatedProjectId('');
  }, [customerId, tenantId]);

  const today = new Date().toISOString().split('T')[0];

  const enrichedUsers = useMemo(() => {
    return users.map(user => {
      const userTasks = allTasks.filter(t => t.picId === user.id && t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
      const overdueTasks = userTasks.filter(t => t.dueDate < today);
      const activeCount = userTasks.length;
      const overdueCount = overdueTasks.length;
      
      let workload = 'Low';
      let workloadColor = 'text-emerald-600 bg-emerald-50 border-emerald-200';
      if (activeCount > 8) {
        workload = 'Heavy';
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
    return enrichedUsers.filter(u => u.name.toLowerCase().includes(lower) || u.role.toLowerCase().includes(lower));
  }, [enrichedUsers, picSearch]);

  const selectedPic = enrichedUsers.find(u => u.id === picId);

  const [error, setError] = useState('');

  const handleCreate = (status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' = 'TODO') => {
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }
    if (!picId) {
      setError('Every task must have a responsible PIC.');
      return;
    }

    const selectedCustomer = customers.find(c => c.id === customerId);

    const newTask = {
      id: `TSK-${Date.now()}`,
      tenantId,
      title,
      taskType: taskType || undefined,
      description,
      customerId,
      customerName: selectedCustomer?.name,
      picId: selectedPic!.id,
      picName: selectedPic!.name,
      picAvatar: selectedPic!.avatar,
      priority,
      status,
      dueDate: dueDate || today,
      createdAt: new Date().toISOString(),
      relatedVisitId: relatedVisitId || undefined,
      relatedProjectId: relatedProjectId || undefined,
    };

    crmApi.createRecord('tasks', newTask as any).then((res) => {
      if (res.success) {
        navigate('/tasks');
      } else {
        setError(res.error || 'Failed to create task');
      }
    });
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif] h-full flex flex-col max-w-[1200px] mx-auto pb-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
          Create Task
        </h1>
        <p className="text-xs text-[#767587] mt-0.5">
          Assign new follow-ups and action items.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-600 px-4 py-3 rounded-xl text-sm font-semibold border border-rose-100 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      {/* TWO COLUMN FORM */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* MAIN SECTION (LEFT) */}
        <div className="flex-1 w-full bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-[#1a1c1c]">Task Details</h3>
          </div>
          
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#464555] mb-1.5">Task Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Follow up quotation..."
                className="w-full px-4 py-2.5 border border-[#E1E1E1] rounded-xl text-sm focus:outline-none focus:border-[#4744e5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#464555] mb-1.5">Task Type</label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#E1E1E1] rounded-xl text-sm bg-white focus:outline-none focus:border-[#4744e5]"
              >
                <option value="">-- Select Task Type --</option>
                {taskTypes.map((type) => (
                  <option key={type.id} value={type.label}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#464555] mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide task context or instructions..."
                className="w-full px-4 py-3 border border-[#E1E1E1] rounded-xl text-sm focus:outline-none focus:border-[#4744e5] resize-none h-32"
              ></textarea>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#464555] mb-1.5">Customer (Optional)</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#E1E1E1] rounded-xl text-sm focus:outline-none focus:border-[#4744e5] bg-white"
              >
                <option value="">-- Select Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {customerId && visits.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-[#464555] mb-1.5">Related Visit</label>
                <select
                  value={relatedVisitId}
                  onChange={(e) => setRelatedVisitId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-[#E1E1E1] rounded-xl text-sm focus:outline-none focus:border-[#4744e5] bg-white"
                >
                  <option value="">-- None --</option>
                  {visits.map(v => (
                    <option key={v.id} value={v.id}>{new Date(v.visitDate).toLocaleDateString('en-GB')} - {v.purpose}</option>
                  ))}
                </select>
              </div>
            )}

            {customerId && projects.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-[#464555] mb-1.5">Related Project</label>
                <select
                  value={relatedProjectId}
                  onChange={(e) => setRelatedProjectId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-[#E1E1E1] rounded-xl text-sm focus:outline-none focus:border-[#4744e5] bg-white"
                >
                  <option value="">-- None --</option>
                  {projects.map(o => (
                    <option key={o.id} value={o.id}>{o.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* OWNERSHIP SECTION (RIGHT) */}
        <div className="w-full lg:w-[400px] shrink-0 space-y-6">
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-bold text-[#1a1c1c]">Ownership & Timeline</h3>
            </div>
            
            <div className="p-6 space-y-6">
              
              {/* PIC Selector */}
              <div ref={picDropdownRef} className="relative">
                <label className="block text-xs font-bold text-[#464555] mb-1.5">PIC (Person In Charge) *</label>
                
                <div 
                  className={`w-full px-4 py-2.5 border rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                    !picId ? 'border-rose-300 bg-rose-50' : 'border-[#E1E1E1] bg-white hover:bg-slate-50'
                  }`}
                  onClick={() => setIsPicDropdownOpen(!isPicDropdownOpen)}
                >
                  {selectedPic ? (
                    <div className="flex items-center gap-2">
                      {selectedPic.avatar ? (
                        <img src={selectedPic.avatar} alt={selectedPic.name} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                          {selectedPic.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-semibold text-[#1a1c1c]">{selectedPic.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm font-semibold text-rose-500">Select PIC...</span>
                  )}
                  <span className="material-symbols-outlined text-[18px] text-[#767587]">expand_more</span>
                </div>

                {/* Dropdown body */}
                {isPicDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E1E1E1] shadow-xl rounded-2xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-slate-100 bg-slate-50">
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
                        <input
                          type="text"
                          placeholder="Search users..."
                          value={picSearch}
                          onChange={(e) => setPicSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-[#E1E1E1] rounded-xl text-xs focus:outline-none focus:border-[#4744e5]"
                        />
                      </div>
                    </div>
                    
                    <div className="max-h-72 overflow-y-auto">
                      {filteredUsers.length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-500">No users found.</div>
                      )}
                      {filteredUsers.map(user => (
                        <div 
                          key={user.id}
                          onClick={() => {
                            setPicId(user.id);
                            setIsPicDropdownOpen(false);
                            setPicSearch('');
                            setError('');
                          }}
                          className={`p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${
                            picId === user.id ? 'bg-indigo-50/50' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {user.avatar ? (
                              <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold shrink-0">
                                {user.name.charAt(0)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1">
                                <div className="text-sm font-bold text-[#1a1c1c] truncate">{user.name}</div>
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${user.workloadColor}`}>
                                  {user.workload} Load
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 mb-1.5">{user.role.replace('_', ' ')}</div>
                              <div className="flex gap-3 text-[10px] font-medium">
                                <span className="text-slate-600"><strong className="text-slate-800">{user.activeTasks}</strong> Active</span>
                                {user.overdueTasks > 0 && (
                                  <span className="text-rose-600"><strong className="text-rose-700">{user.overdueTasks}</strong> Overdue</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-bold text-[#464555] mb-1.5">Due Date *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={today}
                  className="w-full px-4 py-2.5 border border-[#E1E1E1] rounded-xl text-sm focus:outline-none focus:border-[#4744e5] bg-white"
                />
              </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-bold text-[#464555] mb-1.5">Priority *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {taskPriorities.map(p => {
                      const pLabel = p.label.toUpperCase();
                      const isUrgent = pLabel.includes('URGENT');
                      const isHigh = pLabel.includes('HIGH');
                      const isMedium = pLabel.includes('MEDIUM');
                      return (
                      <div
                        key={p.code_value}
                        onClick={() => setPriority(p.code_value)}
                        className={`px-3 py-2 border rounded-xl cursor-pointer text-center text-xs font-bold transition-all ${
                          priority === p.code_value 
                            ? (isUrgent ? 'bg-rose-50 border-rose-300 text-rose-700 ring-1 ring-rose-300' 
                               : isHigh ? 'bg-amber-50 border-amber-300 text-amber-700 ring-1 ring-amber-300'
                               : isMedium ? 'bg-blue-50 border-blue-300 text-blue-700 ring-1 ring-blue-300'
                               : 'bg-slate-100 border-slate-300 text-slate-700 ring-1 ring-slate-300')
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {p.label}
                      </div>
                    )})}
                  </div>
                </div>

            </div>
          </div>
        </div>
      </div>

      {/* ACTIONS FOOTER */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#E1E1E1]">
        <button
          onClick={() => navigate('/tasks')}
          className="px-5 py-2.5 text-sm font-bold text-[#464555] bg-white border border-[#E1E1E1] rounded-xl hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => handleCreate('TODO')} // Draft state can be mapped to TODO, or specific logic if needed
          className="px-5 py-2.5 text-sm font-bold text-[#464555] bg-slate-100 border border-transparent rounded-xl hover:bg-slate-200 transition-colors"
        >
          Save Draft
        </button>
        <button
          onClick={() => handleCreate('TODO')}
          className="px-6 py-2.5 text-sm font-bold text-white bg-[#4744e5] rounded-xl shadow-md shadow-[#4744e5]/20 hover:bg-[#3b38c6] transition-colors"
        >
          Create Task
        </button>
      </div>
    </div>
  );
};

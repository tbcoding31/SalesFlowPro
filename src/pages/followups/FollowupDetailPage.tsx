import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FollowUp, FollowUpStatus, Customer, Task, Visit, Project } from '../../types';
import { crmApi } from '../../services/crmApi';

export const FollowupDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id ;

  const [followup, setFollowup] = useState<FollowUp | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [f, cList, tList, vList, pList] = await Promise.all([
        crmApi.fetchRecordById<FollowUp>('follow_ups', id),
        crmApi.fetchCollection<Customer>('customers', tenantId),
        crmApi.fetchCollection<Task>('tasks', tenantId),
        crmApi.fetchCollection<Visit>('visits', tenantId),
        crmApi.fetchCollection<Project>('projects', tenantId),
      ]);
      if (f) setFollowup(f);
      setCustomers(cList);
      setTasks(tList);
      setVisits(vList);
      setProjects(pList);
    } catch (err) {
      console.error('Error loading followup detail:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, tenantId]);

  const handleComplete = async () => {
    if (!followup) return;
    const isCompleted = followup.status === 'COMPLETED';
    const updated = { 
      ...followup, 
      status: (isCompleted ? 'PENDING' : 'COMPLETED') as FollowUpStatus,
      completedAt: isCompleted ? undefined : new Date().toISOString()
    };
    await crmApi.updateRecord('follow_ups', followup.id, updated);
    loadData();
  };

  const customer = useMemo(() => followup ? customers.find(c => c.id === followup.customerId) : undefined, [customers, followup]);
  const relatedTask = useMemo(() => followup ? tasks.find(t => t.id === followup.relatedTaskId) : undefined, [tasks, followup]);
  const relatedVisit = useMemo(() => followup ? visits.find(v => v.id === followup.relatedVisitId) : undefined, [visits, followup]);
  const relatedProject = useMemo(() => followup ? projects.find(o => o.id === followup.relatedProjectId) : undefined, [projects, followup]);

  const today = new Date().toISOString().split('T')[0];
  const derivedStatus = useMemo(() => {
    if (!followup) return 'SCHEDULED';
    if (followup.status !== 'COMPLETED' && followup.status !== 'CANCELLED') {
      if (followup.followUpDate < today) return 'OVERDUE';
      if (followup.followUpDate === today) return 'DUE_TODAY';
      return 'SCHEDULED';
    }
    return followup.status as string;
  }, [followup, today]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DUE_TODAY':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg uppercase tracking-wider border border-amber-200">Due Today</span>;
      case 'OVERDUE':
        return <span className="px-2.5 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-lg uppercase tracking-wider border border-rose-200">Overdue</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg uppercase tracking-wider border border-emerald-200">Completed</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg uppercase tracking-wider border border-slate-200">Cancelled</span>;
      case 'SCHEDULED':
      default:
        return <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg uppercase tracking-wider border border-indigo-200">Scheduled</span>;
    }
  };

  const getTypeStyle = (type: string) => {
    switch(type) {
      case 'CALL': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'EMAIL': return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'MEETING': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'WHATSAPP': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  if (!followup && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-xl font-bold text-slate-800">Follow-up not found</h2>
        <button onClick={() => navigate('/followups')} className="mt-4 text-[#4744e5] hover:underline">
          Back to Follow-ups
        </button>
      </div>
    );
  }

  if (!followup) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="material-symbols-outlined text-4xl text-[#4744e5] animate-spin">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-['Inter',sans-serif] pb-12">
      {/* Back navigation */}
      <button 
        onClick={() => navigate('/followups')}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Follow-ups
      </button>

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-[#E1E1E1] shadow-2xs">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${getTypeStyle(followup.type)}`}>
              {followup.type}
            </span>
            <span className="text-sm font-bold text-slate-400">{followup.id}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
            {followup.title || followup.type}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {followup.status !== 'COMPLETED' && (
            <button
              onClick={handleComplete}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Complete Follow-up
            </button>
          )}
          <button className="px-4 py-2.5 bg-white border border-[#E1E1E1] text-[#464555] hover:bg-slate-50 text-xs font-extrabold rounded-xl shadow-2xs transition-colors flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Edit
          </button>
          <button className="px-4 py-2.5 bg-white border border-[#E1E1E1] text-amber-600 hover:bg-amber-50 text-xs font-extrabold rounded-xl shadow-2xs transition-colors flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">assignment_ind</span>
            Reassign
          </button>
          {followup.status !== 'CANCELLED' && followup.status !== 'COMPLETED' && (
            <button className="px-4 py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-extrabold rounded-xl shadow-2xs transition-colors flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN - MAIN CONTENT */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Notes Section */}
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs p-6">
            <h3 className="text-sm font-extrabold text-[#1a1c1c] uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400">subject</span>
              Notes
            </h3>
            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {followup.notes || <span className="italic text-slate-400">No notes provided.</span>}
            </div>
          </div>

          {/* Activity History */}
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs p-6">
            <h3 className="text-sm font-extrabold text-[#1a1c1c] uppercase tracking-wider mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400">history</span>
              Activity History
            </h3>
            
            <div className="relative pl-4 space-y-6 before:absolute before:inset-0 before:ml-[23px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:to-transparent">
              <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-indigo-100 text-indigo-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 absolute left-0 md:left-1/2 -translate-x-[4px]">
                  <span className="material-symbols-outlined text-[16px]">add</span>
                </div>
                <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-2.5rem)] pl-4 md:pl-0 pt-1">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-bold text-slate-900">Follow-up Created</h4>
                      <time className="text-[10px] font-medium text-slate-500">{new Date(followup.createdAt).toLocaleDateString()}</time>
                    </div>
                    <p className="text-[11px] text-slate-600">Created by System/User</p>
                  </div>
                </div>
              </div>
              
              {followup.status === 'COMPLETED' && followup.completedAt && (
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-emerald-100 text-emerald-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 absolute left-0 md:left-1/2 -translate-x-[4px]">
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  </div>
                  <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-2.5rem)] pl-4 md:pl-0 pt-1">
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-bold text-emerald-900">Follow-up Completed</h4>
                        <time className="text-[10px] font-medium text-emerald-600">{new Date(followup.completedAt).toLocaleDateString()}</time>
                      </div>
                      <p className="text-[11px] text-emerald-700">Action marked as completed.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Customer Activity */}
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-[#1a1c1c] uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400">store</span>
                Customer Activity
              </h3>
              <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800">View Full Profile</button>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-[#E1E1E1] text-center">
              <span className="material-symbols-outlined text-slate-300 text-3xl mb-2">analytics</span>
              <p className="text-xs text-slate-500 font-medium">Recent customer interactions will appear here.</p>
            </div>
          </div>
          
        </div>

        {/* RIGHT COLUMN - SUMMARY PANEL */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Status & Ownership */}
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-[#E1E1E1] bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#1a1c1c] uppercase tracking-wider">Summary</h3>
              {getStatusBadge(derivedStatus)}
            </div>
            
            <div className="p-5 space-y-5">
              
              {/* Due Date */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5 block">
                  Due Date
                </label>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">calendar_today</span>
                  <span className={`text-sm font-bold ${derivedStatus === 'OVERDUE' ? 'text-rose-600' : 'text-[#1a1c1c]'}`}>
                    {new Date(followup.followUpDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5 block">
                  Priority
                </label>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">flag</span>
                  <span className="text-sm font-bold text-[#1a1c1c]">
                    {followup.priority || 'Medium'}
                  </span>
                </div>
              </div>

              {/* PIC */}
              <div className="pt-4 border-t border-slate-100">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 block">
                  Assigned PIC
                </label>
                <div className="flex items-center gap-3">
                  {followup.picAvatar ? (
                    <img src={followup.picAvatar} alt={followup.picName} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-bold border border-slate-300">
                      {followup.picName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-bold text-[#1a1c1c]">{followup.picName}</div>
                    <div className="text-xs text-indigo-600 font-medium">Sales Rep</div>
                  </div>
                </div>
              </div>

              {/* Customer */}
              <div className="pt-4 border-t border-slate-100">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 block">
                  Customer
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined">domain</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#1a1c1c]">{followup.customerName}</div>
                    <div className="text-xs text-slate-500 font-medium">{customer?.code || followup.customerCode}</div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Related Items */}
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-[#E1E1E1] bg-slate-50">
              <h3 className="text-sm font-extrabold text-[#1a1c1c] uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 text-[18px]">link</span>
                Related Items
              </h3>
            </div>
            
            <div className="p-0">
              
              {/* Visit */}
              {followup.relatedVisitId && (
                <div className="p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors group cursor-pointer">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 block">
                    Related Visit
                  </label>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#1a1c1c] group-hover:text-indigo-600 transition-colors">
                        {relatedVisit?.title || followup.relatedVisitId}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {(relatedVisit?.visitDate || relatedVisit?.date) ? new Date(relatedVisit.visitDate || relatedVisit.date!).toLocaleDateString() : 'View visit details'}
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-300 group-hover:text-indigo-600 text-[16px] transition-colors">open_in_new</span>
                  </div>
                </div>
              )}

              {/* Task */}
              {followup.relatedTaskId && (
                <div className="p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors group cursor-pointer">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 block">
                    Related Task
                  </label>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#1a1c1c] group-hover:text-indigo-600 transition-colors">
                        {relatedTask?.title || followup.relatedTaskId}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {relatedTask?.dueDate ? `Due ${new Date(relatedTask.dueDate).toLocaleDateString()}` : 'View task details'}
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-300 group-hover:text-indigo-600 text-[16px] transition-colors">open_in_new</span>
                  </div>
                </div>
              )}

              {/* Project */}
              {followup.relatedProjectId && (
                <div className="p-4 hover:bg-slate-50 transition-colors group cursor-pointer">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 block">
                    Related Project
                  </label>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#1a1c1c] group-hover:text-indigo-600 transition-colors">
                        {relatedProject?.name || followup.relatedProjectId}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {relatedProject?.stage ? `Stage: ${relatedProject.stage}` : 'View project details'}
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-300 group-hover:text-indigo-600 text-[16px] transition-colors">open_in_new</span>
                  </div>
                </div>
              )}

              {!followup.relatedVisitId && !followup.relatedTaskId && !followup.relatedProjectId && (
                <div className="p-5 text-center">
                  <p className="text-xs text-slate-500 font-medium">No related items attached to this follow-up.</p>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

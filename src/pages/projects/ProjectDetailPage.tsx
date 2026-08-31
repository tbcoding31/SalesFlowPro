import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Project, Customer, Task, Visit, FollowUp, Activity, ProjectStage } from '../../types';
import { crmApi } from '../../services/crmApi';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant, currentUser } = useAuth();
  const tenantId = currentTenant?.id ;

  const [project, setProject] = useState<Project | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [nextAction, setNextAction] = useState<any | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineHasMore, setTimelineHasMore] = useState(false);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);

  const [attentionSignals, setAttentionSignals] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  
  const loadTimeline = async (pageToLoad: number, append: boolean = false) => {
    if (!id) return;
    setIsLoadingTimeline(true);
    try {
      const res = await crmApi.fetchProjectTimeline(id, pageToLoad, 25);
      if (append) {
        setActivities(prev => [...prev, ...res.data]);
      } else {
        setActivities(res.data);
      }
      setTimelinePage(res.pagination.page);
      setTimelineHasMore(res.pagination.hasNextPage);
    } catch (err) {
      console.error('Failed to load project timeline', err);
    } finally {
      setIsLoadingTimeline(false);
    }
  };
const loadData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const summaryRes: any = await crmApi.fetchProjectSummary(id);
      if (summaryRes && summaryRes.project) {
        const proj = summaryRes.project;
        setProject(proj);
        if (summaryRes.attentionSignals) {
          setAttentionSignals(summaryRes.attentionSignals);
        }
        if (proj.customerId) {
          const cust = await crmApi.fetchRecordById<Customer>('customers', proj.customerId);
          if (cust) setCustomer(cust);
        }
        if (summaryRes.tasks) setTasks(summaryRes.tasks);
        if (summaryRes.visits) setVisits(summaryRes.visits);
        if (summaryRes.followups) setFollowups(summaryRes.followups);
        loadTimeline(1, false);

        const naRes = await crmApi.fetchProjectNextAction(id);
        if (naRes && naRes.nextAction) {
          setNextAction(naRes.nextAction);
        } else {
          setNextAction(null);
        }
      }
    } catch (err) {
      console.error('Error loading project details from DB:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStageChange = async (targetStage: string, isReopen = false) => {
    if (!project) return;
    
    let reasonInput: string | undefined = undefined;
    if (targetStage === 'LOST') {
      const promptRes = prompt('Please enter a business reason for marking this project as LOST:');
      if (!promptRes || !promptRes.trim()) {
        alert('A business loss reason is required to mark the project as LOST.');
        return;
      }
      reasonInput = promptRes.trim();
    } else if (isReopen) {
      const promptRes = prompt('Please enter a business reason for reopening this project:');
      if (!promptRes || !promptRes.trim()) {
        alert('An explicit business reason is required to reopen this project.');
        return;
      }
      reasonInput = promptRes.trim();
    }

    const res = await crmApi.transitionProjectStage(project.id, targetStage, {
      lossReason: targetStage === 'LOST' ? reasonInput : undefined,
      reopenReason: isReopen ? reasonInput : undefined,
      isReopen,
      expectedFromStage: project.stage
    });

    if (res.success) {
      loadData();
    } else {
      alert(`Stage transition blocked: ${res.error}`);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !project) return;
    
    await crmApi.createRecord('activities', {
      id: `ACT-${Date.now()}`,
      tenantId,
      customerId: project.customerId,
      userId: currentUser?.id || 'SYS-001',
      typeId: 'NOTE',
      subject: 'Comment',
      description: commentText,
      entityType: 'PROJECT',
      entityId: project.id
    });

    setCommentText('');
    loadData();
  };

  useEffect(() => {
    loadData();
  }, [id, tenantId]);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-500">Project not found.</div>
      </div>
    );
  }

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  const pipelineStages: { key: ProjectStage; label: string }[] = [
    { key: 'LEAD', label: 'Leads' },
    { key: 'QUALIFICATION', label: 'Discuss/Follow up' },
    { key: 'PROPOSAL', label: 'Proposal Sent' },
    { key: 'NEGOTIATION', label: 'Negotiation' },
    { key: 'WON', label: 'Won / Deal' },
  ];

  const currentStageIndex = pipelineStages.findIndex(s => s.key === project.stage);
  const isLost = project.stage === 'LOST';

  const comments = activities.filter(a => a.subject === 'Comment');
  const historyActivities = activities.filter(a => a.subject !== 'Comment');

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-10">
      
      {/* Top Navigation */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => navigate('/projects')} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Projects
        </button>
        <span>/</span>
        <span className="text-slate-800 font-medium truncate">{project.name}</span>
      </div>

      {/* Header Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row md:items-start justify-between">
        <div className="p-6 md:p-8 flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
              {project.name}
            </h1>
            {isLost && (
              <span className="px-2.5 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-lg uppercase tracking-wider">
                Lost
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mt-6">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Customer</div>
              <div className="font-semibold text-indigo-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">domain</span>
                {customer?.name || project.customerName || 'Customer Account'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Value</div>
              <div className="text-lg font-extrabold text-[#008f53]">
                {formatMoney(project.estimatedValue)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">PIC</div>
              <div className="flex items-center gap-2">
                {project.picAvatar ? (
                  <img src={project.picAvatar} alt={project.picName || 'PIC'} className="w-6 h-6 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold border border-slate-300">
                    {(project.picName || 'P').charAt(0)}
                  </div>
                )}
                <span className="text-sm font-semibold text-slate-700">{project.picName || 'Assigned PIC'}</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Expected Close</div>
              <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-slate-400">event</span>
                {new Date(project.expectedCloseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Database-backed Next Action Banner */}
          <div className="mt-5 p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                <span className="material-symbols-outlined text-sm">
                  {nextAction?.type === 'VISIT' ? 'route' : nextAction?.type === 'FOLLOW_UP' ? 'forum' : 'task'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                  Next Action ({nextAction ? nextAction.type : 'None Scheduled'})
                </span>
                <span className="text-xs font-bold text-slate-800 block">
                  {nextAction ? nextAction.title : 'No pending task, visit, or follow-up.'}
                </span>
              </div>
            </div>
            {nextAction && (
              <span className="text-[11px] font-semibold text-indigo-700 bg-white px-2.5 py-1 rounded-md border border-indigo-200 shrink-0 font-mono">
                {nextAction.actionAt}
              </span>
            )}
          </div>

          {/* Database-Authoritative Attention Signals */}
          {attentionSignals.length > 0 && (
            <div className="mt-3 space-y-2">
              {attentionSignals.map((sig, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                    sig.severity === 'CRITICAL'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`material-symbols-outlined text-base mt-0.5 shrink-0 ${
                        sig.severity === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'
                      }`}
                    >
                      {sig.severity === 'CRITICAL' ? 'error' : 'warning'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{sig.title}</span>
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded uppercase ${
                            sig.severity === 'CRITICAL'
                              ? 'bg-rose-200 text-rose-800'
                              : 'bg-amber-200 text-amber-800'
                          }`}
                        >
                          {sig.severity}
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5 opacity-90">{sig.reason}</p>
                      <div className="text-[10px] font-semibold mt-1 opacity-75">
                        👉 Action: {sig.recommendedAction}
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        {sig.code === 'PROJECT_MISSING_NEXT_ACTION' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                const desc = prompt('Enter task description:');
                                if (desc) {
                                  crmApi.createRecord('tasks', {
                                    id: `TSK-${Date.now()}`,
                                    tenantId,
                                    title: desc,
                                    customerId: project.customerId,
                                    relatedProjectId: project.id,
                                    dueDate: new Date().toISOString().split('T')[0],
                                    priorityId: 'HIGH',
                                    statusId: 'TODO'
                                  }).then(() => loadData());
                                }
                              }}
                              className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded"
                            >
                              + Task
                            </button>
                            <button
                              onClick={() => {
                                const title = prompt('Enter follow-up topic:');
                                if (title) {
                                  crmApi.createRecord('follow_ups', {
                                    id: `FLW-${Date.now()}`,
                                    tenantId,
                                    title,
                                    customerId: project.customerId,
                                    relatedProjectId: project.id,
                                    followUpDate: new Date().toISOString().split('T')[0],
                                    typeId: 'CALL',
                                    status: 'PENDING'
                                  }).then(() => loadData());
                                }
                              }}
                              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded"
                            >
                              + Follow-up
                            </button>
                          </div>
                        )}
                        {sig.code === 'EXPECTED_CLOSE_OVERDUE' && (
                          <button
                            onClick={() => {
                              const newDate = prompt('Enter new Expected Close Date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
                              if (newDate) {
                                crmApi.updateRecord('projects', project.id, {
                                  expectedCloseDate: newDate,
                                  expectedClosingDate: newDate
                                }).then(() => loadData());
                              }
                            }}
                            className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded"
                          >
                            Update Close Date
                          </button>
                        )}
                        {sig.code === 'PROJECT_NO_ACTIVE_PIC' && (
                          <button
                            onClick={() => {
                              const newPic = prompt('Enter Active Sales Rep User ID:');
                              if (newPic) {
                                crmApi.updateRecord('projects', project.id, {
                                  picId: newPic
                                }).then(() => loadData());
                              }
                            }}
                            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded"
                          >
                            Assign PIC
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 p-6 flex flex-row md:flex-col items-center justify-center gap-3 shrink-0">
          <button className="flex-1 w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Edit
          </button>
          <button className="flex-1 w-full px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
            Move Stage
          </button>
          <div className="flex-1 w-full flex gap-2">
            <button className="flex-1 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center" title="Create Task">
              <span className="material-symbols-outlined text-[18px]">task</span>
            </button>
            <button className="flex-1 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center" title="Create Follow-up">
              <span className="material-symbols-outlined text-[18px]">forum</span>
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Pipeline Progress */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-6">Pipeline Stage</div>
        
        {isLost ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">cancel</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-rose-700">Project Closed as Lost</h3>
                <p className="text-sm text-rose-600/80">This project is inactive and closed as lost.</p>
              </div>
            </div>
            <button
              onClick={() => handleStageChange('QUALIFICATION', true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">restart_alt</span>
              Reopen Project
            </button>
          </div>
        ) : project.stage === 'WON' ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">verified</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-700">Project Won</h3>
                <p className="text-sm text-emerald-600/80">Contract finalized and deal marked as won.</p>
              </div>
            </div>
            <button
              onClick={() => handleStageChange('NEGOTIATION', true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">restart_alt</span>
              Reopen Deal
            </button>
          </div>
        ) : (
          <div className="relative flex justify-between items-center w-full">
            {/* Background line */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1.5 bg-slate-100 rounded-full z-0"></div>
            {/* Active line */}
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-indigo-500 rounded-full z-0 transition-all duration-500"
              style={{ width: currentStageIndex >= 0 ? `${(currentStageIndex / (pipelineStages.length - 1)) * 100}%` : '0%' }}
            ></div>

            {pipelineStages.map((stage, idx) => {
              const isCompleted = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const isPending = idx > currentStageIndex;

              return (
                <button 
                  key={stage.key} 
                  onClick={() => handleStageChange(stage.key)}
                  className="relative z-10 flex flex-col items-center gap-2 min-w-[80px] hover:scale-105 transition-transform"
                >
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors
                      ${isCompleted ? 'bg-indigo-500 border-indigo-500 text-white' : ''}
                      ${isCurrent ? 'bg-white border-indigo-500 text-indigo-600 shadow-md ring-4 ring-indigo-50' : ''}
                      ${isPending ? 'bg-white border-slate-200 text-slate-300 hover:border-indigo-200' : ''}
                    `}
                  >
                    {isCompleted ? (
                      <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                    ) : isCurrent ? (
                      <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></div>
                    ) : (
                      <div className="w-2 h-2 bg-slate-200 rounded-full"></div>
                    )}
                  </div>
                  <span className={`text-xs font-bold ${isCurrent ? 'text-indigo-700' : isCompleted ? 'text-slate-700' : 'text-slate-400'}`}>
                    {stage.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Content Area (Left 2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Project & Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-indigo-500 text-[20px]">info</span>
                Project Information
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-1">Source</div>
                  <div className="text-sm text-slate-800">{project.source || '-'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-1">Description</div>
                  <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {project.description || 'No description provided.'}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-indigo-500 text-[20px]">domain</span>
                Customer Information
              </h3>
              {customer ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-1">Company Name</div>
                    <div className="text-sm font-bold text-indigo-600">{customer.name}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">Industry</div>
                      <div className="text-sm text-slate-800">{customer.industry}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">Status</div>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                        customer.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {customer.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-1">Address</div>
                    <div className="text-sm text-slate-800">{customer.address}</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500 italic">Customer details not available.</div>
              )}
            </div>
          </div>

          {/* Related Items Tabs (Simplified as stacked lists for now, or just sections) */}
          
          {/* Tasks */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500 text-[20px]">task_alt</span>
                Related Tasks
              </h3>
              <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700">View All</button>
            </div>
            <div className="divide-y divide-slate-100">
              {tasks.length > 0 ? tasks.map(task => (
                <div key={task.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-3">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : 
                    task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <span className="material-symbols-outlined text-[16px]">
                      {task.status === 'COMPLETED' ? 'check_circle' : 'pending_actions'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-bold text-slate-800 truncate">{task.title}</h4>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider shrink-0 ${
                         task.priority === 'HIGH' ? 'bg-rose-100 text-rose-700' :
                         task.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                      }`}>{task.priority}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">event</span>
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                      <span>Assignee: {task.assignedToName}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="p-6 text-center text-sm text-slate-500">No related tasks found.</div>
              )}
            </div>
          </div>

          {/* Follow-ups */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500 text-[20px]">forum</span>
                Follow-ups
              </h3>
              <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700">View All</button>
            </div>
            <div className="divide-y divide-slate-100">
              {followups.length > 0 ? followups.map(fu => (
                <div key={fu.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-3">
                   <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]">
                      {fu.type === 'CALL' ? 'call' : fu.type === 'EMAIL' ? 'mail' : fu.type === 'MEETING' ? 'groups' : 'chat'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-bold text-slate-800 truncate">{fu.type} Follow-up</h4>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider shrink-0 ${
                         fu.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>{fu.status}</span>
                    </div>
                    <div className="text-xs text-slate-600 mb-1 line-clamp-1">{fu.notes || 'No notes.'}</div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">event</span>
                        {new Date(fu.followUpDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="p-6 text-center text-sm text-slate-500">No follow-ups found.</div>
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-white">
              <span className="material-symbols-outlined text-slate-500 text-[20px]">chat_bubble_outline</span>
              <h3 className="text-sm font-bold text-slate-900">Comments</h3>
            </div>
            
            <div className="p-6">
              {/* Input Area */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                  {currentUser?.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                    <textarea
                      placeholder="Add a comment or note..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="w-full min-h-[80px] p-4 bg-transparent text-sm focus:outline-none resize-none"
                    ></textarea>
                  </div>
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={handleAddComment}
                      disabled={!commentText.trim()}
                      className="px-5 py-2 bg-slate-500 text-white rounded-full text-sm font-bold hover:bg-slate-600 transition-colors disabled:opacity-50"
                    >
                      Post Comment
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Divider */}
              {comments.length > 0 && <div className="border-t border-slate-100 my-6"></div>}

              {/* Comment List */}
              <div className="space-y-6">
                {comments.map(comment => (
                  <div key={comment.id} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold shrink-0">
                      {comment.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-900">{comment.userName}</span>
                        <span className="text-xs text-slate-500">
                          {new Date(comment.occurredAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          
          {/* Summary Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900 mb-4 border-b border-slate-100 pb-3">
              Summary
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Value</span>
                <span className="text-sm font-extrabold text-[#008f53]">{formatMoney(project.estimatedValue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Probability</span>
                <span className="text-sm font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{project.probability}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Expected Close</span>
                <span className="text-sm font-medium text-slate-800">{new Date(project.expectedCloseDate).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">PIC</span>
                <span className="text-sm font-medium text-slate-800">{project.picName}</span>
              </div>
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Created At</span>
                  <span className="text-xs text-slate-600">{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Last Updated</span>
                  <span className="text-xs text-slate-600">{new Date(project.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity History */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[500px]">
             <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-500 text-[20px]">history</span>
                Activity History
              </h3>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {historyActivities.length > 0 ? historyActivities.map((activity, idx) => (
                  <div key={activity.id} className="relative flex items-start gap-4">
                     <div className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200 -z-10 last:hidden"></div>
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 border-white z-10 ${
                        activity.type === 'PROJECT' ? 'bg-indigo-100 text-indigo-600' :
                        activity.type === 'CALL' ? 'bg-blue-100 text-blue-600' :
                        activity.type === 'MEETING' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                     }`}>
                       <span className="material-symbols-outlined text-[14px]">
                          {activity.type === 'PROJECT' ? 'monitoring' : 
                           activity.type === 'CALL' ? 'call' : 
                           activity.type === 'MEETING' ? 'groups' : 'history_edu'}
                       </span>
                     </div>
                     <div className="flex-1 min-w-0 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1.5">
                          <span className="text-xs font-bold text-slate-800">{activity.subject}</span>
                          <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                            {new Date(activity.occurredAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{activity.description}</p>
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-200/50">
                           <span className="material-symbols-outlined text-[12px] text-slate-400">person</span>
                           <span className="text-[10px] font-medium text-slate-500">{activity.userName}</span>
                        </div>
                     </div>
                  </div>
                )) : (
                  <div className="text-center text-sm text-slate-500 py-4">No activity history.</div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

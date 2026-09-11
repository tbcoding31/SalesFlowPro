import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  resolveProjectNavigation,
  buildProjectEditUrl,
  getProjectDetailBackUrl
} from '../../utils/projectNavigation';
import { useAuth } from '../../context/AuthContext';
import { Project, Customer, Task, Visit, FollowUp, Activity, ProjectStage, MasterDataItem } from '../../types';
import { crmApi } from '../../services/crmApi';
import { masterDataApi } from '../../services/masterDataApi';
import { CreateFollowUpModal } from '../../components/followups/CreateFollowUpModal';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant, currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navContext = resolveProjectNavigation(searchParams);
  const tenantId = currentTenant?.id ;

  const [project, setProject] = useState<Project | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [nextAction, setNextAction] = useState<any | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineHasMore, setTimelineHasMore] = useState(false);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);

  const [attentionSignals, setAttentionSignals] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // UAT-BUG-061: Stage Advance, Close Modal, and Scroll Targets State
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeModalReason, setCloseModalReason] = useState('');
  const [closeModalError, setCloseModalError] = useState('');

  const tasksSectionRef = useRef<HTMLDivElement | null>(null);
  const commentsSectionRef = useRef<HTMLDivElement | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);

  const handleScrollToTasks = () => {
    if (tasksSectionRef.current) {
      tasksSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleScrollToComments = () => {
    if (commentsSectionRef.current) {
      commentsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setTimeout(() => {
      if (commentInputRef.current) {
        commentInputRef.current.focus();
      }
    }, 300);
  };

  
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
        if (summaryRes.tasks) setTasks(summaryRes.tasks);
        if (summaryRes.visits) setVisits(summaryRes.visits);
        if (summaryRes.followups) setFollowups(summaryRes.followups);

        // Secondary resources loaded resiliently via Promise.allSettled
        const secondaryPromises: Promise<any>[] = [];

        if (proj.customerId) {
          secondaryPromises.push(
            crmApi.fetchRecordById<Customer>('customers', proj.customerId)
              .then(cust => { if (cust) setCustomer(cust); })
              .catch(e => console.warn('Customer load failed resiliently:', e))
          );
        }

        secondaryPromises.push(
          crmApi.fetchProjectNextAction(id)
            .then(naRes => {
              if (naRes && naRes.nextAction) {
                setNextAction(naRes.nextAction);
              } else {
                setNextAction(null);
              }
            })
            .catch(e => {
              console.warn('Next action load failed resiliently:', e);
              setNextAction(null);
            })
        );

        secondaryPromises.push(
          loadTimeline(1, false).catch(e => console.warn('Timeline load failed resiliently:', e))
        );

        await Promise.allSettled(secondaryPromises);
      } else {
        setProject(null);
      }
    } catch (err) {
      console.error('Error loading project details from DB:', err);
      setProject(null);
    } finally {
      setIsLoading(false);
    }
  };

  const [dbStages, setDbStages] = useState<MasterDataItem[]>([]);
  useEffect(() => {
    masterDataApi.fetchMasterData('project_stages', tenantId).then(data => {
      setDbStages(data.filter(d => d.isActive !== false));
    });
  }, [tenantId]);

  const pipelineStages = useMemo(() => {
    return dbStages.map(s => ({
      key: s.id,
      code: s.codeValue,
      label: s.label,
      phase: s.phase || 'SALES',
      commercialOutcome: s.commercialOutcome || 'NONE',
      isTerminal: s.isTerminal === true,
      allowVisits: s.allowVisits !== false,
      allowNewProject: s.allowNewProject !== false,
      displayOrder: s.displayOrder
    }));
  }, [dbStages]);

  const handleStageChange = async (targetStage: string, isReopen = false) => {
    if (!project) return;
    
    const targetObj = pipelineStages.find(s => s.key === targetStage || s.code === targetStage);
    const targetStageId = targetObj ? targetObj.key : targetStage;
    const isTargetLost = targetObj?.commercialOutcome === 'LOST';
    const isTargetCancelled = targetObj?.commercialOutcome === 'CANCELLED';

    // Gate 2: LOST is pre-win commercial failure only
    if (isTargetLost && project.commercialWonAt) {
      alert('This project was already won commercially and cannot be marked as LOST. Post-win commercial abortion must use CANCELLED.');
      return;
    }

    let reasonInput: string | undefined = undefined;
    if (isTargetLost) {
      const promptRes = prompt('Please enter a business reason for marking this project as LOST:');
      if (!promptRes || !promptRes.trim()) {
        alert('A business loss reason is required to mark the project as LOST.');
        return;
      }
      reasonInput = promptRes.trim();
    } else if (isTargetCancelled) {
      const promptRes = prompt('Please enter a business reason for cancelling this project:');
      if (!promptRes || !promptRes.trim()) {
        alert('A business cancellation reason is required to cancel this project.');
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

    const res = await crmApi.transitionProjectStage(project.id, targetStageId, {
      lossReason: isTargetLost ? reasonInput : undefined,
      cancellationReason: isTargetCancelled ? reasonInput : undefined,
      reopenReason: isReopen ? reasonInput : undefined,
      isReopen,
      expectedFromStage: project.stageCode || project.stage || project.stageId
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

  const currentStageIndex = pipelineStages.findIndex(s => s.key === project.stageId || s.code === (project.stageCode || project.stage));
  const currentStage = currentStageIndex >= 0 ? pipelineStages[currentStageIndex] : null;
  const isLost = project.stageCommercialOutcome === 'LOST' || (project.stageCode || project.stage) === 'LOST';
  const isCancelled = project.stageCommercialOutcome === 'CANCELLED' || (project.stageCode || project.stage) === 'CANCELLED';
  const isTerminal = Boolean(project.stageIsTerminal);
  const isWon = Boolean(project.commercialWonAt);
  const isCurrentlyWon = currentStage?.commercialOutcome === 'WON' || project.stageCommercialOutcome === 'WON';

  const nextStage = (project as any)?.nextStage;
  const canAdvance = Boolean((project as any)?.canAdvance);
  const isNextStageTerminalClose = Boolean(
    nextStage &&
    nextStage.isTerminal === 1 &&
    nextStage.phase === 'CLOSED' &&
    nextStage.commercialOutcome === 'WON'
  );

  const handleAdvanceClick = () => {
    if (!canAdvance) return;
    if (isNextStageTerminalClose) {
      setCloseModalReason('');
      setCloseModalError('');
      setShowCloseModal(true);
      return;
    }
    executeAdvance();
  };

  const executeAdvance = async () => {
    if (!project || isAdvancing) return;
    setIsAdvancing(true);
    try {
      const res = await crmApi.advanceProjectStage(project.id);
      if (!res.success) {
        if (res.code === 'PROJECT_CLOSE_CONFIRMATION_REQUIRED' || res.requiresConfirmation) {
          setCloseModalReason('');
          setCloseModalError('');
          setShowCloseModal(true);
          return;
        }
        alert(res.error || 'Failed to advance stage');
        return;
      }
      await loadData();
    } catch (err: any) {
      console.error('Failed to advance project stage', err);
      alert(err.message || 'Failed to advance project stage');
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleConfirmClose = async () => {
    if (!project || !closeModalReason.trim() || isAdvancing) return;
    setIsAdvancing(true);
    setCloseModalError('');
    try {
      const res = await crmApi.advanceProjectStage(project.id, {
        confirmClose: true,
        closeReason: closeModalReason.trim()
      });
      if (!res.success) {
        setCloseModalError(res.error || 'Failed to close project');
        return;
      }
      setShowCloseModal(false);
      setCloseModalReason('');
      await loadData();
    } catch (err: any) {
      setCloseModalError(err.message || 'Failed to close project');
    } finally {
      setIsAdvancing(false);
    }
  };

  const comments = activities.filter(a => a.subject === 'Comment');
  const historyActivities = activities.filter(a => a.subject !== 'Comment');

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-10">
      
      {/* Top Navigation */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => navigate(getProjectDetailBackUrl(navContext.from))} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
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
            {isCancelled && (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg uppercase tracking-wider">
                Cancelled
              </span>
            )}
            {isWon && (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">emoji_events</span>
                Won Deal
              </span>
            )}
            {isTerminal && !isLost && !isCancelled && (
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg uppercase tracking-wider">
                Closed
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
                              onClick={() => setShowFollowUpModal(true)}
                              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded cursor-pointer"
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

        <div className="bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 p-6 flex flex-row md:flex-col items-center justify-center gap-3 shrink-0 min-w-[200px]">
          {/* PRIMARY: Edit Project */}
          <button 
            disabled={isTerminal}
            onClick={() => {
              if (!isTerminal) {
                navigate(buildProjectEditUrl(project.id, { entry: 'detail', from: navContext.from }));
              }
            }}
            title={isTerminal ? 'Project is in a terminal stage and cannot be edited' : 'Edit Project Details'}
            className={`flex-1 w-full px-4 py-2.5 text-sm font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 ${
              isTerminal
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{isTerminal ? 'lock' : 'edit'}</span>
            Edit Project
          </button>

          {/* SECONDARY: Advance Stage or Close Project */}
          {isNextStageTerminalClose ? (
            <button
              disabled={isAdvancing}
              onClick={handleAdvanceClick}
              title="Close & Complete Project"
              className="flex-1 w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">verified</span>
              {isAdvancing ? 'Closing...' : 'Close Project'}
            </button>
          ) : (
            <button
              disabled={!canAdvance || isAdvancing}
              onClick={handleAdvanceClick}
              title={canAdvance ? (nextStage ? `Advance to ${nextStage.name}` : 'Advance Stage') : 'Project is at final canonical stage'}
              className={`flex-1 w-full px-4 py-2.5 text-sm font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 ${
                canAdvance && !isAdvancing
                  ? 'bg-slate-800 hover:bg-slate-900 text-white cursor-pointer'
                  : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {canAdvance ? 'arrow_forward' : 'check_circle'}
              </span>
              {isAdvancing ? 'Advancing...' : (canAdvance && nextStage ? `Advance to ${nextStage.name}` : 'Final Stage Reached')}
            </button>
          )}

          {/* TERTIARY: Tasks and Comments */}
          <div className="flex-1 w-full grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleScrollToTasks}
              className="px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              title="Scroll to Related Tasks"
            >
              <span className="material-symbols-outlined text-[16px] text-amber-500">task_alt</span>
              Tasks
            </button>
            <button
              type="button"
              onClick={handleScrollToComments}
              className="px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              title="Scroll to Comments"
            >
              <span className="material-symbols-outlined text-[16px] text-blue-500">chat_bubble</span>
              Comments
            </button>
            <button
              type="button"
              onClick={() => setShowFollowUpModal(true)}
              className="col-span-2 px-3 py-2 bg-indigo-50/80 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              title="Add Follow-up for this project"
            >
              <span className="material-symbols-outlined text-[16px] text-indigo-600">add_task</span>
              + Add Follow-up
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
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">restart_alt</span>
              Reopen Project
            </button>
          </div>
        ) : isCancelled ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">block</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-amber-700">Project Cancelled</h3>
                <p className="text-sm text-amber-600/80">This project has been cancelled post-win or during delivery.</p>
              </div>
            </div>
            <button
              onClick={() => {
                const defaultReopenStage = isWon ? (pipelineStages.find(s => s.code === 'KICKOFF' || s.key === 'PS-6')?.key || 'PS-5') : 'PS-2';
                handleStageChange(defaultReopenStage, true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">restart_alt</span>
              Reopen Project
            </button>
          </div>
        ) : pipelineStages.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 font-medium">
            Stage master data unavailable.
          </div>
        ) : (
          <div className="space-y-6">
            {isCurrentlyWon && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-xl">emoji_events</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900">Commercial Win Achieved</h4>
                    <p className="text-xs text-emerald-700/90">
                      Deal marked as won{project.commercialWonAt ? ` on ${new Date(project.commercialWonAt).toLocaleDateString()}` : ''}. Delivery and operational milestones can proceed.
                    </p>
                  </div>
                </div>
                {/* Quick advance button if currently at WON stage */}
                {(project.stageId === 'PS-5' || (project.stageCode || project.stage) === 'WON') && (
                  <button
                    onClick={() => {
                      const kickoffStage = pipelineStages.find(s => s.code === 'KICKOFF' || s.key === 'PS-6');
                      if (kickoffStage) handleStageChange(kickoffStage.key);
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <span>Advance to Delivery (Kickoff)</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                )}
              </div>
            )}

            {/* Stepper showing non-terminal progression */}
            {(() => {
              const activeStages = pipelineStages.filter(s => !s.isTerminal);
              const activeIndex = activeStages.findIndex(s => s.key === project.stageId || s.code === (project.stageCode || project.stage));

              return (
                <div className="relative flex justify-between items-center w-full overflow-x-auto py-2">
                  {/* Background line */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1.5 bg-slate-100 rounded-full z-0"></div>
                  {/* Active line */}
                  <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-indigo-500 rounded-full z-0 transition-all duration-500"
                    style={{ width: activeIndex >= 0 ? `${(activeIndex / Math.max(activeStages.length - 1, 1)) * 100}%` : '0%' }}
                  ></div>

                  {activeStages.map((stage, idx) => {
                    const isCompleted = idx < activeIndex;
                    const isCurrent = idx === activeIndex;
                    const isPending = idx > activeIndex;

                    return (
                      <button 
                        key={stage.key} 
                        onClick={() => handleStageChange(stage.key)}
                        className="relative z-10 flex flex-col items-center gap-2 min-w-[70px] hover:scale-105 transition-transform cursor-pointer"
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
                        <span className={`text-[11px] font-bold text-center leading-tight ${isCurrent ? 'text-indigo-700' : isCompleted ? 'text-slate-700' : 'text-slate-400'}`}>
                          {stage.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
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
          
          {/* Visits */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500 text-[20px]">calendar_today</span>
                Related Visits ({visits.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {visits.length > 0 ? (
                visits.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => navigate(`/visits/${v.id}`)}
                    className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-3 cursor-pointer group"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      (v.statusCode || v.status) === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' :
                      (v.statusCode || v.status) === 'CANCELLED' ? 'bg-rose-100 text-rose-600' :
                      (v.statusCode || v.status) === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {(v.statusCode || v.status) === 'COMPLETED' ? 'check_circle' : 'event'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                          {v.title}
                        </h4>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider shrink-0 ${
                          (v.statusCode || v.status) === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                          (v.statusCode || v.status) === 'CANCELLED' ? 'bg-rose-100 text-rose-700' :
                          (v.statusCode || v.status) === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {v.statusName || v.statusCode || v.status || 'Planned'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                          {v.visitDate ? new Date(v.visitDate).toLocaleDateString() : '-'}
                        </span>
                        {v.startTime && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            {v.startTime} - {v.endTime}
                          </span>
                        )}
                        <span>PIC: {v.picName || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-sm text-slate-500">No related visits found.</div>
              )}
            </div>
          </div>

          {/* Tasks */}
          <div id="project-tasks-section" ref={tasksSectionRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
          <div id="project-comments-section" ref={commentsSectionRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
                      ref={commentInputRef}
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

      {/* Explicit Business Closure Modal (Gate 1 & Gate 2) */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">verified</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">Close & Complete Project</h3>
                <p className="text-xs text-slate-500 mt-0.5">Project: {project.name}</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 space-y-2">
              <div className="font-semibold text-slate-700">Important Business Consequences:</div>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li>This action marks the project delivery lifecycle as completed and closed.</li>
                <li>Normal project editing will be <strong>locked</strong>.</li>
                <li>Reopening will require a dedicated administrative lifecycle action and reason.</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                Closure Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={closeModalReason}
                onChange={(e) => {
                  setCloseModalReason(e.target.value);
                  if (closeModalError) setCloseModalError('');
                }}
                placeholder="e.g., Project delivery completed and accepted by customer..."
                rows={3}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-shadow"
              />
              {closeModalError && (
                <p className="text-xs font-semibold text-rose-600">{closeModalError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isAdvancing}
                onClick={() => {
                  setShowCloseModal(false);
                  setCloseModalReason('');
                  setCloseModalError('');
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAdvancing || !closeModalReason.trim()}
                onClick={handleConfirmClose}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">check</span>
                {isAdvancing ? 'Closing...' : 'Confirm & Close Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFollowUpModal && project && (
        <CreateFollowUpModal
          isOpen={showFollowUpModal}
          onClose={() => setShowFollowUpModal(false)}
          onSuccess={() => loadData()}
          initialProjectId={project.id}
          initialProjectName={project.name}
          initialCustomerId={project.customerId}
          initialCustomerName={customer?.name || project.customerName}
          sourceType="PROJECT"
        />
      )}

    </div>
  );
};

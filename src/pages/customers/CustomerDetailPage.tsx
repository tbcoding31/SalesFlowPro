import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { usersApi } from '../../services/usersApi';
import { Customer, Visit, Task, FollowUp, Project, Activity, User, TaskPriority, TaskStatus, FollowUpType, FollowUpPriority, FollowUpStatus, ProjectStage } from '../../types';

export interface ActivityTimelineItem {
  id: string;
  category: 'VISIT' | 'TASK' | 'FOLLOWUP' | 'PROJECT' | 'CUSTOMER' | 'SYSTEM' | string;
  typeBadge: string;
  typeColor: string;
  typeIcon: string;
  subject: string;
  description: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userRole?: string;
  date: string;
  time: string;
  occurredAt: string;
  entityType?: 'VISIT' | 'TASK' | 'FOLLOWUP' | 'PROJECT' | 'CUSTOMER' | 'SYSTEM';
  entityId?: string;
  status?: string;
  recordObj?: any;
}

const renderTaskStatusBadge = (status: string, dueDate?: string) => {
  const todayISO = new Date().toISOString().split('T')[0];
  const isOverdue = dueDate && dueDate < todayISO && status !== 'COMPLETED' && status !== 'CANCELLED';

  if (status === 'COMPLETED') {
    return (
      <span className="px-2.5 py-1 bg-[#00C875]/10 text-[#008f53] text-[10px] font-extrabold rounded-full inline-flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00C875]" />
        <span>Completed</span>
      </span>
    );
  }
  if (isOverdue) {
    return (
      <span className="px-2.5 py-1 bg-[#ba1a1a]/10 text-[#ba1a1a] text-[10px] font-extrabold rounded-full inline-flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]" />
        <span>Overdue</span>
      </span>
    );
  }
  if (status === 'IN_PROGRESS') {
    return (
      <span className="px-2.5 py-1 bg-[#3b82f6]/10 text-[#2563eb] text-[10px] font-extrabold rounded-full inline-flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
        <span>In Progress</span>
      </span>
    );
  }
  if (status === 'CANCELLED') {
    return (
      <span className="px-2.5 py-1 bg-[#6b7280]/10 text-[#4b5563] text-[10px] font-extrabold rounded-full inline-flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#6b7280]" />
        <span>Cancelled</span>
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 bg-[#f59e0b]/10 text-[#d97706] text-[10px] font-extrabold rounded-full inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
      <span>Open</span>
    </span>
  );
};

const renderTaskPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'URGENT':
      return (
        <span className="px-2 py-0.5 bg-[#9333ea]/10 text-[#7e22ce] border border-[#9333ea]/20 text-[10px] font-extrabold rounded inline-flex items-center gap-0.5">
          <span className="material-symbols-outlined text-[13px]">keyboard_double_arrow_up</span>
          <span>URGENT</span>
        </span>
      );
    case 'HIGH':
      return (
        <span className="px-2 py-0.5 bg-[#ba1a1a]/10 text-[#ba1a1a] border border-[#ba1a1a]/20 text-[10px] font-extrabold rounded inline-flex items-center gap-0.5">
          <span className="material-symbols-outlined text-[13px]">keyboard_arrow_up</span>
          <span>HIGH</span>
        </span>
      );
    case 'MEDIUM':
      return (
        <span className="px-2 py-0.5 bg-[#f59e0b]/10 text-[#d97706] border border-[#f59e0b]/20 text-[10px] font-extrabold rounded inline-flex items-center gap-0.5">
          <span className="material-symbols-outlined text-[13px]">remove</span>
          <span>MEDIUM</span>
        </span>
      );
    case 'LOW':
      return (
        <span className="px-2 py-0.5 bg-[#6b7280]/10 text-[#4b5563] border border-[#6b7280]/20 text-[10px] font-extrabold rounded inline-flex items-center gap-0.5">
          <span className="material-symbols-outlined text-[13px]">keyboard_arrow_down</span>
          <span>LOW</span>
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 bg-[#f3f3f3] text-[#1a1c1c] text-[10px] font-bold rounded">
          {priority}
        </span>
      );
  }
};

const renderVisitStatusBadge = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="px-2.5 py-1 bg-[#00C875]/10 text-[#008f53] text-[10px] font-extrabold rounded-full inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00C875]" />
          <span>Completed</span>
        </span>
      );
    case 'PLANNED':
    case 'SCHEDULED':
      return (
        <span className="px-2.5 py-1 bg-[#4744e5]/10 text-[#4744e5] text-[10px] font-extrabold rounded-full inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4744e5]" />
          <span>Scheduled</span>
        </span>
      );
    case 'RESCHEDULED':
      return (
        <span className="px-2.5 py-1 bg-[#f59e0b]/10 text-[#d97706] text-[10px] font-extrabold rounded-full inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
          <span>Rescheduled</span>
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="px-2.5 py-1 bg-[#ba1a1a]/10 text-[#ba1a1a] text-[10px] font-extrabold rounded-full inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]" />
          <span>Cancelled</span>
        </span>
      );
    case 'NO_SHOW':
      return (
        <span className="px-2.5 py-1 bg-[#6b7280]/10 text-[#4b5563] text-[10px] font-extrabold rounded-full inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6b7280]" />
          <span>No Show</span>
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-1 bg-[#f3f3f3] text-[#1a1c1c] text-[10px] font-extrabold rounded-full">
          {status}
        </span>
      );
  }
};

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant, currentUser, hasPermission } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';

  const [customer, setCustomer] = useState<Customer | undefined>(
    DataService.getCustomerById(id || 'CUS-001')
  );

  const [activeTab, setActiveTab] = useState<'overview' | 'visits' | 'tasks' | 'followups' | 'projects' | 'activities'>('overview');

  // Modals state
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [showChangePicModal, setShowChangePicModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showOppModal, setShowOppModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  // Edit Customer Form state
  const [editName, setEditName] = useState(customer?.name || '');
  const [editCode, setEditCode] = useState(customer?.code || '');
  const [editType, setEditType] = useState<any>(customer?.type || 'COMPANY');
  const [editStatus, setEditStatus] = useState<any>(customer?.status || 'ACTIVE');
  const [editPhone, setEditPhone] = useState(customer?.phone || '');
  const [editEmail, setEditEmail] = useState(customer?.email || '');
  const [editRegion, setEditRegion] = useState(customer?.region || '');
  const [editAddress, setEditAddress] = useState(customer?.address || '');

  // Change PIC Form state
  const [selectedPicId, setSelectedPicId] = useState(customer?.assignedPicId || '');

  // Visit Form state
  const [visitTitle, setVisitTitle] = useState('');
  const [visitPurpose, setVisitPurpose] = useState('Product Presentation & Demo');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:30');
  const [location, setLocation] = useState(customer?.address || 'Customer Office');

  // Visit Filters State
  const [visitSearch, setVisitSearch] = useState('');
  const [visitPicFilter, setVisitPicFilter] = useState('ALL');
  const [visitStatusFilter, setVisitStatusFilter] = useState('ALL');
  const [visitPurposeFilter, setVisitPurposeFilter] = useState('ALL');
  const [visitStartDate, setVisitStartDate] = useState('');
  const [visitEndDate, setVisitEndDate] = useState('');

  // Visit Action Modals State
  const [viewingVisit, setViewingVisit] = useState<Visit | null>(null);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [reschedulingVisit, setReschedulingVisit] = useState<Visit | null>(null);
  const [cancellingVisit, setCancellingVisit] = useState<Visit | null>(null);

  // Visit Reschedule Form State
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStartTime, setRescheduleStartTime] = useState('10:00');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('11:30');
  const [rescheduleReason, setRescheduleReason] = useState('');

  // Visit Edit Form State
  const [editVisitTitle, setEditVisitTitle] = useState('');
  const [editVisitPurpose, setEditVisitPurpose] = useState('');
  const [editVisitLocation, setEditVisitLocation] = useState('');
  const [editVisitStatus, setEditVisitStatus] = useState<any>('PLANNED');
  const [editVisitResult, setEditVisitResult] = useState('');
  const [editVisitNextAction, setEditVisitNextAction] = useState('');

  // Visit Cancel Form State
  const [cancelReason, setCancelReason] = useState('');

  // Task Form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<any>('HIGH');
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPicId, setTaskPicId] = useState('');
  const [taskRelatedVisitId, setTaskRelatedVisitId] = useState('');
  const [taskRelatedOppId, setTaskRelatedOppId] = useState('');

  // Task Filters State
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('ALL');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('ALL');
  const [taskPicFilter, setTaskPicFilter] = useState('ALL');
  const [taskDueDateFilter, setTaskDueDateFilter] = useState('');
  const [taskOppFilter, setTaskOppFilter] = useState('ALL');

  // Task Modals State
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [reassigningTask, setReassigningTask] = useState<Task | null>(null);

  // Edit Task Form State
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDescription, setEditTaskDescription] = useState('');
  const [editTaskPriority, setEditTaskPriority] = useState<TaskPriority>('HIGH');
  const [editTaskStatus, setEditTaskStatus] = useState<TaskStatus>('TODO');
  const [editTaskDueDate, setEditTaskDueDate] = useState('');
  const [editTaskPicId, setEditTaskPicId] = useState('');
  const [editTaskRelatedVisitId, setEditTaskRelatedVisitId] = useState('');
  const [editTaskRelatedOppId, setEditTaskRelatedOppId] = useState('');

  // Reassign Task PIC State
  const [reassignTaskPicId, setReassignTaskPicId] = useState('');
  const [reassignSearch, setReassignSearch] = useState('');

  // Follow-Up List State & Filters
  const [followupsList, setFollowupsList] = useState<FollowUp[]>(() => DataService.getFollowUps(tenantId, customer ? customer.id : undefined));
  const refreshFollowups = () => {
    if (customer) {
      setFollowupsList(DataService.getFollowUps(tenantId, customer.id));
    }
  };

  const [followUpSearch, setFollowUpSearch] = useState('');
  const [followUpStatusFilter, setFollowUpStatusFilter] = useState('ALL');
  const [followUpPriorityFilter, setFollowUpPriorityFilter] = useState('ALL');
  const [followUpTypeFilter, setFollowUpTypeFilter] = useState('ALL');
  const [followUpPicFilter, setFollowUpPicFilter] = useState('ALL');
  const [followUpDueDateFilter, setFollowUpDueDateFilter] = useState('');
  const [followUpOppFilter, setFollowUpOppFilter] = useState('ALL');

  // Follow-Up Modals & Action States
  const [viewingFollowUp, setViewingFollowUp] = useState<FollowUp | null>(null);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);
  const [completingFollowUp, setCompletingFollowUp] = useState<FollowUp | null>(null);
  const [reschedulingFollowUp, setReschedulingFollowUp] = useState<FollowUp | null>(null);

  // Form State for Create & Edit Follow-Up
  const [followUpTitleInput, setFollowUpTitleInput] = useState('');
  const [followUpTypeInput, setFollowUpTypeInput] = useState<FollowUpType>('CALL');
  const [followUpPriorityInput, setFollowUpPriorityInput] = useState<FollowUpPriority>('HIGH');
  const [followUpStatusInput, setFollowUpStatusInput] = useState<FollowUpStatus>('PENDING');
  const [followUpDateInput, setFollowUpDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [followUpTimeInput, setFollowUpTimeInput] = useState('09:00');
  const [followUpPicIdInput, setFollowUpPicIdInput] = useState('');
  const [followUpRelatedOppIdInput, setFollowUpRelatedOppIdInput] = useState('');
  const [followUpRelatedVisitIdInput, setFollowUpRelatedVisitIdInput] = useState('');
  const [followUpNotesInput, setFollowUpNotesInput] = useState('');

  // Form State for Complete
  const [completeOutcomeInput, setCompleteOutcomeInput] = useState('');

  // Form State for Reschedule
  const [rescheduleDateInput, setRescheduleDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [rescheduleTimeInput, setRescheduleTimeInput] = useState('10:00');
  const [rescheduleReasonInput, setRescheduleReasonInput] = useState('');

  // Project Modals & Action States
  const [viewingOpp, setViewingOpp] = useState<Project | null>(null);
  const [editingOpp, setEditingOpp] = useState<Project | null>(null);
  const [changingStageOpp, setChangingStageOpp] = useState<Project | null>(null);
  const [reassigningOpp, setReassigningOpp] = useState<Project | null>(null);

  // Filters for Projects
  const [oppSearch, setOppSearch] = useState('');
  const [oppStageFilter, setOppStageFilter] = useState<string>('ALL');
  const [oppPicFilter, setOppPicFilter] = useState<string>('ALL');
  const [oppSort, setOppSort] = useState<string>('CLOSE_DATE_ASC');

  // Form State for Create & Edit Project
  const [oppNameInput, setOppNameInput] = useState('');
  const [oppValueInput, setOppValueInput] = useState<number>(150000000);
  const [oppStageInput, setOppStageInput] = useState<ProjectStage>('QUALIFICATION');
  const [oppProbInput, setOppProbInput] = useState<number>(40);
  const [oppCloseDateInput, setOppCloseDateInput] = useState<string>('2026-10-31');
  const [oppPicIdInput, setOppPicIdInput] = useState<string>('');
  const [oppSourceInput, setOppSourceInput] = useState<string>('Inbound Sales Lead');
  const [oppDescInput, setOppDescInput] = useState<string>('');

  // Form State for Quick Stage Change
  const [newStageInput, setNewStageInput] = useState<ProjectStage>('PROPOSAL');
  const [newStageProbInput, setNewStageProbInput] = useState<number>(60);
  const [stageChangeNotesInput, setStageChangeNotesInput] = useState<string>('');

  // Form State for Reassign PIC
  const [newOppPicIdInput, setNewOppPicIdInput] = useState<string>('');
  const [reassignReasonInput, setReassignReasonInput] = useState<string>('');

  // Customer Note Form state
  const [newNoteText, setNewNoteText] = useState('');

  // Activities Tab State & Filters
  const [actCategoryFilter, setActCategoryFilter] = useState<string>('ALL');
  const [actUserFilter, setActUserFilter] = useState<string>('ALL');
  const [actDateRangeFilter, setActDateRangeFilter] = useState<string>('ALL');
  const [actStartDate, setActStartDate] = useState<string>('');
  const [actEndDate, setActEndDate] = useState<string>('');
  const [actSearch, setActSearch] = useState<string>('');
  const [viewingActivity, setViewingActivity] = useState<ActivityTimelineItem | null>(null);

  if (!customer) {
    return (
      <div className="bg-white p-8 rounded-xl border border-[#E1E1E1] text-center">
        <h2 className="text-xl font-bold text-[#1a1c1c]">Customer Account Not Found</h2>
        <Link to="/customers" className="inline-block mt-4 px-4 py-2 bg-[#4744e5] text-white text-xs font-bold rounded-lg">
          Return to Customer Directory
        </Link>
      </div>
    );
  }

  const [visitsList, setVisitsList] = useState<Visit[]>(() => DataService.getVisits(tenantId, customer.id));
  const refreshVisits = () => {
    setVisitsList(DataService.getVisits(tenantId, customer.id));
  };

  const [tasksList, setTasksList] = useState<Task[]>(() => DataService.getTasks(tenantId, customer.id));
  const refreshTasks = () => {
    setTasksList(DataService.getTasks(tenantId, customer.id));
  };

  const [oppsList, setOppsList] = useState<Project[]>(() => DataService.getProjects(tenantId, customer ? customer.id : undefined));
  const refreshOpps = () => {
    if (customer) {
      setOppsList(DataService.getProjects(tenantId, customer.id));
    }
  };

  const visits: Visit[] = visitsList;
  const tasks: Task[] = tasksList;
  const followups: FollowUp[] = followupsList;
  const projects: Project[] = oppsList;
  const activities: Activity[] = DataService.getActivities(tenantId, customer.id);
  const [tenantUsers, setTenantUsers] = useState<User[]>(() => DataService.getUsers(tenantId));
  useEffect(() => {
    usersApi.fetchUsers(tenantId).then(users => {
      if (users && users.length > 0) setTenantUsers(users);
    });
  }, [tenantId]);

  // Compute Unified Customer Activity Timeline
  const rawActivities: ActivityTimelineItem[] = [];
  const addedActivityKeys = new Set<string>();

  // 1. Convert raw stored activities from DataService
  activities.forEach((a) => {
    let cat: ActivityTimelineItem['category'] = 'SYSTEM';
    let icon = 'history';
    let color = 'bg-slate-100 text-slate-700 border-slate-200';
    let recObj: any = null;

    const tUpper = (a.type || '').toUpperCase();
    if (tUpper === 'VISIT') {
      cat = 'VISIT';
      icon = 'directions_car';
      color = 'bg-blue-50 text-blue-700 border-blue-200';
      recObj = visits.find((v) => v.id === a.entityId || (a.description && a.description.includes(v.id)));
    } else if (tUpper === 'TASK') {
      cat = 'TASK';
      icon = 'task_alt';
      color = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      recObj = tasks.find((t) => t.id === a.entityId);
    } else if (tUpper === 'FOLLOWUP' || tUpper === 'CALL' || tUpper === 'EMAIL' || tUpper === 'WHATSAPP' || tUpper === 'MEETING') {
      cat = 'FOLLOWUP';
      icon = tUpper === 'EMAIL' ? 'mail' : tUpper === 'WHATSAPP' ? 'chat' : tUpper === 'MEETING' ? 'groups' : 'call';
      color = 'bg-amber-50 text-amber-800 border-amber-200';
      recObj = followups.find((f) => f.id === a.entityId);
    } else if (tUpper === 'PROJECT') {
      cat = 'PROJECT';
      icon = 'add_chart';
      color = 'bg-purple-50 text-purple-700 border-purple-200';
      recObj = projects.find((o) => o.id === a.entityId);
    } else if (tUpper === 'NOTE' || tUpper === 'CUSTOMER') {
      cat = 'CUSTOMER';
      icon = 'domain';
      color = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }

    const datePart = a.occurredAt ? a.occurredAt.split(' ')[0] : new Date().toISOString().split('T')[0];
    const timePart = a.occurredAt && a.occurredAt.includes(' ') ? a.occurredAt.split(' ')[1] : '09:00';
    const userObj = tenantUsers.find((u) => u.id === a.userId);

    rawActivities.push({
      id: a.id,
      category: cat,
      typeBadge: a.type || cat,
      typeColor: color,
      typeIcon: icon,
      subject: a.subject,
      description: a.description,
      userId: a.userId,
      userName: a.userName || 'Sales PIC',
      userAvatar: a.userAvatar || userObj?.avatarUrl,
      userRole: userObj?.roleName || userObj?.position || 'Sales Representative',
      date: datePart,
      time: timePart,
      occurredAt: a.occurredAt || `${datePart} ${timePart}`,
      entityType: (a.entityType as any) || (cat as any),
      entityId: a.entityId,
      status: (a as any).status,
      recordObj: recObj,
    });

    if (a.entityId) addedActivityKeys.add(`${cat}-${a.entityId}`);
  });

  // 2. Include Visits for complete activity history
  visits.forEach((v) => {
    const key = `VISIT-${v.id}`;
    if (!addedActivityKeys.has(key)) {
      addedActivityKeys.add(key);
      const picUser = tenantUsers.find((u) => u.id === v.picId);
      rawActivities.push({
        id: `ACT-VIS-${v.id}`,
        category: 'VISIT',
        typeBadge: 'VISIT',
        typeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        typeIcon: 'directions_car',
        subject: `Customer Visit: ${v.title}`,
        description: `Location: ${v.location} | Purpose: ${v.purpose}${v.result ? ` | Result: ${v.result}` : ''}`,
        userId: v.picId,
        userName: v.picName,
        userAvatar: v.picAvatar || picUser?.avatarUrl,
        userRole: picUser?.roleName || 'Sales Representative',
        date: v.visitDate,
        time: v.startTime || '09:00',
        occurredAt: `${v.visitDate} ${v.startTime || '09:00'}`,
        entityType: 'VISIT',
        entityId: v.id,
        status: v.status,
        recordObj: v,
      });
    }
  });

  // 3. Include Tasks for complete activity history
  tasks.forEach((t) => {
    const key = `TASK-${t.id}`;
    if (!addedActivityKeys.has(key)) {
      addedActivityKeys.add(key);
      const picUser = tenantUsers.find((u) => u.id === t.picId);
      const dateVal = t.createdAt ? t.createdAt.split('T')[0] : t.dueDate;
      rawActivities.push({
        id: `ACT-TSK-${t.id}`,
        category: 'TASK',
        typeBadge: 'TASK',
        typeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        typeIcon: 'task_alt',
        subject: `Sales Task (${t.status}): ${t.title}`,
        description: `Priority: ${t.priority} | Due Date: ${t.dueDate}${t.description ? ` | ${t.description}` : ''}`,
        userId: t.picId,
        userName: t.picName,
        userAvatar: t.picAvatar || picUser?.avatarUrl,
        userRole: picUser?.roleName || 'Sales Representative',
        date: dateVal,
        time: '10:00',
        occurredAt: `${dateVal} 10:00`,
        entityType: 'TASK',
        entityId: t.id,
        status: t.status,
        recordObj: t,
      });
    }
  });

  // 4. Include Follow-ups for complete activity history
  followups.forEach((f) => {
    const key = `FOLLOWUP-${f.id}`;
    if (!addedActivityKeys.has(key)) {
      addedActivityKeys.add(key);
      const picUser = tenantUsers.find((u) => u.id === f.picId);
      const icon = f.type === 'EMAIL' ? 'mail' : f.type === 'WHATSAPP' ? 'chat' : f.type === 'MEETING' ? 'groups' : 'call';
      rawActivities.push({
        id: `ACT-FOL-${f.id}`,
        category: 'FOLLOWUP',
        typeBadge: f.type || 'FOLLOWUP',
        typeColor: 'bg-amber-50 text-amber-800 border-amber-200',
        typeIcon: icon,
        subject: `Follow-Up (${f.type}): ${f.title || 'Client Touchpoint'}`,
        description: `Notes: ${f.notes || '-'}${f.outcome ? ` | Outcome: ${f.outcome}` : ''}`,
        userId: f.picId,
        userName: f.picName,
        userAvatar: f.picAvatar || picUser?.avatarUrl,
        userRole: picUser?.roleName || 'Sales Representative',
        date: f.followUpDate,
        time: '09:00',
        occurredAt: `${f.followUpDate} 09:00`,
        entityType: 'FOLLOWUP',
        entityId: f.id,
        status: f.status,
        recordObj: f,
      });
    }
  });

  // 5. Include Projects for complete activity history
  projects.forEach((o) => {
    const key = `PROJECT-${o.id}`;
    if (!addedActivityKeys.has(key)) {
      addedActivityKeys.add(key);
      const picUser = tenantUsers.find((u) => u.id === o.picId);
      const dt = o.updatedAt || o.createdAt;
      rawActivities.push({
        id: `ACT-OPP-${o.id}`,
        category: 'PROJECT',
        typeBadge: 'PROJECT',
        typeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        typeIcon: 'add_chart',
        subject: `Sales Project Stage [${o.stage}]: ${o.name}`,
        description: `Estimated Value: Rp ${(o.estimatedValue || 0).toLocaleString('id-ID')} | Probability: ${o.probability}% | Target Close: ${o.expectedCloseDate}`,
        userId: o.picId,
        userName: o.picName,
        userAvatar: o.picAvatar || picUser?.avatarUrl,
        userRole: picUser?.roleName || 'Sales Representative',
        date: dt,
        time: '11:00',
        occurredAt: `${dt} 11:00`,
        entityType: 'PROJECT',
        entityId: o.id,
        status: o.stage,
        recordObj: o,
      });
    }
  });

  // Sort descending chronologically
  const sortedCustomerActivities = rawActivities.sort((a, b) => (b.occurredAt || "").localeCompare(a.occurredAt || ""));

  // Role Scope Filter for Activities
  const scopedCustomerActivities = sortedCustomerActivities.filter((act) => {
    if (!hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS')) {
      return act.userId === currentUser.id || customer.assignedPicId === currentUser.id;
    }
    if (hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS') && currentUser.teamId) {
      const actUser = tenantUsers.find((u) => u.id === act.userId);
      return act.userId === currentUser.id || actUser?.teamId === currentUser.teamId || customer.teamId === currentUser.teamId;
    }
    return true; // Sales Manager, Tenant Admin, Super Admin
  });

  // Filtered Customer Activities
  const filteredCustomerActivities = scopedCustomerActivities.filter((act) => {
    if (actCategoryFilter !== 'ALL') {
      if (act.category !== actCategoryFilter && act.typeBadge !== actCategoryFilter) return false;
    }
    if (actUserFilter !== 'ALL') {
      if (act.userId !== actUserFilter) return false;
    }
    if (actDateRangeFilter === 'TODAY') {
      const today = new Date().toISOString().split('T')[0];
      if (act.date !== today) return false;
    } else if (actDateRangeFilter === 'LAST_7_DAYS') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      if (act.date < sevenDaysAgo) return false;
    } else if (actDateRangeFilter === 'LAST_30_DAYS') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      if (act.date < thirtyDaysAgo) return false;
    } else if (actDateRangeFilter === 'CUSTOM') {
      if (actStartDate && act.date < actStartDate) return false;
      if (actEndDate && act.date > actEndDate) return false;
    }
    if (actSearch.trim()) {
      const q = actSearch.toLowerCase();
      const match =
        (act.subject || "").toLowerCase().includes(q) ||
        (act.description || "").toLowerCase().includes(q) ||
        (act.userName || "").toLowerCase().includes(q) ||
        (act.entityId && (act.entityId || "").toLowerCase().includes(q)) ||
        (act.status && (act.status || "").toLowerCase().includes(q)) ||
        (act.category || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleOpenRelatedRecord = (act: ActivityTimelineItem) => {
    if (act.entityType === 'VISIT') {
      const v = visits.find((item) => item.id === act.entityId) || act.recordObj;
      if (v) setViewingVisit(v);
    } else if (act.entityType === 'TASK') {
      const t = tasks.find((item) => item.id === act.entityId) || act.recordObj;
      if (t) setViewingTask(t);
    } else if (act.entityType === 'PROJECT') {
      const o = projects.find((item) => item.id === act.entityId) || act.recordObj;
      if (o) setViewingOpp(o);
    } else if (act.entityType === 'FOLLOWUP') {
      const f = followups.find((item) => item.id === act.entityId) || act.recordObj;
      if (f) setViewingFollowUp(f);
    } else {
      setViewingActivity(act);
    }
  };

  // Role Scope logic for Visits
  const scopedVisits = visits.filter((v) => {
    if (!hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS')) {
      return v.picId === currentUser.id;
    }
    if (hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS') && currentUser.teamId) {
      const picUser = tenantUsers.find((u) => u.id === v.picId);
      return v.picId === currentUser.id || picUser?.teamId === currentUser.teamId;
    }
    return true; // Sales Manager, Tenant Admin, Super Admin see all
  });

  // Filtered Visits
  const filteredVisits = scopedVisits.filter((v) => {
    if (visitSearch.trim()) {
      const q = visitSearch.toLowerCase();
      const matches =
        (v.title || "").toLowerCase().includes(q) ||
        (v.purpose || "").toLowerCase().includes(q) ||
        (v.picName || "").toLowerCase().includes(q) ||
        (v.location || "").toLowerCase().includes(q) ||
        (v.result && (v.result || "").toLowerCase().includes(q)) ||
        (v.nextAction && (v.nextAction || "").toLowerCase().includes(q));
      if (!matches) return false;
    }
    if (visitPicFilter !== 'ALL' && v.picId !== visitPicFilter) return false;
    if (visitStatusFilter !== 'ALL') {
      const vStat = v.status as string;
      if (visitStatusFilter === 'SCHEDULED' || visitStatusFilter === 'PLANNED') {
        if (vStat !== 'PLANNED' && vStat !== 'SCHEDULED') return false;
      } else if (vStat !== visitStatusFilter) {
        return false;
      }
    }
    if (visitPurposeFilter !== 'ALL' && v.purpose !== visitPurposeFilter) return false;
    if (visitStartDate && v.visitDate < visitStartDate) return false;
    if (visitEndDate && v.visitDate > visitEndDate) return false;
    return true;
  });

  // Visit Metrics
  const totalVisitsCount = scopedVisits.length;
  const completedVisitsCount = scopedVisits.filter((v) => (v.status as string) === 'COMPLETED').length;
  const upcomingVisitsCount = scopedVisits.filter((v) => {
    const st = v.status as string;
    return st === 'PLANNED' || st === 'SCHEDULED' || st === 'RESCHEDULED';
  }).length;
  const cancelledVisitsCount = scopedVisits.filter((v) => {
    const st = v.status as string;
    return st === 'CANCELLED' || st === 'NO_SHOW';
  }).length;

  const completedVisitsSorted = [...scopedVisits]
    .filter((v) => (v.status as string) === 'COMPLETED')
    .sort((a, b) => (b.visitDate || "").localeCompare(a.visitDate || ""));
  const lastVisitDate = completedVisitsSorted.length > 0 ? completedVisitsSorted[0].visitDate : 'None';

  const upcomingVisitsSorted = [...scopedVisits]
    .filter((v) => {
      const st = v.status as string;
      return st === 'PLANNED' || st === 'SCHEDULED' || st === 'RESCHEDULED';
    })
    .sort((a, b) => (a.visitDate || "").localeCompare(b.visitDate || ""));
  const nextVisitDate = upcomingVisitsSorted.length > 0 ? `${upcomingVisitsSorted[0].visitDate} (${upcomingVisitsSorted[0].startTime})` : 'None scheduled';

  // Role Scope logic for Tasks
  const scopedTasks = tasks.filter((t) => {
    if (!hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS')) {
      return t.picId === currentUser.id;
    }
    if (hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS') && currentUser.teamId) {
      const picUser = tenantUsers.find((u) => u.id === t.picId);
      return t.picId === currentUser.id || picUser?.teamId === currentUser.teamId;
    }
    return true; // Sales Manager, Tenant Admin, Super Admin
  });

  const todayISO = new Date().toISOString().split('T')[0];

  // Filtered Tasks
  const filteredTasks = scopedTasks.filter((t) => {
    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase();
      const picUser = tenantUsers.find((u) => u.id === t.picId);
      const relVisit = visits.find((v) => v.id === t.relatedVisitId);
      const relOpp = projects.find((o) => o.id === t.relatedProjectId);
      const matches =
        (t.title || "").toLowerCase().includes(q) ||
        (t.description && (t.description || "").toLowerCase().includes(q)) ||
        (t.picName || "").toLowerCase().includes(q) ||
        (picUser?.teamName && (picUser.teamName || "").toLowerCase().includes(q)) ||
        (picUser?.department && (picUser.department || "").toLowerCase().includes(q)) ||
        (relVisit && (relVisit.title || "").toLowerCase().includes(q)) ||
        (relOpp && (relOpp.name || "").toLowerCase().includes(q));
      if (!matches) return false;
    }

    if (taskStatusFilter !== 'ALL') {
      const isOverdue = t.dueDate < todayISO && t.status !== 'COMPLETED' && t.status !== 'CANCELLED';
      if (taskStatusFilter === 'OVERDUE') {
        if (!isOverdue) return false;
      } else if (taskStatusFilter === 'OPEN' || taskStatusFilter === 'TODO') {
        if (t.status !== 'TODO' && t.status !== 'IN_PROGRESS') return false;
      } else if (t.status !== taskStatusFilter) {
        return false;
      }
    }

    if (taskPriorityFilter !== 'ALL' && t.priority !== taskPriorityFilter) {
      return false;
    }

    if (taskPicFilter !== 'ALL' && t.picId !== taskPicFilter) {
      return false;
    }

    if (taskDueDateFilter && t.dueDate !== taskDueDateFilter) {
      return false;
    }

    if (taskOppFilter !== 'ALL') {
      if (taskOppFilter === 'NONE') {
        if (t.relatedProjectId) return false;
      } else if (t.relatedProjectId !== taskOppFilter) {
        return false;
      }
    }

    return true;
  });

  // Task Summary Metrics
  const totalTasksCount = scopedTasks.length;
  const openTasksCount = scopedTasks.filter((t) => t.status === 'TODO').length;
  const inProgressTasksCount = scopedTasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const completedTasksCount = scopedTasks.filter((t) => t.status === 'COMPLETED').length;
  const overdueTasksCount = scopedTasks.filter((t) => t.dueDate < todayISO && t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length;

  // Role Scope logic for Follow-ups
  const scopedFollowups = followups.filter((f) => {
    if (!hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS')) {
      return f.picId === currentUser.id;
    }
    if (hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS') && currentUser.teamId) {
      const picUser = tenantUsers.find((u) => u.id === f.picId);
      return f.picId === currentUser.id || picUser?.teamId === currentUser.teamId;
    }
    return true; // Sales Manager, Tenant Admin, Super Admin
  });

  // Filtered Follow-ups
  const filteredFollowups = scopedFollowups.filter((f) => {
    const isOverdue = f.followUpDate < todayISO && f.status !== 'COMPLETED' && f.status !== 'CANCELLED';
    if (followUpSearch.trim()) {
      const q = followUpSearch.toLowerCase();
      const relOppName = (projects.find((o) => o.id === f.relatedProjectId)?.name || "").toLowerCase() || '';
      const relVisitTitle = (visits.find((v) => v.id === f.relatedVisitId)?.title || "").toLowerCase() || '';
      const matches =
        (f.title && (f.title || "").toLowerCase().includes(q)) ||
        (f.notes && (f.notes || "").toLowerCase().includes(q)) ||
        (f.picName || "").toLowerCase().includes(q) ||
        (f.type || "").toLowerCase().includes(q) ||
        relOppName.includes(q) ||
        relVisitTitle.includes(q);
      if (!matches) return false;
    }

    if (followUpStatusFilter !== 'ALL') {
      if (followUpStatusFilter === 'OVERDUE') {
        if (!isOverdue) return false;
      } else if (followUpStatusFilter === 'PENDING') {
        if (f.status !== 'PENDING' && f.status !== 'IN_PROGRESS') return false;
      } else if (f.status !== followUpStatusFilter) {
        return false;
      }
    }

    if (followUpPriorityFilter !== 'ALL' && (f.priority || 'MEDIUM') !== followUpPriorityFilter) {
      return false;
    }

    if (followUpTypeFilter !== 'ALL') {
      const tNorm = f.type ? f.type.toUpperCase() : '';
      if (followUpTypeFilter === 'CALL' && tNorm !== 'CALL' && tNorm !== 'PHONE_CALL') return false;
      if (followUpTypeFilter === 'EMAIL' && tNorm !== 'EMAIL') return false;
      if (followUpTypeFilter === 'MEETING' && tNorm !== 'MEETING') return false;
      if (followUpTypeFilter === 'QUOTATION' && tNorm !== 'QUOTATION' && tNorm !== 'QUOTATION_FOLLOWUP') return false;
      if (followUpTypeFilter === 'PROPOSAL' && tNorm !== 'PROPOSAL' && tNorm !== 'PROPOSAL_FOLLOWUP') return false;
      if (followUpTypeFilter === 'GENERAL' && tNorm !== 'GENERAL' && tNorm !== 'GENERAL_FOLLOWUP') return false;
      if (followUpTypeFilter === 'WHATSAPP' && tNorm !== 'WHATSAPP') return false;
    }

    if (followUpPicFilter !== 'ALL' && f.picId !== followUpPicFilter) {
      return false;
    }

    if (followUpDueDateFilter && f.followUpDate !== followUpDueDateFilter) {
      return false;
    }

    if (followUpOppFilter !== 'ALL') {
      if (followUpOppFilter === 'NONE') {
        if (f.relatedProjectId) return false;
      } else if (f.relatedProjectId !== followUpOppFilter) {
        return false;
      }
    }

    return true;
  });

  // Follow-Up Summary Metrics
  const totalFollowupsCount = scopedFollowups.length;
  const pendingFollowupsCount = scopedFollowups.filter((f) => f.status === 'PENDING' || f.status === 'IN_PROGRESS').length;
  const completedFollowupsCount = scopedFollowups.filter((f) => f.status === 'COMPLETED').length;
  const overdueFollowupsCount = scopedFollowups.filter((f) => f.followUpDate < todayISO && f.status !== 'COMPLETED' && f.status !== 'CANCELLED').length;

  const upcomingFollowupsSorted = [...scopedFollowups]
    .filter((f) => (f.status === 'PENDING' || f.status === 'IN_PROGRESS') && f.followUpDate >= todayISO)
    .sort((a, b) => (a.followUpDate || "").localeCompare(b.followUpDate || ""));

  const nextFollowUpDateText = upcomingFollowupsSorted.length > 0
    ? `${upcomingFollowupsSorted[0].followUpDate}${upcomingFollowupsSorted[0].reminderDate ? ` (${(upcomingFollowupsSorted[0].reminderDate || "").split(' ')[1] || upcomingFollowupsSorted[0].reminderDate})` : ''}`
    : 'None scheduled';

  // Helper Meta Formatting Functions
  const getFollowUpTypeMeta = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'CALL':
      case 'PHONE_CALL':
      case 'PHONE CALL':
        return { label: 'Phone Call', icon: 'call', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'EMAIL':
        return { label: 'Email', icon: 'mail', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'MEETING':
        return { label: 'Meeting', icon: 'groups', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'QUOTATION':
      case 'QUOTATION_FOLLOWUP':
      case 'QUOTATION FOLLOW-UP':
        return { label: 'Quotation Follow-up', icon: 'request_quote', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'PROPOSAL':
      case 'PROPOSAL_FOLLOWUP':
      case 'PROPOSAL FOLLOW-UP':
        return { label: 'Proposal Follow-up', icon: 'description', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'GENERAL':
      case 'GENERAL_FOLLOWUP':
      case 'GENERAL FOLLOW-UP':
        return { label: 'General Follow-up', icon: 'chat_bubble', color: 'bg-slate-50 text-slate-700 border-slate-200' };
      case 'WHATSAPP':
        return { label: 'WhatsApp', icon: 'chat', color: 'bg-teal-50 text-teal-700 border-teal-200' };
      default:
        return { label: type || 'Follow-up', icon: 'flag', color: 'bg-gray-50 text-gray-700 border-gray-200' };
    }
  };

  const getFollowUpPriorityMeta = (priority?: string) => {
    switch (priority?.toUpperCase()) {
      case 'URGENT':
        return { label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-200' };
      case 'HIGH':
        return { label: 'High', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'MEDIUM':
        return { label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'LOW':
        return { label: 'Low', color: 'bg-slate-100 text-slate-600 border-slate-200' };
      default:
        return { label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-200' };
    }
  };

  const getFollowUpStatusMeta = (status: string, dueDate: string) => {
    if (status === 'COMPLETED') {
      return { label: 'Completed', color: 'bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]' };
    }
    if (status === 'CANCELLED') {
      return { label: 'Cancelled', color: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
    if (dueDate < todayISO) {
      return { label: 'Overdue', color: 'bg-[#fee2e2] text-[#b91c1c] border-[#fecaca]' };
    }
    if (status === 'IN_PROGRESS') {
      return { label: 'In Progress', color: 'bg-blue-100 text-blue-700 border-blue-200' };
    }
    return { label: 'Pending', color: 'bg-[#fef3c7] text-[#d97706] border-[#fde68a]' };
  };

  // Follow-Up Action Handlers
  const openCreateFollowUpModal = () => {
    setFollowUpTitleInput('');
    setFollowUpTypeInput('CALL');
    setFollowUpPriorityInput('HIGH');
    setFollowUpStatusInput('PENDING');
    setFollowUpDateInput(new Date().toISOString().split('T')[0]);
    setFollowUpTimeInput('09:00');
    setFollowUpPicIdInput(customer.assignedPicId || currentUser?.id || 'USR-005');
    setFollowUpRelatedOppIdInput('');
    setFollowUpRelatedVisitIdInput('');
    setFollowUpNotesInput('');
    setShowFollowUpModal(true);
  };

  const handleConfirmCreateFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    const picUser = tenantUsers.find((u) => u.id === followUpPicIdInput) || {
      id: currentUser?.id || 'USR-005',
      name: currentUser?.name || 'Budi Santoso',
      avatarUrl: currentUser?.avatarUrl,
    };

    const newFollowUp: FollowUp = {
      id: `FOL-${Date.now().toString().slice(-4)}`,
      tenantId,
      title: followUpTitleInput || `${followUpTypeInput} Follow-up`,
      customerId: customer.id,
      customerName: customer.name,
      customerCode: customer.code,
      picId: picUser.id,
      picName: picUser.name,
      picAvatar: picUser.avatarUrl,
      followUpDate: followUpDateInput,
      reminderDate: `${followUpDateInput} ${followUpTimeInput}`,
      type: followUpTypeInput,
      priority: followUpPriorityInput,
      notes: followUpNotesInput,
      status: followUpStatusInput,
      relatedProjectId: followUpRelatedOppIdInput || undefined,
      relatedVisitId: followUpRelatedVisitIdInput || undefined,
      createdAt: new Date().toISOString().split('T')[0],
    };

    DataService.saveFollowUp(newFollowUp);
    DataService.addActivity({
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      userId: currentUser?.id || 'USR-005',
      userName: currentUser?.name || 'Budi Santoso',
      type: followUpTypeInput === 'CALL' ? 'CALL' : followUpTypeInput === 'EMAIL' ? 'EMAIL' : 'NOTE',
      subject: `Follow-up Scheduled: ${newFollowUp.title}`,
      description: `Follow-up (${followUpTypeInput}) scheduled for ${followUpDateInput} by ${picUser.name}.`,
      occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    });

    refreshFollowups();
    setShowFollowUpModal(false);
  };

  const openEditFollowUpModal = (f: FollowUp) => {
    setEditingFollowUp(f);
    setFollowUpTitleInput(f.title || '');
    setFollowUpTypeInput(f.type || 'CALL');
    setFollowUpPriorityInput(f.priority || 'MEDIUM');
    setFollowUpStatusInput(f.status || 'PENDING');
    setFollowUpDateInput(f.followUpDate);
    setFollowUpTimeInput(f.reminderDate ? (f.reminderDate || "").split(' ')[1] || '09:00' : '09:00');
    setFollowUpPicIdInput(f.picId);
    setFollowUpRelatedOppIdInput(f.relatedProjectId || '');
    setFollowUpRelatedVisitIdInput(f.relatedVisitId || '');
    setFollowUpNotesInput(f.notes || '');
  };

  const handleConfirmEditFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFollowUp) return;
    const picUser = tenantUsers.find((u) => u.id === followUpPicIdInput) || {
      id: editingFollowUp.picId,
      name: editingFollowUp.picName,
      avatarUrl: editingFollowUp.picAvatar,
    };

    const updated: FollowUp = {
      ...editingFollowUp,
      title: followUpTitleInput,
      type: followUpTypeInput,
      priority: followUpPriorityInput,
      status: followUpStatusInput,
      followUpDate: followUpDateInput,
      reminderDate: `${followUpDateInput} ${followUpTimeInput}`,
      picId: picUser.id,
      picName: picUser.name,
      picAvatar: picUser.avatarUrl,
      relatedProjectId: followUpRelatedOppIdInput || undefined,
      relatedVisitId: followUpRelatedVisitIdInput || undefined,
      notes: followUpNotesInput,
      completedAt: followUpStatusInput === 'COMPLETED' ? (editingFollowUp.completedAt || todayISO) : undefined,
    };

    DataService.saveFollowUp(updated);
    DataService.addActivity({
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      userId: currentUser?.id || 'USR-005',
      userName: currentUser?.name || 'Budi Santoso',
      type: 'NOTE',
      subject: `Follow-up Updated: ${updated.title}`,
      description: `Follow-up details updated. Status: ${followUpStatusInput}, PIC: ${picUser.name}.`,
      occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    });

    refreshFollowups();
    setEditingFollowUp(null);
  };

  const openCompleteFollowUpModal = (f: FollowUp) => {
    setCompletingFollowUp(f);
    setCompleteOutcomeInput(f.outcome || '');
  };

  const handleConfirmCompleteFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingFollowUp) return;

    const updated: FollowUp = {
      ...completingFollowUp,
      status: 'COMPLETED',
      completedAt: new Date().toISOString().split('T')[0],
      outcome: completeOutcomeInput,
    };

    DataService.saveFollowUp(updated);
    DataService.addActivity({
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      userId: currentUser?.id || 'USR-005',
      userName: currentUser?.name || 'Budi Santoso',
      type: 'NOTE',
      subject: `Follow-up Completed: ${completingFollowUp.title || completingFollowUp.type}`,
      description: `Outcome: ${completeOutcomeInput || 'Completed successfully'}`,
      occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    });

    refreshFollowups();
    setCompletingFollowUp(null);
  };

  const openRescheduleFollowUpModal = (f: FollowUp) => {
    setReschedulingFollowUp(f);
    setRescheduleDateInput(f.followUpDate);
    setRescheduleTimeInput(f.reminderDate ? (f.reminderDate || "").split(' ')[1] || '10:00' : '10:00');
    setRescheduleReasonInput('');
  };

  const handleConfirmRescheduleFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingFollowUp) return;

    const updated: FollowUp = {
      ...reschedulingFollowUp,
      rescheduledFromDate: reschedulingFollowUp.followUpDate,
      followUpDate: rescheduleDateInput,
      reminderDate: `${rescheduleDateInput} ${rescheduleTimeInput}`,
      rescheduleReason: rescheduleReasonInput,
      status: 'PENDING',
    };

    DataService.saveFollowUp(updated);
    DataService.addActivity({
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      userId: currentUser?.id || 'USR-005',
      userName: currentUser?.name || 'Budi Santoso',
      type: 'NOTE',
      subject: `Follow-up Rescheduled: ${reschedulingFollowUp.title || reschedulingFollowUp.type}`,
      description: `Rescheduled from ${reschedulingFollowUp.followUpDate} to ${rescheduleDateInput}. Reason: ${rescheduleReasonInput || 'No reason provided'}`,
      occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    });

    refreshFollowups();
    setReschedulingFollowUp(null);
  };

  // Project Stage Meta Helper
  const getStageMeta = (stage: ProjectStage) => {
    switch (stage) {
      case 'LEAD':
        return { label: 'Leads', color: 'bg-blue-50 text-blue-700 border-blue-200', badgeColor: 'bg-blue-600', icon: 'filter_alt', defaultProb: 20 };
      case 'QUALIFICATION':
        return { label: 'Discuss/Follow up', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', badgeColor: 'bg-indigo-600', icon: 'psychology', defaultProb: 40 };
      case 'PROPOSAL':
        return { label: 'Proposal Sent', color: 'bg-purple-50 text-purple-700 border-purple-200', badgeColor: 'bg-purple-600', icon: 'description', defaultProb: 60 };
      case 'NEGOTIATION':
        return { label: 'Negotiation', color: 'bg-amber-50 text-amber-800 border-amber-200', badgeColor: 'bg-amber-600', icon: 'handshake', defaultProb: 80 };
      case 'WON':
        return { label: 'Won / Deal', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', badgeColor: 'bg-emerald-600', icon: 'emoji_events', defaultProb: 100 };
      case 'LOST':
        return { label: 'Lost', color: 'bg-rose-50 text-rose-800 border-rose-200', badgeColor: 'bg-rose-600', icon: 'cancel', defaultProb: 0 };
      default:
        return { label: stage, color: 'bg-slate-50 text-slate-700 border-slate-200', badgeColor: 'bg-slate-600', icon: 'grid_view', defaultProb: 50 };
    }
  };

  const getOppStatusMeta = (stage: ProjectStage) => {
    if (stage === 'WON') {
      return { label: 'WON', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: 'check_circle' };
    }
    if (stage === 'LOST') {
      return { label: 'LOST', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: 'cancel' };
    }
    return { label: 'OPEN', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: 'pending' };
  };

  // Role Scope logic for Projects
  const scopedOpps = projects.filter((o) => {
    if (!hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS')) {
      return o.picId === currentUser.id;
    }
    if (hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS') && currentUser.teamId) {
      const picUser = tenantUsers.find((u) => u.id === o.picId);
      return o.picId === currentUser.id || picUser?.teamId === currentUser.teamId;
    }
    return true; // Sales Manager, Tenant Admin, Super Admin see all
  });

  // Filtered Projects
  const filteredOpps = scopedOpps.filter((o) => {
    if (oppSearch.trim()) {
      const q = oppSearch.toLowerCase();
      const picUser = tenantUsers.find((u) => u.id === o.picId);
      const matches =
        (o.name || "").toLowerCase().includes(q) ||
        (o.picName || "").toLowerCase().includes(q) ||
        (o.source && (o.source || "").toLowerCase().includes(q)) ||
        (o.description && (o.description || "").toLowerCase().includes(q)) ||
        (picUser?.teamName && (picUser.teamName || "").toLowerCase().includes(q));
      if (!matches) return false;
    }

    if (oppStageFilter !== 'ALL') {
      if (oppStageFilter === 'OPEN') {
        if (o.stage === 'WON' || o.stage === 'LOST') return false;
      } else if (o.stage !== oppStageFilter) {
        return false;
      }
    }

    if (oppPicFilter !== 'ALL' && o.picId !== oppPicFilter) {
      return false;
    }

    return true;
  }).sort((a, b) => {
    if (oppSort === 'CLOSE_DATE_ASC') {
      return (a.expectedCloseDate || "").localeCompare(b.expectedCloseDate || "");
    }
    if (oppSort === 'CLOSE_DATE_DESC') {
      return (b.expectedCloseDate || "").localeCompare(a.expectedCloseDate || "");
    }
    if (oppSort === 'VALUE_DESC') {
      return (b.estimatedValue || 0) - (a.estimatedValue || 0);
    }
    if (oppSort === 'PROBABILITY_DESC') {
      return (b.probability || 0) - (a.probability || 0);
    }
    return 0;
  });

  // Project Summary Metrics
  const totalOppsCount = scopedOpps.length;
  const openOppsCount = scopedOpps.filter((o) => o.stage !== 'WON' && o.stage !== 'LOST').length;
  const wonOppsCount = scopedOpps.filter((o) => o.stage === 'WON').length;
  const lostOppsCount = scopedOpps.filter((o) => o.stage === 'LOST').length;

  const totalPipelineValue = scopedOpps
    .filter((o) => o.stage !== 'WON' && o.stage !== 'LOST')
    .reduce((sum, o) => sum + (o.estimatedValue || 0), 0);

  const totalExpectedRevenue = scopedOpps
    .filter((o) => o.stage !== 'LOST')
    .reduce((sum, o) => {
      const prob = o.stage === 'WON' ? 100 : (o.probability || 0);
      return sum + ((o.estimatedValue || 0) * prob) / 100;
    }, 0);

  // Project Action Handlers
  const openCreateOppModal = () => {
    setOppNameInput('');
    setOppValueInput(150000000);
    setOppStageInput('LEAD');
    setOppProbInput(20);
    setOppCloseDateInput('2026-10-31');
    setOppPicIdInput(customer.assignedPicId || currentUser?.id || 'USR-005');
    setOppSourceInput('Direct Inbound Lead');
    setOppDescInput('');
    setShowOppModal(true);
  };

  const handleConfirmCreateOpp = (e: React.FormEvent) => {
    e.preventDefault();
    const picUser = tenantUsers.find((u) => u.id === oppPicIdInput);
    const newOpp: Project = {
      id: `OPP-${Date.now().toString().slice(-4)}`,
      tenantId,
      name: oppNameInput,
      customerId: customer.id,
      customerName: customer.name,
      customerCode: customer.code,
      picId: picUser?.id || currentUser?.id || 'USR-005',
      picName: picUser?.name || currentUser?.name || 'Budi Santoso',
      picAvatar: picUser?.avatarUrl || currentUser?.avatarUrl,
      estimatedValue: oppValueInput,
      probability: oppProbInput,
      expectedCloseDate: oppCloseDateInput,
      stage: oppStageInput,
      source: oppSourceInput || 'Direct Inbound',
      description: oppDescInput,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    DataService.saveProject(newOpp);
    refreshOpps();
    setShowOppModal(false);
  };

  const openViewOppModal = (opp: Project) => {
    setViewingOpp(opp);
  };

  const openEditOppModal = (opp: Project) => {
    setEditingOpp(opp);
    setOppNameInput(opp.name);
    setOppValueInput(opp.estimatedValue);
    setOppStageInput(opp.stage);
    setOppProbInput(opp.probability);
    setOppCloseDateInput(opp.expectedCloseDate);
    setOppPicIdInput(opp.picId);
    setOppSourceInput(opp.source || 'Direct Sales');
    setOppDescInput(opp.description || '');
  };

  const handleConfirmEditOpp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOpp) return;
    const picUser = tenantUsers.find((u) => u.id === oppPicIdInput);
    const updated: Project = {
      ...editingOpp,
      name: oppNameInput,
      estimatedValue: oppValueInput,
      stage: oppStageInput,
      probability: oppProbInput,
      expectedCloseDate: oppCloseDateInput,
      picId: picUser?.id || editingOpp.picId,
      picName: picUser?.name || editingOpp.picName,
      picAvatar: picUser?.avatarUrl || editingOpp.picAvatar,
      source: oppSourceInput,
      description: oppDescInput,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    DataService.saveProject(updated);
    refreshOpps();
    setEditingOpp(null);
  };

  const openChangeStageModal = (opp: Project) => {
    setChangingStageOpp(opp);
    setNewStageInput(opp.stage);
    setNewStageProbInput(getStageMeta(opp.stage).defaultProb);
    setStageChangeNotesInput('');
  };

  const handleConfirmChangeStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!changingStageOpp) return;
    const oldStage = changingStageOpp.stage;
    const updated: Project = {
      ...changingStageOpp,
      stage: newStageInput,
      probability: newStageProbInput,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    DataService.saveProject(updated);
    DataService.addActivity({
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      userId: currentUser?.id || 'USR-005',
      userName: currentUser?.name || 'Budi Santoso',
      type: 'PROJECT',
      subject: `Stage Changed: ${updated.name}`,
      description: `Stage moved from ${oldStage} to ${newStageInput}.${stageChangeNotesInput ? ` Notes: ${stageChangeNotesInput}` : ''}`,
      occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    });

    refreshOpps();
    setChangingStageOpp(null);
  };

  const openReassignOppModal = (opp: Project) => {
    setReassigningOpp(opp);
    setNewOppPicIdInput(opp.picId);
    setReassignReasonInput('');
  };

  const handleConfirmReassignOpp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassigningOpp) return;
    const newPic = tenantUsers.find((u) => u.id === newOppPicIdInput);
    if (!newPic) return;

    const oldPicName = reassigningOpp.picName;
    const updated: Project = {
      ...reassigningOpp,
      picId: newPic.id,
      picName: newPic.name,
      picAvatar: newPic.avatarUrl,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    DataService.saveProject(updated);
    DataService.addActivity({
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      userId: currentUser?.id || 'USR-005',
      userName: currentUser?.name || 'Budi Santoso',
      type: 'PROJECT',
      subject: `Project PIC Reassigned: ${updated.name}`,
      description: `Reassigned from ${oldPicName} to ${newPic.name}.${reassignReasonInput ? ` Reason: ${reassignReasonInput}` : ''}`,
      occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    });

    refreshOpps();
    setReassigningOpp(null);
  };

  // Computed Metrics
  const totalVisits = visits.length;
  const totalTasks = tasks.length;
  const openTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length;
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const pendingFollowups = followups.filter((f) => f.status === 'PENDING' || f.status === 'IN_PROGRESS').length;
  const activeOpps = projects.filter((o) => o.stage !== 'WON' && o.stage !== 'LOST');
  const pipelineValue = activeOpps.reduce((sum, o) => sum + o.estimatedValue, 0);

  const canReassignPic = hasPermission('MANAGE_CUSTOMERS') || hasPermission('ASSIGN_TASKS');

  // Handlers
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Customer = {
      ...customer,
      name: editName,
      code: editCode,
      type: editType,
      status: editStatus,
      phone: editPhone,
      email: editEmail,
      region: editRegion,
      address: editAddress,
    };
    DataService.saveCustomer(updated);
    setCustomer(updated);
    setShowEditCustomerModal(false);
  };

  const handleChangePic = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedUser = tenantUsers.find((u) => u.id === selectedPicId);
    if (!selectedUser) return;

    const updated: Customer = {
      ...customer,
      assignedPicId: selectedUser.id,
      assignedPicName: selectedUser.name,
      assignedPicAvatar: selectedUser.avatarUrl,
      teamId: selectedUser.teamId || customer.teamId,
      teamName: selectedUser.teamName || customer.teamName,
    };

    DataService.saveCustomer(updated);
    DataService.addActivity({
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      userId: currentUser?.id || 'USR-001',
      userName: currentUser?.name || 'Admin',
      type: 'SYSTEM',
      subject: 'Primary PIC Reassigned',
      description: `Primary PIC reassigned to ${selectedUser.name} (${selectedUser.roleName}).`,
      occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    });

    setCustomer(updated);
    setShowChangePicModal(false);
  };

  const handleCreateVisit = (e: React.FormEvent) => {
    e.preventDefault();
    const newVisit: Visit = {
      id: `VIS-${Date.now().toString().slice(-4)}`,
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      customerCode: customer.code,
      picId: currentUser?.id || 'USR-005',
      picName: currentUser?.name || 'Budi Santoso',
      picAvatar: currentUser?.avatarUrl,
      title: visitTitle,
      purpose: visitPurpose,
      visitDate,
      startTime,
      endTime,
      location,
      status: 'PLANNED',
      createdAt: new Date().toISOString().split('T')[0],
    };

    DataService.saveVisit(newVisit);
    refreshVisits();
    setShowVisitModal(false);
    setVisitTitle('');
  };

  const openEditVisitModal = (v: Visit) => {
    setEditingVisit(v);
    setEditVisitTitle(v.title);
    setEditVisitPurpose(v.purpose);
    setEditVisitLocation(v.location);
    setEditVisitStatus(v.status);
    setEditVisitResult(v.result || '');
    setEditVisitNextAction(v.nextAction || '');
  };

  const handleSaveEditVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVisit) return;
    const updated: Visit = {
      ...editingVisit,
      title: editVisitTitle,
      purpose: editVisitPurpose,
      location: editVisitLocation,
      status: editVisitStatus,
      result: editVisitResult,
      nextAction: editVisitNextAction,
    };
    DataService.saveVisit(updated);
    refreshVisits();
    setEditingVisit(null);
  };

  const openRescheduleVisitModal = (v: Visit) => {
    setReschedulingVisit(v);
    setRescheduleDate(v.visitDate);
    setRescheduleStartTime(v.startTime);
    setRescheduleEndTime(v.endTime);
    setRescheduleReason('');
  };

  const handleConfirmReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingVisit) return;
    const updated: Visit = {
      ...reschedulingVisit,
      visitDate: rescheduleDate,
      startTime: rescheduleStartTime,
      endTime: rescheduleEndTime,
      status: 'RESCHEDULED',
      notes: rescheduleReason ? `Rescheduled: ${rescheduleReason}` : reschedulingVisit.notes,
    };
    DataService.saveVisit(updated);
    DataService.addActivity({
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      userId: currentUser?.id || 'USR-005',
      userName: currentUser?.name || 'Budi Santoso',
      type: 'VISIT',
      subject: `Visit Rescheduled: ${updated.title}`,
      description: `Visit rescheduled to ${rescheduleDate} (${rescheduleStartTime}). Reason: ${rescheduleReason || 'Schedule adjustment'}`,
      occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    });
    refreshVisits();
    setReschedulingVisit(null);
  };

  const openCancelVisitModal = (v: Visit) => {
    setCancellingVisit(v);
    setCancelReason('');
  };

  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingVisit) return;
    const updated: Visit = {
      ...cancellingVisit,
      status: 'CANCELLED',
      notes: cancelReason ? `Cancelled: ${cancelReason}` : cancellingVisit.notes,
    };
    DataService.saveVisit(updated);
    DataService.addActivity({
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      userId: currentUser?.id || 'USR-005',
      userName: currentUser?.name || 'Budi Santoso',
      type: 'VISIT',
      subject: `Visit Cancelled: ${updated.title}`,
      description: `Visit cancelled. Reason: ${cancelReason || 'Client request'}`,
      occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    });
    refreshVisits();
    setCancellingVisit(null);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const assignedUser = tenantUsers.find((u) => u.id === (taskPicId || currentUser?.id || 'USR-005'));
    const newTask: Task = {
      id: `TSK-${Math.floor(1000 + Math.random() * 9000)}`,
      tenantId,
      title: taskTitle,
      description: taskDescription,
      customerId: customer.id,
      customerName: customer.name,
      customerCode: customer.code,
      picId: assignedUser?.id || currentUser?.id || 'USR-005',
      picName: assignedUser?.name || currentUser?.name || 'Budi Santoso',
      picAvatar: assignedUser?.avatarUrl,
      priority: taskPriority,
      status: 'TODO',
      dueDate: taskDueDate,
      createdAt: new Date().toISOString().split('T')[0],
      relatedVisitId: taskRelatedVisitId || undefined,
      relatedProjectId: taskRelatedOppId || undefined,
    };

    DataService.saveTask(newTask);
    DataService.addActivity({
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      userId: currentUser?.id || 'USR-005',
      userName: currentUser?.name || 'Budi Santoso',
      type: 'TASK',
      subject: `New Task Created: ${newTask.title}`,
      description: `Task assigned to ${newTask.picName}. Due date: ${newTask.dueDate}. Priority: ${newTask.priority}`,
      occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    });

    refreshTasks();
    setShowTaskModal(false);
    setTaskTitle('');
    setTaskDescription('');
    setTaskPicId('');
    setTaskRelatedVisitId('');
    setTaskRelatedOppId('');
  };

  const handleToggleCompleteTask = (t: Task) => {
    const isCompleted = t.status === 'COMPLETED';
    const updatedStatus: TaskStatus = isCompleted ? 'TODO' : 'COMPLETED';
    const updated: Task = {
      ...t,
      status: updatedStatus,
      completedAt: isCompleted ? undefined : new Date().toISOString().split('T')[0],
    };
    DataService.saveTask(updated);
    DataService.addActivity({
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      userId: currentUser?.id || 'USR-005',
      userName: currentUser?.name || 'Budi Santoso',
      type: 'TASK',
      subject: `Task ${isCompleted ? 'Reopened' : 'Completed'}: ${t.title}`,
      description: `Task status updated to ${updatedStatus}.`,
      occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    });
    refreshTasks();
  };

  const openEditTaskModal = (t: Task) => {
    setEditingTask(t);
    setEditTaskTitle(t.title);
    setEditTaskDescription(t.description || '');
    setEditTaskPriority(t.priority);
    setEditTaskStatus(t.status);
    setEditTaskDueDate(t.dueDate);
    setEditTaskPicId(t.picId);
    setEditTaskRelatedVisitId(t.relatedVisitId || '');
    setEditTaskRelatedOppId(t.relatedProjectId || '');
  };

  const handleSaveEditTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    const assignedUser = tenantUsers.find((u) => u.id === editTaskPicId);
    const updated: Task = {
      ...editingTask,
      title: editTaskTitle,
      description: editTaskDescription,
      priority: editTaskPriority,
      status: editTaskStatus,
      dueDate: editTaskDueDate,
      picId: assignedUser?.id || editingTask.picId,
      picName: assignedUser?.name || editingTask.picName,
      picAvatar: assignedUser?.avatarUrl || editingTask.picAvatar,
      relatedVisitId: editTaskRelatedVisitId || undefined,
      relatedProjectId: editTaskRelatedOppId || undefined,
      completedAt: editTaskStatus === 'COMPLETED' ? (editingTask.completedAt || new Date().toISOString().split('T')[0]) : undefined,
    };
    DataService.saveTask(updated);
    refreshTasks();
    setEditingTask(null);
  };

  const openReassignTaskModal = (t: Task) => {
    setReassigningTask(t);
    setReassignSearch('');
    const firstOther = tenantUsers.find((u) => u.id !== t.picId);
    setReassignTaskPicId(firstOther ? firstOther.id : t.picId);
  };

  const handleConfirmReassignTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassigningTask) return;
    const newPic = tenantUsers.find((u) => u.id === reassignTaskPicId);
    if (!newPic) return;

    const updated: Task = {
      ...reassigningTask,
      picId: newPic.id,
      picName: newPic.name,
      picAvatar: newPic.avatarUrl,
    };

    DataService.saveTask(updated);
    DataService.addActivity({
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      userId: currentUser?.id || 'USR-005',
      userName: currentUser?.name || 'Budi Santoso',
      type: 'TASK',
      subject: `Task Ownership Reassigned: ${reassigningTask.title}`,
      description: `Task PIC reassigned from ${reassigningTask.picName} to ${newPic.name} (${newPic.teamName || 'Sales Team'}).`,
      occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    });

    refreshTasks();
    setReassigningTask(null);
  };



  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const existingNotes = customer.notes ? `${customer.notes}\n---\n${newNoteText}` : newNoteText;
    const updated: Customer = {
      ...customer,
      notes: existingNotes,
    };

    DataService.saveCustomer(updated);
    DataService.addActivity({
      tenantId,
      customerId: customer.id,
      customerName: customer.name,
      userId: currentUser?.id || 'USR-005',
      userName: currentUser?.name || 'Budi Santoso',
      type: 'NOTE',
      subject: 'Customer Note Added',
      description: newNoteText,
      occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    });

    setCustomer(updated);
    setNewNoteText('');
    setShowNoteModal(false);
  };

  const primaryContact = customer.contacts?.[0] || {
    name: 'Hendra Wijaya',
    position: 'Procurement Director',
    email: customer.email,
    phone: customer.phone,
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif]">
      {/* Back Link */}
      <div>
        <Link to="/customers" className="text-xs text-[#767587] hover:text-[#1a1c1c] flex items-center gap-1 font-medium">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Customer Directory</span>
        </Link>
      </div>

      {/* CUSTOMER HEADER */}
      <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#4744e5] text-white font-extrabold text-2xl flex items-center justify-center font-['Hanken_Grotesk'] shadow-sm">
            {(customer.name || "C").substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                {customer.name}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                customer.status === 'ACTIVE' || customer.status === 'CUSTOMER'
                  ? 'bg-[#00C875]/10 text-[#008f53]'
                  : 'bg-[#ffcc00]/20 text-[#8f7000]'
              }`}>
                {customer.status}
              </span>
              <span className="px-2 py-0.5 bg-[#eff4ff] text-[#4744e5] rounded text-[10px] font-bold">
                {customer.type}
              </span>
            </div>

            {/* Sub-header info strip */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#767587] mt-1.5">
              <span className="font-mono font-bold text-[#1a1c1c]">{customer.code}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">person</span>
                <span>PIC: <strong className="text-[#1a1c1c]">{customer.assignedPicName}</strong></span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">phone</span>
                <span>{customer.phone}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                <span>{customer.region}</span>
              </span>
              <span>•</span>
              <span>Since: {customer.createdAt}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSelectedPicId(customer.assignedPicId);
              setShowChangePicModal(true);
            }}
            className="px-3 py-1.5 bg-white border border-[#E1E1E1] text-[#1a1c1c] font-semibold text-xs rounded-lg hover:bg-[#f3f3f3] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">manage_accounts</span>
            <span>Change PIC</span>
          </button>

          <button
            onClick={() => setShowVisitModal(true)}
            className="px-3 py-1.5 bg-[#4744e5] text-white font-bold text-xs rounded-lg hover:bg-[#2c24ce] shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">route</span>
            <span>Create Visit</span>
          </button>

          <button
            onClick={() => setShowTaskModal(true)}
            className="px-3 py-1.5 bg-white border border-[#E1E1E1] text-[#1a1c1c] font-semibold text-xs rounded-lg hover:border-[#4744e5] hover:text-[#4744e5] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">task_alt</span>
            <span>Create Task</span>
          </button>

          <button
            onClick={() => setShowFollowUpModal(true)}
            className="px-3 py-1.5 bg-white border border-[#E1E1E1] text-[#1a1c1c] font-semibold text-xs rounded-lg hover:border-[#4744e5] hover:text-[#4744e5] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">schedule_send</span>
            <span>Create Follow-up</span>
          </button>

          <button
            onClick={() => setShowOppModal(true)}
            className="px-3 py-1.5 bg-white border border-[#E1E1E1] text-[#1a1c1c] font-semibold text-xs rounded-lg hover:border-[#4744e5] hover:text-[#4744e5] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">monetization_on</span>
            <span>Create Project</span>
          </button>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="border-b border-[#E1E1E1] flex gap-6 overflow-x-auto pb-0">
        {[
          { id: 'overview', label: 'Overview', count: null },
          { id: 'visits', label: 'Visits', count: visits.length },
          { id: 'tasks', label: 'Tasks', count: tasks.length },
          { id: 'followups', label: 'Follow-ups', count: followups.length },
          { id: 'projects', label: 'Projects', count: projects.length },
          { id: 'activities', label: 'Activities', count: activities.length },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`pb-3 text-xs font-bold font-['Hanken_Grotesk'] transition-colors relative whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === t.id ? 'text-[#4744e5]' : 'text-[#767587] hover:text-[#1a1c1c]'
            }`}
          >
            <span>{t.label}</span>
            {t.count !== null && (
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                activeTab === t.id ? 'bg-[#e1dfff] text-[#09006b]' : 'bg-[#f3f3f3] text-[#1a1c1c]'
              }`}>
                {t.count}
              </span>
            )}
            {activeTab === t.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4744e5] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB CONTENT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* SECTION 1 — CUSTOMER SUMMARY & SECTION 2 — KEY METRICS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SECTION 1: Customer Summary Card */}
            <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E1E1E1] pb-3">
                <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#4744e5]">apartment</span>
                  <span>Customer Summary</span>
                </h2>
                <span className="text-[10px] font-mono text-[#767587]">{customer.code}</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#767587] font-medium">Customer Type</span>
                  <span className="font-bold text-[#1a1c1c] bg-[#f3f3f3] px-2 py-0.5 rounded">{customer.type}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#767587] font-medium">Status</span>
                  <span className="font-bold text-[#008f53] bg-[#00C875]/10 px-2 py-0.5 rounded-full text-[10px]">
                    {customer.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#767587] font-medium">Primary PIC</span>
                  <div className="flex items-center gap-1.5 font-bold text-[#4744e5]">
                    {customer.assignedPicAvatar && (
                      <img src={customer.assignedPicAvatar} alt="" className="w-4 h-4 rounded-full" />
                    )}
                    <span>{customer.assignedPicName}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#767587] font-medium">Department / Team</span>
                  <span className="font-semibold text-[#1a1c1c]">{customer.teamName || 'Sales West'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#767587] font-medium">Customer Since</span>
                  <span className="font-medium text-[#1a1c1c]">{customer.createdAt}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#767587] font-medium">Last Activity</span>
                  <span className="font-medium text-[#1a1c1c]">{customer.lastVisitAt || 'Recent'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#767587] font-medium">Next Follow-up</span>
                  <span className="font-bold text-[#4744e5]">{customer.nextFollowUpAt || '15 Aug 2026'}</span>
                </div>
                <div className="pt-2 border-t border-[#E1E1E1]">
                  <span className="text-[#767587] font-medium block mb-1">Location / Region</span>
                  <span className="text-[#1a1c1c] font-medium">{customer.address} ({customer.region})</span>
                </div>
              </div>
            </div>

            {/* SECTION 2: Key Metrics Cards */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#767587]">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Total Visits</span>
                  <span className="material-symbols-outlined text-[20px] text-[#4744e5]">route</span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">{totalVisits}</span>
                  <p className="text-[10px] text-[#767587] mt-0.5">Recorded visits</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#767587]">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Open Tasks</span>
                  <span className="material-symbols-outlined text-[20px] text-[#f59e0b]">task_alt</span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">{openTasks}</span>
                  <p className="text-[10px] text-[#767587] mt-0.5">{completedTasks} completed</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#767587]">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Pending Follow-ups</span>
                  <span className="material-symbols-outlined text-[20px] text-[#6366f1]">event_repeat</span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">{pendingFollowups}</span>
                  <p className="text-[10px] text-[#767587] mt-0.5">Scheduled actions</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#767587]">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Active Opps</span>
                  <span className="material-symbols-outlined text-[20px] text-[#10b981]">monetization_on</span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">{activeOpps.length}</span>
                  <p className="text-[10px] text-[#767587] mt-0.5">Deals in pipeline</p>
                </div>
              </div>

              {/* Banner Metric: Pipeline Value */}
              <div className="col-span-2 sm:col-span-4 bg-gradient-to-r from-[#4744e5] to-[#2c24ce] p-5 rounded-xl text-white shadow-xs flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 block">
                    Total Project Value (Pipeline)
                  </span>
                  <span className="text-2xl sm:text-3xl font-extrabold font-['Hanken_Grotesk'] block mt-0.5">
                    Rp {pipelineValue.toLocaleString('id-ID')}
                  </span>
                  <span className="text-xs opacity-90 mt-1 block">
                    Based on {activeOpps.length} active projects belonging to {customer.name}
                  </span>
                </div>
                <button
                  onClick={() => setShowOppModal(true)}
                  className="px-3.5 py-2 bg-white text-[#4744e5] font-bold text-xs rounded-lg hover:bg-opacity-90 transition-colors shadow-xs cursor-pointer whitespace-nowrap"
                >
                  + Add Deal
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 3 — CUSTOMER CONTACT */}
          <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E1E1E1] pb-3">
              <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#4744e5]">contacts</span>
                <span>Main Contact Person</span>
              </h2>
              <span className="px-2 py-0.5 bg-[#4744e5]/10 text-[#4744e5] text-[10px] font-bold rounded">
                Primary Contact
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="space-y-1">
                <span className="text-base font-bold text-[#1a1c1c] block">{primaryContact.name}</span>
                <span className="text-xs text-[#767587] font-medium block">{primaryContact.position}</span>
                <span className="text-xs text-[#464555] block font-mono">{primaryContact.phone}</span>
                <span className="text-xs text-[#4744e5] block font-semibold">{primaryContact.email}</span>
              </div>

              <div className="space-y-1 md:border-l md:border-r border-[#E1E1E1] md:px-4">
                <span className="text-xs font-bold text-[#1a1c1c] block mb-1">Office Address</span>
                <p className="text-xs text-[#767587] leading-relaxed">{customer.address}</p>
                <span className="text-xs text-[#1a1c1c] font-semibold block">{customer.region}</span>
              </div>

              <div className="flex flex-wrap md:flex-col gap-2 justify-center">
                <a
                  href={`tel:${primaryContact.phone}`}
                  className="flex-1 md:flex-none px-3 py-1.5 bg-[#f3f3f3] hover:bg-[#e1dfff] text-[#1a1c1c] hover:text-[#09006b] font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">call</span>
                  <span>Call Contact</span>
                </a>
                <a
                  href={`mailto:${primaryContact.email}`}
                  className="flex-1 md:flex-none px-3 py-1.5 bg-[#f3f3f3] hover:bg-[#e1dfff] text-[#1a1c1c] hover:text-[#09006b] font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">mail</span>
                  <span>Send Email</span>
                </a>
              </div>
            </div>
          </div>

          {/* SECTION 4 & 5 — RECENT ACTIVITIES & UPCOMING ACTIVITIES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SECTION 4: Recent Activities Timeline */}
            <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E1E1E1] pb-3">
                <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#4744e5]">history</span>
                  <span>Recent Activities Timeline</span>
                </h2>
                <button
                  onClick={() => setActiveTab('activities')}
                  className="text-xs font-bold text-[#4744e5] hover:underline cursor-pointer"
                >
                  View All
                </button>
              </div>

              <div className="space-y-3">
                {activities.slice(0, 4).map((act) => (
                  <div key={act.id} className="p-3 bg-[#f9f9f9] rounded-lg border border-[#E1E1E1] text-xs flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#4744e5]/10 text-[#4744e5] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px]">
                        {act.type === 'VISIT' ? 'route' : act.type === 'CALL' ? 'call' : act.type === 'NOTE' ? 'edit_note' : 'task_alt'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-[#1a1c1c]">{act.subject}</span>
                        <span className="text-[10px] text-[#767587] font-mono">{act.occurredAt}</span>
                      </div>
                      <p className="text-[11px] text-[#767587] mt-0.5">{act.description}</p>
                      <span className="text-[10px] text-[#4744e5] font-semibold mt-1 block">By {act.userName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 5: Upcoming Activities */}
            <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E1E1E1] pb-3">
                <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#4744e5]">event_upcoming</span>
                  <span>Upcoming Schedule & Tasks</span>
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowVisitModal(true)}
                    className="text-xs font-bold text-[#4744e5] hover:underline cursor-pointer"
                  >
                    + Visit
                  </button>
                  <button
                    onClick={() => setShowTaskModal(true)}
                    className="text-xs font-bold text-[#4744e5] hover:underline cursor-pointer"
                  >
                    + Task
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {visits.filter((v) => v.status === 'PLANNED').map((v) => (
                  <div key={v.id} className="p-3 bg-[#e1dfff]/30 rounded-lg border border-[#c1beff] text-xs flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-[#4744e5] text-white text-[9px] font-bold rounded">VISIT</span>
                        <span className="font-bold text-[#1a1c1c]">{v.title}</span>
                      </div>
                      <span className="text-[11px] text-[#767587] mt-1 block">Date: {v.visitDate} ({v.startTime}) • PIC: {v.picName}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-[#00C875]/10 text-[#008f53] text-[10px] font-bold rounded-full">
                      {v.status}
                    </span>
                  </div>
                ))}

                {tasks.filter((t) => t.status !== 'COMPLETED').map((t) => (
                  <div key={t.id} className="p-3 bg-[#f9f9f9] rounded-lg border border-[#E1E1E1] text-xs flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-[#f59e0b] text-white text-[9px] font-bold rounded">TASK</span>
                        <span className="font-bold text-[#1a1c1c]">{t.title}</span>
                      </div>
                      <span className="text-[11px] text-[#767587] mt-1 block">Due: {t.dueDate} • Assigned: {t.picName}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-[#ba1a1a]/10 text-[#ba1a1a] text-[10px] font-bold rounded">
                      {t.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 6 — ACTIVE PROJECTS */}
          <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E1E1E1] pb-3">
              <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#4744e5]">monetization_on</span>
                <span>Active Projects</span>
              </h2>
              <button
                onClick={() => setActiveTab('projects')}
                className="text-xs font-bold text-[#4744e5] hover:underline cursor-pointer"
              >
                View Projects Tab →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E1E1E1] text-[#767587] font-bold">
                    <th className="py-2 px-3">PROJECT</th>
                    <th className="py-2 px-3">STAGE</th>
                    <th className="py-2 px-3">PIC</th>
                    <th className="py-2 px-3">EXPECTED CLOSE</th>
                    <th className="py-2 px-3">ESTIMATED VALUE</th>
                    <th className="py-2 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E1E1]">
                  {projects.map((opp) => (
                    <tr key={opp.id} className="hover:bg-[#f9f9f9]">
                      <td className="py-3 px-3 font-bold text-[#1a1c1c]">{opp.name}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-[#4744e5]/10 text-[#4744e5] text-[10px] font-bold rounded">
                          {opp.stage}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#464555] font-medium">{opp.picName}</td>
                      <td className="py-3 px-3 text-[#767587]">{opp.expectedCloseDate}</td>
                      <td className="py-3 px-3 font-bold text-[#008f53]">
                        Rp {(opp.estimatedValue || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setActiveTab('projects')}
                          className="px-2.5 py-1 bg-[#f3f3f3] hover:bg-[#e1dfff] text-[#1a1c1c] hover:text-[#09006b] rounded font-semibold text-[11px] cursor-pointer"
                        >
                          View Deal
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 7 — RECENT VISITS */}
          <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E1E1E1] pb-3">
              <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#4744e5]">route</span>
                <span>Recent Customer Visits</span>
              </h2>
              <button
                onClick={() => setActiveTab('visits')}
                className="text-xs font-bold text-[#4744e5] hover:underline cursor-pointer"
              >
                View Visits Tab →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E1E1E1] text-[#767587] font-bold">
                    <th className="py-2 px-3">VISIT DATE</th>
                    <th className="py-2 px-3">PIC</th>
                    <th className="py-2 px-3">PURPOSE</th>
                    <th className="py-2 px-3">RESULT / NOTES</th>
                    <th className="py-2 px-3">STATUS</th>
                    <th className="py-2 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E1E1]">
                  {visits.map((vis) => (
                    <tr key={vis.id} className="hover:bg-[#f9f9f9]">
                      <td className="py-3 px-3 font-semibold text-[#1a1c1c] whitespace-nowrap">
                        {vis.visitDate} ({vis.startTime})
                      </td>
                      <td className="py-3 px-3 font-medium text-[#464555]">{vis.picName}</td>
                      <td className="py-3 px-3 font-bold text-[#1a1c1c]">{vis.title}</td>
                      <td className="py-3 px-3 text-[#767587]">{vis.result || vis.purpose}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-[#00C875]/10 text-[#008f53] text-[10px] font-bold rounded-full">
                          {vis.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setActiveTab('visits')}
                          className="px-2.5 py-1 bg-[#f3f3f3] hover:bg-[#e1dfff] text-[#1a1c1c] hover:text-[#09006b] rounded font-semibold text-[11px] cursor-pointer"
                        >
                          View Visit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 8 — CUSTOMER NOTES */}
          <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E1E1E1] pb-3">
              <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#4744e5]">sticky_note_2</span>
                <span>Customer Notes & Key Insights</span>
              </h2>
              <button
                onClick={() => setShowNoteModal(true)}
                className="px-3 py-1.5 bg-[#4744e5] text-white font-bold text-xs rounded-lg hover:bg-[#2c24ce] cursor-pointer"
              >
                + Add Note
              </button>
            </div>

            <div className="p-4 bg-[#f9f9f9] rounded-lg border border-[#E1E1E1] text-xs leading-relaxed text-[#1a1c1c] whitespace-pre-wrap">
              {customer.notes || 'No customer notes recorded yet.'}
            </div>
          </div>
        </div>
      )}

      {/* TABS OTHER THAN OVERVIEW */}
      {activeTab === 'visits' && (
        <div className="space-y-6">
          {/* VISITS TAB HEADER & ACTION */}
          <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4744e5]">route</span>
                <h2 className="text-lg font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Customer Visit Records & Schedule</h2>
              </div>
              <p className="text-xs text-[#767587] mt-0.5">
                Complete log of sales presentations, technical site audits, and upcoming client visits for {customer.name}.
              </p>
            </div>
            <button
              onClick={() => setShowVisitModal(true)}
              className="px-4 py-2 bg-[#4744e5] hover:bg-[#3834d0] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors self-start md:self-auto"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Schedule New Visit</span>
            </button>
          </div>

          {/* VISIT SUMMARY METRICS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-xs">
              <span className="text-[11px] font-semibold text-[#767587] block uppercase tracking-wider">Total Visits</span>
              <span className="text-xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1 block">
                {totalVisitsCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#00C875]/30 shadow-xs bg-[#00C875]/5">
              <span className="text-[11px] font-semibold text-[#008f53] block uppercase tracking-wider">Completed</span>
              <span className="text-xl font-extrabold text-[#008f53] font-['Hanken_Grotesk'] mt-1 block">
                {completedVisitsCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#4744e5]/30 shadow-xs bg-[#4744e5]/5">
              <span className="text-[11px] font-semibold text-[#4744e5] block uppercase tracking-wider">Upcoming</span>
              <span className="text-xl font-extrabold text-[#4744e5] font-['Hanken_Grotesk'] mt-1 block">
                {upcomingVisitsCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#ba1a1a]/30 shadow-xs bg-[#ba1a1a]/5">
              <span className="text-[11px] font-semibold text-[#ba1a1a] block uppercase tracking-wider">Cancelled</span>
              <span className="text-xl font-extrabold text-[#ba1a1a] font-['Hanken_Grotesk'] mt-1 block">
                {cancelledVisitsCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-xs">
              <span className="text-[11px] font-semibold text-[#767587] block uppercase tracking-wider">Last Visit</span>
              <span className="text-xs font-bold text-[#1a1c1c] mt-1 block truncate">
                {lastVisitDate}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-xs">
              <span className="text-[11px] font-semibold text-[#767587] block uppercase tracking-wider">Next Visit</span>
              <span className="text-xs font-bold text-[#4744e5] mt-1 block truncate">
                {nextVisitDate}
              </span>
            </div>
          </div>

          {/* FILTERS SECTION */}
          <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#1a1c1c] uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#767587]">filter_list</span>
                <span>Filter Visit History</span>
              </span>
              {(visitSearch || visitPicFilter !== 'ALL' || visitStatusFilter !== 'ALL' || visitPurposeFilter !== 'ALL' || visitStartDate || visitEndDate) && (
                <button
                  onClick={() => {
                    setVisitSearch('');
                    setVisitPicFilter('ALL');
                    setVisitStatusFilter('ALL');
                    setVisitPurposeFilter('ALL');
                    setVisitStartDate('');
                    setVisitEndDate('');
                  }}
                  className="text-xs text-[#4744e5] hover:underline font-bold cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {/* Search */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#767587] text-[16px]">search</span>
                <input
                  type="text"
                  placeholder="Search visit title, notes..."
                  value={visitSearch}
                  onChange={(e) => setVisitSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-[#E1E1E1] rounded-lg bg-white"
                />
              </div>

              {/* PIC Filter */}
              <div>
                <select
                  value={visitPicFilter}
                  onChange={(e) => setVisitPicFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-medium"
                >
                  <option value="ALL">All Sales PIC</option>
                  {tenantUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={visitStatusFilter}
                  onChange={(e) => setVisitStatusFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PLANNED">Scheduled / Planned</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="RESCHEDULED">Rescheduled</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="NO_SHOW">No Show</option>
                </select>
              </div>

              {/* Purpose Filter */}
              <div>
                <select
                  value={visitPurposeFilter}
                  onChange={(e) => setVisitPurposeFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-medium"
                >
                  <option value="ALL">All Purposes</option>
                  <option value="Product Presentation & Demo">Product Presentation & Demo</option>
                  <option value="Contract Renewal Negotiation">Contract Renewal Negotiation</option>
                  <option value="Routine Checking & Relationship">Routine Checking & Relationship</option>
                  <option value="Price Negotiation">Price Negotiation</option>
                  <option value="Onsite Technical Audit">Onsite Technical Audit</option>
                </select>
              </div>

              {/* Date Range Start & End */}
              <div className="flex gap-1">
                <input
                  type="date"
                  value={visitStartDate}
                  onChange={(e) => setVisitStartDate(e.target.value)}
                  className="w-1/2 px-1.5 py-1.5 border border-[#E1E1E1] rounded-lg text-[11px]"
                  title="From Date"
                />
                <input
                  type="date"
                  value={visitEndDate}
                  onChange={(e) => setVisitEndDate(e.target.value)}
                  className="w-1/2 px-1.5 py-1.5 border border-[#E1E1E1] rounded-lg text-[11px]"
                  title="To Date"
                />
              </div>
            </div>
          </div>

          {/* VISITS ENTERPRISE TABLE */}
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E1E1E1] flex justify-between items-center bg-[#fcfcfc]">
              <span className="text-xs font-bold text-[#1a1c1c]">
                Showing {filteredVisits.length} of {scopedVisits.length} visits
              </span>
              <span className="text-[11px] text-[#767587]">
                Scope: {!hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS') ? 'Own Visits' : hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS') ? 'Team Scope' : 'Organization Scope'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f9f9f9] border-b border-[#E1E1E1] text-[10px] font-extrabold uppercase text-[#767587]">
                  <tr>
                    <th className="py-3 px-4">Visit Date & Time</th>
                    <th className="py-3 px-4">Sales PIC</th>
                    <th className="py-3 px-4">Purpose & Subject</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Result / Notes</th>
                    <th className="py-3 px-4">Next Action</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E1E1]">
                  {filteredVisits.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#767587]">
                        No visits found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredVisits.map((v) => (
                      <tr key={v.id} className="hover:bg-[#fcfcfc] transition-colors">
                        {/* Visit Date & Time */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-bold text-[#1a1c1c] block">{v.visitDate}</span>
                          <span className="text-[11px] text-[#767587] flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[13px]">schedule</span>
                            <span>{v.startTime} - {v.endTime}</span>
                          </span>
                        </td>

                        {/* PIC */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#4744e5]/10 text-[#4744e5] font-bold text-[10px] flex items-center justify-center">
                              {(v.picName || "U").charAt(0)}
                            </div>
                            <span className="font-semibold text-[#1a1c1c]">{v.picName}</span>
                          </div>
                        </td>

                        {/* Purpose & Subject */}
                        <td className="py-3 px-4">
                          <span className="font-bold text-[#1a1c1c] block text-xs">{v.title}</span>
                          <span className="text-[10px] font-bold text-[#4744e5] bg-[#4744e5]/5 px-2 py-0.5 rounded inline-block mt-0.5">
                            {v.purpose}
                          </span>
                          {v.location && (
                            <span className="text-[11px] text-[#767587] flex items-center gap-1 mt-1">
                              <span className="material-symbols-outlined text-[12px]">location_on</span>
                              <span className="truncate max-w-[200px]">{v.location}</span>
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {renderVisitStatusBadge(v.status)}
                        </td>

                        {/* Result */}
                        <td className="py-3 px-4 max-w-[220px]">
                          {v.result ? (
                            <p className="text-[11px] text-[#1a1c1c] line-clamp-2">{v.result}</p>
                          ) : (
                            <span className="text-[11px] text-[#a0a0a0] italic">No result recorded</span>
                          )}
                        </td>

                        {/* Next Action */}
                        <td className="py-3 px-4 max-w-[180px]">
                          {v.nextAction ? (
                            <span className="text-[11px] text-[#008f53] font-medium block bg-[#00C875]/10 px-2 py-1 rounded">
                              {v.nextAction}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#a0a0a0] italic">N/A</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setViewingVisit(v)}
                              title="View Visit Details"
                              className="p-1.5 hover:bg-[#f0f0f0] rounded text-[#464555] hover:text-[#1a1c1c] cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </button>

                            <button
                              onClick={() => openEditVisitModal(v)}
                              title="Edit Visit"
                              className="p-1.5 hover:bg-[#e1dfff] rounded text-[#4744e5] cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>

                            <button
                              onClick={() => openRescheduleVisitModal(v)}
                              title="Reschedule Visit"
                              className="p-1.5 hover:bg-[#fef3c7] rounded text-[#d97706] cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">event_repeat</span>
                            </button>

                            {v.status !== 'CANCELLED' && (
                              <button
                                onClick={() => openCancelVisitModal(v)}
                                title="Cancel Visit"
                                className="p-1.5 hover:bg-[#fee2e2] rounded text-[#ba1a1a] cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]">block</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-6">
          {/* TASKS TAB HEADER & ACTION */}
          <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4744e5]">check_box</span>
                <h2 className="text-lg font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Customer Sales Tasks & Action Items</h2>
              </div>
              <p className="text-xs text-[#767587] mt-0.5">
                Track follow-ups, deliverable deadlines, PIC ownership, and task links to visits and deal projects for {customer.name}.
              </p>
            </div>
            <button
              onClick={() => {
                setTaskPicId(customer.assignedPicId || currentUser?.id || 'USR-005');
                setShowTaskModal(true);
              }}
              className="px-4 py-2 bg-[#4744e5] hover:bg-[#3834d0] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors self-start md:self-auto"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Create New Task</span>
            </button>
          </div>

          {/* TASK SUMMARY METRICS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-xs">
              <span className="text-[11px] font-semibold text-[#767587] block uppercase tracking-wider">Total Tasks</span>
              <span className="text-xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1 block">
                {totalTasksCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#f59e0b]/30 shadow-xs bg-[#f59e0b]/5">
              <span className="text-[11px] font-semibold text-[#d97706] block uppercase tracking-wider">Open Tasks</span>
              <span className="text-xl font-extrabold text-[#d97706] font-['Hanken_Grotesk'] mt-1 block">
                {openTasksCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#3b82f6]/30 shadow-xs bg-[#3b82f6]/5">
              <span className="text-[11px] font-semibold text-[#2563eb] block uppercase tracking-wider">In Progress</span>
              <span className="text-xl font-extrabold text-[#2563eb] font-['Hanken_Grotesk'] mt-1 block">
                {inProgressTasksCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#00C875]/30 shadow-xs bg-[#00C875]/5">
              <span className="text-[11px] font-semibold text-[#008f53] block uppercase tracking-wider">Completed</span>
              <span className="text-xl font-extrabold text-[#008f53] font-['Hanken_Grotesk'] mt-1 block">
                {completedTasksCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#ba1a1a]/30 shadow-xs bg-[#ba1a1a]/5 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-[#ba1a1a] block uppercase tracking-wider">Overdue</span>
              <span className="text-xl font-extrabold text-[#ba1a1a] font-['Hanken_Grotesk'] mt-1 block">
                {overdueTasksCount}
              </span>
            </div>
          </div>

          {/* TASK FILTERS SECTION */}
          <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#1a1c1c] uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#767587]">filter_list</span>
                <span>Filter Tasks</span>
              </span>
              {(taskSearch || taskStatusFilter !== 'ALL' || taskPriorityFilter !== 'ALL' || taskPicFilter !== 'ALL' || taskDueDateFilter || taskOppFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setTaskSearch('');
                    setTaskStatusFilter('ALL');
                    setTaskPriorityFilter('ALL');
                    setTaskPicFilter('ALL');
                    setTaskDueDateFilter('');
                    setTaskOppFilter('ALL');
                  }}
                  className="text-xs text-[#4744e5] hover:underline font-bold cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              {/* Search */}
              <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#767587] text-[16px]">search</span>
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-[#E1E1E1] rounded-lg bg-white"
                />
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={taskStatusFilter}
                  onChange={(e) => setTaskStatusFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="OPEN">Open (To Do)</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <select
                  value={taskPriorityFilter}
                  onChange={(e) => setTaskPriorityFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-medium"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="URGENT">Urgent</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              {/* PIC Filter */}
              <div>
                <select
                  value={taskPicFilter}
                  onChange={(e) => setTaskPicFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-medium"
                >
                  <option value="ALL">All Assigned PICs</option>
                  {tenantUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date Filter */}
              <div>
                <input
                  type="date"
                  value={taskDueDateFilter}
                  onChange={(e) => setTaskDueDateFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white text-[11px]"
                  title="Filter by Exact Due Date"
                />
              </div>

              {/* Related Project Filter */}
              <div>
                <select
                  value={taskOppFilter}
                  onChange={(e) => setTaskOppFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-medium truncate"
                >
                  <option value="ALL">All Related Deals</option>
                  <option value="NONE">No Project</option>
                  {projects.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* TASK TABLE */}
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E1E1E1] flex justify-between items-center bg-[#fcfcfc]">
              <span className="text-xs font-bold text-[#1a1c1c]">
                Showing {filteredTasks.length} of {scopedTasks.length} tasks
              </span>
              <span className="text-[11px] text-[#767587]">
                Scope: {!hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS') ? 'Own Tasks' : hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS') ? 'Team Scope' : 'Organization Scope'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f9f9f9] border-b border-[#E1E1E1] text-[10px] font-extrabold uppercase text-[#767587]">
                  <tr>
                    <th className="py-3 px-4">Task Details</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">PIC & Ownership</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Related Visit</th>
                    <th className="py-3 px-4">Related Project</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E1E1]">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#767587]">
                        No tasks found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((t) => {
                      const picUser = tenantUsers.find((u) => u.id === t.picId);
                      const relVisit = visits.find((v) => v.id === t.relatedVisitId);
                      const relOpp = projects.find((o) => o.id === t.relatedProjectId);
                      const isOverdue = t.dueDate < todayISO && t.status !== 'COMPLETED' && t.status !== 'CANCELLED';

                      return (
                        <tr key={t.id} className="hover:bg-[#fcfcfc] transition-colors">
                          {/* Task Title & Desc */}
                          <td className="py-3 px-4 max-w-[240px]">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] font-mono bg-[#f0f0f0] px-1.5 py-0.5 rounded text-[#767587]">
                                #{t.id}
                              </span>
                              <span className="font-bold text-[#1a1c1c] text-xs line-clamp-1">{t.title}</span>
                            </div>
                            {t.description && (
                              <p className="text-[11px] text-[#767587] line-clamp-2 mt-0.5">{t.description}</p>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {renderTaskStatusBadge(t.status, t.dueDate)}
                          </td>

                          {/* Priority */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {renderTaskPriorityBadge(t.priority)}
                          </td>

                          {/* PIC Ownership */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {t.picAvatar ? (
                                <img src={t.picAvatar} alt={t.picName} className="w-7 h-7 rounded-full object-cover border border-[#E1E1E1]" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-[#4744e5]/10 text-[#4744e5] font-bold text-[10px] flex items-center justify-center">
                                  {(t.picName || "U").charAt(0)}
                                </div>
                              )}
                              <div>
                                <span className="font-bold text-[#1a1c1c] block text-xs">{t.picName}</span>
                                <div className="flex items-center gap-1 text-[10px] text-[#767587] mt-0.5">
                                  <span className="bg-[#f0f0f0] px-1 py-0.2 rounded font-medium">
                                    {picUser?.teamName || picUser?.teamId || customer.teamName || 'Sales Team'}
                                  </span>
                                  <span>•</span>
                                  <span>{picUser?.department || picUser?.roleName || 'Sales'}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Due Date */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span className={`material-symbols-outlined text-[14px] ${isOverdue ? 'text-[#ba1a1a]' : 'text-[#767587]'}`}>
                                {isOverdue ? 'warning' : 'event'}
                              </span>
                              <span className={`font-semibold ${isOverdue ? 'text-[#ba1a1a] font-bold' : 'text-[#1a1c1c]'}`}>
                                {t.dueDate}
                              </span>
                            </div>
                          </td>

                          {/* Related Visit */}
                          <td className="py-3 px-4 max-w-[160px]">
                            {relVisit ? (
                              <span className="text-[11px] text-[#4744e5] font-semibold bg-[#4744e5]/5 px-2 py-1 rounded inline-flex items-center gap-1 truncate max-w-full">
                                <span className="material-symbols-outlined text-[13px]">route</span>
                                <span className="truncate">{relVisit.title}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#a0a0a0] italic">—</span>
                            )}
                          </td>

                          {/* Related Project */}
                          <td className="py-3 px-4 max-w-[160px]">
                            {relOpp ? (
                              <span className="text-[11px] text-[#008f53] font-semibold bg-[#00C875]/10 px-2 py-1 rounded inline-flex items-center gap-1 truncate max-w-full">
                                <span className="material-symbols-outlined text-[13px]">monetization_on</span>
                                <span className="truncate">{relOpp.name}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#a0a0a0] italic">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Quick Complete Button */}
                              <button
                                onClick={() => handleToggleCompleteTask(t)}
                                title={t.status === 'COMPLETED' ? 'Mark as Incomplete' : 'Mark as Complete'}
                                className={`p-1.5 rounded cursor-pointer transition-colors ${
                                  t.status === 'COMPLETED'
                                    ? 'bg-[#00C875]/20 text-[#008f53]'
                                    : 'hover:bg-[#00C875]/10 text-[#767587] hover:text-[#008f53]'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  {t.status === 'COMPLETED' ? 'check_circle' : 'radio_button_unchecked'}
                                </span>
                              </button>

                              {/* View Task */}
                              <button
                                onClick={() => setViewingTask(t)}
                                title="View Task Details"
                                className="p-1.5 hover:bg-[#f0f0f0] rounded text-[#464555] hover:text-[#1a1c1c] cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]">visibility</span>
                              </button>

                              {/* Edit Task */}
                              <button
                                onClick={() => openEditTaskModal(t)}
                                title="Edit Task"
                                className="p-1.5 hover:bg-[#e1dfff] rounded text-[#4744e5] cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>

                              {/* Reassign PIC */}
                              {canReassignPic && (
                                <button
                                  onClick={() => openReassignTaskModal(t)}
                                  title="Reassign Task Ownership (PIC)"
                                  className="p-1.5 hover:bg-[#fef3c7] rounded text-[#d97706] cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[18px]">person_switch</span>
                                </button>
                              )}
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
      )}

      {activeTab === 'followups' && (
        <div className="space-y-6">
          {/* SUMMARY CARDS METRICS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
              <div className="flex justify-between items-center text-[#767587] text-xs font-semibold mb-1">
                <span>Total Follow-ups</span>
                <span className="material-symbols-outlined text-[18px] text-[#4744e5]">format_list_bulleted</span>
              </div>
              <div className="text-2xl font-black text-[#1a1c1c]">{totalFollowupsCount}</div>
              <div className="text-[10px] text-[#767587] mt-1">Scope: {currentUser?.role?.replace('_', ' ')}</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
              <div className="flex justify-between items-center text-[#767587] text-xs font-semibold mb-1">
                <span>Pending</span>
                <span className="material-symbols-outlined text-[18px] text-[#d97706]">pending_actions</span>
              </div>
              <div className="text-2xl font-black text-[#d97706]">{pendingFollowupsCount}</div>
              <div className="text-[10px] text-[#767587] mt-1">Awaiting action or in progress</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
              <div className="flex justify-between items-center text-[#767587] text-xs font-semibold mb-1">
                <span>Completed</span>
                <span className="material-symbols-outlined text-[18px] text-[#15803d]">check_circle</span>
              </div>
              <div className="text-2xl font-black text-[#15803d]">{completedFollowupsCount}</div>
              <div className="text-[10px] text-[#767587] mt-1">Successfully closed follow-ups</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
              <div className="flex justify-between items-center text-[#767587] text-xs font-semibold mb-1">
                <span>Overdue</span>
                <span className="material-symbols-outlined text-[18px] text-[#b91c1c]">error</span>
              </div>
              <div className="text-2xl font-black text-[#b91c1c]">{overdueFollowupsCount}</div>
              <div className="text-[10px] text-[#767587] mt-1">Requires urgent rescheduling</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-2xs">
              <div className="flex justify-between items-center text-[#767587] text-xs font-semibold mb-1">
                <span>Next Follow-up</span>
                <span className="material-symbols-outlined text-[18px] text-[#4744e5]">event_upcoming</span>
              </div>
              <div className="text-sm font-bold text-[#1a1c1c] truncate mt-1">{nextFollowUpDateText}</div>
              <div className="text-[10px] text-[#767587] mt-1">Upcoming scheduled engagement</div>
            </div>
          </div>

          {/* MAIN FOLLOW-UP LIST CONTAINER */}
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-2xs overflow-hidden">
            {/* CONTAINER HEADER & ACTIONS */}
            <div className="p-4 sm:p-5 border-b border-[#E1E1E1] flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h2 className="text-base font-bold text-[#1a1c1c] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#4744e5]">mark_chat_read</span>
                  Follow-ups Activity Log
                </h2>
                <p className="text-xs text-[#767587] mt-0.5">
                  Manage and track all customer interactions, calls, quotes, proposals, and scheduled engagements.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={openCreateFollowUpModal}
                  className="px-4 py-2 bg-[#4744e5] hover:bg-[#3b38d4] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Create Follow-up
                </button>
              </div>
            </div>

            {/* FILTERS & SEARCH BAR */}
            <div className="p-4 border-b border-[#E1E1E1] bg-white space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
                {/* Search */}
                <div className="lg:col-span-2 relative">
                  <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[#767587] text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={followUpSearch}
                    onChange={(e) => setFollowUpSearch(e.target.value)}
                    placeholder="Search follow-up, notes, PIC..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#E1E1E1] rounded-lg text-xs focus:ring-1 focus:ring-[#4744e5] outline-none"
                  />
                </div>

                {/* Filter Type */}
                <div>
                  <select
                    value={followUpTypeFilter}
                    onChange={(e) => setFollowUpTypeFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E1E1E1] rounded-lg text-xs font-medium text-[#1a1c1c] outline-none"
                  >
                    <option value="ALL">All Types</option>
                    <option value="CALL">Phone Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Meeting</option>
                    <option value="QUOTATION">Quotation Follow-up</option>
                    <option value="PROPOSAL">Proposal Follow-up</option>
                    <option value="GENERAL">General Follow-up</option>
                    <option value="WHATSAPP">WhatsApp</option>
                  </select>
                </div>

                {/* Filter Priority */}
                <div>
                  <select
                    value={followUpPriorityFilter}
                    onChange={(e) => setFollowUpPriorityFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E1E1E1] rounded-lg text-xs font-medium text-[#1a1c1c] outline-none"
                  >
                    <option value="ALL">All Priorities</option>
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                {/* Filter Status */}
                <div>
                  <select
                    value={followUpStatusFilter}
                    onChange={(e) => setFollowUpStatusFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E1E1E1] rounded-lg text-xs font-medium text-[#1a1c1c] outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending / In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="OVERDUE">Overdue</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                {/* Filter PIC */}
                <div>
                  <select
                    value={followUpPicFilter}
                    onChange={(e) => setFollowUpPicFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E1E1E1] rounded-lg text-xs font-medium text-[#1a1c1c] outline-none"
                  >
                    <option value="ALL">All PICs</option>
                    {tenantUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Related Project */}
                <div>
                  <select
                    value={followUpOppFilter}
                    onChange={(e) => setFollowUpOppFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E1E1E1] rounded-lg text-xs font-medium text-[#1a1c1c] outline-none"
                  >
                    <option value="ALL">All Projects</option>
                    <option value="NONE">No Project</option>
                    {projects.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(followUpSearch ||
                followUpStatusFilter !== 'ALL' ||
                followUpPriorityFilter !== 'ALL' ||
                followUpTypeFilter !== 'ALL' ||
                followUpPicFilter !== 'ALL' ||
                followUpDueDateFilter ||
                followUpOppFilter !== 'ALL') && (
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-[#767587]">
                    Showing <strong className="text-[#1a1c1c]">{filteredFollowups.length}</strong> of {scopedFollowups.length} follow-ups
                  </span>
                  <button
                    onClick={() => {
                      setFollowUpSearch('');
                      setFollowUpStatusFilter('ALL');
                      setFollowUpPriorityFilter('ALL');
                      setFollowUpTypeFilter('ALL');
                      setFollowUpPicFilter('ALL');
                      setFollowUpDueDateFilter('');
                      setFollowUpOppFilter('ALL');
                    }}
                    className="text-[#4744e5] hover:underline font-semibold text-xs flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                    Reset Filters
                  </button>
                </div>
              )}
            </div>

            {/* TABLE LIST */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E1E1E1] text-[11px] font-bold text-[#767587] uppercase tracking-wider">
                    <th className="py-3 px-4">Follow-up</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">PIC</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Related Project</th>
                    <th className="py-3 px-4">Related Visit</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E1E1] text-xs text-[#1a1c1c]">
                  {filteredFollowups.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-[#767587]">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">mark_chat_read</span>
                        <p className="font-semibold text-sm">No follow-ups match your filter criteria.</p>
                        <p className="text-xs text-slate-400 mt-1">Try resetting filters or schedule a new follow-up.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredFollowups.map((f) => {
                      const typeMeta = getFollowUpTypeMeta(f.type);
                      const priorityMeta = getFollowUpPriorityMeta(f.priority);
                      const statusMeta = getFollowUpStatusMeta(f.status, f.followUpDate);
                      const picUser = tenantUsers.find((u) => u.id === f.picId);
                      const relOpp = projects.find((o) => o.id === f.relatedProjectId);
                      const relVisit = visits.find((v) => v.id === f.relatedVisitId);

                      return (
                        <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Follow-up Title & Notes */}
                          <td className="py-3.5 px-4 max-w-[220px]">
                            <div className="font-bold text-[#1a1c1c] text-xs truncate">
                              {f.title || `${typeMeta.label}`}
                            </div>
                            {f.notes && (
                              <div className="text-[11px] text-[#767587] line-clamp-1 mt-0.5" title={f.notes}>
                                {f.notes}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-400 mt-0.5">ID: {f.id}</div>
                          </td>

                          {/* Type */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${typeMeta.color}`}>
                              <span className="material-symbols-outlined text-[14px]">{typeMeta.icon}</span>
                              {typeMeta.label}
                            </span>
                          </td>

                          {/* PIC */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {f.picAvatar ? (
                                <img src={f.picAvatar} alt={f.picName} className="w-6 h-6 rounded-full object-cover border border-slate-200" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-[#4744e5]/10 text-[#4744e5] flex items-center justify-center font-bold text-[10px]">
                                  {f.picName?.substring(0, 2).toUpperCase() || 'PC'}
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-xs text-[#1a1c1c]">{f.picName}</div>
                                <div className="text-[10px] text-[#767587]">
                                  {picUser?.teamName || picUser?.role?.replace('_', ' ') || 'Sales Team'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Due Date */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-semibold text-xs text-[#1a1c1c]">{f.followUpDate}</div>
                            {f.reminderDate && (
                              <div className="text-[10px] text-[#767587] flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">schedule</span>
                                {(f.reminderDate || "").split(' ')[1] || f.reminderDate}
                              </div>
                            )}
                          </td>

                          {/* Priority */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityMeta.color}`}>
                              {priorityMeta.label}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.color}`}>
                              {statusMeta.label}
                            </span>
                          </td>

                          {/* Related Project */}
                          <td className="py-3.5 px-4 max-w-[160px]">
                            {relOpp ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4744e5] bg-[#4744e5]/10 px-2 py-1 rounded-md border border-[#4744e5]/20 truncate">
                                <span className="material-symbols-outlined text-[13px]">monetization_on</span>
                                <span className="truncate">{relOpp.name}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px] font-normal">-</span>
                            )}
                          </td>

                          {/* Related Visit */}
                          <td className="py-3.5 px-4 max-w-[160px]">
                            {relVisit ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 truncate">
                                <span className="material-symbols-outlined text-[13px]">place</span>
                                <span className="truncate">{relVisit.title}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px] font-normal">-</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {/* View Details */}
                              <button
                                onClick={() => setViewingFollowUp(f)}
                                title="View Details"
                                className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]">visibility</span>
                              </button>

                              {/* Complete Follow-up */}
                              {f.status !== 'COMPLETED' && (
                                <button
                                  onClick={() => openCompleteFollowUpModal(f)}
                                  title="Mark Completed"
                                  className="p-1.5 hover:bg-[#dcfce7] rounded text-[#15803d] transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                </button>
                              )}

                              {/* Reschedule */}
                              {f.status !== 'COMPLETED' && (
                                <button
                                  onClick={() => openRescheduleFollowUpModal(f)}
                                  title="Reschedule Date"
                                  className="p-1.5 hover:bg-[#fef3c7] rounded text-[#d97706] transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[18px]">update</span>
                                </button>
                              )}

                              {/* Edit Follow-up */}
                              <button
                                onClick={() => openEditFollowUpModal(f)}
                                title="Edit Follow-up"
                                className="p-1.5 hover:bg-[#e1dfff] rounded text-[#4744e5] transition-colors cursor-pointer"
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
      )}

      {activeTab === 'projects' && (
        <div className="space-y-6">
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Projects */}
            <div className="p-4 bg-white rounded-xl border border-[#E1E1E1] shadow-xs space-y-1">
              <span className="text-[10px] font-bold tracking-wider text-[#767587] uppercase block">Total Projects</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-extrabold text-[#1a1c1c]">{totalOppsCount}</span>
                <span className="material-symbols-outlined text-[#4744e5] text-lg">insights</span>
              </div>
            </div>

            {/* Open Projects */}
            <div className="p-4 bg-white rounded-xl border border-[#E1E1E1] shadow-xs space-y-1">
              <span className="text-[10px] font-bold tracking-wider text-[#767587] uppercase block">Open Projects</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-extrabold text-blue-600">{openOppsCount}</span>
                <span className="material-symbols-outlined text-blue-600 text-lg">pending</span>
              </div>
            </div>

            {/* Won */}
            <div className="p-4 bg-white rounded-xl border border-[#E1E1E1] shadow-xs space-y-1">
              <span className="text-[10px] font-bold tracking-wider text-[#767587] uppercase block">Closed Won</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-extrabold text-emerald-600">{wonOppsCount}</span>
                <span className="material-symbols-outlined text-emerald-600 text-lg">emoji_events</span>
              </div>
            </div>

            {/* Lost */}
            <div className="p-4 bg-white rounded-xl border border-[#E1E1E1] shadow-xs space-y-1">
              <span className="text-[10px] font-bold tracking-wider text-[#767587] uppercase block">Closed Lost</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-extrabold text-rose-600">{lostOppsCount}</span>
                <span className="material-symbols-outlined text-rose-600 text-lg">cancel</span>
              </div>
            </div>

            {/* Pipeline Value */}
            <div className="p-4 bg-white rounded-xl border border-[#E1E1E1] shadow-xs space-y-1 col-span-2 md:col-span-1 lg:col-span-1">
              <span className="text-[10px] font-bold tracking-wider text-[#767587] uppercase block">Pipeline Value</span>
              <div className="text-sm font-extrabold text-[#1a1c1c] truncate" title={`Rp ${totalPipelineValue.toLocaleString('id-ID')}`}>
                Rp {totalPipelineValue >= 1000000000 ? `${(totalPipelineValue / 1000000000).toFixed(2)}B` : `${(totalPipelineValue / 1000000).toFixed(0)}M`}
              </div>
              <div className="text-[10px] text-[#767587]">Sum of open deals</div>
            </div>

            {/* Expected Revenue */}
            <div className="p-4 bg-white rounded-xl border border-[#E1E1E1] shadow-xs space-y-1 col-span-2 md:col-span-1 lg:col-span-1">
              <span className="text-[10px] font-bold tracking-wider text-[#767587] uppercase block">Expected Revenue</span>
              <div className="text-sm font-extrabold text-emerald-700 truncate" title={`Rp ${totalExpectedRevenue.toLocaleString('id-ID')}`}>
                Rp {totalExpectedRevenue >= 1000000000 ? `${(totalExpectedRevenue / 1000000000).toFixed(2)}B` : `${(totalExpectedRevenue / 1000000).toFixed(0)}M`}
              </div>
              <div className="text-[10px] text-emerald-800">Weighted probability</div>
            </div>
          </div>

          {/* COMPACT PIPELINE VISUALIZATION */}
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xs p-5 space-y-3">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1a1c1c] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#4744e5]">account_tree</span>
                Sales Project Pipeline
              </h3>
              <span className="text-[11px] text-[#767587]">Click stage to filter view</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {(['LEAD', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as ProjectStage[]).map((stage) => {
                const meta = getStageMeta(stage);
                const stageDeals = scopedOpps.filter((o) => o.stage === stage);
                const stageVal = stageDeals.reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
                const isSelected = oppStageFilter === stage;

                return (
                  <button
                    key={stage}
                    onClick={() => setOppStageFilter(isSelected ? 'ALL' : stage)}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected ? 'ring-2 ring-[#4744e5] border-[#4744e5] bg-[#4744e5]/5 shadow-xs' : 'bg-slate-50 hover:bg-slate-100/80 border-[#E1E1E1]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${meta.color}`}>
                        <span className="material-symbols-outlined text-[12px]">{meta.icon}</span>
                        {meta.label}
                      </span>
                      <span className="text-xs font-extrabold text-[#1a1c1c] bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {stageDeals.length}
                      </span>
                    </div>

                    <div className="mt-2">
                      <div className="text-[11px] font-extrabold text-[#1a1c1c] truncate">
                        Rp {stageVal >= 1000000000 ? `${(stageVal / 1000000000).toFixed(1)}B` : `${(stageVal / 1000000).toFixed(0)}M`}
                      </div>
                      <div className="text-[9px] text-[#767587]">
                        {stage === 'WON' ? '100% prob' : stage === 'LOST' ? '0% prob' : `Avg ~${meta.defaultProb}% prob`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TABLE & CONTROLS */}
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xs space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1E1E1] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1a1c1c]">Projects List</h3>
                <p className="text-[11px] text-[#767587]">Active sales pipeline for {customer.name}</p>
              </div>

              <button
                onClick={openCreateOppModal}
                className="px-3.5 py-2 bg-[#4744e5] hover:bg-[#3b38d4] text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                Create Project
              </button>
            </div>

            {/* FILTERS BAR */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
              {/* Search */}
              <div className="relative col-span-1 sm:col-span-2 lg:col-span-2">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#767587] text-[18px]">search</span>
                <input
                  type="text"
                  placeholder="Search project name, PIC, source..."
                  value={oppSearch}
                  onChange={(e) => setOppSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                />
              </div>

              {/* Stage Filter */}
              <div>
                <select
                  value={oppStageFilter}
                  onChange={(e) => setOppStageFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-medium text-xs"
                >
                  <option value="ALL">All Stages</option>
                  <option value="OPEN">Open Deals Only</option>
                  <option value="LEAD">Leads</option>
                  <option value="QUALIFICATION">Discuss/Follow up</option>
                  <option value="PROPOSAL">Proposal Sent</option>
                  <option value="NEGOTIATION">Negotiation</option>
                  <option value="WON">Won / Deal</option>
                  <option value="LOST">Lost</option>
                </select>
              </div>

              {/* PIC Filter */}
              <div>
                <select
                  value={oppPicFilter}
                  onChange={(e) => setOppPicFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-medium text-xs"
                >
                  <option value="ALL">All PICs</option>
                  {tenantUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div>
                <select
                  value={oppSort}
                  onChange={(e) => setOppSort(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-medium text-xs"
                >
                  <option value="CLOSE_DATE_ASC">Close Date (Earliest)</option>
                  <option value="CLOSE_DATE_DESC">Close Date (Latest)</option>
                  <option value="VALUE_DESC">Deal Value (Highest)</option>
                  <option value="PROBABILITY_DESC">Probability (Highest)</option>
                </select>
              </div>
            </div>

            {/* DATA TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E1E1E1] bg-slate-50/80 text-[#767587]">
                    <th className="py-2.5 px-3 font-bold">Project Name</th>
                    <th className="py-2.5 px-3 font-bold">Stage</th>
                    <th className="py-2.5 px-3 font-bold">PIC</th>
                    <th className="py-2.5 px-3 font-bold">Probability</th>
                    <th className="py-2.5 px-3 font-bold">Expected Close</th>
                    <th className="py-2.5 px-3 font-bold">Project Value</th>
                    <th className="py-2.5 px-3 font-bold">Status</th>
                    <th className="py-2.5 px-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E1E1]">
                  {filteredOpps.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#767587]">
                        <span className="material-symbols-outlined text-3xl mb-1 block">grid_off</span>
                        No project deals found matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOpps.map((o) => {
                      const stageMeta = getStageMeta(o.stage);
                      const statusMeta = getOppStatusMeta(o.stage);
                      const isPastClose = o.stage !== 'WON' && o.stage !== 'LOST' && o.expectedCloseDate < todayISO;
                      const weightedVal = (o.estimatedValue * o.probability) / 100;

                      return (
                        <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3">
                            <button
                              onClick={() => openViewOppModal(o)}
                              className="font-bold text-[#1a1c1c] hover:text-[#4744e5] text-left block cursor-pointer"
                            >
                              {o.name}
                            </button>
                            <div className="text-[10px] text-[#767587] flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono">{o.id}</span>
                              <span>•</span>
                              <span>{o.source || 'Direct Sales'}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${stageMeta.color}`}>
                              <span className="material-symbols-outlined text-[13px]">{stageMeta.icon}</span>
                              {stageMeta.label}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              {o.picAvatar ? (
                                <img src={o.picAvatar} alt={o.picName} className="w-6 h-6 rounded-full object-cover border border-slate-200" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-[#4744e5]/10 text-[#4744e5] font-bold flex items-center justify-center text-[10px]">
                                  {(o.picName || "U").substring(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span className="font-medium text-[#1a1c1c]">{o.picName}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="space-y-1 w-24">
                              <div className="flex justify-between text-[11px] font-bold text-[#1a1c1c]">
                                <span>{o.probability}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full ${
                                    o.stage === 'WON' ? 'bg-emerald-500' : o.stage === 'LOST' ? 'bg-rose-400' : 'bg-[#4744e5]'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, o.probability))}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className={`font-medium ${isPastClose ? 'text-amber-700 font-bold' : 'text-[#1a1c1c]'}`}>
                              {o.expectedCloseDate}
                            </div>
                            {isPastClose && (
                              <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                Overdue Close
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-extrabold text-[#008f53]">
                              Rp {(o.estimatedValue || 0).toLocaleString('id-ID')}
                            </div>
                            <div className="text-[10px] text-[#767587]">
                              Weighted: Rp {weightedVal.toLocaleString('id-ID')}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.color}`}>
                              <span className="material-symbols-outlined text-[12px]">{statusMeta.icon}</span>
                              {statusMeta.label}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* View Details */}
                              <button
                                onClick={() => openViewOppModal(o)}
                                title="View Project Details"
                                className="p-1.5 hover:bg-slate-100 rounded text-[#767587] hover:text-[#1a1c1c] transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]">visibility</span>
                              </button>

                              {/* Change Stage */}
                              <button
                                onClick={() => openChangeStageModal(o)}
                                title="Change Stage"
                                className="p-1.5 hover:bg-indigo-50 rounded text-indigo-700 transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]">alt_route</span>
                              </button>

                              {/* Reassign PIC */}
                              <button
                                onClick={() => openReassignOppModal(o)}
                                title="Reassign PIC"
                                className="p-1.5 hover:bg-amber-50 rounded text-amber-800 transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]">person_switch</span>
                              </button>

                              {/* Edit Project */}
                              <button
                                onClick={() => openEditOppModal(o)}
                                title="Edit Project"
                                className="p-1.5 hover:bg-[#e1dfff] rounded text-[#4744e5] transition-colors cursor-pointer"
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
      )}

      {activeTab === 'activities' && (
        <div className="space-y-5">
          {/* Top Summary & Category Quick Filters */}
          <div className="bg-white rounded-xl border border-[#E1E1E1] p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E1E1E1] pb-4">
              <div>
                <h2 className="text-base font-bold text-[#1a1c1c] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#4744e5]">history</span>
                  Customer Activity Timeline
                </h2>
                <p className="text-xs text-[#767587] mt-0.5">
                  Complete chronological interaction history for {customer.name} ({customer.code})
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-3 py-1 bg-slate-100 text-[#1a1c1c] font-bold rounded-lg border border-slate-200">
                  Total Logged: <strong className="text-[#4744e5]">{scopedCustomerActivities.length}</strong>
                </span>
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-200">
                  Showing: <strong>{filteredCustomerActivities.length}</strong>
                </span>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[#767587] font-bold text-[11px] uppercase mr-1">Quick Filters:</span>

              <button
                type="button"
                onClick={() => setActCategoryFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  actCategoryFilter === 'ALL'
                    ? 'bg-[#4744e5] text-white shadow-xs'
                    : 'bg-slate-100 text-[#767587] hover:bg-slate-200'
                }`}
              >
                <span>All Activities</span>
                <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px]">{scopedCustomerActivities.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setActCategoryFilter('VISIT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  actCategoryFilter === 'VISIT'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">directions_car</span>
                <span>Visits</span>
                <span className="px-1.5 py-0.2 bg-blue-200/50 rounded text-[10px]">
                  {scopedCustomerActivities.filter((i) => i.category === 'VISIT').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActCategoryFilter('TASK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  actCategoryFilter === 'TASK'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">task_alt</span>
                <span>Tasks</span>
                <span className="px-1.5 py-0.2 bg-emerald-200/50 rounded text-[10px]">
                  {scopedCustomerActivities.filter((i) => i.category === 'TASK').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActCategoryFilter('FOLLOWUP')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  actCategoryFilter === 'FOLLOWUP'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">call</span>
                <span>Follow-ups</span>
                <span className="px-1.5 py-0.2 bg-amber-200/50 rounded text-[10px]">
                  {scopedCustomerActivities.filter((i) => i.category === 'FOLLOWUP').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActCategoryFilter('PROJECT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  actCategoryFilter === 'PROJECT'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">add_chart</span>
                <span>Projects</span>
                <span className="px-1.5 py-0.2 bg-purple-200/50 rounded text-[10px]">
                  {scopedCustomerActivities.filter((i) => i.category === 'PROJECT').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActCategoryFilter('CUSTOMER')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  actCategoryFilter === 'CUSTOMER'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">domain</span>
                <span>Customer Records</span>
                <span className="px-1.5 py-0.2 bg-indigo-200/50 rounded text-[10px]">
                  {scopedCustomerActivities.filter((i) => i.category === 'CUSTOMER').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActCategoryFilter('SYSTEM')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  actCategoryFilter === 'SYSTEM'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">history</span>
                <span>System Logs</span>
                <span className="px-1.5 py-0.2 bg-slate-200/50 rounded text-[10px]">
                  {scopedCustomerActivities.filter((i) => i.category === 'SYSTEM').length}
                </span>
              </button>
            </div>

            {/* Detailed Controls Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
              {/* Search */}
              <div className="relative lg:col-span-2">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-[18px] text-[#767587]">
                  search
                </span>
                <input
                  type="text"
                  value={actSearch}
                  onChange={(e) => setActSearch(e.target.value)}
                  placeholder="Search activity subject, user, description, or record ID..."
                  className="w-full pl-8 pr-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-[#4744e5]"
                />
                {actSearch && (
                  <button
                    type="button"
                    onClick={() => setActSearch('')}
                    className="absolute right-2 top-2 text-[#767587] hover:text-[#1a1c1c]"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>

              {/* User Select */}
              <div>
                <select
                  value={actUserFilter}
                  onChange={(e) => setActUserFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg text-xs bg-slate-50 focus:bg-white font-medium"
                >
                  <option value="ALL">All Sales PICs</option>
                  {tenantUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range Select */}
              <div>
                <select
                  value={actDateRangeFilter}
                  onChange={(e) => setActDateRangeFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg text-xs bg-slate-50 focus:bg-white font-medium"
                >
                  <option value="ALL">All Date Ranges</option>
                  <option value="TODAY">Today</option>
                  <option value="LAST_7_DAYS">Last 7 Days</option>
                  <option value="LAST_30_DAYS">Last 30 Days</option>
                  <option value="CUSTOM">Custom Range</option>
                </select>
              </div>

              {/* Reset Filters */}
              {(actCategoryFilter !== 'ALL' || actUserFilter !== 'ALL' || actDateRangeFilter !== 'ALL' || actSearch) && (
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setActCategoryFilter('ALL');
                      setActUserFilter('ALL');
                      setActDateRangeFilter('ALL');
                      setActStartDate('');
                      setActEndDate('');
                      setActSearch('');
                    }}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200 flex items-center gap-1 cursor-pointer w-full justify-center"
                  >
                    <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                    Reset Filters
                  </button>
                </div>
              )}
            </div>

            {/* Custom Date Pickers */}
            {actDateRangeFilter === 'CUSTOM' && (
              <div className="flex items-center gap-3 pt-2 border-t border-[#E1E1E1] text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#767587]">From:</span>
                  <input
                    type="date"
                    value={actStartDate}
                    onChange={(e) => setActStartDate(e.target.value)}
                    className="px-2.5 py-1 border border-[#E1E1E1] rounded-lg text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#767587]">To:</span>
                  <input
                    type="date"
                    value={actEndDate}
                    onChange={(e) => setActEndDate(e.target.value)}
                    className="px-2.5 py-1 border border-[#E1E1E1] rounded-lg text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Timeline List */}
          <div className="bg-white rounded-xl border border-[#E1E1E1] p-6 shadow-xs">
            {filteredCustomerActivities.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-[#767587]">
                  <span className="material-symbols-outlined text-2xl">history_toggle_off</span>
                </div>
                <h3 className="text-sm font-bold text-[#1a1c1c]">No Activities Found</h3>
                <p className="text-xs text-[#767587] max-w-sm mx-auto">
                  No interaction activity history matches your selected criteria for this customer account.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActCategoryFilter('ALL');
                    setActUserFilter('ALL');
                    setActDateRangeFilter('ALL');
                    setActSearch('');
                  }}
                  className="px-3.5 py-1.5 bg-[#4744e5] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6 py-2">
                {filteredCustomerActivities.map((act) => (
                  <div key={act.id} className="relative group">
                    {/* Circle Node Icon */}
                    <div
                      className={`absolute -left-[37px] top-0.5 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${act.typeColor}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">{act.typeIcon}</span>
                    </div>

                    {/* Timeline Card */}
                    <div className="bg-white rounded-xl border border-[#E1E1E1] hover:border-slate-300 p-4 space-y-2.5 shadow-2xs hover:shadow-xs transition-all">
                      {/* Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold border ${act.typeColor}`}
                          >
                            {act.typeBadge}
                          </span>

                          {act.entityId && (
                            <span className="font-mono text-[10px] bg-slate-100 text-[#767587] px-2 py-0.5 rounded border border-slate-200 font-bold">
                              {act.entityId}
                            </span>
                          )}

                          {act.status && (
                            <span className="px-2 py-0.5 bg-slate-100 text-[#1a1c1c] text-[10px] font-bold rounded border border-slate-200 uppercase">
                              {act.status}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-[#767587] font-medium">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          <span>{act.date}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-mono">{act.time}</span>
                        </div>
                      </div>

                      {/* Subject & Description */}
                      <div>
                        <h3 className="text-sm font-bold text-[#1a1c1c]">{act.subject}</h3>
                        <p className="text-xs text-[#464555] mt-1 whitespace-pre-wrap leading-relaxed">
                          {act.description}
                        </p>
                      </div>

                      {/* User PIC Footer & Navigation Button */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-2">
                          {act.userAvatar ? (
                            <img
                              src={act.userAvatar}
                              alt={act.userName}
                              className="w-6 h-6 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-[#4744e5]/10 text-[#4744e5] font-bold text-[10px] flex items-center justify-center">
                              {(act.userName || "U").substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="font-bold text-[#1a1c1c]">{act.userName}</span>
                          {act.userRole && (
                            <span className="text-[10px] text-[#767587] bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                              {act.userRole}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenRelatedRecord(act)}
                          className="px-3 py-1 bg-slate-100 hover:bg-[#4744e5] text-[#1a1c1c] hover:text-white font-bold rounded-lg border border-slate-200 text-xs flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          <span>
                            {act.entityType === 'VISIT'
                              ? 'View Visit'
                              : act.entityType === 'TASK'
                              ? 'View Task'
                              : act.entityType === 'PROJECT'
                              ? 'View Project'
                              : act.entityType === 'FOLLOWUP'
                              ? 'View Follow-up'
                              : 'View Details'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: VIEW ACTIVITY DETAIL */}
      {viewingActivity && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-[#E1E1E1] pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${viewingActivity.typeColor}`}>
                    {viewingActivity.typeBadge}
                  </span>
                  {viewingActivity.entityId && (
                    <span className="font-mono text-[10px] text-[#767587] bg-slate-100 px-1.5 py-0.5 rounded">
                      {viewingActivity.entityId}
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold text-[#1a1c1c]">{viewingActivity.subject}</h2>
              </div>
              <button type="button" onClick={() => setViewingActivity(null)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-[#767587] uppercase font-bold block">Date & Time</span>
                  <span className="font-bold text-[#1a1c1c]">{viewingActivity.date} at {viewingActivity.time}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#767587] uppercase font-bold block">Category</span>
                  <span className="font-bold text-[#1a1c1c]">{viewingActivity.category}</span>
                </div>
              </div>

              <div>
                <span className="text-[#767587] font-bold block mb-1">Activity Description:</span>
                <p className="p-3 bg-white rounded-lg border border-slate-200 text-[#1a1c1c] leading-relaxed whitespace-pre-wrap">
                  {viewingActivity.description}
                </p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                {viewingActivity.userAvatar ? (
                  <img src={viewingActivity.userAvatar} alt={viewingActivity.userName} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#4744e5]/10 text-[#4744e5] font-bold text-xs flex items-center justify-center">
                    {(viewingActivity.userName || "U").substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-[#767587] uppercase font-bold block">Logged By User</span>
                  <span className="font-bold text-[#1a1c1c] text-xs">{viewingActivity.userName}</span>
                  {viewingActivity.userRole && (
                    <span className="text-[10px] text-[#767587] ml-2 font-medium">({viewingActivity.userRole})</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E1E1E1] text-xs">
              {viewingActivity.entityType ? (
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingActivity;
                    setViewingActivity(null);
                    handleOpenRelatedRecord(target);
                  }}
                  className="px-4 py-2 bg-[#4744e5] hover:bg-[#3b38d4] text-white font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>Open Related Record ({viewingActivity.entityType})</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setViewingActivity(null)}
                className="px-4 py-2 border border-[#E1E1E1] rounded-lg font-bold text-[#767587] hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: EDIT CUSTOMER */}
      {showEditCustomerModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c]">Edit Customer Details</h2>
              <button onClick={() => setShowEditCustomerModal(false)} className="text-[#767587]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Customer Type</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded bg-white"
                  >
                    <option value="COMPANY">Company</option>
                    <option value="ENTERPRISE">Enterprise</option>
                    <option value="INDIVIDUAL">Individual</option>
                    <option value="GOVERNMENT">Government</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded bg-white"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PROSPECT">Prospect</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Phone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Region</label>
                <input
                  type="text"
                  value={editRegion}
                  onChange={(e) => setEditRegion(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                />
              </div>
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Address</label>
                <textarea
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setShowEditCustomerModal(false)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#4744e5] text-white rounded font-bold">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CHANGE PIC */}
      {showChangePicModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c]">Reassign Primary PIC</h2>
              <button onClick={() => setShowChangePicModal(false)} className="text-[#767587]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleChangePic} className="space-y-3 text-xs">
              <p className="text-[#767587]">
                Select the sales representative or account manager responsible for <strong>{customer.name}</strong>.
              </p>
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Select Sales PIC *</label>
                <select
                  value={selectedPicId}
                  onChange={(e) => setSelectedPicId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1E1E1] rounded bg-white font-bold text-xs"
                >
                  {tenantUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.roleName} ({u.teamName || u.department})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setShowChangePicModal(false)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#4744e5] text-white rounded font-bold">
                  Confirm Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE VISIT */}
      {showVisitModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c]">Schedule Sales Visit</h2>
              <button onClick={() => setShowVisitModal(false)} className="text-[#767587]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateVisit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Visit Subject *</label>
                <input
                  type="text"
                  required
                  value={visitTitle}
                  onChange={(e) => setVisitTitle(e.target.value)}
                  placeholder="e.g. Commercial Proposal Presentation"
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Visit Date</label>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setShowVisitModal(false)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#4744e5] text-white rounded font-bold">
                  Confirm Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE TASK */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c]">Create Sales Task</h2>
              <button onClick={() => setShowTaskModal(false)} className="text-[#767587]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Prepare revised commercial quotation"
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Description / Instructions</label>
                <textarea
                  rows={2}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Enter detailed action plan or requirements..."
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded bg-white font-bold"
                  >
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Assigned PIC (Task Owner)</label>
                <select
                  value={taskPicId}
                  onChange={(e) => setTaskPicId(e.target.value)}
                  className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded bg-white font-medium"
                >
                  {tenantUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.teamName || 'Sales Team'} ({u.department || u.roleName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Related Visit (Optional)</label>
                <select
                  value={taskRelatedVisitId}
                  onChange={(e) => setTaskRelatedVisitId(e.target.value)}
                  className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded bg-white font-medium"
                >
                  <option value="">None / Standalone Task</option>
                  {visits.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} ({v.visitDate})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Related Project (Optional)</label>
                <select
                  value={taskRelatedOppId}
                  onChange={(e) => setTaskRelatedOppId(e.target.value)}
                  className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded bg-white font-medium"
                >
                  <option value="">None / Standalone Task</option>
                  {projects.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#4744e5] text-white rounded font-bold">
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW TASK DETAILS */}
      {viewingTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#767587] block">Task #{viewingTask.id}</span>
                <h2 className="text-base font-bold text-[#1a1c1c]">{viewingTask.title}</h2>
              </div>
              <button onClick={() => setViewingTask(null)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#f9f9f9] p-3 rounded-lg border border-[#E1E1E1]">
                <div>
                  <span className="text-[#767587] block text-[10px] uppercase font-bold">Status</span>
                  <span className="mt-0.5 block">{renderTaskStatusBadge(viewingTask.status, viewingTask.dueDate)}</span>
                </div>
                <div>
                  <span className="text-[#767587] block text-[10px] uppercase font-bold">Priority</span>
                  <span className="mt-0.5 block">{renderTaskPriorityBadge(viewingTask.priority)}</span>
                </div>
                <div>
                  <span className="text-[#767587] block text-[10px] uppercase font-bold">Due Date</span>
                  <span className="font-bold text-[#1a1c1c] mt-0.5 block">{viewingTask.dueDate}</span>
                </div>
                <div>
                  <span className="text-[#767587] block text-[10px] uppercase font-bold">Created Date</span>
                  <span className="font-medium text-[#464555] mt-0.5 block">{viewingTask.createdAt}</span>
                </div>
              </div>

              {/* Task Ownership Card */}
              <div className="p-3 bg-[#4744e5]/5 rounded-lg border border-[#4744e5]/20 space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#4744e5] block">Task Owner (PIC)</span>
                {(() => {
                  const picUser = tenantUsers.find((u) => u.id === viewingTask.picId);
                  return (
                    <div className="flex items-center gap-3 pt-1">
                      {viewingTask.picAvatar ? (
                        <img src={viewingTask.picAvatar} alt={viewingTask.picName} className="w-9 h-9 rounded-full object-cover border border-[#E1E1E1]" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#4744e5]/20 text-[#4744e5] font-bold text-xs flex items-center justify-center">
                          {(viewingTask.picName || "U").charAt(0)}
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-[#1a1c1c] text-sm block">{viewingTask.picName}</span>
                        <div className="text-[11px] text-[#464555] flex items-center gap-2 mt-0.5">
                          <span>Team: <strong>{picUser?.teamName || picUser?.teamId || customer.teamName || 'Sales Team'}</strong></span>
                          <span>•</span>
                          <span>Dept: <strong>{picUser?.department || picUser?.roleName || 'Sales'}</strong></span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Description */}
              <div>
                <span className="text-[#767587] block text-[11px] font-bold uppercase mb-1">Description & Instructions</span>
                <div className="p-3 bg-[#f9f9f9] rounded border border-[#E1E1E1] text-[#1a1c1c] min-h-[50px]">
                  {viewingTask.description || 'No detailed instructions recorded for this task.'}
                </div>
              </div>

              {/* Related Links */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[#767587] block text-[10px] font-bold uppercase mb-1">Related Visit</span>
                  {viewingTask.relatedVisitId ? (
                    (() => {
                      const v = visits.find((item) => item.id === viewingTask.relatedVisitId);
                      return (
                        <div className="p-2 bg-[#f3f3f3] rounded border border-[#E1E1E1] font-semibold text-[#4744e5]">
                          {v ? v.title : viewingTask.relatedVisitId}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-2 bg-[#f3f3f3] rounded border border-[#E1E1E1] text-[#a0a0a0] italic">None</div>
                  )}
                </div>

                <div>
                  <span className="text-[#767587] block text-[10px] font-bold uppercase mb-1">Related Project</span>
                  {viewingTask.relatedProjectId ? (
                    (() => {
                      const o = projects.find((item) => item.id === viewingTask.relatedProjectId);
                      return (
                        <div className="p-2 bg-[#f3f3f3] rounded border border-[#E1E1E1] font-semibold text-[#008f53]">
                          {o ? o.name : viewingTask.relatedProjectId}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-2 bg-[#f3f3f3] rounded border border-[#E1E1E1] text-[#a0a0a0] italic">None</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E1E1E1]">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const t = viewingTask;
                    setViewingTask(null);
                    openEditTaskModal(t);
                  }}
                  className="px-3 py-1.5 bg-[#4744e5]/10 text-[#4744e5] rounded text-xs font-bold hover:bg-[#4744e5]/20 cursor-pointer"
                >
                  Edit Task
                </button>
                {canReassignPic && (
                  <button
                    onClick={() => {
                      const t = viewingTask;
                      setViewingTask(null);
                      openReassignTaskModal(t);
                    }}
                    className="px-3 py-1.5 bg-[#f59e0b]/10 text-[#d97706] rounded text-xs font-bold hover:bg-[#f59e0b]/20 cursor-pointer"
                  >
                    Reassign PIC
                  </button>
                )}
              </div>
              <button
                onClick={() => setViewingTask(null)}
                className="px-4 py-1.5 border border-[#E1E1E1] text-[#1a1c1c] rounded text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT TASK */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c]">Edit Task</h2>
              <button onClick={() => setEditingTask(null)} className="text-[#767587]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveEditTask} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={editTaskTitle}
                  onChange={(e) => setEditTaskTitle(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editTaskDescription}
                  onChange={(e) => setEditTaskDescription(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Status</label>
                  <select
                    value={editTaskStatus}
                    onChange={(e) => setEditTaskStatus(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded bg-white font-bold"
                  >
                    <option value="TODO">Open (To Do)</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Priority</label>
                  <select
                    value={editTaskPriority}
                    onChange={(e) => setEditTaskPriority(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded bg-white font-bold"
                  >
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={editTaskDueDate}
                    onChange={(e) => setEditTaskDueDate(e.target.value)}
                    className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Assigned PIC</label>
                  <select
                    value={editTaskPicId}
                    onChange={(e) => setEditTaskPicId(e.target.value)}
                    disabled={!canReassignPic}
                    className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded bg-white font-medium disabled:bg-[#f0f0f0]"
                  >
                    {tenantUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.teamName || 'Sales'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Related Visit</label>
                <select
                  value={editTaskRelatedVisitId}
                  onChange={(e) => setEditTaskRelatedVisitId(e.target.value)}
                  className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded bg-white font-medium"
                >
                  <option value="">None / Unlinked</option>
                  {visits.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} ({v.visitDate})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Related Project</label>
                <select
                  value={editTaskRelatedOppId}
                  onChange={(e) => setEditTaskRelatedOppId(e.target.value)}
                  className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded bg-white font-medium"
                >
                  <option value="">None / Unlinked</option>
                  {projects.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#4744e5] text-white rounded font-bold cursor-pointer">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REASSIGN TASK PIC */}
      {reassigningTask && (() => {
        const allTenantTasks = DataService.getTasks(tenantId);
        const currentPicUser = tenantUsers.find((u) => u.id === reassigningTask.picId) || {
          id: reassigningTask.picId,
          name: reassigningTask.picName,
          roleName: 'Sales Representative',
          department: 'Sales',
          avatarUrl: reassigningTask.picAvatar,
        };
        const currentActiveCount = allTenantTasks.filter((tk) => tk.picId === currentPicUser.id && tk.status !== 'COMPLETED' && tk.status !== 'CANCELLED').length;
        const currentOverdueCount = allTenantTasks.filter((tk) => tk.picId === currentPicUser.id && tk.dueDate < todayISO && tk.status !== 'COMPLETED' && tk.status !== 'CANCELLED').length;

        const candidateUsers = tenantUsers.filter((u) => u.id !== currentPicUser.id && (
          (u.name || "").toLowerCase().includes(reassignSearch.toLowerCase()) ||
          (u.roleName && (u.roleName || "").toLowerCase().includes(reassignSearch.toLowerCase())) ||
          (u.department && (u.department || "").toLowerCase().includes(reassignSearch.toLowerCase()))
        ));

        const selectedNewPicUser = tenantUsers.find((u) => u.id === reassignTaskPicId);
        const selectedActiveCount = selectedNewPicUser
          ? allTenantTasks.filter((tk) => tk.picId === selectedNewPicUser.id && tk.status !== 'COMPLETED' && tk.status !== 'CANCELLED').length
          : 0;

        const currentFirstName = (currentPicUser.name || "User").split(" ")[0];
        const selectedFirstName = selectedNewPicUser ? selectedNewPicUser.name.split(' ')[0] : '';

        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-xl max-w-md w-full overflow-hidden text-xs font-['Hanken_Grotesk',sans-serif]">
              {/* HEADER */}
              <div className="px-6 py-4 flex justify-between items-center border-b border-[#E1E1E1]">
                <h2 className="text-lg font-bold text-[#111827]">Reassign PIC</h2>
                <button
                  type="button"
                  onClick={() => setReassigningTask(null)}
                  className="text-[#9ca3af] hover:text-[#111827] p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <form onSubmit={handleConfirmReassignTask} className="flex flex-col">
                <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                  {/* CURRENT ASSIGNMENT */}
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#6b7280] block mb-2">
                      CURRENT ASSIGNMENT
                    </span>
                    <div className="p-3.5 bg-[#f9fafb] rounded-xl border border-[#e5e7eb] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {currentPicUser.avatarUrl ? (
                          <img
                            src={currentPicUser.avatarUrl}
                            alt={currentPicUser.name}
                            className="w-10 h-10 rounded-lg object-cover border border-[#e5e7eb]"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[#4744e5]/10 text-[#4744e5] font-bold text-sm flex items-center justify-center border border-[#e5e7eb]">
                            {(currentPicUser.name || "U").charAt(0)}
                          </div>
                        )}
                        <div>
                          <span className="font-bold text-[#111827] text-sm block">{currentPicUser.name}</span>
                          <span className="text-xs text-[#6b7280] block mt-0.5">
                            {currentPicUser.roleName || currentPicUser.department || 'Sales Representative'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <span className="font-bold text-sm text-[#111827] block text-center">{currentActiveCount}</span>
                          <span className="text-[11px] text-[#6b7280]">Active</span>
                        </div>
                        <div className="w-[1px] h-7 bg-[#e5e7eb]" />
                        <div>
                          <span className="font-bold text-sm text-[#ef4444] block text-center">{currentOverdueCount}</span>
                          <span className="text-[11px] text-[#ef4444] font-medium">Overdue</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SELECT NEW PIC */}
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#6b7280] block mb-2">
                      SELECT NEW PIC
                    </span>

                    {/* SEARCH INPUT */}
                    <div className="relative mb-3">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#9ca3af] text-[18px]">
                        search
                      </span>
                      <input
                        type="text"
                        placeholder="Search team members..."
                        value={reassignSearch}
                        onChange={(e) => setReassignSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-[#e5e7eb] rounded-xl bg-[#f9fafb] text-xs text-[#111827] placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all"
                      />
                    </div>

                    {/* PIC CANDIDATES LIST */}
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {candidateUsers.length === 0 ? (
                        <div className="p-4 text-center text-[#9ca3af] italic">
                          No team members found.
                        </div>
                      ) : (
                        candidateUsers.map((u) => {
                          const isSelected = reassignTaskPicId === u.id;
                          const uActiveCount = allTenantTasks.filter((tk) => tk.picId === u.id && tk.status !== 'COMPLETED' && tk.status !== 'CANCELLED').length;
                          const uOverdueCount = allTenantTasks.filter((tk) => tk.picId === u.id && tk.dueDate < todayISO && tk.status !== 'COMPLETED' && tk.status !== 'CANCELLED').length;

                          // Workload badge logic (Normal / High)
                          let badgeText = 'Normal';
                          let badgeClass = 'bg-[#dcfce7] text-[#15803d]';
                          if (uActiveCount >= 10 || uOverdueCount >= 3) {
                            badgeText = 'High';
                            badgeClass = 'bg-[#fee2e2] text-[#b91c1c]';
                          } else if (uActiveCount >= 6) {
                            badgeText = 'Medium';
                            badgeClass = 'bg-[#fef3c7] text-[#d97706]';
                          }

                          return (
                            <div
                              key={u.id}
                              onClick={() => setReassignTaskPicId(u.id)}
                              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'border-2 border-[#4f46e5] bg-[#f5f3ff]'
                                  : 'border-[#e5e7eb] bg-[#f9fafb] hover:bg-white'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {/* Radio button */}
                                <div
                                  className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    isSelected ? 'border-4 border-[#4f46e5] bg-white' : 'border-2 border-[#d1d5db] bg-white'
                                  }`}
                                />

                                {u.avatarUrl ? (
                                  <img
                                    src={u.avatarUrl}
                                    alt={u.name}
                                    className="w-10 h-10 rounded-lg object-cover border border-[#e5e7eb]"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-[#4744e5]/10 text-[#4744e5] font-bold text-sm flex items-center justify-center border border-[#e5e7eb]">
                                    {(u.name || "U").charAt(0)}
                                  </div>
                                )}

                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-[#111827] text-sm">{u.name}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badgeClass}`}>
                                      {badgeText}
                                    </span>
                                  </div>
                                  <span className="text-xs text-[#6b7280] block mt-0.5">
                                    {u.roleName || u.department || 'Account Executive'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 text-right">
                                <div>
                                  <span className="font-bold text-sm text-[#111827] block text-center">{uActiveCount}</span>
                                  <span className="text-[10px] text-[#6b7280] block -mt-0.5">Active</span>
                                </div>
                                <div>
                                  <span className={`font-bold text-sm block text-center ${uOverdueCount > 0 ? 'text-[#ef4444]' : 'text-[#111827]'}`}>
                                    {uOverdueCount}
                                  </span>
                                  <span className={`text-[10px] block -mt-0.5 ${uOverdueCount > 0 ? 'text-[#ef4444]' : 'text-[#6b7280]'}`}>
                                    Overdue
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* CONFIRMATION BANNER */}
                  {selectedNewPicUser && (
                    <div className="p-4 bg-[#f8f9fa] border border-[#e5e7eb] rounded-xl text-center space-y-3">
                      <p className="text-xs text-[#374151] font-medium">
                        Are you sure you want to reassign this task from <span className="font-bold text-[#111827]">{currentFirstName}</span> to <span className="font-bold text-[#111827]">{selectedFirstName}</span>?
                      </p>

                      <div className="flex items-center justify-center gap-8 pt-1">
                        <div className="text-center">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#6b7280] block mb-0.5">
                            CURRENT
                          </span>
                          <span className="font-bold text-sm text-[#111827] block">{currentFirstName}</span>
                          <span className="text-xs text-[#6b7280] block">{currentActiveCount} tasks</span>
                        </div>

                        <span className="material-symbols-outlined text-[#4f46e5] text-xl font-bold">
                          arrow_forward
                        </span>

                        <div className="text-center">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#6b7280] block mb-0.5">
                            NEW
                          </span>
                          <span className="font-bold text-sm text-[#111827] block">{selectedFirstName}</span>
                          <span className="text-xs text-[#6b7280] block">{selectedActiveCount} tasks</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* FOOTER ACTIONS */}
                <div className="px-6 py-4 border-t border-[#E1E1E1] flex justify-end gap-3 bg-white">
                  <button
                    type="button"
                    onClick={() => setReassigningTask(null)}
                    className="px-5 py-2 border border-[#d1d5db] text-[#374151] hover:bg-[#f9fafb] text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!reassignTaskPicId || reassignTaskPicId === currentPicUser.id}
                    className="px-5 py-2 bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    Reassign PIC
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL 5: CREATE FOLLOW-UP */}
      {showFollowUpModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4744e5]">add_task</span>
                Schedule Follow-up Engagement
              </h2>
              <button onClick={() => setShowFollowUpModal(false)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmCreateFollowUp} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Follow-up Subject / Title *</label>
                <input
                  type="text"
                  required
                  value={followUpTitleInput}
                  onChange={(e) => setFollowUpTitleInput(e.target.value)}
                  placeholder="e.g. Call client to confirm receipt of revised quotation"
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Follow-up Type *</label>
                  <select
                    value={followUpTypeInput}
                    onChange={(e) => setFollowUpTypeInput(e.target.value as FollowUpType)}
                    className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-bold text-xs"
                  >
                    <option value="CALL">Phone Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Meeting</option>
                    <option value="QUOTATION">Quotation Follow-up</option>
                    <option value="PROPOSAL">Proposal Follow-up</option>
                    <option value="GENERAL">General Follow-up</option>
                    <option value="WHATSAPP">WhatsApp</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Priority</label>
                  <select
                    value={followUpPriorityInput}
                    onChange={(e) => setFollowUpPriorityInput(e.target.value as FollowUpPriority)}
                    className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-bold text-xs"
                  >
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={followUpDateInput}
                    onChange={(e) => setFollowUpDateInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Reminder Time</label>
                  <input
                    type="time"
                    value={followUpTimeInput}
                    onChange={(e) => setFollowUpTimeInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Assigned PIC *</label>
                  <select
                    value={followUpPicIdInput}
                    onChange={(e) => setFollowUpPicIdInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white text-xs font-medium"
                  >
                    {tenantUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.teamName || 'Sales'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Related Project</label>
                  <select
                    value={followUpRelatedOppIdInput}
                    onChange={(e) => setFollowUpRelatedOppIdInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white text-xs"
                  >
                    <option value="">None (General)</option>
                    {projects.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Related Visit (Optional)</label>
                <select
                  value={followUpRelatedVisitIdInput}
                  onChange={(e) => setFollowUpRelatedVisitIdInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white text-xs"
                >
                  <option value="">None</option>
                  {visits.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} ({v.visitDate})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Notes / Instructions</label>
                <textarea
                  rows={3}
                  value={followUpNotesInput}
                  onChange={(e) => setFollowUpNotesInput(e.target.value)}
                  placeholder="Specific follow-up goals, discussion points, or customer background..."
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4744e5] hover:bg-[#3b38d4] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Schedule Follow-up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW FOLLOW-UP DETAILS */}
      {viewingFollowUp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-start border-b border-[#E1E1E1] pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getFollowUpTypeMeta(viewingFollowUp.type).color}`}>
                    <span className="material-symbols-outlined text-[13px]">{getFollowUpTypeMeta(viewingFollowUp.type).icon}</span>
                    {getFollowUpTypeMeta(viewingFollowUp.type).label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getFollowUpPriorityMeta(viewingFollowUp.priority).color}`}>
                    {getFollowUpPriorityMeta(viewingFollowUp.priority).label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getFollowUpStatusMeta(viewingFollowUp.status, viewingFollowUp.followUpDate).color}`}>
                    {getFollowUpStatusMeta(viewingFollowUp.status, viewingFollowUp.followUpDate).label}
                  </span>
                </div>
                <h2 className="text-base font-bold text-[#1a1c1c]">{viewingFollowUp.title || `${viewingFollowUp.type} Follow-up`}</h2>
                <div className="text-[11px] text-[#767587]">Follow-up ID: {viewingFollowUp.id}</div>
              </div>
              <button onClick={() => setViewingFollowUp(null)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3.5">
              {/* PIC info card */}
              <div className="p-3 bg-slate-50 rounded-lg border border-[#E1E1E1] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {viewingFollowUp.picAvatar ? (
                    <img src={viewingFollowUp.picAvatar} alt={viewingFollowUp.picName} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#4744e5]/10 text-[#4744e5] font-bold flex items-center justify-center text-xs">
                      {(viewingFollowUp.picName || "U").substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-[#1a1c1c]">{viewingFollowUp.picName}</div>
                    <div className="text-[10px] text-[#767587]">Assigned Task PIC</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[#767587]">Scheduled Date</div>
                  <div className="font-bold text-[#1a1c1c]">{viewingFollowUp.followUpDate}</div>
                </div>
              </div>

              {/* Related Project & Visit */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-white border border-[#E1E1E1] rounded-lg">
                  <span className="text-[10px] font-bold text-[#767587] block mb-1">RELATED PROJECT</span>
                  {viewingFollowUp.relatedProjectId ? (
                    <div className="font-semibold text-[#4744e5] truncate">
                      {projects.find((o) => o.id === viewingFollowUp.relatedProjectId)?.name || viewingFollowUp.relatedProjectId}
                    </div>
                  ) : (
                    <div className="text-slate-400 italic">None linked</div>
                  )}
                </div>

                <div className="p-2.5 bg-white border border-[#E1E1E1] rounded-lg">
                  <span className="text-[10px] font-bold text-[#767587] block mb-1">RELATED VISIT</span>
                  {viewingFollowUp.relatedVisitId ? (
                    <div className="font-semibold text-slate-700 truncate">
                      {visits.find((v) => v.id === viewingFollowUp.relatedVisitId)?.title || viewingFollowUp.relatedVisitId}
                    </div>
                  ) : (
                    <div className="text-slate-400 italic">None linked</div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <span className="font-bold text-[#1a1c1c] block mb-1">Follow-up Notes & Context</span>
                <div className="p-3 bg-slate-50 border border-[#E1E1E1] rounded-lg text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {viewingFollowUp.notes || 'No detailed notes provided.'}
                </div>
              </div>

              {/* Outcome if completed */}
              {viewingFollowUp.status === 'COMPLETED' && (
                <div>
                  <span className="font-bold text-[#15803d] block mb-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Completion Outcome
                  </span>
                  <div className="p-3 bg-[#dcfce7]/50 border border-[#bbf7d0] rounded-lg text-[#15803d] font-medium whitespace-pre-wrap">
                    {viewingFollowUp.outcome || 'Marked as completed without extra outcome notes.'}
                  </div>
                </div>
              )}

              {/* Reschedule details if present */}
              {viewingFollowUp.rescheduledFromDate && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                  <strong>Rescheduled:</strong> Previously set for {viewingFollowUp.rescheduledFromDate}. Reason: {viewingFollowUp.rescheduleReason || 'N/A'}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E1E1E1]">
              <button
                type="button"
                onClick={() => setViewingFollowUp(null)}
                className="px-4 py-2 border border-[#E1E1E1] rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {viewingFollowUp.status !== 'COMPLETED' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingFollowUp;
                        setViewingFollowUp(null);
                        openRescheduleFollowUpModal(target);
                      }}
                      className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 font-bold rounded-lg cursor-pointer"
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingFollowUp;
                        setViewingFollowUp(null);
                        openCompleteFollowUpModal(target);
                      }}
                      className="px-3 py-1.5 bg-[#15803d] hover:bg-[#166534] text-white font-bold rounded-lg cursor-pointer shadow-xs"
                    >
                      Complete
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingFollowUp;
                    setViewingFollowUp(null);
                    openEditFollowUpModal(target);
                  }}
                  className="px-3 py-1.5 bg-[#4744e5] hover:bg-[#3b38d4] text-white font-bold rounded-lg cursor-pointer shadow-xs"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT FOLLOW-UP */}
      {editingFollowUp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4744e5]">edit</span>
                Edit Follow-up Details
              </h2>
              <button onClick={() => setEditingFollowUp(null)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmEditFollowUp} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Follow-up Subject *</label>
                <input
                  type="text"
                  required
                  value={followUpTitleInput}
                  onChange={(e) => setFollowUpTitleInput(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Type</label>
                  <select
                    value={followUpTypeInput}
                    onChange={(e) => setFollowUpTypeInput(e.target.value as FollowUpType)}
                    className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-bold text-xs"
                  >
                    <option value="CALL">Phone Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Meeting</option>
                    <option value="QUOTATION">Quotation Follow-up</option>
                    <option value="PROPOSAL">Proposal Follow-up</option>
                    <option value="GENERAL">General Follow-up</option>
                    <option value="WHATSAPP">WhatsApp</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Priority</label>
                  <select
                    value={followUpPriorityInput}
                    onChange={(e) => setFollowUpPriorityInput(e.target.value as FollowUpPriority)}
                    className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-bold text-xs"
                  >
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Status</label>
                  <select
                    value={followUpStatusInput}
                    onChange={(e) => setFollowUpStatusInput(e.target.value as FollowUpStatus)}
                    className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-bold text-xs"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={followUpDateInput}
                    onChange={(e) => setFollowUpDateInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Reminder Time</label>
                  <input
                    type="time"
                    value={followUpTimeInput}
                    onChange={(e) => setFollowUpTimeInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Assigned PIC</label>
                  <select
                    value={followUpPicIdInput}
                    onChange={(e) => setFollowUpPicIdInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white text-xs font-medium"
                  >
                    {tenantUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.teamName || 'Sales'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Related Project</label>
                  <select
                    value={followUpRelatedOppIdInput}
                    onChange={(e) => setFollowUpRelatedOppIdInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white text-xs"
                  >
                    <option value="">None (General)</option>
                    {projects.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Related Visit</label>
                <select
                  value={followUpRelatedVisitIdInput}
                  onChange={(e) => setFollowUpRelatedVisitIdInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white text-xs"
                >
                  <option value="">None</option>
                  {visits.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} ({v.visitDate})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Notes / Instructions</label>
                <textarea
                  rows={3}
                  value={followUpNotesInput}
                  onChange={(e) => setFollowUpNotesInput(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setEditingFollowUp(null)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4744e5] hover:bg-[#3b38d4] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COMPLETE FOLLOW-UP */}
      {completingFollowUp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#15803d]">check_circle</span>
                Mark Follow-up Completed
              </h2>
              <button onClick={() => setCompletingFollowUp(null)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmCompleteFollowUp} className="space-y-3.5">
              <div className="p-3 bg-[#dcfce7]/50 border border-[#bbf7d0] rounded-lg">
                <div className="font-bold text-[#15803d]">{completingFollowUp.title || `${completingFollowUp.type} Follow-up`}</div>
                <div className="text-[11px] text-slate-600 mt-1">PIC: {completingFollowUp.picName} | Due: {completingFollowUp.followUpDate}</div>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Engagement Outcome / Results *</label>
                <textarea
                  rows={3}
                  required
                  value={completeOutcomeInput}
                  onChange={(e) => setCompleteOutcomeInput(e.target.value)}
                  placeholder="Record key outcomes, client response, agreement, or next agreed steps..."
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setCompletingFollowUp(null)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#15803d] hover:bg-[#166534] text-white font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Complete Follow-up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESCHEDULE FOLLOW-UP */}
      {reschedulingFollowUp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#d97706]">update</span>
                Reschedule Follow-up
              </h2>
              <button onClick={() => setReschedulingFollowUp(null)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmRescheduleFollowUp} className="space-y-3.5">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="font-bold text-amber-900">{reschedulingFollowUp.title || `${reschedulingFollowUp.type} Follow-up`}</div>
                <div className="text-[11px] text-amber-700 mt-0.5">Currently Scheduled: <strong>{reschedulingFollowUp.followUpDate}</strong></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">New Due Date *</label>
                  <input
                    type="date"
                    required
                    value={rescheduleDateInput}
                    onChange={(e) => setRescheduleDateInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">New Time</label>
                  <input
                    type="time"
                    value={rescheduleTimeInput}
                    onChange={(e) => setRescheduleTimeInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Reason for Rescheduling</label>
                <textarea
                  rows={2.5}
                  value={rescheduleReasonInput}
                  onChange={(e) => setRescheduleReasonInput(e.target.value)}
                  placeholder="e.g. Client requested postpone to next week due to internal audit..."
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setReschedulingFollowUp(null)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#d97706] hover:bg-[#b45309] text-white font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PROJECT */}
      {showOppModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4744e5]">add_chart</span>
                Create Sales Project
              </h2>
              <button onClick={() => setShowOppModal(false)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmCreateOpp} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  value={oppNameInput}
                  onChange={(e) => setOppNameInput(e.target.value)}
                  placeholder="e.g. Enterprise ERP License Upgrade Q3"
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Estimated Value (IDR) *</label>
                  <input
                    type="number"
                    required
                    value={oppValueInput}
                    onChange={(e) => setOppValueInput(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Pipeline Stage</label>
                  <select
                    value={oppStageInput}
                    onChange={(e) => {
                      const st = e.target.value as ProjectStage;
                      setOppStageInput(st);
                      setOppProbInput(getStageMeta(st).defaultProb);
                    }}
                    className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-bold text-xs"
                  >
                    <option value="LEAD">Leads (20%)</option>
                    <option value="QUALIFICATION">Discuss/Follow up (40%)</option>
                    <option value="PROPOSAL">Proposal Sent (60%)</option>
                    <option value="NEGOTIATION">Negotiation (80%)</option>
                    <option value="WON">Won / Deal (100%)</option>
                    <option value="LOST">Lost (0%)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Close Probability (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={oppProbInput}
                    onChange={(e) => setOppProbInput(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Expected Close Date *</label>
                  <input
                    type="date"
                    required
                    value={oppCloseDateInput}
                    onChange={(e) => setOppCloseDateInput(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Assigned PIC</label>
                  <select
                    value={oppPicIdInput}
                    onChange={(e) => setOppPicIdInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-medium text-xs"
                  >
                    {tenantUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Lead Source</label>
                  <input
                    type="text"
                    value={oppSourceInput}
                    onChange={(e) => setOppSourceInput(e.target.value)}
                    placeholder="e.g. Inbound Website, Referral"
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Project Description / Scope</label>
                <textarea
                  rows={2}
                  value={oppDescInput}
                  onChange={(e) => setOppDescInput(e.target.value)}
                  placeholder="Details regarding scope, requirements, key stakeholders..."
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setShowOppModal(false)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded-lg text-xs font-bold text-[#767587] hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4744e5] hover:bg-[#3b38d4] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW PROJECT DETAILS */}
      {viewingOpp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-[#E1E1E1] pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] text-[#767587] bg-slate-100 px-1.5 py-0.5 rounded">
                    {viewingOpp.id}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStageMeta(viewingOpp.stage).color}`}>
                    <span className="material-symbols-outlined text-[12px]">{getStageMeta(viewingOpp.stage).icon}</span>
                    {getStageMeta(viewingOpp.stage).label}
                  </span>
                </div>
                <h2 className="text-base font-bold text-[#1a1c1c]">{viewingOpp.name}</h2>
              </div>
              <button onClick={() => setViewingOpp(null)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg border border-[#E1E1E1]">
                <div>
                  <span className="text-[10px] text-[#767587] uppercase font-bold block">Deal Value</span>
                  <span className="text-sm font-extrabold text-[#008f53]">
                    Rp {(viewingOpp.estimatedValue || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#767587] uppercase font-bold block">Probability</span>
                  <span className="text-sm font-extrabold text-[#1a1c1c]">
                    {viewingOpp.probability}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#767587] uppercase font-bold block">Weighted Value</span>
                  <span className="text-sm font-extrabold text-[#1a1c1c]">
                    Rp {((viewingOpp.estimatedValue * viewingOpp.probability) / 100).toLocaleString('id-ID')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#767587] uppercase font-bold block">Expected Close</span>
                  <span className="text-sm font-extrabold text-[#1a1c1c]">
                    {viewingOpp.expectedCloseDate}
                  </span>
                </div>
              </div>

              {/* Details List */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <span className="text-[#767587] font-bold block">Assigned Sales PIC:</span>
                  <div className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200">
                    {viewingOpp.picAvatar ? (
                      <img src={viewingOpp.picAvatar} alt={viewingOpp.picName} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#4744e5]/10 text-[#4744e5] font-bold flex items-center justify-center text-[10px]">
                        {(viewingOpp.picName || "U").substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="font-bold text-[#1a1c1c]">{viewingOpp.picName}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[#767587] font-bold block">Lead Source:</span>
                  <div className="p-2 bg-white rounded border border-slate-200 font-medium text-[#1a1c1c]">
                    {viewingOpp.source || 'Direct Sales Lead'}
                  </div>
                </div>
              </div>

              {viewingOpp.description && (
                <div className="space-y-1">
                  <span className="text-[#767587] font-bold block">Description / Notes:</span>
                  <p className="p-2.5 bg-slate-50 rounded border border-slate-200 text-[#1a1c1c] whitespace-pre-wrap">
                    {viewingOpp.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[10px] text-[#767587] pt-1">
                <div>Created At: <span className="font-medium text-[#1a1c1c]">{viewingOpp.createdAt}</span></div>
                <div>Last Updated: <span className="font-medium text-[#1a1c1c]">{viewingOpp.updatedAt}</span></div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E1E1E1] text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const target = viewingOpp;
                    setViewingOpp(null);
                    openChangeStageModal(target);
                  }}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">alt_route</span>
                  Change Stage
                </button>

                <button
                  onClick={() => {
                    const target = viewingOpp;
                    setViewingOpp(null);
                    openReassignOppModal(target);
                  }}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-lg border border-amber-200 flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">person_switch</span>
                  Reassign PIC
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewingOpp(null)}
                  className="px-3 py-1.5 border border-[#E1E1E1] rounded-lg font-bold text-[#767587] hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    const target = viewingOpp;
                    setViewingOpp(null);
                    openEditOppModal(target);
                  }}
                  className="px-3.5 py-1.5 bg-[#4744e5] hover:bg-[#3b38d4] text-white font-bold rounded-lg cursor-pointer shadow-xs"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PROJECT */}
      {editingOpp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4744e5]">edit</span>
                Edit Project
              </h2>
              <button onClick={() => setEditingOpp(null)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmEditOpp} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  value={oppNameInput}
                  onChange={(e) => setOppNameInput(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Estimated Value (IDR)</label>
                  <input
                    type="number"
                    required
                    value={oppValueInput}
                    onChange={(e) => setOppValueInput(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Stage</label>
                  <select
                    value={oppStageInput}
                    onChange={(e) => setOppStageInput(e.target.value as ProjectStage)}
                    className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white font-bold text-xs"
                  >
                    <option value="LEAD">Leads</option>
                    <option value="QUALIFICATION">Discuss/Follow up</option>
                    <option value="PROPOSAL">Proposal Sent</option>
                    <option value="NEGOTIATION">Negotiation</option>
                    <option value="WON">Won / Deal</option>
                    <option value="LOST">Lost</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Probability (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={oppProbInput}
                    onChange={(e) => setOppProbInput(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Expected Close Date</label>
                  <input
                    type="date"
                    required
                    value={oppCloseDateInput}
                    onChange={(e) => setOppCloseDateInput(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Assigned PIC</label>
                  <select
                    value={oppPicIdInput}
                    onChange={(e) => setOppPicIdInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E1E1E1] rounded-lg bg-white text-xs"
                  >
                    {tenantUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Lead Source</label>
                  <input
                    type="text"
                    value={oppSourceInput}
                    onChange={(e) => setOppSourceInput(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={oppDescInput}
                  onChange={(e) => setOppDescInput(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setEditingOpp(null)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded-lg text-xs font-bold text-[#767587] hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4744e5] hover:bg-[#3b38d4] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CHANGE STAGE */}
      {changingStageOpp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c] flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600">alt_route</span>
                Change Project Stage
              </h2>
              <button onClick={() => setChangingStageOpp(null)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmChangeStage} className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-[#E1E1E1] space-y-1">
                <div className="font-bold text-[#1a1c1c] text-sm">{changingStageOpp.name}</div>
                <div className="text-[#767587] text-[11px]">
                  Current Stage: <span className="font-bold text-[#1a1c1c]">{changingStageOpp.stage}</span> ({changingStageOpp.probability}%)
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">New Stage *</label>
                <select
                  value={newStageInput}
                  onChange={(e) => {
                    const st = e.target.value as ProjectStage;
                    setNewStageInput(st);
                    setNewStageProbInput(getStageMeta(st).defaultProb);
                  }}
                  className="w-full px-2.5 py-2 border border-[#E1E1E1] rounded-lg bg-white font-bold text-xs"
                >
                  <option value="LEAD">Leads (Default 20%)</option>
                  <option value="QUALIFICATION">Discuss/Follow up (Default 40%)</option>
                  <option value="PROPOSAL">Proposal Sent (Default 60%)</option>
                  <option value="NEGOTIATION">Negotiation (Default 80%)</option>
                  <option value="WON">Won / Deal (100%)</option>
                  <option value="LOST">Lost (0%)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Win Probability (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newStageProbInput}
                  onChange={(e) => setNewStageProbInput(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Stage Change Notes / Key Reason</label>
                <textarea
                  rows={2}
                  value={stageChangeNotesInput}
                  onChange={(e) => setStageChangeNotesInput(e.target.value)}
                  placeholder="e.g. Quotation sent and approved by CFO, advancing to Negotiation stage"
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setChangingStageOpp(null)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded-lg text-xs font-bold text-[#767587] hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Update Stage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REASSIGN PROJECT PIC */}
      {reassigningOpp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c] flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-700">person_switch</span>
                Reassign Project PIC
              </h2>
              <button onClick={() => setReassigningOpp(null)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmReassignOpp} className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-[#E1E1E1] space-y-1">
                <div className="font-bold text-[#1a1c1c] text-sm">{reassigningOpp.name}</div>
                <div className="text-[#767587] text-[11px]">
                  Current PIC: <span className="font-bold text-[#1a1c1c]">{reassigningOpp.picName}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">New Assigned PIC *</label>
                <select
                  required
                  value={newOppPicIdInput}
                  onChange={(e) => setNewOppPicIdInput(e.target.value)}
                  className="w-full px-2.5 py-2 border border-[#E1E1E1] rounded-lg bg-white font-bold text-xs"
                >
                  {tenantUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.role} ({u.teamName || 'Sales'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Reassignment Reason / Handover Notes</label>
                <textarea
                  rows={2}
                  value={reassignReasonInput}
                  onChange={(e) => setReassignReasonInput(e.target.value)}
                  placeholder="e.g. Account reassignment due to region focus..."
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setReassigningOpp(null)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded-lg text-xs font-bold text-[#767587] hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Reassign PIC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: ADD NOTE */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c]">Add Customer Note</h2>
              <button onClick={() => setShowNoteModal(false)} className="text-[#767587]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleAddNote} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Note Content *</label>
                <textarea
                  required
                  rows={4}
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Write client insight, meeting notes, or budget updates..."
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#4744e5] text-white rounded font-bold">
                  Add Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW VISIT DETAILS */}
      {viewingVisit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <div>
                <span className="text-[10px] font-bold text-[#4744e5] uppercase tracking-wider block">Visit Record #{viewingVisit.id}</span>
                <h2 className="text-base font-bold text-[#1a1c1c]">{viewingVisit.title}</h2>
              </div>
              <button onClick={() => setViewingVisit(null)} className="text-[#767587] hover:text-[#1a1c1c]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#f9f9f9] p-3 rounded-lg border border-[#E1E1E1]">
                <div>
                  <span className="text-[#767587] block text-[10px] uppercase font-bold">Visit Date & Time</span>
                  <span className="font-bold text-[#1a1c1c] mt-0.5 block">{viewingVisit.visitDate} ({viewingVisit.startTime} - {viewingVisit.endTime})</span>
                </div>
                <div>
                  <span className="text-[#767587] block text-[10px] uppercase font-bold">Assigned Sales PIC</span>
                  <span className="font-bold text-[#1a1c1c] mt-0.5 block">{viewingVisit.picName}</span>
                </div>
                <div>
                  <span className="text-[#767587] block text-[10px] uppercase font-bold">Purpose</span>
                  <span className="font-bold text-[#4744e5] mt-0.5 block">{viewingVisit.purpose}</span>
                </div>
                <div>
                  <span className="text-[#767587] block text-[10px] uppercase font-bold">Current Status</span>
                  <span className="mt-0.5 block">{renderVisitStatusBadge(viewingVisit.status)}</span>
                </div>
              </div>

              <div>
                <span className="text-[#767587] block text-[11px] font-bold uppercase mb-1">Visit Location</span>
                <p className="p-2.5 bg-[#f3f3f3] rounded border border-[#E1E1E1] text-[#1a1c1c] font-medium flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#4744e5]">location_on</span>
                  <span>{viewingVisit.location || customer.address}</span>
                </p>
              </div>

              <div>
                <span className="text-[#767587] block text-[11px] font-bold uppercase mb-1">Visit Result / Meeting Notes</span>
                <div className="p-3 bg-[#f9f9f9] rounded border border-[#E1E1E1] text-[#1a1c1c] min-h-[60px]">
                  {viewingVisit.result || 'No result summary recorded yet for this visit.'}
                </div>
              </div>

              <div>
                <span className="text-[#767587] block text-[11px] font-bold uppercase mb-1">Next Agreed Action</span>
                <div className="p-3 bg-[#00C875]/5 rounded border border-[#00C875]/30 text-[#008f53] font-semibold">
                  {viewingVisit.nextAction || 'No explicit next action assigned.'}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E1E1E1]">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const v = viewingVisit;
                    setViewingVisit(null);
                    openEditVisitModal(v);
                  }}
                  className="px-3 py-1.5 bg-[#4744e5]/10 text-[#4744e5] rounded text-xs font-bold hover:bg-[#4744e5]/20"
                >
                  Edit Visit
                </button>
                <button
                  onClick={() => {
                    const v = viewingVisit;
                    setViewingVisit(null);
                    openRescheduleVisitModal(v);
                  }}
                  className="px-3 py-1.5 bg-[#f59e0b]/10 text-[#d97706] rounded text-xs font-bold hover:bg-[#f59e0b]/20"
                >
                  Reschedule
                </button>
              </div>
              <button
                onClick={() => setViewingVisit(null)}
                className="px-4 py-1.5 border border-[#E1E1E1] text-[#1a1c1c] rounded text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT VISIT */}
      {editingVisit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c]">Edit Visit Record</h2>
              <button onClick={() => setEditingVisit(null)} className="text-[#767587]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveEditVisit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Subject / Title *</label>
                <input
                  type="text"
                  required
                  value={editVisitTitle}
                  onChange={(e) => setEditVisitTitle(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Visit Purpose</label>
                <select
                  value={editVisitPurpose}
                  onChange={(e) => setEditVisitPurpose(e.target.value)}
                  className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded bg-white font-medium"
                >
                  <option value="Product Presentation & Demo">Product Presentation & Demo</option>
                  <option value="Contract Renewal Negotiation">Contract Renewal Negotiation</option>
                  <option value="Routine Checking & Relationship">Routine Checking & Relationship</option>
                  <option value="Price Negotiation">Price Negotiation</option>
                  <option value="Onsite Technical Audit">Onsite Technical Audit</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Status</label>
                <select
                  value={editVisitStatus}
                  onChange={(e) => setEditVisitStatus(e.target.value as any)}
                  className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded bg-white font-bold"
                >
                  <option value="PLANNED">Scheduled / Planned</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="RESCHEDULED">Rescheduled</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="NO_SHOW">No Show</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Location</label>
                <input
                  type="text"
                  value={editVisitLocation}
                  onChange={(e) => setEditVisitLocation(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Visit Result / Summary</label>
                <textarea
                  rows={2}
                  value={editVisitResult}
                  onChange={(e) => setEditVisitResult(e.target.value)}
                  placeholder="Record key meeting outcomes..."
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Next Action</label>
                <input
                  type="text"
                  value={editVisitNextAction}
                  onChange={(e) => setEditVisitNextAction(e.target.value)}
                  placeholder="e.g. Send revised contract quote by Friday"
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setEditingVisit(null)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#4744e5] text-white rounded font-bold">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESCHEDULE VISIT */}
      {reschedulingVisit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <div>
                <h2 className="text-base font-bold text-[#1a1c1c]">Reschedule Sales Visit</h2>
                <span className="text-[11px] text-[#767587]">{reschedulingVisit.title}</span>
              </div>
              <button onClick={() => setReschedulingVisit(null)} className="text-[#767587]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleConfirmReschedule} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">New Visit Date *</label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">Start Time</label>
                  <input
                    type="time"
                    value={rescheduleStartTime}
                    onChange={(e) => setRescheduleStartTime(e.target.value)}
                    className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1a1c1c] mb-1">End Time</label>
                  <input
                    type="time"
                    value={rescheduleEndTime}
                    onChange={(e) => setRescheduleEndTime(e.target.value)}
                    className="w-full px-2 py-1.5 border border-[#E1E1E1] rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1">Reschedule Reason / Notes</label>
                <textarea
                  rows={2}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Requested by client due to executive schedule overlap"
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setReschedulingVisit(null)}
                  className="px-4 py-2 border border-[#E1E1E1] rounded"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#d97706] text-white rounded font-bold">
                  Confirm Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CANCEL VISIT */}
      {cancellingVisit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#ba1a1a]">warning</span>
                <h2 className="text-base font-bold text-[#1a1c1c]">Cancel Visit Confirmation</h2>
              </div>
              <button onClick={() => setCancellingVisit(null)} className="text-[#767587]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="text-xs space-y-2">
              <p className="text-[#464555]">
                Are you sure you want to cancel the scheduled visit <strong className="text-[#1a1c1c]">{cancellingVisit.title}</strong>?
              </p>
              <div>
                <label className="block font-bold text-[#1a1c1c] mb-1 mt-3">Reason for Cancellation</label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Client requested cancellation or project put on hold"
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
              <button
                type="button"
                onClick={() => setCancellingVisit(null)}
                className="px-4 py-2 border border-[#E1E1E1] rounded text-xs"
              >
                Keep Scheduled
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-[#ba1a1a] text-white rounded font-bold text-xs"
              >
                Confirm Cancel Visit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

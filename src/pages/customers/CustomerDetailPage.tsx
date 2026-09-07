import { CustomerVisitsTab } from './components/CustomerVisitsTab';
import { CustomerFollowUpsTab } from './components/CustomerFollowUpsTab';
import { CustomerTasksTab } from './components/CustomerTasksTab';
import { CustomerProjectsTab } from './components/CustomerProjectsTab';
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../services/usersApi';
import { crmApi } from '../../services/crmApi';
import { Customer, Visit, Task, FollowUp, Project, Activity, User, CustomerContact, TaskPriority, TaskStatus, FollowUpType, FollowUpPriority, FollowUpStatus, ProjectStage } from '../../types';
import { CustomerOverviewTab } from './components/CustomerOverviewTab';
import { useCustomerTimeline } from './components/useCustomerTimeline';
import { CustomerActivitiesTab } from './components/CustomerActivitiesTab';

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
  const tenantId = currentTenant?.id ;
  const todayISO = new Date().toISOString().split('T')[0];
  const { timelineEvents, timelinePage, timelineHasMore, isLoadingTimeline, error: timelineError, loadTimeline } = useCustomerTimeline(id || '', tenantId);

  const [customer, setCustomer] = useState<Customer | undefined>(undefined);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState<boolean>(true);
  const [customerNotFound, setCustomerNotFound] = useState<boolean>(false);
  const [customerNextAction, setCustomerNextAction] = useState<any | null>(null);
  const [customerAttentionSignals, setCustomerAttentionSignals] = useState<any[]>([]);
  const [projectAttentionSummary, setProjectAttentionSummary] = useState<any | null>(null);

  const visits: Visit[] = [];
  const [activeTab, setActiveTab] = useState<'overview' | 'visits' | 'tasks' | 'followups' | 'projects' | 'activities'>('overview');

  // Modals state
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [showChangePicModal, setShowChangePicModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
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

  // Task Filters State

  // Task Modals State

  // Edit Task Form State

  // Reassign Task PIC State
  const [reassignSearch, setReassignSearch] = useState('');

  // Follow-Up List State & Filters
  const [followupsList, setFollowupsList] = useState<FollowUp[]>([]);

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
  const [actUserFilter, setActUserFilter] = useState<string>('ALL');
  const [viewingActivity, setViewingActivity] = useState<ActivityTimelineItem | null>(null);

  const [oppsList, setOppsList] = useState<Project[]>([]);
  const [activitiesList, setActivitiesList] = useState<Activity[]>([]);

  const [contactsList, setContactsList] = useState<CustomerContact[]>([]);
  const [tenantUsers, setTenantUsers] = useState<User[]>([]);

  const loadAllCustomerData = async () => {
    if (!id) return;
    try {
      setIsLoadingCustomer(true);
      const custData = await crmApi.fetchCustomerById(id);
      if (!custData) {
        setCustomerNotFound(true);
        setIsLoadingCustomer(false);
        return;
      }

      setCustomer(custData);
      setCustomerNotFound(false);
      setEditName(custData.name || '');
      setEditCode(custData.code || '');
      setEditType((custData as any).typeName || (custData as any).typeCode || custData.type || 'COMPANY');
      setEditStatus((custData as any).statusName || (custData as any).statusCode || custData.status || 'ACTIVE');
      setEditPhone(custData.phone || '');
      setEditEmail(custData.email || '');
      setEditRegion(custData.region || '');
      setEditAddress(custData.address || '');
      setSelectedPicId(custData.picId || (custData as any).assignedPicId || '');

      if (custData.contacts && Array.isArray(custData.contacts) && custData.contacts.length > 0) {
        setContactsList(custData.contacts);
      }

      // Non-fatal secondary queries using Promise.allSettled
      Promise.allSettled([
        crmApi.fetchCustomerSummary(id),
        crmApi.fetchCustomerContacts(id),
        usersApi.fetchUsers(tenantId),
        crmApi.fetchCustomerNextAction(id)
      ]).then(([summaryRes, contactsRes, usersRes, naRes]) => {
        if (summaryRes.status === 'fulfilled' && summaryRes.value) {
          if (summaryRes.value.attentionSignals) {
            setCustomerAttentionSignals(summaryRes.value.attentionSignals);
          }
          if (summaryRes.value.projectAttentionSummary) {
            setProjectAttentionSummary(summaryRes.value.projectAttentionSummary);
          }
        }
        if (contactsRes.status === 'fulfilled' && Array.isArray(contactsRes.value) && contactsRes.value.length > 0) {
          setContactsList(contactsRes.value);
        }
        if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value)) {
          setTenantUsers(usersRes.value);
        }
        if (naRes.status === 'fulfilled' && naRes.value?.nextAction) {
          setCustomerNextAction(naRes.value.nextAction);
        } else {
          setCustomerNextAction(null);
        }
      }).catch(err => {
        console.warn('Non-fatal error loading secondary customer data:', err);
      });
    } catch (err) {
      console.error('Error loading customer detail data:', err);
      setCustomerNotFound(true);
    } finally {
      setIsLoadingCustomer(false);
    }
  };

  useEffect(() => {
    loadAllCustomerData();
  }, [id, tenantId]);

  const refreshVisits = () => loadAllCustomerData();
  const refreshTasks = () => loadAllCustomerData();
  const refreshFollowups = () => loadAllCustomerData();
  const refreshOpps = () => loadAllCustomerData();

  
  const tasks: Task[] = []; // tasks are now handled in CustomerTasksTab
  const followups: FollowUp[] = followupsList;
  const projects: Project[] = [];
  const activities: Activity[] = [];

  // Compute Unified Customer Activity Timeline
  const rawActivities: ActivityTimelineItem[] = [];
  const addedActivityKeys = new Set<string>();

  // 1. Convert raw stored activities from Database API
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
      recObj = [].find((v) => v.id === a.entityId || (a.description && a.description.includes(v.id)));
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
  [].forEach((v) => {
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
    if (actUserFilter !== 'ALL') {
      if (act.userId !== actUserFilter) return false;
    }
    return true;
  });

  const handleOpenRelatedRecord = (act: ActivityTimelineItem) => {
    if (act.entityType === 'VISIT') {
      const v = [].find((item) => item.id === act.entityId) || act.recordObj;
      if (v) setViewingVisit(v);
    } else if (act.entityType === 'TASK') {
      const t = tasks.find((item) => item.id === act.entityId) || act.recordObj;
      if (t) setActiveTab('tasks');
    } else if (act.entityType === 'PROJECT') {
      const o = projects.find((item) => item.id === act.entityId) || act.recordObj;
      if (o) setViewingOpp(o);
    } else if (act.entityType === 'FOLLOWUP') {
      const f = followups.find((item) => item.id === act.entityId) || act.recordObj;
      // f is ignored since modal is removed, instead switch tab:
      if (f) setActiveTab('followups');
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
      const relVisitTitle = ([].find((v) => v.id === f.relatedVisitId)?.title || "").toLowerCase() || '';
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

    crmApi.createRecord('follow_ups', newFollowUp).then(() => {
      refreshFollowups();
      setShowFollowUpModal(false);
    });
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

  const handleSaveEditFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFollowUp) return;
    const picUser = tenantUsers.find((u) => u.id === followUpPicIdInput) || {
      id: editingFollowUp.picId,
      name: editingFollowUp.picName,
      avatarUrl: editingFollowUp.picAvatar,
    };

    const updated: Partial<FollowUp> = {
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

    crmApi.updateRecord('follow_ups', editingFollowUp.id, updated).then(() => {
      refreshFollowups();
      setEditingFollowUp(null);
    });
  };

  const openCompleteFollowUpModal = (f: FollowUp) => {
    setCompletingFollowUp(f);
    setCompleteOutcomeInput(f.outcome || '');
  };

  const handleConfirmCompleteFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingFollowUp) return;

    const updated: Partial<FollowUp> = {
      ...completingFollowUp,
      status: 'COMPLETED',
      completedAt: new Date().toISOString().split('T')[0],
      outcome: completeOutcomeInput,
    };

    crmApi.updateRecord('follow_ups', completingFollowUp.id, updated).then(() => {
      refreshFollowups();
      setCompletingFollowUp(null);
    });
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

    const updated: Partial<FollowUp> = {
      ...reschedulingFollowUp,
      rescheduledFromDate: reschedulingFollowUp.followUpDate,
      followUpDate: rescheduleDateInput,
      reminderDate: `${rescheduleDateInput} ${rescheduleTimeInput}`,
      rescheduleReason: rescheduleReasonInput,
      status: 'PENDING',
    };

    crmApi.updateRecord('follow_ups', reschedulingFollowUp.id, updated).then(() => {
      refreshFollowups();
      setReschedulingFollowUp(null);
    });
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

    crmApi.createRecord('projects', newOpp).then(() => {
      refreshOpps();
      setShowOppModal(false);
    });
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
    const updated: Partial<Project> = {
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

    crmApi.updateRecord('projects', editingOpp.id, updated).then(() => {
      refreshOpps();
      setEditingOpp(null);
    });
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
    const isReopen = (oldStage === 'WON' || oldStage === 'LOST') && (newStageInput !== 'WON' && newStageInput !== 'LOST');

    crmApi.transitionProjectStage(changingStageOpp.id, newStageInput, {
      notes: stageChangeNotesInput || undefined,
      lossReason: newStageInput === 'LOST' ? (stageChangeNotesInput || 'Lost via Customer 360') : undefined,
      reopenReason: isReopen ? (stageChangeNotesInput || 'Reopened via Customer 360') : undefined,
      isReopen,
      expectedFromStage: oldStage
    }).then((res) => {
      if (res.success) {
        refreshOpps();
        setChangingStageOpp(null);
      } else {
        alert(`Stage transition failed: ${res.error}`);
      }
    });
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

    const updated: Partial<Project> = {
      ...reassigningOpp,
      picId: newPic.id,
      picName: newPic.name,
      picAvatar: newPic.avatarUrl,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    crmApi.updateRecord('projects', reassigningOpp.id, updated).then(() => {
      refreshOpps();
      setReassigningOpp(null);
    });
  };

  // Computed Metrics
  const totalVisits = 0;
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
    const updated: Partial<Customer> = {
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
    crmApi.updateCustomer(customer.id, updated).then(() => {
      loadAllCustomerData();
      setShowEditCustomerModal(false);
    });
  };

  const handleChangePic = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedUser = tenantUsers.find((u) => u.id === selectedPicId);
    if (!selectedUser) return;

    const updated: Partial<Customer> = {
      ...customer,
      assignedPicId: selectedUser.id,
      assignedPicName: selectedUser.name,
      assignedPicAvatar: selectedUser.avatarUrl,
      teamId: selectedUser.teamId || customer.teamId,
      teamName: selectedUser.teamName || customer.teamName,
    };

    crmApi.updateCustomer(customer.id, updated).then(() => {
      loadAllCustomerData();
      setShowChangePicModal(false);
    });
  };

  

  

  const handleSaveEditVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVisit) return;
    const updated: Partial<Visit> = {
      ...editingVisit,
      title: editVisitTitle,
      purpose: editVisitPurpose,
      location: editVisitLocation,
      status: editVisitStatus,
      result: editVisitResult,
      nextAction: editVisitNextAction,
    };
    crmApi.updateRecord('visits', editingVisit.id, updated).then(() => {
      refreshVisits();
      setEditingVisit(null);
    });
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
    const updated: Partial<Visit> = {
      ...reschedulingVisit,
      visitDate: rescheduleDate,
      startTime: rescheduleStartTime,
      endTime: rescheduleEndTime,
      status: 'RESCHEDULED',
      notes: rescheduleReason ? `Rescheduled: ${rescheduleReason}` : reschedulingVisit.notes,
    };
    crmApi.updateRecord('visits', reschedulingVisit.id, updated).then(() => {
      refreshVisits();
      setReschedulingVisit(null);
    });
  };

  const openCancelVisitModal = (v: Visit) => {
    setCancellingVisit(v);
    setCancelReason('');
  };

  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingVisit) return;
    const updated: Partial<Visit> = {
      ...cancellingVisit,
      status: 'CANCELLED',
      notes: cancelReason ? `Cancelled: ${cancelReason}` : cancellingVisit.notes,
    };
    crmApi.updateRecord('visits', cancellingVisit.id, updated).then(() => {
      refreshVisits();
      setCancellingVisit(null);
    });
  };




  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !customer) return;

    const existingNotes = customer.notes ? `${customer.notes}\n---\n${newNoteText}` : newNoteText;
    const updated: Customer = {
      ...customer,
      notes: existingNotes,
    };

    await crmApi.updateCustomer(customer.id, {
      notes: existingNotes
    });

    await crmApi.createRecord('activities', {
      tenantId,
      customerId: customer.id,
      userId: currentUser?.id || 'USR-005',
      typeId: 'NOTE',
      subject: 'Customer Note Added',
      description: newNoteText,
      entityType: 'CUSTOMER',
      entityId: customer.id
    });

    setCustomer(updated);
    setNewNoteText('');
    setShowNoteModal(false);
    loadAllCustomerData();
  };

  if (isLoadingCustomer) {
    return (
      <div className="bg-white p-12 rounded-xl border border-[#E1E1E1] text-center space-y-3">
        <div className="inline-block w-8 h-8 border-4 border-[#4744e5] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-[#767587] font-medium">Loading customer details...</p>
      </div>
    );
  }

  if (customerNotFound || !customer) {
    return (
      <div className="bg-white p-8 rounded-xl border border-[#E1E1E1] text-center">
        <h2 className="text-xl font-bold text-[#1a1c1c]">Customer Account Not Found</h2>
        <Link to="/customers" className="inline-block mt-4 px-4 py-2 bg-[#4744e5] text-white text-xs font-bold rounded-lg">
          Return to Customer Directory
        </Link>
      </div>
    );
  }

  const primaryContact = contactsList.find(c => c.isPrimary) || contactsList[0] || (customer.phone || customer.email ? {
    name: customer.contactPerson || customer.name || 'Primary Contact',
    position: 'Main Contact',
    email: customer.email || '',
    phone: customer.phone || '',
    isPrimary: true
  } : null);

  const displayStatus = (customer as any).statusName || customer.status || 'Active';
  const displayType = (customer as any).typeName || (customer as any).typeCode || customer.type || 'Enterprise';
  const displayPic = (customer as any).picName || customer.assignedPicName || 'Unassigned';

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
                customer.status === 'ACTIVE' || customer.status === 'CUSTOMER' || (customer as any).statusCode === 'ST_ACTIVE' || displayStatus === 'Active'
                  ? 'bg-[#00C875]/10 text-[#008f53]'
                  : 'bg-[#ffcc00]/20 text-[#8f7000]'
              }`}>
                {displayStatus}
              </span>
              <span className="px-2 py-0.5 bg-[#eff4ff] text-[#4744e5] rounded text-[10px] font-bold">
                {displayType}
              </span>
            </div>

            {/* Sub-header info strip */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#767587] mt-1.5">
              <span className="font-mono font-bold text-[#1a1c1c]">{customer.code}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">person</span>
                <span>PIC: <strong className="text-[#1a1c1c]">{displayPic}</strong></span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">phone</span>
                <span>{customer.phone || '-'}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                <span>{customer.region || ((customer as any).addresses?.[0]?.city) || '-'}</span>
              </span>
              <span>•</span>
              <span>Since: {customer.createdAt ? String(customer.createdAt).split('T')[0] : '-'}</span>
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
            onClick={() => setActiveTab('tasks')}
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
          { id: 'visits', label: 'Visits', count: 0 },
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
          <CustomerOverviewTab
            customer={customer!}
            customerNextAction={customerNextAction}
            summaryMetrics={{
              totalVisits,
              openTasks,
              completedTasks,
              pendingFollowups,
              activeProjects: activeOpps.length || 0,
              pipelineValue
            }}
            primaryContact={primaryContact}
            
            
            
            
            customerAttentionSignals={customerAttentionSignals}
            projectAttentionSummary={projectAttentionSummary}
            onViewActivities={() => setActiveTab('activities')}
            onViewProjects={() => setActiveTab('projects')}
            onViewVisits={() => setActiveTab('visits')}
            onViewTasks={() => setActiveTab('tasks')}
            onCreateProject={() => setShowOppModal(true)}
            onCreateVisit={() => setShowVisitModal(true)}
            onCreateTask={() => setActiveTab('tasks')}
            onCreateNote={() => setShowNoteModal(true)}
            onChangePic={() => setShowChangePicModal(true)}
          />
        )}

      {/* TABS OTHER THAN OVERVIEW */}
      {activeTab === 'visits' && (<CustomerVisitsTab customerId={id || ''} tenantUsers={tenantUsers} />)}

      {activeTab === 'tasks' && (
        <CustomerTasksTab customerId={id} tenantUsers={tenantUsers} projects={[]} />
      )}
      {activeTab === 'followups' && (<CustomerFollowUpsTab customerId={id || ''} tenantUsers={tenantUsers} projects={[]} />)}
        {activeTab === 'projects' && (
        <CustomerProjectsTab customerId={id || ''} tenantUsers={tenantUsers} customer={customer} />
      )}
      {false && (
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
          <CustomerActivitiesTab
            timelineEvents={timelineEvents}
            timelinePage={timelinePage}
            timelineHasMore={timelineHasMore}
            isLoadingTimeline={isLoadingTimeline}
            error={timelineError}
            onLoadMore={(page) => loadTimeline(page, true)}
            onOpenRelatedRecord={(type, recordId) => {
              if (type === 'TASK') {
                const t = null; // tasks removed
                // tasksList.find(x => x.id === recordId);
                if (t) { setActiveTab('tasks'); setActiveTab('tasks'); }
              } else if (type === 'VISIT') {
                const v = [].find(x => x.id === recordId);
                if (v) { setViewingVisit(v); setShowVisitModal(true); }
              } else if (type === 'FOLLOW_UP') {
                const f = followupsList.find(x => x.id === recordId);
                if (f) { setViewingFollowUp(f); setShowFollowUpModal(true); }
              } else if (type === 'PROJECT') {
                navigate(`/projects/${recordId}`);
              }
            }}
          />
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


      {/* MODAL: CREATE TASK */}
      

      {/* MODAL: VIEW TASK DETAILS */}
      

      {/* MODAL: EDIT TASK */}
      

      {/* MODAL: REASSIGN TASK PIC */}
      

      {/* MODAL 5: CREATE FOLLOW-UP */}
      

      {/* MODAL: VIEW FOLLOW-UP DETAILS */}
      

      {/* MODAL: EDIT FOLLOW-UP */}
      

      {/* MODAL: COMPLETE FOLLOW-UP */}
      

      {/* MODAL: RESCHEDULE FOLLOW-UP */}
      

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




    </div>
  );
};

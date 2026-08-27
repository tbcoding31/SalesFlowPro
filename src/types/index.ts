export type UserRole = 
  | 'SUPER_ADMIN'
  | 'TENANT_ADMIN'
  | 'SALES_MANAGER'
  | 'SUPERVISOR'
  | 'SALES_REPRESENTATIVE'
  | string;

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'PENDING';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'INVITED';

export type TenantType = 'Trial 3 Bulan' | 'Enterprise' | 'Professional' | 'Starter';

export interface Tenant {
  id: string;
  code: string;
  name: string;
  email: string;
  industry: string;
  phone: string;
  region: string;
  address: string;
  description?: string;
  type: TenantType;
  status: TenantStatus;
  trialEndDate?: string;
  isTrialExpired?: boolean;
  primaryAdminId?: string;
  primaryAdminName?: string;
  primaryAdminEmail?: string;
  createdAt: string;
  updatedAt?: string;
  lastActivityAt?: string;
  userCount?: number;
  activeUserCount?: number;
  userStats?: {
    total: number;
    active: number;
    suspended: number;
    inactive: number;
  };
  organizationStats?: {
    departments: number;
    teams: number;
    roles: number;
    salesReps: number;
  };
  primaryAdmin?: {
    id: string;
    name: string;
    email: string;
    role?: string;
    status?: string;
    lastLoginAt?: string;
  } | null;
  recentActivity?: Array<{
    id: string;
    action: string;
    entity?: string;
    description?: string;
    userName?: string;
    timestamp?: string;
  }>;
}

export interface User {
  id: string;
  tenantId?: string | null; // null for platform Super Admin
  tenantUserId?: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  username: string;
  phone?: string;
  avatarUrl?: string;
  avatar?: string;
  role: UserRole;
  roleName: string;
  department: string;
  position: string;
  teamId?: string;
  teamName?: string;
  status: UserStatus;
  activeTasksCount?: number;
  lastLoginAt?: string;
  permissions?: string[];
  dataScope?: string;
  createdAt: string;
}

export type CustomerType = string;
export type CustomerStatus = string;

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  position: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  type: 'OFFICE' | 'BILLING' | 'SHIPPING';
  address: string;
  city: string;
  province: string;
  postalCode?: string;
  isPrimary: boolean;
}

export interface Customer {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: CustomerType;
  industry: string;
  status: CustomerStatus;
  phone: string;
  email: string;
  region: string;
  address: string;
  picId?: string;
  assignedPicId: string;
  assignedPicName: string;
  assignedPicAvatar?: string;
  teamId?: string;
  teamName?: string;
  projectValue: number;
  lastVisitAt?: string;
  nextFollowUpAt?: string;
  notes?: string;
  customerSource?: string;
  contactPerson?: string;
  createdByName?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  createdAt: string;
  updatedAt?: string;
  contacts?: CustomerContact[];
  addresses?: CustomerAddress[];
}

export type VisitStatus = string;

export interface Visit {
  id: string;
  tenantId: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  picId: string;
  picName: string;
  picAvatar?: string;
  title: string;
  taskType?: string;
  purpose: string;
  visitDate: string;
  date?: string;
  startTime: string;
  endTime: string;
  location: string;
  status: VisitStatus;
  notes?: string;
  result?: string;
  nextAction?: string;
  createdAt: string;
}

export type TaskPriority = string;
export type TaskStatus = string;

export interface Task {
  id: string;
  tenantId: string;
  title: string;
  taskType?: string;
  description?: string;
  customerId?: string;
  customerName?: string;
  customerCode?: string;
  picId: string;
  picName: string;
  picAvatar?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  createdAt: string;
  completedAt?: string;
  relatedProjectId?: string;
  relatedTaskId?: string;
  relatedVisitId?: string;
  assignedToName?: string;
}

export type FollowUpType =
  | 'CALL'
  | 'EMAIL'
  | 'MEETING'
  | 'QUOTATION'
  | 'PROPOSAL'
  | 'GENERAL'
  | 'WHATSAPP'
  | 'OTHER'
  | string;

export type FollowUpStatus = 'SCHEDULED' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type FollowUpPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface FollowUp {
  id: string;
  tenantId: string;
  title?: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  relatedVisitId?: string;
  relatedProjectId?: string;
  relatedTaskId?: string;
  picId: string;
  picName: string;
  picAvatar?: string;
  followUpDate: string;
  reminderDate?: string;
  type: FollowUpType;
  priority?: FollowUpPriority;
  notes?: string;
  outcome?: string;
  status: FollowUpStatus;
  createdAt: string;
  completedAt?: string;
  rescheduledFromDate?: string;
  rescheduleReason?: string;
}

export type ProjectStage = string;

export interface Project {
  id: string;
  tenantId: string;
  name: string;
  title?: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  picId: string;
  picName: string;
  picAvatar?: string;
  estimatedValue: number;
  probability: number;
  expectedCloseDate: string;
  stage: ProjectStage;
  source: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type ActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'VISIT' | 'NOTE' | 'WHATSAPP' | 'TASK' | 'PROJECT' | 'SYSTEM';

export interface Activity {
  id: string;
  tenantId: string;
  customerId?: string;
  customerName?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  type: ActivityType;
  subject: string;
  description: string;
  occurredAt: string;
  entityType?: string;
  entityId?: string;
  changes?: { field: string; oldValue?: any; newValue?: any }[];
  metadata?: Record<string, any>;
}

export type SalesTargetScope = 'USER' | 'TEAM';
export type SalesTargetType = 'WON_PROJECT_VALUE' | 'WON_PROJECT_COUNT';
export type SalesTargetStatus = 'ACTIVE' | 'INACTIVE';

export interface SalesTarget {
  id: string;
  tenantId: string;
  targetScope: SalesTargetScope;
  tenantUserId?: string | null;
  teamId?: string | null;
  targetType: SalesTargetType;
  periodStart: string;
  periodEnd: string;
  targetValue: number;
  status: SalesTargetStatus;
  createdById: string;
  createdAt?: string;
  updatedAt?: string;
  // Resolved presentation fields
  userId?: string;
  userName?: string;
  userEmail?: string;
  teamName?: string;
}

export interface UserTargetAttainment {
  tenantUserId: string;
  userId: string;
  name: string;
  email: string;
  teamId?: string | null;
  teamName: string;
  targetId?: string | null;
  targetType: SalesTargetType;
  targetValue: number | null;
  actualValue: number;
  actualCount: number;
  attainmentPercent: number | null;
  remainingValue: number | null;
  hasTargetAssigned: boolean;
}

export interface TeamTargetAttainment {
  teamId: string;
  teamName: string;
  targetId?: string | null;
  targetType: SalesTargetType;
  targetValue: number | null;
  actualValue: number;
  actualCount: number;
  attainmentPercent: number | null;
  remainingValue: number | null;
  hasTargetAssigned: boolean;
}

export interface SalesTargetAttainmentResponse {
  businessDate: string;
  evaluatedAt: string;
  scope: string;
  period: {
    periodStart: string;
    periodEnd: string;
    targetType: SalesTargetType;
  };
  summary: {
    totalReps: number;
    repsWithTarget: number;
    totalTargetValue: number;
    totalActualValue: number;
    totalActualCount: number;
    overallAttainmentPercent: number | null;
  };
  repAttainment: UserTargetAttainment[];
  teamAttainment: TeamTargetAttainment[];
  coverage: {
    wonProjectsInPeriod: number;
    wonProjectsWithUserAttribution: number;
    wonProjectsWithTeamAttribution: number;
    missingAttributionCount: number;
  };
}

export interface MasterDataItem {
  id: string;
  tenantId?: string; // empty if global
  category: 'customer_types' | 'customer_status' | 'customer_statuses' | 'visit_purposes' | 'task_priorities' | 'task_statuses' | 'project_stages' | 'departments' | 'positions' | 'task_types';
  label: string;
  codeValue: string;
  code_value?: string;
  indicator?: string;
  isDefault: boolean;
  is_default?: boolean;
  displayOrder: number;
}

export interface NotificationItem {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  taskType?: string;
  message: string;
  type: 'TASK' | 'VISIT' | 'FOLLOW_UP' | 'PROJECT' | 'SYSTEM';
  isRead: boolean;
  createdAt: string;
  linkUrl?: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  tenantName?: string;
  userId: string;
  userName: string;
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'ASSIGN' | 'STATUS_CHANGE' | 'PASSWORD_CHANGE' | 'ROLE_CHANGE';
  module: string;
  entity: string;
  entityId: string;
  description: string;
  ipAddress: string;
  timestamp: string;
}

export interface PermissionDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  module: string;
  category: string;
  isSystem: boolean | number;
  isTenantAssignable: boolean | number;
  status: string;
}

export interface RolePermissions {
  role: UserRole;
  roleName: string;
  scope?: 'SYSTEM' | 'TEMPLATE' | 'TENANT' | string;
  isSystem?: boolean | number;
  tenantId?: string | null;
  description?: string;
  memberCount?: number;
  dataScope: 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ORGANIZATION' | 'SYSTEM';
  assignedPermissions?: string[];
  permissions?: {
    module: string;
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    assign?: boolean;
    reassign?: boolean;
    complete?: boolean;
    export?: boolean;
    moveStage?: boolean;
  }[];
}

export type CadenceActionType = 'VISIT' | 'FOLLOW_UP' | 'TASK';
export type CadenceFrequencyUnit = 'DAY' | 'WEEK' | 'MONTH';
export type CadenceStatus = 'ACTIVE' | 'PAUSED';
export type CadenceExecutionHealth = 'IN_FLIGHT' | 'READY_TO_GENERATE' | 'BLOCKED_INVALID_PIC' | 'ACTION_CANCELLED' | 'PAUSED';

export interface MaintenanceCadence {
  id: string;
  tenantId: string;
  customerId?: string | null;
  customerName?: string;
  customerCode?: string;
  projectId?: string | null;
  projectName?: string;
  actionType: CadenceActionType;
  actionTypeDetails?: string;
  frequencyUnit: CadenceFrequencyUnit;
  frequencyInterval: number;
  title?: string;
  notes?: string;
  startDate: string;
  nextDueAt: string;
  status: CadenceStatus;
  lastGeneratedActionId?: string | null;
  lastGeneratedActionType?: string | null;
  lastOccurrenceIndex: number;
  lastCompletedAt?: string | null;
  createdById?: string;
  createdAt?: string;
  updatedAt?: string;
  // Derived metadata for UI
  executionHealth?: CadenceExecutionHealth;
  picId?: string;
  picName?: string;
}

export type AttentionSignalSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type AttentionSignalCode =
  | 'PROJECT_MISSING_NEXT_ACTION'
  | 'PROJECT_OVERDUE_ACTION'
  | 'CUSTOMER_OVERDUE_ACTION'
  | 'EXPECTED_CLOSE_OVERDUE'
  | 'CADENCE_BLOCKED_INVALID_PIC'
  | 'CADENCE_ACTION_CANCELLED'
  | 'PROJECT_NO_ACTIVE_PIC'
  | 'CUSTOMER_NO_ACTIVE_PIC';

export interface AttentionSignal {
  code: AttentionSignalCode;
  severity: AttentionSignalSeverity;
  title: string;
  reason: string;
  evaluatedAt: string;
  recommendedAction: string;
  metadata?: Record<string, any>;
}

export interface ProjectAttentionSummary {
  projectsNeedingAttention: number;
  criticalCount: number;
  warningCount: number;
  projects: {
    id: string;
    title: string;
    stage: string;
    signals: AttentionSignal[];
  }[];
}

export interface SalesAttentionSummary {
  customersNeedingAttention: number;
  projectsNeedingAttention: number;
  criticalSignals: number;
  warningSignals: number;
  overdueActions: number;
}

export interface SalesAttentionResponse {
  evaluatedAt: string;
  businessDate: string;
  summary: SalesAttentionSummary;
  projects: {
    id: string;
    title: string;
    stage: string;
    customerId?: string;
    customerName?: string;
    picId?: string;
    picName?: string;
    signals: AttentionSignal[];
  }[];
  customers: {
    id: string;
    name: string;
    code?: string;
    status: string;
    picId?: string;
    picName?: string;
    signals: AttentionSignal[];
    projectAttentionSummary?: ProjectAttentionSummary;
  }[];
}

export interface RepWorkloadSummary {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  status: string;
  teamId?: string;
  teamName?: string;
  openProjects: number;
  openTasks: number;
  overdueActions: number;
  todayVisits: number;
  todayTasks: number;
  pendingFollowups: number;
  attentionSignals: number;
  blockedCadences: number;
  completedToday: number;
}

export interface ControlTowerSummary {
  activeSalesReps: number;
  openProjects: number;
  projectsNeedingAttention: number;
  overdueActions: number;
  dueToday: number;
  upcomingWork: number;
  blockedCadences: number;
  projectsMissingNextAction: number;
  expectedCloseOverdue: number;
  completedToday: number;
  criticalSignals: number;
  warningSignals: number;
}

export interface ControlTowerResponse {
  businessDate: string;
  evaluatedAt: string;
  scope: 'TEAM' | 'ORGANIZATION' | 'OWN' | string;
  summary: ControlTowerSummary;
  reps: RepWorkloadSummary[];
  projectsNeedingAttention: any[];
  overdueWork: any[];
  blockedCadences: any[];
}

export interface PipelineStageSummary {
  stage: string;
  label: string;
  count: number;
  value: number;
  weightedValue: number;
}

export interface RepPipelineSummary {
  userId: string;
  name: string;
  email: string;
  teamId?: string;
  teamName?: string;
  openProjects: number;
  pipelineValue: number;
  weightedPipelineValue: number;
  wonProjects: number;
  wonValue: number;
  lostProjects: number;
  lostValue: number;
  winRate: number;
}

export interface StageVelocityMetric {
  stage: string;
  label: string;
  transitionCount: number;
  averageDays: number;
  medianDays: number;
}

export interface ExpectedCloseForecastMonth {
  month: string; // YYYY-MM
  label: string;
  projectCount: number;
  pipelineValue: number;
  weightedValue: number;
}

export interface PipelineAnalyticsSummary {
  openProjects: number;
  pipelineValue: number;
  weightedPipelineValue: number;
  wonProjects: number;
  wonValue: number;
  lostProjects: number;
  lostValue: number;
  winRate: number;
  averageSalesCycleDays: number;
  medianSalesCycleDays: number;
  averageOpenProjectAgeDays: number;
}

export interface PipelineAnalyticsCoverage {
  totalProjects: number;
  openProjects: number;
  closedProjects: number;
  projectsWithProbability: number;
  projectsMissingProbability: number;
  pipelineValueMissingProbability: number;
  projectsWithExpectedCloseDate: number;
  projectsWithStageHistory: number;
  terminalProjectsMissingTerminalHistory: number;
  reopenedProjects: number;
  projectsExcludedFromCycleMetrics: number;
  invalidTransitionsExcluded: number;
}

export interface PipelineAnalyticsResponse {
  businessDate: string;
  evaluatedAt: string;
  scope: 'OWN' | 'TEAM' | 'ORGANIZATION' | string;
  currency: string;
  summary: PipelineAnalyticsSummary;
  stageDistribution: PipelineStageSummary[];
  repPipeline: RepPipelineSummary[];
  stageVelocity: StageVelocityMetric[];
  expectedCloseForecast: {
    overdue: { count: number; value: number; weightedValue: number };
    upcomingMonths: ExpectedCloseForecastMonth[];
    missingCloseDate: { count: number; value: number; weightedValue: number };
  };
  coverage: PipelineAnalyticsCoverage;
  recentProjects: any[];
}

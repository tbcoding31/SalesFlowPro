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
  isForecastAvailable?: boolean;
  rawPipelineValue?: number;
  weightedPipelineValue?: number;
  rawPipelineCount?: number;
  weightedPipelineCount?: number;
  projectedCoveragePercent?: number | null;
  projectedGap?: number | null;
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
  isForecastAvailable?: boolean;
  rawPipelineValue?: number;
  weightedPipelineValue?: number;
  rawPipelineCount?: number;
  weightedPipelineCount?: number;
  projectedCoveragePercent?: number | null;
  projectedGap?: number | null;
}

export interface SalesTargetAttainmentResponse {
  businessDate: string;
  evaluatedAt: string;
  scope: string;
  period: {
    periodStart: string;
    periodEnd: string;
    targetType: SalesTargetType;
    isHistoricalPeriod?: boolean;
    isForecastAvailable?: boolean;
  };
  summary: {
    totalReps: number;
    repsWithTarget: number;
    totalTargetValue: number;
    totalActualValue: number;
    totalActualCount: number;
    overallAttainmentPercent: number | null;
    remainingTarget?: number;
    rawPipelineValue?: number;
    weightedPipelineValue?: number;
    rawPipelineCount?: number;
    weightedPipelineCount?: number;
    projectedCoveragePercent?: number | null;
    projectedGap?: number | null;
  };
  repAttainment: UserTargetAttainment[];
  teamAttainment: TeamTargetAttainment[];
  coverage: {
    wonProjectsInPeriod: number;
    wonProjectsWithUserAttribution: number;
    wonProjectsMissingUserAttribution: number;
    wonProjectsWithTeamAttribution: number;
    wonProjectsMissingTeamAttribution: number;
    missingAttributionCount: number;
    eligibleOpenProjectsInPeriod?: number;
    projectsExpectedInsidePeriod?: number;
    projectsExpectedOutsidePeriod?: number;
    projectsEligibleForWeightedValue?: number;
    projectsEligibleForWeightedCount?: number;
    projectsWithValue?: number;
    projectsMissingValue?: number;
    projectsWithProbability?: number;
    projectsMissingProbability?: number;
    projectsWithExpectedCloseDate?: number;
  };
}

export interface ProjectActivityCoverage {
  projectId: string;
  projectTitle: string;
  customerId: string;
  customerName: string;
  picId: string;
  picTenantUserId: string;
  picName: string;
  picTeamId?: string;
  stageId: string;
  expectedCloseDate: string;
  value: number | null;
  probability: number | null;
  weightedValue: number | null;
  hasNextAction: boolean;
  hasOverdueAction: boolean;
  overdueActionsCount: number;
  hasActiveCadence: boolean;
  isCadenceBlocked: boolean;
  isPicInvalid: boolean;
  nextAction?: {
    id: string;
    type: 'TASK' | 'VISIT' | 'FOLLOW_UP';
    title: string;
    date: string;
  } | null;
}

export interface RepActivityCoverage {
  tenantUserId: string;
  userId: string;
  name: string;
  email: string;
  teamId?: string;
  teamName: string;
  isCoverageAvailable: boolean;
  eligibleTargetPeriodProjects: number | null;
  projectsWithNextAction: number | null;
  projectsMissingNextAction: number | null;
  nextActionCoveragePercent: number | null;
  projectsWithOverdueActions: number | null;
  overdueActionsCount: number | null;
  projectsWithBlockedCadence: number | null;
  coveredPipelineValue: number | null;
  uncoveredPipelineValue: number | null;
  coveredWeightedPipelineValue: number | null;
  uncoveredWeightedPipelineValue: number | null;
  weightedPipelineCoveragePercent: number | null;
}

export interface TargetActivityCoverageResponse {
  businessDate: string;
  evaluatedAt: string;
  scope: string;
  period: {
    periodStart: string;
    periodEnd: string;
    isHistoricalPeriod: boolean;
    isCoverageAvailable: boolean;
  };
  summary: {
    isCoverageAvailable: boolean;
    linearPace: {
      totalPeriodDays: number;
      elapsedPeriodDays: number;
      elapsedPeriodPercent: number;
    };
    eligibleTargetPeriodProjects: number | null;
    projectsWithNextAction: number | null;
    projectsMissingNextAction: number | null;
    nextActionCoveragePercent: number | null;
    projectsWithOverdueActions: number | null;
    overdueActionsCount: number | null;
    projectsWithBlockedCadence: number | null;
    projectsWithInvalidPic: number | null;
    coveredPipelineValue: number | null;
    uncoveredPipelineValue: number | null;
    coveredWeightedPipelineValue: number | null;
    uncoveredWeightedPipelineValue: number | null;
    weightedPipelineCoveragePercent: number | null;
  };
  repCoverage: RepActivityCoverage[];
  projects: ProjectActivityCoverage[];
}

export interface StageDurationBaseline {
  stageId: string;
  sampleSize: number;
  statisticsAvailable: boolean;
  comparisonPolicyConfigured: boolean;
  comparisonMinimumSampleSize: number | null;
  comparisonAvailable: boolean;
  comparisonUnavailableReason: string | null;
  averageDays: number | null;
  medianDays: number | null;
  p25Days: number | null;
  p75Days: number | null;
  p90Days: number | null;
}

export interface CurrentProjectVelocity {
  projectId: string;
  projectTitle: string;
  customerId: string;
  customerName: string;
  picId: string;
  picName: string;
  picTeamName: string;
  stageId: string;
  value: number | null;
  probability: number | null;
  expectedCloseDate: string | null;
  stageEnteredAt: string | null;
  stageEntryProvenance: 'CURRENT_STAGE_ENTRY_KNOWN_FROM_HISTORY' | 'CURRENT_STAGE_ENTRY_KNOWN_FROM_CREATION' | 'CURRENT_STAGE_ENTRY_UNKNOWN';
  daysInCurrentStage: number | null;
  baselineMedianDays: number | null;
  baselineP75Days: number | null;
  statisticsAvailable: boolean;
  comparisonAvailable: boolean;
  relativePosition: 'BELOW_MEDIAN' | 'AT_MEDIAN' | 'ABOVE_MEDIAN' | 'ABOVE_P75' | 'INSUFFICIENT_SAMPLE_FOR_COMPARISON' | 'COMPARISON_POLICY_NOT_CONFIGURED' | 'UNKNOWN_STAGE_ENTRY';
  hasNextAction: boolean;
  nextAction: {
    id: string;
    type: 'TASK' | 'VISIT' | 'FOLLOW_UP';
    title: string;
    date: string | null;
  } | null;
}

export interface PipelineVelocityResponse {
  businessDate: string;
  evaluatedAt: string;
  scope: string;
  baselineScope: string;
  comparisonPolicyConfigured: boolean;
  comparisonMinimumSampleSize: number | null;
  baselines: StageDurationBaseline[];
  currentProjects: CurrentProjectVelocity[];
  coverage: {
    totalOpenProjectsInScope: number;
    projectsWithHistoryCount: number;
    projectsMissingHistoryCount: number;
    projectsUsingCreationEntryCount: number;
    projectsUsingHistoryEntryCount: number;
    projectsWithUnknownEntryCount: number;
    totalStageIntervalsEvaluated: number;
    validStageIntervals: number;
    invalidIntervalsExcluded: number;
  };
}

export interface ProjectInterventionPolicy {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description: string | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  matchMode: 'ALL';
  status: 'ACTIVE' | 'INACTIVE';
  createdById: string;
  createdAt: string;
  updatedAt: string;
  conditions: string[];
}

export interface ProjectInterventionItem {
  policyId: string;
  policyCode: string;
  policyName: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  matchedConditions: string[];
  conditionEvaluations: Array<{
    conditionType: string;
    state: 'MATCHED' | 'NOT_MATCHED' | 'UNKNOWN';
    reason: string | null;
  }>;
  recommendedActions: Array<{
    actionType: string;
    description: string;
    path: string;
  }>;
}

export interface EvaluatedProjectIntervention {
  projectId: string;
  projectTitle: string;
  customerId: string;
  customerName: string;
  picId: string;
  picName: string;
  picTeamName: string;
  stageId: string;
  value: number | null;
  probability: number | null;
  expectedCloseDate: string | null;
  stageEnteredAt: string | null;
  daysInCurrentStage: number | null;
  supportingFacts: Record<string, any>;
  interventionStatus: 'NONE' | 'MATCHED' | 'UNKNOWN';
  interventions: ProjectInterventionItem[];
}

export interface ProjectInterventionsResponse {
  businessDate: string;
  evaluatedAt: string;
  scope: string;
  interventionPolicyConfigured: boolean;
  activePoliciesCount: number;
  summary: {
    totalProjectsEvaluated: number;
    projectsWithMatchedInterventions: number;
    unknownEvaluationProjectsCount: number;
    criticalInterventionsCount: number;
    warningInterventionsCount: number;
    infoInterventionsCount: number;
  };
  currentProjects: EvaluatedProjectIntervention[];
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

export interface ProjectInterventionEpisode {
  id: string;
  tenantId: string;
  projectId: string;
  projectTitle: string;
  customerName: string;
  currentPicId?: string;
  picName: string;
  policyId: string;
  policyCode: string;
  policyName: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  matchMode: string;
  conditions: string[];
  startFacts: Record<string, any>;
  endFacts?: Record<string, any> | null;
  startReason: string;
  endReason?: string | null;
  startedByEventType: string;
  endedByEventType?: string | null;
  startedByUserId?: string | null;
  endedByUserId?: string | null;
  startedAt: string;
  endedAt?: string | null;
  durationHours?: number | null;
  durationDays?: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface ProjectInterventionHistoryResponse {
  tenantId: string;
  evaluatedAt: string;
  scope: string;
  summary: {
    totalEpisodes: number;
    activeEpisodesCount: number;
    resolvedEpisodesCount: number;
    episodesWithExactStart?: number;
    episodesWithObservedStart?: number;
    episodesWithExactDuration?: number;
    episodesWithPartialObservedDuration?: number;
    historyCoverageStartAt?: string | null;
  };
  episodes: ProjectInterventionEpisode[];
}

export interface PolicyAnalyticsItem {
  policyId: string;
  policyCode: string;
  policyName: string;
  severity: string;
  totalEpisodes: number;
  activeEpisodes: number;
  resolvedEpisodes: number;
  businessResolvedEpisodes: number;
  uniqueProjectsCount: number;
  recurringProjectsCount: number;
  exactSampleSize: number;
  medianBusinessResolutionHours: number | null;
  averageBusinessResolutionHours: number | null;
  endReasons: Record<string, number>;
}

export interface ProjectRecurrenceAnalyticsItem {
  projectId: string;
  projectTitle: string;
  customerName: string;
  currentPicId?: string;
  picName: string;
  totalEpisodes: number;
  activeEpisodes: number;
  resolvedEpisodes: number;
  recurrenceCount: number;
  policies: {
    policyId: string;
    policyCode: string;
    policyName: string;
    severity: string;
    episodeCount: number;
    recurrenceCount: number;
    hasActive: boolean;
  }[];
}

export interface RepAnalyticsItem {
  picId: string | null;
  picName: string;
  totalEpisodes: number;
  activeEpisodes: number;
  resolvedEpisodes: number;
  businessResolvedEpisodes: number;
  exactSampleSize: number;
  medianBusinessResolutionHours: number | null;
}

export interface PolicyRevision {
  id: string;
  tenantId: string;
  policyId: string;
  revisionNumber: number;
  severity: string;
  matchMode: string;
  createdById: string;
  createdByName?: string;
  createdAt: string;
  changeReason?: string | null;
  migrationProvenance?: string | null;
  isCurrentActive: boolean;
  conditions: string[];
}

export interface InterventionAnalyticsResponse {
  tenantId: string;
  evaluatedAt: string;
  scope: string;
  periodFilterBasis: 'STARTED_AT';
  summary: {
    totalEpisodes: number;
    activeEpisodes: number;
    closedEpisodes: number;
    businessResolvedEpisodes: number;
    exactClosedEpisodes: number;
    exactBusinessResolvedEpisodes: number;
    observedPartialClosedEpisodes: number;
    observedPartialBusinessResolvedEpisodes: number;
    uniqueProjectsWithEpisodes: number;
    recurringProjectCount: number;
    totalRecurrences: number;
    policiesWithEpisodes: number;
    versionedEpisodes?: number;
    legacyUnversionedEpisodes?: number;
    unattributedPicEpisodes?: number;
  };
  resolutionDuration: {
    metric: string;
    storagePrecisionHours?: number;
    sampleSize: number;
    averageResolutionHours: number | null;
    medianResolutionHours: number | null;
    p25ResolutionHours: number | null;
    p75ResolutionHours: number | null;
    p90ResolutionHours: number | null;
    minResolutionHours: number | null;
    maxResolutionHours: number | null;
  };
  recurrence: {
    totalRecurrences: number;
    recurringProjectCount: number;
    totalRevisionRecurrences?: number;
    recurringProjectsRevisionCount?: number;
    repeatIntervalsSample: number;
    averageRepeatIntervalHours: number | null;
    medianRepeatIntervalHours: number | null;
    overlapAnomalyCount?: number;
  };
  dataQuality?: {
    invalidNegativeDurationCount: number;
    missingDurationCount: number;
    unknownEndReasonCount: number;
  };
  endReasonBreakdown: Record<string, number>;
  severityBreakdown: Record<string, number>;
  coverage: {
    historyCoverageStartAt: string | null;
    exactClosedEpisodes: number;
    observedPartialClosedEpisodes: number;
    exactBusinessResolvedEpisodes: number;
    observedPartialBusinessResolvedEpisodes: number;
    exactClosedDurationCoveragePercent: number | null;
    exactBusinessResolutionCoveragePercent: number | null;
    versionedEpisodes?: number;
    legacyUnversionedEpisodes?: number;
    revisionIdentityCoveragePercent?: number | null;
  };
  policyBreakdown: PolicyAnalyticsItem[];
  projectBreakdown: ProjectRecurrenceAnalyticsItem[];
  repBreakdown: RepAnalyticsItem[];
}

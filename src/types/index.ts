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

export interface SalesTarget {
  id: string;
  tenantId: string;
  userId?: string;
  userName?: string;
  repId?: string;
  repName?: string;
  repAvatar?: string;
  period?: string;
  month?: string; // YYYY-MM
  targetAmount?: number;
  actualAmount?: number;
  targetRevenue?: number;
  achievedRevenue?: number;
  targetVisits: number;
  actualVisits?: number;
  achievedVisits?: number;
  targetDeals?: number;
  actualDeals?: number;
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

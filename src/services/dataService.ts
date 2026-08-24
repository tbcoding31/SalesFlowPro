import {
  Tenant,
  User,
  Customer,
  Visit,
  Task,
  FollowUp,
  Project,
  Activity,
  SalesTarget,
  MasterDataItem,
  NotificationItem,
  AuditLog,
  RolePermissions
} from '../types';
import {
  INITIAL_TENANTS,
  INITIAL_USERS,
  INITIAL_CUSTOMERS,
  INITIAL_VISITS,
  INITIAL_TASKS,
  INITIAL_FOLLOWUPS,
  INITIAL_PROJECTS,
  INITIAL_ACTIVITIES,
  INITIAL_TARGETS,
  INITIAL_MASTER_DATA,
  INITIAL_NOTIFICATIONS,
  INITIAL_AUDIT_LOGS,
  DEFAULT_ROLE_PERMISSIONS
} from '../data/initialData';

const STORAGE_KEYS = {
  TENANTS: 'sfp_tenants_v1',
  USERS: 'sfp_users_v1',
  CUSTOMERS: 'sfp_customers_v1',
  VISITS: 'sfp_visits_v1',
  TASKS: 'sfp_tasks_v1',
  FOLLOWUPS: 'sfp_followups_v1',
  PROJECTS: 'sfp_projects_v1',
  ACTIVITIES: 'sfp_activities_v1',
  TARGETS: 'sfp_targets_v1',
  MASTER_DATA: 'sfp_master_data_v1',
  NOTIFICATIONS: 'sfp_notifications_v1',
  AUDIT_LOGS: 'sfp_audit_logs_v1',
  ROLE_PERMISSIONS: 'sfp_role_permissions_v1',
};

function getLocal<T>(key: string, initial: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item || item === 'undefined' || item === 'null') {
      localStorage.setItem(key, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(item);
    if (!parsed || (Array.isArray(initial) && !Array.isArray(parsed))) {
      return initial;
    }
    return parsed;
  } catch (e) {
    console.error('Error reading localStorage key', key, e);
    return initial;
  }
}


const syncPush = async (method: 'POST'|'PUT'|'DELETE', endpoint: string, data?: any, onRollback?: () => void) => {
  try {
    const res = await fetch(`/api/${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    });
    if (!res.ok) {
      console.warn(`[Sync Error] ${method} /api/${endpoint} returned ${res.status}. Rolling back local cache state.`);
      if (onRollback) {
        onRollback();
      }
    }
  } catch (e) {
    console.error(`[Sync Network Error] ${method} /api/${endpoint}`, e);
    if (onRollback) {
      onRollback();
    }
  }
};

function setLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error writing localStorage key', key, e);
  }
}

export const DataService = {
  // TENANTS
  getTenants: (): Tenant[] => getLocal(STORAGE_KEYS.TENANTS, INITIAL_TENANTS),
  getTenantById: (id: string): Tenant | undefined => {
    return DataService.getTenants().find((t) => t.id === id);
  },
  cacheTenant: (tenant: Tenant): void => {
    const tenants = DataService.getTenants();
    const idx = tenants.findIndex((t) => t.id === tenant.id);
    if (idx >= 0) {
      tenants[idx] = tenant;
    } else {
      tenants.unshift(tenant);
    }
    setLocal(STORAGE_KEYS.TENANTS, tenants);
  },
  saveTenant: (tenant: Tenant): Tenant => {
    const tenants = DataService.getTenants();
    const idx = tenants.findIndex((t) => t.id === tenant.id);
    if (idx >= 0) {
      tenants[idx] = tenant;
    } else {
      tenants.unshift(tenant);
    }
    setLocal(STORAGE_KEYS.TENANTS, tenants);
    syncPush(idx >= 0 ? 'PUT' : 'POST', idx >= 0 ? `tenants/${tenant.id}` : 'tenants', tenant);
    DataService.addAuditLog({
      tenantId: tenant.id,
      tenantName: tenant.name,
      userId: 'USR-001',
      userName: 'Ahmad Ricky',
      action: idx >= 0 ? 'UPDATE' : 'CREATE',
      module: 'Tenant Management',
      entity: 'Tenant',
      entityId: tenant.id,
      description: `Saved tenant ${tenant.name} (${tenant.code}) with status ${tenant.status}`,
      ipAddress: '127.0.0.1'
    });
    return tenant;
  },
  updateTenantStatus: (id: string, status: Tenant['status']): Tenant | undefined => {
    const tenant = DataService.getTenantById(id);
    if (tenant) {
      tenant.status = status;
      tenant.updatedAt = new Date().toISOString().split('T')[0];
      DataService.saveTenant(tenant);
    }
    return tenant;
  },

  // USERS
  getUsers: (tenantId?: string): User[] => {
    const users = getLocal(STORAGE_KEYS.USERS, INITIAL_USERS);
    if (!tenantId || tenantId === 'ALL' || tenantId === 'SYSTEM') {
      return users;
    }
    return users.filter((u) => u.tenantId === tenantId);
  },
  getUserById: (id: string): User | undefined => {
    return getLocal(STORAGE_KEYS.USERS, INITIAL_USERS).find((u) => u.id === id);
  },
  saveUser: (user: User): User => {
    const users = getLocal(STORAGE_KEYS.USERS, INITIAL_USERS);
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      users[idx] = user;
    } else {
      users.unshift(user);
    }
    setLocal(STORAGE_KEYS.USERS, users);
    syncPush(idx >= 0 ? 'PUT' : 'POST', idx >= 0 ? `users/${user.id}` : 'users', user);
    DataService.addAuditLog({
      tenantId: user.tenantId,
      userId: 'USR-002',
      userName: 'Sarah Jenkins',
      action: idx >= 0 ? 'UPDATE' : 'CREATE',
      module: 'User Management',
      entity: 'Tenant User',
      entityId: user.id,
      description: `Saved user ${user.name} (${user.email}) as ${user.roleName}`,
      ipAddress: '127.0.0.1'
    });
    return user;
  },

  // CUSTOMERS
  getCustomers: (tenantId: string): Customer[] => {
    const customers = getLocal(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    if (tenantId === 'SYSTEM' || tenantId === 'ALL') return customers;
    return customers.filter((c) => c.tenantId === tenantId);
  },
  getCustomerById: (id: string): Customer | undefined => {
    return getLocal(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS).find((c) => c.id === id);
  },
  saveCustomer: (customer: Customer): Customer => {
    const previousCustomers = getLocal(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    const customers = [...previousCustomers];
    const idx = customers.findIndex((c) => c.id === customer.id);
    if (idx >= 0) {
      customers[idx] = customer;
    } else {
      customers.unshift(customer);
    }
    setLocal(STORAGE_KEYS.CUSTOMERS, customers);
    
    // Map to DB Schema columns: title/name, assignedPicId -> picId, etc.
    const cAny = customer as any;
    const dbPayload: any = {
      id: customer.id,
      tenantId: customer.tenantId,
      code: customer.code,
      name: customer.name,
      typeId: customer.type,
      statusId: customer.status,
      industry: customer.industry,
      tier: cAny.tier,
      creditLimit: cAny.creditLimit,
      taxId: cAny.taxId,
      picId: customer.assignedPicId || 'USR-005'
    };

    syncPush(
      idx >= 0 ? 'PUT' : 'POST',
      idx >= 0 ? `customers/${customer.id}` : 'customers',
      dbPayload,
      () => {
        // Rollback on failure
        setLocal(STORAGE_KEYS.CUSTOMERS, previousCustomers);
      }
    );

    DataService.addActivity({
      tenantId: customer.tenantId,
      customerId: customer.id,
      customerName: customer.name,
      userId: customer.assignedPicId || 'USR-005',
      userName: customer.assignedPicName || 'Budi Santoso',
      type: 'NOTE',
      subject: idx >= 0 ? 'Customer Record Updated' : 'New Customer Created',
      description: `Customer ${customer.name} (${customer.code}) details updated.`,
      occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    });
    return customer;
  },
  deleteCustomer: (id: string): void => {
    const previousCustomers = getLocal(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    const filtered = previousCustomers.filter((c) => c.id !== id);
    setLocal(STORAGE_KEYS.CUSTOMERS, filtered);
    syncPush('DELETE', `customers/${id}`, undefined, () => {
      // Rollback on failure
      setLocal(STORAGE_KEYS.CUSTOMERS, previousCustomers);
    });
  },

  // VISITS
  getVisits: (tenantId: string, customerId?: string): Visit[] => {
    const visits = getLocal(STORAGE_KEYS.VISITS, INITIAL_VISITS);
    const tasks = getLocal(STORAGE_KEYS.TASKS, INITIAL_TASKS);
    
    // Map tasks of type 'Visit' to Visit interface
    const visitTasks: Visit[] = tasks
      .filter(t => t.taskType === 'Visit')
      .map(t => ({
        id: t.id,
        tenantId: t.tenantId,
        customerId: t.customerId || '',
        customerName: t.customerName || 'Unknown Customer',
        customerCode: t.customerCode || '',
        picId: t.picId,
        picName: t.picName,
        picAvatar: t.picAvatar,
        title: t.title,
        purpose: t.description || 'Task Visit',
        visitDate: t.dueDate || t.createdAt.split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        location: 'TBD',
        status: t.status === 'COMPLETED' ? 'COMPLETED' : 'PLANNED',
        createdAt: t.createdAt,
      }));

    const combinedVisits = [...visitTasks, ...visits];

    let filtered = tenantId === 'SYSTEM' || tenantId === 'ALL' ? combinedVisits : combinedVisits.filter((v) => v.tenantId === tenantId);
    if (customerId) {
      filtered = filtered.filter((v) => v.customerId === customerId);
    }
    
    // Deduplicate by ID just in case
    const uniqueMap = new Map<string, Visit>();
    filtered.forEach(v => uniqueMap.set(v.id, v));
    return Array.from(uniqueMap.values()).sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
  },
  saveVisit: (visit: Visit): Visit => {
    const visits = getLocal(STORAGE_KEYS.VISITS, INITIAL_VISITS);
    const idx = visits.findIndex((v) => v.id === visit.id);
    if (idx >= 0) {
      visits[idx] = visit;
    } else {
      visits.unshift(visit);
    }
    setLocal(STORAGE_KEYS.VISITS, visits);
    DataService.addActivity({
      tenantId: visit.tenantId,
      customerId: visit.customerId,
      customerName: visit.customerName,
      userId: visit.picId,
      userName: visit.picName,
      type: 'VISIT',
      subject: visit.title,
      description: `Visit scheduled for ${visit.visitDate} ${visit.startTime}. Status: ${visit.status}`,
      occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    });
    return visit;
  },

  // TASKS
  getTasks: (tenantId: string, customerId?: string): Task[] => {
    const tasks = getLocal(STORAGE_KEYS.TASKS, INITIAL_TASKS);
    const visits = getLocal(STORAGE_KEYS.VISITS, INITIAL_VISITS);

    // Map visits to tasks automatically
    const visitTasks: Task[] = visits.map((v: any) => ({
      id: `VS-TSK-${v.id}`, // Unique prefix to avoid collision if they ever had same ID
      tenantId: v.tenantId,
      title: v.title,
      taskType: 'Visit',
      description: v.purpose || 'Visit scheduled',
      customerId: v.customerId,
      customerName: v.customerName,
      customerCode: v.customerCode,
      picId: v.picId,
      picName: v.picName,
      picAvatar: v.picAvatar,
      priority: 'HIGH', // Default priority for visits
      status: v.status === 'COMPLETED' ? 'COMPLETED' : v.status === 'CANCELLED' ? 'CANCELLED' : 'TODO',
      dueDate: v.visitDate,
      createdAt: v.createdAt || new Date().toISOString(),
      relatedVisitId: v.id,
    }));

    const combinedTasks = [...visitTasks, ...tasks];

    // Deduplicate by ID so if a Visit Task was edited and saved as a real Task, it won't duplicate
    const uniqueTasksMap = new Map<string, Task>();
    combinedTasks.forEach(t => uniqueTasksMap.set(t.id, t));
    const uniqueCombinedTasks = Array.from(uniqueTasksMap.values());

    let filtered = tenantId === 'SYSTEM' || tenantId === 'ALL' ? uniqueCombinedTasks : uniqueCombinedTasks.filter((t) => t.tenantId === tenantId);
    if (customerId) {
      filtered = filtered.filter((t) => t.customerId === customerId);
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  saveTask: (task: Task): Task => {
    const previousTasks = getLocal(STORAGE_KEYS.TASKS, INITIAL_TASKS);
    const tasks = [...previousTasks];
    const idx = tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) {
      tasks[idx] = task;
    } else {
      tasks.unshift(task);
    }
    setLocal(STORAGE_KEYS.TASKS, tasks);
    
    // DB Schema payload mapping
    const dbPayload: any = {
      id: task.id,
      tenantId: task.tenantId,
      customerId: task.customerId,
      title: task.title,
      description: task.description,
      priorityId: task.priority,
      statusId: task.status,
      dueDate: task.dueDate,
      assigneeId: task.picId || 'USR-005',
      createdAt: task.createdAt
    };

    syncPush(
      idx >= 0 ? 'PUT' : 'POST',
      idx >= 0 ? `tasks/${task.id}` : 'tasks',
      dbPayload,
      () => {
        setLocal(STORAGE_KEYS.TASKS, previousTasks);
      }
    );
    return task;
  },

  // FOLLOW-UPS
  getFollowUps: (tenantId: string, customerId?: string): FollowUp[] => {
    const followups = getLocal(STORAGE_KEYS.FOLLOWUPS, INITIAL_FOLLOWUPS);
    let filtered = tenantId === 'SYSTEM' || tenantId === 'ALL' ? followups : followups.filter((f) => f.tenantId === tenantId);
    if (customerId) {
      filtered = filtered.filter((f) => f.customerId === customerId);
    }
    return filtered;
  },
  saveFollowUp: (followUp: FollowUp): FollowUp => {
    const previousFollowups = getLocal(STORAGE_KEYS.FOLLOWUPS, INITIAL_FOLLOWUPS);
    const followups = [...previousFollowups];
    const idx = followups.findIndex((f) => f.id === followUp.id);
    if (idx >= 0) {
      followups[idx] = followUp;
    } else {
      followups.unshift(followUp);
    }
    setLocal(STORAGE_KEYS.FOLLOWUPS, followups);
    syncPush(
      idx >= 0 ? 'PUT' : 'POST',
      idx >= 0 ? `follow_ups/${followUp.id}` : 'follow_ups',
      followUp,
      () => {
        setLocal(STORAGE_KEYS.FOLLOWUPS, previousFollowups);
      }
    );
    return followUp;
  },
  deleteFollowUpsByProjectId: (projectId: string): void => {
    const followups = getLocal(STORAGE_KEYS.FOLLOWUPS, INITIAL_FOLLOWUPS);
    const filtered = followups.filter(f => f.relatedProjectId !== projectId);
    setLocal(STORAGE_KEYS.FOLLOWUPS, filtered);
  },

  // PROJECTS
  getProjects: (tenantId: string, customerId?: string): Project[] => {
    const opps = getLocal(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS);
    let filtered = tenantId === 'SYSTEM' || tenantId === 'ALL' ? opps : opps.filter((o) => o.tenantId === tenantId);
    if (customerId) {
      filtered = filtered.filter((o) => o.customerId === customerId);
    }
    return filtered;
  },
  saveProject: (project: Project): Project => {
    const previousProjects = getLocal(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS);
    const opps = [...previousProjects];
    const idx = opps.findIndex((o) => o.id === project.id);
    if (idx >= 0) {
      opps[idx] = project;
    } else {
      opps.unshift(project);
    }
    setLocal(STORAGE_KEYS.PROJECTS, opps);

    // Map to DB Schema: title, value, probability, stageId, picId, etc.
    const dbPayload: any = {
      id: project.id,
      tenantId: project.tenantId,
      customerId: project.customerId,
      title: project.name,
      value: project.estimatedValue,
      probability: project.probability,
      expectedCloseDate: project.expectedCloseDate,
      stageId: project.stage,
      source: project.source,
      description: project.description,
      picId: project.picId || 'USR-005'
    };

    syncPush(
      idx >= 0 ? 'PUT' : 'POST',
      idx >= 0 ? `projects/${project.id}` : 'projects',
      dbPayload,
      () => {
        setLocal(STORAGE_KEYS.PROJECTS, previousProjects);
      }
    );

    DataService.addActivity({
      tenantId: project.tenantId,
      customerId: project.customerId,
      customerName: project.customerName,
      userId: project.picId,
      userName: project.picName,
      type: 'PROJECT',
      subject: `Project: ${project.name}`,
      description: `Stage: ${project.stage} | Estimated Value: Rp ${project.estimatedValue.toLocaleString('id-ID')}`,
      occurredAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    });
    return project;
  },

  // ACTIVITIES
  getActivities: (tenantId: string, customerId?: string): Activity[] => {
    const activities = getLocal(STORAGE_KEYS.ACTIVITIES, INITIAL_ACTIVITIES);
    let filtered = tenantId === 'SYSTEM' || tenantId === 'ALL' ? activities : activities.filter((a) => a.tenantId === tenantId);
    if (customerId) {
      filtered = filtered.filter((a) => a.customerId === customerId);
    }
    return filtered.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  },
  addActivity: (activityData: Omit<Activity, 'id'>): Activity => {
    const previousActivities = getLocal(STORAGE_KEYS.ACTIVITIES, INITIAL_ACTIVITIES);
    const activities = [...previousActivities];
    const newAct: Activity = {
      ...activityData,
      id: `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    };
    activities.unshift(newAct);
    setLocal(STORAGE_KEYS.ACTIVITIES, activities);
    syncPush('POST', 'activities', newAct, () => {
      setLocal(STORAGE_KEYS.ACTIVITIES, previousActivities);
    });
    return newAct;
  },

  // TARGETS
  getTargets: (tenantId: string): SalesTarget[] => {
    const targets = getLocal(STORAGE_KEYS.TARGETS, INITIAL_TARGETS);
    if (tenantId === 'SYSTEM' || tenantId === 'ALL') return targets;
    return targets.filter((t) => t.tenantId === tenantId);
  },
  saveTarget: (target: SalesTarget): SalesTarget => {
    const previousTargets = getLocal(STORAGE_KEYS.TARGETS, INITIAL_TARGETS);
    const targets = [...previousTargets];
    const idx = targets.findIndex((t) => t.id === target.id);
    if (idx >= 0) {
      targets[idx] = target;
    } else {
      targets.unshift(target);
    }
    setLocal(STORAGE_KEYS.TARGETS, targets);
    syncPush(
      idx >= 0 ? 'PUT' : 'POST',
      idx >= 0 ? `sales_targets/${target.id}` : 'sales_targets',
      target,
      () => {
        setLocal(STORAGE_KEYS.TARGETS, previousTargets);
      }
    );
    return target;
  },

  // MASTER DATA REMOVED - using masterDataApi.ts instead
  // NOTIFICATIONS
  getNotifications: (userId?: string): NotificationItem[] => {
    const notifs = getLocal(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    if (userId) {
      return notifs.filter((n) => n.userId === userId || n.userId === 'ALL');
    }
    return notifs;
  },
  markNotificationAsRead: (id: string): void => {
    const notifs = getLocal(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    const item = notifs.find((n) => n.id === id);
    if (item) {
      item.isRead = true;
      setLocal(STORAGE_KEYS.NOTIFICATIONS, notifs);
    }
  },
  markAllNotificationsAsRead: (userId: string): void => {
    const notifs = getLocal(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    notifs.forEach((n) => {
      if (n.userId === userId || n.userId === 'ALL') {
        n.isRead = true;
      }
    });
    setLocal(STORAGE_KEYS.NOTIFICATIONS, notifs);
  },

  // AUDIT LOGS
  getAuditLogs: (tenantId?: string): AuditLog[] => {
    const logs = getLocal(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    if (!tenantId || tenantId === 'SYSTEM' || tenantId === 'ALL') {
      return logs;
    }
    return logs.filter((l) => l.tenantId === tenantId);
  },
  addAuditLog: (logData: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog => {
    const logs = getLocal(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    const newLog: AuditLog = {
      ...logData,
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };
    logs.unshift(newLog);
    setLocal(STORAGE_KEYS.AUDIT_LOGS, logs);
    return newLog;
  },

  // ROLE PERMISSIONS REMOVED - using rolesApi.ts instead
};

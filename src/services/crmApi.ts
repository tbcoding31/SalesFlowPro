import { PaginatedResponse, Customer, Task, Activity, Project, Visit, FollowUp } from '../types';

const API_BASE = '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('sfp_auth_token') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

export interface QueryPaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC';
  status?: string;
  priority?: string;
  picId?: string;
  customerId?: string;
  userId?: string;
  typeId?: string;
  tenantId?: string;
}

export const crmApi = {
  // Generic collection fetcher (bounded / full)
  fetchCollection: async <T>(table: string, tenantId?: string): Promise<T[]> => {
    try {
      const params = new URLSearchParams();
      if (tenantId && tenantId !== 'ALL') params.set('tenantId', tenantId);

      const url = `${API_BASE}/${table}${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch ${table}`);
      const data = await res.json();
      return Array.isArray(data) ? data : (data.data && Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(`[crmApi.fetchCollection ${table} error]`, err);
      return [];
    }
  },

  // Resource-specific Server-Side Paginated Fetchers
  
  fetchProjects: async (params?: QueryPaginationParams): Promise<PaginatedResponse<Project>> => {
    const q = new URLSearchParams();
    if (params) {
      if (params.page) q.set('page', String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      if (params.search) q.set('search', params.search.trim());
      if (params.sortBy) q.set('sortBy', params.sortBy);
      if (params.sortOrder) q.set('sortOrder', params.sortOrder);
      if (params.status && params.status !== 'ALL') q.set('status', params.status);
      if (params.picId && params.picId !== 'ALL') q.set('picId', params.picId);
      if (params.tenantId && params.tenantId !== 'ALL') q.set('tenantId', params.tenantId);
    }
    const url = `${API_BASE}/projects${q.toString() ? '?' + q.toString() : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch projects`);
    return await res.json();
  },

  fetchProjectPipeline: async (tenantId?: string): Promise<{ data: Project[], aggregates: Record<string, { count: number, value: number }> }> => {
    try {
      const params = new URLSearchParams();
      if (tenantId && tenantId !== 'ALL') params.set('tenantId', tenantId);

      const url = `${API_BASE}/projects/pipeline${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch project pipeline`);
      const data = await res.json();
      return { data: data.data || [], aggregates: data.aggregates || {} };
    } catch (err) {
      console.error('[crmApi.fetchProjectPipeline error]', err);
      return { data: [], aggregates: {} };
    }
  },

  fetchVisits: async (params?: QueryPaginationParams): Promise<PaginatedResponse<Visit>> => {
    const q = new URLSearchParams();
    if (params) {
      if (params.page) q.set('page', String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      if (params.search) q.set('search', params.search.trim());
      if (params.sortBy) q.set('sortBy', params.sortBy);
      if (params.sortOrder) q.set('sortOrder', params.sortOrder);
      if (params.status && params.status !== 'ALL') q.set('status', params.status);
      if (params.picId && params.picId !== 'ALL') q.set('picId', params.picId);
      if (params.tenantId && params.tenantId !== 'ALL') q.set('tenantId', params.tenantId);
    }
    const url = `${API_BASE}/visits${q.toString() ? '?' + q.toString() : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch visits`);
    return await res.json();
  },

  fetchFollowUps: async (params?: QueryPaginationParams): Promise<PaginatedResponse<FollowUp>> => {
    const q = new URLSearchParams();
    if (params) {
      if (params.page) q.set('page', String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      if (params.search) q.set('search', params.search.trim());
      if (params.sortBy) q.set('sortBy', params.sortBy);
      if (params.sortOrder) q.set('sortOrder', params.sortOrder);
      if (params.status && params.status !== 'ALL') q.set('status', params.status);
      if (params.picId && params.picId !== 'ALL') q.set('picId', params.picId);
      if (params.tenantId && params.tenantId !== 'ALL') q.set('tenantId', params.tenantId);
    }
    const url = `${API_BASE}/follow_ups${q.toString() ? '?' + q.toString() : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch follow_ups`);
    return await res.json();
  },

  fetchCustomerTimeline: async (customerId: string, page: number = 1, pageSize: number = 25): Promise<PaginatedResponse<CustomerTimelineEvent>> => {
    const url = `${API_BASE}/customers/${customerId}/timeline?page=${page}&pageSize=${pageSize}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch customer timeline`);
    return await res.json();
  },

  fetchProjectTimeline: async (projectId: string, page: number = 1, pageSize: number = 25): Promise<PaginatedResponse<CustomerTimelineEvent>> => {
    const url = `${API_BASE}/projects/${projectId}/timeline?page=${page}&pageSize=${pageSize}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch project timeline`);
    return await res.json();
  },

fetchCustomers: async (params?: QueryPaginationParams): Promise<PaginatedResponse<Customer>> => {
    const q = new URLSearchParams();
    if (params) {
      if (params.page) q.set('page', String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      if (params.search) q.set('search', params.search.trim());
      if (params.sortBy) q.set('sortBy', params.sortBy);
      if (params.sortOrder) q.set('sortOrder', params.sortOrder);
      if (params.status && params.status !== 'ALL') q.set('status', params.status);
      if (params.picId && params.picId !== 'ALL') q.set('picId', params.picId);
      if (params.tenantId && params.tenantId !== 'ALL') q.set('tenantId', params.tenantId);
    }
    const url = `${API_BASE}/customers${q.toString() ? '?' + q.toString() : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch customers`);
    return await res.json();
  },

  fetchTasks: async (params?: QueryPaginationParams): Promise<PaginatedResponse<Task>> => {
    const q = new URLSearchParams();
    if (params) {
      if (params.page) q.set('page', String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      if (params.search) q.set('search', params.search.trim());
      if (params.sortBy) q.set('sortBy', params.sortBy);
      if (params.sortOrder) q.set('sortOrder', params.sortOrder);
      if (params.status && params.status !== 'ALL') q.set('status', params.status);
      if (params.priority && params.priority !== 'ALL') q.set('priority', params.priority);
      if (params.customerId && params.customerId !== 'ALL') q.set('customerId', params.customerId);
      if (params.picId && params.picId !== 'ALL') q.set('picId', params.picId);
      if (params.tenantId && params.tenantId !== 'ALL') q.set('tenantId', params.tenantId);
    }
    const url = `${API_BASE}/tasks${q.toString() ? '?' + q.toString() : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch tasks`);
    return await res.json();
  },

  fetchActivities: async (params?: QueryPaginationParams): Promise<PaginatedResponse<CustomerTimelineEvent>> => {
    const q = new URLSearchParams();
    if (params) {
      if (params.page) q.set('page', String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      if (params.search) q.set('search', params.search.trim());
      if (params.sortBy) q.set('sortBy', params.sortBy);
      if (params.sortOrder) q.set('sortOrder', params.sortOrder);
      if (params.customerId && params.customerId !== 'ALL') q.set('customerId', params.customerId);
      if (params.userId && params.userId !== 'ALL') q.set('userId', params.userId);
      if (params.typeId && params.typeId !== 'ALL') q.set('typeId', params.typeId);
      if (params.tenantId && params.tenantId !== 'ALL') q.set('tenantId', params.tenantId);
    }
    const url = `${API_BASE}/activities${q.toString() ? '?' + q.toString() : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch activities`);
    return await res.json();
  },

  fetchAuditLogs: async (params?: QueryPaginationParams): Promise<PaginatedResponse<CustomerTimelineEvent>> => {
    const q = new URLSearchParams();
    if (params) {
      if (params.page) q.set('page', String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      if (params.search) q.set('search', params.search.trim());
      if (params.sortBy) q.set('sortBy', params.sortBy);
      if (params.sortOrder) q.set('sortOrder', params.sortOrder);
      if (params.tenantId && params.tenantId !== 'ALL') q.set('tenantId', params.tenantId);
    }
    const url = `${API_BASE}/audit_logs${q.toString() ? '?' + q.toString() : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch audit logs`);
    return await res.json();
  },

  // Generic single record fetcher
  fetchRecordById: async <T>(table: string, id: string): Promise<T | null> => {
    try {
      const res = await fetch(`${API_BASE}/${table}/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch ${table}/${id}`);
      return await res.json();
    } catch (err) {
      console.error(`[crmApi.fetchRecordById ${table}/${id} error]`, err);
      return null;
    }
  },

  // Generic record creator
  createRecord: async <T>(table: string, payload: any): Promise<{ success: boolean; data?: T; error?: string; code?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/${table}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || `Failed to create ${table}`, code: data.code };
      }
      return { success: true, data };
    } catch (err: any) {
      console.error(`[crmApi.createRecord ${table} error]`, err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  // Generic record updater
  updateRecord: async <T>(table: string, id: string, payload: any): Promise<{ success: boolean; data?: T; error?: string; code?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/${table}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || `Failed to update ${table}`, code: data.code };
      }
      return { success: true, data };
    } catch (err: any) {
      console.error(`[crmApi.updateRecord ${table} error]`, err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  // Generic record deleter
  deleteRecord: async (table: string, id: string): Promise<{ success: boolean; error?: string; code?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/${table}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || `Failed to delete ${table}`, code: data.code };
      }
      return { success: true };
    } catch (err: any) {
      console.error(`[crmApi.deleteRecord ${table} error]`, err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  // Sales Agenda & Next Action Fetchers
  fetchSalesAgenda: async (date?: string, upcomingDays: number = 7): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      if (upcomingDays) params.set('upcomingDays', String(upcomingDays));

      const url = `${API_BASE}/sales/agenda${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch sales agenda`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchSalesAgenda error]', err);
      return null;
    }
  },

  fetchCustomerNextAction: async (customerId: string): Promise<any> => {
    try {
      const res = await fetch(`${API_BASE}/customers/${customerId}/next-action`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch next action`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchCustomerNextAction error]', err);
      return null;
    }
  },

  fetchProjectNextAction: async (projectId: string): Promise<any> => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/next-action`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch next action`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchProjectNextAction error]', err);
      return null;
    }
  },

  // Project Commercial Stage Transition
  transitionProjectStage: async (
    projectId: string, 
    stageId: string, 
    options?: { notes?: string; lossReason?: string; reopenReason?: string; isReopen?: boolean; expectedFromStage?: string } | string
  ): Promise<{ success: boolean; error?: string; code?: string; missingFields?: string[]; data?: any }> => {
    try {
      const payload: any = { stageId };
      if (typeof options === 'string') {
        payload.notes = options;
      } else if (options) {
        if (options.notes) payload.notes = options.notes;
        if (options.lossReason) payload.lossReason = options.lossReason;
        if (options.reopenReason) payload.reopenReason = options.reopenReason;
        if (options.isReopen !== undefined) payload.isReopen = options.isReopen;
        if (options.expectedFromStage) payload.expectedFromStage = options.expectedFromStage;
      }

      const res = await fetch(`${API_BASE}/projects/${projectId}/stage`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { 
          success: false, 
          error: data.error || 'Failed to update stage', 
          code: data.code,
          missingFields: data.missingFields
        };
      }
      return { success: true, data };
    } catch (err: any) {
      console.error('[crmApi.transitionProjectStage error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  // Specialized Reports Fetchers
  fetchSalesReport: async (tenantId?: string): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (tenantId && tenantId !== 'ALL') params.set('tenantId', tenantId);

      const url = `${API_BASE}/reports/sales${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch sales report`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchSalesReport error]', err);
      return null;
    }
  },

  fetchCustomerReport: async (tenantId?: string): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (tenantId && tenantId !== 'ALL') params.set('tenantId', tenantId);

      const url = `${API_BASE}/reports/customers${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch customer report`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchCustomerReport error]', err);
      return null;
    }
  },

  // 360 Workspace Summary Fetchers
  fetchCustomerSummary: async (customerId: string, tenantId?: string): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (tenantId && tenantId !== 'ALL') params.set('tenantId', tenantId);

      const url = `${API_BASE}/customers/${customerId}/summary${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch customer summary`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchCustomerSummary error]', err);
      return null;
    }
  },

  fetchProjectSummary: async (projectId: string, tenantId?: string): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (tenantId && tenantId !== 'ALL') params.set('tenantId', tenantId);

      const url = `${API_BASE}/projects/${projectId}/summary${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch project summary`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchProjectSummary error]', err);
      return null;
    }
  },

  // Maintenance Cadence APIs
  fetchCadences: async (filters: { customerId?: string; projectId?: string; tenantId?: string }): Promise<any[]> => {
    try {
      const params = new URLSearchParams();
      if (filters.tenantId && filters.tenantId !== 'ALL') params.set('tenantId', filters.tenantId);
      if (filters.customerId) params.set('customerId', filters.customerId);
      if (filters.projectId) params.set('projectId', filters.projectId);

      const url = `${API_BASE}/maintenance_cadences${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch cadences`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchCadences error]', err);
      return [];
    }
  },

  createCadence: async (cadenceData: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/maintenance_cadences`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(cadenceData)
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}: Failed to create cadence`);
    }
    return await res.json();
  },

  updateCadence: async (id: string, cadenceData: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/maintenance_cadences/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(cadenceData)
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}: Failed to update cadence`);
    }
    return await res.json();
  },

  toggleCadenceStatus: async (id: string, status: 'ACTIVE' | 'PAUSED'): Promise<any> => {
    const res = await fetch(`${API_BASE}/maintenance_cadences/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}: Failed to toggle cadence status`);
    }
    return await res.json();
  },

  fetchSalesAttention: async (date?: string): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      const url = `${API_BASE}/sales/attention${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch sales attention`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchSalesAttention error]', err);
      return null;
    }
  },

  fetchControlTower: async (date?: string, teamId?: string, repId?: string): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      if (teamId) params.set('teamId', teamId);
      if (repId) params.set('repId', repId);
      const url = `${API_BASE}/management/control-tower${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch control tower`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchControlTower error]', err);
      return null;
    }
  },

  // R48 Sales Targets and Attainment APIs
  fetchSalesTargets: async (filters?: { status?: string; periodStart?: string; periodEnd?: string }): Promise<any[]> => {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.periodStart) params.set('periodStart', filters.periodStart);
      if (filters?.periodEnd) params.set('periodEnd', filters.periodEnd);

      const url = `${API_BASE}/sales-targets${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch sales targets`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchSalesTargets error]', err);
      return [];
    }
  },

  createSalesTarget: async (targetData: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/sales-targets`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(targetData)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || `HTTP ${res.status}: Failed to create sales target`);
    }
    return json;
  },

  updateSalesTarget: async (id: string, targetData: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/sales-targets/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(targetData)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || `HTTP ${res.status}: Failed to update sales target`);
    }
    return json;
  },

  fetchSalesTargetAttainment: async (filters?: { periodStart?: string; periodEnd?: string; targetType?: string }): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (filters?.periodStart) params.set('periodStart', filters.periodStart);
      if (filters?.periodEnd) params.set('periodEnd', filters.periodEnd);
      if (filters?.targetType) params.set('targetType', filters.targetType);

      const url = `${API_BASE}/sales-targets/attainment${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch target attainment`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchSalesTargetAttainment error]', err);
      return null;
    }
  },

  fetchSalesTargetActivityCoverage: async (filters?: { periodStart?: string; periodEnd?: string; tenantId?: string }): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (filters?.periodStart) params.set('periodStart', filters.periodStart);
      if (filters?.periodEnd) params.set('periodEnd', filters.periodEnd);
      if (filters?.tenantId && filters.tenantId !== 'ALL') params.set('tenantId', filters.tenantId);

      const url = `${API_BASE}/sales-targets/coverage${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch target activity coverage`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchSalesTargetActivityCoverage error]', err);
      return null;
    }
  },

  fetchPipelineAnalytics: async (filters?: { fromDate?: string; toDate?: string; teamId?: string; repId?: string }): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (filters?.fromDate) params.set('fromDate', filters.fromDate);
      if (filters?.toDate) params.set('toDate', filters.toDate);
      if (filters?.teamId) params.set('teamId', filters.teamId);
      if (filters?.repId) params.set('repId', filters.repId);
      const url = `${API_BASE}/reports/pipeline${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch pipeline analytics`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchPipelineAnalytics error]', err);
      return null;
    }
  },

  fetchPipelineVelocity: async (filters?: { teamId?: string; repId?: string }): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (filters?.teamId) params.set('teamId', filters.teamId);
      if (filters?.repId) params.set('repId', filters.repId);

      const url = `${API_BASE}/reports/pipeline-velocity${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch pipeline velocity`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchPipelineVelocity error]', err);
      return null;
    }
  },

  fetchTenantAnalyticsSettings: async (): Promise<any> => {
    try {
      const res = await fetch(`${API_BASE}/tenant/analytics-settings`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch tenant analytics settings`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchTenantAnalyticsSettings error]', err);
      return null;
    }
  },

  updateTenantAnalyticsSettings: async (settings: { velocityMinComparisonSampleSize: number }): Promise<any> => {
    try {
      const res = await fetch(`${API_BASE}/tenant/analytics-settings`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to update tenant analytics settings`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.updateTenantAnalyticsSettings error]', err);
      return null;
    }
  },

  fetchProjectInterventions: async (filters?: { teamId?: string; repId?: string }): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (filters?.teamId) params.set('teamId', filters.teamId);
      if (filters?.repId) params.set('repId', filters.repId);

      const url = `${API_BASE}/management/project-interventions${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch project interventions`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchProjectInterventions error]', err);
      return null;
    }
  },

  fetchProjectInterventionPolicies: async (): Promise<any> => {
    try {
      const res = await fetch(`${API_BASE}/tenant/project-intervention-policies`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch intervention policies`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchProjectInterventionPolicies error]', err);
      return null;
    }
  },

  createProjectInterventionPolicy: async (policy: {
    code: string;
    name: string;
    description?: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    matchMode: 'ALL';
    status?: 'ACTIVE' | 'INACTIVE';
    conditions: string[];
  }): Promise<any> => {
    try {
      const res = await fetch(`${API_BASE}/tenant/project-intervention-policies`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(policy)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to create intervention policy`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.createProjectInterventionPolicy error]', err);
      return null;
    }
  },

  updateProjectInterventionPolicy: async (id: string, updates: {
    name?: string;
    description?: string;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
    status?: 'ACTIVE' | 'INACTIVE';
    conditions?: string[];
  }): Promise<any> => {
    try {
      const res = await fetch(`${API_BASE}/tenant/project-intervention-policies/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to update intervention policy`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.updateProjectInterventionPolicy error]', err);
      return null;
    }
  },

  fetchProjectInterventionHistory: async (filters?: {
    projectId?: string;
    policyId?: string;
    repId?: string;
    teamId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (filters?.projectId) params.set('projectId', filters.projectId);
      if (filters?.policyId) params.set('policyId', filters.policyId);
      if (filters?.repId) params.set('repId', filters.repId);
      if (filters?.teamId) params.set('teamId', filters.teamId);
      if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.set('dateTo', filters.dateTo);

      const url = `${API_BASE}/management/project-intervention-history${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch project intervention history`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchProjectInterventionHistory error]', err);
      return null;
    }
  },

  fetchInterventionAnalytics: async (filters?: {
    projectId?: string;
    policyId?: string;
    repId?: string;
    teamId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: 'ACTIVE' | 'RESOLVED' | 'ALL';
  }): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (filters?.projectId) params.set('projectId', filters.projectId);
      if (filters?.policyId) params.set('policyId', filters.policyId);
      if (filters?.repId) params.set('repId', filters.repId);
      if (filters?.teamId) params.set('teamId', filters.teamId);
      if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.set('dateTo', filters.dateTo);
      if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);

      const url = `${API_BASE}/reports/intervention-analytics${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch intervention analytics`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchInterventionAnalytics error]', err);
      return null;
    }
  },

  fetchPolicyRevisions: async (policyId: string, tenantId?: string): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (tenantId && tenantId !== 'ALL') params.set('tenantId', tenantId);

      const url = `${API_BASE}/tenant/project-intervention-policies/${policyId}/revisions${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch policy revisions`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchPolicyRevisions error]', err);
      return null;
    }
  }
};



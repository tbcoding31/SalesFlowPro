import { PaginatedResponse, Customer, Task, Activity, Project, Visit, FollowUp, CustomerTimelineEvent } from '../types';

export const API_BASE = '/api';

export const getAuthHeaders = () => {
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
  upcoming?: string;
  stageId?: string;
  priority?: string;
  picId?: string;
  customerId?: string;
  userId?: string;
  typeId?: string;
  tenantId?: string;
  dueDate?: string;
  projectId?: string;
  sourceType?: string;
  relatedProjectId?: string;
  relatedVisitId?: string;
  scope?: string;
  statusScope?: string;
}

export const crmApi = {
  // Generic collection fetcher (bounded / full)
  
  fetchCustomerContacts: async (customerId: string) => {
    try {
      const url = `${API_BASE}/customers/${customerId}/contacts`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) {
        const fallbackRes = await fetch(`${API_BASE}/customer_contacts?customerId=${customerId}`, { headers: getAuthHeaders() });
        if (!fallbackRes.ok) return [];
        const fallbackData = await fallbackRes.json();
        return Array.isArray(fallbackData) ? fallbackData : (fallbackData.data || []);
      }
      const data = await res.json();
      return Array.isArray(data) ? data : (data.data || []);
    } catch(err) {
      console.error('[crmApi.fetchCustomerContacts error]', err);
      return [];
    }
  },
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
        if (params.stageId) q.set('stageId', params.stageId);
      if (params.sortBy) q.set('sortBy', params.sortBy);
      if (params.sortOrder) q.set('sortOrder', params.sortOrder);
      if (params.status && params.status !== 'ALL') q.set('status', params.status);
      if (params.statusScope) q.set('statusScope', params.statusScope);
      if (params.upcoming) q.set('upcoming', params.upcoming);
      if (params.picId && params.picId !== 'ALL') q.set('picId', params.picId);
      if (params.tenantId && params.tenantId !== 'ALL') q.set('tenantId', params.tenantId);
      if (params.customerId && params.customerId !== 'ALL') q.set('customerId', params.customerId);
    }
    const url = `${API_BASE}/projects${q.toString() ? '?' + q.toString() : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch projects`);
    const json = await res.json();
    if (json && Array.isArray(json.data)) {
      const page = json.pagination?.page || 1;
      const totalPages = json.pagination?.totalPages || 1;
      return {
        data: json.data,
        pagination: {
          page,
          pageSize: json.pagination?.pageSize || 20,
          totalItems: json.pagination?.totalItems || json.data.length,
          totalPages,
          hasNextPage: json.pagination?.hasNextPage ?? (page < totalPages),
          hasPreviousPage: json.pagination?.hasPreviousPage ?? (page > 1)
        }
      };
    }
    if (Array.isArray(json)) {
      return {
        data: json,
        pagination: {
          page: 1,
          pageSize: json.length,
          totalItems: json.length,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false
        }
      };
    }
    return {
      data: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
      }
    };
  },

  fetchProjectPipeline: async (tenantId?: string): Promise<{ stages?: any[], data: Project[], aggregates: Record<string, { count: number, value: number }>, summary?: any }> => {
    try {
      const params = new URLSearchParams();
      if (tenantId && tenantId !== 'ALL') params.set('tenantId', tenantId);

      const url = `${API_BASE}/projects/pipeline${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch project pipeline`);
      const data = await res.json();
      return { stages: data.stages || [], data: data.data || [], aggregates: data.aggregates || {}, summary: data.summary || {} };
    } catch (err) {
      console.error('[crmApi.fetchProjectPipeline error]', err);
      return { stages: [], data: [], aggregates: {}, summary: {} };
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
      if (params.customerId && params.customerId !== 'ALL') q.set('customerId', params.customerId);
      if (params.scope) q.set('scope', params.scope);
    }
    const url = `${API_BASE}/visits${q.toString() ? '?' + q.toString() : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch visits`);
    return await res.json();
  },

  createVisit: async (payload: any): Promise<{ success: boolean; data?: Visit; id?: string; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/visits`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to schedule visit' };
      }
      return { success: true, data: data.data, id: data.id };
    } catch (err: any) {
      console.error('[crmApi.createVisit error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  fetchCustomerTimeline: async (customerId: string, page: number = 1, pageSize: number = 25): Promise<PaginatedResponse<CustomerTimelineEvent>> => {
    const url = `${API_BASE}/customers/${customerId}/timeline?page=${page}&pageSize=${pageSize}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch customer timeline`);
    return await res.json();
  },

  fetchProjectTimeline: async (projectId: string, page: number = 1, pageSize: number = 25): Promise<PaginatedResponse<Activity>> => {
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
      if (params.customerId && params.customerId !== 'ALL') q.set('customerId', params.customerId);
    }
    const url = `${API_BASE}/customers${q.toString() ? '?' + q.toString() : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch customers`);
    const data = await res.json();
    if (Array.isArray(data)) {
      return { data, pagination: { totalItems: data.length, totalPages: 1, page: 1, pageSize: data.length, hasNextPage: false, hasPreviousPage: false } };
    }
    return data;
  },

  fetchCustomerById: async (id: string): Promise<Customer | null> => {
    try {
      const res = await fetch(`${API_BASE}/customers/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch customer`);
      return await res.json();
    } catch (err) {
      console.error(`[crmApi.fetchCustomerById error]`, err);
      return null;
    }
  },

  createCustomer: async (customerData: Partial<Customer>): Promise<{ success: boolean; data?: Customer; error?: string; code?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/customers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(customerData)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to create customer', code: data.code };
      }
      return { success: true, data: data.data || data };
    } catch (err: any) {
      console.error('[crmApi.createCustomer error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  updateCustomer: async (id: string, customerData: Partial<Customer>): Promise<{ success: boolean; data?: any; error?: string; code?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/customers/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(customerData)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update customer', code: data.code };
      }
      return { success: true, data };
    } catch (err: any) {
      console.error('[crmApi.updateCustomer error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  deleteCustomer: async (id: string): Promise<{ success: boolean; error?: string; code?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/customers/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to delete customer', code: data.code };
      }
      return { success: true };
    } catch (err: any) {
      console.error('[crmApi.deleteCustomer error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

      fetchCustomerProjects: async (customerId: string): Promise<any[]> => {
    try {
      let allProjects: any[] = [];
      let page = 1;
      const pageSize = 50;
      let hasMore = true;
      
      while (hasMore) {
        const res = await fetch(`${API_BASE}/projects?customerId=${customerId}&page=${page}&pageSize=${pageSize}`, { headers: getAuthHeaders() });
        if (!res.ok) break;
        const data = await res.json();
        
        if (Array.isArray(data)) {
           allProjects = [...allProjects, ...data];
           hasMore = false; // No pagination metadata
        } else {
           const items = data.data || [];
           allProjects = [...allProjects, ...items];
           if (data.pagination && data.pagination.totalPages) {
             hasMore = page < data.pagination.totalPages;
           } else {
             hasMore = false;
           }
        }
        page++;
      }
      return allProjects;
    } catch (err) {
      console.error('[fetchCustomerProjects error]', err);
      return [];
    }
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
      if (params.dueDate) q.set('dueDate', params.dueDate);
      if (params.projectId && params.projectId !== 'ALL') q.set('relatedProjectId', params.projectId);
      if (params.relatedProjectId && params.relatedProjectId !== 'ALL') q.set('relatedProjectId', params.relatedProjectId);
      if (params.relatedVisitId && params.relatedVisitId !== 'ALL') q.set('relatedVisitId', params.relatedVisitId);
      if (params.sourceType && params.sourceType !== 'ALL') q.set('sourceType', params.sourceType);
      if (params.scope) q.set('scope', params.scope);
    }
    const url = `${API_BASE}/tasks${q.toString() ? '?' + q.toString() : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch tasks`);
    return await res.json();
  },

  fetchActivities: async (params?: QueryPaginationParams): Promise<PaginatedResponse<Activity>> => {
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
      if (params.customerId && params.customerId !== 'ALL') q.set('customerId', params.customerId);
      if (params.scope) q.set('scope', params.scope);
    }
    const url = `${API_BASE}/activities${q.toString() ? '?' + q.toString() : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch activities`);
    return await res.json();
  },

  fetchAuditLogs: async (params?: QueryPaginationParams): Promise<PaginatedResponse<Activity>> => {
    const q = new URLSearchParams();
    if (params) {
      if (params.page) q.set('page', String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      if (params.search) q.set('search', params.search.trim());
      if (params.tenantId && params.tenantId !== 'ALL' && params.tenantId !== 'null') q.set('tenantId', params.tenantId);
    }
    const token = localStorage.getItem('sfp_auth_token');
    
    // Always use the platform endpoint for Audit Logs page
    const url = `${API_BASE}/system/audit-logs${q.toString() ? '?' + q.toString() : ''}`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch audit logs`);
    
    const data = await res.json();
    if (data.items) {
      return {
        data: data.items,
        pagination: { totalItems: data.totalCount || data.total, totalPages: data.totalPages }
      } as any;
    }
    return data;
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

  // Visit Lifecycle Endpoints
  cancelVisit: async (id: string, reason?: string): Promise<{ success: boolean; error?: string; code?: string; data?: any }> => {
    try {
      const res = await fetch(`${API_BASE}/visits/${id}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to cancel visit', code: data.code };
      }
      return { success: true, data };
    } catch (err: any) {
      console.error('[crmApi.cancelVisit error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  rescheduleVisit: async (
    id: string,
    payload: { visitDate: string; startTime?: string; endTime?: string; reason?: string }
  ): Promise<{ success: boolean; error?: string; code?: string; data?: any }> => {
    try {
      const res = await fetch(`${API_BASE}/visits/${id}/reschedule`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to reschedule visit', code: data.code };
      }
      return { success: true, data };
    } catch (err: any) {
      console.error('[crmApi.rescheduleVisit error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  fetchUpcomingVisitReminders: async (scope?: string): Promise<any[]> => {
    try {
      const url = `${API_BASE}/visits/reminders${scope ? `?scope=${scope}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch visit reminders`);
      const json = await res.json();
      return json.data || (Array.isArray(json) ? json : []);
    } catch (err) {
      console.error('[crmApi.fetchUpcomingVisitReminders error]', err);
      return [];
    }
  },

  fetchTenantVisitReminders: async (tenantId: string): Promise<any> => {
    try {
      const res = await fetch(`${API_BASE}/tenants/${tenantId}/visit-reminders`, { headers: getAuthHeaders() });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to fetch tenant visit reminders');
      }
      const json = await res.json();
      return json.data || json;
    } catch (err) {
      console.error('[crmApi.fetchTenantVisitReminders error]', err);
      throw err;
    }
  },

  updateTenantVisitReminders: async (tenantId: string, settings: any): Promise<any> => {
    try {
      const res = await fetch(`${API_BASE}/tenants/${tenantId}/visit-reminders`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(settings)
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to update tenant visit reminders');
      }
      const json = await res.json();
      return json.data || json;
    } catch (err) {
      console.error('[crmApi.updateTenantVisitReminders error]', err);
      throw err;
    }
  },

  resetTenantVisitReminders: async (tenantId: string): Promise<any> => {
    try {
      const res = await fetch(`${API_BASE}/tenants/${tenantId}/visit-reminders/reset`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to reset tenant visit reminders');
      }
      const json = await res.json();
      return json.data || json;
    } catch (err) {
      console.error('[crmApi.resetTenantVisitReminders error]', err);
      throw err;
    }
  },


  fetchVisitHistory: async (id: string): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE}/visits/${id}/history`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('[crmApi.fetchVisitHistory error]', err);
      return [];
    }
  },

  fetchVisitTasks: async (id: string): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE}/visits/${id}/tasks`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('[crmApi.fetchVisitTasks error]', err);
      return [];
    }
  },

  fetchVisitFollowups: async (id: string): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE}/visits/${id}/followups`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('[crmApi.fetchVisitFollowups error]', err);
      return [];
    }
  },

  fetchTaskHistory: async (id: string): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/history`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('[crmApi.fetchTaskHistory error]', err);
      return [];
    }
  },

  fetchTaskFollowups: async (id: string): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/followups`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('[crmApi.fetchTaskFollowups error]', err);
      return [];
    }
  },

  fetchVisitById: async (id: string): Promise<any> => {
    try {
      const res = await fetch(`${API_BASE}/visits/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch visit ${id}`);
      return await res.json();
    } catch (err) {
      console.error(`[crmApi.fetchVisitById ${id} error]`, err);
      return null;
    }
  },

  updateVisit: async (id: string, payload: any): Promise<{ success: boolean; data?: any; error?: string; code?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/visits/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update visit', code: data.code };
      }
      return { success: true, data };
    } catch (err: any) {
      console.error(`[crmApi.updateVisit ${id} error]`, err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  // Project Commercial Stage Transition
  transitionProjectStage: async (
    projectId: string, 
    stageId: string, 
    options?: { notes?: string; lossReason?: string; cancellationReason?: string; reopenReason?: string; isReopen?: boolean; expectedFromStage?: string } | string
  ): Promise<{ success: boolean; error?: string; code?: string; missingFields?: string[]; data?: any }> => {
    try {
      const payload: any = { stageId };
      if (typeof options === 'string') {
        payload.notes = options;
      } else if (options) {
        if (options.notes) payload.notes = options.notes;
        if (options.lossReason) payload.lossReason = options.lossReason;
        if (options.cancellationReason) payload.cancellationReason = options.cancellationReason;
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

  advanceProjectStage: async (
    projectId: string,
    options?: { confirmClose?: boolean; closeReason?: string; notes?: string }
  ): Promise<{ success: boolean; project?: any; transition?: any; canAdvance?: boolean; nextStage?: any; error?: string; code?: string; requiresConfirmation?: boolean }> => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/advance-stage`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(options || {})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Failed to advance stage',
          code: data.code,
          requiresConfirmation: data.requiresConfirmation,
          nextStage: data.nextStage
        };
      }
      return data;
    } catch (err: any) {
      console.error('[crmApi.advanceProjectStage error]', err);
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

  fetchTaskReport: async (tenantId?: string): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (tenantId && tenantId !== 'ALL') params.set('tenantId', tenantId);

      const url = `${API_BASE}/reports/tasks${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch task report`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchTaskReport error]', err);
      return null;
    }
  },

  fetchVisitReport: async (tenantId?: string): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (tenantId && tenantId !== 'ALL') params.set('tenantId', tenantId);

      const url = `${API_BASE}/reports/visits${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch visit report`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchVisitReport error]', err);
      return null;
    }
  },

  fetchPerformanceReport: async (tenantId?: string): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (tenantId && tenantId !== 'ALL') params.set('tenantId', tenantId);

      const url = `${API_BASE}/reports/performance${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch performance report`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchPerformanceReport error]', err);
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

  fetchProjectById: async (projectId: string): Promise<Project | null> => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch project`);
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchProjectById error]', err);
      return null;
    }
  },

  updateProject: async (projectId: string, payload: any): Promise<{ success: boolean; data?: any; error?: string; code?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update project', code: data.code };
      }
      return { success: true, data };
    } catch (err: any) {
      console.error('[crmApi.updateProject error]', err);
      return { success: false, error: err.message || 'Network error' };
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
      const url = `${API_BASE}/sales/pipeline${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${res.status}: Failed to fetch pipeline analytics`);
      }
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchPipelineAnalytics error]', err);
      throw err;
    }
  },

  fetchPipelineVelocity: async (filters?: { teamId?: string; repId?: string }): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (filters?.teamId) params.set('teamId', filters.teamId);
      if (filters?.repId) params.set('repId', filters.repId);

      const url = `${API_BASE}/sales/pipeline-velocity${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${res.status}: Failed to fetch pipeline velocity`);
      }
      const data = await res.json();
      if (data) {
        if (data.baselines && !Array.isArray(data.baselines) && typeof data.baselines === 'object') {
          data.baselines = Object.values(data.baselines);
        } else if (!Array.isArray(data.baselines) && Array.isArray(data.baselinesList)) {
          data.baselines = data.baselinesList;
        } else if (!Array.isArray(data.baselines)) {
          data.baselines = [];
        }

        if (!Array.isArray(data.currentProjects) && Array.isArray(data.projectVelocities)) {
          data.currentProjects = data.projectVelocities;
        } else if (!Array.isArray(data.currentProjects)) {
          data.currentProjects = [];
        }
      }
      return data;
    } catch (err) {
      console.error('[crmApi.fetchPipelineVelocity error]', err);
      throw err;
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
  },

  // --- Follow-up API Endpoints ---
  fetchFollowUps: async (params?: QueryPaginationParams & {
    dueDateFrom?: string;
    dueDateTo?: string;
    isOverdue?: boolean;
    isDueToday?: boolean;
  }): Promise<PaginatedResponse<FollowUp> | { data: FollowUp[]; pagination: any }> => {
    const q = new URLSearchParams();
    if (params) {
      if (params.page) q.set('page', String(params.page));
      if (params.pageSize) q.set('pageSize', String(params.pageSize));
      if (params.search) q.set('search', params.search.trim());
      if (params.status && params.status !== 'ALL') q.set('status', params.status);
      if (params.priority && params.priority !== 'ALL') q.set('priority', params.priority);
      if (params.customerId && params.customerId !== 'ALL') q.set('customerId', params.customerId);
      if (params.picId && params.picId !== 'ALL') q.set('picId', params.picId);
      if (params.typeId && params.typeId !== 'ALL') q.set('typeId', params.typeId);
      if (params.projectId && params.projectId !== 'ALL') q.set('projectId', params.projectId);
      if (params.relatedProjectId && params.relatedProjectId !== 'ALL') q.set('relatedProjectId', params.relatedProjectId);
      if (params.relatedVisitId && params.relatedVisitId !== 'ALL') q.set('relatedVisitId', params.relatedVisitId);
      if (params.dueDateFrom) q.set('dueDateFrom', params.dueDateFrom);
      if (params.dueDateTo) q.set('dueDateTo', params.dueDateTo);
      if (params.isOverdue) q.set('isOverdue', 'true');
      if (params.isDueToday) q.set('isDueToday', 'true');
      if (params.scope) q.set('scope', params.scope);
    }
    const url = `${API_BASE}/follow-ups${q.toString() ? '?' + q.toString() : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch follow-ups`);
    const data = await res.json();
    if (Array.isArray(data)) {
      return {
        data,
        pagination: {
          page: 1,
          pageSize: data.length,
          totalItems: data.length,
          totalPages: 1
        }
      };
    }
    return data;
  },

  fetchFollowUpById: async (id: string): Promise<FollowUp | null> => {
    try {
      const res = await fetch(`${API_BASE}/follow-ups/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('[crmApi.fetchFollowUpById error]', err);
      return null;
    }
  },

  createFollowUp: async (data: Partial<FollowUp>): Promise<{ success: boolean; data?: FollowUp; error?: string; code?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/follow-ups`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: json.error || 'Failed to create follow-up', code: json.code };
      }
      return { success: true, data: json.data || json };
    } catch (err: any) {
      console.error('[crmApi.createFollowUp error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  updateFollowUp: async (id: string, data: Partial<FollowUp>): Promise<{ success: boolean; error?: string; code?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/follow-ups/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: json.error || 'Failed to update follow-up', code: json.code };
      }
      return { success: true };
    } catch (err: any) {
      console.error('[crmApi.updateFollowUp error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  completeFollowUp: async (id: string, outcome?: string): Promise<{ success: boolean; data?: any; error?: string; code?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/follow-ups/${id}/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ outcome })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: json.error || 'Failed to complete follow-up', code: json.code };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      console.error('[crmApi.completeFollowUp error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  cancelFollowUp: async (id: string, cancellationReason: string): Promise<{ success: boolean; data?: any; error?: string; code?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/follow-ups/${id}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ cancellationReason })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: json.error || 'Failed to cancel follow-up', code: json.code };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      console.error('[crmApi.cancelFollowUp error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  uploadFollowUpEvidence: async (followUpId: string, file: File): Promise<{ success: boolean; data?: any; error?: string; code?: string }> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('sfp_auth_token') || '';
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/follow-ups/${followUpId}/evidences`, {
        method: 'POST',
        headers,
        body: formData
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: json.error || 'Failed to upload evidence', code: json.code };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      console.error('[crmApi.uploadFollowUpEvidence error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  deleteFollowUpEvidence: async (followUpId: string, evidenceId: string): Promise<{ success: boolean; error?: string; code?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/follow-ups/${followUpId}/evidences/${evidenceId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: json.error || 'Failed to delete evidence', code: json.code };
      }
      return { success: true };
    } catch (err: any) {
      console.error('[crmApi.deleteFollowUpEvidence error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  }
};



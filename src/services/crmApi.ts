const API_BASE = '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('sfp_auth_token') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

export const crmApi = {
  // Generic collection fetcher
  fetchCollection: async <T>(table: string, tenantId?: string): Promise<T[]> => {
    try {
      const params = new URLSearchParams();
      if (tenantId && tenantId !== 'ALL') params.set('tenantId', tenantId);

      const url = `${API_BASE}/${table}${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch ${table}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error(`[crmApi.fetchCollection ${table} error]`, err);
      return [];
    }
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
  }
};



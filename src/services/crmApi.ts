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
  }
};

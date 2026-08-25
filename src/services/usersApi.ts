import { User } from '../types';

const API_BASE = '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('sfp_auth_token') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

export const usersApi = {
  fetchUsers: async (tenantId?: string, assignableOnly: boolean = false): Promise<User[]> => {
    try {
      const params = new URLSearchParams();
      if (tenantId && tenantId !== 'ALL') params.set('tenantId', tenantId);
      if (assignableOnly) params.set('assignable', 'true');

      const url = `${API_BASE}/users${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch users`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('[usersApi.fetchUsers error]', err);
      return [];
    }
  },

  saveUser: async (user: User, isNew: boolean = true): Promise<{ success: boolean, error?: string, code?: string }> => {
    try {
      const res = await fetch(`${API_BASE}${isNew ? '/tenant/users' : `/users/${user.id}`}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(user)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to save user', code: data.code };
      }
      return { success: true };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  updateUserStatus: async (userId: string, status: string, isPlatformLevel: boolean = false): Promise<{ success: boolean, error?: string, code?: string }> => {
    try {
      const endpoint = isPlatformLevel ? `${API_BASE}/users/${userId}/status` : `${API_BASE}/tenant/users/${userId}/status`;
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update user status', code: data.code };
      }
      return { success: true };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  fetchOwnershipImpact: async (userId: string, tenantId?: string): Promise<{
    userId: string;
    tenantId: string;
    customers: number;
    projects: number;
    tasks: number;
    openTasks: number;
    visits: number;
    plannedVisits: number;
    followUps: number;
    pendingFollowUps: number;
    totalOwnedRecords: number;
  } | null> => {
    try {
      const params = new URLSearchParams();
      if (tenantId) params.set('tenantId', tenantId);
      const url = `${API_BASE}/tenant/users/${userId}/ownership-impact${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch ownership impact`);
      return await res.json();
    } catch (err) {
      console.error('[usersApi.fetchOwnershipImpact error]', err);
      return null;
    }
  },

  transferOwnership: async (sourceUserId: string, targetUserId: string, resources?: string[], options?: any): Promise<{
    success: boolean;
    transferred?: {
      customers: number;
      projects: number;
      tasks: number;
      visits: number;
      followUps: number;
      total: number;
    };
    error?: string;
    code?: string;
  }> => {
    try {
      const res = await fetch(`${API_BASE}/tenant/users/${sourceUserId}/ownership-transfer`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ targetUserId, resources, options })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to transfer ownership', code: data.code };
      }
      return data;
    } catch (err: any) {
      console.error('[usersApi.transferOwnership error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  }
};

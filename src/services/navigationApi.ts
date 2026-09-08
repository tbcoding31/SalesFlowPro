import { AppMenuItem } from '../types';

const API_BASE = '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('sfp_auth_token') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

export const navigationApi = {
  fetchMyNavigation: async (): Promise<{ data: AppMenuItem[], role?: string, scope?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/navigation/me`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch navigation`);
      const result = await res.json();
      return {
        data: Array.isArray(result.data) ? result.data : [],
        role: result.role,
        scope: result.scope
      };
    } catch (err) {
      console.error('[navigationApi.fetchMyNavigation error]', err);
      throw err;
    }
  },

  fetchPlatformMenus: async (): Promise<AppMenuItem[]> => {
    try {
      const res = await fetch(`${API_BASE}/platform/menus`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch platform menus`);
      const result = await res.json();
      return Array.isArray(result.data) ? result.data : [];
    } catch (err) {
      console.error('[navigationApi.fetchPlatformMenus error]', err);
      throw err;
    }
  },

  createPlatformMenu: async (menu: Partial<AppMenuItem> & { roles?: string[] }): Promise<{ success: boolean, data?: AppMenuItem, error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/platform/menus`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(menu)
      });
      const result = await res.json();
      if (!res.ok) return { success: false, error: result.error || 'Failed to create menu' };
      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  updatePlatformMenu: async (id: string, menu: Partial<AppMenuItem> & { roles?: string[] }): Promise<{ success: boolean, error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/platform/menus/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(menu)
      });
      const result = await res.json();
      if (!res.ok) return { success: false, error: result.error || 'Failed to update menu' };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  deletePlatformMenu: async (id: string): Promise<{ success: boolean, error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/platform/menus/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const result = await res.json();
      if (!res.ok) return { success: false, error: result.error || 'Failed to deactivate menu' };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  fetchMenuRoles: async (menuId: string): Promise<string[]> => {
    try {
      const res = await fetch(`${API_BASE}/platform/menus/${menuId}/roles`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      return Array.isArray(result.data) ? result.data : [];
    } catch (err) {
      console.error('[navigationApi.fetchMenuRoles error]', err);
      return [];
    }
  },

  updateMenuRoles: async (menuId: string, roles: string[]): Promise<{ success: boolean, error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/platform/menus/${menuId}/roles`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ roles })
      });
      const result = await res.json();
      if (!res.ok) return { success: false, error: result.error || 'Failed to update roles' };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  }
};

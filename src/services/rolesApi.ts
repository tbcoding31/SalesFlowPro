import { RolePermissions } from '../types';

const API_BASE = '/api';

export const rolesApi = {
  fetchPlatformRoles: async (): Promise<any[]> => {
    try {
      const token = localStorage.getItem('sfp_auth_token') || '';
      const res = await fetch(`${API_BASE}/roles/platform`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch platform roles');
      const data = await res.json();
      return data.items || [];
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  fetchRoleTemplates: async (): Promise<any[]> => {
    try {
      const token = localStorage.getItem('sfp_auth_token') || '';
      const res = await fetch(`${API_BASE}/roles/templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch role templates');
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  fetchPermissionCatalog: async (): Promise<any[]> => {
    try {
      const token = localStorage.getItem('sfp_auth_token') || '';
      const res = await fetch(`${API_BASE}/permissions/catalog`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch permission catalog');
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  fetchTenantRoles: async (tenantId?: string | null): Promise<RolePermissions[]> => {
    try {
      const token = localStorage.getItem('sfp_auth_token') || '';
      const url = tenantId ? `${API_BASE}/roles/tenant?tenantId=${tenantId}` : `${API_BASE}/roles/tenant`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch tenant roles');
      const data = await res.json();
      return data.items || [];
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  fetchTenantPermissionCatalog: async (): Promise<any[]> => {
    try {
      const token = localStorage.getItem('sfp_auth_token') || '';
      const res = await fetch(`${API_BASE}/permissions/tenant-catalog`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch tenant permission catalog');
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  updateRoleDirectPermissions: async (roleId: string, permissions: string[], dataScope: string): Promise<boolean> => {
    try {
      const token = localStorage.getItem('sfp_auth_token') || '';
      const res = await fetch(`${API_BASE}/roles/tenant/${roleId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ permissions, dataScope })
      });
      return res.ok;
    } catch (err) {
      console.error(err);
      return false;
    }
  },

  createCustomRole: async (roleData: { name: string; code?: string; description?: string; dataScope?: string; permissions?: string[] }): Promise<any> => {
    try {
      const token = localStorage.getItem('sfp_auth_token') || '';
      const res = await fetch(`${API_BASE}/roles/tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(roleData)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create role');
      }
      return await res.json();
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  },

  updateRoleName: async (roleId: string, name: string, description?: string): Promise<boolean> => {
    try {
      const token = localStorage.getItem('sfp_auth_token') || '';
      const res = await fetch(`${API_BASE}/roles/tenant/${roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, description })
      });
      return res.ok;
    } catch (err) {
      console.error(err);
      return false;
    }
  },

  deleteCustomRole: async (roleId: string): Promise<boolean> => {
    try {
      const token = localStorage.getItem('sfp_auth_token') || '';
      const res = await fetch(`${API_BASE}/roles/tenant/${roleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.ok;
    } catch (err) {
      console.error(err);
      return false;
    }
  }
};

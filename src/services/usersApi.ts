import { User } from '../types';

const API_BASE = '/api';

export const usersApi = {
  fetchUsers: async (tenantId?: string): Promise<User[]> => {
    try {
      const token = localStorage.getItem('sfp_auth_token') || '';
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const url = tenantId ? `${API_BASE}/users?tenantId=${tenantId}` : `${API_BASE}/users`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch users`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('[usersApi.fetchUsers error]', err);
      return [];
    }
  },

  saveUser: async (user: User, isNew: boolean = true): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}${isNew ? '/tenant/users' : `/users/${user.id}`}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      return res.ok;
    } catch (err) {
      console.error(err);
      return false;
    }
  },

  updateUserStatus: async (userId: string, status: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      return res.ok;
    } catch (err) {
      console.error(err);
      return false;
    }
  }
};

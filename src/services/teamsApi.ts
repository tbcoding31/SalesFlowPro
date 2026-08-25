const API_BASE = '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('sfp_auth_token') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

export interface Team {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  leaderId?: string | null;
  leaderName?: string | null;
  leaderEmail?: string | null;
  leaderStatus?: string | null;
  leaderUserId?: string | null;
  memberCount?: number;
  members?: TeamMember[];
}

export interface TeamMember {
  id: string;
  tenantUserId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  teamRole: 'LEADER' | 'MEMBER';
  status: string;
  joinedAt?: string;
}

export const teamsApi = {
  fetchTeams: async (tenantId?: string): Promise<Team[]> => {
    try {
      const params = new URLSearchParams();
      if (tenantId && tenantId !== 'ALL') params.set('tenantId', tenantId);

      const url = `${API_BASE}/teams${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch teams`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('[teamsApi.fetchTeams error]', err);
      return [];
    }
  },

  fetchTeamById: async (teamId: string): Promise<Team | null> => {
    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch team`);
      return await res.json();
    } catch (err) {
      console.error('[teamsApi.fetchTeamById error]', err);
      return null;
    }
  },

  createTeam: async (teamData: { name: string; description?: string; leaderId?: string; tenantId?: string }): Promise<{
    success: boolean;
    teamId?: string;
    error?: string;
    code?: string;
  }> => {
    try {
      const res = await fetch(`${API_BASE}/teams`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(teamData)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to create team', code: data.code };
      }
      return data;
    } catch (err: any) {
      console.error('[teamsApi.createTeam error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  updateTeam: async (teamId: string, teamData: { name?: string; description?: string; leaderId?: string | null }): Promise<{
    success: boolean;
    error?: string;
    code?: string;
  }> => {
    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(teamData)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update team', code: data.code };
      }
      return data;
    } catch (err: any) {
      console.error('[teamsApi.updateTeam error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  deleteTeam: async (teamId: string): Promise<{
    success: boolean;
    error?: string;
    code?: string;
  }> => {
    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to delete team', code: data.code };
      }
      return { success: true };
    } catch (err: any) {
      console.error('[teamsApi.deleteTeam error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  addMember: async (teamId: string, tenantUserId: string, role: string = 'MEMBER'): Promise<{
    success: boolean;
    error?: string;
    code?: string;
  }> => {
    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}/members`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ tenantUserId, role })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to add team member', code: data.code };
      }
      return data;
    } catch (err: any) {
      console.error('[teamsApi.addMember error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  removeMember: async (teamId: string, targetId: string): Promise<{
    success: boolean;
    error?: string;
    code?: string;
  }> => {
    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}/members/${targetId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to remove team member', code: data.code };
      }
      return { success: true };
    } catch (err: any) {
      console.error('[teamsApi.removeMember error]', err);
      return { success: false, error: err.message || 'Network error' };
    }
  }
};

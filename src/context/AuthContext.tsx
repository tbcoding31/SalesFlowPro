import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Tenant, UserRole } from '../types';
import { DataService } from '../services/dataService';

export interface LoginResult {
  success: boolean;
  status?: number;
  message?: string;
  code?: string;
}

interface AuthContextType {
  currentUser: User | null;
  currentTenant: Tenant | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult | boolean>;
  logout: () => void;
  switchUser: (userId: string) => void;
  switchTenant: (tenantId: string) => void;
  refreshTenant: () => void;
  refreshUser: () => void;
  hasPermission: (permissionCode: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_USER_KEY = 'sfp_auth_user_id';
const AUTH_TOKEN_KEY = 'sfp_auth_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Bootstrap auth session from localStorage
    const savedUserId = localStorage.getItem(AUTH_USER_KEY);
    const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const savedUserStr = localStorage.getItem('sfp_currentUser');

    if (savedToken && savedUserId && savedUserStr) {
      try {
        const user = JSON.parse(savedUserStr);
        setCurrentUser(user);
        setToken(savedToken);
        if (user.role === 'SUPER_ADMIN' || !user.tenantId || user.tenantId === 'SYSTEM') {
          setCurrentTenant(null);
        } else {
          setCurrentTenant({ id: user.tenantId, name: 'Active Tenant', status: 'ACTIVE' } as any);
        }
        // Restore session from localStorage. NOTE: This uses stateful database-backed session tokens,
        // NOT JSON Web Tokens (JWT). The token is a cryptographically random 256-bit session identifier
        // verified on every request against the auth_sessions table. The server is the source of truth.
      } catch (e) {
        // Corrupted localStorage state
        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem('sfp_currentUser');
      }
    }
    setIsLoading(false);

    // -- Multi-Tab Session Synchronization (BroadcastChannel) --
    // When Tab A logs out or has session invalidated, broadcast to all other tabs
    const sessionChannel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('sfp_session_channel')
      : null;

    if (sessionChannel) {
      sessionChannel.onmessage = (event) => {
        if (event.data?.type === 'SESSION_TERMINATED') {
          // Another tab logged out — clear this tab's state too
          localStorage.removeItem(AUTH_USER_KEY);
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem('sfp_currentUser');
          // Clear sensitive cached data
          const sensitiveKeys = ['sfp_users_v1', 'sfp_customers_v1', 'sfp_projects_v1',
            'sfp_activities_v1', 'sfp_targets_v1', 'sfp_audit_logs_v1', 'sfp_notifications_v1'];
          sensitiveKeys.forEach(k => localStorage.removeItem(k));
          setCurrentUser(null);
          setCurrentTenant(null);
          setToken(null);
          window.location.href = '/login';
        }
      };
    }

    // -- Global Fetch Interceptor --
    const originalFetch = window.fetch;
    let isHandlingSuspension = false;
    let isHandlingUnauthorized = false;

    window.fetch = async (...args) => {
      const [resource, config] = args;
      const url = typeof resource === 'string' ? resource : (resource instanceof Request ? resource.url : '');
      
      const newConfig = { ...config } as RequestInit;
      
      // Only intercept our own API
      if (url.startsWith('/api/')) {
        const currentToken = localStorage.getItem(AUTH_TOKEN_KEY);
        if (currentToken) {
          const headers = new Headers(newConfig.headers || {});
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${currentToken}`);
          }
          newConfig.headers = headers;
        }
      }

      const response = await originalFetch(resource, newConfig);

      // Handle 401 Unauthorized (Invalid/Expired Session)
      if (response.status === 401 && url.startsWith('/api/') && !url.includes('/auth/login') && !isHandlingUnauthorized) {
        isHandlingUnauthorized = true;
        // Broadcast session termination to all other tabs
        sessionChannel?.postMessage({ type: 'SESSION_TERMINATED', reason: 'unauthorized' });
        // Clear valid authentication state only
        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem('sfp_currentUser');
        setCurrentUser(null);
        setCurrentTenant(null);
        setToken(null);
        // Redirect to login
        window.location.href = '/login';
        return response;
      }

      // Handle Suspension 403
      if (response.status === 403 && url.startsWith('/api/') && !isHandlingSuspension && !isHandlingUnauthorized) {
        try {
          const clone = response.clone();
          const body = await clone.json();
          if (body?.code === 'TENANT_SUSPENDED') {
            isHandlingSuspension = true;
            // Broadcast session termination to all other tabs
            sessionChannel?.postMessage({ type: 'SESSION_TERMINATED', reason: 'suspended' });
            // Log out user visually and clear session
            localStorage.removeItem(AUTH_USER_KEY);
            localStorage.removeItem(AUTH_TOKEN_KEY);
            localStorage.removeItem('sfp_currentUser');
            setCurrentUser(null);
            setCurrentTenant(null);
            setToken(null);
            // Show modal via DOM directly to ensure it survives React unmounts
            const modal = document.createElement('div');
            modal.innerHTML = `
              <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:999999;">
                <div style="background:white;padding:32px;border-radius:12px;max-width:400px;text-align:center;font-family:sans-serif;box-shadow:0 10px 25px rgba(0,0,0,0.2);">
                  <div style="width:48px;height:48px;background:#fee2e2;color:#ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                  </div>
                  <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">Account Access Suspended</h2>
                  <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.5;">Your organization's tenant has been suspended. You have been logged out and can no longer access the application.</p>
                  <button id="suspend-ok-btn" style="background:#4744e5;color:white;border:none;padding:10px 24px;border-radius:6px;font-weight:bold;cursor:pointer;width:100%;">Back to Login</button>
                </div>
              </div>
            `;
            document.body.appendChild(modal);
            document.getElementById('suspend-ok-btn')?.addEventListener('click', () => {
              window.location.href = '/login';
            });
          }
        } catch (e) {
          // ignore parsing error
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch; // cleanup
      sessionChannel?.close();
    };
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setIsLoading(false);
        return {
          success: false,
          status: res.status,
          message: data?.message || data?.error || (res.status === 401 ? 'Invalid credentials' : 'Login failed'),
          code: data?.code || (res.status === 401 ? 'INVALID_CREDENTIALS' : 'LOGIN_ERROR')
        };
      }

      const user = data.user;
      const newToken = data.token;

      setCurrentUser(user);
      setToken(newToken);
      localStorage.setItem(AUTH_USER_KEY, user.id);
      localStorage.setItem(AUTH_TOKEN_KEY, newToken);
      localStorage.setItem('sfp_currentUser', JSON.stringify({
        ...user
      }));
      
      // HYDRATION: Fetch all DB data and store to localStorage before navigating
      try {
        const syncRes = await fetch(`/api/sync/all?tenantId=${user.tenantId || 'SYSTEM'}`);
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          localStorage.setItem('sfp_tenants_v1', JSON.stringify(syncData.tenants || []));
          localStorage.setItem('sfp_users_v1', JSON.stringify(syncData.users || []));
          localStorage.setItem('sfp_customers_v1', JSON.stringify(syncData.customers || []));
          localStorage.setItem('sfp_projects_v1', JSON.stringify(syncData.projects || []));
          localStorage.setItem('sfp_visits_v1', JSON.stringify(syncData.visits || []));
          localStorage.setItem('sfp_tasks_v1', JSON.stringify(syncData.tasks || []));
          localStorage.setItem('sfp_activities_v1', JSON.stringify(syncData.activities || []));
          localStorage.setItem('sfp_targets_v1', JSON.stringify(syncData.salesTargets || []));
          localStorage.setItem('sfp_audit_logs_v1', JSON.stringify(syncData.auditLogs || []));
          localStorage.setItem('sfp_notifications_v1', JSON.stringify(syncData.notifications || []));
        }
      } catch (err) {
        console.error('Failed to sync data during login:', err);
      }

      if (user.role === 'SUPER_ADMIN' || !user.tenantId || user.tenantId === 'SYSTEM') {
        setCurrentTenant(null);
      } else {
        setCurrentTenant({ id: user.tenantId, name: 'Active Tenant', status: 'ACTIVE' } as any);
      }

      setIsLoading(false);
      return { success: true, status: 200 };
    } catch (err: any) {
      console.error('Login network error:', err);
      setIsLoading(false);
      return {
        success: false,
        status: 0,
        message: 'Unable to connect to the server. Please check your connection and try again.',
        code: 'NETWORK_ERROR'
      };
    }
  };

  const logout = () => {
    if (currentUser) {
      DataService.addAuditLog({
        tenantId: currentUser.tenantId || 'SYSTEM',
        userId: currentUser.id,
        userName: currentUser.name,
        action: 'LOGOUT',
        module: 'Authentication',
        entity: 'Session',
        entityId: currentUser.id,
        description: `User ${currentUser.name} logged out`,
        ipAddress: '127.0.0.1'
      });
    }
    // Broadcast to all other tabs that session has ended
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('sfp_session_channel');
      ch.postMessage({ type: 'SESSION_TERMINATED', reason: 'logout' });
      ch.close();
    }
    setCurrentUser(null);
    setCurrentTenant(null);
    setToken(null);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem('sfp_currentUser');
    // Clear sensitive cached data on logout
    ['sfp_users_v1', 'sfp_customers_v1', 'sfp_projects_v1',
     'sfp_activities_v1', 'sfp_targets_v1', 'sfp_audit_logs_v1', 'sfp_notifications_v1'
    ].forEach(k => localStorage.removeItem(k));
  };

  const switchUser = (userId: string) => {
    const user = DataService.getUserById(userId);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem(AUTH_USER_KEY, user.id);
      if (user.role === 'SUPER_ADMIN' || !user.tenantId || user.tenantId === 'SYSTEM') {
        setCurrentTenant(null);
      } else {
        const tenant = DataService.getTenantById(user.tenantId);
        setCurrentTenant(tenant || DataService.getTenants()[0]);
      }
    }
  };

  const switchTenant = (tenantId: string) => {
    const tenant = DataService.getTenantById(tenantId);
    if (tenant) {
      setCurrentTenant(tenant);
    }
  };

  const refreshTenant = () => {
    if (currentTenant) {
      const refreshed = DataService.getTenantById(currentTenant.id);
      if (refreshed) setCurrentTenant(refreshed);
    }
  };

  const refreshUser = () => {
    if (currentUser) {
      const refreshed = DataService.getUserById(currentUser.id);
      if (refreshed) setCurrentUser(refreshed);
    }
  };

  const hasPermission = (permissionCode: string): boolean => {
    if (!currentUser || !currentUser.permissions) return false;
    if (currentUser.permissions.includes('ALL')) return true;
    return currentUser.permissions.includes(permissionCode);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentTenant,
        token,
        isAuthenticated: !!currentUser && !!token,
        isLoading,
        login,
        logout,
        switchUser,
        switchTenant,
        refreshTenant,
        refreshUser,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

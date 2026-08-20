import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Tenant, UserRole } from '../types';
import { DataService } from '../services/dataService';

interface AuthContextType {
  currentUser: User | null;
  currentTenant: Tenant | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
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
    const savedUserId = localStorage.getItem(AUTH_USER_KEY) || 'USR-001'; // Default to Super Admin for demo
    const savedToken = localStorage.getItem(AUTH_TOKEN_KEY) || 'demo-jwt-token-123';

    const user = DataService.getUserById(savedUserId) || DataService.getUsers()[0];
    if (user) {
      setCurrentUser(user);
      setToken(savedToken);
      if (user.tenantId && user.tenantId !== 'SYSTEM') {
        const tenant = DataService.getTenantById(user.tenantId);
        setCurrentTenant(tenant || DataService.getTenants()[0]);
      } else {
        // Super Admin uses first tenant as active context or platform context
        setCurrentTenant(DataService.getTenants()[0]);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        setIsLoading(false);
        return false;
      }

      const data = await res.json();
      const user = data.user;
      const newToken = data.token;

      setCurrentUser(user);
      setToken(newToken);
      localStorage.setItem(AUTH_USER_KEY, user.id);
      localStorage.setItem('sfp_currentUser', JSON.stringify({
        ...data.user,
        tenantId: data.tenantId,
        role: data.role,
        roleName: data.roleName
      }));
      
      // HYDRATION: Fetch all DB data and store to localStorage before navigating
      try {
        const syncRes = await fetch(`/api/sync/all?tenantId=${data.tenantId}`);
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          localStorage.setItem('sfp_tenants_v1', JSON.stringify(syncData.tenants || []));
          localStorage.setItem('sfp_users_v1', JSON.stringify(syncData.users || []));
          localStorage.setItem('sfp_customers_v1', JSON.stringify(syncData.customers || []));
          localStorage.setItem('sfp_visits_v1', JSON.stringify(syncData.visits || []));
          localStorage.setItem('sfp_tasks_v1', JSON.stringify(syncData.tasks || []));
          localStorage.setItem('sfp_activities_v1', JSON.stringify(syncData.activities || []));
          localStorage.setItem('sfp_targets_v1', JSON.stringify(syncData.salesTargets || []));
          localStorage.setItem('sfp_audit_logs_v1', JSON.stringify(syncData.auditLogs || []));
          localStorage.setItem('sfp_projects_v1', JSON.stringify(syncData.projects || []));
        }
      } catch (syncErr) {
        console.error("Hydration failed:", syncErr);
      }

      if (user.tenantId && user.tenantId !== 'SYSTEM') {
        const tenant = DataService.getTenantById(user.tenantId);
        setCurrentTenant(tenant || DataService.getTenants()[0]);
      } else {
        // Super Admin uses first tenant as active context or platform context
        setCurrentTenant(DataService.getTenants()[0]);
      }

      setIsLoading(false);
      return true;
    } catch (err) {
      console.error('Login error:', err);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    if (currentUser) {
      DataService.addAuditLog({
        tenantId: currentUser.tenantId === 'SYSTEM' ? 'TEN-00001' : currentUser.tenantId,
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
    setCurrentUser(null);
    setCurrentTenant(null);
    setToken(null);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  };

  const switchUser = (userId: string) => {
    const user = DataService.getUserById(userId);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem(AUTH_USER_KEY, user.id);
      if (user.tenantId && user.tenantId !== 'SYSTEM') {
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
    if (!currentUser) return false;
    if (currentUser.role === 'SUPER_ADMIN') return true;
    if (currentUser.role === 'TENANT_ADMIN') return true;
    
    // Check role-based permission
    if (permissionCode.includes('delete') && currentUser.role === 'SALES_REPRESENTATIVE') {
      return false;
    }
    if (permissionCode.includes('tenant') && currentUser.role !== 'SUPER_ADMIN') {
      return false;
    }
    return true;
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

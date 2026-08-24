import { RolePermissions } from '../types';

const API_BASE = '/api';

export const rolesApi = {
  fetchRoles: async (tenantId: string): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE}/roles?tenantId=${tenantId}`);
      if (!res.ok) throw new Error('Failed to fetch roles');
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  fetchPermissions: async (): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE}/permissions`);
      if (!res.ok) throw new Error('Failed to fetch permissions');
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  fetchRolePermissions: async (): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE}/role_permissions`);
      if (!res.ok) throw new Error('Failed to fetch role_permissions');
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  fetchRoleDataScopes: async (): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE}/role_data_scopes`);
      if (!res.ok) throw new Error('Failed to fetch role_data_scopes');
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  getAggregatedRolePermissions: async (tenantId: string): Promise<RolePermissions[]> => {
    const [roles, permissions, rolePerms, dataScopes, tenantUsers] = await Promise.all([
      rolesApi.fetchRoles(tenantId),
      rolesApi.fetchPermissions(),
      rolesApi.fetchRolePermissions(),
      rolesApi.fetchRoleDataScopes(),
      fetch(`${API_BASE}/tenant_user_roles`).then(r => r.ok ? r.json() : []).catch(() => [])
    ]);

    const moduleNames = ['Customers', 'Visits', 'Tasks', 'Projects', 'Reports', 'Settings'];

    return roles.map(role => {
      const rolePermissionIds = rolePerms.filter(rp => rp.roleId === role.id).map(rp => rp.permission || rp.permissionId);
      const roleScope = dataScopes.find(ds => ds.roleId === role.id);
      const membersCount = tenantUsers.filter((tur: any) => tur.roleId === role.id).length;
      
      const permissionsMap = moduleNames.map(moduleName => {
        const prefix = moduleName.toUpperCase();
        return {
          module: moduleName,
          view: rolePermissionIds.includes(`${prefix}_VIEW`) || rolePermissionIds.includes(`MANAGE_${prefix}`) || rolePermissionIds.includes(`VIEW_ALL_${prefix}`),
          create: rolePermissionIds.includes(`${prefix}_CREATE`) || rolePermissionIds.includes(`MANAGE_${prefix}`),
          edit: rolePermissionIds.includes(`${prefix}_EDIT`) || rolePermissionIds.includes(`MANAGE_${prefix}`),
          delete: rolePermissionIds.includes(`${prefix}_DELETE`) || rolePermissionIds.includes(`MANAGE_${prefix}`),
          export: rolePermissionIds.includes(`${prefix}_EXPORT`),
          assign: rolePermissionIds.includes(`${prefix}_ASSIGN`) || rolePermissionIds.includes(`ASSIGN_${prefix}`),
          reassign: rolePermissionIds.includes(`${prefix}_REASSIGN`),
          complete: rolePermissionIds.includes(`${prefix}_COMPLETE`),
          moveStage: rolePermissionIds.includes(`${prefix}_MOVESTAGE`),
        };
      });
      
      return {
        role: role.id || role.role_code || role.name,
        roleName: role.name,
        description: role.description,
        scope: role.scope,
        isSystem: role.isSystem,
        tenantId: role.tenantId,
        memberCount: membersCount,
        assignedPermissions: rolePermissionIds,
        permissions: permissionsMap as any,
        dataScope: roleScope ? roleScope.scope : 'TEAM',
      } as RolePermissions;
    });
  },

  updateRoleDirectPermissions: async (roleId: string, permissions: string[], dataScope: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/roles/${roleId}/permissions_scopes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions, dataScope })
      });
      return res.ok;
    } catch (err) {
      console.error(err);
      return false;
    }
  },

  updateRolePermissions: async (roleId: string, permissionsState: RolePermissions): Promise<boolean> => {
    try {
      // If assignedPermissions is explicitly provided, send that directly
      if (permissionsState.assignedPermissions && Array.isArray(permissionsState.assignedPermissions)) {
        return await rolesApi.updateRoleDirectPermissions(roleId, permissionsState.assignedPermissions, permissionsState.dataScope);
      }

      const dbPermissions: string[] = [];
      permissionsState.permissions?.forEach((p: any) => {
        const prefix = p.module.toUpperCase();
        if (p.view) dbPermissions.push(`${prefix}_VIEW`);
        if (p.create) dbPermissions.push(`${prefix}_CREATE`);
        if (p.edit) dbPermissions.push(`${prefix}_EDIT`);
        if (p.delete) dbPermissions.push(`${prefix}_DELETE`);
        if (p.export) dbPermissions.push(`${prefix}_EXPORT`);
        if (p.assign) dbPermissions.push(`${prefix}_ASSIGN`);
        if (p.reassign) dbPermissions.push(`${prefix}_REASSIGN`);
        if (p.complete) dbPermissions.push(`${prefix}_COMPLETE`);
        if (p.moveStage) dbPermissions.push(`${prefix}_MOVESTAGE`);
      });

      const res = await fetch(`${API_BASE}/roles/${roleId}/permissions_scopes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: dbPermissions, dataScope: permissionsState.dataScope })
      });
      return res.ok;
    } catch (err) {
      console.error(err);
      return false;
    }
  }
};

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
    const [roles, permissions, rolePerms, dataScopes] = await Promise.all([
      rolesApi.fetchRoles(tenantId),
      rolesApi.fetchPermissions(),
      rolesApi.fetchRolePermissions(),
      rolesApi.fetchRoleDataScopes()
    ]);

    const moduleNames = ['Customers', 'Visits', 'Tasks', 'Projects', 'Reports', 'Settings'];

    return roles.map(role => {
      const rolePermissionIds = rolePerms.filter(rp => rp.roleId === role.id).map(rp => rp.permissionId);
      const roleScope = dataScopes.find(ds => ds.roleId === role.id);
      
      const permissionsMap = moduleNames.map(moduleName => {
        const prefix = moduleName.toUpperCase();
        return {
          module: moduleName,
          view: rolePermissionIds.includes(`${prefix}_VIEW`),
          create: rolePermissionIds.includes(`${prefix}_CREATE`),
          edit: rolePermissionIds.includes(`${prefix}_EDIT`),
          delete: rolePermissionIds.includes(`${prefix}_DELETE`),
          export: rolePermissionIds.includes(`${prefix}_EXPORT`),
          assign: rolePermissionIds.includes(`${prefix}_ASSIGN`),
          reassign: rolePermissionIds.includes(`${prefix}_REASSIGN`),
          complete: rolePermissionIds.includes(`${prefix}_COMPLETE`),
          moveStage: rolePermissionIds.includes(`${prefix}_MOVESTAGE`),
        };
      });
      
      return {
        role: role.id || role.role_code || role.name,
        roleName: role.name,
        scope: role.scope,
        isSystem: role.isSystem,
        tenantId: role.tenantId,
        permissions: permissionsMap as any,
        dataScope: roleScope ? roleScope.scope : 'TEAM',
      } as RolePermissions;
    });
  },

  updateRolePermissions: async (roleId: string, permissionsState: RolePermissions): Promise<boolean> => {
    try {
      const dbPermissions: string[] = [];
      permissionsState.permissions.forEach((p: any) => {
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

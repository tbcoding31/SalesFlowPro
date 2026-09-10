import { MasterDataItem } from '../types';
import { isColorValue } from '../components/master-data/MasterDataIndicator';

const API_BASE = '/api';

export const getTableName = (category: MasterDataItem['category']): string => {
  if (category === 'task_types') return 'activity_types';
  if (category === 'customer_status') return 'customer_statuses';
  return category;
};

const mapFromDb = (category: MasterDataItem['category'], row: any): MasterDataItem => {
  const icon = row.icon || undefined;
  const color = row.color || undefined;
  return {
    id: row.id,
    category,
    label: row.name || row.label || '',
    codeValue: row.code || row.id || '',
    indicator: icon || color || '',
    icon,
    color,
    description: row.description || undefined,
    level: row.level !== undefined ? Number(row.level) : undefined,
    isDefault: !!row.isDefault,
    displayOrder: row.displayOrder || row.level || 0,
    probability: row.probability !== undefined ? Number(row.probability) : undefined,
    phase: row.phase || undefined,
    commercialOutcome: row.commercialOutcome || undefined,
    isActive: row.isActive !== undefined ? Boolean(row.isActive) : true,
    isTerminal: row.isTerminal !== undefined ? Boolean(row.isTerminal) : undefined,
    allowVisits: row.allowVisits !== undefined ? Boolean(row.allowVisits) : undefined,
    allowNewProject: row.allowNewProject !== undefined ? Boolean(row.allowNewProject) : undefined,
    sourceType: row.sourceType || 'PLATFORM',
    platformMasterId: row.platformMasterId || null,
  };
};

const mapToDb = (category: MasterDataItem['category'], item: MasterDataItem, tenantId: string): any => {
  const base = {
    id: item.id,
    name: item.label,
    code: item.codeValue,
    isActive: item.isActive !== undefined ? (item.isActive ? 1 : 0) : 1,
    displayOrder: item.displayOrder || 1,
  };

  // Derive separated color and icon without cross-pollination
  const resolvedColor = item.color || (isColorValue(item.indicator) ? item.indicator : null);
  const resolvedIcon = item.icon || (!isColorValue(item.indicator) ? item.indicator : null);

  switch (category) {
    case 'task_types':
      return {
        ...base,
        icon: resolvedIcon || null,
        color: resolvedColor || null
      };
    case 'task_priorities':
      return {
        ...base,
        color: resolvedColor || null,
        isDefault: item.isDefault ? 1 : 0
      };
    case 'task_statuses':
    case 'customer_status':
    case 'customer_statuses':
    case 'visit_statuses':
      return {
        ...base,
        color: resolvedColor || null
      };
    case 'visit_purposes':
      return {
        ...base,
        description: item.description || null
      };
    case 'customer_types':
      return { ...base };
    case 'project_stages':
      return {
        ...base,
        displayOrder: item.displayOrder,
        probability: item.probability !== undefined ? item.probability : 50,
        phase: item.phase || 'SALES',
        commercialOutcome: item.commercialOutcome || 'NONE',
        isTerminal: item.isTerminal !== undefined ? (item.isTerminal ? 1 : 0) : 0,
        allowVisits: item.allowVisits !== undefined ? (item.allowVisits ? 1 : 0) : 1,
        allowNewProject: item.allowNewProject !== undefined ? (item.allowNewProject ? 1 : 0) : 1,
        isActive: item.isActive !== undefined ? (item.isActive ? 1 : 0) : 1
      };
    case 'departments':
      return {
        id: item.id,
        tenantId: tenantId === 'platform' ? null : tenantId,
        name: item.label,
        description: item.description || item.codeValue || null,
        isActive: item.isActive !== undefined ? (item.isActive ? 1 : 0) : 1,
        displayOrder: item.displayOrder || 0
      };
    case 'positions':
      return {
        id: item.id,
        tenantId: tenantId === 'platform' ? null : tenantId,
        name: item.label,
        level: item.level !== undefined ? item.level : (item.displayOrder || 1),
        isActive: item.isActive !== undefined ? (item.isActive ? 1 : 0) : 1
      };
    default:
      return base;
  }
};

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  usageCount?: number;
  message?: string;
}

export const masterDataApi = {
  fetchMasterData: async (category: MasterDataItem['category'], tenantId?: string): Promise<MasterDataItem[]> => {
    const table = getTableName(category);
    try {
      const url = tenantId === 'platform' 
        ? `${API_BASE}/master-data/platform/${table}` 
        : `${API_BASE}/master-data/${table}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('sfp_auth_token')}` }
      });
      if (!res.ok) throw new Error(`Failed to fetch ${table}`);
      const rows = await res.json();
      return rows.map((row: any) => mapFromDb(category, row));
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  fetchTenantMasterData: async (category: MasterDataItem['category']): Promise<MasterDataItem[]> => {
    return masterDataApi.fetchMasterData(category);
  },

  fetchPlatformMasterData: async (category: MasterDataItem['category']): Promise<MasterDataItem[]> => {
    return masterDataApi.fetchMasterData(category, 'platform');
  },

  saveMasterDataItem: async (item: MasterDataItem, tenantId?: string, isNew: boolean = false): Promise<ApiResponse> => {
    const table = getTableName(item.category);
    const dbRow = mapToDb(item.category, item, tenantId || '');
    try {
      let url = isNew ? `${API_BASE}/master-data/${table}` : `${API_BASE}/master-data/${table}/${item.id}`;
      if (tenantId === 'platform') {
        url = isNew ? `${API_BASE}/master-data/platform/${table}` : `${API_BASE}/master-data/platform/${table}/${item.id}`;
      }
      const method = isNew ? 'POST' : 'PUT';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('sfp_auth_token')}` },
        body: JSON.stringify(dbRow)
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error: body.error || body.message || `Failed to save item (${res.status})`,
          code: body.code
        };
      }
      return { success: true, data: body };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  deleteMasterDataItem: async (category: MasterDataItem['category'], id: string, tenantId?: string): Promise<ApiResponse> => {
    const table = getTableName(category);
    try {
      let url = `${API_BASE}/master-data/${table}/${id}`;
      if (tenantId === 'platform') {
        url = `${API_BASE}/master-data/platform/${table}/${id}`;
      }
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('sfp_auth_token')}` }
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error: body.error || body.message || `Failed to delete item (${res.status})`,
          code: body.code,
          usageCount: body.usageCount
        };
      }
      return { success: true, data: body };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  resetMasterDataCategory: async (category: MasterDataItem['category']): Promise<{ success: boolean; message?: string; restoredCount?: number; preservedCustomCount?: number; error?: string }> => {
    const table = getTableName(category);
    try {
      const res = await fetch(`${API_BASE}/master-data/${table}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sfp_auth_token')}`
        }
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error: body.error || body.message || 'Reset failed'
        };
      }
      return {
        success: true,
        message: body.message,
        restoredCount: body.restoredCount,
        preservedCustomCount: body.preservedCustomCount
      };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  fetchVisitReminderDefaults: async (): Promise<any> => {
    try {
      const res = await fetch(`${API_BASE}/master-data/platform/visit-reminder-defaults`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('sfp_auth_token')}` }
      });
      if (!res.ok) throw new Error('Failed to fetch visit reminder defaults');
      return await res.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  updateVisitReminderDefaults: async (settings: any): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/master-data/platform/visit-reminder-defaults`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sfp_auth_token')}`
        },
        body: JSON.stringify(settings)
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Failed to update visit reminder defaults');
      }
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
};


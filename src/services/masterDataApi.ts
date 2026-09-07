import { MasterDataItem } from '../types';

const API_BASE = '/api';

export const getTableName = (category: MasterDataItem['category']): string => {
  if (category === 'task_types') return 'activity_types';
  if (category === 'customer_status') return 'customer_statuses';
  return category;
};

const mapFromDb = (category: MasterDataItem['category'], row: any): MasterDataItem => {
  return {
    id: row.id,
    category,
    label: row.name || row.label || '',
    codeValue: row.code || row.id || '',
    indicator: row.color || row.icon || '',
    isDefault: !!row.isDefault,
    displayOrder: row.displayOrder || row.level || 0,
  };
};

const mapToDb = (category: MasterDataItem['category'], item: MasterDataItem, tenantId: string): any => {
  const base = {
    id: item.id,
    name: item.label,
    code: item.codeValue,
  };

  switch (category) {
    case 'task_types':
      return { ...base, icon: item.indicator, color: item.indicator };
    case 'task_priorities':
    case 'task_statuses':
    case 'customer_status':
      return { ...base, color: item.indicator };
    case 'project_stages':
      return { ...base, displayOrder: item.displayOrder, probability: 50 };
    case 'departments':
      return { id: item.id, tenantId: tenantId === 'platform' ? null : tenantId, name: item.label, description: item.codeValue };
    case 'positions':
      return { id: item.id, tenantId: tenantId === 'platform' ? null : tenantId, name: item.label, level: item.displayOrder };
    default:
      return base;
  }
};

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

  saveMasterDataItem: async (item: MasterDataItem, tenantId?: string, isNew: boolean = false): Promise<boolean> => {
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
      return res.ok;
    } catch (err) {
      console.error(err);
      return false;
    }
  },

  deleteMasterDataItem: async (category: MasterDataItem['category'], id: string, tenantId?: string): Promise<boolean> => {
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
      return res.ok;
    } catch (err) {
      console.error(err);
      return false;
    }
  }
};

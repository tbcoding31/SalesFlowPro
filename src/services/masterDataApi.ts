import { MasterDataItem } from '../types';

const API_BASE = '/api';

// Map frontend category to database table name
export const getTableName = (category: MasterDataItem['category']): string => {
  if (category === 'task_types') return 'activity_types';
  if (category === 'customer_status') return 'customer_statuses';
  return category;
};

// Map DB row to MasterDataItem
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

// Map MasterDataItem to DB row
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
      return { ...base, displayOrder: item.displayOrder, probability: 50 }; // default probability if missing
    case 'departments':
      return { id: item.id, tenantId, name: item.label, description: item.codeValue };
    case 'positions':
      return { id: item.id, tenantId, name: item.label, level: item.displayOrder };
    default:
      return base;
  }
};

export const masterDataApi = {
  fetchMasterData: async (category: MasterDataItem['category'], tenantId: string): Promise<MasterDataItem[]> => {
    const table = getTableName(category);
    try {
      const res = await fetch(`${API_BASE}/${table}?tenantId=${tenantId}`);
      if (!res.ok) throw new Error(`Failed to fetch ${table}`);
      const rows = await res.json();
      return rows.map((row: any) => mapFromDb(category, row));
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  saveMasterDataItem: async (item: MasterDataItem, tenantId: string, isNew: boolean): Promise<boolean> => {
    const table = getTableName(item.category);
    const dbRow = mapToDb(item.category, item, tenantId);
    try {
      const url = isNew ? `${API_BASE}/${table}` : `${API_BASE}/${table}/${item.id}`;
      const method = isNew ? 'POST' : 'PUT';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbRow)
      });
      return res.ok;
    } catch (err) {
      console.error(err);
      return false;
    }
  },

  deleteMasterDataItem: async (category: MasterDataItem['category'], id: string): Promise<boolean> => {
    const table = getTableName(category);
    try {
      const res = await fetch(`${API_BASE}/${table}/${id}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch (err) {
      console.error(err);
      return false;
    }
  }
};

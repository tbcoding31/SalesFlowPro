import { DataService } from './dataService';

const API_URL = 'http://localhost:5000/api';

const fetchAndSync = async (endpoint: string, key: string) => {
  try {
    const res = await fetch(`${API_URL}/${endpoint}`);
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(key, JSON.stringify(data));
      console.log(`Synced ${endpoint} from backend`);
    }
  } catch (err) {
    console.error(`Error syncing ${endpoint}`, err);
  }
};

export const SyncService = {
  syncAll: async (tenantId: string) => {
    console.log('Starting full backend sync...');
    
    const endpoints = [
      { path: 'tenants', key: 'sfp_tenants_v1' },
      { path: `users?tenantId=${tenantId}`, key: 'sfp_users_v1' },
      { path: `customers?tenantId=${tenantId}`, key: 'sfp_customers_v1' },
      { path: `projects?tenantId=${tenantId}`, key: 'sfp_projects_v1' },
      { path: `tasks?tenantId=${tenantId}`, key: 'sfp_tasks_v1' },
      { path: `visits?tenantId=${tenantId}`, key: 'sfp_visits_v1' },
      { path: `follow_ups?tenantId=${tenantId}`, key: 'sfp_followups_v1' },
      { path: `activities?tenantId=${tenantId}`, key: 'sfp_activities_v1' },
      { path: `sales_targets?tenantId=${tenantId}`, key: 'sfp_targets_v1' },
      { path: `notifications?tenantId=${tenantId}`, key: 'sfp_notifications_v1' },
      { path: `audit_logs?tenantId=${tenantId}`, key: 'sfp_audit_logs_v1' },
    ];

    await Promise.all(endpoints.map(ep => fetchAndSync(ep.path, ep.key)));
    console.log('Backend sync completed.');
    
    // Dispatch an event to notify React components that data has updated
    window.dispatchEvent(new Event('sfp_data_synced'));
  }
};

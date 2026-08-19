const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'services', 'dataService.ts');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('const syncPush = ')) {
  const syncPushCode = `
const syncPush = (method: 'POST'|'PUT'|'DELETE', endpoint: string, data?: any) => {
  fetch(\`http://localhost:5000/api/\${endpoint}\`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined
  }).catch(e => console.error('Sync Error', e));
};
`;
  content = content.replace('function setLocal<T>(key: string, value: T): void {', syncPushCode + '\nfunction setLocal<T>(key: string, value: T): void {');
}

const replacements = [
  { match: /setLocal\(STORAGE_KEYS\.TENANTS, tenants\);\s+DataService\.addAuditLog/g, rep: "setLocal(STORAGE_KEYS.TENANTS, tenants);\n    syncPush(idx >= 0 ? 'PUT' : 'POST', idx >= 0 ? `tenants/${tenant.id}` : 'tenants', tenant);\n    DataService.addAuditLog" },
  { match: /setLocal\(STORAGE_KEYS\.USERS, users\);\s+DataService\.addAuditLog/g, rep: "setLocal(STORAGE_KEYS.USERS, users);\n    syncPush(idx >= 0 ? 'PUT' : 'POST', idx >= 0 ? `users/${user.id}` : 'users', user);\n    DataService.addAuditLog" },
  { match: /setLocal\(STORAGE_KEYS\.CUSTOMERS, customers\);\s+DataService\.addAuditLog/g, rep: "setLocal(STORAGE_KEYS.CUSTOMERS, customers);\n    syncPush(idx >= 0 ? 'PUT' : 'POST', idx >= 0 ? `customers/${customer.id}` : 'customers', customer);\n    DataService.addAuditLog" },
  { match: /setLocal\(STORAGE_KEYS\.VISITS, visits\);\s+return visit;/g, rep: "setLocal(STORAGE_KEYS.VISITS, visits);\n    syncPush(idx >= 0 ? 'PUT' : 'POST', idx >= 0 ? `visits/${visit.id}` : 'visits', visit);\n    return visit;" },
  { match: /setLocal\(STORAGE_KEYS\.TASKS, tasks\);\s+return task;/g, rep: "setLocal(STORAGE_KEYS.TASKS, tasks);\n    syncPush(idx >= 0 ? 'PUT' : 'POST', idx >= 0 ? `tasks/${task.id}` : 'tasks', task);\n    return task;" },
  { match: /setLocal\(STORAGE_KEYS\.FOLLOWUPS, followups\);\s+return followUp;/g, rep: "setLocal(STORAGE_KEYS.FOLLOWUPS, followups);\n    syncPush(idx >= 0 ? 'PUT' : 'POST', idx >= 0 ? `follow_ups/${followUp.id}` : 'follow_ups', followUp);\n    return followUp;" },
  { match: /setLocal\(STORAGE_KEYS\.PROJECTS, opps\);\s+DataService\.addActivity/g, rep: "setLocal(STORAGE_KEYS.PROJECTS, opps);\n    syncPush(idx >= 0 ? 'PUT' : 'POST', idx >= 0 ? `projects/${project.id}` : 'projects', project);\n    DataService.addActivity" },
  { match: /setLocal\(STORAGE_KEYS\.ACTIVITIES, activities\);\s+return newAct;/g, rep: "setLocal(STORAGE_KEYS.ACTIVITIES, activities);\n    syncPush('POST', 'activities', newAct);\n    return newAct;" },
  { match: /setLocal\(STORAGE_KEYS\.TARGETS, targets\);\s+return target;/g, rep: "setLocal(STORAGE_KEYS.TARGETS, targets);\n    syncPush(idx >= 0 ? 'PUT' : 'POST', idx >= 0 ? `sales_targets/${target.id}` : 'sales_targets', target);\n    return target;" }
];

for (const r of replacements) {
  content = content.replace(r.match, r.rep);
}

fs.writeFileSync(file, content);
console.log('dataService.ts refactored for two-way sync.');

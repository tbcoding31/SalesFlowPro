import React, { useState } from 'react';

const Toggle: React.FC<{ enabled: boolean; onChange: () => void }> = ({ enabled, onChange }) => (
  <button
    type="button"
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
    role="switch"
    aria-checked={enabled}
    onClick={onChange}
  >
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
    />
  </button>
);

export const SystemSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);

  // States
  const [generalSettings, setGeneralSettings] = useState({
    appName: 'SalesFlow Pro',
    timezone: 'Asia/Jakarta',
    dateFormat: 'DD/MM/YYYY',
    currency: 'IDR'
  });

  const [applicationSettings, setApplicationSettings] = useState({
    supportEmail: 'support@salesflow.com',
    language: 'English (US)',
    maintenanceMode: false
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailAlerts: true,
    pushNotifications: true,
    dailyDigest: false
  });

  const [salesSettings, setSalesSettings] = useState({
    defaultTaskPriority: 'MEDIUM',
    defaultVisitDuration: '60',
    projectAutoClose: true
  });

  const [securitySettings, setSecuritySettings] = useState({
    sessionTimeout: '30',
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    mfaEnabled: false
  });

  const [auditSettings, setAuditSettings] = useState({
    retentionDays: '90',
    logVisits: true,
    logProjects: true,
    logLogins: true
  });

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      // alert('Settings saved successfully!');
    }, 800);
  };

  const tabs = [
    { id: 'general', name: 'General', icon: 'settings' },
    { id: 'application', name: 'Application', icon: 'apps' },
    { id: 'sales', name: 'Sales', icon: 'point_of_sale' },
    { id: 'notifications', name: 'Notifications', icon: 'notifications_active' },
    { id: 'security', name: 'Security', icon: 'shield' },
    { id: 'audit', name: 'Audit', icon: 'history' },
    { id: 'integrations', name: 'Integrations', icon: 'extension' }
  ];

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
            System Settings
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Manage global application configurations and policies.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className={`px-4 py-2 flex items-center gap-2 ${isSaving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} text-white text-sm font-bold rounded-xl shadow-sm transition-colors`}
          >
            {isSaving && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left Navigation */}
        <div className="w-full lg:w-64 shrink-0">
          <nav className="flex flex-col gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                  activeTab === tab.id 
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 font-semibold border border-transparent'
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {tab.icon}
                </span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm p-8 min-h-[500px]">
          
          {activeTab === 'general' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 font-['Hanken_Grotesk']">General Settings</h2>
                <p className="text-xs font-medium text-slate-500 mt-1">Basic configuration for the application environment.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Application Name</label>
                  <input 
                    type="text" 
                    value={generalSettings.appName}
                    onChange={(e) => setGeneralSettings({...generalSettings, appName: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                  <p className="text-[11px] text-slate-500">Displayed in headers and emails.</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Timezone</label>
                  <select 
                    value={generalSettings.timezone}
                    onChange={(e) => setGeneralSettings({...generalSettings, timezone: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  >
                    <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Date Format</label>
                  <select 
                    value={generalSettings.dateFormat}
                    onChange={(e) => setGeneralSettings({...generalSettings, dateFormat: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Currency</label>
                  <select 
                    value={generalSettings.currency}
                    onChange={(e) => setGeneralSettings({...generalSettings, currency: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  >
                    <option value="IDR">Indonesian Rupiah (Rp)</option>
                    <option value="USD">US Dollar ($)</option>
                    <option value="SGD">Singapore Dollar (S$)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'application' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 font-['Hanken_Grotesk']">Application Settings</h2>
                <p className="text-xs font-medium text-slate-500 mt-1">Manage global app behavior and contact points.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Support Email</label>
                  <input 
                    type="email" 
                    value={applicationSettings.supportEmail}
                    onChange={(e) => setApplicationSettings({...applicationSettings, supportEmail: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                  <p className="text-[11px] text-slate-500">Contact email shown to users.</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Default Language</label>
                  <select 
                    value={applicationSettings.language}
                    onChange={(e) => setApplicationSettings({...applicationSettings, language: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  >
                    <option value="English (US)">English (US)</option>
                    <option value="Indonesian">Indonesian</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Maintenance Mode</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Disable user access to perform system updates.</p>
                  </div>
                  <Toggle 
                    enabled={applicationSettings.maintenanceMode} 
                    onChange={() => setApplicationSettings({...applicationSettings, maintenanceMode: !applicationSettings.maintenanceMode})} 
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 font-['Hanken_Grotesk']">Sales Defaults</h2>
                <p className="text-xs font-medium text-slate-500 mt-1">Configure default behaviors for sales activities.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Default Task Priority</label>
                  <select 
                    value={salesSettings.defaultTaskPriority}
                    onChange={(e) => setSalesSettings({...salesSettings, defaultTaskPriority: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Default Visit Duration (Mins)</label>
                  <input 
                    type="number"
                    value={salesSettings.defaultVisitDuration}
                    onChange={(e) => setSalesSettings({...salesSettings, defaultVisitDuration: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                  <p className="text-[11px] text-slate-500">Default time block when scheduling a new visit.</p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Auto-close Inactive Projects</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Automatically mark projects as lost if no activity for 90 days.</p>
                  </div>
                  <Toggle 
                    enabled={salesSettings.projectAutoClose} 
                    onChange={() => setSalesSettings({...salesSettings, projectAutoClose: !salesSettings.projectAutoClose})} 
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 font-['Hanken_Grotesk']">Global Notifications</h2>
                <p className="text-xs font-medium text-slate-500 mt-1">Configure default notification delivery channels for the entire system.</p>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Enable Email Alerts</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Allow system to send transactional emails to users.</p>
                  </div>
                  <Toggle 
                    enabled={notificationSettings.emailAlerts} 
                    onChange={() => setNotificationSettings({...notificationSettings, emailAlerts: !notificationSettings.emailAlerts})} 
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Enable Push Notifications</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Allow browser and mobile push notifications.</p>
                  </div>
                  <Toggle 
                    enabled={notificationSettings.pushNotifications} 
                    onChange={() => setNotificationSettings({...notificationSettings, pushNotifications: !notificationSettings.pushNotifications})} 
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Daily Digest Emails</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Send a daily summary of tasks and visits to all users.</p>
                  </div>
                  <Toggle 
                    enabled={notificationSettings.dailyDigest} 
                    onChange={() => setNotificationSettings({...notificationSettings, dailyDigest: !notificationSettings.dailyDigest})} 
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 font-['Hanken_Grotesk']">Security Policies</h2>
                <p className="text-xs font-medium text-slate-500 mt-1">Manage session timeouts and password requirements.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Session Timeout (Mins)</label>
                  <input 
                    type="number"
                    value={securitySettings.sessionTimeout}
                    onChange={(e) => setSecuritySettings({...securitySettings, sessionTimeout: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                  <p className="text-[11px] text-slate-500">Users will be logged out after this period of inactivity.</p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Require Uppercase Letters</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Passwords must contain at least one uppercase letter.</p>
                  </div>
                  <Toggle 
                    enabled={securitySettings.requireUppercase} 
                    onChange={() => setSecuritySettings({...securitySettings, requireUppercase: !securitySettings.requireUppercase})} 
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Require Numbers</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Passwords must contain at least one number.</p>
                  </div>
                  <Toggle 
                    enabled={securitySettings.requireNumbers} 
                    onChange={() => setSecuritySettings({...securitySettings, requireNumbers: !securitySettings.requireNumbers})} 
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Require Special Characters</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Passwords must contain at least one special character.</p>
                  </div>
                  <Toggle 
                    enabled={securitySettings.requireSpecialChars} 
                    onChange={() => setSecuritySettings({...securitySettings, requireSpecialChars: !securitySettings.requireSpecialChars})} 
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Enforce Multi-Factor Authentication (MFA)</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Require all users to use MFA during login.</p>
                  </div>
                  <Toggle 
                    enabled={securitySettings.mfaEnabled} 
                    onChange={() => setSecuritySettings({...securitySettings, mfaEnabled: !securitySettings.mfaEnabled})} 
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 font-['Hanken_Grotesk']">Audit & Logging</h2>
                <p className="text-xs font-medium text-slate-500 mt-1">Configure data retention and system logging.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Activity Retention (Days)</label>
                  <input 
                    type="number"
                    value={auditSettings.retentionDays}
                    onChange={(e) => setAuditSettings({...auditSettings, retentionDays: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                  <p className="text-[11px] text-slate-500">How long audit logs are kept before being purged.</p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Log Visit Changes</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Keep a history of all visit creations, updates, and cancellations.</p>
                  </div>
                  <Toggle 
                    enabled={auditSettings.logVisits} 
                    onChange={() => setAuditSettings({...auditSettings, logVisits: !auditSettings.logVisits})} 
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Log Project Updates</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Track pipeline stage movements and value changes.</p>
                  </div>
                  <Toggle 
                    enabled={auditSettings.logProjects} 
                    onChange={() => setAuditSettings({...auditSettings, logProjects: !auditSettings.logProjects})} 
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Log User Logins</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Record successful and failed login attempts.</p>
                  </div>
                  <Toggle 
                    enabled={auditSettings.logLogins} 
                    onChange={() => setAuditSettings({...auditSettings, logLogins: !auditSettings.logLogins})} 
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 font-['Hanken_Grotesk']">External Integrations</h2>
                <p className="text-xs font-medium text-slate-500 mt-1">Connect SalesFlow Pro to third-party services.</p>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[24px] text-blue-600">mail</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Email SMTP Provider</h3>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">Not connected</p>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">
                    Configure
                  </button>
                </div>
                
                <div className="border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[24px] text-emerald-600">calendar_month</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Calendar Sync (Google/Outlook)</h3>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">Not connected</p>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">
                    Configure
                  </button>
                </div>
                
                <div className="border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[24px] text-amber-600">chat</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Slack / Teams Notifications</h3>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">Not connected</p>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">
                    Configure
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
};

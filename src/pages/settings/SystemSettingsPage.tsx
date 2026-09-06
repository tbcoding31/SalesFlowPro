import React, { useState, useEffect } from 'react';

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

  const [integrations, setIntegrations] = useState<any>({});
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [integrationForm, setIntegrationForm] = useState<any>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    fetch('/api/system/integrations', { headers: { Authorization: `Bearer ${localStorage.getItem('sfp_auth_token')}` } })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.integrations) {
          setIntegrations(data.integrations);
        }
      }).catch(console.error);
  }, []);

  const openIntegrationModal = async (provider: string) => {
    try {
      const res = await fetch(`/api/system/integrations/${provider}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sfp_auth_token')}` }
      });
      const data = await res.json();
      if (data.success && data.integration) {
        const itg = data.integration;
        setIntegrationForm({
          provider,
          displayName: itg.displayName || provider,
          enabled: itg.enabled !== undefined ? itg.enabled : false,
          config: itg.config || {},
          hasSecrets: itg.hasSecrets,
          secrets: {}
        });
      } else {
        const existing = integrations[provider] || {};
        setIntegrationForm({
          provider,
          displayName: existing.displayName || provider,
          enabled: existing.enabled || false,
          config: existing.config || {},
          hasSecrets: false,
          secrets: {}
        });
      }
    } catch (e) {
      const existing = integrations[provider] || {};
      setIntegrationForm({
        provider,
        displayName: existing.displayName || provider,
        enabled: existing.enabled || false,
        config: existing.config || {},
        hasSecrets: false,
        secrets: {}
      });
    }
    setTestResult(null);
    setSaveMessage(null);
    setIsDirty(false);
    setActiveModal(provider);
  };

  const handleSaveIntegration = async () => {
    try {
      setIsSaving(true);
      setSaveMessage(null);
      await fetch(`/api/system/integrations/${integrationForm.provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('sfp_auth_token')}` },
        body: JSON.stringify(integrationForm)
      });
      
      // Reload
      const res = await fetch('/api/system/integrations', { headers: { Authorization: `Bearer ${localStorage.getItem('sfp_auth_token')}` } });
      const data = await res.json();
      if (data.success && data.integrations) setIntegrations(data.integrations);
      
      setIsDirty(false);
      setSaveMessage('Configuration saved successfully.');
      if (integrationForm.secrets?.password) {
        setIntegrationForm((prev: any) => ({ ...prev, hasSecrets: true }));
      }
    } catch(e) {
      console.error(e);
      setSaveMessage(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestIntegration = async () => {
    if (isTesting) return;

    if (integrationForm.provider === 'smtp') {
      const host = (integrationForm.config?.host || '').trim();
      const port = Number(integrationForm.config?.port);
      if (!host) {
        setTestResult({ success: false, code: 'SMTP_MISSING_HOST', message: 'SMTP host is required.' });
        return;
      }
      if (isNaN(port) || port < 1 || port > 65535) {
        setTestResult({ success: false, code: 'SMTP_INVALID_PORT', message: 'SMTP port must be a valid number between 1 and 65535.' });
        return;
      }
      const hasStoredPass = integrationForm.hasSecrets || (integrations.smtp?.status && integrations.smtp?.status !== 'NOT_CONNECTED');
      const newPass = integrationForm.secrets?.password ? String(integrationForm.secrets.password).trim() : '';
      if (!hasStoredPass && !newPass) {
        setTestResult({ success: false, code: 'SMTP_MISSING_PASSWORD', message: 'SMTP password is required.' });
        return;
      }
    }

    try {
      setIsTesting(true);
      setTestResult(null);
      setSaveMessage(null);

      const payload = {
        enabled: integrationForm.enabled,
        host: integrationForm.config?.host,
        port: integrationForm.config?.port,
        secure: integrationForm.config?.secure,
        ignoreTls: integrationForm.config?.ignoreTls,
        fromEmail: integrationForm.config?.fromEmail,
        username: integrationForm.config?.username || integrationForm.secrets?.username,
        password: integrationForm.secrets?.password || undefined
      };

      const res = await fetch(`/api/system/integrations/${integrationForm.provider}/test`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sfp_auth_token')}` 
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setTestResult(data);
      
      // Reload to see updated status
      const res2 = await fetch('/api/system/integrations', { headers: { Authorization: `Bearer ${localStorage.getItem('sfp_auth_token')}` } });
      const data2 = await res2.json();
      if (data2.success && data2.integrations) setIntegrations(data2.integrations);
    } catch(e: any) {
      setTestResult({ success: false, code: 'NETWORK_ERROR', message: e.message || 'Unable to connect to server.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnectIntegration = async () => {
    try {
      setIsSaving(true);
      await fetch(`/api/system/integrations/${integrationForm.provider}/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('sfp_auth_token')}` }
      });
      
      // Reload
      const res = await fetch('/api/system/integrations', { headers: { Authorization: `Bearer ${localStorage.getItem('sfp_auth_token')}` } });
      const data = await res.json();
      if (data.success) setIntegrations(data.integrations);
      
      setActiveModal(null);
    } catch(e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

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

  
  useEffect(() => {
    fetch('/api/system/settings', { headers: { Authorization: `Bearer ${localStorage.getItem('sfp_auth_token')}` } })
      .then(res => res.json())
      .then(data => {
        if (data.appName) setGeneralSettings(prev => ({...prev, appName: data.appName, timezone: data.timezone || prev.timezone, dateFormat: data.dateFormat || prev.dateFormat, currency: data.currency || prev.currency}));
        if (data.supportEmail) setApplicationSettings(prev => ({...prev, supportEmail: data.supportEmail, language: data.language || prev.language, maintenanceMode: !!data.maintenanceMode}));
        if (data.defaultTaskPriority) setSalesSettings(prev => ({...prev, defaultTaskPriority: data.defaultTaskPriority, defaultVisitDuration: String(data.defaultVisitDuration || prev.defaultVisitDuration), projectAutoClose: !!data.projectAutoClose}));
        if (data.emailAlerts !== undefined) setNotificationSettings(prev => ({...prev, emailAlerts: !!data.emailAlerts, pushNotifications: !!data.pushNotifications, dailyDigest: !!data.dailyDigest}));
        if (data.sessionTimeout) setSecuritySettings(prev => ({...prev, sessionTimeout: String(data.sessionTimeout), requireUppercase: !!data.requireUppercase, requireNumbers: !!data.requireNumbers, requireSpecialChars: !!data.requireSpecialChars, mfaEnabled: !!data.mfaEnabled}));
        if (data.retentionDays) setAuditSettings(prev => ({...prev, retentionDays: String(data.retentionDays), logVisits: !!data.logVisits, logProjects: !!data.logProjects, logLogins: !!data.logLogins}));
      }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        appName: generalSettings.appName,
        timezone: generalSettings.timezone,
        dateFormat: generalSettings.dateFormat,
        currency: generalSettings.currency,
        supportEmail: applicationSettings.supportEmail,
        language: applicationSettings.language,
        maintenanceMode: applicationSettings.maintenanceMode,
        defaultTaskPriority: salesSettings.defaultTaskPriority,
        defaultVisitDuration: Number(salesSettings.defaultVisitDuration),
        projectAutoClose: salesSettings.projectAutoClose,
        emailAlerts: notificationSettings.emailAlerts,
        pushNotifications: notificationSettings.pushNotifications,
        dailyDigest: notificationSettings.dailyDigest,
        sessionTimeout: Number(securitySettings.sessionTimeout),
        requireUppercase: securitySettings.requireUppercase,
        requireNumbers: securitySettings.requireNumbers,
        requireSpecialChars: securitySettings.requireSpecialChars,
        mfaEnabled: securitySettings.mfaEnabled,
        retentionDays: Number(auditSettings.retentionDays),
        logVisits: auditSettings.logVisits,
        logProjects: auditSettings.logProjects,
        logLogins: auditSettings.logLogins
      };

      await fetch('/api/system/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('sfp_auth_token')}` },
        body: JSON.stringify(payload)
      });
    } catch(e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
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
                  {/* SMTP */}
                  <div className="border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[24px] text-blue-600">mail</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Email SMTP Provider</h3>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                          {integrations.smtp?.status === 'CONNECTED' ? (
                            <span className="text-emerald-600 font-bold">Connected</span>
                          ) : integrations.smtp?.status === 'CONFIGURED' ? (
                            <span className="text-blue-600">Configured &ndash; live connection not yet verified</span>
                          ) : integrations.smtp?.status === 'ERROR' ? (
                            <span className="text-red-600 font-bold">Connection Error</span>
                          ) : integrations.smtp?.status === 'DISABLED' ? (
                            <span className="text-slate-400">Disabled</span>
                          ) : (
                            <span className="text-slate-500">Not configured</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => openIntegrationModal('smtp')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">
                      Configure
                    </button>
                  </div>
                  
                  {/* CALENDAR */}
                  <div className="border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[24px] text-emerald-600">calendar_month</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Calendar Sync (Google/Outlook)</h3>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                          {integrations.calendar?.status === 'CONNECTED' ? (
                            <span className="text-emerald-600 font-bold">Connected</span>
                          ) : integrations.calendar?.status === 'CONFIGURED' ? (
                            <span className="text-blue-600">Configured &ndash; live connection not yet verified</span>
                          ) : integrations.calendar?.status === 'ERROR' ? (
                            <span className="text-red-600 font-bold">Connection Error</span>
                          ) : integrations.calendar?.status === 'DISABLED' ? (
                            <span className="text-slate-400">Disabled</span>
                          ) : (
                            <span className="text-slate-500">Not configured</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => openIntegrationModal('calendar')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">
                      Configure
                    </button>
                  </div>
                  
                  {/* SLACK/TEAMS */}
                  <div className="border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[24px] text-amber-600">chat</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Slack / Teams Notifications</h3>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                          {integrations.messaging?.status === 'CONNECTED' ? (
                            <span className="text-emerald-600 font-bold">Connected</span>
                          ) : integrations.messaging?.status === 'CONFIGURED' ? (
                            <span className="text-blue-600">Configured &ndash; live connection not yet verified</span>
                          ) : integrations.messaging?.status === 'ERROR' ? (
                            <span className="text-red-600 font-bold">Connection Error</span>
                          ) : integrations.messaging?.status === 'DISABLED' ? (
                            <span className="text-slate-400">Disabled</span>
                          ) : (
                            <span className="text-slate-500">Not configured</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => openIntegrationModal('messaging')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">
                      Configure
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeModal && (
              <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-lg text-slate-900 font-['Hanken_Grotesk'] flex items-center gap-2">
                      <span>Configure {activeModal === 'smtp' ? 'SMTP' : activeModal === 'calendar' ? 'Calendar Sync' : 'Messaging'}</span>
                      {isDirty && (
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">Unsaved changes</span>
                      )}
                    </h3>
                    <button 
                      onClick={() => { setActiveModal(null); setSaveMessage(null); setTestResult(null); }} 
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    {saveMessage && (
                      <div className="p-3 rounded-lg text-sm bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                        <span>{saveMessage}</span>
                      </div>
                    )}

                    {isTesting && (
                      <div className="p-3 rounded-lg text-sm bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-base text-blue-600">sync</span>
                        <span>Testing SMTP connection...</span>
                      </div>
                    )}

                    {activeModal === 'smtp' && (
                      <>
                        <div className="flex items-center gap-3 mb-4">
                          <label className="text-sm font-bold text-slate-700 w-24">Enable</label>
                          <Toggle 
                            enabled={integrationForm.enabled} 
                            onChange={() => {
                              setIntegrationForm({...integrationForm, enabled: !integrationForm.enabled});
                              setIsDirty(true);
                            }} 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">SMTP Host</label>
                          <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" 
                            placeholder="e.g. webmail.berjaya-inovasi.com"
                            value={integrationForm.config?.host || ''} 
                            onChange={e => {
                              setIntegrationForm({...integrationForm, config: {...integrationForm.config, host: e.target.value}});
                              setIsDirty(true);
                            }} 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">SMTP Port</label>
                          <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" 
                            placeholder="587 or 465"
                            value={integrationForm.config?.port || ''} 
                            onChange={e => {
                              setIntegrationForm({...integrationForm, config: {...integrationForm.config, port: e.target.value}});
                              setIsDirty(true);
                            }} 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">From Email</label>
                          <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" 
                            placeholder="no-reply@yourcompany.com"
                            value={integrationForm.config?.fromEmail || ''} 
                            onChange={e => {
                              setIntegrationForm({...integrationForm, config: {...integrationForm.config, fromEmail: e.target.value}});
                              setIsDirty(true);
                            }} 
                          />
                        </div>
                        <div className="pt-2 border-t border-slate-100">
                          <label className="block text-sm font-bold text-slate-700 mb-1">Username</label>
                          <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" 
                            placeholder="e.g. user@yourcompany.com"
                            value={integrationForm.config?.username !== undefined ? integrationForm.config.username : (integrationForm.secrets?.username || '')} 
                            onChange={e => {
                              setIntegrationForm({
                                ...integrationForm, 
                                config: {...integrationForm.config, username: e.target.value},
                                secrets: {...integrationForm.secrets, username: e.target.value}
                              });
                              setIsDirty(true);
                            }} 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
                          <input type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" 
                            placeholder={integrationForm.hasSecrets || (integrations.smtp?.status && integrations.smtp?.status !== 'NOT_CONNECTED') ? 'Leave blank to keep existing password' : 'Enter SMTP password'}
                            value={integrationForm.secrets?.password || ''} 
                            onChange={e => {
                              setIntegrationForm({...integrationForm, secrets: {...integrationForm.secrets, password: e.target.value}});
                              setIsDirty(true);
                            }} 
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <input 
                            type="checkbox" 
                            id="smtpIgnoreTls" 
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            checked={!!integrationForm.config?.ignoreTls} 
                            onChange={e => {
                              setIntegrationForm({
                                ...integrationForm, 
                                config: {...integrationForm.config, ignoreTls: e.target.checked}
                              });
                              setIsDirty(true);
                            }} 
                          />
                          <label htmlFor="smtpIgnoreTls" className="text-xs font-medium text-slate-600">
                            Ignore TLS certificate mismatch (for shared hosting / cPanel)
                          </label>
                        </div>
                      </>
                    )}

                    {activeModal === 'calendar' && (
                      <>
                        <div className="flex items-center gap-3 mb-4">
                          <label className="text-sm font-bold text-slate-700 w-24">Enable Sync</label>
                          <Toggle 
                            enabled={integrationForm.enabled} 
                            onChange={() => {
                              setIntegrationForm({...integrationForm, enabled: !integrationForm.enabled});
                              setIsDirty(true);
                            }} 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Provider</label>
                          <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                            value={integrationForm.config.calendarProvider || 'google'}
                            onChange={e => {
                              setIntegrationForm({...integrationForm, config: {...integrationForm.config, calendarProvider: e.target.value}});
                              setIsDirty(true);
                            }}>
                            <option value="google">Google Calendar (OAuth)</option>
                            <option value="outlook">Microsoft Outlook 365 (OAuth)</option>
                          </select>
                        </div>
                        <div className="pt-2 border-t border-slate-100">
                          <label className="block text-sm font-bold text-slate-700 mb-1">OAuth Client ID (Secret)</label>
                          <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" 
                            placeholder={integrations.calendar?.status && integrations.calendar?.status !== 'NOT_CONNECTED' ? '******** (Leave blank to keep existing)' : ''}
                            value={integrationForm.secrets?.clientId || ''} 
                            onChange={e => {
                              setIntegrationForm({...integrationForm, secrets: {...integrationForm.secrets, clientId: e.target.value}});
                              setIsDirty(true);
                            }} 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">OAuth Client Secret (Secret)</label>
                          <input type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" 
                            placeholder={integrations.calendar?.status && integrations.calendar?.status !== 'NOT_CONNECTED' ? '******** (Leave blank to keep existing)' : ''}
                            value={integrationForm.secrets?.clientSecret || ''} 
                            onChange={e => {
                              setIntegrationForm({...integrationForm, secrets: {...integrationForm.secrets, clientSecret: e.target.value}});
                              setIsDirty(true);
                            }} 
                          />
                        </div>
                      </>
                    )}

                    {activeModal === 'messaging' && (
                      <>
                        <div className="flex items-center gap-3 mb-4">
                          <label className="text-sm font-bold text-slate-700 w-24">Enable</label>
                          <Toggle 
                            enabled={integrationForm.enabled} 
                            onChange={() => {
                              setIntegrationForm({...integrationForm, enabled: !integrationForm.enabled});
                              setIsDirty(true);
                            }} 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Provider</label>
                          <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                            value={integrationForm.config.messagingProvider || 'slack'}
                            onChange={e => {
                              setIntegrationForm({...integrationForm, config: {...integrationForm.config, messagingProvider: e.target.value}});
                              setIsDirty(true);
                            }}>
                            <option value="slack">Slack</option>
                            <option value="teams">Microsoft Teams</option>
                          </select>
                        </div>
                        <div className="pt-2 border-t border-slate-100">
                          <label className="block text-sm font-bold text-slate-700 mb-1">Webhook URL (Secret)</label>
                          <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" 
                            placeholder={integrations.messaging?.status && integrations.messaging?.status !== 'NOT_CONNECTED' ? '******** (Leave blank to keep existing)' : ''}
                            value={integrationForm.secrets?.webhookUrl || ''} 
                            onChange={e => {
                              setIntegrationForm({...integrationForm, secrets: {...integrationForm.secrets, webhookUrl: e.target.value}});
                              setIsDirty(true);
                            }} 
                          />
                        </div>
                      </>
                    )}

                    {testResult && !isTesting && (
                      <div className={"p-3 rounded-lg text-sm " + (testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200')}>
                        <div className="font-bold">{testResult.success ? (activeModal === 'smtp' ? 'SMTP connection verified successfully.' : 'Connected') : (testResult.code || 'Connection Failed')}</div>
                        <div className="mt-0.5">{testResult.message || testResult.error}</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="px-6 py-4 border-t border-slate-200 flex justify-between bg-slate-50">
                    <button 
                      onClick={handleDisconnectIntegration}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 font-bold rounded-lg text-sm transition-colors"
                    >
                      Disconnect
                    </button>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => { setActiveModal(null); setSaveMessage(null); setTestResult(null); }}
                        className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-sm transition-colors"
                      >
                        Close
                      </button>
                      <button 
                        type="button"
                        onClick={handleTestIntegration}
                        disabled={isTesting || (activeModal === 'smtp' && (!integrationForm.config?.host || !integrationForm.config?.port))}
                        className={`px-4 py-2 font-bold rounded-lg text-sm transition-colors ${
                          isTesting || (activeModal === 'smtp' && (!integrationForm.config?.host || !integrationForm.config?.port))
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                        }`}
                      >
                        {isTesting ? 'Testing...' : 'Test Connection'}
                      </button>
                      <button 
                        onClick={handleSaveIntegration}
                        disabled={isSaving}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors"
                      >
                        {isSaving ? 'Saving...' : 'Save Configuration'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}



          </div>
        </div>
      </div>
    );
};

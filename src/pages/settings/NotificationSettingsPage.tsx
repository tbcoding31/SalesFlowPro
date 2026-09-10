import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/crmApi';

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

export const NotificationSettingsPage: React.FC = () => {
  const { currentUser, currentTenant } = useAuth();
  const isTenantAdmin = currentUser?.role === 'TENANT_ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const tenantId = currentTenant?.id || '';

  const [settings, setSettings] = useState({
    taskAssigned: true,
    taskDueSoon: true,
    taskOverdue: true,
    visitReminder: true,
    visitRescheduled: true,
    visitCancelled: false,
    followupReminder: true,
    projectUpdated: false,
    taskReassigned: true,
    visitReassigned: true,
  });

  // Tenant Visit Reminder State
  const [tenantReminderSettings, setTenantReminderSettings] = useState({
    dashboardReminderEnabled: true,
    dashboardReminderDaysBefore: 5,
    emailReminderEnabled: true,
    emailReminderDaysBefore: 2,
    immediateReminderInsideWindowEnabled: true
  });
  const [isLoadingReminder, setIsLoadingReminder] = useState(false);
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    if (tenantId && isTenantAdmin) {
      setIsLoadingReminder(true);
      crmApi.fetchTenantVisitReminders(tenantId)
        .then((data) => {
          if (data) {
            setTenantReminderSettings({
              dashboardReminderEnabled: Boolean(data.dashboardReminderEnabled),
              dashboardReminderDaysBefore: Number(data.dashboardReminderDaysBefore),
              emailReminderEnabled: Boolean(data.emailReminderEnabled),
              emailReminderDaysBefore: Number(data.emailReminderDaysBefore),
              immediateReminderInsideWindowEnabled: Boolean(data.immediateReminderInsideWindowEnabled)
            });
          }
        })
        .catch((err) => {
          console.error('Failed to load tenant reminder settings', err);
        })
        .finally(() => {
          setIsLoadingReminder(false);
        });
    }
  }, [tenantId, isTenantAdmin]);

  const handleSaveTenantReminders = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setIsSavingReminder(true);
    setReminderMsg(null);
    try {
      await crmApi.updateTenantVisitReminders(tenantId, tenantReminderSettings);
      setReminderMsg({ text: 'Company visit reminder settings saved successfully.', isError: false });
    } catch (err: any) {
      setReminderMsg({ text: err.message || 'Failed to update reminder settings', isError: true });
    } finally {
      setIsSavingReminder(false);
    }
  };

  const handleResetToPlatformDefaults = async () => {
    if (!tenantId) return;
    if (!window.confirm('Are you sure you want to reset your company visit reminder settings to the current platform default snapshot?')) {
      return;
    }
    setIsSavingReminder(true);
    setReminderMsg(null);
    try {
      const resetData = await crmApi.resetTenantVisitReminders(tenantId);
      if (resetData) {
        setTenantReminderSettings({
          dashboardReminderEnabled: Boolean(resetData.dashboardReminderEnabled),
          dashboardReminderDaysBefore: Number(resetData.dashboardReminderDaysBefore),
          emailReminderEnabled: Boolean(resetData.emailReminderEnabled),
          emailReminderDaysBefore: Number(resetData.emailReminderDaysBefore),
          immediateReminderInsideWindowEnabled: Boolean(resetData.immediateReminderInsideWindowEnabled)
        });
      }
      setReminderMsg({ text: 'Reset to platform default snapshot successful.', isError: false });
    } catch (err: any) {
      setReminderMsg({ text: err.message || 'Failed to reset reminder settings', isError: true });
    } finally {
      setIsSavingReminder(false);
    }
  };

  const handleToggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleReset = () => {
    setSettings({
      taskAssigned: true,
      taskDueSoon: true,
      taskOverdue: true,
      visitReminder: true,
      visitRescheduled: true,
      visitCancelled: false,
      followupReminder: true,
      projectUpdated: false,
      taskReassigned: true,
      visitReassigned: true,
    });
  };

  const location = useLocation();
  const isVisitReminderRoute = location.pathname === '/settings/visit-reminders';

  if (isVisitReminderRoute) {
    return (
      <div className="space-y-6 font-['Inter',sans-serif] max-w-4xl mx-auto pb-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
              Visit Reminder Settings
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Configure lead time windows for dashboard alerts and automated email notifications across all visits.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={handleResetToPlatformDefaults}
              disabled={isSavingReminder || isLoadingReminder}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              <span>Reset to Platform Default</span>
            </button>
            <button 
              type="button"
              onClick={handleSaveTenantReminders}
              disabled={isSavingReminder || isLoadingReminder}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              {isSavingReminder && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        {/* Notice Banners */}
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium space-y-1">
          <p className="font-semibold">
            These settings apply only to your company/tenant. Changing them does not affect other tenants.
          </p>
          <p className="text-blue-700">
            'Reset to Platform Default' means COPY current platform values. It must NOT establish inheritance.
          </p>
        </div>

        {reminderMsg && (
          <div className={`p-4 rounded-xl text-xs font-semibold ${reminderMsg.isError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {reminderMsg.text}
          </div>
        )}

        {/* Reminder settings card */}
        <div className="bg-white rounded-2xl border border-indigo-200/80 shadow-xs overflow-hidden ring-1 ring-indigo-50">
          <div className="p-6 border-b border-indigo-100/70 bg-gradient-to-r from-indigo-50/50 via-white to-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[20px]">notifications_active</span>
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk']">
                  Company Visit Reminder Orchestration
                </h2>
                <span className="text-xs text-slate-500">
                  Tenant-level visit reminder rules
                </span>
              </div>
            </div>
          </div>

          {isLoadingReminder ? (
            <div className="p-8 flex justify-center items-center text-slate-400 gap-2 text-xs">
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
              <span>Loading reminder settings...</span>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Dashboard Reminder */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="max-w-md">
                  <h3 className="text-sm font-bold text-slate-900">Dashboard Reminder Window</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Days before a scheduled visit when it starts appearing on user's dashboard Upcoming Visits widget.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Lead Days:</span>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={tenantReminderSettings.dashboardReminderDaysBefore}
                      onChange={(e) => setTenantReminderSettings(prev => ({ ...prev, dashboardReminderDaysBefore: parseInt(e.target.value) || 0 }))}
                      className="w-18 px-2.5 py-1 text-xs font-bold text-slate-800 border border-slate-300 rounded-lg text-center focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <Toggle
                    enabled={tenantReminderSettings.dashboardReminderEnabled}
                    onChange={() => setTenantReminderSettings(prev => ({ ...prev, dashboardReminderEnabled: !prev.dashboardReminderEnabled }))}
                  />
                </div>
              </div>

              {/* Email Reminder */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="max-w-md">
                  <h3 className="text-sm font-bold text-slate-900">Automated Email Notifications</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Days before a scheduled visit when automated email reminders are dispatched to PIC and participants.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Lead Days:</span>
                    <input
                      type="number"
                      min={0}
                      max={14}
                      value={tenantReminderSettings.emailReminderDaysBefore}
                      onChange={(e) => setTenantReminderSettings(prev => ({ ...prev, emailReminderDaysBefore: parseInt(e.target.value) || 0 }))}
                      className="w-18 px-2.5 py-1 text-xs font-bold text-slate-800 border border-slate-300 rounded-lg text-center focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <Toggle
                    enabled={tenantReminderSettings.emailReminderEnabled}
                    onChange={() => setTenantReminderSettings(prev => ({ ...prev, emailReminderEnabled: !prev.emailReminderEnabled }))}
                  />
                </div>
              </div>

              {/* Immediate Reminder Inside Window */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="max-w-md">
                  <h3 className="text-sm font-bold text-slate-900">Immediate Reminder Inside Window</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    If a visit is created or rescheduled with a start date inside the reminder window, dispatch immediately on next scheduler run.
                  </p>
                </div>
                <Toggle
                  enabled={tenantReminderSettings.immediateReminderInsideWindowEnabled}
                  onChange={() => setTenantReminderSettings(prev => ({ ...prev, immediateReminderInsideWindowEnabled: !prev.immediateReminderInsideWindowEnabled }))}
                />
              </div>
            </div>
          )}

          {/* Footer action bar */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleResetToPlatformDefaults}
              disabled={isSavingReminder || isLoadingReminder}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-bold rounded-xl shadow-xs transition-colors"
            >
              Reset to Platform Default
            </button>
            <button
              type="button"
              onClick={handleSaveTenantReminders}
              disabled={isSavingReminder || isLoadingReminder}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-xs transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-4xl mx-auto pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
            Notification Settings
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Control how and when you want to be notified about updates.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleReset}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl shadow-sm transition-colors"
          >
            Reset
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        
        {/* Company Visit Reminder Policy (Tenant Admin / Super Admin) */}
        {isTenantAdmin && (
          <div className="bg-white rounded-2xl border border-indigo-200/80 shadow-xs overflow-hidden ring-1 ring-indigo-50">
            <div className="p-6 border-b border-indigo-100/70 bg-gradient-to-r from-indigo-50/50 via-white to-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[20px]">notifications_active</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk']">
                      Company Visit Reminder Orchestration
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 tracking-wide">
                      COMPANY POLICY
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure lead time windows for dashboard alerts and automated email notifications across all visits.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetToPlatformDefaults}
                  disabled={isSavingReminder || isLoadingReminder}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
                  title="Reset to Platform Default snapshot"
                >
                  <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                  <span>Reset to Platform Default</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveTenantReminders}
                  disabled={isSavingReminder || isLoadingReminder}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  {isSavingReminder && <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>}
                  <span>Save Policy</span>
                </button>
              </div>
            </div>

            {reminderMsg && (
              <div className={`mx-6 mt-6 p-4 rounded-xl text-xs font-semibold ${reminderMsg.isError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                {reminderMsg.text}
              </div>
            )}

            {isLoadingReminder ? (
              <div className="p-8 flex justify-center items-center text-slate-400 gap-2 text-xs">
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                <span>Loading reminder settings...</span>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Dashboard Reminder */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div className="max-w-md">
                    <h3 className="text-sm font-bold text-slate-900">Dashboard Reminder Window</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Days before a scheduled visit when it starts appearing on user's dashboard Upcoming Visits widget.
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600">Lead Days:</span>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={tenantReminderSettings.dashboardReminderDaysBefore}
                        onChange={(e) => setTenantReminderSettings(prev => ({ ...prev, dashboardReminderDaysBefore: parseInt(e.target.value) || 0 }))}
                        className="w-18 px-2.5 py-1 text-xs font-bold text-slate-800 border border-slate-300 rounded-lg text-center focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <Toggle
                      enabled={tenantReminderSettings.dashboardReminderEnabled}
                      onChange={() => setTenantReminderSettings(prev => ({ ...prev, dashboardReminderEnabled: !prev.dashboardReminderEnabled }))}
                    />
                  </div>
                </div>

                {/* Email Reminder */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div className="max-w-md">
                    <h3 className="text-sm font-bold text-slate-900">Automated Email Notifications</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Days before a scheduled visit when automated email reminders are dispatched to PIC and participants.
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600">Lead Days:</span>
                      <input
                        type="number"
                        min={0}
                        max={14}
                        value={tenantReminderSettings.emailReminderDaysBefore}
                        onChange={(e) => setTenantReminderSettings(prev => ({ ...prev, emailReminderDaysBefore: parseInt(e.target.value) || 0 }))}
                        className="w-18 px-2.5 py-1 text-xs font-bold text-slate-800 border border-slate-300 rounded-lg text-center focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <Toggle
                      enabled={tenantReminderSettings.emailReminderEnabled}
                      onChange={() => setTenantReminderSettings(prev => ({ ...prev, emailReminderEnabled: !prev.emailReminderEnabled }))}
                    />
                  </div>
                </div>

                {/* Immediate Reminder Inside Window */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="max-w-md">
                    <h3 className="text-sm font-bold text-slate-900">Immediate Reminder Inside Window</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      If a visit is created or rescheduled with a start date inside the reminder window, dispatch immediately on next scheduler run.
                    </p>
                  </div>
                  <Toggle
                    enabled={tenantReminderSettings.immediateReminderInsideWindowEnabled}
                    onChange={() => setTenantReminderSettings(prev => ({ ...prev, immediateReminderInsideWindowEnabled: !prev.immediateReminderInsideWindowEnabled }))}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Tasks Settings */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-blue-600">task</span>
            </div>
            <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk']">Tasks</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Task Assigned</h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Notify me when a new task is assigned to me.</p>
              </div>
              <Toggle enabled={settings.taskAssigned} onChange={() => handleToggle('taskAssigned')} />
            </div>
            <div className="w-full h-px bg-slate-100"></div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Task Due Soon</h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Notify me when a task assigned to me is due in 24 hours.</p>
              </div>
              <Toggle enabled={settings.taskDueSoon} onChange={() => handleToggle('taskDueSoon')} />
            </div>
            <div className="w-full h-px bg-slate-100"></div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Task Overdue</h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Notify me when a task assigned to me becomes overdue.</p>
              </div>
              <Toggle enabled={settings.taskOverdue} onChange={() => handleToggle('taskOverdue')} />
            </div>
          </div>
        </div>

        {/* Visits Settings */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-emerald-600">storefront</span>
            </div>
            <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk']">Visits</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Visit Reminder</h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Notify me 1 hour before a scheduled visit.</p>
              </div>
              <Toggle enabled={settings.visitReminder} onChange={() => handleToggle('visitReminder')} />
            </div>
            <div className="w-full h-px bg-slate-100"></div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Visit Rescheduled</h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Notify me when a visit schedule is changed.</p>
              </div>
              <Toggle enabled={settings.visitRescheduled} onChange={() => handleToggle('visitRescheduled')} />
            </div>
            <div className="w-full h-px bg-slate-100"></div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Visit Cancelled</h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Notify me when a scheduled visit is cancelled.</p>
              </div>
              <Toggle enabled={settings.visitCancelled} onChange={() => handleToggle('visitCancelled')} />
            </div>
          </div>
        </div>

        {/* Follow-ups Settings */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-amber-600">event_repeat</span>
            </div>
            <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk']">Follow-ups</h2>
          </div>
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Follow-up Reminder</h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Notify me when a follow-up action is due today.</p>
              </div>
              <Toggle enabled={settings.followupReminder} onChange={() => handleToggle('followupReminder')} />
            </div>
          </div>
        </div>

        {/* Projects Settings */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-indigo-600">monitoring</span>
            </div>
            <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk']">Projects</h2>
          </div>
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Project Updated</h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Notify me when an project stage is changed.</p>
              </div>
              <Toggle enabled={settings.projectUpdated} onChange={() => handleToggle('projectUpdated')} />
            </div>
          </div>
        </div>

        {/* PIC Settings */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-purple-600">manage_accounts</span>
            </div>
            <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk']">PIC</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Task Reassigned</h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Notify me when a task's PIC is changed to or from me.</p>
              </div>
              <Toggle enabled={settings.taskReassigned} onChange={() => handleToggle('taskReassigned')} />
            </div>
            <div className="w-full h-px bg-slate-100"></div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Visit Reassigned</h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Notify me when a visit's PIC is changed to or from me.</p>
              </div>
              <Toggle enabled={settings.visitReassigned} onChange={() => handleToggle('visitReassigned')} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

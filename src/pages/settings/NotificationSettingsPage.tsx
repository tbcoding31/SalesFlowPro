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

export const NotificationSettingsPage: React.FC = () => {
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

  const handleSave = () => {
    // Placeholder for actual save logic
    console.log('Settings saved:', settings);
  };

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

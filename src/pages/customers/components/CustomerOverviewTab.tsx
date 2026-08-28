import React from 'react';
import { Customer, Visit, Task, Project, Activity, AttentionSignal, ProjectAttentionSummary } from '../../../types';
import { CustomerAttentionTab } from './CustomerAttentionTab';

export interface CustomerOverviewSummaryMetrics {
  totalVisits: number;
  openTasks: number;
  completedTasks: number;
  pendingFollowups: number;
  activeProjects: number;
  pipelineValue: number;
}

export interface CustomerOverviewTabProps {
  customer: Customer;
  customerNextAction: any;
  summaryMetrics: CustomerOverviewSummaryMetrics;
  primaryContact: any;
  activities: Activity[];
  visits: Visit[];
  tasks: Task[];
  projects: Project[];
  customerAttentionSignals: AttentionSignal[];
  projectAttentionSummary: ProjectAttentionSummary | null;
  onViewActivities: () => void;
  onViewProjects: () => void;
  onViewVisits: () => void;
  onViewTasks: () => void;
  onCreateProject: () => void;
  onCreateVisit: () => void;
  onCreateTask: () => void;
  onCreateNote: () => void;
  onChangePic: () => void;
}

export const CustomerOverviewTab: React.FC<CustomerOverviewTabProps> = ({
  customer,
  customerNextAction,
  summaryMetrics,
  primaryContact,
  activities,
  visits,
  tasks,
  projects,
  customerAttentionSignals,
  projectAttentionSummary,
  onViewActivities,
  onViewProjects,
  onViewVisits,
  onViewTasks,
  onCreateProject,
  onCreateVisit,
  onCreateTask,
  onCreateNote,
  onChangePic
}) => {
  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* SECTION 1 — CUSTOMER SUMMARY & SECTION 2 — KEY METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SECTION 1: Customer Summary Card */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-xs space-y-5">
          <div className="flex justify-between items-start">
            <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#4744e5]">corporate_fare</span>
              <span>Customer Summary</span>
            </h2>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
              customer.status === 'ACTIVE' ? 'bg-[#00C875]/10 text-[#008f53]' : 'bg-[#e1dfff] text-[#4744e5]'
            }`}>
              {customer.status}
            </span>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <p className="text-[10px] font-bold text-[#767587] uppercase mb-1">Company Code</p>
              <p className="text-sm font-bold text-[#1a1c1c]">{customer.code}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#767587] uppercase mb-1">Industry</p>
              <p className="text-sm font-semibold text-[#1a1c1c]">{customer.industry || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#767587] uppercase mb-1">Address</p>
              <p className="text-xs text-[#1a1c1c] leading-relaxed">{customer.address || '—'}</p>
            </div>
          </div>
        </div>

        {/* SECTION 2: Key Metrics Cards */}
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] flex flex-col justify-center">
            <span className="text-[10px] font-bold text-[#767587] uppercase mb-2">Total Visits</span>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-extrabold text-[#1a1c1c]">{summaryMetrics.totalVisits}</span>
              <span className="material-symbols-outlined text-[#00C875] text-[18px] mb-1">trending_up</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] flex flex-col justify-center">
            <span className="text-[10px] font-bold text-[#767587] uppercase mb-2">Open Tasks</span>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-extrabold text-[#1a1c1c]">{summaryMetrics.openTasks}</span>
              <span className="text-xs text-[#767587] mb-1.5 font-medium">/ {summaryMetrics.completedTasks} Done</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#E1E1E1] flex flex-col justify-center">
            <span className="text-[10px] font-bold text-[#767587] uppercase mb-2">Active Projects</span>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-extrabold text-[#1a1c1c]">{summaryMetrics.activeProjects}</span>
              <span className="material-symbols-outlined text-[#4744e5] text-[18px] mb-1">folder_open</span>
            </div>
          </div>
          <div className="bg-[#4744e5] p-4 rounded-xl shadow-md flex flex-col justify-center md:col-span-3 lg:col-span-3">
            <span className="text-[10px] font-bold text-[#e1dfff] uppercase mb-1">Total Pipeline Value</span>
            <span className="text-2xl font-extrabold text-white">Rp {summaryMetrics.pipelineValue.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SECTION 3 — CUSTOMER CONTACT */}
        <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2 border-b border-[#E1E1E1] pb-3">
            <span className="material-symbols-outlined text-[18px] text-[#4744e5]">person</span>
            <span>Primary Contact (PIC)</span>
          </h2>
          {primaryContact ? (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-bold text-[#767587] uppercase mb-0.5">Name</p>
                <p className="text-sm font-bold text-[#1a1c1c]">{primaryContact.name}</p>
                <p className="text-[11px] font-medium text-[#4744e5]">{primaryContact.role}</p>
              </div>
              <div className="pt-2 border-t border-[#E1E1E1]/50 space-y-2">
                <div className="flex items-center gap-2 text-xs text-[#1a1c1c]">
                  <span className="material-symbols-outlined text-[14px] text-[#767587]">mail</span>
                  <span>{primaryContact.email || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#1a1c1c]">
                  <span className="material-symbols-outlined text-[14px] text-[#767587]">phone</span>
                  <span>{primaryContact.phone || '—'}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#767587] italic">No primary contact assigned.</p>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* SECTION 3.5 — DATABASE-AUTHORITATIVE NEXT ACTION */}
          <div className="bg-white p-5 rounded-xl border border-indigo-200 shadow-sm space-y-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
            <div className="flex justify-between items-start">
              <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-base">forward</span>
                <span>Next Action (Canonical)</span>
              </h3>
            </div>
            
            {customerNextAction ? (
              <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 flex items-start gap-3">
                <span className="material-symbols-outlined text-indigo-600 mt-0.5">
                  {customerNextAction.type === 'VISIT' ? 'meeting_room' : customerNextAction.type === 'TASK' ? 'task_alt' : 'call'}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 text-[9px] font-extrabold rounded uppercase tracking-wider">
                      {customerNextAction.type}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{customerNextAction.title}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-600 font-medium">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                      {customerNextAction.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">person</span>
                      {customerNextAction.assignedTo}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-400">do_not_disturb_on</span>
                <p className="text-xs text-slate-500 font-medium">No next action scheduled.</p>
              </div>
            )}
          </div>

          {/* SECTION 3.6 — DATABASE-AUTHORITATIVE NEEDS ATTENTION */}
          <CustomerAttentionTab
            customerAttentionSignals={customerAttentionSignals}
            projectAttentionSummary={projectAttentionSummary}
            onAssignPic={onChangePic}
            onReviewOverdue={onViewTasks}
            onViewProjects={onViewProjects}
          />

          {/* SECTION 4 & 5 — RECENT ACTIVITIES & UPCOMING ACTIVITIES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SECTION 4: Recent Activities Timeline */}
            <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E1E1E1] pb-3">
                <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#4744e5]">history</span>
                  <span>Recent Activities Timeline</span>
                </h2>
                <button
                  onClick={onViewActivities}
                  className="text-xs font-bold text-[#4744e5] hover:underline cursor-pointer"
                >
                  View All
                </button>
              </div>

              <div className="space-y-3">
                {activities.slice(0, 4).map((act) => (
                  <div key={act.id} className="p-3 bg-[#f9f9f9] rounded-lg border border-[#E1E1E1] text-xs flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#4744e5]/10 text-[#4744e5] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px]">
                        {act.type === 'VISIT' ? 'route' : act.type === 'CALL' ? 'call' : act.type === 'NOTE' ? 'edit_note' : 'task_alt'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-[#1a1c1c]">{act.subject}</span>
                        <span className="text-[10px] text-[#767587] font-mono">{act.occurredAt}</span>
                      </div>
                      <p className="text-[11px] text-[#767587] mt-0.5">{act.description}</p>
                      <span className="text-[10px] text-[#4744e5] font-semibold mt-1 block">By {act.userName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 5: Upcoming Activities */}
            <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E1E1E1] pb-3">
                <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#4744e5]">event_upcoming</span>
                  <span>Upcoming Schedule & Tasks</span>
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={onCreateVisit}
                    className="text-xs font-bold text-[#4744e5] hover:underline cursor-pointer"
                  >
                    + Visit
                  </button>
                  <button
                    onClick={onCreateTask}
                    className="text-xs font-bold text-[#4744e5] hover:underline cursor-pointer"
                  >
                    + Task
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {visits.filter((v) => v.status === 'PLANNED').map((v) => (
                  <div key={v.id} className="p-3 bg-[#e1dfff]/30 rounded-lg border border-[#c1beff] text-xs flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-[#4744e5] text-white text-[9px] font-bold rounded">VISIT</span>
                        <span className="font-bold text-[#1a1c1c]">{v.title}</span>
                      </div>
                      <span className="text-[11px] text-[#767587] mt-1 block">Date: {v.visitDate} ({v.startTime}) • PIC: {v.picName}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-[#00C875]/10 text-[#008f53] text-[10px] font-bold rounded-full">
                      {v.status}
                    </span>
                  </div>
                ))}

                {tasks.filter((t) => t.status !== 'COMPLETED').map((t) => (
                  <div key={t.id} className="p-3 bg-[#f9f9f9] rounded-lg border border-[#E1E1E1] text-xs flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-bold rounded">TASK</span>
                        <span className="font-bold text-[#1a1c1c]">{t.title}</span>
                      </div>
                      <span className="text-[11px] text-[#767587] mt-1 block">Due: {t.dueDate}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      t.priority === 'HIGH' ? 'bg-[#FF3366]/10 text-[#FF3366]' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {t.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* SECTION 6 — ACTIVE PROJECTS */}
          <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E1E1E1] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#4744e5]">folder_open</span>
                  <span>Active Projects / Pipeline</span>
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onViewProjects}
                  className="text-[11px] font-bold text-[#767587] hover:text-[#4744e5] transition-colors"
                >
                  View All
                </button>
                <button
                  onClick={onCreateProject}
                  className="px-3 py-1.5 bg-[#4744e5] hover:bg-[#3431c4] text-white text-[11px] font-bold rounded-lg transition-colors"
                >
                  + New Project
                </button>
              </div>
            </div>

            {projects.filter(o => o.stage !== 'LOST' && o.stage !== 'WON').length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs text-[#767587]">No active projects.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.filter(o => o.stage !== 'LOST' && o.stage !== 'WON').slice(0, 3).map((opp) => (
                  <div key={opp.id} className="p-4 bg-white rounded-xl border border-[#E1E1E1] hover:border-[#4744e5] transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-[#767587] uppercase tracking-wider">{opp.stage}</span>
                      <span className="px-2 py-0.5 bg-[#e1dfff] text-[#4744e5] text-[10px] font-bold rounded-full">
                        {opp.probability}%
                      </span>
                    </div>
                    <h3 className="font-bold text-[#1a1c1c] mb-1 group-hover:text-[#4744e5] transition-colors line-clamp-1">{opp.title}</h3>
                    <p className="text-sm font-extrabold text-[#00C875]">
                      Rp {opp.estimatedValue.toLocaleString('id-ID')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

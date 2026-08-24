import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { Customer, Visit, Task, Project, Activity } from '../../types';

export const SalesDashboard: React.FC = () => {
  const { currentUser, currentTenant } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';

  const [customers] = useState<Customer[]>(DataService.getCustomers(tenantId));
  const [visits, setVisits] = useState<Visit[]>(DataService.getVisits(tenantId));
  const [tasks, setTasks] = useState<Task[]>(DataService.getTasks(tenantId));
  const [projects] = useState<Project[]>(DataService.getProjects(tenantId));
  const [activities] = useState<Activity[]>(DataService.getActivities(tenantId));

  const { hasPermission } = useAuth();
  const isSalesRep = !hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS');

  // Metrics
  const myCustomers = isSalesRep
    ? customers.filter((c) => c.assignedPicId === currentUser?.id)
    : customers;

  const plannedVisitsToday = visits.filter(
    (v) => (v.visitDate === '2026-08-12' || v.visitDate === new Date().toISOString().split('T')[0])
  );

  const pendingTasks = tasks.filter((t) => t.status !== 'COMPLETED');

  const totalPipelineValue = projects
    .filter((o) => o.stage !== 'LOST')
    .reduce((acc, o) => acc + o.estimatedValue, 0);

  const toggleTaskComplete = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const updated: Task = {
        ...task,
        status: task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED',
        completedAt: new Date().toISOString().split('T')[0],
      };
      DataService.saveTask(updated);
      setTasks(DataService.getTasks(tenantId));
    }
  };

  const updateVisitStatus = (visitId: string, status: Visit['status']) => {
    const visit = visits.find((v) => v.id === visitId);
    if (visit) {
      const updated: Visit = { ...visit, status };
      DataService.saveVisit(updated);
      setVisits(DataService.getVisits(tenantId));
    }
  };

  return (
    <div className="space-y-8 font-['Inter',sans-serif]">
      {/* Greeting Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
            {isSalesRep ? `Welcome back, ${currentUser?.name || 'Sales Officer'} 👋` : 'Team Dashboard'}
          </h1>
          <p className="text-xs text-[#464555] mt-1">
            {isSalesRep
              ? "Here is your daily sales schedule, high-priority tasks, and deal pipeline."
              : `Overview of ${currentTenant?.name || 'Organization'} sales activities, field visits, and team performance.`}
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            to="/visits"
            className="px-3.5 py-2 bg-[#4744e5] hover:bg-[#2c24ce] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 font-['Hanken_Grotesk']"
          >
            <span className="material-symbols-outlined text-[18px]">route</span>
            <span>Schedule Visit</span>
          </Link>
          <Link
            to="/projects"
            className="px-3.5 py-2 bg-white border border-[#E1E1E1] hover:border-[#4744e5] text-[#1a1c1c] text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 font-['Hanken_Grotesk']"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>New Project</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#464555] font-['Hanken_Grotesk'] uppercase tracking-wider">
              Active Accounts
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#4744e5]/10 text-[#4744e5] flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">groups</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
              {myCustomers.length}
            </span>
            <span className="text-xs text-[#00C875] font-semibold flex items-center">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              +12% MoM
            </span>
          </div>
          <div className="text-[11px] text-[#767587] mt-1">
            {myCustomers.filter((c) => c.type === 'ENTERPRISE').length} Enterprise Tier
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#464555] font-['Hanken_Grotesk'] uppercase tracking-wider">
              Today's Field Visits
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#6161ff]/10 text-[#6161ff] flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">route</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
              {plannedVisitsToday.length}
            </span>
            <span className="text-xs text-[#4744e5] font-bold">
              {plannedVisitsToday.filter((v) => v.status === 'COMPLETED').length} Done
            </span>
          </div>
          <div className="text-[11px] text-[#767587] mt-1">
            {plannedVisitsToday.filter((v) => v.status === 'IN_PROGRESS').length} Currently in progress
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#464555] font-['Hanken_Grotesk'] uppercase tracking-wider">
              Pending Sales Tasks
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#9a4600]/10 text-[#9a4600] flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">task_alt</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
              {pendingTasks.length}
            </span>
            <span className="text-xs text-[#ba1a1a] font-bold">
              {pendingTasks.filter((t) => t.priority === 'URGENT').length} Urgent
            </span>
          </div>
          <div className="text-[11px] text-[#767587] mt-1">
            Overdue tasks require immediate follow-up
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#464555] font-['Hanken_Grotesk'] uppercase tracking-wider">
              Active Pipeline Value
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#00C875]/10 text-[#008f53] flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">monetization_on</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
              Rp {(totalPipelineValue / 1000000000).toFixed(1)}B IDR
            </span>
            <span className="text-xs text-[#00C875] font-semibold">
              {projects.filter((o) => o.stage === 'WON').length} Deals Won
            </span>
          </div>
          <div className="text-[11px] text-[#767587] mt-1">
            Weighted close probability: 74%
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Schedule & Urgent Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Visits */}
        <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
            <div>
              <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Today's Planned Sales Visits
              </h2>
              <p className="text-xs text-[#767587]">Field engagements scheduled for today</p>
            </div>

            <Link to="/visits" className="text-xs text-[#4744e5] font-bold hover:underline">
              View All Visits
            </Link>
          </div>

          <div className="space-y-3">
            {plannedVisitsToday.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#767587]">No sales visits scheduled for today.</div>
            ) : (
              plannedVisitsToday.map((v) => (
                <div key={v.id} className="p-4 bg-[#f9f9f9] rounded-lg border border-[#E1E1E1] space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-xs text-[#1a1c1c] font-['Hanken_Grotesk'] block">
                        {v.title}
                      </span>
                      <span className="text-[11px] text-[#4744e5] font-bold block mt-0.5">
                        {v.customerName} ({v.customerCode})
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        v.status === 'COMPLETED'
                          ? 'bg-[#00C875]/10 text-[#008f53]'
                          : v.status === 'IN_PROGRESS'
                          ? 'bg-[#6161ff]/10 text-[#6161ff]'
                          : 'bg-[#f3f3f3] text-[#464555]'
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#767587]">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      {v.startTime} - {v.endTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">location_on</span>
                      {v.location}
                    </span>
                  </div>

                  {v.notes && (
                    <p className="text-[11px] text-[#464555] bg-white p-2 rounded border border-[#E1E1E1]">
                      {v.notes}
                    </p>
                  )}

                  {v.status !== 'COMPLETED' && (
                    <div className="flex justify-end gap-2 pt-1">
                      {v.status === 'PLANNED' && (
                        <button
                          onClick={() => updateVisitStatus(v.id, 'IN_PROGRESS')}
                          className="px-2.5 py-1 bg-[#4744e5] text-white text-[11px] font-bold rounded hover:bg-[#2c24ce]"
                        >
                          Start Visit
                        </button>
                      )}
                      <button
                        onClick={() => updateVisitStatus(v.id, 'COMPLETED')}
                        className="px-2.5 py-1 bg-[#00C875] text-white text-[11px] font-bold rounded hover:bg-[#00a35f]"
                      >
                        Complete Visit
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Actionable Sales Tasks */}
        <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
            <div>
              <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Actionable Tasks & Follow-ups
              </h2>
              <p className="text-xs text-[#767587]">Checklist for current sales deliverables</p>
            </div>

            <Link to="/tasks" className="text-xs text-[#4744e5] font-bold hover:underline">
              View All Tasks
            </Link>
          </div>

          <div className="space-y-2.5">
            {pendingTasks.map((t) => (
              <div
                key={t.id}
                className="p-3 bg-[#f9f9f9] rounded-lg border border-[#E1E1E1] flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={t.status === 'COMPLETED'}
                    onChange={() => toggleTaskComplete(t.id)}
                    className="mt-0.5 w-4 h-4 rounded text-[#4744e5] cursor-pointer"
                  />
                  <div>
                    <span
                      className={`text-xs font-bold block ${
                        t.status === 'COMPLETED' ? 'line-through text-[#767587]' : 'text-[#1a1c1c]'
                      }`}
                    >
                      {t.title}
                    </span>
                    <span className="text-[11px] text-[#767587] block mt-0.5">
                      {t.customerName} • Due: {t.dueDate}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${
                    t.priority === 'URGENT'
                      ? 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
                      : t.priority === 'HIGH'
                      ? 'bg-[#9a4600]/10 text-[#9a4600]'
                      : 'bg-[#f3f3f3] text-[#464555]'
                  }`}
                >
                  {t.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Timeline Feed */}
      <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
          <div>
            <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
              Live Sales Activities Stream
            </h2>
            <p className="text-xs text-[#767587]">Audit trail of real-time sales actions</p>
          </div>

          <Link to="/activities" className="text-xs text-[#4744e5] font-bold hover:underline">
            View Full Timeline
          </Link>
        </div>

        <div className="space-y-3">
          {activities.slice(0, 5).map((a) => (
            <div key={a.id} className="flex items-start gap-3 p-3 bg-[#f9f9f9] rounded-lg border border-[#E1E1E1]">
              <img
                src={a.userAvatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'}
                alt={a.userName}
                className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#E1E1E1]"
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-xs text-[#1a1c1c]">{a.userName}</span>
                  <span className="text-[10px] text-[#767587] font-mono">{a.occurredAt}</span>
                </div>
                <p className="text-xs font-semibold text-[#4744e5] mt-0.5">{a.subject}</p>
                <p className="text-[11px] text-[#464555] mt-0.5">{a.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { Customer, Visit, Task, Project, Activity } from '../../types';
import { crmApi } from '../../services/crmApi';

export const SalesDashboard: React.FC = () => {
  const { currentUser, currentTenant } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';

  const [agenda, setAgenda] = useState<any | null>(null);
  const [attention, setAttention] = useState<any | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [agendaData, attentionData, cList, pList, aList] = await Promise.all([
        crmApi.fetchSalesAgenda(),
        crmApi.fetchSalesAttention(),
        crmApi.fetchCollection<Customer>('customers', tenantId),
        crmApi.fetchCollection<Project>('projects', tenantId),
        crmApi.fetchCollection<Activity>('activities', tenantId)
      ]);
      setAgenda(agendaData);
      setAttention(attentionData);
      setCustomers(cList);
      setProjects(pList);
      setActivities(aList);
    } catch (err) {
      console.error('Failed to load dashboard data from DB:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, [tenantId]);

  const { hasPermission } = useAuth();
  const isSalesRep = !hasPermission('VIEW_TEAM_TASKS') && !hasPermission('VIEW_ALL_TASKS');

  // Authoritative Agenda Lists
  const overdueItems = agenda?.overdue || [];
  const todayItems = agenda?.today || [];
  const upcomingItems = agenda?.upcoming || [];
  const completedTodayItems = agenda?.completedToday || [];
  const stalledProjects = agenda?.stalledProjects || [];

  // Authoritative Attention Data
  const attentionSummary = attention?.summary || {
    customersNeedingAttention: 0,
    projectsNeedingAttention: 0,
    criticalSignals: 0,
    warningSignals: 0,
    overdueActions: 0
  };
  const attentionProjects = attention?.projects || [];
  const attentionCustomers = attention?.customers || [];

  const myCustomers = isSalesRep
    ? customers.filter((c) => (c.picId || c.assignedPicId) === currentUser?.id)
    : customers;

  const totalPipelineValue = projects
    .filter((o) => (o as any).stageId !== 'LOST' && o.stage !== 'LOST')
    .reduce((acc, o) => acc + (Number((o as any).value) || Number(o.estimatedValue) || 0), 0);

  const toggleTaskComplete = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'TODO' : 'COMPLETED';
    await crmApi.updateRecord('tasks', taskId, {
      statusId: nextStatus,
      status: nextStatus,
      completedAt: nextStatus === 'COMPLETED' ? new Date().toISOString() : null
    });
    loadData();
  };

  const updateVisitStatus = async (visitId: string, status: Visit['status']) => {
    await crmApi.updateRecord('visits', visitId, {
      statusId: status,
      status
    });
    loadData();
  };

  const completeFollowUp = async (fuId: string) => {
    await crmApi.updateRecord('follow_ups', fuId, {
      status: 'COMPLETED',
      statusId: 'COMPLETED',
      completedAt: new Date().toISOString()
    });
    loadData();
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
        {/* Card 1: Today Actions */}
        <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#464555] font-['Hanken_Grotesk'] uppercase tracking-wider">
              Due Today
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#4744e5]/10 text-[#4744e5] flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">today</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
              {todayItems.length}
            </span>
            <span className="text-xs text-[#4744e5] font-bold">
              {completedTodayItems.length} Done
            </span>
          </div>
          <div className="text-[11px] text-[#767587] mt-1">
            Visits, Follow-ups, and Tasks scheduled today
          </div>
        </div>

        {/* Card 2: Overdue Attention */}
        <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#464555] font-['Hanken_Grotesk'] uppercase tracking-wider">
              Overdue Actions
            </span>
            <div className={`w-8 h-8 rounded-lg ${overdueItems.length > 0 ? 'bg-[#ba1a1a]/10 text-[#ba1a1a]' : 'bg-[#00C875]/10 text-[#008f53]'} flex items-center justify-center`}>
              <span className="material-symbols-outlined text-lg">warning</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className={`text-2xl font-extrabold font-['Hanken_Grotesk'] ${overdueItems.length > 0 ? 'text-[#ba1a1a]' : 'text-[#1a1c1c]'}`}>
              {overdueItems.length}
            </span>
            <span className={`text-xs font-bold ${overdueItems.length > 0 ? 'text-[#ba1a1a]' : 'text-[#008f53]'}`}>
              {overdueItems.length > 0 ? 'Requires Action' : 'All Clear'}
            </span>
          </div>
          <div className="text-[11px] text-[#767587] mt-1">
            Past due deliverables needing resolution
          </div>
        </div>

        {/* Card 3: Upcoming 7 Days */}
        <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#464555] font-['Hanken_Grotesk'] uppercase tracking-wider">
              Upcoming (7 Days)
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#6161ff]/10 text-[#6161ff] flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">upcoming</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
              {upcomingItems.length}
            </span>
            <span className="text-xs text-[#767587] font-semibold">
              Planned Work
            </span>
          </div>
          <div className="text-[11px] text-[#767587] mt-1">
            Future pipeline engagements
          </div>
        </div>

        {/* Card 4: Stalled Projects */}
        <div className="bg-white p-5 rounded-xl border border-[#E1E1E1] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#464555] font-['Hanken_Grotesk'] uppercase tracking-wider">
              Missing Next Action
            </span>
            <div className={`w-8 h-8 rounded-lg ${stalledProjects.length > 0 ? 'bg-[#9a4600]/10 text-[#9a4600]' : 'bg-[#00C875]/10 text-[#008f53]'} flex items-center justify-center`}>
              <span className="material-symbols-outlined text-lg">pending_actions</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
              {stalledProjects.length}
            </span>
            <span className="text-xs text-[#9a4600] font-bold">
              Open Projects
            </span>
          </div>
          <div className="text-[11px] text-[#767587] mt-1">
            Active projects with zero future schedule
          </div>
        </div>
      </div>

      {/* Main Grid: Overdue & Today Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Queue */}
        <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
            <div>
              <h2 className="text-base font-bold text-[#ba1a1a] font-['Hanken_Grotesk'] flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">error</span>
                <span>Overdue Action Queue</span>
              </h2>
              <p className="text-xs text-[#767587]">Work that passed its deadline without completion</p>
            </div>
            <span className="px-2.5 py-0.5 bg-[#ba1a1a]/10 text-[#ba1a1a] text-xs font-extrabold rounded-full">
              {overdueItems.length}
            </span>
          </div>

          <div className="space-y-3">
            {overdueItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#767587] bg-[#f9f9f9] rounded-lg border border-[#E1E1E1]">
                🎉 No overdue actions! All historical deliverables are up to date.
              </div>
            ) : (
              overdueItems.map((item) => (
                <div key={item.id} className="p-3.5 bg-rose-50/50 rounded-lg border border-rose-200 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${
                          item.type === 'VISIT' ? 'bg-[#4744e5] text-white' : item.type === 'FOLLOW_UP' ? 'bg-[#0284c7] text-white' : 'bg-[#d97706] text-white'
                        }`}>
                          {item.type}
                        </span>
                        <span className="font-bold text-xs text-[#1a1c1c]">{item.title}</span>
                      </div>
                      <span className="text-[11px] text-[#4744e5] font-bold block mt-1">
                        {item.customerName} {item.projectName ? `• Project: ${item.projectName}` : ''}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-rose-700 bg-white px-2 py-0.5 rounded border border-rose-300 font-mono">
                      Due: {item.actionAt}
                    </span>
                  </div>

                  <div className="flex justify-end gap-2 pt-1 border-t border-rose-100">
                    {item.type === 'VISIT' && (
                      <button
                        onClick={() => updateVisitStatus(item.sourceId, 'COMPLETED')}
                        className="px-2.5 py-1 bg-[#00C875] text-white text-[11px] font-bold rounded hover:bg-[#00a35f]"
                      >
                        Complete Visit
                      </button>
                    )}
                    {item.type === 'FOLLOW_UP' && (
                      <button
                        onClick={() => completeFollowUp(item.sourceId)}
                        className="px-2.5 py-1 bg-[#0284c7] text-white text-[11px] font-bold rounded hover:bg-[#0369a1]"
                      >
                        Resolve Follow-up
                      </button>
                    )}
                    {item.type === 'TASK' && (
                      <button
                        onClick={() => toggleTaskComplete(item.sourceId, item.status)}
                        className="px-2.5 py-1 bg-[#4744e5] text-white text-[11px] font-bold rounded hover:bg-[#2c24ce]"
                      >
                        Complete Task
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Today's Unified Agenda */}
        <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
            <div>
              <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#4744e5]">today</span>
                <span>Today's Unified Agenda</span>
              </h2>
              <p className="text-xs text-[#767587]">Action items scheduled for your business day</p>
            </div>
            <span className="px-2.5 py-0.5 bg-[#4744e5]/10 text-[#4744e5] text-xs font-extrabold rounded-full">
              {todayItems.length}
            </span>
          </div>

          <div className="space-y-3">
            {todayItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#767587] bg-[#f9f9f9] rounded-lg border border-[#E1E1E1]">
                You're all caught up for today! No pending visits, calls, or tasks.
              </div>
            ) : (
              todayItems.map((item) => (
                <div key={item.id} className="p-3.5 bg-[#f9f9f9] rounded-lg border border-[#E1E1E1] space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${
                          item.type === 'VISIT' ? 'bg-[#4744e5] text-white' : item.type === 'FOLLOW_UP' ? 'bg-[#0284c7] text-white' : 'bg-[#d97706] text-white'
                        }`}>
                          {item.type}
                        </span>
                        <span className="font-bold text-xs text-[#1a1c1c]">{item.title}</span>
                      </div>
                      <span className="text-[11px] text-[#4744e5] font-bold block mt-1">
                        {item.customerName} {item.projectName ? `• Project: ${item.projectName}` : ''}
                      </span>
                    </div>
                    {item.startTime ? (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-mono">
                        {item.startTime} - {item.endTime}
                      </span>
                    ) : item.priority ? (
                      <span className="text-[9px] font-extrabold uppercase bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                        {item.priority}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex justify-end gap-2 pt-1 border-t border-[#E1E1E1]">
                    {item.type === 'VISIT' && (
                      <button
                        onClick={() => updateVisitStatus(item.sourceId, 'COMPLETED')}
                        className="px-2.5 py-1 bg-[#00C875] text-white text-[11px] font-bold rounded hover:bg-[#00a35f]"
                      >
                        Complete Visit
                      </button>
                    )}
                    {item.type === 'FOLLOW_UP' && (
                      <button
                        onClick={() => completeFollowUp(item.sourceId)}
                        className="px-2.5 py-1 bg-[#0284c7] text-white text-[11px] font-bold rounded hover:bg-[#0369a1]"
                      >
                        Resolve Follow-up
                      </button>
                    )}
                    {item.type === 'TASK' && (
                      <button
                        onClick={() => toggleTaskComplete(item.sourceId, item.status)}
                        className="px-2.5 py-1 bg-[#4744e5] text-white text-[11px] font-bold rounded hover:bg-[#2c24ce]"
                      >
                        Complete Task
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* R43: Database-Authoritative Needs Attention Section */}
      {(attentionProjects.length > 0 || attentionCustomers.length > 0) && (
        <div className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-amber-200/60 pb-3">
            <div>
              <h2 className="text-base font-bold text-amber-900 font-['Hanken_Grotesk'] flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-amber-600">warning</span>
                <span>Needs Attention</span>
              </h2>
              <p className="text-xs text-[#767587]">Deterministic issues requiring sales rep or management intervention</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-xs font-bold rounded">
                {attentionSummary.criticalSignals} Critical
              </span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded">
                {attentionSummary.warningSignals} Warnings
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Projects Needing Attention */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Projects Needing Attention ({attentionProjects.length})
              </h3>
              {attentionProjects.slice(0, 5).map((p: any) => (
                <div key={p.id} className="p-3 bg-amber-50/50 rounded-lg border border-amber-200 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link to={`/projects/${p.id}`} className="font-bold text-xs text-indigo-700 hover:underline">
                        {p.title}
                      </Link>
                      <span className="text-[11px] text-slate-500 block">{p.customerName || 'Customer Account'}</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                      {p.stage}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {p.signals.map((sig: any, sIdx: number) => (
                      <div key={sIdx} className="text-[11px] flex items-start gap-1.5 text-slate-800">
                        <span className={`material-symbols-outlined text-[14px] mt-0.5 ${sig.severity === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'}`}>
                          {sig.severity === 'CRITICAL' ? 'error' : 'warning'}
                        </span>
                        <span>{sig.reason}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5 pt-1 border-t border-amber-200/50">
                    <Link
                      to={`/projects/${p.id}`}
                      className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded"
                    >
                      Remediate →
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Customers Needing Attention */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Customers Needing Attention ({attentionCustomers.length})
              </h3>
              {attentionCustomers.slice(0, 5).map((c: any) => (
                <div key={c.id} className="p-3 bg-amber-50/50 rounded-lg border border-amber-200 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link to={`/customers/${c.id}`} className="font-bold text-xs text-indigo-700 hover:underline">
                        {c.name}
                      </Link>
                      <span className="text-[11px] text-slate-500 block">Code: {c.code || '-'}</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {c.status}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {c.signals.map((sig: any, sIdx: number) => (
                      <div key={sIdx} className="text-[11px] flex items-start gap-1.5 text-slate-800">
                        <span className={`material-symbols-outlined text-[14px] mt-0.5 ${sig.severity === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'}`}>
                          {sig.severity === 'CRITICAL' ? 'error' : 'warning'}
                        </span>
                        <span>{sig.reason}</span>
                      </div>
                    ))}
                    {c.projectAttentionSummary && c.projectAttentionSummary.projectsNeedingAttention > 0 && (
                      <div className="text-[11px] font-medium text-amber-900 bg-amber-100/60 px-2 py-0.5 rounded">
                        📁 {c.projectAttentionSummary.projectsNeedingAttention} child project(s) require attention
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 pt-1 border-t border-amber-200/50">
                    <Link
                      to={`/customers/${c.id}`}
                      className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded"
                    >
                      Remediate →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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

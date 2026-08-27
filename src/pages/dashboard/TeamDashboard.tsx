import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ControlTowerResponse, RepWorkloadSummary } from '../../types';
import { crmApi } from '../../services/crmApi';

export const TeamDashboard: React.FC = () => {
  const { currentTenant, currentUser } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';
  const navigate = useNavigate();

  const [controlTower, setControlTower] = useState<ControlTowerResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  
  // Sort state
  const [sortField, setSortField] = useState<'name' | 'openProjects' | 'openTasks' | 'overdueActions' | 'attentionSignals' | 'completedToday'>('overdueActions');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await crmApi.fetchControlTower(dateFilter || undefined, selectedTeamId || undefined);
      if (res && res.summary) {
        setControlTower(res);
      }
    } catch (err) {
      console.error('Failed to load Control Tower data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, dateFilter, selectedTeamId]);

  const handleSort = (field: 'name' | 'openProjects' | 'openTasks' | 'overdueActions' | 'attentionSignals' | 'completedToday') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedReps = useMemo(() => {
    const reps = controlTower?.reps ? [...controlTower.reps] : [];
    return reps.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });
  }, [controlTower, sortField, sortDir]);

  const summary = controlTower?.summary || {
    activeSalesReps: 0,
    openProjects: 0,
    projectsNeedingAttention: 0,
    overdueActions: 0,
    dueToday: 0,
    upcomingWork: 0,
    blockedCadences: 0,
    projectsMissingNextAction: 0,
    expectedCloseOverdue: 0,
    completedToday: 0,
    criticalSignals: 0,
    warningSignals: 0
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return 'unfold_more';
    return sortDir === 'asc' ? 'expand_less' : 'expand_more';
  };


  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-10">
      
      {/* Header & Date Range */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
              Operational Control Tower
            </h1>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 uppercase tracking-wider font-mono">
              {controlTower?.scope || 'TEAM'} Scope
            </span>
          </div>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            Database-authoritative operational workload, overdue items, and attention signals across representatives.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            disabled={isLoading}
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-xs font-bold flex items-center gap-1 shadow-sm"
            title="Refresh Control Tower from Database"
          >
            <span className={`material-symbols-outlined text-[18px] ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {/* Active Sales Reps */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Active Reps</span>
            <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] text-indigo-600">group</span>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{summary.activeSalesReps}</div>
        </div>

        {/* Open Projects */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Open Deals</span>
            <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] text-blue-600">folder_open</span>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{summary.openProjects}</div>
        </div>

        {/* Overdue Actions */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-rose-500"></div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wider">Overdue Work</span>
            <div className="w-7 h-7 rounded-full bg-rose-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] text-rose-600">warning</span>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-700 font-['Hanken_Grotesk']">{summary.overdueActions}</div>
        </div>

        {/* Projects Needing Attention */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider">Need Attention</span>
            <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] text-amber-600">priority_high</span>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-700 font-['Hanken_Grotesk']">{summary.projectsNeedingAttention}</div>
        </div>

        {/* Due Today */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Due Today</span>
            <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">today</span>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{summary.dueToday}</div>
        </div>

        {/* Completed Today */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Completed Today</span>
            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] text-slate-600">check_circle</span>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{summary.completedToday}</div>
        </div>
      </div>

      {/* Projects Needing Attention Banner */}
      {controlTower?.projectsNeedingAttention && controlTower.projectsNeedingAttention.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-amber-600">notification_important</span>
              Projects Requiring Manager Intervention ({controlTower.projectsNeedingAttention.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {controlTower.projectsNeedingAttention.slice(0, 6).map((proj: any) => (
              <div key={proj.id} className="p-3.5 bg-white rounded-xl border border-amber-200/80 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <Link to={`/projects/${proj.id}`} className="font-bold text-xs text-indigo-700 hover:underline">
                      {proj.title}
                    </Link>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                      {proj.stage}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {proj.customerName} • PIC: <span className="font-medium text-slate-700">{proj.picName || 'Unassigned'}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {proj.signals.map((sig: any, sIdx: number) => (
                      <div key={sIdx} className="text-[11px] flex items-start gap-1 text-slate-800">
                        <span className={`material-symbols-outlined text-[13px] mt-0.5 ${sig.severity === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'}`}>
                          {sig.severity === 'CRITICAL' ? 'error' : 'warning'}
                        </span>
                        <span>{sig.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                  <Link
                    to={`/projects/${proj.id}`}
                    className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded"
                  >
                    Open Project →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Representative Workload Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Representative Workload Distribution ({sortedReps.length})
          </h2>
          <span className="text-[11px] font-medium text-slate-400">
            Database-authoritative transparent counts
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th 
                  className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Sales Representative
                    <span className="material-symbols-outlined text-[14px]">{getSortIcon('name')}</span>
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('openProjects')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Open Deals
                    <span className="material-symbols-outlined text-[14px]">{getSortIcon('openProjects')}</span>
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('openTasks')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Open Tasks
                    <span className="material-symbols-outlined text-[14px]">{getSortIcon('openTasks')}</span>
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('overdueActions')}
                >
                  <div className="flex items-center justify-center gap-1 text-rose-600">
                    Overdue
                    <span className="material-symbols-outlined text-[14px]">{getSortIcon('overdueActions')}</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">
                  Today (Visits/Tasks)
                </th>
                <th className="px-4 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">
                  Pending Follow-ups
                </th>
                <th 
                  className="px-4 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('attentionSignals')}
                >
                  <div className="flex items-center justify-center gap-1 text-amber-600">
                    Attention
                    <span className="material-symbols-outlined text-[14px]">{getSortIcon('attentionSignals')}</span>
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('completedToday')}
                >
                  <div className="flex items-center justify-center gap-1 text-emerald-600">
                    Completed Today
                    <span className="material-symbols-outlined text-[14px]">{getSortIcon('completedToday')}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedReps.map((rep) => (
                <tr key={rep.userId} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {rep.avatarUrl ? (
                        <img src={rep.avatarUrl} alt={rep.name} className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-bold border border-indigo-100 shrink-0">
                          {rep.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-slate-900">{rep.name}</span>
                          {rep.status !== 'ACTIVE' && (
                            <span className="px-1 py-0.2 bg-rose-100 text-rose-700 text-[9px] font-bold rounded">
                              {rep.status}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-medium">{rep.email} • <span className="text-slate-400">{rep.teamName}</span></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                      {rep.openProjects}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                      {rep.openTasks}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {rep.overdueActions > 0 ? (
                      <div className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold shadow-xs">
                        {rep.overdueActions}
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs font-bold">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="text-xs font-bold text-slate-800">
                      {rep.todayVisits} visits / {rep.todayTasks} tasks
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="text-xs font-bold text-slate-800">{rep.pendingFollowups}</div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {rep.attentionSignals > 0 ? (
                      <div className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                        {rep.attentionSignals}
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs font-bold">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="text-xs font-bold text-emerald-700">
                      {rep.completedToday > 0 ? `+${rep.completedToday}` : '-'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

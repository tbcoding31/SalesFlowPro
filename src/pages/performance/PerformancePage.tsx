import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/crmApi';

export const PerformancePage: React.FC = () => {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState('THIS_MONTH');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [employeeFilter, setEmployeeFilter] = useState('ALL');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await crmApi.fetchPerformanceReport(tenantId);
      if (data) {
        setReportData(data);
      } else {
        setError('Failed to load team performance report.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to database');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const kpiData = reportData?.kpiData || {
    visits: 0,
    completedVisits: 0,
    tasksCompleted: 0,
    overdueTasks: 0,
    wonProjects: 0,
    salesValue: 0,
    conversionRate: 0
  };

  const oppConversionData = reportData?.oppConversionData || [];
  const rankingData: any[] = reportData?.rankingData || [];

  // Dynamic employee filter
  const uniqueEmployees = useMemo(() => {
    return rankingData.map(r => r.name).filter(Boolean);
  }, [rankingData]);

  const filteredRankingData = useMemo(() => {
    if (employeeFilter === 'ALL') return rankingData;
    return rankingData.filter(r => r.name === employeeFilter);
  }, [rankingData, employeeFilter]);

  const repTaskData = useMemo(() => {
    return rankingData.slice(0, 8).map(r => ({
      name: r.name,
      completed: r.tasks,
      won: r.won
    }));
  }, [rankingData]);

  const repVisitData = useMemo(() => {
    return rankingData.slice(0, 8).map(r => ({
      name: r.name,
      visits: r.visits,
      projects: r.projects
    }));
  }, [rankingData]);

  const totalOpps = useMemo(() => {
    return oppConversionData.reduce((acc: number, curr: any) => acc + (curr.value || 0), 0);
  }, [oppConversionData]);

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-10">
      
      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
            Team Performance
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Authoritative metrics, commercial conversion rates, and team leaderboard.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={loadData}
            className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Refresh
          </button>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          >
            <option value="THIS_MONTH">This Month</option>
            <option value="LAST_MONTH">Last Month</option>
            <option value="Q3_2026">Q3 2026</option>
            <option value="YTD">Year to Date</option>
          </select>

          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          >
            <option value="ALL">All Employees</option>
            {uniqueEmployees.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
          Loading team performance metrics from database...
        </div>
      ) : error ? (
        <div className="bg-white p-12 rounded-2xl border border-rose-200 text-center text-xs text-rose-600">
          {error}
          <div className="mt-3">
            <button onClick={loadData} className="px-3 py-1 bg-rose-50 text-rose-700 rounded font-bold">Retry</button>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards (7 Metrics) */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {/* Visits */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Visits</span>
                <span className="material-symbols-outlined text-[18px] text-blue-500">location_on</span>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.visits}</div>
            </div>

            {/* Completed Visits */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed Visits</span>
                <span className="material-symbols-outlined text-[18px] text-emerald-500">check_circle</span>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.completedVisits}</div>
            </div>

            {/* Tasks Completed */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tasks Completed</span>
                <span className="material-symbols-outlined text-[18px] text-indigo-500">task_alt</span>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.tasksCompleted}</div>
            </div>

            {/* Overdue Tasks */}
            <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Overdue Tasks</span>
                <span className="material-symbols-outlined text-[18px] text-rose-500">error</span>
              </div>
              <div className="text-2xl font-extrabold text-rose-700 font-['Hanken_Grotesk']">{kpiData.overdueTasks}</div>
            </div>

            {/* Won Projects */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Won Deals</span>
                <span className="material-symbols-outlined text-[18px] text-amber-500">emoji_events</span>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.wonProjects}</div>
            </div>

            {/* Sales Value */}
            <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between col-span-2 md:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Sales Value</span>
                <span className="material-symbols-outlined text-[18px] text-emerald-600">payments</span>
              </div>
              <div className="text-2xl font-extrabold text-emerald-700 font-['Hanken_Grotesk']">
                ${(kpiData.salesValue >= 1000000 ? (kpiData.salesValue / 1000000).toFixed(2) + 'M' : (kpiData.salesValue / 1000).toFixed(0) + 'k')}
              </div>
            </div>

            {/* Conversion Rate */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-2 md:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Win Rate</span>
                <span className="material-symbols-outlined text-[18px] text-purple-500">trending_up</span>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.conversionRate}%</div>
            </div>
          </div>

          {/* Analytics Charts 2x2 Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Rep Visit Activity */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Visits & Projects by Rep</h2>
              <div className="h-64">
                {repVisitData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={repVisitData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <Tooltip 
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                      <Bar dataKey="visits" name="Visits" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar dataKey="projects" name="Projects" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">No representative activity</div>
                )}
              </div>
            </div>

            {/* Task & Deal Completion */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Tasks & Won Deals by Rep</h2>
              <div className="h-64">
                {repTaskData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={repTaskData} layout="vertical" margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                      <Tooltip 
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                      <Bar dataKey="completed" name="Tasks Done" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} />
                      <Bar dataKey="won" name="Won Deals" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">No task completion data</div>
                )}
              </div>
            </div>

            {/* Project Outcome Conversion */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Commercial Outcome Conversion</h2>
              <div className="h-64 flex items-center justify-center relative">
                {oppConversionData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={oppConversionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {oppConversionData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] leading-none">{totalOpps}</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Total Deals</span>
                    </div>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-3">
                      {oppConversionData.map((item: any) => (
                        <div key={item.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                          <div className="text-xs font-medium text-slate-600">{item.name}</div>
                          <div className="text-xs font-bold text-slate-900 ml-2">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">No deal outcome data</div>
                )}
              </div>
            </div>

            {/* Conversion Summary */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-2">Deal Win Rate Efficiency</h2>
              <p className="text-xs text-slate-500 mb-6 text-center">Percentage of closed deals resulting in commercial win</p>
              <div className="text-5xl font-black text-emerald-600 font-['Hanken_Grotesk']">{kpiData.conversionRate}%</div>
              <div className="mt-4 flex items-center gap-4 text-xs font-bold text-slate-600">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>{kpiData.wonProjects} Won</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-700"></span>${(kpiData.salesValue >= 1000000 ? (kpiData.salesValue / 1000000).toFixed(2) + 'M' : (kpiData.salesValue / 1000).toFixed(0) + 'k')} Booked</span>
              </div>
            </div>

          </div>

          {/* Team Ranking Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-extrabold text-slate-900 font-['Hanken_Grotesk']">Leaderboard & Ranking</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Top contributors ranked by booked revenue and commercial wins</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center w-20">Rank</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Visits</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Tasks</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Projects</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Won</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-right">Sales Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRankingData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-xs text-slate-400">
                        No team activity recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredRankingData.map((row, idx) => (
                      <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-center">
                          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                            idx === 0 ? 'bg-amber-100 text-amber-700' :
                            idx === 1 ? 'bg-slate-200 text-slate-700' :
                            idx === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-50 text-slate-500'
                          }`}>
                            #{idx + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm border border-slate-200">
                              {(row.name || 'U').charAt(0)}
                            </div>
                            <span className="font-bold text-sm text-slate-900">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-700">{row.visits}</td>
                        <td className="px-6 py-4 text-center font-bold text-slate-700">{row.tasks}</td>
                        <td className="px-6 py-4 text-center font-bold text-slate-700">{row.projects}</td>
                        <td className="px-6 py-4 text-center font-bold text-emerald-600">{row.won}</td>
                        <td className="px-6 py-4 text-right font-extrabold text-slate-900 font-['Hanken_Grotesk']">
                          ${(row.salesValue || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
};

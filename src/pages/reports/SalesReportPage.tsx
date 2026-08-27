import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/crmApi';
import { PipelineAnalyticsResponse } from '../../types';

export const SalesReportPage: React.FC = () => {
  const { currentTenant } = useAuth();
  const [data, setData] = useState<PipelineAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedRepId, setSelectedRepId] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await crmApi.fetchPipelineAnalytics({
        teamId: selectedTeamId || undefined,
        repId: selectedRepId || undefined
      });
      if (res && res.summary) {
        setData(res);
      } else {
        setError('Failed to load authoritative pipeline analytics.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to database');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentTenant?.id, selectedTeamId, selectedRepId]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const summary = data?.summary || {
    openProjects: 0,
    pipelineValue: 0,
    weightedPipelineValue: 0,
    wonProjects: 0,
    wonValue: 0,
    lostProjects: 0,
    lostValue: 0,
    winRate: 0,
    conversionRate: 0,
    averageSalesCycleDays: 0,
    medianSalesCycleDays: 0,
    averageOpenProjectAgeDays: 0
  };

  const stageDistribution = data?.stageDistribution || [];
  const repPipeline = data?.repPipeline || [];
  const stageVelocity = data?.stageVelocity || [];
  const forecast = data?.expectedCloseForecast || { overdue: { count: 0, value: 0, weightedValue: 0 }, upcomingMonths: [], missingCloseDate: { count: 0, value: 0, weightedValue: 0 } };
  const coverage = data?.coverage || { totalProjects: 0, openProjects: 0, closedProjects: 0, projectsWithStageHistory: 0, projectsWithExpectedCloseDate: 0, projectsWithProbability: 0, projectsExcludedFromCycleMetrics: 0 };
  const recentProjects = data?.recentProjects || [];

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-12">
      
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
              Pipeline Analytics & Sales Cycle Intelligence
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {data?.scope || 'ORGANIZATION'} SCOPE
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Deterministic, database-authoritative project velocity, stage distribution, and closed-cycle durations.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={loadData} 
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 font-medium">
          Loading pipeline analytics and cycle intelligence from database...
        </div>
      ) : error ? (
        <div className="bg-white p-12 rounded-2xl border border-rose-200 text-center text-xs text-rose-600">
          {error}
          <div className="mt-3">
            <button onClick={loadData} className="px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg font-bold">Retry</button>
          </div>
        </div>
      ) : (
        <>
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Open Pipeline Value */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Open Pipeline Value</span>
              <div className="mt-2">
                <div className="text-xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] truncate">
                  {formatCurrency(summary.pipelineValue)}
                </div>
                <div className="text-[11px] text-indigo-600 font-bold mt-1">
                  Weighted: {formatCurrency(summary.weightedPipelineValue)}
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                {summary.openProjects} commercially active projects
              </div>
            </div>

            {/* Won Revenue */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Realized Won Revenue</span>
              <div className="mt-2">
                <div className="text-xl font-extrabold text-emerald-600 font-['Hanken_Grotesk'] truncate">
                  {formatCurrency(summary.wonValue)}
                </div>
                <div className="text-[11px] text-emerald-700 font-bold mt-1">
                  {summary.wonProjects} deals closed won
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                Lost value: {formatCurrency(summary.lostValue)} ({summary.lostProjects} lost)
              </div>
            </div>

            {/* Win Rate */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Win Rate (Closed)</span>
              <div className="mt-2">
                <div className="text-2xl font-extrabold text-indigo-600 font-['Hanken_Grotesk']">
                  {summary.winRate}%
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  WON / (WON + LOST) closed deals
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                Overall conversion: {summary.conversionRate}%
              </div>
            </div>

            {/* Sales Cycle Duration */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sales Cycle (Closed)</span>
              <div className="mt-2">
                <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">
                  {summary.medianSalesCycleDays} <span className="text-xs font-bold text-slate-500">Days (Median)</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  Average: {summary.averageSalesCycleDays} days
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                Avg Open Project Age: {summary.averageOpenProjectAgeDays} days
              </div>
            </div>

          </div>

          {/* Pipeline Stage Distribution & Velocity Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Stage Distribution Table & Funnel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-sm font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-4 flex items-center justify-between">
                <span>Stage Distribution & Value</span>
                <span className="text-[11px] font-bold text-slate-400">CURRENT PIPELINE</span>
              </h2>

              <div className="space-y-3">
                {stageDistribution.map(st => {
                  const isClosed = st.stage === 'WON' || st.stage === 'LOST';
                  const percentOfOpen = summary.pipelineValue > 0 && !isClosed ? Math.round((st.value / summary.pipelineValue) * 100) : 0;
                  return (
                    <div key={st.stage} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{st.label}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700">
                            {st.count} Deals
                          </span>
                        </div>
                        <div className="text-right font-extrabold text-slate-900">
                          {formatCurrency(st.value)}
                        </div>
                      </div>
                      {!isClosed && (
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${percentOfOpen}%` }}></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stage Velocity & Closed Duration */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-4 flex items-center justify-between">
                  <span>Stage Duration & Velocity</span>
                  <span className="text-[11px] font-bold text-slate-400">HISTORICAL TRANSITIONS</span>
                </h2>

                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stageVelocity}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="medianDays" name="Median Days" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="averageDays" name="Avg Days" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
                <span>Coverage: {coverage.projectsWithStageHistory} projects with transition history</span>
                <span>Exclusions: {coverage.projectsExcludedFromCycleMetrics} without terminal history</span>
              </div>
            </div>

          </div>

          {/* Expected Close Forecast Panel */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-4 flex items-center justify-between">
              <span>Expected Close Distribution & Pipeline Projection</span>
              <span className="text-[11px] font-bold text-slate-400">DETERMINISTIC FORECAST</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50">
                <div className="text-[11px] font-bold text-rose-600 uppercase">Past Due Expected Close</div>
                <div className="text-lg font-extrabold text-rose-900 mt-1">{formatCurrency(forecast.overdue.value)}</div>
                <div className="text-[11px] text-rose-700 font-medium mt-0.5">{forecast.overdue.count} deals past close deadline</div>
              </div>

              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50">
                <div className="text-[11px] font-bold text-indigo-600 uppercase">Upcoming Projected Pipeline</div>
                <div className="text-lg font-extrabold text-indigo-900 mt-1">
                  {formatCurrency(forecast.upcomingMonths.reduce((acc, m) => acc + m.pipelineValue, 0))}
                </div>
                <div className="text-[11px] text-indigo-700 font-medium mt-0.5">
                  Weighted: {formatCurrency(forecast.upcomingMonths.reduce((acc, m) => acc + m.weightedValue, 0))}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
                <div className="text-[11px] font-bold text-amber-600 uppercase">Missing Expected Close Date</div>
                <div className="text-lg font-extrabold text-amber-900 mt-1">{formatCurrency(forecast.missingCloseDate.value)}</div>
                <div className="text-[11px] text-amber-700 font-medium mt-0.5">{forecast.missingCloseDate.count} deals without close date</div>
              </div>
            </div>

            {forecast.upcomingMonths.length > 0 && (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecast.upcomingMonths}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="pipelineValue" name="Pipeline Value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="weightedValue" name="Weighted Value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Rep Pipeline Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-extrabold text-xs text-slate-900 flex justify-between items-center">
              <span>Representative Pipeline Workload ({repPipeline.length})</span>
              <span className="text-[10px] font-bold text-slate-400">NO ARBITRARY EMPLOYEE SCORING</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                    <th className="px-4 py-3">Sales Representative</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3 text-center">Open Deals</th>
                    <th className="px-4 py-3 text-right">Pipeline Value</th>
                    <th className="px-4 py-3 text-right">Weighted Pipeline</th>
                    <th className="px-4 py-3 text-center">Won / Lost</th>
                    <th className="px-4 py-3 text-right">Won Revenue</th>
                    <th className="px-4 py-3 text-center">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {repPipeline.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No representative records found under authorized data scope.
                      </td>
                    </tr>
                  ) : (
                    repPipeline.map((r: any) => (
                      <tr key={r.userId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-900">{r.name}</td>
                        <td className="px-4 py-3 text-slate-500">{r.teamName || 'General'}</td>
                        <td className="px-4 py-3 text-center font-bold text-indigo-600">{r.openProjects}</td>
                        <td className="px-4 py-3 text-right font-extrabold text-slate-900">{formatCurrency(r.pipelineValue)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-600">{formatCurrency(r.weightedPipelineValue)}</td>
                        <td className="px-4 py-3 text-center text-slate-700">
                          <span className="text-emerald-600 font-bold">{r.wonProjects}</span> / <span className="text-rose-600 font-bold">{r.lostProjects}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(r.wonValue)}</td>
                        <td className="px-4 py-3 text-center font-bold text-indigo-600">{r.winRate}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operational Projects Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-extrabold text-xs text-slate-900 flex justify-between items-center">
              <span>Scoped Project Portfolio ({recentProjects.length})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                    <th className="px-4 py-3">Project Title</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">PIC</th>
                    <th className="px-4 py-3 text-right">Value</th>
                    <th className="px-4 py-3 text-center">Probability</th>
                    <th className="px-4 py-3 text-center">Expected Close</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentProjects.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No projects match the authorized data scope.
                      </td>
                    </tr>
                  ) : (
                    recentProjects.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-900">{p.title}</td>
                        <td className="px-4 py-3 text-slate-600">{p.customerName || 'Unassigned'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.stageId === 'WON' ? 'bg-emerald-100 text-emerald-700' :
                            p.stageId === 'LOST' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {p.stageId}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{p.picName || 'Unassigned'}</td>
                        <td className="px-4 py-3 text-right font-extrabold text-slate-900">{formatCurrency(p.value)}</td>
                        <td className="px-4 py-3 text-center font-bold text-slate-600">{p.probability !== null ? `${p.probability}%` : '-'}</td>
                        <td className="px-4 py-3 text-center text-slate-500">{p.expectedCloseDate ? p.expectedCloseDate.slice(0, 10) : 'None'}</td>
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


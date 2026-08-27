import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/crmApi';
import { PipelineAnalyticsResponse, PipelineVelocityResponse, ProjectInterventionsResponse, ProjectInterventionHistoryResponse, InterventionAnalyticsResponse } from '../../types';

export const SalesReportPage: React.FC = () => {
  const { currentTenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'ANALYTICS' | 'VELOCITY' | 'INTERVENTIONS' | 'INTERVENTION_HISTORY' | 'INTERVENTION_ANALYTICS'>('ANALYTICS');
  const [data, setData] = useState<PipelineAnalyticsResponse | null>(null);
  const [velocityData, setVelocityData] = useState<PipelineVelocityResponse | null>(null);
  const [interventionData, setInterventionData] = useState<ProjectInterventionsResponse | null>(null);
  const [historyData, setHistoryData] = useState<ProjectInterventionHistoryResponse | null>(null);
  const [analyticsData, setAnalyticsData] = useState<InterventionAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedRepId, setSelectedRepId] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeTab === 'ANALYTICS') {
        const res = await crmApi.fetchPipelineAnalytics({
          teamId: selectedTeamId || undefined,
          repId: selectedRepId || undefined
        });
        if (res && res.summary) {
          setData(res);
        } else {
          setError('Failed to load authoritative pipeline analytics.');
        }
      } else if (activeTab === 'VELOCITY') {
        const vRes = await crmApi.fetchPipelineVelocity({
          teamId: selectedTeamId || undefined,
          repId: selectedRepId || undefined
        });
        if (vRes && vRes.baselines) {
          setVelocityData(vRes);
        } else {
          setError('Failed to load authoritative pipeline velocity & stage duration intelligence.');
        }
      } else if (activeTab === 'INTERVENTIONS') {
        const iRes = await crmApi.fetchProjectInterventions({
          teamId: selectedTeamId || undefined,
          repId: selectedRepId || undefined
        });
        if (iRes && iRes.summary) {
          setInterventionData(iRes);
        } else {
          setError('Failed to load project interventions.');
        }
      } else if (activeTab === 'INTERVENTION_HISTORY') {
        const hRes = await crmApi.fetchProjectInterventionHistory({
          teamId: selectedTeamId || undefined,
          repId: selectedRepId || undefined
        });
        if (hRes && hRes.summary) {
          setHistoryData(hRes);
        } else {
          setError('Failed to load project intervention history.');
        }
      } else {
        const aRes = await crmApi.fetchInterventionAnalytics({
          teamId: selectedTeamId || undefined,
          repId: selectedRepId || undefined
        });
        if (aRes && aRes.summary) {
          setAnalyticsData(aRes);
        } else {
          setError('Failed to load intervention resolution analytics.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to database');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentTenant?.id, selectedTeamId, selectedRepId, activeTab]);

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
              Pipeline Analytics & Sales Velocity Intelligence
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {(activeTab === 'ANALYTICS' ? data?.scope : velocityData?.scope) || 'ORGANIZATION'} SCOPE
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Deterministic, database-authoritative stage duration baselines, project velocity, and sales cycle metrics.
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

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('ANALYTICS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'ANALYTICS'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">analytics</span>
          Pipeline Analytics & Sales Cycle
        </button>
        <button
          onClick={() => setActiveTab('VELOCITY')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'VELOCITY'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">speed</span>
          Stage Velocity & Duration Baselines
        </button>
        <button
          onClick={() => setActiveTab('INTERVENTIONS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'INTERVENTIONS'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">warning</span>
          Project Interventions & Stalled Governance
        </button>
        <button
          onClick={() => setActiveTab('INTERVENTION_HISTORY')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'INTERVENTION_HISTORY'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">history</span>
          Intervention Episodes History & Timeline
        </button>
        <button
          onClick={() => setActiveTab('INTERVENTION_ANALYTICS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'INTERVENTION_ANALYTICS'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">query_stats</span>
          Intervention Resolution & Recurrence Analytics
        </button>
      </div>

      {isLoading ? (
        <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 font-medium">
          Loading authoritative data from database...
        </div>
      ) : error ? (
        <div className="bg-white p-12 rounded-2xl border border-rose-200 text-center text-xs text-rose-600">
          {error}
          <div className="mt-3">
            <button onClick={loadData} className="px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg font-bold">Retry</button>
          </div>
        </div>
      ) : activeTab === 'ANALYTICS' ? (
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
                {summary.openProjects} open projects ({coverage.projectsWithProbability} with probability)
              </div>
            </div>

            {/* Total Won Value */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Won Revenue</span>
              <div className="mt-2">
                <div className="text-xl font-extrabold text-emerald-600 font-['Hanken_Grotesk'] truncate">
                  {formatCurrency(summary.wonValue)}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  {summary.wonProjects} Won deals
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                Lost value: {formatCurrency(summary.lostValue)} ({summary.lostProjects} Lost)
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
                  WON / (WON + LOST) closed projects
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                Closed projects total: {coverage.closedProjects}
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

          {/* Project Portfolio Table */}
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
      ) : activeTab === 'VELOCITY' ? (
        /* R51 Pipeline Velocity & Stage Duration Intelligence Tab */
        <div className="space-y-6">
          {/* Stage Duration Baselines Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-extrabold text-xs text-slate-900 flex justify-between items-center">
              <span>Historical Stage Duration Baselines ({velocityData?.baselineScope || 'ORGANIZATION'})</span>
              <span className="text-[11px] font-normal text-slate-500">
                {velocityData?.comparisonPolicyConfigured
                  ? `Comparison Policy: Min. ${velocityData?.comparisonMinimumSampleSize} sample intervals (Database-Authoritative)`
                  : 'Comparison Policy: Not Configured in Database'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3 text-center">Sample Size</th>
                    <th className="px-4 py-3 text-center">Median (Days)</th>
                    <th className="px-4 py-3 text-center">Average (Days)</th>
                    <th className="px-4 py-3 text-center">P25 (Days)</th>
                    <th className="px-4 py-3 text-center">P75 (Days)</th>
                    <th className="px-4 py-3 text-center">P90 (Days)</th>
                    <th className="px-4 py-3 text-center">Comparison Eligibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {velocityData?.baselines.map((b) => (
                    <tr key={b.stageId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-900">{b.stageId}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700">{b.sampleSize}</td>
                      <td className="px-4 py-3 text-center font-black text-indigo-600">{b.medianDays !== null ? `${b.medianDays}d` : '-'}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{b.averageDays !== null ? `${b.averageDays}d` : '-'}</td>
                      <td className="px-4 py-3 text-center text-slate-500">{b.p25Days !== null ? `${b.p25Days}d` : '-'}</td>
                      <td className="px-4 py-3 text-center text-slate-500">{b.p75Days !== null ? `${b.p75Days}d` : '-'}</td>
                      <td className="px-4 py-3 text-center text-slate-500">{b.p90Days !== null ? `${b.p90Days}d` : '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.comparisonAvailable
                            ? 'bg-emerald-100 text-emerald-700'
                            : !b.comparisonPolicyConfigured
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {b.comparisonAvailable
                            ? 'Eligible'
                            : !b.comparisonPolicyConfigured
                            ? 'Policy Unconfigured'
                            : 'Insufficient Sample'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Current Projects Stage Duration & Relative Position Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-extrabold text-xs text-slate-900 flex justify-between items-center">
              <span>Current Open Projects Stage Velocity ({velocityData?.currentProjects.length ?? 0})</span>
              <span className="text-[11px] font-normal text-slate-500">
                Neutral duration comparison vs historical baseline
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                    <th className="px-4 py-3">Project Title</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">PIC</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3 text-center">Days in Stage</th>
                    <th className="px-4 py-3 text-center">Stage Median</th>
                    <th className="px-4 py-3 text-center">Stage P75</th>
                    <th className="px-4 py-3 text-center">Relative Position</th>
                    <th className="px-4 py-3">Next Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {velocityData?.currentProjects.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No open projects match current data scope.
                      </td>
                    </tr>
                  ) : (
                    velocityData?.currentProjects.map((p) => (
                      <tr key={p.projectId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-900">{p.projectTitle}</td>
                        <td className="px-4 py-3 text-slate-600">{p.customerName}</td>
                        <td className="px-4 py-3 text-slate-700">{p.picName}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">
                            {p.stageId}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-extrabold text-slate-900">
                          {p.daysInCurrentStage !== null ? `${p.daysInCurrentStage}d` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">{p.baselineMedianDays !== null ? `${p.baselineMedianDays}d` : '-'}</td>
                        <td className="px-4 py-3 text-center text-slate-500">{p.baselineP75Days !== null ? `${p.baselineP75Days}d` : '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.relativePosition === 'BELOW_MEDIAN' ? 'bg-emerald-100 text-emerald-700' :
                            p.relativePosition === 'AT_MEDIAN' ? 'bg-blue-100 text-blue-700' :
                            p.relativePosition === 'ABOVE_MEDIAN' ? 'bg-amber-100 text-amber-700' :
                            p.relativePosition === 'ABOVE_P75' ? 'bg-rose-100 text-rose-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {p.relativePosition.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {p.nextAction ? (
                            <span className="text-[11px] text-slate-700 font-medium truncate max-w-[200px] inline-block">
                              [{p.nextAction.type}] {p.nextAction.title} ({p.nextAction.date || 'No Date'})
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-amber-600">Missing Next Action</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'INTERVENTIONS' ? (
        /* R52 Project Interventions & Stalled Governance Tab */
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Evaluated Deals</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {interventionData?.summary.totalProjectsEvaluated ?? 0}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Active Policies: {interventionData?.activePoliciesCount ?? 0}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Critical Interventions</div>
              <div className="text-2xl font-extrabold text-rose-700 mt-1">
                {interventionData?.summary.criticalInterventionsCount ?? 0}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Immediate Action Required
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Warning Interventions</div>
              <div className="text-2xl font-extrabold text-amber-700 mt-1">
                {interventionData?.summary.warningInterventionsCount ?? 0}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Commercial Velocity Risk
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unknown Evaluations</div>
              <div className="text-2xl font-extrabold text-slate-600 mt-1">
                {interventionData?.summary.unknownEvaluationProjectsCount ?? 0}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Unconfigured/Missing Sample
              </div>
            </div>
          </div>

          {/* Interventions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-extrabold text-xs text-slate-900 flex justify-between items-center">
              <span>Operational Project Interventions ({interventionData?.currentProjects.length ?? 0})</span>
              <span className="text-[11px] font-normal text-slate-500">
                {interventionData?.interventionPolicyConfigured
                  ? 'Deterministic, DB-authoritative intervention rules applied'
                  : 'No intervention policies configured in database'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                    <th className="px-4 py-3">Project Title</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">PIC</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3 text-center">Days in Stage</th>
                    <th className="px-4 py-3 text-center">Intervention Status</th>
                    <th className="px-4 py-3">Matched Policy</th>
                    <th className="px-4 py-3">Recommended Remediation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!interventionData?.currentProjects || interventionData?.currentProjects.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        {!interventionData?.interventionPolicyConfigured
                          ? 'No intervention policies configured.'
                          : 'No projects match configured interventions.'}
                      </td>
                    </tr>
                  ) : (
                    interventionData?.currentProjects.map((p) => (
                      <tr key={p.projectId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-900">{p.projectTitle}</td>
                        <td className="px-4 py-3 text-slate-600">{p.customerName}</td>
                        <td className="px-4 py-3 text-slate-700">{p.picName}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">
                            {p.stageId}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-extrabold text-slate-900">
                          {p.daysInCurrentStage !== null ? `${p.daysInCurrentStage}d` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.interventionStatus === 'MATCHED'
                              ? p.interventions.some(i => i.severity === 'CRITICAL')
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                              : p.interventionStatus === 'UNKNOWN'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {p.interventionStatus === 'MATCHED'
                              ? (p.interventions[0]?.severity || 'MATCHED')
                              : p.interventionStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {p.interventions.length > 0 ? (
                            <div className="space-y-1">
                              {p.interventions.map((i) => (
                                <div key={i.policyId} className="font-bold text-slate-800 text-[11px]">
                                  {i.policyName}
                                  <span className="text-[10px] text-slate-400 font-normal ml-1">
                                    ({i.matchedConditions.join(' + ')})
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-medium">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {p.interventions.length > 0 && p.interventions[0].recommendedActions.length > 0 ? (
                            <span className="text-[11px] text-indigo-700 font-semibold">
                              {p.interventions[0].recommendedActions[0].description}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'INTERVENTION_HISTORY' ? (
        <div className="space-y-6">
          {/* History KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Recorded Episodes</span>
              <div className="mt-2 text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">
                {historyData?.summary.totalEpisodes || 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Append-only historical records
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Currently Active Episodes</span>
              <div className="mt-2 text-2xl font-extrabold text-amber-600 font-['Hanken_Grotesk']">
                {historyData?.summary.activeEpisodesCount || 0}
              </div>
              <div className="text-[11px] text-amber-700 font-medium mt-1">
                Awaiting underlying operational resolution
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Resolved Episodes</span>
              <div className="mt-2 text-2xl font-extrabold text-emerald-600 font-['Hanken_Grotesk']">
                {historyData?.summary.resolvedEpisodesCount || 0}
              </div>
              <div className="text-[11px] text-emerald-700 font-medium mt-1">
                Resolved by canonical state changes
              </div>
            </div>
          </div>

          {/* Historical Episodes Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-['Hanken_Grotesk']">
                  Historical Intervention Episodes & State Transitions
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Traceable audit of when projects entered/exited intervention states and underlying trigger events.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Episode ID</th>
                    <th className="px-4 py-3">Project / Customer</th>
                    <th className="px-4 py-3">Policy / Severity</th>
                    <th className="px-4 py-3">Started At (Trigger)</th>
                    <th className="px-4 py-3">Ended At (Resolution)</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(!historyData?.episodes || historyData.episodes.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                        No intervention episodes recorded for this organization scope yet.
                      </td>
                    </tr>
                  ) : (
                    historyData.episodes.map((ep) => (
                      <tr key={ep.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{ep.id}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{ep.projectTitle}</div>
                          <div className="text-[11px] text-slate-500">{ep.customerName} • PIC: {ep.picName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{ep.policyName}</div>
                          <div className="text-[10px] text-slate-400">
                            {ep.severity} • {ep.conditions.join(', ')}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-800 font-semibold">{ep.startedAt.slice(0, 16).replace('T', ' ')}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{ep.startedByEventType}</div>
                        </td>
                        <td className="px-4 py-3">
                          {ep.endedAt ? (
                            <>
                              <div className="text-slate-800 font-semibold">{ep.endedAt.slice(0, 16).replace('T', ' ')}</div>
                              <div className="text-[10px] text-emerald-600 font-semibold">{ep.endReason || 'RESOLVED'}</div>
                            </>
                          ) : (
                            <span className="text-amber-600 font-bold text-[11px]">Active</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {ep.durationHours !== null && ep.durationHours !== undefined ? (
                            <span className="font-semibold text-slate-700">
                              {ep.durationDays && ep.durationDays >= 1 ? `${ep.durationDays} days` : `${ep.durationHours} hrs`}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ep.isActive
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {ep.isActive ? 'ACTIVE' : 'RESOLVED'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* R54 INTERVENTION RESOLUTION ANALYTICS & RECURRENCE INTELLIGENCE VIEW */
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Recorded Episodes</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1 font-['Hanken_Grotesk']">
                {analyticsData?.summary.totalEpisodes ?? 0}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Active: {analyticsData?.summary.activeEpisodes ?? 0} • Closed: {analyticsData?.summary.closedEpisodes ?? 0}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Business Resolved</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1 font-['Hanken_Grotesk']">
                {analyticsData?.summary.businessResolvedEpisodes ?? 0}
              </div>
              <div className="text-[11px] text-emerald-600 font-medium mt-1">
                Underlying condition stopped matching
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Median Exact Resolution</div>
              <div className="text-2xl font-extrabold text-indigo-700 mt-1 font-['Hanken_Grotesk']">
                {analyticsData?.resolutionDuration.medianResolutionHours !== null && analyticsData?.resolutionDuration.medianResolutionHours !== undefined
                  ? `${analyticsData.resolutionDuration.medianResolutionHours}h`
                  : '-'}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Sample: {analyticsData?.resolutionDuration.sampleSize ?? 0} exact resolved deals
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Recurring Projects</div>
              <div className="text-2xl font-extrabold text-amber-700 mt-1 font-['Hanken_Grotesk']">
                {analyticsData?.summary.recurringProjectCount ?? 0}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Total Recurrences: {analyticsData?.summary.totalRecurrences ?? 0}
              </div>
            </div>
          </div>

          {/* Resolution Duration Percentiles Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 font-['Hanken_Grotesk']">
              Exact Business-State Resolution Duration Distribution
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Strictly computed from transition-detected episodes ending with BUSINESS_STATE_CHANGED.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mt-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Min</span>
                <div className="text-base font-bold text-slate-800 mt-0.5">
                  {analyticsData?.resolutionDuration.minResolutionHours !== null && analyticsData?.resolutionDuration.minResolutionHours !== undefined ? `${analyticsData.resolutionDuration.minResolutionHours}h` : '-'}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">P25</span>
                <div className="text-base font-bold text-slate-800 mt-0.5">
                  {analyticsData?.resolutionDuration.p25ResolutionHours !== null && analyticsData?.resolutionDuration.p25ResolutionHours !== undefined ? `${analyticsData.resolutionDuration.p25ResolutionHours}h` : '-'}
                </div>
              </div>
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-center">
                <span className="text-[10px] font-bold text-indigo-600 uppercase">Median (P50)</span>
                <div className="text-base font-extrabold text-indigo-700 mt-0.5">
                  {analyticsData?.resolutionDuration.medianResolutionHours !== null && analyticsData?.resolutionDuration.medianResolutionHours !== undefined ? `${analyticsData.resolutionDuration.medianResolutionHours}h` : '-'}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Average</span>
                <div className="text-base font-bold text-slate-800 mt-0.5">
                  {analyticsData?.resolutionDuration.averageResolutionHours !== null && analyticsData?.resolutionDuration.averageResolutionHours !== undefined ? `${analyticsData.resolutionDuration.averageResolutionHours}h` : '-'}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">P75</span>
                <div className="text-base font-bold text-slate-800 mt-0.5">
                  {analyticsData?.resolutionDuration.p75ResolutionHours !== null && analyticsData?.resolutionDuration.p75ResolutionHours !== undefined ? `${analyticsData.resolutionDuration.p75ResolutionHours}h` : '-'}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">P90 / Max</span>
                <div className="text-base font-bold text-slate-800 mt-0.5">
                  {analyticsData?.resolutionDuration.p90ResolutionHours !== null && analyticsData?.resolutionDuration.p90ResolutionHours !== undefined ? `${analyticsData.resolutionDuration.p90ResolutionHours}h` : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Policy Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 font-['Hanken_Grotesk']">
                Intervention Policy Breakdown & Recurrence Intelligence
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Descriptive breakdown per policy identity based on historical snapshots.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Policy Name</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3 text-center">Total Episodes</th>
                    <th className="px-4 py-3 text-center">Active</th>
                    <th className="px-4 py-3 text-center">Business Resolved</th>
                    <th className="px-4 py-3 text-center">Recurring Deals</th>
                    <th className="px-4 py-3 text-center">Median Resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(!analyticsData?.policyBreakdown || analyticsData.policyBreakdown.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No policy analytics available.
                      </td>
                    </tr>
                  ) : (
                    analyticsData.policyBreakdown.map((pol) => (
                      <tr key={pol.policyId} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900">{pol.policyName}</span>
                          <span className="text-[10px] text-slate-400 ml-2 font-mono">{pol.policyCode}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            pol.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                            pol.severity === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {pol.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-900">{pol.totalEpisodes}</td>
                        <td className="px-4 py-3 text-center font-semibold text-amber-600">{pol.activeEpisodes}</td>
                        <td className="px-4 py-3 text-center font-semibold text-emerald-600">{pol.businessResolvedEpisodes}</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-700">{pol.recurringProjectsCount}</td>
                        <td className="px-4 py-3 text-center font-bold text-indigo-700">
                          {pol.medianBusinessResolutionHours !== null ? `${pol.medianBusinessResolutionHours}h` : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Data Quality & Provenance Coverage Disclosure */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Historical Dataset Integrity & Provenance Coverage
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-3 text-xs text-slate-600">
              <div>
                <span className="font-semibold text-slate-700">Closed Episodes Coverage: </span>
                <span>
                  {analyticsData?.coverage.exactClosedDurationCoveragePercent !== null && analyticsData?.coverage.exactClosedDurationCoveragePercent !== undefined
                    ? `${analyticsData.coverage.exactClosedDurationCoveragePercent}% exact`
                    : 'N/A'}
                </span>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {analyticsData?.coverage.exactClosedEpisodes ?? 0} exact / {analyticsData?.coverage.observedPartialClosedEpisodes ?? 0} observed partial
                </div>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Business Resolution Coverage: </span>
                <span>
                  {analyticsData?.coverage.exactBusinessResolutionCoveragePercent !== null && analyticsData?.coverage.exactBusinessResolutionCoveragePercent !== undefined
                    ? `${analyticsData.coverage.exactBusinessResolutionCoveragePercent}% exact`
                    : 'N/A'}
                </span>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {analyticsData?.coverage.exactBusinessResolvedEpisodes ?? 0} exact / {analyticsData?.coverage.observedPartialBusinessResolvedEpisodes ?? 0} observed partial
                </div>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Revision Identity Coverage: </span>
                <span>
                  {analyticsData?.coverage.revisionIdentityCoveragePercent !== null && analyticsData?.coverage.revisionIdentityCoveragePercent !== undefined
                    ? `${analyticsData.coverage.revisionIdentityCoveragePercent}% versioned`
                    : 'N/A'}
                </span>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {analyticsData?.coverage.versionedEpisodes ?? 0} versioned / {analyticsData?.coverage.legacyUnversionedEpisodes ?? 0} legacy unversioned
                </div>
              </div>
              <div>
                <span className="font-semibold text-slate-700">History Coverage Basis: </span>
                <span>{analyticsData?.periodFilterBasis || 'STARTED_AT'}</span>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Lineage Recurrences: {analyticsData?.recurrence.totalRecurrences ?? 0} (Exact Revision: {analyticsData?.recurrence.totalRevisionRecurrences ?? 0})
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


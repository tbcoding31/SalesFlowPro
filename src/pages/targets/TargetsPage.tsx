import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/crmApi';
import { SalesTargetAttainmentResponse, SalesTargetType } from '../../types';

export const TargetsPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const isManagerOrAdmin = hasPermission('MANAGE_TENANT') || hasPermission('MANAGE_USERS') || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'SALES_MANAGER' || currentUser?.role === 'SUPERVISOR';

  // Date Defaults: Current Month
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(curYear, now.getMonth() + 1, 0).getDate();

  const [periodStart, setPeriodStart] = useState<string>(`${curYear}-${curMonth}-01`);
  const [periodEnd, setPeriodEnd] = useState<string>(`${curYear}-${curMonth}-${String(lastDay).padStart(2, '0')}`);
  const [targetType, setTargetType] = useState<SalesTargetType>('WON_PROJECT_VALUE');
  
  const [attainmentData, setAttainmentData] = useState<SalesTargetAttainmentResponse | null>(null);
  const [coverageData, setCoverageData] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'REPS' | 'TEAMS' | 'COVERAGE'>('REPS');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);

  // Modal Form State
  const [modalScope, setModalScope] = useState<'USER' | 'TEAM'>('USER');
  const [modalTenantUserId, setModalTenantUserId] = useState<string>('');
  const [modalTeamId, setModalTeamId] = useState<string>('');
  const [modalTargetValue, setModalTargetValue] = useState<number>(100000000);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [attainmentRes, coverageRes] = await Promise.all([
        crmApi.fetchSalesTargetAttainment({
          periodStart,
          periodEnd,
          targetType
        }),
        crmApi.fetchSalesTargetActivityCoverage({
          periodStart,
          periodEnd
        })
      ]);
      setAttainmentData(attainmentRes);
      setCoverageData(coverageRes);
      if (attainmentRes && attainmentRes.repAttainment && attainmentRes.repAttainment.length > 0 && !modalTenantUserId) {
        setModalTenantUserId(attainmentRes.repAttainment[0].tenantUserId);
      }
      if (attainmentRes && attainmentRes.teamAttainment && attainmentRes.teamAttainment.length > 0 && !modalTeamId) {
        setModalTeamId(attainmentRes.teamAttainment[0].teamId);
      }
    } catch (err) {
      console.error('Error fetching target data from DB:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [periodStart, periodEnd, targetType]);

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '-';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleCreateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);

    try {
      await crmApi.createSalesTarget({
        targetScope: modalScope,
        tenantUserId: modalScope === 'USER' ? modalTenantUserId : null,
        teamId: modalScope === 'TEAM' ? modalTeamId : null,
        targetType,
        periodStart,
        periodEnd,
        targetValue: modalTargetValue,
        status: 'ACTIVE'
      });
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create target');
    } finally {
      setIsSubmitting(false);
    }
  };

  const summary = attainmentData?.summary;
  const coverage = attainmentData?.coverage;
  const period = attainmentData?.period;

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-extrabold rounded-md uppercase tracking-wider border border-indigo-100">
              Sales Governance
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Scope: {attainmentData?.scope || 'OWN'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-['Hanken_Grotesk'] mt-1">
            Sales Targets & Attainment Governance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Database-authoritative quota tracking and realized commercial attainment derived from closed projects.
          </p>
        </div>

        {/* Action & Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
            <span className="text-[11px] font-bold text-slate-500 px-2">Type:</span>
            <button
              onClick={() => setTargetType('WON_PROJECT_VALUE')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                targetType === 'WON_PROJECT_VALUE'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Won Value
            </button>
            <button
              onClick={() => setTargetType('WON_PROJECT_COUNT')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                targetType === 'WON_PROJECT_COUNT'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Project Count
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="material-symbols-outlined text-[16px] text-slate-400">calendar_month</span>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="bg-transparent border-0 text-xs font-bold text-slate-800 p-0 focus:ring-0"
            />
            <span className="text-slate-400 font-bold">to</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="bg-transparent border-0 text-xs font-bold text-slate-800 p-0 focus:ring-0"
            />
          </div>

          {isManagerOrAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 font-['Hanken_Grotesk'] shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">add_task</span>
              <span>Assign Target</span>
            </button>
          )}
        </div>
      </div>

      {/* Top KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Target Sum */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Target Assigned</span>
            <div className="mt-2">
              <div className="text-xl font-black text-slate-900 font-['Hanken_Grotesk'] truncate">
                {targetType === 'WON_PROJECT_VALUE' ? formatCurrency(summary.totalTargetValue) : `${summary.totalTargetValue} Projects`}
              </div>
              <div className="text-[11px] text-indigo-600 font-bold mt-1">
                {summary.repsWithTarget} of {summary.totalReps} Reps with active quota
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
              Period: {periodStart} to {periodEnd}
            </div>
          </div>

          {/* Actual Won Realized */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Realized Won Outcome</span>
            <div className="mt-2">
              <div className="text-xl font-black text-emerald-600 font-['Hanken_Grotesk'] truncate">
                {targetType === 'WON_PROJECT_VALUE' ? formatCurrency(summary.totalActualValue) : `${summary.totalActualCount} Projects`}
              </div>
              <div className="text-[11px] text-emerald-700 font-bold mt-1">
                {summary.totalActualCount} verified won projects
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
              Attributed: {coverage?.wonProjectsWithUserAttribution || 0} projects
            </div>
          </div>

          {/* Remaining Target Gap */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Remaining Quota Gap</span>
            <div className="mt-2">
              <div className="text-xl font-black text-amber-600 font-['Hanken_Grotesk'] truncate">
                {summary.remainingTarget !== undefined
                  ? (targetType === 'WON_PROJECT_VALUE' ? formatCurrency(summary.remainingTarget) : `${summary.remainingTarget} Projects`)
                  : '-'}
              </div>
              <div className="text-[11px] text-amber-700 font-bold mt-1">
                {summary.overallAttainmentPercent !== null ? `${summary.overallAttainmentPercent}% Achieved` : 'No Target'}
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
              Target − Realized Actual
            </div>
          </div>

          {/* Weighted Pipeline Forecast */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Period Target Forecast</span>
            <div className="mt-2">
              <div className="text-xl font-black text-indigo-600 font-['Hanken_Grotesk'] truncate">
                {period?.isForecastAvailable
                  ? (targetType === 'WON_PROJECT_VALUE' ? formatCurrency(summary.weightedPipelineValue || 0) : `${summary.weightedPipelineCount || 0} Projects`)
                  : 'Unavailable'}
              </div>
              <div className="text-[11px] text-slate-600 font-medium mt-1">
                {period?.isForecastAvailable
                  ? `${targetType === 'WON_PROJECT_VALUE' ? (coverage?.projectsEligibleForWeightedValue || 0) : (coverage?.projectsEligibleForWeightedCount || 0)} qualifying open deals`
                  : 'Historical period completed'}
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
              Σ (Value × Prob) within period
            </div>
          </div>

          {/* Projected Coverage & Gap */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Projected Coverage</span>
            <div className="mt-2">
              <div className="text-2xl font-black text-indigo-700 font-['Hanken_Grotesk']">
                {summary.projectedCoveragePercent !== null && summary.projectedCoveragePercent !== undefined
                  ? `${summary.projectedCoveragePercent}%`
                  : (period?.isForecastAvailable ? 'No Target' : 'N/A')}
              </div>
              <div className="text-[11px] text-slate-600 font-medium mt-1">
                {summary.projectedGap !== null && summary.projectedGap !== undefined && summary.projectedGap > 0
                  ? `Projected Gap: ${formatCurrency(summary.projectedGap)}`
                  : (summary.projectedGap === 0 ? '✓ Projected Fully Covered' : '-')}
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
              (Actual + Weighted) / Target
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('REPS')}
          className={`px-4 py-2 font-bold text-sm rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'REPS'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">person</span>
          <span>Representative Attainment & Forecast ({attainmentData?.repAttainment?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('TEAMS')}
          className={`px-4 py-2 font-bold text-sm rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'TEAMS'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">groups</span>
          <span>Team Quotas & Forecast ({attainmentData?.teamAttainment?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('COVERAGE')}
          className={`px-4 py-2 font-bold text-sm rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'COVERAGE'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">checklist</span>
          <span>Commercial Activity Coverage ({coverageData?.projects?.length || 0})</span>
        </button>
      </div>

      {/* Representative Attainment & Forecast Table */}
      {activeTab === 'REPS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-900 font-['Hanken_Grotesk']">
              Sales Representatives Target Attainment & Pipeline Forecast
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Period: {periodStart} to {periodEnd}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-900">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Representative</th>
                  <th className="px-5 py-3.5">Team</th>
                  <th className="px-5 py-3.5">Target</th>
                  <th className="px-5 py-3.5">Realized Actual</th>
                  <th className="px-5 py-3.5">Attainment</th>
                  <th className="px-5 py-3.5">Remaining</th>
                  <th className="px-5 py-3.5">Weighted Pipeline</th>
                  <th className="px-5 py-3.5 text-right">Projected Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-400">Loading quota and forecast data from database...</td>
                  </tr>
                ) : attainmentData?.repAttainment?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-400">No representative targets found in scope.</td>
                  </tr>
                ) : (
                  attainmentData?.repAttainment?.map((r) => {
                    const hasTarget = r.hasTargetAssigned;
                    const isCount = targetType === 'WON_PROJECT_COUNT';
                    const targetDisplay = hasTarget ? (isCount ? `${r.targetValue} Projects` : formatCurrency(r.targetValue)) : 'No target assigned';
                    const actualDisplay = isCount ? `${r.actualCount} Projects` : formatCurrency(r.actualValue);
                    const remainingDisplay = hasTarget ? (isCount ? `${r.remainingValue} Projects` : formatCurrency(r.remainingValue)) : '-';
                    const weightedPipeDisplay = isCount ? `${r.weightedPipelineCount} Projects` : formatCurrency(r.weightedPipelineValue || 0);
                    const rate = r.attainmentPercent;
                    const projCoverage = r.projectedCoveragePercent;

                    return (
                      <tr key={r.userId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-bold text-sm text-slate-900">{r.name}</div>
                          <div className="text-[11px] text-slate-500">{r.email}</div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md">
                            {r.teamName}
                          </span>
                        </td>

                        <td className="px-5 py-4 font-mono font-bold text-slate-900">
                          {targetDisplay}
                        </td>

                        <td className="px-5 py-4 font-mono font-bold text-emerald-600">
                          {actualDisplay} ({r.actualCount} won)
                        </td>

                        <td className="px-5 py-4">
                          {rate !== null ? (
                            <div className="flex items-center gap-2">
                              <span className="font-black text-indigo-600 text-xs">{rate}%</span>
                              <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${rate >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                                  style={{ width: `${Math.min(rate, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-semibold italic">Unassigned</span>
                          )}
                        </td>

                        <td className="px-5 py-4 font-mono font-semibold text-slate-600">
                          {remainingDisplay}
                        </td>

                        <td className="px-5 py-4 font-mono font-bold text-indigo-600">
                          {r.isForecastAvailable ? weightedPipeDisplay : <span className="text-slate-400 font-normal italic">N/A</span>}
                        </td>

                        <td className="px-5 py-4 text-right">
                          {projCoverage !== null && projCoverage !== undefined ? (
                            <span className={`font-black text-xs ${projCoverage >= 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                              {projCoverage}%
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Team Attainment & Forecast Table */}
      {activeTab === 'TEAMS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-900 font-['Hanken_Grotesk']">
              Team Target Quotas & Pipeline Forecast
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Period: {periodStart} to {periodEnd}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-900">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Team Name</th>
                  <th className="px-5 py-3.5">Target</th>
                  <th className="px-5 py-3.5">Realized Actual</th>
                  <th className="px-5 py-3.5">Attainment</th>
                  <th className="px-5 py-3.5">Remaining</th>
                  <th className="px-5 py-3.5">Weighted Pipeline</th>
                  <th className="px-5 py-3.5 text-right">Projected Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">Loading team quota data...</td>
                  </tr>
                ) : attainmentData?.teamAttainment?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">No teams found in scope.</td>
                  </tr>
                ) : (
                  attainmentData?.teamAttainment?.map((tm) => {
                    const hasTarget = tm.hasTargetAssigned;
                    const isCount = targetType === 'WON_PROJECT_COUNT';
                    const targetDisplay = hasTarget ? (isCount ? `${tm.targetValue} Projects` : formatCurrency(tm.targetValue)) : 'No target assigned';
                    const actualDisplay = isCount ? `${tm.actualCount} Projects` : formatCurrency(tm.actualValue);
                    const remainingDisplay = hasTarget ? (isCount ? `${tm.remainingValue} Projects` : formatCurrency(tm.remainingValue)) : '-';
                    const weightedPipeDisplay = isCount ? `${tm.weightedPipelineCount} Projects` : formatCurrency(tm.weightedPipelineValue || 0);
                    const rate = tm.attainmentPercent;
                    const projCoverage = tm.projectedCoveragePercent;

                    return (
                      <tr key={tm.teamId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-4 font-bold text-sm text-slate-900">
                          {tm.teamName}
                        </td>

                        <td className="px-5 py-4 font-mono font-bold text-slate-900">
                          {targetDisplay}
                        </td>

                        <td className="px-5 py-4 font-mono font-bold text-emerald-600">
                          {actualDisplay} ({tm.actualCount} won)
                        </td>

                        <td className="px-5 py-4">
                          {rate !== null ? (
                            <div className="flex items-center gap-2">
                              <span className="font-black text-indigo-600 text-xs">{rate}%</span>
                              <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${rate >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                                  style={{ width: `${Math.min(rate, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-semibold italic">Unassigned</span>
                          )}
                        </td>

                        <td className="px-5 py-4 font-mono font-semibold text-slate-600">
                          {remainingDisplay}
                        </td>

                        <td className="px-5 py-4 font-mono font-bold text-indigo-600">
                          {tm.isForecastAvailable ? weightedPipeDisplay : <span className="text-slate-400 font-normal italic">N/A</span>}
                        </td>

                        <td className="px-5 py-4 text-right">
                          {projCoverage !== null && projCoverage !== undefined ? (
                            <span className={`font-black text-xs ${projCoverage >= 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                              {projCoverage}%
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right font-mono font-semibold text-slate-600">
                          {remainingDisplay}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Commercial Activity Coverage Table */}
      {activeTab === 'COVERAGE' && (
        <div className="space-y-6">
          {/* Coverage Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Target-Period Projects</span>
              <div className="mt-2">
                <div className="text-2xl font-black text-slate-900 font-['Hanken_Grotesk']">
                  {coverageData?.summary?.eligibleTargetPeriodProjects ?? '-'}
                </div>
                <div className="text-[11px] text-slate-600 font-medium mt-1">
                  Open commercial deals closing in period
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                Pace: {coverageData?.summary?.linearPace?.elapsedPeriodPercent ?? 0}% calendar elapsed
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Next Action Coverage</span>
              <div className="mt-2">
                <div className="text-2xl font-black text-indigo-600 font-['Hanken_Grotesk']">
                  {coverageData?.summary?.nextActionCoveragePercent !== null && coverageData?.summary?.nextActionCoveragePercent !== undefined
                    ? `${coverageData.summary.nextActionCoveragePercent}%`
                    : 'N/A'}
                </div>
                <div className="text-[11px] text-slate-600 font-medium mt-1">
                  {coverageData?.summary?.projectsWithNextAction ?? 0} with action / {coverageData?.summary?.projectsMissingNextAction ?? 0} missing action
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                {coverageData?.summary?.projectsMissingNextAction === 0 ? '✓ Full action coverage' : '⚠️ Action gap exists'}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Overdue Actions</span>
              <div className="mt-2">
                <div className="text-2xl font-black text-rose-600 font-['Hanken_Grotesk']">
                  {coverageData?.summary?.overdueActionsCount ?? 0}
                </div>
                <div className="text-[11px] text-rose-700 font-medium mt-1">
                  Across {coverageData?.summary?.projectsWithOverdueActions ?? 0} open projects
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                Past due tasks, visits, follow-ups
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Covered Pipeline Value</span>
              <div className="mt-2">
                <div className="text-xl font-black text-emerald-600 font-['Hanken_Grotesk'] truncate">
                  {coverageData?.summary?.isCoverageAvailable ? formatCurrency(coverageData.summary.coveredWeightedPipelineValue || 0) : 'Unavailable'}
                </div>
                <div className="text-[11px] text-slate-600 font-medium mt-1">
                  Uncovered: {formatCurrency(coverageData?.summary?.uncoveredWeightedPipelineValue || 0)}
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                Weighted pipeline with active Next Action
              </div>
            </div>
          </div>

          {/* Project Details Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-slate-900 font-['Hanken_Grotesk']">
                Target-Period Commercial Pipeline Activity Coverage
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {coverageData?.period?.isCoverageAvailable ? `${coverageData?.projects?.length || 0} Open Deals` : 'Historical Period Completed'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-900">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                  <tr>
                    <th className="px-5 py-3.5">Project / Customer</th>
                    <th className="px-5 py-3.5">Assigned Rep</th>
                    <th className="px-5 py-3.5">Stage / Close Date</th>
                    <th className="px-5 py-3.5">Pipeline Value</th>
                    <th className="px-5 py-3.5">Next Action</th>
                    <th className="px-5 py-3.5">Overdue Work</th>
                    <th className="px-5 py-3.5 text-right">Cadence State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-400">Loading coverage details from database...</td>
                    </tr>
                  ) : coverageData?.projects?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-400">No open projects expected to close in this period.</td>
                    </tr>
                  ) : (
                    coverageData?.projects?.map((p: any) => {
                      return (
                        <tr key={p.projectId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-bold text-sm text-slate-900">{p.projectTitle}</div>
                            <div className="text-[11px] text-slate-500">{p.customerName}</div>
                          </td>

                          <td className="px-5 py-4 font-medium text-slate-800">
                            {p.picName}
                            {p.isPicInvalid && (
                              <span className="ml-1.5 px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-bold rounded">
                                Invalid PIC
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md">
                              {p.stageId}
                            </span>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {p.expectedCloseDate ? String(p.expectedCloseDate).slice(0, 10) : 'No date'}
                            </div>
                          </td>

                          <td className="px-5 py-4 font-mono font-bold text-slate-900">
                            {formatCurrency(p.value)}
                            <div className="text-[11px] text-indigo-600 font-semibold">
                              {p.probability !== null ? `${p.probability}% (${formatCurrency(p.weightedValue)})` : 'No prob'}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            {p.hasNextAction ? (
                              <div>
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md border border-emerald-200">
                                  {p.nextAction?.type || 'ACTION'}: {p.nextAction?.title || 'Scheduled'}
                                </span>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  Due: {p.nextAction?.date || '-'}
                                </div>
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-bold rounded-md border border-amber-200">
                                ⚠️ Missing Next Action
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            {p.hasOverdueAction ? (
                              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-md border border-rose-200">
                                {p.overdueActionsCount} overdue action{p.overdueActionsCount > 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">None</span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-right">
                            {p.hasActiveCadence ? (
                              p.isCadenceBlocked ? (
                                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-md">
                                  Blocked Cadence
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md">
                                  Active Cadence
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-lg font-black text-slate-900 font-['Hanken_Grotesk']">
                Assign Sales Target Quota
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateTarget} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Scope</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalScope('USER')}
                    className={`py-2 text-xs font-bold rounded-xl border ${
                      modalScope === 'USER'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Sales Representative
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalScope('TEAM')}
                    className={`py-2 text-xs font-bold rounded-xl border ${
                      modalScope === 'TEAM'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Team Quota
                  </button>
                </div>
              </div>

              {modalScope === 'USER' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Sales Representative</label>
                  <select
                    value={modalTenantUserId}
                    onChange={(e) => setModalTenantUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white font-bold text-slate-800 focus:outline-indigo-500"
                  >
                    {attainmentData?.repAttainment?.map((r) => (
                      <option key={r.tenantUserId} value={r.tenantUserId}>
                        {r.name} ({r.teamName})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Team</label>
                  <select
                    value={modalTeamId}
                    onChange={(e) => setModalTeamId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white font-bold text-slate-800 focus:outline-indigo-500"
                  >
                    {attainmentData?.teamAttainment?.map((tm) => (
                      <option key={tm.teamId} value={tm.teamId}>
                        {tm.teamName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Value {targetType === 'WON_PROJECT_VALUE' ? '(IDR)' : '(Project Count)'}
                </label>
                <input
                  type="number"
                  min="1"
                  step={targetType === 'WON_PROJECT_COUNT' ? '1' : '1000'}
                  value={modalTargetValue}
                  onChange={(e) => setModalTargetValue(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div>
                  <span className="font-bold block text-[10px] uppercase">Period Start</span>
                  <span className="font-mono text-slate-800 font-bold">{periodStart}</span>
                </div>
                <div>
                  <span className="font-bold block text-[10px] uppercase">Period End</span>
                  <span className="font-mono text-slate-800 font-bold">{periodEnd}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving Target...' : 'Save Target Quota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/crmApi';

export const SalesReportPage: React.FC = () => {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';

  const [dateRange, setDateRange] = useState('YTD');
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await crmApi.fetchSalesReport(tenantId);
      if (data) {
        setReportData(data);
      } else {
        setError('Failed to load sales report.');
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

  const formatCurrency = (val: number) => `$${(val / 1000).toFixed(0)}k`;
  const formatFullCurrency = (val: number) => `$${Number(val || 0).toLocaleString()}`;

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'WON': return 'bg-emerald-100 text-emerald-700';
      case 'LOST': return 'bg-rose-100 text-rose-700';
      case 'OPEN': return 'bg-indigo-100 text-indigo-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStageColor = (stage: string) => {
    if ((stage || '').includes('Won')) return 'text-emerald-600';
    if ((stage || '').includes('Lost')) return 'text-rose-600';
    return 'text-indigo-600';
  };

  const kpi = reportData?.kpi || {
    totalProjects: 0,
    wonProjects: 0,
    lostProjects: 0,
    openProjects: 0,
    pipelineValue: 0,
    wonValue: 0,
    weightedPipeline: 0,
    conversionRate: 0
  };

  const salesPipelineData = reportData?.salesPipeline || [];
  const salesByEmployeeData = reportData?.salesByEmployee || [];
  const oppConversionData = reportData?.oppConversion || [];
  const tableData = reportData?.tableData || [];

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-10">
      
      {/* Header & Filter Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
              Sales Report
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Authoritative database pipeline, revenue, and conversion metrics.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={loadData} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
          Loading sales report from database...
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
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Pipeline Value</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{formatFullCurrency(kpi.pipelineValue)}</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 font-medium">Weighted: {formatFullCurrency(kpi.weightedPipeline)}</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Won Revenue</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-emerald-600 font-['Hanken_Grotesk']">{formatFullCurrency(kpi.wonValue)}</span>
              </div>
              <div className="mt-2 text-[11px] text-emerald-600 font-bold">{kpi.wonProjects} deals closed won</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Deals</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpi.totalProjects}</span>
              </div>
              <div className="mt-2 text-[11px] text-indigo-600 font-bold">{kpi.openProjects} open in pipeline</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Win Rate / Conversion</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-indigo-600 font-['Hanken_Grotesk']">{kpi.conversionRate}%</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 font-medium">{kpi.lostProjects} deals marked lost</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Sales Pipeline Stage Bar */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-4">Pipeline by Stage</h2>
              {salesPipelineData.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">No project stage data recorded in database.</div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesPipelineData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#4744e5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Sales by PIC */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-4">Pipeline by Representative / PIC</h2>
              {salesByEmployeeData.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">No sales representative pipeline data in database.</div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesByEmployeeData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip />
                      <Bar dataKey="sales" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

          </div>

          {/* Scoped Projects Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-bold text-xs text-slate-900">
              Operational Deals / Projects ({tableData.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                    <th className="px-4 py-3">Deal Name</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">PIC</th>
                    <th className="px-4 py-3 text-right">Value</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No deals match the authorized data scope.
                      </td>
                    </tr>
                  ) : (
                    tableData.map((d: any) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-900">{d.name}</td>
                        <td className="px-4 py-3 text-slate-600">{d.customer || 'Unassigned'}</td>
                        <td className="px-4 py-3 font-semibold text-indigo-600">{d.stage}</td>
                        <td className="px-4 py-3 text-slate-700">{d.pic || 'Unassigned'}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">{formatFullCurrency(d.value)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadge(d.status || d.stage)}`}>
                            {d.status || d.stage}
                          </span>
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

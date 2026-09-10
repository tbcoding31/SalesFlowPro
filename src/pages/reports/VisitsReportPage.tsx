import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/crmApi';

export const VisitsReportPage: React.FC = () => {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState('THIS_MONTH');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [picFilter, setPicFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [purposeFilter, setPurposeFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await crmApi.fetchVisitReport(tenantId);
      if (data) {
        setReportData(data);
      } else {
        setError('Failed to load visit report.');
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

  const kpiData = reportData?.kpi || {
    totalVisits: 0,
    completed: 0,
    cancelled: 0,
    rescheduled: 0,
    completionRate: 0
  };

  const visitsByPicData = reportData?.visitsByPicData || [];
  const visitsByStatusData = reportData?.visitsByStatusData || [];
  const visitsByPurposeData = reportData?.visitsByPurposeData || [];
  const rawTableData: any[] = reportData?.tableData || [];

  // Dynamic filter options
  const uniquePics = useMemo(() => {
    const set = new Set<string>();
    rawTableData.forEach(r => { if (r.pic && r.pic !== 'Unassigned') set.add(r.pic); });
    return Array.from(set).sort();
  }, [rawTableData]);

  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>();
    rawTableData.forEach(r => { if (r.customer && r.customer !== 'Direct') set.add(r.customer); });
    return Array.from(set).sort();
  }, [rawTableData]);

  const uniquePurposes = useMemo(() => {
    const set = new Set<string>();
    rawTableData.forEach(r => { if (r.purpose) set.add(r.purpose); });
    return Array.from(set).sort();
  }, [rawTableData]);

  const filteredTableData = useMemo(() => {
    return rawTableData.filter(row => {
      if (picFilter !== 'ALL' && row.pic !== picFilter) return false;
      if (customerFilter !== 'ALL' && row.customer !== customerFilter) return false;
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      if (purposeFilter !== 'ALL' && row.purpose !== purposeFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const idMatch = row.id?.toLowerCase().includes(q);
        const custMatch = row.customer?.toLowerCase().includes(q);
        const picMatch = row.pic?.toLowerCase().includes(q);
        const resMatch = row.result?.toLowerCase().includes(q);
        if (!idMatch && !custMatch && !picMatch && !resMatch) return false;
      }
      return true;
    });
  }, [rawTableData, picFilter, customerFilter, statusFilter, purposeFilter, searchTerm]);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-700';
      case 'CANCELLED': return 'bg-rose-100 text-rose-700';
      case 'RESCHEDULED': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-10">
      
      {/* Header & Filter Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
              Visit Report
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Analyze team field activities, visit outcomes, and completion rates.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={loadData}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-4 border-t border-slate-100">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="Q3">Q3 2026</option>
              <option value="YTD">Year to Date</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Customer</label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
              <option value="ALL">All Customers</option>
              {uniqueCustomers.map(cust => (
                <option key={cust} value={cust}>{cust}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">PIC (Employee)</label>
            <select
              value={picFilter}
              onChange={(e) => setPicFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
              <option value="ALL">All Employees</option>
              {uniquePics.map(pic => (
                <option key={pic} value={pic}>{pic}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="RESCHEDULED">Rescheduled</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Visit Purpose</label>
            <select
              value={purposeFilter}
              onChange={(e) => setPurposeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
              <option value="ALL">All Purposes</option>
              {uniquePurposes.map(purp => (
                <option key={purp} value={purp}>{purp}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
          Loading visit report from database...
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
          {/* KPI Cards (5 Metrics) */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Visits */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Visits</span>
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-blue-600">location_on</span>
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.totalVisits}</div>
            </div>

            {/* Completed */}
            <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500"></div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Completed</span>
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                </div>
              </div>
              <div className="text-2xl font-extrabold text-emerald-700 font-['Hanken_Grotesk']">{kpiData.completed}</div>
            </div>

            {/* Cancelled */}
            <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Cancelled</span>
                <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-rose-600">cancel</span>
                </div>
              </div>
              <div className="text-2xl font-extrabold text-rose-700 font-['Hanken_Grotesk']">{kpiData.cancelled}</div>
            </div>

            {/* Rescheduled */}
            <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Rescheduled</span>
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-amber-600">edit_calendar</span>
                </div>
              </div>
              <div className="text-2xl font-extrabold text-amber-700 font-['Hanken_Grotesk']">{kpiData.rescheduled}</div>
            </div>

            {/* Completion Rate */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completion Rate</span>
                <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-purple-600">data_exploration</span>
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.completionRate}%</div>
            </div>
          </div>

          {/* Analytics Charts 2x2 Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Visits by PIC */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Visits by PIC</h2>
              <div className="h-64">
                {visitsByPicData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={visitsByPicData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <Tooltip 
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="visits" name="Visits" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">No representative visit data</div>
                )}
              </div>
            </div>

            {/* Visits by Status */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Visits by Status</h2>
              <div className="h-64 flex items-center justify-center relative">
                {visitsByStatusData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={visitsByStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {visitsByStatusData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] leading-none">{kpiData.totalVisits}</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Total Visits</span>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">No visit status data</div>
                )}
              </div>
            </div>

            {/* Visits by Purpose */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Visits by Purpose</h2>
              <div className="h-64 flex items-center justify-center relative">
                {visitsByPurposeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={visitsByPurposeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {visitsByPurposeData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">No visit purpose data</div>
                )}
              </div>
            </div>

            {/* Completion Summary Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-2">Visit Completion Efficiency</h2>
              <p className="text-xs text-slate-500 mb-6 text-center">Percentage of executed visits against scheduled targets</p>
              <div className="text-5xl font-black text-indigo-600 font-['Hanken_Grotesk']">{kpiData.completionRate}%</div>
              <div className="mt-4 flex items-center gap-4 text-xs font-bold text-slate-600">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>{kpiData.completed} Completed</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>{kpiData.cancelled} Cancelled</span>
              </div>
            </div>

          </div>

          {/* Detailed Visits Data Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 font-['Hanken_Grotesk']">Detailed Visit Log</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Showing {filteredTableData.length} records</p>
              </div>
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search visits..." 
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">PIC</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Purpose</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Status</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Duration</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Result / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTableData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-xs text-slate-400">
                        No visits match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTableData.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm text-slate-900">{row.date}</div>
                          <div className="text-xs text-slate-500 font-medium">{row.id}</div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-700 text-sm">{row.customer}</td>
                        <td className="px-6 py-4">
                          <div className="inline-flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                              {(row.pic || 'U').charAt(0)}
                            </div>
                            <span className="font-bold text-sm text-slate-700">{row.pic}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-600 text-sm">
                          {row.purpose}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-md ${getStatusBadge(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-slate-700 text-sm">
                          {row.duration}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-600 text-sm truncate max-w-xs" title={row.result}>
                          {row.result}
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

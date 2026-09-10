import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/crmApi';

export const TaskReportPage: React.FC = () => {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState('THIS_MONTH');
  const [picFilter, setPicFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await crmApi.fetchTaskReport(tenantId);
      if (data) {
        setReportData(data);
      } else {
        setError('Failed to load task report.');
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
    totalTasks: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0,
    completionRate: 0
  };

  const taskCompletionData = reportData?.taskCompletionData || [];
  const tasksByPicData = reportData?.tasksByPicData || [];
  const tasksByPriorityData = reportData?.tasksByPriorityData || [];
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

  const filteredTableData = useMemo(() => {
    return rawTableData.filter(row => {
      if (picFilter !== 'ALL' && row.pic !== picFilter) return false;
      if (customerFilter !== 'ALL' && row.customer !== customerFilter) return false;
      if (priorityFilter !== 'ALL' && row.priority !== priorityFilter) return false;
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const nameMatch = row.name?.toLowerCase().includes(q);
        const idMatch = row.id?.toLowerCase().includes(q);
        const custMatch = row.customer?.toLowerCase().includes(q);
        if (!nameMatch && !idMatch && !custMatch) return false;
      }
      return true;
    });
  }, [rawTableData, picFilter, customerFilter, priorityFilter, statusFilter, searchTerm]);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-700';
      case 'OVERDUE': return 'bg-rose-100 text-rose-700 border border-rose-200 shadow-[0_0_8px_rgba(225,29,72,0.4)]';
      case 'IN_PROGRESS': return 'bg-indigo-100 text-indigo-700';
      case 'TODO': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch(priority) {
      case 'High': return 'text-rose-600 bg-rose-50 border border-rose-100';
      case 'Medium': return 'text-amber-600 bg-amber-50 border border-amber-100';
      case 'Low': return 'text-blue-600 bg-blue-50 border border-blue-100';
      default: return 'text-slate-600 bg-slate-50 border border-slate-100';
    }
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-10">
      
      {/* Header & Filter Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
              Task Report
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Monitor task execution, team workloads, and identify overdue activities.
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
            <label className="text-xs font-bold text-slate-500 uppercase">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
              <option value="ALL">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
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
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
          Loading task report from database...
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
            {/* Total Tasks */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Tasks</span>
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-blue-600">task</span>
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.totalTasks}</div>
            </div>

            {/* Completed */}
            <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500"></div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Completed</span>
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">task_alt</span>
                </div>
              </div>
              <div className="text-2xl font-extrabold text-emerald-700 font-['Hanken_Grotesk']">{kpiData.completed}</div>
            </div>

            {/* In Progress */}
            <div className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">In Progress</span>
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-indigo-600">pending_actions</span>
                </div>
              </div>
              <div className="text-2xl font-extrabold text-indigo-700 font-['Hanken_Grotesk']">{kpiData.inProgress}</div>
            </div>

            {/* Overdue */}
            <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm flex flex-col justify-between relative shadow-[0_0_15px_rgba(225,29,72,0.15)] ring-1 ring-rose-500/20">
              <div className="absolute top-0 right-0 w-1 h-full bg-rose-500"></div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Overdue</span>
                <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-rose-600">alarm_off</span>
                </div>
              </div>
              <div className="text-2xl font-extrabold text-rose-700 font-['Hanken_Grotesk']">{kpiData.overdue}</div>
            </div>

            {/* Completion Rate */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completion Rate</span>
                <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-purple-600">percent</span>
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.completionRate}%</div>
            </div>
          </div>

          {/* Analytics Charts 2x2 Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Task Completion */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Task Completion (Weekly)</h2>
              <div className="h-64">
                {taskCompletionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={taskCompletionData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <Tooltip 
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                      <Bar dataKey="scheduled" name="Scheduled" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar dataKey="completed" name="Completed" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">No task completion data</div>
                )}
              </div>
            </div>

            {/* Tasks by PIC */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Tasks by PIC</h2>
              <div className="h-64">
                {tasksByPicData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tasksByPicData} layout="vertical" margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                      <Tooltip 
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                      <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} stackId="a" />
                      <Bar dataKey="overdue" name="Overdue" fill="#f43f5e" radius={[4, 4, 4, 4]} barSize={16} stackId="b" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">No team assignment data</div>
                )}
              </div>
            </div>

            {/* Tasks by Priority */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Tasks by Priority</h2>
              <div className="h-64 flex items-center justify-center relative">
                {tasksByPriorityData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={tasksByPriorityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {tasksByPriorityData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] leading-none">{kpiData.totalTasks}</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Total Tasks</span>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">No priority distribution data</div>
                )}
              </div>
            </div>

            {/* Total Completion Summary */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-2">Completion Efficiency</h2>
              <p className="text-xs text-slate-500 mb-6 text-center">Percentage of tasks resolved against overdue tasks</p>
              <div className="text-5xl font-black text-indigo-600 font-['Hanken_Grotesk']">{kpiData.completionRate}%</div>
              <div className="mt-4 flex items-center gap-4 text-xs font-bold text-slate-600">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>{kpiData.completed} Completed</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>{kpiData.overdue} Overdue</span>
              </div>
            </div>

          </div>

          {/* Detailed Tasks Data Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 font-['Hanken_Grotesk']">Detailed Task List</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Showing {filteredTableData.length} records</p>
              </div>
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search tasks..." 
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Task</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">PIC</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Priority</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Status</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Completed Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTableData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-xs text-slate-400">
                        No tasks match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTableData.map((row) => {
                      const isOverdue = row.status === 'OVERDUE';
                      return (
                        <tr key={row.id} className={`transition-colors ${isOverdue ? 'bg-rose-50/30 hover:bg-rose-50/60' : 'hover:bg-slate-50'}`}>
                          <td className="px-6 py-4">
                            <div className={`font-bold text-sm ${isOverdue ? 'text-rose-900' : 'text-slate-900'}`}>{row.name}</div>
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
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-md ${getPriorityBadge(row.priority)}`}>
                              {row.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-md ${getStatusBadge(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className={`px-6 py-4 font-bold text-sm ${isOverdue ? 'text-rose-600' : 'text-slate-600'}`}>
                            {row.dueDate}
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-600 text-sm">
                            {row.completedDate}
                          </td>
                        </tr>
                      );
                    })
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

import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';

// Mock Data
const kpiData = {
  totalTasks: 412,
  completed: 289,
  inProgress: 85,
  overdue: 38,
  completionRate: 70.1 // %
};

const taskCompletionData = [
  { name: 'Mon', completed: 45, scheduled: 50 },
  { name: 'Tue', completed: 52, scheduled: 55 },
  { name: 'Wed', completed: 48, scheduled: 55 },
  { name: 'Thu', completed: 60, scheduled: 65 },
  { name: 'Fri', completed: 40, scheduled: 45 },
  { name: 'Sat', completed: 25, scheduled: 30 },
  { name: 'Sun', completed: 19, scheduled: 20 }
];

const tasksByPicData = [
  { name: 'Citra', tasks: 110, completed: 85, overdue: 5 },
  { name: 'Ahmad', tasks: 95, completed: 70, overdue: 12 },
  { name: 'Dian', tasks: 85, completed: 60, overdue: 8 },
  { name: 'Budi', tasks: 75, completed: 50, overdue: 10 },
  { name: 'Eka', tasks: 47, completed: 24, overdue: 3 }
];

const tasksByPriorityData = [
  { name: 'High', value: 120, color: '#ef4444' },
  { name: 'Medium', value: 185, color: '#f59e0b' },
  { name: 'Low', value: 107, color: '#3b82f6' }
];

const overdueTrendData = [
  { name: 'Week 1', overdue: 12 },
  { name: 'Week 2', overdue: 18 },
  { name: 'Week 3', overdue: 14 },
  { name: 'Week 4', overdue: 25 },
  { name: 'Week 5', overdue: 38 }
];

const tableData = [
  { id: 'TSK-3001', name: 'Follow up on proposal', customer: 'TechCorp Ind', pic: 'Citra', priority: 'High', status: 'COMPLETED', dueDate: '2026-08-10', completedDate: '2026-08-10' },
  { id: 'TSK-3002', name: 'Prepare presentation deck', customer: 'Global Logistics', pic: 'Ahmad', priority: 'High', status: 'OVERDUE', dueDate: '2026-08-11', completedDate: '-' },
  { id: 'TSK-3003', name: 'Send revised contract', customer: 'Finance Bank', pic: 'Dian', priority: 'Medium', status: 'IN_PROGRESS', dueDate: '2026-08-14', completedDate: '-' },
  { id: 'TSK-3004', name: 'Product demo setup', customer: 'Retail Hub', pic: 'Budi', priority: 'Low', status: 'COMPLETED', dueDate: '2026-08-08', completedDate: '2026-08-08' },
  { id: 'TSK-3005', name: 'Weekly sync with client', customer: 'EduTech Inc', pic: 'Citra', priority: 'Medium', status: 'OVERDUE', dueDate: '2026-08-12', completedDate: '-' },
  { id: 'TSK-3006', name: 'Negotiate SLA terms', customer: 'HealthPlus', pic: 'Ahmad', priority: 'High', status: 'COMPLETED', dueDate: '2026-08-09', completedDate: '2026-08-09' },
  { id: 'TSK-3007', name: 'Onboarding training', customer: 'Startup XYZ', pic: 'Dian', priority: 'Medium', status: 'IN_PROGRESS', dueDate: '2026-08-15', completedDate: '-' },
];

export const TaskReportPage: React.FC = () => {
  const [dateRange, setDateRange] = useState('THIS_MONTH');
  const [picFilter, setPicFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-700';
      case 'OVERDUE': return 'bg-rose-100 text-rose-700 border border-rose-200 shadow-[0_0_8px_rgba(225,29,72,0.4)]'; // Highlighted overdue
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
            <button className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">print</span>
              Print
            </button>
            <button className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">download</span>
              Export
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
              <option value="CITRA">Citra</option>
              <option value="AHMAD">Ahmad</option>
              <option value="DIAN">Dian</option>
              <option value="BUDI">Budi</option>
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
              <option value="TECHCORP">TechCorp Ind</option>
              <option value="GLOBAL">Global Logistics</option>
              <option value="FINANCE">Finance Bank</option>
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
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
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
          </div>
        </div>

        {/* Tasks by PIC */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Tasks by PIC</h2>
          <div className="h-64">
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
          </div>
        </div>

        {/* Tasks by Priority */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Tasks by Priority</h2>
          <div className="h-64 flex items-center justify-center relative">
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
                  {tasksByPriorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center text for Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] leading-none">{kpiData.totalTasks}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Total Tasks</span>
            </div>
            
            {/* Legend Overlay */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-3">
              {tasksByPriorityData.map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <div className="text-xs font-medium text-slate-600">{item.name}</div>
                  <div className="text-xs font-bold text-slate-900 ml-2">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Overdue Trend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Overdue Trend</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overdueTrendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOverdue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value} Tasks`, 'Overdue']}
                />
                <Area type="monotone" dataKey="overdue" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorOverdue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Detailed Tasks Data Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-extrabold text-slate-900 font-['Hanken_Grotesk']">Detailed Task List</h2>
          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
            <input 
              type="text" 
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
              {tableData.map((row) => {
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
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

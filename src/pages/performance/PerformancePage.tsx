import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend 
} from 'recharts';

// Mock Data
const kpiData = {
  visits: 142,
  completedVisits: 120,
  tasksCompleted: 89,
  overdueTasks: 12,
  wonProjects: 28,
  salesValue: 1250000, // $1.25M
  conversionRate: 24.5
};

const visitCompletionData = [
  { name: 'Mon', scheduled: 25, completed: 20 },
  { name: 'Tue', scheduled: 30, completed: 28 },
  { name: 'Wed', scheduled: 28, completed: 25 },
  { name: 'Thu', scheduled: 35, completed: 30 },
  { name: 'Fri', scheduled: 24, completed: 17 }
];

const taskCompletionData = [
  { name: 'Ahmad', completed: 24, overdue: 2 },
  { name: 'Budi', completed: 18, overdue: 0 },
  { name: 'Citra', completed: 29, overdue: 3 },
  { name: 'Dian', completed: 18, overdue: 7 }
];

const oppConversionData = [
  { name: 'Won', value: 28, color: '#10b981' },
  { name: 'Lost', value: 12, color: '#ef4444' },
  { name: 'Open', value: 74, color: '#6366f1' }
];

const salesValueData = [
  { name: 'Week 1', value: 250000 },
  { name: 'Week 2', value: 380000 },
  { name: 'Week 3', value: 310000 },
  { name: 'Week 4', value: 520000 }
];

const rankingData = [
  { id: 1, name: 'Citra', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80', visits: 35, tasks: 29, projects: 14, won: 6, salesValue: 480000 },
  { id: 2, name: 'Ahmad', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80', visits: 32, tasks: 24, projects: 12, won: 5, salesValue: 350000 },
  { id: 3, name: 'Dian', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80', visits: 25, tasks: 18, projects: 9, won: 3, salesValue: 210000 },
  { id: 4, name: 'Budi', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80', visits: 28, tasks: 18, projects: 8, won: 2, salesValue: 180000 }
];

const formatCurrency = (val: number) => `$${(val / 1000).toFixed(0)}k`;

export const PerformancePage: React.FC = () => {
  const [dateRange, setDateRange] = useState('THIS_MONTH');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [employeeFilter, setEmployeeFilter] = useState('ALL');

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-10">
      
      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
            Team Performance
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Analyze key metrics, conversion rates, and team leaderboard.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none relative"
          >
            <option value="TODAY">Today</option>
            <option value="THIS_WEEK">This Week</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="Q3_2026">Q3 2026</option>
          </select>

          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
          >
            <option value="ALL">All Teams</option>
            <option value="ENTERPRISE">Enterprise Sales</option>
            <option value="SMB">SMB Sales</option>
          </select>

          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
          >
            <option value="ALL">All Employees</option>
            <option value="CITRA">Citra</option>
            <option value="AHMAD">Ahmad</option>
            <option value="DIAN">Dian</option>
            <option value="BUDI">Budi</option>
          </select>
        </div>
      </div>

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
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Won Opps</span>
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
            ${(kpiData.salesValue / 1000000).toFixed(2)}M
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-2 md:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Conversion Rate</span>
            <span className="material-symbols-outlined text-[18px] text-purple-500">trending_up</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.conversionRate}%</div>
        </div>
      </div>

      {/* Analytics Charts 2x2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Visit Completion */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Visit Completion</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visitCompletionData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                <Bar dataKey="scheduled" name="Scheduled" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="completed" name="Completed" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Task Completion */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Task Completion by Rep</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskCompletionData} layout="vertical" margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
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

        {/* Project Conversion */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Project Conversion</h2>
          <div className="h-64 flex items-center justify-center relative">
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
                  {oppConversionData.map((entry, index) => (
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
              <span className="text-3xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] leading-none">114</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Total Opps</span>
            </div>
            
            {/* Legend Overlay */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-3">
              {oppConversionData.map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <div className="text-xs font-medium text-slate-600">{item.name}</div>
                  <div className="text-xs font-bold text-slate-900 ml-2">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sales Value */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Sales Value Trend</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesValueData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  formatter={(value: number) => [`$${(value).toLocaleString()}`, 'Sales Value']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Team Ranking Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-extrabold text-slate-900 font-['Hanken_Grotesk']">Leaderboard & Ranking</h2>
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
              {rankingData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-center">
                    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                      row.id === 1 ? 'bg-amber-100 text-amber-700' :
                      row.id === 2 ? 'bg-slate-200 text-slate-700' :
                      row.id === 3 ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-50 text-slate-500'
                    }`}>
                      #{row.id}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={row.avatar} alt={row.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                      <span className="font-bold text-sm text-slate-900">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-slate-700">{row.visits}</td>
                  <td className="px-6 py-4 text-center font-bold text-slate-700">{row.tasks}</td>
                  <td className="px-6 py-4 text-center font-bold text-slate-700">{row.projects}</td>
                  <td className="px-6 py-4 text-center font-bold text-emerald-600">{row.won}</td>
                  <td className="px-6 py-4 text-right font-extrabold text-slate-900 font-['Hanken_Grotesk']">
                    ${row.salesValue.toLocaleString()}
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

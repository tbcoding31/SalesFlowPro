import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';

// Mock Data
const kpiData = {
  totalCustomers: 156,
  newCustomers: 24,
  activeCustomers: 118,
  inactiveCustomers: 14,
  prospects: 38,
  wonCustomers: 118
};

const customersByStatusData = [
  { name: 'Active', value: 118, color: '#10b981' },
  { name: 'Prospect', value: 38, color: '#f59e0b' },
  { name: 'Inactive', value: 14, color: '#94a3b8' }
];

const customersByPicData = [
  { name: 'Citra', customers: 45 },
  { name: 'Ahmad', customers: 38 },
  { name: 'Dian', customers: 32 },
  { name: 'Budi', customers: 25 },
  { name: 'Eka', customers: 16 }
];

const newCustomersTrendData = [
  { name: 'Jan', new: 4 },
  { name: 'Feb', new: 7 },
  { name: 'Mar', new: 5 },
  { name: 'Apr', new: 12 },
  { name: 'May', new: 8 },
  { name: 'Jun', new: 15 },
  { name: 'Jul', new: 24 }
];

const customerActivityData = [
  { name: 'Week 1', visits: 12, tasks: 25, followups: 15 },
  { name: 'Week 2', visits: 18, tasks: 30, followups: 22 },
  { name: 'Week 3', visits: 15, tasks: 28, followups: 18 },
  { name: 'Week 4', visits: 22, tasks: 35, followups: 28 },
  { name: 'Week 5', visits: 28, tasks: 42, followups: 35 }
];

const tableData = [
  { id: 'CUST-001', name: 'TechCorp Ind', status: 'ACTIVE', pic: 'Citra', visits: 12, tasks: 24, followups: 8, projects: 3, lastActivity: '2026-08-12' },
  { id: 'CUST-002', name: 'Global Logistics', status: 'WON', pic: 'Ahmad', visits: 8, tasks: 15, followups: 5, projects: 1, lastActivity: '2026-08-11' },
  { id: 'CUST-003', name: 'Finance Bank', status: 'PROSPECT', pic: 'Dian', visits: 4, tasks: 12, followups: 6, projects: 2, lastActivity: '2026-08-10' },
  { id: 'CUST-004', name: 'Retail Hub', status: 'ACTIVE', pic: 'Budi', visits: 15, tasks: 30, followups: 12, projects: 4, lastActivity: '2026-08-12' },
  { id: 'CUST-005', name: 'EduTech Inc', status: 'INACTIVE', pic: 'Citra', visits: 2, tasks: 5, followups: 1, projects: 0, lastActivity: '2026-07-15' },
  { id: 'CUST-006', name: 'HealthPlus', status: 'WON', pic: 'Ahmad', visits: 6, tasks: 18, followups: 7, projects: 2, lastActivity: '2026-08-09' },
  { id: 'CUST-007', name: 'Startup XYZ', status: 'PROSPECT', pic: 'Dian', visits: 5, tasks: 14, followups: 9, projects: 1, lastActivity: '2026-08-08' },
];

export const CustomerReportPage: React.FC = () => {
  const [dateRange, setDateRange] = useState('THIS_MONTH');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [picFilter, setPicFilter] = useState('ALL');

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'ACTIVE': return 'bg-emerald-100 text-emerald-700';
      case 'WON': return 'bg-indigo-100 text-indigo-700';
      case 'PROSPECT': return 'bg-amber-100 text-amber-700';
      case 'INACTIVE': return 'bg-slate-100 text-slate-700';
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
              Customer Report
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Analyze customer growth, engagement activity, and portfolio health.
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
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
            <label className="text-xs font-bold text-slate-500 uppercase">Customer Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PROSPECT">Prospect</option>
              <option value="INACTIVE">Inactive</option>
              <option value="WON">Won</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Customer Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
              <option value="ALL">All Types</option>
              <option value="ENTERPRISE">Enterprise</option>
              <option value="SMB">SMB</option>
              <option value="GOVERNMENT">Government</option>
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
        </div>
      </div>

      {/* KPI Cards (6 Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Customers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-blue-600">groups</span>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.totalCustomers}</div>
        </div>

        {/* New Customers */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500"></div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">New</span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-emerald-600">person_add</span>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 font-['Hanken_Grotesk']">{kpiData.newCustomers}</div>
        </div>

        {/* Active Customers */}
        <div className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Active</span>
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-indigo-600">how_to_reg</span>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-indigo-700 font-['Hanken_Grotesk']">{kpiData.activeCustomers}</div>
        </div>
        
        {/* Prospects */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Prospects</span>
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-amber-600">radar</span>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-700 font-['Hanken_Grotesk']">{kpiData.prospects}</div>
        </div>

        {/* Won Customers */}
        <div className="bg-white p-5 rounded-2xl border border-purple-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Won</span>
            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-purple-600">workspace_premium</span>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-purple-700 font-['Hanken_Grotesk']">{kpiData.wonCustomers}</div>
        </div>

        {/* Inactive Customers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Inactive</span>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-slate-500">person_off</span>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.inactiveCustomers}</div>
        </div>
      </div>

      {/* Analytics Charts 2x2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Customers by Status */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Customers by Status</h2>
          <div className="h-64 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={customersByStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {customersByStatusData.map((entry, index) => (
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
              <span className="text-3xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] leading-none">{kpiData.totalCustomers}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Total</span>
            </div>
            
            {/* Legend Overlay */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-3">
              {customersByStatusData.map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <div className="text-xs font-medium text-slate-600">{item.name}</div>
                  <div className="text-xs font-bold text-slate-900 ml-2">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Customers by PIC */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Customers by PIC</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customersByPicData} layout="vertical" margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value} Customers`, 'Portfolio Size']}
                />
                <Bar dataKey="customers" name="Customers" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* New Customers Trend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">New Customers Trend</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={newCustomersTrendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNewCust" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value} New`, 'Acquired']}
                />
                <Area type="monotone" dataKey="new" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorNewCust)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Customer Activity */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Customer Activity</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customerActivityData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="visits" name="Visits" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} barSize={20} />
                <Bar dataKey="followups" name="Follow-ups" fill="#8b5cf6" stackId="a" radius={[0, 0, 0, 0]} barSize={20} />
                <Bar dataKey="tasks" name="Tasks" fill="#f59e0b" stackId="a" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Detailed Customers Data Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-extrabold text-slate-900 font-['Hanken_Grotesk']">Customer Directory</h2>
          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
            <input 
              type="text" 
              placeholder="Search customers..." 
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">PIC</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Visits</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Tasks</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Follow-ups</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Opps</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-sm text-slate-900">{row.name}</div>
                    <div className="text-xs text-slate-500 font-medium">{row.id}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-md ${getStatusBadge(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                        {(row.pic || 'U').charAt(0)}
                      </div>
                      <span className="font-bold text-sm text-slate-700">{row.pic}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-medium text-slate-700 text-sm">{row.visits}</td>
                  <td className="px-6 py-4 text-center font-medium text-slate-700 text-sm">{row.tasks}</td>
                  <td className="px-6 py-4 text-center font-medium text-slate-700 text-sm">{row.followups}</td>
                  <td className="px-6 py-4 text-center font-medium text-slate-700 text-sm">{row.projects}</td>
                  <td className="px-6 py-4 font-medium text-slate-600 text-sm">{row.lastActivity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend 
} from 'recharts';

// Mock Data
const kpiData = {
  totalProjects: 124,
  wonProjects: 32,
  lostProjects: 18,
  pipelineValue: 4850000, // $4.85M
  wonValue: 1250000,      // $1.25M
  conversionRate: 25.8    // %
};

const salesPipelineData = [
  { stage: 'Leads', value: 45 },
  { stage: 'Discuss/Follow up', value: 32 },
  { stage: 'Proposal Sent', value: 24 },
  { stage: 'Negotiation', value: 15 },
  { stage: 'Won / Deal', value: 32 }
];

const salesByEmployeeData = [
  { name: 'Citra', sales: 480000 },
  { name: 'Ahmad', sales: 350000 },
  { name: 'Dian', sales: 210000 },
  { name: 'Budi', sales: 180000 },
  { name: 'Eka', sales: 90000 }
];

const salesByMonthData = [
  { name: 'Jan', value: 240000 },
  { name: 'Feb', value: 380000 },
  { name: 'Mar', value: 310000 },
  { name: 'Apr', value: 520000 },
  { name: 'May', value: 480000 },
  { name: 'Jun', value: 650000 },
  { name: 'Jul', value: 890000 }
];

const oppConversionData = [
  { name: 'Won', value: 32, color: '#10b981' },
  { name: 'Lost', value: 18, color: '#ef4444' },
  { name: 'Open', value: 74, color: '#6366f1' }
];

const tableData = [
  { id: 'OPP-1001', name: 'ERP Implementation', customer: 'TechCorp Ind', pic: 'Citra', stage: 'Negotiation', value: 120000, probability: 80, expectedClose: '2026-08-25', status: 'OPEN' },
  { id: 'OPP-1002', name: 'Cloud Migration', customer: 'Global Logistics', pic: 'Ahmad', stage: 'Won / Deal', value: 85000, probability: 100, expectedClose: '2026-08-10', status: 'WON' },
  { id: 'OPP-1003', name: 'Security Audit', customer: 'Finance Bank', pic: 'Dian', stage: 'Proposal Sent', value: 45000, probability: 60, expectedClose: '2026-09-15', status: 'OPEN' },
  { id: 'OPP-1004', name: 'Managed Services', customer: 'Retail Hub', pic: 'Budi', stage: 'Discuss/Follow up', value: 60000, probability: 30, expectedClose: '2026-10-01', status: 'OPEN' },
  { id: 'OPP-1005', name: 'Software License', customer: 'EduTech Inc', pic: 'Citra', stage: 'Lost', value: 25000, probability: 0, expectedClose: '2026-08-05', status: 'LOST' },
  { id: 'OPP-1006', name: 'Data Center Up', customer: 'HealthPlus', pic: 'Ahmad', stage: 'Won / Deal', value: 150000, probability: 100, expectedClose: '2026-07-28', status: 'WON' },
  { id: 'OPP-1007', name: 'Network Setup', customer: 'Startup XYZ', pic: 'Dian', stage: 'Leads', value: 15000, probability: 10, expectedClose: '2026-11-10', status: 'OPEN' },
];

const formatCurrency = (val: number) => `$${(val / 1000).toFixed(0)}k`;
const formatFullCurrency = (val: number) => `$${val.toLocaleString()}`;

export const SalesReportPage: React.FC = () => {
  const [dateRange, setDateRange] = useState('YTD');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [picFilter, setPicFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState('ALL');

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
              Comprehensive overview of sales pipeline, revenue, and conversion metrics.
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
            <button className="px-4 py-2 bg-[#4744e5] hover:bg-[#322fce] text-white text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">filter_alt</span>
              Apply Filter
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
              <option value="Q3">Q3 2026</option>
              <option value="YTD">Year to Date</option>
              <option value="CUSTOM">Custom Range...</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Team</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
              <option value="ALL">All Teams</option>
              <option value="ENTERPRISE">Enterprise Sales</option>
              <option value="SMB">SMB Sales</option>
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
            <label className="text-xs font-bold text-slate-500 uppercase">Project Stage</label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
              <option value="ALL">All Stages</option>
              <option value="LEAD">Leads</option>
              <option value="QUALIFICATION">Discuss/Follow up</option>
              <option value="PROPOSAL">Proposal Sent</option>
              <option value="NEGOTIATION">Negotiation</option>
              <option value="WON">Won / Deal</option>
              <option value="LOST">Lost</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards (6 Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Projects */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Opps</span>
            <span className="material-symbols-outlined text-[18px] text-blue-500">list_alt</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.totalProjects}</div>
        </div>

        {/* Pipeline Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pipeline Value</span>
            <span className="material-symbols-outlined text-[18px] text-indigo-500">account_balance_wallet</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">
            ${(kpiData.pipelineValue / 1000000).toFixed(2)}M
          </div>
        </div>

        {/* Won Projects */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Won Opps</span>
            <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 font-['Hanken_Grotesk']">{kpiData.wonProjects}</div>
        </div>

        {/* Won Value */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500"></div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Won Value</span>
            <span className="material-symbols-outlined text-[18px] text-emerald-600">payments</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 font-['Hanken_Grotesk']">
            ${(kpiData.wonValue / 1000000).toFixed(2)}M
          </div>
        </div>

        {/* Lost Projects */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Lost Opps</span>
            <span className="material-symbols-outlined text-[18px] text-rose-500">cancel</span>
          </div>
          <div className="text-2xl font-extrabold text-rose-700 font-['Hanken_Grotesk']">{kpiData.lostProjects}</div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Conversion Rate</span>
            <span className="material-symbols-outlined text-[18px] text-purple-500">trending_up</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.conversionRate}%</div>
        </div>
      </div>

      {/* Analytics Charts 2x2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Sales Pipeline Funnel / Bar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Sales Pipeline</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesPipelineData} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value} Opps`, 'Volume']}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24}>
                  {salesPipelineData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === salesPipelineData.length - 1 ? '#10b981' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales by Employee */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Sales by Employee</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesByEmployeeData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`$${(value).toLocaleString()}`, 'Sales']}
                />
                <Bar dataKey="sales" name="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales by Month Trend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Sales Trend (YTD)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesByMonthData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSalesMonth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  formatter={(value: number) => [`$${(value).toLocaleString()}`, 'Revenue']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSalesMonth)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Conversion */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Project Status</h2>
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
              <span className="text-3xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] leading-none">124</span>
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

      </div>

      {/* Detailed Sales Data Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-extrabold text-slate-900 font-['Hanken_Grotesk']">Detailed Sales Data</h2>
          <div className="relative w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
            <input 
              type="text" 
              placeholder="Search projects..." 
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Project</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">PIC</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Stage</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-right">Value</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Probability</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Expected Close</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-sm text-slate-900">{row.name}</div>
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
                  <td className="px-6 py-4 font-bold text-sm">
                    <span className={getStageColor(row.stage)}>{row.stage}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-extrabold text-slate-900 font-['Hanken_Grotesk'] text-sm">
                    {formatFullCurrency(row.value)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center justify-center w-10 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                      {row.probability}%
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-600 text-sm">{row.expectedClose}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-md ${getStatusBadge(row.status)}`}>
                      {row.status}
                    </span>
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

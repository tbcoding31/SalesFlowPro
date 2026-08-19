import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';

// Mock Data
const kpiData = {
  totalVisits: 342,
  completed: 285,
  cancelled: 32,
  rescheduled: 25,
  completionRate: 83.3 // %
};

const visitsByDateData = [
  { name: '01 Aug', completed: 12, scheduled: 15 },
  { name: '02 Aug', completed: 18, scheduled: 20 },
  { name: '03 Aug', completed: 15, scheduled: 15 },
  { name: '04 Aug', completed: 22, scheduled: 25 },
  { name: '05 Aug', completed: 28, scheduled: 30 },
  { name: '06 Aug', completed: 24, scheduled: 25 },
  { name: '07 Aug', completed: 19, scheduled: 22 }
];

const visitsByPicData = [
  { name: 'Citra', visits: 85 },
  { name: 'Ahmad', visits: 72 },
  { name: 'Dian', visits: 64 },
  { name: 'Budi', visits: 58 },
  { name: 'Eka', visits: 42 }
];

const visitsByStatusData = [
  { name: 'Completed', value: 285, color: '#10b981' },
  { name: 'Cancelled', value: 32, color: '#ef4444' },
  { name: 'Rescheduled', value: 25, color: '#f59e0b' }
];

const visitsByPurposeData = [
  { name: 'Initial Presentation', value: 120, color: '#6366f1' },
  { name: 'Negotiation', value: 85, color: '#8b5cf6' },
  { name: 'Follow-up', value: 75, color: '#3b82f6' },
  { name: 'Relationship Building', value: 62, color: '#14b8a6' }
];

const tableData = [
  { id: 'VST-2001', date: '2026-08-12', customer: 'TechCorp Ind', pic: 'Citra', purpose: 'Initial Presentation', status: 'COMPLETED', duration: '1h 30m', result: 'Interested in ERP' },
  { id: 'VST-2002', date: '2026-08-12', customer: 'Global Logistics', pic: 'Ahmad', purpose: 'Negotiation', status: 'COMPLETED', duration: '2h 00m', result: 'Agreed on pricing' },
  { id: 'VST-2003', date: '2026-08-11', customer: 'Finance Bank', pic: 'Dian', purpose: 'Follow-up', status: 'RESCHEDULED', duration: '-', result: 'Client requested new date' },
  { id: 'VST-2004', date: '2026-08-11', customer: 'Retail Hub', pic: 'Budi', purpose: 'Relationship Building', status: 'COMPLETED', duration: '0h 45m', result: 'Met new procurement head' },
  { id: 'VST-2005', date: '2026-08-10', customer: 'EduTech Inc', pic: 'Citra', purpose: 'Initial Presentation', status: 'CANCELLED', duration: '-', result: 'Client no-show' },
  { id: 'VST-2006', date: '2026-08-10', customer: 'HealthPlus', pic: 'Ahmad', purpose: 'Negotiation', status: 'COMPLETED', duration: '1h 15m', result: 'Contract signed' },
  { id: 'VST-2007', date: '2026-08-09', customer: 'Startup XYZ', pic: 'Dian', purpose: 'Follow-up', status: 'COMPLETED', duration: '1h 00m', result: 'Demo completed successfully' },
];

export const VisitsReportPage: React.FC = () => {
  const [dateRange, setDateRange] = useState('THIS_MONTH');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [picFilter, setPicFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [purposeFilter, setPurposeFilter] = useState('ALL');

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
              <option value="INITIAL">Initial Presentation</option>
              <option value="NEGOTIATION">Negotiation</option>
              <option value="FOLLOWUP">Follow-up</option>
              <option value="RELATIONSHIP">Relationship Building</option>
            </select>
          </div>
        </div>
      </div>

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
        
        {/* Visits by Date */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Visits by Date</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visitsByDateData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                <Line type="monotone" dataKey="scheduled" name="Scheduled" stroke="#94a3b8" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="completed" name="Completed" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Visits by PIC */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Visits by PIC</h2>
          <div className="h-64">
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
          </div>
        </div>

        {/* Visits by Status */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Visits by Status</h2>
          <div className="h-64 flex items-center justify-center relative">
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
                  {visitsByStatusData.map((entry, index) => (
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
              <span className="text-3xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] leading-none">{kpiData.totalVisits}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Total Visits</span>
            </div>
            
            {/* Legend Overlay */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-3">
              {visitsByStatusData.map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <div className="text-xs font-medium text-slate-600">{item.name}</div>
                  <div className="text-xs font-bold text-slate-900 ml-2">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Visits by Purpose */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-6">Visits by Purpose</h2>
          <div className="h-64 flex items-center justify-center relative">
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
                  {visitsByPurposeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend Overlay */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-3">
              {visitsByPurposeData.map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <div className="text-xs font-medium text-slate-600 truncate max-w-[100px]" title={item.name}>{item.name}</div>
                  <div className="text-xs font-bold text-slate-900 ml-auto pl-2">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Detailed Visits Data Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-extrabold text-slate-900 font-['Hanken_Grotesk']">Detailed Visit Log</h2>
          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
            <input 
              type="text" 
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
              {tableData.map((row) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

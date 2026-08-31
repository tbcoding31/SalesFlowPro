import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/crmApi';

export const CustomerReportPage: React.FC = () => {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id ;

  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await crmApi.fetchCustomerReport(tenantId);
      if (data) {
        setReportData(data);
      } else {
        setError('Failed to load customer report.');
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

  const kpi = reportData?.kpi || {
    totalCustomers: 0,
    activeCustomers: 0,
    inactiveCustomers: 0,
    prospects: 0,
    wonCustomers: 0
  };

  const customersByStatusData = reportData?.customersByStatus || [];
  const customersByPicData = reportData?.customersByPic || [];
  const tableData = reportData?.tableData || [];

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-10">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
            Customer Report
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Authoritative database metrics on client acquisition, segmentation, and ownership.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={loadData} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
          Loading customer report from database...
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
          {/* KPI Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Accounts</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpi.totalCustomers}</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 font-medium">Under active management</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Customers</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-emerald-600 font-['Hanken_Grotesk']">{kpi.activeCustomers}</span>
              </div>
              <div className="mt-2 text-[11px] text-emerald-600 font-bold">Transacting accounts</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prospects / Leads</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-amber-600 font-['Hanken_Grotesk']">{kpi.prospects}</span>
              </div>
              <div className="mt-2 text-[11px] text-amber-600 font-medium">In qualification funnel</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inactive Accounts</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-slate-400 font-['Hanken_Grotesk']">{kpi.inactiveCustomers}</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 font-medium">Require reactivation</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Status Breakdown Pie */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-4">Customer Status Distribution</h2>
              {customersByStatusData.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">No customer records in database.</div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={customersByStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {customersByStatusData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color || '#4744e5'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Customers by PIC Bar */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk'] mb-4">Portfolio by Sales Representative</h2>
              {customersByPicData.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">No assigned customer portfolio data in database.</div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={customersByPicData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip />
                      <Bar dataKey="customers" fill="#4744e5" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

          </div>

          {/* Scoped Customers Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-bold text-xs text-slate-900">
              Customer Accounts Roster ({tableData.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                    <th className="px-4 py-3">Customer Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Industry</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">PIC</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No customer accounts match the authorized data scope.
                      </td>
                    </tr>
                  ) : (
                    tableData.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-900">{c.name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{c.industry || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{c.city || '-'}</td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{c.pic || 'Unassigned'}</td>
                        <td className="px-4 py-3 text-slate-500">{c.lastActivity ? new Date(c.lastActivity).toLocaleDateString() : '-'}</td>
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

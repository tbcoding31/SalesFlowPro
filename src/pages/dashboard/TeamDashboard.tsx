import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { User } from '../../types';

export const TeamDashboard: React.FC = () => {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';
  const navigate = useNavigate();

  const [users] = useState<User[]>(DataService.getUsers(tenantId));
  const [dateRange, setDateRange] = useState('THIS_WEEK');
  
  // Sort state
  const [sortField, setSortField] = useState<'workload' | 'activeTasks' | 'overdue' | 'visits'>('workload');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'workload' | 'activeTasks' | 'overdue' | 'visits') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc'); // Default to descending when changing sort
    }
  };

  const sortedData = useMemo(() => {
    const data = users.map(user => {
      // Generate some deterministic mock stats for the real users to keep the UI rich
      const idNum = parseInt((user.id || '').replace(/\D/g, ''), 10) || 1;
      const workloadScore = 40 + ((idNum * 17) % 60);
      return {
        ...user,
        activeTasks: (idNum * 3) % 15,
        overdue: (idNum * 2) % 5,
        visitsToday: (idNum * 5) % 4,
        followups: (idNum * 2) % 6,
        projects: (idNum * 3) % 8,
        workload: workloadScore >= 80 ? 'High' : workloadScore >= 60 ? 'Medium' : 'Normal',
        workloadScore,
      };
    });

    return data.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'activeTasks': valA = a.activeTasks; valB = b.activeTasks; break;
        case 'overdue': valA = a.overdue; valB = b.overdue; break;
        case 'visits': valA = a.visitsToday; valB = b.visitsToday; break;
        case 'workload': valA = a.workloadScore; valB = b.workloadScore; break;
        default: valA = a.workloadScore; valB = b.workloadScore;
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });
  }, [users, sortField, sortDir]);

  // KPI Data based on real users
  const kpiData = {
    teamMembers: users.length,
    activeTasks: sortedData.reduce((acc, curr) => acc + curr.activeTasks, 0),
    overdueTasks: sortedData.reduce((acc, curr) => acc + curr.overdue, 0),
    visitsToday: sortedData.reduce((acc, curr) => acc + curr.visitsToday, 0),
    followupsDue: Math.floor(users.length * 1.5)
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return 'unfold_more';
    return sortDir === 'asc' ? 'expand_less' : 'expand_more';
  };

  const getWorkloadColor = (score: number) => {
    if (score >= 80) return 'bg-rose-500';
    if (score >= 50) return 'bg-amber-400';
    return 'bg-emerald-500';
  };

  const getWorkloadBg = (score: number) => {
    if (score >= 80) return 'bg-rose-100';
    if (score >= 50) return 'bg-amber-100';
    return 'bg-emerald-100';
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-10">
      
      {/* Header & Date Range */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
            Team Workload
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            Monitor activity distribution and identify bottlenecks across the team.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="appearance-none pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="TODAY">Today</option>
              <option value="THIS_WEEK">This Week</option>
              <option value="THIS_MONTH">This Month</option>
            </select>
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 pointer-events-none">
              calendar_month
            </span>
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 pointer-events-none">
              expand_more
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Team Members */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Team Members</span>
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-indigo-600">group</span>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.teamMembers}</div>
        </div>

        {/* Active Tasks */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Tasks</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-blue-600">task</span>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.activeTasks}</div>
        </div>

        {/* Overdue Tasks */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-rose-500"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Overdue Tasks</span>
            <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-rose-600">warning</span>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-rose-700 font-['Hanken_Grotesk']">{kpiData.overdueTasks}</div>
        </div>

        {/* Visits Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Visits Today</span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-emerald-600">location_on</span>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.visitsToday}</div>
        </div>

        {/* Follow-ups Due */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Follow-ups Due</span>
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-amber-600">call</span>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{kpiData.followupsDue}</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Employee
                </th>
                <th 
                  className="px-4 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('activeTasks')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Active Tasks
                    <span className="material-symbols-outlined text-[14px]">{getSortIcon('activeTasks')}</span>
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('overdue')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Overdue
                    <span className="material-symbols-outlined text-[14px]">{getSortIcon('overdue')}</span>
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('visits')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Visits Today
                    <span className="material-symbols-outlined text-[14px]">{getSortIcon('visits')}</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">
                  Follow-ups
                </th>
                <th className="px-4 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">
                  Projects
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider min-w-[180px] cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('workload')}
                >
                  <div className="flex items-center gap-1">
                    Workload
                    <span className="material-symbols-outlined text-[14px]">{getSortIcon('workload')}</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedData.map((employee) => (
                <tr key={employee.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {employee.avatarUrl ? (
                        <img src={employee.avatarUrl} alt={employee.name} className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-sm font-bold border border-indigo-100 shrink-0">
                          {employee.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-bold text-slate-900">{employee.name}</div>
                        <div className="text-xs text-slate-500 font-medium">{employee.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 text-sm font-bold">
                      {employee.activeTasks}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {employee.overdue > 0 ? (
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-100 text-rose-700 text-sm font-bold shadow-sm">
                        {employee.overdue}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-sm font-bold">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="text-sm font-bold text-slate-800">{employee.visitsToday}</div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="text-sm font-bold text-slate-800">{employee.followups}</div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="text-sm font-bold text-slate-800">{employee.projects}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5 w-full">
                      <div className="flex justify-between items-center text-xs">
                        <span className={`font-bold ${employee.workload === 'High' ? 'text-rose-600' : 'text-slate-700'}`}>
                          {employee.workload}
                        </span>
                        <span className="text-slate-500 font-medium">{employee.workloadScore}% Capacity</span>
                      </div>
                      <div className={`w-full h-2 rounded-full overflow-hidden ${getWorkloadBg(employee.workloadScore)}`}>
                        <div 
                          className={`h-full rounded-full ${getWorkloadColor(employee.workloadScore)}`}
                          style={{ width: `${employee.workloadScore}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View Tasks">
                        <span className="material-symbols-outlined text-[18px]">task</span>
                      </button>
                      <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="View Visits">
                        <span className="material-symbols-outlined text-[18px]">location_on</span>
                      </button>
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Assign Task">
                        <span className="material-symbols-outlined text-[18px]">add_task</span>
                      </button>
                      <button className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Reassign PIC">
                        <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                      </button>
                    </div>
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

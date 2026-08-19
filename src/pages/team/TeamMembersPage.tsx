import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../services/usersApi';
import { User } from '../../types';

export const TeamMembersPage: React.FC = () => {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';
  const navigate = useNavigate();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const data = await usersApi.fetchUsers(tenantId);
      setUsers(data);
      setIsLoading(false);
    };
    loadData();
  }, [tenantId]);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const roles = useMemo(() => Array.from(new Set(users.map(u => u.roleName))).filter(Boolean).sort(), [users]);
  const departments = useMemo(() => Array.from(new Set(users.map(u => u.department))).filter(Boolean).sort(), [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || 
                          u.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === 'ALL' || u.roleName === roleFilter;
      const matchDept = deptFilter === 'ALL' || u.department === deptFilter;
      const matchStatus = statusFilter === 'ALL' || u.status === statusFilter;
      
      return matchSearch && matchRole && matchDept && matchStatus;
    });
  }, [users, search, roleFilter, deptFilter, statusFilter]);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ACTIVE': return 'bg-emerald-100 text-emerald-700';
      case 'SUSPENDED': return 'bg-rose-100 text-rose-700';
      case 'INACTIVE': return 'bg-slate-100 text-slate-700';
      case 'INVITED': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
            Team Members
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your sales representatives and team access.
          </p>
        </div>
        <div>
          <button 
            className="px-4 py-2 bg-[#4744e5] hover:bg-[#322fce] text-white text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Add Team Member
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[240px] relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
          <input 
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Roles</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <select 
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INVITED">Invited</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Active Tasks</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Overdue</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Visits Today</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">Projects</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-sm text-slate-500 font-medium">
                    No team members found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  // Generate realistic-looking mock data deterministically based on user ID
                  const idNum = parseInt(user.id.replace(/\D/g, ''), 10) || 1;
                  const activeTasks = (idNum * 3) % 15;
                  const overdue = (idNum * 2) % 5;
                  const visitsToday = (idNum * 5) % 4;
                  const openOpps = (idNum * 4) % 12;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-sm font-bold border border-indigo-100 shrink-0">
                              {user.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{user.name}</div>
                            <div className="text-xs text-slate-500 font-medium">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-slate-700">{user.roleName}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-600">{user.department}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-md ${getStatusColor(user.status)}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                          {activeTasks}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {overdue > 0 ? (
                          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-100 text-rose-700 text-xs font-bold">
                            {overdue}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm font-medium">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm font-bold text-slate-700">{visitsToday}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm font-bold text-slate-700">{openOpps}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View Workload">
                            <span className="material-symbols-outlined text-[18px]">assignment</span>
                          </button>
                          <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="View Performance">
                            <span className="material-symbols-outlined text-[18px]">monitoring</span>
                          </button>
                          <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors" title="View Profile">
                            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

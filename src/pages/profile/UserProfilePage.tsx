import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/crmApi';
import { Task, Visit, Project, Activity } from '../../types';

export const UserProfilePage: React.FC = () => {
  const { currentUser } = useAuth();
  const tenantId = currentUser?.tenantId || 'TEN-00001';

  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [myVisits, setMyVisits] = useState<Visit[]>([]);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [myActivities, setMyActivities] = useState<Activity[]>([]);

  useEffect(() => {
    Promise.all([
      crmApi.fetchCollection<Task>('tasks', tenantId),
      crmApi.fetchCollection<Visit>('visits', tenantId),
      crmApi.fetchCollection<Project>('projects', tenantId),
      crmApi.fetchCollection<Activity>('activities', tenantId)
    ]).then(([tList, vList, pList, aList]) => {
      setMyTasks(tList.filter(t => t.picId === currentUser?.id && t.status !== 'COMPLETED'));
      setMyVisits(vList.filter(v => v.picId === currentUser?.id));
      setMyProjects(pList.filter(p => p.picId === currentUser?.id && p.stage !== 'WON' && p.stage !== 'LOST'));
      setMyActivities(aList.filter(a => a.userId === currentUser?.id));
    });
  }, [tenantId, currentUser?.id]);
  
  // Use current user data if available, otherwise fallback to the requested mock data
  const user = {
    name: currentUser?.name || 'Ahmad Ricky',
    role: currentUser?.tenantId === 'SYSTEM' ? 'System Administrator' : 
          currentUser?.role === 'TENANT_ADMIN' ? 'Tenant Administrator' : 
          currentUser?.role === 'SALES_MANAGER' ? 'Sales Manager' :
          currentUser?.role === 'SUPERVISOR' ? 'Supervisor' :
          'Sales Representative',
    department: currentUser?.department || 'Sales Department',
    email: currentUser?.email || 'ahmadricky90909@gmail.com',
    phone: currentUser?.phone || '+62 812 3456 7890',
    avatar: currentUser?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'Ahmad Ricky')}&background=4f46e5&color=fff`
  };
  
  const stats = [
    { label: 'Active Tasks', value: myTasks.length.toString(), icon: 'assignment', color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Visits This Month', value: myVisits.length.toString(), icon: 'map', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Open Projects', value: myProjects.length.toString(), icon: 'monitoring', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'System Logs', value: myActivities.length.toString(), icon: 'history', color: 'text-purple-600', bg: 'bg-purple-50' }
  ];

  const activities = myActivities.slice(0, 4).map(act => ({
    id: act.id,
    action: `${act.type} ${act.subject}`,
    time: act.occurredAt?.substring(0, 10) || 'Recent',
    icon: 'history',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50'
  }));

  if (activities.length === 0) {
    activities.push({ id: '1', action: 'Logged in to system', time: 'Today', icon: 'login', color: 'text-slate-600', bg: 'bg-slate-50' } as any);
  }

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
            Profile
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Manage your personal information and account security.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Profile Card & Stats */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Profile Header Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
            <div className="relative mb-4">
              <img 
                src={user.avatar} 
                alt={user.name} 
                className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover"
              />
              <button className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center border-2 border-white hover:bg-indigo-700 transition-colors shadow-sm">
                <span className="material-symbols-outlined text-[14px]">edit</span>
              </button>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{user.name}</h2>
            <div className="text-sm font-bold text-indigo-600 mt-1">{user.role}</div>
            <div className="text-xs font-medium text-slate-500 mt-1">{user.department}</div>
            
            <div className="w-full h-px bg-slate-100 my-5"></div>
            
            <div className="w-full flex flex-col gap-3 text-left">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[16px] text-slate-500">mail</span>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</div>
                  <div className="font-medium text-slate-700 break-all">{user.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[16px] text-slate-500">phone</span>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</div>
                  <div className="font-medium text-slate-700">{user.phone}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-28">
                <div className="flex items-center justify-between">
                  <div className={`w-8 h-8 rounded-full ${stat.bg} flex items-center justify-center`}>
                    <span className={`material-symbols-outlined text-[18px] ${stat.color}`}>{stat.icon}</span>
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk']">{stat.value}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Right Column: Information & Activity */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Personal Information */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk']">Personal Information</h2>
              <button className="px-3 py-1.5 bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">edit</span>
                Edit Profile
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">First Name</label>
                <div className="text-sm font-semibold text-slate-900">{(user?.name || '').split(' ')[0]}</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Name</label>
                <div className="text-sm font-semibold text-slate-900">{(user?.name || '').split(' ').slice(1).join(' ') || '-'}</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                <div className="text-sm font-semibold text-slate-900">{user.email}</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
                <div className="text-sm font-semibold text-slate-900">{user.phone}</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</label>
                <div className="text-sm font-semibold text-slate-900">Jakarta, Indonesia</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timezone</label>
                <div className="text-sm font-semibold text-slate-900">GMT+7 (WIB)</div>
              </div>
            </div>
          </div>

          {/* Account Security */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk']">Account Security</h2>
            </div>
            <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Password</div>
                <div className="text-xs font-medium text-slate-500 mt-1">Last changed 3 months ago</div>
              </div>
              <button className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                Change Password
              </button>
            </div>
          </div>

          {/* Activity History */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk']">Activity History</h2>
            </div>
            <div className="p-6">
              <div className="relative border-l-2 border-slate-100 ml-4 space-y-6 pb-2">
                {activities.map((activity, index) => (
                  <div key={activity.id} className="relative pl-6">
                    <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full ${activity.bg} flex items-center justify-center border-4 border-white`}>
                      <span className={`material-symbols-outlined text-[14px] ${activity.color}`}>{activity.icon}</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{activity.action}</div>
                      <div className="text-xs font-medium text-slate-500 mt-0.5">{activity.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

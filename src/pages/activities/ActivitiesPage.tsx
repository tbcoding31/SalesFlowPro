import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { Activity, Customer, User } from '../../types';

export const ActivitiesPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';
  
  const [activities] = useState<Activity[]>(DataService.getActivities(tenantId));
  const [customers] = useState<Customer[]>(DataService.getCustomers(tenantId));
  const [users] = useState<User[]>(DataService.getUsers(tenantId));

  // Filters
  const [dateRange, setDateRange] = useState<string>('ALL');
  const [activityType, setActivityType] = useState<string>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [selectedPic, setSelectedPic] = useState<string>('ALL');
  
  const activityTypesList = [
    'Customer Created',
    'Visit Created',
    'Visit Completed',
    'Task Created',
    'Task Completed',
    'PIC Reassigned',
    'Follow-up Created',
    'Project Updated',
    'Status Changed',
    'Comment Added'
  ];

  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      if (selectedCustomer !== 'ALL' && a.customerId !== selectedCustomer) return false;
      if (selectedUser !== 'ALL' && a.userId !== selectedUser) return false;
      
      if (activityType !== 'ALL') {
        const typeStr = (activityType || '').toLowerCase();
        // Since our mock data doesn't perfectly align with the new standard activity types, 
        // we'll do a loose match or just let them pass if they have relevant keywords.
        const subjMatch = (a.subject || '').toLowerCase().includes(typeStr.replace(' created', '').replace(' updated', '').replace(' completed', ''));
        const descMatch = (a.description || '').toLowerCase().includes(typeStr);
        if (!subjMatch && !descMatch) return false;
      }

      return true;
    });
  }, [activities, selectedCustomer, selectedUser, activityType, dateRange]);

  // Helper to determine icon and color based on activity type or subject
  const getActivityStyling = (activity: Activity) => {
    const subj = (activity.subject || '').toLowerCase();
    const type = (activity.type || '').toLowerCase();
    
    if (subj.includes('visit') || type === 'visit') return { icon: 'location_on', color: 'bg-emerald-100 text-emerald-600', borderColor: 'border-emerald-200' };
    if (subj.includes('task') || type === 'task') return { icon: 'task_alt', color: 'bg-amber-100 text-amber-600', borderColor: 'border-amber-200' };
    if (subj.includes('project') || subj.includes('deal') || type === 'project') return { icon: 'monitoring', color: 'bg-indigo-100 text-indigo-600', borderColor: 'border-indigo-200' };
    if (subj.includes('customer') || type === 'system') return { icon: 'domain', color: 'bg-blue-100 text-blue-600', borderColor: 'border-blue-200' };
    if (type === 'call') return { icon: 'call', color: 'bg-teal-100 text-teal-600', borderColor: 'border-teal-200' };
    if (type === 'meeting') return { icon: 'groups', color: 'bg-purple-100 text-purple-600', borderColor: 'border-purple-200' };
    if (type === 'note' || subj.includes('comment') || subj.includes('follow')) return { icon: 'chat', color: 'bg-slate-100 text-slate-600', borderColor: 'border-slate-200' };
    
    return { icon: 'history', color: 'bg-slate-100 text-slate-600', borderColor: 'border-slate-200' };
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-5xl mx-auto pb-10">
      
      {/* Header */}
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
          Activity History
        </h1>
        <p className="text-sm font-medium text-slate-500">
          Track changes and activities across customers and sales operations.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        {/* Date Range */}
        <select 
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="ALL">All Time</option>
          <option value="TODAY">Today</option>
          <option value="THIS_WEEK">This Week</option>
          <option value="THIS_MONTH">This Month</option>
        </select>
        
        {/* Activity Type */}
        <select 
          value={activityType}
          onChange={(e) => setActivityType(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="ALL">All Activity Types</option>
          {activityTypesList.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        {/* Customer */}
        <select 
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="ALL">All Customers</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* User */}
        <select 
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="ALL">All Users</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        
        {/* PIC */}
        <select 
          value={selectedPic}
          onChange={(e) => setSelectedPic(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="ALL">All PICs</option>
          {users.map(u => (
            <option key={`pic-${u.id}`} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Desktop Timeline */}
      <div className="relative pl-4 sm:pl-8 py-2 before:absolute before:inset-0 before:ml-[34px] sm:before:ml-[50px] before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-200">
        
        {filteredActivities.length === 0 ? (
          <div className="pl-12 py-10 text-slate-500 text-sm font-medium">
            No activities found matching your filters.
          </div>
        ) : (
          filteredActivities.map((activity) => {
            const styling = getActivityStyling(activity);
            
            return (
              <div key={activity.id} className="relative flex items-start gap-6 mb-8 last:mb-0 group">
                
                {/* Timeline Node */}
                <div className={`absolute left-0 w-10 h-10 rounded-full border-4 border-[#F8F9FA] flex items-center justify-center shadow-sm z-10 transition-transform group-hover:scale-110 ${styling.color}`}>
                  <span className="material-symbols-outlined text-[18px]">{styling.icon}</span>
                </div>
                
                {/* Content Card */}
                <div 
                  className="flex-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all ml-12 sm:ml-14 cursor-pointer"
                  onClick={() => navigate(`/activities/${activity.id}`)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    
                    <div className="space-y-3 flex-1">
                      {/* Header / Subject */}
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 ${styling.color.replace('text-', 'text-opacity-80 text-').replace('bg-', 'bg-opacity-50 bg-')} text-[10px] font-extrabold rounded-md uppercase tracking-wider`}>
                          {activity.type}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900 leading-tight">{activity.subject}</h3>
                      </div>
                      
                      {/* Entity & Customer Info */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold">
                        {activity.entityType && (
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <span className="text-slate-400">Entity:</span>
                            <span className="text-slate-800">{activity.entityType} {activity.entityId ? `(#${activity.entityId.substring(0,6)})` : ''}</span>
                          </div>
                        )}
                        {activity.customerName && (
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <span className="text-slate-400">Customer:</span>
                            <span className="text-indigo-600 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">domain</span>
                              {activity.customerName}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Description / Details Box */}
                      <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 leading-relaxed font-medium">
                        {activity.description}
                      </div>
                    </div>

                    {/* Meta info (Right side on desktop) */}
                    <div className="flex flex-col items-start sm:items-end gap-2.5 shrink-0 sm:min-w-[160px] text-left sm:text-right pt-1 sm:pt-0 border-t border-slate-100 sm:border-t-0 mt-3 sm:mt-0">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
                        <span className="material-symbols-outlined text-[16px]">event</span>
                        {new Date(activity.occurredAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      
                      <div className="mt-1 flex flex-col sm:items-end gap-1.5">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Changed By</span>
                        <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                          {activity.userAvatar ? (
                            <img src={activity.userAvatar} alt={activity.userName || 'User'} className="w-6 h-6 rounded-full object-cover border border-slate-200" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold border border-slate-300">
                              {(activity.userName || '?').charAt(0)}
                            </div>
                          )}
                          <span className="font-semibold text-[#1a1c1c]">{activity.userName || 'Unknown User'}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

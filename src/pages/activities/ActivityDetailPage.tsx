import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { Activity } from '../../types';
import { crmApi } from '../../services/crmApi';

export const ActivityDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';

  const [activity, setActivity] = useState<Activity | null>(null);

  useEffect(() => {
    if (id) {
      crmApi.fetchRecordById<Activity>('activities', id).then((data) => {
        if (data) {
          setActivity(data);
        }
      });
    }
  }, [id, tenantId]);

  if (!activity) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-500">Activity not found.</div>
      </div>
    );
  }

  // Helper for icons
  const getActivityStyling = (type: string, subject: string) => {
    const s = (subject || '').toLowerCase();
    const t = (type || '').toLowerCase();
    
    if (s.includes('visit') || t === 'visit') return { icon: 'location_on', color: 'bg-emerald-100 text-emerald-600', border: 'border-emerald-200' };
    if (s.includes('task') || t === 'task') return { icon: 'task_alt', color: 'bg-amber-100 text-amber-600', border: 'border-amber-200' };
    if (s.includes('project') || s.includes('deal') || t === 'project') return { icon: 'monitoring', color: 'bg-indigo-100 text-indigo-600', border: 'border-indigo-200' };
    if (s.includes('customer') || t === 'system') return { icon: 'domain', color: 'bg-blue-100 text-blue-600', border: 'border-blue-200' };
    if (t === 'call') return { icon: 'call', color: 'bg-teal-100 text-teal-600', border: 'border-teal-200' };
    if (t === 'meeting') return { icon: 'groups', color: 'bg-purple-100 text-purple-600', border: 'border-purple-200' };
    if (t === 'note' || s.includes('comment') || s.includes('follow')) return { icon: 'chat', color: 'bg-slate-100 text-slate-600', border: 'border-slate-200' };
    
    return { icon: 'history', color: 'bg-slate-100 text-slate-600', border: 'border-slate-200' };
  };

  const styling = getActivityStyling(activity.type, activity.subject);
  
  // Format dates
  const formattedDate = activity.occurredAt ? new Date(activity.occurredAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-";
  const formattedTime = activity.occurredAt ? new Date(activity.occurredAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "-";

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-5xl mx-auto pb-10">
      
      {/* Top Navigation */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
        <button onClick={() => navigate('/activities')} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Activities
        </button>
        <span>/</span>
        <span className="text-slate-800 font-medium">Activity Detail</span>
      </div>

      {/* Header Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border ${styling.color} ${styling.border}`}>
            <span className="material-symbols-outlined text-[32px]">{styling.icon}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2.5 py-1 ${styling.color.replace('text-', 'text-opacity-80 text-').replace('bg-', 'bg-opacity-50 bg-')} text-[10px] font-extrabold rounded-md uppercase tracking-wider`}>
                {activity.type}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight mb-2">
              {activity.subject}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              {activity.description}
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-1 shrink-0 bg-slate-50 p-4 rounded-xl border border-slate-100">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date & Time</span>
             <div className="flex items-center gap-1.5 text-slate-800 font-bold text-sm">
               <span className="material-symbols-outlined text-[18px] text-indigo-500">event</span>
               {formattedDate} <span className="text-slate-400 font-normal">at</span> {formattedTime}
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Main Data) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Changes Panel (Diff) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-[20px]">difference</span>
              <h3 className="text-sm font-extrabold text-slate-900">Change Log</h3>
            </div>
            <div className="p-6">
              {activity.changes && activity.changes.length > 0 ? (
                <div className="space-y-4">
                  {activity.changes.map((change, idx) => (
                    <div key={idx} className="flex flex-col">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{change.field}</span>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        {/* Previous Value */}
                        {change.oldValue !== undefined && (
                          <div className="flex-1 bg-rose-50 border border-rose-100 rounded-xl p-3 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-1.5 bg-rose-100 rounded-bl-lg">
                              <span className="text-[9px] font-bold text-rose-600 uppercase tracking-wider">Previous Value</span>
                            </div>
                            <div className="text-sm font-semibold text-rose-900 mt-3">{String(change.oldValue)}</div>
                          </div>
                        )}
                        
                        {/* Arrow */}
                        {change.oldValue !== undefined && change.newValue !== undefined && (
                          <div className="flex items-center justify-center py-2 sm:py-0">
                            <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shadow-sm">
                              <span className="material-symbols-outlined text-slate-400 text-[16px]">arrow_forward</span>
                            </div>
                          </div>
                        )}
                        
                        {/* New Value */}
                        {change.newValue !== undefined && (
                          <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-xl p-3 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-1.5 bg-emerald-100 rounded-bl-lg">
                              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">New Value</span>
                            </div>
                            <div className="text-sm font-semibold text-emerald-900 mt-3">{String(change.newValue)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500 italic py-2">
                  This activity does not contain specific field-level changes.
                </div>
              )}
            </div>
          </div>

          {/* Related Entities Context */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-[20px]">account_tree</span>
              <h3 className="text-sm font-extrabold text-slate-900">Related Context</h3>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Customer Link */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</span>
                {activity.customerId ? (
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[16px]">domain</span>
                      </div>
                      <span className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{activity.customerName}</span>
                    </div>
                    <span className="material-symbols-outlined text-slate-300 group-hover:text-indigo-500 transition-colors">chevron_right</span>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 italic">No customer linked.</div>
                )}
              </div>

              {/* Entity Link */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Related Entity</span>
                {activity.entityType ? (
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors cursor-pointer group">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{activity.entityType}</span>
                      <span className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                         {activity.entityId ? `#${activity.entityId}` : 'View Record'}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-slate-300 group-hover:text-indigo-500 transition-colors">chevron_right</span>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 italic">No specific entity linked.</div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* Right Column (Audit Info) */}
        <div className="space-y-6">
          
          {/* Changed By Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-[20px]">person</span>
              <h3 className="text-sm font-extrabold text-slate-900">Changed By</h3>
            </div>
            <div className="p-6 flex flex-col items-center text-center">
              {activity.userAvatar ? (
                <img src={activity.userAvatar} alt={activity.userName} className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-md mb-3" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl font-bold border-4 border-white shadow-md mb-3">
                  {(activity.userName || "U").charAt(0)}
                </div>
              )}
              <div className="text-base font-extrabold text-slate-900">{activity.userName}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">{activity.userId}</div>
              <button className="mt-4 w-full px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-xl transition-colors">
                View Profile
              </button>
            </div>
          </div>

          {/* System Metadata Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-[20px]">dns</span>
              <h3 className="text-sm font-extrabold text-slate-900">System Metadata</h3>
            </div>
            <div className="p-6">
              <ul className="space-y-3">
                <li className="flex justify-between items-center pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                  <span className="text-xs font-semibold text-slate-500">Activity ID</span>
                  <span className="text-xs font-mono font-medium text-slate-800">{activity.id}</span>
                </li>
                <li className="flex justify-between items-center pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                  <span className="text-xs font-semibold text-slate-500">Tenant ID</span>
                  <span className="text-xs font-mono font-medium text-slate-800">{activity.tenantId}</span>
                </li>
                {activity.metadata && Object.entries(activity.metadata).map(([key, value]) => (
                  <li key={key} className="flex justify-between items-center pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                    <span className="text-xs font-semibold text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="text-xs font-medium text-slate-800 max-w-[120px] text-right truncate" title={String(value)}>{String(value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

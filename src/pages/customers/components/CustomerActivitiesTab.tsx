import React, { useState } from 'react';
import { CustomerTimelineEvent } from '../../../types';

export interface CustomerActivitiesTabProps {
  timelineEvents: CustomerTimelineEvent[];
  timelinePage: number;
  timelineHasMore: boolean;
  isLoadingTimeline: boolean;
  error: string | null;
  onLoadMore: (page: number) => void;
  onOpenRelatedRecord: (type: string, id: string) => void;
}

export const CustomerActivitiesTab: React.FC<CustomerActivitiesTabProps> = ({
  timelineEvents,
  timelinePage,
  timelineHasMore,
  isLoadingTimeline,
  error,
  onLoadMore,
  onOpenRelatedRecord
}) => {
  const [actCategoryFilter, setActCategoryFilter] = useState<string>('ALL');
  const [actDateRangeFilter, setActDateRangeFilter] = useState<string>('ALL');
  const [actStartDate, setActStartDate] = useState<string>('');
  const [actEndDate, setActEndDate] = useState<string>('');
  const [actSearch, setActSearch] = useState<string>('');

  const filteredEvents = timelineEvents.filter((act) => {
    if (actCategoryFilter !== 'ALL' && act.eventType !== actCategoryFilter) return false;
    if (actSearch) {
      const s = actSearch.toLowerCase();
      if (!act.title.toLowerCase().includes(s) && !(act.details || '').toLowerCase().includes(s)) return false;
    }
    const actDate = act.eventTimestamp?.split('T')[0] || '';
    if (actDateRangeFilter === 'CUSTOM') {
      if (actStartDate && actDate < actStartDate) return false;
      if (actEndDate && actDate > actEndDate) return false;
    } else if (actDateRangeFilter === 'LAST_7_DAYS') {
      const d7 = new Date(); d7.setDate(d7.getDate() - 7);
      if (actDate < d7.toISOString().split('T')[0]) return false;
    } else if (actDateRangeFilter === 'LAST_30_DAYS') {
      const d30 = new Date(); d30.setDate(d30.getDate() - 30);
      if (actDate < d30.toISOString().split('T')[0]) return false;
    }
    return true;
  });

  const getTypeStyle = (eventType: string) => {
    switch (eventType) {
      case 'VISIT': return { badge: 'VISIT', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: 'meeting_room' };
      case 'TASK': return { badge: 'TASK', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: 'task_alt' };
      case 'FOLLOW_UP': return { badge: 'FOLLOW-UP', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: 'call' };
      case 'PROJECT': return { badge: 'PROJECT', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: 'folder' };
      case 'ACTIVITY': return { badge: 'ACTIVITY', color: 'bg-slate-100 text-slate-800 border-slate-200', icon: 'history' };
      default: return { badge: eventType, color: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'history' };
    }
  };

  if (error) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-center bg-white rounded-xl border border-red-200">
        <span className="material-symbols-outlined text-4xl text-red-400 mb-2">error</span>
        <p className="text-sm font-bold text-red-800">Failed to load timeline</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Summary & Category Quick Filters */}
      <div className="bg-white rounded-xl border border-[#E1E1E1] p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E1E1E1] pb-4">
          <div>
            <h2 className="text-base font-bold text-[#1a1c1c] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4744e5]">history</span>
              Customer Activity Timeline
            </h2>
            <p className="text-xs text-[#767587] mt-0.5">
              Comprehensive log of all interactions and updates
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-[#767587] uppercase mb-1">Search</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-[#767587]">search</span>
              <input
                type="text"
                value={actSearch}
                onChange={(e) => setActSearch(e.target.value)}
                placeholder="Search activities..."
                className="w-full pl-9 pr-3 py-2 bg-[#f8f9fa] border border-[#E1E1E1] rounded-lg text-xs focus:ring-2 focus:ring-[#4744e5]/20 focus:border-[#4744e5] transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#767587] uppercase mb-1">Category</label>
            <select
              value={actCategoryFilter}
              onChange={(e) => setActCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 bg-[#f8f9fa] border border-[#E1E1E1] rounded-lg text-xs focus:ring-2 focus:ring-[#4744e5]/20 focus:border-[#4744e5] transition-all"
            >
              <option value="ALL">All Categories</option>
              <option value="VISIT">Visits & Meetings</option>
              <option value="TASK">Tasks & Actions</option>
              <option value="FOLLOW_UP">Follow-ups</option>
              <option value="PROJECT">Projects & Pipeline</option>
              <option value="ACTIVITY">System Events</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#767587] uppercase mb-1">Date Range</label>
            <select
              value={actDateRangeFilter}
              onChange={(e) => setActDateRangeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-[#f8f9fa] border border-[#E1E1E1] rounded-lg text-xs focus:ring-2 focus:ring-[#4744e5]/20 focus:border-[#4744e5] transition-all"
            >
              <option value="ALL">All Time</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
              <option value="CUSTOM">Custom Range</option>
            </select>
          </div>
          {actDateRangeFilter === 'CUSTOM' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={actStartDate}
                onChange={(e) => setActStartDate(e.target.value)}
                className="w-full px-2 py-2 bg-[#f8f9fa] border border-[#E1E1E1] rounded-lg text-xs"
              />
              <span className="text-slate-400">-</span>
              <input
                type="date"
                value={actEndDate}
                onChange={(e) => setActEndDate(e.target.value)}
                className="w-full px-2 py-2 bg-[#f8f9fa] border border-[#E1E1E1] rounded-lg text-xs"
              />
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xs">
        {filteredEvents.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            {isLoadingTimeline ? (
              <div className="w-16 h-16 flex items-center justify-center mb-3">
                 <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3 border border-slate-100">
                  <span className="material-symbols-outlined text-3xl text-slate-300">history</span>
                </div>
                <p className="text-sm font-bold text-[#1a1c1c]">No activities found</p>
                <p className="text-xs text-[#767587] mt-1">Timeline events will appear here.</p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#E1E1E1]">
            {filteredEvents.map((act) => {
              const style = getTypeStyle(act.eventType);
              const date = act.eventTimestamp?.split('T')[0] || '';
              const time = act.eventTimestamp?.split('T')[1]?.substring(0, 5) || '';

              return (
                <div key={act.stableEventKey} className="p-5 flex gap-4 hover:bg-[#f8f9fa] transition-colors group">
                  <div className="flex flex-col items-center gap-2 pt-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${style.color}`}>
                      <span className="material-symbols-outlined text-[16px]">{style.icon}</span>
                    </div>
                    <div className="w-[1px] h-full bg-[#E1E1E1] group-last:hidden" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${style.color}`}>
                            {style.badge}
                          </span>
                          <span className="text-[11px] font-medium text-[#767587] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                            {date}
                          </span>
                          <span className="text-[11px] font-medium text-[#767587] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            {time}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-[#1a1c1c]">{act.title}</h3>
                      </div>
                    </div>
                    {act.details && (
                      <div className="text-xs text-[#4a4b57] bg-white border border-[#E1E1E1] p-3 rounded-lg shadow-sm leading-relaxed whitespace-pre-wrap">
                        {act.details}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        {/* Removed user info since canonical timeline endpoint doesn't return it yet, it could be extended later */}
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenRelatedRecord(act.eventType, act.sourceId)}
                        className="px-3 py-1 bg-slate-100 hover:bg-[#4744e5] text-[#1a1c1c] hover:text-white font-bold rounded-lg border border-slate-200 text-xs flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                        <span>
                          {act.eventType === 'VISIT'
                            ? 'View Visit'
                            : act.eventType === 'TASK'
                            ? 'View Task'
                            : act.eventType === 'PROJECT'
                            ? 'View Project'
                            : act.eventType === 'FOLLOW_UP'
                            ? 'View Follow-up'
                            : 'View Details'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {timelineHasMore && (
        <div className="text-center pt-4">
          <button
            onClick={() => onLoadMore(timelinePage + 1)}
            disabled={isLoadingTimeline}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg transition-colors border border-slate-300 disabled:opacity-50"
          >
            {isLoadingTimeline ? 'Loading...' : 'Load More History'}
          </button>
        </div>
      )}
    </div>
  );
};

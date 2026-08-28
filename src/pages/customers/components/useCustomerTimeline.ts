import { useState, useCallback, useEffect } from 'react';
import { crmApi } from '../../../services/crmApi';
import { CustomerTimelineEvent } from '../../../types';

export const useCustomerTimeline = (customerId: string, tenantId: string) => {
  const [timelineEvents, setTimelineEvents] = useState<CustomerTimelineEvent[]>([]);
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineHasMore, setTimelineHasMore] = useState(false);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTimeline = useCallback(async (pageToLoad: number, append: boolean = false) => {
    if (!customerId) return;
    setIsLoadingTimeline(true);
    setError(null);
    try {
      const res = await crmApi.fetchCustomerTimeline(customerId, pageToLoad, 25);
      if (append) {
        setTimelineEvents(prev => {
          // Avoid duplicates by checking stableEventKey
          const existingKeys = new Set(prev.map(e => e.stableEventKey));
          const newEvents = res.data.filter((e: CustomerTimelineEvent) => !existingKeys.has(e.stableEventKey));
          return [...prev, ...newEvents];
        });
      } else {
        setTimelineEvents(res.data);
      }
      setTimelinePage(res.pagination.page);
      setTimelineHasMore(res.pagination.hasNextPage);
    } catch (err: any) {
      console.error('Failed to load timeline', err);
      setError(err.message || 'Failed to load timeline');
    } finally {
      setIsLoadingTimeline(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (customerId) {
      setTimelineEvents([]);
      setTimelinePage(1);
      setTimelineHasMore(false);
      setError(null);
      loadTimeline(1, false);
    }
  }, [customerId, tenantId, loadTimeline]);

  return {
    timelineEvents,
    timelinePage,
    timelineHasMore,
    isLoadingTimeline,
    error,
    loadTimeline
  };
};

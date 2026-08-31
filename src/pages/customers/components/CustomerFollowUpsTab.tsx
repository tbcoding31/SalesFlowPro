import React, { useState, useEffect } from 'react';
import { crmApi } from '../../../services/crmApi';
import type { FollowUp, FollowUpType, FollowUpPriority, FollowUpStatus, PaginatedResponse } from '../../../types';

interface CustomerFollowUpsTabProps {
  customerId: string;
  tenantUsers: any[];
  projects: any[];
}

export function CustomerFollowUpsTab({ customerId, tenantUsers, projects }: CustomerFollowUpsTabProps) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [followupsResponse, setFollowupsResponse] = useState<PaginatedResponse<FollowUp> | null>(null);

  const [followUpTitleInput, setFollowUpTitleInput] = useState('');
  const [followUpTypeInput, setFollowUpTypeInput] = useState<FollowUpType>('CALL');
  const [followUpPriorityInput, setFollowUpPriorityInput] = useState<FollowUpPriority>('MEDIUM');
  const [followUpStatusInput, setFollowUpStatusInput] = useState<FollowUpStatus>('PENDING');
  const [followUpDateInput, setFollowUpDateInput] = useState('');
  const [followUpTimeInput, setFollowUpTimeInput] = useState('');
  const [followUpPicIdInput, setFollowUpPicIdInput] = useState('');
  const [followUpRelatedOppIdInput, setFollowUpRelatedOppIdInput] = useState('');
  const [followUpRelatedVisitIdInput, setFollowUpRelatedVisitIdInput] = useState('');
  const [followUpNotesInput, setFollowUpNotesInput] = useState('');

  const [creatingFollowUp, setCreatingFollowUp] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);
  const [viewingFollowUp, setViewingFollowUp] = useState<FollowUp | null>(null);
  const [reschedulingFollowUp, setReschedulingFollowUp] = useState<FollowUp | null>(null);
  const [completingFollowUp, setCompletingFollowUp] = useState<FollowUp | null>(null);

  const fetchFollowUpsData = async () => {
    try {
      if (!customerId) return;
      const res = await crmApi.fetchFollowUps({ customerId, page, pageSize });
      setFollowupsResponse(res);
    } catch (error) {
      console.error('Error fetching follow-ups:', error);
    }
  };

  useEffect(() => {
    fetchFollowUpsData();
  }, [customerId, page]);

  const followupsList = followupsResponse?.data || [];
  const followupsTotalItems = followupsResponse?.pagination.totalItems || 0;
  const followupsTotalPages = followupsResponse?.pagination.totalPages || 1;

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= followupsTotalPages) {
      setPage(newPage);
    }
  };

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await crmApi.createRecord('follow_ups', {
        customerId,
        title: followUpTitleInput,
        type: followUpTypeInput,
        priority: followUpPriorityInput,
        status: followUpStatusInput,
        followUpDate: followUpDateInput,
        reminderDate: `${followUpDateInput} ${followUpTimeInput}`,
        picId: followUpPicIdInput,
        relatedProjectId: followUpRelatedOppIdInput || null,
        relatedVisitId: followUpRelatedVisitIdInput || null,
        notes: followUpNotesInput
      });
      setCreatingFollowUp(false);
      setPage(1);
      fetchFollowUpsData();
    } catch (err) {
      console.error('Failed to create follow-up:', err);
    }
  };

  const handleSaveEditFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFollowUp) return;
    try {
      await crmApi.updateRecord('follow_ups', editingFollowUp.id, {
        title: followUpTitleInput,
        type: followUpTypeInput,
        priority: followUpPriorityInput,
        status: followUpStatusInput,
        followUpDate: followUpDateInput,
        reminderDate: `${followUpDateInput} ${followUpTimeInput}`,
        picId: followUpPicIdInput,
        relatedProjectId: followUpRelatedOppIdInput || null,
        relatedVisitId: followUpRelatedVisitIdInput || null,
        notes: followUpNotesInput
      });
      setEditingFollowUp(null);
      fetchFollowUpsData();
    } catch (err) {
      console.error('Failed to edit follow-up:', err);
    }
  };

  const handleConfirmCompleteFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingFollowUp) return;
    try {
      await crmApi.updateRecord('follow_ups', completingFollowUp.id, {
        status: 'COMPLETED',
        outcome: followUpNotesInput
      });
      setCompletingFollowUp(null);
      fetchFollowUpsData();
    } catch (err) {
      console.error('Failed to complete follow-up:', err);
    }
  };

  const handleConfirmRescheduleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingFollowUp) return;
    try {
      await crmApi.updateRecord('follow_ups', reschedulingFollowUp.id, {
        followUpDate: followUpDateInput,
        reminderDate: `${followUpDateInput} ${followUpTimeInput}`,
        rescheduledFromDate: reschedulingFollowUp.followUpDate,
        rescheduleReason: followUpNotesInput
      });
      setReschedulingFollowUp(null);
      fetchFollowUpsData();
    } catch (err) {
      console.error('Failed to reschedule follow-up:', err);
    }
  };

  const handleConfirmCancelFollowUp = async (target: FollowUp) => {
    if (!confirm('Are you sure you want to cancel this follow-up?')) return;
    try {
      await crmApi.updateRecord('follow_ups', target.id, {
        status: 'CANCELLED'
      });
      fetchFollowUpsData();
    } catch (err) {
      console.error('Failed to cancel follow-up:', err);
    }
  };

  const openEditFollowUpModal = (target: FollowUp) => {
    setEditingFollowUp(target);
    setFollowUpTitleInput(target.title || '');
    setFollowUpTypeInput(target.type || 'CALL');
    setFollowUpPriorityInput(target.priority || 'MEDIUM');
    setFollowUpStatusInput(target.status || 'PENDING');
    setFollowUpDateInput(target.followUpDate || '');
    setFollowUpTimeInput(target.reminderDate?.split(' ')[1] || '');
    setFollowUpPicIdInput(target.picId || '');
    setFollowUpRelatedOppIdInput(target.relatedProjectId || '');
    setFollowUpRelatedVisitIdInput(target.relatedVisitId || '');
    setFollowUpNotesInput(target.notes || '');
  };

  const openRescheduleFollowUpModal = (target: FollowUp) => {
    setReschedulingFollowUp(target);
    setFollowUpDateInput(target.followUpDate || '');
    setFollowUpTimeInput(target.reminderDate?.split(' ')[1] || '');
    setFollowUpNotesInput('');
  };

  const openCompleteFollowUpModal = (target: FollowUp) => {
    setCompletingFollowUp(target);
    setFollowUpNotesInput('');
  };

  const openCreateFollowUpModal = () => {
    setCreatingFollowUp(true);
    setFollowUpTitleInput('');
    setFollowUpTypeInput('CALL');
    setFollowUpPriorityInput('MEDIUM');
    setFollowUpStatusInput('PENDING');
    setFollowUpDateInput(new Date().toISOString().split('T')[0]);
    setFollowUpTimeInput('09:00');
    const defaultPic = tenantUsers.find(u => u.name === 'Current User')?.id || tenantUsers[0]?.id || '';
    setFollowUpPicIdInput(defaultPic);
    setFollowUpRelatedOppIdInput('');
    setFollowUpRelatedVisitIdInput('');
    setFollowUpNotesInput('');
  };

  const followups = followupsList;
  const followUpSearch = '';
  const followUpStatusFilter = 'ALL';
  const followUpPriorityFilter = 'ALL';
  const followUpTypeFilter = 'ALL';
  const followUpPicFilter = 'ALL';
  const followUpDueDateFilter = '';
  const followUpOppFilter = 'ALL';

  return (
    <>


    </>
  );
}

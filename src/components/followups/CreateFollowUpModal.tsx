import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { crmApi } from '../../services/crmApi';
import { masterDataApi } from '../../services/masterDataApi';
import { MasterDataItem, Customer, User } from '../../types';

interface CreateFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newFollowUp: any) => void;
  initialCustomerId?: string;
  initialCustomerName?: string;
  initialProjectId?: string;
  initialProjectName?: string;
  initialVisitId?: string;
  initialVisitTitle?: string;
  initialTaskId?: string;
  initialTaskTitle?: string;
  sourceType?: 'DIRECT' | 'VISIT' | 'PROJECT' | 'TASK';
}

export const CreateFollowUpModal: React.FC<CreateFollowUpModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialCustomerId,
  initialCustomerName,
  initialProjectId,
  initialProjectName,
  initialVisitId,
  initialVisitTitle,
  initialTaskId,
  initialTaskTitle,
  sourceType
}) => {
  const { currentTenant, currentUser } = useAuth();
  const tenantId = currentTenant?.id || '';

  const [types, setTypes] = useState<MasterDataItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [customerId, setCustomerId] = useState(initialCustomerId || '');
  const [typeId, setTypeId] = useState('');
  const [picId, setPicId] = useState(currentUser?.id || '');
  const [title, setTitle] = useState('');
  const [followUpDate, setFollowUpDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [priority, setPriority] = useState<'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    if (initialCustomerId) setCustomerId(initialCustomerId);
    if (currentUser?.id) setPicId(currentUser.id);

    const loadFormData = async () => {
      setIsLoading(true);
      try {
        const [typeList, custList, userList] = await Promise.all([
          masterDataApi.fetchMasterData('follow_up_types', tenantId),
          crmApi.fetchCollection<Customer>('customers', tenantId),
          crmApi.fetchCollection<User>('users', tenantId)
        ]);

        const activeTypes = (typeList || []).filter((t: MasterDataItem) => t.isActive !== false);
        setTypes(activeTypes);
        if (activeTypes.length > 0 && !typeId) {
          setTypeId(activeTypes[0].id);
        }

        setCustomers(custList || []);
        setUsers(userList || []);
      } catch (err: any) {
        console.error('Failed to load form prerequisites:', err);
        setError('Failed to load required data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadFormData();
  }, [isOpen, tenantId, initialCustomerId, currentUser?.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerId) {
      setError('Please select a customer.');
      return;
    }
    if (!typeId) {
      setError('Please select a follow-up activity type.');
      return;
    }
    if (!followUpDate) {
      setError('Please select a due date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedType = types.find((t) => t.id === typeId);
      const selectedCust = customers.find((c) => c.id === customerId);

      const generatedTitle =
        title.trim() ||
        `${selectedType?.label || 'Follow-up'} with ${initialCustomerName || selectedCust?.name || 'Customer'}`;

      let determinedSourceType: 'DIRECT' | 'VISIT' | 'PROJECT' | 'TASK' = 'DIRECT';
      if (initialVisitId) determinedSourceType = 'VISIT';
      else if (initialProjectId) determinedSourceType = 'PROJECT';
      else if (initialTaskId) determinedSourceType = 'TASK';
      else if (sourceType) determinedSourceType = sourceType;

      const res = await crmApi.createFollowUp({
        customerId,
        typeId,
        picId: picId || currentUser?.id,
        followUpDate,
        title: generatedTitle,
        priority,
        notes: notes.trim() || undefined,
        relatedProjectId: initialProjectId || undefined,
        relatedVisitId: initialVisitId || undefined,
        relatedTaskId: initialTaskId || undefined,
        sourceType: determinedSourceType
      });

      if (res.success && res.data) {
        onSuccess(res.data);
        onClose();
      } else {
        setError(res.error || 'Failed to create follow-up.');
      }
    } catch (err: any) {
      console.error('Error creating follow-up:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#4744e5]/10 text-[#4744e5] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">add_task</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-['Hanken_Grotesk']">
                Add Follow-up
              </h2>
              <p className="text-xs text-slate-500">
                Schedule a client touchpoint or next action
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Contextual Parent Banner (if linked to Project/Visit/Task) */}
          {(initialProjectName || initialVisitTitle || initialTaskTitle) && (
            <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                Contextual Link
              </div>
              {initialProjectName && (
                <div className="flex items-center gap-1.5 text-slate-700">
                  <span className="material-symbols-outlined text-[16px] text-indigo-500">monetization_on</span>
                  <span>Project: <strong>{initialProjectName}</strong></span>
                </div>
              )}
              {initialVisitTitle && (
                <div className="flex items-center gap-1.5 text-slate-700">
                  <span className="material-symbols-outlined text-[16px] text-indigo-500">directions_walk</span>
                  <span>Visit: <strong>{initialVisitTitle}</strong></span>
                </div>
              )}
              {initialTaskTitle && (
                <div className="flex items-center gap-1.5 text-slate-700">
                  <span className="material-symbols-outlined text-[16px] text-indigo-500">task_alt</span>
                  <span>Task: <strong>{initialTaskTitle}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Customer Selection */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Customer *</label>
            {initialCustomerId ? (
              <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-semibold flex items-center justify-between">
                <span>{initialCustomerName || 'Selected Customer'}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Locked Context</span>
              </div>
            ) : (
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-hidden focus:border-[#4744e5]"
              >
                <option value="">-- Select Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Follow-up Type Selection (Master Data) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Activity Type *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {types.map((t) => {
                const isSelected = typeId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTypeId(t.id)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#4744e5] bg-[#4744e5]/5 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-[18px] shrink-0"
                      style={{ color: t.color || '#4744e5' }}
                    >
                      {t.icon || 'call'}
                    </span>
                    <span className="truncate font-semibold text-slate-800 text-[11px]">
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {types.length === 0 && !isLoading && (
              <p className="text-amber-600 text-[11px] mt-1">
                No active follow-up types found. Please configure Master Data first.
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Title / Summary <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Discuss Q3 proposal revisions"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-hidden focus:border-[#4744e5]"
            />
          </div>

          {/* Due Date & Priority Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Due Date *</label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-hidden focus:border-[#4744e5]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-hidden focus:border-[#4744e5]"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          {/* Assigned PIC */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Assigned Person (PIC)</label>
            <select
              value={picId}
              onChange={(e) => setPicId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-hidden focus:border-[#4744e5]"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.id === currentUser?.id ? '(You)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Notes / Instructions</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Context notes, talking points, or prep steps..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-hidden focus:border-[#4744e5] resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoading || types.length === 0}
              className="px-5 py-2 bg-[#4744e5] hover:bg-[#3936c5] disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Save Follow-up</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

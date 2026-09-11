import React, { useState, useEffect } from 'react';
import { crmApi } from '../../services/crmApi';
import { FollowUp } from '../../types';

interface CancelFollowUpModalProps {
  followUp: FollowUp;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CancelFollowUpModal: React.FC<CancelFollowUpModalProps> = ({
  followUp,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanReason = reason.trim();
    if (!cleanReason) {
      setError('Please provide a reason for cancelling this follow-up.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await crmApi.cancelFollowUp(followUp.id, cleanReason);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to cancel follow-up.');
      }
    } catch (err: any) {
      setError(err.message || 'Cancellation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-rose-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">cancel</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-['Hanken_Grotesk']">
                Cancel Follow-up
              </h2>
              <p className="text-xs text-slate-500">
                Provide an audit reason for cancelling this activity
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

        {/* Form */}
        <form onSubmit={handleCancel} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="font-bold text-slate-800">{followUp.title}</div>
            <div className="text-slate-500">
              Customer: <strong>{followUp.customerName}</strong>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Cancellation Reason *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              placeholder="e.g. Client requested postponement, duplicate entry, contact unavailable..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-hidden focus:border-rose-500 resize-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Cancelling...</span>
                </>
              ) : (
                <span>Confirm Cancellation</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

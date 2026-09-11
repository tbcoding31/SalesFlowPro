import React, { useState, useEffect, useRef } from 'react';
import { crmApi } from '../../services/crmApi';
import { FollowUp, FollowUpEvidence } from '../../types';

interface CompleteFollowUpModalProps {
  followUp: FollowUp;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CompleteFollowUpModal: React.FC<CompleteFollowUpModalProps> = ({
  followUp,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [outcome, setOutcome] = useState(followUp.outcome || '');
  const [evidences, setEvidences] = useState<FollowUpEvidence[]>(followUp.evidences || []);
  const [isLoadingEvidences, setIsLoadingEvidences] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadEvidences = async () => {
    setIsLoadingEvidences(true);
    try {
      const res = await fetch(`/api/follow-ups/${followUp.id}/evidences`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sfp_auth_token') || ''}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setEvidences(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching evidences:', err);
    } finally {
      setIsLoadingEvidences(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setOutcome(followUp.outcome || '');
      loadEvidences();
    }
  }, [isOpen, followUp.id]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Frontend validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPEG, PNG, and WEBP images are supported.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be 5MB or smaller.');
      return;
    }

    if (evidences.length >= 5) {
      setError('Maximum 5 evidence files allowed per follow-up.');
      return;
    }

    setIsUploading(true);
    try {
      const res = await crmApi.uploadFollowUpEvidence(followUp.id, file);
      if (res.success) {
        await loadEvidences();
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setError(res.error || 'Failed to upload evidence.');
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteEvidence = async (evidenceId: string) => {
    if (!window.confirm('Delete this evidence file?')) return;
    try {
      const res = await crmApi.deleteFollowUpEvidence(followUp.id, evidenceId);
      if (res.success) {
        setEvidences((prev) => prev.filter((e) => e.id !== evidenceId));
      } else {
        setError(res.error || 'Failed to delete evidence.');
      }
    } catch (err: any) {
      setError(err.message || 'Delete failed.');
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (evidences.length === 0) {
      setError('Evidence image is strictly required before marking follow-up as completed.');
      return;
    }

    setIsCompleting(true);
    try {
      const res = await crmApi.completeFollowUp(followUp.id, outcome.trim() || undefined);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to mark follow-up as completed.');
      }
    } catch (err: any) {
      setError(err.message || 'Completion failed.');
    } finally {
      setIsCompleting(false);
    }
  };

  const hasEvidence = evidences.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-['Hanken_Grotesk']">
                Complete Follow-up
              </h2>
              <p className="text-xs text-slate-500">
                Upload evidence photo and record final outcome
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

        {/* Content */}
        <form onSubmit={handleComplete} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Follow-up Summary Info */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="font-bold text-slate-800">{followUp.title}</div>
            <div className="text-slate-500 flex items-center justify-between">
              <span>Customer: <strong>{followUp.customerName}</strong></span>
              <span>Due: {followUp.followUpDate}</span>
            </div>
          </div>

          {/* Mandatory Evidence Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-800 flex items-center gap-1">
                <span>Proof of Execution (Evidence Images)</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-semibold text-slate-500">
                {evidences.length} / 5 files
              </span>
            </div>

            {!hasEvidence && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl flex items-center gap-2 text-[11px] mb-2">
                <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">
                  warning
                </span>
                <span>
                  At least <strong>one image</strong> (JPEG, PNG, WEBP) is required to complete this follow-up.
                </span>
              </div>
            )}

            {/* List existing evidences */}
            {evidences.length > 0 && (
              <div className="space-y-1.5 mb-2.5">
                {evidences.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <a
                        href={`/api/follow-ups/${followUp.id}/evidences/${ev.id}/preview`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-8 h-8 rounded border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0 hover:opacity-80"
                      >
                        <img
                          src={`/api/follow-ups/${followUp.id}/evidences/${ev.id}/preview`}
                          alt={ev.originalFileName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </a>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate text-[11px]">
                          {ev.originalFileName}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {(ev.fileSizeBytes / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteEvidence(ev.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Delete evidence"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Area */}
            {evidences.length < 5 && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                  id="evidence-file-input"
                  disabled={isUploading}
                />
                <label
                  htmlFor="evidence-file-input"
                  className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                    isUploading
                      ? 'border-slate-300 bg-slate-50 opacity-60 cursor-not-allowed'
                      : 'border-slate-200 hover:border-[#4744e5] hover:bg-[#4744e5]/5 bg-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px] text-slate-400">
                    add_photo_alternate
                  </span>
                  <span className="font-semibold text-slate-700">
                    {isUploading ? 'Uploading evidence...' : 'Click to upload proof photo'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    JPEG, PNG, WEBP up to 5MB
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Outcome Notes */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Result / Outcome Notes</span>
              <span className="text-xs font-normal text-slate-400">Optional</span>
            </label>
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              rows={3}
              placeholder="Detail the discussion outcome, next decisions, or client feedback (optional)..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-hidden focus:border-[#4744e5] resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isCompleting}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!hasEvidence || isCompleting || isUploading}
              className={`px-5 py-2 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 ${
                hasEvidence && !isCompleting && !isUploading
                  ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                  : 'bg-slate-300 cursor-not-allowed opacity-70'
              }`}
              title={!hasEvidence ? 'Please upload at least one evidence image to complete' : ''}
            >
              {isCompleting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Completing...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">done_all</span>
                  <span>Complete Follow-up</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

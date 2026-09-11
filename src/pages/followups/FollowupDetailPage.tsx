import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FollowUp, FollowUpEvidence } from '../../types';
import { crmApi } from '../../services/crmApi';
import { CompleteFollowUpModal } from '../../components/followups/CompleteFollowUpModal';
import { CancelFollowUpModal } from '../../components/followups/CancelFollowUpModal';

export const FollowupDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id || '';

  const [followup, setFollowup] = useState<FollowUp | null>(null);
  const [evidences, setEvidences] = useState<FollowUpEvidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Modals
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await crmApi.fetchFollowUpById(id);
      if (data) {
        setFollowup(data);
        setEvidences(data.evidences || []);
      }
    } catch (err) {
      console.error('Error loading followup detail:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, tenantId]);

  const handleUploadEvidence = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploadError(null);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Only JPEG, PNG, and WEBP images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be 5MB or smaller.');
      return;
    }
    if (evidences.length >= 5) {
      setUploadError('Maximum 5 evidence files allowed.');
      return;
    }

    setIsUploading(true);
    try {
      const res = await crmApi.uploadFollowUpEvidence(id, file);
      if (res.success) {
        await loadData();
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setUploadError(res.error || 'Upload failed.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteEvidence = async (evidenceId: string) => {
    if (!id) return;
    if (!window.confirm('Delete this evidence file?')) return;
    try {
      const res = await crmApi.deleteFollowUpEvidence(id, evidenceId);
      if (res.success) {
        setEvidences((prev) => prev.filter((e) => e.id !== evidenceId));
        await loadData();
      } else {
        alert(res.error || 'Failed to delete evidence.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete evidence.');
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const derivedStatus = useMemo(() => {
    if (!followup) return 'SCHEDULED';
    if (followup.status !== 'COMPLETED' && followup.status !== 'CANCELLED') {
      const fDate = followup.followUpDate ? followup.followUpDate.split('T')[0] : '';
      if (fDate && fDate < today) return 'OVERDUE';
      if (fDate && fDate === today) return 'DUE_TODAY';
      return 'SCHEDULED';
    }
    return followup.status as string;
  }, [followup, today]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DUE_TODAY':
        return (
          <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg uppercase tracking-wider border border-amber-200">
            Due Today
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="px-2.5 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-lg uppercase tracking-wider border border-rose-200">
            Overdue
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg uppercase tracking-wider border border-emerald-200">
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg uppercase tracking-wider border border-slate-200">
            Cancelled
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg uppercase tracking-wider border border-blue-200">
            In Progress
          </span>
        );
      case 'SCHEDULED':
      case 'OPEN':
      default:
        return (
          <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg uppercase tracking-wider border border-indigo-200">
            Scheduled
          </span>
        );
    }
  };

  if (!followup && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <h2 className="text-xl font-bold text-slate-800">Follow-up not found</h2>
        <button
          onClick={() => navigate('/followups')}
          className="mt-4 px-4 py-2 bg-[#4744e5] text-white rounded-xl text-xs font-bold"
        >
          Back to Follow-ups
        </button>
      </div>
    );
  }

  if (!followup) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="material-symbols-outlined text-4xl text-[#4744e5] animate-spin">
          progress_activity
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-['Inter',sans-serif] pb-12">
      {/* Back navigation */}
      <button
        onClick={() => navigate('/followups')}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Follow-ups
      </button>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <span
              className="px-2.5 py-1 rounded-md border text-xs font-bold flex items-center gap-1.5"
              style={{
                backgroundColor: `${followup.typeColor || '#4744e5'}15`,
                borderColor: `${followup.typeColor || '#4744e5'}40`,
                color: followup.typeColor || '#4744e5'
              }}
            >
              <span className="material-symbols-outlined text-[16px]">
                {followup.typeIcon || 'call'}
              </span>
              <span>{followup.typeName || followup.type || 'Follow-up'}</span>
            </span>
            <span className="text-xs font-mono font-bold text-slate-400">{followup.id}</span>
          </div>

          <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
            {followup.title}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {followup.status !== 'COMPLETED' && followup.status !== 'CANCELLED' && (
            <>
              <button
                onClick={() => setShowCompleteModal(true)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>Complete</span>
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-4 py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-extrabold rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">cancel</span>
                <span>Cancel</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cancellation Notice */}
      {followup.status === 'CANCELLED' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
          <span className="material-symbols-outlined text-rose-600 text-[24px] shrink-0 mt-0.5">
            cancel
          </span>
          <div>
            <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
              Follow-up Cancelled
            </h4>
            <p className="text-xs text-rose-700 mt-0.5">
              Reason: <strong>{followup.cancellationReason || 'No reason provided'}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Completion Notice */}
      {followup.status === 'COMPLETED' && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
          <span className="material-symbols-outlined text-emerald-600 text-[24px] shrink-0 mt-0.5">
            check_circle
          </span>
          <div>
            <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
              Follow-up Completed
            </h4>
            <p className="text-xs text-emerald-800 mt-0.5">
              Completed by <strong>{followup.completedByName || 'Assigned Agent'}</strong> on{' '}
              {followup.completedAt ? new Date(followup.completedAt).toLocaleString() : 'N/A'}.
            </p>
            {followup.outcome && (
              <p className="text-xs text-emerald-900 mt-1 italic">
                Outcome: "{followup.outcome}"
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN - MAIN CONTENT */}
        <div className="lg:col-span-2 space-y-6">
          {/* Notes Section */}
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs p-6">
            <h3 className="text-xs font-extrabold text-[#1a1c1c] uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-[18px]">subject</span>
              <span>Instructions & Notes</span>
            </h3>
            <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
              {followup.notes || <span className="italic text-slate-400">No notes provided.</span>}
            </div>
          </div>

          {/* Evidence Gallery Card */}
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-extrabold text-[#1a1c1c] uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">
                    photo_camera
                  </span>
                  <span>Execution Evidence Gallery</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Proof photos required for audit and resolution ({evidences.length} / 5 files)
                </p>
              </div>

              {evidences.length < 5 && followup.status !== 'COMPLETED' && followup.status !== 'CANCELLED' && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleUploadEvidence}
                    className="hidden"
                    id="detail-evidence-upload"
                    disabled={isUploading}
                  />
                  <label
                    htmlFor="detail-evidence-upload"
                    className="px-3 py-1.5 bg-[#4744e5]/10 hover:bg-[#4744e5]/20 text-[#4744e5] text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">upload_file</span>
                    <span>{isUploading ? 'Uploading...' : 'Upload Proof'}</span>
                  </label>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{uploadError}</span>
              </div>
            )}

            {evidences.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">
                  add_photo_alternate
                </span>
                <p className="text-xs font-bold text-slate-700">No evidence images attached yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Follow-up completion requires at least one verified image upload.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {evidences.map((ev) => (
                  <div
                    key={ev.id}
                    className="group relative border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col"
                  >
                    <div className="aspect-video w-full bg-slate-200 overflow-hidden flex items-center justify-center">
                      <img
                        src={`/api/follow-ups/${followup.id}/evidences/${ev.id}/preview`}
                        alt={ev.originalFileName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="p-2 flex-1 flex flex-col justify-between text-[10px]">
                      <div className="font-semibold text-slate-800 truncate" title={ev.originalFileName}>
                        {ev.originalFileName}
                      </div>
                      <div className="text-slate-400 flex items-center justify-between mt-1">
                        <span>{(ev.fileSizeBytes / 1024).toFixed(1)} KB</span>
                        <span>{new Date(ev.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={`/api/follow-ups/${followup.id}/evidences/${ev.id}/preview`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 bg-black/60 hover:bg-black/80 text-white rounded-md transition-colors"
                        title="Open Fullscreen"
                      >
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      </a>
                      {followup.status !== 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteEvidence(ev.id)}
                          className="p-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-md transition-colors"
                          title="Delete Evidence"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outcome Notes Section (if completed) */}
          {followup.outcome && (
            <div className="bg-white rounded-2xl border border-emerald-200 shadow-2xs p-6 bg-emerald-50/20">
              <h3 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                  task_alt
                </span>
                <span>Final Resolution Outcome</span>
              </h3>
              <div className="text-xs text-slate-800 leading-relaxed">
                {followup.outcome}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN - METADATA & RELATIONS */}
        <div className="lg:col-span-1 space-y-6">
          {/* Status & Timing */}
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs p-6 space-y-4">
            <h3 className="text-xs font-extrabold text-[#1a1c1c] uppercase tracking-wider">
              Status & Due Date
            </h3>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Status</span>
              {getStatusBadge(derivedStatus)}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Priority</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                {followup.priority || 'MEDIUM'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Due Date</span>
              <span className="text-xs font-bold text-slate-800">
                {followup.followUpDate ? followup.followUpDate.split('T')[0] : '-'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Assigned PIC</span>
              <div className="flex items-center gap-1.5">
                {followup.picAvatar ? (
                  <img
                    src={followup.picAvatar}
                    alt={followup.picName}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold">
                    {(followup.picName || 'U').charAt(0)}
                  </div>
                )}
                <span className="text-xs font-bold text-slate-800">
                  {followup.picName || 'Unassigned'}
                </span>
              </div>
            </div>
          </div>

          {/* Contextual Relations */}
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs p-6 space-y-3.5">
            <h3 className="text-xs font-extrabold text-[#1a1c1c] uppercase tracking-wider">
              Contextual Relationships
            </h3>

            {/* Customer */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">domain</span>
                <span>Customer</span>
              </div>
              <div className="font-bold text-slate-800 text-xs">
                {followup.customerName}
              </div>
              {followup.customerCode && (
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {followup.customerCode}
                </div>
              )}
            </div>

            {/* Related Project */}
            {followup.relatedProjectId && (
              <div
                onClick={() => navigate(`/projects/${followup.relatedProjectId}`)}
                className="p-3 bg-indigo-50/50 hover:bg-indigo-50 rounded-xl border border-indigo-100 cursor-pointer transition-colors"
              >
                <div className="text-[10px] uppercase font-bold text-indigo-600 mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">monetization_on</span>
                  <span>Related Project</span>
                </div>
                <div className="font-bold text-slate-800 text-xs truncate">
                  {followup.projectName || followup.relatedProjectId}
                </div>
              </div>
            )}

            {/* Related Visit */}
            {followup.relatedVisitId && (
              <div
                onClick={() => navigate(`/visits/${followup.relatedVisitId}`)}
                className="p-3 bg-indigo-50/50 hover:bg-indigo-50 rounded-xl border border-indigo-100 cursor-pointer transition-colors"
              >
                <div className="text-[10px] uppercase font-bold text-indigo-600 mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">directions_walk</span>
                  <span>Related Visit</span>
                </div>
                <div className="font-bold text-slate-800 text-xs truncate">
                  {followup.visitTitle || followup.relatedVisitId}
                </div>
              </div>
            )}

            {/* Related Task */}
            {followup.relatedTaskId && (
              <div
                onClick={() => navigate(`/tasks/${followup.relatedTaskId}`)}
                className="p-3 bg-indigo-50/50 hover:bg-indigo-50 rounded-xl border border-indigo-100 cursor-pointer transition-colors"
              >
                <div className="text-[10px] uppercase font-bold text-indigo-600 mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">task_alt</span>
                  <span>Related Task</span>
                </div>
                <div className="font-bold text-slate-800 text-xs truncate">
                  {followup.taskTitle || followup.relatedTaskId}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODALS */}
      {showCompleteModal && (
        <CompleteFollowUpModal
          followUp={followup}
          isOpen={showCompleteModal}
          onClose={() => setShowCompleteModal(false)}
          onSuccess={() => {
            setShowCompleteModal(false);
            loadData();
          }}
        />
      )}

      {showCancelModal && (
        <CancelFollowUpModal
          followUp={followup}
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onSuccess={() => {
            setShowCancelModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};

import React from 'react';
import { AttentionSignal, ProjectAttentionSummary } from '../../../types';

export interface CustomerAttentionTabProps {
  customerAttentionSignals: AttentionSignal[];
  projectAttentionSummary: ProjectAttentionSummary | null;
  onAssignPic: () => void;
  onReviewOverdue: () => void;
  onViewProjects: () => void;
}

export const CustomerAttentionTab: React.FC<CustomerAttentionTabProps> = ({
  customerAttentionSignals,
  projectAttentionSummary,
  onAssignPic,
  onReviewOverdue,
  onViewProjects
}) => {
  if (customerAttentionSignals.length === 0 && (!projectAttentionSummary || projectAttentionSummary.projectsNeedingAttention === 0)) {
    return null;
  }

  return (
    <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
      <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
        <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-amber-700">warning</span>
          <span>Account Attention Signals</span>
        </h3>
        <span className="text-[10px] font-bold text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-200">
          {customerAttentionSignals.length + (projectAttentionSummary?.projectsNeedingAttention || 0)} Signals
        </span>
      </div>

      {/* Direct Customer Signals */}
      {customerAttentionSignals.map((sig, idx) => (
        <div
          key={`c-sig-${idx}`}
          className={`p-2.5 rounded-lg border text-xs flex items-start justify-between gap-3 ${
            sig.severity === 'CRITICAL' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-white border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-start gap-2">
            <span className={`material-symbols-outlined text-base mt-0.5 ${sig.severity === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'}`}>
              {sig.severity === 'CRITICAL' ? 'error' : 'warning'}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{sig.title}</span>
                <span className={`px-1.5 py-0.2 text-[9px] font-extrabold rounded uppercase ${
                  sig.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {sig.severity}
                </span>
              </div>
              <p className="text-[11px] mt-0.5 opacity-90">{sig.reason}</p>
              <div className="text-[10px] font-semibold mt-1 opacity-75">
                👉 Action: {sig.recommendedAction}
              </div>
              <div className="flex gap-1.5 mt-2">
                {sig.code === 'CUSTOMER_NO_ACTIVE_PIC' && (
                  <button
                    onClick={onAssignPic}
                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded"
                  >
                    Assign Active PIC
                  </button>
                )}
                {sig.code === 'CUSTOMER_OVERDUE_ACTION' && (
                  <button
                    onClick={onReviewOverdue}
                    className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded"
                  >
                    Review Overdue Work
                  </button>
                )}
                {sig.code === 'CADENCE_BLOCKED_INVALID_PIC' && (
                  <button
                    onClick={onAssignPic}
                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded"
                  >
                    Update PIC to Unblock
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Related Child Projects Attention Summary */}
      {projectAttentionSummary && projectAttentionSummary.projectsNeedingAttention > 0 && (
        <div className="p-2.5 bg-white rounded-lg border border-amber-200 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900">
              📁 {projectAttentionSummary.projectsNeedingAttention} Child Project{projectAttentionSummary.projectsNeedingAttention > 1 ? 's' : ''} Require Attention
            </span>
            <button
              onClick={onViewProjects}
              className="text-[11px] font-bold text-indigo-600 hover:underline"
            >
              View Projects →
            </button>
          </div>
          <div className="space-y-1">
            {projectAttentionSummary.projects.map((p) => (
              <div key={p.id} className="text-[11px] text-slate-700 flex items-center justify-between bg-slate-50 px-2 py-1 rounded">
                <span className="font-medium truncate max-w-[200px]">{p.title}</span>
                <div className="flex gap-1">
                  {p.signals.map((s, sIdx) => (
                    <span key={sIdx} className="text-[9px] font-bold px-1 rounded bg-amber-100 text-amber-800">
                      {s.code.replace('PROJECT_', '').replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

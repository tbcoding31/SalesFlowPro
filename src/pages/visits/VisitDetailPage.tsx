import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Visit, VisitStatus } from '../../types';
import { crmApi } from '../../services/crmApi';
import { formatDate, formatTime, formatDuration, formatDateTime } from '../../utils/formatters';

export const VisitDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const tenantId = currentUser?.tenantId;

  const [visit, setVisit] = useState<Visit | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Action States
  const [currentStatus, setCurrentStatus] = useState<VisitStatus>('PLANNED');
  const [notes, setNotes] = useState<string>('');

  // Reschedule state
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('10:00');
  const [rescheduleReason, setRescheduleReason] = useState('');

  // Cancel State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Activity History & Related Lists State
  const [activityHistory, setActivityHistory] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [v, hist, tList, fList] = await Promise.all([
        crmApi.fetchRecordById<Visit>('visits', id),
        crmApi.fetchVisitHistory(id),
        crmApi.fetchVisitTasks(id),
        crmApi.fetchVisitFollowups(id)
      ]);

      if (v) {
        setVisit(v);
        setCurrentStatus((v.statusCode || v.status || 'PLANNED') as VisitStatus);
        setNotes(v.notes || '');
        setNewDate(v.visitDate);
        setNewStartTime(v.startTime ? String(v.startTime).substring(0, 5) : '09:00');
        setNewEndTime(v.endTime ? String(v.endTime).substring(0, 5) : '10:00');
      }
      setActivityHistory(Array.isArray(hist) ? hist : []);
      setTasks(Array.isArray(tList) ? tList : []);
      setFollowups(Array.isArray(fList) ? fList : []);
    } catch (err) {
      console.error('Failed to load visit details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, tenantId]);

  // Status Handlers
  const handleStartVisit = async () => {
    if (!visit) return;
    const res = await crmApi.updateRecord('visits', visit.id, {
      statusId: 'VS-5',
      status: 'IN_PROGRESS'
    });
    if (res.error) {
      showToast(res.error);
      return;
    }
    await loadData();
    showToast('Visit started! Status updated to In Progress.');
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visit) return;

    const res = await crmApi.rescheduleVisit(visit.id, {
      visitDate: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      reason: rescheduleReason
    });

    if (!res.success) {
      showToast(res.error || 'Failed to reschedule visit');
      return;
    }

    await loadData();
    setIsRescheduleOpen(false);
    setRescheduleReason('');
    showToast('Visit rescheduled successfully!');
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visit) return;

    const res = await crmApi.cancelVisit(visit.id, cancelReason);
    if (!res.success) {
      showToast(res.error || 'Failed to cancel visit');
      return;
    }

    await loadData();
    setIsCancelModalOpen(false);
    setCancelReason('');
    showToast('Visit has been cancelled.');
  };

  const handleSaveNotes = async () => {
    if (!visit) return;
    const res = await crmApi.updateRecord('visits', visit.id, { notes });
    if (res.error) {
      showToast(res.error);
      return;
    }
    await loadData();
    showToast('Visit notes updated!');
  };

  if (!visit && !isLoading) {
    return (
      <div className="bg-white p-8 rounded-xl border border-[#E1E1E1] text-center max-w-lg mx-auto my-12">
        <h2 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Visit Not Found</h2>
        <p className="text-xs text-[#767587] mt-1">The requested visit could not be found.</p>
        <Link to="/visits" className="inline-block mt-4 px-4 py-2 bg-[#4744e5] text-white text-xs font-bold rounded-lg">
          Return to Visits
        </Link>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="material-symbols-outlined text-4xl text-[#4744e5] animate-spin">progress_activity</span>
      </div>
    );
  }

  // Timeline Step Status Mapping
  const timelineSteps = [
    { key: 'PLANNED', label: 'Planned' },
    { key: 'CONFIRMED', label: 'Confirmed' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'COMPLETED', label: 'Completed' },
  ];

  const getStepState = (stepKey: string) => {
    const order = ['PLANNED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];
    const currentIdx = order.indexOf(currentStatus);
    const stepIdx = order.indexOf(stepKey);

    if (currentStatus === 'CANCELLED') return 'cancelled';
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'active';
    return 'upcoming';
  };

  const statusStr = (visit.statusCode || visit.status || 'PLANNED').toUpperCase();

  return (
    <div className="space-y-6 font-['Inter',sans-serif] pb-12">
      {/* TOAST ALERT */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#1a1c1c] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-5">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP BAR / BREADCRUMB & PRIMARY INFO */}
      <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] mb-1">
              <Link to="/" className="hover:text-[#4744e5] transition-colors">
                Home
              </Link>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <Link to="/visits" className="hover:text-[#4744e5] transition-colors">
                Visits
              </Link>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-[#1a1c1c]">{visit.id}</span>
            </div>

            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
                {visit.customerName}
              </h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                statusStr === 'COMPLETED' ? 'bg-green-50 text-green-700 border border-green-200' :
                statusStr === 'IN_PROGRESS' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                statusStr === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                statusStr === 'CANCELLED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                'bg-slate-100 text-slate-700 border border-slate-200'
              }`}>
                {visit.statusName || visit.statusCode || visit.status}
              </span>
            </div>
            <p className="text-xs text-[#767587] mt-0.5">
              Subject: <span className="font-semibold text-[#1a1c1c]">{visit.title}</span> {visit.customerCode ? `(${visit.customerCode})` : ''}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {statusStr !== 'COMPLETED' && statusStr !== 'CANCELLED' && (
              <button
                onClick={handleStartVisit}
                disabled={statusStr === 'IN_PROGRESS'}
                className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all shadow-xs flex items-center gap-1.5 font-['Hanken_Grotesk'] cursor-pointer ${
                  statusStr === 'IN_PROGRESS'
                    ? 'bg-emerald-600 text-white opacity-80 cursor-default'
                    : 'bg-[#4744e5] hover:bg-[#322fce] text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                <span>{statusStr === 'IN_PROGRESS' ? 'Visit In Progress' : 'Start Visit'}</span>
              </button>
            )}

            {/* Edit Visit button */}
            {statusStr !== 'COMPLETED' && (
              <button
                onClick={() => navigate(`/visits/${visit.id}/edit`)}
                className="px-3.5 py-2 border border-[#E1E1E1] hover:bg-slate-50 text-[#1a1c1c] text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 font-['Hanken_Grotesk'] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                <span>Edit Visit</span>
              </button>
            )}

            {/* Reschedule button available for PLANNED, CONFIRMED, and CANCELLED */}
            {statusStr !== 'COMPLETED' && (
              <button
                onClick={() => {
                  setNewDate(visit.visitDate);
                  setNewStartTime(visit.startTime ? String(visit.startTime).substring(0, 5) : '09:00');
                  setNewEndTime(visit.endTime ? String(visit.endTime).substring(0, 5) : '10:00');
                  setRescheduleReason('');
                  setIsRescheduleOpen(true);
                }}
                className="px-3.5 py-2 border border-[#E1E1E1] hover:bg-slate-50 text-[#1a1c1c] text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 font-['Hanken_Grotesk'] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">update</span>
                <span>Reschedule</span>
              </button>
            )}

            {statusStr !== 'CANCELLED' && statusStr !== 'COMPLETED' && (
              <button
                onClick={() => {
                  setCancelReason('');
                  setIsCancelModalOpen(true);
                }}
                className="px-3.5 py-2 border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 font-['Hanken_Grotesk'] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                <span>Cancel Visit</span>
              </button>
            )}
          </div>
        </div>

        {/* HORIZONTAL STATUS TIMELINE */}
        <div className="pt-2">
          <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block mb-3">
            Visit Progress Timeline
          </span>
          <div className="flex items-center justify-between relative max-w-2xl mx-auto px-4">
            {/* Connecting Line */}
            <div className="absolute top-1/2 left-8 right-8 -translate-y-1/2 h-0.5 bg-[#E1E1E1] -z-0" />

            {timelineSteps.map((step) => {
              const state = getStepState(step.key);
              return (
                <div key={step.key} className="flex flex-col items-center gap-1.5 z-10 bg-white px-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold transition-all border-2 ${
                      state === 'completed'
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : state === 'active'
                        ? 'bg-[#4744e5] border-[#4744e5] text-white shadow-md ring-4 ring-indigo-100'
                        : state === 'cancelled'
                        ? 'bg-rose-100 border-rose-400 text-rose-600'
                        : 'bg-white border-[#E1E1E1] text-[#767587]'
                    }`}
                  >
                    {state === 'completed' ? (
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    ) : (
                      step.label[0]
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-bold font-['Hanken_Grotesk'] ${
                      state === 'active'
                        ? 'text-[#4744e5]'
                        : state === 'completed'
                        ? 'text-emerald-700'
                        : 'text-[#767587]'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CANCELLED BANNER */}
      {statusStr === 'CANCELLED' && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">cancel</span>
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-rose-900 font-['Hanken_Grotesk']">
                This Visit is Cancelled
              </h3>
              <p className="text-xs text-rose-800 mt-0.5">
                {visit.cancellationReason ? `Reason: ${visit.cancellationReason}` : 'This scheduled visit has been cancelled.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsRescheduleOpen(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            Reschedule Visit
          </button>
        </div>
      )}

      {/* COMPLETED BANNER */}
      {statusStr === 'COMPLETED' && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">assignment_turned_in</span>
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-emerald-900 font-['Hanken_Grotesk']">
                Visit Completed
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                {visit.result ? `Outcome: ${visit.result}` : 'All meeting objectives and post-visit reports have been recorded.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* METRIC / ESSENTIAL DATA CARDS (6 CARDS) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Customer Account */}
        <div className="bg-white p-4 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-[#767587]">
            <span className="material-symbols-outlined text-[16px]">domain</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-['Hanken_Grotesk']">Customer</span>
          </div>
          <p className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] truncate">{visit.customerName}</p>
          <p className="text-[10px] text-[#767587]">{visit.customerCode || '—'}</p>
        </div>

        {/* Date */}
        <div className="bg-white p-4 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-[#767587]">
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-['Hanken_Grotesk']">Date</span>
          </div>
          <p className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">{formatDate(visit.visitDate)}</p>
          <p className="text-[10px] text-[#767587]">Scheduled Date</p>
        </div>

        {/* Time & Computed Duration */}
        <div className="bg-white p-4 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-[#767587]">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-['Hanken_Grotesk']">Time</span>
          </div>
          <p className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
            {formatTime(visit.startTime)} - {formatTime(visit.endTime)}
          </p>
          <p className="text-[10px] text-[#767587]">{formatDuration(visit.startTime, visit.endTime)} duration</p>
        </div>

        {/* Location */}
        <div className="bg-white p-4 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-[#767587]">
            <span className="material-symbols-outlined text-[16px]">location_on</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-['Hanken_Grotesk']">Location</span>
          </div>
          <p className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] truncate">{visit.location || '—'}</p>
          <p className="text-[10px] text-[#767587]">Meeting Venue</p>
        </div>

        {/* Purpose */}
        <div className="bg-white p-4 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-[#767587]">
            <span className="material-symbols-outlined text-[16px]">flag</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-['Hanken_Grotesk']">Purpose</span>
          </div>
          <p className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
            {visit.purposeName || visit.purpose || '—'}
          </p>
          <p className="text-[10px] text-[#767587]">{visit.purposeCode || 'Objective'}</p>
        </div>

        {/* PIC */}
        <div className="bg-white p-4 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-[#767587]">
            <span className="material-symbols-outlined text-[16px]">account_circle</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-['Hanken_Grotesk']">PIC</span>
          </div>
          <div className="flex items-center gap-1.5">
            <img
              src={visit.picAvatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'}
              alt={visit.picName || 'PIC'}
              className="w-4 h-4 rounded-full object-cover"
            />
            <p className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] truncate">{visit.picName || '—'}</p>
          </div>
          <p className="text-[10px] text-[#767587]">Sales Lead</p>
        </div>
      </div>

      {/* LOWER SECTION: NOTES, ACTIVITY HISTORY, TASKS, FOLLOW-UPS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT 2 COLS: NOTES & ACTIVITY HISTORY */}
        <div className="lg:col-span-2 space-y-6">
          {/* Visit Notes Card */}
          <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#f0f0f4] pb-3">
              <h3 className="font-extrabold text-sm text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4744e5] text-[18px]">notes</span>
                <span>Visit Notes</span>
              </h3>
              <button
                onClick={handleSaveNotes}
                className="text-xs font-bold text-[#4744e5] hover:underline cursor-pointer"
              >
                Save Notes
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full p-3 border border-[#E1E1E1] rounded-xl text-xs bg-slate-50/50 text-[#1a1c1c] focus:outline-none focus:border-[#4744e5] focus:bg-white resize-none font-medium"
              placeholder="Enter preparation notes or agenda discussion items..."
            />
          </div>

          {/* Activity History Card (Authoritative from audit_logs) */}
          <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-4">
            <div className="border-b border-[#f0f0f4] pb-3">
              <h3 className="font-extrabold text-sm text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4744e5] text-[18px]">history</span>
                <span>Activity History</span>
              </h3>
            </div>

            <div className="space-y-3">
              {activityHistory.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#767587]">
                  No activity history recorded
                </div>
              ) : (
                activityHistory.map((item) => (
                  <div key={item.id} className="flex gap-3 text-xs border-b border-slate-100 last:border-none pb-2.5">
                    <div className="w-2 h-2 rounded-full bg-[#4744e5] mt-1.5 shrink-0" />
                    <div>
                      <p className="text-[#1a1c1c] font-medium">{item.description || item.action}</p>
                      <div className="flex items-center gap-2 text-[10px] text-[#767587] mt-0.5">
                        <span className="font-bold text-[#555468]">{item.userName || 'System'}</span>
                        <span>•</span>
                        <span>{formatDateTime(item.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT 1 COL: PARTICIPANTS, TASKS, FOLLOW-UPS */}
        <div className="space-y-6">
          {/* Participants Card */}
          <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#f0f0f4] pb-3">
              <h3 className="font-extrabold text-sm text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4744e5] text-[18px]">group</span>
                <span>Participants</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-[#555468]">
                {(visit.participants || []).length} Assigned
              </span>
            </div>

            {(!visit.participants || visit.participants.length === 0) ? (
              <p className="text-xs text-[#767587] py-2">No participants assigned</p>
            ) : (
              <div className="space-y-2">
                {visit.participants.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs">
                    <img
                      src={p.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'}
                      alt={p.userName || 'User'}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <div>
                      <div className="font-semibold text-[#1a1c1c]">{p.userName}</div>
                      <div className="text-[10px] text-[#767587]">{p.userEmail || p.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Related Tasks Card */}
          <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#f0f0f4] pb-3">
              <h3 className="font-extrabold text-sm text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4744e5] text-[18px]">task_alt</span>
                <span>Related Tasks</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-[#555468]">
                {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
              </span>
            </div>

            {tasks.length === 0 ? (
              <div className="text-center py-4 text-xs text-[#767587]">
                No tasks linked to this visit
              </div>
            ) : (
              <div className="space-y-2.5">
                {tasks.map((t: any) => (
                  <div key={t.id} className="p-3 border border-[#E1E1E1] rounded-xl hover:border-[#4744e5] transition-all text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
                        {t.title}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {t.priorityName || t.priorityId || 'Normal'}
                      </span>
                    </div>
                    {t.description && <p className="text-[11px] text-[#767587]">{t.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Related Follow-ups Card */}
          <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#f0f0f4] pb-3">
              <h3 className="font-extrabold text-sm text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4744e5] text-[18px]">nest_clock_farsight_analog</span>
                <span>Related Follow-ups</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-[#555468]">
                {followups.length} Scheduled
              </span>
            </div>

            {followups.length === 0 ? (
              <div className="text-center py-4 text-xs text-[#767587]">
                No follow-ups linked to this visit
              </div>
            ) : (
              <div className="space-y-2.5">
                {followups.map((f: any) => (
                  <div key={f.id} className="p-3 border border-[#E1E1E1] rounded-xl hover:border-[#4744e5] transition-all text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
                        {f.title}
                      </span>
                      <span className="text-[10px] text-[#4744e5] font-bold">
                        {formatDate(f.followUpDate)}
                      </span>
                    </div>
                    {f.notes && <p className="text-[11px] text-[#767587]">{f.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RESCHEDULE MODAL */}
      {isRescheduleOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-[#E1E1E1] shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#f0f0f4] pb-3">
              <h3 className="font-extrabold text-base text-[#1a1c1c] font-['Hanken_Grotesk']">
                Reschedule Visit
              </h3>
              <button
                onClick={() => setIsRescheduleOpen(false)}
                className="text-[#767587] hover:text-[#1a1c1c]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#1a1c1c] block mb-1">New Date *</label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full p-2.5 border border-[#E1E1E1] rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#1a1c1c] block mb-1">Start Time *</label>
                  <input
                    type="time"
                    required
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full p-2.5 border border-[#E1E1E1] rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#1a1c1c] block mb-1">End Time *</label>
                  <input
                    type="time"
                    required
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full p-2.5 border border-[#E1E1E1] rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#1a1c1c] block mb-1">Reason for Rescheduling</label>
                <textarea
                  rows={2}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Client requested postponement due to executive conflict..."
                  className="w-full p-2.5 border border-[#E1E1E1] rounded-xl font-medium resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f0f0f4]">
                <button
                  type="button"
                  onClick={() => setIsRescheduleOpen(false)}
                  className="px-4 py-2 border border-[#E1E1E1] text-xs font-bold rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4744e5] text-white text-xs font-extrabold rounded-xl hover:bg-[#322fce]"
                >
                  Confirm Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-[#E1E1E1] shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#f0f0f4] pb-3">
              <h3 className="font-extrabold text-base text-rose-600 font-['Hanken_Grotesk']">
                Cancel Visit
              </h3>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="text-[#767587] hover:text-[#1a1c1c]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-3 text-xs">
              <p className="text-[#555468]">
                Are you sure you want to cancel the visit with <span className="font-bold text-[#1a1c1c]">{visit.customerName}</span>?
              </p>

              <div>
                <label className="font-bold text-[#1a1c1c] block mb-1">Cancellation Reason</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Client requested postponement due to internal audit..."
                  className="w-full p-2.5 border border-[#E1E1E1] rounded-xl font-medium resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f0f0f4]">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 border border-[#E1E1E1] text-xs font-bold rounded-xl hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 text-white text-xs font-extrabold rounded-xl hover:bg-rose-700"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitDetailPage;

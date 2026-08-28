import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Visit, VisitStatus } from '../../types';
import { crmApi } from '../../services/crmApi';

export const VisitDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const tenantId = currentUser?.tenantId || 'TEN-00001';

  const [visit, setVisit] = useState<Visit | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const v = await crmApi.fetchRecordById<Visit>('visits', id);
      if (v) {
        setVisit(v);
        setCurrentStatus(v.status);
        setNotes(v.notes || '');
        setNewDate(v.visitDate);
        setNewStartTime(v.startTime);
        setNewEndTime(v.endTime);
      }
    } catch (err) {
      console.error('Failed to load visit details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, tenantId]);

  // Modals & Action States
  const [currentStatus, setCurrentStatus] = useState<VisitStatus>('PLANNED');
  const [notes, setNotes] = useState<string>('');
  
  // Reschedule state
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('10:00');

  // Cancel State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Activity History State
  const [activityHistory, setActivityHistory] = useState([
    { id: '1', date: '2026-08-01 09:30', user: 'PIC', action: 'Scheduled initial visit' },
  ]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Status Handlers
  const handleStartVisit = async () => {
    if (!visit) return;
    setCurrentStatus('IN_PROGRESS');
    const updated = { ...visit, status: 'IN_PROGRESS' as VisitStatus };
    await crmApi.updateRecord('visits', visit.id, updated);
    loadData();
    setActivityHistory([
      ...activityHistory,
      { id: Date.now().toString(), date: new Date().toLocaleString(), user: currentUser?.name || 'User', action: 'Marked visit as In Progress (Started)' },
    ]);
    showToast('Visit started! Status updated to In Progress.');
  };

  const handleRescheduleSubmit = async () => {
    if (!visit) return;
    setCurrentStatus('RESCHEDULED');
    const updated = {
      ...visit,
      status: 'RESCHEDULED' as VisitStatus,
      visitDate: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
    };
    await crmApi.updateRecord('visits', visit.id, updated);
    loadData();
    setIsRescheduleOpen(false);
    setActivityHistory([
      ...activityHistory,
      { id: Date.now().toString(), date: new Date().toLocaleString(), user: currentUser?.name || 'User', action: `Rescheduled visit to ${newDate} (${newStartTime}-${newEndTime})` },
    ]);
    showToast('Visit rescheduled successfully!');
  };

  const handleCancelSubmit = async () => {
    if (!visit) return;
    setCurrentStatus('CANCELLED');
    const updated = { ...visit, status: 'CANCELLED' as VisitStatus, notes: `[Cancelled: ${cancelReason}] ${visit.notes || ''}` };
    await crmApi.updateRecord('visits', visit.id, updated);
    loadData();
    setIsCancelModalOpen(false);
    setActivityHistory([
      ...activityHistory,
      { id: Date.now().toString(), date: new Date().toLocaleString(), user: currentUser?.name || 'User', action: `Cancelled visit: ${cancelReason}` },
    ]);
    showToast('Visit has been cancelled.');
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
    return 'pending';
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif] pb-16 max-w-7xl mx-auto">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#1a1c1c] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <span className="material-symbols-outlined text-emerald-400 text-[20px]">check_circle</span>
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[11px] font-bold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk']">
          <Link to="/visits" className="hover:text-[#4744e5] transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">calendar_month</span>
            <span>Visits</span>
          </Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-[#1a1c1c]">Customer Visit Detail</span>
        </div>

        {/* Title & Top Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#f0f0f4] pb-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk']">
                Customer Visit
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                  currentStatus === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : currentStatus === 'CONFIRMED'
                    ? 'bg-indigo-100 text-indigo-800'
                    : currentStatus === 'IN_PROGRESS'
                    ? 'bg-blue-100 text-blue-800'
                    : currentStatus === 'CANCELLED'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {currentStatus}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight mt-1">
              {visit.customerName}
            </h1>
            <p className="text-xs text-[#767587] mt-0.5">
              Subject: <span className="font-semibold text-[#1a1c1c]">{visit.title || visit.purpose}</span> ({visit.customerCode})
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {currentStatus !== 'COMPLETED' && currentStatus !== 'CANCELLED' && (
              <button
                onClick={handleStartVisit}
                disabled={currentStatus === 'IN_PROGRESS'}
                className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all shadow-xs flex items-center gap-1.5 font-['Hanken_Grotesk'] cursor-pointer ${
                  currentStatus === 'IN_PROGRESS'
                    ? 'bg-emerald-600 text-white opacity-80 cursor-default'
                    : 'bg-[#4744e5] hover:bg-[#322fce] text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                <span>{currentStatus === 'IN_PROGRESS' ? 'Visit In Progress' : 'Start Visit'}</span>
              </button>
            )}

            {currentStatus !== 'CANCELLED' && (
              <button
                onClick={() => setIsRescheduleOpen(true)}
                className="px-3.5 py-2 border border-[#E1E1E1] hover:bg-slate-50 text-[#1a1c1c] text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 font-['Hanken_Grotesk'] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">update</span>
                <span>Reschedule</span>
              </button>
            )}

            {currentStatus !== 'CANCELLED' && currentStatus !== 'COMPLETED' && (
              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="px-3.5 py-2 border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 font-['Hanken_Grotesk'] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                <span>Cancel</span>
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

      {/* COMPLETED BANNER (WHEN STATUS IS COMPLETED) */}
      {currentStatus === 'COMPLETED' && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">assignment_turned_in</span>
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-[#1a1c1c] font-['Hanken_Grotesk']">
                Visit Report Required
              </h3>
              <p className="text-xs text-[#555468] mt-0.5">
                This customer visit is completed. Please submit the final visit report and key action items for executive review.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate(`/visits/${visit.id}/report`)}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer font-['Hanken_Grotesk']"
          >
            <span className="material-symbols-outlined text-[18px]">edit_note</span>
            <span>Complete Visit & Submit Report</span>
          </button>
        </div>
      )}

      {/* INFORMATION CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        {/* Customer */}
        <div className="bg-white p-4 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-[#767587]">
            <span className="material-symbols-outlined text-[16px]">domain</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-['Hanken_Grotesk']">Customer</span>
          </div>
          <p className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] truncate">{visit.customerName}</p>
          <p className="text-[10px] text-[#767587]">{visit.customerCode}</p>
        </div>

        {/* Date */}
        <div className="bg-white p-4 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-[#767587]">
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-['Hanken_Grotesk']">Date</span>
          </div>
          <p className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">{visit.visitDate}</p>
          <p className="text-[10px] text-[#767587]">Scheduled</p>
        </div>

        {/* Time */}
        <div className="bg-white p-4 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-[#767587]">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-['Hanken_Grotesk']">Time</span>
          </div>
          <p className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">{visit.startTime} - {visit.endTime}</p>
          <p className="text-[10px] text-[#767587]">1.5 Hours duration</p>
        </div>

        {/* Location */}
        <div className="bg-white p-4 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-[#767587]">
            <span className="material-symbols-outlined text-[16px]">location_on</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-['Hanken_Grotesk']">Location</span>
          </div>
          <p className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] truncate">{visit.location}</p>
          <p className="text-[10px] text-[#767587]">On-site Visit</p>
        </div>

        {/* Purpose */}
        <div className="bg-white p-4 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-[#767587]">
            <span className="material-symbols-outlined text-[16px]">flag</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-['Hanken_Grotesk']">Purpose</span>
          </div>
          <p className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">{visit.purpose}</p>
          <p className="text-[10px] text-[#767587]">Primary Objective</p>
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
              alt={visit.picName}
              className="w-4 h-4 rounded-full object-cover"
            />
            <p className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] truncate">{visit.picName}</p>
          </div>
          <p className="text-[10px] text-[#767587]">Sales Lead</p>
        </div>

        {/* Participants */}
        <div className="bg-white p-4 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-[#767587]">
            <span className="material-symbols-outlined text-[16px]">group</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-['Hanken_Grotesk']">Participants</span>
          </div>
          <div className="flex -space-x-1.5 pt-0.5">
            <img
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
              alt="Sarah"
              className="w-5 h-5 rounded-full object-cover border border-white"
              title="Sarah Jenkins"
            />
            <img
              src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
              alt="Michael"
              className="w-5 h-5 rounded-full object-cover border border-white"
              title="Michael Rodriguez"
            />
            <span className="w-5 h-5 rounded-full bg-slate-100 border border-white text-[9px] font-bold text-[#555468] flex items-center justify-center">
              +1
            </span>
          </div>
          <p className="text-[10px] text-[#767587]">3 Team Members</p>
        </div>
      </div>

      {/* LOWER SECTION: NOTES, TASKS, FOLLOW-UPS, HISTORY */}
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
                onClick={async () => {
                  const updated = { ...visit, notes };
                  await crmApi.updateRecord('visits', visit.id, updated);
                  showToast('Visit notes updated!');
                }}
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

          {/* Activity History Card */}
          <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-4">
            <div className="border-b border-[#f0f0f4] pb-3">
              <h3 className="font-extrabold text-sm text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4744e5] text-[18px]">history</span>
                <span>Activity History</span>
              </h3>
            </div>

            <div className="space-y-3">
              {activityHistory.map((item) => (
                <div key={item.id} className="flex gap-3 text-xs border-b border-slate-100 last:border-none pb-2.5">
                  <div className="w-2 h-2 rounded-full bg-[#4744e5] mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[#1a1c1c] font-medium">{item.action}</p>
                    <div className="flex items-center gap-2 text-[10px] text-[#767587] mt-0.5">
                      <span className="font-bold text-[#555468]">{item.user}</span>
                      <span>•</span>
                      <span>{item.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT 1 COL: RELATED TASKS & FOLLOW-UPS */}
        <div className="space-y-6">
          {/* Related Tasks Card */}
          <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#f0f0f4] pb-3">
              <h3 className="font-extrabold text-sm text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4744e5] text-[18px]">task_alt</span>
                <span>Related Tasks</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-[#555468]">
                2 Tasks
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 border border-[#E1E1E1] rounded-xl hover:border-[#4744e5] transition-all text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
                    Prepare Q3 Deck
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                    High
                  </span>
                </div>
                <p className="text-[11px] text-[#767587]">Compile SLA performance data for PT Maju Jaya</p>
              </div>

              <div className="p-3 border border-[#E1E1E1] rounded-xl hover:border-[#4744e5] transition-all text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
                    Confirm Visitor Badges
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Normal
                  </span>
                </div>
                <p className="text-[11px] text-[#767587]">Coordinate Cyber 2 Tower lobby registration</p>
              </div>
            </div>
          </div>

          {/* Related Follow-ups Card */}
          <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#f0f0f4] pb-3">
              <h3 className="font-extrabold text-sm text-[#1a1c1c] font-['Hanken_Grotesk'] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4744e5] text-[18px]">nest_clock_farsight_analog</span>
                <span>Related Follow-ups</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-[#555468]">
                1 Scheduled
              </span>
            </div>

            <div className="p-3 border border-[#E1E1E1] rounded-xl hover:border-[#4744e5] transition-all text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Send Proposal Draft
                </span>
                <span className="text-[10px] text-[#4744e5] font-bold">Aug 14, 2026</span>
              </div>
              <p className="text-[11px] text-[#767587]">Email revised license pricing model post-visit.</p>
            </div>
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

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#1a1c1c] block mb-1">New Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full p-2.5 border border-[#E1E1E1] rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#1a1c1c] block mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full p-2.5 border border-[#E1E1E1] rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#1a1c1c] block mb-1">End Time</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full p-2.5 border border-[#E1E1E1] rounded-xl font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f0f0f4]">
              <button
                onClick={() => setIsRescheduleOpen(false)}
                className="px-4 py-2 border border-[#E1E1E1] text-xs font-bold rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleSubmit}
                className="px-4 py-2 bg-[#4744e5] text-white text-xs font-extrabold rounded-xl hover:bg-[#322fce]"
              >
                Confirm Reschedule
              </button>
            </div>
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

            <div className="space-y-3 text-xs">
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
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f0f0f4]">
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 border border-[#E1E1E1] text-xs font-bold rounded-xl hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={handleCancelSubmit}
                className="px-4 py-2 bg-rose-600 text-white text-xs font-extrabold rounded-xl hover:bg-rose-700"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitDetailPage;

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Visit, VisitStatus } from '../../types';
import { crmApi } from '../../services/crmApi';

export const VisitReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const tenantId = currentUser?.tenantId || 'TEN-00001';

  const [visit, setVisit] = useState<Visit | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      crmApi.fetchRecordById<Visit>('visits', id).then(v => {
        if (v) setVisit(v);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [id, tenantId]);

  // Form State
  const [visitResult, setVisitResult] = useState<string>('Successful');
  const [discussionSummary, setDiscussionSummary] = useState<string>('');
  const [customerNeeds, setCustomerNeeds] = useState<string>('');
  const [projectIdentified, setProjectIdentified] = useState<boolean>(false);
  const [projectDetails, setProjectDetails] = useState<string>('');
  const [nextAction, setNextAction] = useState<string>('');
  const [nextFollowupDate, setNextFollowupDate] = useState<string>('');

  // UI State
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveDraft = () => {
    showToast('Draft saved successfully.');
  };

  const handleCreateFollowUpTask = () => {
    showToast('Follow-up task creation triggered.');
  };

  const handleCompleteVisit = async () => {
    if (!discussionSummary) {
      alert('Please provide a discussion summary before completing the visit.');
      return;
    }

    if (!visit) return;

    const updatedVisit = {
      ...visit,
      status: 'COMPLETED' as VisitStatus,
      result: visitResult,
      nextAction: nextAction,
    };
    
    await crmApi.updateRecord('visits', visit.id, updatedVisit);
    setIsSubmitted(true);
  };

  if (!visit && !isLoading) {
    return (
      <div className="bg-white p-8 rounded-xl border border-[#E1E1E1] text-center max-w-lg mx-auto my-12">
        <h2 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Visit Not Found</h2>
        <p className="text-xs text-[#767587] mt-1">The requested visit report could not be found.</p>
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

  // If submitted, show success state
  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 font-['Inter',sans-serif]">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center animate-bounce">
          <span className="material-symbols-outlined text-[40px] text-emerald-600">check_circle</span>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">Visit Report Submitted!</h2>
          <p className="text-[#555468] max-w-md mx-auto text-sm">
            Your visit report for <span className="font-bold text-[#1a1c1c]">{visit.customerName}</span> has been successfully saved and the visit is marked as completed.
          </p>
        </div>
        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={() => navigate(`/visits/${visit.id}`)}
            className="px-6 py-2.5 border border-[#E1E1E1] hover:bg-slate-50 text-[#1a1c1c] text-sm font-bold rounded-xl transition-all font-['Hanken_Grotesk']"
          >
            View Visit Details
          </button>
          <button
            onClick={() => navigate('/visits')}
            className="px-6 py-2.5 bg-[#4744e5] hover:bg-[#322fce] text-white text-sm font-extrabold rounded-xl shadow-md transition-all font-['Hanken_Grotesk']"
          >
            Back to All Visits
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-['Inter',sans-serif] pb-16 max-w-7xl mx-auto">
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
          <Link to={`/visits/${visit.id}`} className="hover:text-[#4744e5] transition-colors">
            {visit.customerName}
          </Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-[#1a1c1c]">Visit Report</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
              Visit Report
            </h1>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-[#555468] flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="font-semibold text-[#1a1c1c]">Customer:</span>
                {visit.customerName}
              </span>
              <span className="text-[#E1E1E1]">|</span>
              <span className="flex items-center gap-1.5">
                <span className="font-semibold text-[#1a1c1c]">PIC:</span>
                {visit.picName}
              </span>
              <span className="text-[#E1E1E1]">|</span>
              <span className="flex items-center gap-1.5">
                <span className="font-semibold text-[#1a1c1c]">Visit:</span>
                {new Date(visit.visitDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate(`/visits/${visit.id}`)}
            className="px-3.5 py-1.5 border border-[#E1E1E1] text-[#555468] hover:bg-slate-50 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Cancel</span>
          </button>
        </div>
      </div>

      {/* TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: MAIN FORM (Takes up 2 columns on lg screens) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-6">
            
            {/* Visit Result */}
            <div className="space-y-3">
              <label className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] uppercase tracking-wider block">
                Visit Result <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['Successful', 'Follow-up Required', 'No Project', 'Customer Unavailable'].map((res) => (
                  <label
                    key={res}
                    className={`flex items-center justify-center p-3 border rounded-xl cursor-pointer transition-all text-xs font-bold text-center ${
                      visitResult === res
                        ? 'border-[#4744e5] bg-indigo-50/50 text-[#4744e5] ring-1 ring-[#4744e5]'
                        : 'border-[#E1E1E1] bg-white text-[#555468] hover:border-[#a0a0b0]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visitResult"
                      value={res}
                      checked={visitResult === res}
                      onChange={(e) => setVisitResult(e.target.value)}
                      className="hidden"
                    />
                    <span>{res}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Discussion Summary */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Discussion Summary <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={discussionSummary}
                onChange={(e) => setDiscussionSummary(e.target.value)}
                rows={4}
                placeholder="What was discussed during the visit?"
                className="w-full p-3.5 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] placeholder:text-[#a0a0b0] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium resize-none"
              />
            </div>

            {/* Customer Needs */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Customer Needs / Pain Points
              </label>
              <textarea
                value={customerNeeds}
                onChange={(e) => setCustomerNeeds(e.target.value)}
                rows={3}
                placeholder="List any specific needs or pain points mentioned by the customer..."
                className="w-full p-3.5 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] placeholder:text-[#a0a0b0] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium resize-none"
              />
            </div>

            {/* Project Identified */}
            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={projectIdentified}
                    onChange={(e) => setProjectIdentified(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#4744e5]/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#4744e5]"></div>
                </div>
                <span className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] group-hover:text-[#4744e5] transition-colors">
                  Project Identified?
                </span>
              </label>
            </div>

            {/* Project Details (Conditional) */}
            {projectIdentified && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] text-indigo-700">
                  Project Details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={projectDetails}
                  onChange={(e) => setProjectDetails(e.target.value)}
                  rows={3}
                  placeholder="Describe the potential project, estimated value, or product interest..."
                  className="w-full p-3.5 border border-indigo-200 rounded-xl text-xs bg-indigo-50/30 text-[#1a1c1c] placeholder:text-[#a0a0b0] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium resize-none"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Next Action */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Next Action
                </label>
                <input
                  type="text"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="e.g. Send proposal"
                  className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] placeholder:text-[#a0a0b0] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium"
                />
              </div>

              {/* Next Follow-up Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Next Follow-up Date
                </label>
                <input
                  type="date"
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] font-medium"
                />
              </div>
            </div>

            <hr className="border-[#f0f0f4]" />

            {/* Attachments */}
            <div className="space-y-3">
              <label className="text-xs font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] uppercase tracking-wider block">
                Attachments (Photos & Documents)
              </label>
              <div className="border-2 border-dashed border-[#E1E1E1] hover:border-[#4744e5] rounded-2xl p-8 text-center transition-colors cursor-pointer bg-slate-50/50">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm mb-3">
                  <span className="material-symbols-outlined text-[#4744e5]">upload_file</span>
                </div>
                <p className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-[#767587] mt-1">
                  PNG, JPG, PDF up to 10MB
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SUMMARY PANEL */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-[#E1E1E1] shadow-2xs space-y-5 sticky top-6">
            <div className="flex items-center gap-2 border-b border-[#f0f0f4] pb-3">
              <span className="material-symbols-outlined text-[#4744e5] text-[20px]">info</span>
              <h2 className="text-base font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Visit Summary
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block mb-1">
                  Customer
                </span>
                <p className="text-sm font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  {visit.customerName}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block mb-1">
                  PIC
                </span>
                <div className="flex items-center gap-2">
                  <img src={visit.picAvatar} alt={visit.picName} className="w-5 h-5 rounded-full object-cover" />
                  <p className="text-xs font-bold text-[#1a1c1c]">
                    {visit.picName}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block mb-1">
                  Visit Date
                </span>
                <p className="text-xs font-bold text-[#1a1c1c]">
                  {new Date(visit.visitDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block mb-1">
                  Visit Duration
                </span>
                <p className="text-xs font-bold text-[#1a1c1c]">
                  {visit.startTime} - {visit.endTime}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider font-['Hanken_Grotesk'] block mb-1">
                  Current Status
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-blue-100 text-blue-800">
                  {visit.status === 'COMPLETED' ? 'COMPLETED' : 'IN PROGRESS'}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#f0f0f4] space-y-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="w-full py-2.5 border border-[#E1E1E1] hover:bg-slate-50 text-[#1a1c1c] text-xs font-bold rounded-xl transition-all font-['Hanken_Grotesk']"
              >
                Save Draft
              </button>
              
              <button
                type="button"
                onClick={handleCreateFollowUpTask}
                className="w-full py-2.5 border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-[#4744e5] text-xs font-bold rounded-xl transition-all font-['Hanken_Grotesk'] flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">add_task</span>
                <span>Create Follow-up Task</span>
              </button>

              <button
                type="button"
                onClick={handleCompleteVisit}
                className="w-full py-3 bg-[#4744e5] hover:bg-[#322fce] text-white text-xs font-extrabold rounded-xl shadow-md transition-all font-['Hanken_Grotesk'] flex items-center justify-center gap-1.5 mt-2"
              >
                <span className="material-symbols-outlined text-[18px]">done_all</span>
                <span>Complete Visit</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitReportPage;

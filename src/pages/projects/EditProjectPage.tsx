import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import {
  resolveProjectNavigation,
  getProjectEditReturnUrl,
  getProjectDetailBackUrl,
  buildProjectDetailUrl
} from '../../utils/projectNavigation';
import { useAuth } from '../../context/AuthContext';
import { Customer, User, Project } from '../../types';
import { crmApi } from '../../services/crmApi';
import { usersApi } from '../../services/usersApi';

export const EditProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  const [project, setProject] = useState<Project | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const navContext = resolveProjectNavigation(searchParams);
  const returnUrl = id ? getProjectEditReturnUrl(id, navContext) : '/projects?view=list';

  // Form State
  const [title, setTitle] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [value, setValue] = useState<number | string>('');
  const [probability, setProbability] = useState<number | string>('');
  const [expectedCloseDate, setExpectedCloseDate] = useState<string>('');
  const [selectedPicId, setSelectedPicId] = useState<string>('');

  // Validation Errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Authoritative Hydration
  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);

    Promise.all([
      crmApi.fetchProjectById(id),
      crmApi.fetchCustomers({ page: 1, pageSize: 200 }),
      usersApi.fetchUsers(undefined, true).catch(() => ({ data: [] }))
    ])
      .then(([projData, custRes, usersRes]) => {
        if (!mounted) return;

        if (!projData) {
          setErrorMessage(`Project '${id}' not found or access denied.`);
          setLoading(false);
          return;
        }

        setProject(projData);
        setTitle(projData.title || projData.name || '');
        setSelectedCustomerId(projData.customerId || '');
        setDescription(projData.description || '');
        setValue(projData.value !== undefined ? projData.value : (projData.estimatedValue || 0));
        setProbability(projData.probability !== undefined ? projData.probability : 0);
        
        let closeDateStr = '';
        if (projData.expectedCloseDate) {
          try {
            closeDateStr = new Date(projData.expectedCloseDate).toISOString().split('T')[0];
          } catch {
            closeDateStr = String(projData.expectedCloseDate).split('T')[0];
          }
        }
        setExpectedCloseDate(closeDateStr);
        setSelectedPicId(projData.picId || '');

        setCustomers(Array.isArray(custRes) ? custRes : (custRes?.data || []));
        const userList = (usersRes as any)?.data || (Array.isArray(usersRes) ? usersRes : []);
        setUsers(userList);

        setIsHydrated(true);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('[EditProjectPage hydration error]', err);
        setErrorMessage(err.message || 'Failed to load project details.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, tenantId]);

  const validateForm = (): boolean => {
    const errs: { [key: string]: string } = {};

    if (!title.trim()) {
      errs.title = 'Project Title is required.';
    }

    if (!selectedCustomerId) {
      errs.customerId = 'Customer is required.';
    }

    if (value === '' || isNaN(Number(value)) || Number(value) < 0) {
      errs.value = 'Value must be a non-negative number.';
    }

    if (probability === '' || isNaN(Number(probability)) || Number(probability) < 0 || Number(probability) > 100) {
      errs.probability = 'Probability must be between 0 and 100.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !project) return;

    if (project.stageIsTerminal) {
      alert(`This project is in a terminal stage ('${project.stageName || project.stage}') and is locked for generic edit. Reopen the project first to make changes.`);
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Strict invariant: stageId is strictly omitted from generic edit payload
      const payload: any = {
        title: title.trim(),
        customerId: selectedCustomerId,
        description: description.trim(),
        value: Number(value),
        probability: Number(probability),
        expectedCloseDate: expectedCloseDate || null,
        picId: selectedPicId || null
      };

      const res = await crmApi.updateProject(id, payload);
      if (!res.success) {
        throw new Error(res.error || 'Failed to update project');
      }

      setToastMessage('Project updated successfully!');
      setTimeout(() => {
        navigate(returnUrl);
      }, 500);
    } catch (err: any) {
      console.error('[EditProjectPage save error]', err);
      alert(err.message || 'Failed to save changes');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && !isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-indigo-600 animate-spin">
            progress_activity
          </span>
          <span className="text-xs font-bold text-slate-500">Loading project data...</span>
        </div>
      </div>
    );
  }

  if (errorMessage && !project) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-rose-200 shadow-sm max-w-lg mx-auto text-center space-y-4 my-8">
        <span className="material-symbols-outlined text-4xl text-rose-500">error</span>
        <h2 className="text-lg font-bold text-slate-900 font-['Hanken_Grotesk']">Cannot Edit Project</h2>
        <p className="text-xs text-slate-600">{errorMessage}</p>
        <button
          onClick={() => navigate(returnUrl)}
          className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-5xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold animate-fade-in">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link to={getProjectDetailBackUrl(navContext.from)} className="hover:text-indigo-600 transition-colors">
          Projects
        </Link>
        <span>/</span>
        {navContext.entry === 'detail' ? (
          <>
            <Link to={buildProjectDetailUrl(id!, { from: navContext.from })} className="hover:text-indigo-600 transition-colors truncate max-w-xs">
              {project?.title || project?.name || id}
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-bold">Edit</span>
          </>
        ) : (
          <span className="text-slate-800 font-bold">Edit Project</span>
        )}
      </div>

      {/* Header with Title & Action Controls */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 font-['Hanken_Grotesk'] tracking-tight flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(returnUrl)}
              className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer mr-0.5"
              title="Back"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
            <span className="material-symbols-outlined text-indigo-600 text-[26px]">edit_note</span>
            Edit Project
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Update project core details, customer alignment, and financial targets.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => navigate(returnUrl)}
            className="flex-1 md:flex-none px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || Boolean(project?.stageIsTerminal)}
            className="flex-1 md:flex-none px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                Saving...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">save</span>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Terminal Lock Warning Banner */}
      {project?.stageIsTerminal && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
          <span className="material-symbols-outlined text-rose-600 text-xl shrink-0 mt-0.5">lock</span>
          <div className="text-xs text-rose-900">
            <span className="font-bold">Project Locked (Terminal Stage): </span>
            This project is currently in the terminal stage <strong>'{project.stageName || project.stage}'</strong>. General updates are locked. To make changes to this project, transition or reopen it to an active stage first using the <strong>Change Stage</strong> action.
          </div>
        </div>
      )}

      {/* Stage Governance Notice Banner */}
      <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-start gap-3">
        <span className="material-symbols-outlined text-indigo-600 text-xl shrink-0 mt-0.5">policy</span>
        <div className="text-xs text-indigo-900">
          <span className="font-bold">Lifecycle Stage Authority: </span>
          Project lifecycle stages are governed under strict state transition policies and cannot be edited in general project settings. To transition or reopen this project, use the <strong>Change Stage</strong> command on the Project Detail page or Project List.
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Information Card */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600 text-[20px]">info</span>
            <h2 className="text-sm font-extrabold text-slate-900">Project Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Project Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Enterprise Cloud ERP Migration"
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors ${
                  errors.title ? 'border-rose-400' : 'border-slate-200'
                }`}
              />
              {errors.title && <p className="text-[11px] text-rose-500 mt-1">{errors.title}</p>}
            </div>

            {/* Customer */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Customer Account <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors ${
                  errors.customerId ? 'border-rose-400' : 'border-slate-200'
                }`}
              >
                <option value="">Select a customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
              {errors.customerId && <p className="text-[11px] text-rose-500 mt-1">{errors.customerId}</p>}
            </div>

            {/* PIC / Assigned Rep */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Person in Charge (PIC)
              </label>
              <select
                value={selectedPicId}
                onChange={(e) => setSelectedPicId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Description / Scope Summary
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details of client requirements, background, and delivery scope..."
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors resize-y"
              />
            </div>
          </div>
        </div>

        {/* Financials & Target Dates Card */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-[20px]">payments</span>
            <h2 className="text-sm font-extrabold text-slate-900">Financials & Milestones</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Value */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Estimated Value (IDR) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors ${
                  errors.value ? 'border-rose-400' : 'border-slate-200'
                }`}
              />
              {errors.value && <p className="text-[11px] text-rose-500 mt-1">{errors.value}</p>}
            </div>

            {/* Probability */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Win Probability (%) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
                placeholder="50"
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors ${
                  errors.probability ? 'border-rose-400' : 'border-slate-200'
                }`}
              />
              {errors.probability && <p className="text-[11px] text-rose-500 mt-1">{errors.probability}</p>}
            </div>

            {/* Expected Close Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Expected Close Date
              </label>
              <input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(returnUrl)}
            className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

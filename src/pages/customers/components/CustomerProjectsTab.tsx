
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Customer, Project, ProjectStage} from '../../../types';
import { crmApi } from '../../../services/crmApi';
import { useAuth } from '../../../context/AuthContext';
import { getAuthHeaders, API_BASE } from '../../../services/crmApi';

export const CustomerProjectsTab: React.FC<{ customerId: string, tenantUsers: any[], customer: Customer }> = ({ customerId, tenantUsers, customer }) => {
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useAuth();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  const [oppSearch, setOppSearch] = useState('');
  const [oppStageFilter, setOppStageFilter] = useState<string>('ALL');

  // Summary Metrics
  const [totalOppsCount, setTotalOppsCount] = useState(0);
  const [openOppsCount, setOpenOppsCount] = useState(0);
  const [wonOppsCount, setWonOppsCount] = useState(0);
  const [lostOppsCount, setLostOppsCount] = useState(0);
  const [totalPipelineValue, setTotalPipelineValue] = useState(0);
  const [totalExpectedRevenue, setTotalExpectedRevenue] = useState(0);
  
  // Modals
  const [showOppModal, setShowOppModal] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Project | null>(null);
  const [changingStageOpp, setChangingStageOpp] = useState<Project | null>(null);
  
  // Form State
  const [oppNameInput, setOppNameInput] = useState('');
  const [oppValueInput, setOppValueInput] = useState<number>(0);
  const [oppStageInput, setOppStageInput] = useState<ProjectStage>('QUALIFICATION');
  const [availableStages, setAvailableStages] = useState<any[]>([]);
  const [oppProbInput, setOppProbInput] = useState<number>(20);
  const [oppCloseDateInput, setOppCloseDateInput] = useState<string>('');
  
  const [newStageInput, setNewStageInput] = useState<ProjectStage>('PROPOSAL');
  const [newStageProbInput, setNewStageProbInput] = useState<number>(50);
  const [stageChangeNotesInput, setStageChangeNotesInput] = useState<string>('');

  const getStageMeta = (stage: ProjectStage) => {
    switch (stage) {
      case 'LEAD': return { label: 'Lead', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'lightbulb', defaultProb: 10 };
      case 'QUALIFICATION': return { label: 'Qualification', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'psychology', defaultProb: 25 };
      case 'PROPOSAL': return { label: 'Proposal', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'description', defaultProb: 50 };
      case 'NEGOTIATION': return { label: 'Negotiation', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: 'handshake', defaultProb: 75 };
      case 'WON': return { label: 'Closed Won', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: 'emoji_events', defaultProb: 100 };
      case 'LOST': return { label: 'Closed Lost', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: 'cancel', defaultProb: 0 };
      default: return { label: stage, color: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'help', defaultProb: 0 };
    }
  };

  const fetchProjects = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await crmApi.fetchProjects({
        customerId,
        page,
        pageSize,
        search: oppSearch,
        stageId: oppStageFilter !== 'ALL' ? oppStageFilter : undefined
      });
      setProjects(res.data || []);
      setTotalItems(res.pagination?.totalItems || 0);
      setTotalPages(res.pagination?.totalPages || 1);
      
      const sumRes = await fetch(`${API_BASE}/customers/${customerId}/summary`, { headers: getAuthHeaders() });
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        if (sumData.projectsSummary) {
          setTotalOppsCount(sumData.projectsSummary.total || 0);
          setOpenOppsCount(sumData.projectsSummary.active || 0);
          setWonOppsCount(sumData.projectsSummary.won || 0);
          setLostOppsCount(sumData.projectsSummary.lost || 0);
          setTotalPipelineValue(sumData.projectsSummary.pipelineValue || 0);
          setTotalExpectedRevenue(sumData.projectsSummary.pipelineValue || 0); // Simplified
        }
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [customerId, page, oppSearch, oppStageFilter]);

  const openCreateOppModal = () => {
    setOppNameInput('');
    setOppValueInput(0);
    setOppStageInput('QUALIFICATION');
    setOppProbInput(25);
    setOppCloseDateInput('');
    setShowOppModal(true);
  };

  const handleSaveOpp = async () => {
    if (!oppNameInput.trim()) return alert('Name required');
    try {
      await crmApi.createRecord('projects', {
        title: oppNameInput,
        customerId,
        value: oppValueInput,
        stageId: oppStageInput,
        probability: oppProbInput,
        expectedCloseDate: oppCloseDateInput || null
      });
      setShowOppModal(false);
      fetchProjects();
    } catch (err) {
      alert('Failed to create project');
    }
  };

  const handleUpdateOpp = async () => {
    if (!editingOpp) return;
    try {
      await crmApi.updateRecord('projects', editingOpp.id, {
        title: oppNameInput,
        value: oppValueInput,
        expectedCloseDate: oppCloseDateInput || null
      });
      setEditingOpp(null);
      fetchProjects();
    } catch (err) {
      alert('Failed to update project');
    }
  };

  const handleStageChange = async () => {
    if (!changingStageOpp) return;
    try {
      await crmApi.transitionProjectStage(changingStageOpp.id, newStageInput, {
        notes: stageChangeNotesInput || undefined,
        
        lossReason: newStageInput === 'LOST' ? stageChangeNotesInput : undefined
      });
      setChangingStageOpp(null);
      fetchProjects();
    } catch (err) {
      alert('Failed to change stage');
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-white rounded-xl border border-[#E1E1E1] shadow-xs space-y-1">
          <span className="text-[10px] font-bold tracking-wider text-[#767587] uppercase block">Total Projects</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-[#1a1c1c]">{totalOppsCount}</span>
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-[#E1E1E1] shadow-xs space-y-1">
          <span className="text-[10px] font-bold tracking-wider text-[#767587] uppercase block">Open Projects</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-blue-600">{openOppsCount}</span>
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-[#E1E1E1] shadow-xs space-y-1">
          <span className="text-[10px] font-bold tracking-wider text-[#767587] uppercase block">Closed Won</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-emerald-600">{wonOppsCount}</span>
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-[#E1E1E1] shadow-xs space-y-1">
          <span className="text-[10px] font-bold tracking-wider text-[#767587] uppercase block">Closed Lost</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-rose-600">{lostOppsCount}</span>
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-[#E1E1E1] shadow-xs space-y-1 col-span-2 md:col-span-1 lg:col-span-1">
          <span className="text-[10px] font-bold tracking-wider text-[#767587] uppercase block">Pipeline Value</span>
          <div className="text-sm font-extrabold text-[#1a1c1c] truncate">
            Rp {totalPipelineValue >= 1000000000 ? `${(totalPipelineValue / 1000000000).toFixed(2)}B` : `${(totalPipelineValue / 1000000).toFixed(0)}M`}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-xs space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1E1E1] pb-3">
          <div>
            <h3 className="text-base font-bold text-[#1a1c1c]">Projects List</h3>
            <p className="text-[11px] text-[#767587]">Active sales pipeline for {customer.name}</p>
          </div>
          <button onClick={openCreateOppModal} className="px-3.5 py-2 bg-[#4744e5] hover:bg-[#3b38d4] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            Create Project
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search projects..."
            value={oppSearch}
            onChange={(e) => { setOppSearch(e.target.value); setPage(1); }}
            className="flex-1 px-3 py-2 border rounded-lg text-xs"
          />
          <select
            value={oppStageFilter}
            onChange={(e) => { setOppStageFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg text-xs"
          >
            <option value="ALL">All Stages</option>
            {availableStages.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-10 text-[#767587]">Loading...</div>
        ) : error ? (
          <div className="text-center py-10 text-red-500">Error loading projects.</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-10 text-[#767587]">No projects found.</div>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => {
              const meta = getStageMeta(p.stage as ProjectStage || 'LEAD');
              return (
                <div key={p.id} className="p-4 border rounded-lg hover:border-slate-300 transition-colors bg-white group flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-[#1a1c1c] text-sm">{p.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${meta.color}`}>{meta.label}</span>
                    </div>
                    <div className="text-xs text-[#767587] flex items-center gap-4">
                      <span>Val: Rp {(Number(p.estimatedValue || 0) / 1000000).toFixed(0)}M</span>
                      <span>Prob: {p.probability}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingOpp(p);
                        setOppNameInput(p.title);
                        setOppValueInput(Number(p.estimatedValue || 0));
                        setOppCloseDateInput(p.expectedCloseDate || '');
                      }}
                      className="p-1.5 text-[#767587] hover:text-[#1a1c1c] hover:bg-slate-100 rounded"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setChangingStageOpp(p);
                        setNewStageInput(p.stage as ProjectStage || 'PROPOSAL');
                        setNewStageProbInput(p.probability || 50);
                        setStageChangeNotesInput('');
                      }}
                      className="px-3 py-1.5 border rounded-lg text-xs font-bold hover:bg-slate-50"
                    >
                      Update Stage
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center text-xs mt-4">
            <span className="text-[#767587]">Total: {totalItems}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border rounded-lg bg-white disabled:opacity-50">Previous</button>
              <span className="px-3 py-1.5 font-bold">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border rounded-lg bg-white disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showOppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold">Create Project</h3>
              <button onClick={() => setShowOppModal(false)} className="text-gray-500 hover:text-black">&times;</button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold mb-1">Project Name *</label>
                <input type="text" value={oppNameInput} onChange={e => setOppNameInput(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Value (Rp)</label>
                <input type="number" value={oppValueInput} onChange={e => setOppValueInput(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Expected Close</label>
                <input type="date" value={oppCloseDateInput} onChange={e => setOppCloseDateInput(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setShowOppModal(false)} className="px-4 py-2 border rounded-lg text-sm font-bold">Cancel</button>
              <button onClick={handleSaveOpp} className="px-4 py-2 bg-[#4744e5] text-white rounded-lg text-sm font-bold">Save</button>
            </div>
          </div>
        </div>
      )}

      {editingOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold">Edit Project Details</h3>
              <button onClick={() => setEditingOpp(null)} className="text-gray-500 hover:text-black">&times;</button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold mb-1">Project Name *</label>
                <input type="text" value={oppNameInput} onChange={e => setOppNameInput(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Value (Rp)</label>
                <input type="number" value={oppValueInput} onChange={e => setOppValueInput(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Expected Close</label>
                <input type="date" value={oppCloseDateInput} onChange={e => setOppCloseDateInput(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setEditingOpp(null)} className="px-4 py-2 border rounded-lg text-sm font-bold">Cancel</button>
              <button onClick={handleUpdateOpp} className="px-4 py-2 bg-[#4744e5] text-white rounded-lg text-sm font-bold">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {changingStageOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold">Update Stage: {changingStageOpp.title}</h3>
              <button onClick={() => setChangingStageOpp(null)} className="text-gray-500 hover:text-black">&times;</button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold mb-1">New Stage</label>
                <select value={newStageInput} onChange={e => {
                  setNewStageInput(e.target.value as ProjectStage);
                  setNewStageProbInput(getStageMeta(e.target.value as ProjectStage).defaultProb);
                }} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="LEAD">Lead</option>
                  <option value="QUALIFICATION">Qualification</option>
                  <option value="PROPOSAL">Proposal</option>
                  <option value="NEGOTIATION">Negotiation</option>
                  <option value="WON">Closed Won</option>
                  <option value="LOST">Closed Lost</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Probability (%)</label>
                <input type="number" value={newStageProbInput} onChange={e => setNewStageProbInput(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Notes / Reason</label>
                <textarea value={stageChangeNotesInput} onChange={e => setStageChangeNotesInput(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" rows={3}></textarea>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setChangingStageOpp(null)} className="px-4 py-2 border rounded-lg text-sm font-bold">Cancel</button>
              <button onClick={handleStageChange} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold">Confirm Transition</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

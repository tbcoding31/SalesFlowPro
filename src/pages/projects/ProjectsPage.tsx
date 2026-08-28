import React, { useState, useMemo, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { masterDataApi } from '../../services/masterDataApi';
import { Project, ProjectStage, ActivityType, Customer, FollowUpType, MasterDataItem } from '../../types';
import { crmApi } from '../../services/crmApi';

type ViewMode = 'PIPELINE' | 'LIST';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentTenant, currentUser } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';

  const [projects, setProjects] = useState<Project[]>([]);
  const [pipelineAggregates, setPipelineAggregates] = useState<any>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [draggedOppId, setDraggedOppId] = useState<string | null>(null);

  
  const loadData = async (page = currentPage) => {
    setIsLoading(true);
    try {
      if (viewMode === 'LIST') {
        const [pRes, cList] = await Promise.all([
          crmApi.fetchProjects({ page, pageSize, search: searchQuery || undefined, tenantId }),
          crmApi.fetchCollection('customers', tenantId)
        ]);
        if ((pRes as any).data) {
          setProjects((pRes as any).data);
          setTotalItems((pRes as any).pagination.totalItems);
          setTotalPages((pRes as any).pagination.totalPages);
          setCurrentPage((pRes as any).pagination.page);
        }
        setCustomers(cList as any);
      } else {
        const [pListRes, cList] = await Promise.all([
          crmApi.fetchProjectPipeline(tenantId),
          crmApi.fetchCollection('customers', tenantId)
        ]);
        setProjects(pListRes.data as any);
        setPipelineAggregates(pListRes.aggregates);
        setCustomers(cList as any);
      }
    } catch (err) {
      console.error('Failed to load projects', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData(1);
  }, [tenantId, viewMode, pageSize, searchQuery]);


  React.useEffect(() => {
    loadData();
  }, [tenantId]);

  // Follow Up Modal State
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [pendingFollowUpOpp, setPendingFollowUpOpp] = useState<Project | null>(null);
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpType, setFollowUpType] = useState<FollowUpType>('CALL');
  const [followUpDate, setFollowUpDate] = useState(new Date().toISOString().split('T')[0]);
  const [followUpNotes, setFollowUpNotes] = useState('');

  const [projectStages, setProjectStages] = useState<MasterDataItem[]>([]);
  React.useEffect(() => {
    masterDataApi.fetchMasterData('project_stages', tenantId).then(setProjectStages);
  }, [tenantId]);

  // Filters for List View
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  
  // List View Pagination & Selection
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const stages: { key: ProjectStage; label: string; color: string }[] = [
    { key: 'LEAD', label: 'Leads', color: 'border-slate-300' },
    { key: 'QUALIFICATION', label: 'Discuss/Follow up', color: 'border-blue-300' },
    { key: 'PROPOSAL', label: 'Proposal Sent', color: 'border-indigo-300' },
    { key: 'NEGOTIATION', label: 'Negotiation', color: 'border-amber-300' },
    { key: 'WON', label: 'Won / Deal', color: 'border-emerald-300' },
    { key: 'LOST', label: 'Lost', color: 'border-rose-300' },
  ];

  // Summaries
  const totalPipeline = useMemo(() => projects.reduce((acc, curr) => acc + (curr.estimatedValue || 0), 0), [projects]);
  const weightedPipeline = useMemo(() => projects.reduce((acc, curr) => acc + ((curr.estimatedValue || 0) * ((curr.probability || 0) / 100)), 0), [projects]);
  const totalWon = useMemo(() => projects.filter(o => o.stage === 'WON').reduce((acc, curr) => acc + (curr.estimatedValue || 0), 0), [projects]);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatSummary = (val: number) => {
    if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(1)}B`;
    if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)}M`;
    return formatMoney(val);
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, oppId: string) => {
    setDraggedOppId(oppId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', oppId);
    setTimeout(() => {
      const el = document.getElementById(`opp-card-${oppId}`);
      if (el) el.classList.add('opacity-50');
    }, 0);
  };

  const handleDragEnd = (e: DragEvent<HTMLDivElement>, oppId: string) => {
    setDraggedOppId(null);
    const el = document.getElementById(`opp-card-${oppId}`);
    if (el) el.classList.remove('opacity-50');
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetStage: ProjectStage) => {
    e.preventDefault();
    const oppId = e.dataTransfer.getData('text/plain');
    if (!oppId) return;

    const opp = projects.find(o => o.id === oppId);
    if (!opp || opp.stage === targetStage) return;

    if (targetStage === 'QUALIFICATION') {
      setPendingFollowUpOpp(opp);
      setFollowUpTitle(`Follow up: ${opp.name}`);
      setFollowUpType('CALL');
      setFollowUpDate(new Date().toISOString().split('T')[0]);
      setFollowUpNotes('');
      setShowFollowUpModal(true);
      return;
    }

    executeMove(opp, targetStage);
  };

  const executeMove = async (opp: Project, targetStage: ProjectStage) => {
    let reasonInput: string | undefined = undefined;
    const isReopen = (opp.stage === 'WON' || opp.stage === 'LOST') && (targetStage !== 'WON' && targetStage !== 'LOST');
    
    if (targetStage === 'LOST') {
      const promptRes = prompt('Please enter a business reason for marking this project as LOST:');
      if (!promptRes || !promptRes.trim()) {
        alert('A business loss reason is required to mark the project as LOST.');
        return;
      }
      reasonInput = promptRes.trim();
    } else if (isReopen) {
      const promptRes = prompt('Please enter a business reason for reopening this project:');
      if (!promptRes || !promptRes.trim()) {
        alert('An explicit business reason is required to reopen this project.');
        return;
      }
      reasonInput = promptRes.trim();
    }

    const res = await crmApi.transitionProjectStage(opp.id, targetStage, {
      lossReason: targetStage === 'LOST' ? reasonInput : undefined,
      reopenReason: isReopen ? reasonInput : undefined,
      isReopen,
      expectedFromStage: opp.stage
    });

    if (res.success) {
      loadData();
    } else {
      alert(`Stage transition blocked: ${res.error}`);
    }
  };

  const handleCreateFollowUp = async () => {
    if (!pendingFollowUpOpp) return;
    
    // Create FollowUp entity
    await crmApi.createRecord('follow_ups', {
      id: `FU-${Date.now()}`,
      tenantId,
      title: followUpTitle,
      customerId: pendingFollowUpOpp.customerId || '',
      customerName: pendingFollowUpOpp.customerName || '',
      customerCode: '',
      picId: currentUser?.id || 'SYS-001',
      picName: currentUser?.name || 'System',
      type: followUpType,
      status: 'SCHEDULED',
      priority: 'MEDIUM',
      followUpDate: followUpDate,
      relatedProjectId: pendingFollowUpOpp.id,
      notes: followUpNotes,
      createdAt: new Date().toISOString().split('T')[0],
    });

    executeMove(pendingFollowUpOpp, 'QUALIFICATION');
    setShowFollowUpModal(false);
    setPendingFollowUpOpp(null);
  };

  // List View Filtering
  const filteredList = useMemo(() => {
    return projects.filter(opp => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!opp.name.toLowerCase().includes(term) && !opp.customerName.toLowerCase().includes(term)) {
          return false;
        }
      }
      if (stageFilter !== 'ALL' && opp.stage !== stageFilter) return false;
      if (customerFilter !== 'ALL' && opp.customerId !== customerFilter) return false;
      return true;
    });
  }, [projects, searchTerm, stageFilter, customerFilter]);

  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const paginatedList = filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedList.map(o => o.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const getStageBadge = (stage: ProjectStage) => {
    switch (stage) {
      case 'LEAD': return <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded uppercase tracking-wider border border-slate-200">Leads</span>;
      case 'QUALIFICATION': return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wider border border-blue-200">Discuss/Follow up</span>;
      case 'PROPOSAL': return <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wider border border-indigo-200">Proposal Sent</span>;
      case 'NEGOTIATION': return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase tracking-wider border border-amber-200">Negotiation</span>;
      case 'WON': return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wider border border-emerald-200">Won / Deal</span>;
      case 'LOST': return <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded uppercase tracking-wider border border-rose-200">Lost</span>;
      default: return null;
    }
  };

  return (
    <div className={`space-y-6 font-['Inter',sans-serif] flex flex-col ${viewMode === 'PIPELINE' ? 'h-[calc(100vh-80px)] min-h-[600px]' : ''}`}>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
            Projects
          </h1>
          <p className="text-xs text-[#767587] mt-0.5">
            Manage your projects and track revenue across the sales process.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
            <button 
              onClick={() => setViewMode('LIST')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${viewMode === 'LIST' ? 'bg-white text-[#1a1c1c] shadow-sm' : 'text-slate-500 hover:text-[#1a1c1c]'}`}
            >
              <span className="material-symbols-outlined text-[16px]">list</span>
              List
            </button>
            <button 
              onClick={() => setViewMode('PIPELINE')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${viewMode === 'PIPELINE' ? 'bg-white text-[#1a1c1c] shadow-sm' : 'text-slate-500 hover:text-[#1a1c1c]'}`}
            >
              <span className="material-symbols-outlined text-[16px]">view_kanban</span>
              Pipeline
            </button>
          </div>
          <button 
            onClick={() => navigate('/projects/new')}
            className="px-4 py-2 bg-[#4744e5] hover:bg-[#322fce] text-white text-xs font-extrabold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Project
          </button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <div className="bg-white p-5 rounded-2xl border border-[#E1E1E1] shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider mb-1">Total Pipeline</div>
            <div className="text-2xl font-extrabold text-[#1a1c1c]">{formatSummary(totalPipeline)}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined">monitoring</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#E1E1E1] shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider mb-1">Weighted Pipeline</div>
            <div className="text-2xl font-extrabold text-[#1a1c1c]">{formatSummary(weightedPipeline)}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <span className="material-symbols-outlined">donut_large</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#E1E1E1] shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-extrabold text-[#767587] uppercase tracking-wider mb-1">Won</div>
            <div className="text-2xl font-extrabold text-emerald-600">{formatSummary(totalWon)}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined">emoji_events</span>
          </div>
        </div>
      </div>

      {viewMode === 'PIPELINE' ? (
        /* Kanban Board */
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-4 h-full snap-x">
            {stages.map((stage) => {
              const stageOpps = projects.filter(o => o.stage === stage.key);
              const stageValue = stageOpps.reduce((acc, curr) => acc + curr.estimatedValue, 0);

              return (
                <div 
                  key={stage.key}
                  className="flex-shrink-0 w-[300px] flex flex-col bg-slate-50/50 rounded-2xl border border-[#E1E1E1] overflow-hidden snap-center"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage.key)}
                >
                  <div className={`p-4 bg-white border-b-2 ${stage.color}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-extrabold text-[#1a1c1c] uppercase tracking-wider">
                        {stage.label}
                      </h3>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                        {stageOpps.length}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-500">
                      {formatSummary(0)}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {stageOpps.length < stageOpps.length && (
                      <div className="text-[10px] font-bold text-center text-slate-400 uppercase tracking-wider mb-2">
                        Showing {stageOpps.length} of {stageOpps.length} (Load More)
                      </div>
                    )}
                    {stageOpps.map(opp => (
                      <div
                        key={opp.id}
                        id={`opp-card-${opp.id}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, opp.id)}
                        onDragEnd={(e) => handleDragEnd(e, opp.id)}
                        className="bg-white p-4 rounded-xl border border-[#E1E1E1] shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-grab active:cursor-grabbing group"
                      >
                        <div className="flex flex-col gap-3">
                          <div>
                            <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1 truncate">
                              {opp.customerName}
                            </div>
                            <h4 
                              onClick={() => navigate(`/projects/${opp.id}`)}
                              className="text-sm font-bold text-[#1a1c1c] leading-tight hover:text-indigo-600 transition-colors cursor-pointer"
                            >
                              {opp.name}
                            </h4>
                          </div>
                          
                          <div className="text-sm font-extrabold text-[#008f53]">
                            {formatMoney(opp.estimatedValue)}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                              {opp.picAvatar ? (
                                <img src={opp.picAvatar} alt={opp.picName || 'User'} className="w-5 h-5 rounded-full object-cover border border-slate-200" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold border border-slate-300">
                                  {(opp.picName || '?').charAt(0)}
                                </div>
                              )}
                              <span className="text-[11px] font-medium text-slate-600 truncate max-w-[80px]">
                                {opp.picName || 'Unknown User'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-500">
                              <span className="material-symbols-outlined text-[12px]">event</span>
                              <span className="text-[10px] font-semibold">
                                {new Date(opp.expectedCloseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {stageOpps.length === 0 && (
                      <div className="h-24 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-xs font-medium">
                        Drop here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xs overflow-hidden flex flex-col">
          {/* List Toolbar */}
          <div className="p-4 border-b border-[#E1E1E1] flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-slate-50/50">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:flex-none sm:min-w-[240px]">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                <input 
                  type="text" 
                  placeholder="Search projects..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
                />
              </div>
              
              <div className="hidden md:flex items-center gap-3">
                <div className="h-6 w-px bg-slate-200 mx-1"></div>
                <select 
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-indigo-500 min-w-[130px]"
                >
                  <option value="ALL">All Stages</option>
                  {projectStages.map(s => (
                    <option key={s.id} value={s.code_value}>{s.label}</option>
                  ))}
                </select>
                <select 
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-indigo-500 min-w-[150px]"
                >
                  <option value="ALL">All Customers</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                
                {/* Visual mock of other filters to satisfy UI completeness without cluttering state */}
                <select className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-indigo-500 min-w-[120px]">
                  <option>Any PIC</option>
                </select>
                <select className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-indigo-500 min-w-[130px]">
                  <option>Any Close Date</option>
                </select>
                <button className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">filter_list</span>
                  More Filters
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-bold rounded-xl transition-colors flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">download</span>
                <span className="hidden sm:inline">Export</span>
              </button>
              <div className="h-6 w-px bg-slate-200 mx-1"></div>
              <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Columns">
                <span className="material-symbols-outlined text-[20px]">view_column</span>
              </button>
            </div>
          </div>

          {/* Bulk Selection Actions Strip (Appears when items selected) */}
          {selectedIds.size > 0 && (
            <div className="bg-indigo-50 px-5 py-2.5 border-b border-indigo-100 flex items-center justify-between">
              <div className="text-sm font-bold text-indigo-700">
                {selectedIds.size} projects selected
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-100 text-xs font-bold rounded-lg transition-colors">
                  Update Stage
                </button>
                <button className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-100 text-xs font-bold rounded-lg transition-colors">
                  Reassign PIC
                </button>
                <button className="px-3 py-1.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-lg transition-colors">
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E1E1E1]">
                  <th className="px-5 py-3 w-10">
                    <input 
                      type="checkbox" 
                      checked={paginatedList.length > 0 && selectedIds.size === paginatedList.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-5 py-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">Project & Customer</th>
                  <th className="px-5 py-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">Value & Probability</th>
                  <th className="px-5 py-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">Stage</th>
                  <th className="px-5 py-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">PIC</th>
                  <th className="px-5 py-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">Expected Close / Updated</th>
                  <th className="px-5 py-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E1E1]">
                {paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500 text-sm">
                      <div className="flex flex-col items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-3">inbox</span>
                        <p>No projects found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((opp) => (
                    <tr key={opp.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(opp.id) ? 'bg-indigo-50/40' : ''}`}>
                      <td className="px-5 py-4">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(opp.id)}
                          onChange={() => toggleSelect(opp.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div 
                          onClick={() => navigate(`/projects/${opp.id}`)}
                          className="font-bold text-[#1a1c1c] text-sm leading-tight group-hover:text-indigo-600 transition-colors cursor-pointer hover:underline"
                        >
                          {opp.name}
                        </div>
                        <div className="text-xs text-indigo-600 font-semibold mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">domain</span>
                          {opp.customerName}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-extrabold text-[#008f53]">
                          {formatMoney(opp.estimatedValue)}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[60px]">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${opp.probability}%` }}></div>
                          </div>
                          <div className="text-[10px] text-slate-500 font-bold">
                            {opp.probability}%
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {getStageBadge(opp.stage)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {opp.picAvatar ? (
                            <img src={opp.picAvatar} alt={opp.picName || 'User'} className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold border border-slate-300">
                              {(opp.picName || '?').charAt(0)}
                            </div>
                          )}
                          <span className="text-xs font-semibold text-slate-700">{opp.picName || 'Unknown User'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-[#1a1c1c]">
                          <span className="material-symbols-outlined text-[14px] text-slate-400">event</span>
                          {new Date(opp.expectedCloseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium mt-1">
                          Updated {new Date(opp.updatedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer" title="Edit">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer" title="More">
                            <span className="material-symbols-outlined text-[18px]">more_vert</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 0 && (
            <div className="p-4 border-t border-[#E1E1E1] flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50">
              <div className="text-xs text-slate-500 font-medium">
                Showing <span className="font-bold text-[#1a1c1c]">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-[#1a1c1c]">{Math.min(currentPage * itemsPerPage, filteredList.length)}</span> of <span className="font-bold text-[#1a1c1c]">{filteredList.length}</span> projects
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setCurrentPage(idx + 1)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${currentPage === idx + 1 ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Follow Up Modal */}
      {showFollowUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl border border-[#E1E1E1]">
            <div className="px-6 py-4 border-b border-[#E1E1E1] flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Create Follow Up</h2>
              <button onClick={() => setShowFollowUpModal(false)} className="text-[#767587] hover:text-rose-600 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#464555] mb-1.5">Follow Up Title</label>
                <input
                  type="text"
                  value={followUpTitle}
                  onChange={(e) => setFollowUpTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-[#E1E1E1] rounded-xl text-sm focus:outline-none focus:border-[#4744e5]"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-[#464555] mb-1.5">Type</label>
                <select
                  value={followUpType}
                  onChange={(e) => setFollowUpType(e.target.value as FollowUpType)}
                  className="w-full px-4 py-2 border border-[#E1E1E1] rounded-xl text-sm bg-white focus:outline-none focus:border-[#4744e5]"
                >
                  <option value="CALL">Call</option>
                  <option value="EMAIL">Email</option>
                  <option value="MEETING">Meeting</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#464555] mb-1.5">Scheduled Date</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full px-4 py-2 border border-[#E1E1E1] rounded-xl text-sm focus:outline-none focus:border-[#4744e5]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#464555] mb-1.5">Notes (Optional)</label>
                <textarea
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-[#E1E1E1] rounded-xl text-sm focus:outline-none focus:border-[#4744e5]"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E1E1E1] bg-slate-50/50 flex justify-end gap-3">
              <button 
                onClick={() => setShowFollowUpModal(false)}
                className="px-4 py-2 text-sm font-bold text-[#767587] hover:text-[#1a1c1c] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateFollowUp}
                className="px-4 py-2 bg-[#4744e5] text-white text-sm font-bold rounded-xl hover:bg-[#3b38c6] transition-colors"
              >
                Create Follow Up
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

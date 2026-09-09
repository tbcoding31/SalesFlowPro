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
  const tenantId = currentTenant?.id ;

  const [projects, setProjects] = useState<Project[]>([]);
  const [pipelineAggregates, setPipelineAggregates] = useState<any>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [draggedOppId, setDraggedOppId] = useState<string | null>(null);

  
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async (page = currentPage) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      if (viewMode === 'LIST') {
        const [pRes, cList] = await Promise.all([
          crmApi.fetchProjects({ page, pageSize, search: searchQuery || undefined, tenantId }),
          crmApi.fetchCollection('customers', tenantId)
        ]);
        const list = Array.isArray(pRes) ? pRes : (pRes?.data || []);
        const pagination = (pRes as any)?.pagination || { totalItems: list.length, totalPages: 1, page: 1 };
        setProjects(list);
        setTotalItems(pagination.totalItems);
        setCurrentPage(pagination.page);
        setCustomers(cList as any);
      } else {
        const [pListRes, cList] = await Promise.all([
          crmApi.fetchProjectPipeline(tenantId),
          crmApi.fetchCollection('customers', tenantId)
        ]);
        setProjects(pListRes.data as any);
        setPipelineAggregates(pListRes.aggregates || {});
        setPipelineSummary(pListRes.summary || null);
        if (pListRes.stages && pListRes.stages.length > 0) {
          setPipelineStages(pListRes.stages);
        }
        setCustomers(cList as any);
      }
    } catch (err: any) {
      console.error('Failed to load projects', err);
      setLoadError(err.message || 'Unable to load project pipeline');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData(1);
  }, [tenantId, viewMode, pageSize, searchQuery]);

  // Follow Up Modal State
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [pendingFollowUpOpp, setPendingFollowUpOpp] = useState<Project | null>(null);
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpType, setFollowUpType] = useState<FollowUpType>('CALL');
  const [followUpDate, setFollowUpDate] = useState(new Date().toISOString().split('T')[0]);
  const [followUpNotes, setFollowUpNotes] = useState('');

  // Action Menu and Change Stage Modal State
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [stageModalOpp, setStageModalOpp] = useState<Project | null>(null);
  const [selectedTargetStageId, setSelectedTargetStageId] = useState<string>('');
  const [transitionLossReason, setTransitionLossReason] = useState<string>('');
  const [transitionReopenReason, setTransitionReopenReason] = useState<string>('');
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-action-menu]')) {
        setActiveActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [pipelineSummary, setPipelineSummary] = useState<any>(null);
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [projectStages, setProjectStages] = useState<MasterDataItem[]>([]);
  React.useEffect(() => {
    masterDataApi.fetchMasterData('project_stages', tenantId).then(data => {
      setProjectStages(data);
      if (pipelineStages.length === 0 && data.length > 0) {
        setPipelineStages(data.map(d => ({
          id: d.id,
          code: d.codeValue,
          name: d.label,
          displayOrder: d.displayOrder,
          probability: d.probability,
          lifecycleCategory: d.lifecycleCategory || 'OPEN',
          isActive: d.isActive !== false
        })));
      }
    });
  }, [tenantId]);

  // Filters for List View
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  
  // List View Pagination & Selection
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const getStageColor = (category?: string, idx: number = 0) => {
    if (category === 'WON') return 'border-emerald-400';
    if (category === 'LOST') return 'border-rose-400';
    const borderColors = ['border-slate-300', 'border-blue-300', 'border-indigo-300', 'border-amber-300', 'border-purple-300', 'border-teal-300'];
    return borderColors[idx % borderColors.length];
  };

  const stagesToRender = useMemo(() => {
    if (pipelineStages && pipelineStages.length > 0) {
      return pipelineStages.map((s, idx) => ({
        key: s.id,
        code: s.code,
        label: s.name,
        color: getStageColor(s.lifecycleCategory, idx),
        lifecycleCategory: s.lifecycleCategory,
        isActive: s.isActive !== false,
        probability: s.probability
      }));
    }
    if (projectStages && projectStages.length > 0) {
      return projectStages.map((s, idx) => ({
        key: s.id,
        code: s.codeValue,
        label: s.label,
        color: getStageColor(s.lifecycleCategory, idx),
        lifecycleCategory: s.lifecycleCategory,
        isActive: s.isActive !== false,
        probability: s.probability
      }));
    }
    return [
      { key: 'PS-1', code: 'LEAD', label: 'Leads', color: 'border-slate-300', lifecycleCategory: 'OPEN', isActive: true, probability: 20 },
      { key: 'PS-2', code: 'QUALIFICATION', label: 'Discuss/Follow up', color: 'border-blue-300', lifecycleCategory: 'OPEN', isActive: true, probability: 40 },
      { key: 'PS-3', code: 'PROPOSAL', label: 'Proposal Sent', color: 'border-indigo-300', lifecycleCategory: 'OPEN', isActive: true, probability: 60 },
      { key: 'PS-4', code: 'NEGOTIATION', label: 'Negotiation', color: 'border-amber-300', lifecycleCategory: 'OPEN', isActive: true, probability: 80 },
      { key: 'PS-5', code: 'WON', label: 'Won / Deal', color: 'border-emerald-300', lifecycleCategory: 'WON', isActive: true, probability: 100 },
    ];
  }, [pipelineStages, projectStages]);

  const totalPipeline = useMemo(() => {
    if (pipelineSummary?.totalPipeline !== undefined) return pipelineSummary.totalPipeline;
    return projects
      .filter(o => (o as any).stageLifecycleCategory === 'OPEN' || ['LEAD', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'PS-1', 'PS-2', 'PS-3', 'PS-4'].includes((o.stageCode || o.stage || o.stageId || '').toUpperCase()))
      .reduce((acc, curr) => acc + (Number(curr.value ?? curr.estimatedValue) || 0), 0);
  }, [projects, pipelineSummary]);

  const weightedPipeline = useMemo(() => {
    if (pipelineSummary?.weightedPipeline !== undefined) return pipelineSummary.weightedPipeline;
    return projects
      .filter(o => (o as any).stageLifecycleCategory === 'OPEN' || ['LEAD', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'PS-1', 'PS-2', 'PS-3', 'PS-4'].includes((o.stageCode || o.stage || o.stageId || '').toUpperCase()))
      .reduce((acc, curr) => {
        const val = Number(curr.value ?? curr.estimatedValue) || 0;
        const prob = Number((curr as any).effectiveProbability ?? curr.probability ?? 0);
        return acc + ((val * prob) / 100);
      }, 0);
  }, [projects, pipelineSummary]);

  const totalWon = useMemo(() => {
    if (pipelineSummary?.totalWon !== undefined) return pipelineSummary.totalWon;
    return projects
      .filter(o => (o as any).stageLifecycleCategory === 'WON' || (o.stageCode || o.stage || o.stageId || '').toUpperCase() === 'WON' || o.stageId === 'PS-5')
      .reduce((acc, curr) => acc + (Number(curr.value ?? curr.estimatedValue) || 0), 0);
  }, [projects, pipelineSummary]);

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

  const executeMove = async (opp: Project, targetStage: string) => {
    let reasonInput: string | undefined = undefined;
    const targetObj = stagesToRender.find(s => s.key === targetStage || s.code === targetStage);
    if (targetObj && !targetObj.isActive) {
      alert('Cannot transition to an inactive project stage.');
      return;
    }

    const fromCategory = (opp as any).stageLifecycleCategory || (['WON', 'PS-5'].includes((opp.stageCode || opp.stage || '').toUpperCase()) ? 'WON' : (opp.stageCode || opp.stage || '').toUpperCase() === 'LOST' ? 'LOST' : 'OPEN');
    const toCategory = targetObj?.lifecycleCategory || (targetStage === 'WON' || targetStage === 'PS-5' ? 'WON' : targetStage === 'LOST' ? 'LOST' : 'OPEN');
    const isReopen = (fromCategory === 'WON' || fromCategory === 'LOST') && toCategory === 'OPEN';
    const isLost = toCategory === 'LOST';

    if (isLost) {
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

    const targetStageId = targetObj ? targetObj.key : targetStage;
    const res = await crmApi.transitionProjectStage(opp.id, targetStageId, {
      lossReason: isLost ? reasonInput : undefined,
      reopenReason: isReopen ? reasonInput : undefined,
      isReopen,
      expectedFromStage: opp.stageCode || opp.stage || opp.stageId
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

    executeMove(pendingFollowUpOpp, 'PS-2');
    setShowFollowUpModal(false);
    setPendingFollowUpOpp(null);
  };

  // List View Filtering
  const filteredList = useMemo(() => {
    return projects.filter(opp => {
      const pTitle = (opp.title || opp.name || '').toLowerCase();
      const cName = (opp.customerName || '').toLowerCase();
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!pTitle.includes(term) && !cName.includes(term)) {
          return false;
        }
      }
      const pStageId = opp.stageId;
      const pStageCode = (opp.stageCode || opp.stage || '').toUpperCase();
      if (stageFilter !== 'ALL') {
        if (stageFilter === '_UNASSIGNED') {
          if (pStageId) return false;
        } else {
          const filterUpper = stageFilter.toUpperCase();
          const stageMatch = pStageId === stageFilter || pStageCode === filterUpper;
          if (!stageMatch) return false;
        }
      }
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

  const getStageBadge = (stage: string, opp?: any) => {
    if (!stage && !opp?.stageId) {
      return <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase tracking-wider border border-slate-200">Unassigned</span>;
    }
    const stageName = opp?.stageName;
    const lifecycleCategory = opp?.stageLifecycleCategory;
    if (stageName) {
      if (lifecycleCategory === 'WON') {
        return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wider border border-emerald-200">{stageName}</span>;
      }
      if (lifecycleCategory === 'LOST') {
        return <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded uppercase tracking-wider border border-rose-200">{stageName}</span>;
      }
      return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wider border border-blue-200">{stageName}</span>;
    }
    const s = (stage || '').toUpperCase();
    if (s === 'LEAD' || s === 'PS-1') {
      return <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded uppercase tracking-wider border border-slate-200">Leads</span>;
    }
    if (s === 'QUALIFICATION' || s === 'PS-2') {
      return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wider border border-blue-200">Discuss/Follow up</span>;
    }
    if (s === 'PROPOSAL' || s === 'PS-3') {
      return <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wider border border-indigo-200">Proposal Sent</span>;
    }
    if (s === 'NEGOTIATION' || s === 'PS-4') {
      return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase tracking-wider border border-amber-200">Negotiation</span>;
    }
    if (s === 'WON' || s === 'PS-5') {
      return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wider border border-emerald-200">Won / Deal</span>;
    }
    if (s === 'LOST') {
      return <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded uppercase tracking-wider border border-rose-200">Lost</span>;
    }
    return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase tracking-wider border border-slate-200">{stage || 'Unassigned'}</span>;
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

      {loadError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center justify-between text-sm shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{loadError}</span>
          </div>
          <button 
            onClick={() => loadData(currentPage)} 
            className="px-3 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

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
            {/* Unassigned Projects Column */}
            {(() => {
              const unassignedOpps = projects.filter(o => !o.stageId);
              if (unassignedOpps.length === 0) return null;
              const unassignedValue = unassignedOpps.reduce((acc, curr) => acc + (Number(curr.value ?? curr.estimatedValue) || 0), 0);
              return (
                <div
                  key="_UNASSIGNED"
                  className="flex-shrink-0 w-[300px] flex flex-col bg-amber-50/20 rounded-2xl border border-dashed border-amber-300 overflow-hidden snap-center"
                >
                  <div className="p-4 bg-white border-b-2 border-amber-300">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-amber-500 text-sm">warning</span>
                        Stage Not Assigned
                      </h3>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                        {unassignedOpps.length}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-400">
                      {formatSummary(unassignedValue)}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {unassignedOpps.map(opp => (
                      <div
                        key={opp.id}
                        id={`opp-card-${opp.id}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, opp.id)}
                        onDragEnd={(e) => handleDragEnd(e, opp.id)}
                        className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm hover:shadow-md hover:border-amber-400 transition-all cursor-grab active:cursor-grabbing group"
                      >
                        <div className="flex flex-col gap-3">
                          <div>
                            <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1 truncate">
                              {opp.customerName || 'Customer'}
                            </div>
                            <h4 
                              onClick={() => navigate(`/projects/${opp.id}`)}
                              className="text-sm font-bold text-[#1a1c1c] leading-tight hover:text-indigo-600 transition-colors cursor-pointer"
                            >
                              {opp.title || opp.name || opp.id}
                            </h4>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                            <span className="font-extrabold text-[#008f53]">
                              {formatMoney(Number(opp.value ?? opp.estimatedValue) || 0)}
                            </span>
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Drag to Assign
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {stagesToRender.map((stage) => {
              const stageOpps = projects.filter(o => o.stageId === stage.key || (o.stageCode && o.stageCode === stage.code));
              const stageValue = stageOpps.reduce((acc, curr) => acc + (Number(curr.value ?? curr.estimatedValue) || 0), 0);
              const isInactive = !stage.isActive;

              return (
                <div 
                  key={stage.key}
                  className={`flex-shrink-0 w-[300px] flex flex-col ${isInactive ? 'bg-slate-100/70 opacity-75' : 'bg-slate-50/50'} rounded-2xl border border-[#E1E1E1] overflow-hidden snap-center`}
                  onDragOver={isInactive ? undefined : handleDragOver}
                  onDrop={isInactive ? undefined : ((e) => handleDrop(e, stage.key))}
                >
                  <div className={`p-4 bg-white border-b-2 ${stage.color}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-extrabold text-[#1a1c1c] uppercase tracking-wider flex items-center gap-1.5">
                        {stage.label}
                        {isInactive && (
                          <span className="px-1.5 py-0.2 bg-slate-200 text-slate-600 text-[9px] font-bold rounded">Inactive</span>
                        )}
                      </h3>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                        {stageOpps.length}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-500">
                      {formatSummary(stageValue)}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
                              {opp.customerName || 'Customer'}
                            </div>
                            <h4 
                              onClick={() => navigate(`/projects/${opp.id}`)}
                              className="text-sm font-bold text-[#1a1c1c] leading-tight hover:text-indigo-600 transition-colors cursor-pointer"
                            >
                              {opp.title || opp.name || opp.id}
                            </h4>
                          </div>
                          
                          <div className="text-sm font-extrabold text-[#008f53]">
                            {formatMoney(Number(opp.value ?? opp.estimatedValue) || 0)}
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
                                {opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '-'}
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
                  {stagesToRender.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                  <option value="_UNASSIGNED">Stage Not Assigned</option>
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
                          {opp.title || opp.name || opp.id}
                        </div>
                        <div className="text-xs text-indigo-600 font-semibold mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">domain</span>
                          {opp.customerName || 'Customer'}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-extrabold text-[#008f53]">
                          {formatMoney(Number(opp.value ?? opp.estimatedValue) || 0)}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[60px]">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${opp.probability ?? (opp as any).effectiveProbability ?? 0}%` }}></div>
                          </div>
                          <div className="text-[10px] text-slate-500 font-bold">
                            {opp.probability ?? (opp as any).effectiveProbability ?? 0}%
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {getStageBadge(opp.stageCode || opp.stage || opp.stageId || '')}
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
                          {opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium mt-1">
                          Updated {opp.updatedAt ? new Date(opp.updatedAt).toLocaleDateString() : '-'}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="relative inline-flex items-center justify-end" data-action-menu>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionMenuId(activeActionMenuId === opp.id ? null : opp.id);
                            }}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              activeActionMenuId === opp.id ? 'bg-indigo-50 text-indigo-600 ring-2 ring-indigo-500/20' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                            }`}
                            title="Actions"
                          >
                            <span className="material-symbols-outlined text-[18px]">more_vert</span>
                          </button>

                          {activeActionMenuId === opp.id && (
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 text-left animate-fade-in">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionMenuId(null);
                                  navigate(`/projects/${opp.id}`);
                                }}
                                className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px] text-slate-400">visibility</span>
                                View Details
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionMenuId(null);
                                  navigate(`/projects/${opp.id}/edit`);
                                }}
                                className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px] text-slate-400">edit</span>
                                Edit Project
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionMenuId(null);
                                  setStageModalOpp(opp);
                                  setSelectedTargetStageId(opp.stageId || '');
                                  setTransitionLossReason('');
                                  setTransitionReopenReason('');
                                }}
                                className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px] text-indigo-500">swap_horiz</span>
                                Change Stage
                              </button>
                            </div>
                          )}
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

      {/* Change Stage Modal */}
      {stageModalOpp && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-xl">swap_horiz</span>
                <h3 className="text-base font-extrabold text-slate-900 font-['Hanken_Grotesk']">Change Project Stage</h3>
              </div>
              <button
                onClick={() => setStageModalOpp(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Project</p>
              <p className="text-sm font-bold text-slate-900">{stageModalOpp.name || stageModalOpp.title}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Target Lifecycle Stage</label>
              <select
                value={selectedTargetStageId}
                onChange={(e) => setSelectedTargetStageId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
              >
                <option value="">Select target stage...</option>
                {stagesToRender.filter(s => s.isActive !== false).map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label} ({s.lifecycleCategory})
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const targetObj = stagesToRender.find(s => s.key === selectedTargetStageId || s.code === selectedTargetStageId);
              const fromCat = (stageModalOpp as any).stageLifecycleCategory || (['WON', 'PS-5'].includes((stageModalOpp.stageCode || stageModalOpp.stage || '').toUpperCase()) ? 'WON' : (stageModalOpp.stageCode || stageModalOpp.stage || '').toUpperCase() === 'LOST' ? 'LOST' : 'OPEN');
              const toCat = targetObj?.lifecycleCategory || (selectedTargetStageId === 'WON' || selectedTargetStageId === 'PS-5' ? 'WON' : selectedTargetStageId === 'LOST' ? 'LOST' : 'OPEN');
              const isReopen = (fromCat === 'WON' || fromCat === 'LOST') && toCat === 'OPEN';
              const isLost = toCat === 'LOST';

              return (
                <>
                  {isLost && (
                    <div>
                      <label className="block text-xs font-bold text-rose-700 mb-1.5">
                        Business Loss Reason <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={transitionLossReason}
                        onChange={(e) => setTransitionLossReason(e.target.value)}
                        placeholder="Reason why this project is lost (e.g. competitor pricing, budget cancelled)..."
                        className="w-full p-2.5 bg-rose-50/50 border border-rose-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>
                  )}
                  {isReopen && (
                    <div>
                      <label className="block text-xs font-bold text-indigo-700 mb-1.5">
                        Reopen Reason <span className="text-indigo-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={transitionReopenReason}
                        onChange={(e) => setTransitionReopenReason(e.target.value)}
                        placeholder="Reason for reopening this completed or lost deal..."
                        className="w-full p-2.5 bg-indigo-50/50 border border-indigo-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  )}
                </>
              );
            })()}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStageModalOpp(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedTargetStageId || isTransitioning}
                onClick={async () => {
                  if (!stageModalOpp || !selectedTargetStageId) return;
                  const targetObj = stagesToRender.find(s => s.key === selectedTargetStageId || s.code === selectedTargetStageId);
                  const fromCat = (stageModalOpp as any).stageLifecycleCategory || (['WON', 'PS-5'].includes((stageModalOpp.stageCode || stageModalOpp.stage || '').toUpperCase()) ? 'WON' : (stageModalOpp.stageCode || stageModalOpp.stage || '').toUpperCase() === 'LOST' ? 'LOST' : 'OPEN');
                  const toCat = targetObj?.lifecycleCategory || (selectedTargetStageId === 'WON' || selectedTargetStageId === 'PS-5' ? 'WON' : selectedTargetStageId === 'LOST' ? 'LOST' : 'OPEN');
                  const isReopen = (fromCat === 'WON' || fromCat === 'LOST') && toCat === 'OPEN';
                  const isLost = toCat === 'LOST';

                  if (isLost && !transitionLossReason.trim()) {
                    alert('A business loss reason is required to mark the project as LOST.');
                    return;
                  }
                  if (isReopen && !transitionReopenReason.trim()) {
                    alert('An explicit business reason is required to reopen this project.');
                    return;
                  }

                  setIsTransitioning(true);
                  try {
                    const res = await crmApi.transitionProjectStage(stageModalOpp.id, selectedTargetStageId, {
                      lossReason: isLost ? transitionLossReason.trim() : undefined,
                      reopenReason: isReopen ? transitionReopenReason.trim() : undefined,
                      isReopen,
                      expectedFromStage: stageModalOpp.stageCode || stageModalOpp.stage || stageModalOpp.stageId
                    });
                    if (res.success) {
                      setStageModalOpp(null);
                      loadData();
                    } else {
                      alert(`Stage transition failed: ${res.error}`);
                    }
                  } catch (err: any) {
                    alert(err.message || 'Stage transition failed');
                  } finally {
                    setIsTransitioning(false);
                  }
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm flex items-center gap-1.5"
              >
                {isTransitioning ? 'Applying...' : 'Apply Stage'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

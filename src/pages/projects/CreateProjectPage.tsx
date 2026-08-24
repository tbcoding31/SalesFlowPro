import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { masterDataApi } from '../../services/masterDataApi';
import { Customer, User, ProjectStage, Project, MasterDataItem } from '../../types';

export const CreateProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentTenant, currentUser } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Form State
  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [stage, setStage] = useState<string>('');
  const [probability, setProbability] = useState<number>(20);
  
  const [projectStages, setProjectStages] = useState<MasterDataItem[]>([]);
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [picId, setPicId] = useState('');
  const [description, setDescription] = useState('');

  // PIC Dropdown State
  const [isPicDropdownOpen, setIsPicDropdownOpen] = useState(false);
  const [picSearch, setPicSearch] = useState('');
  const picDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomers(DataService.getCustomers(tenantId));
    setUsers(DataService.getUsers(tenantId));
    // Default PIC to current user
    if (currentUser) {
      setPicId(currentUser.id);
    }
    masterDataApi.fetchMasterData('project_stages', tenantId).then(data => {
      setProjectStages(data);
      const def = data.find(d => d.isDefault);
      if (def) setStage(def.codeValue);
      else if (data.length > 0) setStage(data[0].codeValue);
    });
  }, [tenantId, currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (picDropdownRef.current && !picDropdownRef.current.contains(event.target as Node)) {
        setIsPicDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = (isDraft: boolean = false) => {
    if (!name || !customerId || !picId) {
      alert('Please fill in the required fields: Project Name, Customer, and PIC.');
      return;
    }

    const selectedCustomer = customers.find(c => c.id === customerId);
    const selectedPic = users.find(u => u.id === picId);

    if (!selectedCustomer || !selectedPic) return;

    const newOpp: Project = {
      id: `OPP-${Date.now()}`,
      tenantId,
      name,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerCode: selectedCustomer.code,
      picId: selectedPic.id,
      picName: selectedPic.name,
      picAvatar: selectedPic.avatar,
      estimatedValue: Number(estimatedValue.replace(/[^0-9]/g, '')) || 0,
      probability,
      expectedCloseDate: expectedCloseDate || new Date().toISOString().split('T')[0],
      stage: isDraft ? (projectStages[0]?.code_value || 'LEAD') : stage,
      source: 'Direct',
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    DataService.saveProject(newOpp);
    navigate('/projects');
  };

  const formatMoneyInput = (val: string) => {
    const numberPattern = val.replace(/[^0-9]/g, '');
    if (!numberPattern) return '';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Number(numberPattern));
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEstimatedValue(formatMoneyInput(e.target.value));
  };

  const selectedPicObj = users.find(u => u.id === picId);
  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(picSearch.toLowerCase()));

  // Auto-adjust probability based on stage
  useEffect(() => {
    const s = stage.toUpperCase();
    if (s.includes('LEAD')) setProbability(10);
    else if (s.includes('QUAL')) setProbability(25);
    else if (s.includes('PROP')) setProbability(50);
    else if (s.includes('NEGOTIATION')) setProbability(75);
    else if (s.includes('WON') || s.includes('DEAL')) setProbability(100);
    else if (s.includes('LOST')) setProbability(0);
  }, [stage]);

  return (
    <div className="space-y-6 font-['Inter',sans-serif] max-w-7xl mx-auto pb-10">
      
      {/* Header Section */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
        <button onClick={() => navigate('/projects')} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Projects
        </button>
        <span>/</span>
        <span className="text-slate-800 font-medium">Create Project</span>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-['Hanken_Grotesk'] tracking-tight">
            Create Project
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Add a new sales project to your pipeline.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={() => navigate('/projects')}
            className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-bold rounded-xl shadow-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => handleSave(true)}
            className="flex-1 sm:flex-none px-4 py-2 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-sm font-bold rounded-xl shadow-sm transition-colors"
          >
            Save Draft
          </button>
          <button 
            onClick={() => handleSave(false)}
            className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors"
          >
            Create Project
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Project Information */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-indigo-500 text-[20px]">info</span>
              Project Information
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Project Name <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Office Equipment Purchase - 2026"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Customer <span className="text-rose-500">*</span></label>
                <select 
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
                >
                  <option value="" disabled>Select a customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Estimated Value <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    value={estimatedValue}
                    onChange={handleValueChange}
                    placeholder="Rp 0"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-[#008f53] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Expected Close Date</label>
                  <input 
                    type="date" 
                    value={expectedCloseDate}
                    onChange={(e) => setExpectedCloseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Stage</label>
                  <select 
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
                  >
                    {projectStages.map(s => (
                      <option key={s.id} value={s.code_value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Probability (%)</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      step="5"
                      value={probability}
                      onChange={(e) => setProbability(Number(e.target.value))}
                      className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="text-sm font-bold text-slate-700 w-12 text-right">{probability}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Ownership & Details */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-indigo-500 text-[20px]">assignment_ind</span>
              Ownership
            </h3>

            <div className="space-y-4">
              <div className="relative" ref={picDropdownRef}>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Person in Charge (PIC) <span className="text-rose-500">*</span></label>
                
                {/* Selected PIC Display (Click to open dropdown) */}
                <div 
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-colors"
                  onClick={() => setIsPicDropdownOpen(!isPicDropdownOpen)}
                >
                  {selectedPicObj ? (
                    <div className="flex items-center gap-3">
                      {selectedPicObj.avatar ? (
                        <img src={selectedPicObj.avatar} alt={selectedPicObj.name} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold border border-slate-200">
                          {selectedPicObj.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-bold text-slate-800">{selectedPicObj.name}</div>
                        <div className="text-[10px] text-slate-500 font-medium">{selectedPicObj.role}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">Select a team member</div>
                  )}
                  <span className="material-symbols-outlined text-slate-400">expand_more</span>
                </div>

                {/* Custom Dropdown UI */}
                {isPicDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                        <input 
                          type="text"
                          placeholder="Search team member..."
                          value={picSearch}
                          onChange={(e) => setPicSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-1">
                      {filteredUsers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">No members found.</div>
                      ) : (
                        filteredUsers.map(user => {
                          // Mock workload data for display purposes
                          const activeTasks = (user.id.length * 3) % 12; 
                          const openOpps = (user.id.length * 2) % 8;
                          const isHighWorkload = activeTasks > 8 || openOpps > 5;

                          return (
                            <div 
                              key={user.id}
                              className="w-full text-left p-3 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              onClick={() => {
                                setPicId(user.id);
                                setIsPicDropdownOpen(false);
                                setPicSearch('');
                              }}
                            >
                              <div className="flex items-center gap-3">
                                {user.avatar ? (
                                  <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold border border-slate-200">
                                    {user.name.charAt(0)}
                                  </div>
                                )}
                                <div>
                                  <div className="text-sm font-bold text-slate-800">{user.name}</div>
                                  <div className="text-[10px] font-semibold text-indigo-600 mt-0.5">{user.role}</div>
                                </div>
                              </div>
                              <div className="flex flex-row sm:flex-col gap-2 sm:gap-1 items-start sm:items-end shrink-0 pl-12 sm:pl-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[14px] text-slate-400">task_alt</span>
                                  <span className="text-[10px] font-medium text-slate-600">{activeTasks} Active Tasks</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[14px] text-slate-400">monetization_on</span>
                                  <span className="text-[10px] font-medium text-slate-600">{openOpps} Open Opps</span>
                                </div>
                                {isHighWorkload && (
                                  <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-bold rounded mt-0.5">High Workload</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Description & Notes</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter any initial notes, competitor information, or specific requirements..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow min-h-[120px] resize-y"
                />
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

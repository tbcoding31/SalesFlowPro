import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { masterDataApi } from '../../services/masterDataApi';
import { MasterDataItem } from '../../types';

export const MasterDataPage: React.FC = () => {
  const { currentTenant, currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const effectiveTenantId = isSuperAdmin ? 'platform' : currentTenant?.id || '';
  

  const [selectedCategory, setSelectedCategory] = useState<MasterDataItem['category']>('task_priorities');
  const [items, setItems] = useState<MasterDataItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterDataItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<MasterDataItem | null>(null);

  // Modal form state
  const [label, setLabel] = useState('');
  const [codeValue, setCodeValue] = useState('');
  const [indicator, setIndicator] = useState('flag');
  const [isDefault, setIsDefault] = useState(false);
  const [probability, setProbability] = useState<number>(50);
  const [phase, setPhase] = useState<'SALES' | 'DELIVERY' | 'POST_LIVE' | 'CLOSED'>('SALES');
  const [commercialOutcome, setCommercialOutcome] = useState<'NONE' | 'WON' | 'LOST' | 'CANCELLED'>('NONE');
  const [isTerminal, setIsTerminal] = useState<boolean>(false);
  const [allowVisits, setAllowVisits] = useState<boolean>(true);
  const [allowNewProject, setAllowNewProject] = useState<boolean>(true);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Platform Visit Reminder Defaults state (Super Admin)
  const [reminderDefaults, setReminderDefaults] = useState({
    dashboardReminderEnabled: true,
    dashboardReminderDaysBefore: 5,
    emailReminderEnabled: true,
    emailReminderDaysBefore: 2,
    immediateReminderInsideWindowEnabled: true
  });
  const [isSavingDefaults, setIsSavingDefaults] = useState(false);
  const [defaultsMsg, setDefaultsMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const categories: { id: MasterDataItem['category'] | 'visit_reminder_defaults'; name: string; icon: string }[] = [
    { id: 'task_types', name: 'Task Types', icon: 'label' },
    { id: 'task_priorities', name: 'Task Priorities', icon: 'priority_high' },
    { id: 'customer_types', name: 'Customer Types', icon: 'category' },
    { id: 'customer_status', name: 'Customer Statuses', icon: 'toggle_on' },
    { id: 'visit_purposes', name: 'Visit Purposes', icon: 'route' },
    { id: 'task_statuses', name: 'Task Statuses', icon: 'task_alt' },
    { id: 'project_stages', name: 'Project Stages', icon: 'monetization_on' },
    { id: 'departments', name: 'Departments', icon: 'corporate_fare' },
    { id: 'positions', name: 'Positions', icon: 'badge' },
    ...(isSuperAdmin ? [{ id: 'visit_reminder_defaults' as any, name: 'Visit Reminder Defaults', icon: 'notifications_active' }] : [])
  ];

  const loadDefaults = async () => {
    setIsLoading(true);
    const data = await masterDataApi.fetchVisitReminderDefaults();
    if (data) {
      setReminderDefaults({
        dashboardReminderEnabled: Boolean(data.dashboardReminderEnabled),
        dashboardReminderDaysBefore: Number(data.dashboardReminderDaysBefore),
        emailReminderEnabled: Boolean(data.emailReminderEnabled),
        emailReminderDaysBefore: Number(data.emailReminderDaysBefore),
        immediateReminderInsideWindowEnabled: Boolean(data.immediateReminderInsideWindowEnabled)
      });
    }
    setIsLoading(false);
  };

  const loadData = async (cat: any) => {
    if (cat === 'visit_reminder_defaults') {
      await loadDefaults();
      return;
    }
    setIsLoading(true);
    const data = await masterDataApi.fetchMasterData(cat, effectiveTenantId);
    setItems(data);
    setIsLoading(false);
  };

  const handleSaveDefaults = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDefaults(true);
    setDefaultsMsg(null);
    try {
      await masterDataApi.updateVisitReminderDefaults(reminderDefaults);
      setDefaultsMsg({ text: 'Platform visit reminder defaults updated successfully!', isError: false });
    } catch (err: any) {
      setDefaultsMsg({ text: err.message || 'Failed to update reminder defaults', isError: true });
    } finally {
      setIsSavingDefaults(false);
    }
  };

  useEffect(() => {
    loadData(selectedCategory);
  }, [selectedCategory, effectiveTenantId]);


  const handleSelectCategory = (cat: MasterDataItem['category']) => {
    setSelectedCategory(cat);
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setLabel('');
    setCodeValue('');
    setIndicator('flag');
    setIsDefault(false);
    setProbability(50);
    setPhase('SALES');
    setCommercialOutcome('NONE');
    setIsTerminal(false);
    setAllowVisits(true);
    setAllowNewProject(true);
    setIsActive(true);
    setShowModal(true);
  };

  const handleOpenEditModal = (item: MasterDataItem) => {
    setEditingItem(item);
    setLabel(item.label);
    setCodeValue(item.codeValue);
    setIndicator(item.indicator || '');
    setIsDefault(!!item.isDefault);
    setProbability(item.probability !== undefined ? item.probability : 50);
    setPhase(item.phase || 'SALES');
    setCommercialOutcome(item.commercialOutcome || 'NONE');
    setIsTerminal(!!item.isTerminal);
    setAllowVisits(item.allowVisits !== false);
    setAllowNewProject(item.allowNewProject !== false);
    setIsActive(item.isActive !== false);
    setShowModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategory === 'project_stages') {
      const shouldBeTerm = phase === 'CLOSED' || commercialOutcome === 'LOST' || commercialOutcome === 'CANCELLED';
      if (isTerminal !== shouldBeTerm) {
        alert('Strict Terminal Consistency Violation: isTerminal must be true if and only if phase is CLOSED or commercialOutcome is LOST or CANCELLED.');
        return;
      }
    }

    const isNew = !editingItem;
    const itemToSave: MasterDataItem = {
      id: editingItem ? editingItem.id : (selectedCategory === 'project_stages' ? `PS-${Date.now().toString().slice(-4)}` : `MD-${Date.now().toString().slice(-4)}`),
      category: selectedCategory,
      label,
      codeValue,
      indicator,
      isDefault,
      displayOrder: editingItem ? editingItem.displayOrder : items.length + 1,
      probability: selectedCategory === 'project_stages' ? probability : undefined,
      phase: selectedCategory === 'project_stages' ? phase : undefined,
      commercialOutcome: selectedCategory === 'project_stages' ? commercialOutcome : undefined,
      isTerminal: selectedCategory === 'project_stages' ? isTerminal : undefined,
      allowVisits: selectedCategory === 'project_stages' ? allowVisits : undefined,
      allowNewProject: selectedCategory === 'project_stages' ? allowNewProject : undefined,
      isActive: selectedCategory === 'project_stages' ? isActive : undefined,
    };

    const success = await masterDataApi.saveMasterDataItem(itemToSave, effectiveTenantId, isNew);
    if (success) {
      await loadData(selectedCategory);
      setShowModal(false);
      setEditingItem(null);
      setLabel('');
      setCodeValue('');
    } else {
      alert("Failed to save item");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    const success = await masterDataApi.deleteMasterDataItem(selectedCategory, deletingItem.id, effectiveTenantId);
    if (success) {
      await loadData(selectedCategory);
      setDeletingItem(null);
    } else {
      alert("Failed to delete item");
    }
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#4744e5]/10 text-[#4744e5] text-xs font-bold rounded uppercase">
              System Configuration
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mt-1">
            Master Data & Classification Lookups
          </h1>
          <p className="text-xs text-[#464555] mt-0.5">
            Configure system lookup values, task priority rankings, customer lifecycle status lists, and stage options.
          </p>
        </div>

      </div>

      {/* Split Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* LEFT PANE: CATEGORY LIST */}
        <div className="bg-white p-3 rounded-xl border border-[#E1E1E1] shadow-sm space-y-1">
          <span className="px-3 py-2 text-[10px] font-bold text-[#464555] uppercase tracking-wider block font-['Hanken_Grotesk']">
            Master Categories
          </span>
          {categories.map((c) => {
            const isSelected = c.id === selectedCategory;
            return (
              <button
                key={c.id}
                onClick={() => handleSelectCategory(c.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors text-left ${
                  isSelected
                    ? 'bg-[#4744e5] text-white'
                    : 'text-[#464555] hover:bg-[#f3f3f3] hover:text-[#1a1c1c]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{c.icon}</span>
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>

        {/* RIGHT PANE: ITEMS LIST TABLE OR DEFAULTS FORM */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-[#E1E1E1] shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          {selectedCategory === 'visit_reminder_defaults' ? (
            <div className="p-6 flex flex-col gap-6">
              <div className="border-b border-[#E1E1E1] pb-4">
                <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Platform Visit Reminder Defaults
                </h2>
                <p className="text-xs text-[#767587] mt-1">
                  Global baseline snapshot copied to new tenants during onboarding and used when a tenant resets to defaults.
                </p>
              </div>

              {defaultsMsg && (
                <div className={`p-4 rounded-lg text-xs font-semibold ${defaultsMsg.isError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  {defaultsMsg.text}
                </div>
              )}

              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-xs text-indigo-900">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-[18px]">info</span>
                  <div className="space-y-1">
                    <p className="font-bold">Two-Tier Reminder Policy Architecture</p>
                    <p className="text-indigo-800">
                      Changes made here define the <strong>Platform Default Snapshot</strong>. Newly created tenants will automatically receive these values. Existing tenants will not be affected unless their Tenant Admin explicitly resets their settings.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveDefaults} className="space-y-6 max-w-2xl">
                {/* Dashboard Reminder Section */}
                <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Dashboard Reminder</h3>
                      <p className="text-xs text-slate-500">Show upcoming visits on the user's dashboard widget</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reminderDefaults.dashboardReminderEnabled}
                        onChange={(e) => setReminderDefaults({ ...reminderDefaults, dashboardReminderEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4744e5]"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Lead Days Before Visit (H-X)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={reminderDefaults.dashboardReminderDaysBefore}
                        onChange={(e) => setReminderDefaults({ ...reminderDefaults, dashboardReminderDaysBefore: parseInt(e.target.value) || 0 })}
                        className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#4744e5]/20 focus:border-[#4744e5]"
                      />
                      <span className="text-xs text-slate-500">days before scheduled visit date (0–30 days)</span>
                    </div>
                  </div>
                </div>

                {/* Email Reminder Section */}
                <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Email Reminder</h3>
                      <p className="text-xs text-slate-500">Send automated email notifications to PIC and participants</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reminderDefaults.emailReminderEnabled}
                        onChange={(e) => setReminderDefaults({ ...reminderDefaults, emailReminderEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4744e5]"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Lead Days Before Visit (H-X)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={0}
                        max={14}
                        value={reminderDefaults.emailReminderDaysBefore}
                        onChange={(e) => setReminderDefaults({ ...reminderDefaults, emailReminderDaysBefore: parseInt(e.target.value) || 0 })}
                        className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#4744e5]/20 focus:border-[#4744e5]"
                      />
                      <span className="text-xs text-slate-500">days before scheduled visit date (0–14 days)</span>
                    </div>
                  </div>
                </div>

                {/* Immediate Reminder Inside Window */}
                <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 flex items-center justify-between">
                  <div className="max-w-md">
                    <h3 className="text-sm font-bold text-slate-800">Immediate Reminder Inside Window</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      When a visit is newly created or rescheduled directly inside the reminder lead window, queue and send reminder immediately.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reminderDefaults.immediateReminderInsideWindowEnabled}
                      onChange={(e) => setReminderDefaults({ ...reminderDefaults, immediateReminderInsideWindowEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4744e5]"></div>
                  </label>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSavingDefaults}
                    className="px-5 py-2.5 bg-[#4744e5] hover:bg-[#2c24ce] disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2"
                  >
                    {isSavingDefaults && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                    <span>Save Platform Defaults</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center border-b border-[#E1E1E1] p-6">
                <div>
                  <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                    {categories.find((c) => c.id === selectedCategory)?.name}
                  </h2>
                  <p className="text-xs text-[#767587]">Configured system values and order rankings</p>
                </div>
                <button
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 bg-[#4744e5] hover:bg-[#2c24ce] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 font-['Hanken_Grotesk'] shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>Add Item</span>
                </button>            
              </div>

          <div className="flex-1 overflow-x-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-[#767587]">
                <span className="material-symbols-outlined text-4xl animate-spin text-[#4744e5]">progress_activity</span>
                <span className="mt-4 text-sm font-semibold">Loading data...</span>
              </div>
            ) : (
            <table className="w-full text-left text-xs text-[#1a1c1c]">
              <thead className="bg-[#f9f9f9] text-[#464555] font-bold uppercase border-b border-[#E1E1E1]">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">Order</th>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Code Value</th>
                  {selectedCategory === 'project_stages' ? (
                    <>
                      <th className="px-4 py-3">Phase</th>
                      <th className="px-4 py-3">Outcome</th>
                      <th className="px-4 py-3">Benchmark Prob</th>
                      <th className="px-4 py-3">Visits</th>
                      <th className="px-4 py-3">New Proj</th>
                      <th className="px-4 py-3">Terminal</th>
                      <th className="px-4 py-3">Status</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3">Indicator Icon</th>
                      <th className="px-4 py-3">Default</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E1E1]">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={selectedCategory === 'project_stages' ? 11 : 6} className="text-center py-8 text-[#767587] text-xs">
                      No master items defined in this category.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-[#f9f9f9]">
                      <td className="px-4 py-3 text-center font-bold text-[#767587]">
                        {idx + 1}
                      </td>

                      <td className="px-4 py-3 font-bold text-[#1a1c1c]">{item.label}</td>

                      <td className="px-4 py-3 font-mono text-[#464555]">{item.codeValue}</td>

                      {selectedCategory === 'project_stages' ? (
                        <>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.phase === 'SALES' ? 'bg-blue-100 text-blue-700' :
                              item.phase === 'DELIVERY' ? 'bg-indigo-100 text-indigo-700' :
                              item.phase === 'POST_LIVE' ? 'bg-teal-100 text-teal-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {item.phase || 'SALES'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.commercialOutcome === 'WON' 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : item.commercialOutcome === 'LOST' 
                                ? 'bg-rose-100 text-rose-700' 
                                : item.commercialOutcome === 'CANCELLED'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {item.commercialOutcome || 'NONE'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-xs text-slate-700">
                            {item.probability !== undefined ? `${item.probability}%` : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[11px] font-bold ${item.allowVisits !== false ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {item.allowVisits !== false ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[11px] font-bold ${item.allowNewProject !== false ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {item.allowNewProject !== false ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[11px] font-bold ${item.isTerminal ? 'text-rose-600' : 'text-slate-400'}`}>
                              {item.isTerminal ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                              {item.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3">
                            {item.indicator && (
                              <span className="material-symbols-outlined text-[18px] text-[#4744e5]">
                                {item.indicator}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {item.isDefault ? (
                              <span className="px-2 py-0.5 bg-[#00C875]/10 text-[#008f53] font-bold rounded text-[10px]">
                                Default Option
                              </span>
                            ) : (
                              <span className="text-[#767587] text-[11px]">-</span>
                            )}
                          </td>
                        </>
                      )}

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1 text-[#4744e5] hover:bg-[#4744e5]/10 rounded transition-colors"
                            title="Edit Item"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => setDeletingItem(item)}
                            className="p-1 text-[#ba1a1a] hover:bg-[#ba1a1a]/10 rounded transition-colors"
                            title="Delete Item"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            )}
          </div>
          </>
          )}
        </div>
      </div>

      {/* ADD / EDIT ITEM MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                {editingItem ? 'Edit Item Option' : 'Add Item Option'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-[#767587]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Display Label *</label>
                <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    setCodeValue(e.target.value.toUpperCase().replace(/\s+/g, '_'));
                  }}
                  placeholder="e.g. Critical"
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Code Value *</label>
                <input
                  type="text"
                  required
                  value={codeValue}
                  onChange={(e) => setCodeValue(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs font-mono"
                />
              </div>

              {selectedCategory === 'project_stages' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Operational Phase *</label>
                    <select
                      value={phase}
                      onChange={(e) => {
                        const newPhase = e.target.value as 'SALES' | 'DELIVERY' | 'POST_LIVE' | 'CLOSED';
                        setPhase(newPhase);
                        if (newPhase === 'CLOSED') {
                          setIsTerminal(true);
                          setAllowVisits(false);
                          setAllowNewProject(false);
                          if (commercialOutcome === 'NONE') setCommercialOutcome('WON');
                        } else if (commercialOutcome !== 'LOST' && commercialOutcome !== 'CANCELLED') {
                          setIsTerminal(false);
                        }
                      }}
                      className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs bg-white"
                    >
                      <option value="SALES">SALES (Sales & Pre-Contract Pipeline)</option>
                      <option value="DELIVERY">DELIVERY (Operational Execution)</option>
                      <option value="POST_LIVE">POST_LIVE (Warranty & Maintenance)</option>
                      <option value="CLOSED">CLOSED (Terminal Project Closure)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Commercial Outcome *</label>
                    <select
                      value={commercialOutcome}
                      onChange={(e) => {
                        const newOutcome = e.target.value as 'NONE' | 'WON' | 'LOST' | 'CANCELLED';
                        setCommercialOutcome(newOutcome);
                        if (newOutcome === 'LOST' || newOutcome === 'CANCELLED') {
                          setIsTerminal(true);
                          setAllowVisits(false);
                          setAllowNewProject(false);
                        } else if (phase !== 'CLOSED') {
                          setIsTerminal(false);
                        }
                      }}
                      className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs bg-white"
                    >
                      <option value="NONE">NONE (Pre-Outcome Deal)</option>
                      <option value="WON">WON (Commercially Closed Won)</option>
                      <option value="LOST">LOST (Closed Lost - Pre-Win Only)</option>
                      <option value="CANCELLED">CANCELLED (Post-Win / Delivery Aborted)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Benchmark Probability (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={probability}
                      onChange={(e) => setProbability(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="term"
                      checked={isTerminal}
                      disabled
                      className="w-4 h-4 rounded text-[#4744e5] opacity-80 cursor-not-allowed"
                    />
                    <label htmlFor="term" className="text-xs text-[#1a1c1c] font-semibold">
                      Terminal Stage (Enforced strictly by Phase CLOSED or Outcome LOST/CANCELLED)
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="vis"
                      checked={allowVisits}
                      onChange={(e) => setAllowVisits(e.target.checked)}
                      className="w-4 h-4 rounded text-[#4744e5]"
                    />
                    <label htmlFor="vis" className="text-xs text-[#1a1c1c] font-semibold">
                      Allow Visits (Permits linking field visits to projects in this stage)
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="newProj"
                      checked={allowNewProject}
                      onChange={(e) => setAllowNewProject(e.target.checked)}
                      className="w-4 h-4 rounded text-[#4744e5]"
                    />
                    <label htmlFor="newProj" className="text-xs text-[#1a1c1c] font-semibold">
                      Allow Initial Stage Selection (Permits selecting when creating a project)
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="act"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-[#4744e5]"
                    />
                    <label htmlFor="act" className="text-xs text-[#1a1c1c] font-semibold">
                      Active Stage (Allows transitions into this stage)
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#1a1c1c] mb-1">Icon Identifier</label>
                    <input
                      type="text"
                      value={indicator}
                      onChange={(e) => setIndicator(e.target.value)}
                      placeholder="e.g. flag, priority_high, star"
                      className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="def"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      className="w-4 h-4 rounded text-[#4744e5]"
                    />
                    <label htmlFor="def" className="text-xs text-[#1a1c1c] font-semibold">
                      Set as Default Selection Option
                    </label>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-[#E1E1E1] text-[#1a1c1c] rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4744e5] text-white rounded text-xs font-bold hover:bg-[#2c24ce]"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-2xl border border-[#E1E1E1] shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#ba1a1a]/10 text-[#ba1a1a] flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[22px]">warning</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Peringatan Hapus Data
                </h3>
                <p className="text-xs text-[#767587] leading-relaxed">
                  Apakah Anda yakin ingin menghapus item master <strong className="text-[#1a1c1c]">{deletingItem.label}</strong> (<code className="font-mono text-[#ba1a1a] font-bold">{deletingItem.codeValue}</code>)? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 border border-[#E1E1E1] hover:bg-[#f3f3f3] text-[#1a1c1c] rounded-xl text-xs font-bold transition-all font-['Hanken_Grotesk']"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-[#ba1a1a] hover:bg-[#9a1414] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 font-['Hanken_Grotesk']"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Ya, Hapus Item</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

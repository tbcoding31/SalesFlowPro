import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { masterDataApi } from '../../services/masterDataApi';
import { MasterDataItem } from '../../types';

export const MasterDataPage: React.FC = () => {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id ;

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

  const categories: { id: MasterDataItem['category']; name: string; icon: string }[] = [
    { id: 'task_types', name: 'Task Types', icon: 'label' },
    { id: 'task_priorities', name: 'Task Priorities', icon: 'priority_high' },
    { id: 'customer_types', name: 'Customer Types', icon: 'category' },
    { id: 'customer_status', name: 'Customer Statuses', icon: 'toggle_on' },
    { id: 'visit_purposes', name: 'Visit Purposes', icon: 'route' },
    { id: 'task_statuses', name: 'Task Statuses', icon: 'task_alt' },
    { id: 'project_stages', name: 'Project Stages', icon: 'monetization_on' },
    { id: 'departments', name: 'Departments', icon: 'corporate_fare' },
    { id: 'positions', name: 'Positions', icon: 'badge' },
  ];

  const loadData = async (cat: MasterDataItem['category']) => {
    setIsLoading(true);
    const data = await masterDataApi.fetchMasterData(cat, tenantId);
    setItems(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData(selectedCategory);
  }, [selectedCategory, tenantId]);

  const handleSelectCategory = (cat: MasterDataItem['category']) => {
    setSelectedCategory(cat);
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setLabel('');
    setCodeValue('');
    setIndicator('flag');
    setIsDefault(false);
    setShowModal(true);
  };

  const handleOpenEditModal = (item: MasterDataItem) => {
    setEditingItem(item);
    setLabel(item.label);
    setCodeValue(item.codeValue);
    setIndicator(item.indicator || '');
    setIsDefault(!!item.isDefault);
    setShowModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const isNew = !editingItem;
    const itemToSave: MasterDataItem = {
      id: editingItem ? editingItem.id : `MD-${Date.now().toString().slice(-4)}`,
      category: selectedCategory,
      label,
      codeValue,
      indicator,
      isDefault,
      displayOrder: editingItem ? editingItem.displayOrder : items.length + 1,
    };

    const success = await masterDataApi.saveMasterDataItem(itemToSave, tenantId, isNew);
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
    const success = await masterDataApi.deleteMasterDataItem(selectedCategory, deletingItem.id);
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

        {/* RIGHT PANE: ITEMS LIST TABLE */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-[#E1E1E1] shadow-sm overflow-hidden flex flex-col min-h-[500px]">
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
                  <th className="px-4 py-3">Indicator Icon</th>
                  <th className="px-4 py-3">Default</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E1E1]">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-[#767587] text-xs">
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

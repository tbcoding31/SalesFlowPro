import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { masterDataApi } from '../../services/masterDataApi';
import { Customer, CustomerType, User, MasterDataItem } from '../../types';

interface ExtendedCustomerItem {
  id: string;
  code: string;
  name: string;
  industry: string;
  avatarBg: string;
  avatarText: string;
  status: 'Active' | 'Pending' | 'Inactive';
  contactPersonName: string;
  contactPersonEmail: string;
  picName: string;
  picAvatar?: string;
  picIsUnassigned?: boolean;
  lastVisit: string;
  followUpDate?: string;
  followUpStatus?: 'scheduled' | 'overdue' | 'none';
  tasksCount: number | '-';
  oppsCount: number | '-';
  updatedAt: string;
  type: string;
}

const DEFAULT_MOCK_CUSTOMERS: ExtendedCustomerItem[] = [
  {
    id: 'CUS-001',
    code: 'CUS-0001',
    name: 'PT Maju Jaya',
    industry: 'Manufacturing',
    avatarBg: 'bg-[#6161ff]',
    avatarText: 'MJ',
    status: 'Active',
    contactPersonName: 'Budi Santoso',
    contactPersonEmail: 'budi@majujaya.co.id',
    picName: 'Ahmad',
    picAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    lastVisit: '8 Aug 2026',
    followUpDate: '12 Aug 2026',
    followUpStatus: 'scheduled',
    tasksCount: 4,
    oppsCount: 3,
    updatedAt: '10 Aug 2026',
    type: 'Manufacturing',
  },
  {
    id: 'CUS-002',
    code: 'CUS-0002',
    name: 'TechSynergy Solutions',
    industry: 'IT Services',
    avatarBg: 'bg-[#f97316]',
    avatarText: 'TS',
    status: 'Pending',
    contactPersonName: 'Sarah Connor',
    contactPersonEmail: 'sarah@techsynergy.net',
    picName: 'Rina',
    picAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    lastVisit: '1 Aug 2026',
    followUpStatus: 'none',
    tasksCount: 1,
    oppsCount: 1,
    updatedAt: '5 Aug 2026',
    type: 'IT Services',
  },
  {
    id: 'CUS-003',
    code: 'CUS-0003',
    name: 'Global Retailers Inc',
    industry: 'Retail',
    avatarBg: 'bg-[#94a3b8]',
    avatarText: 'GR',
    status: 'Inactive',
    contactPersonName: 'Michael Lee',
    contactPersonEmail: 'm.lee@globalretail.com',
    picName: 'Unassigned',
    picIsUnassigned: true,
    lastVisit: '15 Jan 2026',
    followUpStatus: 'overdue',
    tasksCount: '-',
    oppsCount: '-',
    updatedAt: '2 Feb 2026',
    type: 'Retail',
  },
  {
    id: 'CUS-004',
    code: 'CUS-0004',
    name: 'Nusantara Energy Corp',
    industry: 'Energy & Mining',
    avatarBg: 'bg-[#10b981]',
    avatarText: 'NE',
    status: 'Active',
    contactPersonName: 'Dian Sastro',
    contactPersonEmail: 'dian.s@nusantaraenergy.co.id',
    picName: 'Ahmad',
    picAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    lastVisit: '5 Aug 2026',
    followUpDate: '18 Aug 2026',
    followUpStatus: 'scheduled',
    tasksCount: 6,
    oppsCount: 4,
    updatedAt: '11 Aug 2026',
    type: 'Energy',
  },
  {
    id: 'CUS-005',
    code: 'CUS-0005',
    name: 'Barokah Logistics',
    industry: 'Transport & Logistics',
    avatarBg: 'bg-[#3b82f6]',
    avatarText: 'BL',
    status: 'Active',
    contactPersonName: 'Eko Prasetyo',
    contactPersonEmail: 'eko@barokahlogistics.id',
    picName: 'Dimas',
    picAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    lastVisit: '3 Aug 2026',
    followUpDate: '15 Aug 2026',
    followUpStatus: 'scheduled',
    tasksCount: 2,
    oppsCount: 2,
    updatedAt: '9 Aug 2026',
    type: 'Logistics',
  },
];

export const CustomersListPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentTenant, currentUser } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';

  // Local state for list items
  const [items, setItems] = useState<ExtendedCustomerItem[]>(() => {
    const dataFromService = DataService.getCustomers(tenantId);
    if (dataFromService && dataFromService.length > 0) {
      // Map initial data service items to display structure
      const mapped = dataFromService.map((c, idx) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        industry: c.industry,
        avatarBg: idx % 3 === 0 ? 'bg-[#6161ff]' : idx % 3 === 1 ? 'bg-[#f97316]' : 'bg-[#94a3b8]',
        avatarText: c.name.substring(0, 2).toUpperCase(),
        status: c.status === 'ACTIVE' || c.status === 'CUSTOMER' ? 'Active' as const : c.status === 'PROSPECT' ? 'Pending' as const : 'Inactive' as const,
        contactPersonName: c.contacts && c.contacts.length > 0 ? c.contacts[0].name : 'Contact Person',
        contactPersonEmail: c.email || 'info@company.com',
        picName: c.assignedPicName || 'Ahmad',
        picAvatar: c.assignedPicAvatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
        picIsUnassigned: !c.assignedPicName || c.assignedPicName === 'Unassigned',
        lastVisit: c.lastVisitAt || '8 Aug 2026',
        followUpDate: c.nextFollowUpAt || '12 Aug 2026',
        followUpStatus: c.nextFollowUpAt ? 'scheduled' as const : 'none' as const,
        tasksCount: Math.floor(Math.random() * 5) + 1,
        oppsCount: Math.floor(Math.random() * 4) + 1,
        updatedAt: '10 Aug 2026',
        type: c.type,
      }));

      // Ensure mock items from user request image (PT Maju Jaya, TechSynergy, Global Retailers) exist
      const hasMajuJaya = mapped.some(m => m.name.toLowerCase().includes('maju jaya'));
      if (!hasMajuJaya) {
        return [...DEFAULT_MOCK_CUSTOMERS, ...mapped];
      }
      return mapped;
    }
    return DEFAULT_MOCK_CUSTOMERS;
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('Any');
  const [picFilter, setPicFilter] = useState('Me');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalCount = 248; // To match header in image

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIndustry, setNewIndustry] = useState('Manufacturing');
  const [newType, setNewType] = useState<CustomerType>('COMPANY');
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newPicId, setNewPicId] = useState(currentUser?.id || 'USR-001');

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<ExtendedCustomerItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [editStatus, setEditStatus] = useState<'Active' | 'Pending' | 'Inactive'>('Active');
  const [editContactName, setEditContactName] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editPicName, setEditPicName] = useState('');

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<ExtendedCustomerItem | null>(null);

  const [customerStatuses, setCustomerStatuses] = useState<MasterDataItem[]>([]);
  const [customerTypes, setCustomerTypes] = useState<MasterDataItem[]>([]);

  React.useEffect(() => {
    masterDataApi.fetchMasterData('customer_statuses', tenantId).then(setCustomerStatuses);
    masterDataApi.fetchMasterData('customer_types', tenantId).then(setCustomerTypes);
  }, [tenantId]);

  const tenantUsers: User[] = DataService.getUsers(tenantId);

  const handleOpenEditModal = (item: ExtendedCustomerItem) => {
    setEditingCustomer(item);
    setEditName(item.name);
    setEditIndustry(item.industry);
    setEditStatus(item.status);
    setEditContactName(item.contactPersonName);
    setEditContactEmail(item.contactPersonEmail);
    setEditPicName(item.picName);
    setShowEditModal(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    const picUser = tenantUsers.find((u) => u.name === editPicName) || currentUser;

    const updatedItem: ExtendedCustomerItem = {
      ...editingCustomer,
      name: editName,
      industry: editIndustry,
      avatarText: editName.substring(0, 2).toUpperCase(),
      status: editStatus,
      contactPersonName: editContactName,
      contactPersonEmail: editContactEmail,
      picName: editPicName === 'Unassigned' ? 'Unassigned' : editPicName,
      picIsUnassigned: editPicName === 'Unassigned',
      picAvatar: editPicName === 'Unassigned' ? undefined : (picUser?.avatarUrl || editingCustomer.picAvatar),
      updatedAt: 'Today',
    };

    setItems((prev) => prev.map((i) => (i.id === editingCustomer.id ? updatedItem : i)));

    const realCustomer = DataService.getCustomerById(editingCustomer.id);
    if (realCustomer) {
      realCustomer.name = editName;
      realCustomer.industry = editIndustry;
      realCustomer.status = editStatus === 'Active' ? 'ACTIVE' : editStatus === 'Pending' ? 'PROSPECT' : 'INACTIVE';
      realCustomer.email = editContactEmail;
      if (realCustomer.contacts && realCustomer.contacts.length > 0) {
        realCustomer.contacts[0].name = editContactName;
        realCustomer.contacts[0].email = editContactEmail;
      }
      if (editPicName !== 'Unassigned') {
        realCustomer.assignedPicName = editPicName;
      }
      DataService.saveCustomer(realCustomer);
    }

    setShowEditModal(false);
    setEditingCustomer(null);
  };

  const handleOpenDeleteModal = (item: ExtendedCustomerItem) => {
    setCustomerToDelete(item);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (!customerToDelete) return;

    setItems((prev) => prev.filter((i) => i.id !== customerToDelete.id));
    DataService.deleteCustomer(customerToDelete.id);

    setShowDeleteModal(false);
    setCustomerToDelete(null);
  };

  // Filter logic
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.contactPersonName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.contactPersonEmail.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' || item.status.toLowerCase() === statusFilter.toLowerCase();

    const matchesType =
      typeFilter === 'Any' || item.type.toLowerCase().includes(typeFilter.toLowerCase());

    const matchesPic =
      picFilter === 'All' ||
      (picFilter === 'Me' && (item.picName === 'Ahmad' || item.picName === currentUser?.name)) ||
      (picFilter !== 'Me' && picFilter !== 'All' && item.picName.toLowerCase().includes(picFilter.toLowerCase()));

    return matchesSearch && matchesStatus && matchesType && matchesPic;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredItems.map((i) => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const picUser = tenantUsers.find((u) => u.id === newPicId) || currentUser;

    const newCustomerObj: Customer = {
      id: `CUS-${Date.now().toString().slice(-4)}`,
      tenantId,
      code: `CUS-${Math.floor(1000 + Math.random() * 9000)}`,
      name: newName,
      type: newType,
      industry: newIndustry,
      status: 'ACTIVE',
      phone: '+62 21 555 0000',
      email: newContactEmail,
      region: 'DKI Jakarta',
      address: 'Jl. Sudirman No. 45, Jakarta',
      assignedPicId: picUser?.id || 'USR-001',
      assignedPicName: picUser?.name || 'Ahmad',
      assignedPicAvatar: picUser?.avatarUrl,
      projectValue: 1000000000,
      createdAt: new Date().toISOString().split('T')[0],
      contacts: [
        {
          id: `CON-${Date.now()}`,
          customerId: `CUS-${Date.now().toString().slice(-4)}`,
          name: newContactName,
          position: 'Manager',
          email: newContactEmail,
          phone: '+62 811 000 111',
          isPrimary: true,
        },
      ],
      addresses: [],
    };

    DataService.saveCustomer(newCustomerObj);

    const newExtended: ExtendedCustomerItem = {
      id: newCustomerObj.id,
      code: newCustomerObj.code,
      name: newName,
      industry: newIndustry,
      avatarBg: 'bg-[#6161ff]',
      avatarText: newName.substring(0, 2).toUpperCase(),
      status: 'Active',
      contactPersonName: newContactName || 'Budi Santoso',
      contactPersonEmail: newContactEmail || 'contact@company.com',
      picName: picUser?.firstName || picUser?.name || 'Ahmad',
      picAvatar: picUser?.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
      lastVisit: 'Today',
      followUpDate: '15 Aug 2026',
      followUpStatus: 'scheduled',
      tasksCount: 1,
      oppsCount: 1,
      updatedAt: 'Today',
      type: newIndustry,
    };

    setItems([newExtended, ...items]);
    setShowAddModal(false);
    setNewName('');
    setNewContactName('');
    setNewContactEmail('');
  };

  const handleExport = () => {
    alert('Exporting customer data as CSV/Excel...');
  };

  const handleImport = () => {
    alert('Import customer file dialog opening...');
  };

  return (
    <div className="space-y-5 font-['Inter',sans-serif]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-[#767587] uppercase font-['Hanken_Grotesk']">
        <span>SALESFLOW PRO</span>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[#1a1c1c]">CUSTOMERS</span>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
            Customers
          </h1>
          <p className="text-xs text-[#767587] mt-0.5">
            Manage customer relationships and sales activities.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Export Button */}
          <button
            onClick={handleExport}
            className="px-3.5 py-1.5 bg-white border border-[#E1E1E1] hover:bg-[#f9f9f9] text-[#1a1c1c] text-xs font-semibold rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer font-['Hanken_Grotesk']"
          >
            <span className="material-symbols-outlined text-[16px] text-[#767587]">file_download</span>
            <span>Export</span>
          </button>

          {/* Import Button */}
          <button
            onClick={handleImport}
            className="px-3.5 py-1.5 bg-white border border-[#E1E1E1] hover:bg-[#f9f9f9] text-[#1a1c1c] text-xs font-semibold rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer font-['Hanken_Grotesk']"
          >
            <span className="material-symbols-outlined text-[16px] text-[#767587]">file_upload</span>
            <span>Import</span>
          </button>

          {/* + New Customer Button */}
          <button
            onClick={() => navigate('/customers/create')}
            className="px-4 py-1.5 bg-[#4744e5] hover:bg-[#2c24ce] text-white text-xs font-bold rounded-lg shadow-2xs transition-all flex items-center gap-1.5 font-['Hanken_Grotesk'] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>New Customer</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-[#E1E1E1] shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#767587] text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customers..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#E1E1E1] rounded-lg text-xs text-[#1a1c1c] placeholder-[#767587] focus:outline-none focus:border-[#4744e5]"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-[#E1E1E1] text-[#1a1c1c] text-xs font-medium rounded-lg pl-3 pr-8 py-1.5 shadow-2xs appearance-none cursor-pointer focus:outline-none focus:border-[#4744e5]"
            >
              <option value="All">Status: All</option>
              {customerStatuses.map(s => (
                <option key={s.id} value={s.code_value}>Status: {s.label}</option>
              ))}
            </select>
            <span className="material-symbols-outlined text-[16px] text-[#767587] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              expand_more
            </span>
          </div>

          {/* Type Filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white border border-[#E1E1E1] text-[#1a1c1c] text-xs font-medium rounded-lg pl-3 pr-8 py-1.5 shadow-2xs appearance-none cursor-pointer focus:outline-none focus:border-[#4744e5]"
            >
              <option value="Any">Type: Any</option>
              {customerTypes.map(t => (
                <option key={t.id} value={t.code_value}>Type: {t.label}</option>
              ))}
            </select>
            <span className="material-symbols-outlined text-[16px] text-[#767587] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              expand_more
            </span>
          </div>

          {/* PIC Filter */}
          <div className="relative">
            <select
              value={picFilter}
              onChange={(e) => setPicFilter(e.target.value)}
              className="bg-white border border-[#E1E1E1] text-[#1a1c1c] text-xs font-medium rounded-lg pl-3 pr-8 py-1.5 shadow-2xs appearance-none cursor-pointer focus:outline-none focus:border-[#4744e5]"
            >
              <option value="Me">PIC: Me</option>
              <option value="All">PIC: All</option>
              <option value="Ahmad">PIC: Ahmad</option>
              <option value="Rina">PIC: Rina</option>
              <option value="Unassigned">PIC: Unassigned</option>
            </select>
            <span className="material-symbols-outlined text-[16px] text-[#767587] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              expand_more
            </span>
          </div>
        </div>

        {/* Right Side: Advanced Filters */}
        <button
          onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
          className="px-3 py-1.5 bg-white border border-[#E1E1E1] hover:bg-[#f9f9f9] text-[#1a1c1c] text-xs font-medium rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px] text-[#767587]">tune</span>
          <span>Advanced Filters</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-2xs overflow-hidden">
        {/* Table Subheader / Tab */}
        <div className="px-5 py-3.5 border-b border-[#E1E1E1] bg-white flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
            All Customers ({totalCount})
          </h2>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1a1c1c]">
            <thead className="bg-[#f9f9f9] text-[#767587] font-bold uppercase tracking-wider text-[10px] border-b border-[#E1E1E1] font-['Hanken_Grotesk']">
              <tr>
                <th className="px-4 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={
                      filteredItems.length > 0 && selectedIds.length === filteredItems.length
                    }
                    className="rounded border-[#E1E1E1] text-[#4744e5] focus:ring-[#4744e5]"
                  />
                </th>
                <th className="px-4 py-3.5">CUSTOMER</th>
                <th className="px-4 py-3.5">STATUS</th>
                <th className="px-4 py-3.5">CONTACT PERSON</th>
                <th className="px-4 py-3.5">PIC</th>
                <th className="px-4 py-3.5">LAST VISIT</th>
                <th className="px-4 py-3.5">FOLLOW-UP</th>
                <th className="px-4 py-3.5 text-center">TASKS</th>
                <th className="px-4 py-3.5 text-center">OPPS</th>
                <th className="px-4 py-3.5">UPDATED</th>
                <th className="px-4 py-3.5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E1E1]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-xs text-[#767587]">
                    No customers found matching search filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-[#f9f9f9] transition-colors ${
                        isSelected ? 'bg-[#f4f4ff]' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(item.id)}
                          className="rounded border-[#E1E1E1] text-[#4744e5] focus:ring-[#4744e5]"
                        />
                      </td>

                      {/* Customer Info */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-md ${item.avatarBg} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs font-['Hanken_Grotesk']`}
                          >
                            {item.avatarText}
                          </div>
                          <div>
                            <Link
                              to={`/customers/${item.id}`}
                              className="font-bold text-xs text-[#1a1c1c] hover:text-[#4744e5] font-['Hanken_Grotesk'] block"
                            >
                              {item.name}
                            </Link>
                            <div className="text-[11px] text-[#767587]">{item.industry}</div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        {item.status === 'Active' && (
                          <span className="px-2.5 py-0.5 bg-[#e6f9f0] text-[#00A35C] text-[11px] font-semibold rounded-full inline-block">
                            Active
                          </span>
                        )}
                        {item.status === 'Pending' && (
                          <span className="px-2.5 py-0.5 bg-[#fffbeb] text-[#d97706] text-[11px] font-semibold rounded-full inline-block">
                            Pending
                          </span>
                        )}
                        {item.status === 'Inactive' && (
                          <span className="px-2.5 py-0.5 bg-[#f3f4f6] text-[#6b7280] text-[11px] font-semibold rounded-full inline-block">
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Contact Person */}
                      <td className="px-4 py-4">
                        <div className="font-medium text-xs text-[#1a1c1c]">
                          {item.contactPersonName}
                        </div>
                        <div className="text-[11px] text-[#767587]">
                          {item.contactPersonEmail}
                        </div>
                      </td>

                      {/* PIC */}
                      <td className="px-4 py-4">
                        {item.picIsUnassigned ? (
                          <div className="flex items-center gap-2 text-[#767587]">
                            <div className="w-6 h-6 rounded-full bg-[#e2e8f0] text-[#767587] font-bold text-[10px] flex items-center justify-center shrink-0">
                              UN
                            </div>
                            <span className="italic text-xs">Unassigned</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <img
                              src={
                                item.picAvatar ||
                                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                              }
                              alt={item.picName}
                              className="w-6 h-6 rounded-full object-cover border border-[#E1E1E1]"
                            />
                            <span className="font-medium text-xs text-[#1a1c1c]">
                              {item.picName}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Last Visit */}
                      <td className="px-4 py-4 text-xs text-[#1a1c1c]">
                        {item.lastVisit}
                      </td>

                      {/* Follow-up */}
                      <td className="px-4 py-4">
                        {item.followUpStatus === 'scheduled' && (
                          <div className="flex items-center gap-1.5 text-[#6161ff] font-medium text-xs">
                            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                            <span>{item.followUpDate}</span>
                          </div>
                        )}
                        {item.followUpStatus === 'overdue' && (
                          <div className="flex items-center gap-1.5 text-[#d92d20] font-bold text-xs">
                            <span className="material-symbols-outlined text-[16px]">warning</span>
                            <span>Overdue</span>
                          </div>
                        )}
                        {item.followUpStatus === 'none' && (
                          <span className="text-xs text-[#767587]">-</span>
                        )}
                      </td>

                      {/* Tasks Count */}
                      <td className="px-4 py-4 text-center">
                        {typeof item.tasksCount === 'number' ? (
                          <span className="w-6 h-6 rounded-full bg-[#f1f5f9] text-[#475569] font-semibold text-xs inline-flex items-center justify-center">
                            {item.tasksCount}
                          </span>
                        ) : (
                          <span className="text-xs text-[#767587]">-</span>
                        )}
                      </td>

                      {/* Opps Count */}
                      <td className="px-4 py-4 text-center">
                        {typeof item.oppsCount === 'number' ? (
                          <span className="w-6 h-6 rounded-full bg-[#f1f5f9] text-[#6161ff] font-semibold text-xs inline-flex items-center justify-center">
                            {item.oppsCount}
                          </span>
                        ) : (
                          <span className="text-xs text-[#767587]">-</span>
                        )}
                      </td>

                      {/* Updated */}
                      <td className="px-4 py-4 text-xs text-[#767587]">
                        {item.updatedAt}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/customers/${item.id}/edit`)}
                            title="Edit Customer"
                            className="p-1.5 text-[#767587] hover:text-[#4744e5] hover:bg-[#f4f4ff] rounded-lg transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(item)}
                            title="Delete Customer"
                            className="p-1.5 text-[#767587] hover:text-[#d92d20] hover:bg-[#ffe4e4] rounded-lg transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="p-4 bg-white border-t border-[#E1E1E1] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#767587]">
          <div>Showing 1-10 of {totalCount}</div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 flex items-center justify-center text-[#767587] hover:bg-[#f3f3f3] rounded disabled:opacity-30 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>

            <button
              onClick={() => setCurrentPage(1)}
              className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center cursor-pointer ${
                currentPage === 1 ? 'bg-[#4744e5] text-white shadow-2xs' : 'text-[#1a1c1c] hover:bg-[#f3f3f3]'
              }`}
            >
              1
            </button>

            <button
              onClick={() => setCurrentPage(2)}
              className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center cursor-pointer ${
                currentPage === 2 ? 'bg-[#4744e5] text-white shadow-2xs' : 'text-[#1a1c1c] hover:bg-[#f3f3f3]'
              }`}
            >
              2
            </button>

            <button
              onClick={() => setCurrentPage(3)}
              className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center cursor-pointer ${
                currentPage === 3 ? 'bg-[#4744e5] text-white shadow-2xs' : 'text-[#1a1c1c] hover:bg-[#f3f3f3]'
              }`}
            >
              3
            </button>

            <span className="px-1 text-[#767587]">...</span>

            <button
              onClick={() => setCurrentPage(25)}
              className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center cursor-pointer ${
                currentPage === 25 ? 'bg-[#4744e5] text-white shadow-2xs' : 'text-[#1a1c1c] hover:bg-[#f3f3f3]'
              }`}
            >
              25
            </button>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, 25))}
              className="w-8 h-8 flex items-center justify-center text-[#767587] hover:bg-[#f3f3f3] rounded cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* CREATE NEW CUSTOMER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-[#E1E1E1] shadow-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#E1E1E1] pb-3">
              <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Add New Customer Account
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#767587] hover:text-[#1a1c1c]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  Company / Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. PT Maju Jaya"
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs focus:outline-none focus:border-[#4744e5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                    Industry / Category
                  </label>
                  <input
                    type="text"
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                    placeholder="e.g. Manufacturing"
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs focus:outline-none focus:border-[#4744e5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                    Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as CustomerType)}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs bg-white focus:outline-none focus:border-[#4744e5]"
                  >
                    <option value="COMPANY">Company / SMB</option>
                    <option value="ENTERPRISE">Enterprise</option>
                    <option value="GOVERNMENT">Government</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="Budi Santoso"
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs focus:outline-none focus:border-[#4744e5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    placeholder="budi@majujaya.co.id"
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs focus:outline-none focus:border-[#4744e5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  Assigned PIC
                </label>
                <select
                  value={newPicId}
                  onChange={(e) => setNewPicId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs bg-white font-semibold focus:outline-none focus:border-[#4744e5]"
                >
                  {tenantUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.roleName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-[#E1E1E1] text-[#1a1c1c] rounded text-xs font-semibold hover:bg-[#f3f3f3]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4744e5] text-white rounded text-xs font-bold hover:bg-[#2c24ce]"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditModal && editingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-[#E1E1E1]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E1E1E1] mb-4">
              <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Edit Customer Details
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCustomer(null);
                }}
                className="text-[#767587] hover:text-[#1a1c1c] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  Company / Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs focus:outline-none focus:border-[#4744e5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                    Industry / Category
                  </label>
                  <input
                    type="text"
                    value={editIndustry}
                    onChange={(e) => setEditIndustry(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs focus:outline-none focus:border-[#4744e5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'Active' | 'Pending' | 'Inactive')}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs bg-white focus:outline-none focus:border-[#4744e5]"
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    value={editContactName}
                    onChange={(e) => setEditContactName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs focus:outline-none focus:border-[#4744e5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={editContactEmail}
                    onChange={(e) => setEditContactEmail(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs focus:outline-none focus:border-[#4744e5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  Assigned PIC
                </label>
                <select
                  value={editPicName}
                  onChange={(e) => setEditPicName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E1E1E1] rounded text-xs bg-white font-semibold focus:outline-none focus:border-[#4744e5]"
                >
                  <option value="Unassigned">Unassigned</option>
                  {tenantUsers.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name} ({u.roleName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E1E1]">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCustomer(null);
                  }}
                  className="px-4 py-2 border border-[#E1E1E1] text-[#1a1c1c] rounded text-xs font-semibold hover:bg-[#f3f3f3] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4744e5] text-white rounded text-xs font-bold hover:bg-[#2c24ce] cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Popup */}
      {showDeleteModal && customerToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E1E1E1]">
            <div className="flex flex-col items-center text-center">
              {/* Warning Icon Badge */}
              <div className="w-14 h-14 rounded-full bg-[#fee2e2] text-[#dc2626] flex items-center justify-center mb-4 shadow-2xs">
                <span className="material-symbols-outlined text-[30px]">warning</span>
              </div>

              <h2 className="text-base font-bold text-[#1a1c1c] mb-2 font-['Hanken_Grotesk']">
                Hapus Data Customer?
              </h2>

              <p className="text-xs text-[#767587] leading-relaxed mb-6">
                Apakah Anda yakin ingin menghapus customer <strong className="text-[#1a1c1c] font-semibold">{customerToDelete.name}</strong>? 
                Tindakan ini tidak dapat dibatalkan dan semua data histori terkait customer ini akan terhapus.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setCustomerToDelete(null);
                  }}
                  className="flex-1 px-4 py-2.5 border border-[#E1E1E1] text-[#1a1c1c] rounded-xl text-xs font-semibold hover:bg-[#f3f3f3] transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2.5 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  <span>Hapus Customer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

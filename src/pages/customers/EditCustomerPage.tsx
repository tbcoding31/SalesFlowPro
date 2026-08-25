import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { masterDataApi } from '../../services/masterDataApi';
import { Customer, CustomerType, CustomerStatus, User, MasterDataItem } from '../../types';
import { usersApi } from '../../services/usersApi';

export const EditCustomerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant, currentUser } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';

  const [tenantUsers, setTenantUsers] = useState<User[]>([]);
  const tasks = DataService.getTasks(tenantId);

  const [customer, setCustomer] = useState<Customer | undefined>(() => {
    return DataService.getCustomerById(id || 'CUS-001');
  });

  // Form States
  const [companyName, setCompanyName] = useState('');
  const [customerType, setCustomerType] = useState('');
  const [customerStatus, setCustomerStatus] = useState('');

  const [masterTypes, setMasterTypes] = useState<MasterDataItem[]>([]);
  const [masterStatuses, setMasterStatuses] = useState<MasterDataItem[]>([]);

  useEffect(() => {
    usersApi.fetchUsers(tenantId).then(setTenantUsers);
    masterDataApi.fetchMasterData('customer_types', tenantId).then(setMasterTypes);
    masterDataApi.fetchMasterData('customer_statuses', tenantId).then(setMasterStatuses);
  }, [tenantId]);

  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [assignedPicId, setAssignedPicId] = useState('');
  const [customerSource, setCustomerSource] = useState('Referral');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (customer) {
      setCompanyName(customer.name || '');
      setCustomerType(customer.type || '');
      setCustomerStatus(customer.status || '');

      const primaryContact = customer.contacts?.[0];
      setContactPerson(primaryContact?.name || 'Budi Santoso');
      setPhone(customer.phone || primaryContact?.phone || '+62 812 3456 7890');
      setEmail(customer.email || primaryContact?.email || 'budi.s@majujaya.co.id');

      setStreetAddress(customer.address || 'Jl. Sudirman Kav 21');
      setCity(customer.city || 'Jakarta Selatan');
      setProvince(customer.province || 'DKI Jakarta');
      setPostalCode(customer.postalCode || '12190');

      setAssignedPicId(customer.assignedPicId || currentUser?.id || 'USR-001');
      setCustomerSource(customer.customerSource || 'Referral');
      setNotes(customer.notes || 'Key supplier for heavy machinery parts in the Java region.');
    } else {
      // Fallback data matching PT Maju Jaya screenshot if ID not found directly
      setCompanyName('PT Maju Jaya');
      setCustomerType('');
      setCustomerStatus('');
      setContactPerson('Budi Santoso');
      setPhone('+62 812 3456 7890');
      setEmail('budi.s@majujaya.co.id');
      setStreetAddress('Jl. Sudirman Kav 21');
      setCity('Jakarta Selatan');
      setProvince('DKI Jakarta');
      setPostalCode('12190');
      setAssignedPicId('USR-001');
      setCustomerSource('Referral');
      setNotes('Key supplier for heavy machinery parts in the Java region.');
    }
  }, [customer, currentUser]);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const selectedUser = tenantUsers.find((u) => u.id === assignedPicId) || currentUser;

    const updatedCustomer: Customer = {
      ...(customer || {
        id: id || 'CUS-001',
        tenantId,
        code: 'CUS-0001',
        projectValue: 1000000000,
        createdAt: '2026-01-10',
      }),
      id: id || customer?.id || 'CUS-001',
      tenantId,
      code: customer?.code || 'CUS-0001',
      name: companyName,
      type: customerType || 'TYPE_ENTERPRISE',
      industry: masterTypes.find(t => t.code_value === customerType)?.label || 'Other',
      status: customerStatus || 'ST_PROSPECT',
      phone: phone,
      email: email,
      address: streetAddress,
      city: city,
      province: province,
      postalCode: postalCode,
      region: province || 'DKI Jakarta',
      assignedPicId: selectedUser?.id || 'USR-001',
      assignedPicName: selectedUser?.name || 'Ahmad',
      assignedPicAvatar: selectedUser?.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
      customerSource: customerSource,
      notes: notes,
      updatedAt: '15 Aug 2026',
      createdByName: customer?.createdByName || 'Admin User',
      createdAt: customer?.createdAt || '10 Jan 2026',
      contacts: [
        {
          id: customer?.contacts?.[0]?.id || `CON-${Date.now()}`,
          customerId: customer?.id || 'CUS-001',
          name: contactPerson,
          position: 'Primary Contact',
          email: email,
          phone: phone,
          isPrimary: true,
        },
      ],
    };

    DataService.saveCustomer(updatedCustomer);
    navigate(`/customers/${updatedCustomer.id}`);
  };

  const selectedPicUser = tenantUsers.find((u) => u.id === assignedPicId) || currentUser;
  const picTasksCount = tasks.filter((t) => t.picId === assignedPicId && t.status !== 'COMPLETED').length || 8;

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-6 font-['Inter',sans-serif]">
      {/* Top Breadcrumb Header */}
      <div className="border-b border-[#E1E1E1] pb-4">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-[#767587] uppercase font-['Hanken_Grotesk'] mb-1">
          <Link to="/customers" className="hover:text-[#4744e5]">Customers</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link to={`/customers/${id || 'CUS-001'}`} className="hover:text-[#4744e5]">{companyName || 'PT Maju Jaya'}</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-[#1a1c1c]">Edit</span>
        </div>
        <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
          Edit Customer: {companyName || 'PT Maju Jaya'}
        </h1>
      </div>

      {/* 2-Column Grid Layout matching Image 2 */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Basic Information */}
          <div className="bg-white rounded-xl border border-[#E1E1E1] p-6 shadow-2xs space-y-5">
            <div className="flex items-center gap-2 border-b border-[#E1E1E1] pb-3">
              <span className="material-symbols-outlined text-[20px] text-[#767587]">domain</span>
              <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Basic Information
              </h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] font-semibold focus:outline-none focus:border-[#4744e5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                    Customer Type
                  </label>
                  <div className="relative">
                    <select
                      value={customerType}
                      onChange={(e) => setCustomerType(e.target.value)}
                      className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] font-medium appearance-none focus:outline-none focus:border-[#4744e5] cursor-pointer"
                    >
                      <option value="">Select Type</option>
                      {masterTypes.map(t => (
                        <option key={t.id} value={t.code_value}>{t.label}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined text-[18px] text-[#767587] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  Customer Status
                </label>
                  <div className="relative">
                    <select
                      value={customerStatus}
                      onChange={(e) => setCustomerStatus(e.target.value)}
                      className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] font-medium appearance-none focus:outline-none focus:border-[#4744e5] cursor-pointer"
                    >
                      {masterStatuses.map(s => (
                        <option key={s.id} value={s.code_value}>{s.label}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined text-[18px] text-[#767587] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      expand_more
                    </span>
                  </div>
              </div>
            </div>
          </div>

          {/* 2. Contact Information */}
          <div className="bg-white rounded-xl border border-[#E1E1E1] p-6 shadow-2xs space-y-5">
            <div className="flex items-center gap-2 border-b border-[#E1E1E1] pb-3">
              <span className="material-symbols-outlined text-[20px] text-[#767587]">badge</span>
              <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Contact Information
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  Contact Person <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] font-medium focus:outline-none focus:border-[#4744e5]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Address Details */}
          <div className="bg-white rounded-xl border border-[#E1E1E1] p-6 shadow-2xs space-y-5">
            <div className="flex items-center gap-2 border-b border-[#E1E1E1] pb-3">
              <span className="material-symbols-outlined text-[20px] text-[#767587]">location_on</span>
              <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Address Details
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                    Province
                  </label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
                  />
                </div>
              </div>

              <div className="max-w-xs">
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Sidebar 1/3 width) */}
        <div className="space-y-6">
          {/* Sales Information */}
          <div className="bg-white rounded-xl border border-[#E1E1E1] p-6 shadow-2xs space-y-5">
            <div className="flex items-center gap-2 border-b border-[#E1E1E1] pb-3">
              <span className="material-symbols-outlined text-[20px] text-[#767587]">trending_up</span>
              <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                Sales Information
              </h2>
            </div>

            <div className="space-y-4">
              {/* Assigned PIC Dropdown */}
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  Assigned PIC
                </label>
                <div className="relative">
                  <select
                    value={assignedPicId}
                    onChange={(e) => setAssignedPicId(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-xl text-xs bg-white text-[#1a1c1c] font-medium appearance-none focus:outline-none focus:border-[#4744e5] cursor-pointer"
                  >
                    {tenantUsers.map((u) => {
                      const tCnt = tasks.filter((t) => t.picId === u.id && t.status !== 'COMPLETED').length || 8;
                      return (
                        <option key={u.id} value={u.id}>
                          {u.name} — {u.position || u.roleName} ({tCnt} Active Tasks)
                        </option>
                      );
                    })}
                  </select>
                  <span className="material-symbols-outlined text-[18px] text-[#767587] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    expand_more
                  </span>
                </div>

                {/* Rich PIC Box matching Image 2 */}
                {selectedPicUser && (
                  <div className="mt-2.5 p-3 bg-slate-50 border border-[#E1E1E1] rounded-xl flex items-center gap-3">
                    <img
                      src={
                        selectedPicUser.avatarUrl ||
                        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                      }
                      alt={selectedPicUser.name}
                      className="w-9 h-9 rounded-full object-cover border border-slate-200"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-xs text-[#1a1c1c]">
                        {selectedPicUser.name}
                      </div>
                      <div className="text-[11px] text-[#767587]">
                        {selectedPicUser.position || 'Senior Rep'} • {picTasksCount} Active Tasks
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Customer Source */}
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  Customer Source
                </label>
                <div className="relative">
                  <select
                    value={customerSource}
                    onChange={(e) => setCustomerSource(e.target.value)}
                    className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] font-medium appearance-none focus:outline-none focus:border-[#4744e5] cursor-pointer"
                  >
                    <option value="Referral">Referral</option>
                    <option value="Inbound Web">Inbound Web</option>
                    <option value="Exhibition">Exhibition</option>
                    <option value="Cold Call">Cold Call</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Partner">Partner</option>
                  </select>
                  <span className="material-symbols-outlined text-[18px] text-[#767587] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    expand_more
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  Notes
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5] transition-all resize-none leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* SYSTEM AUDIT Card */}
          <div className="bg-[#f8fafc] rounded-xl border border-[#E1E1E1] p-5 space-y-3">
            <h3 className="text-[11px] font-extrabold text-[#767587] uppercase font-['Hanken_Grotesk'] tracking-wider">
              SYSTEM AUDIT
            </h3>
            <div className="space-y-2 text-xs divide-y divide-[#E1E1E1]/60">
              <div className="flex items-center justify-between pt-1">
                <span className="text-[#767587] font-medium">Created:</span>
                <span className="font-bold text-[#1a1c1c] text-right">
                  {customer?.createdByName || 'Admin User'}<br />
                  <span className="text-[11px] font-normal text-[#767587]">
                    {customer?.createdAt || '10 Jan 2026'}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-[#767587] font-medium">Last Updated:</span>
                <span className="font-bold text-[#1a1c1c] text-right">
                  {customer?.assignedPicName || 'Ahmad'}<br />
                  <span className="text-[11px] font-normal text-[#767587]">
                    {customer?.updatedAt || '15 Aug 2026'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Footer */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E1E1E1] p-4 shadow-lg z-30 flex items-center justify-end gap-3 px-8">
          <button
            type="button"
            onClick={() => navigate('/customers')}
            className="px-5 py-2 border border-[#E1E1E1] text-[#1a1c1c] rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-[#4744e5] hover:bg-[#3b38d4] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

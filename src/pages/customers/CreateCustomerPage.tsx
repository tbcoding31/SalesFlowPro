import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DataService } from '../../services/dataService';
import { masterDataApi } from '../../services/masterDataApi';
import { Customer, CustomerType, CustomerStatus, User, MasterDataItem } from '../../types';
import { usersApi } from '../../services/usersApi';

export const CreateCustomerPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentTenant, currentUser } = useAuth();
  const tenantId = currentTenant?.id || 'TEN-00001';

  const [tenantUsers, setTenantUsers] = useState<User[]>([]);
  const tasks = DataService.getTasks(tenantId);

  // Form Fields
  const [companyName, setCompanyName] = useState('');
  const [customerType, setCustomerType] = useState<string>('');
  const [customerStatus, setCustomerStatus] = useState<string>('');

  const [masterTypes, setMasterTypes] = React.useState<MasterDataItem[]>([]);
  const [masterStatuses, setMasterStatuses] = React.useState<MasterDataItem[]>([]);

  React.useEffect(() => {
    usersApi.fetchUsers(tenantId, true).then(users => {
      setTenantUsers(users);
      if (users.length > 0) {
        setAssignedPicId(prev => prev || users[0].id);
      }
    });

    masterDataApi.fetchMasterData('customer_types', tenantId).then(data => {
      setMasterTypes(data);
      const def = data.find(d => d.isDefault);
      if (def) setCustomerType(def.codeValue);
      else if (data.length > 0) setCustomerType(data[0].codeValue);
    });
    masterDataApi.fetchMasterData('customer_statuses', tenantId).then(data => {
      setMasterStatuses(data);
      const def = data.find(d => d.isDefault);
      if (def) setCustomerStatus(def.codeValue);
      else if (data.length > 0) setCustomerStatus(data[0].codeValue);
    });
  }, [tenantId]);

  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);

  const [streetAddress, setStreetAddress] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [assignedPicId, setAssignedPicId] = useState<string>(currentUser?.id || '');
  const [customerSource, setCustomerSource] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Email Validation Helper
  const isValidEmail = (val: string) => {
    if (!val) return true; // optional until touched/submitted or if valid format
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const isEmailError = emailTouched && email.length > 0 && !isValidEmail(email);

  // Helper for PIC task workload calculation
  const getPicWorkload = (userId: string) => {
    const user = tenantUsers.find((u) => u.id === userId);
    const picTasks = tasks.filter((t) => t.picId === userId && t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    const taskCount = picTasks.length || user?.activeTasksCount || 8;
    const isHighWorkload = taskCount >= 10;
    return {
      user,
      taskCount,
      isHighWorkload,
    };
  };

  const selectedPicWorkload = getPicWorkload(assignedPicId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidEmail(email)) {
      setEmailTouched(true);
      return;
    }

    const selectedUser = tenantUsers.find((u) => u.id === assignedPicId) || currentUser;

    const newCustomer: Customer = {
      id: `CUS-${Date.now().toString().slice(-4)}`,
      tenantId,
      code: `CUS-${Math.floor(1000 + Math.random() * 9000)}`,
      name: companyName,
      type: customerType || 'TYPE_ENTERPRISE',
      industry: masterTypes.find(t => t.code_value === customerType)?.label || 'Other',
      status: customerStatus || 'ST_PROSPECT',
      phone: phone || '+62 21 555 0000',
      email: email,
      region: province || 'DKI Jakarta',
      address: streetAddress || 'Jl. Sudirman No. 45',
      city: city || 'Jakarta',
      province: province || 'DKI Jakarta',
      postalCode: postalCode || '12190',
      assignedPicId: selectedUser?.id || 'USR-001',
      assignedPicName: selectedUser?.name || 'Jane Doe',
      assignedPicAvatar: selectedUser?.avatarUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
      customerSource: customerSource || 'Referral',
      notes: notes,
      projectValue: 500000000,
      createdAt: new Date().toISOString().split('T')[0],
      createdByName: currentUser?.name || 'Supervisor',
      contacts: [
        {
          id: `CON-${Date.now()}`,
          customerId: `CUS-${Date.now().toString().slice(-4)}`,
          name: contactPerson,
          position: 'Primary Contact',
          email: email,
          phone: phone,
          isPrimary: true,
        },
      ],
      addresses: [
        {
          id: `ADDR-${Date.now()}`,
          customerId: `CUS-${Date.now().toString().slice(-4)}`,
          type: 'OFFICE',
          address: streetAddress,
          city: city,
          province: province,
          postalCode: postalCode,
          isPrimary: true,
        },
      ],
    };

    DataService.saveCustomer(newCustomer);
    navigate('/customers');
  };

  return (
    <div className="max-w-5xl mx-auto pb-24 space-y-6 font-['Inter',sans-serif]">
      {/* Top Breadcrumb & Page Header */}
      <div className="border-b border-[#E1E1E1] pb-4">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-[#767587] uppercase font-['Hanken_Grotesk'] mb-1">
          <Link to="/customers" className="hover:text-[#4744e5] transition-colors">CUSTOMERS</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-[#1a1c1c]">CREATE</span>
        </div>
        <h1 className="text-2xl font-extrabold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
          Create Customer
        </h1>
        <p className="text-xs text-[#767587]">
          Add a new organization to your CRM
        </p>
      </div>

      {/* Main Form Container */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Basic Information */}
        <div className="bg-white rounded-xl border border-[#E1E1E1] p-6 shadow-2xs space-y-5">
          <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] border-b border-[#E1E1E1] pb-3">
            Basic Information
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter full registered company name"
                className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  Customer Type
                </label>
                  <div className="relative">
                    <select
                      value={customerType}
                      onChange={(e) => setCustomerType(e.target.value)}
                      className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] appearance-none focus:outline-none focus:border-[#4744e5] cursor-pointer"
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

              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  Customer Status
                </label>
                <div className="relative">
                  <select
                    value={customerStatus}
                    onChange={(e) => setCustomerStatus(e.target.value)}
                    className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] appearance-none focus:outline-none focus:border-[#4744e5] cursor-pointer"
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
        </div>

        {/* 2. Contact Information */}
        <div className="bg-white rounded-xl border border-[#E1E1E1] p-6 shadow-2xs space-y-5">
          <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] border-b border-[#E1E1E1] pb-3">
            Contact Information
          </h2>

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
                placeholder="Full name of primary contact"
                className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#767587]">
                    call
                  </span>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full pl-9 pr-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white focus:outline-none focus:border-[#4744e5] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span
                    className={`material-symbols-outlined absolute left-3 top-2.5 text-[18px] ${
                      isEmailError ? 'text-red-500' : 'text-[#767587]'
                    }`}
                  >
                    mail
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (!emailTouched) setEmailTouched(true);
                    }}
                    onBlur={() => setEmailTouched(true)}
                    placeholder="name@company.com"
                    className={`w-full pl-9 pr-3.5 py-2 rounded-lg text-xs bg-white transition-all focus:outline-none ${
                      isEmailError
                        ? 'border-2 border-red-500 text-red-600 bg-red-50/20'
                        : 'border border-[#E1E1E1] focus:border-[#4744e5]'
                    }`}
                  />
                </div>
                {isEmailError && (
                  <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1">
                    <span>ⓘ</span> Email address is invalid
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Address */}
        <div className="bg-white rounded-xl border border-[#E1E1E1] p-6 shadow-2xs space-y-5">
          <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] border-b border-[#E1E1E1] pb-3">
            Address
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                Address
              </label>
              <input
                type="text"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="Street address"
                className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white focus:outline-none focus:border-[#4744e5] transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  Province / State
                </label>
                <div className="relative">
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] appearance-none focus:outline-none focus:border-[#4744e5] cursor-pointer"
                  >
                    <option value="">Select Province</option>
                    <option value="DKI Jakarta">DKI Jakarta</option>
                    <option value="Jawa Barat">Jawa Barat</option>
                    <option value="Jawa Tengah">Jawa Tengah</option>
                    <option value="Jawa Timur">Jawa Timur</option>
                    <option value="Banten">Banten</option>
                    <option value="Bali">Bali</option>
                    <option value="Sumatera Utara">Sumatera Utara</option>
                  </select>
                  <span className="material-symbols-outlined text-[18px] text-[#767587] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    expand_more
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white focus:outline-none focus:border-[#4744e5] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                Postal Code
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="Postal Code"
                className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white focus:outline-none focus:border-[#4744e5] transition-all"
              />
            </div>
          </div>
        </div>

        {/* 4. Sales Information */}
        <div className="bg-white rounded-xl border border-[#E1E1E1] p-6 shadow-2xs space-y-5">
          <h2 className="text-sm font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] border-b border-[#E1E1E1] pb-3">
            Sales Information
          </h2>

          <div className="space-y-4">
            {/* Rich Person in Charge (PIC) Selector */}
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] mb-1">
                Person in Charge (PIC)
              </label>
              <div className="relative">
                <select
                  value={assignedPicId}
                  onChange={(e) => setAssignedPicId(e.target.value)}
                  className="w-full px-3.5 py-3 border border-[#E1E1E1] rounded-xl text-xs bg-white appearance-none focus:outline-none focus:border-[#4744e5] cursor-pointer"
                >
                  {tenantUsers.map((u) => {
                    const picTasks = tasks.filter((t) => t.picId === u.id && t.status !== 'COMPLETED');
                    const cnt = picTasks.length || u.activeTasksCount || 8;
                    const wl = cnt >= 10 ? 'High Workload' : 'Normal Workload';
                    return (
                      <option key={u.id} value={u.id}>
                        {u.name} — {u.position || u.roleName} ({cnt} Active Tasks - {wl})
                      </option>
                    );
                  })}
                </select>
                <span className="material-symbols-outlined text-[20px] text-[#767587] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  expand_more
                </span>
              </div>

              {/* Selected PIC Preview Card matching Image 1 */}
              {selectedPicWorkload.user && (
                <div className="mt-2.5 p-3 bg-slate-50 border border-[#E1E1E1] rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        selectedPicWorkload.user.avatarUrl ||
                        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                      }
                      alt={selectedPicWorkload.user.name}
                      className="w-9 h-9 rounded-full object-cover border border-slate-200"
                    />
                    <div>
                      <div className="font-bold text-xs text-[#1a1c1c]">
                        {selectedPicWorkload.user.name}
                      </div>
                      <div className="text-[11px] text-[#767587]">
                        {selectedPicWorkload.user.position || selectedPicWorkload.user.roleName || 'Senior Account Executive'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="text-right">
                      <span className="text-[10px] text-[#767587] block uppercase font-bold">Active Tasks</span>
                      <span className="font-bold text-[#1a1c1c] font-mono">{selectedPicWorkload.taskCount}</span>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase border ${
                        selectedPicWorkload.isHighWorkload
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {selectedPicWorkload.isHighWorkload ? 'High Workload' : 'Normal Workload'}
                    </span>
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
                  className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] appearance-none focus:outline-none focus:border-[#4744e5] cursor-pointer"
                >
                  <option value="">Select Source</option>
                  <option value="Referral">Referral</option>
                  <option value="Inbound Web">Inbound Web</option>
                  <option value="Exhibition">Exhibition</option>
                  <option value="Cold Call">Cold Call</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Partner">Partner</option>
                  <option value="Direct Outreach">Direct Outreach</option>
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
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about the customer..."
                className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white focus:outline-none focus:border-[#4744e5] transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* Bottom Fixed Action Footer */}
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
            Create Customer
          </button>
        </div>
      </form>
    </div>
  );
};

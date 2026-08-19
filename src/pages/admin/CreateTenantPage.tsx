import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { DataService } from '../../services/dataService';
import { Tenant, User, TenantType } from '../../types';

export const CreateTenantPage: React.FC = () => {
  const navigate = useNavigate();

  // Section 1: Tenant Info
  const [tenantName, setTenantName] = useState('');
  const [tenantCode, setTenantCode] = useState(`TEN-${Math.floor(10000 + Math.random() * 90000)}`);
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [industry, setIndustry] = useState('Manufacturing & Distribution');
  const [region, setRegion] = useState('DKI Jakarta');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TenantType>('Trial 3 Bulan');
  const [simulateTrialExpired, setSimulateTrialExpired] = useState(false);

  // Section 2: Primary Admin Account
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('InitialPass123!');
  const [adminPhone, setAdminPhone] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      const adminId = `USR-${Date.now().toString().slice(-4)}`;
      const newAdmin: User = {
        id: adminId,
        tenantId: tenantCode,
        firstName: adminFirstName,
        lastName: adminLastName,
        name: `${adminFirstName} ${adminLastName}`,
        email: adminEmail,
        username: adminEmail.split('@')[0],
        phone: adminPhone,
        avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80`,
        role: 'TENANT_ADMIN',
        roleName: 'Tenant Administrator',
        department: 'Executive',
        position: 'VP of Operations',
        status: 'ACTIVE',
        createdAt: new Date().toISOString().split('T')[0],
      };

      const todayDate = new Date();
      const trialEndDateObj = new Date(todayDate);
      trialEndDateObj.setMonth(trialEndDateObj.getMonth() + 3);
      const trialEndDateStr = trialEndDateObj.toISOString().split('T')[0];

      const newTenant: Tenant = {
        id: tenantCode,
        code: tenantCode,
        name: tenantName,
        email: tenantEmail,
        phone: tenantPhone,
        industry,
        region,
        address,
        description,
        type,
        status: 'ACTIVE',
        trialEndDate: type === 'Trial 3 Bulan' ? (simulateTrialExpired ? '2026-08-01' : trialEndDateStr) : undefined,
        isTrialExpired: type === 'Trial 3 Bulan' ? simulateTrialExpired : false,
        primaryAdminId: adminId,
        primaryAdminName: newAdmin.name,
        primaryAdminEmail: newAdmin.email,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        lastActivityAt: 'Just now',
        userCount: 1,
        activeUserCount: 1,
      };

      DataService.saveUser(newAdmin);
      DataService.saveTenant(newTenant);

      setIsLoading(false);
      navigate(`/admin/tenants/${newTenant.id}`);
    }, 600);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-['Inter',sans-serif]">
      {/* Back Link */}
      <div>
        <Link to="/admin/tenants" className="text-xs text-[#767587] hover:text-[#1a1c1c] flex items-center gap-1 font-medium">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Tenants List</span>
        </Link>
      </div>

      {/* Page Title */}
      <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm">
        <h1 className="text-2xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
          Provision New Enterprise Tenant Organization
        </h1>
        <p className="text-xs text-[#464555] mt-1">
          Configure organization identity, regional data routing, and provision initial primary administrator account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: TENANT INFORMATION */}
        <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E1E1E1] pb-3">
            <span className="w-6 h-6 rounded bg-[#4744e5] text-white font-bold text-xs flex items-center justify-center">
              1
            </span>
            <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
              Organization Details
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Organization Name *
              </label>
              <input
                type="text"
                required
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="e.g. PT Mitra Sejahtera Tbk"
                className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Tenant Identification Code *
              </label>
              <input
                type="text"
                required
                value={tenantCode}
                onChange={(e) => setTenantCode(e.target.value)}
                className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs font-mono bg-[#f9f9f9] text-[#1a1c1c]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Official Email *
              </label>
              <input
                type="email"
                required
                value={tenantEmail}
                onChange={(e) => setTenantEmail(e.target.value)}
                placeholder="contact@mitrasejahtera.co.id"
                className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Phone Number *
              </label>
              <input
                type="text"
                required
                value={tenantPhone}
                onChange={(e) => setTenantPhone(e.target.value)}
                placeholder="+62 21 555 1234"
                className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Industry Sector
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
              >
                <option value="Manufacturing & Distribution">Manufacturing & Distribution</option>
                <option value="Technology & Services">Technology & Services</option>
                <option value="Consumer Goods & FMCG">Consumer Goods & FMCG</option>
                <option value="Logistics & Supply Chain">Logistics & Supply Chain</option>
                <option value="Financial Services">Financial Services</option>
                <option value="Healthcare & Pharma">Healthcare & Pharma</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Subscription Tier Plan *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TenantType)}
                className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] font-bold focus:outline-none focus:border-[#4744e5]"
              >
                <option value="Trial 3 Bulan">Trial 3 Bulan (Masa Percobaan 90 Hari)</option>
                <option value="Enterprise">Enterprise (Unlimited Seats, Dedicated DB)</option>
                <option value="Professional">Professional (Up to 100 Seats)</option>
                <option value="Starter">Starter (Up to 25 Seats)</option>
              </select>

              {type === 'Trial 3 Bulan' && (
                <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <div className="flex items-start gap-2 text-xs text-amber-900 font-medium">
                    <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0 mt-0.5">timer</span>
                    <div>
                      <span className="font-bold block">Ketentuan Trial 3 Bulan:</span>
                      Organisasi diberikan masa percobaan 90 hari. Setelah masa trial habis, Client yang membuka aplikasi akan langsung melihat popup notifikasi bahwa trial telah habis dan dipaksa untuk logout.
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-1 border-t border-amber-200/60 cursor-pointer text-xs font-semibold text-amber-950">
                    <input
                      type="checkbox"
                      checked={simulateTrialExpired}
                      onChange={(e) => setSimulateTrialExpired(e.target.checked)}
                      className="rounded border-amber-400 text-[#4744e5] focus:ring-[#4744e5]"
                    />
                    <span>Simulasi Masa Trial Langsung Habis (Untuk Testing Prompt)</span>
                  </label>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Operating Region
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Headquarters Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Jl. Jend. Sudirman No. 10..."
                className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Organization Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter organization overview, business scope, or notes..."
                className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: PRIMARY ADMIN ACCOUNT */}
        <div className="bg-white p-6 rounded-xl border border-[#E1E1E1] shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E1E1E1] pb-3">
            <span className="w-6 h-6 rounded bg-[#4744e5] text-white font-bold text-xs flex items-center justify-center">
              2
            </span>
            <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
              Initial Primary Administrator Account
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={adminFirstName}
                onChange={(e) => setAdminFirstName(e.target.value)}
                placeholder="e.g. Hendra"
                className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={adminLastName}
                onChange={(e) => setAdminLastName(e.target.value)}
                placeholder="e.g. Pratama"
                className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Administrator Email Address *
              </label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="hendra@mitrasejahtera.co.id"
                className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Temporary Initial Password *
              </label>
              <input
                type="text"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs font-mono focus:outline-none focus:border-[#4744e5]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Direct Contact Phone
              </label>
              <input
                type="text"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="+62 812 3456 7890"
                className="w-full px-3 py-2 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5]"
              />
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex justify-end gap-3 pt-2">
          <Link
            to="/admin/tenants"
            className="px-5 py-2.5 bg-white border border-[#E1E1E1] text-[#1a1c1c] rounded-lg text-xs font-bold hover:bg-[#f3f3f3]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2.5 bg-[#4744e5] text-white rounded-lg text-xs font-bold hover:bg-[#2c24ce] shadow-sm transition-colors flex items-center gap-2"
          >
            {isLoading ? 'Provisioning Tenant...' : 'Provision Tenant & Generate Keys'}
          </button>
        </div>
      </form>
    </div>
  );
};

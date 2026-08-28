import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Tenant, User, UserRole, UserStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../services/usersApi';

export const CreateTenantUserPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentTenant: authTenant, currentUser } = useAuth();

  const [roleOptions, setRoleOptions] = useState<{id: string, name: string, scope: string}[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const paramTenantId = searchParams.get('tenantId');
  const [selectedTenantId, setSelectedTenantId] = useState<string>(paramTenantId || authTenant?.id || 'TEN-00001');

  useEffect(() => {
    fetch('/api/roles/assignable', {
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('sfp_auth_token') || '') }
    }).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setRoleOptions(data);
    }).catch(e => console.error(e));

    fetch('/api/tenants', {
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('sfp_auth_token') || '') }
    }).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setTenants(data);
    }).catch(e => console.error(e));
  }, []);

  const activeTenant = tenants.find((t) => t.id === selectedTenantId) || authTenant || {
    id: selectedTenantId,
    code: selectedTenantId,
    name: 'Selected Tenant',
    email: 'contact@tenant.co.id',
  };

  const [teamsList, setTeamsList] = useState<{id: string, name: string}[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  useEffect(() => {
    fetch(`/api/teams?tenantId=${selectedTenantId}`, {
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('sfp_auth_token') || '') }
    }).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setTeamsList(data);
    }).catch(e => console.error(e));
  }, [selectedTenantId]);

  // Form State - User Information
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [isUsernameCustom, setIsUsernameCustom] = useState(false);
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('Sales');

  // Form State - Role & Status
  const [role, setRole] = useState<UserRole | ''>('');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');

  // Form State - Security & Access
  const [securityMethod, setSecurityMethod] = useState<'EMAIL' | 'TEMP_PASSWORD'>('EMAIL');
  
  // Auto-generate helper
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pass = 'SalesFlow#';
    for (let i = 0; i < 5; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const [tempPassword, setTempPassword] = useState<string>(generateRandomPassword());
  const [showPassword, setShowPassword] = useState<boolean>(true);
  const [requirePassChange, setRequirePassChange] = useState<boolean>(true);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Form validation & Feedback
  const [errorMsg, setErrorMsg] = useState('');
  const [successModal, setSuccessModal] = useState<User | null>(null);

  // Auto handle username suggestion when email or names change (if not manually edited)
  useEffect(() => {
    if (!isUsernameCustom) {
      if (email.includes('@')) {
        setUsername(email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, ''));
      } else if (firstName || lastName) {
        setUsername(`${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9_.]/g, ''));
      }
    }
  }, [email, firstName, lastName, isUsernameCustom]);

  const handleRegeneratePassword = () => {
    const newPass = generateRandomPassword();
    setTempPassword(newPass);
    setIsCopied(false);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!firstName.trim()) {
      setErrorMsg('First Name is required.');
      return;
    }
    if (!lastName.trim()) {
      setErrorMsg('Last Name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('A valid Email Address is required.');
      return;
    }
    if (!username.trim()) {
      setErrorMsg('Username is required.');
      return;
    }
    if (!role) {
      setErrorMsg('Please select a System Role for the user.');
      return;
    }
    if (securityMethod === 'TEMP_PASSWORD' && !tempPassword.trim()) {
      setErrorMsg('Temporary Password cannot be empty.');
      return;
    }

    const roleNameMap: Record<string, string> = roleOptions.reduce((acc: any, r) => {
      acc[r.id] = r.name;
      return acc;
    }, {});

    const selectedTeamObj = teamsList.find(t => t.id === selectedTeamId);

    const payload: any = {
      tenantId: activeTenant.id,
      email: email.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      roleId: role,
      password: tempPassword,
      teamId: selectedTeamId || undefined
    };

    setIsSubmitting(true);
    usersApi.saveUser(payload as any, true).then((res) => {
      setIsSubmitting(false);
      if (res.success) {
        const createdUser: User = {
          id: (res as any).userId || `USR-${Date.now().toString().slice(-4)}`,
          tenantId: activeTenant.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          name: `${firstName.trim()} ${lastName.trim()}`,
          email: email.trim(),
          username: username.trim(),
          department: department,
          role: role as UserRole,
          roleName: roleNameMap[role as UserRole] || 'Tenant Member',
          position: position.trim() || 'Staff',
          teamId: selectedTeamId || undefined,
          teamName: selectedTeamObj?.name || undefined,
          status: 'ACTIVE',
          createdAt: new Date().toISOString().split('T')[0],
        };

        if (securityMethod === 'TEMP_PASSWORD') {
          setSuccessModal(createdUser);
        } else {
          navigate('/admin/tenant-users');
        }
      } else {
        if (res.code === 'USER_ALREADY_MEMBER') {
          setErrorMsg('This user already belongs to this organization.');
        } else if (res.code === 'USER_SUSPENDED') {
          setErrorMsg('This user identity is suspended at platform level and cannot be added.');
        } else {
          setErrorMsg(res.error || 'Failed to create user account. Please try again.');
        }
      }
    }).catch(err => {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'An unexpected network error occurred.');
    });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="space-y-6 font-['Inter',sans-serif] pb-12 max-w-[1200px] mx-auto">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          {/* Breadcrumb navigation */}
          <nav className="flex items-center gap-1.5 text-xs text-[#767587] font-medium mb-1">
            <span className="text-[#767587]">Administration</span>
            <span>&rsaquo;</span>
            {currentUser?.role === 'SUPER_ADMIN' && (
              <>
                <Link to="/admin/tenants" className="hover:text-[#4744e5] transition-colors">
                  Tenants
                </Link>
                <span>&rsaquo;</span>
                <Link to={`/admin/tenants/${activeTenant.id}`} className="hover:text-[#4744e5] transition-colors">
                  {activeTenant.name}
                </Link>
                <span>&rsaquo;</span>
              </>
            )}
            <Link to="/admin/tenant-users" className="hover:text-[#4744e5] transition-colors">
              Users
            </Link>
            <span>&rsaquo;</span>
            <span className="text-[#1a1c1c] font-semibold">New User</span>
          </nav>

          <h1 className="text-2xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] tracking-tight">
            Create Tenant User
          </h1>
          <p className="text-xs text-[#464555] mt-0.5">
            Add a new member to <strong className="text-[#1a1c1c]">{activeTenant.name}</strong>. This user will inherit tenant-specific permissions based on their assigned role.
          </p>
        </div>

        {/* Top Right Tenant Badge Card */}
        <div className="bg-white border border-[#E1E1E1] rounded-xl p-3 shadow-sm flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-lg bg-[#4744e5]/10 border border-[#4744e5]/20 flex items-center justify-center text-[#4744e5]">
            <span className="material-symbols-outlined text-[22px]">apartment</span>
          </div>
          <div>
            {currentUser?.role === 'SUPER_ADMIN' && tenants.length > 1 ? (
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="font-bold text-xs text-[#1a1c1c] bg-transparent border-b border-[#E1E1E1] pb-0.5 focus:outline-none focus:border-[#4744e5] cursor-pointer"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            ) : (
              <div className="font-bold text-xs text-[#1a1c1c] font-['Hanken_Grotesk']">
                {activeTenant.name}
              </div>
            )}
            <div className="text-[11px] font-mono text-[#767587] font-semibold">{activeTenant.code}</div>
          </div>
        </div>
      </div>

      {/* Main Form Box */}
      <form onSubmit={handleSubmit} className="bg-white border border-[#E1E1E1] rounded-2xl shadow-sm p-6 sm:p-8 space-y-8">
        {errorMsg && (
          <div className="p-3.5 bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 rounded-xl text-xs text-[#ba1a1a] font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* SECTION 1: USER INFORMATION */}
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">User Information</h2>
            <p className="text-xs text-[#767587]">Basic contact and identification details.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* First Name */}
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                First Name <span className="text-[#ba1a1a]">*</span>
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Jane"
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] text-[#1a1c1c] placeholder-[#9494a0]"
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Last Name <span className="text-[#ba1a1a]">*</span>
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Doe"
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] text-[#1a1c1c] placeholder-[#9494a0]"
              />
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Email Address <span className="text-[#ba1a1a]">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane.doe@example.com"
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] text-[#1a1c1c] placeholder-[#9494a0]"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Username <span className="text-[#ba1a1a]">*</span>
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setIsUsernameCustom(true);
                }}
                placeholder="janedoe"
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] text-[#1a1c1c] placeholder-[#9494a0]"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+62 812..."
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] text-[#1a1c1c] placeholder-[#9494a0]"
              />
            </div>

            {/* Position */}
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Position
              </label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g. Regional Sales Lead"
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] text-[#1a1c1c] placeholder-[#9494a0]"
              />
            </div>

            {/* Assigned Team (Optional) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Assigned Team (Optional)
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
              >
                <option value="">No Team (Individual / Unassigned)</option>
                {teamsList.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-[#767587] mt-1">
                Users with Team data scope will only have visibility over records assigned to members of this team.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 2: ROLE & STATUS */}
        <div className="border-t border-[#E1E1E1] pt-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Role & Status</h2>
            <p className="text-xs text-[#767587]">Determine the user's access level and current system status.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* System Role */}
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                System Role <span className="text-[#ba1a1a]">*</span>
              </label>
              <select
                required
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
              >
                <option value="" disabled>Select a role...</option>
                {roleOptions.length === 0 && <option value="" disabled>Loading roles...</option>}
                {roleOptions.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {/* Account Status */}
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Account Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs bg-white text-[#1a1c1c] focus:outline-none focus:border-[#4744e5]"
              >
                <option value="ACTIVE">Active</option>
                <option value="INVITED">Invited</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 3: SECURITY & ACCESS */}
        <div className="border-t border-[#E1E1E1] pt-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Security & Access</h2>
            <p className="text-xs text-[#767587]">Choose how this user will receive their initial login credentials.</p>
          </div>

          <div className="space-y-3">
            {/* Radio Option 1: Send Email Link */}
            <label
              className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                securityMethod === 'EMAIL'
                  ? 'border-2 border-[#4744e5] bg-[#4744e5]/[0.02] shadow-sm'
                  : 'border-[#E1E1E1] hover:border-[#b0b0b0] bg-white'
              }`}
            >
              <input
                type="radio"
                name="securityMethod"
                value="EMAIL"
                checked={securityMethod === 'EMAIL'}
                onChange={() => setSecurityMethod('EMAIL')}
                className="mt-1 text-[#4744e5] focus:ring-[#4744e5]"
              />
              <div>
                <div className="font-bold text-xs text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Send password setup email (Recommended)
                </div>
                <div className="text-xs text-[#767587] mt-0.5">
                  User will receive a secure link to set their own password.
                </div>
              </div>
            </label>

            {/* Radio Option 2: Generate Temporary Password */}
            <div
              className={`rounded-xl border transition-all ${
                securityMethod === 'TEMP_PASSWORD'
                  ? 'border-2 border-[#4744e5] bg-[#4744e5]/[0.02] shadow-sm p-4'
                  : 'border-[#E1E1E1] hover:border-[#b0b0b0] bg-white p-4'
              }`}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="securityMethod"
                  value="TEMP_PASSWORD"
                  checked={securityMethod === 'TEMP_PASSWORD'}
                  onChange={() => setSecurityMethod('TEMP_PASSWORD')}
                  className="mt-1 text-[#4744e5] focus:ring-[#4744e5]"
                />
                <div>
                  <div className="font-bold text-xs text-[#1a1c1c] font-['Hanken_Grotesk']">
                    Generate temporary password
                  </div>
                  <div className="text-xs text-[#767587] mt-0.5">
                    A temporary password will be generated and shown after creation.
                  </div>
                </div>
              </label>

              {/* DYNAMIC FIELD: Appears directly when "Generate temporary password" is selected */}
              {securityMethod === 'TEMP_PASSWORD' && (
                <div className="mt-4 pt-4 border-t border-[#4744e5]/20 pl-7 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                      Temporary Password <span className="text-[#ba1a1a]">*</span>
                    </label>
                    <span className="text-[11px] text-[#4744e5] font-medium">
                      (Password otomatis tergenerate & dapat Anda ubah secara bebas)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={tempPassword}
                        onChange={(e) => setTempPassword(e.target.value)}
                        placeholder="Masukkan temporary password custom..."
                        className="w-full pl-3.5 pr-10 py-2.5 border border-[#4744e5] rounded-lg text-xs font-mono font-bold bg-white text-[#1a1c1c] focus:outline-none focus:ring-2 focus:ring-[#4744e5]/30 shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#767587] hover:text-[#1a1c1c]"
                        title={showPassword ? 'Hide Password' : 'Show Password'}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>

                    {/* Regenerate Random Password Button */}
                    <button
                      type="button"
                      onClick={handleRegeneratePassword}
                      className="px-3 py-2.5 bg-white border border-[#E1E1E1] hover:border-[#4744e5] text-[#464555] hover:text-[#4744e5] rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                      title="Acak / Auto Generate Password Baru"
                    >
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                      <span className="hidden sm:inline">Generate Auto</span>
                    </button>

                    {/* Copy Password Button */}
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className={`px-3 py-2.5 border rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                        isCopied
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-[#4744e5]/10 border-[#4744e5]/30 text-[#4744e5] hover:bg-[#4744e5]/20'
                      }`}
                      title="Salin Password"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isCopied ? 'check' : 'content_copy'}
                      </span>
                      <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>

                  {/* Require password change checkbox */}
                  <label className="flex items-center gap-2 pt-1 cursor-pointer text-xs text-[#464555]">
                    <input
                      type="checkbox"
                      checked={requirePassChange}
                      onChange={(e) => setRequirePassChange(e.target.checked)}
                      className="rounded border-[#E1E1E1] text-[#4744e5] focus:ring-[#4744e5]"
                    />
                    <span>Require user to change password on first login</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="pt-6 border-t border-[#E1E1E1] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/tenant-users')}
            className="px-5 py-2.5 border border-[#E1E1E1] hover:bg-[#f3f3f3] text-[#1a1c1c] font-bold text-xs rounded-xl transition-all font-['Hanken_Grotesk']"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#4744e5] hover:bg-[#2c24ce] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 font-['Hanken_Grotesk'] active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Create User</span>
          </button>
        </div>
      </form>

      {/* SUCCESS MODAL FOR TEMPORARY PASSWORD */}
      {successModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-[#E1E1E1] shadow-2xl p-6 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                User Created Successfully!
              </h3>
              <p className="text-xs text-[#767587]">
                Account for <strong className="text-[#1a1c1c]">{successModal.name}</strong> has been provisioned.
              </p>
            </div>

            <div className="bg-[#f8f9fc] border border-[#E1E1E1] rounded-xl p-4 text-left text-xs space-y-2">
              <div className="flex justify-between border-b border-[#E1E1E1] pb-2">
                <span className="text-[#767587]">Username:</span>
                <span className="font-mono font-bold text-[#1a1c1c]">{successModal.username}</span>
              </div>
              <div className="flex justify-between border-b border-[#E1E1E1] pb-2">
                <span className="text-[#767587]">Email:</span>
                <span className="font-bold text-[#1a1c1c]">{successModal.email}</span>
              </div>
              <div className="flex justify-between border-b border-[#E1E1E1] pb-2">
                <span className="text-[#767587]">Assigned Role:</span>
                <span className="font-bold text-[#4744e5]">{successModal.roleName}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-[#767587] font-bold">Temporary Password:</span>
                <span className="font-mono font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded border border-amber-300 text-xs">
                  {tempPassword}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#767587] italic">
              Please share these credentials securely with the user.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleCopyPassword}
                className="flex-1 py-2.5 bg-white border border-[#E1E1E1] hover:border-[#4744e5] text-[#1a1c1c] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 font-['Hanken_Grotesk']"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span>{isCopied ? 'Copied!' : 'Copy Password'}</span>
              </button>
              <button
                onClick={() => navigate('/admin/tenant-users')}
                className="flex-1 py-2.5 bg-[#4744e5] hover:bg-[#2c24ce] text-white font-bold text-xs rounded-xl shadow-md transition-all font-['Hanken_Grotesk']"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

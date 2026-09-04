import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Tenant, User, UserRole, UserStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../services/usersApi';

export const CreateTenantUserPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentTenant: authTenant, currentUser } = useAuth();

  const paramTenantId = searchParams.get('tenantId');
  const [selectedTenantId] = useState<string | null>(paramTenantId);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);

  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  const [roleOptions, setRoleOptions] = useState<{id: string, name: string, scope: string}[]>([]);
  const [teamsList, setTeamsList] = useState<{id: string, name: string}[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  useEffect(() => {
    if (!selectedTenantId) {
      setContextError('Tenant context is required.');
      setIsLoadingContext(false);
      return;
    }

    const loadContext = async () => {
      try {
        const headers = { 'Authorization': 'Bearer ' + (localStorage.getItem('sfp_auth_token') || '') };
        
        // Load Tenant
        const tenantRes = await fetch(`/api/tenants/${selectedTenantId}`, { headers });
        if (tenantRes.status === 404) {
          setContextError('Tenant not found.');
          setIsLoadingContext(false);
          return;
        } else if (tenantRes.status === 403 || tenantRes.status === 401) {
          setContextError('Access denied.');
          setIsLoadingContext(false);
          return;
        } else if (!tenantRes.ok) {
          setContextError('Failed to load tenant context.');
          setIsLoadingContext(false);
          return;
        }
        const tenantData = await tenantRes.json();
        setActiveTenant(tenantData);

        // Load Roles
        const rolesRes = await fetch(`/api/roles/assignable?tenantId=${selectedTenantId}`, { headers });
        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          if (Array.isArray(rolesData)) setRoleOptions(rolesData);
        }

        // Load Teams
        const teamsRes = await fetch(`/api/teams?tenantId=${selectedTenantId}`, { headers });
        if (teamsRes.ok) {
          const teamsData = await teamsRes.json();
          if (Array.isArray(teamsData)) setTeamsList(teamsData);
        }

      } catch (err: any) {
        setContextError(err.message || 'Network error loading context.');
      } finally {
        setIsLoadingContext(false);
      }
    };

    loadContext();
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

    if (!activeTenant) return;

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

        setSuccessModal(createdUser);
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

  if (isLoadingContext) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="material-symbols-outlined animate-spin text-[#4744e5] text-4xl">autorenew</span>
      </div>
    );
  }

  if (contextError || !activeTenant) {
    return (
      <div className="bg-white p-8 rounded-xl border border-[#E1E1E1] text-center max-w-lg mx-auto my-12 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-2xl">error</span>
        </div>
        <h2 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Cannot Add User</h2>
        <p className="text-sm text-[#767587] mt-2 mb-6">{contextError}</p>
        <Link to="/admin/tenants" className="inline-block px-5 py-2.5 bg-[#4744e5] text-white text-sm font-bold rounded-lg hover:bg-[#2c24ce] transition-colors">
          Back to Tenants
        </Link>
      </div>
    );
  }

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

        {/* Top Right Tenant Badge Card (Locked) */}
        <div className="bg-gray-50 border border-[#E1E1E1] rounded-xl p-3 shadow-sm flex items-center gap-3 shrink-0 opacity-80 cursor-not-allowed">
          <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500">
            <span className="material-symbols-outlined text-[22px]">domain</span>
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-xs text-gray-700 font-['Hanken_Grotesk']">{activeTenant.name}</span>
              <span className="material-symbols-outlined text-[14px] text-gray-400">lock</span>
            </div>
            <div className="text-[11px] font-mono text-gray-500 font-semibold mt-0.5">Tenant ID: {activeTenant.id}</div>
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

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Email Address <span className="text-[#ba1a1a]">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane.doe@company.com"
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
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] text-[#1a1c1c] placeholder-[#9494a0] bg-[#F8F8F9]"
              />
              <p className="text-[10px] text-[#767587] mt-1">Used for login instead of email if preferred.</p>
            </div>
            
            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Phone Number <span className="text-[#9494a0] font-normal">(Optional)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] text-[#1a1c1c] placeholder-[#9494a0]"
              />
            </div>
          </div>
        </div>

        <div className="h-px bg-[#E1E1E1] w-full my-6"></div>

        {/* SECTION 2: ACCESS & ROLE */}
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Access & Role</h2>
            <p className="text-xs text-[#767587]">Define system privileges and organizational placement.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Role */}
            <div className="col-span-1 sm:col-span-2 md:col-span-1">
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                System Role <span className="text-[#ba1a1a]">*</span>
              </label>
              <div className="relative">
                <select
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] text-[#1a1c1c] appearance-none cursor-pointer bg-white"
                >
                  <option value="" disabled>Select a role...</option>
                  {roleOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-[#767587]">
                  <span className="material-symbols-outlined text-[18px]">expand_more</span>
                </div>
              </div>
              <p className="text-[10px] text-[#767587] mt-1">
                Determines permissions and features this user can access within {activeTenant.name}.
              </p>
            </div>
            
            {/* Team Assignment */}
            <div className="col-span-1 sm:col-span-2 md:col-span-1">
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Team Assignment <span className="text-[#9494a0] font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] text-[#1a1c1c] appearance-none cursor-pointer bg-white disabled:bg-gray-50"
                  disabled={teamsList.length === 0}
                >
                  <option value="">No team assignment</option>
                  {teamsList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-[#767587]">
                  <span className="material-symbols-outlined text-[18px]">expand_more</span>
                </div>
              </div>
              {teamsList.length === 0 && (
                <p className="text-[10px] text-amber-600 mt-1">No teams found for this tenant.</p>
              )}
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Sales"
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] text-[#1a1c1c] placeholder-[#9494a0]"
              />
            </div>

            {/* Job Title / Position */}
            <div>
              <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1">
                Job Title
              </label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g. Account Executive"
                className="w-full px-3.5 py-2.5 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] text-[#1a1c1c] placeholder-[#9494a0]"
              />
            </div>
          </div>
        </div>

        <div className="h-px bg-[#E1E1E1] w-full my-6"></div>

        {/* SECTION 3: CREDENTIALS */}
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">Credentials & Security</h2>
            <p className="text-xs text-[#767587]">How the user will log in to SalesFlow Pro.</p>
          </div>

          <div className="p-4 rounded-xl border border-[#E1E1E1] bg-[#F8F8F9] space-y-4">
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="securityMethod"
                  value="EMAIL"
                  checked={securityMethod === 'EMAIL'}
                  onChange={() => setSecurityMethod('EMAIL')}
                  className="w-4 h-4 text-[#4744e5] border-[#E1E1E1] focus:ring-[#4744e5]"
                />
                <span className="text-xs font-semibold text-[#1a1c1c]">Email Setup Link</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="securityMethod"
                  value="TEMP_PASSWORD"
                  checked={securityMethod === 'TEMP_PASSWORD'}
                  onChange={() => setSecurityMethod('TEMP_PASSWORD')}
                  className="w-4 h-4 text-[#4744e5] border-[#E1E1E1] focus:ring-[#4744e5]"
                />
                <span className="text-xs font-semibold text-[#1a1c1c]">Temporary Password</span>
              </label>
            </div>

            {securityMethod === 'EMAIL' ? (
              <div className="text-xs text-[#767587] pl-6 border-l-2 border-[#4744e5]/30">
                An invitation email will be sent to <strong>{email || 'the provided address'}</strong> with a secure link to complete their profile and set a password. The link expires in 48 hours.
              </div>
            ) : (
              <div className="space-y-3 pl-6 border-l-2 border-[#4744e5]">
                <div>
                  <label className="block text-[11px] font-bold text-[#1a1c1c] uppercase tracking-wider mb-1">
                    Temporary Password
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1 max-w-[280px]">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={tempPassword}
                        readOnly
                        className="w-full px-3.5 py-2 border border-[#E1E1E1] rounded-lg text-sm font-mono text-[#1a1c1c] bg-white pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#767587] hover:text-[#1a1c1c]"
                        tabIndex={-1}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleRegeneratePassword}
                      className="px-3 py-2 bg-white border border-[#E1E1E1] rounded-lg text-xs font-semibold text-[#464555] hover:bg-gray-50 flex items-center gap-1 transition-colors"
                      title="Generate new password"
                    >
                      <span className="material-symbols-outlined text-[16px]">autorenew</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className={`px-3 py-2 border rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                        isCopied 
                          ? 'bg-[#10b981]/10 border-[#10b981]/20 text-[#10b981]' 
                          : 'bg-white border-[#E1E1E1] text-[#464555] hover:bg-gray-50'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isCopied ? 'check' : 'content_copy'}
                      </span>
                      {isCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={requirePassChange}
                    onChange={(e) => setRequirePassChange(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-[#E1E1E1] text-[#4744e5] focus:ring-[#4744e5]"
                  />
                  <span className="text-xs text-[#464555]">Require password change on first login</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="pt-6 border-t border-[#E1E1E1] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 border border-[#E1E1E1] rounded-lg text-[#464555] text-xs font-bold hover:bg-[#F8F8F9] transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-[#4744e5] text-white rounded-lg text-xs font-bold hover:bg-[#2c24ce] transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">autorenew</span>
                Creating User...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Create User
              </>
            )}
          </button>
        </div>
      </form>

      {/* Success Modal */}
      {successModal && (
        <div className="fixed inset-0 bg-[#1a1c1c]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-[#10b981]/10 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl text-[#10b981]">check_circle</span>
              </div>
              <h3 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-2">
                User Created Successfully
              </h3>
              <p className="text-sm text-[#767587] mb-6">
                <strong>{successModal.name}</strong> has been added to {activeTenant.name} as a {successModal.roleName}.
              </p>
              
              {securityMethod === 'TEMP_PASSWORD' && (
                <div className="bg-[#F8F8F9] p-4 rounded-xl border border-[#E1E1E1] text-left mb-6">
                  <p className="text-xs font-semibold text-[#1a1c1c] mb-2 uppercase tracking-wider">Login Credentials</p>
                  <div className="flex justify-between items-center py-1.5 border-b border-[#E1E1E1]">
                    <span className="text-xs text-[#767587]">Email:</span>
                    <span className="text-xs font-mono font-medium text-[#1a1c1c]">{successModal.email}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-xs text-[#767587]">Password:</span>
                    <span className="text-xs font-mono font-medium text-[#1a1c1c]">{tempPassword}</span>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => navigate(`/admin/tenant-users`)}
                  className="w-full py-2.5 bg-[#4744e5] text-white rounded-lg text-sm font-bold hover:bg-[#2c24ce] transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

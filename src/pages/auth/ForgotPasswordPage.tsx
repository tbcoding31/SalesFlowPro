import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('alex@company.com');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'forgot' | 'reset' | 'success' | 'expired'>('forgot');
  const [isLoading, setIsLoading] = useState(false);

  // Password rules validation
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const validCount = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;

  const handleSendReset = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setActiveTab('success');
    }, 1000);
  };

  const handleSetNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setActiveTab('success');
    }, 1000);
  };

  return (
    <div className="bg-[#f9f9f9] min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-['Inter',sans-serif]">
      <div className="sm:mx-auto sm:w-full sm:max-w-[450px]">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="SalesFlow Logo" className="w-14 h-14 object-contain rounded-xl mx-auto shadow-sm" />
          <h1 className="font-extrabold text-2xl text-[#4744e5] font-['Hanken_Grotesk'] mt-3">
            SalesFlow Pro
          </h1>
          <p className="text-xs text-[#464555] mt-1">Enterprise CRM Password Recovery</p>

          {/* Interactive State Selector */}
          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => setActiveTab('forgot')}
              className={`px-2.5 py-1 text-[11px] rounded border transition-colors ${
                activeTab === 'forgot' ? 'bg-[#4744e5] text-white border-[#4744e5]' : 'bg-white text-[#464555] border-[#E1E1E1]'
              }`}
            >
              Forgot Password
            </button>
            <button
              onClick={() => setActiveTab('reset')}
              className={`px-2.5 py-1 text-[11px] rounded border transition-colors ${
                activeTab === 'reset' ? 'bg-[#4744e5] text-white border-[#4744e5]' : 'bg-white text-[#464555] border-[#E1E1E1]'
              }`}
            >
              Set New Password
            </button>
            <button
              onClick={() => setActiveTab('success')}
              className={`px-2.5 py-1 text-[11px] rounded border transition-colors ${
                activeTab === 'success' ? 'bg-[#00C875] text-white border-[#00C875]' : 'bg-white text-[#464555] border-[#E1E1E1]'
              }`}
            >
              Success
            </button>
            <button
              onClick={() => setActiveTab('expired')}
              className={`px-2.5 py-1 text-[11px] rounded border transition-colors ${
                activeTab === 'expired' ? 'bg-[#ba1a1a] text-white border-[#ba1a1a]' : 'bg-white text-[#464555] border-[#E1E1E1]'
              }`}
            >
              Expired Link
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="bg-white py-8 px-6 border border-[#E1E1E1] rounded-xl shadow-sm sm:px-10">
          {/* TAB 1: FORGOT PASSWORD REQUEST */}
          {activeTab === 'forgot' && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Forgot Password?
                </h2>
                <p className="text-xs text-[#464555] mt-1">
                  Enter your email address and we'll send you instructions to reset your password.
                </p>
              </div>

              <form onSubmit={handleSendReset} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1.5" htmlFor="email">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#767587] text-[18px]">
                      mail
                    </span>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      required
                      className="w-full pl-9 pr-3 py-2 h-10 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 bg-[#4744e5] hover:bg-[#2c24ce] text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? 'Sending Link...' : 'Send Reset Link'}
                </button>

                <div className="text-center pt-2">
                  <Link to="/login" className="text-xs text-[#767587] hover:text-[#1a1c1c] flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    Back to Sign In
                  </Link>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: SET NEW PASSWORD FORM */}
          {activeTab === 'reset' && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Set New Password
                </h2>
                <p className="text-xs text-[#464555] mt-1">
                  Create a new password for your SalesFlow Pro account.
                </p>
              </div>

              <form onSubmit={handleSetNewPassword} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#767587] text-[18px]">
                      lock
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                      className="w-full pl-9 pr-10 py-2 h-10 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#767587]"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Password Requirement Rules */}
                <div className="bg-[#f3f3f3] p-3.5 rounded-lg border border-[#E1E1E1]/60 text-xs space-y-2">
                  <p className="text-[10px] font-bold text-[#464555] uppercase tracking-wider mb-2">
                    Password must contain:
                  </p>
                  <ul className="space-y-1.5">
                    <li className={`flex items-center gap-2 ${hasMinLength ? 'text-[#00C875] font-semibold' : 'text-[#767587]'}`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {hasMinLength ? 'check_circle' : 'cancel'}
                      </span>
                      <span>At least 8 characters</span>
                    </li>
                    <li className={`flex items-center gap-2 ${hasUppercase ? 'text-[#00C875] font-semibold' : 'text-[#767587]'}`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {hasUppercase ? 'check_circle' : 'cancel'}
                      </span>
                      <span>One uppercase letter</span>
                    </li>
                    <li className={`flex items-center gap-2 ${hasLowercase ? 'text-[#00C875] font-semibold' : 'text-[#767587]'}`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {hasLowercase ? 'check_circle' : 'cancel'}
                      </span>
                      <span>One lowercase letter</span>
                    </li>
                    <li className={`flex items-center gap-2 ${hasNumber ? 'text-[#00C875] font-semibold' : 'text-[#767587]'}`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {hasNumber ? 'check_circle' : 'cancel'}
                      </span>
                      <span>One number</span>
                    </li>
                    <li className={`flex items-center gap-2 ${hasSpecial ? 'text-[#00C875] font-semibold' : 'text-[#767587]'}`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {hasSpecial ? 'check_circle' : 'cancel'}
                      </span>
                      <span>One special character</span>
                    </li>
                  </ul>
                </div>

                {/* Password Strength Progress Bar */}
                <div>
                  <div className="flex justify-between items-center mb-1 text-[11px]">
                    <span className="font-bold text-[#464555] uppercase">Password Strength</span>
                    <span className={`font-bold ${validCount >= 4 ? 'text-[#00C875]' : validCount >= 2 ? 'text-[#FFCB00]' : 'text-[#767587]'}`}>
                      {validCount >= 4 ? 'Strong' : validCount >= 2 ? 'Medium' : 'Weak'}
                    </span>
                  </div>
                  <div className="w-full bg-[#e2e2e2] rounded-full h-1.5 flex gap-1">
                    <div className={`h-1.5 rounded-full w-1/3 ${validCount >= 2 ? 'bg-[#00C875]' : 'bg-[#767587]'}`} />
                    <div className={`h-1.5 rounded-full w-1/3 ${validCount >= 4 ? 'bg-[#00C875]' : 'bg-[#e2e2e2]'}`} />
                    <div className={`h-1.5 rounded-full w-1/3 ${validCount >= 5 ? 'bg-[#00C875]' : 'bg-[#e2e2e2]'}`} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    className="w-full pl-3 pr-3 py-2 h-10 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5]"
                  />
                  {confirmPassword && confirmPassword === password && (
                    <p className="text-[11px] text-[#00C875] font-semibold mt-1">Passwords match</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full h-10 bg-[#4744e5] hover:bg-[#2c24ce] text-white font-bold text-xs rounded-lg shadow-sm transition-colors"
                >
                  Set New Password
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: SUCCESS CONFIRMATION */}
          {activeTab === 'success' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-[#00C875]/10 text-[#00C875] flex items-center justify-center mx-auto mb-4 border border-[#00C875]/20">
                <span className="material-symbols-outlined text-3xl">mark_email_read</span>
              </div>
              <h2 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-2">
                Check your inbox
              </h2>
              <p className="text-xs text-[#464555] mb-6 leading-relaxed">
                Password reset instructions have been sent to <br />
                <strong className="text-[#1a1c1c] font-semibold">{email}</strong>.
              </p>

              <Link
                to="/login"
                className="w-full h-10 bg-[#4744e5] hover:bg-[#2c24ce] text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center mb-3"
              >
                Return to Login
              </Link>

              <p className="text-xs text-[#767587]">
                Didn't receive the email?{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('forgot')}
                  className="text-[#4744e5] font-bold hover:underline"
                >
                  Click to resend
                </button>
              </p>
            </div>
          )}

          {/* TAB 4: EXPIRED LINK STATE */}
          {activeTab === 'expired' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-[#FF3D57]/10 text-[#FF3D57] flex items-center justify-center mx-auto mb-4 border border-[#FF3D57]/20">
                <span className="material-symbols-outlined text-3xl">error</span>
              </div>
              <h2 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-2">
                Reset Link Invalid or Expired
              </h2>
              <p className="text-xs text-[#464555] mb-6 leading-relaxed">
                This password reset link is no longer valid. Please request a new one.
              </p>

              <button
                type="button"
                onClick={() => setActiveTab('forgot')}
                className="w-full h-10 bg-[#4744e5] hover:bg-[#2c24ce] text-white font-bold text-xs rounded-lg shadow-sm transition-colors mb-3"
              >
                Request New Reset Link
              </button>

              <Link to="/login" className="text-xs text-[#767587] hover:underline">
                Back to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

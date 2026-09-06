import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [isLoading, setIsLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [policy, setPolicy] = useState<PasswordPolicy>({
    minLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  });

  useEffect(() => {
    if (!token.trim()) {
      setIsLoading(false);
      setIsValid(false);
      return;
    }

    // Validate token against backend
    fetch(`/api/auth/password-reset/validate?token=${encodeURIComponent(token.trim())}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.valid) {
          setIsValid(true);
          if (data.passwordPolicy) {
            setPolicy(data.passwordPolicy);
          }
        } else {
          setIsValid(false);
        }
      })
      .catch(() => {
        setIsValid(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  // Validation rules
  const hasMinLength = password.length >= (policy.minLength || 8);
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const checks = [
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial
  ];
  const validCount = checks.filter(Boolean).length;

  const isFormValid =
    hasMinLength &&
    (!policy.requireUppercase || hasUppercase) &&
    (!policy.requireNumbers || hasNumber) &&
    (!policy.requireSpecialChars || hasSpecial) &&
    password === confirmPassword &&
    password.length > 0;

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!isFormValid) {
      setErrorMessage('Please ensure all password policy requirements are met.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          newPassword: password,
          confirmPassword: confirmPassword
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === 'RESET_TOKEN_EXPIRED' || data.code === 'RESET_TOKEN_USED' || data.code === 'RESET_TOKEN_REVOKED' || data.code === 'RESET_TOKEN_INVALID') {
          setIsValid(false);
          return;
        }
        setErrorMessage(data.message || data.error || 'Failed to reset password. Please try again.');
        return;
      }

      setIsSuccess(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err: any) {
      setErrorMessage('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
        </div>

        {/* Card Body */}
        <div className="bg-white py-8 px-6 border border-[#E1E1E1] rounded-xl shadow-sm sm:px-10">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 border-4 border-[#4744e5]/20 border-t-[#4744e5] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-xs text-[#464555] font-medium">Validating reset link...</p>
            </div>
          ) : isSuccess ? (
            /* SUCCESS STATE */
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-[#00C875]/10 text-[#00C875] flex items-center justify-center mx-auto mb-4 border border-[#00C875]/20">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <h2 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-2">
                Password Updated Successfully
              </h2>
              <p className="text-xs text-[#464555] mb-6 leading-relaxed">
                Your password has been changed successfully. You can now log in with your new credentials.
              </p>

              <Link
                to="/login"
                className="w-full h-10 bg-[#4744e5] hover:bg-[#2c24ce] text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center mb-3"
              >
                Return to Login
              </Link>
            </div>
          ) : !isValid ? (
            /* EXPIRED / INVALID STATE */
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

              <Link
                to="/forgot-password"
                className="w-full h-10 bg-[#4744e5] hover:bg-[#2c24ce] text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center mb-3"
              >
                Request New Reset Link
              </Link>

              <Link to="/login" className="text-xs text-[#767587] hover:underline">
                Back to Sign In
              </Link>
            </div>
          ) : (
            /* SET NEW PASSWORD FORM */
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Set New Password
                </h2>
                <p className="text-xs text-[#464555] mt-1">
                  Create a new password for your SalesFlow Pro account.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 rounded-lg text-xs bg-red-50 text-red-700 border border-red-200">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-5">
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#767587] hover:text-[#1a1c1c] cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Password Policy Checklist */}
                <div className="bg-[#f3f3f3] p-3.5 rounded-lg border border-[#E1E1E1]/60 text-xs space-y-2">
                  <p className="text-[10px] font-bold text-[#464555] uppercase tracking-wider mb-2">
                    Password must contain:
                  </p>
                  <ul className="space-y-1.5">
                    <li className={`flex items-center gap-2 ${hasMinLength ? 'text-[#00C875] font-semibold' : 'text-[#767587]'}`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {hasMinLength ? 'check_circle' : 'cancel'}
                      </span>
                      <span>At least {policy.minLength || 8} characters</span>
                    </li>
                    {policy.requireUppercase && (
                      <li className={`flex items-center gap-2 ${hasUppercase ? 'text-[#00C875] font-semibold' : 'text-[#767587]'}`}>
                        <span className="material-symbols-outlined text-[16px]">
                          {hasUppercase ? 'check_circle' : 'cancel'}
                        </span>
                        <span>One uppercase letter</span>
                      </li>
                    )}
                    <li className={`flex items-center gap-2 ${hasLowercase ? 'text-[#00C875] font-semibold' : 'text-[#767587]'}`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {hasLowercase ? 'check_circle' : 'cancel'}
                      </span>
                      <span>One lowercase letter</span>
                    </li>
                    {policy.requireNumbers && (
                      <li className={`flex items-center gap-2 ${hasNumber ? 'text-[#00C875] font-semibold' : 'text-[#767587]'}`}>
                        <span className="material-symbols-outlined text-[16px]">
                          {hasNumber ? 'check_circle' : 'cancel'}
                        </span>
                        <span>One number</span>
                      </li>
                    )}
                    {policy.requireSpecialChars && (
                      <li className={`flex items-center gap-2 ${hasSpecial ? 'text-[#00C875] font-semibold' : 'text-[#767587]'}`}>
                        <span className="material-symbols-outlined text-[16px]">
                          {hasSpecial ? 'check_circle' : 'cancel'}
                        </span>
                        <span>One special character (!@#$%^&*)</span>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Password Strength Indicator */}
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
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#767587] text-[18px]">
                      lock
                    </span>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      required
                      className="w-full pl-9 pr-10 py-2 h-10 border border-[#E1E1E1] rounded-lg text-xs focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#767587] hover:text-[#1a1c1c] cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showConfirmPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {confirmPassword && confirmPassword === password && (
                    <p className="text-[11px] text-[#00C875] font-semibold mt-1">Passwords match</p>
                  )}
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-[11px] text-red-500 font-semibold mt-1">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !isFormValid}
                  className="w-full h-10 bg-[#4744e5] hover:bg-[#2c24ce] disabled:bg-[#4744e5]/70 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Setting Password...' : 'Set New Password'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

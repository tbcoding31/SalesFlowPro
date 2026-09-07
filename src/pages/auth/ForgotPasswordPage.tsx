import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail })
      });

      const data = await res.json();
      if (!res.ok && res.status !== 200) {
        if (data.code === 'RATE_LIMITED' || data.code === 'PASSWORD_RESET_RATE_LIMITED') {
          if (data.retryAfterSeconds) {
            const minutes = Math.ceil(data.retryAfterSeconds / 60);
            setErrorMessage(`Too many reset requests. Please wait approximately ${minutes} minute${minutes > 1 ? 's' : ''} before trying again.`);
          } else {
            setErrorMessage(data.message || 'Too many password reset requests. Please try again later.');
          }
          return;
        }
        if (data.code === 'INVALID_EMAIL') {
          setErrorMessage(data.message || 'Please enter a valid email address.');
          return;
        }
        setErrorMessage(data.message || data.error || 'Unable to process request right now.');
        return;
      }

      setIsSubmitted(true);
    } catch (err: any) {
      setErrorMessage('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
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
          {!isSubmitted ? (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
                  Forgot Password?
                </h2>
                <p className="text-xs text-[#464555] mt-1">
                  Enter your email address and we'll send you instructions to reset your password.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 rounded-lg text-xs bg-red-50 text-red-700 border border-red-200">
                  {errorMessage}
                </div>
              )}

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
                  className="w-full h-10 bg-[#4744e5] hover:bg-[#2c24ce] disabled:bg-[#4744e5]/70 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
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
          ) : (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-[#00C875]/10 text-[#00C875] flex items-center justify-center mx-auto mb-4 border border-[#00C875]/20">
                <span className="material-symbols-outlined text-3xl">mark_email_read</span>
              </div>
              <h2 className="text-xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk'] mb-2">
                Check your inbox
              </h2>
              <p className="text-xs text-[#464555] mb-6 leading-relaxed">
                If an account exists for this email, password reset instructions have been sent.
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
                  onClick={() => {
                    setIsSubmitted(false);
                    setErrorMessage(null);
                  }}
                  className="text-[#4744e5] font-bold hover:underline cursor-pointer"
                >
                  Click to resend
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

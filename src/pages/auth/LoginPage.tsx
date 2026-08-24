import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [uiState, setUiState] = useState<'default' | 'error' | 'network-error' | 'loading'>('default');
  const [errorDetails, setErrorDetails] = useState<{ status?: number; message?: string; code?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUiState('loading');
    setErrorDetails(null);

    const result = await login(email, password);
    const isSuccess = typeof result === 'boolean' ? result : result.success;

    if (isSuccess) {
      setUiState('default');
      // Read user from localStorage to avoid stale state closure
      const savedUserStr = localStorage.getItem('sfp_currentUser');
      const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
      if (savedUser?.tenantId === 'SYSTEM') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } else {
      const loginRes = typeof result === 'object' ? result : null;
      if (loginRes?.status === 0 || loginRes?.code === 'NETWORK_ERROR') {
        setUiState('network-error');
        setErrorDetails({
          status: 0,
          message: loginRes.message || 'Unable to connect to the server. Please check your internet connection.',
          code: 'NETWORK_ERROR'
        });
      } else {
        setUiState('error');
        setErrorDetails({
          status: loginRes?.status || 401,
          message: loginRes?.message || 'Invalid credentials',
          code: loginRes?.code || 'INVALID_CREDENTIALS'
        });
      }
    }
  };

  const whatsappUrl = `https://wa.me/6285291082021?text=${encodeURIComponent('Hallo saya ingin menggunakan aplikasi Sales Flow Pro')}`;

  return (
    <div className="bg-[#f9f9f9] text-[#1a1c1c] min-h-screen w-full flex flex-col md:flex-row font-['Inter',sans-serif] overflow-x-hidden">
      {/* Left Side: Hero / Brand Area */}
      <div className="flex flex-col w-full md:w-[40%] lg:w-[45%] hero-pattern relative p-8 md:p-12 justify-center md:justify-between min-h-[320px] md:min-h-screen shrink-0 text-white">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        
        <div className="z-10 flex flex-col gap-4 items-center md:items-start text-center md:text-left">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="SalesFlow Logo" className="w-12 h-12 object-contain rounded shadow-sm" />
            <h1 className="text-white font-bold text-3xl font-['Hanken_Grotesk'] tracking-tight m-0">
              SalesFlow Pro
            </h1>
          </div>
          <p className="text-[#c1c1ff] text-base max-w-md mt-4 hidden md:block leading-relaxed">
            Enterprise CRM & Activity Management platform designed for high-performance sales teams driving operational visibility.
          </p>
        </div>

        {/* Testimonial Quote Card */}
        <div className="z-10 hidden md:block">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 text-white shadow-sm">
            <p className="text-sm italic mb-4 leading-relaxed font-['Hanken_Grotesk']">
              "The precision and clarity SalesFlow Pro brought to our pipeline management directly increased our quarterly closed-won rates by 24%."
            </p>
            <div className="flex items-center gap-3">
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                alt="Sarah Jenkins"
                className="w-10 h-10 rounded-full object-cover border border-white/30"
              />
              <div>
                <div className="text-xs font-bold font-['Hanken_Grotesk']">Sarah Jenkins</div>
                <div className="text-[11px] text-[#c1c1ff]">VP of Global Sales, TechCorp</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Login Form Area */}
      <div className="w-full md:w-[60%] lg:w-[55%] bg-[#f9f9f9] flex flex-1 items-center justify-center p-6 md:p-8">
        <div className="w-full max-w-[420px] flex flex-col gap-6 bg-white p-8 rounded-xl shadow-sm border border-[#E1E1E1]">
          <div className="flex flex-col gap-1 text-center md:text-left">
            <h2 className="text-2xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
              Welcome back
            </h2>
            <p className="text-xs text-[#464555]">
              Enter your credentials to access your account
            </p>
          </div>

          {/* Global Error Alert */}
          {uiState === 'error' && (
            <div className="bg-[#ffdad6]/40 border border-[#ba1a1a]/30 rounded-lg p-3.5 flex items-start gap-3" role="alert">
              <span className="material-symbols-outlined text-[#ba1a1a] text-xl shrink-0">error</span>
              <div className="flex flex-col text-xs">
                <span className="font-bold text-[#93000a]">
                  Login Failed {errorDetails?.status ? `(${errorDetails.status})` : ''}
                </span>
                <span className="text-[#93000a]/90 text-[11px] mt-0.5 font-medium">
                  {errorDetails?.message || 'Invalid credentials'}
                </span>
              </div>
            </div>
          )}

          {/* Network Error Alert */}
          {uiState === 'network-error' && (
            <div className="bg-[#ffdbc9]/40 border border-[#9a4600]/30 rounded-lg p-3.5 flex items-start gap-3" role="alert">
              <span className="material-symbols-outlined text-[#9a4600] text-xl shrink-0">wifi_off</span>
              <div className="flex flex-col text-xs">
                <span className="font-bold text-[#0d0300]">Network Error</span>
                <span className="text-[#0d0300]/80 text-[11px] mt-0.5">
                  {errorDetails?.message || 'Unable to connect to the server. Please check your internet connection and try again.'}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email Field */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk']" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#767587] text-[18px] pointer-events-none">
                  mail
                </span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  autoComplete="email"
                  className={`w-full pl-9 pr-3 py-2 h-10 border rounded-lg bg-white text-[#1a1c1c] text-xs focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] transition-all ${
                    uiState === 'error' ? 'border-[#ba1a1a]' : 'border-[#E1E1E1]'
                  }`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-[#1a1c1c] font-['Hanken_Grotesk']" htmlFor="password">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-[#4744e5] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#767587] text-[18px] pointer-events-none">
                  lock
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className={`w-full pl-9 pr-10 py-2 h-10 border rounded-lg bg-white text-[#1a1c1c] text-xs focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] transition-all ${
                    uiState === 'error' ? 'border-[#ba1a1a]' : 'border-[#E1E1E1]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#767587] hover:text-[#1a1c1c] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={uiState === 'loading'}
              className="w-full h-10 mt-2 bg-[#4744e5] hover:bg-[#2c24ce] text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-['Hanken_Grotesk']"
            >
              {uiState === 'loading' ? (
                <>
                  <span>Signing In...</span>
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    progress_activity
                  </span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          <div className="text-center mt-1">
            <span className="text-xs text-[#464555]">
              Don't have an account?{' '}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4744e5] hover:underline font-semibold"
              >
                Contact Sales
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

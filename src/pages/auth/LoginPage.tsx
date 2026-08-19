import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('sarah.j@salesflow.co');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [uiState, setUiState] = useState<'default' | 'error' | 'network-error' | 'loading'>('default');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUiState('loading');
    const success = await login(email, password);
    if (success) {
      setUiState('default');
      if (currentUser?.role === 'SUPER_ADMIN') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } else {
      setUiState('error');
    }
  };

  const setPresetState = (state: 'default' | 'error' | 'network-error' | 'loading') => {
    setUiState(state);
    if (state === 'error') {
      setEmail('invalid@email');
      setPassword('wrongpass');
    } else if (state === 'default') {
      setEmail('sarah.j@salesflow.co');
      setPassword('password123');
    }
  };

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
      <div className="w-full md:w-[60%] lg:w-[55%] bg-[#f9f9f9] flex flex-1 items-center justify-center p-6 md:p-8 relative">
        {/* Interactive State Controls for Demo Purposes */}
        <div className="absolute top-4 right-4 flex flex-wrap justify-end gap-1.5 z-20">
          <button
            type="button"
            onClick={() => setPresetState('default')}
            className={`px-2.5 py-1 text-xs border rounded bg-white transition-colors shadow-sm ${uiState === 'default' ? 'border-[#4744e5] text-[#4744e5] font-bold' : 'border-[#E1E1E1] text-[#464555]'}`}
          >
            Default
          </button>
          <button
            type="button"
            onClick={() => setPresetState('error')}
            className={`px-2.5 py-1 text-xs border rounded bg-white transition-colors shadow-sm ${uiState === 'error' ? 'border-[#ba1a1a] text-[#ba1a1a] font-bold' : 'border-[#E1E1E1] text-[#ba1a1a]'}`}
          >
            Error
          </button>
          <button
            type="button"
            onClick={() => setPresetState('network-error')}
            className={`px-2.5 py-1 text-xs border rounded bg-white transition-colors shadow-sm ${uiState === 'network-error' ? 'border-[#9a4600] text-[#9a4600] font-bold' : 'border-[#E1E1E1] text-[#9a4600]'}`}
          >
            Network Error
          </button>
          <button
            type="button"
            onClick={() => setPresetState('loading')}
            className={`px-2.5 py-1 text-xs border rounded bg-white transition-colors shadow-sm ${uiState === 'loading' ? 'border-[#4744e5] text-[#4744e5] font-bold' : 'border-[#E1E1E1] text-[#4744e5]'}`}
          >
            Loading
          </button>
        </div>

        <div className="w-full max-w-[420px] flex flex-col gap-6 bg-white p-8 rounded-xl shadow-sm border border-[#E1E1E1]">
          <div className="flex flex-col gap-1 text-center md:text-left">
            <h2 className="text-2xl font-bold text-[#1a1c1c] font-['Hanken_Grotesk']">
              Welcome back
            </h2>
            <p className="text-xs text-[#464555]">
              Enter your credentials to access your account
            </p>
          </div>

          {/* Quick Switch Persona Buttons */}
          <div className="p-3 bg-[#f3f3f3] rounded-lg border border-[#E1E1E1] text-xs">
            <span className="font-bold text-[11px] text-[#464555] block mb-1.5">Quick Demo Login:</span>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => { setEmail('sarah.j@salesflow.co'); setPassword('password123'); }}
                className="px-2 py-0.5 bg-white border border-[#c7c4d8] rounded text-[10px] hover:border-[#4744e5] hover:text-[#4744e5]"
              >
                Tenant Admin
              </button>
              <button
                type="button"
                onClick={() => { setEmail('m.rodriguez@salesflow.co'); setPassword('password123'); }}
                className="px-2 py-0.5 bg-white border border-[#c7c4d8] rounded text-[10px] hover:border-[#4744e5] hover:text-[#4744e5]"
              >
                Sales Manager
              </button>
              <button
                type="button"
                onClick={() => { setEmail('budi.s@salesflow.co'); setPassword('password123'); }}
                className="px-2 py-0.5 bg-white border border-[#c7c4d8] rounded text-[10px] hover:border-[#4744e5] hover:text-[#4744e5]"
              >
                Sales Rep
              </button>
              <button
                type="button"
                onClick={() => { setEmail('ahmad.ricky@salesflow.pro'); setPassword('password123'); }}
                className="px-2 py-0.5 bg-white border border-[#c7c4d8] rounded text-[10px] hover:border-[#4744e5] hover:text-[#4744e5]"
              >
                Super Admin
              </button>
            </div>
          </div>

          {/* Global Error Alert */}
          {uiState === 'error' && (
            <div className="bg-[#ffdad6]/40 border border-[#ba1a1a]/30 rounded-lg p-3.5 flex items-start gap-3">
              <span className="material-symbols-outlined text-[#ba1a1a] text-xl shrink-0">error</span>
              <div className="flex flex-col text-xs">
                <span className="font-bold text-[#93000a]">Invalid credentials</span>
                <span className="text-[#93000a]/80 text-[11px] mt-0.5">
                  The email or password provided is incorrect. Please verify and try again.
                </span>
              </div>
            </div>
          )}

          {/* Network Error Alert */}
          {uiState === 'network-error' && (
            <div className="bg-[#ffdbc9]/40 border border-[#9a4600]/30 rounded-lg p-3.5 flex items-start gap-3">
              <span className="material-symbols-outlined text-[#9a4600] text-xl shrink-0">wifi_off</span>
              <div className="flex flex-col text-xs">
                <span className="font-bold text-[#0d0300]">Network error</span>
                <span className="text-[#0d0300]/80 text-[11px] mt-0.5">
                  Please check your internet connection and try again.
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
                  className={`w-full pl-9 pr-10 py-2 h-10 border rounded-lg bg-white text-[#1a1c1c] text-xs focus:outline-none focus:border-[#4744e5] focus:ring-1 focus:ring-[#4744e5] transition-all ${
                    uiState === 'error' ? 'border-[#ba1a1a]' : 'border-[#E1E1E1]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#767587] hover:text-[#1a1c1c] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2 mt-1">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 border-[#E1E1E1] rounded text-[#4744e5] focus:ring-[#4744e5]/20 cursor-pointer"
              />
              <label htmlFor="remember" className="text-xs text-[#464555] cursor-pointer select-none">
                Remember me for 30 days
              </label>
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
              <a href="#" className="text-[#4744e5] hover:underline font-semibold">
                Contact Sales
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

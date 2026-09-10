import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldAlert, ArrowRight, Car, KeyRound, CheckCircle2 } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (rememberMe: boolean) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Configured password from environment or default fallback
  const envObj = (import.meta as any).env || {};
  const configuredPassword = (
    envObj.VITE_ADMIN_PASSWORD ||
    envObj.VITE_APP_PASSWORD ||
    envObj.VITE_ADMIN_SECRET ||
    'admin123'
  ).trim();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const enteredPassword = password.trim();

    if (!enteredPassword) {
      setError('Please enter your administrator password.');
      return;
    }

    setIsVerifying(true);

    setTimeout(() => {
      if (enteredPassword === configuredPassword) {
        setIsSuccess(true);
        // Always persist to localStorage for continuous access
        localStorage.setItem('fleet_console_auth', 'true');
        setTimeout(() => {
          onLoginSuccess(rememberMe);
        }, 400);
      } else {
        setIsVerifying(false);
        setError('Incorrect password. Please try again.');
      }
    }, 250);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 flex flex-col items-center justify-center p-4 selection:bg-amber-500 selection:text-slate-950 relative overflow-hidden">
      {/* Subtle Background Glow Accents */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Brand Badge */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 mb-4 ring-4 ring-amber-400/20">
            <Car className="w-8 h-8 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Trusty Yellow Cab
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Fleet Dispatch & Operations Console
          </p>
        </div>

        {/* Login Card (Light Theme) */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Administrator Access
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter your password to unlock the console
              </p>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-bold text-slate-700 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter administrator password"
                  className="w-full pl-10 pr-11 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-300 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 hover:text-slate-900 transition font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded bg-white border-slate-300 text-amber-500 focus:ring-amber-500 w-4 h-4"
                />
                <span>Keep me logged in on this browser</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isVerifying || isSuccess}
              className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  <span>Access Granted</span>
                </>
              ) : isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Unlock Dispatch Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security Stamp & Links */}
        <div className="text-center mt-6 space-y-1">
          <p className="text-[11px] text-slate-500 font-medium">
            Trusty Yellow Cab • Dispatch Operations
          </p>
          <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400">
            <a
              href="/privacy-policy"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/privacy-policy');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="hover:text-slate-600 underline font-medium transition cursor-pointer"
            >
              Privacy Policy
            </a>
            <span>•</span>
            <a
              href="/account-deletion"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/account-deletion');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="hover:text-slate-600 underline font-medium transition cursor-pointer"
            >
              Account Deletion
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

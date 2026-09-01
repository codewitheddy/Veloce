import React, { useState } from 'react';
import { ShieldCheck, Lock, User, ArrowRight, CheckCircle2, AlertCircle, Terminal, KeyRound } from 'lucide-react';
import VeloceLogo from './VeloceLogo';

interface DjangoAdminLoginProps {
  onLoginSuccess: () => void;
  onCancel?: () => void;
}

export default function DjangoAdminLogin({ onLoginSuccess, onCancel }: DjangoAdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/superuser-login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok && (data.success || data.user?.is_superuser || data.user?.is_staff)) {
        if (data.access) {
          localStorage.setItem('veloce_admin_token', data.access);
        }
        localStorage.setItem('veloce_user_role', 'admin');
        if (data.user?.email) {
          localStorage.setItem('veloce_admin_email', data.user.email);
        }
        setSuccessMsg("Superuser credentials verified! Opening Veloce Admin Portal...");
        setTimeout(() => {
          onLoginSuccess();
        }, 500);
      } else {
        setError(data.error || data.detail || "Invalid superuser credentials. Please verify your username and password.");
      }
    } catch (err: any) {
      setError("Could not connect to Django auth service. Please ensure the backend server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-950 text-white font-sans">
      <div className="w-full max-w-md">
        {/* Django Superuser Header Card */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
          {/* Accent Django Green Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-600"></div>

          {/* Top Django Admin Badge */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <VeloceLogo size="md" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#062619] text-emerald-300 border border-emerald-700/60">
              <ShieldCheck className="h-3 w-3 text-emerald-400" /> Django 4.2 Admin
            </span>
          </div>

          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Superuser Login
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed font-medium">
              Enter your Django administrator credentials to access the <span className="text-emerald-300 font-bold">Veloce Hub Admin Suite</span>.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5 font-medium">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-200 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                Superuser Username or Email
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter superuser username or email"
                  className="w-full bg-slate-950/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 font-mono">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter superuser password"
                  className="w-full bg-slate-950/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all duration-200 shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Log In as Superuser</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Terminal superuser notice */}
          <div className="mt-6 pt-5 border-t border-slate-800 space-y-3">
            <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] text-slate-300 space-y-1.5 font-medium">
              <div className="flex items-center gap-1.5 text-slate-200 font-bold font-mono">
                <Terminal className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>Superuser Creation</span>
              </div>
              <p className="text-slate-400 leading-normal">
                To create a new administrator account, run the standard Django command in your terminal:
              </p>
              <div className="bg-slate-900 p-1.5 rounded text-emerald-400 font-mono text-[10px] select-all border border-slate-850">
                python manage.py createsuperuser
              </div>
            </div>

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full text-xs text-slate-400 hover:text-slate-200 transition-colors text-center cursor-pointer pt-1"
              >
                ← Return to Public Customer Storefront
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

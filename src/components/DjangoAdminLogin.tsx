/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Lock, User, ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff, Shield } from 'lucide-react';
import VeloceLogo from './VeloceLogo';

interface DjangoAdminLoginProps {
  onLoginSuccess: () => void;
  onCancel?: () => void;
}

export default function DjangoAdminLogin({ onLoginSuccess, onCancel }: DjangoAdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
        if (rememberMe) {
          localStorage.setItem('veloce_remember_admin', 'true');
        }
        setSuccessMsg("Welcome back! Loading Ropenix Admin...");
        setTimeout(() => {
          onLoginSuccess();
        }, 350);
      } else {
        setError(data.error || data.detail || "Invalid credentials. Please verify your username and password.");
      }
    } catch (err: any) {
      setError("Could not connect to authentication service. Please check your network connection.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-50 dark:bg-slate-950 font-sans selection:bg-indigo-600 selection:text-white">
      <div className="w-full max-w-md">
        {/* Main Card Container */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 sm:p-9 shadow-xl shadow-slate-200/60 dark:shadow-black/60 relative overflow-hidden">
          
          {/* Logo & Avatar Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <VeloceLogo size="md" />
            </div>

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 mb-3">
              <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>

            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Sign in to Admin Studio
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-light">
              Enter your administrative credentials to manage catalog, orders &amp; settings
            </p>
          </div>

          {/* Error Message Alert */}
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 font-medium animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message Alert */}
          {successMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2.5 font-medium animate-in fade-in duration-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Username / Email */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1 font-mono">
                Username or Email address
              </label>
              <div className="relative">
                <User className="absolute top-3 left-3 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin@ropenix.co.ke"
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 pl-9 pr-4 text-xs font-normal text-slate-900 dark:text-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none bg-white dark:bg-slate-800 transition-colors"
                  id="input-admin-username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1 font-mono">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute top-3 left-3 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 pl-9 pr-10 text-xs font-normal text-slate-900 dark:text-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none bg-white dark:bg-slate-800 transition-colors"
                  id="input-admin-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Remember this session</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                256-bit Encrypted
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 h-10 w-full rounded-xl bg-indigo-600 font-semibold text-xs text-white transition-colors hover:bg-indigo-700 cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
              id="btn-admin-submit-login"
            >
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In &amp; Continue to Admin</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Return to Storefront Link */}
          {onCancel && (
            <div className="mt-6 pt-5 border-t border-slate-150 dark:border-slate-800 text-center text-xs">
              <button
                type="button"
                onClick={onCancel}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
              >
                ← Return to Public Customer Storefront
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

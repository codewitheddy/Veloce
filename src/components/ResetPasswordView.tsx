/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { KeyRound, CheckCircle2, AlertCircle, ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import api from '../services/api';

interface ResetPasswordViewProps {
  onSuccessRedirect?: () => void;
  onBackToLogin?: () => void;
  darkMode?: boolean;
}

export default function ResetPasswordView({
  onSuccessRedirect,
  onBackToLogin,
  darkMode = false,
}: ResetPasswordViewProps) {
  const [token, setToken] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('Password updated. Please log in.');
  const [redirectCountdown, setRedirectCountdown] = useState<number>(3);

  // Extract token from URL query string on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token') || params.get('code') || '';
      if (urlToken) {
        setToken(urlToken.trim());
      }
    }
  }, []);

  // Auto-redirect countdown on success
  useEffect(() => {
    if (!success) return;
    const interval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onSuccessRedirect) {
            onSuccessRedirect();
          } else if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [success, onSuccessRedirect]);

  // Password Strength Calculation
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const strengthScore = [hasMinLength, hasNumber, hasSpecial, hasMixedCase].filter(Boolean).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanToken = token.trim();
    if (!cleanToken) {
      setError('Password reset token is missing. Please click the link in your reset email.');
      return;
    }

    if (password.length < 8) {
      setError('Your new password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/reset-password', {
        token: cleanToken,
        password: password,
        confirmPassword: confirmPassword,
      });

      if (response.data && response.data.success) {
        setSuccess(true);
        setSuccessMessage(response.data.message || 'Password updated. Please log in.');
      } else {
        setError(response.data?.error || 'Unable to reset password. The link may have expired.');
      }
    } catch (err: any) {
      const data = err?.response?.data;
      const errorMsg = data?.error || data?.message || err?.message || 'Failed to reset password. Please request a new link.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 sm:p-8 shadow-sm">
          
          {/* Success State */}
          {success ? (
            <div className="text-center py-4 space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Password Reset Successful
                </h2>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {successMessage}
                </p>
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                  Redirecting to login in {redirectCountdown}s...
                </p>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => {
                    if (onSuccessRedirect) onSuccessRedirect();
                    else if (typeof window !== 'undefined') window.location.href = '/login';
                  }}
                  className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Go to Sign In Now</span>
                </button>
              </div>
            </div>
          ) : (
            /* Reset Form State */
            <div>
              <div className="text-center mb-6">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-3">
                  <KeyRound className="h-6 w-6" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Set New Password
                </h1>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Choose a strong, unique password to secure your account.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Hidden or editable token input if missing in URL */}
                {!token && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Reset Token
                    </label>
                    <input
                      type="text"
                      required
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Paste 64-character token from email"
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 text-xs text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-600 focus:outline-none transition-colors"
                    />
                  </div>
                )}

                {/* New Password */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute top-3 left-3 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="••••••••••••"
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 pl-9.5 pr-10 text-xs text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-600 focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Strength Meter */}
                {password.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex gap-1">
                      <div className={`h-1 flex-1 rounded-full transition-colors ${strengthScore >= 1 ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                      <div className={`h-1 flex-1 rounded-full transition-colors ${strengthScore >= 2 ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                      <div className={`h-1 flex-1 rounded-full transition-colors ${strengthScore >= 3 ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                      <div className={`h-1 flex-1 rounded-full transition-colors ${strengthScore >= 4 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{hasMinLength ? '✓ 8+ chars' : '• Min 8 chars'}</span>
                      <span>{hasNumber ? '✓ Number' : '• Add a number'}</span>
                      <span>{hasMixedCase ? '✓ Mixed case' : '• Upper & lower'}</span>
                    </div>
                  </div>
                )}

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute top-3 left-3 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="••••••••••••"
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 pl-9.5 pr-10 text-xs text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-600 focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <p className="mt-1 text-[11px] text-rose-500">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || password.length < 8 || password !== confirmPassword}
                  className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs mt-2"
                >
                  {loading ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </form>

              {onBackToLogin && (
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={onBackToLogin}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer font-medium"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

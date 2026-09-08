/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Server,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Mail,
  Zap,
  Activity,
  ChevronDown,
  ChevronUp,
  Cpu,
  Info
} from 'lucide-react';
import { emailService } from '../services/api';

export interface SmtpValidationData {
  valid: boolean;
  status: 'healthy' | 'unhealthy' | 'degraded';
  latencyMs: number;
  config: {
    host: string;
    port: number;
    user: string;
    defaultFrom: string;
    useSsl: boolean;
    backend: string;
  };
  checks: {
    envLoaded: boolean;
    dnsResolved: boolean;
    authSuccess: boolean;
  };
  message: string;
  error?: string;
  validatedAt: string;
}

interface SmtpHealthValidatorProps {
  onOpenFullDiagnostics?: () => void;
  compact?: boolean;
}

export default function SmtpHealthValidator({
  onOpenFullDiagnostics,
  compact = false
}: SmtpHealthValidatorProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [data, setData] = useState<SmtpValidationData | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleValidate = async () => {
    setIsValidating(true);
    setErrorMsg(null);
    try {
      const res = await emailService.validateConfig();
      setData(res);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Validation request failed';
      setErrorMsg(msg);
      setData({
        valid: false,
        status: 'unhealthy',
        latencyMs: 0,
        config: {
          host: 'mail.marid.co.ke',
          port: 465,
          user: 'noreply@marid.co.ke',
          defaultFrom: 'Ropenix Collections <noreply@marid.co.ke>',
          useSsl: true,
          backend: 'django.core.mail.backends.smtp.EmailBackend'
        },
        checks: {
          envLoaded: false,
          dnsResolved: false,
          authSuccess: false
        },
        message: msg,
        error: msg,
        validatedAt: new Date().toISOString()
      });
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    // Initial silent check on component mount
    handleValidate();
  }, []);

  if (compact) {
    return (
      <div className="flex items-center gap-2 font-sans">
        {/* Compact Health Badge */}
        {isValidating ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
            <span>Verifying SMTP...</span>
          </span>
        ) : data?.valid ? (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-pointer transition hover:bg-emerald-100"
            onClick={handleValidate}
            title="Click to re-validate SMTP parameters"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>SMTP Active ({data.latencyMs}ms)</span>
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 cursor-pointer transition hover:bg-rose-100"
            onClick={handleValidate}
            title="Click to re-validate SMTP parameters"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>SMTP Offline</span>
          </span>
        )}

        <button
          onClick={handleValidate}
          disabled={isValidating}
          className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
          title="Validate .env SMTP Configuration On-Demand"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all">
      {/* Top Banner Row */}
      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl border ${
              isValidating
                ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800'
                : data?.valid
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800'
            }`}
          >
            {isValidating ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : data?.valid ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                cPanel & Django SMTP Gateway Health
              </h4>
              {isValidating ? (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded-full border border-amber-200">
                  Verifying .env...
                </span>
              ) : data?.valid ? (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full border border-emerald-200/80 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  HEALTHY ({data.latencyMs}ms)
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 rounded-full border border-rose-200/80 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  UNHEALTHY
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {data?.message || 'On-demand verification of backend .env mail server credentials'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handleValidate}
            disabled={isValidating}
            className="px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin text-blue-500' : ''}`} />
            <span>Validate Configuration</span>
          </button>

          {onOpenFullDiagnostics && (
            <button
              onClick={onOpenFullDiagnostics}
              className="px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Full Diagnostics</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
            title={isExpanded ? 'Collapse parameters' : 'Expand parameter breakdown'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Breakdown */}
      {isExpanded && data && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="font-semibold">.env Config Status</span>
                {data.checks.envLoaded ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500" />
                )}
              </div>
              <p className="font-mono text-slate-800 dark:text-slate-200 font-bold truncate">
                {data.config.host}:{data.config.port}
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="font-semibold">DNS Name Resolution</span>
                {data.checks.dnsResolved ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500" />
                )}
              </div>
              <p className="font-mono text-slate-800 dark:text-slate-200 font-bold truncate">
                {data.checks.dnsResolved ? 'Resolved A Record' : 'Resolution Failed'}
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="font-semibold">SMTP Handshake & Auth</span>
                {data.checks.authSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500" />
                )}
              </div>
              <p className="font-mono text-slate-800 dark:text-slate-200 font-bold truncate">
                {data.checks.authSuccess ? 'Login Accepted (250 OK)' : 'Authentication Rejected'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-100 dark:border-slate-900">
            <span>User: <strong>{data.config.user}</strong></span>
            <span>Sender: <strong>{data.config.defaultFrom}</strong></span>
            <span>SSL/TLS: <strong>{data.config.useSsl ? 'Active' : 'Disabled'}</strong></span>
            <span>Validated: <strong>{new Date(data.validatedAt).toLocaleTimeString()}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

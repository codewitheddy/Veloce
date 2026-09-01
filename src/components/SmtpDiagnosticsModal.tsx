/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Send,
  Terminal,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Server,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Cpu,
  Lock,
  ArrowRight,
  Info,
  Bug,
  ListFilter,
  Eye,
  EyeOff,
  Save
} from 'lucide-react';
import { emailService } from '../services/api';

interface SmtpDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

interface DiagnosticStep {
  step: string;
  status: 'ok' | 'error' | 'warning' | 'info';
  detail: string;
  latencyMs?: number;
}

interface DiagnosticReport {
  success: boolean;
  recipient: string;
  config: {
    host: string;
    port: number;
    user: string;
    defaultFrom: string;
    useSsl: boolean;
    backend: string;
  };
  timestamp: string;
  messageId?: string;
  response?: string;
  steps: DiagnosticStep[];
  logs: string[];
  errorDetails?: {
    name?: string;
    message: string;
    code?: string;
    command?: string;
    response?: string;
    stack?: string;
  };
  troubleshootingTip?: string;
}

export default function SmtpDiagnosticsModal({
  isOpen,
  onClose,
  defaultEmail = 'admin@veloce.co.ke'
}: SmtpDiagnosticsModalProps) {
  const [recipient, setRecipient] = useState(defaultEmail);
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'logs' | 'raw_error'>('pipeline');
  const [activeFilter, setActiveFilter] = useState<'all' | 'errors' | 'ok'>('all');

  // Interactive SMTP Edit Form state
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [formHost, setFormHost] = useState('mail.marid.co.ke');
  const [formPort, setFormPort] = useState<number>(465);
  const [formUser, setFormUser] = useState('noreply@marid.co.ke');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    if (isOpen) {
      emailService.getConfig().then((res) => {
        if (res) {
          if (res.host) setFormHost(res.host);
          if (res.port) setFormPort(res.port);
          if (res.user) setFormUser(res.user);
        }
      }).catch(console.error);
    }
  }, [isOpen]);

  const handleSaveAndRetest = async () => {
    setIsSavingConfig(true);
    setIsRunning(true);
    try {
      const res = await emailService.updateConfig({
        host: formHost,
        port: Number(formPort),
        user: formUser,
        password: formPassword,
      });

      setReport({
        success: res.success,
        recipient,
        config: {
          host: res.config.host,
          port: res.config.port,
          user: res.config.user,
          defaultFrom: res.config.defaultFrom,
          useSsl: res.config.useSsl,
          backend: 'django.core.mail.backends.smtp.EmailBackend'
        },
        timestamp: new Date().toISOString(),
        steps: [
          { step: '1. Update & DNS Lookup', status: res.validation?.dnsResolved ? 'ok' : 'error', detail: res.validation?.dnsResolved ? `Resolved ${res.config.host}` : 'DNS Lookup Failed' },
          { step: '2. SMTP Handshake & Auth', status: res.validation?.authSuccess ? 'ok' : 'error', detail: res.validation?.authSuccess ? `Accepted ${res.config.user}` : 'SMTP Auth Rejected' }
        ],
        logs: [
          `[${new Date().toLocaleTimeString()}] Real-time SMTP configuration updated`,
          `[Server] ${res.config.host}:${res.config.port}`,
          `[User] ${res.config.user}`,
          `[Latency] ${res.validation?.latencyMs || 0}ms`,
          `[Result] ${res.message}`
        ],
        errorDetails: !res.success ? { name: 'SMTPUpdateError', message: res.message } : undefined,
      });

      setLogs([
        `[${new Date().toLocaleTimeString()}] Real-time SMTP configuration updated`,
        `[Server] ${res.config.host}:${res.config.port}`,
        `[User] ${res.config.user}`,
        `[Result] ${res.message}`
      ]);
      setIsEditingConfig(false);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSavingConfig(false);
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (isOpen && !report && !isRunning) {
      // Auto fetch config on load
      runDiagnostic(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const runDiagnostic = async (triggerFullSend = true) => {
    setIsRunning(true);
    setCopiedLogs(false);
    try {
      const data = await emailService.testDiagnostics(recipient);
      setReport(data);
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to execute SMTP diagnostic test';
      setReport({
        success: false,
        recipient,
        config: {
          host: 'mail.marid.co.ke',
          port: 465,
          user: 'noreply@marid.co.ke',
          defaultFrom: 'Veloce Kenya <noreply@marid.co.ke>',
          useSsl: true,
          backend: 'django.core.mail.backends.smtp.EmailBackend'
        },
        timestamp: new Date().toISOString(),
        steps: [
          {
            step: '1. Endpoint Call',
            status: 'error',
            detail: errorMsg
          }
        ],
        logs: [`[${new Date().toLocaleTimeString()}] Critical API Error: ${errorMsg}`],
        errorDetails: {
          name: 'Network/Backend Error',
          message: errorMsg,
          stack: err.stack
        }
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyLogs = () => {
    if (!logs.length) return;
    const textToCopy = `=== VELOCE SMTP DIAGNOSTIC REPORT ===\nTimestamp: ${report?.timestamp || new Date().toISOString()}\nRecipient: ${recipient}\nHost: ${report?.config.host}:${report?.config.port}\nStatus: ${report?.success ? 'PASSED' : 'FAILED'}\n\nLOGS:\n${logs.join('\n')}\n\n${report?.errorDetails ? `ERROR DETAILS:\n${JSON.stringify(report.errorDetails, null, 2)}` : ''}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold text-slate-100">Django & cPanel SMTP Diagnostic Tool</h3>
                <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  Admin Tool
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Raw socket connectivity, DNS lookup, authentication & delivery test
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close SMTP Diagnostics Modal"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50 dark:bg-slate-950">
          {/* Target Email Controls Card */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-500" /> Target Recipient Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="Enter email e.g. admin@veloce.co.ke"
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-800 dark:text-slate-100 font-mono"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
              </div>

              <div className="flex items-end space-x-2">
                <button
                  onClick={() => setIsEditingConfig(!isEditingConfig)}
                  className={`px-3.5 py-2.5 font-medium text-xs rounded-lg border shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer ${
                    isEditingConfig
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  }`}
                  title="Update SMTP Host, Port, User, Password in real time"
                >
                  <Server className="w-4 h-4 text-blue-400" />
                  <span>{isEditingConfig ? 'Cancel Editing' : 'Edit SMTP Settings'}</span>
                </button>

                <button
                  onClick={async () => {
                    setIsRunning(true);
                    try {
                      const res = await emailService.validateConfig();
                      setReport({
                        success: res.valid,
                        recipient,
                        config: res.config,
                        timestamp: res.validatedAt,
                        steps: [
                          { step: '1. Config Check', status: res.checks.envLoaded ? 'ok' : 'error', detail: `Loaded ${res.config.host}:${res.config.port}` },
                          { step: '2. DNS Resolution', status: res.checks.dnsResolved ? 'ok' : 'error', detail: res.checks.dnsResolved ? `Resolved ${res.config.host}` : 'DNS Failed' },
                          { step: '3. Handshake & Auth', status: res.checks.authSuccess ? 'ok' : 'error', detail: res.checks.authSuccess ? `Accepted user ${res.config.user}` : 'Auth Rejected' }
                        ],
                        logs: [
                          `[${new Date().toLocaleTimeString()}] On-demand .env parameter validation executed`,
                          `[Status] ${res.valid ? 'PASSED (250 OK)' : 'FAILED'}`,
                          `[Latency] ${res.latencyMs}ms`,
                          `[Message] ${res.message}`
                        ],
                        errorDetails: res.error ? { name: 'ConfigValidationError', message: res.error } : undefined,
                        troubleshootingTip: res.valid ? undefined : 'Verify EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in your configuration.'
                      });
                      setLogs([
                        `[${new Date().toLocaleTimeString()}] On-demand .env parameter validation executed`,
                        `[Status] ${res.valid ? 'PASSED (250 OK)' : 'FAILED'}`,
                        `[Latency] ${res.latencyMs}ms`,
                        `[Message] ${res.message}`
                      ]);
                    } catch (e: any) {
                      console.error(e);
                    } finally {
                      setIsRunning(false);
                    }
                  }}
                  disabled={isRunning}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Validate .env parameters without sending an email"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Validate Config</span>
                </button>

                <button
                  onClick={() => runDiagnostic(true)}
                  disabled={isRunning || !recipient}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-sm flex items-center space-x-2 transition-all cursor-pointer hover:shadow-blue-500/20"
                >
                  {isRunning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Test Email Delivery</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Inline SMTP Settings Form */}
            {isEditingConfig && (
              <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/20 space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-blue-500" /> Real-time SMTP Settings Form
                  </span>
                  <span className="text-[10px] text-blue-500 font-mono">Changes apply to live backend immediately</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      value={formHost}
                      onChange={(e) => setFormHost(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="mail.marid.co.ke"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                      SMTP Port
                    </label>
                    <input
                      type="number"
                      value={formPort}
                      onChange={(e) => setFormPort(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="465"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                      SMTP Username
                    </label>
                    <input
                      type="text"
                      value={formUser}
                      onChange={(e) => setFormUser(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="noreply@marid.co.ke"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                      SMTP Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full pl-3 pr-9 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveAndRetest}
                    disabled={isSavingConfig}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                  >
                    {isSavingConfig ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving & Re-testing...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save & Re-test Validation</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Config Highlights */}
            {report && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 block font-medium">SMTP Server</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200 font-semibold">{report.config.host}</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 block font-medium">Port & SSL</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200 font-semibold">
                    {report.config.port} ({report.config.useSsl ? 'SSL/TLS' : 'STARTTLS'})
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 block font-medium">Auth User</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200 font-semibold truncate block" title={report.config.user}>
                    {report.config.user}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 block font-medium">Django Backend</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200 font-semibold truncate block" title={report.config.backend}>
                    smtp.EmailBackend
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Test Result Status Banner */}
          {report && (
            <div
              className={`p-4 rounded-xl border flex items-start space-x-3 ${
                report.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
              }`}
            >
              {report.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm">
                    {report.success
                      ? 'SMTP Gateway Operational & Email Delivered'
                      : 'SMTP Connection / Authentication Test Failed'}
                  </h4>
                  <span className="text-xs opacity-70 font-mono">
                    {new Date(report.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs opacity-90 leading-relaxed">
                  {report.success
                    ? `Live message dispatched to ${report.recipient}. Message ID: ${report.messageId || 'Accepted'}`
                    : report.errorDetails?.message || 'SMTP handshakes or credentials were rejected by the server.'}
                </p>
                {report.troubleshootingTip && (
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mt-1 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> {report.troubleshootingTip}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab('pipeline')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                  activeTab === 'pipeline'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Diagnostic Pipeline</span>
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                  activeTab === 'logs'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Live Logs ({logs.length})</span>
              </button>
              {report?.errorDetails && (
                <button
                  onClick={() => setActiveTab('raw_error')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                    activeTab === 'raw_error'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950'
                  }`}
                >
                  <Bug className="w-3.5 h-3.5" />
                  <span>Error Stack Inspector</span>
                </button>
              )}
            </div>

            <button
              onClick={handleCopyLogs}
              disabled={!logs.length}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center space-x-1.5 transition-all shadow-sm disabled:opacity-40"
            >
              {copiedLogs ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Report</span>
                </>
              )}
            </button>
          </div>

          {/* TAB 1: PIPELINE STEPS */}
          {activeTab === 'pipeline' && (
            <div className="space-y-3">
              {report?.steps && report.steps.length > 0 ? (
                report.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 shadow-sm"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5">
                        {step.status === 'ok' ? (
                          <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : step.status === 'error' ? (
                          <div className="p-1.5 bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-lg">
                            <XCircle className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="p-1.5 bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-lg">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h5 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                          {step.step}
                        </h5>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                          {step.detail}
                        </p>
                      </div>
                    </div>

                    {step.latencyMs !== undefined && (
                      <span className="px-2.5 py-1 text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md shrink-0">
                        {step.latencyMs}ms
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-400">
                  <Server className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm">Click "Run SMTP Connectivity Test" to execute real-time diagnostics.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TERMINAL LOGS */}
          {activeTab === 'logs' && (
            <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs text-slate-200 overflow-x-auto max-h-80 shadow-inner">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 text-slate-400 text-[11px]">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>cPanel SMTP Diagnostic Stream</span>
                </div>
                <span>{logs.length} log lines</span>
              </div>
              {logs.length > 0 ? (
                <div className="space-y-1.5">
                  {logs.map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.includes('Error') || line.includes('FAILED')
                          ? 'text-rose-400 font-semibold'
                          : line.includes('successful') || line.includes('delivered')
                          ? 'text-emerald-400 font-semibold'
                          : 'text-slate-300'
                      }
                    >
                      {line}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-slate-600 italic">No output logs recorded yet...</span>
              )}
            </div>
          )}

          {/* TAB 3: ERROR INSPECTOR */}
          {activeTab === 'raw_error' && report?.errorDetails && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Error Classification</span>
                  <span className="px-2 py-0.5 text-xs font-mono bg-rose-900/50 text-rose-300 rounded border border-rose-700/50">
                    {report.errorDetails.code || report.errorDetails.name || 'SMTP_ERROR'}
                  </span>
                </div>
                <p className="font-mono text-sm font-semibold">{report.errorDetails.message}</p>
              </div>

              {report.errorDetails.stack && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-60">
                  <span className="text-slate-500 block mb-2 font-bold">// Backend Stack Trace</span>
                  <pre className="whitespace-pre-wrap">{report.errorDetails.stack}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Active Server Domain: <strong>mail.marid.co.ke</strong> (SSL Port 465)</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
}

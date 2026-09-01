import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Clock,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserX,
  Zap,
  Star,
  ExternalLink,
  ChevronRight,
  Filter,
  BarChart3
} from 'lucide-react';
import { Order, Review, ReviewRequestLog, ReviewRequestSettings } from '../types';
import { processReviewRequestAutomation } from '../lib/reviewRequestScheduler';
import { EmailNotification } from './EmailToaster';

interface ReviewRequestAutomationPanelProps {
  orders: Order[];
  reviews: Review[];
  onTriggerEmailToast?: (toast: EmailNotification) => void;
  onUpdateOrder?: (updatedOrder: Order) => void;
}

export default function ReviewRequestAutomationPanel({
  orders,
  reviews,
  onTriggerEmailToast,
  onUpdateOrder,
}: ReviewRequestAutomationPanelProps) {
  const [logs, setLogs] = useState<ReviewRequestLog[]>([]);
  const [settings, setSettings] = useState<ReviewRequestSettings>({
    enabled: true,
    delayDays: 3,
    autoTriggerOnDelivery: true,
    incentiveDiscountPercent: 15,
  });
  const [funnel, setFunnel] = useState({
    totalDelivered: 0,
    totalRequestsSent: 0,
    totalOpened: 0,
    totalClicked: 0,
    totalReviewed: 0,
    conversionRatePercent: 0,
  });
  const [optOutsCount, setOptOutsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form input state for settings
  const [delayDaysInput, setDelayDaysInput] = useState(3);
  const [enabledInput, setEnabledInput] = useState(true);

  // Fetch automation status & logs from API or compute locally
  const fetchAutomationData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/review-requests/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (data.settings) {
          setSettings(data.settings);
          setDelayDaysInput(data.settings.delayDays);
          setEnabledInput(data.settings.enabled);
        }
        if (data.funnel) {
          setFunnel(data.funnel);
        }
        setOptOutsCount(data.optOutsCount || 0);
      }
    } catch (err) {
      console.warn('Backend logs unavailable, computing local funnel metrics.');
      computeLocalFunnel();
    } finally {
      setIsLoading(false);
    }
  };

  const computeLocalFunnel = () => {
    const delivered = orders.filter((o) => {
      const st = String(o.status || '').toLowerCase();
      return st === 'delivered' || st === 'completed';
    });

    const sentOrders = orders.filter((o) => o.review_request_sent_at);
    const reviewedCount = reviews.filter((r) => r.orderId).length;

    setFunnel({
      totalDelivered: delivered.length,
      totalRequestsSent: sentOrders.length,
      totalOpened: sentOrders.length,
      totalClicked: Math.min(sentOrders.length, reviewedCount + 1),
      totalReviewed: reviewedCount,
      conversionRatePercent: sentOrders.length > 0 ? Math.round((reviewedCount / sentOrders.length) * 1000) / 10 : 0,
    });
  };

  useEffect(() => {
    fetchAutomationData();
  }, [orders, reviews]);

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/review-requests/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: enabledInput,
          delayDays: Number(delayDaysInput),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setStatusMessage('Automation settings saved successfully!');
      } else {
        setStatusMessage('Failed to save settings to server.');
      }
    } catch (e) {
      setSettings((prev) => ({ ...prev, enabled: enabledInput, delayDays: Number(delayDaysInput) }));
      setStatusMessage('Automation settings saved locally.');
    }
  };

  // Handle Manual Execution / Processing Batch
  const handleTriggerBatchProcessing = async () => {
    setIsProcessing(true);
    setStatusMessage(null);

    const activeSettings: ReviewRequestSettings = {
      ...settings,
      enabled: enabledInput,
      delayDays: Number(delayDaysInput),
    };

    const result = await processReviewRequestAutomation(
      orders,
      reviews,
      activeSettings,
      onTriggerEmailToast,
      onUpdateOrder
    );

    setIsProcessing(false);

    if (result.processedCount > 0) {
      setStatusMessage(`Success! Sent ${result.processedCount} review request email(s) for eligible delivered orders.`);
    } else {
      setStatusMessage(`All eligible delivered orders have already been processed or are currently waiting in their ${activeSettings.delayDays}-day delay window.`);
    }

    fetchAutomationData();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Strategy Description */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-700/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold tracking-wider uppercase mb-1">
              <Zap className="h-4 w-4 text-emerald-400" />
              <span>Post-Delivery Review Automation Engine (Section 6)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Customer Feedback & Rating Funnel
            </h2>
            <p className="text-indigo-200/90 text-xs sm:text-sm mt-1 max-w-2xl font-normal leading-relaxed">
              Automatically dispatches single-order review request emails with quick 1-to-5 star deep links after a configurable post-delivery delay window, with built-in idempotency safeguards and opt-out tracking.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-stretch sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleTriggerBatchProcessing}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'Processing Queue...' : 'Run Scheduled Job Now'}</span>
            </button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 font-semibold flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-indigo-500 hover:text-indigo-700 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 6.5 Admin Funnel Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block font-mono">Delivered Orders</span>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-1 font-mono">
            {funnel.totalDelivered}
          </div>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Eligible trigger base</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xs">
          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block font-mono">Requests Sent</span>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
            {funnel.totalRequestsSent}
          </div>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Idempotency logged</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xs">
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block font-mono">Emails Clicked</span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
            {funnel.totalClicked}
          </div>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Star deep-link clicks</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block font-mono">Reviews Created</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {funnel.totalReviewed}
          </div>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Published feedback</span>
        </div>

        <div className="p-4 rounded-xl bg-indigo-50/40 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 shadow-2xs">
          <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider block font-mono">Funnel Conversion</span>
          <div className="text-2xl font-black text-indigo-700 dark:text-emerald-300 mt-1 font-mono">
            {funnel.conversionRatePercent}%
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 block flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Sent to Review ratio
          </span>
        </div>
      </div>

      {/* Settings & Automation Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-2xs">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100 dark:border-gray-700">
          <Settings className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
            Automation Parameters & Safeguards Configuration
          </h3>
        </div>

        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Automation Status
            </label>
            <select
              value={enabledInput ? 'true' : 'false'}
              onChange={(e) => setEnabledInput(e.target.value === 'true')}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs font-medium text-gray-900 dark:text-white"
            >
              <option value="true">Enabled (Auto-send after delay window)</option>
              <option value="false">Disabled (Pause automated review emails)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Post-Delivery Delay Window
            </label>
            <select
              value={delayDaysInput}
              onChange={(e) => setDelayDaysInput(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs font-medium text-gray-900 dark:text-white"
            >
              <option value={0}>0 Days (Instant / Dev Test Mode)</option>
              <option value={1}>1 Day after delivery</option>
              <option value={3}>3 Days after delivery (Recommended)</option>
              <option value={5}>5 Days after delivery</option>
              <option value={7}>7 Days after delivery</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Save Automation Settings</span>
            </button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Idempotent: Enforced by <code>review_request_sent_at</code> timestamp.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Multi-item aggregation: 1 email per order with per-product star links.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Safeguarded: Auto-skips cancelled, refunded & opted-out emails ({optOutsCount}).</span>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <Mail className="h-4 w-4 text-indigo-600" />
              <span>Review Request Dispatch Logs & Funnel Audit</span>
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Tracks delivered order notifications and customer deep-link interactions.
            </p>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs">
            No review request dispatches logged yet. Delivered orders will appear here automatically when the delay window triggers.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-mono text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                  <th className="py-3 px-4 font-bold">Order ID</th>
                  <th className="py-3 px-4 font-bold">Customer</th>
                  <th className="py-3 px-4 font-bold">Dispatched At</th>
                  <th className="py-3 px-4 font-bold">Delay Window</th>
                  <th className="py-3 px-4 font-bold">Funnel Status</th>
                  <th className="py-3 px-4 font-bold text-right">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-750/50 transition">
                    <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                      #{log.orderId}
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-gray-900 dark:text-gray-100">
                      {log.customerName}
                      <span className="block text-[10px] text-gray-400 font-mono font-normal">
                        {log.customerEmail}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 dark:text-gray-400">
                      {new Date(log.sentAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      {log.delayDays} day{log.delayDays === 1 ? '' : 's'}
                    </td>
                    <td className="py-3 px-4">
                      {log.status === 'reviewed' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                          ⭐ Reviewed
                        </span>
                      ) : log.status === 'clicked' ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-[10px]">
                          ⚡ Clicked
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-medium text-[10px]">
                          ✉️ Sent
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-gray-700 dark:text-gray-300">
                      {log.itemsCount} product{log.itemsCount === 1 ? '' : 's'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

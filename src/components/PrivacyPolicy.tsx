/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, Eye, Trash2, Download, RefreshCw, CheckCircle2, FileCode, Lock, Globe, Server, Info, ArrowLeft, Settings } from 'lucide-react';

interface PrivacyPolicyProps {
  setCurrentTab: (tab: string) => void;
}

export default function PrivacyPolicy({ setCurrentTab }: PrivacyPolicyProps) {
  const [auditData, setAuditData] = useState<{ key: string; label: string; size: number; count: number }[]>([]);
  const [totalSize, setTotalSize] = useState<number>(0);
  const [purgeSuccess, setPurgeSuccess] = useState<string | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const keyLabels: Record<string, string> = {
    'veloce_products': 'Product Catalog Data',
    'veloce_orders': 'Customer Purchase Orders',
    'veloce_affiliates': 'Affiliate Program Inventory',
    'veloce_campaigns': 'Affiliate Campaign Tracks',
    'veloce_clicklogs': 'Affiliate Referral Log Audits',
    'veloce_payout_logs': 'Affiliate Commission Payouts',
    'veloce_cart': 'Active Shopping Cart Items',
    'veloce_wishlist': 'Personal Wishlisted Accessories',
    'veloce_earnings': 'Affiliate Cumulative Revenue',
    'veloce_loyalty_points': 'Earned Loyalty Balances',
    'veloce_coupons': 'Active Promotional Discounts',
    'veloce_promo_banner': 'Global Promo Headliner Settings',
    'veloce_inventory_audit_logs': 'Security & Inventory Audit Trails',
    'veloce_last_backup_time': 'Database Backup Chronology',
    'theme': 'Interface Color Settings',
    'app-font-size': 'Accessible Type Scale Settings'
  };

  const loadAuditData = () => {
    const data: { key: string; label: string; size: number; count: number }[] = [];
    let total = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('veloce_') || key === 'theme' || key === 'app-font-size')) {
        const value = localStorage.getItem(key) || '';
        const sizeInBytes = new Blob([value]).size;
        
        // Count entries if it is an array
        let count = 1;
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            count = parsed.length;
          }
        } catch (_) {
          // Keep default count as 1 for primitive variables
        }

        data.push({
          key,
          label: keyLabels[key] || key,
          size: sizeInBytes,
          count
        });
        total += sizeInBytes;
      }
    }

    setAuditData(data.sort((a, b) => b.size - a.size));
    setTotalSize(total);
  };

  useEffect(() => {
    loadAuditData();
  }, []);

  const handlePurgeKey = (key: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Confirm Purge",
      message: `Are you sure you want to delete "${keyLabels[key] || key}"? This action cannot be undone.`,
      onConfirm: () => {
        localStorage.removeItem(key);
        loadAuditData();
        setPurgeSuccess(`Purged data for: ${keyLabels[key] || key}`);
        setTimeout(() => setPurgeSuccess(null), 3500);
      }
    });
  };

  const handlePurgeAll = () => {
    setConfirmConfig({
      isOpen: true,
      title: "CRITICAL: Erase All Local Data",
      message: 'Are you sure you want to erase ALL local data for Veloce? This will reset all order history, affiliate commissions, settings, and custom products back to defaults.',
      onConfirm: () => {
        // Find all matching keys
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('veloce_') || key === 'theme' || key === 'app-font-size')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        window.location.reload();
      }
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(2)} KB`;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 font-sans">
      {/* Breadcrumb / Go Back Header */}
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={() => setCurrentTab('home')}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Return to Overview
        </button>
        <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest">
          SYSTEM CLASSIFICATION: PUBLIC STANDBY
        </span>
      </div>

      {/* Hero Header */}
      <div className="border-b border-gray-100 dark:border-gray-900 pb-8 mb-10">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1 text-[10px] font-semibold text-indigo-650 dark:text-indigo-400 font-mono uppercase mb-4">
          <Shield className="h-3.5 w-3.5" /> Privacy & Policy Charter
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-light tracking-tight text-gray-900 dark:text-white">
          Our absolute commitment to <span className="font-semibold">local-first data privacy</span>.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-505 dark:text-gray-405 font-extralight max-w-3xl">
          At Veloce Collective, privacy is not a compliance checklist; it is an architectural fundamental. 
          We have engineered this entire workspace infrastructure to run with zero server-side telemetry or trackers. 
          Every single byte of catalog customisations, click registries, order logs, and configuration state resides inside your browser's private database.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left column: Comprehensive Legal-Technical policy */}
        <div className="lg:col-span-7 flex flex-col gap-8 text-xs leading-relaxed font-extralight text-gray-650 dark:text-gray-400">
          
          {/* Section 1 */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider font-mono mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600"></span> 1. The Zero-Server Architecture
            </h3>
            <p className="mb-3">
              Most digital commerce platforms capture and aggregate behavioral telemetry on remote database nodes. 
              Veloce stands in opposition to this practice. Our site does not transmit your search queries, review descriptions, cart actions, or referral codes to any remote endpoint. 
            </p>
            <div className="rounded-lg p-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex gap-3">
              <Server className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-gray-850 dark:text-gray-200 font-semibold mb-0.5">Where is my data processed?</strong>
                All application logic (including checkout totals, loyalty point computations, promotional evaluations, and graph-rendering algorithms) is compiled in your local JavaScript thread and executed fully sandbox-side.
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider font-mono mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600"></span> 2. Tracking Cookies & Affiliation
            </h3>
            <p className="mb-3">
              Veloce operates cooperative alliances with premium third-party woodcrafters and digital tool designers. 
              When clicking external partner links from the Affiliate Marketplace, the following transparent controls apply:
            </p>
            <ul className="list-disc pl-5 space-y-2.5">
              <li>
                <strong>Encrypted Affiliation Parameters:</strong> Clicking an partner offer logs a secure record to 
                your local database, storing the targeted item ID and reference source.
              </li>
              <li>
                <strong>60-Day Memory:</strong> This tracking registry triggers the respective commission attribution only 
                if a purchase checkout occurs during this lifetime. It remains strictly internal to your browser cache.
              </li>
              <li>
                <strong>No Third-Party Scripts:</strong> We do not load external tracker snippets, pixels (e.g., Meta Pixel), 
                or Google Analytics script libraries. The click logs are pure local logs.
              </li>
            </ul>
          </div>

          {/* Section 3 */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider font-mono mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600"></span> 3. Data Portability & Backup Rights
            </h3>
            <p className="mb-3">
              You own your data completely. Under CCPA and GDPR portability mandates, you have the absolute right to extract 
              your entire state at any time:
            </p>
            <p>
              In our Executive Dashboard's **Backup & Settings** panel, we provide dual choices: you can download a direct 
              plaintext JSON file containing your active schema, or create an AES-256 encrypted archive. You can import these 
              files into any secondary browser session to restore your configurations instantly.
            </p>
          </div>

          {/* Section 4 */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider font-mono mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600"></span> 4. Security Frameworks
            </h3>
            <p>
              While browser LocalStorage is exceptionally private because remote actors cannot access it without hardware entry, 
              it can be read by local users on your device. We advise clearing your local state before returning a shared terminal 
              using our interactive audit system.
            </p>
          </div>

          {/* Corporate Standby Box */}
          <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-center">
            <Globe className="h-6 w-6 text-gray-400 mx-auto mb-2" />
            <h4 className="text-xs font-semibold text-gray-900 dark:text-white">Need a Corporate GDPR Data Protection Officer?</h4>
            <p className="text-[10px] mt-1 max-w-sm mx-auto">
              Our engineering standby team responds to cryptographic and storage-scale queries within 24 working hours at <span className="underline font-mono">legal@veloce.io</span>.
            </p>
          </div>

        </div>

        {/* Right column: Interactive Real-time Browser Audit Dashboard */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-gray-50 dark:border-gray-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4.5 w-4.5 text-indigo-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white font-mono">
                  Local Data Audit Tool
                </h3>
              </div>
              <button
                onClick={loadAuditData}
                className="rounded-md p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer"
                title="Refresh State Audit"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-gray-505 dark:text-gray-400 font-extralight mb-4 leading-relaxed">
              Below is a real-time list of every variable Veloce has saved inside your browser session. 
              Inspect sizes and purge items to maintain optimal disk hygiene.
            </p>

            {/* Total footprint score */}
            <div className="mb-5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-3.5 flex items-center justify-between">
              <div>
                <span className="block text-[10px] font-mono uppercase text-gray-400">Total Browser Footprint</span>
                <strong className="block text-base font-semibold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                  {formatSize(totalSize)}
                </strong>
              </div>
              <div className="text-right">
                <span className="block text-[10px] font-mono uppercase text-gray-400">Total Schema Domains</span>
                <strong className="block text-base font-semibold text-gray-800 dark:text-gray-250 font-mono mt-0.5">
                  {auditData.length}
                </strong>
              </div>
            </div>

            {/* Purge Success Banner */}
            {purgeSuccess && (
              <div className="mb-4 p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-400 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 animate-in slide-in-from-top duration-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> {purgeSuccess}
              </div>
            )}

            {/* Audited List of Keys */}
            {auditData.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-[11px] font-extralight border border-dashed border-gray-100 dark:border-gray-800 rounded-lg">
                No local variables mapped. Storage is entirely clean.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
                {auditData.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-gray-50 dark:border-gray-800 bg-gray-50/20 dark:bg-gray-900/20 text-[11px] font-sans hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {item.label}
                        </span>
                        {item.count > 1 && (
                          <span className="rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-400 px-1 text-[8px] font-bold font-mono">
                            {item.count} items
                          </span>
                        )}
                      </div>
                      <span className="block font-mono text-[9px] text-gray-400 mt-0.5 truncate">
                        {item.key} ({formatSize(item.size)})
                      </span>
                    </div>
                    <button
                      onClick={() => handlePurgeKey(item.key)}
                      className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded-md hover:bg-white dark:hover:bg-gray-800 transition-all cursor-pointer"
                      title="Purge Variable"
                      id={`btn-purge-${item.key}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Clear All Critical Control */}
            {auditData.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-50 dark:border-gray-800 flex flex-col gap-2">
                <button
                  onClick={handlePurgeAll}
                  className="w-full inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-red-200 hover:border-red-300 dark:border-red-900/40 bg-red-50 hover:bg-red-100 dark:bg-red-950/10 text-red-700 dark:text-red-400 text-xs font-semibold transition-colors cursor-pointer"
                  id="btn-purge-all-localstorage"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Erase Entire Local Workspace
                </button>
                <p className="text-[9px] text-gray-400 text-center font-extralight mt-1">
                  Clicking erase resets the interface, cart, orders, and products back to static factory states.
                </p>
              </div>
            )}

          </div>

          {/* Cookie banner info card */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-indigo-950/5 dark:bg-indigo-950/10 p-4 font-sans text-[11px] leading-relaxed text-indigo-950 dark:text-indigo-300">
            <div className="flex items-center gap-2 font-semibold text-indigo-900 dark:text-indigo-200 mb-2">
              <Shield className="h-4.5 w-4.5 shrink-0" /> Local Cookie & Tracker Consent
            </div>
            <p className="mb-3 font-extralight text-indigo-950/80 dark:text-indigo-300/80">
              Veloce complies with strict GDPR "Privacy by Design" guidelines. You can inspect or modify your active cookie preference privileges at any time.
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('veloce_open_cookie_settings'))}
              className="w-full inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-indigo-650 hover:bg-indigo-700 text-white text-[10px] font-bold transition-all cursor-pointer shadow-sm"
              id="privacy-btn-edit-cookies"
            >
              <Settings className="h-3.5 w-3.5" /> Configure Cookie Preferences
            </button>
          </div>

        </div>
      </div>

      {/* Custom IFrame-Safe Confirmation Dialog */}
      {confirmConfig && confirmConfig.isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 font-sans">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl max-w-md w-full mx-4 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 text-rose-600 mb-3">
                <Shield className="h-6 w-6 text-rose-500 shrink-0" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                  {confirmConfig.title}
                </h3>
              </div>
              <p className="text-sm text-gray-650 dark:text-gray-300 leading-relaxed font-sans font-light">
                {confirmConfig.message}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-gray-950/40 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-850">
              <button
                type="button"
                onClick={() => setConfirmConfig(null)}
                className="px-4 py-2 rounded-lg border border-gray-250 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850 text-gray-700 dark:text-gray-300 text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmConfig.onConfirm();
                  setConfirmConfig(null);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Wrench,
  Shield,
  Clock,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  Cpu,
  Check
} from 'lucide-react';
import VeloceLogo from './VeloceLogo';
import { useSiteSettings } from '../context/SiteSettingsContext';

interface MaintenanceModeViewProps {
  onAdminLoginClick?: () => void;
}

export default function MaintenanceModeView({ onAdminLoginClick }: MaintenanceModeViewProps) {
  const { settings, refreshSettings, isLoading } = useSiteSettings();
  const [notifyEmail, setNotifyEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkStatusMessage, setCheckStatusMessage] = useState<string | null>(null);

  const siteName = settings.general.site_name || 'Ropenix Collections';
  const tagline = settings.general.tagline || 'Premium eCommerce & Affiliate Marketplace';
  const message = settings.general.maintenance_message || 'We are currently conducting scheduled system maintenance and platform enhancements. Please check back shortly.';
  const businessEmail = settings.general.business_email || 'support@ropenix.co.ke';
  const supportPhone = settings.general.support_phone || '+254 182 180 965';
  const physicalAddress = settings.general.physical_address || 'Enterprise Road, Industrial Area, Nairobi, Kenya';

  const handleManualRefresh = async () => {
    setIsChecking(true);
    setCheckStatusMessage(null);
    try {
      const updated = await refreshSettings();
      if (!updated.general.maintenance_mode) {
        setCheckStatusMessage('Maintenance complete! Reloading storefront...');
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        setCheckStatusMessage('System upgrade is still active. Please standby.');
        setTimeout(() => setCheckStatusMessage(null), 4000);
      }
    } catch {
      setCheckStatusMessage('Unable to connect to server. Retrying connection...');
      setTimeout(() => setCheckStatusMessage(null), 3000);
    } finally {
      setIsChecking(false);
    }
  };

  const handleNotifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyEmail || !notifyEmail.includes('@')) return;
    setSubscribed(true);
  };

  const whatsappMessage = encodeURIComponent(
    `Hello ${siteName}, I am reaching out regarding the storefront maintenance.`
  );
  const cleanWaNumber = (settings.payments?.whatsapp_number || '0182180965').replace(/\D/g, '').replace(/^0/, '254');
  const whatsappUrl = `https://wa.me/${cleanWaNumber}?text=${whatsappMessage}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Header Navigation */}
      <header className="w-full bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <VeloceLogo size="md" light={false} />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>MAINTENANCE ACTIVE</span>
            </div>

            {onAdminLoginClick && (
              <button
                type="button"
                onClick={onAdminLoginClick}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer"
              >
                <Lock className="h-3.5 w-3.5 text-indigo-600" />
                <span>Staff Portal</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-2xl bg-white border border-slate-200 p-6 sm:p-10 shadow-xs text-center">
          
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono font-bold uppercase tracking-wider mb-6">
            <Wrench className="h-3.5 w-3.5 text-amber-600" />
            <span>Scheduled Maintenance</span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-3">
            We Are Upgrading {siteName}
          </h1>

          {/* Subtitle / Message */}
          <p className="text-sm sm:text-base text-slate-600 font-normal leading-relaxed max-w-lg mx-auto mb-8">
            {message}
          </p>

          {/* Key Indicators Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-6 text-left">
            <div className="p-3.5 bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  Data Security
                </span>
                <Shield className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <span className="text-xs font-bold text-slate-900 block">
                100% Protected
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                All order records safe
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  Core Engine
                </span>
                <Cpu className="h-3.5 w-3.5 text-indigo-600" />
              </div>
              <span className="text-xs font-bold text-slate-900 block">
                Speed Optimization
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Catalog & API tuning
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  Order Dispatch
                </span>
                <Clock className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <span className="text-xs font-bold text-slate-900 block">
                Queue Maintained
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Fulfillment ongoing
              </span>
            </div>
          </div>

          {/* WhatsApp Support Box */}
          <div className="my-6 p-4 bg-slate-50 border border-slate-200 text-left flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div 
                className="h-9 w-9 flex items-center justify-center shrink-0"
                style={{ backgroundColor: '#25D366' }}
              >
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Need Immediate Assistance?</h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Our team is available on WhatsApp for any urgent questions or order inquiries.
                </p>
              </div>
            </div>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold font-sans transition-opacity shrink-0 cursor-pointer hover:opacity-90"
              style={{ backgroundColor: '#25D366', color: '#ffffff' }}
            >
              <MessageCircle className="h-4 w-4 fill-white" />
              <span>Chat on WhatsApp</span>
            </a>
          </div>

          {/* Email Notification on Reopen */}
          <div className="mt-8 pt-6 border-t border-slate-200 max-w-md mx-auto">
            <p className="text-xs text-slate-600 mb-3 font-normal">
              Want an alert as soon as {siteName} is back online?
            </p>

            {subscribed ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                <Check className="h-4 w-4 text-emerald-600" />
                <span>Thank you! We will email you the moment the store reopens.</span>
              </div>
            ) : (
              <form onSubmit={handleNotifySubmit} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="Enter your email address..."
                  required
                  className="flex-1 bg-white border border-slate-300 text-slate-900 placeholder-slate-400 px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-600"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shrink-0 cursor-pointer flex items-center justify-center gap-1"
                >
                  <span>Notify Me</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>

          {/* Manual Status Check Button */}
          <div className="mt-6 flex flex-col items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isChecking || isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin text-indigo-600' : ''}`} />
              <span>{isChecking ? 'Checking Platform Status...' : 'Check If Store Is Back Online'}</span>
            </button>

            {checkStatusMessage && (
              <p className="text-xs text-indigo-600 font-mono mt-1">
                {checkStatusMessage}
              </p>
            )}
          </div>

        </div>
      </main>

      {/* Footer Contact Details */}
      <footer className="w-full bg-white border-t border-slate-200 py-5 text-xs text-slate-500 font-normal">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 sm:gap-6 text-[11.5px]">
            <a href={`mailto:${businessEmail}`} className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
              <Mail className="h-3.5 w-3.5 text-slate-400" /> {businessEmail}
            </a>
            <a href={`tel:${supportPhone.replace(/\s+/g, '')}`} className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
              <Phone className="h-3.5 w-3.5 text-slate-400" /> {supportPhone}
            </a>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400" /> {physicalAddress}
            </span>
          </div>

          <div className="text-slate-400 font-mono text-[11px]">
            &copy; {new Date().getFullYear()} {siteName}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

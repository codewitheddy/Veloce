/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Mail,
  Facebook,
  Twitter,
  Instagram,
  ArrowUpCircle,
  MapPin,
  Phone,
  ShieldCheck,
  Truck,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Lock,
} from 'lucide-react';
import VeloceLogo from './VeloceLogo';
import NewsletterSubscription from './NewsletterSubscription';
import { useSiteSettings } from '../context/SiteSettingsContext';

interface FooterProps {
  setCurrentTab: (tab: string) => void;
}

// Authentic Vector WhatsApp Icon
const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function Footer({ setCurrentTab }: FooterProps) {
  const { settings } = useSiteSettings();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentYear = new Date().getFullYear();
  const siteName = settings.general.site_name || 'Ropenix Collections';
  const tagline =
    settings.general.tagline ||
    'Curated bespoke fashion, premium workspace engineering, and verified commerce assets.';
  const businessEmail = settings.general.business_email || 'concierge@ropenix.co.ke';
  const supportPhone = settings.general.support_phone || '+254 182 180 965';
  const physicalAddress =
    settings.general.physical_address || 'Enterprise Road, Industrial Area, Nairobi, Kenya';

  // Format clean telephone for tel: link
  const rawPhone = supportPhone.replace(/[^0-9+]/g, '');
  const rawWhatsApp = rawPhone.replace('+', '');
  const whatsappUrl = `https://wa.me/${rawWhatsApp}?text=${encodeURIComponent(
    'Hello Ropenix Collections, I would like to inquire about your products and services.'
  )}`;

  return (
    <footer className="w-full max-w-full overflow-hidden bg-[#262626] text-[#FFFFFF] border-t border-[#383838] mt-auto pb-28 sm:pb-24 lg:pb-10 shrink-0 font-sans">
      {/* 1. Mobile & Desktop Trust Banner */}
      <div className="border-b border-[#333333] bg-[#1e1e1e]">
        <div className="w-full px-4 py-4 sm:px-6 lg:px-12 xl:px-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#000000] border border-[#383838]">
              <div className="h-8 w-8 rounded-lg bg-[#1a1a1a] border border-[#333333] text-indigo-400 flex items-center justify-center shrink-0">
                <Truck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[#FFFFFF] font-semibold text-xs truncate">Fast Dispatch</p>
                <p className="text-[10px] text-[#FFFFFF]/70 truncate">Countrywide Kenya</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#000000] border border-[#383838]">
              <div className="h-8 w-8 rounded-lg bg-[#1a1a1a] border border-[#333333] text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[#FFFFFF] font-semibold text-xs truncate">Verified M-Pesa</p>
                <p className="text-[10px] text-[#FFFFFF]/70 truncate">Instant STK / Till</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#000000] border border-[#383838]">
              <div className="h-8 w-8 rounded-lg bg-[#1a1a1a] border border-[#333333] text-amber-400 flex items-center justify-center shrink-0">
                <RotateCcw className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[#FFFFFF] font-semibold text-xs truncate">Easy Returns</p>
                <p className="text-[10px] text-[#FFFFFF]/70 truncate">7-Day Guarantee</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#000000] border border-[#383838]">
              <div className="h-8 w-8 rounded-lg bg-[#1a1a1a] border border-[#333333] text-sky-400 flex items-center justify-center shrink-0">
                <Lock className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[#FFFFFF] font-semibold text-xs truncate">256-Bit SSL</p>
                <p className="text-[10px] text-[#FFFFFF]/70 truncate">PCI-DSS Compliant</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Footer Body */}
      <div className="w-full px-4 pt-10 pb-6 sm:px-6 lg:px-12 xl:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Brand & Direct Contact Column */}
          <div className="lg:col-span-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <VeloceLogo size="md" light />
              </div>

              <p className="mt-3.5 text-xs text-[#FFFFFF]/85 leading-relaxed font-light max-w-sm">
                {tagline}
              </p>

              {/* Direct Tap Action Buttons for Mobile */}
              <div className="mt-5 space-y-2 text-xs">
                <a
                  href={`tel:${rawPhone}`}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#000000] hover:bg-[#111111] border border-[#383838] hover:border-[#555555] transition-all text-[#FFFFFF] active:scale-[0.99] group cursor-pointer"
                >
                  <div className="h-7 w-7 rounded-lg bg-[#1a1a1a] text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-[#252525] transition-colors">
                    <Phone className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] text-[#FFFFFF]/70 font-mono uppercase tracking-wider">
                      Direct Concierge
                    </span>
                    <span className="font-mono text-xs font-bold text-[#FFFFFF] tracking-wide">
                      {supportPhone}
                    </span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-[#FFFFFF]/50 group-hover:text-[#FFFFFF] group-hover:translate-x-0.5 transition-all" />
                </a>

                <a
                  href={`mailto:${businessEmail}`}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#000000] hover:bg-[#111111] border border-[#383838] hover:border-[#555555] transition-all text-[#FFFFFF] active:scale-[0.99] group cursor-pointer"
                >
                  <div className="h-7 w-7 rounded-lg bg-[#1a1a1a] text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-[#252525] transition-colors">
                    <Mail className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] text-[#FFFFFF]/70 font-mono uppercase tracking-wider">
                      Email Inquiries
                    </span>
                    <span className="text-xs font-semibold text-[#FFFFFF] truncate block">
                      {businessEmail}
                    </span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-[#FFFFFF]/50 group-hover:text-[#FFFFFF] group-hover:translate-x-0.5 transition-all" />
                </a>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-transparent text-[#FFFFFF]/80 text-xs">
                  <MapPin className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{physicalAddress}</span>
                </div>
              </div>

              {/* Direct WhatsApp Concierge Button */}
              <div className="mt-4">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Chat with Ropenix concierge on WhatsApp"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#000000] hover:bg-[#111111] border border-[#383838] hover:border-[#25D366] text-[#FFFFFF] font-bold text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer group"
                >
                  <WhatsAppIcon className="h-4.5 w-4.5 text-[#25D366] group-hover:scale-110 transition-transform" />
                  <span>WhatsApp Fast Support</span>
                </a>
              </div>
            </div>

            {/* Social Channels (Buttons) */}
            <div className="mt-6 flex items-center gap-2.5">
              <a
                href="https://twitter.com/ropenix_ke"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter / X"
                className="h-9 w-9 rounded-xl bg-[#000000] hover:bg-[#111111] border border-[#383838] hover:border-[#555555] text-[#FFFFFF]/80 hover:text-[#FFFFFF] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="https://instagram.com/ropenix_ke"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="h-9 w-9 rounded-xl bg-[#000000] hover:bg-[#111111] border border-[#383838] hover:border-[#555555] text-[#FFFFFF]/80 hover:text-[#FFFFFF] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://facebook.com/ropenix_ke"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="h-9 w-9 rounded-xl bg-[#000000] hover:bg-[#111111] border border-[#383838] hover:border-[#555555] text-[#FFFFFF]/80 hover:text-[#FFFFFF] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="h-9 w-9 rounded-xl bg-[#000000] hover:bg-[#111111] border border-[#383838] hover:border-[#25D366] text-[#25D366] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                title="WhatsApp Concierge"
              >
                <WhatsAppIcon className="h-4.5 w-4.5" />
              </a>
            </div>
          </div>

          {/* Navigation Links Columns (Clean Text Links without Background Colors) */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            
            {/* 1. Ecosystem */}
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#FFFFFF] font-mono flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                <span>Ecosystem</span>
              </h4>
              <ul className="mt-3.5 flex flex-col gap-2.5 text-xs font-normal">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTab('store');
                      scrollToTop();
                    }}
                    className="w-full text-left py-1 text-[#FFFFFF]/75 hover:text-[#FFFFFF] hover:translate-x-0.5 transition-all cursor-pointer flex items-center justify-between group bg-transparent border-0"
                  >
                    <span className="group-hover:underline underline-offset-4">Proprietary Store</span>
                    <ChevronRight className="h-3 w-3 text-[#FFFFFF]/40 group-hover:text-[#FFFFFF] transition-colors" />
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTab('services');
                      scrollToTop();
                    }}
                    className="w-full text-left py-1 text-[#FFFFFF]/75 hover:text-[#FFFFFF] hover:translate-x-0.5 transition-all cursor-pointer flex items-center justify-between group bg-transparent border-0"
                  >
                    <span className="group-hover:underline underline-offset-4">Bespoke Consultation</span>
                    <ChevronRight className="h-3 w-3 text-[#FFFFFF]/40 group-hover:text-[#FFFFFF] transition-colors" />
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTab('blog');
                      scrollToTop();
                    }}
                    className="w-full text-left py-1 text-[#FFFFFF]/75 hover:text-[#FFFFFF] hover:translate-x-0.5 transition-all cursor-pointer flex items-center justify-between group bg-transparent border-0"
                  >
                    <span className="group-hover:underline underline-offset-4">Ropenix Insights</span>
                    <ChevronRight className="h-3 w-3 text-[#FFFFFF]/40 group-hover:text-[#FFFFFF] transition-colors" />
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTab('home');
                      scrollToTop();
                    }}
                    className="w-full text-left py-1 text-[#FFFFFF]/75 hover:text-[#FFFFFF] hover:translate-x-0.5 transition-all cursor-pointer flex items-center justify-between group bg-transparent border-0"
                  >
                    <span className="group-hover:underline underline-offset-4">Brand Overview</span>
                    <ChevronRight className="h-3 w-3 text-[#FFFFFF]/40 group-hover:text-[#FFFFFF] transition-colors" />
                  </button>
                </li>
              </ul>
            </div>

            {/* 2. Customer Care & Policies */}
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#FFFFFF] font-mono flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Client Services</span>
              </h4>
              <ul className="mt-3.5 flex flex-col gap-2.5 text-xs font-normal">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTab('user');
                      scrollToTop();
                    }}
                    className="w-full text-left py-1 text-[#FFFFFF]/75 hover:text-[#FFFFFF] hover:translate-x-0.5 transition-all cursor-pointer flex items-center justify-between group bg-transparent border-0"
                  >
                    <span className="group-hover:underline underline-offset-4">Order Tracking</span>
                    <ChevronRight className="h-3 w-3 text-[#FFFFFF]/40 group-hover:text-[#FFFFFF] transition-colors" />
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTab('privacy');
                      scrollToTop();
                    }}
                    className="w-full text-left py-1 text-[#FFFFFF]/75 hover:text-[#FFFFFF] hover:translate-x-0.5 transition-all cursor-pointer flex items-center justify-between group bg-transparent border-0"
                  >
                    <span className="group-hover:underline underline-offset-4">Privacy &amp; Data Policy</span>
                    <ChevronRight className="h-3 w-3 text-[#FFFFFF]/40 group-hover:text-[#FFFFFF] transition-colors" />
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTab('unsubscribe');
                      scrollToTop();
                    }}
                    className="w-full text-left py-1 text-rose-300/80 hover:text-rose-300 hover:translate-x-0.5 transition-all cursor-pointer flex items-center justify-between group bg-transparent border-0"
                  >
                    <span className="group-hover:underline underline-offset-4">Email Preferences</span>
                    <ChevronRight className="h-3 w-3 text-rose-400/40 group-hover:text-rose-300 transition-colors" />
                  </button>
                </li>
              </ul>
            </div>

            {/* 3. Newsletter Widget */}
            <div className="bg-[#1e1e1e] p-4 sm:p-5 rounded-2xl border border-[#383838]">
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#FFFFFF] font-mono flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-indigo-400" />
                <span>VIP Newsletter</span>
              </h4>
              <p className="mt-2 text-[11px] text-[#FFFFFF]/80 leading-relaxed font-light">
                Receive drops &amp; exclusive 10% welcome voucher on join.
              </p>
              <div className="mt-3">
                <NewsletterSubscription variant="compact" source="Footer Widget" />
              </div>
            </div>

          </div>
        </div>

        {/* 3. Accepted Payment Methods Strip (M-Pesa & Cash on Delivery Only) */}
        <div className="mt-10 pt-6 border-t border-[#333333] flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <span className="font-mono uppercase font-bold text-[#FFFFFF]/70 mr-1">Accepted Payments:</span>
            <span className="px-2.5 py-1 rounded-lg bg-[#000000] border border-[#383838] text-emerald-400 font-mono font-bold flex items-center gap-1.5 shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block"></span>
              M-PESA
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#000000] border border-[#383838] text-[#FFFFFF] font-mono font-bold flex items-center gap-1.5 shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block"></span>
              CASH ON DELIVERY
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <button
              type="button"
              onClick={scrollToTop}
              aria-label="Scroll back to top of page"
              className="flex items-center gap-1.5 text-[#FFFFFF]/80 hover:text-[#FFFFFF] font-mono text-[10px] uppercase font-bold transition-all cursor-pointer py-1.5 px-3 rounded-lg bg-[#000000] hover:bg-[#111111] border border-[#383838] hover:border-[#555555] active:scale-95"
            >
              <span>Back to Top</span>
              <ArrowUpCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 4. Bottom Legal & Copyright Bar */}
        <div className="mt-6 pt-4 border-t border-[#333333] flex flex-col sm:flex-row justify-between items-center text-center sm:text-left text-xs text-[#FFFFFF]/75 font-light gap-2">
          <p className="text-[11px] leading-relaxed">
            © {currentYear} {siteName}. All rights reserved. Powered by Ropenix Investments Limited.
          </p>
          <p className="text-[10px] font-mono text-[#FFFFFF]/60">
            Nairobi, Kenya • SECURE ENCRYPTED GATEWAY
          </p>
        </div>
      </div>
    </footer>
  );
}

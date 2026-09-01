/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Mail, Facebook, Twitter, Instagram, ArrowUpCircle } from 'lucide-react';
import VeloceLogo from './VeloceLogo';
import NewsletterSubscription from './NewsletterSubscription';

interface FooterProps {
  setCurrentTab: (tab: string) => void;
}

export default function Footer({ setCurrentTab }: FooterProps) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full bg-gray-950 text-gray-200 border-t border-gray-900 mt-20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand */}
          <div className="md:col-span-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <VeloceLogo size="md" light />
              </div>
              <p className="mt-4 text-xs font-extralight text-gray-400 leading-relaxed max-w-xs">
                Premium master accessories engineered with solid Oak and carbon steel. Curators of professional workspace machinery and high-output digital assets.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-4 text-gray-400">
              <a href="https://twitter.com/veloce_ke" target="_blank" rel="noopener noreferrer" aria-label="Visit Veloce Twitter / X profile" title="Twitter / X" className="hover:text-white transition-colors"><Twitter className="h-4 w-4" /></a>
              <a href="https://instagram.com/veloce_ke" target="_blank" rel="noopener noreferrer" aria-label="Visit Veloce Instagram profile" title="Instagram" className="hover:text-white transition-colors"><Instagram className="h-4 w-4" /></a>
              <a href="https://facebook.com/veloce_ke" target="_blank" rel="noopener noreferrer" aria-label="Visit Veloce Facebook page" title="Facebook" className="hover:text-white transition-colors"><Facebook className="h-4 w-4" /></a>
            </div>
          </div>

          {/* Nav groups */}
          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-6">
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">Ecosystem</h4>
              <ul className="mt-4 flex flex-col gap-2.5 text-xs text-gray-400 font-extralight">
                <li><button onClick={() => setCurrentTab('store')} className="hover:text-white bg-transparent">Proprietary Store</button></li>
                <li><button onClick={() => setCurrentTab('services')} className="hover:text-white bg-transparent">Consultation Booking</button></li>
                <li><button onClick={() => setCurrentTab('blog')} className="hover:text-white bg-transparent">Veloce Insights</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">Company</h4>
              <ul className="mt-4 flex flex-col gap-2.5 text-xs text-gray-400 font-extralight">
                <li><button onClick={() => setCurrentTab('home')} className="hover:text-white bg-transparent text-left cursor-pointer">Overview</button></li>
                <li><button onClick={() => { setCurrentTab('home'); setTimeout(() => { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }, 100); }} className="hover:text-white bg-transparent text-left cursor-pointer">Mission story</button></li>
                <li><button onClick={() => setCurrentTab('privacy')} className="hover:text-white bg-transparent text-left cursor-pointer">Privacy Policy</button></li>
                <li><button onClick={() => setCurrentTab('unsubscribe')} className="hover:text-rose-400 bg-transparent text-left cursor-pointer">Email Preferences & Unsubscribe</button></li>
                <li><button onClick={() => window.dispatchEvent(new CustomEvent('veloce_open_cookie_settings'))} className="hover:text-white bg-transparent text-left cursor-pointer">Cookie Settings</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">Newsletter</h4>
              <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
                Receive workspace blueprints & exclusive 10% welcome voucher.
              </p>
              <div className="mt-3">
                <NewsletterSubscription variant="compact" source="Footer Widget" />
              </div>
              <ul className="mt-4 flex flex-col gap-2 text-xs text-gray-400 font-extralight">
                <li className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> support@marid.co.ke</li>
                <li className="font-mono text-[10px] text-emerald-400">● VERIFIED TLS NODE ACTIVE</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-gray-900 pt-8 flex flex-col sm:flex-row justify-between items-center text-xs text-gray-500 font-light gap-4">
          <p>© 2026 Veloce Collective. Meticulously engineered in San Francisco. All rights reserved.</p>
          <button
            onClick={scrollToTop}
            aria-label="Scroll back to top of page"
            className="flex items-center gap-1.5 hover:text-white font-mono text-[10px] uppercase font-bold"
          >
            Scroll to summit <ArrowUpCircle className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}

import React from 'react';
import { ShieldCheck, Truck, RotateCcw, Smartphone } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 text-sm mt-20 border-t border-slate-800">
      {/* Value propositions banner */}
      <div className="border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-4 gap-6 text-slate-300">
          <div className="flex items-center gap-3">
            <Smartphone className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider font-mono">Instant M-Pesa</h4>
              <p className="text-xs text-slate-400">Zero-fee instant STK push checkout.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Truck className="w-6 h-6 text-indigo-400 shrink-0" />
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider font-mono">East Africa Express</h4>
              <p className="text-xs text-slate-400">Doorstep delivery across KE, UG, TZ, RW.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-violet-400 shrink-0" />
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider font-mono">100% Guaranteed</h4>
              <p className="text-xs text-slate-400">Authentic high-grade performance gear.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <RotateCcw className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider font-mono">Easy 7-Day Returns</h4>
              <p className="text-xs text-slate-400">Hassle-free regional return drop-offs.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <p>© 2026 Veloce Direct-to-Consumer Hub. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-white transition-colors">Sitemap</a>
        </div>
      </div>
    </footer>
  );
}

import React, { useEffect, useState, useMemo } from 'react';
import { Mail, X, Check, ArrowRight, ShieldAlert, CheckCircle2, Clock, Truck, ShoppingBag, Send, Tag, Bell, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface EmailNotification {
  id: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  body: string;
  status: string;
  timestamp: string;
  recipientType?: 'customer' | 'admin';
  category?: string;
}

interface EmailToasterProps {
  toasts: EmailNotification[];
  onDismiss: (id: string) => void;
  isAdminView?: boolean;
}

export default function EmailToaster({ toasts, onDismiss, isAdminView = false }: EmailToasterProps) {
  // Deduplicate and filter notifications to avoid redundant stacked toasts
  const visibleToasts = useMemo(() => {
    const seen = new Set<string>();
    const result: EmailNotification[] = [];

    for (const toast of toasts) {
      if (!toast) continue;

      // Filter internal admin alerts if viewing from public storefront
      if (!isAdminView) {
        if (toast.recipientType === 'admin') continue;
        if (toast.subject && toast.subject.includes('[ADMIN')) continue;
        if (toast.customerEmail && toast.customerEmail.toLowerCase().includes('ropenixkenya@gmail.com')) continue;
      }

      // Deduplication signature: orderId + subject + customerEmail + category
      const signature = `${toast.orderId || ''}_${toast.subject || ''}_${toast.customerEmail || ''}_${toast.category || ''}`;
      if (seen.has(signature)) {
        continue;
      }
      seen.add(signature);
      result.push(toast);

      // Show at most 3 simultaneous toasts to prevent screen crowding
      if (result.length >= 3) break;
    }

    return result;
  }, [toasts, isAdminView]);

  return (
    <aside aria-label="System Notifications" className="fixed bottom-16 sm:bottom-5 right-3 sm:right-5 left-3 sm:left-auto z-[9999] flex flex-col gap-2.5 w-auto max-w-[calc(100%-1.5rem)] sm:max-w-[370px] pointer-events-none no-print">
      <AnimatePresence mode="popLayout">
        {visibleToasts.map((toast) => (
          <EmailToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </aside>
  );
}

function EmailToastItem({ toast, onDismiss }: { toast: EmailNotification; onDismiss: (id: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeLeft, setTimeLeft] = useState(100); // percentage for countdown progress bar
  const [isHovered, setIsHovered] = useState(false);

  // Maximum on-screen duration: 2.0 seconds (2000ms)
  const DURATION_MS = 2000;

  useEffect(() => {
    // If user expands or hovers, pause the auto-dismiss timer so they can read
    if (isExpanded || isHovered) return;

    const intervalTime = 40; // 40ms updates for smooth 60fps countdown bar
    const totalSteps = DURATION_MS / intervalTime;
    let currentStep = (100 - timeLeft) / (100 / totalSteps);

    const timer = setInterval(() => {
      currentStep += 1;
      const percent = Math.max(0, 100 - (currentStep / totalSteps) * 100);
      setTimeLeft(percent);

      if (currentStep >= totalSteps) {
        clearInterval(timer);
        onDismiss(toast.id);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [toast.id, onDismiss, isExpanded, isHovered, timeLeft]);

  const getStatusStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('completed') || s.includes('delivered') || s.includes('approved') || s.includes('verified')) {
      return {
        bg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300',
        progressBar: 'from-emerald-500 to-teal-400',
        icon: CheckCircle2,
      };
    }
    if (s.includes('cancelled') || s.includes('low-stock') || s.includes('rejected') || s.includes('blocked')) {
      return {
        bg: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20',
        badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300',
        progressBar: 'from-rose-500 to-pink-500',
        icon: ShieldAlert,
      };
    }
    if (s.includes('shipped') || s.includes('transit')) {
      return {
        bg: 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        badgeBg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300',
        progressBar: 'from-indigo-500 to-blue-500',
        icon: Truck,
      };
    }
    if (s.includes('pending') || s.includes('warning')) {
      return {
        bg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20',
        badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300',
        progressBar: 'from-amber-500 to-yellow-400',
        icon: Clock,
      };
    }
    if (s.includes('price-drop')) {
      return {
        bg: 'bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/20',
        badgeBg: 'bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300',
        progressBar: 'from-violet-500 to-purple-500',
        icon: Tag,
      };
    }
    return {
      bg: 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
      progressBar: 'from-indigo-500 to-cyan-400',
      icon: ShoppingBag,
    };
  };

  const style = getStatusStyle(toast.status);
  const StatusIcon = style.icon;
  const isAdmin = toast.recipientType === 'admin';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 25, scale: 0.94, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -15, scale: 0.92, filter: 'blur(4px)', transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="pointer-events-auto w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-xl hover:shadow-2xl border border-slate-200/80 dark:border-slate-800/90 overflow-hidden flex flex-col transition-all duration-200 ring-1 ring-black/5 dark:ring-white/5"
    >
      {/* Top Banner Tab */}
      <div className={`px-3 py-1.5 flex items-center justify-between text-[10px] font-mono tracking-wider text-white ${
        isAdmin 
          ? 'bg-gradient-to-r from-amber-700 via-amber-800 to-amber-950' 
          : 'bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950'
      }`}>
        <div className="flex items-center gap-1.5 text-slate-100">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isAdmin ? 'bg-amber-400' : 'bg-emerald-400'
            }`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              isAdmin ? 'bg-amber-400' : 'bg-emerald-500'
            }`} />
          </span>
          <Mail className={`h-3 w-3 shrink-0 ${isAdmin ? 'text-amber-300' : 'text-indigo-300'}`} />
          <span className="font-bold text-[10px] uppercase tracking-wider">
            {isAdmin ? '👑 Admin Notification' : '📬 Customer Email Dispatch'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-[9.5px] font-mono">{toast.timestamp}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-white/60 hover:text-white p-0.5 rounded hover:bg-white/15 transition-colors cursor-pointer"
            title="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Notification Body */}
      <div className="p-3 flex gap-2.5 items-start">
        {/* Status Bubble */}
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${style.bg} mt-0.5`}>
          <StatusIcon className="h-4 w-4" />
        </div>

        {/* Content Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 font-mono truncate max-w-[190px]">
              To: {toast.customerEmail}
            </span>
            <span className={`text-[8.5px] uppercase font-bold px-1.5 py-0.5 rounded-md shrink-0 ${style.badgeBg}`}>
              {toast.category || (isAdmin ? 'Admin' : 'Delivery Notice')}
            </span>
          </div>

          <h4 className="text-[12px] font-bold text-slate-900 dark:text-slate-100 font-sans tracking-tight leading-tight truncate">
            {toast.subject}
          </h4>

          <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-normal mt-0.5 line-clamp-2 leading-relaxed">
            {toast.body}
          </p>

          {/* Quick Body Expand Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-1.5 text-[9px] font-semibold font-mono text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
          >
            {isExpanded ? 'Hide Details ▲' : 'View Full Snippet ▼'}
          </button>

          {/* Expandable Preview */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1, marginTop: 6 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 rounded-md p-2 font-mono text-[9px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed select-text"
              >
                <div className="text-[8px] text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1 mb-1 flex justify-between uppercase">
                  <span>Server Queue: Authoritative SMTP</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                    <Send className="h-2 w-2" /> Dispatched
                  </span>
                </div>
                {toast.body}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 2-Second Visual Countdown Bar */}
      <div className="h-[2px] w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div 
          className={`h-full bg-gradient-to-r ${style.progressBar} transition-all duration-75 ease-linear`}
          style={{ width: `${timeLeft}%` }}
        />
      </div>
    </motion.div>
  );
}

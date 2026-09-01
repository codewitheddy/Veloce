import React, { useEffect, useState } from 'react';
import { Mail, X, Check, ArrowRight, ShieldAlert, CheckCircle2, Clock, Truck, ShoppingBag, Send, Tag } from 'lucide-react';
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
  const visibleToasts = toasts.filter((toast) => {
    // Hide internal administrator alerts from public shoppers
    if (!isAdminView) {
      if (toast.recipientType === 'admin') return false;
      if (toast.subject && toast.subject.includes('[ADMIN')) return false;
      if (toast.customerEmail && toast.customerEmail.toLowerCase().includes('ropenixkenya@gmail.com')) return false;
    }
    return true;
  });

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3.5 max-w-sm w-full pointer-events-none no-print">
      <AnimatePresence mode="popLayout">
        {visibleToasts.map((toast) => (
          <EmailToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function EmailToastItem({ toast, onDismiss }: { toast: EmailNotification; onDismiss: (id: string) => void; key?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeLeft, setTimeLeft] = useState(100); // percentage for progress bar

  useEffect(() => {
    const duration = 9000; // 9 seconds
    const intervalTime = 100;
    const steps = duration / intervalTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep += 1;
      const percent = 100 - (currentStep / steps) * 100;
      setTimeLeft(Math.max(0, percent));

      if (currentStep >= steps) {
        clearInterval(timer);
        onDismiss(toast.id);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [toast.id, onDismiss]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
      case 'approved':
      case 'return-approved':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/30',
          text: 'text-emerald-800 dark:text-emerald-400',
          icon: CheckCircle2,
          colorCode: 'emerald'
        };
      case 'cancelled':
      case 'low-stock':
      case 'rejected':
      case 'return-rejected':
        return {
          bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/30',
          text: 'text-rose-800 dark:text-rose-400',
          icon: ShieldAlert,
          colorCode: 'rose'
        };
      case 'resolved':
      case 'return-resolved':
        return {
          bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/30',
          text: 'text-indigo-800 dark:text-indigo-400',
          icon: CheckCircle2,
          colorCode: 'indigo'
        };
      case 'shipped':
      case 'received':
      case 'return-received':
        return {
          bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/30',
          text: 'text-purple-800 dark:text-purple-400',
          icon: Truck,
          colorCode: 'purple'
        };
      case 'pending-cancellation':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/30',
          text: 'text-amber-800 dark:text-amber-400',
          icon: Clock,
          colorCode: 'amber'
        };
      case 'processing':
        return {
          bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/30',
          text: 'text-indigo-800 dark:text-indigo-400',
          icon: Clock,
          colorCode: 'indigo'
        };
      case 'price-drop':
        return {
          bg: 'bg-violet-50 dark:bg-violet-950/40 border-violet-150 dark:border-violet-900/30',
          text: 'text-violet-800 dark:text-violet-400',
          icon: Tag,
          colorCode: 'violet'
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-900/80 border-gray-150 dark:border-gray-800',
          text: 'text-gray-800 dark:text-gray-300',
          icon: ShoppingBag,
          colorCode: 'gray'
        };
    }
  };

  const config = getStatusStyle(toast.status);
  const StatusIcon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, x: 100, transition: { duration: 0.25 } }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      className="pointer-events-auto w-full bg-white dark:bg-gray-950 rounded-xl shadow-xl border border-gray-200 dark:border-gray-850 overflow-hidden flex flex-col hover:shadow-2xl transition-all"
    >
      {/* simulated mail header tab */}
      <div className={`px-3 py-1.5 flex items-center justify-between text-[10px] font-mono tracking-wider text-white ${
        toast.recipientType === 'admin' ? 'bg-amber-950' : 'bg-slate-900'
      }`}>
        <div className="flex items-center gap-1.5 text-slate-200">
          <Mail className={`h-3 w-3 shrink-0 ${toast.recipientType === 'admin' ? 'text-amber-400' : 'text-indigo-400'}`} />
          <span className="font-bold">
            {toast.recipientType === 'admin' ? '👑 OWNER / ADMIN ALERT' : '📬 CUSTOMER EMAIL SYSTEM'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">{toast.timestamp}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Toast Content Body */}
      <div className="p-3.5 flex gap-3">
        {/* Status indicator bubble icon */}
        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 border ${config.bg}`}>
          <StatusIcon className={`h-4.5 w-4.5 ${config.text}`} />
        </div>

        {/* Text information */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 font-mono tracking-tight break-all truncate">
              To: {toast.customerEmail}
            </span>
            <span className={`text-[8px] uppercase font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
              toast.recipientType === 'admin' 
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300' 
                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
            }`}>
              {toast.category || (toast.recipientType === 'admin' ? 'Admin Alert' : 'Customer Notice')}
            </span>
          </div>

          <h5 className="text-[11.5px] font-extrabold text-gray-900 dark:text-gray-100 font-sans tracking-tight leading-tight mt-1 truncate">
            {typeof toast.subject === 'string'
              ? toast.subject
              : typeof (toast as any)?.title === 'string'
              ? (toast as any).title
              : 'System Notification'}
          </h5>

          <p className="text-[10.5px] text-gray-500 dark:text-gray-400 font-light mt-1 line-clamp-2 leading-relaxed">
            {typeof toast.body === 'string'
              ? toast.body
              : typeof (toast as any)?.message === 'string'
              ? (toast as any).message
              : ''}
          </p>

          {/* Expand/Collapse Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-[9px] font-bold font-mono tracking-wider text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-0.5 transition-all cursor-pointer"
          >
            {isExpanded ? 'Collapse Full Email ⬆️' : 'Read Full Email Body ⬇️'}
          </button>

          {/* Full email preview collapse */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1, marginTop: 8 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-850 rounded-lg p-2.5 font-mono text-[9px] text-slate-700 dark:text-slate-350 whitespace-pre-wrap leading-relaxed select-text"
              >
                <div className="text-[8px] text-slate-400 border-b border-slate-150/50 dark:border-slate-800 pb-1 mb-1.5 flex justify-between uppercase">
                  <span>From: no-reply@veloce-rewards.com</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-0.5">
                    <Send className="h-2 w-2" /> Sent successfully
                  </span>
                </div>
                {typeof toast.body === 'string' ? toast.body : (toast as any)?.message || ''}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Expiration visual countdown bar */}
      <div className="h-[2.5px] w-full bg-gray-100 dark:bg-gray-900/40">
        <div 
          className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-100 ease-linear"
          style={{ width: `${timeLeft}%` }}
        />
      </div>
    </motion.div>
  );
}

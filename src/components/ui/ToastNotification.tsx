/**
 * Toast Notification Viewport & Item Components
 * Renders high-craft, accessible toast notifications with auto-dismiss progress,
 * collapsible validation breakdowns, and customizable action triggers.
 */

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldAlert,
  Lock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast, ToastItem } from '../../lib/toast';

export function useToastNotifications(): ToastItem[] {
  const [toasts, setToasts] = useState<ToastItem[]>(() => toast.getToasts());

  useEffect(() => {
    const unsubscribe = toast.subscribe((updatedToasts) => {
      setToasts(updatedToasts);
    });
    return unsubscribe;
  }, []);

  return toasts;
}

export function ToastContainer() {
  const toasts = useToastNotifications();

  return (
    <div
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-md w-full pointer-events-none p-2 sm:p-0"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastCard key={t.id} toastItem={t} onDismiss={(id) => toast.dismiss(id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ToastCardProps {
  toastItem: ToastItem;
  onDismiss: (id: string) => void;
}

function ToastCard({ toastItem, onDismiss }: ToastCardProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(toastItem.duration || 5000);

  useEffect(() => {
    if (!toastItem.duration || toastItem.duration <= 0) return;

    let intervalId: any;
    const duration = toastItem.duration;

    if (!isPaused) {
      startTimeRef.current = Date.now();
      const step = 50;

      intervalId = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const currentRemaining = Math.max(0, remainingTimeRef.current - elapsed);
        const percent = (currentRemaining / duration) * 100;
        setProgress(percent);

        if (currentRemaining <= 0) {
          clearInterval(intervalId);
          onDismiss(toastItem.id);
        }
      }, step);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPaused, toastItem.id, toastItem.duration, onDismiss]);

  const handleMouseEnter = () => {
    if (!toastItem.duration || toastItem.duration <= 0) return;
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    if (!toastItem.duration || toastItem.duration <= 0) return;
    setIsPaused(false);
  };

  // Determine icon & color palette based on status code and type
  const getStyling = () => {
    if (toastItem.statusCode === 401) {
      return {
        icon: Lock,
        border: 'border-amber-400/40 dark:border-amber-500/40',
        bg: 'bg-white dark:bg-slate-900',
        badgeBg: 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300',
        iconColor: 'text-amber-600 dark:text-amber-400',
        progressBar: 'bg-amber-500',
        role: 'alert',
      };
    }
    if (toastItem.statusCode === 403) {
      return {
        icon: ShieldAlert,
        border: 'border-rose-400/40 dark:border-rose-500/40',
        bg: 'bg-white dark:bg-slate-900',
        badgeBg: 'bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-300',
        iconColor: 'text-rose-600 dark:text-rose-400',
        progressBar: 'bg-rose-500',
        role: 'alert',
      };
    }
    if (toastItem.type === 'error') {
      return {
        icon: AlertCircle,
        border: 'border-red-400/40 dark:border-red-500/40',
        bg: 'bg-white dark:bg-slate-900',
        badgeBg: 'bg-red-100 text-red-900 dark:bg-red-950/80 dark:text-red-300',
        iconColor: 'text-red-600 dark:text-red-400',
        progressBar: 'bg-red-500',
        role: 'alert',
      };
    }
    if (toastItem.type === 'warning') {
      return {
        icon: AlertTriangle,
        border: 'border-amber-400/40 dark:border-amber-500/40',
        bg: 'bg-white dark:bg-slate-900',
        badgeBg: 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300',
        iconColor: 'text-amber-600 dark:text-amber-400',
        progressBar: 'bg-amber-500',
        role: 'status',
      };
    }
    if (toastItem.type === 'success') {
      return {
        icon: CheckCircle2,
        border: 'border-emerald-400/40 dark:border-emerald-500/40',
        bg: 'bg-white dark:bg-slate-900',
        badgeBg: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        progressBar: 'bg-emerald-500',
        role: 'status',
      };
    }
    // Default info
    return {
      icon: Info,
      border: 'border-blue-400/40 dark:border-blue-500/40',
      bg: 'bg-white dark:bg-slate-900',
      badgeBg: 'bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-300',
      iconColor: 'text-blue-600 dark:text-blue-400',
      progressBar: 'bg-blue-500',
      role: 'status',
    };
  };

  const style = getStyling();
  const Icon = style.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`pointer-events-auto w-full rounded-xl shadow-xl shadow-slate-900/10 dark:shadow-black/40 border ${style.border} ${style.bg} overflow-hidden backdrop-blur-md transition-shadow hover:shadow-2xl`}
      role={style.role}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon Badge */}
          <div className={`p-2 rounded-lg shrink-0 ${style.badgeBg} ${style.iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>

          {/* Body Content */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                {toastItem.title}
              </h4>
              {toastItem.statusCode && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  HTTP {toastItem.statusCode}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
              {toastItem.message}
            </p>

            {/* Validation Details Breakdown */}
            {toastItem.details && toastItem.details.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setDetailsExpanded(!detailsExpanded)}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <span>
                    {detailsExpanded ? 'Hide' : 'Show'} validation issues ({toastItem.details.length})
                  </span>
                  {detailsExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                <AnimatePresence>
                  {detailsExpanded && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-2 space-y-1 text-[11px] text-red-700 dark:text-red-300 bg-red-50/60 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-100 dark:border-red-900/30 max-h-36 overflow-y-auto"
                    >
                      {toastItem.details.map((detail, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 leading-snug">
                          <span className="text-red-500 font-bold shrink-0">•</span>
                          <span className="font-mono text-[10.5px]">{detail}</span>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Action Buttons */}
            {toastItem.action && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    toastItem.action?.onClick();
                    onDismiss(toastItem.id);
                  }}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-xs ${
                    toastItem.action.primary !== false
                      ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {toastItem.action.label}
                </button>
              </div>
            )}
          </div>

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={() => onDismiss(toastItem.id)}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-1 rounded-md transition-colors -mr-1 -mt-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Auto-Dismiss Progress Bar */}
      {toastItem.duration && toastItem.duration > 0 && (
        <div className="h-0.5 w-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
          <div
            className={`h-full ${style.progressBar} transition-all duration-75`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </motion.div>
  );
}

export default ToastContainer;

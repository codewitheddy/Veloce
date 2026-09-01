import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Sparkles, X, ArrowRight, Flame, Gift } from 'lucide-react';
import { useHappyHourStatus } from '../hooks/useHappyHourStatus';

export interface HappyHourBannerProps {
  onActionClick?: () => void;
  actionText?: string;
  className?: string;
  showWhenUpcoming?: boolean;
  dismissible?: boolean;
  variant?: 'full' | 'compact' | 'sticky';
}

export function HappyHourBanner({
  onActionClick,
  actionText,
  className = '',
  showWhenUpcoming = true,
  dismissible = true,
}: HappyHourBannerProps) {
  const happyHour = useHappyHourStatus();
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  // If dismissed or if not showing when upcoming and happy hour is not active
  if (isDismissed) {
    return null;
  }

  if (!happyHour.isActive && !showWhenUpcoming) {
    return null;
  }

  const {
    isActive,
    discountPercentage,
    timeRemaining,
    title,
    description,
  } = happyHour;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.99 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={`relative overflow-hidden rounded-2xl border transition-all ${
          isActive
            ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/80 shadow-xs'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
        } ${className}`}
      >
        <div className="relative z-10 px-4 py-3.5 sm:px-6 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          {/* Left Column: Icon, Badges & Title */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center border transition-all ${
                isActive
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs animate-pulse'
                  : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50'
              }`}
            >
              {isActive ? (
                <Flame className="h-5 w-5 fill-current" />
              ) : (
                <Gift className="h-5 w-5" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider uppercase border ${
                    isActive
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                      : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800'
                  }`}
                >
                  <Sparkles className={`h-3 w-3 ${isActive ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
                  {isActive ? 'HAPPY HOUR LIVE NOW' : 'DAILY HAPPY HOUR'}
                </span>

                <span className="text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500 text-white shadow-3xs uppercase">
                  {discountPercentage}% OFF DELIVERY
                </span>
              </div>

              <h4 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                {title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-normal max-w-xl leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          {/* Right Column: Countdown Timer & CTA Button */}
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 border-t md:border-t-0 border-slate-100 dark:border-slate-800 pt-2.5 md:pt-0 shrink-0">
            {/* Countdown Box */}
            <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <Clock className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="text-left">
                <span className="block text-[9px] font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {isActive ? 'Ends In' : 'Starts In'}
                </span>
                <span className="font-mono text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-wider">
                  {timeRemaining.formatted}
                </span>
              </div>
            </div>

            {/* Action CTA */}
            {onActionClick && (
              <button
                type="button"
                onClick={onActionClick}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all transform active:scale-95 cursor-pointer shadow-xs ${
                  isActive
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                <span>{actionText || (isActive ? 'Claim Discount' : 'View Deals')}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Dismiss Button */}
            {dismissible && (
              <button
                type="button"
                onClick={() => setIsDismissed(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default HappyHourBanner;

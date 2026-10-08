/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  AlertTriangle,
  Info,
  Tag,
  PackageX,
  TrendingDown,
  TrendingUp,
  X,
  CheckCircle2,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { CartChangeNotice } from '../hooks/useCartSync';

interface CartChangeNoticeProps {
  notices: CartChangeNotice[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  isValidating?: boolean;
  isStreamConnected?: boolean;
  onManualSync?: () => void;
}

export const CartChangeNoticeBanner: React.FC<CartChangeNoticeProps> = ({
  notices,
  onDismiss,
  onClearAll,
  isValidating = false,
  isStreamConnected = true,
  onManualSync,
}) => {
  if (notices.length === 0 && !isValidating) {
    return null;
  }

  const getNoticeIcon = (type: string) => {
    switch (type) {
      case 'PRICE_CHANGED':
        return <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />;
      case 'OUT_OF_STOCK':
      case 'PRODUCT_REMOVED':
        return <PackageX className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />;
      case 'QUANTITY_ADJUSTED':
        return <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />;
      case 'COUPON_INVALID':
        return <Tag className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />;
    }
  };

  const getNoticeBgStyle = (type: string) => {
    switch (type) {
      case 'PRICE_CHANGED':
        return 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-100';
      case 'OUT_OF_STOCK':
      case 'PRODUCT_REMOVED':
        return 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-950 dark:text-rose-100';
      case 'QUANTITY_ADJUSTED':
        return 'bg-orange-50/90 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/60 text-orange-950 dark:text-orange-100';
      case 'COUPON_INVALID':
        return 'bg-purple-50/90 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/60 text-purple-950 dark:text-purple-100';
      default:
        return 'bg-blue-50/90 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60 text-blue-950 dark:text-blue-100';
    }
  };

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="w-full mb-5 transition-all duration-300"
    >
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-sm backdrop-blur-md overflow-hidden">
        {/* Header Status Strip */}
        <div className="px-4 py-2.5 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isStreamConnected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isStreamConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {isValidating
                ? 'Validating live store inventory...'
                : 'Live Store Sync: Cart Updated'}
            </span>
            {isValidating && (
              <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin" />
            )}
          </div>

          <div className="flex items-center gap-2">
            {onManualSync && (
              <button
                type="button"
                onClick={onManualSync}
                disabled={isValidating}
                className="text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white flex items-center gap-1 transition cursor-pointer"
                title="Force refresh cart validation"
              >
                <RefreshCw className={`w-3 h-3 ${isValidating ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClearAll();
                if (onManualSync) onManualSync();
              }}
              className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1 transition ml-2 cursor-pointer bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Acknowledge All ({notices.length})</span>
            </button>
          </div>
        </div>

        {/* List of active change notices */}
        <div className="p-3 space-y-2.5">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs transition-all duration-200 shadow-2xs ${getNoticeBgStyle(
                notice.type
              )}`}
            >
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <div className="mt-0.5">{getNoticeIcon(notice.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold leading-relaxed break-words">{notice.message}</p>
                  {notice.oldValue !== undefined && notice.newValue !== undefined && (
                    <div className="mt-1 flex items-center gap-2 text-[11px] opacity-85 font-mono">
                      <span className="line-through text-slate-400 dark:text-slate-500">
                        {String(notice.oldValue)}
                      </span>
                      <span>→</span>
                      <span className="font-bold">{String(notice.newValue)}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onDismiss(notice.id)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition shrink-0 cursor-pointer"
                aria-label={`Dismiss notice: ${notice.message}`}
                title="Dismiss notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Accept Adjustments Callout Button */}
          <div className="pt-1 flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                onClearAll();
                if (onManualSync) onManualSync();
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Accept Adjustments & Proceed to Checkout</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default CartChangeNoticeBanner;

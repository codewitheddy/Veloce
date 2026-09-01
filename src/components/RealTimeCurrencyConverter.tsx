/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  ArrowRightLeft, 
  Globe, 
  TrendingUp, 
  CheckCircle2, 
  DollarSign, 
  Award, 
  ShoppingBag, 
  X, 
  Sparkles, 
  Calculator, 
  BarChart2, 
  Check,
  Zap,
  Info
} from 'lucide-react';
import { 
  CurrencyType, 
  CURRENCY_NAMES, 
  CURRENCY_SYMBOLS, 
  DEFAULT_EXCHANGE_RATES, 
  getActiveRates, 
  fetchLiveExchangeRates, 
  formatPrice, 
  convertBetween,
  getLastRateUpdatedTime,
  getIsRatesLive,
  formatLoyaltyPointsValue
} from '../lib/currency';

interface RealTimeCurrencyConverterProps {
  isOpen: boolean;
  onClose: () => void;
  activeCurrency: CurrencyType;
  onChangeCurrency: (currency: CurrencyType) => void;
}

const SUPPORTED_CURRENCIES: CurrencyType[] = ['KSh', 'USD', 'EUR', 'GBP', 'CAD', 'JPY', 'AUD', 'ZAR'];

export default function RealTimeCurrencyConverter({
  isOpen,
  onClose,
  activeCurrency,
  onChangeCurrency,
}: RealTimeCurrencyConverterProps) {
  const [rates, setRates] = useState<Record<CurrencyType, number>>(() => getActiveRates());
  const [lastUpdated, setLastUpdated] = useState<string>(() => getLastRateUpdatedTime());
  const [isLive, setIsLive] = useState<boolean>(() => getIsRatesLive());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'calculator' | 'rates_table' | 'impact'>('calculator');

  // Calculator State
  const [calcAmount, setCalcAmount] = useState<number>(10000);
  const [calcFromCurrency, setCalcFromCurrency] = useState<CurrencyType>('KSh');
  const [calcToCurrency, setCalcToCurrency] = useState<CurrencyType>(activeCurrency === 'KSh' ? 'USD' : activeCurrency);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Subscribe to rate update events
  useEffect(() => {
    const handleRatesChanged = (e: any) => {
      if (e.detail) {
        setRates(e.detail.rates);
        setLastUpdated(e.detail.timestamp);
        setIsLive(e.detail.isLive);
      }
    };

    window.addEventListener('veloce_currency_rates_changed', handleRatesChanged);
    return () => {
      window.removeEventListener('veloce_currency_rates_changed', handleRatesChanged);
    };
  }, []);

  // Sync calcToCurrency with activeCurrency when opened
  useEffect(() => {
    if (isOpen) {
      setCalcToCurrency(activeCurrency);
    }
  }, [isOpen, activeCurrency]);

  if (!isOpen) return null;

  const handleFetchRates = async () => {
    setIsRefreshing(true);
    const result = await fetchLiveExchangeRates();
    setIsRefreshing(false);
    if (result.success) {
      setToastMessage('✅ Successfully synced latest live Forex market rates!');
    } else {
      setToastMessage('⚡ Offline fallback rates active (Forex API unreachable)');
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSwapCurrencies = () => {
    const temp = calcFromCurrency;
    setCalcFromCurrency(calcToCurrency);
    setCalcToCurrency(temp);
  };

  const convertedResult = convertBetween(calcAmount, calcFromCurrency, calcToCurrency);
  const rateMultiplier = convertBetween(1, calcFromCurrency, calcToCurrency);
  const inverseMultiplier = convertBetween(1, calcToCurrency, calcFromCurrency);

  // Sample Product & Rewards for Impact View
  const sampleProductPriceKES = 11570; // Veloce MagSafe Stand
  const sampleLoyaltyPoints = 500; // 500 PTS
  const sampleCartTotalKES = 24850; // Typical cart total

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-gray-900 border border-indigo-100 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-indigo-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 text-indigo-300">
              <Globe className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white font-sans tracking-tight">Real-Time Currency Engine</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 ${
                  isLive 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {isLive ? 'LIVE FOREX API' : 'OFFLINE RATES'}
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 font-light mt-0.5">
                Dynamic live rates automatically update all product prices, loyalty rewards, & checkout totals.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close Currency Converter"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Status Bar & Refresh Control */}
        <div className="bg-indigo-50/70 dark:bg-gray-800/60 px-5 py-2.5 border-b border-indigo-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 font-mono text-[11px]">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">Base: 1 KES</span>
            <span>•</span>
            <span>Updated: {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>

          <button
            onClick={handleFetchRates}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-indigo-200' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Live Rates'}</span>
          </button>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white px-5 py-2 text-xs font-semibold flex items-center gap-2 justify-center animate-in slide-in-from-top duration-200">
            <Sparkles className="h-4 w-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('calculator')}
            className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'calculator'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Calculator className="h-4 w-4" />
            <span>Currency Calculator</span>
          </button>

          <button
            onClick={() => setActiveTab('rates_table')}
            className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rates_table'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <BarChart2 className="h-4 w-4" />
            <span>Live Rate Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('impact')}
            className={`pb-2.5 px-3 font-semibold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'impact'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>Store Pricing Impact</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'calculator' && (
            <div className="space-y-6">
              {/* Input Amount & Presets */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider font-mono">
                  Convert Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={calcAmount || ''}
                    onChange={(e) => setCalcAmount(parseFloat(e.target.value) || 0)}
                    className="w-full text-2xl font-bold font-mono px-4 py-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-600 focus:outline-none transition-all"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-xl">
                    {CURRENCY_SYMBOLS[calcFromCurrency]}
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {[1000, 5000, 10000, 50000, 100000].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setCalcAmount(preset)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-mono font-medium transition-colors cursor-pointer ${
                        calcAmount === preset
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {preset.toLocaleString()} {CURRENCY_SYMBOLS[calcFromCurrency]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency Selectors & Swap */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
                <div className="sm:col-span-2 space-y-1">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">From Currency</span>
                  <select
                    value={calcFromCurrency}
                    onChange={(e) => setCalcFromCurrency(e.target.value as CurrencyType)}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-2xl px-3 py-2.5 font-bold text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-600 focus:outline-none cursor-pointer"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c} ({CURRENCY_SYMBOLS[c]}) - {CURRENCY_NAMES[c]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-center sm:col-span-1 pt-4 sm:pt-0">
                  <button
                    onClick={handleSwapCurrencies}
                    className="p-3 rounded-2xl bg-indigo-50 dark:bg-gray-800 hover:bg-indigo-100 dark:hover:bg-gray-700 border border-indigo-200 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer active:scale-90"
                    title="Swap From / To Currencies"
                  >
                    <ArrowRightLeft className="h-5 w-5" />
                  </button>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">To Currency</span>
                  <select
                    value={calcToCurrency}
                    onChange={(e) => setCalcToCurrency(e.target.value as CurrencyType)}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-2xl px-3 py-2.5 font-bold text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-600 focus:outline-none cursor-pointer"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c} ({CURRENCY_SYMBOLS[c]}) - {CURRENCY_NAMES[c]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conversion Result Display */}
              <div className="bg-indigo-50/40 dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-800/80 p-5 rounded-3xl space-y-3">
                <div className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Live Converted Equivalent
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-3xl sm:text-4xl font-extrabold font-mono text-gray-900 dark:text-white tracking-tight">
                    {CURRENCY_SYMBOLS[calcToCurrency]} {convertedResult.toLocaleString(undefined, { minimumFractionDigits: calcToCurrency === 'KSh' || calcToCurrency === 'JPY' ? 0 : 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs font-mono font-semibold text-gray-500 dark:text-gray-400">
                    {CURRENCY_NAMES[calcToCurrency]}
                  </div>
                </div>

                {/* Rate Detail */}
                <div className="pt-3 border-t border-indigo-100 dark:border-indigo-900/50 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-gray-600 dark:text-gray-300">
                  <div>
                    1 {calcFromCurrency} = <span className="font-bold text-indigo-600 dark:text-indigo-300">{rateMultiplier.toFixed(6)} {calcToCurrency}</span>
                  </div>
                  <div>
                    1 {calcToCurrency} = <span className="font-bold text-indigo-600 dark:text-indigo-300">{inverseMultiplier.toFixed(4)} {calcFromCurrency}</span>
                  </div>
                </div>
              </div>

              {/* Apply Active Store Currency Action */}
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-gray-900 dark:text-white">Set Store Active Currency</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Switch entire store prices to <span className="font-bold text-indigo-600 dark:text-indigo-400">{calcToCurrency} ({CURRENCY_SYMBOLS[calcToCurrency]})</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onChangeCurrency(calcToCurrency);
                    setToastMessage(`✨ Applied ${calcToCurrency} as active store currency!`);
                    setTimeout(() => {
                      onClose();
                    }, 800);
                  }}
                  className={`px-4 py-2 rounded-xl font-bold text-xs text-white transition-all shadow-md cursor-pointer flex items-center gap-1.5 ${
                    activeCurrency === calcToCurrency
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
                  }`}
                >
                  {activeCurrency === calcToCurrency ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Active Currency</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Apply {calcToCurrency}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'rates_table' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-gray-900 dark:text-white uppercase tracking-wider font-mono">
                  Live Global Exchange Rate Matrix (Base: KES)
                </h4>
                <span className="text-[11px] text-gray-500 font-mono">
                  8 Currencies Supported
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SUPPORTED_CURRENCIES.map((c) => {
                  const ratePerKes = rates[c] || DEFAULT_EXCHANGE_RATES[c];
                  const kesPerUnit = ratePerKes > 0 ? 1 / ratePerKes : 1;
                  const isCurrent = activeCurrency === c;

                  return (
                    <div
                      key={c}
                      onClick={() => onChangeCurrency(c)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                        isCurrent
                          ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-sm'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/80 hover:border-indigo-300 dark:hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-gray-700 flex items-center justify-center font-bold text-xs font-mono text-indigo-700 dark:text-indigo-300">
                            {CURRENCY_SYMBOLS[c]}
                          </div>
                          <div>
                            <span className="font-bold text-sm text-gray-900 dark:text-white font-mono">{c}</span>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">{CURRENCY_NAMES[c]}</p>
                          </div>
                        </div>

                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold font-mono">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-xs font-mono">
                        <span className="text-gray-500 dark:text-gray-400">1 KES =</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {CURRENCY_SYMBOLS[c]} {ratePerKes.toFixed(c === 'KSh' || c === 'JPY' ? 2 : 5)}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-gray-500 dark:text-gray-400">
                        <span>1 {c} =</span>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-300">
                          KSh {Math.round(kesPerUnit).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'impact' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-gray-800/70 border border-indigo-100 dark:border-gray-700 flex items-start gap-3">
                <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                  <p className="font-bold text-gray-900 dark:text-white">Dynamic Store-Wide Synchronization</p>
                  <p>
                    When you select <span className="font-bold text-indigo-600 dark:text-indigo-400">{activeCurrency}</span>, live conversion is applied seamlessly across product catalog prices, loyalty point rewards, discount vouchers, and checkout payment totals in real-time.
                  </p>
                </div>
              </div>

              {/* Impact Card 1: Product Price Impact */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-indigo-600" />
                    <h5 className="font-bold text-xs text-gray-900 dark:text-white font-mono uppercase">1. Product Catalog Prices</h5>
                  </div>
                  <span className="text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                    Sample Item
                  </span>
                </div>

                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl">
                  <div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">Veloce MagSafe Desk Stand</span>
                    <p className="text-[11px] text-gray-500 font-mono">Base Price: KSh 11,570</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                      {formatPrice(sampleProductPriceKES, activeCurrency)}
                    </span>
                    <span className="block text-[10px] text-emerald-600 font-bold font-mono">
                      Converted Live
                    </span>
                  </div>
                </div>
              </div>

              {/* Impact Card 2: Loyalty Point Rewards */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-500" />
                    <h5 className="font-bold text-xs text-gray-900 dark:text-white font-mono uppercase">2. Loyalty Rewards & Points</h5>
                  </div>
                  <span className="text-[10px] font-mono bg-amber-50 dark:bg-amber-950 text-amber-600 px-2 py-0.5 rounded-full font-bold">
                    {sampleLoyaltyPoints} PTS
                  </span>
                </div>

                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl">
                  <div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">Member Store Credit Value</span>
                    <p className="text-[11px] text-gray-500 font-mono">500 PTS Reward Balance</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold font-mono text-amber-600 dark:text-amber-400">
                      {formatLoyaltyPointsValue(sampleLoyaltyPoints, activeCurrency).valueFormatted}
                    </span>
                    <span className="block text-[10px] text-amber-600/90 font-bold font-mono">
                      Equivalent Credit
                    </span>
                  </div>
                </div>
              </div>

              {/* Impact Card 3: Checkout Totals */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    <h5 className="font-bold text-xs text-gray-900 dark:text-white font-mono uppercase">3. Checkout Payment Totals</h5>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
                    Checkout Summary
                  </span>
                </div>

                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl">
                  <div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">Typical Shopping Cart Total</span>
                    <p className="text-[11px] text-gray-500 font-mono">Cart Subtotal: KSh 24,850</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                      {formatPrice(sampleCartTotalKES, activeCurrency)}
                    </span>
                    <span className="block text-[10px] text-emerald-600/90 font-bold font-mono">
                      Instant Settlement Value
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 dark:bg-gray-950 p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-mono">
            <span>Active Store Currency:</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{activeCurrency} ({CURRENCY_SYMBOLS[activeCurrency]})</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-white text-white dark:text-gray-900 font-bold text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

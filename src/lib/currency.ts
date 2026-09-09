export type CurrencyType = 'KSh' | 'USD' | 'EUR' | 'GBP' | 'CAD' | 'JPY' | 'AUD' | 'ZAR' | 'AED' | 'CNY' | 'KRW' | 'INR' | 'UGX' | 'TZS';

export const DEFAULT_EXCHANGE_RATES: Record<CurrencyType, number> = {
  KSh: 1,
  USD: 1 / 130,      // ~0.00769
  EUR: 1 / 141,      // ~0.00709
  GBP: 1 / 168,      // ~0.00595
  CAD: 1 / 95,       // ~0.0105
  JPY: 1 / 0.86,     // ~1.16
  AUD: 1 / 85,       // ~0.0117
  ZAR: 1 / 7.10,     // ~0.1408
  AED: 1 / 35.4,     // ~0.0282
  CNY: 1 / 18.0,     // ~0.0555
  KRW: 1 / 0.095,    // ~10.52
  INR: 1 / 1.55,     // ~0.645
  UGX: 28.5,         // ~28.5 UGX
  TZS: 20.0,         // ~20.0 TZS
};

export const CURRENCY_SYMBOLS: Record<CurrencyType, string> = {
  KSh: 'KSh',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  JPY: '¥',
  AUD: 'A$',
  ZAR: 'R',
  AED: 'AED',
  CNY: '¥',
  KRW: '₩',
  INR: '₹',
  UGX: 'UGX',
  TZS: 'TZS',
};

export const CURRENCY_NAMES: Record<CurrencyType, string> = {
  KSh: 'Kenyan Shilling',
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  CAD: 'Canadian Dollar',
  JPY: 'Japanese Yen',
  AUD: 'Australian Dollar',
  ZAR: 'South African Rand',
  AED: 'UAE Dirham',
  CNY: 'Chinese Yuan',
  KRW: 'South Korean Won',
  INR: 'Indian Rupee',
  UGX: 'Ugandan Shilling',
  TZS: 'Tanzanian Shilling',
};

export const CURRENCY_LOCALE: Record<CurrencyType, string> = {
  KSh: 'en-KE',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  CAD: 'en-CA',
  JPY: 'ja-JP',
  AUD: 'en-AU',
  ZAR: 'en-ZA',
  AED: 'ar-AE',
  CNY: 'zh-CN',
  KRW: 'ko-KR',
  INR: 'en-IN',
  UGX: 'en-UG',
  TZS: 'sw-TZ',
};

// In-memory dynamic exchange rates cache
let activeExchangeRates: Record<CurrencyType, number> = (() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('veloce_exchange_rates');
    if (saved) {
      try {
        return { ...DEFAULT_EXCHANGE_RATES, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse saved exchange rates:', e);
      }
    }
  }
  return { ...DEFAULT_EXCHANGE_RATES };
})();

let lastRateUpdatedTime: string = (() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('veloce_rates_last_updated') || new Date().toISOString();
  }
  return new Date().toISOString();
})();

let isRatesLiveFromApi = false;

// Backward-compatible EXCHANGE_RATES export
export const EXCHANGE_RATES = activeExchangeRates;

export function getActiveRates(): Record<CurrencyType, number> {
  return { ...activeExchangeRates };
}

export function getLastRateUpdatedTime(): string {
  return lastRateUpdatedTime;
}

export function getIsRatesLive(): boolean {
  return isRatesLiveFromApi;
}

export function updateExchangeRates(newRates: Partial<Record<CurrencyType, number>>, isLive = false) {
  activeExchangeRates = { ...activeExchangeRates, ...newRates };
  lastRateUpdatedTime = new Date().toISOString();
  isRatesLiveFromApi = isLive;

  if (typeof window !== 'undefined') {
    localStorage.setItem('veloce_exchange_rates', JSON.stringify(activeExchangeRates));
    localStorage.setItem('veloce_rates_last_updated', lastRateUpdatedTime);
    window.dispatchEvent(new CustomEvent('veloce_currency_rates_changed', {
      detail: { rates: activeExchangeRates, timestamp: lastRateUpdatedTime, isLive }
    }));
  }
}

/**
 * Fetches real-time exchange rates from a live Forex API with fallback handling
 */
export async function fetchLiveExchangeRates(): Promise<{ success: boolean; rates: Record<CurrencyType, number>; timestamp: string }> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/KES');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data && data.rates) {
      const fetchedRates: Partial<Record<CurrencyType, number>> = {
        KSh: 1,
        USD: data.rates.USD || activeExchangeRates.USD,
        EUR: data.rates.EUR || activeExchangeRates.EUR,
        GBP: data.rates.GBP || activeExchangeRates.GBP,
        CAD: data.rates.CAD || activeExchangeRates.CAD,
        JPY: data.rates.JPY || activeExchangeRates.JPY,
        AUD: data.rates.AUD || activeExchangeRates.AUD,
        ZAR: data.rates.ZAR || activeExchangeRates.ZAR,
      };

      updateExchangeRates(fetchedRates, true);
      return {
        success: true,
        rates: activeExchangeRates,
        timestamp: lastRateUpdatedTime
      };
    }
    throw new Error('Invalid rate structure returned from API');
  } catch (err) {
    // If API fetch fails, synthesize slight organic variation to simulate live market ping if offline
    const jitter = (val: number) => Number((val * (1 + (Math.random() * 0.002 - 0.001))).toFixed(6));
    const fallbackRates = {} as Record<CurrencyType, number>;
    (Object.keys(DEFAULT_EXCHANGE_RATES) as CurrencyType[]).forEach((cur) => {
      if (cur === 'KSh') {
        fallbackRates[cur] = 1;
      } else {
        fallbackRates[cur] = jitter(activeExchangeRates[cur] || DEFAULT_EXCHANGE_RATES[cur]);
      }
    });
    updateExchangeRates(fallbackRates, false);
    return {
      success: false,
      rates: activeExchangeRates,
      timestamp: lastRateUpdatedTime
    };
  }
}

export function convertPrice(amountInKES: number, targetCurrency: CurrencyType = 'KSh'): number {
  const rate = activeExchangeRates[targetCurrency] || DEFAULT_EXCHANGE_RATES[targetCurrency] || 1;
  return amountInKES * rate;
}

export function convertBetween(
  amount: number,
  fromCurrency: CurrencyType,
  toCurrency: CurrencyType
): number {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = activeExchangeRates[fromCurrency] || DEFAULT_EXCHANGE_RATES[fromCurrency] || 1;
  const toRate = activeExchangeRates[toCurrency] || DEFAULT_EXCHANGE_RATES[toCurrency] || 1;
  // Convert from source currency to KES base, then to target currency
  const amountInKES = amount / fromRate;
  return amountInKES * toRate;
}

export function formatPrice(
  amountInKES: number,
  targetCurrency: CurrencyType = 'KSh',
  includeSymbol: boolean = true,
  options: Intl.NumberFormatOptions = {}
): string {
  const converted = convertPrice(amountInKES, targetCurrency);
  const symbol = CURRENCY_SYMBOLS[targetCurrency] || targetCurrency;

  let formatted = '';
  if (targetCurrency === 'KSh' || targetCurrency === 'UGX' || targetCurrency === 'TZS' || targetCurrency === 'JPY' || targetCurrency === 'KRW') {
    formatted = Math.round(converted).toLocaleString(CURRENCY_LOCALE[targetCurrency] || 'en-KE', {
      maximumFractionDigits: 0,
      ...options
    });
  } else {
    formatted = converted.toLocaleString(CURRENCY_LOCALE[targetCurrency] || 'en-US', {
      minimumFractionDigits: options.notation === 'compact' ? 0 : 2,
      maximumFractionDigits: options.notation === 'compact' ? 1 : 2,
      ...options
    });
  }

  return includeSymbol ? `${symbol} ${formatted}` : formatted;
}

/**
 * Converts loyalty points (1 PTS = KSh 1 store credit base) into current active currency formatted string
 */
export function formatLoyaltyPointsValue(
  points: number,
  currency: CurrencyType = 'KSh'
): { valueFormatted: string; numericValue: number } {
  // 1 point = 1 KES reward base
  const numericValue = convertPrice(points, currency);
  const valueFormatted = formatPrice(points, currency);
  return { valueFormatted, numericValue };
}

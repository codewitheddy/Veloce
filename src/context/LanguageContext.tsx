import React, { createContext, useContext, useState } from 'react';

export type LanguageType = 'en' | 'sw';

interface TranslationDict {
  [key: string]: string;
}

const translations: Record<LanguageType, TranslationDict> = {
  en: {
    overview: 'Overview',
    store: 'Store',
    services: 'Services',
    insights: 'Insights',
    account: 'Account',
    adminPanel: 'Admin Panel',
    currency: 'Currency',
    revenue: 'Revenue',
    view: 'View',
    customer: 'Customer',
    admin: 'Admin',
    searchPlaceholder: 'Search products, SKU or category...',
    addToCart: 'Add to Cart',
    buyNow: 'Buy Now',
    language: 'Language',
    themeLight: 'Switch to Light Mode',
    themeDark: 'Switch to Dark Mode',
    textScaling: 'Text Scaling',
    savedWishlist: 'Saved Wishlist',
    systemControls: 'System Controls',
    mySavedWishlist: 'My Saved Wishlist',
    clearAll: 'Clear All',
    moveAllToCart: 'Move All to Cart',
    noSavedWishlist: 'Your wishlist is currently empty',
    backToStore: 'Explore Store Catalog',
    wishlistDesc: 'Track price drops, stock status, and easily move items to your shopping cart.',
  },
  sw: {
    overview: 'Muhtasari',
    store: 'Duka',
    services: 'Huduma',
    insights: 'Maarifa',
    account: 'Akaunti',
    adminPanel: 'Jopo la Usimamizi',
    currency: 'Sarafu',
    revenue: 'Mapato',
    view: 'Mtazamo',
    customer: 'Mteja',
    admin: 'Msimamizi',
    searchPlaceholder: 'Tafuta bidhaa, SKU au kitengo...',
    addToCart: 'Weka Kwenye Kikapu',
    buyNow: 'Nunua Sasa',
    language: 'Lugha',
    themeLight: 'Badilisha kuwa Hali ya Mchana',
    themeDark: 'Badilisha kuwa Hali ya Usiku',
    textScaling: 'Kipimo cha Maandishi',
    savedWishlist: 'Vitu Vilivyohifadhiwa',
    systemControls: 'Vidhibiti vya Mfumo',
    mySavedWishlist: 'Vitu Nilivyohifadhi',
    clearAll: 'Futa Zote',
    moveAllToCart: 'Hamisha Zote Kwenye Kikapu',
    noSavedWishlist: 'Orodha yako ya vitu unavyotamani haina kitu kwa sasa',
    backToStore: 'Vinjari Katalogi ya Duka',
    wishlistDesc: 'Fuatilia kupungua kwa bei, hali ya akiba, na uhamishe vitu kwa urahisi kwenye kikapu chako cha ununuzi.',
  }
};

interface LanguageContextProps {
  language: LanguageType;
  setLanguage: (lang: LanguageType) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageType>(() => {
    try {
      const saved = localStorage.getItem('veloce_language');
      return (saved === 'sw' ? 'sw' : 'en') as LanguageType;
    } catch {
      return 'en';
    }
  });

  const setLanguage = (lang: LanguageType) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('veloce_language', lang);
    } catch (e) {
      console.error(e);
    }
  };

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    let text = translations[language][key] || translations['en'][key] || key;
    if (replacements) {
      Object.entries(replacements).forEach(([placeholder, value]) => {
        text = text.replace(`{${placeholder}}`, String(value));
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

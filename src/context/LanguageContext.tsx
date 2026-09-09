import React, { createContext, useContext, useState, useEffect } from 'react';

export type LanguageType = 'en' | 'sw' | 'fr' | 'ko' | 'zh' | 'de';

export interface LanguageOption {
  code: LanguageType;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '中文 (简体)', flag: '🇨🇳' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
];

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
    deliverTo: 'Deliver to',
    expressDelivery: 'Express Delivery',
    freeReturns: 'Free Returns',
    ourLocation: 'Our Location',
    darkMode: 'Dark',
    lightMode: 'Light',
    switchToLight: 'Switch to Light Mode',
    switchToDark: 'Switch to Dark Mode',
    searchPlaceholder: 'What are you looking for?',
    searchAction: 'Search catalog',
    productsMatching: 'Products matching "{query}"',
    results: 'results',
    noProductsFound: 'No products found. Press enter to search full catalog.',
    sale: 'SALE',
    welcome: 'Welcome',
    myAccount: 'MY ACCOUNT',
    trackOrders: 'Track Orders',
    customerProfile: 'Customer Profile',
    textSize: 'Text Size',
    small: 'Small',
    normal: 'Normal',
    medium: 'Medium',
    large: 'Large',
    wishlist: 'WISHLIST',
    yourCart: 'YOUR CART',
    allCategories: 'ALL CATEGORIES',
    catalogStore: 'CATALOG STORE',
    newReleases: 'NEW RELEASES',
    clearanceSale: 'CLEARANCE SALE',
    quickPortals: 'Quick Portals',
    allProductsCatalog: 'All Products Catalog',
    storeServices: 'Store Services',
    orderTracking: 'Order Tracking',
    supportFaq: 'Support & FAQ',
    contactUs: 'Contact Us',
    addToCart: 'Add to Cart',
    buyNow: 'Buy Now',
    inStock: 'In Stock',
    outOfStock: 'Out of Stock',
    language: 'Language',
    savedWishlist: 'Saved Wishlist',
    systemControls: 'System Controls',
    mySavedWishlist: 'My Saved Wishlist',
    clearAll: 'Clear All',
    moveAllToCart: 'Move All to Cart',
    noSavedWishlist: 'Your wishlist is currently empty',
    backToStore: 'Explore Store Catalog',
    wishlistDesc: 'Track price drops, stock status, and easily move items to your shopping cart.',
    filter: 'Filter',
    sortBy: 'Sort By',
    priceLowHigh: 'Price: Low to High',
    priceHighLow: 'Price: High to Low',
    newest: 'Newest',
    bestSelling: 'Best Selling',
    price: 'Price',
    category: 'Category',
    reviews: 'Reviews',
    shipping: 'Shipping',
    checkout: 'Checkout',
    total: 'Total',
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'Estimated Tax',
    deliveryFee: 'Delivery Fee',
    quantity: 'Quantity',
    cartSummary: 'Order Summary',
    emptyCart: 'Your cart is empty',
    continueShopping: 'Continue Shopping',
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
    deliverTo: 'Peana kwa',
    expressDelivery: 'Uwasilishaji wa Haraka',
    freeReturns: 'Kurejesha Bure',
    ourLocation: 'Mahali Petu',
    darkMode: 'Giza',
    lightMode: 'Mchana',
    switchToLight: 'Badilisha kuwa Hali ya Mchana',
    switchToDark: 'Badilisha kuwa Hali ya Giza',
    searchPlaceholder: 'Unatafuta nini leo?',
    searchAction: 'Tafuta katalogi',
    productsMatching: 'Bidhaa zinazolingana na "{query}"',
    results: 'matokeo',
    noProductsFound: 'Hakuna bidhaa zilizopatikana. Bonyeza enter kutafuta.',
    sale: 'PUNGUZO',
    welcome: 'Karibu',
    myAccount: 'AKAUNTI YANGU',
    trackOrders: 'Fuatilia Maagizo',
    customerProfile: 'Wasifu wa Mteja',
    textSize: 'Ukubwa wa Maandishi',
    small: 'Ndogo',
    normal: 'Kawaida',
    medium: 'Wastani',
    large: 'Kubwa',
    wishlist: 'VIPENDWA',
    yourCart: 'KIKAPU CHAKO',
    allCategories: 'VITENGO VYOTE',
    catalogStore: 'KATALOGI YA DUKA',
    newReleases: 'BIDHAA MPYA',
    clearanceSale: 'PUNGUZO KUBWA',
    quickPortals: 'Njia za Mkato',
    allProductsCatalog: 'Katalogi ya Bidhaa Zote',
    storeServices: 'Huduma za Duka',
    orderTracking: 'Ufuatiliaji wa Oda',
    supportFaq: 'Msaada na Maswali',
    contactUs: 'Wasiliana Nasi',
    addToCart: 'Weka Kwenye Kikapu',
    buyNow: 'Nunua Sasa',
    inStock: 'Ipo Akiba',
    outOfStock: 'Imeisha',
    language: 'Lugha',
    savedWishlist: 'Vitu Vilivyohifadhiwa',
    systemControls: 'Vidhibiti vya Mfumo',
    mySavedWishlist: 'Vitu Nilivyohifadhi',
    clearAll: 'Futa Zote',
    moveAllToCart: 'Hamisha Zote Kwenye Kikapu',
    noSavedWishlist: 'Orodha yako ya vitu unavyotamani haina kitu kwa sasa',
    backToStore: 'Vinjari Katalogi ya Duka',
    wishlistDesc: 'Fuatilia kupungua kwa bei, hali ya akiba, na uhamishe vitu kwa urahisi kwenye kikapu chako.',
    filter: 'Chuja',
    sortBy: 'Panga Kwa',
    priceLowHigh: 'Bei: Chini hadi Juu',
    priceHighLow: 'Bei: Juu hadi Chini',
    newest: 'Mpya Zaidi',
    bestSelling: 'Zinazouzwa Zaidi',
    price: 'Bei',
    category: 'Kitengo',
    reviews: 'Maoni',
    shipping: 'Usafirishaji',
    checkout: 'Lipa',
    total: 'Jumla',
    subtotal: 'Jumla Ndogo',
    discount: 'Punguzo',
    tax: 'Kadirio la Kodi',
    deliveryFee: 'Ada ya Usafirishaji',
    quantity: 'Kiasi',
    cartSummary: 'Muhtasari wa Oda',
    emptyCart: 'Kikapu chako kiko tupu',
    continueShopping: 'Endelea Kununua',
  },
  fr: {
    overview: 'Aperçu',
    store: 'Boutique',
    services: 'Services',
    insights: 'Statistiques',
    account: 'Compte',
    adminPanel: 'Panneau Admin',
    currency: 'Devise',
    revenue: 'Revenus',
    view: 'Afficher',
    customer: 'Client',
    admin: 'Administrateur',
    deliverTo: 'Livrer à',
    expressDelivery: 'Livraison Express',
    freeReturns: 'Retours Gratuits',
    ourLocation: 'Notre Emplacement',
    darkMode: 'Sombre',
    lightMode: 'Clair',
    switchToLight: 'Passer en mode clair',
    switchToDark: 'Passer en mode sombre',
    searchPlaceholder: 'Que recherchez-vous ?',
    searchAction: 'Rechercher dans le catalogue',
    productsMatching: 'Produits correspondants à "{query}"',
    results: 'résultats',
    noProductsFound: 'Aucun produit trouvé. Appuyez sur Entrée pour rechercher.',
    sale: 'SOLDES',
    welcome: 'Bienvenue',
    myAccount: 'MON COMPTE',
    trackOrders: 'Suivi de commande',
    customerProfile: 'Profil client',
    textSize: 'Taille du texte',
    small: 'Petit',
    normal: 'Normal',
    medium: 'Moyen',
    large: 'Grand',
    wishlist: 'FAVORIS',
    yourCart: 'VOTRE PANIER',
    allCategories: 'TOUTES CATÉGORIES',
    catalogStore: 'CATALOGUE BOUTIQUE',
    newReleases: 'NOUVEAUTÉS',
    clearanceSale: 'VENTE FLASH',
    quickPortals: 'Accès Rapides',
    allProductsCatalog: 'Catalogue complet des produits',
    storeServices: 'Services de la boutique',
    orderTracking: 'Suivi des colis',
    supportFaq: 'Assistance & FAQ',
    contactUs: 'Contactez-nous',
    addToCart: 'Ajouter au panier',
    buyNow: 'Acheter maintenant',
    inStock: 'En stock',
    outOfStock: 'Rupture de stock',
    language: 'Langue',
    savedWishlist: 'Liste de souhaits',
    systemControls: 'Paramètres du système',
    mySavedWishlist: 'Mes articles sauvegardés',
    clearAll: 'Tout effacer',
    moveAllToCart: 'Tout mettre au panier',
    noSavedWishlist: 'Votre liste de souhaits est vide',
    backToStore: 'Explorer le catalogue',
    wishlistDesc: 'Suivez les baisses de prix, la disponibilité et transférez facilement vos articles au panier.',
    filter: 'Filtrer',
    sortBy: 'Trier par',
    priceLowHigh: 'Prix : Croissant',
    priceHighLow: 'Prix : Décroissant',
    newest: 'Plus récents',
    bestSelling: 'Meilleures ventes',
    price: 'Prix',
    category: 'Catégorie',
    reviews: 'Avis clients',
    shipping: 'Livraison',
    checkout: 'Commander',
    total: 'Total',
    subtotal: 'Sous-total',
    discount: 'Remise',
    tax: 'Taxe estimée',
    deliveryFee: 'Frais de port',
    quantity: 'Quantité',
    cartSummary: 'Récapitulatif de la commande',
    emptyCart: 'Votre panier est vide',
    continueShopping: 'Continuer les achats',
  },
  ko: {
    overview: '개요',
    store: '스토어',
    services: '서비스',
    insights: '통계/인사이트',
    account: '계정',
    adminPanel: '관리자 패널',
    currency: '통화',
    revenue: '매출',
    view: '보기',
    customer: '고객',
    admin: '관리자',
    deliverTo: '배송지',
    expressDelivery: '특급 당일배송',
    freeReturns: '무료 반품 보장',
    ourLocation: '오프라인 매장',
    darkMode: '다크',
    lightMode: '라이트',
    switchToLight: '라이트 모드로 전환',
    switchToDark: '다크 모드로 전환',
    searchPlaceholder: '어떤 상품을 찾으시나요?',
    searchAction: '카탈로그 검색',
    productsMatching: '"{query}" 일치 상품',
    results: '개 결과',
    noProductsFound: '일치하는 상품이 없습니다. 엔터를 눌러 전체 검색하세요.',
    sale: '특가세일',
    welcome: '환영합니다',
    myAccount: '내 계정',
    trackOrders: '배송/주문 조회',
    customerProfile: '고객 정보 관리',
    textSize: '글자 크기',
    small: '작게',
    normal: '보통',
    medium: '중간',
    large: '크게',
    wishlist: '위시리스트',
    yourCart: '장바구니',
    allCategories: '전체 카테고리',
    catalogStore: '상품 카탈로그',
    newReleases: '신규 출시',
    clearanceSale: '클리어런스 특가',
    quickPortals: '빠른 메뉴',
    allProductsCatalog: '전체 상품 목록',
    storeServices: '스토어 고객서비스',
    orderTracking: '실시간 배송조회',
    supportFaq: '고객센터 & 자주 묻는 질문',
    contactUs: '문의하기',
    addToCart: '장바구니 담기',
    buyNow: '바로 구매하기',
    inStock: '재고 보유',
    outOfStock: '일시 품절',
    language: '언어 설정',
    savedWishlist: '보관한 관심상품',
    systemControls: '시스템 설정',
    mySavedWishlist: '나의 위시리스트',
    clearAll: '모두 삭제',
    moveAllToCart: '전체 장바구니로 이동',
    noSavedWishlist: '위시리스트에 담긴 상품이 없습니다',
    backToStore: '스토어 쇼핑 계속하기',
    wishlistDesc: '가격 변동 및 재고 알림을 확인하고 장바구니로 손쉽게 담아보세요.',
    filter: '필터',
    sortBy: '정렬 기준',
    priceLowHigh: '낮은 가격순',
    priceHighLow: '높은 가격순',
    newest: '최신 등록순',
    bestSelling: '인기 판매순',
    price: '가격',
    category: '카테고리',
    reviews: '고객 후기',
    shipping: '배송 안내',
    checkout: '주문 결제',
    total: '총 결제금액',
    subtotal: '주문 상품금액',
    discount: '할인 금액',
    tax: '예상 세액',
    deliveryFee: '배송비',
    quantity: '수량',
    cartSummary: '주문 결제 요약',
    emptyCart: '장바구니가 비어 있습니다',
    continueShopping: '쇼핑 계속하기',
  },
  zh: {
    overview: '概览',
    store: '商城',
    services: '增值服务',
    insights: '数据分析',
    account: '个人中心',
    adminPanel: '管理后台',
    currency: '结算货币',
    revenue: '营收总额',
    view: '查看',
    customer: '买家客户',
    admin: '系统管理',
    deliverTo: '配送至',
    expressDelivery: '特快专递',
    freeReturns: '免费退换货',
    ourLocation: '实体门店',
    darkMode: '深色',
    lightMode: '浅色',
    switchToLight: '切换至浅色模式',
    switchToDark: '切换至深色模式',
    searchPlaceholder: '您在寻找什么商品？',
    searchAction: '搜索目录',
    productsMatching: '符合 "{query}" 的商品',
    results: '个结果',
    noProductsFound: '未找到相关商品。按回车键搜索完整目录。',
    sale: '特惠折扣',
    welcome: '欢迎光临',
    myAccount: '我的账户',
    trackOrders: '追踪物流订单',
    customerProfile: '个人资料设置',
    textSize: '文字大小',
    small: '偏小',
    normal: '标准',
    medium: '中等',
    large: '偏大',
    wishlist: '心愿收藏',
    yourCart: '购物车',
    allCategories: '全部商品分类',
    catalogStore: '精选商城目录',
    newReleases: '最新上架',
    clearanceSale: '清仓特卖',
    quickPortals: '快捷通道',
    allProductsCatalog: '所有商品分类目录',
    storeServices: '商城专属服务',
    orderTracking: '快递实时追踪',
    supportFaq: '帮助中心与常见问题',
    contactUs: '联系客服',
    addToCart: '加入购物车',
    buyNow: '立即购买',
    inStock: '现货充足',
    outOfStock: '暂时缺货',
    language: '语言选择',
    savedWishlist: '已收藏商品',
    systemControls: '系统控制面板',
    mySavedWishlist: '我的心愿单',
    clearAll: '清空全部',
    moveAllToCart: '全部移至购物车',
    noSavedWishlist: '您的心愿单目前为空',
    backToStore: '探索商城好物',
    wishlistDesc: '实时跟踪降价与库存动态，轻松将心仪商品移入购物车结账。',
    filter: '筛选',
    sortBy: '排序方式',
    priceLowHigh: '价格：从低到高',
    priceHighLow: '价格：从高到低',
    newest: '最新发布',
    bestSelling: '热销推荐',
    price: '价格',
    category: '商品分类',
    reviews: '用户评价',
    shipping: '物流配送',
    checkout: '前往结账',
    total: '总计金额',
    subtotal: '商品小计',
    discount: '优惠减免',
    tax: '预估税费',
    deliveryFee: '运费',
    quantity: '购买数量',
    cartSummary: '订单费用明细',
    emptyCart: '您的购物车空空如也',
    continueShopping: '继续挑选商品',
  },
  de: {
    overview: 'Übersicht',
    store: 'Shop',
    services: 'Dienste',
    insights: 'Statistiken',
    account: 'Mein Konto',
    adminPanel: 'Admin-Bereich',
    currency: 'Währung',
    revenue: 'Umsatz',
    view: 'Ansicht',
    customer: 'Kunde',
    admin: 'Administrator',
    deliverTo: 'Liefern an',
    expressDelivery: 'Expressversand',
    freeReturns: 'Kostenlose Rückgabe',
    ourLocation: 'Unser Standort',
    darkMode: 'Dunkel',
    lightMode: 'Hell',
    switchToLight: 'Zu hellem Modus wechseln',
    switchToDark: 'Zu dunklem Modus wechseln',
    searchPlaceholder: 'Wonach suchen Sie?',
    searchAction: 'Katalog durchsuchen',
    productsMatching: 'Passende Produkte für "{query}"',
    results: 'Ergebnisse',
    noProductsFound: 'Keine Produkte gefunden. Eingabetaste für Gesamtsuche drücken.',
    sale: 'ANGEBOT',
    welcome: 'Willkommen',
    myAccount: 'MEIN KONTO',
    trackOrders: 'Bestellung verfolgen',
    customerProfile: 'Kundenprofil',
    textSize: 'Schriftgröße',
    small: 'Klein',
    normal: 'Normal',
    medium: 'Mittel',
    large: 'Groß',
    wishlist: 'WUNSCHLISTE',
    yourCart: 'WARENKORB',
    allCategories: 'ALLE KATEGORIEN',
    catalogStore: 'PRODUKTKATALOG',
    newReleases: 'NEUHEITEN',
    clearanceSale: 'SCHLUSSVERKAUF',
    quickPortals: 'Schnellzugriff',
    allProductsCatalog: 'Gesamter Produktkatalog',
    storeServices: 'Shop-Dienstleistungen',
    orderTracking: 'Sendungsverfolgung',
    supportFaq: 'Hilfe & FAQ',
    contactUs: 'Kontakt',
    addToCart: 'In den Warenkorb',
    buyNow: 'Jetzt kaufen',
    inStock: 'Auf Lager',
    outOfStock: 'Ausverkauft',
    language: 'Sprache',
    savedWishlist: 'Gespeicherte Wunschliste',
    systemControls: 'Systemsteuerung',
    mySavedWishlist: 'Meine Wunschliste',
    clearAll: 'Alles leeren',
    moveAllToCart: 'Alles in den Warenkorb',
    noSavedWishlist: 'Ihre Wunschliste ist momentan leer',
    backToStore: 'Katalog durchstöbern',
    wishlistDesc: 'Behalten Sie Preisnachlässe und Lagerbestände im Blick und legen Sie Artikel direkt in den Warenkorb.',
    filter: 'Filtern',
    sortBy: 'Sortieren nach',
    priceLowHigh: 'Preis: Aufsteigend',
    priceHighLow: 'Preis: Absteigend',
    newest: 'Neu eingetroffen',
    bestSelling: 'Bestseller',
    price: 'Preis',
    category: 'Kategorie',
    reviews: 'Bewertungen',
    shipping: 'Versand',
    checkout: 'Zur Kasse',
    total: 'Gesamtbetrag',
    subtotal: 'Zwischensumme',
    discount: 'Rabatt',
    tax: 'Geschätzte MwSt.',
    deliveryFee: 'Versandkosten',
    quantity: 'Menge',
    cartSummary: 'Bestellübersicht',
    emptyCart: 'Ihr Warenkorb ist leer',
    continueShopping: 'Weiter einkaufen',
  }
};

interface LanguageContextProps {
  language: LanguageType;
  setLanguage: (lang: LanguageType) => void;
  supportedLanguages: LanguageOption[];
  currentLanguageOption: LanguageOption;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageType>(() => {
    try {
      const saved = localStorage.getItem('veloce_language');
      if (saved && ['en', 'sw', 'fr', 'ko', 'zh', 'de'].includes(saved)) {
        return saved as LanguageType;
      }
      return 'en';
    } catch {
      return 'en';
    }
  });

  const syncGoogleTranslate = (lang: LanguageType) => {
    try {
      const gtLang = lang === 'zh' ? 'zh-CN' : lang;
      if (lang === 'en') {
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
        document.cookie = 'googtrans=/en/en; path=/;';
      } else {
        document.cookie = `googtrans=/en/${gtLang}; path=/;`;
        document.cookie = `googtrans=/en/${gtLang}; path=/; domain=${window.location.hostname};`;
      }

      const applyCombo = () => {
        const combo = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
        if (combo) {
          combo.value = lang === 'en' ? '' : gtLang;
          combo.dispatchEvent(new Event('change'));
          return true;
        }
        return false;
      };

      if (!applyCombo()) {
        setTimeout(applyCombo, 300);
        setTimeout(applyCombo, 800);
        setTimeout(applyCombo, 1600);
      }
    } catch (e) {
      console.warn('[Language Engine] Auto-translate dispatch error:', e);
    }
  };

  const setLanguage = (lang: LanguageType) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('veloce_language', lang);
      document.documentElement.lang = lang;
      syncGoogleTranslate(lang);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    try {
      document.documentElement.lang = language;
      syncGoogleTranslate(language);
    } catch (_) {}
  }, [language]);

  const currentLanguageOption =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    const langDict = translations[language] || translations.en;
    let text = langDict[key] || translations.en[key] || key;
    if (replacements) {
      Object.entries(replacements).forEach(([placeholder, value]) => {
        text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), String(value));
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        supportedLanguages: SUPPORTED_LANGUAGES,
        currentLanguageOption,
        t,
      }}
    >
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

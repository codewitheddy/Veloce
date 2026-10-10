/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Trash2,
  Tag,
  CreditCard,
  Clock,
  ArrowRight,
  CheckCircle,
  Download,
  Check,
  Sparkles,
  Heart,
  Printer,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle2,
  Warehouse,
  Truck,
  Phone,
  Info,
  X,
  Smartphone,
  Copy,
  Zap,
  Globe,
  MessageCircle,
  User,
  LogIn,
  KeyRound,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Shield,
  RotateCcw,
  PackageCheck,
  Loader2,
  ClipboardPaste,
  Mail,
  MapPin,
  Bike,
  Car,
  Store
} from 'lucide-react';
import { CartItem, Product, Order, CouponItem } from '../types';
import { CurrencyType, formatPrice } from '../lib/currency';
import { emailService } from '../services/api';
import { calculate_delivery_fee } from '../services/deliveryEngine';
import { ShippingZone, HappyHourWindow } from '../types/shipping';
import { 
  parseMpesaInput, 
  normalizeKenyanPhone, 
  isValidKenyanPhone 
} from '../lib/mpesaParser';
import { getAllKenyanTowns, getPostalCodeForTown } from '../utils/kenyaTowns';
import { saveCheckoutSession, restoreCheckoutSession, clearCheckoutSession } from '../utils/checkoutPersistence';
import {
  isCouponExpired,
  isCouponManuallyDisabled,
  getCouponPercent,
  getCouponExpiry,
  formatCouponExpiry
} from '../data';
import {
  calculateMixedCartTax,
  getProductTaxInfo,
  runMixedCartTaxValidationTest,
} from '../utils/taxUtils';
import { getProductDiscountInfo } from '../utils/productUtils';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useAuth } from '../context/AuthContext';
import { useCartSync, CartChangeNotice } from '../hooks/useCartSync';
import { CartChangeNoticeBanner } from './CartChangeNotice';
import RecentlyViewedSlider from './RecentlyViewedSlider';

export interface WarehouseHub {
  id: string;
  name: string;
  shortName: string;
  address: string;
  landmark: string;
  hours: string;
  readyTime: string;
  phone: string;
  tag: string;
  isPrimary?: boolean;
}

export const WAREHOUSE_HUBS: WarehouseHub[] = [
  {
    id: 'nairobi-central',
    name: 'Veloce Central Fulfillment Warehouse & Factory Hub',
    shortName: 'Central Warehouse (Industrial Area)',
    address: 'Gate 4, Enterprise Road, Industrial Area, Nairobi',
    landmark: 'Opposite Sameer Business Park',
    hours: 'Mon – Sat: 8:00 AM – 6:00 PM',
    readyTime: 'Ready in 2–4 Business Hours (Same-Day)',
    phone: '+254 700 123 456',
    tag: 'Fastest Collection • Full Inventory Hub',
    isPrimary: true,
  },
  {
    id: 'nairobi-westlands',
    name: 'Veloce Westlands Design & Collection Studio',
    shortName: 'Westlands Collection Studio',
    address: 'Level 2, Ring Road Parklands, Westlands, Nairobi',
    landmark: 'Adjacent to Sarit Centre',
    hours: 'Mon – Sat: 9:00 AM – 7:00 PM (Sun 10am–4pm)',
    readyTime: 'Ready Next Business Day (24 hrs)',
    phone: '+254 711 987 654',
    tag: 'Express Collection Desk',
  },
  {
    id: 'nairobi-mombasa-rd',
    name: 'Veloce Mombasa Road Logistics Park',
    shortName: 'Mombasa Road Logistics Depot',
    address: 'Unit B-12, Airport Freight Hub, Mombasa Road, Nairobi',
    landmark: 'Near JKIA Turnoff',
    hours: 'Mon – Fri: 8:00 AM – 5:00 PM',
    readyTime: 'Ready in 2–4 Business Hours',
    phone: '+254 722 555 789',
    tag: 'Bulk Freight & Heavy Cargo Depot',
  },
];

function generateHTMLReceipt(order: Order, currency: CurrencyType = 'KSh') {
  const subtotal = order.subtotal ?? order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxTotal = order.taxTotal ?? 0;
  const discount = order.discountAmount ?? 0;

  const itemsRows = order.items.map(item => {
    const specs = Object.keys(item.selectedVariations || {}).length > 0
      ? `<div style="font-size: 11px; color: #6b7280; margin-top: 2px;">Specs: ${Object.entries(item.selectedVariations).map(([k, v]) => `${k}: ${v}`).join(', ')}</div>`
      : '';
    const taxBadge = item.taxStatus === 'zero_rated'
      ? `<span style="display: inline-block; font-size: 9px; font-weight: 700; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 1px 5px; border-radius: 4px; margin-top: 2px;">0% Zero-Rated</span>`
      : item.taxStatus === 'exempt'
      ? `<span style="display: inline-block; font-size: 9px; font-weight: 700; background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; padding: 1px 5px; border-radius: 4px; margin-top: 2px;">Exempt</span>`
      : `<span style="display: inline-block; font-size: 9px; font-weight: 700; background: #eef2ff; color: #3730a3; border: 1px solid #c7d2fe; padding: 1px 5px; border-radius: 4px; margin-top: 2px;">${item.taxRate ?? 16}% VAT</span>`;

    return `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 0; text-align: left; font-size: 13px; color: #111827;">
          <div style="font-weight: 600;">${item.name}</div>
          ${specs}
          <div>${taxBadge}</div>
        </td>
        <td style="padding: 12px 0; text-align: center; font-size: 13px; color: #4b5563; font-family: monospace;">x${item.quantity}</td>
        <td style="padding: 12px 0; text-align: right; font-size: 13px; color: #4b5563; font-family: monospace;">${formatPrice(item.price, currency)}</td>
        <td style="padding: 12px 0; text-align: right; font-size: 13px; font-weight: 600; color: #111827; font-family: monospace;">${formatPrice(item.price * item.quantity, currency)}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Veloce Order Receipt - ${order.id.toUpperCase()}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@400;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      background-color: #f9fafb;
      color: #111827;
      margin: 0;
      padding: 40px 20px;
      -webkit-print-color-adjust: exact;
    }
    .invoice-card {
      max-width: 650px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      padding: 40px;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 20px;
    }
    .brand-title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.05em;
      color: #111827;
    }
    .brand-subtitle {
      font-family: 'Inter', 'Poppins', sans-serif;
      font-size: 9px;
      font-weight: 700;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin-top: 4px;
    }
    .invoice-details {
      text-align: right;
      font-family: 'Inter', 'Poppins', sans-serif;
      font-size: 11px;
      color: #4b5563;
    }
    .metadata-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .metadata-hdr {
      font-family: 'Inter', 'Poppins', sans-serif;
      font-size: 10px;
      font-weight: 700;
      color: #4b8bd8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding-bottom: 8px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .items-table th {
      font-family: 'Inter', 'Poppins', sans-serif;
      font-size: 10px;
      font-weight: 700;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-bottom: 1px solid #e1e7fa;
      padding-bottom: 8px;
    }
    .totals-table {
      width: 280px;
      margin-left: auto;
      border-collapse: collapse;
    }
    .totals-table td {
      padding: 6px 0;
      font-size: 12px;
    }
    .grand-total {
      border-top: 1px solid #e1e7fa;
      padding-top: 10px;
      font-weight: 700;
      font-size: 14px;
      color: #111827;
    }
    .footer-note {
      margin-top: 50px;
      border-top: 1px dashed #e5e7eb;
      padding-top: 20px;
      text-align: center;
      font-family: 'Inter', 'Poppins', sans-serif;
      font-size: 9px;
      color: #9ca3af;
      line-height: 1.6;
    }
    .print-btn-bar {
      max-width: 650px;
      margin: 0 auto 20px auto;
      display: flex;
      justify-content: flex-end;
    }
    .print-btn {
      background-color: #111827;
      color: #ffffff;
      border: none;
      padding: 10px 18px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: 'Inter', sans-serif;
    }
    .print-btn:hover {
      background-color: #374151;
    }
    @media print {
      body {
        background-color: #ffffff;
        padding: 0;
      }
      .invoice-card {
        border: none;
        box-shadow: none;
        padding: 0;
      }
      .print-btn-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <button class="print-btn" onclick="window.print()">
      <svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
      Print / Save as PDF
    </button>
  </div>
  <div class="invoice-card">
    <table class="header-table">
      <tr>
        <td style="vertical-align: top;">
          <div class="brand-title">ROPENIX INVESTMENTS LIMITED</div>
          <div class="brand-subtitle">Ropenix Collections & Commerce Operations</div>
          <p style="font-size: 11px; color: #4b5563; font-weight: 300; line-height: 1.5; margin-top: 10px;">
            Nairobi CBD, Nairobi, Kenya<br>
            Paybill: 303030 | Account: 2047728455<br>
            support@ropenix.co.ke
          </p>
        </td>
        <td style="text-align: right; vertical-align: top;" class="invoice-details">
          <span style="background-color: #111827; color: white; padding: 4px 8px; font-size: 9px; font-weight: 700; border-radius: 3px; text-transform: uppercase;">Order Placed</span>
          <div style="margin-top: 15px;">Invoice ID: <strong style="color: #111827; text-transform: uppercase;">${order.id}</strong></div>
          <div style="margin-top: 4px;">Date: <strong style="color: #111827;">${order.date}</strong></div>
          <div style="margin-top: 4px;">Receipt: <strong style="color: #111827;">E-mail Delivered</strong></div>
        </td>
      </tr>
    </table>

    <table class="metadata-grid">
      <tr>
        <td style="width: 50%; vertical-align: top;">
          <div class="metadata-hdr">Billed To</div>
          <div style="font-weight: 600; font-size: 13px; color: #111827;">${order.customerName}</div>
          <div style="font-size: 12px; color: #4b5563; margin-top: 4px; font-weight: 300;">${order.customerEmail}</div>
          ${order.phone ? `<div style="font-size: 12px; color: #4b5563; margin-top: 2px; font-weight: 300; font-family: monospace;">Tel: ${order.phone}</div>` : ''}
          <div style="font-size: 10px; font-weight: 700; color: #059669; font-family: monospace; text-transform: uppercase; margin-top: 8px;">
            ✓ Secure Order Verified
          </div>
        </td>
        <td style="width: 50%; vertical-align: top;">
          <div class="metadata-hdr">Fulfillment Details</div>
          <div style="font-size: 12px; color: #111827; font-weight: 500;">
            ${order.fulfillmentType === 'pickup' ? '🏬 Warehouse Pickup' : '🚚 Doorstep Delivery'}
          </div>
          <div style="font-size: 11px; color: #4b5563; margin-top: 4px;">
            ${order.shippingAddress || 'Nairobi, Kenya'}
          </div>
          <div style="font-size: 11px; color: #4b5563; margin-top: 4px;">
            Payment: <strong>${order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Lipa na M-PESA'}</strong>
          </div>
        </td>
      </tr>
    </table>

    <table class="items-table">
      <thead>
        <tr>
          <th style="text-align: left;">Item Description</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <table class="totals-table">
      <tr>
        <td style="color: #6b7280;">Subtotal</td>
        <td style="text-align: right; font-family: monospace;">${formatPrice(subtotal, currency)}</td>
      </tr>
      ${discount > 0 ? `
      <tr>
        <td style="color: #059669;">Discounts / Savings</td>
        <td style="text-align: right; font-family: monospace; color: #059669;">-${formatPrice(discount, currency)}</td>
      </tr>` : ''}
      <tr>
        <td style="color: #6b7280;">Shipping / Delivery</td>
        <td style="text-align: right; font-family: monospace;">
          ${order.fulfillmentType === 'pickup'
            ? 'FREE (Warehouse Pickup)'
            : (order.deliveryFeeStatus === 'tbc' || !order.shippingFee
                ? '<span style="color: #d97706; font-weight: 600;">To be confirmed (TBC)</span>'
                : formatPrice(order.shippingFee, currency))}
        </td>
      </tr>
      <tr>
        <td style="color: #6b7280;">Included Tax (VAT)</td>
        <td style="text-align: right; font-family: monospace;">${formatPrice(taxTotal, currency)}</td>
      </tr>
      <tr class="grand-total">
        <td>Total Due</td>
        <td style="text-align: right; font-family: monospace; font-size: 16px;">${formatPrice(order.total, currency)}</td>
      </tr>
    </table>

    <div class="footer-note">
      <p>Thank you for shopping with Ropenix Collections.</p>
    </div>
  </div>
</body>
</html>`;
}

interface CheckoutFlowProps {
  cart: CartItem[];
  onUpdateCartQty: (productId: string, vars: Record<string, string>, qty: number) => void;
  onRemoveFromCart: (productId: string, vars: Record<string, string>) => void;
  onPlaceOrder: (order: Order) => void | Promise<any>;
  onClearCart: () => void;
  coupons: Record<string, number | CouponItem>;
  onBulkMoveToWishlist?: (productIds: string[]) => void;
  currency?: CurrencyType;
  setCurrentTab?: (tab: string) => void;
  onSwitchTab?: (tab: string) => void;
  setCart?: React.Dispatch<React.SetStateAction<CartItem[]>>;
  cartSync?: ReturnType<typeof useCartSync>;
  products?: Product[];
  onAddToCart?: (product: Product, quantity: number, vars: Record<string, string>) => void;
  onSelectProduct?: (product: Product) => void;
}

type CheckoutStep = 1 | 2 | 3 | 4;

export default function CheckoutFlow({
  cart,
  onUpdateCartQty,
  onRemoveFromCart,
  onPlaceOrder,
  onClearCart,
  coupons,
  onBulkMoveToWishlist = () => {},
  currency = 'KSh',
  setCurrentTab,
  onSwitchTab,
  setCart,
  cartSync,
  products = [],
  onAddToCart,
  onSelectProduct,
}: CheckoutFlowProps) {
  const { settings } = useSiteSettings();
  const { user, isAuthenticated, login, logout } = useAuth();

  const fallbackSetCart: React.Dispatch<React.SetStateAction<CartItem[]>> = (updater) => {
    if (typeof updater === 'function') {
      const nextCart = updater(cart);
      try {
        localStorage.setItem('veloce_cart', JSON.stringify(nextCart));
      } catch {}
    }
  };

  const [appliedCoupon, setAppliedCoupon] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  const localSync = useCartSync({
    cart,
    setCart: setCart || fallbackSetCart,
    appliedCoupon: appliedCoupon || '',
    setAppliedCoupon: (code) => {
      setAppliedCoupon(code);
      if (!code) setDiscountPercent(0);
    },
    enabled: true,
  });

  const sync = cartSync || localSync;

  const mpesaPaybill = settings.payments.mpesa_paybill || '303030';
  const mpesaAccountNumber = settings.payments.mpesa_account_number || '2047728455';
  const mpesaAccountName = settings.payments.mpesa_account_name || 'ROPENIX INVESTMENTS LTD';
  const whatsappNumber = settings.payments.whatsapp_number || '0182180965';
  const cleanWhatsAppNumber = whatsappNumber.replace(/\D/g, '').replace(/^0/, '254').replace(/^254254/, '254');

  // Stepper state (1: Information, 2: Shipping, 3: Payment, 4: Review)
  const [activeStep, setActiveStep] = useState<CheckoutStep>(1);
  const [stepError, setStepError] = useState<string>('');

  const isUserLoggedIn = Boolean(isAuthenticated && user && user.email);

  // Helper functions to retrieve clean customer/member details from auth
  const getCleanMemberDetails = () => {
    if (!isUserLoggedIn || !user) {
      return { name: '', email: '', phone: '', address: '' };
    }
    const adminEmail = localStorage.getItem('veloce_admin_email') || 'ropenixkenya@gmail.com';
    const emailCandidate = user.email || '';
    const email = (emailCandidate && emailCandidate.toLowerCase() !== adminEmail.toLowerCase() && emailCandidate.toLowerCase() !== 'ropenixkenya@gmail.com') ? emailCandidate : '';

    const nameCandidate = user.name || '';
    const name = (nameCandidate && !['admin', 'superuser', 'admin demo'].includes(nameCandidate.toLowerCase())) ? nameCandidate : '';

    const phoneCandidate = user.phone || '';
    const phone = (phoneCandidate && phoneCandidate !== '0712345678' && phoneCandidate !== '+254700000000') ? phoneCandidate : '';

    const address = user.shippingAddress || '';

    return { name, email, phone, address };
  };

  const [isGuest, setIsGuest] = useState<boolean>(() => !isUserLoggedIn);

  // Form Fields
  const initialMember = getCleanMemberDetails();
  const [fullName, setFullName] = useState(() => isUserLoggedIn ? (initialMember.name || '') : '');
  const nameParts = (initialMember.name || '').trim().split(' ');
  const [firstName, setFirstName] = useState(() => isUserLoggedIn ? nameParts[0] || '' : '');
  const [lastName, setLastName] = useState(() => isUserLoggedIn ? nameParts.slice(1).join(' ') || '' : '');
  const [customerEmail, setCustomerEmail] = useState(() => isUserLoggedIn ? initialMember.email : '');
  const [customerPhone, setCustomerPhone] = useState(() => isUserLoggedIn ? initialMember.phone : '');
  const [shippingAddress, setShippingAddress] = useState(() => isUserLoggedIn ? initialMember.address : '');
  const [areaEstate, setAreaEstate] = useState('');
  const [landmark, setLandmark] = useState('');
  const [preferredCourier, setPreferredCourier] = useState<'any' | 'uber' | 'bolt' | 'pickup_mtaani'>('any');
  const [pickupMtaaniPoint, setPickupMtaaniPoint] = useState('');
  const [shippingCity, setShippingCity] = useState('Nairobi');
  const [shippingZip, setShippingZip] = useState('00100');
  const [shippingCountry, setShippingCountry] = useState('Kenya');
  const [saveShippingInfo, setSaveShippingInfo] = useState(true);

  const handleFullNameChange = (val: string) => {
    setFullName(val);
    const trimmed = val.trim();
    const parts = trimmed.split(' ');
    setFirstName(parts[0] || '');
    setLastName(parts.slice(1).join(' ') || '');
  };

  // Restore checkout session on component mount
  useEffect(() => {
    const savedSession = restoreCheckoutSession();
    if (savedSession) {
      // Restore all form data
      setActiveStep(savedSession.activeStep);
      setFulfillmentMethod(savedSession.fulfillmentMethod);
      setSelectedWarehouseId(savedSession.selectedWarehouseId);
      const combined = `${savedSession.firstName || ''} ${savedSession.lastName || ''}`.trim();
      setFullName(combined);
      setFirstName(savedSession.firstName);
      setLastName(savedSession.lastName);
      setCustomerEmail(savedSession.customerEmail);
      setCustomerPhone(savedSession.customerPhone);
      setIsGuest(savedSession.isGuest);
      setShippingAddress(savedSession.shippingAddress);
      if (savedSession.areaEstate) setAreaEstate(savedSession.areaEstate);
      if (savedSession.landmark) setLandmark(savedSession.landmark);
      if (savedSession.preferredCourier) setPreferredCourier(savedSession.preferredCourier as any);
      if (savedSession.pickupMtaaniPoint) setPickupMtaaniPoint(savedSession.pickupMtaaniPoint);
      setShippingCity(savedSession.shippingCity);
      setShippingZip(savedSession.shippingZip);
      setIsExpressDelivery(savedSession.isExpressDelivery);
      setCustomDistanceKm(savedSession.customDistanceKm);
      setPickupContactName(savedSession.pickupContactName);
      setPickupContactPhone(savedSession.pickupContactPhone);
      setPaymentMethod(savedSession.paymentMethod as any);
      setMpesaPhone(savedSession.mpesaPhone);
      if (savedSession.appliedCouponCode) {
        setAppliedCoupon(savedSession.appliedCouponCode);
      }
    }
  }, []); // Run only once on mount

  // Keep form fields synchronized with AuthContext state
  useEffect(() => {
    if (isAuthenticated && user && user.email) {
      setIsGuest(false);
      const userName = (user.name || '').trim();
      setFullName(userName);
      const parts = userName.split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
      setCustomerEmail(user.email || '');
      if (user.phone) {
        setCustomerPhone(user.phone);
        setMpesaPhone(user.phone);
      }
      if (user.shippingAddress) {
        setShippingAddress(user.shippingAddress);
      }
    } else if (!isAuthenticated || !user) {
      setIsGuest(true);
      setFullName('');
      setFirstName('');
      setLastName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setShippingAddress('');
    }
  }, [isAuthenticated, user]);

  // Full customer name derived
  const customerName = useMemo(() => {
    return fullName.trim() || `${firstName} ${lastName}`.trim();
  }, [fullName, firstName, lastName]);

  // Fulfillment & Shipping Method State
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('nairobi-central');
  const [pickupContactName, setPickupContactName] = useState('');
  const [pickupContactPhone, setPickupContactPhone] = useState('');
  const [isExpressDelivery, setIsExpressDelivery] = useState<boolean>(false);
  const [customDistanceKm, setCustomDistanceKm] = useState<number | null>(null);

  // Payment State
  const [checkoutChannel, setCheckoutChannel] = useState<'web' | 'whatsapp'>('web');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'cod'>('mpesa');
  const [mpesaPhone, setMpesaPhone] = useState(() => isUserLoggedIn ? initialMember.phone : '');
  const [mpesaTransactionCode, setMpesaTransactionCode] = useState('');
  const [copiedField, setCopiedField] = useState<'paybill' | 'account' | null>(null);

  // Coupons state
  const [couponInput, setCouponInput] = useState('');
  const [appliedCouponExpiry, setAppliedCouponExpiry] = useState('');
  const [flatDiscount, setFlatDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

  // Quick Auth Modal
  const [showQuickAuth, setShowQuickAuth] = useState(false);
  const [quickAuthMode, setQuickAuthMode] = useState<'login' | 'register'>('login');
  const [quickAuthEmail, setQuickAuthEmail] = useState('');
  const [quickAuthPassword, setQuickAuthPassword] = useState('');
  const [quickAuthName, setQuickAuthName] = useState('');
  const [quickAuthPhone, setQuickAuthPhone] = useState('');
  const [quickAuthError, setQuickAuthError] = useState('');
  const [quickAuthSuccess, setQuickAuthSuccess] = useState('');
  const [quickAuthLoading, setQuickAuthLoading] = useState(false);

  // Processing & completed order state
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkedOutOrder, setCheckedOutOrder] = useState<Order | null>(null);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  // Dynamic Delivery Zones & Thresholds
  const [storeZones, setStoreZones] = useState<ShippingZone[]>(() => {
    try {
      const saved = localStorage.getItem('veloce_shipping_zones');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [storeHappyHours, setStoreHappyHours] = useState<HappyHourWindow[]>(() => {
    try {
      const saved = localStorage.getItem('veloce_happy_hour_windows');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [storeFreeThreshold, setStoreFreeThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('veloce_free_delivery_threshold');
      if (saved) return Number(saved);
    } catch {}
    return 5000;
  });

  // Sync auth changes
  useEffect(() => {
    if (isUserLoggedIn && !isGuest) {
      const mem = getCleanMemberDetails();
      if (mem.name) {
        const parts = mem.name.split(' ');
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' ') || '');
      }
      if (mem.email) setCustomerEmail(mem.email);
      if (mem.phone) {
        setCustomerPhone(mem.phone);
        setMpesaPhone(mem.phone);
      }
      if (mem.address) setShippingAddress(mem.address);
    }
  }, [isUserLoggedIn, user]);

  // Handle Quick Auth Submit
  const handleQuickAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAuthEmail.trim() || !quickAuthEmail.includes('@')) {
      setQuickAuthError('Please provide a valid email address.');
      return;
    }

    setQuickAuthLoading(true);
    setQuickAuthError('');
    const cleanEmail = quickAuthEmail.trim();
    const cleanName = quickAuthName.trim() || (quickAuthMode === 'register' ? cleanEmail.split('@')[0] : (localStorage.getItem('veloce_login_name') || cleanEmail.split('@')[0]));
    const cleanPhone = quickAuthPhone.trim();

    try {
      login(cleanEmail, 'customer');
      localStorage.setItem('veloce_login_email', cleanEmail);
      localStorage.setItem('veloce_login_name', cleanName);
      if (cleanPhone) localStorage.setItem('veloce_login_phone', cleanPhone);

      const parts = cleanName.split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
      setCustomerEmail(cleanEmail);
      if (cleanPhone) {
        setCustomerPhone(cleanPhone);
        setMpesaPhone(cleanPhone);
      }
      setIsGuest(false);
      setShowQuickAuth(false);
      setQuickAuthSuccess(`Welcome back, ${cleanName}! Details auto-filled.`);
      setTimeout(() => setQuickAuthSuccess(''), 4000);
    } catch (err: any) {
      setQuickAuthError(err?.message || 'Authentication failed. Please try again.');
    } finally {
      setQuickAuthLoading(false);
    }
  };

  const handleCopyText = (text: string, field: 'paybill' | 'account') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Cart financial calculations
  const originalSubtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const catalogPreSaleRetailTotal = cart.reduce((acc, item) => {
    const dInfo = getProductDiscountInfo(item.product);
    const regPrice = dInfo.isOnSale && dInfo.originalPrice && dInfo.originalPrice > item.product.price
      ? dInfo.originalPrice
      : item.product.price;
    return acc + regPrice * item.quantity;
  }, 0);
  const promotionalMarkdownSavings = Math.max(0, catalogPreSaleRetailTotal - originalSubtotal);

  // Automatic Tier & Threshold Discount Calculation
  const DISCOUNT_THRESHOLD = 15000;
  const isThresholdReached = originalSubtotal >= DISCOUNT_THRESHOLD;
  const amountRemainingForThreshold = Math.max(0, DISCOUNT_THRESHOLD - originalSubtotal);
  const thresholdProgress = Math.min(100, Math.round((originalSubtotal / DISCOUNT_THRESHOLD) * 100));

  const volumeDiscountAmount = cart.reduce((acc, item) => {
    if (item.quantity >= 6) {
      return acc + (item.product.price * item.quantity * 0.15);
    }
    return acc;
  }, 0);

  // If order reaches the KSh 15,000 threshold and no individual item-level bulk was applied, apply automatic 15% discount
  const thresholdDiscountAmount = isThresholdReached && volumeDiscountAmount === 0
    ? originalSubtotal * 0.15
    : 0;

  const totalAutomaticDiscount = Math.max(volumeDiscountAmount, thresholdDiscountAmount);

  const subtotal = Math.max(0, originalSubtotal - totalAutomaticDiscount);
  const percentageDiscountAmount = Math.max(0, subtotal * (discountPercent / 100));
  const discountAmount = percentageDiscountAmount + flatDiscount;
  const totalDiscountSavings = totalAutomaticDiscount + percentageDiscountAmount + flatDiscount;
  const discountedSubtotal = Math.max(0, originalSubtotal - totalDiscountSavings);
  const hasPhysicalItems = cart.some(item => !item.product?.type || item.product.type === 'physical');

  // Dynamic Multi-layered Delivery Fee Calculation
  // NOTE: Automated shipping rate calculation at checkout is removed/disabled.
  // Delivery fees are determined post-order based on actual courier charges (Uber, Bolt, PickUp Mtaani).
  // Reversible toggle: Set `enableAutomatedCheckoutRates = true` to re-enable automated calculation.
  const enableAutomatedCheckoutRates = false;

  const deliveryFeeCalculation = useMemo(() => {
    if (fulfillmentMethod === 'pickup' || !hasPhysicalItems) {
      return {
        fee: 0,
        originalFee: 0,
        discount: 0,
        reason: fulfillmentMethod === 'pickup' ? 'Self-Pickup (FREE)' : 'Digital Fulfillment (FREE)',
        reasonCode: 'free_threshold' as const,
        isFreeDelivery: true,
        isHappyHourApplied: false,
        amountRemainingForFreeShipping: 0,
        isTbc: false,
        estimatedTimeframe: 'Ready in 2–4 Business Hours',
        breakdown: { baseFee: 0, distanceFee: 0, expressSurcharge: 0, discountAmount: 0 }
      };
    }

    if (enableAutomatedCheckoutRates) {
      return {
        ...calculate_delivery_fee({
          orderSubtotal: discountedSubtotal,
          distanceKm: customDistanceKm !== null ? customDistanceKm : 5.5,
          isExpress: isExpressDelivery,
          freeDeliveryThreshold: storeFreeThreshold,
          zones: storeZones,
          happyHours: storeHappyHours,
          selectedRegion: `${shippingAddress} ${shippingCity}`
        }),
        isTbc: false,
      };
    }

    // Doorstep delivery: fee is KES 0 at checkout with TBC (To Be Confirmed)
    return {
      fee: 0,
      originalFee: 0,
      discount: 0,
      reason: 'To be confirmed based on actual courier charges (Uber, Bolt, PickUp Mtaani)',
      reasonCode: 'tbc_courier' as const,
      isFreeDelivery: false,
      isHappyHourApplied: false,
      amountRemainingForFreeShipping: 0,
      isTbc: true,
      estimatedTimeframe: 'Calculated post-order (Uber / Bolt / PickUp Mtaani)',
      breakdown: { baseFee: 0, distanceFee: 0, expressSurcharge: 0, discountAmount: 0 }
    };
  }, [
    fulfillmentMethod,
    hasPhysicalItems,
    discountedSubtotal,
    customDistanceKm,
    isExpressDelivery,
    storeFreeThreshold,
    storeZones,
    storeHappyHours,
    shippingAddress,
    shippingCity
  ]);

  const shippingFee = deliveryFeeCalculation.fee;
  const isDeliveryFeeTbc = fulfillmentMethod === 'delivery' && hasPhysicalItems;

  // Mixed-tax calculations
  const mixedTaxSummary = calculateMixedCartTax(
    cart.map((item) => ({
      product: item.product,
      quantity: item.quantity,
      price: item.quantity >= 6 ? item.product.price * 0.85 : item.product.price,
    })),
    discountAmount,
    shippingFee,
    'exempt',
    0
  );

  const total = mixedTaxSummary.cartTotal;

  // Coupon Handlers
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    setCouponSuccess('');
    const code = couponInput.trim().toUpperCase();

    if (!code) {
      setCouponError('Please enter a coupon code.');
      return;
    }

    if (appliedCoupon === code) {
      setCouponError(`Coupon "${code}" is already applied.`);
      return;
    }

    if (coupons && coupons[code] !== undefined) {
      const couponEntry = coupons[code];
      const pct = getCouponPercent(couponEntry);
      const expiry = getCouponExpiry(couponEntry);
      const isManuallyDisabled = isCouponManuallyDisabled(couponEntry);

      if (isManuallyDisabled) {
        setCouponError(`Coupon "${code}" is inactive.`);
        return;
      }

      if (isCouponExpired(expiry)) {
        setCouponError(`Coupon "${code}" expired on ${formatCouponExpiry(expiry)}.`);
        return;
      }

      setAppliedCoupon(code);
      setDiscountPercent(pct);
      setAppliedCouponExpiry(expiry || '');
      setCouponSuccess(`Coupon "${code}" applied! ${pct}% discount active.`);
      setCouponInput('');
      return;
    }

    try {
      const res = await fetch('/api/sensitive/verify-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, cartSubtotal: subtotal })
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        if (data.expiryDate && isCouponExpired(data.expiryDate)) {
          setCouponError(`Coupon "${data.code || code}" expired on ${formatCouponExpiry(data.expiryDate)}.`);
          return;
        }
        setAppliedCoupon(data.code);
        setDiscountPercent(data.discountPercent);
        setAppliedCouponExpiry(data.expiryDate || '');
        setCouponSuccess(`Coupon "${data.code}" verified! ${data.description}`);
        setCouponInput('');
        return;
      } else if (data.error) {
        setCouponError(data.error);
        return;
      }
    } catch {
      // Fallback
    }

    setCouponError(`Invalid coupon code "${code}". Please check and try again.`);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon('');
    setAppliedCouponExpiry('');
    setDiscountPercent(0);
    setCouponSuccess('');
    setCouponError('');
  };

  // Payment restrictions analysis
  const hasPrepaid = cart.some(item => item.product?.paymentRestriction === 'prepaid');
  const hasCod = cart.some(item => item.product?.paymentRestriction === 'cod');
  const hasConflict = hasPrepaid && hasCod;

  useEffect(() => {
    if (hasConflict) return;
    if (hasPrepaid) {
      setPaymentMethod('mpesa');
    } else if (hasCod) {
      setPaymentMethod('cod');
    }
  }, [hasPrepaid, hasCod, hasConflict]);

  // Save checkout state to localStorage for persistence on page refresh
  useEffect(() => {
    saveCheckoutSession({
      activeStep,
      fulfillmentMethod,
      selectedWarehouseId,
      firstName,
      lastName,
      customerEmail,
      customerPhone,
      isGuest,
      shippingAddress,
      areaEstate,
      landmark,
      preferredCourier,
      pickupMtaaniPoint,
      shippingCity,
      shippingZip,
      isExpressDelivery,
      customDistanceKm,
      pickupContactName,
      pickupContactPhone,
      paymentMethod,
      mpesaPhone,
      appliedCouponCode: appliedCoupon,
    });
  }, [
    activeStep,
    fulfillmentMethod,
    selectedWarehouseId,
    firstName,
    lastName,
    customerEmail,
    customerPhone,
    isGuest,
    shippingAddress,
    areaEstate,
    landmark,
    preferredCourier,
    pickupMtaaniPoint,
    shippingCity,
    shippingZip,
    isExpressDelivery,
    customDistanceKm,
    pickupContactName,
    pickupContactPhone,
    paymentMethod,
    mpesaPhone,
    appliedCoupon,
  ]);

  const handleSplitCart = () => {
    const codItems = cart.filter(item => item.product?.paymentRestriction === 'cod');
    const codProductIds = codItems.map(item => item.product?.id).filter(Boolean);
    onBulkMoveToWishlist(codProductIds);
  };

  // Step Navigation Handlers
  const validateStep1 = () => {
    setStepError('');
    if (!fullName.trim() && !firstName.trim()) {
      setStepError('Please enter your full name.');
      return false;
    }
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setStepError('Please enter a valid email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail.trim())) {
      setStepError('Please enter a valid email address (e.g. name@domain.com).');
      return false;
    }
    if (!customerPhone.trim()) {
      setStepError('Please enter your phone number.');
      return false;
    }
    if (!isValidKenyanPhone(customerPhone.trim())) {
      setStepError('Please enter a valid Kenyan phone number (e.g. 0712 345 678, 0110 123 456, or +254 712 345 678).');
      return false;
    }
    if (fulfillmentMethod === 'delivery') {
      if (!shippingAddress.trim()) {
        setStepError('Please enter your street / building address.');
        return false;
      }
      if (!areaEstate.trim()) {
        setStepError('Please enter your area or estate (e.g. Kilimani, South B, Rongai) to calculate courier delivery charges.');
        return false;
      }
    }
    return true;
  };

  const handleGoToShipping = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      if (saveShippingInfo && !isGuest) {
        localStorage.setItem('veloce_login_name', customerName);
        localStorage.setItem('veloce_login_email', customerEmail);
        localStorage.setItem('veloce_login_phone', customerPhone);
        localStorage.setItem('veloce_login_address', shippingAddress);
      }
      setActiveStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGoToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === 'mpesa') {
      const code = mpesaTransactionCode.trim();
      if (!code) {
        setStepError('M-PESA Confirmation Code is required. Please enter the code received in your Lipa na M-PESA SMS to continue.');
        return;
      }
      if (code.length < 6) {
        setStepError('Please enter a valid M-PESA transaction code (e.g. SHB4X7K9LP).');
        return;
      }
    }
    setStepError('');
    setActiveStep(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // WhatsApp message builder
  const buildWhatsAppOrderUrl = (order: Order) => {
    const itemsList = order.items
      .map((item, idx) => {
        const variationText =
          Object.keys(item.selectedVariations || {}).length > 0
            ? ` (${Object.entries(item.selectedVariations)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ')})`
            : '';
        return `${idx + 1}. *${item.name}*${variationText}\n   Qty: ${item.quantity} × KSh ${item.price.toLocaleString('en-KE')} = *KSh ${(item.price * item.quantity).toLocaleString('en-KE')}*`;
      })
      .join('\n');

    const courierLabel = order.preferredCourier === 'uber' ? 'Uber Package'
      : order.preferredCourier === 'bolt' ? 'Bolt Send'
      : order.preferredCourier === 'pickup_mtaani' ? 'PickUp Mtaani'
      : 'Best Available Courier';

    const deliveryText =
      order.fulfillmentType === 'pickup'
        ? `• *Fulfillment:* Self-Pickup (${order.pickupLocation || 'Warehouse Hub'})`
        : `• *Delivery Address:* ${order.shippingAddress || 'Nairobi'}\n• *Area / Estate:* ${order.areaEstate || 'N/A'}\n• *Landmark:* ${order.landmark || 'N/A'}\n• *Preferred Courier:* ${courierLabel}${order.pickupMtaaniPoint ? `\n• *PickUp Mtaani Point:* ${order.pickupMtaaniPoint}` : ''}`;

    const discountsText =
      order.discountAmount && order.discountAmount > 0
        ? `\n• *Discount Savings:* -KSh ${order.discountAmount.toLocaleString('en-KE')}`
        : '';

    const couponText = order.couponCode ? ` (Promo: ${order.couponCode})` : '';

    const deliveryFeeDisplay = order.fulfillmentType === 'pickup'
      ? 'FREE (Self-Pickup)'
      : '⏳ To be confirmed (TBC - Uber/Bolt/PickUp Mtaani)';

    const message = `*NEW ORDER - ROPENIX COLLECTIONS*
----------------------------------------
• *Order Ref:* #${order.id.toUpperCase()}
• *Customer Name:* ${order.customerName}
• *Phone Number:* ${order.phone || 'N/A'}
• *Email:* ${order.customerEmail}
${deliveryText}

*Order Items:*
${itemsList}
----------------------------------------
• *Subtotal:* KSh ${(order.subtotal || order.total).toLocaleString('en-KE')}
• *Delivery Fee:* ${deliveryFeeDisplay}${discountsText}${couponText}
• *ITEMS TOTAL:* *KSh ${order.total.toLocaleString('en-KE')}* (Delivery fee quoted separately)

• *Order Placement Channel:* 📱 WhatsApp Checkout
• *Payment Method:* ${order.paymentMethod === 'cod' ? '🚚 Cash on Delivery (Doorstep)' : `📲 Lipa na M-PESA Paybill (${mpesaPaybill})`}${order.paymentReference ? `\n• *Payment Reference / Code:* ${order.paymentReference}` : ''}
----------------------------------------
_Notice: Delivery fee is not included in total and will be confirmed based on actual courier charges before dispatch._
_Hello Ropenix Team, I would like to place and confirm this order!_`;

    return `https://wa.me/${cleanWhatsAppNumber}?text=${encodeURIComponent(message)}`;
  };

  // Order Submission
  const handleCompleteOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (sync.hasBlockingChanges) {
      setStepError('One or more items in your cart are out of stock or have quantity restrictions. Please review your cart.');
      return;
    }

    if (paymentMethod === 'mpesa' && !mpesaTransactionCode.trim()) {
      setStepError('M-PESA Confirmation Code is required. Please enter the code from your Lipa na M-PESA SMS.');
      setActiveStep(3);
      return;
    }

    setIsProcessing(true);
    setStepError('');

    try {
      // 1. Authoritative Pre-validation Check
      const validation = await sync.validateCartNow();
      if (validation && (validation.hasConflict || (validation.changes && validation.changes.length > 0))) {
        setStepError('Cart items or prices have changed in real time. Please review the updated cart notices before completing your order.');
        setIsProcessing(false);
        return;
      }

      const orderItems = cart.map((item, idx) => {
        const effectivePrice = item.quantity >= 6 ? item.product.price * 0.85 : item.product.price;
        const lineCalc = mixedTaxSummary.lineCalculations[idx];
        const taxInfo = getProductTaxInfo(item.product);

        return {
          productId: item.product.id,
          name: item.product.name,
          price: effectivePrice,
          quantity: item.quantity,
          selectedVariations: item.selectedVariations,
          type: item.product.type,
          taxStatus: taxInfo.taxStatus,
          taxRate: taxInfo.taxRate,
          taxClass: taxInfo.taxClass,
          lineSubtotal: lineCalc ? lineCalc.lineSubtotal : effectivePrice * item.quantity,
          lineTax: lineCalc ? lineCalc.lineTax : 0,
        };
      });

      const selectedWarehouse = WAREHOUSE_HUBS.find(w => w.id === selectedWarehouseId) || WAREHOUSE_HUBS[0];
      const effectiveShippingAddress = fulfillmentMethod === 'pickup'
        ? `Self-Pickup at ${selectedWarehouse.name}, ${selectedWarehouse.address}`
        : `${shippingAddress}${areaEstate ? `, ${areaEstate}` : ''}${landmark ? ` (Landmark: ${landmark})` : ''}, ${shippingCity} ${shippingZip}, ${shippingCountry}`;

      const trimmedName = customerName || (isGuest ? 'Guest Customer' : 'Customer');
      const trimmedEmail = customerEmail.trim();
      const trimmedPhone = customerPhone.trim() || mpesaPhone.trim();

      const isDeliveryOrder = fulfillmentMethod === 'delivery';

      const newOrder: Order = {
        id: 'ord-' + (1000 + Math.floor(Math.random() * 9000)),
        customerName: trimmedName,
        customerEmail: trimmedEmail,
        phone: trimmedPhone,
        items: orderItems,
        total: mixedTaxSummary.cartTotal,
        subtotal: mixedTaxSummary.cartSubtotal,
        taxTotal: mixedTaxSummary.totalTax,
        shippingFee: 0, // Delivery fee determined post-order based on actual courier charges
        shippingTaxAmount: 0,
        discountAmount,
        status: isDeliveryOrder ? 'awaiting_delivery_quote' : 'pending',
        deliveryFeeStatus: isDeliveryOrder ? 'tbc' : 'waived',
        areaEstate: isDeliveryOrder ? areaEstate.trim() : undefined,
        landmark: isDeliveryOrder ? landmark.trim() : undefined,
        preferredCourier: isDeliveryOrder ? preferredCourier : undefined,
        pickupMtaaniPoint: (isDeliveryOrder && pickupMtaaniPoint.trim()) ? pickupMtaaniPoint.trim() : undefined,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        couponCode: appliedCoupon || undefined,
        shippingAddress: effectiveShippingAddress,
        fulfillmentType: fulfillmentMethod,
        pickupLocation: fulfillmentMethod === 'pickup' ? `${selectedWarehouse.name} (${selectedWarehouse.address})` : undefined,
        pickupContactPhone: fulfillmentMethod === 'pickup' ? (pickupContactPhone || trimmedPhone) : trimmedPhone,
        pickupEstimatedTime: fulfillmentMethod === 'pickup' ? selectedWarehouse.readyTime : undefined,
        isGuest,
        checkoutChannel: checkoutChannel,
        checkoutMode: checkoutChannel,
        orderSource: checkoutChannel === 'whatsapp' ? 'whatsapp' : 'website',
        paymentMethod: paymentMethod,
        paymentStatus: 'unpaid',
        paymentReference: mpesaTransactionCode.trim() || undefined,
        mpesaPhone: mpesaPhone.trim() || trimmedPhone || undefined,
      };

      await onPlaceOrder(newOrder);

      if (mpesaTransactionCode.trim()) {
        const cleanCode = mpesaTransactionCode.trim().toUpperCase();
        fetch('/api/payments/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: newOrder.id,
            mpesaCode: cleanCode,
            phoneNumber: newOrder.mpesaPhone || newOrder.phone,
            amount: newOrder.total,
            notes: 'Submitted directly during checkout placement',
          }),
        }).catch(() => {});
      }

      if (checkoutChannel === 'whatsapp') {
        const waUrl = buildWhatsAppOrderUrl(newOrder);
        try {
          window.open(waUrl, '_blank');
        } catch {
          window.location.href = waUrl;
        }
      }

      setCheckedOutOrder(newOrder);
      clearCheckoutSession(); // Clear the checkout session after successful order
      setIsProcessing(false);
      setEmailStatus('sent');
      onClearCart();
      setAppliedCoupon('');
      setDiscountPercent(0);
      setMpesaTransactionCode('');
    } catch (err: any) {
      setIsProcessing(false);
      if (err?.response?.status === 409 || err?.status === 409) {
        const conflictData = err?.response?.data || err?.data;
        sync.handle409OrderConflict(conflictData);
        setStepError(conflictData?.message || 'Some cart items or prices have changed. We have updated your cart. Please review the changes before placing your order.');
        return;
      }
      console.error('[CheckoutFlow] Order placement error:', err);
      setStepError('An error occurred while placing your order. Please review your cart and try again.');
    }
  };

  // Render Completed Order View
  if (checkedOutOrder) {
    const handleDownloadPDFReceipt = () => {
      const htmlContent = generateHTMLReceipt(checkedOutOrder, currency);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Veloce_Invoice_${checkedOutOrder.id.toUpperCase()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const isOrderPaid = checkedOutOrder.paymentStatus === 'paid' || checkedOutOrder.status === 'completed';
    const isOrderUnderReview = checkedOutOrder.paymentStatus === 'pending_verification' || Boolean(checkedOutOrder.paymentReference);

    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 md:p-10 shadow-sm text-center">
          <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mb-4 sm:mb-5 shadow-xs">
            <CheckCircle className="h-7 w-7 sm:h-8 sm:w-8 stroke-[2.5]" />
          </div>

          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-mono">
            {checkedOutOrder.fulfillmentType === 'delivery' && checkedOutOrder.status === 'awaiting_delivery_quote'
              ? 'Order Placed • Awaiting Courier Quote'
              : isOrderPaid
              ? 'Payment Verified & Order Placed'
              : isOrderUnderReview
              ? 'Payment Submitted • Verifying'
              : 'Order Placed • Complete Payment'}
          </span>
          <h1 className="mt-1.5 text-xl sm:text-2xl md:text-3xl font-display font-bold text-gray-900 dark:text-white leading-tight">
            Thank You, {checkedOutOrder.customerName}!
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-gray-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Order <strong className="font-mono text-gray-900 dark:text-white">#{checkedOutOrder.id.toUpperCase()}</strong> has been recorded and an official summary sent to <strong className="text-gray-900 dark:text-white break-all">{checkedOutOrder.customerEmail}</strong>.
          </p>

          {/* Quick Details Bar */}
          <div className="mt-5 sm:mt-6 rounded-2xl bg-slate-50 dark:bg-slate-850/70 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 text-left max-w-lg mx-auto space-y-2.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <span className="text-gray-500 dark:text-slate-400">Order Reference</span>
              <span className="font-mono font-bold text-gray-900 dark:text-white uppercase">{checkedOutOrder.id}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <span className="text-gray-500 dark:text-slate-400">Fulfillment</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {checkedOutOrder.fulfillmentType === 'pickup' ? '🏬 Warehouse Pickup' : `🚚 Doorstep Delivery (${checkedOutOrder.areaEstate || 'Nairobi'})`}
              </span>
            </div>
            {checkedOutOrder.fulfillmentType === 'delivery' && (
              <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                <span className="text-gray-500 dark:text-slate-400">Delivery Fee</span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded text-[11px] border border-amber-200 dark:border-amber-800">
                  To be confirmed (TBC)
                </span>
              </div>
            )}
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <span className="text-gray-500 dark:text-slate-400">Payment Status</span>
              <span className={`font-semibold px-2 py-0.5 rounded-md text-[11px] ${
                isOrderPaid
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : isOrderUnderReview
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                  : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
              }`}>
                {isOrderPaid ? '✓ Paid & Confirmed' : isOrderUnderReview ? '⏳ Verification in Progress' : '⚡ Awaiting Payment'}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 font-bold text-sm sm:text-base">
              <div>
                <span className="text-gray-900 dark:text-white">Items Total</span>
                {checkedOutOrder.fulfillmentType === 'delivery' && (
                  <span className="block text-[10px] text-amber-700 font-normal">
                    (Excludes delivery fee)
                  </span>
                )}
              </div>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(checkedOutOrder.total, currency)}</span>
            </div>
          </div>

          {/* Post-Order Delivery Quote Explanation Box */}
          {checkedOutOrder.fulfillmentType === 'delivery' && (
            <div className="mt-4 max-w-lg mx-auto text-left rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300/80 p-4 text-xs text-amber-950 dark:text-amber-200 space-y-1.5 shadow-3xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300">
                <Truck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Courier Delivery Quoting Notice</span>
              </div>
              <p className="text-[11.5px] text-amber-800 dark:text-amber-300 leading-relaxed font-normal">
                Delivery fee is not included in your total. It will be calculated after your order is placed, based on courier charges (Uber, Bolt, or PickUp Mtaani), and we'll contact you to confirm before dispatch.
              </p>
              <div className="text-[10.5px] font-mono text-amber-900 dark:text-amber-400 pt-1.5 border-t border-amber-200/60 flex items-center justify-between">
                <span>📍 Area: {checkedOutOrder.areaEstate || 'Nairobi'}</span>
                <span>📞 Contact: {checkedOutOrder.phone || 'N/A'}</span>
              </div>
            </div>
          )}

          {/* EMBEDDED PAYBILL & PAYMENT VERIFICATION NOTICE (If M-Pesa & not yet paid) */}
          {checkedOutOrder.paymentMethod !== 'cod' && !isOrderPaid && (
            <div className="mt-6 max-w-lg mx-auto text-left rounded-3xl border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/15 p-4 sm:p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3.5">
                <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Lipa na M-PESA Paybill Reference
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Your payment details have been recorded for admin verification
                  </p>
                </div>
              </div>

              {/* Paybill Numbers Card with 1-Click Copy */}
              <div className="grid grid-cols-2 gap-2 mb-3.5">
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between shadow-3xs">
                  <div>
                    <span className="text-[9px] text-slate-400 block">Paybill Number</span>
                    <strong className="text-emerald-700 dark:text-emerald-400 font-mono text-xs">{mpesaPaybill}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(mpesaPaybill, 'paybill')}
                    className="text-slate-400 hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Copy Paybill"
                  >
                    {copiedField === 'paybill' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between shadow-3xs">
                  <div>
                    <span className="text-[9px] text-slate-400 block">Account Number</span>
                    <strong className="text-emerald-700 dark:text-emerald-400 font-mono text-xs">{mpesaAccountNumber}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(mpesaAccountNumber, 'account')}
                    className="text-slate-400 hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Copy Account"
                  >
                    {copiedField === 'account' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {checkedOutOrder.paymentReference ? (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Payment Reference Recorded: <strong className="font-mono">{checkedOutOrder.paymentReference}</strong></span>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                    Your payment code entered at checkout has been recorded. Our store administrator will verify it against the M-Pesa statement and update your status.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <span>Payment Pending Admin Verification</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    If you completed payment via Paybill, our store administrator will cross-reference the payment and confirm your order shortly.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Paid / Verified Celebration Box */}
          {isOrderPaid && (
            <div className="mt-6 max-w-lg mx-auto p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-left flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs text-emerald-900 dark:text-emerald-300">
                  Payment Verified &amp; Confirmed!
                </h4>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 leading-relaxed">
                  Ref: <strong className="font-mono">{checkedOutOrder.paymentReference || 'CONFIRMED'}</strong>. Your order is moving to packaging and doorstep dispatch.
                </p>
              </div>
            </div>
          )}

          {/* Guest Email Updates Notification Banner */}
          {isGuest && (
            <div className="mt-6 max-w-lg mx-auto rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/50 p-4 text-xs text-left flex items-start gap-3 shadow-3xs">
              <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-indigo-950 dark:text-indigo-200">
                  Email Updates &amp; Delivery Tracking
                </h4>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5 leading-relaxed">
                  All parcel dispatch notifications, courier tracking numbers, and invoice receipts are delivered straight to <strong className="text-indigo-950 dark:text-white break-all">{checkedOutOrder.customerEmail}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Order Action Hub */}
          <div className="mt-8 max-w-md mx-auto w-full space-y-3">
            {isGuest ? (
              /* GUEST ACTIONS: PDF Receipt & Continue Shopping */
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleDownloadPDFReceipt}
                  className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm px-6 flex items-center justify-center gap-2.5 transition-all shadow-md shadow-indigo-600/25 cursor-pointer active:scale-[0.99]"
                >
                  <Download className="h-4.5 w-4.5 stroke-[2.2]" />
                  <span>Download PDF Receipt &amp; Invoice</span>
                  <ArrowRight className="h-4 w-4 ml-0.5 opacity-80" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCheckedOutOrder(null);
                    if (setCurrentTab) setCurrentTab('store');
                    else if (onSwitchTab) onSwitchTab('store');
                  }}
                  className="w-full h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs px-4 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <ShoppingBag className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
                  <span>Continue Shopping</span>
                </button>
              </div>
            ) : (
              /* REGISTERED MEMBER ACTIONS: Portal Tracking + Grid */
              <>
                <button
                  onClick={() => {
                    setCheckedOutOrder(null);
                    if (setCurrentTab) setCurrentTab('user');
                    else if (onSwitchTab) onSwitchTab('user');
                  }}
                  className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm px-6 flex items-center justify-center gap-2.5 transition-all shadow-md shadow-indigo-600/25 cursor-pointer active:scale-[0.99]"
                >
                  <PackageCheck className="h-4.5 w-4.5 stroke-[2.2]" />
                  <span>Track &amp; View My Orders</span>
                  <ArrowRight className="h-4 w-4 ml-0.5 opacity-80" />
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleDownloadPDFReceipt}
                    className="h-11 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs px-3.5 flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
                  >
                    <Download className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="truncate">PDF Receipt</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setCheckedOutOrder(null);
                      if (setCurrentTab) setCurrentTab('store');
                      else if (onSwitchTab) onSwitchTab('store');
                    }}
                    className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs px-3.5 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <ShoppingBag className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                    <span className="truncate">Continue Shopping</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Empty Cart State
  if (cart.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8 font-sans antialiased text-gray-900">
        <div className="mx-auto max-w-md px-4 py-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-3xl bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 mb-6">
            <ShoppingBag className="h-10 w-10 stroke-1" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Cart is Empty</h2>
          <p className="mt-2 text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
            Looks like you haven't added any items to your bag yet. Explore our curated collections to get started.
          </p>
          <div className="mt-6">
            <button
              onClick={() => {
                if (setCurrentTab) setCurrentTab('store');
                else if (onSwitchTab) onSwitchTab('store');
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-slate-200 font-medium text-xs px-8 shadow-sm transition-all cursor-pointer"
            >
              <span>Explore Store</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Recently Viewed / Recommended Slider in Empty Cart */}
        <RecentlyViewedSlider
          products={products}
          cart={cart}
          onSelectProduct={onSelectProduct}
          onAddToCart={onAddToCart}
          onViewCart={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          currency={currency}
          onExploreStore={() => (setCurrentTab ? setCurrentTab('store') : onSwitchTab?.('store'))}
        />
      </div>
    );
  }

  const stepsList = [
    { num: 1, title: 'Information', sub: 'Address & Contact' },
    { num: 2, title: 'Shipping', sub: 'Delivery Method' },
    { num: 3, title: 'Payment', sub: 'Cards & Wallets' },
    { num: 4, title: 'Review', sub: 'Confirm & Place' },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 font-sans antialiased text-gray-900">
      {/* REAL-TIME CART SYNCHRONIZATION BANNER */}
      <CartChangeNoticeBanner
        notices={sync.notices}
        onDismiss={sync.dismissNotice}
        onClearAll={sync.clearAllNotices}
        isValidating={sync.isValidating}
        isStreamConnected={sync.isStreamConnected}
        onManualSync={sync.validateCartNow}
      />

      {/* TOP PROGRESS STEPPER */}
      <div className="mb-6 sm:mb-10 max-w-3xl mx-auto">
        <div className="flex items-center justify-between relative">
          {/* Subtle connecting line */}
          <div className="absolute top-4 sm:top-5 left-6 sm:left-8 right-6 sm:right-8 h-[1px] bg-gray-200 dark:bg-slate-800 -z-0" />

          {stepsList.map((step) => {
            const isActive = activeStep === step.num;
            const isCompleted = activeStep > step.num;
            return (
              <button
                key={step.num}
                type="button"
                onClick={() => {
                  if (step.num < activeStep) {
                    setActiveStep(step.num as CheckoutStep);
                  } else if (step.num === 2 && validateStep1()) {
                    setActiveStep(2);
                  }
                }}
                className={`flex flex-col items-center relative z-10 group transition-all ${
                  step.num <= activeStep ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                <div
                  className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'border-2 border-indigo-600 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 ring-2 sm:ring-4 ring-indigo-50 dark:ring-indigo-950 shadow-xs'
                      : isCompleted
                      ? 'bg-indigo-600 text-white border-2 border-indigo-600'
                      : 'border-2 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-400'
                  }`}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" /> : step.num}
                </div>
                <div className="mt-1.5 sm:mt-2 text-center">
                  <span
                    className={`block text-[10px] sm:text-xs font-bold leading-tight ${
                      isActive || isCompleted ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-500'
                    }`}
                  >
                    {step.title}
                  </span>
                  <span className="hidden sm:block text-[10px] text-gray-400 dark:text-slate-500 font-normal mt-0.5">
                    {step.sub}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: ACTIVE STEP CONTAINER */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl sm:rounded-3xl border border-gray-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-8 lg:p-10 shadow-xs">
            {stepError && (
              <div className="mb-6 rounded-2xl bg-rose-50 border border-rose-200/80 p-3.5 text-xs text-rose-700 flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span className="font-medium">{stepError}</span>
              </div>
            )}

            {/* STEP 1: INFORMATION (ADDRESS & CONTACT) */}
            {activeStep === 1 && (
              <form onSubmit={handleGoToShipping} className="space-y-6">
                <div>
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-gray-950 dark:text-white">Contact &amp; Shipping Details</h2>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 sm:mt-1">Where should we deliver your purchase?</p>
                    </div>

                    {!isUserLoggedIn && (
                      <button
                        type="button"
                        onClick={() => setShowQuickAuth(true)}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap pt-1 sm:pt-0"
                      >
                        <LogIn className="h-3.5 w-3.5" /> <span>Sign in</span>
                      </button>
                    )}
                  </div>
                </div>

                {isUserLoggedIn && (
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50 border border-gray-150 text-xs text-gray-600">
                    <span className="flex items-center gap-1.5 font-medium">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" /> Signed in as {customerEmail}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setIsGuest(true);
                        setFirstName('');
                        setLastName('');
                        setCustomerEmail('');
                        setCustomerPhone('');
                        setShippingAddress('');
                      }}
                      className="text-xs text-gray-400 hover:text-rose-600 underline cursor-pointer"
                    >
                      Sign out
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => handleFullNameChange(e.target.value)}
                      placeholder="e.g. Sarah Connor"
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-xs text-gray-900 focus:border-black focus:outline-hidden transition-colors"
                    />
                  </div>

                  {/* Email & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                        Email Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="sarah.connor@example.com"
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-xs text-gray-900 focus:border-black focus:outline-hidden transition-colors"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          Phone Number <span className="text-rose-500">*</span>
                        </label>
                        {customerPhone.trim() && (
                          <span className={`text-[10px] font-mono font-bold ${
                            isValidKenyanPhone(customerPhone.trim())
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}>
                            {isValidKenyanPhone(customerPhone.trim()) ? '✓ Valid Kenyan Number' : 'e.g. 07XXXXXXXX'}
                          </span>
                        )}
                      </div>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => {
                          setCustomerPhone(e.target.value);
                          if (!mpesaPhone || mpesaPhone === customerPhone) {
                            setMpesaPhone(e.target.value);
                          }
                        }}
                        placeholder="e.g. 0712 345 678 or +254 712 345 678"
                        className={`h-11 w-full rounded-xl border bg-white px-3.5 text-xs text-gray-900 focus:outline-hidden transition-colors ${
                          customerPhone.trim() && !isValidKenyanPhone(customerPhone.trim())
                            ? 'border-amber-400 focus:border-amber-500'
                            : 'border-gray-200 focus:border-black'
                        }`}
                      />
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                        Format: 07XX XXX XXX, 01XX XXX XXX, or +254 7XX XXX XXX
                      </p>
                    </div>
                  </div>

                  {/* Street Address */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Street Address / Building <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      placeholder="e.g. 14 Riverside Drive, Block B, Suite 401"
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-xs text-gray-900 focus:border-black focus:outline-hidden transition-colors"
                    />
                  </div>

                  {/* Area / Estate & Landmark (Essential for Local Courier Quoting) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                        Area / Estate / Neighborhood <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={areaEstate}
                        onChange={(e) => setAreaEstate(e.target.value)}
                        placeholder="e.g. Kilimani, South B, Rongai, Thika Rd"
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-xs text-gray-900 focus:border-black focus:outline-hidden transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                        Nearest Landmark / Building / Floor
                      </label>
                      <input
                        type="text"
                        value={landmark}
                        onChange={(e) => setLandmark(e.target.value)}
                        placeholder="e.g. Near Quickmart, 3rd Floor Apt 4B"
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-xs text-gray-900 focus:border-black focus:outline-hidden transition-colors"
                      />
                    </div>
                  </div>

                  {/* City & Zip */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                        City / Town <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={shippingCity}
                        onChange={(e) => {
                          setShippingCity(e.target.value);
                          // Auto-fill postal code if available
                          const postalCode = getPostalCodeForTown(e.target.value);
                          if (postalCode) {
                            setShippingZip(postalCode);
                          }
                        }}
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-xs text-gray-900 focus:border-black focus:outline-hidden transition-colors cursor-pointer"
                      >
                        <option value="">Select a town or city...</option>
                        {getAllKenyanTowns().map((town) => (
                          <option key={town} value={town}>
                            {town}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                        Zip / Postal Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={shippingZip}
                        onChange={(e) => setShippingZip(e.target.value)}
                        placeholder="00100"
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-xs text-gray-900 focus:border-black focus:outline-hidden transition-colors"
                      />
                    </div>
                  </div>

                  {/* Country - Fixed to Kenya */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      Country
                    </label>
                    <div className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 text-xs text-gray-900 flex items-center font-medium">
                      🇰🇪 Kenya
                    </div>
                  </div>

                  {/* PROMINENT DELIVERY NOTICE (STEP 1) */}
                  <div className="rounded-2xl border border-amber-300/80 bg-amber-50/75 dark:bg-amber-950/30 p-4 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-3 shadow-3xs">
                    <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-bold text-xs text-amber-900 dark:text-amber-300 block">
                        Delivery Fee Notice
                      </span>
                      <p className="text-[11.5px] text-amber-800 dark:text-amber-300 leading-relaxed font-normal">
                        Delivery fee is not included in your total. It will be calculated after your order is placed, based on courier charges (Uber, Bolt, or PickUp Mtaani), and we'll contact you to confirm before dispatch.
                      </p>
                    </div>
                  </div>

                  {/* Save info checkbox */}
                  <div className="pt-2">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={saveShippingInfo}
                        onChange={(e) => setSaveShippingInfo(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black accent-black cursor-pointer"
                      />
                      <span className="text-xs text-gray-600">Save this shipping information for one-click future checkouts</span>
                    </label>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 dark:border-slate-800 flex items-center justify-center sm:justify-end">
                  <button
                    type="submit"
                    className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs px-8 shadow-sm shadow-indigo-600/20 transition-all cursor-pointer active:scale-98"
                  >
                    <span>Continue to Shipping</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: SHIPPING (FULFILLMENT METHOD) */}
            {activeStep === 2 && (
              <form onSubmit={handleGoToPayment} className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-950">Shipping &amp; Fulfillment Method</h2>
                  <p className="text-xs text-gray-500 mt-1">Select your preferred dispatch method or warehouse collection</p>
                </div>

                {/* Recap of Address */}
                <div className="rounded-2xl border border-gray-200/80 p-4 bg-gray-50/50 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Ship to</span>
                    <span className="font-semibold text-gray-900 mt-0.5 block">
                      {customerName} • {shippingAddress}{areaEstate ? `, ${areaEstate}` : ''}, {shippingCity}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="text-xs font-semibold text-black hover:underline cursor-pointer"
                  >
                    Change
                  </button>
                </div>

                {/* PROMINENT DELIVERY NOTICE (STEP 2) */}
                <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 via-amber-50/60 to-orange-50/40 p-3.5 sm:p-4 text-xs text-amber-950 flex items-start gap-3 shadow-3xs">
                  <div className="p-1.5 rounded-xl bg-amber-100/90 text-amber-800 shrink-0 mt-0.5">
                    <Info className="h-4 w-4" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <span className="font-bold text-xs text-amber-900 block">
                      Courier Delivery Rate Calculation
                    </span>
                    <p className="text-[11.5px] text-amber-800 leading-relaxed font-normal">
                      Delivery fee is not included in your checkout total. It will be calculated after your order is placed, based on live courier charges (Uber, Bolt, or PickUp Mtaani), and we'll contact you to confirm before dispatch.
                    </p>
                  </div>
                </div>

                {/* Delivery Options */}
                <div className="space-y-3 sm:space-y-3.5 w-full">
                  {/* Local Courier Delivery Option */}
                  <div
                    onClick={() => setFulfillmentMethod('delivery')}
                    className={`flex flex-col p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer select-none w-full ${
                      fulfillmentMethod === 'delivery'
                        ? 'border-indigo-600 bg-indigo-50/20 ring-1.5 ring-indigo-600/90 shadow-xs'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {/* Header Row - Full Width Responsive Layout */}
                    <div className="flex items-start gap-3 min-w-0 w-full">
                      <div className="mt-0.5 shrink-0">
                        <input
                          type="radio"
                          name="fulfillment"
                          checked={fulfillmentMethod === 'delivery'}
                          onChange={() => setFulfillmentMethod('delivery')}
                          className="h-4 w-4 text-indigo-600 accent-indigo-600 cursor-pointer"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-sm sm:text-base font-bold text-gray-950 block">Local Courier Delivery</span>
                            <span className="text-xs text-gray-500 font-medium block">(Uber / Bolt / PickUp Mtaani)</span>
                          </div>
                          {/* Single Clean Price Badge */}
                          <div className="shrink-0 text-right">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/90 text-amber-800 font-mono font-bold text-[11px] sm:text-xs shadow-3xs whitespace-nowrap">
                              To be confirmed
                            </span>
                            <span className="block text-[10px] text-gray-400 font-mono mt-0.5">Live quote</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                          Quoted at actual courier rates based on your area <span className="font-semibold text-gray-800">({areaEstate || shippingAddress || 'Nairobi'})</span>.
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-indigo-700 font-medium">
                          <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                          <span>Fast doorstep dispatch across Kenya</span>
                        </div>
                      </div>
                    </div>

                    {/* Preferred Courier Selector (If Delivery is Selected) */}
                    {fulfillmentMethod === 'delivery' && (
                      <div className="mt-4 pt-4 border-t border-gray-100 sm:border-indigo-100/70 space-y-3 w-full">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10.5px] sm:text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                            Select Preferred Local Courier <span className="text-gray-400 font-normal lowercase">(optional)</span>
                          </label>
                        </div>

                        {/* Responsive Courier Selection Grid (Spacious 2-column on desktop/tablet, full-width on mobile) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 w-full">
                          {[
                            { 
                              id: 'any', 
                              label: 'Best Rate', 
                              badge: 'Lowest Quote',
                              desc: 'Lowest live quote found across services',
                              icon: <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                            },
                            { 
                              id: 'uber', 
                              label: 'Uber Package', 
                              badge: 'Doorstep Car',
                              desc: 'Direct doorstep delivery via car/van',
                              icon: <Car className="h-4 w-4 text-gray-800" />
                            },
                            { 
                              id: 'bolt', 
                              label: 'Bolt Send', 
                              badge: 'Express Boda',
                              desc: 'Rapid motorbike dispatch rider',
                              icon: <Bike className="h-4 w-4 text-emerald-600" />
                            },
                            { 
                              id: 'pickup_mtaani', 
                              label: 'PickUp Mtaani', 
                              badge: 'Agent Point',
                              desc: 'Affordable collection counter agent',
                              icon: <Store className="h-4 w-4 text-indigo-600" />
                            },
                          ].map((c) => {
                            const isSelected = preferredCourier === c.id;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setPreferredCourier(c.id as any);
                                }}
                                className={`group relative flex items-start justify-between p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition-all duration-150 cursor-pointer select-none active:scale-[0.99] w-full ${
                                  isSelected
                                    ? 'border-indigo-600 bg-indigo-50/70 ring-1.5 ring-indigo-600 text-indigo-950 shadow-xs'
                                    : 'border-gray-200/90 bg-white hover:border-gray-300 hover:bg-gray-50/50 text-gray-700'
                                }`}
                              >
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${isSelected ? 'bg-white shadow-3xs text-indigo-600' : 'bg-gray-100 group-hover:bg-gray-200/70'}`}>
                                    {c.icon}
                                  </div>
                                  <div className="min-w-0 flex-1 pr-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <span className={`text-xs sm:text-sm font-bold leading-tight block ${isSelected ? 'text-indigo-950' : 'text-gray-900'}`}>
                                        {c.label}
                                      </span>
                                      {c.badge && (
                                        <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold uppercase font-mono tracking-wide whitespace-nowrap ${
                                          c.id === 'any' ? 'bg-amber-100 text-amber-900 border border-amber-200/60' : 'bg-gray-100 text-gray-700 border border-gray-200/60'
                                        }`}>
                                          {c.badge}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11.5px] sm:text-xs text-gray-500 leading-snug line-clamp-2">
                                      {c.desc}
                                    </p>
                                  </div>
                                </div>

                                <div className="shrink-0 ml-2 mt-0.5">
                                  {isSelected ? (
                                    <CheckCircle2 className="h-5 w-5 text-indigo-600 fill-indigo-100" />
                                  ) : (
                                    <div className="h-4 w-4 rounded-full border-2 border-gray-300 group-hover:border-gray-400 transition-colors" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* PickUp Mtaani Specific Drop Point (if PickUp Mtaani selected) */}
                        {preferredCourier === 'pickup_mtaani' && (
                          <div className="pt-1.5 w-full">
                            <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-2 animate-in fade-in duration-200 w-full">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                <label className="block text-[11px] font-bold text-indigo-950 uppercase tracking-wider">
                                  Preferred PickUp Mtaani Agent / Location
                                </label>
                              </div>
                              <input
                                type="text"
                                value={pickupMtaaniPoint}
                                onChange={(e) => setPickupMtaaniPoint(e.target.value)}
                                placeholder="e.g. Pioneer House CBD / Sarit Centre / Roysambu Agent"
                                className="h-10 w-full rounded-xl border border-indigo-200 bg-white px-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-hidden"
                              />
                              <p className="text-[10.5px] text-indigo-800/80">
                                💡 We will quote the exact PickUp Mtaani package rate for this collection point.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Warehouse Self-Pickup Option */}
                  <div
                    onClick={() => setFulfillmentMethod('pickup')}
                    className={`flex flex-col p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer select-none w-full ${
                      fulfillmentMethod === 'pickup'
                        ? 'border-emerald-600 bg-emerald-50/20 ring-1.5 ring-emerald-600/90 shadow-xs'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 w-full">
                      <div className="mt-0.5 shrink-0">
                        <input
                          type="radio"
                          name="fulfillment"
                          checked={fulfillmentMethod === 'pickup'}
                          onChange={() => setFulfillmentMethod('pickup')}
                          className="h-4 w-4 text-emerald-600 accent-emerald-600 cursor-pointer"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-sm sm:text-base font-bold text-gray-950 block">Warehouse Hub Self-Pickup</span>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase font-mono">
                              FREE
                            </span>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-bold text-[11px] sm:text-xs shadow-3xs whitespace-nowrap">
                              FREE
                            </span>
                            <span className="block text-[10px] text-gray-400 font-mono mt-0.5">Zero charge</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                          Collect directly from any of our official logistics depots in Nairobi.
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-700 font-mono font-medium">
                          <Warehouse className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>Ready in 2–4 Business Hours</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Warehouse Selection if Pickup */}
                {fulfillmentMethod === 'pickup' && (
                  <div className="space-y-3.5 pt-2">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                        Choose Collection Location
                      </label>
                      <div className="relative">
                        <select
                          value={selectedWarehouseId}
                          onChange={(e) => setSelectedWarehouseId(e.target.value)}
                          className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-xs font-medium text-gray-900 focus:border-black focus:outline-hidden transition-colors cursor-pointer appearance-none"
                        >
                          {WAREHOUSE_HUBS.map((hub) => (
                            <option key={hub.id} value={hub.id}>
                              {hub.name} ({hub.readyTime})
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-500">
                          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Selected Location Information Card */}
                    {(() => {
                      const selectedHub = WAREHOUSE_HUBS.find(h => h.id === selectedWarehouseId) || WAREHOUSE_HUBS[0];
                      return (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 space-y-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-gray-900 block">{selectedHub.name}</span>
                              <span className="text-gray-500 mt-0.5 block">📍 {selectedHub.address} ({selectedHub.landmark})</span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">
                              {selectedHub.readyTime}
                            </span>
                          </div>
                          <div className="pt-2 border-t border-gray-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 font-mono">
                            <span>🕒 {selectedHub.hours}</span>
                            <span>📞 {selectedHub.phone}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Pickup Contact Information */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Pickup Contact Name
                        </label>
                        <input
                          type="text"
                          value={pickupContactName}
                          onChange={(e) => setPickupContactName(e.target.value)}
                          placeholder={customerName || "Full name of collector"}
                          className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:border-black focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Collector Mobile Number
                        </label>
                        <input
                          type="tel"
                          value={pickupContactPhone}
                          onChange={(e) => setPickupContactPhone(e.target.value)}
                          placeholder={customerPhone || "+254 7XX XXX XXX"}
                          className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:border-black focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t border-gray-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-3.5">
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="w-full sm:w-auto text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer py-1"
                  >
                    <ChevronLeft className="h-4 w-4" /> Return to Information
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs px-8 shadow-sm shadow-indigo-600/20 transition-all cursor-pointer active:scale-98"
                  >
                    <span>Continue to Payment</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: PAYMENT METHOD */}
            {activeStep === 3 && (
              <form onSubmit={handleGoToReview} className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-950">Payment &amp; Settlement</h2>
                  <p className="text-xs text-gray-500 mt-1">All transactions are secure and encrypted</p>
                </div>

                {/* Placement Channel */}
                <div className="space-y-2.5">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Order Placement Channel
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCheckoutChannel('web')}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        checkoutChannel === 'web'
                          ? 'border-black bg-neutral-50 ring-1 ring-black'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Globe className="h-4 w-4 text-black" />
                        <div>
                          <span className="text-xs font-bold text-gray-900 block">Online Web Checkout</span>
                          <span className="text-[10px] text-gray-500">Automated ledger &amp; instant receipt</span>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCheckoutChannel('whatsapp')}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        checkoutChannel === 'whatsapp'
                          ? 'border-[#25D366] bg-emerald-50/50 ring-1 ring-[#25D366]'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <MessageCircle className="h-4 w-4 text-[#25D366]" />
                        <div>
                          <span className="text-xs font-bold text-gray-900 block">WhatsApp Checkout</span>
                          <span className="text-[10px] text-gray-500">Direct sales line: {whatsappNumber}</span>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Payment Option Cards */}
                <div className="space-y-3 pt-2">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Select Payment Method
                  </label>

                  {/* M-PESA Option */}
                  <div
                    onClick={() => !hasCod && setPaymentMethod('mpesa')}
                    className={`p-4 rounded-2xl border transition-all ${
                      hasCod ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      paymentMethod === 'mpesa'
                        ? 'border-black bg-neutral-50/40 ring-1 ring-black'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === 'mpesa'}
                          disabled={hasCod}
                          onChange={() => setPaymentMethod('mpesa')}
                          className="h-4 w-4 text-black accent-black"
                        />
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-emerald-600" />
                          <span className="text-xs font-bold text-gray-900">Lipa na M-PESA (Paybill)</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        Paybill {mpesaPaybill}
                      </span>
                    </div>

                    {paymentMethod === 'mpesa' && (
                      <div className="mt-4 pt-4 border-t border-gray-200/80 space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="p-3 rounded-xl bg-white border border-gray-200 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] font-bold text-gray-400 uppercase font-mono block">Paybill Number</span>
                              <span className="text-sm font-bold font-mono text-gray-900">{mpesaPaybill}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyText(mpesaPaybill, 'paybill');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-[10px] font-semibold text-gray-700 transition flex items-center gap-1 cursor-pointer"
                            >
                              {copiedField === 'paybill' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              {copiedField === 'paybill' ? 'Copied' : 'Copy'}
                            </button>
                          </div>

                          <div className="p-3 rounded-xl bg-white border border-gray-200 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] font-bold text-gray-400 uppercase font-mono block">Account Number</span>
                              <span className="text-sm font-bold font-mono text-gray-900">{mpesaAccountNumber}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyText(mpesaAccountNumber, 'account');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-[10px] font-semibold text-gray-700 transition flex items-center gap-1 cursor-pointer"
                            >
                              {copiedField === 'account' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              {copiedField === 'account' ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>

                        {/* Required M-Pesa Transaction / Confirmation Code */}
                        <div className="pt-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                              M-PESA Confirmation Code <span className="text-rose-500">*</span>
                            </label>
                            {mpesaTransactionCode.trim() && (
                              <span className={`text-[10px] font-mono font-bold ${
                                mpesaTransactionCode.trim().length >= 8
                                  ? 'text-emerald-600'
                                  : 'text-amber-600'
                              }`}>
                                {mpesaTransactionCode.trim().length >= 8 ? '✓ Code Entered' : `${mpesaTransactionCode.trim().length}/10 chars`}
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            required
                            value={mpesaTransactionCode}
                            onChange={(e) => {
                              setMpesaTransactionCode(e.target.value.toUpperCase());
                              if (stepError) setStepError('');
                            }}
                            placeholder="e.g. SHB4X7K9LP"
                            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-xs font-mono uppercase tracking-wider text-gray-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-hidden transition-colors"
                          />
                          <p className="text-[10.5px] text-gray-500 mt-1.5 leading-relaxed">
                            💡 Enter the 10-character code from your Lipa na M-PESA SMS. Our store administrator will check and verify this code to confirm your payment.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cash on Delivery Option */}
                  <div
                    onClick={() => !hasPrepaid && setPaymentMethod('cod')}
                    className={`p-4 rounded-2xl border transition-all ${
                      hasPrepaid ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      paymentMethod === 'cod'
                        ? 'border-black bg-neutral-50/40 ring-1 ring-black'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === 'cod'}
                          disabled={hasPrepaid}
                          onChange={() => setPaymentMethod('cod')}
                          className="h-4 w-4 text-black accent-black"
                        />
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-amber-600" />
                          <span className="text-xs font-bold text-gray-900">Cash on Delivery</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium">Doorstep Settle</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-3.5">
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="w-full sm:w-auto text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer py-1"
                  >
                    <ChevronLeft className="h-4 w-4" /> Return to Shipping
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs px-8 shadow-sm shadow-indigo-600/20 transition-all cursor-pointer active:scale-98"
                  >
                    <span>Continue to Review</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 4: REVIEW & PLACE ORDER */}
            {activeStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-950">Review Your Order</h2>
                  <p className="text-xs text-gray-500 mt-1">Please confirm your details before completing your order</p>
                </div>

                {/* Summary Panels */}
                <div className="rounded-2xl border border-gray-200 divide-y divide-gray-150 text-xs">
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[10px] block">Contact Details</span>
                      <span className="font-semibold text-gray-900 block mt-0.5">{customerName} ({customerEmail}, {customerPhone})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveStep(1)}
                      className="text-xs font-semibold text-black hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[10px] block">Fulfillment</span>
                      <span className="font-semibold text-gray-900 block mt-0.5">
                        {fulfillmentMethod === 'pickup'
                          ? `🏬 Warehouse Pickup (${WAREHOUSE_HUBS.find(w => w.id === selectedWarehouseId)?.shortName})`
                          : `🚚 Doorstep Delivery to ${shippingAddress}${areaEstate ? `, ${areaEstate}` : ''}${landmark ? ` (${landmark})` : ''}, ${shippingCity}`}
                      </span>
                      {fulfillmentMethod === 'delivery' && (
                        <div className="mt-1.5 p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-[11px] text-amber-900 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold">Delivery Fee:</span>
                            <span>To be confirmed (TBC) based on live courier quote</span>
                          </div>
                          <div className="text-[10.5px] text-amber-800 flex items-center gap-1.5">
                            <span className="font-bold">Preferred Dispatch:</span>
                            <span>
                              {preferredCourier === 'uber'
                                ? 'Uber Package (Direct car)'
                                : preferredCourier === 'bolt'
                                ? 'Bolt Send (Rapid motorbike)'
                                : preferredCourier === 'pickup_mtaani'
                                ? `PickUp Mtaani${pickupMtaaniPoint ? ` • Drop Point: ${pickupMtaaniPoint}` : ''}`
                                : 'Best Rate (Lowest live quote)'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveStep(2)}
                      className="text-xs font-semibold text-black hover:underline cursor-pointer ml-3 shrink-0"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[10px] block">Payment Method</span>
                      <span className="font-semibold text-gray-900 block mt-0.5">
                        {paymentMethod === 'cod' ? 'Cash on Delivery' : `Lipa na M-PESA Paybill (${mpesaPaybill})`}
                        {checkoutChannel === 'whatsapp' ? ' • WhatsApp Placement' : ''}
                      </span>
                      {paymentMethod === 'mpesa' && mpesaTransactionCode && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-mono">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>M-PESA Code: <strong>{mpesaTransactionCode}</strong></span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveStep(3)}
                      className="text-xs font-semibold text-black hover:underline cursor-pointer ml-3 shrink-0"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-3.5">
                  <button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    className="w-full sm:w-auto text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer py-1"
                  >
                    <ChevronLeft className="h-4 w-4" /> Return to Payment
                  </button>

                  <button
                    type="button"
                    onClick={handleCompleteOrder}
                    disabled={isProcessing || sync.isValidating || sync.hasBlockingChanges}
                    className={`w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl font-semibold text-xs px-8 shadow-sm transition-all cursor-pointer active:scale-98 ${
                      isProcessing || sync.isValidating || sync.hasBlockingChanges
                        ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                        : checkoutChannel === 'whatsapp'
                        ? 'bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-[#25D366]/20'
                        : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-indigo-600/20'
                    }`}
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4 animate-spin" /> Processing Order...
                      </span>
                    ) : sync.isValidating ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Validating cart...
                      </span>
                    ) : sync.hasBlockingChanges ? (
                      <span>Resolve Cart Notices to Place Order</span>
                    ) : checkoutChannel === 'whatsapp' ? (
                      <>
                        <MessageCircle className="h-4 w-4" />
                        <span>Place Order via WhatsApp ({formatPrice(total, currency)})</span>
                      </>
                    ) : (
                      <>
                        <span>Place Order ({formatPrice(total, currency)})</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: STICKY ORDER SUMMARY (MATCHING SCREENSHOT) */}
        <div className="lg:col-span-5 lg:sticky lg:top-8">
          <div className="rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-7 shadow-xs space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-gray-700" />
                <h3 className="font-bold text-sm text-gray-900">Order Summary</h3>
              </div>
              <span className="text-xs text-gray-500 font-medium">
                {cart.reduce((s, i) => s + i.quantity, 0)} {cart.reduce((s, i) => s + i.quantity, 0) === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Cart Items List */}
            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              {cart.map((item, idx) => {
                const specsText = Object.entries(item.selectedVariations || {})
                  .map(([k, v]) => `${v}`)
                  .join(' / ');

                const isHighlighted = sync.highlightedIds.has(item.product.id);
                const stockData = sync.stockInfo[item.product.id];
                const isOutOfStock = (item.product.stock !== null && item.product.stock <= 0) || stockData?.isOutOfStock;
                const isLowStock = stockData?.isLowStock || (item.product.stock !== null && item.product.stock > 0 && item.product.stock <= 5);
                const priceHist = sync.priceHistory[item.product.id];
                const hasPriceChanged = Boolean(priceHist && priceHist.oldPrice !== item.product.price);

                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3.5 pb-4 border-b border-gray-50 last:border-0 last:pb-0 transition-all duration-300 rounded-xl ${
                      isHighlighted ? 'ring-2 ring-amber-400/80 bg-amber-50/20 p-2 animate-pulse' : ''
                    } ${isOutOfStock ? 'opacity-65 grayscale-[35%] bg-slate-50/80 p-2 rounded-xl border border-dashed border-rose-200' : ''}`}
                  >
                    {/* Thumbnail with quantity badge */}
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center p-1">
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        width={64}
                        height={64}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain object-center"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[9px] font-bold text-white">
                        {item.quantity}
                      </span>
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-[8px] font-bold text-white uppercase bg-rose-600 px-1 py-0.5 rounded">
                            Out of Stock
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Details & Controls */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-semibold text-gray-900 leading-tight truncate max-w-[180px]">
                              {item.product.name}
                            </h4>
                            {isOutOfStock && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                                Out of stock
                              </span>
                            )}
                            {!isOutOfStock && isLowStock && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-amber-100 text-amber-900">
                                Only {item.product.stock ?? stockData?.stock} left
                              </span>
                            )}
                          </div>
                          {specsText ? (
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">{specsText}</p>
                          ) : (
                            <p className="text-[10px] text-gray-400 mt-0.5">{item.product.category || 'Luxury Collection'}</p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          {hasPriceChanged && (
                            <span className="block line-through text-[10px] text-gray-400 font-mono">
                              {formatPrice(priceHist.oldPrice * item.quantity, currency)}
                            </span>
                          )}
                          <span className={`font-mono text-xs font-bold ${hasPriceChanged ? 'text-amber-600' : 'text-gray-900'}`}>
                            {formatPrice(item.product.price * item.quantity, currency)}
                          </span>
                        </div>
                      </div>

                      {/* Stepper + Delete button */}
                      <div className="mt-2.5 flex items-center justify-between">
                        {isOutOfStock ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onRemoveFromCart(item.product.id, item.selectedVariations)}
                              className="text-[10px] font-medium text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                            >
                              Remove item
                            </button>
                            <span className="text-gray-300">•</span>
                            <button
                              type="button"
                              onClick={() => alert(`We will notify you when ${item.product.name} is back in stock!`)}
                              className="text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                            >
                              Notify me when back
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 h-7 px-1">
                            <button
                              type="button"
                              onClick={() => onUpdateCartQty(item.product.id, item.selectedVariations, Math.max(1, item.quantity - 1))}
                              disabled={item.quantity <= 1}
                              className="p-1 text-gray-400 hover:text-black transition disabled:opacity-30 cursor-pointer"
                            >
                              <Minus className="h-2.5 w-2.5" />
                            </button>
                            <span className="px-2 font-mono text-[11px] font-semibold text-gray-800">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateCartQty(item.product.id, item.selectedVariations, item.quantity + 1)}
                              disabled={item.product.stock !== null && item.quantity >= item.product.stock}
                              className="p-1 text-gray-400 hover:text-black transition disabled:opacity-30 cursor-pointer"
                            >
                              <Plus className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => onRemoveFromCart(item.product.id, item.selectedVariations)}
                          className="text-gray-400 hover:text-rose-600 transition p-1 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Minimal Automatic Discount Notice */}
            <div className="p-3 rounded-2xl border border-indigo-100/90 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/60 via-slate-50 to-emerald-50/50 dark:from-indigo-950/25 dark:via-slate-900/40 dark:to-emerald-950/25 text-xs shadow-3xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    {isThresholdReached || volumeDiscountAmount > 0
                      ? '15% Automatic Discount Applied!'
                      : `Add ${formatPrice(amountRemainingForThreshold, currency)} more to save 15%`}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-extrabold text-emerald-700 dark:text-emerald-400">
                  {isThresholdReached || volumeDiscountAmount > 0 ? '✓ UNLOCKED' : `${thresholdProgress}%`}
                </span>
              </div>

              {/* Clean Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${isThresholdReached || volumeDiscountAmount > 0 ? 100 : thresholdProgress}%` }}
                />
              </div>

              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight">
                {isThresholdReached || volumeDiscountAmount > 0
                  ? `An automatic 15% savings (-${formatPrice(totalAutomaticDiscount, currency)}) was applied to your order.`
                  : `Orders of ${formatPrice(DISCOUNT_THRESHOLD, currency)} or more automatically receive a 15% discount at checkout.`}
              </p>
            </div>

            {/* Promo Code Input */}
            <div className="pt-2">
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  placeholder="% PROMO CODE (E.G. SAVE15)"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value);
                    if (couponError) setCouponError('');
                  }}
                  className="h-10 flex-1 rounded-xl border border-gray-200 bg-white px-3.5 text-xs uppercase placeholder:normal-case font-mono focus:border-black focus:outline-hidden"
                />
                <button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  APPLY
                </button>
              </form>

              {couponError && (
                <p className="mt-2 text-[11px] text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {couponError}
                </p>
              )}

              {appliedCoupon && (
                <div className="mt-2.5 flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                  <span className="text-emerald-900 font-semibold flex items-center gap-1 font-mono">
                    <Tag className="h-3 w-3 text-emerald-600" /> {appliedCoupon} (-{discountPercent}%)
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-rose-600 hover:underline text-[11px] font-bold cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Financial Lines */}
            <div className="pt-4 border-t border-gray-100 space-y-2.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono text-gray-900 font-semibold">{formatPrice(subtotal, currency)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Savings &amp; Coupons</span>
                  <span className="font-mono">-{formatPrice(discountAmount, currency)}</span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  Shipping / Delivery <Info className="h-3 w-3 text-gray-400" />
                </span>
                <span className="font-mono text-gray-900 font-semibold">
                  {fulfillmentMethod === 'pickup' ? (
                    <span className="text-emerald-600 font-bold">FREE (Self-Pickup)</span>
                  ) : (
                    <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200">
                      To be confirmed (TBC)
                    </span>
                  )}
                </span>
              </div>

              {/* VISIBLE NOTICE IN ORDER SUMMARY */}
              {fulfillmentMethod === 'delivery' && (
                <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300/80 text-[11px] text-amber-950 dark:text-amber-200 leading-relaxed shadow-3xs">
                  <strong className="block text-amber-900 dark:text-amber-300 mb-0.5 font-bold">Delivery Notice:</strong>
                  Delivery fee is not included in your total. It will be calculated after your order is placed, based on courier charges (Uber, Bolt, or PickUp Mtaani), and we'll contact you to confirm before dispatch.
                </div>
              )}

              <div className="flex justify-between">
                <span>Estimated Tax (16% VAT)</span>
                <span className="font-mono text-gray-900 font-semibold">{formatPrice(mixedTaxSummary.totalTax, currency)}</span>
              </div>

              {/* Total */}
              <div className="pt-3 border-t border-gray-100 flex items-baseline justify-between text-base">
                <div>
                  <span className="font-bold text-gray-900">Total</span>
                  {fulfillmentMethod === 'delivery' && (
                    <span className="block text-[10px] text-amber-700 font-medium">
                      + Courier fee quoted upon placement
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 font-mono uppercase mr-1">KES / {currency}</span>
                  <span className="font-bold text-lg font-mono text-gray-950">
                    {formatPrice(total, currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Trust Badges at Bottom */}
            <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-500">
              <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <Shield className="h-3.5 w-3.5 text-emerald-600" />
                <span>30-Day Easy Returns</span>
              </div>
              <div className="flex items-center gap-1.5 text-indigo-700 font-medium">
                <Truck className="h-3.5 w-3.5 text-indigo-600" />
                <span>Free Ground Over KSh 5,000</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RECENTLY VIEWED ITEMS SLIDER AT BOTTOM OF CART/CHECKOUT */}
      <RecentlyViewedSlider
        products={products}
        cart={cart}
        onSelectProduct={onSelectProduct}
        onAddToCart={onAddToCart}
        onViewCart={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        currency={currency}
        onExploreStore={() => (setCurrentTab ? setCurrentTab('store') : onSwitchTab?.('store'))}
      />

      {/* QUICK SIGN IN MODAL */}
      {showQuickAuth && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-black" />
                <h3 className="text-sm font-bold text-gray-900">
                  {quickAuthMode === 'login' ? 'Member Quick Sign In' : 'Create Member Account'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAuth(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {quickAuthError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{quickAuthError}</span>
              </div>
            )}

            <form onSubmit={handleQuickAuthSubmit} className="space-y-3.5">
              {quickAuthMode === 'register' && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Full Name</label>
                  <input
                    type="text"
                    value={quickAuthName}
                    onChange={(e) => setQuickAuthName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="h-10 w-full rounded-xl border border-gray-200 px-3 text-xs focus:border-black focus:outline-hidden"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={quickAuthEmail}
                  onChange={(e) => setQuickAuthEmail(e.target.value)}
                  placeholder="e.g. member@example.com"
                  className="h-10 w-full rounded-xl border border-gray-200 px-3 text-xs focus:border-black focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Password</label>
                <input
                  type="password"
                  value={quickAuthPassword}
                  onChange={(e) => setQuickAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 w-full rounded-xl border border-gray-200 px-3 text-xs focus:border-black focus:outline-hidden font-mono"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setQuickAuthMode(quickAuthMode === 'login' ? 'register' : 'login')}
                  className="text-black font-semibold hover:underline cursor-pointer"
                >
                  {quickAuthMode === 'login' ? 'New customer? Create account' : 'Already have account? Sign in'}
                </button>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={quickAuthLoading}
                  className="flex-1 h-11 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>{quickAuthLoading ? 'Authenticating...' : (quickAuthMode === 'login' ? 'Sign In & Auto-fill' : 'Register & Auto-fill')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickAuth(false)}
                  className="h-11 px-4 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition cursor-pointer"
                >
                  Guest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

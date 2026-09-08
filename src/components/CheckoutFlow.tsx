/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Trash2, Tag, CreditCard, Clock, FileText, ArrowRight, CheckCircle, Download, Check, Sparkles, Award, Gift, Heart, Mail, Printer, Send, Inbox, ExternalLink, RefreshCw, Plus, Minus, AlertCircle, CheckCircle2, XCircle, Warehouse, Truck, MapPin, Building2, UserCheck, Navigation, Phone, Calendar, Info, X, Percent, Flame, Smartphone, Copy, Zap, Globe, MessageCircle } from 'lucide-react';
import { CartItem, Product, Order, CouponItem } from '../types';
import { CurrencyType, formatPrice } from '../lib/currency';
import { emailService } from '../services/api';
import HappyHourBanner from './HappyHourBanner';
import AddressAutocomplete, { AddressDetails } from './AddressAutocomplete';
import InteractiveDeliveryMap from './InteractiveDeliveryMap';
import { calculate_delivery_fee } from '../services/deliveryEngine';
import { ShippingZone, HappyHourWindow } from '../types/shipping';
import { DEFAULT_STORE_LOCATION } from '../services/maps';
import {
  isCouponExpired,
  isCouponActive,
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
      <tr style="border-b: 1px solid #f3f4f6;">
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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
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
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 700;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin-top: 4px;
    }
    .invoice-details {
      text-align: right;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #4b5563;
    }
    .metadata-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .metadata-hdr {
      font-family: 'JetBrains Mono', monospace;
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
      font-family: 'JetBrains Mono', monospace;
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
      font-family: 'JetBrains Mono', monospace;
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
      background-color: #4b8bd8;
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
      background-color: #3a79c4;
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
          <span style="background-color: #4b8bd8; color: white; padding: 4px 8px; font-size: 9px; font-weight: 700; border-radius: 3px; text-transform: uppercase;">Settled Paid</span>
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
            ✓ Secure TLS v1.3 Verified
          </div>
        </td>
        <td style="width: 50%; vertical-align: top;">
          <div class="metadata-hdr">Settlement Process</div>
          <table style="width: 100%; font-size: 12px; color: #4b5563; font-weight: 300;">
            <tr>
              <td style="padding: 2px 0;">Method:</td>
              <td style="text-align: right; font-weight: 600; color: #111827;">${order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'M-PESA Paybill'}</td>
            </tr>
            ${order.paymentMethod !== 'cod' ? `
            <tr>
              <td style="padding: 2px 0;">Paybill No:</td>
              <td style="text-align: right; font-weight: 700; font-family: monospace; color: #059669;">303030</td>
            </tr>
            <tr>
              <td style="padding: 2px 0;">Account No:</td>
              <td style="text-align: right; font-weight: 700; font-family: monospace; color: #059669;">2047728455</td>
            </tr>
            <tr>
              <td style="padding: 2px 0;">Account Name:</td>
              <td style="text-align: right; font-weight: 600; font-size: 11px; color: #111827;">ROPENIX INVESTMENTS LTD</td>
            </tr>
            ` : ''}
            ${order.paymentReference ? `
            <tr>
              <td style="padding: 2px 0;">M-Pesa Ref:</td>
              <td style="text-align: right; font-weight: 700; font-family: monospace; color: #059669;">${order.paymentReference}</td>
            </tr>
            <tr>
              <td style="padding: 2px 0;">Settlement:</td>
              <td style="text-align: right; font-weight: 700; color: #059669;">Prepaid Before Delivery</td>
            </tr>` : ''}
            ${(order.mpesaPhone || (order.paymentMethod === 'mpesa' && order.phone)) ? `
            <tr>
              <td style="padding: 2px 0;">Payer Mobile:</td>
              <td style="text-align: right; font-weight: 600; font-family: monospace; color: #111827;">${order.mpesaPhone || order.phone}</td>
            </tr>` : ''}
            ${order.couponCode ? `
            <tr>
              <td style="padding: 2px 0;">Ref Code:</td>
              <td style="text-align: right; font-weight: 600; font-family: monospace; color: #4f46e5;">${order.couponCode}</td>
            </tr>` : ''}
          </table>
        </td>
      </tr>
    </table>

    <table class="items-table">
      <thead>
        <tr>
          <th style="text-align: left; padding-bottom: 8px;">Description</th>
          <th style="text-align: center; width: 60px; padding-bottom: 8px;">Qty</th>
          <th style="text-align: right; width: 100px; padding-bottom: 8px;">Unit Price</th>
          <th style="text-align: right; width: 100px; padding-bottom: 8px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <table class="totals-table">
      <tr>
        <td style="color: #6b7280; font-weight: 300;">Gross Subtotal</td>
        <td style="text-align: right; font-family: monospace; color: #111827;">${formatPrice(subtotal, currency)}</td>
      </tr>
      <tr>
        <td style="color: #6b7280; font-weight: 300;">Total Line-Item Tax (VAT)</td>
        <td style="text-align: right; font-family: monospace; color: #111827;">${formatPrice(taxTotal, currency)}</td>
      </tr>
      ${discount > 0 ? `
      <tr>
        <td style="color: #059669; font-weight: 500;">Discounts Applied</td>
        <td style="text-align: right; font-family: monospace; color: #059669; font-weight: 600;">-${formatPrice(discount, currency)}</td>
      </tr>` : ''}
      <tr class="grand-total">
        <td style="padding-top: 12px; font-weight: 700;">GRAND TOTAL SETTLED</td>
        <td style="text-align: right; font-family: monospace; font-weight: 700; color: #111827; padding-top: 12px; font-size: 15px;">${formatPrice(order.total, currency)}</td>
      </tr>
    </table>

    <div class="footer-note">
      <p>This automated statement serves as official digital proof of asset release. 3-year structural builder warranty registered instantly.</p>
      <p style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #cbccd4; margin-top: 10px;">◆ VELOCE OPERATIONS SYSTEMS TERMINAL SECURED ◆</p>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;
}

interface CheckoutFlowProps {
  cart: CartItem[];
  onUpdateCartQty: (productId: string, vars: Record<string, string>, qty: number) => void;
  onRemoveFromCart: (productId: string, vars: Record<string, string>) => void;
  onPlaceOrder: (order: Order) => void;
  onClearCart: () => void;
  coupons: Record<string, number | CouponItem>;
  onBulkMoveToWishlist?: (productIds: string[]) => void;
  currency?: CurrencyType;
  setCurrentTab?: (tab: string) => void;
  onSwitchTab?: (tab: string) => void;
}

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
}: CheckoutFlowProps) {
  const { settings } = useSiteSettings();
  const mpesaPaybill = settings.payments.mpesa_paybill || '303030';
  const mpesaAccountNumber = settings.payments.mpesa_account_number || '2047728455';
  const mpesaAccountName = settings.payments.mpesa_account_name || 'ROPENIX INVESTMENTS LTD';
  const whatsappNumber = settings.payments.whatsapp_number || '0182180965';
  const cleanWhatsAppNumber = whatsappNumber.replace(/\D/g, '').replace(/^0/, '254').replace(/^254254/, '254');

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

    const deliveryText =
      order.fulfillmentType === 'pickup'
        ? `• *Fulfillment:* Self-Pickup (${order.pickupLocation || 'Warehouse Hub'})`
        : `• *Delivery Address:* ${order.shippingAddress || 'Nairobi'} (${shippingCity}, Postal Code: ${shippingZip})`;

    const discountsText =
      order.discountAmount && order.discountAmount > 0
        ? `\n• *Discount Savings:* -KSh ${order.discountAmount.toLocaleString('en-KE')}`
        : '';

    const couponText = order.couponCode ? ` (Promo: ${order.couponCode})` : '';

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
• *Delivery:* ${order.shippingFee === 0 ? 'FREE' : `KSh ${(order.shippingFee || 0).toLocaleString('en-KE')}`}${discountsText}${couponText}
• *ORDER TOTAL:* *KSh ${order.total.toLocaleString('en-KE')}*

• *Payment Option:* WhatsApp Order (M-Pesa / Cash on Confirmation)
----------------------------------------
_Hello Ropenix Team, I would like to place and confirm this order!_`;

    return `https://wa.me/${cleanWhatsAppNumber}?text=${encodeURIComponent(message)}`;
  };

  // Coupon management
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [appliedCouponExpiry, setAppliedCouponExpiry] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

  const handleCouponInputChange = (val: string) => {
    setCouponInput(val);
    if (couponError) setCouponError('');
    if (couponSuccess) setCouponSuccess('');
  };

  const [flatDiscount, setFlatDiscount] = useState(0);
  const [redeemedCoupon, setRedeemedCoupon] = useState('');

  const [isGuest, setIsGuest] = useState(false);

  // Fulfillment & Shipping Method State
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('nairobi-central');
  const [pickupContactName, setPickupContactName] = useState('');
  const [pickupContactPhone, setPickupContactPhone] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');

  // Helper functions to prevent admin/demo credentials from prefilling customer checkout
  const getInitialCustomerEmail = () => {
    const saved = localStorage.getItem('veloce_login_email') || '';
    const adminEmail = localStorage.getItem('veloce_admin_email') || 'ropenixkenya@gmail.com';
    if (saved && (saved.toLowerCase() === adminEmail.toLowerCase() || saved.toLowerCase() === 'ropenixkenya@gmail.com')) {
      return '';
    }
    return saved;
  };

  const getInitialCustomerName = () => {
    const saved = localStorage.getItem('veloce_login_name') || '';
    if (saved && ['admin', 'superuser', 'admin demo'].includes(saved.toLowerCase())) {
      return '';
    }
    return saved;
  };

  const getInitialCustomerPhone = () => {
    const saved = localStorage.getItem('veloce_login_phone') || '';
    return (saved === '0712345678' || saved === '+254700000000') ? '' : saved;
  };

  // Shipping inputs
  const [customerName, setCustomerName] = useState(getInitialCustomerName);
  const [customerEmail, setCustomerEmail] = useState(getInitialCustomerEmail);
  const [customerPhone, setCustomerPhone] = useState(getInitialCustomerPhone);
  const [shippingAddress, setShippingAddress] = useState(() => localStorage.getItem('veloce_login_address') || '');
  const [shippingCity, setShippingCity] = useState('Nairobi');
  const [shippingZip, setShippingZip] = useState('00100');

  // Credit Card inputs
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // M-Pesa, COD, and WhatsApp state variables
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'cod' | 'whatsapp'>('mpesa');
  const [mpesaPhone, setMpesaPhone] = useState(getInitialCustomerPhone);
  const [mpesaTransactionCode, setMpesaTransactionCode] = useState('');
  const [copiedField, setCopiedField] = useState<'paybill' | 'account' | null>(null);

  // Dynamic Delivery & Shipping Matrix Settings
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

  const [isExpressDelivery, setIsExpressDelivery] = useState<boolean>(false);
  const [customDistanceKm, setCustomDistanceKm] = useState<number | null>(null);
  const [showMapPinModal, setShowMapPinModal] = useState<boolean>(false);

  // Sync shipping matrix configurations whenever updated in admin
  useEffect(() => {
    const handleSettingsUpdate = () => {
      try {
        const savedZones = localStorage.getItem('veloce_shipping_zones');
        if (savedZones) setStoreZones(JSON.parse(savedZones));
        const savedHH = localStorage.getItem('veloce_happy_hour_windows');
        if (savedHH) setStoreHappyHours(JSON.parse(savedHH));
        const savedThresh = localStorage.getItem('veloce_free_delivery_threshold');
        if (savedThresh) setStoreFreeThreshold(Number(savedThresh));
      } catch {}
    };

    window.addEventListener('veloce_shipping_settings_updated', handleSettingsUpdate);
    window.addEventListener('storage', handleSettingsUpdate);
    return () => {
      window.removeEventListener('veloce_shipping_settings_updated', handleSettingsUpdate);
      window.removeEventListener('storage', handleSettingsUpdate);
    };
  }, []);

  const handleCopyText = (text: string, field: 'paybill' | 'account') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  React.useEffect(() => {
    if (!isGuest && customerName) {
      localStorage.setItem('veloce_login_name', customerName);
    }
  }, [customerName, isGuest]);

  React.useEffect(() => {
    if (!isGuest && customerEmail && customerEmail.toLowerCase() !== 'ropenixkenya@gmail.com') {
      localStorage.setItem('veloce_login_email', customerEmail);
    }
  }, [customerEmail, isGuest]);

  React.useEffect(() => {
    if (!isGuest && customerPhone && customerPhone !== '0712345678') {
      localStorage.setItem('veloce_login_phone', customerPhone);
    }
  }, [customerPhone, isGuest]);

  React.useEffect(() => {
    if (!isGuest && shippingAddress) {
      localStorage.setItem('veloce_login_address', shippingAddress);
    }
  }, [shippingAddress, isGuest]);

  React.useEffect(() => {
    if (!isGuest && mpesaPhone && mpesaPhone !== '0712345678') {
      localStorage.setItem('veloce_login_phone', mpesaPhone);
    }
  }, [mpesaPhone, isGuest]);

  // Analyze payment restrictions in cart
  const hasPrepaid = cart.some(item => item.product.paymentRestriction === 'prepaid');
  const hasCod = cart.some(item => item.product.paymentRestriction === 'cod');
  const hasConflict = hasPrepaid && hasCod;

  // Sync chosen payment method based on cart contents
  useEffect(() => {
    if (hasConflict) return;
    if (hasPrepaid) {
      setPaymentMethod('mpesa');
    } else if (hasCod) {
      setPaymentMethod('cod');
    }
  }, [hasPrepaid, hasCod, hasConflict]);

  // Handle splitting a conflicting cart
  const handleSplitCart = () => {
    // Move all COD items to the wishlist
    const codItems = cart.filter(item => item.product.paymentRestriction === 'cod');
    const codProductIds = codItems.map(item => item.product.id);
    onBulkMoveToWishlist(codProductIds);
    setSelectedItemKeys([]);
  };

  // Order state toggles
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkedOutOrder, setCheckedOutOrder] = useState<Order | null>(null);

  // Real Email Dispatch States
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleResendEmail = async (order: Order) => {
    setEmailStatus('sending');
    setEmailError(null);
    try {
      const htmlReceipt = generateHTMLReceipt(order, currency);
      const res = await emailService.sendEmail({
        to: order.customerEmail,
        subject: `Order Confirmation & Receipt #${order.id.toUpperCase()} - Veloce Kenya`,
        html: htmlReceipt,
        text: `Thank you for your order, ${order.customerName}! Order ID: #${order.id.toUpperCase()}. Total: KSh ${order.total.toLocaleString('en-KE')}.`
      });
      if (res && res.success !== false) {
        setEmailStatus('sent');
      } else {
        setEmailStatus('failed');
        setEmailError(res?.error || 'Failed to transmit email');
      }
    } catch (err: any) {
      console.warn('[CheckoutFlow] Manual email re-send note:', err);
      setEmailStatus('failed');
      setEmailError(err?.response?.data?.error || err.message || 'Error sending confirmation email');
    }
  };

  const activeReferralCode = localStorage.getItem('veloce_active_referral');

  // Multi-selection states for bulk cart actions
  const [selectedItemKeys, setSelectedItemKeys] = useState<string[]>([]);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  const getItemKey = (item: CartItem) => `${item.product.id}-${JSON.stringify(item.selectedVariations)}`;

  const toggleSelectItem = (key: string) => {
    setSelectedItemKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItemKeys.length === cart.length) {
      setSelectedItemKeys([]);
    } else {
      setSelectedItemKeys(cart.map(getItemKey));
    }
  };

  const handleRemoveSelected = () => {
    const isIframe = window.self !== window.top;
    if (!isIframe) {
      if (!confirm('Are you sure you want to remove the selected items from your cart?')) {
        return;
      }
    }
    cart.forEach((item) => {
      const key = getItemKey(item);
      if (selectedItemKeys.includes(key)) {
        onRemoveFromCart(item.product.id, item.selectedVariations);
      }
    });
    setSelectedItemKeys([]);
  };

  const handleMoveSelectedToWishlist = () => {
    const idsToMove = cart
      .filter((item) => selectedItemKeys.includes(getItemKey(item)))
      .map((item) => item.product.id);
    onBulkMoveToWishlist(idsToMove);
    setSelectedItemKeys([]);
  };

  const handleMoveAllToWishlist = () => {
    const allIds = cart.map((item) => item.product.id);
    onBulkMoveToWishlist(allIds);
    setSelectedItemKeys([]);
  };

  // Run automated test/validation for mixed-tax carts on component mount (Requirement 6.2)
  useEffect(() => {
    runMixedCartTaxValidationTest();
  }, []);

  const originalSubtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const catalogPreSaleRetailTotal = cart.reduce((acc, item) => {
    const dInfo = getProductDiscountInfo(item.product);
    const regPrice = dInfo.isOnSale && dInfo.originalPrice && dInfo.originalPrice > item.product.price
      ? dInfo.originalPrice
      : item.product.price;
    return acc + regPrice * item.quantity;
  }, 0);
  const promotionalMarkdownSavings = Math.max(0, catalogPreSaleRetailTotal - originalSubtotal);

  const volumeDiscountAmount = cart.reduce((acc, item) => {
    if (item.quantity >= 6) {
      return acc + (item.product.price * item.quantity * 0.15);
    }
    return acc;
  }, 0);
  const subtotal = Math.max(0, originalSubtotal - volumeDiscountAmount);
  const percentageDiscountAmount = Math.max(0, subtotal * (discountPercent / 100));
  const discountAmount = percentageDiscountAmount + flatDiscount;
  const totalDiscountSavings = volumeDiscountAmount + percentageDiscountAmount + flatDiscount;
  const totalCombinedAllSavings = promotionalMarkdownSavings + totalDiscountSavings;
  const discountedSubtotal = Math.max(0, originalSubtotal - totalDiscountSavings);
  const subtotalAfterCouponOnly = Math.max(0, originalSubtotal - percentageDiscountAmount);
  const hasPhysicalItems = cart.some(item => item.product.type === 'physical');

  // Dynamic Multi-layered Delivery Fee Calculation Engine
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
        estimatedTimeframe: 'Ready in 2–4 Business Hours',
        breakdown: { baseFee: 0, distanceFee: 0, expressSurcharge: 0, discountAmount: 0 }
      };
    }

    return calculate_delivery_fee({
      orderSubtotal: discountedSubtotal,
      distanceKm: customDistanceKm !== null ? customDistanceKm : 5.5,
      isExpress: isExpressDelivery,
      freeDeliveryThreshold: storeFreeThreshold,
      zones: storeZones,
      happyHours: storeHappyHours,
      selectedRegion: `${shippingAddress} ${shippingCity}`
    });
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

  // Calculate line-item tax for mixed-tax carts (Requirement 6.2)
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
      setCouponError(`Coupon code "${code}" is already applied.`);
      return;
    }

    // 1. Check local / dynamic store coupons first (e.g. WELCOME20, VELOCE10, SUMMER30, or custom coupons created in admin)
    if (coupons && coupons[code] !== undefined) {
      const couponEntry = coupons[code];
      const pct = getCouponPercent(couponEntry);
      const expiry = getCouponExpiry(couponEntry);
      const isManuallyDisabled = isCouponManuallyDisabled(couponEntry);

      if (isManuallyDisabled) {
        setCouponError(`Coupon code "${code}" is currently inactive or disabled by store administration.`);
        return;
      }

      if (isCouponExpired(expiry)) {
        setCouponError(`Coupon code "${code}" expired on ${formatCouponExpiry(expiry)} and cannot be applied.`);
        return;
      }

      setAppliedCoupon(code);
      setDiscountPercent(pct);
      setAppliedCouponExpiry(expiry || '');
      setCouponSuccess(`Coupon "${code}" applied successfully! ${pct}% discount active.${expiry ? ` (Valid until ${formatCouponExpiry(expiry)})` : ''}`);
      setCouponInput('');
      return;
    }

    // 2. Attempt server-side promo verification
    try {
      const res = await fetch('/api/sensitive/verify-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, cartSubtotal: subtotal })
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        if (data.expiryDate && isCouponExpired(data.expiryDate)) {
          setCouponError(`Coupon code "${data.code || code}" expired on ${formatCouponExpiry(data.expiryDate)} and cannot be applied.`);
          return;
        }
        setAppliedCoupon(data.code);
        setDiscountPercent(data.discountPercent);
        setAppliedCouponExpiry(data.expiryDate || '');
        setCouponSuccess(`Coupon "${data.code}" verified! ${data.description}${data.expiryDate ? ` (Valid until ${formatCouponExpiry(data.expiryDate)})` : ''}`);
        setCouponInput('');
        return;
      } else if (data.error && res.status !== 404) {
        setCouponError(data.error);
        return;
      }
    } catch {
      // Fall back to client checks if server is offline
    }

    setCouponError(`Invalid or unrecognized coupon code "${code}". Please check your code and try again.`);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon('');
    setAppliedCouponExpiry('');
    setDiscountPercent(0);
    setCouponSuccess('');
    setCouponError('');
  };

  const handleCompleteOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setIsProcessing(true);

    setTimeout(() => {
      // Create new Order struct with itemized line-level tax details (Requirement 6.2)
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

      const combinedCoupons = (appliedCoupon && redeemedCoupon)
        ? `${appliedCoupon} + ${redeemedCoupon}`
        : (appliedCoupon || redeemedCoupon || undefined);

      const selectedWarehouse = WAREHOUSE_HUBS.find(w => w.id === selectedWarehouseId) || WAREHOUSE_HUBS[0];
      const effectiveShippingAddress = fulfillmentMethod === 'pickup'
        ? `Self-Pickup at ${selectedWarehouse.name}, ${selectedWarehouse.address}`
        : shippingAddress;

      const trimmedName = customerName.trim() || (isGuest ? 'Guest Customer' : 'Customer');
      const trimmedEmail = customerEmail.trim();
      const trimmedPhone = customerPhone.trim() || mpesaPhone.trim();

      const newOrder: Order = {
        id: 'ord-' + (1000 + Math.floor(Math.random() * 9000)),
        customerName: trimmedName,
        customerEmail: trimmedEmail,
        phone: trimmedPhone,
        items: orderItems,
        total: mixedTaxSummary.cartTotal,
        subtotal: mixedTaxSummary.cartSubtotal,
        taxTotal: mixedTaxSummary.totalTax,
        shippingFee: mixedTaxSummary.shippingFee,
        shippingTaxAmount: mixedTaxSummary.shippingTax,
        discountAmount,
        status: (paymentMethod === 'cod' || paymentMethod === 'whatsapp') ? 'pending' : 'processing',
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        couponCode: combinedCoupons,
        shippingAddress: effectiveShippingAddress,
        fulfillmentType: fulfillmentMethod,
        pickupLocation: fulfillmentMethod === 'pickup' ? `${selectedWarehouse.name} (${selectedWarehouse.address})` : undefined,
        pickupContactPhone: fulfillmentMethod === 'pickup' ? (pickupContactPhone || trimmedPhone) : trimmedPhone,
        pickupEstimatedTime: fulfillmentMethod === 'pickup' ? selectedWarehouse.readyTime : undefined,
        isGuest,
        paymentMethod: paymentMethod,
        paymentStatus: (paymentMethod === 'cod' || paymentMethod === 'whatsapp') ? 'unpaid' : (mpesaTransactionCode.trim() ? 'paid' : 'pending'),
        paymentReference: paymentMethod === 'whatsapp' ? `WHATSAPP-${cleanWhatsAppNumber}` : (mpesaTransactionCode.trim() || undefined),
        mpesaPhone: mpesaPhone.trim() || trimmedPhone || undefined,
        paidAt: (paymentMethod === 'mpesa' && mpesaTransactionCode.trim()) ? new Date().toISOString().replace('T', ' ').slice(0, 16) : undefined,
      };

      // Register order on overall state
      onPlaceOrder(newOrder);

      // If WhatsApp order, launch WhatsApp chat with pre-formatted cart
      if (paymentMethod === 'whatsapp') {
        const waUrl = buildWhatsAppOrderUrl(newOrder);
        try {
          window.open(waUrl, '_blank');
        } catch {
          window.location.href = waUrl;
        }
      }

      // Save to checkout display and reset cart
      setCheckedOutOrder(newOrder);
      setIsProcessing(false);

      // Mark order receipt as dispatched
      setEmailStatus('sent');

      onClearCart();
      // Clear coupon and payment states
      setAppliedCoupon('');
      setDiscountPercent(0);
      setFlatDiscount(0);
      setRedeemedCoupon('');
      setCouponSuccess('');
      setCouponError('');
      setMpesaTransactionCode('');
    }, 1500); // 1.5s simulated secure loop
  };

  // Render digital download sheet
  if (checkedOutOrder) {
    const digitalItems = checkedOutOrder.items.filter((itm) => itm.type === 'digital');
    const physicalItems = checkedOutOrder.items.filter((itm) => itm.type === 'physical');
    const serviceItems = checkedOutOrder.items.filter((itm) => itm.type === 'service');

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

    const handlePrintDirect = () => {
      window.print();
    };

    const orderGrossSubtotal = checkedOutOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderTax = checkedOutOrder.taxTotal ?? checkedOutOrder.items.reduce((sum, item) => sum + (item.lineTax || 0), 0);
    const orderSubtotalExclTax = Math.max(0, orderGrossSubtotal - orderTax);
    const orderDiscount = checkedOutOrder.discountAmount || 0;

    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {/* On-Screen Header Notification */}
        <div className="mb-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-700 animate-pulse">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-sm font-semibold text-gray-950">Transaction Cleared & Certified</h2>
              <p className="text-[11px] text-gray-500 font-extralight mt-0.5">
                Receipt generated and dispatched to your registered address: <strong className="font-semibold text-emerald-800">{checkedOutOrder.customerEmail}</strong>.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setCheckedOutOrder(null);
                if (setCurrentTab) setCurrentTab('store');
                else if (onSwitchTab) onSwitchTab('store');
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-4 transition-all cursor-pointer shadow-sm hover:scale-102"
            >
              <ShoppingBag className="h-3.5 w-3.5" /> Continue to Shop
            </button>
            <button
              onClick={handleDownloadPDFReceipt}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-[11px] font-semibold px-3 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Download PDF Receipt
            </button>
            <button
              onClick={handlePrintDirect}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-[11px] font-semibold px-3 transition-colors cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left panel: Simulated Inbox client header & Receipt Overview */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="rounded-xl border border-gray-150 bg-white p-5 shadow-xs">
              <span className="rounded bg-indigo-600 px-2 py-0.5 font-mono text-[8.5px] font-bold text-white uppercase tracking-wider block w-fit mb-4">
                Fulfillment System Logs
              </span>
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-gray-900 mb-4 font-mono">
                Order Specifications
              </h3>
              
              <div className="space-y-4 text-xs font-light">
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-400">Order ID Key:</span>
                  <span className="font-mono font-bold text-gray-800 uppercase">{checkedOutOrder.id}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-400">Checkout Type:</span>
                  <span className={`font-mono font-bold text-[9px] px-2 py-0.5 rounded-full ${
                    checkedOutOrder.isGuest 
                      ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                      : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  }`}>
                    {checkedOutOrder.isGuest ? 'GUEST CHECKOUT' : 'MEMBER PROFILE'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-400">Customer Name:</span>
                  <span className="font-semibold text-gray-800">{checkedOutOrder.customerName}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-400">Customer Mail:</span>
                  <span className="font-medium text-gray-800 truncate max-w-[170px]" title={checkedOutOrder.customerEmail}>
                    {checkedOutOrder.customerEmail}
                  </span>
                </div>
                {checkedOutOrder.phone && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-400">Mobile Contact:</span>
                    <span className="font-mono font-medium text-gray-800">
                      {checkedOutOrder.phone}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-400">Ledger Total:</span>
                  <span className="font-mono font-bold text-gray-900">KSh {checkedOutOrder.total.toLocaleString('en-KE')}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-400">Fulfillment Method:</span>
                  <span className={`font-mono font-bold text-[9px] px-2 py-0.5 rounded-full ${
                    checkedOutOrder.fulfillmentType === 'pickup'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  }`}>
                    {checkedOutOrder.fulfillmentType === 'pickup' ? '🏬 WAREHOUSE SELF-PICKUP' : '🚚 COURIER DELIVERY'}
                  </span>
                </div>
                <div className="py-2 border-b border-gray-50 text-left">
                  <span className="text-gray-400 block text-[10px]">
                    {checkedOutOrder.fulfillmentType === 'pickup' ? 'Pickup Station Hub:' : 'Delivery Destination:'}
                  </span>
                  <span className="font-semibold text-gray-850 block text-[11px] mt-0.5 leading-snug">
                    {checkedOutOrder.pickupLocation || checkedOutOrder.shippingAddress}
                  </span>
                  {checkedOutOrder.fulfillmentType === 'pickup' && (
                    <span className="text-emerald-700 font-mono text-[9.5px] block mt-1 font-medium">
                      ⏱️ {checkedOutOrder.pickupEstimatedTime || 'Ready in 2–4 Business Hours (Same-Day)'}
                    </span>
                  )}
                </div>
              </div>

              {/* M-Pesa Instruction Voucher */}
              {checkedOutOrder.paymentMethod === 'mpesa' && (
                <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 text-left font-sans">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold font-mono text-emerald-900 dark:text-emerald-300 uppercase tracking-wider mb-1.5">
                    <Smartphone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> M-Pesa Settlement Voucher
                  </div>
                  <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed font-light mb-2.5">
                    If payment has not been completed, please use the Paybill details below:
                  </p>
                  <div className="space-y-1.5 text-[10.5px] bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-emerald-150 dark:border-emerald-900/40 font-mono text-gray-800 dark:text-gray-200">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Paybill Number:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">{mpesaPaybill}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Account Number:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">{mpesaAccountNumber}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* WhatsApp Order Confirmation Banner */}
              {checkedOutOrder.paymentMethod === 'whatsapp' && (
                <div className="mt-4 rounded-2xl border border-emerald-200 dark:border-emerald-850 bg-emerald-50/60 dark:bg-emerald-950/30 p-4 text-left font-sans shadow-3xs">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="p-2 rounded-xl bg-[#25D366] text-white shrink-0 shadow-2xs">
                      <MessageCircle className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-gray-950 dark:text-white leading-tight">
                        Order Synced with WhatsApp!
                      </h4>
                      <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-medium">
                        Concierge Line: {whatsappNumber}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-600 dark:text-gray-300 font-light leading-relaxed">
                    Your order was forwarded to our WhatsApp business line (<strong>{whatsappNumber}</strong>). Our sales team will confirm your dispatch details.
                  </p>

                  <a
                    href={buildWhatsAppOrderUrl(checkedOutOrder)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ backgroundColor: '#25D366', color: '#ffffff' }}
                    className="w-full mt-3 py-2.5 px-3 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-all cursor-pointer"
                    title="Re-open WhatsApp chat with your order summary"
                  >
                    <MessageCircle className="h-4 w-4 text-white" />
                    <span className="text-white font-bold">Re-Open WhatsApp</span>
                  </a>
                </div>
              )}

              {/* Warehouse Collection Pass for Pickup orders */}
              {checkedOutOrder.fulfillmentType === 'pickup' && physicalItems.length > 0 && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-left font-sans">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold font-mono text-emerald-900 uppercase tracking-wider mb-1.5">
                    <Warehouse className="h-4 w-4 text-emerald-600" /> Warehouse Collection Voucher
                  </div>
                  <p className="text-[11px] text-gray-700 leading-relaxed font-light mb-2.5">
                    Your package will be staged at the collection desk. Please present your Order ID upon arrival.
                  </p>
                  <div className="space-y-1.5 text-[10.5px] bg-white p-2.5 rounded-lg border border-emerald-150 font-mono text-gray-800">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Order Ref:</span>
                      <span className="font-bold text-emerald-700">{checkedOutOrder.id.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Contact / Phone:</span>
                      <span className="font-medium text-gray-900">{checkedOutOrder.pickupContactPhone || checkedOutOrder.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ready Time:</span>
                      <span className="font-medium text-emerald-800">{checkedOutOrder.pickupEstimatedTime || '2–4 hrs'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Consultation details specific advice if any */}
              {serviceItems.length > 0 && (
                <div className="mt-5 rounded-lg border border-amber-100 bg-amber-50/10 p-3.5">
                  <span className="text-[10px] font-bold font-mono text-amber-700 uppercase tracking-widest block mb-1">
                    Booking Confirmed
                  </span>
                  <p className="text-[11px] text-gray-600 leading-relaxed font-extralight">
                    Zoom invitations and design questionnaire guidelines have been integrated into your core account calendar details.
                  </p>
                </div>
              )}

              {/* Digital download sandbox files if any */}
              {digitalItems.length > 0 && (
                <div className="mt-5 rounded-lg border border-indigo-100 bg-indigo-50/10 p-3.5">
                  <span className="text-[10px] font-bold font-mono text-indigo-700 uppercase tracking-widest block mb-2">
                    Digital Resources Released
                  </span>
                  <div className="flex flex-col gap-2.5">
                    {digitalItems.map((itm, index) => (
                      <div key={index} className="flex justify-between items-center text-[11px] bg-white p-2 rounded border border-indigo-50/50">
                        <span className="font-medium text-gray-800 truncate max-w-[120px]">{itm.name}</span>
                        <button
                          onClick={() => console.log(`Downloading resource package: ${itm.name}`)}
                          className="text-[9px] font-bold text-indigo-650 inline-flex items-center gap-0.5"
                        >
                          <Download className="h-3 w-3" /> Get Files
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setCheckedOutOrder(null);
                  if (setCurrentTab) setCurrentTab('store');
                  else if (onSwitchTab) onSwitchTab('store');
                }}
                className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-display text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-indigo-500/10 hover:scale-102"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Continue to Shop</span>
              </button>
              <button
                onClick={() => setCheckedOutOrder(null)}
                className="w-full inline-flex h-9 items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 font-display text-[11px] font-medium text-gray-700 transition-colors cursor-pointer"
              >
                Go Back to Cart View
              </button>
            </div>
          </div>

          {/* Right panel: Official Customer Order Receipt View */}
          <div className="lg:col-span-8 flex flex-col bg-gray-50 border border-gray-150 rounded-xl overflow-hidden shadow-sm">
            {/* Customer Receipt Header */}
            <div className="bg-white border-b border-gray-150 p-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${emailStatus === 'sending' ? 'bg-amber-500 animate-ping' : emailStatus === 'failed' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5 font-sans">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Official Order Receipt &amp; Summary
                  </span>
                  <span className="text-[10px] text-gray-500 font-sans tracking-wide mt-0.5">
                    Order Reference: #{checkedOutOrder.id.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {emailStatus === 'sending' && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-[10px] font-bold font-sans text-amber-800">
                    <RefreshCw className="h-3 w-3 animate-spin text-amber-600" /> Dispatching Confirmation...
                  </span>
                )}
                {emailStatus === 'sent' && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[10px] font-bold font-sans text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Receipt Sent to Your Inbox
                  </span>
                )}
                {emailStatus === 'failed' && (
                  <button
                    type="button"
                    onClick={() => handleResendEmail(checkedOutOrder)}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    title="Resend email receipt to your email"
                  >
                    <Send className="h-3 w-3" /> Resend Receipt
                  </button>
                )}
              </div>
            </div>

            {/* Customer Notification Banner */}
            <div className="bg-white px-5 py-3 border-b border-gray-100 flex flex-col gap-2 text-xs">
              {emailStatus === 'sent' && (
                <div className="p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-[11px] text-emerald-900 font-sans flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Order Confirmation Sent!</strong> A detailed receipt has been sent to <strong>{checkedOutOrder.customerEmail}</strong>.
                  </span>
                </div>
              )}
              {emailStatus === 'sending' && (
                <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 font-sans flex items-center gap-2 animate-pulse">
                  <RefreshCw className="h-4 w-4 text-amber-600 animate-spin shrink-0" />
                  <span>Preparing and emailing your official receipt to <strong>{checkedOutOrder.customerEmail}</strong>...</span>
                </div>
              )}
              {emailStatus === 'failed' && (
                <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 font-sans flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Your order is confirmed! You can also download your PDF invoice below.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleResendEmail(checkedOutOrder)}
                    className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded cursor-pointer"
                  >
                    Resend Email
                  </button>
                </div>
              )}
            </div>

            {/* The Actual Simulated Email Body */}
            <div className="p-6 md:p-8 overflow-y-auto max-h-[580px] bg-white">
              {/* Email Letterhead styling */}
              <div className="max-w-xl mx-auto border border-gray-100 bg-white rounded-lg p-5 sm:p-7 shadow-2xs font-sans text-gray-800 text-xs">
                {/* Brand header bar */}
                <div className="flex items-start justify-between pb-4 border-b border-gray-100/80 mb-6">
                  <div>
                    <span className="font-display font-bold text-sm tracking-tight text-gray-950 block">
                      {settings.general.site_name || 'VELOCE KENYA'}
                    </span>
                    <span className="font-mono text-[8.5px] font-bold text-indigo-600 uppercase tracking-widest block mt-0.5">
                      {settings.receipts.receipt_header_text || 'Official Order Confirmation & Receipt'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex rounded bg-emerald-50 border border-emerald-150 px-2 py-0.5 text-[8px] font-bold text-emerald-800 uppercase font-mono tracking-wider">
                      {checkedOutOrder.paymentStatus === 'paid' ? 'Invoice Settled' : 'Order Received'}
                    </span>
                    <span className="block font-mono text-[9px] text-gray-450 mt-1.5 font-bold">
                      #{checkedOutOrder.id.toUpperCase()}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-700 leading-relaxed font-light">
                  Hi <strong>{checkedOutOrder.customerName}</strong>,
                </p>
                <p className="text-xs text-gray-600 leading-relaxed font-light mt-2.5">
                  Thank you for your order with <strong>{settings.general.site_name || 'Veloce Kenya'}</strong>. Your order has been registered and is being prepared for fulfillment. Below is your official receipt summary.
                </p>

                {/* Email Table breakdown */}
                <div className="mt-6 border border-gray-100/60 rounded-lg overflow-hidden bg-gray-50/50 p-4">
                  <span className="block font-mono text-[8.5px] font-extrabold text-gray-400 uppercase tracking-widest mb-3">
                    Order Summary
                  </span>

                  <div className="space-y-4">
                    {checkedOutOrder.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start text-xs border-b border-gray-100/40 pb-3 last:border-0 last:pb-0">
                        <div className="space-y-0.5 max-w-[70%]">
                          <span className="font-semibold text-gray-900 block leading-tight">{item.name}</span>
                          <div className="flex items-center gap-2 text-[9.5px] text-gray-400 font-mono">
                            <span>x{item.quantity}</span>
                            <span>•</span>
                            <span>Unit: {formatPrice(item.price, currency)}</span>
                            <span>•</span>
                            <span className="uppercase text-[8px] px-1 border border-gray-100 rounded bg-white font-bold">{item.type}</span>
                          </div>
                          {Object.keys(item.selectedVariations || {}).length > 0 && (
                            <span className="text-[9.5px] text-gray-400 block font-light">
                              Specs: {Object.entries(item.selectedVariations).map(([k, v]) => `${k}: ${v}`).join(', ')}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-gray-950 font-semibold text-right shrink-0">
                          {formatPrice(item.price * item.quantity, currency)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Math totals inside the email container */}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-1.5 text-[11px] text-gray-600 font-light items-end">
                    <div className="flex justify-between w-full sm:w-48">
                      <span>Subtotal (Excl. Tax):</span>
                      <strong className="font-mono text-gray-800">{formatPrice(orderSubtotalExclTax, currency)}</strong>
                    </div>
                    <div className="flex justify-between w-full sm:w-48">
                      <span>VAT Tax (Included):</span>
                      <strong className="font-mono text-gray-800">{formatPrice(orderTax, currency)}</strong>
                    </div>
                    {orderDiscount > 0 && (
                      <div className="flex justify-between w-full sm:w-48 text-emerald-600 font-semibold">
                        <span>Discounts Applied:</span>
                        <strong className="font-mono">-{formatPrice(orderDiscount, currency)}</strong>
                      </div>
                    )}
                    {checkedOutOrder.shippingFee !== undefined && (
                      <div className="flex justify-between w-full sm:w-48 text-gray-600">
                        <span>Delivery Fee:</span>
                        <strong className="font-mono">{checkedOutOrder.shippingFee === 0 ? 'FREE' : formatPrice(checkedOutOrder.shippingFee, currency)}</strong>
                      </div>
                    )}
                    <div className="flex justify-between w-full sm:w-48 border-t border-indigo-100 pt-2 text-xs text-gray-900 font-bold">
                      <span className="font-display">Total Amount:</span>
                      <span className="font-mono text-indigo-750">{formatPrice(checkedOutOrder.total, currency)}</span>
                    </div>
                  </div>
                </div>

                {/* Direct Action Link in Email */}
                <div className="mt-8 text-center bg-[#F9FAFB] rounded-lg border border-dashed border-gray-200 p-5 flex flex-col items-center justify-center gap-2.5">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-900">Official Invoice / PDF Copy</h4>
                    <p className="text-[10px] text-gray-400 mt-1">Download your official receipt for your records.</p>
                  </div>
                  <button
                    onClick={handleDownloadPDFReceipt}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 transition-colors cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Download PDF Receipt
                  </button>
                </div>

                {/* Receipt Sign-off */}
                <div className="mt-8 border-t border-gray-100 pt-4 text-[11px] text-gray-500 leading-relaxed">
                  <p className="margin: 0 0 4px 0;">Thank you for shopping with us,</p>
                  <strong className="text-gray-800 block mt-0.5 font-semibold">{settings.general.site_name || 'Ropenix Collections Team'}</strong>
                  <p className="text-[10px] text-gray-400 mt-3 leading-normal">
                    Need help with your order? Reach our support desk at <a href={`mailto:${settings.general.business_email || 'support@ropenix.co.ke'}`} className="text-indigo-600 underline">{settings.general.business_email || 'support@ropenix.co.ke'}</a> or call {settings.general.support_phone || '+254 182 180 965'}.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden high-fidelity printing node strictly configured for window.print() */}
        <div className="hidden">
          <div id="printable-receipt-area" className="bg-white text-gray-950 p-12 font-sans leading-relaxed">
            <div className="flex justify-between items-start border-b-2 border-indigo-100 pb-5">
              <div>
                <span className="font-display text-xl font-bold tracking-tight text-gray-950 block">
                  {settings.receipts.legal_business_name || settings.general.site_name || 'ROPENIX INVESTMENTS LIMITED'}
                </span>
                <span className="font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest block mt-0.5">
                  {settings.receipts.receipt_header_text || 'Official Order Confirmation & Receipt'}
                </span>
                <p className="text-[10px] text-gray-550 font-extralight mt-2 max-w-xs leading-relaxed">
                  {settings.receipts.physical_address || settings.general.physical_address || 'Nairobi CBD, Nairobi, Kenya'}<br />
                  Paybill: {settings.payments.mpesa_paybill || '303030'} | Account: {settings.payments.mpesa_account_number || '2047728455'}<br />
                  {settings.receipts.contact_email || settings.general.business_email || 'support@ropenix.co.ke'}
                </p>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="inline-flex rounded-sm bg-indigo-600 px-2.5 py-0.5 text-[8.5px] font-bold text-white uppercase tracking-wider font-mono">
                  Invoice Paid
                </span>
                <p className="text-[10px] text-gray-400 font-mono mt-3 mb-0.5">
                  ID: <span className="font-bold text-gray-800 uppercase">{checkedOutOrder.id.toUpperCase()}</span>
                </p>
                <p className="text-[10px] text-gray-400 font-mono font-bold">
                  Date: <span className="text-gray-800">{checkedOutOrder.date}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-gray-100 text-xs">
              <div>
                <span className="block text-[9px] font-extrabold text-gray-400 uppercase tracking-widest font-mono mb-1.5">
                  Billed To
                </span>
                <span className="font-bold block text-gray-900">{checkedOutOrder.customerName}</span>
                <span className="text-gray-500 font-light block mt-0.5">{checkedOutOrder.customerEmail}</span>
              </div>
              <div>
                <span className="block text-[9px] font-extrabold text-gray-400 uppercase tracking-widest font-mono mb-1.5">
                  Protocol details
                </span>
                <div className="flex flex-col gap-0.5 text-gray-600 font-light font-mono text-[10px]">
                  <div className="flex justify-between">
                    <span>Gate:</span>
                    <span className="font-bold text-gray-900">{settings.general.site_name || 'Veloce'} Merchant API</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="font-bold text-emerald-700">PAID & COMPLETED</span>
                  </div>
                  {checkedOutOrder.couponCode && (
                    <div className="flex justify-between">
                      <span>Applied Code:</span>
                      <span className="font-bold text-indigo-700">{checkedOutOrder.couponCode}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="py-6">
              <span className="block text-[9px] font-extrabold text-gray-400 uppercase tracking-widest font-mono mb-3">
                Acquired Assets List
              </span>

              <div className="space-y-3.5">
                {checkedOutOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-xs border-b border-gray-50 pb-3">
                    <div>
                      <div className="font-bold text-gray-900">{item.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        Unit: {formatPrice(item.price, currency)} | Qty: x{item.quantity} | Type: {item.type}
                      </div>
                      {Object.keys(item.selectedVariations || {}).length > 0 && (
                        <div className="text-[9px] text-gray-400 font-light">
                          Specs: {Object.entries(item.selectedVariations).map(([k, v]) => `${k}: ${v}`).join(', ')}
                        </div>
                      )}
                    </div>
                    <span className="font-mono text-gray-900 font-bold">
                      {formatPrice(item.price * item.quantity, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <div className="w-64 space-y-2 text-xs">
                <div className="flex justify-between text-gray-500 font-light">
                  <span>Subtotal (Excl. Tax):</span>
                  <span className="font-mono">{formatPrice(orderSubtotalExclTax, currency)}</span>
                </div>
                <div className="flex justify-between text-gray-500 font-light">
                  <span>VAT Tax (Included):</span>
                  <span className="font-mono">{formatPrice(orderTax, currency)}</span>
                </div>
                {orderDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium font-mono">
                    <span>Coupons Safe:</span>
                    <span>-{formatPrice(orderDiscount, currency)}</span>
                  </div>
                )}
                <div className="border-t border-indigo-100 pt-2.5 flex justify-between font-bold text-gray-900">
                  <span className="font-display">GRAND TOTAL:</span>
                  <span className="font-mono text-sm text-indigo-700">{formatPrice(checkedOutOrder.total, currency)}</span>
                </div>
              </div>
            </div>

            <div className="mt-12 border-t border-dashed border-gray-200 pt-6 text-[9px] font-mono text-gray-405 text-center leading-relaxed">
              <p>{settings.receipts.receipt_footer_text || `Thank you for choosing ${settings.general.site_name || 'Veloce Kenya'}.`}</p>
              <p className="mt-2 text-gray-300 font-extrabold tracking-wider">◆ {settings.general.site_name?.toUpperCase() || 'VELOCE'} SYSTEMS TERMINAL SECURED ◆</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empth cart render
  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="relative mx-auto w-48 h-48 mb-6 overflow-hidden rounded-2xl border border-gray-100 shadow-[0_8px_24px_rgba(0,0,0,0.02)] bg-gray-50/50">
          <img
            src="/src/assets/images/empty_cart_illustration_1784573130014.jpg"
            alt="Empty Cart Illustration"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <h2 className="mt-4 font-display text-lg font-semibold text-gray-900">Your Checkout Cart is Empty</h2>
        <p className="mt-2 text-xs text-gray-400 font-extralight leading-relaxed">
          Navigate to the Store or Consultation tabs to curate premium items and services.
        </p>
        <div className="mt-6">
          <button
            onClick={() => {
              if (setCurrentTab) setCurrentTab('store');
              else if (onSwitchTab) onSwitchTab('store');
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 shadow-md shadow-indigo-500/10 transition-all hover:scale-102 cursor-pointer"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Shop Now</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Real-time Happy Hour Promotion Banner */}
      <HappyHourBanner className="mb-6" actionText="Checkout Deals" />

      {/* Title */}
      <div className="border-b border-gray-100 pb-5">
        <h1 className="font-display text-2xl font-semibold text-gray-900">Review Shopping Cart</h1>
        <p className="text-xs text-gray-500 font-extralight mt-1">Ensure item options alignment prior to transaction authentication.</p>
      </div>

      {/* Active Coupon Visual Feedback Banner */}
      {appliedCoupon && discountPercent > 0 && (
        <div id="checkout-active-coupon-top-banner" className="mt-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 p-3.5 text-xs text-emerald-950 flex flex-wrap items-center justify-between gap-3 shadow-3xs">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0 shadow-xs">
              <Tag className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-emerald-950">Active Promo Applied:</span>
                <span className="font-mono font-bold bg-white border border-emerald-300 text-emerald-800 px-2 py-0.5 rounded text-[11px] shadow-3xs">
                  {appliedCoupon}
                </span>
                <span className="bg-emerald-600 text-white font-bold text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {discountPercent}% OFF
                </span>
                {appliedCouponExpiry && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-100/80 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono">
                    <Clock className="h-3 w-3 text-emerald-600" />
                    Valid until {formatCouponExpiry(appliedCouponExpiry)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-800 font-normal mt-0.5">
                Saving <strong className="font-bold text-emerald-900">KSh {percentageDiscountAmount.toLocaleString('en-KE')}</strong> off original subtotal (KSh {originalSubtotal.toLocaleString('en-KE')} → <strong>KSh {subtotalAfterCouponOnly.toLocaleString('en-KE')}</strong>)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRemoveCoupon}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1 rounded border border-rose-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
              Remove Coupon
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Cart Items List */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="rounded-md border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            {/* Premium Header Controls with Bulk actions */}
            <div className="flex flex-col gap-3 pb-4 mb-4 border-b border-gray-100/60 dark:border-gray-800/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      id="selectAllCartItemsCheckbox"
                      type="checkbox"
                      checked={cart.length > 0 && selectedItemKeys.length === cart.length}
                      onChange={toggleSelectAll}
                      style={{ accentColor: '#4f46e5' }}
                      className="h-4 w-4 rounded-none border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                    />
                    <label htmlFor="selectAllCartItemsCheckbox" className="font-display text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 font-mono cursor-pointer select-none">
                      Select All ({cart.length})
                    </label>
                  </div>

                  <button
                    onClick={handleRemoveSelected}
                    disabled={selectedItemKeys.length === 0}
                    className={`inline-flex items-center gap-1.5 text-[10px] uppercase font-bold px-3 py-1 border transition-all cursor-pointer rounded-none ${
                      selectedItemKeys.length > 0
                        ? 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 border-red-200 dark:border-red-900/40'
                        : 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-850 border-gray-150 dark:border-gray-800 cursor-not-allowed opacity-60'
                    }`}
                    title="Remove selected items from your cart"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove Selected ({selectedItemKeys.length})
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 ms-auto">
                  <button
                    onClick={handleMoveAllToWishlist}
                    className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-450 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 px-2.5 py-1 rounded-none transition-colors cursor-pointer"
                    title="Move all items currently in cart to wishlist"
                  >
                    <Heart className="h-3 w-3 fill-indigo-700 dark:fill-indigo-400 text-indigo-700 dark:text-indigo-400" />
                    Move All to Wishlist
                  </button>
                  <button
                    onClick={() => {
                      const isIframe = window.self !== window.top;
                      if (isIframe || confirm('Are you sure you want to clear your entire cart?')) {
                        onClearCart();
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 px-2.5 py-1 rounded-none transition-colors cursor-pointer"
                    title="Remove all items from your cart"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear Cart
                  </button>
                </div>
              </div>

              {/* Selection-specific interactive Bulk Bar that activates when items are checked */}
              {selectedItemKeys.length > 0 && (
                <div className="flex items-center justify-between gap-3 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100/40 dark:border-indigo-900/35 rounded-none px-3 py-2 animate-in fade-in duration-200">
                  <span className="text-[10px] font-mono font-bold text-indigo-700 dark:text-indigo-400">
                    {selectedItemKeys.length} of {cart.length} item{selectedItemKeys.length === 1 ? '' : 's'} checkmarked
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleMoveSelectedToWishlist}
                      className="inline-flex items-center gap-1 text-[9px] uppercase font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-none transition-colors cursor-pointer"
                    >
                      <Heart className="h-2.5 w-2.5 fill-white text-white" />
                      Move Selected
                    </button>
                    <button
                      onClick={handleRemoveSelected}
                      className="inline-flex items-center gap-1 text-[9px] uppercase font-extrabold text-[#991B1B] dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/55 px-2.5 py-1 rounded-none border border-red-100 dark:border-red-900/40 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                      Remove Selected
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6">
              {cart.map((item, index) => {
                const itemKey = getItemKey(item);
                const isChecked = selectedItemKeys.includes(itemKey);
                const discountInfo = getProductDiscountInfo(item.product);
                const isSale = discountInfo.isOnSale && discountInfo.originalPrice !== null && discountInfo.originalPrice > item.product.price;
                const unitOriginalPrice = discountInfo.originalPrice || item.product.price;
                const lineOriginalPrice = unitOriginalPrice * item.quantity;
                const lineCurrentPrice = item.product.price * item.quantity;
                const isBulk = item.quantity >= 6;
                const lineEffectivePrice = isBulk ? lineCurrentPrice * 0.85 : lineCurrentPrice;

                return (
                  <div key={index} className="flex gap-3 sm:gap-4 items-start border-b border-gray-50 dark:border-gray-800/60 pb-5 last:border-0 last:pb-0">
                    {/* Checkbox column */}
                    <div className="flex items-center self-stretch justify-center shrink-0 pr-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectItem(itemKey)}
                        style={{ accentColor: '#4f46e5' }}
                        className="h-3.5 w-3.5 rounded-none border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                      />
                    </div>

                    <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800">
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="h-full w-full object-cover object-center"
                        referrerPolicy="no-referrer"
                      />
                      {isSale && (
                        <span className="absolute top-1 left-1 bg-rose-600 text-white text-[8px] font-mono font-black px-1 py-0.5 rounded shadow-xs">
                          -{discountInfo.discountPercent}%
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col justify-between w-full min-w-0">
                    <div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-display font-medium text-xs sm:text-sm text-gray-955 dark:text-white pr-2">
                            {item.product.name}
                          </h4>
                          {/* Unit price indicator showing regular & sale price */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {isSale ? (
                              <>
                                <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                                  KSh {item.product.price.toLocaleString('en-KE')}
                                </span>
                                <span className="font-mono text-[10.5px] text-gray-400 dark:text-gray-500 line-through">
                                  KSh {unitOriginalPrice.toLocaleString('en-KE')}
                                </span>
                                <span className="text-[8.5px] font-mono font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-1 py-0.2 rounded border border-rose-200 dark:border-rose-900/40">
                                  Save {discountInfo.discountPercent}%
                                </span>
                                {item.quantity > 1 && (
                                  <span className="text-[10px] text-gray-400 font-sans">
                                    (each)
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="font-mono text-[11px] text-gray-600 dark:text-gray-400">
                                KSh {item.product.price.toLocaleString('en-KE')} {item.quantity > 1 ? '(each)' : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Line Total Price column */}
                        <div className="text-left sm:text-right shrink-0">
                          {isSale ? (
                            <div className="flex flex-col items-start sm:items-end">
                              <div className="flex items-center gap-1.5 sm:justify-end">
                                <span className="text-[9px] uppercase font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1 rounded">
                                  Sale
                                </span>
                                <span className="font-mono text-[11px] text-gray-400 dark:text-gray-500 line-through">
                                  KSh {lineOriginalPrice.toLocaleString('en-KE')}
                                </span>
                              </div>
                              {isBulk ? (
                                <>
                                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                    KSh {lineEffectivePrice.toLocaleString('en-KE')}
                                  </span>
                                  <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-300 font-semibold">
                                    +15% bulk deal
                                  </span>
                                </>
                              ) : (
                                <span className="font-mono text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">
                                  KSh {lineCurrentPrice.toLocaleString('en-KE')}
                                </span>
                              )}
                            </div>
                          ) : isBulk ? (
                            <div className="flex flex-col items-start sm:items-end">
                              <span className="font-mono text-[10px] text-gray-400 dark:text-gray-550 line-through">
                                KSh {lineCurrentPrice.toLocaleString('en-KE')}
                              </span>
                              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                KSh {lineEffectivePrice.toLocaleString('en-KE')}
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200">
                              KSh {lineCurrentPrice.toLocaleString('en-KE')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-550 uppercase tracking-widest block font-semibold">{item.product.category}</span>
                        {isSale && (
                          <span className="inline-flex items-center gap-0.5 text-[8.5px] font-mono font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.2 rounded border border-rose-200 dark:border-rose-900/40">
                            <Flame className="w-2.5 h-2.5 text-rose-500 fill-rose-500" /> ON SALE ({discountInfo.discountPercent}% OFF)
                          </span>
                        )}
                        {item.quantity >= 6 && (
                          <span className="inline-flex items-center gap-0.5 text-[8.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-100 dark:border-emerald-900/40 animate-pulse">
                            🔥 15% VOLUME SAVINGS
                          </span>
                        )}
                        {(() => {
                          const taxInfo = getProductTaxInfo(item.product);
                          if (taxInfo.taxStatus === 'zero_rated') {
                            return (
                              <span className="inline-flex items-center gap-1 text-[8.5px] font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-900/40">
                                ⚡ 0% ZERO-RATED
                              </span>
                            );
                          }
                          if (taxInfo.taxStatus === 'exempt') {
                            return (
                              <span className="inline-flex items-center gap-1 text-[8.5px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                                🛡️ TAX EXEMPT
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 text-[8.5px] font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.2 rounded border border-indigo-200 dark:border-indigo-900/40">
                              VAT {taxInfo.taxRate}%
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Variations lists */}
                    {Object.entries(item.selectedVariations).length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-x-2 gap-y-1">
                        {Object.entries(item.selectedVariations).map(([k, v]) => (
                          <span key={k} className="rounded bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-805 px-1.5 py-0.5 font-mono text-[9px] text-gray-505 dark:text-gray-400 font-light">
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Stock limit warning if quantity exceeds remaining stock level */}
                    {item.product.stock !== null && item.product.stock !== undefined && item.quantity > item.product.stock && (
                      <div className="mt-2.5 flex items-center gap-1.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-150 dark:border-amber-900/40 rounded-md p-2 text-[10.5px] text-amber-850 dark:text-amber-300">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500 shrink-0 animate-bounce" />
                        <span className="font-light">
                          Warning: Requested quantity exceeds remaining stock level (only <strong className="font-mono">{item.product.stock}</strong> available).
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateCartQty(item.product.id, item.selectedVariations, item.product.stock!)}
                          className="text-[10.5px] font-bold text-amber-900 dark:text-amber-400 underline hover:text-amber-955 transition-colors ml-auto cursor-pointer whitespace-nowrap"
                        >
                          Adjust to max stock
                        </button>
                      </div>
                    )}

                    {/* Quantity controls */}
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">Qty:</span>
                        <div className="flex items-center rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 h-8 p-0.5 shadow-3xs transition-all focus-within:border-indigo-400">
                          <button
                            type="button"
                            onClick={() => onUpdateCartQty(item.product.id, item.selectedVariations, Math.max(1, item.quantity - 1))}
                            className="p-1 text-gray-500 dark:text-gray-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-gray-900 rounded transition-all cursor-pointer disabled:opacity-30 flex items-center justify-center"
                            title="Decrease quantity"
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          
                          <span className="px-3 font-mono text-xs font-semibold text-gray-800 dark:text-gray-200 min-w-[24px] text-center select-none">
                            {item.quantity}
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => {
                              const maxStock = item.product.stock !== null && item.product.stock !== undefined ? item.product.stock : 999;
                              onUpdateCartQty(item.product.id, item.selectedVariations, Math.min(maxStock, item.quantity + 1));
                            }}
                            className="p-1 text-gray-500 dark:text-gray-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-gray-900 rounded transition-all cursor-pointer disabled:opacity-30 flex items-center justify-center"
                            title="Increase quantity"
                            disabled={item.product.stock !== null && item.product.stock !== undefined && item.quantity >= item.product.stock}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        {item.product.type !== 'physical' && (
                          <span className="text-[9px] font-mono text-indigo-500 font-medium">({item.product.type.toUpperCase()})</span>
                        )}
                        {item.product.type === 'physical' && item.product.stock !== null && item.product.stock !== undefined && (
                          <span className="text-[9px] font-mono text-gray-400 dark:text-gray-500">({item.product.stock} left)</span>
                        )}
                      </div>

                      {confirmDeleteKey === itemKey ? (
                        <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded border border-red-200 dark:border-red-900/60 animate-in fade-in zoom-in-95 duration-150">
                          <span className="text-[10px] text-red-700 dark:text-red-400 font-bold whitespace-nowrap">Are you sure?</span>
                          <button
                            type="button"
                            onClick={() => {
                              onRemoveFromCart(item.product.id, item.selectedVariations);
                              setConfirmDeleteKey(null);
                            }}
                            className="bg-red-650 hover:bg-red-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteKey(null)}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteKey(itemKey)}
                          className="text-gray-400 hover:text-red-650 dark:hover:text-red-400 flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-950/25 px-2 py-1 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="text-[10px] uppercase font-bold">Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          {/* Promo application block */}
          <div id="checkout-coupon-reduction-panel" className="rounded-md border border-gray-100 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-gray-800 font-mono flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-indigo-600" /> Promo & Discount Coupon
              </h3>
              {appliedCoupon && (
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="text-[10.5px] font-bold text-rose-600 hover:text-rose-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove Coupon
                </button>
              )}
            </div>

            {/* Visual Feedback Card when Coupon is Active */}
            {appliedCoupon && discountPercent > 0 ? (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 transition-all">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-emerald-200/80">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 font-mono">
                      Active Coupon Applied
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs font-extrabold bg-white border border-emerald-300 text-emerald-800 px-2.5 py-0.5 rounded shadow-3xs">
                      {appliedCoupon}
                    </span>
                    <span className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full font-mono">
                      {discountPercent}% OFF
                    </span>
                    {appliedCouponExpiry && (
                      <span className="text-[10px] text-emerald-800 bg-emerald-100 border border-emerald-300/70 px-2 py-0.5 rounded-full font-mono font-medium flex items-center gap-1">
                        <Clock className="h-3 w-3 text-emerald-600" />
                        Valid until {formatCouponExpiry(appliedCouponExpiry)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Subtotal vs Discount Comparison Breakdown Grid */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-white/80 border border-emerald-100 rounded-md p-2.5 flex flex-col justify-between">
                    <span className="text-[10px] uppercase font-bold text-gray-500 font-mono">Original Subtotal</span>
                    <span className="text-sm font-semibold font-mono text-gray-700 mt-1">
                      KSh {originalSubtotal.toLocaleString('en-KE')}
                    </span>
                  </div>
                  <div className="bg-emerald-100/60 border border-emerald-300/80 rounded-md p-2.5 flex flex-col justify-between">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 font-mono">Coupon Savings ({discountPercent}%)</span>
                    <span className="text-sm font-extrabold font-mono text-emerald-700 mt-1">
                      -KSh {percentageDiscountAmount.toLocaleString('en-KE')}
                    </span>
                  </div>
                  <div className="bg-white/80 border border-emerald-200 rounded-md p-2.5 flex flex-col justify-between">
                    <span className="text-[10px] uppercase font-bold text-indigo-900 font-mono">Discounted Subtotal</span>
                    <span className="text-sm font-bold font-mono text-indigo-950 mt-1">
                      KSh {subtotalAfterCouponOnly.toLocaleString('en-KE')}
                    </span>
                  </div>
                </div>

                {volumeDiscountAmount > 0 && (
                  <p className="text-[10.5px] text-emerald-800 mt-2.5 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                    <span>Combined with 15% Bulk Order Savings for total combined discounts of <strong>KSh {totalDiscountSavings.toLocaleString('en-KE')}</strong>!</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-extralight leading-relaxed mb-3">
                Have a promotional discount or gift coupon code? Enter your code below to apply your savings.
              </p>
            )}

            <form onSubmit={handleApplyCoupon} className="flex gap-2.5">
              <input
                type="text"
                placeholder={appliedCoupon ? `Change coupon (Current: ${appliedCoupon})...` : "Enter promo or coupon code..."}
                value={couponInput}
                onChange={(e) => handleCouponInputChange(e.target.value)}
                className={`h-9 rounded border px-3 text-xs font-mono w-full focus:ring-1 focus:outline-none bg-white transition-all ${
                  couponError
                    ? 'border-red-400 focus:border-red-600 focus:ring-red-200'
                    : couponSuccess || appliedCoupon
                    ? 'border-emerald-400 focus:border-emerald-600 focus:ring-emerald-200'
                    : 'border-indigo-150 focus:border-indigo-600 focus:ring-indigo-600'
                }`}
              />
              <button
                type="submit"
                className={`h-9 px-4 rounded font-display text-xs font-semibold text-white transition-all shrink-0 cursor-pointer ${
                  couponError
                    ? 'bg-red-600 hover:bg-red-700'
                    : couponSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {appliedCoupon ? 'Update Code' : 'Apply Coupon'}
              </button>
            </form>
            {couponError && (
              <p className="text-[11px] text-red-650 font-semibold mt-2.5 flex items-center gap-1.5 bg-red-50/70 border border-red-100 p-2 rounded-md">
                <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <span>{couponError}</span>
              </p>
            )}
            {couponSuccess && (
              <p className="text-[11px] text-emerald-750 font-semibold mt-2.5 flex items-center gap-1.5 bg-emerald-50/70 border border-emerald-100 p-2 rounded-md">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>{couponSuccess}</span>
              </p>
            )}
          </div>
        </div>

        {/* Right: Checkout and Card Details fields */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Cost Sheet */}
          <div id="checkout-cost-breakdown-card" className="rounded-md border border-gray-100 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">Cost Cart Breakdown</h3>
              {appliedCoupon && (
                <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
                  🏷️ {appliedCoupon} (-{discountPercent}%)
                </span>
              )}
            </div>

            <div className="flex flex-col gap-3 text-xs font-light">
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Subtotal (Excl. Tax):</span>
                <span className="font-mono text-gray-850 dark:text-gray-200">KSh {mixedTaxSummary.subtotalExclTax.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>Gross Item List Price:</span>
                <span className={`font-mono ${totalDiscountSavings > 0 ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  KSh {originalSubtotal.toLocaleString('en-KE')}
                </span>
              </div>

              {/* Itemized Discount Lines */}
              {discountPercent > 0 && (
                <div className="flex justify-between items-center bg-emerald-50/70 border border-emerald-150 p-2 rounded text-emerald-900">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Tag className="h-3 w-3 text-emerald-600 shrink-0" />
                    Coupon Discount ({appliedCoupon || 'PROMO'} • {discountPercent}% OFF):
                  </span>
                  <span className="font-mono font-bold text-emerald-700">-KSh {percentageDiscountAmount.toLocaleString('en-KE')}</span>
                </div>
              )}

              {volumeDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>📦 Bulk Volume Savings (15% on 6+ units):</span>
                  <span className="font-mono font-bold text-emerald-700">-KSh {volumeDiscountAmount.toLocaleString('en-KE')}</span>
                </div>
              )}

              {flatDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>⭐ Promo Discount ({redeemedCoupon}):</span>
                  <span className="font-mono font-bold text-emerald-700">-KSh {flatDiscount.toLocaleString('en-KE')}</span>
                </div>
              )}

              {/* Subtotal vs Discount Comparison Summary Card */}
              {totalDiscountSavings > 0 && (
                <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2.5 my-1">
                  <div className="flex justify-between items-center text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                      Total Price Reductions:
                    </span>
                    <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-300">
                      -KSh {totalDiscountSavings.toLocaleString('en-KE')}
                    </span>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-emerald-200/80 dark:border-emerald-800/80 flex justify-between text-[11px]">
                    <span className="text-emerald-950 dark:text-emerald-100 font-medium">Discounted Subtotal:</span>
                    <span className="font-mono font-bold text-emerald-950 dark:text-white">
                      KSh {discountedSubtotal.toLocaleString('en-KE')}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                    <span>Original Price:</span>
                    <span className="font-mono line-through">KSh {originalSubtotal.toLocaleString('en-KE')}</span>
                  </div>
                </div>
              )}

              {/* Mixed Cart Tax Breakdown */}
              {mixedTaxSummary.zeroRatedSubtotal > 0 && (
                <div className="flex justify-between text-emerald-700 bg-emerald-50/60 p-1.5 rounded font-mono text-[11px]">
                  <span>⚡ Zero-Rated Items Subtotal:</span>
                  <span>KSh {mixedTaxSummary.zeroRatedSubtotal.toLocaleString('en-KE')} (0% Tax)</span>
                </div>
              )}
              {mixedTaxSummary.exemptSubtotal > 0 && (
                <div className="flex justify-between text-slate-600 bg-slate-100/60 p-1.5 rounded font-mono text-[11px]">
                  <span>🛡️ Tax-Exempt Items Subtotal:</span>
                  <span>KSh {mixedTaxSummary.exemptSubtotal.toLocaleString('en-KE')} (Exempt)</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-amber-700 font-medium font-mono">VAT Tax (Included in Price):</span>
                <span className="font-mono font-bold text-amber-700">
                  +KSh {mixedTaxSummary.totalTax.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">Fulfillment & Dispatch:</span>
                <span className="font-mono text-gray-850 dark:text-gray-200">
                  {fulfillmentMethod === 'pickup' ? (
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10.5px] font-bold border border-emerald-200 inline-flex items-center gap-1">
                      🏬 Self-Pickup (FREE)
                    </span>
                  ) : shippingFee === 0 ? (
                    <span className="text-emerald-700 font-bold">FREE Delivery</span>
                  ) : (
                    <span>KSh {shippingFee.toLocaleString('en-KE')} (Courier Delivery)</span>
                  )}
                </span>
              </div>
              <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3.5 flex flex-col gap-1">
                <div className="flex justify-between font-semibold text-sm">
                  <span className="text-gray-900 dark:text-white font-display font-medium">NET LEDGER TOTAL:</span>
                  <span className="font-mono font-bold text-gray-950 dark:text-white">KSh {total.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {totalDiscountSavings > 0 && (
                  <p className="text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 text-right">
                    🎉 You saved KSh {totalDiscountSavings.toLocaleString('en-KE')} on this order!
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Payment info fields */}
          <form onSubmit={handleCompleteOrder} className="rounded-md border border-gray-100 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-gray-850 flex items-center gap-1.5 mb-4.5 font-sans">
              <CreditCard className="h-4.5 w-4.5 text-black" /> Secure Payment & Fulfillment Gateway
            </h3>

            {isProcessing && (
              <div className="mb-4 rounded-md bg-indigo-900 p-3.5 text-xs text-indigo-50 flex items-center justify-center gap-2 animate-pulse">
                <Clock className="h-4 w-4 animate-spin text-white" />
                <span className="font-semibold tracking-wide font-mono">STANDBY: VALIDATING MERCHANT TRUST ENCRYPTIONS...</span>
              </div>
            )}

            <div className="flex flex-col gap-3.5">
              {/* Checkout Mode Selector */}
              <div className="bg-slate-50/50 p-2.5 rounded-lg border border-gray-150">
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5">Checkout Profile Mode</label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-white border border-gray-150/80">
                  <button
                    type="button"
                    onClick={() => {
                      setIsGuest(false);
                      setCustomerName(getInitialCustomerName());
                      setCustomerEmail(getInitialCustomerEmail());
                      const cleanPhone = getInitialCustomerPhone();
                      setCustomerPhone(cleanPhone);
                      setShippingAddress(localStorage.getItem('veloce_login_address') || '');
                      setMpesaPhone(cleanPhone);
                    }}
                    className={`h-7 rounded text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer ${
                      !isGuest 
                        ? 'bg-indigo-600 text-white shadow-3xs font-bold' 
                        : 'text-gray-500 hover:text-gray-800 bg-gray-50/40'
                    }`}
                  >
                    🌟 Member Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsGuest(true);
                      setCustomerName('');
                      setCustomerEmail('');
                      setCustomerPhone('');
                      setMpesaPhone('');
                    }}
                    className={`h-7 rounded text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer ${
                      isGuest 
                        ? 'bg-amber-500 text-white shadow-3xs font-bold' 
                        : 'text-gray-500 hover:text-gray-800 bg-gray-50/40'
                    }`}
                  >
                    👤 Guest Checkout
                  </button>
                </div>
                {isGuest && (
                  <p className="text-[10px] text-amber-700 font-light mt-1.5 leading-tight">
                    Placing order as Guest. Fill in custom contact details below.
                  </p>
                )}
              </div>

              {/* Profile details */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-0.5">
                  Your Full Name <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={isGuest ? "Enter full name" : "e.g. Jane Doe"}
                  className="h-8 w-full rounded border border-gray-200 bg-white px-2.5 text-xs font-light text-gray-850 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-0.5">
                  Invoice PDF Dispatch Email <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder={isGuest ? "guest@example.com" : "e.g. customer@example.com"}
                  className="h-8 w-full rounded border border-gray-200 bg-white px-2.5 text-xs font-light text-gray-850 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-0.5">
                  Phone Number (SMS & Dispatch Alerts) <span className="text-rose-500 font-bold">*</span>
                </label>
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
                  placeholder={isGuest ? "e.g. 0712 345 678 or +254 712 345 678" : "e.g. 0712 345 678"}
                  className="h-8 w-full rounded border border-gray-200 bg-white px-2.5 text-xs font-mono text-gray-850 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* FULFILLMENT METHOD TOGGLE: Delivery to Place vs Self-Pickup from Warehouse */}
              <div className="border-t border-indigo-100/60 pt-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider font-mono">
                    Fulfillment Preference
                  </label>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    fulfillmentMethod === 'pickup'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-indigo-700 bg-indigo-50 border-indigo-200'
                  }`}>
                    {fulfillmentMethod === 'pickup' ? '⚡ Warehouse Pickup: FREE' : '🚚 Doorstep Courier Delivery'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option 1: Doorstep Delivery */}
                  <button
                    type="button"
                    onClick={() => setFulfillmentMethod('delivery')}
                    className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left relative cursor-pointer ${
                      fulfillmentMethod === 'delivery'
                        ? 'border-indigo-600 bg-indigo-50/20 ring-1.5 ring-indigo-500 shadow-3xs'
                        : 'border-gray-200 bg-white hover:bg-gray-50/60 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${fulfillmentMethod === 'delivery' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                          <Truck className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold font-sans text-gray-900 block">Delivery to My Place</span>
                          <span className="text-[10px] text-gray-500 font-light block">Courier Doorstep Delivery</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between w-full text-[10px] text-gray-500 font-light mt-1 pt-1 border-t border-gray-100">
                      <span>{hasPhysicalItems ? 'KSh 15.00 Courier fee' : 'FREE'}</span>
                      <span className="font-mono text-indigo-650 font-medium">24–48 hrs</span>
                    </div>
                  </button>

                  {/* Option 2: Self-Pickup from Warehouse */}
                  <button
                    type="button"
                    onClick={() => setFulfillmentMethod('pickup')}
                    className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left relative cursor-pointer ${
                      fulfillmentMethod === 'pickup'
                        ? 'border-emerald-600 bg-emerald-50/25 ring-1.5 ring-emerald-500 shadow-3xs'
                        : 'border-gray-200 bg-white hover:bg-gray-50/60 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${fulfillmentMethod === 'pickup' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                          <Warehouse className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold font-sans text-gray-900 block">Self-Pickup from Warehouse</span>
                          <span className="text-[10px] text-emerald-700 font-medium block">Collect at Warehouse Desk</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between w-full text-[10px] text-emerald-700 font-light mt-1 pt-1 border-t border-emerald-100/60">
                      <span className="font-bold">FREE (KSh 0)</span>
                      <span className="font-mono font-medium">Ready in 2–4 hrs</span>
                    </div>
                  </button>
                </div>

                {/* Sub-view: DELIVERY ADDRESS FORM */}
                {fulfillmentMethod === 'delivery' && (
                  <div className="mt-1 flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <AddressAutocomplete
                      value={shippingAddress}
                      onChange={(text) => setShippingAddress(text)}
                      onAddressSelect={(details: AddressDetails) => {
                        setShippingAddress(details.formattedAddress);
                        if (details.city) setShippingCity(details.city);
                        if (details.postalCode) setShippingZip(details.postalCode);
                      }}
                      label="Shipping Street Address & GPS Pin"
                      required
                    />

                    {/* OpenStreetMap Pin Drop Trigger */}
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setShowMapPinModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        <Globe className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Drop Pin on Live OpenStreetMap</span>
                      </button>

                      {customDistanceKm !== null && (
                        <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                          ✓ Distance: {customDistanceKm} km
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">City / County</label>
                        <input
                          type="text"
                          required
                          value={shippingCity}
                          onChange={(e) => setShippingCity(e.target.value)}
                          className="h-8 w-full rounded border border-gray-200 bg-white px-2.5 text-xs font-light text-gray-850"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">ZIP / Postal Code</label>
                        <input
                          type="text"
                          required
                          value={shippingZip}
                          onChange={(e) => setShippingZip(e.target.value)}
                          className="h-8 w-full rounded border border-gray-200 bg-white px-2.5 text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Express Priority Rush Option */}
                    <label className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      isExpressDelivery ? 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-300' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isExpressDelivery}
                          onChange={(e) => setIsExpressDelivery(e.target.checked)}
                          className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1">
                            <Zap className="h-3.5 w-3.5 text-amber-500" /> Express Rush Priority (+KSh 150)
                          </span>
                          <span className="text-[10px] text-gray-500 font-light block">
                            Dispatched via priority motorcycle courier within 30-45 mins
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                        Priority
                      </span>
                    </label>

                    {/* Live Delivery Cost & SLA Card */}
                    <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-1 font-bold text-indigo-950 dark:text-indigo-200 text-[11px]">
                          <Truck className="h-3.5 w-3.5 text-indigo-600" />
                          <span>{deliveryFeeCalculation.reason}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5 flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-indigo-500" />
                          <span>Estimated Timeframe: {deliveryFeeCalculation.estimatedTimeframe}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="block text-[9px] font-mono uppercase text-gray-400 font-bold">Courier Fee</span>
                        <span className="font-mono font-bold text-sm text-gray-950 dark:text-white">
                          {deliveryFeeCalculation.isFreeDelivery ? (
                            <span className="text-emerald-700 font-extrabold">FREE (KSh 0)</span>
                          ) : (
                            `KSh ${deliveryFeeCalculation.fee.toLocaleString('en-KE')}`
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-view: WAREHOUSE SELF-PICKUP SELECTION */}
                {fulfillmentMethod === 'pickup' && (
                  <div className="mt-1 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5">
                        Select Collection Warehouse / Hub Location
                      </label>
                      <div className="space-y-2">
                        {WAREHOUSE_HUBS.map((hub) => {
                          const isSelected = selectedWarehouseId === hub.id;
                          return (
                            <label
                              key={hub.id}
                              className={`p-3 rounded-xl border flex flex-col gap-1.5 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-emerald-600 bg-emerald-50/20 ring-1 ring-emerald-500 shadow-2xs'
                                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/40'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5">
                                  <input
                                    type="radio"
                                    name="warehouseHub"
                                    value={hub.id}
                                    checked={isSelected}
                                    onChange={() => setSelectedWarehouseId(hub.id)}
                                    className="mt-0.5 h-3.5 w-3.5 text-emerald-600 accent-emerald-600"
                                  />
                                  <div>
                                    <span className="text-xs font-bold text-gray-900 block leading-tight font-sans">
                                      {hub.name}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-light block mt-0.5">
                                      📍 {hub.address} ({hub.landmark})
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[9px] font-mono font-bold text-emerald-800 bg-emerald-100/70 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
                                  {hub.readyTime}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center justify-between text-[9.5px] text-gray-400 font-mono pt-1.5 border-t border-gray-100 pl-6">
                                <span className="flex items-center gap-1 text-gray-500">
                                  <Clock className="h-3 w-3 text-gray-400" /> {hub.hours}
                                </span>
                                <span className="flex items-center gap-1 text-gray-500">
                                  <Phone className="h-3 w-3 text-gray-400" /> {hub.phone}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Collector contact info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50/60 p-3 rounded-xl border border-gray-150">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">
                          Pickup Contact / Collector Name
                        </label>
                        <input
                          type="text"
                          value={pickupContactName}
                          onChange={(e) => setPickupContactName(e.target.value)}
                          placeholder={customerName || "Full name of person collecting"}
                          className="h-8 w-full rounded border border-gray-200 bg-white px-2.5 text-xs font-light text-gray-850"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5">
                          Collector Verification Mobile No.
                        </label>
                        <input
                          type="tel"
                          value={pickupContactPhone}
                          onChange={(e) => setPickupContactPhone(e.target.value)}
                          placeholder={mpesaPhone || "07XX XXX XXX"}
                          className="h-8 w-full rounded border border-gray-200 bg-white px-2.5 text-xs font-mono text-gray-850"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg bg-emerald-50/60 border border-emerald-200/80 p-2.5 text-[10.5px] text-emerald-950 font-light flex items-start gap-2">
                      <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Pickup Protocol:</strong> Once your payment is verified, your order will be prepared within 2–4 hours. Please present your <strong>Order Ref ID</strong> and National ID / Phone at the pickup counter.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Methods Choice (M-Pesa / Cash on Delivery) */}
              <div className="border-t border-indigo-100/50 pt-3 flex flex-col gap-3">
                {hasConflict ? (
                  /* Conflicting Cart warning with Split action */
                  <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 animate-in fade-in zoom-in duration-200 text-left">
                    <div className="flex gap-2.5 items-start">
                      <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-rose-950 font-sans">Direct Payment Conflict!</h4>
                        <p className="text-[10.5px] text-rose-800 font-light leading-relaxed mt-1">
                          Your cart contains customized items requiring <strong>Prepayment (M-Pesa Only)</strong> as well as items restricted to <strong>Cash on Delivery (COD Only)</strong>.
                        </p>
                        <p className="text-[10.5px] text-rose-800 font-light leading-relaxed mt-1">
                          To place your order, you must split your cart. Our quick action can transfer your COD items to your wishlist.
                        </p>
                        <button
                          type="button"
                          onClick={handleSplitCart}
                          className="mt-3 inline-flex h-7.5 items-center justify-center rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-3 transition-colors cursor-pointer shadow-3xs"
                        >
                          ⚡ Split Cart & Resolve Conflict
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-left">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[9px] font-bold text-gray-400 uppercase">Payment & Order Placement Method</label>
                      <span className="text-[9.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Zap className="h-3 w-3" /> WhatsApp Checkout Available
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* WhatsApp Order Option */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('whatsapp')}
                        className={`p-3 rounded-xl border flex flex-col items-start gap-1 transition-all text-left relative cursor-pointer ${
                          paymentMethod === 'whatsapp'
                            ? 'border-[#25D366] bg-[#25D366]/10 dark:bg-[#25D366]/15 ring-1.5 ring-[#25D366] shadow-3xs'
                            : 'border-gray-200 bg-white hover:bg-gray-55/30 dark:bg-gray-900 dark:border-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-black font-sans tracking-tight text-gray-950 dark:text-white flex items-center gap-1.5">
                            <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" /> WhatsApp Order
                          </span>
                          <span className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                            paymentMethod === 'whatsapp' ? 'border-[#25D366]' : 'border-gray-300 dark:border-gray-700'
                          }`}>
                            {paymentMethod === 'whatsapp' && <span className="h-2 w-2 rounded-full bg-[#25D366]" />}
                          </span>
                        </div>
                        <span className="text-[9.5px] text-gray-500 dark:text-gray-400 leading-normal">
                          Chat directly with our sales team on <strong>{whatsappNumber}</strong> to finalize dispatch.
                        </span>
                        <span className="absolute -top-1.5 right-4 px-1.5 py-0.2 rounded bg-emerald-500 text-white text-[8px] font-black uppercase font-mono shadow-3xs">
                          ⚡ Instant Chat
                        </span>
                      </button>

                      {/* M-Pesa Toggle Option */}
                      <button
                        type="button"
                        disabled={hasCod}
                        onClick={() => setPaymentMethod('mpesa')}
                        className={`p-3 rounded-xl border flex flex-col items-start gap-1 transition-all text-left relative cursor-pointer ${
                          paymentMethod === 'mpesa'
                            ? 'border-indigo-600 bg-indigo-50/10 ring-1.5 ring-indigo-500 shadow-3xs'
                            : 'border-gray-200 bg-white hover:bg-gray-55/30 dark:bg-gray-900 dark:border-gray-800'
                        } ${hasCod ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-black font-sans tracking-tight text-gray-950 dark:text-white flex items-center gap-1.5">
                            <Smartphone className="h-3.5 w-3.5 text-indigo-600" /> M-Pesa Paybill
                          </span>
                          <span className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                            paymentMethod === 'mpesa' ? 'border-indigo-600' : 'border-gray-300 dark:border-gray-700'
                          }`}>
                            {paymentMethod === 'mpesa' && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                          </span>
                        </div>
                        <span className="text-[9.5px] text-gray-500 dark:text-gray-400 leading-normal">
                          Pay via Lipa na M-Pesa Paybill {mpesaPaybill} / Till.
                        </span>
                        {hasPrepaid && (
                          <span className="absolute -top-1.5 right-4 px-1.5 py-0.2 rounded bg-emerald-100 border border-emerald-300 text-[8px] font-extrabold text-emerald-800 uppercase font-mono shadow-3xs">
                            Required
                          </span>
                        )}
                      </button>

                      {/* Cash on Delivery Option */}
                      <button
                        type="button"
                        disabled={hasPrepaid}
                        onClick={() => setPaymentMethod('cod')}
                        className={`p-3 rounded-xl border flex flex-col items-start gap-1 transition-all text-left relative cursor-pointer ${
                          paymentMethod === 'cod'
                            ? 'border-indigo-600 bg-indigo-50/10 ring-1.5 ring-indigo-500 shadow-3xs'
                            : 'border-gray-200 bg-white hover:bg-gray-55/30 dark:bg-gray-900 dark:border-gray-800'
                        } ${hasPrepaid ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-black font-sans tracking-tight text-gray-950 dark:text-white flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5 text-amber-600" /> Cash on Delivery
                          </span>
                          <span className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                            paymentMethod === 'cod' ? 'border-indigo-600' : 'border-gray-300 dark:border-gray-700'
                          }`}>
                            {paymentMethod === 'cod' && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                          </span>
                        </div>
                        <span className="text-[9.5px] text-gray-500 dark:text-gray-400 leading-normal">
                          Settle in cash or mobile money upon physical package receipt.
                        </span>
                        {hasCod && (
                          <span className="absolute -top-1.5 right-4 px-1.5 py-0.2 rounded bg-amber-100 border border-amber-300 text-[8px] font-extrabold text-amber-800 uppercase font-mono shadow-3xs">
                            Required
                          </span>
                        )}
                      </button>
                    </div>

                    {/* WhatsApp Checkout Highlight Card */}
                    {paymentMethod === 'whatsapp' && (
                      <div className="mt-3.5 rounded-2xl border border-[#25D366]/40 bg-[#25D366]/10 dark:bg-[#25D366]/15 p-4 animate-in fade-in duration-200 text-left">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-xl bg-[#25D366] text-white shadow-2xs shrink-0 mt-0.5">
                            <MessageCircle className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h5 className="text-xs font-bold text-gray-950 dark:text-white flex items-center gap-1.5">
                                  Official WhatsApp Concierge Desk
                                </h5>
                                <span className="text-[11px] font-mono font-bold text-[#1ea952] dark:text-[#25D366]">
                                  WhatsApp Line: +254 182 180 965 ({whatsappNumber})
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 font-mono text-[9.5px] font-bold">
                                🟢 ACTIVE CONCIERGE
                              </span>
                            </div>

                            <p className="text-[11px] text-gray-700 dark:text-gray-300 font-light leading-relaxed">
                              When you click <strong>Confirm &amp; Place Order on WhatsApp</strong>, our system will record your order reference and immediately launch WhatsApp with your pre-formatted cart summary. Simply tap <strong>Send</strong> to chat directly with our dispatch team!
                            </p>

                            <div className="pt-2 border-t border-[#25D366]/30 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-gray-600 dark:text-gray-400 font-mono">
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                <span>No upfront payment required</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                <span>Fast delivery dispatch</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                <span>Custom sizing support</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Explanatory notes under selected option */}
                    <div className="mt-2.5">
                      {hasPrepaid && !hasConflict && (
                        <p className="text-[10px] text-emerald-700 font-medium">
                          🔒 Prepaid: Your cart contains customized or digital items which require payment before shipping. Cash on Delivery is disabled.
                        </p>
                      )}
                      {hasCod && !hasConflict && (
                        <p className="text-[10px] text-amber-700 font-medium">
                          🚚 Cash on Delivery Only: Your cart contains items restricted to COD only. Prepaid payment is disabled.
                        </p>
                      )}
                    </div>

                    {/* M-Pesa Paybill Instructions & Details */}
                    {paymentMethod === 'mpesa' && (
                      <div className="mt-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-850/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 animate-in fade-in duration-200">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-2xs shrink-0 mt-0.5">
                            <Smartphone className="h-5 w-5" />
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <h5 className="text-xs font-bold text-gray-900 dark:text-white">Lipa na M-PESA (Paybill)</h5>
                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 font-mono text-[9.5px] font-bold">
                                  OFFICIAL BUSINESS PAYBILL
                                </span>
                              </div>
                              <span className="text-[11px] font-mono font-black text-emerald-700 dark:text-emerald-400">
                                Amount: KSh {total.toLocaleString('en-KE')}
                              </span>
                            </div>

                            {/* Highlighted Paybill Details Box */}
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-white dark:bg-gray-900 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40 shadow-3xs">
                              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-100/60 dark:border-emerald-900/30">
                                <div>
                                  <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase font-mono block">Business / Paybill No.</span>
                                  <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400">{mpesaPaybill}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(mpesaPaybill, 'paybill')}
                                  className="px-2 py-1 rounded bg-white dark:bg-gray-800 text-[10px] font-bold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Copy Paybill Number"
                                >
                                  {copiedField === 'paybill' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                  <span>{copiedField === 'paybill' ? 'Copied' : 'Copy'}</span>
                                </button>
                              </div>

                              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-100/60 dark:border-emerald-900/30">
                                <div>
                                  <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase font-mono block">Account No.</span>
                                  <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400">{mpesaAccountNumber}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(mpesaAccountNumber, 'account')}
                                  className="px-2 py-1 rounded bg-white dark:bg-gray-800 text-[10px] font-bold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Copy Account Number"
                                >
                                  {copiedField === 'account' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                  <span>{copiedField === 'account' ? 'Copied' : 'Copy'}</span>
                                </button>
                              </div>
                            </div>

                            <div className="mt-2 text-[10px] text-gray-600 dark:text-gray-400 flex items-center gap-1 font-medium">
                              <span className="text-gray-400">Account Name:</span>
                              <strong className="text-gray-900 dark:text-white font-mono uppercase font-bold">{mpesaAccountName}</strong>
                            </div>

                            {/* Step by step checklist */}
                            <div className="mt-2.5 pt-2.5 border-t border-emerald-100/80 dark:border-emerald-900/40 text-[10.5px] text-gray-600 dark:text-gray-400 space-y-1 font-light leading-relaxed">
                              <div>1. Go to <strong>M-PESA</strong> on your phone &rarr; Select <strong>Lipa na M-PESA</strong> &rarr; <strong>Paybill</strong></div>
                              <div>2. Enter Business Number: <strong className="font-mono text-gray-900 dark:text-white">{mpesaPaybill}</strong></div>
                              <div>3. Enter Account Number: <strong className="font-mono text-gray-900 dark:text-white">{mpesaAccountNumber}</strong></div>
                              <div>4. Enter Amount: <strong className="font-mono text-emerald-700 dark:text-emerald-400">KSh {total.toLocaleString('en-KE')}</strong></div>
                              <div>5. Enter your <strong>M-PESA PIN</strong> and verify recipient as <strong>{mpesaAccountName}</strong></div>
                            </div>

                            {/* Optional M-Pesa Transaction Ref / Contact Phone */}
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-emerald-100/80 dark:border-emerald-900/40 items-end">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between min-h-[18px]">
                                  <label className="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 uppercase font-mono truncate">
                                    M-Pesa Confirmation Code
                                  </label>
                                  <span className="text-[8.5px] font-mono font-medium text-gray-400 dark:text-gray-500 lowercase shrink-0">
                                    (optional)
                                  </span>
                                </div>
                                <input
                                  type="text"
                                  value={mpesaTransactionCode}
                                  onChange={(e) => setMpesaTransactionCode(e.target.value.toUpperCase())}
                                  placeholder="e.g. SHB4X7K9LP"
                                  maxLength={12}
                                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-xs font-mono text-gray-900 dark:text-white uppercase placeholder:normal-case focus:outline-hidden focus:ring-1 focus:ring-emerald-500 shadow-3xs"
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between min-h-[18px]">
                                  <label className="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 uppercase font-mono truncate">
                                    M-Pesa Sender Phone
                                  </label>
                                  <span className="text-[8.5px] font-mono font-medium text-gray-400 dark:text-gray-500 lowercase shrink-0">
                                    (optional)
                                  </span>
                                </div>
                                <input
                                  type="tel"
                                  value={mpesaPhone}
                                  onChange={(e) => setMpesaPhone(e.target.value)}
                                  placeholder="e.g. 0712345678"
                                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-xs font-mono text-gray-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500 shadow-3xs"
                                />
                              </div>
                            </div>

                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-gray-100">
              <button
                type="submit"
                disabled={isProcessing || hasConflict}
                style={
                  paymentMethod === 'whatsapp'
                    ? { backgroundColor: '#25D366', color: '#ffffff' }
                    : undefined
                }
                className={`w-full h-11 rounded-xl font-display text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2 ${
                  paymentMethod === 'whatsapp'
                    ? 'hover:opacity-95 text-white shadow-[#25D366]/30'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 hover:shadow-indigo-500/30'
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-1.5 font-mono">
                    <Clock className="h-4 w-4 animate-spin text-white" /> PROCESSING ORDER...
                  </span>
                ) : paymentMethod === 'whatsapp' ? (
                  <>
                    <MessageCircle className="h-4 w-4 text-white" />
                    <span className="text-white font-black">Confirm &amp; Send Order on WhatsApp (KSh {total.toLocaleString('en-KE')})</span>
                  </>
                ) : paymentMethod === 'cod' ? (
                  `Place Cash on Delivery Order (KSh ${total.toLocaleString('en-KE')})`
                ) : (
                  `Place Order with M-Pesa (KSh ${total.toLocaleString('en-KE')})`
                )}
              </button>
              <span className="block text-center text-[9px] text-gray-400 font-mono mt-2 uppercase tracking-wide font-medium">
                ◆ PROTOTYPE SECURED BY DYNAMIC KENYA GATEWAY
              </span>
            </div>
          </form>
        </div>
      </div>

      {/* OpenStreetMap Interactive Pin Drop Modal */}
      {showMapPinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-3.5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-gray-950 dark:text-white flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Select Delivery Destination on OpenStreetMap
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-light">
                  Search your estate or drag the pin to calculate exact driving distance and delivery fee.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMapPinModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <InteractiveDeliveryMap
              storeLocation={DEFAULT_STORE_LOCATION}
              zones={storeZones}
              happyHours={storeHappyHours}
              orderSubtotal={discountedSubtotal}
              isExpress={isExpressDelivery}
              freeThreshold={storeFreeThreshold}
              height="380px"
              onLocationSelected={(loc) => {
                setShippingAddress(loc.address);
                setCustomDistanceKm(loc.distanceResult.distanceKm);
              }}
            />

            <div className="flex items-center justify-between pt-2 border-t border-gray-150 dark:border-gray-800">
              <span className="text-[11px] text-gray-500 font-mono">
                {customDistanceKm !== null ? `✓ Selected: ${customDistanceKm} km from Central Hub` : 'Drop pin on map'}
              </span>
              <button
                type="button"
                onClick={() => setShowMapPinModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Confirm Location Pin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import {
  Printer,
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Award,
  Check,
  Download,
  ShoppingBag,
  Clock,
  Truck,
  ShoppingCart,
  Warehouse,
  MapPin,
  Phone,
  Mail,
  QrCode,
  CheckCircle2,
  FileText,
  Smartphone,
  Copy,
  ExternalLink,
  Package,
  Calendar,
  AlertCircle,
  Tag,
  DollarSign
} from 'lucide-react';
import { Order } from '../types';
import { CurrencyType, formatPrice } from '../lib/currency';
import { useSiteSettings } from '../context/SiteSettingsContext';

export interface OrderReceiptPageProps {
  order: Order;
  onBack?: () => void;
  onClose?: () => void;
  autoPrint?: boolean;
  shippingStatus?: 'ordered' | 'processing' | 'shipped' | 'delivered';
  onReorder?: (order: Order) => void;
  allOrders?: Order[];
  onUpdateOrderPaymentStatus?: (orderId: string, paymentStatus: 'unpaid' | 'paid', paidNote?: string) => void;
  currency?: CurrencyType;
}

export default function OrderReceiptPage({
  order,
  onBack,
  onClose,
  autoPrint = false,
  shippingStatus,
  onReorder,
  allOrders = [],
  onUpdateOrderPaymentStatus,
  currency = 'KSh',
}: OrderReceiptPageProps) {
  const { settings } = useSiteSettings();
  const mpesaPaybill = settings.payments.mpesa_paybill || '303030';
  const mpesaAccountNumber = settings.payments.mpesa_account_number || '2047728455';
  const mpesaAccountName = settings.payments.mpesa_account_name || 'ROPENIX INVESTMENTS LTD';
  const legalBusinessName = settings.receipts.legal_business_name || settings.general.site_name || 'ROPENIX INVESTMENTS LTD';
  const businessAddress = settings.receipts.physical_address || settings.general.physical_address || 'Nairobi Central Business District, Nairobi, Kenya';
  const businessEmail = settings.receipts.contact_email || settings.general.business_email || 'support@ropenix.co.ke';
  const businessPhone = settings.receipts.contact_phone || settings.general.support_phone || '+254 182 180 965';
  const tagline = settings.general.tagline || 'Ropenix Collections & Logistics Operations';

  const [copiedField, setCopiedField] = useState<'paybill' | 'account' | 'orderId' | null>(null);
  const printableAreaRef = useRef<HTMLDivElement>(null);

  const handleBack = () => {
    if (onBack) onBack();
    else if (onClose) onClose();
  };

  const handlePrint = () => {
    window.print();
  };

  React.useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  const handleCopyText = (text: string, field: 'paybill' | 'account' | 'orderId') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const isPickup = order.fulfillmentType === 'pickup';
  const currentStage = shippingStatus || (order.status === 'completed' ? 'delivered' : 'processing');

  const steps = isPickup
    ? [
        { label: 'Order Placed', key: 'ordered', desc: 'Order logged in ledger', icon: ShoppingBag },
        { label: 'Staged at Hub', key: 'processing', desc: 'Warehouse staging', icon: Warehouse },
        { label: 'Ready for Collection', key: 'shipped', desc: 'Ready at counter', icon: Clock },
        { label: 'Collected & Verified', key: 'delivered', desc: 'Signed handover', icon: Check },
      ]
    : [
        { label: 'Order Placed', key: 'ordered', desc: 'Order logged in ledger', icon: ShoppingBag },
        { label: 'Processing', key: 'processing', desc: 'Packaging & QA check', icon: Clock },
        { label: 'Dispatched', key: 'shipped', desc: 'Courier in transit', icon: Truck },
        { label: 'Delivered', key: 'delivered', desc: 'Customer signed receipt', icon: Check },
      ];

  const activeIndex = order.status === 'cancelled' ? -1 : steps.findIndex((step) => step.key === currentStage);
  const progressPercent = activeIndex < 0 ? 0 : (activeIndex / (steps.length - 1)) * 100;

  // Lifetime metrics calculation
  const customerOrders = allOrders.length > 0
    ? allOrders.filter(
        (o) =>
          (o.customerEmail && order.customerEmail && o.customerEmail.toLowerCase() === order.customerEmail.toLowerCase()) ||
          (o.customerName && order.customerName && o.customerName.toLowerCase() === order.customerName.toLowerCase())
      )
    : [order];

  const totalOrdersCount = customerOrders.length || 1;
  const lifetimeValue = customerOrders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total, 0);

  // Financial calculations
  const grossSubtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxAmount =
    order.taxTotal ??
    order.items.reduce((sum, item) => {
      const rate = item.taxRate ?? 16;
      return sum + (item.taxStatus === 'taxable' || !item.taxStatus ? (item.price * item.quantity) - ((item.price * item.quantity) / (1 + rate / 100)) : 0);
    }, 0);
  const subtotalExclTax = Math.max(0, grossSubtotal - taxAmount);
  const discountAmount = order.discountAmount ?? 0;
  const shippingFee = order.shippingFee ?? 0;

  const isCod = order.paymentMethod === 'cod';
  const isPaid = order.paymentStatus === 'paid' || (!isCod && order.paymentStatus !== 'unpaid' && order.paymentStatus !== 'pending');

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(order.id)}&color=000000&bgcolor=ffffff`;

  const handleDownloadQR = async () => {
    try {
      const response = await fetch(qrUrl);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Ropenix_Order_QR_${order.id.slice(0, 8).toUpperCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(qrUrl, '_blank');
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-20 font-sans text-gray-900 dark:text-white" id="order-receipt-dedicated-page">
      {/* 1. Header Action Toolbar (Hidden in Print) */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-850 pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-2.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer shadow-3xs flex items-center justify-center"
            title="Return to orders"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                Official Order Receipt & Acquisition Record
              </h2>
              <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-mono text-[10px] font-bold rounded-md">
                VERIFIED FISCAL RECORD
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Order ID: <strong className="font-mono text-gray-900 dark:text-white uppercase">{order.id}</strong> • Placed on {order.date}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {onUpdateOrderPaymentStatus && (
            <button
              type="button"
              onClick={() => onUpdateOrderPaymentStatus(order.id, isPaid ? 'unpaid' : 'paid')}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-3xs flex items-center gap-1.5 ${
                isPaid
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isPaid ? 'Mark Unpaid' : 'Mark as Verified Paid ✓'}</span>
            </button>
          )}

          {onReorder && (
            <button
              type="button"
              onClick={() => onReorder(order)}
              className="px-3.5 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
              title="Add items to cart"
            >
              <ShoppingCart className="h-3.5 w-3.5 text-gray-500" />
              <span>Reorder Items</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadQR}
            className="px-3.5 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
            title="Download QR code PNG"
          >
            <QrCode className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Download QR</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Print Fiscal Receipt</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics & Status Bar (Hidden in Print) */}
      <div className="no-print grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase font-mono tracking-wider block">Total Settled</span>
          <div className="mt-1.5 text-xl font-black font-mono text-gray-900 dark:text-white">
            {formatPrice(order.total, currency)}
          </div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium block mt-0.5">
            {order.items.reduce((s, i) => s + i.quantity, 0)} total item(s)
          </span>
        </div>

        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase font-mono tracking-wider block">Payment Status</span>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold ${
              isPaid
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              {isPaid ? (order.paymentReference ? 'PREPAID VIA M-PESA' : 'VERIFIED PAID') : 'PENDING (PAY ON DELIVERY)'}
            </span>
          </div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono block mt-1 truncate">
            {order.paymentReference ? `Code: ${order.paymentReference}` : (order.paymentMethod === 'cod' ? 'Cash on Delivery' : `M-PESA Paybill ${mpesaPaybill}`)}
          </span>
        </div>

        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase font-mono tracking-wider block">Fulfillment Type</span>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold ${
              isPickup
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
            }`}>
              {isPickup ? <Warehouse className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
              {isPickup ? 'WAREHOUSE PICKUP' : 'DOORSTEP COURIER'}
            </span>
          </div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium block mt-1 truncate">
            {isPickup ? 'Station Collection' : 'Direct Dispatch'}
          </span>
        </div>

        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase font-mono tracking-wider block">Customer LTV</span>
          <div className="mt-1.5 text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {formatPrice(lifetimeValue, currency)}
          </div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium block mt-0.5">
            Across {totalOrdersCount} lifetime order(s)
          </span>
        </div>
      </div>

      {/* 3. The Official High-Fidelity Printable Receipt Card Frame */}
      <div
        ref={printableAreaRef}
        id="printable-receipt-area"
        className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 sm:p-10 shadow-md font-sans text-gray-900 dark:text-white print:border-none print:shadow-none print:p-0 print:m-0 print:bg-white print:text-black"
      >
        {/* Company Letterhead & Document Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-2 border-indigo-600 dark:border-indigo-500 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 bg-indigo-600 text-white font-display font-black text-sm rounded-xl flex items-center justify-center shadow-3xs">
                R
              </div>
              <div>
                <span className="font-display text-lg sm:text-xl font-black tracking-tight text-gray-950 dark:text-white uppercase block">
                  {legalBusinessName}
                </span>
                <span className="font-mono text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">
                  {tagline}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 font-normal mt-3 leading-relaxed max-w-sm">
              {businessAddress}<br />
              P.O. Box 40404 - 00100 GPO, Nairobi<br />
              <span className="font-semibold text-gray-700 dark:text-gray-300">Official M-PESA Paybill:</span> <strong className="font-mono text-emerald-600 font-bold">{mpesaPaybill}</strong> (Acc: <strong className="font-mono text-emerald-600 font-bold">{mpesaAccountNumber}</strong>)<br />
              <span className="font-semibold text-gray-700 dark:text-gray-300">Support Hotline:</span> {businessPhone} • {businessEmail}
            </p>
          </div>

          <div className="text-left sm:text-right flex flex-col sm:items-end shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-wider mb-2 shadow-3xs ${
              isPaid
                ? 'bg-emerald-500 text-white'
                : 'bg-amber-500 text-white'
            }`}>
              <Check className="h-3.5 w-3.5" />
              {isPaid ? 'INVOICE SETTLED (PAID)' : 'PAYMENT PENDING'}
            </span>

            <div className="space-y-1 text-xs font-mono text-gray-500 dark:text-gray-400">
              <div>
                Order ID: <strong className="font-bold text-gray-900 dark:text-white uppercase">{order.id}</strong>
              </div>
              <div>
                Receipt Date: <strong className="text-gray-800 dark:text-gray-200">{order.date}</strong>
              </div>
              <div>
                Payment Method: <strong className="text-gray-800 dark:text-gray-200">{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'M-PESA Paybill (303030)'}</strong>
              </div>
              {order.paymentReference && (
                <div className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <span>M-Pesa Txn Code:</span>
                  <span className="font-black underline">{order.paymentReference}</span>
                </div>
              )}
              {(order.mpesaPhone || (order.paymentMethod === 'mpesa' && order.phone)) && (
                <div>
                  Payer Mobile: <strong className="text-gray-800 dark:text-gray-200">{order.mpesaPhone || order.phone}</strong>
                </div>
              )}
            </div>

            {/* Micro QR Code */}
            <div className="mt-3 flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-2 rounded-xl">
              <img
                src={qrUrl}
                alt={`QR for order ${order.id}`}
                className="h-12 w-12 object-contain bg-white rounded p-0.5"
                referrerPolicy="no-referrer"
              />
              <div className="text-left">
                <span className="text-[8px] font-mono text-gray-400 uppercase tracking-widest font-extrabold block">
                  Scan to Verify
                </span>
                <span className="text-[9px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {order.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bill To & Settlement Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 border-b border-gray-100 dark:border-gray-850 text-xs">
          <div>
            <span className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest font-mono mb-2">
              Billed To Customer
            </span>
            <div className="space-y-1">
              <strong className="text-sm font-bold text-gray-950 dark:text-white block">
                {order.customerName}
              </strong>
              <span className="text-gray-500 dark:text-gray-400 block font-mono">
                {order.customerEmail}
              </span>
              {order.phone && (
                <span className="text-gray-500 dark:text-gray-400 block font-mono">
                  Tel: {order.phone}
                </span>
              )}
              <div className="pt-1.5 flex items-center gap-1.5 font-mono text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4" /> SECURE AUTHENTICATED WORKSPACE RECORD
              </div>
            </div>
          </div>

          <div className="md:text-right flex flex-col md:items-end">
            <span className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest font-mono mb-2">
              Settlement & Channel Details
            </span>
            <div className="space-y-1.5 text-gray-600 dark:text-gray-300 w-full sm:max-w-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Payment Channel:</span>
                <strong className="text-gray-900 dark:text-white font-mono">
                  {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'M-PESA Paybill'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Settlement Status:</span>
                <strong className={`font-mono font-bold ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {isPaid ? (order.paymentReference ? 'Prepaid Before Delivery' : 'Verified Settled') : 'Pay on Delivery'}
                </strong>
              </div>
              {order.paymentMethod !== 'cod' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Paybill No:</span>
                    <strong className="text-emerald-600 font-mono font-bold">303030</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Account No:</span>
                    <strong className="text-emerald-600 font-mono font-bold">2047728455</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Account Name:</span>
                    <strong className="text-gray-900 dark:text-white text-[11px]">ROPENIX INVESTMENTS LTD</strong>
                  </div>
                </>
              )}
              {order.paymentReference && (
                <div className="mt-2 p-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-left font-mono">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-emerald-800 dark:text-emerald-300 font-bold uppercase">M-Pesa Txn Code:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-black text-emerald-700 dark:text-emerald-400 text-xs">{order.paymentReference}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(order.paymentReference!, 'orderId')}
                        className="text-emerald-600 hover:text-emerald-800 p-0.5 print:hidden cursor-pointer"
                        title="Copy code"
                      >
                        {copiedField === 'orderId' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                  {(order.mpesaPhone || (order.paymentMethod === 'mpesa' && order.phone)) && (
                    <div className="flex justify-between text-[10px] text-gray-600 dark:text-gray-300 mt-1 pt-1 border-t border-emerald-150 dark:border-emerald-850">
                      <span>Payer Mobile:</span>
                      <strong className="text-gray-900 dark:text-white">{order.mpesaPhone || order.phone}</strong>
                    </div>
                  )}
                  {order.paidAt && (
                    <div className="flex justify-between text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">
                      <span>Paid Timestamp:</span>
                      <span>{order.paidAt}</span>
                    </div>
                  )}
                </div>
              )}
              {order.couponCode && (
                <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-mono font-bold pt-1 border-t border-gray-100 dark:border-gray-850">
                  <span>Applied Promo / Affiliate:</span>
                  <span>{order.couponCode}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fulfillment & Dispatch Progress Tracker */}
        <div className="py-6 border-b border-gray-100 dark:border-gray-850">
          <div className="flex items-center justify-between mb-4">
            <span className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest font-mono">
              Fulfillment & Dispatch Pipeline
            </span>
            <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md border ${
              isPickup
                ? 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800'
                : 'text-indigo-800 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800'
            }`}>
              {isPickup ? '🏬 Warehouse Pickup' : '🚚 Doorstep Delivery'}
            </span>
          </div>

          {order.status === 'cancelled' ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 p-4 flex items-center gap-2.5 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>This order was cancelled. Physical fulfillment operations have been archived.</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tracker Step Nodes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {steps.map((step, idx) => {
                  const isDone = idx <= activeIndex;
                  const isCurrent = idx === activeIndex;
                  const StepIcon = step.icon;

                  return (
                    <div
                      key={step.key}
                      className={`p-3 rounded-2xl border transition-all ${
                        isCurrent
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-3xs'
                          : isDone
                          ? 'border-emerald-200 dark:border-emerald-850 bg-emerald-50/30 dark:bg-emerald-950/20'
                          : 'border-gray-100 dark:border-gray-850 bg-gray-50/50 dark:bg-gray-900/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`p-1.5 rounded-lg ${
                          isCurrent
                            ? 'bg-indigo-600 text-white'
                            : isDone
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-800 text-gray-500'
                        }`}>
                          <StepIcon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-[11px] font-bold text-gray-900 dark:text-white font-display">
                          {step.label}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 block font-light">
                        {step.desc}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Destination Address / Pickup Hub Details */}
              <div className="p-3.5 rounded-2xl border border-gray-150 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase font-mono text-gray-400 block">
                    {isPickup ? 'Collection Hub & Ready Time:' : 'Destination Delivery Address:'}
                  </span>
                  <p className="text-xs font-bold text-gray-900 dark:text-white mt-0.5">
                    {order.pickupLocation || order.shippingAddress || 'Standard Delivery Zone (Nairobi & Express Countrywide)'}
                  </p>
                  {isPickup && order.pickupEstimatedTime && (
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono block mt-0.5">
                      ⏱️ Ready Time: {order.pickupEstimatedTime}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Acquired Assets & Items Ledger */}
        <div className="py-6 border-b border-gray-100 dark:border-gray-850">
          <span className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest font-mono mb-4">
            Acquired Products & Assets Ledger
          </span>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 font-mono text-[9px] font-bold uppercase tracking-wider pb-2">
                  <th className="py-2.5">Item Description</th>
                  <th className="py-2.5 text-center">Type</th>
                  <th className="py-2.5 text-center">Qty</th>
                  <th className="py-2.5 text-right">Unit Price</th>
                  <th className="py-2.5 text-right">Line Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-850">
                {order.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                    <td className="py-3.5 pr-3">
                      <div className="font-bold text-gray-900 dark:text-white text-xs">
                        {item.name}
                      </div>
                      {item.selectedVariations && Object.keys(item.selectedVariations).length > 0 && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                          {Object.entries(item.selectedVariations)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' • ')}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-mono text-[9px] uppercase font-bold">
                        {item.type || 'Physical'}
                      </span>
                    </td>
                    <td className="py-3.5 text-center font-mono font-bold text-gray-800 dark:text-gray-200">
                      x{item.quantity}
                    </td>
                    <td className="py-3.5 text-right font-mono text-gray-600 dark:text-gray-300">
                      {formatPrice(item.price, currency)}
                    </td>
                    <td className="py-3.5 text-right font-mono font-bold text-gray-950 dark:text-white">
                      {formatPrice(item.price * item.quantity, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Totals Ledger & Calculation Summary */}
        <div className="pt-6 flex flex-col sm:flex-row justify-between items-start gap-6">
          <div className="space-y-2 max-w-sm">
            <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
              <span className="text-[10px] font-bold text-emerald-900 dark:text-emerald-300 uppercase font-mono block">
                M-PESA Business Paybill Settlement
              </span>
              <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                Paybill: <strong className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{mpesaPaybill}</strong> • Account No: <strong className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{mpesaAccountNumber}</strong>
                <br />
                Account Name: <strong className="font-semibold text-gray-900 dark:text-white">{mpesaAccountName}</strong>
              </p>
              {order.paymentReference && (
                <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-850 font-mono text-[10.5px] space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-emerald-800 dark:text-emerald-300 font-bold">Prepaid M-Pesa Code:</span>
                    <strong className="text-emerald-700 dark:text-emerald-400 font-black">{order.paymentReference}</strong>
                  </div>
                  {(order.mpesaPhone || (order.paymentMethod === 'mpesa' && order.phone)) && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Payer Mobile:</span>
                      <strong className="text-gray-900 dark:text-white">{order.mpesaPhone || order.phone}</strong>
                    </div>
                  )}
                  {order.paidAt && (
                    <div className="flex justify-between text-[9.5px] text-gray-500">
                      <span>Settled:</span>
                      <span>{order.paidAt}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {order.customNote && (
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 text-xs italic text-gray-600 dark:text-gray-400">
                &ldquo;{order.customNote}&rdquo;
              </div>
            )}
          </div>

          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-gray-500 dark:text-gray-400 font-medium">
              <span>Subtotal (Excl. Tax):</span>
              <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                {formatPrice(subtotalExclTax, currency)}
              </span>
            </div>
            <div className="flex justify-between text-gray-500 dark:text-gray-400 font-medium">
              <span>VAT Tax (16% Included):</span>
              <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                {formatPrice(taxAmount, currency)}
              </span>
            </div>
            {shippingFee > 0 && (
              <div className="flex justify-between text-gray-500 dark:text-gray-400 font-medium">
                <span>Shipping / Delivery:</span>
                <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                  {formatPrice(shippingFee, currency)}
                </span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                <span>Promotional Discount:</span>
                <span className="font-mono">
                  -{formatPrice(discountAmount, currency)}
                </span>
              </div>
            )}
            <div className="border-t-2 border-indigo-600 dark:border-indigo-500 pt-3 flex justify-between font-black text-gray-950 dark:text-white text-sm">
              <span className="font-display uppercase tracking-tight">GRAND TOTAL:</span>
              <span className="font-mono text-base text-indigo-600 dark:text-indigo-400">
                {formatPrice(order.total, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Legal & Compliance Notice */}
        <div className="mt-10 border-t border-dashed border-gray-200 dark:border-gray-800 pt-6 text-[10px] font-mono text-gray-400 dark:text-gray-500 text-center leading-relaxed">
          <p>
            This acquisition receipt is certified under 256-bit SSL encryption. All standard catalog hardware items carry comprehensive structural warranties.
          </p>
          <p className="mt-1 font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            ◆ ROPENIX INVESTMENTS LTD • ROPENIX COLLECTIONS SYSTEM TERMINAL REGISTERED ◆
          </p>
        </div>
      </div>
    </div>
  );
}

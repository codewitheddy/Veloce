'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Smartphone, CheckCircle, ArrowRight, Loader2, Zap, Clock } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { calculateTax, reserveInventory, initiateMpesaStkPush } from '@/lib/api';
import { TaxCalculationResult } from '@/types';

export default function CheckoutPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { items, currency, formatPrice, getRawSubtotal, reservationToken, setReservation, clearCart } = useCartStore();

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [countryCode, setCountryCode] = useState<'KE' | 'UG' | 'TZ' | 'RW'>('KE');
  const [shippingAddress, setShippingAddress] = useState('');
  
  const [taxData, setTaxData] = useState<TaxCalculationResult | null>(null);
  const [isLoadingTax, setIsLoadingTax] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [stkSent, setStkSent] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const rawSubtotal = mounted ? getRawSubtotal() : 0;

  // Re-calculate VAT on country change or subtotal change
  useEffect(() => {
    if (!mounted || items.length === 0) return;

    const compute = async () => {
      setIsLoadingTax(true);
      try {
        const res = await calculateTax({
          country_code: countryCode,
          subtotal: rawSubtotal,
          shipping_fee: countryCode === 'KE' ? 350 : 1200,
        });
        setTaxData(res);
      } catch (err) {
        console.error('Tax compute error:', err);
      } finally {
        setIsLoadingTax(false);
      }
    };

    compute();
  }, [mounted, countryCode, rawSubtotal, items.length]);

  // Handle Order Placement & M-Pesa STK Push
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone || items.length === 0) return;

    setIsProcessingPayment(true);
    const generatedOrderId = `ORD-${Date.now().toString().slice(-6)}`;
    setOrderId(generatedOrderId);

    try {
      // 1. Atomic Redis Inventory Hold (15 minutes)
      let token = reservationToken;
      if (!token) {
        const reserveRes = await reserveInventory(
          `cart_${Date.now()}`,
          items.map((i) => ({ sku: i.product.sku, quantity: i.quantity }))
        );
        if (reserveRes.success) {
          token = reserveRes.reservation_token;
          setReservation(token!, 900);
        }
      }

      // 2. Initiate M-Pesa STK Push
      const totalAmount = taxData ? taxData.total_amount : rawSubtotal;
      const stkRes = await initiateMpesaStkPush({
        order_id: generatedOrderId,
        phone: customerPhone,
        amount: totalAmount,
        reservation_token: token || undefined,
      });

      if (stkRes.success) {
        setStkSent(true);
        setOrderComplete(true);
        clearCart();
      }
    } catch (error) {
      console.error('Payment checkout error:', error);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (!mounted) return null;

  if (items.length === 0 && !orderComplete) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">No Items to Checkout</h2>
        <Link href="/" className="text-sm font-bold text-indigo-600">
          Browse Catalog
        </Link>
      </div>
    );
  }

  if (orderComplete) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-md shadow-emerald-100 animate-bounce">
          <CheckCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-emerald-600 uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Payment Prompt Dispatched
          </span>
          <h1 className="text-3xl font-black font-display text-slate-900">
            Order #{orderId} Received
          </h1>
          <p className="text-sm text-slate-500 font-light max-w-md mx-auto">
            Please enter your M-Pesa PIN on your phone (<strong>{customerPhone}</strong>) to complete payment. Your stock is reserved.
          </p>
        </div>

        <div className="pt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 text-white font-bold text-sm hover:bg-indigo-600 transition-colors shadow-md"
          >
            Return to Storefront
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black font-display text-slate-900 tracking-tight">
          Secure Express Checkout
        </h1>
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
          <Clock className="w-3.5 h-3.5" />
          <span>15-Minute Atomic Stock Hold Active</span>
        </div>
      </div>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Shipping & Contact Form */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-8 shadow-xs space-y-6">
          <h3 className="text-lg font-black font-display text-slate-900">
            Contact & Regional Delivery Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. David Mwangi"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                Delivery Country (VAT Auto-Lookup)
              </label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="KE">Kenya (16% Flat VAT)</option>
                <option value="UG">Uganda (18% Flat VAT)</option>
                <option value="TZ">Tanzania (18% Flat VAT)</option>
                <option value="RW">Rwanda (18% Flat VAT)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                M-Pesa / Delivery Phone *
              </label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0712 345 678"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-slate-400 uppercase">
              Street / Building Address *
            </label>
            <textarea
              required
              rows={2}
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              placeholder="Apartment/Office, Street name, City"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Payment & Tax Breakdown Box */}
        <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-md space-y-6">
          <h3 className="text-lg font-black font-display text-slate-900">
            Payment & Breakdown
          </h3>

          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono font-bold text-slate-900">
                {formatPrice(rawSubtotal)}
              </span>
            </div>

            <div className="flex justify-between">
              <span>VAT ({taxData?.vat_percentage || 16}%)</span>
              <span className="font-mono text-slate-900">
                {taxData ? formatPrice(taxData.vat_amount) : 'Calculating...'}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Shipping Fee</span>
              <span className="font-mono text-slate-900">
                {taxData ? formatPrice(taxData.shipping_fee) : '...'}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex justify-between items-baseline">
            <span className="text-base font-bold text-slate-900">Grand Total</span>
            <span className="text-2xl font-black font-mono text-slate-900">
              {taxData ? formatPrice(taxData.total_amount) : formatPrice(rawSubtotal)}
            </span>
          </div>

          <button
            type="submit"
            disabled={isProcessingPayment}
            className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 transition-all cursor-pointer"
          >
            {isProcessingPayment ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Initiating STK Push...
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4" /> Pay with M-Pesa STK Push
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

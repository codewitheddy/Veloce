/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Copy,
  Check,
  CreditCard,
  ClipboardPaste,
  Sparkles,
  Info
} from 'lucide-react';
import { CurrencyType, formatPrice } from '../lib/currency';
import { parseMpesaInput } from '../lib/mpesaParser';

interface CustomerPaymentClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId?: string;
  orderTotal?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  currency?: CurrencyType;
  onClaimSuccess?: (data: { mpesaCode: string; amount: number; submissionId?: string }) => void;
  onNavigateToOrders?: () => void;
}

export default function CustomerPaymentClaimModal({
  isOpen,
  onClose,
  orderId = '',
  orderTotal = 0,
  customerName = '',
  customerEmail = '',
  customerPhone = '',
  currency = 'KSh',
  onClaimSuccess,
  onNavigateToOrders,
}: CustomerPaymentClaimModalProps) {
  const safeOrderId = typeof orderId === 'string' && orderId.trim().length > 0 ? orderId.trim() : '';
  const displayOrderId = safeOrderId ? safeOrderId.slice(0, 10).toUpperCase() : 'PENDING';

  // Form State
  const [phone, setPhone] = useState(customerPhone || '');
  const [amount, setAmount] = useState(String(orderTotal || 0));
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState<{ mpesaCode: string; message: string } | null>(null);

  // Smart SMS Paste / Direct Code State
  const [pasteInput, setPasteInput] = useState('');
  const [extractedCode, setExtractedCode] = useState('');
  const [extractedAmount, setExtractedAmount] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-sync customerPhone and orderTotal when props update
  useEffect(() => {
    if (customerPhone) setPhone(customerPhone);
    if (orderTotal) setAmount(String(orderTotal));
  }, [customerPhone, orderTotal]);

  if (!isOpen) return null;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGoToOrders = () => {
    onClose();
    if (onNavigateToOrders) {
      onNavigateToOrders();
    } else {
      window.dispatchEvent(new CustomEvent('veloce_navigate_tab', { detail: 'user' }));
    }
  };

  // Smart SMS text extraction handler
  const handlePasteInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const raw = e.target.value;
    setPasteInput(raw);
    setErrorMsg('');

    const parsed = parseMpesaInput(raw);
    if (parsed.code) {
      setExtractedCode(parsed.code);
      if (parsed.amount) {
        setExtractedAmount(parsed.amount);
        setAmount(String(parsed.amount));
      }
    } else {
      // Direct manual code typing fallback
      const cleanDirect = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
      setExtractedCode(cleanDirect);
    }
  };

  // Submit Payment Claim / Extracted Code
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanCode = (extractedCode || pasteInput).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

    if (!cleanCode || cleanCode.length < 8) {
      setErrorMsg('Please enter or paste a valid 10-character M-Pesa confirmation code (e.g. SGH7A1B2C3).');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/payments/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: safeOrderId || undefined,
          mpesaCode: cleanCode,
          customerName: customerName || undefined,
          customerEmail: customerEmail || undefined,
          phoneNumber: (phone || '').trim() || undefined,
          amount: parseFloat(amount) || orderTotal || 0,
          notes: (notes || (extractedAmount ? `Auto-extracted from SMS: KSh ${extractedAmount}` : '')).trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit payment verification.');
      }

      window.dispatchEvent(
        new CustomEvent('veloce_payment_submitted', {
          detail: {
            orderId: safeOrderId,
            mpesaCode: data.mpesaCode || cleanCode,
            amount: parseFloat(amount) || orderTotal || 0,
            isPaid: false,
          },
        })
      );

      setSuccessData({
        mpesaCode: data.mpesaCode || cleanCode,
        message: data.message || 'Your payment reference has been submitted. Our accounts desk is matching it with the statement.',
      });

      if (onClaimSuccess) {
        onClaimSuccess({
          mpesaCode: data.mpesaCode || cleanCode,
          amount: parseFloat(amount) || orderTotal || 0,
          submissionId: data.submissionId,
        });
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred while submitting your payment reference.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100 my-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                  Confirm M-Pesa Payment
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Order <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">#{displayOrderId}</span> • Total: <strong className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{formatPrice(orderTotal, currency)}</strong>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 sm:p-6">
            {successData ? (
              /* Success View */
              <div className="text-center py-2 space-y-4 sm:space-y-5">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 shadow-sm animate-in zoom-in-95 duration-300">
                  <CheckCircle2 className="w-9 h-9" />
                </div>

                <div>
                  <h4 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    Payment Code Submitted!
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
                    M-Pesa reference <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-sm bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">{successData.mpesaCode}</strong> has been received and queued for matching with our Paybill statement.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-850/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 text-xs text-left space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Next Steps</span>
                  </div>
                  <div className="space-y-1.5 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Our accounts desk verifies the code against Paybill deposits.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Your order status automatically updates to Paid &amp; Processing.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Official invoice &amp; dispatch tracking enqueued to <strong>{customerEmail || 'your email'}</strong>.</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleGoToOrders}
                    className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>View &amp; Track Order</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-11 px-5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Payment Submission Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Paybill Instructions Box (Fast 1-Click Copy) */}
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/50 rounded-2xl p-3.5 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 text-[11px]">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Lipa na M-PESA Paybill Details
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                      Paybill: 303030
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Paybill */}
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between shadow-3xs">
                      <div>
                        <span className="text-[9px] text-slate-400 block">Business No</span>
                        <strong className="text-emerald-700 dark:text-emerald-400 font-mono text-xs tracking-wider">303030</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy('303030', 'paybill')}
                        className="text-slate-400 hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Copy Paybill"
                      >
                        {copiedField === 'paybill' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Account */}
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between shadow-3xs">
                      <div>
                        <span className="text-[9px] text-slate-400 block">Account No</span>
                        <strong className="text-emerald-700 dark:text-emerald-400 font-mono text-xs tracking-wider">{safeOrderId.toUpperCase() || '2047728455'}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(safeOrderId.toUpperCase() || '2047728455', 'account')}
                        className="text-slate-400 hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Copy Account"
                      >
                        {copiedField === 'account' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                    💬 Account Name on M-Pesa: <strong className="font-semibold text-emerald-950 dark:text-white">ROPENIX INVESTMENTS LTD</strong>
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in-50">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Smart SMS Paste / Direct Code Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <ClipboardPaste className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Paste Full Safaricom SMS or Enter Code</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    {extractedCode && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <Sparkles className="w-3 h-3" />
                        Detected: {extractedCode}
                      </span>
                    )}
                  </div>

                  <textarea
                    rows={2}
                    placeholder="Paste your full M-Pesa SMS receipt here (e.g. SGH7XYZ123 Confirmed. Ksh1,500 sent to...)"
                    value={pasteInput}
                    onChange={handlePasteInputChange}
                    className="w-full bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl p-3 text-xs text-slate-900 dark:text-white transition-colors placeholder:text-slate-400 resize-none font-sans"
                  />

                  {extractedCode ? (
                    <div className="mt-2 p-2.5 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-slate-700 dark:text-slate-300">
                          Parsed Code: <strong className="font-mono text-emerald-700 dark:text-emerald-400 font-bold uppercase">{extractedCode}</strong>
                          {extractedAmount ? ` (KSh ${extractedAmount.toLocaleString('en-KE')})` : ''}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-1">
                      You can paste your entire Safaricom SMS; our system automatically parses the 10-character code and amount.
                    </span>
                  )}
                </div>

                {/* Phone & Amount Inputs */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Phone Number Used
                    </label>
                    <input
                      type="tel"
                      placeholder="07XX XXX XXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-10 w-full bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-600 rounded-xl px-3 text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Amount Paid ({currency})
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-10 w-full bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-600 rounded-xl px-3 text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Optional Note */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Optional Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Paid via family member's phone (Jane Doe)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-10 w-full bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || (!extractedCode && pasteInput.length < 8)}
                  className="w-full h-11.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20 active:scale-[0.99] mt-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Payment Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Payment Reference</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

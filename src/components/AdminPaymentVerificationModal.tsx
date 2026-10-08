/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, CheckCircle2, AlertTriangle, Smartphone, RefreshCw, Send,
  ShieldCheck, Loader2, DollarSign, MessageSquare, AlertCircle
} from 'lucide-react';
import { CurrencyType, formatPrice } from '../lib/currency';
import { getAuthHeaders } from '../utils/authTokens';

interface AdminPaymentVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId?: string;
  currency?: CurrencyType;
  onPaymentVerified?: (orderId?: string, status?: 'paid' | 'unpaid' | 'partial') => void;
}

export default function AdminPaymentVerificationModal({
  isOpen,
  onClose,
  orderId,
  currency = 'KSh',
  onPaymentVerified,
}: AdminPaymentVerificationModalProps) {
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verifiedAmount, setVerifiedAmount] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'partial'>('approve');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPendingPayments();
    }
  }, [isOpen, orderId]);

  const fetchPendingPayments = async () => {
    setIsLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/payments/admin/pending', {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.pending)) {
        setPendingList(data.pending);
        if (orderId) {
          const match = data.pending.find((p: any) => p.order_id === orderId);
          if (match) {
            setSelectedSubmission(match);
            setVerifiedAmount(String(match.amount_claimed || match.total || ''));
          } else if (data.pending.length > 0) {
            setSelectedSubmission(data.pending[0]);
            setVerifiedAmount(String(data.pending[0].amount_claimed || data.pending[0].total || ''));
          }
        } else if (data.pending.length > 0) {
          setSelectedSubmission(data.pending[0]);
          setVerifiedAmount(String(data.pending[0].amount_claimed || data.pending[0].total || ''));
        }
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to load pending payments.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAction = async (action: 'approve' | 'reject' | 'partial') => {
    if (!selectedSubmission) return;
    const targetOrderId = selectedSubmission.order_id;
    setIsProcessing(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/payments/admin/verify', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          submissionId: selectedSubmission.id,
          orderId: targetOrderId,
          action,
          verifiedAmount: parseFloat(verifiedAmount) || selectedSubmission.amount_claimed,
          adminNotes: adminNotes.trim(),
          mpesaCode: selectedSubmission.mpesa_receipt_code,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to verify payment.');
      }

      const nextStatus: 'paid' | 'unpaid' | 'partial' = action === 'approve' ? 'paid' : (action === 'partial' ? 'partial' : 'unpaid');
      setStatusMsg({ type: 'success', text: data.message || `Payment marked as ${action.toUpperCase()}.` });
      fetchPendingPayments();
      if (onPaymentVerified) {
        onPaymentVerified(targetOrderId, nextStatus);
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Verification action failed.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResendPaybill = async (targetOrderId: string) => {
    try {
      const res = await fetch(`/api/payments/admin/orders/${targetOrderId}/resend-paybill`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: data.message });
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to resend paybill.' });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">M-Pesa Payment Verification Desk</h3>
                <p className="text-xs text-slate-400">
                  {pendingList.length} payment claim{pendingList.length === 1 ? '' : 's'} awaiting clearance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchPendingPayments}
                disabled={isLoading}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {statusMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  statusMsg.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                }`}
              >
                {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{statusMsg.text}</span>
              </div>
            )}

            {isLoading && pendingList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-400" />
                <p className="text-xs">Loading pending claims...</p>
              </div>
            ) : pendingList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-3">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400" />
                <h4 className="text-base font-bold text-white">All Payments Verified!</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  There are currently no customer payment submissions waiting for admin verification.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* List Column */}
                <div className="md:col-span-1 space-y-2 border-r border-slate-800 pr-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Pending Claims
                  </span>
                  {pendingList.map((item) => {
                    const isSelected = selectedSubmission?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedSubmission(item);
                          setVerifiedAmount(String(item.amount_claimed || item.total || ''));
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                            : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-mono font-bold text-emerald-400 text-xs">{item.mpesa_receipt_code}</span>
                          <span className="text-[10px] text-slate-400 font-sans">
                            {formatPrice(item.amount_claimed || item.total || 0, currency)}
                          </span>
                        </div>
                        <p className="text-xs font-semibold truncate text-slate-200">{item.customer_name || 'Customer'}</p>
                        <p className="text-[10px] text-slate-400 truncate">Order: {item.order_id}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Details & Actions Column */}
                {selectedSubmission && (
                  <div className="md:col-span-2 space-y-4">
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] uppercase text-emerald-400 font-bold tracking-wider">M-Pesa Reference</span>
                          <h4 className="font-mono text-xl font-extrabold text-emerald-400 tracking-wider">
                            {selectedSubmission.mpesa_receipt_code}
                          </h4>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase text-slate-400 font-bold">Order Amount</span>
                          <p className="text-lg font-bold text-white">
                            {formatPrice(selectedSubmission.total || selectedSubmission.amount_claimed || 0, currency)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-800 text-slate-300">
                        <div>
                          <span className="text-slate-500 block">Customer</span>
                          <strong className="text-slate-100">{selectedSubmission.customer_name || 'Customer'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Phone</span>
                          <strong className="text-slate-100">{selectedSubmission.phone_number || 'N/A'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Email</span>
                          <strong className="text-slate-100">{selectedSubmission.customer_email || 'N/A'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Order Reference</span>
                          <strong className="text-indigo-400 font-mono">{selectedSubmission.order_id}</strong>
                        </div>
                      </div>

                      {selectedSubmission.notes && (
                        <div className="text-xs bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-slate-400 italic">
                          "{selectedSubmission.notes}"
                        </div>
                      )}
                    </div>

                    {/* Verification Inputs */}
                    <div className="space-y-3 bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
                      <h5 className="text-xs font-bold uppercase text-slate-300 tracking-wider">Verification Controls</h5>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Verified Amount ({currency})
                          </label>
                          <input
                            type="number"
                            value={verifiedAmount}
                            onChange={(e) => setVerifiedAmount(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Notes / Reason for Issue
                          </label>
                          <input
                            type="text"
                            placeholder="Optional verification note"
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-3 gap-2 pt-2">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleVerifyAction('approve')}
                          className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Send Receipt</span>
                        </button>

                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleVerifyAction('partial')}
                          className="py-2.5 px-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Flag Partial Payment</span>
                        </button>

                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleVerifyAction('reject')}
                          className="py-2.5 px-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject Code</span>
                        </button>
                      </div>

                      <div className="pt-2 flex justify-between items-center text-[11px] text-slate-400">
                        <span>Need to resend instructions?</span>
                        <button
                          type="button"
                          onClick={() => handleResendPaybill(selectedSubmission.order_id)}
                          className="text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>Resend Paybill Email</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

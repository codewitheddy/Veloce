import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, AlertCircle, Ban, UserCheck, Shield, ArrowLeft } from 'lucide-react';
import { emailService } from '../services/api';

interface UnsubscribeViewProps {
  initialEmail?: string;
  onBackToStore?: () => void;
}

export const UnsubscribeView: React.FC<UnsubscribeViewProps> = ({ initialEmail, onBackToStore }) => {
  const [email, setEmail] = useState('');
  const [isUnsubscribed, setIsUnsubscribed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [unsubReason, setUnsubReason] = useState('Too many emails');
  const [optOutReviewRequests, setOptOutReviewRequests] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('veloce_opt_out_review_requests') === 'true';
    }
    return false;
  });

  useEffect(() => {
    // Determine email from URL query or initial props
    const searchParams = new URLSearchParams(window.location.search);
    const queryEmail = searchParams.get('email') || initialEmail || '';
    if (queryEmail) {
      const clean = queryEmail.trim();
      setEmail(clean);
      checkStatus(clean);

      if (typeof window !== 'undefined' && window.localStorage) {
        const emailSpecificOptOut = localStorage.getItem(`veloce_opt_out_review_requests_${clean.toLowerCase()}`);
        if (emailSpecificOptOut !== null) {
          setOptOutReviewRequests(emailSpecificOptOut === 'true');
        } else {
          try {
            const raw = localStorage.getItem('veloce_review_opt_out_emails');
            if (raw) {
              const list: string[] = JSON.parse(raw);
              if (Array.isArray(list) && list.includes(clean.toLowerCase())) {
                setOptOutReviewRequests(true);
              }
            }
          } catch (e) {
            // ignore
          }
        }
      }
    }
  }, [initialEmail]);

  const handleOptOutReviewToggle = async (checked: boolean) => {
    setOptOutReviewRequests(checked);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('veloce_opt_out_review_requests', String(checked));

      if (email && email.includes('@')) {
        const cleanEmail = email.toLowerCase().trim();
        localStorage.setItem(`veloce_opt_out_review_requests_${cleanEmail}`, String(checked));

        try {
          const listRaw = localStorage.getItem('veloce_review_opt_out_emails');
          let list: string[] = listRaw ? JSON.parse(listRaw) : [];
          if (!Array.isArray(list)) list = [];

          if (checked) {
            if (!list.includes(cleanEmail)) list.push(cleanEmail);
          } else {
            list = list.filter((e) => e !== cleanEmail);
          }
          localStorage.setItem('veloce_review_opt_out_emails', JSON.stringify(list));
        } catch (e) {
          // ignore
        }

        if (checked) {
          try {
            await fetch('/api/review-requests/unsubscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: cleanEmail }),
            });
          } catch (err) {
            // silent catch
          }
        }
      }
    }

    setMessage({
      type: 'success',
      text: checked
        ? 'Opted out of post-delivery product review requests on this device.'
        : 'Re-enabled post-delivery product review requests on this device.',
    });
  };

  const checkStatus = async (targetEmail: string) => {
    if (!targetEmail || !targetEmail.includes('@')) return;
    setLoading(true);
    try {
      const res = await emailService.getUnsubscribeStatus(targetEmail);
      setIsUnsubscribed(res.unsubscribed);
    } catch (err) {
      console.error('Failed to check unsubscribe status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await emailService.unsubscribe(email, unsubReason);
      if (res.success) {
        setIsUnsubscribed(true);
        setMessage({
          type: 'success',
          text: `You have successfully unsubscribed (${email}) from promotional marketing communications.`,
        });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to process unsubscribe request.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'An error occurred while updating your preferences.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResubscribe = async () => {
    if (!email || !email.includes('@')) return;
    setLoading(true);
    setMessage(null);

    try {
      const res = await emailService.resubscribe(email);
      if (res.success) {
        setIsUnsubscribed(false);
        setMessage({
          type: 'success',
          text: `Welcome back! (${email}) has been re-subscribed to Veloce Kenya updates & exclusive discounts.`,
        });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to re-subscribe.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'An error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-gray-50/50">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden animate-fade-in">
        {/* Header Banner */}
        <div className="bg-slate-900 text-white p-6 relative">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 text-indigo-400">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">Communication Preferences</h2>
              <p className="text-xs text-slate-300">Manage your Veloce Kenya email subscriptions</p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 flex flex-col gap-5">
          {message && (
            <div
              className={`p-4 rounded-xl text-xs font-medium flex items-start gap-2.5 ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {isUnsubscribed === true ? (
            <div className="bg-rose-50/60 border border-rose-100 p-5 rounded-xl text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <Ban className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm">Unsubscribed from Marketing Emails</h3>
              <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
                <strong className="text-gray-800">{email}</strong> will no longer receive promotional marketing broadcasts, price drops, or newsletters from this site.
              </p>
              
              <div className="w-full pt-3 border-t border-rose-100/80 mt-1 flex flex-col gap-3">
                <div className="p-3.5 rounded-xl bg-white border border-rose-200 text-left flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="optOutReviewRequestsUnsub"
                    checked={optOutReviewRequests}
                    onChange={(e) => handleOptOutReviewToggle(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="optOutReviewRequestsUnsub" className="text-xs text-slate-700 cursor-pointer select-none">
                    <span className="font-bold block text-slate-900">Opt-out of product review requests</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Stop post-delivery email reminders asking to rate or review recent purchases.
                    </span>
                  </label>
                </div>

                <button
                  onClick={handleResubscribe}
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>Re-subscribe to Marketing Updates</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUnsubscribe} className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 font-mono">
                  Your Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setIsUnsubscribed(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 font-mono">
                  Reason for Unsubscribing (Optional)
                </label>
                <select
                  value={unsubReason}
                  onChange={(e) => setUnsubReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Too many emails">Receiving too many emails</option>
                  <option value="Not relevant">Content is no longer relevant</option>
                  <option value="Did not sign up">I didn't sign up for this list</option>
                  <option value="Other">Other reason</option>
                </select>
              </div>

              {/* Opt-out of product review requests checkbox */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="optOutReviewRequests"
                  checked={optOutReviewRequests}
                  onChange={(e) => handleOptOutReviewToggle(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="optOutReviewRequests" className="text-xs text-slate-700 cursor-pointer select-none">
                  <span className="font-bold block text-slate-900">Opt-out of product review requests</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Stop post-delivery email reminders asking to rate or review recent purchases. Saved in your local preferences.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Ban className="h-4 w-4" />
                <span>{loading ? 'Processing...' : 'Unsubscribe from Promotional Emails'}</span>
              </button>
            </form>
          )}

          {/* Transactional Emails Disclaimer */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 flex items-start gap-2.5 text-[11px] text-gray-500">
            <Shield className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
            <span>
              <strong>Note:</strong> You will still receive essential order confirmations, shipping updates, and password reset security tokens required for your account.
            </span>
          </div>

          {onBackToStore && (
            <button
              onClick={onBackToStore}
              className="mt-2 text-xs font-bold text-gray-500 hover:text-gray-900 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Veloce Store</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnsubscribeView;

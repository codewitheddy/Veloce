/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Tag,
  Copy,
  Check,
  Send,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Inbox,
  Lock,
} from 'lucide-react';
import { newsletterService } from '../services/api';
import { NewsletterSubscribeResponse, Order } from '../types';

interface NewsletterSubscriptionProps {
  variant?: 'card' | 'compact' | 'banner';
  title?: string;
  subtitle?: string;
  source?: string;
  className?: string;
  onSubscribeSuccess?: (res: NewsletterSubscribeResponse) => void;
  onTriggerEmailToast?: (mockOrder: Order, status: string) => void;
  onTriggerCustomEmail?: (subject: string, body: string, status?: string) => void;
}

const AVAILABLE_TOPICS = [
  { id: 'blueprints', label: 'Workspace Blueprints & CAD' },
  { id: 'drops', label: 'Limited Hardware Drops' },
  { id: 'ergonomics', label: 'Ergonomics & Tech Guides' },
  { id: 'discounts', label: 'VIP Member Allocations' },
];

export default function NewsletterSubscription({
  variant = 'card',
  title = 'Subscribe to Veloce Insights',
  subtitle = 'Join 12,000+ creators, architects, and workspace engineers receiving our monthly engineering white papers, analog desk schematics, and VIP release allocations. No spam, ever.',
  source = 'Website Newsletter Component',
  className = '',
  onSubscribeSuccess,
  onTriggerEmailToast,
  onTriggerCustomEmail,
}: NewsletterSubscriptionProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([
    'Workspace Blueprints & CAD',
    'Limited Hardware Drops',
  ]);
  const [showPreferences, setShowPreferences] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<NewsletterSubscribeResponse | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [unsubscribedPrompt, setUnsubscribedPrompt] = useState(false);

  const toggleTopic = (topicLabel: string) => {
    if (selectedTopics.includes(topicLabel)) {
      if (selectedTopics.length > 1) {
        setSelectedTopics(selectedTopics.filter((t) => t !== topicLabel));
      }
    } else {
      setSelectedTopics([...selectedTopics, topicLabel]);
    }
  };

  const handleSubscribe = async (e: React.FormEvent, forceResubscribe: boolean = false) => {
    e.preventDefault();
    if (!email || !email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await newsletterService.subscribe({
        email,
        firstName: firstName.trim() || undefined,
        preferences: selectedTopics,
        source,
        forceResubscribe,
      });

      if (res.unsubscribed && res.requiresConfirmation && !forceResubscribe) {
        setUnsubscribedPrompt(true);
        setIsLoading(false);
        return;
      }

      if (res.success) {
        setResponse(res);
        setUnsubscribedPrompt(false);
        if (onSubscribeSuccess) {
          onSubscribeSuccess(res);
        }

        // Trigger local visual email toast so user sees immediate feedback
        const displayName = firstName.trim() || email.split('@')[0];
        const capitalizedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
        const welcomeCode = res.couponCode || 'WELCOME10';

        if (onTriggerCustomEmail) {
          onTriggerCustomEmail(
            `🎉 Welcome to Veloce Insights (${welcomeCode})`,
            `Hi ${capitalizedName},\n\nThank you for subscribing to Veloce Insights! Your 10% VIP coupon code (${welcomeCode}) has been activated and sent to ${email}.\n\nBest regards,\nVeloce Editorial Desk`,
            'welcome-email'
          );
        } else if (onTriggerEmailToast) {
          const mockOrder: Order = {
            id: `welcome-${Date.now().toString(36)}`,
            customerName: capitalizedName,
            customerEmail: email,
            items: [
              {
                productId: 'newsletter-welcome',
                name: 'Veloce Insights VIP Subscription',
                quantity: 1,
                price: 0,
                selectedVariations: {},
                type: 'digital'
              }
            ],
            total: 0,
            status: 'completed',
            paymentMethod: 'mpesa',
            shippingAddress: 'Direct Email Dispatch',
            date: new Date().toISOString().split('T')[0],
          };
          onTriggerEmailToast(mockOrder, 'newsletter-welcome');
        }
      } else {
        setError(res.message || res.error || 'Failed to complete subscription. Please try again.');
      }
    } catch (err: any) {
      console.error('[Newsletter Component Error]:', err);
      setError(err?.response?.data?.error || err?.message || 'Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const handleReset = () => {
    setEmail('');
    setFirstName('');
    setResponse(null);
    setError(null);
    setUnsubscribedPrompt(false);
  };

  // =========================================================================
  // Compact Variant (e.g. for Footers or small widget areas)
  // =========================================================================
  if (variant === 'compact') {
    return (
      <div className={`w-full ${className}`}>
        {response ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-emerald-300"
          >
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-200">Subscribed Successfully!</p>
                <p className="text-[11px] text-emerald-300/90 mt-0.5">
                  Welcome email dispatched to <strong className="text-white">{email}</strong>.
                </p>
                <div className="mt-2.5 flex items-center gap-2 bg-emerald-900/60 px-2.5 py-1.5 rounded-lg border border-emerald-700/50">
                  <Tag className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="font-mono text-xs font-bold text-white tracking-wider">
                    {response.couponCode || 'WELCOME10'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCoupon(response.couponCode || 'WELCOME10')}
                    className="ml-auto text-[10px] bg-emerald-700/80 hover:bg-emerald-600 px-2 py-0.5 rounded text-white font-medium flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCode ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedCode ? 'Copied' : 'Copy 10% Off'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={(e) => handleSubscribe(e)} className="flex flex-col gap-2">
            <div className="relative flex items-center">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={isLoading}
                className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900/90 px-3.5 pr-24 text-xs text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="absolute right-1 h-8 rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 text-xs font-semibold text-white transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <span>Join</span>
                    <ArrowRight className="h-3 w-3" />
                  </>
                )}
              </button>
            </div>
            {error && <p className="text-[10px] text-rose-400">{error}</p>}
            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              <Lock className="h-2.5 w-2.5 text-gray-400" /> Free 10% welcome code on join. Zero spam.
            </p>
          </form>
        )}
      </div>
    );
  }

  // =========================================================================
  // Full Rich Card / Banner Variant (Hero / Editorial section)
  // =========================================================================
  return (
    <section className={`rounded-2xl bg-slate-900 p-6 sm:p-10 md:p-12 shadow-sm border border-slate-800 text-white ${className}`}>
      <div className="mx-auto max-w-2xl text-center">
        {/* VIP Insider Badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500 bg-indigo-900/60 px-3 py-1 text-[11px] font-mono font-bold tracking-widest text-indigo-200 uppercase mb-4 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
          <span>VELOCE INSIGHTS • VIP EDITORIAL</span>
        </div>

        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-3 text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
          {subtitle}
        </p>

        {/* State: Unsubscribed Confirmation Notice */}
        {unsubscribedPrompt && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 rounded-xl border border-amber-500/30 bg-amber-950/40 p-4 text-left text-amber-200"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-100 uppercase tracking-wide">
                  Previous Unsubscribe Detected
                </h4>
                <p className="text-xs text-amber-200/90 mt-1">
                  <strong>{email}</strong> was previously unsubscribed from marketing emails. Would you like to re-subscribe and receive the welcome discount code?
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleSubscribe(e, true)}
                    disabled={isLoading}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    <span>Confirm & Re-subscribe</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnsubscribedPrompt(false)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-gray-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* State: Success Feedback */}
        {response ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-8 rounded-2xl border border-emerald-500 bg-emerald-950 p-6 text-emerald-200 text-left shadow-md"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-emerald-500/20 p-2 text-emerald-400 shrink-0 mt-1">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-emerald-400 bg-emerald-900 px-2 py-0.5 rounded border border-emerald-700">
                  SUBSCRIPTION VERIFIED
                </span>
                <h3 className="text-base font-bold text-white mt-1.5">
                  Welcome to Veloce Insights!
                </h3>
                <p className="text-xs text-emerald-200 mt-1 leading-relaxed">
                  We've successfully registered <strong className="text-white font-semibold">{email}</strong>. An automated welcome email sequence containing your onboarding dossier and store guide has been dispatched via our secure cPanel mail exchanger.
                </p>

                {/* VIP Coupon Code Box */}
                <div className="mt-4 rounded-xl border border-emerald-500 bg-emerald-900 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Tag className="h-5 w-5 text-emerald-400" />
                    <div>
                      <span className="text-[10px] text-emerald-300 uppercase tracking-wider font-bold block">
                        Your 10% Welcome Voucher
                      </span>
                      <span className="font-mono text-lg font-black text-white tracking-widest">
                        {response.couponCode || 'WELCOME10'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyCoupon(response.couponCode || 'WELCOME10')}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copy Voucher Code</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Delivery Meta Notice */}
                <div className="mt-4 flex flex-wrap items-center justify-between text-[11px] text-emerald-300 pt-3 border-t border-emerald-800 gap-2">
                  <span className="flex items-center gap-1.5">
                    <Inbox className="h-3.5 w-3.5 text-emerald-400" /> Check your inbox for the full welcome email.
                  </span>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-white hover:text-emerald-300 underline font-medium cursor-pointer"
                  >
                    Subscribe another email
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* State: Subscription Form */
          <form onSubmit={(e) => handleSubscribe(e)} className="mt-6 flex flex-col gap-3.5">
            <div className="flex flex-col sm:flex-row justify-center gap-2.5">
              {/* Optional Name */}
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name (optional)"
                disabled={isLoading}
                className="h-11 w-full sm:w-44 rounded-xl border border-slate-700 bg-slate-800 px-3.5 text-xs sm:text-sm text-white placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
              />

              {/* Email Input */}
              <div className="relative flex-1">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  disabled={isLoading}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-800 pl-10 pr-4 text-xs sm:text-sm text-white placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="h-11 rounded-xl bg-white hover:bg-indigo-50 px-6 font-display text-xs sm:text-sm font-bold text-indigo-950 transition flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg disabled:opacity-60 shrink-0"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-indigo-900" />
                    <span>Subscribing...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 text-indigo-700" />
                    <span>Join Publication</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-rose-500/20 border border-rose-500/40 p-2.5 text-xs text-rose-200 flex items-center gap-2 text-left"
              >
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Preferences Toggle */}
            <div className="flex items-center justify-between text-xs text-indigo-200/80 px-1">
              <button
                type="button"
                onClick={() => setShowPreferences(!showPreferences)}
                className="flex items-center gap-1.5 text-[11px] text-indigo-300 hover:text-white transition font-medium cursor-pointer"
              >
                <span>Customize newsletter topics ({selectedTopics.length} selected)</span>
                {showPreferences ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              <span className="text-[11px] text-indigo-300/70 hidden sm:flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Instant 10% VIP Voucher on Join
              </span>
            </div>

            {/* Expanded Topics Selection */}
            <AnimatePresence>
              {showPreferences && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl border border-indigo-800/60 bg-indigo-900/40 p-3.5 text-left flex flex-wrap gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-300 w-full mb-1">
                      Choose Your Preferred Reading Streams:
                    </span>
                    {AVAILABLE_TOPICS.map((topic) => {
                      const isSelected = selectedTopics.includes(topic.label);
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => toggleTopic(topic.label)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs font-bold border border-indigo-400/40'
                              : 'bg-white/5 text-indigo-200 hover:bg-white/10 border border-indigo-800/40'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-indigo-200" />}
                          <span>{topic.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        )}

        {/* Footer Guarantee Trust Seals */}
        <div className="mt-8 pt-6 border-t border-indigo-800/40 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left sm:text-center text-[11px] text-indigo-200/70">
          <div className="flex items-center justify-center gap-2">
            <Tag className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>10% Welcome Voucher Included</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Mail className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <span>1–2 Curated Editions Monthly</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <span>Zero spam • 1-click unsubscribe</span>
          </div>
        </div>
      </div>
    </section>
  );
}

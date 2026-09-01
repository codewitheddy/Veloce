/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Mail, Phone, MapPin, Check, HelpCircle, ShieldAlert, Sparkles, ChevronRight, Truck, RotateCcw, Package, Search, Layers, Loader2, AlertCircle, Send } from 'lucide-react';
import { buildAdminCustomServiceRequestEmail, createEmailId, getCurrentTimestamp } from '../lib/emailNotifier';
import { EmailNotification } from './EmailToaster';
import { contactService } from '../services/api';

interface ContactAboutProps {
  onTriggerEmailToast?: (toast: EmailNotification) => void;
}

export default function ContactAbout({ onTriggerEmailToast }: ContactAboutProps) {
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryPhone, setInquiryPhone] = useState('');
  const [inquirySubject, setInquirySubject] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [hpField, setHpField] = useState(''); // Anti-spam honeypot
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // FAQ Category and Expand state
  const [faqCategory, setFaqCategory] = useState<'all' | 'shipping' | 'returns' | 'general'>('all');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>('shipping-1');
  const [faqSearchQuery, setFaqSearchQuery] = useState('');

  const faqData = [
    {
      id: 'shipping-1',
      category: 'shipping',
      categoryName: 'Shipping & Delivery',
      icon: Truck,
      q: 'How long does shipping take within Kenya & internationally?',
      a: 'Nairobi metro and regional Kenya deliveries arrive within 24 to 48 hours via local courier dispatch and M-Pesa tracking. International shipments are dispatched through DHL Express and typically arrive within 3 to 7 business days with real-time tracking.'
    },
    {
      id: 'shipping-2',
      category: 'shipping',
      categoryName: 'Shipping & Delivery',
      icon: Truck,
      q: 'How can I track my physical order status?',
      a: 'Once your order is processed, a unique courier tracking code is generated and saved directly in your User Account orders statement. You will also receive instant SMS and email notifications with live GPS routing updates.'
    },
    {
      id: 'shipping-3',
      category: 'shipping',
      categoryName: 'Shipping & Delivery',
      icon: Truck,
      q: 'Are delivery fees refundable if an item is returned?',
      a: 'Standard courier delivery fees are fully covered by Veloce if the return is due to a transit damage or manufacturing defect. For standard customer preference returns, outbound delivery fees are deducted from store credit.'
    },
    {
      id: 'returns-1',
      category: 'returns',
      categoryName: 'Returns & Refunds',
      icon: RotateCcw,
      q: 'What is Veloce’s standard return policy window?',
      a: 'We offer a 30-day money-back guarantee for all unblemished physical accessories and products returned in their original protective packaging.'
    },
    {
      id: 'returns-2',
      category: 'returns',
      categoryName: 'Returns & Refunds',
      icon: RotateCcw,
      q: 'How do I initiate a return or product exchange?',
      a: 'Navigate to your User Account portal, select the Order History section, click "Request Return", upload a quick photo of the item condition, and download your pre-paid courier return slip.'
    },
    {
      id: 'returns-3',
      category: 'returns',
      categoryName: 'Returns & Refunds',
      icon: RotateCcw,
      q: 'Are digital creator assets and Figma kits refundable?',
      a: 'Due to the instant nature of digital files (Figma grids, vector packs, software manuals), digital asset purchases are non-refundable once the secure download link has been extracted.'
    },
    {
      id: 'general-1',
      category: 'general',
      categoryName: 'General & Materials',
      icon: Package,
      q: 'What materials are used in Veloce physical products?',
      a: 'Our shelves, stands, and accessories are constructed exclusively from FSC-Certified solid American White Oak and Black Walnut. We finish surfaces with organic, non-toxic matte safflower oil to preserve natural grain without discoloration.'
    },
    {
      id: 'general-2',
      category: 'general',
      categoryName: 'General & Materials',
      icon: Package,
      q: 'Do your products come with a warranty or guarantee?',
      a: 'All Veloce physical products include a comprehensive 2-year manufacturer warranty covering structural integrity and craftsmanship defect protection with complimentary parts replacement.'
    }
  ];

  const categories = [
    { id: 'all', label: 'All Queries', icon: Layers },
    { id: 'shipping', label: 'Shipping & Delivery', icon: Truck },
    { id: 'returns', label: 'Returns & Refunds', icon: RotateCcw },
    { id: 'general', label: 'General & Materials', icon: Package },
  ];

  const filteredFAQs = faqData.filter((item) => {
    const matchesCategory = faqCategory === 'all' || item.category === faqCategory;
    const matchesSearch =
      !faqSearchQuery ||
      item.q.toLowerCase().includes(faqSearchQuery.toLowerCase()) ||
      item.a.toLowerCase().includes(faqSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessToast(false);

    try {
      const res = await contactService.sendMessage({
        name: inquiryName.trim(),
        email: inquiryEmail.trim(),
        phone: inquiryPhone.trim(),
        subject: inquirySubject.trim() || 'Customer Workspace Inquiry',
        message: inquiryMessage.trim(),
        hp_field: hpField,
      });

      if (res && res.success) {
        setSuccessToast(true);
        setSuccessMessage(res.message || 'Thank you! Your message has been sent successfully. We will get back to you shortly.');
        
        // Optional local toast for UI feedback
        if (onTriggerEmailToast) {
          const customerReceipt: EmailNotification = {
            id: createEmailId(),
            orderId: 'inquiry-' + Date.now().toString().slice(-4),
            customerName: inquiryName || 'Customer',
            customerEmail: inquiryEmail || 'customer@example.com',
            subject: `📩 Inquiry Sent - Veloce Customer Desk`,
            body: `Hi ${inquiryName || 'Customer'},\n\nWe have logged your inquiry and sent it to our team (ropenixkenya@gmail.com). You will receive a response shortly.`,
            status: 'completed',
            timestamp: getCurrentTimestamp(),
            recipientType: 'customer',
            category: 'Inquiry Confirmation'
          };
          onTriggerEmailToast(customerReceipt);
        }

        setInquiryName('');
        setInquiryEmail('');
        setInquiryPhone('');
        setInquirySubject('');
        setInquiryMessage('');
      } else {
        setErrorMessage(res?.error || 'Unable to submit your message. Please check the fields and try again.');
      }
    } catch (err: any) {
      const errDetail = err.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join(' ')
        : (err.response?.data?.error || err.response?.data?.message || 'Unable to send message at this time. Please try again later.');
      setErrorMessage(errDetail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Hand: Brand Story & FAQ Directory */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Brand Intro Card */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest font-mono mb-3">
              <Sparkles className="h-4 w-4" />
              Crafted in Nairobi, Kenya
            </div>
            <h2 className="font-display font-bold text-gray-950 dark:text-white text-2xl sm:text-3xl mb-4">
              Direct Contact & Customer Helpdesk
            </h2>
            <p className="text-sm font-light text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
              Have a question about an order, custom apparel, bulk pricing, or need technical support? 
              Our team monitors inquiries in real-time and responds promptly to all requests.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 font-mono block">Direct Email</span>
                  <a href="mailto:ropenixkenya@gmail.com" className="text-xs font-medium text-gray-900 dark:text-white hover:text-indigo-600 truncate block">
                    ropenixkenya@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 font-mono block">Customer Hotline</span>
                  <span className="text-xs font-medium text-gray-900 dark:text-white block">+254 700 000 000</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 font-mono block">Fulfillment Hub</span>
                  <span className="text-xs font-medium text-gray-900 dark:text-white block">Westlands, Nairobi</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive FAQ Search & Accordion */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-display font-semibold text-gray-950 dark:text-white text-base">Frequently Asked Questions</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-extralight">Find instant answers to common logistics, policy, and material questions.</p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  value={faqSearchQuery}
                  onChange={(e) => setFaqSearchQuery(e.target.value)}
                  placeholder="Search questions..."
                  className="h-8 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 pl-8 pr-3 text-xs font-light text-gray-800 dark:text-gray-200 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {categories.map((c) => {
                const Icon = c.icon;
                const active = faqCategory === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setFaqCategory(c.id as any)}
                    className={`h-7 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      active
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {c.label}
                  </button>
                );
              })}
            </div>

            {/* Accordion FAQ List */}
            <div className="flex flex-col gap-3">
              {filteredFAQs.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">
                  No matching questions found for "{faqSearchQuery}". Use the form on the right to message our team directly.
                </div>
              ) : (
                filteredFAQs.map((faq) => {
                  const isExpanded = expandedFAQ === faq.id;
                  const Icon = faq.icon;
                  return (
                    <div
                      key={faq.id}
                      className="rounded-xl border border-gray-200/80 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-950/40 overflow-hidden transition-colors"
                    >
                      <button
                        onClick={() => setExpandedFAQ(isExpanded ? null : faq.id)}
                        className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <div>
                            <span className="block text-xs font-semibold text-gray-900 dark:text-white">
                              {faq.q}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                              {faq.categoryName}
                            </span>
                          </div>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${
                            isExpanded ? 'rotate-90 text-indigo-600' : ''
                          }`}
                        />
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 text-xs font-normal text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-gray-800/80">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Hand: Contact Form */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-xs">
            <h3 className="font-display font-semibold text-gray-950 dark:text-white text-base mb-2">Customer Inquiries</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-extralight mb-6">
              Have product sizing questions, custom apparel needs, or feedback? Send us a message and we will respond to your email.
            </p>

            {successToast && (
              <div className="mb-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-200">
                <p className="font-semibold flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600" /> Message Sent Successfully!
                </p>
                <p className="mt-1 font-light leading-relaxed">{successMessage}</p>
              </div>
            )}

            {errorMessage && (
              <div className="mb-5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-4 text-xs text-red-800 dark:text-red-300 animate-in fade-in duration-200">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-red-600" /> Submission Failed
                </p>
                <p className="mt-1 font-light leading-relaxed">{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Anti-spam honeypot (hidden from real users) */}
              <input
                type="text"
                name="hp_field"
                value={hpField}
                onChange={(e) => setHpField(e.target.value)}
                style={{ display: 'none' }}
                tabIndex={-1}
                autoComplete="off"
              />

              <div>
                <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 font-mono">Your Full Name *</label>
                <input
                  type="text"
                  required
                  value={inquiryName}
                  onChange={(e) => setInquiryName(e.target.value)}
                  placeholder="e.g. Sarah Reed"
                  className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 text-xs font-light text-gray-800 dark:text-gray-200 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 font-mono">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={inquiryEmail}
                    onChange={(e) => setInquiryEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 text-xs font-light text-gray-800 dark:text-gray-200 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 font-mono">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    value={inquiryPhone}
                    onChange={(e) => setInquiryPhone(e.target.value)}
                    placeholder="e.g. +254 712 345678"
                    className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 text-xs font-light text-gray-800 dark:text-gray-200 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 font-mono">Subject / Topic</label>
                <input
                  type="text"
                  value={inquirySubject}
                  onChange={(e) => setInquirySubject(e.target.value)}
                  placeholder="e.g. Order Inquiry / Custom Apparel Quote"
                  className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 text-xs font-light text-gray-800 dark:text-gray-200 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 font-mono">Message Detail *</label>
                <textarea
                  required
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  placeholder="How can we assist you with workspace setup or order inquiries?"
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-xs font-light text-gray-800 dark:text-gray-200 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 rounded-xl bg-indigo-600 font-display text-xs font-semibold text-white transition-colors hover:bg-indigo-700 cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending Message...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Send Message to Support Desk
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick legal/policy footer statement */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 p-5 text-gray-500 dark:text-gray-400 text-[11px] font-light leading-relaxed">
            <h4 className="font-display font-medium text-gray-700 dark:text-gray-300 text-xs mb-1.5 uppercase tracking-wide font-mono">Customer Communication Notice</h4>
            <p className="mb-2"><strong>Support Commitment:</strong> Inquiries submitted through this portal are dispatched directly to our administrative management inbox (<code className="text-indigo-600 dark:text-indigo-400">ropenixkenya@gmail.com</code>). You will receive an automated confirmation copy upon dispatch.</p>
            <p><strong>Privacy Strategy:</strong> We do not sell or distribute customer contact details to third parties.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

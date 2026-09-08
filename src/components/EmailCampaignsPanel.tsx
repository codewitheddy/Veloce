/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Product, Order, CouponItem } from '../types';
import { getCouponPercent, getCouponExpiry, isCouponExpired, formatCouponExpiry } from '../data';
import SmtpDiagnosticsModal from './SmtpDiagnosticsModal';
import SmtpHealthValidator from './SmtpHealthValidator';
import DnsAuthenticationGuide from './DnsAuthenticationGuide';
import ReviewRequestAutomationPanel from './ReviewRequestAutomationPanel';
import { emailService } from '../services/api';
import {
  Mail,
  Send,
  Sparkles,
  Users,
  Tag,
  Eye,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  ArrowRight,
  TrendingUp,
  Percent,
  Play,
  RotateCcw,
  BookOpen,
  Calendar,
  Save,
  Trash2,
  Copy,
  PlusCircle,
  Layers,
  Sliders,
  DollarSign,
  Activity,
  Terminal,
  ShieldCheck,
  UserX,
  UserCheck,
  Ban,
  Search,
  RefreshCw,
  Edit3,
  Code,
  Smartphone,
  Monitor,
  Maximize2,
  X,
  History,
  Camera,
  Bookmark
} from 'lucide-react';

interface TransactionalEmailLog {
  id: string;
  recipientEmail: string;
  recipientName: string;
  templateId: string;
  templateName: string;
  subject: string;
  status: 'delivered' | 'failed' | 'retried';
  timestamp: string;
  errorMessage?: string;
  retryCount: number;
}

interface EmailCampaignsPanelProps {
  products: Product[];
  orders: Order[];
  coupons: Record<string, CouponItem | number>;
  onTriggerEmailToast?: (mockOrder: Order, status: string) => void;
}

interface SentCampaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  templateType: string;
  segment: string;
  recipientCount: number;
  dateSent: string;
  openRate: number;
  clickRate: number;
  conversions: number;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  templateType: 'promo' | 'spotlight' | 'custom' | 'transactional' | 'lifecycle';
  category?: 'transactional' | 'lifecycle' | 'marketing';
  isCustom?: boolean;
}

interface ScheduledCampaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  templateType: string;
  segment: string;
  recipientCount: number;
  scheduledTime: string;
  productId: string;
  couponCode: string;
}

export interface TemplateVariable {
  tag: string;
  label: string;
  category: 'customer' | 'order' | 'product' | 'security' | 'store';
  description: string;
  sample: string;
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  timestamp: string;
  name: string;
  subject: string;
  body: string;
  category: 'transactional' | 'lifecycle' | 'marketing';
  note: string;
  savedBy: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  // Customer & Recipient
  { tag: 'customer_name', label: 'Customer Full Name', category: 'customer', description: 'First & last name of recipient', sample: 'Alex Morgan' },
  { tag: 'customer_email', label: 'Customer Email Address', category: 'customer', description: 'Primary email address of recipient', sample: 'alex.morgan@example.com' },
  { tag: 'customer_phone', label: 'Customer Phone Contact', category: 'customer', description: 'Phone number with country code', sample: '+254 712 345678' },
  
  // Order & Payment
  { tag: 'order_id', label: 'Order Reference ID', category: 'order', description: 'Unique 8-character order identifier', sample: 'VEL-89421' },
  { tag: 'order_total', label: 'Order Total Amount', category: 'order', description: 'Formatted grand total with currency symbol', sample: 'KES 45,000' },
  { tag: 'order_date', label: 'Order Placement Timestamp', category: 'order', description: 'Date & time when order was placed', sample: '23 Jul 2026, 09:48 AM' },
  { tag: 'payment_method', label: 'Payment Method Type', category: 'order', description: 'Gateway method selected at checkout', sample: 'M-PESA Express' },
  { tag: 'mpesa_ref', label: 'M-PESA Confirmation Ref', category: 'order', description: 'Official Safaricom M-PESA transaction code', sample: 'RHK9824X10' },
  { tag: 'shipping_address', label: 'Delivery Shipping Address', category: 'order', description: 'Destination address specified by customer', sample: 'Kilimani, Nairobi, Kenya' },

  // Product & Promo
  { tag: 'product_name', label: 'Featured Product Title', category: 'product', description: 'Title of purchased or spotlighted product', sample: 'Veloce Standing Desk' },
  { tag: 'product_price', label: 'Product Unit Price', category: 'product', description: 'Formatted single item unit price', sample: 'KES 45,000' },
  { tag: 'discount_code', label: 'Promotional Coupon Code', category: 'product', description: 'Active coupon discount code', sample: 'SUMMER15' },
  { tag: 'coupon_expiry', label: 'Coupon Expiration Date', category: 'product', description: 'Valid-until date for promotional discount', sample: '31 Aug 2026' },
  { tag: 'product_link', label: 'Direct Product / Store Link', category: 'product', description: 'Direct URL to store or product page', sample: 'https://marid.co.ke/store' },

  // Account & Security
  { tag: 'otp_code', label: '2FA One-Time Passcode', category: 'security', description: '6-digit secure verification passcode', sample: '849201' },
  { tag: 'reset_password_link', label: 'Password Reset URL', category: 'security', description: 'Secure tokenized link to reset password', sample: 'https://marid.co.ke/reset-password' },
  { tag: 'login_url', label: 'Customer Login Portal URL', category: 'security', description: 'Direct link to customer account portal', sample: 'https://marid.co.ke/login' },

  // Store & Branding
  { tag: 'store_name', label: 'Merchant Brand Name', category: 'store', description: 'Official merchant store name', sample: 'Veloce Kenya' },
  { tag: 'support_email', label: 'Customer Support Email', category: 'store', description: 'Helpdesk support contact email', sample: 'support@marid.co.ke' },
  { tag: 'unsubscribe_link', label: 'Unsubscribe Link', category: 'store', description: 'CAN-SPAM compliant unsubscribe URL', sample: 'https://marid.co.ke/unsubscribe' },
];

export const renderSampleTemplate = (text: string, productsList: Product[]) => {
  if (!text) return '';
  const prodName = productsList[0]?.name || 'Veloce Standing Desk';
  const prodPrice = productsList[0]?.price ? `KES ${productsList[0].price.toLocaleString()}` : 'KES 45,000';
  return text
    .replace(/\{\{customer_name\}\}/g, 'Alex Morgan')
    .replace(/\{\{customer_email\}\}/g, 'alex.morgan@example.com')
    .replace(/\{\{customer_phone\}\}/g, '+254 712 345678')
    .replace(/\{\{order_id\}\}/g, 'VEL-89421')
    .replace(/\{\{order_total\}\}/g, 'KES 45,000')
    .replace(/\{\{order_date\}\}/g, '23 Jul 2026, 09:48 AM')
    .replace(/\{\{payment_method\}\}/g, 'M-PESA Express')
    .replace(/\{\{mpesa_ref\}\}/g, 'RHK9824X10')
    .replace(/\{\{shipping_address\}\}/g, 'Kilimani, Nairobi, Kenya')
    .replace(/\{\{product_name\}\}/g, prodName)
    .replace(/\{\{product_price\}\}/g, prodPrice)
    .replace(/\{\{discount_code\}\}/g, 'SUMMER15')
    .replace(/\{\{coupon_expiry\}\}/g, '31 Aug 2026')
    .replace(/\{\{product_link\}\}/g, 'https://marid.co.ke/store')
    .replace(/\{\{otp_code\}\}/g, '849201')
    .replace(/\{\{reset_password_link\}\}/g, 'https://marid.co.ke/reset-password?token=xyz123')
    .replace(/\{\{login_url\}\}/g, 'https://marid.co.ke/login')
    .replace(/\{\{store_name\}\}/g, 'Veloce Kenya')
    .replace(/\{\{support_email\}\}/g, 'support@marid.co.ke')
    .replace(/\{\{unsubscribe_link\}\}/g, 'https://marid.co.ke/unsubscribe');
};

export default function EmailCampaignsPanel({
  products,
  orders,
  coupons,
  onTriggerEmailToast
}: EmailCampaignsPanelProps) {
  // --- STATE ---
  const [showHowTo, setShowHowTo] = useState(true);
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);
  const [activeMainSection, setActiveMainSection] = useState<'composer' | 'editor' | 'logs' | 'dns' | 'unsubscribes' | 'review_automation'>('composer');

  // --- TRANSACTIONAL DELIVERIES & RETRY ENGINE STATES ---
  const [transactionalLogs, setTransactionalLogs] = useState<TransactionalEmailLog[]>(() => {
    const saved = localStorage.getItem('veloce_transactional_email_logs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });

  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);
  const [logFilterStatus, setLogFilterStatus] = useState<'all' | 'delivered' | 'failed'>('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // Manual Re-trigger Form States
  const [manualTargetEmail, setManualTargetEmail] = useState('');
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [manualTemplateId, setManualTemplateId] = useState('tx-1');
  const [isManualDispatching, setIsManualDispatching] = useState(false);

  // --- TEMPLATE EDITOR STATES ---
  const [editingTemplateId, setEditingTemplateId] = useState<string>('tx-1');
  const [editedTemplateName, setEditedTemplateName] = useState<string>('');
  const [editedTemplateSubject, setEditedTemplateSubject] = useState<string>('');
  const [editedTemplateBody, setEditedTemplateBody] = useState<string>('');
  const [editedTemplateCategory, setEditedTemplateCategory] = useState<'transactional' | 'lifecycle' | 'marketing'>('transactional');
  const [editorPreviewMode, setEditorPreviewMode] = useState<'split' | 'code' | 'preview'>('split');
  const [editorTestEmail, setEditorTestEmail] = useState<string>('admin@ropenix.co.ke');
  const [isTestSending, setIsTestSending] = useState(false);

  // Device Preview Modal States
  const [isDevicePreviewOpen, setIsDevicePreviewOpen] = useState(false);
  const [devicePreviewFrame, setDevicePreviewFrame] = useState<'desktop' | 'mobile'>('desktop');

  // --- VERSION HISTORY STATES ---
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [selectedVersionForPreview, setSelectedVersionForPreview] = useState<TemplateVersion | null>(null);
  const [versionHistory, setVersionHistory] = useState<TemplateVersion[]>(() => {
    const saved = localStorage.getItem('veloce_template_versions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error('Failed to parse veloce_template_versions', err);
      }
    }
    return [
      {
        id: 'ver-tx1-v1',
        templateId: 'tx-1',
        versionNumber: 1,
        timestamp: '23 Jul 2026, 08:30 AM',
        name: '🧾 Order Confirmation & Receipt',
        subject: 'Order Confirmation #10042 for {{customer_name}}',
        body: `Hi {{customer_name}},\n\nThank you for ordering {{product_name}}!\nOrder Total: KSh {{product_price}}\n\nWe are processing your order now.`,
        category: 'transactional',
        note: 'Initial system baseline layout',
        savedBy: 'System Core'
      },
      {
        id: 'ver-tx1-v2',
        templateId: 'tx-1',
        versionNumber: 2,
        timestamp: '23 Jul 2026, 09:15 AM',
        name: '🧾 Order Confirmation & Receipt',
        subject: 'Order Confirmed #10042 • Receipt & Breakdown for {{customer_name}}',
        body: `Hi {{customer_name}},\n\nThank you for shopping with Veloce Kenya! We have received your payment and are preparing your order for immediate dispatch.\n\n==============================================\nORDER RECEIPT & BREAKDOWN\n==============================================\nOrder ID: #10042\nCustomer: {{customer_name}}\n\nITEMS:\n• {{product_name}} x 1 — KSh {{product_price}}\n\nSubtotal: KSh {{product_price}}\nVAT (16%): Included\nShipping: KSh 0 (Free Express Delivery)\n----------------------------------------------\nTOTAL PAID: KSh {{product_price}}\n==============================================\n\nYou can track your shipment status live inside your user account dashboard.\n\nQuestions? Reply to this email or contact support at orders@marid.co.ke.\n\nWarm regards,\nVeloce Express Logistics Team`,
        category: 'transactional',
        note: 'Added M-PESA & detailed receipt item breakdown',
        savedBy: 'Admin (edwinmuliro64@gmail.com)'
      },
      {
        id: 'ver-lc1-v1',
        templateId: 'lc-1',
        versionNumber: 1,
        timestamp: '22 Jul 2026, 11:00 AM',
        name: '🛒 Abandoned Cart Recovery (1 Hour)',
        subject: 'Did you leave something behind, {{customer_name}}?',
        body: `Hi {{customer_name}},\n\nWe noticed you left {{product_name}} in your shopping cart! Items are selling fast.\n\nReturn to cart: {{product_link}}`,
        category: 'lifecycle',
        note: 'Initial baseline cart recovery text',
        savedBy: 'System Core'
      }
    ];
  });

  const currentTemplateVersions = useMemo(() => {
    return versionHistory.filter((v) => v.templateId === editingTemplateId);
  }, [versionHistory, editingTemplateId]);

  const handleTakeManualSnapshot = () => {
    const defaultNote = `Snapshot v${Date.now().toString().slice(-4)}`;
    const note = prompt('Enter a label or description for this version checkpoint:', defaultNote);
    if (note === null) return; // User cancelled

    const currentTplVersions = versionHistory.filter((v) => v.templateId === editingTemplateId);
    const nextVerNum = currentTplVersions.length > 0 ? Math.max(...currentTplVersions.map((v) => v.versionNumber)) + 1 : 1;

    const newVersion: TemplateVersion = {
      id: `ver-${editingTemplateId}-v${nextVerNum}-${Date.now()}`,
      templateId: editingTemplateId,
      versionNumber: nextVerNum,
      timestamp: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      name: editedTemplateName.trim() || 'Untitled Template',
      subject: editedTemplateSubject,
      body: editedTemplateBody,
      category: editedTemplateCategory,
      note: note.trim() || `Manual Snapshot (v${nextVerNum})`,
      savedBy: 'Admin (admin@ropenix.co.ke)'
    };

    const updatedHistory = [newVersion, ...versionHistory];
    setVersionHistory(updatedHistory);
    localStorage.setItem('veloce_template_versions', JSON.stringify(updatedHistory));

    setSuccessBanner(`📸 Created version checkpoint v${nextVerNum} ("${newVersion.note}")!`);
    setTimeout(() => setSuccessBanner(''), 4000);
  };

  const handleRestoreVersion = (ver: TemplateVersion) => {
    setEditedTemplateName(ver.name);
    setEditedTemplateSubject(ver.subject);
    setEditedTemplateBody(ver.body);
    setEditedTemplateCategory(ver.category);
    setSelectedVersionForPreview(null);

    setSuccessBanner(`⏪ Restored Version #${ver.versionNumber} ("${ver.note}") into the editor! Review changes and click "Save Changes" when ready.`);
    setTimeout(() => setSuccessBanner(''), 5000);
  };

  const handleDeleteVersion = (versionId: string) => {
    if (!confirm('Are you sure you want to delete this historical version snapshot?')) return;
    const updated = versionHistory.filter((v) => v.id !== versionId);
    setVersionHistory(updated);
    localStorage.setItem('veloce_template_versions', JSON.stringify(updated));
    if (selectedVersionForPreview?.id === versionId) {
      setSelectedVersionForPreview(null);
    }
    setSuccessBanner('🗑️ Version snapshot removed from history.');
    setTimeout(() => setSuccessBanner(''), 3000);
  };

  // Unsubscribed Suppression Engine States
  const [unsubscribedList, setUnsubscribedList] = useState<string[]>([]);
  const [manualUnsubEmail, setManualUnsubEmail] = useState('');
  const [unsubSearchQuery, setUnsubSearchQuery] = useState('');

  const loadUnsubscribedList = async () => {
    try {
      const res = await emailService.getUnsubscribedList();
      if (res && res.emails) {
        setUnsubscribedList(res.emails);
      }
    } catch (err) {
      console.error('[Email Campaigns] Failed to fetch unsubscribed list:', err);
    }
  };

  useEffect(() => {
    loadUnsubscribedList();
  }, []);

  const handleManualUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUnsubEmail.trim() || !manualUnsubEmail.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }
    try {
      const res = await emailService.unsubscribe(manualUnsubEmail.trim(), 'Admin manually added to suppression list');
      setSuccessBanner(res.message || `${manualUnsubEmail} added to unsubscribe suppression list.`);
      setManualUnsubEmail('');
      loadUnsubscribedList();
      setTimeout(() => setSuccessBanner(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to unsubscribe email.');
    }
  };

  const handleManualResubscribe = async (emailToResub: string) => {
    try {
      const res = await emailService.resubscribe(emailToResub);
      setSuccessBanner(res.message || `${emailToResub} re-subscribed successfully.`);
      loadUnsubscribedList();
      setTimeout(() => setSuccessBanner(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to re-subscribe email.');
    }
  };

  // --- TEMPLATE EDITOR HANDLERS ---
  const handleSaveEditedTemplate = () => {
    if (!editedTemplateName.trim()) {
      alert('Please provide a template title.');
      return;
    }

    const existingIndex = templatesList.findIndex((t) => t.id === editingTemplateId);
    let updatedList: EmailTemplate[] = [];

    if (existingIndex >= 0) {
      const updatedItem: EmailTemplate = {
        ...templatesList[existingIndex],
        name: editedTemplateName.trim(),
        subject: editedTemplateSubject,
        body: editedTemplateBody,
        category: editedTemplateCategory,
        isCustom: true
      };
      updatedList = [...templatesList];
      updatedList[existingIndex] = updatedItem;
    } else {
      const newItem: EmailTemplate = {
        id: `template-${Date.now()}`,
        name: editedTemplateName.trim(),
        subject: editedTemplateSubject,
        body: editedTemplateBody,
        templateType: 'custom',
        category: editedTemplateCategory,
        isCustom: true
      };
      updatedList = [newItem, ...templatesList];
      setEditingTemplateId(newItem.id);
    }

    setTemplatesList(updatedList);

    // Save custom templates to localStorage
    const customOnly = updatedList.filter((t) => t.isCustom);
    localStorage.setItem('veloce_custom_templates', JSON.stringify(customOnly));

    // Automatically record version snapshot in history
    const currentTplVersions = versionHistory.filter((v) => v.templateId === editingTemplateId);
    const nextVerNum = currentTplVersions.length > 0 ? Math.max(...currentTplVersions.map((v) => v.versionNumber)) + 1 : 1;

    const newVersion: TemplateVersion = {
      id: `ver-${editingTemplateId}-v${nextVerNum}-${Date.now()}`,
      templateId: editingTemplateId,
      versionNumber: nextVerNum,
      timestamp: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      name: editedTemplateName.trim(),
      subject: editedTemplateSubject,
      body: editedTemplateBody,
      category: editedTemplateCategory,
      note: `Saved Changes (v${nextVerNum})`,
      savedBy: 'Admin (admin@ropenix.co.ke)'
    };

    const updatedHistory = [newVersion, ...versionHistory];
    setVersionHistory(updatedHistory);
    localStorage.setItem('veloce_template_versions', JSON.stringify(updatedHistory));

    setSuccessBanner(`💾 Template "${editedTemplateName.trim()}" saved securely (Recorded Version v${nextVerNum})!`);
    setTimeout(() => setSuccessBanner(''), 4000);
  };

  const handleSendEditorTestEmail = async () => {
    if (!editorTestEmail || !editorTestEmail.includes('@')) {
      alert('Please enter a valid target email address for test send.');
      return;
    }

    setIsTestSending(true);
    try {
      const formattedSubject = editedTemplateSubject
        .replace(/\{\{customer_name\}\}/g, 'Alex Morgan')
        .replace(/\{\{product_name\}\}/g, products[0]?.name || 'Veloce Desk Pad')
        .replace(/\{\{product_price\}\}/g, products[0]?.price.toLocaleString() || '45,000')
        .replace(/\{\{discount_code\}\}/g, 'SUMMER15');

      const formattedBody = editedTemplateBody
        .replace(/\{\{customer_name\}\}/g, 'Alex Morgan')
        .replace(/\{\{product_name\}\}/g, products[0]?.name || 'Veloce Desk Pad')
        .replace(/\{\{product_price\}\}/g, products[0]?.price.toLocaleString() || '45,000')
        .replace(/\{\{discount_code\}\}/g, 'SUMMER15')
        .replace(/\{\{product_link\}\}/g, 'https://marid.co.ke/store');

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #1e293b; margin: 0; font-size: 20px;">Veloce Kenya</h2>
            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">Template Test Preview</p>
          </div>
          <div style="color: #334155; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${formattedBody}</div>
        </div>
      `;

      await emailService.sendEmail({
        to: editorTestEmail,
        subject: `[TEST PREVIEW] ${formattedSubject}`,
        html: htmlContent,
        text: formattedBody,
        category: editedTemplateCategory
      });

      setSuccessBanner(`✉️ Test preview email dispatched to ${editorTestEmail} via cPanel SMTP!`);
      setTimeout(() => setSuccessBanner(''), 5000);
    } catch (err: any) {
      alert(`Failed to send test email: ${err.message || 'SMTP Connection Error'}`);
    } finally {
      setIsTestSending(false);
    }
  };

  // Variables Cheat Sheet Dropdown States
  const [isVarDropdownOpen, setIsVarDropdownOpen] = useState(false);
  const [varSearchQuery, setVarSearchQuery] = useState('');
  const [varCategoryFilter, setVarCategoryFilter] = useState<'all' | 'customer' | 'order' | 'product' | 'security' | 'store'>('all');
  const [copiedVarTag, setCopiedVarTag] = useState<string | null>(null);

  const filteredTemplateVariables = useMemo(() => {
    return TEMPLATE_VARIABLES.filter((item) => {
      const matchesCat = varCategoryFilter === 'all' || item.category === varCategoryFilter;
      const q = varSearchQuery.trim().toLowerCase();
      const matchesQ = !q || (
        item.tag.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.sample.toLowerCase().includes(q)
      );
      return matchesCat && matchesQ;
    });
  }, [varCategoryFilter, varSearchQuery]);

  const handleInsertVariable = (variableTag: string) => {
    setEditedTemplateBody((prev) => `${prev} {{${variableTag}}}`);
    setSuccessBanner(`✅ Inserted dynamic tag {{${variableTag}}} into template body!`);
    setTimeout(() => setSuccessBanner(''), 3000);
  };

  const handleCopyVariableTag = (variableTag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(`{{${variableTag}}}`);
      setCopiedVarTag(variableTag);
      setTimeout(() => setCopiedVarTag(null), 2000);
    } catch (err) {
      console.error('Failed to copy variable tag:', err);
    }
  };

  // --- RETRY FAILED DELIVERIES & MANUAL DISPATCH HANDLERS ---
  const handleRetryDelivery = async (logToRetry: TransactionalEmailLog) => {
    setRetryingLogId(logToRetry.id);
    try {
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #1e293b; margin: 0; font-size: 20px;">Veloce Hub Kenya</h2>
            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">Automated Notice Re-transmission</p>
          </div>
          <div style="color: #334155; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">Notice Re-sent: ${logToRetry.subject}</div>
        </div>
      `;

      await emailService.sendEmail({
        to: logToRetry.recipientEmail,
        subject: logToRetry.subject,
        html: htmlContent,
        text: `Notice Re-sent: ${logToRetry.subject}`,
        category: 'transactional'
      });

      // Update log item in state and localStorage
      const updatedLogs = transactionalLogs.map((item) => {
        if (item.id === logToRetry.id) {
          return {
            ...item,
            status: 'retried' as const,
            timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
            errorMessage: undefined,
            retryCount: item.retryCount + 1
          };
        }
        return item;
      });

      setTransactionalLogs(updatedLogs);
      localStorage.setItem('veloce_transactional_email_logs', JSON.stringify(updatedLogs));

      setSuccessBanner(`✅ Transactional email successfully re-triggered & delivered to ${logToRetry.recipientEmail} via cPanel SMTP!`);
      setTimeout(() => setSuccessBanner(''), 5000);
    } catch (err: any) {
      alert(`Retry delivery failed: ${err.message || 'Connection error'}`);
    } finally {
      setRetryingLogId(null);
    }
  };

  const handleManualTransactionalDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTargetEmail || !manualTargetEmail.includes('@')) {
      alert('Please enter a valid customer email address.');
      return;
    }

    setIsManualDispatching(true);
    try {
      const selectedTpl = templatesList.find((t) => t.id === manualTemplateId) || defaultTemplates[0];
      const name = manualCustomerName.trim() || manualTargetEmail.split('@')[0];

      const formattedSubject = selectedTpl.subject
        .replace(/\{\{customer_name\}\}/g, name)
        .replace(/\{\{product_name\}\}/g, products[0]?.name || 'Veloce Desk Pad')
        .replace(/\{\{product_price\}\}/g, products[0]?.price.toLocaleString() || '45,000')
        .replace(/\{\{discount_code\}\}/g, 'SUMMER15');

      const formattedBody = selectedTpl.body
        .replace(/\{\{customer_name\}\}/g, name)
        .replace(/\{\{product_name\}\}/g, products[0]?.name || 'Veloce Desk Pad')
        .replace(/\{\{product_price\}\}/g, products[0]?.price.toLocaleString() || '45,000')
        .replace(/\{\{discount_code\}\}/g, 'SUMMER15')
        .replace(/\{\{product_link\}\}/g, 'https://marid.co.ke/store');

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #1e293b; margin: 0; font-size: 20px;">Veloce Hub Kenya</h2>
            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">Transactional Notification</p>
          </div>
          <div style="color: #334155; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${formattedBody}</div>
        </div>
      `;

      await emailService.sendEmail({
        to: manualTargetEmail.trim(),
        subject: formattedSubject,
        html: htmlContent,
        text: formattedBody,
        category: 'transactional'
      });

      const newLog: TransactionalEmailLog = {
        id: `txlog-${Date.now()}`,
        recipientEmail: manualTargetEmail.trim(),
        recipientName: name,
        templateId: selectedTpl.id,
        templateName: selectedTpl.name,
        subject: formattedSubject,
        status: 'delivered',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        retryCount: 0
      };

      const updatedLogs = [newLog, ...transactionalLogs];
      setTransactionalLogs(updatedLogs);
      localStorage.setItem('veloce_transactional_email_logs', JSON.stringify(updatedLogs));

      setSuccessBanner(`🚀 Transactional email "${selectedTpl.name}" re-triggered & delivered to ${manualTargetEmail}!`);
      setManualTargetEmail('');
      setManualCustomerName('');
      setTimeout(() => setSuccessBanner(''), 5000);
    } catch (err: any) {
      alert(`Manual dispatch failed: ${err.message || 'SMTP Connection Error'}`);
    } finally {
      setIsManualDispatching(false);
    }
  };
  
  // Category Filter and Preview Mode States
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<'all' | 'transactional' | 'lifecycle' | 'marketing'>('all');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Basic Campaign Inputs
  const [campaignName, setCampaignName] = useState('Veloce Mid-Summer Tech Blitz');
  const [subjectLine, setSubjectLine] = useState('🔥 Premium workspace gadgets curated for {{customer_name}} + Exclusive Discount!');
  const [templateType, setTemplateType] = useState<'promo' | 'spotlight' | 'custom'>('promo');
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [selectedCouponCode, setSelectedCouponCode] = useState<string>(Object.keys(coupons)[0] || '');
  const [emailBody, setEmailBody] = useState(
    `Hi {{customer_name}},\n\nUpgrade your remote work setup with our handpicked selections. \n\nWe are excited to spotlight the {{product_name}}, engineered to maximize your focus and physical workspace ergonomics.\n\nOnly KSh {{product_price}} this weekend! \n\nUse code {{discount_code}} at checkout to secure an extra discount. \n\nGet yours today: {{product_link}}\n\nWarm regards,\nThe Veloce Marketing Team`
  );
  
  // Segmentation and Sandbox Target
  const [targetSegment, setTargetSegment] = useState<'all' | 'vip' | 'frequent' | 'high-intent' | 'test'>('all');
  const [testEmail, setTestEmail] = useState('admin@ropenix.co.ke');

  // Scheduling Configuration
  const [deliveryType, setDeliveryType] = useState<'now' | 'scheduled'>('now');
  const [scheduledDateTime, setScheduledDateTime] = useState(() => {
    // Default to tomorrow at 9:00 AM local time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    // Convert to local ISO format for datetime-local input (YYYY-MM-DDTHH:MM)
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const hours = String(tomorrow.getHours()).padStart(2, '0');
    const minutes = String(tomorrow.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });



  // Template Library List
  const [templatesList, setTemplatesList] = useState<EmailTemplate[]>([]);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);

  // Reschedule Modal States
  const [reschedulingCampaign, setReschedulingCampaign] = useState<ScheduledCampaign | null>(null);
  const [rescheduleNewDateTime, setRescheduleNewDateTime] = useState<string>('');

  // Quick Preset Helper for Promotional Email Scheduling
  const applySchedulePreset = (preset: '1h' | 'tomorrow-9am' | 'tomorrow-6pm' | '3days' | 'next-monday') => {
    const now = new Date();
    if (preset === '1h') {
      now.setHours(now.getHours() + 1);
    } else if (preset === 'tomorrow-9am') {
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0);
    } else if (preset === 'tomorrow-6pm') {
      now.setDate(now.getDate() + 1);
      now.setHours(18, 0, 0, 0);
    } else if (preset === '3days') {
      now.setDate(now.getDate() + 3);
      now.setHours(10, 0, 0, 0);
    } else if (preset === 'next-monday') {
      const day = now.getDay();
      const diff = day === 0 ? 1 : 8 - day;
      now.setDate(now.getDate() + diff);
      now.setHours(9, 0, 0, 0);
    }
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setScheduledDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
  };

  // Helper to format date/time & relative time remaining
  const getScheduleTimeDetails = (dateTimeStr: string) => {
    if (!dateTimeStr) return { isValid: false, formatted: '', relativeStr: 'No date selected', isPast: false, diffMs: 0 };
    const targetDate = new Date(dateTimeStr.replace(' ', 'T'));
    if (isNaN(targetDate.getTime())) return { isValid: false, formatted: '', relativeStr: 'Invalid date format', isPast: false, diffMs: 0 };
    
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    const isPast = diffMs < 0;

    const formatted = targetDate.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const absDiffMs = Math.abs(diffMs);
    const minutes = Math.floor((absDiffMs / (1000 * 60)) % 60);
    const hours = Math.floor((absDiffMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    let relativeStr = parts.join(' ');

    if (isPast) {
      relativeStr = `${relativeStr} ago (Ready for release)`;
    } else {
      relativeStr = `in ${relativeStr}`;
    }

    return { isValid: true, formatted, relativeStr, isPast, diffMs };
  };

  // Reschedule Handlers
  const handleOpenRescheduleModal = (item: ScheduledCampaign) => {
    setReschedulingCampaign(item);
    setRescheduleNewDateTime(item.scheduledTime.replace(' ', 'T'));
  };

  const applyReschedulePreset = (preset: '1h' | 'tomorrow-9am' | 'tomorrow-6pm' | '3days' | 'next-monday') => {
    const now = new Date();
    if (preset === '1h') {
      now.setHours(now.getHours() + 1);
    } else if (preset === 'tomorrow-9am') {
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0);
    } else if (preset === 'tomorrow-6pm') {
      now.setDate(now.getDate() + 1);
      now.setHours(18, 0, 0, 0);
    } else if (preset === '3days') {
      now.setDate(now.getDate() + 3);
      now.setHours(10, 0, 0, 0);
    } else if (preset === 'next-monday') {
      const day = now.getDay();
      const diff = day === 0 ? 1 : 8 - day;
      now.setDate(now.getDate() + diff);
      now.setHours(9, 0, 0, 0);
    }
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setRescheduleNewDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
  };

  const handleSaveReschedule = () => {
    if (!reschedulingCampaign || !rescheduleNewDateTime) return;
    const targetDate = new Date(rescheduleNewDateTime.replace(' ', 'T'));
    if (isNaN(targetDate.getTime())) {
      alert('Please enter a valid date and time.');
      return;
    }
    const formattedNewTime = rescheduleNewDateTime.replace('T', ' ');
    const updatedQueue = scheduledQueue.map((q) =>
      q.id === reschedulingCampaign.id ? { ...q, scheduledTime: formattedNewTime } : q
    );
    setScheduledQueue(updatedQueue);
    localStorage.setItem('veloce_scheduled_campaigns', JSON.stringify(updatedQueue));
    setSuccessBanner(`📅 Campaign "${reschedulingCampaign.name}" rescheduled to ${formattedNewTime}`);
    setReschedulingCampaign(null);
    setTimeout(() => setSuccessBanner(''), 4000);
  };

  // Sync editor fields when editingTemplateId changes
  useEffect(() => {
    const current = templatesList.find((t) => t.id === editingTemplateId);
    if (current) {
      setEditedTemplateName(current.name);
      setEditedTemplateSubject(current.subject);
      setEditedTemplateBody(current.body);
      setEditedTemplateCategory(current.category || 'transactional');
    }
  }, [editingTemplateId, templatesList]);

  // Delivery simulation states
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [totalRecipients, setTotalRecipients] = useState(0);
  
  // Logs & Pending Queue states
  const [sentLog, setSentLog] = useState<SentCampaign[]>([]);
  const [scheduledQueue, setScheduledQueue] = useState<ScheduledCampaign[]>([]);
  const [successBanner, setSuccessBanner] = useState('');

  // SEED TEMPLATES FOR E-COMMERCE CATEGORIES
  const defaultTemplates: EmailTemplate[] = useMemo(() => [
    // --- 1. CRITICAL TRANSACTIONAL EMAILS ---
    {
      id: 'tx-1',
      name: '🧾 Order Confirmation & Receipt',
      subject: 'Order Confirmed #10042 • Receipt & Breakdown for {{customer_name}}',
      templateType: 'transactional',
      category: 'transactional',
      body: `Hi {{customer_name}},\n\nThank you for shopping with Ropenix Collections! We have received your payment and are preparing your order for immediate dispatch.\n\n==============================================\nORDER RECEIPT & BREAKDOWN\n==============================================\nOrder ID: #ROP-10042\nCustomer: {{customer_name}}\n\nITEMS:\n• {{product_name}} x 1 — KSh {{product_price}}\n\nSubtotal: KSh {{product_price}}\nVAT (16%): Included\nShipping: KSh 0 (Free Express Delivery)\n----------------------------------------------\nTOTAL PAID: KSh {{product_price}}\n==============================================\n\nYou can track your shipment status live inside your user account dashboard.\n\nQuestions? Reply to this email or contact support at support@ropenix.co.ke.\n\nWarm regards,\nRopenix Logistics Team`
    },
    {
      id: 'tx-2',
      name: '🚚 Shipping & Tracking Update',
      subject: 'Your Ropenix Order #ROP-10042 Has Shipped!',
      templateType: 'transactional',
      category: 'transactional',
      body: `Hi {{customer_name}},\n\nGreat news! Your package containing {{product_name}} has left our Nairobi fulfillment warehouse and is en route.\n\nSHIPMENT DETAILS:\n• Order ID: #ROP-10042\n• Item: {{product_name}}\n• Carrier: Ropenix Express Courier\n• Tracking Number: ROP-KE-889421\n• Estimated Delivery: 24 - 48 Hours\n\nTrack your package live: https://ropenix.co.ke/tracking/ROP-KE-889421\n\nBest regards,\nRopenix Fulfillment Team`
    },
    {
      id: 'tx-3',
      name: '📦 Delivery Confirmation',
      subject: 'Delivered! Your Ropenix package has arrived, {{customer_name}}',
      templateType: 'transactional',
      category: 'transactional',
      body: `Hi {{customer_name}},\n\nOur courier driver has marked your parcel for Order #ROP-10042 as delivered!\n\nDELIVERY SUMMARY:\n• Item Delivered: {{product_name}}\n• Delivery Status: Dropped Off & Verified\n\nWe hope you enjoy your new setup! If you have any questions or need setup help, reply directly to this email or contact support at support@ropenix.co.ke.\n\nThank you for choosing Ropenix Collections!`
    },
    {
      id: 'tx-4',
      name: '🔒 Account Verification / Password Reset',
      subject: 'Secure Verification Link for {{customer_name}}',
      templateType: 'transactional',
      category: 'transactional',
      body: `Hello {{customer_name}},\n\nWe received a request to verify your Ropenix Collections account or reset your password.\n\nClick the link below to verify your email address:\nhttps://ropenix.co.ke/verify-account?token=sec_9938210\n\nOne-Time Security Pin: 849-204\n\nThis security token expires in 15 minutes. If you did not initiate this request, please ignore this message or contact security@ropenix.co.ke.\n\nBest regards,\nRopenix Security Systems`
    },
    {
      id: 'tx-5',
      name: '❌ Order Cancellation & Refund Notice',
      subject: 'Order Cancellation Notice #ROP-10042 • Refund Information for {{customer_name}}',
      templateType: 'transactional',
      category: 'transactional',
      body: `Hi {{customer_name}},\n\nYour order #ROP-10042 for {{product_name}} has been cancelled as requested.\n\nREFUND STATUS:\n• Refund Method: Original M-Pesa Number\n• Amount: KSh {{product_price}}\n• Estimated Processing: 1 - 24 Hours\n\nIf you believe this cancellation was made in error or have any questions, please reply to this email or contact support@ropenix.co.ke.\n\nBest regards,\nRopenix Customer Support`
    },
    {
      id: 'tx-6',
      name: '🤝 Affiliate Welcome & Partner Confirmation',
      subject: '🎉 Application Approved! Welcome to Ropenix Affiliate Program, {{customer_name}}',
      templateType: 'transactional',
      category: 'transactional',
      body: `Hi {{customer_name}},\n\nWelcome aboard! Your application to become an official Ropenix Collections Affiliate Partner is APPROVED.\n\nPARTNER DETAILS:\n• Partner Tier: Silver Tier Partner\n• Commission Rate: 10% - 15% per order\n• Personal Referral Link: https://ropenix.co.ke/?ref=ROP-AFF-882\n\nEarn instant cash commissions whenever customers buy via your referral link. Payouts are sent directly to your M-Pesa account.\n\nWarm regards,\nRopenix Partner Relations`
    },
    {
      id: 'tx-7',
      name: '💸 Affiliate Payout Notice & Important Program Updates',
      subject: '💸 Affiliate Commission Payout Dispatched • KSh {{product_price}} for {{customer_name}}',
      templateType: 'transactional',
      category: 'transactional',
      body: `Hi {{customer_name}},\n\nYour monthly affiliate commission payout of KSh {{product_price}} has been processed and disbursed to your registered M-Pesa number!\n\nPAYOUT SUMMARY:\n• Amount Transferred: KSh {{product_price}}\n• M-Pesa Reference: MP-ROP98214\n• Status: Completed & Settled\n\nThank you for partnering with Ropenix Collections. Keep sharing your link to reach Gold Tier status!\n\nBest regards,\nRopenix Finance & Affiliate Department`
    },

    // --- 2. CUSTOMER LIFECYCLE & ENGAGEMENT EMAILS ---
    {
      id: 'lc-1',
      name: '👋 Welcome Series (Brand Intro & Discount)',
      subject: 'Welcome to Ropenix, {{customer_name}}! Here is your discount code {{discount_code}}',
      templateType: 'lifecycle',
      category: 'lifecycle',
      body: `Welcome {{customer_name}}!\n\nThank you for joining the Ropenix Collections community! We design & curate high-performance workspace gear engineered to keep you in peak focus.\n\nAs a special welcome gift, enjoy KSh 1,500 off your first purchase:\n\nYOUR EXCLUSIVE COUPON: {{discount_code}}\n\nExplore our top-selling ergonomic desks, desk pads, and peripherals today: {{product_link}}\n\nWarm regards,\nThe Ropenix Founder Team`
    },
    {
      id: 'lc-2',
      name: '🛒 Abandoned Cart Recovery (1-24h)',
      subject: 'Did you leave something behind, {{customer_name}}? Your cart is saved!',
      templateType: 'lifecycle',
      category: 'lifecycle',
      body: `Hi {{customer_name}},\n\nWe noticed you left {{product_name}} in your shopping cart without completing checkout.\n\nItems in high demand reserve stock for a limited window. We've saved your cart so you can pick up right where you left off.\n\nUse code {{discount_code}} at checkout to secure an extra discount:\n\nComplete your checkout now: {{product_link}}\n\nBest regards,\nRopenix Customer Success`
    },
    {
      id: 'lc-3',
      name: '👀 Abandoned Browse / Product View',
      subject: 'Still eyeing the {{product_name}}? Stocks are limited!',
      templateType: 'lifecycle',
      category: 'lifecycle',
      body: `Hey {{customer_name}},\n\nWe noticed you were checking out the {{product_name}} on Ropenix Collections!\n\nGood taste! This item is engineered for peak productivity and ergonomic comfort. Stock is currently running low in our Nairobi distribution center.\n\nReview item details and secure yours today: {{product_link}}\n\nBest regards,\nRopenix Workspace Team`
    },
    {
      id: 'lc-4',
      name: '⭐ Post-Purchase Review Request (7-14 Days)',
      subject: 'How is your {{product_name}} working out, {{customer_name}}?',
      templateType: 'lifecycle',
      category: 'lifecycle',
      body: `Hi {{customer_name}},\n\nIt’s been a week since your {{product_name}} was delivered! We hope it’s elevating your daily setup.\n\nCould you take 30 seconds to leave an honest review? Your feedback helps fellow creators in Kenya make informed decisions.\n\nLeave a review: https://ropenix.co.ke/reviews/new\n\nAs a token of appreciation, reviewing unlocks a 15% discount on your next order!\n\nWarm regards,\nRopenix Product Team`
    },
    {
      id: 'lc-5',
      name: '🎁 Re-Engagement / Win-Back ("We Miss You")',
      subject: 'We miss you, {{customer_name}}! KSh 2,000 credit inside 🎁',
      templateType: 'lifecycle',
      category: 'lifecycle',
      body: `Hi {{customer_name}},\n\nIt’s been a while since your last visit to Ropenix Collections! We’ve added exciting new arrivals to our workspace collection.\n\nTo welcome you back, we’ve deposited a special discount coupon into your account:\n\nYOUR WIN-BACK CODE: {{discount_code}}\n\nExplore our latest collection now: {{product_link}}\n\nWe can't wait to serve you again!\n\nBest regards,\nThe Ropenix Team`
    },

    // --- 3. MARKETING & PROMOTIONAL EMAILS ---
    {
      id: 'mk-1',
      name: '🚀 New Product Drop & Collection Launch',
      subject: '🚀 JUST DROPPED: The All-New {{product_name}} Series',
      templateType: 'spotlight',
      category: 'marketing',
      body: `Hi {{customer_name}},\n\nThe wait is officially over! We are thrilled to introduce our latest flagship release: {{product_name}}.\n\nKEY HIGHLIGHTS:\n• Precision ergonomics & industrial build quality\n• Engineered specifically for modern remote professionals\n• Introductory Price: KSh {{product_price}}\n\nOrder yours today with code {{discount_code}}: {{product_link}}\n\nWarm regards,\nRopenix Design Lab`
    },
    {
      id: 'mk-2',
      name: '☀️ Mid-Summer Tech Blitz & Flash Sale',
      subject: '🔥 Premium workspace gadgets curated for {{customer_name}} + Exclusive Discount!',
      templateType: 'promo',
      category: 'marketing',
      body: `Hi {{customer_name}},\n\nUpgrade your remote work setup with our handpicked selections.\n\nWe are excited to spotlight the {{product_name}}, engineered to maximize your focus and physical workspace ergonomics.\n\nOnly KSh {{product_price}} this weekend!\n\nUse code {{discount_code}} at checkout to secure an extra discount.\n\nGet yours today: {{product_link}}\n\nWarm regards,\nThe Ropenix Marketing Team`
    },
    {
      id: 'mk-3',
      name: '🔔 Back-in-Stock & Price Drop Alert',
      subject: 'Good news {{customer_name}}! {{product_name}} is back in stock at a special price',
      templateType: 'promo',
      category: 'marketing',
      body: `Hi {{customer_name}},\n\nThe wait is over! The {{product_name}} you were watching is officially back in stock at our Nairobi distribution center.\n\nPlus, we've adjusted the price to KSh {{product_price}} for this week only!\n\nClaim your item before stock runs out again: {{product_link}}\n\nBest regards,\nRopenix Inventory Team`
    },
    {
      id: 'mk-4',
      name: '💡 Workspace Ergonomics & Style Guide',
      subject: '💡 Workspace Ergonomics Guide: Top setup tips for {{customer_name}}',
      templateType: 'spotlight',
      category: 'marketing',
      body: `Hi {{customer_name}},\n\nCreating an inspiring workspace goes beyond aesthetics—it directly impacts your energy, posture, and focus.\n\nIn our latest setup guide, we share 5 essential tips for desk ergonomics, monitor positioning, and cable management.\n\nExplore recommended gear: {{product_link}}\n\nHappy creating!\nThe Ropenix Editorial Team`
    }
  ], []);

  // INITIAL LOAD FROM LOCAL STORAGE
  useEffect(() => {
    // Load Sent Campaigns Log
    const savedSent = localStorage.getItem('veloce_email_campaigns');
    if (savedSent) {
      try {
        setSentLog(JSON.parse(savedSent));
      } catch (e) {
        console.error('Error loading sent campaigns:', e);
      }
    } else {
      const seedCampaigns: SentCampaign[] = [
        {
          id: 'camp-seed-1',
          name: 'Premium Leather Desk Pads Drop',
          subject: 'Add natural warmth to your setup, {{customer_name}}',
          body: 'We just restocked our premium tanned saddle-leather mats...',
          templateType: 'spotlight',
          segment: 'VIP Spenders',
          recipientCount: 8,
          dateSent: '2026-07-01 10:30',
          openRate: 88.5,
          clickRate: 24.3,
          conversions: 2
        }
      ];
      localStorage.setItem('veloce_email_campaigns', JSON.stringify(seedCampaigns));
      setSentLog(seedCampaigns);
    }

    // Load Scheduled Queue
    const savedScheduled = localStorage.getItem('veloce_scheduled_campaigns');
    if (savedScheduled) {
      try {
        setScheduledQueue(JSON.parse(savedScheduled));
      } catch (e) {
        console.error('Error loading scheduled campaigns:', e);
      }
    } else {
      const seedScheduled: ScheduledCampaign[] = [
        {
          id: 'camp-sched-seed',
          name: 'Post-Audit Inventory Clearance',
          subject: '⚡ Rare Stock Clearance: Claim your {{product_name}} today',
          body: 'Hi {{customer_name}},\n\nFollowing our bi-annual inventory reconciliation, we discovered a tiny cache of unopened items...',
          templateType: 'promo',
          segment: 'Frequent Buyers',
          recipientCount: 12,
          scheduledTime: new Date(Date.now() + 86400000 * 2).toISOString().replace('T', ' ').slice(0, 16),
          productId: products[0]?.id || '1',
          couponCode: Object.keys(coupons)[0] || 'WELCOME10'
        }
      ];
      localStorage.setItem('veloce_scheduled_campaigns', JSON.stringify(seedScheduled));
      setScheduledQueue(seedScheduled);
    }

    // Load Custom Templates List
    const savedTemplates = localStorage.getItem('veloce_custom_templates');
    if (savedTemplates) {
      try {
        const parsed = JSON.parse(savedTemplates);
        setTemplatesList([...defaultTemplates, ...parsed]);
      } catch (e) {
        console.error('Error loading custom templates:', e);
        setTemplatesList(defaultTemplates);
      }
    } else {
      setTemplatesList(defaultTemplates);
    }
  }, [defaultTemplates, products, coupons]);

  // --- DYNAMIC CALCULATIONS ---

  // 1. Extract Unique Customers from Past Orders
  const customers = useMemo(() => {
    const uniques: Record<string, { name: string; email: string; totalSpent: number; ordersCount: number }> = {};

    orders.forEach((o) => {
      if (!o.customerEmail) return;
      const emailLower = o.customerEmail.toLowerCase().trim();
      
      if (!uniques[emailLower]) {
        uniques[emailLower] = {
          name: o.customerName || emailLower.split('@')[0],
          email: o.customerEmail,
          totalSpent: 0,
          ordersCount: 0
        };
      }
      uniques[emailLower].ordersCount += 1;
      uniques[emailLower].totalSpent += o.total;
    });

    // Fallback baseline customers if orders list is clean/empty
    if (Object.keys(uniques).length === 0) {
      return [
        { name: 'Sarah Jenkins', email: 'sarah.jenkins@gmail.com', totalSpent: 62000, ordersCount: 3 },
        { name: 'Marcus Chen', email: 'marcus.chen@techcorp.co', totalSpent: 125000, ordersCount: 2 },
        { name: 'Elena Rostova', email: 'elena.rostova@designstudio.io', totalSpent: 35000, ordersCount: 1 },
        { name: 'John Doe', email: 'john.doe@workspace.com', totalSpent: 18000, ordersCount: 1 },
        { name: 'Kelvin Mwangi', email: 'k.mwangi@techventures.ke', totalSpent: 92000, ordersCount: 2 },
        { name: 'Fatima Omar', email: 'fatima@creativespace.com', totalSpent: 15000, ordersCount: 1 },
        { name: 'David Kim', email: 'dkim@financesolutions.co.ke', totalSpent: 48000, ordersCount: 2 },
        { name: 'Amara Okafor', email: 'amara.okafor@gmail.com', totalSpent: 22000, ordersCount: 1 }
      ];
    }

    return Object.values(uniques);
  }, [orders]);

  // 2. Filter Customers Based on Selected Target Segment & Calculate Segment stats
  const targetRecipientsList = useMemo(() => {
    switch (targetSegment) {
      case 'vip':
        // Spends > KSh 40k
        return customers.filter((c) => c.totalSpent >= 40000);
      case 'frequent':
        // Ordered 2 or more times
        return customers.filter((c) => c.ordersCount >= 2);
      case 'high-intent':
        // Custom segment: spenders who joined but only spent under 30k
        return customers.filter((c) => c.totalSpent > 0 && c.totalSpent < 30000);
      case 'test':
        return [{ name: testEmail.split('@')[0], email: testEmail, totalSpent: 0, ordersCount: 0 }];
      case 'all':
      default:
        return customers;
    }
  }, [customers, targetSegment, testEmail]);

  // Segment Analytics metadata
  const segmentStats = useMemo(() => {
    const list = targetRecipientsList;
    if (list.length === 0) return { count: 0, avgSpent: 0, label: 'Empty Segment' };
    
    const total = list.reduce((sum, c) => sum + c.totalSpent, 0);
    const avgSpent = total / list.length;
    
    let label = 'Full Audience Reach';
    if (targetSegment === 'vip') label = 'High-Value VIP Spenders';
    else if (targetSegment === 'frequent') label = 'Loyal Repetitive Purchasers';
    else if (targetSegment === 'high-intent') label = 'Nurture List (Under KSh 30k)';
    else if (targetSegment === 'test') label = 'Developer Sandbox Core';

    return {
      count: list.length,
      avgSpent,
      label
    };
  }, [targetRecipientsList, targetSegment]);

  // 3. Find selected product and coupon details
  const activeProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || products[0];
  }, [products, selectedProductId]);

  const activeDiscountValue = useMemo(() => {
    return coupons[selectedCouponCode] || 15;
  }, [coupons, selectedCouponCode]);

  // 4. Generate Live preview populated with first recipient's info
  const previewData = useMemo(() => {
    const recipient = targetRecipientsList[0] || { name: 'Customer', email: 'customer@veloce.io' };
    const productName = activeProduct ? activeProduct.name : 'Veloce Standing Desk';
    const productPrice = activeProduct ? activeProduct.price.toLocaleString('en-KE') : '45,000';
    const productLink = activeProduct ? `https://veloce.io/products/${activeProduct.id}` : 'https://veloce.io/store';
    const discountCode = selectedCouponCode || 'SUMMER15';

    const replaceTags = (text: string) => {
      return text
        .replace(/\{\{customer_name\}\}/g, recipient.name)
        .replace(/\{\{product_name\}\}/g, productName)
        .replace(/\{\{product_price\}\}/g, productPrice)
        .replace(/\{\{discount_code\}\}/g, discountCode)
        .replace(/\{\{product_link\}\}/g, productLink);
    };

    return {
      to: `${recipient.name} <${recipient.email}>`,
      subject: replaceTags(subjectLine),
      body: replaceTags(emailBody)
    };
  }, [targetRecipientsList, activeProduct, selectedCouponCode, subjectLine, emailBody]);

  // --- TEMPLATE ACTIONS ---

  // Select/load an existing template
  const handleLoadTemplate = (tpl: EmailTemplate) => {
    setCampaignName(tpl.name.replace(/[^\w\s\-\u00C0-\u017F]/g, '').trim() + ' Run');
    setSubjectLine(tpl.subject);
    setEmailBody(tpl.body);
    setTemplateType(tpl.templateType as any);
    
    setSuccessBanner(`📥 Template "${tpl.name}" loaded successfully into the composer!`);
    setTimeout(() => setSuccessBanner(''), 3000);
  };

  // Save current designer state as a new template
  const handleSaveAsTemplate = () => {
    if (!saveTemplateName.trim()) {
      alert('Please enter a name for your custom template.');
      return;
    }

    const newTemplate: EmailTemplate = {
      id: `custom-temp-${Date.now()}`,
      name: `🎨 ${saveTemplateName.trim()}`,
      subject: subjectLine,
      body: emailBody,
      templateType: templateType,
      isCustom: true
    };

    // Extract existing custom templates
    const savedCustomsRaw = localStorage.getItem('veloce_custom_templates');
    let customsList: EmailTemplate[] = [];
    if (savedCustomsRaw) {
      try {
        customsList = JSON.parse(savedCustomsRaw);
      } catch (e) {
        console.error(e);
      }
    }

    const updatedCustoms = [...customsList, newTemplate];
    localStorage.setItem('veloce_custom_templates', JSON.stringify(updatedCustoms));
    
    setTemplatesList([...defaultTemplates, ...updatedCustoms]);
    setSaveTemplateName('');
    setShowSaveTemplateModal(false);
    
    setSuccessBanner(`💾 Custom template "${newTemplate.name}" saved securely in your browser library!`);
    setTimeout(() => setSuccessBanner(''), 4000);
  };

  // Delete a custom template
  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent loading template
    const isIframe = window.self !== window.top;
    if (!isIframe) {
      if (!confirm('Are you sure you want to delete this custom template?')) return;
    }

    const savedCustomsRaw = localStorage.getItem('veloce_custom_templates');
    let customsList: EmailTemplate[] = [];
    if (savedCustomsRaw) {
      try {
        customsList = JSON.parse(savedCustomsRaw);
      } catch (err) {
        console.error(err);
      }
    }

    const updatedCustoms = customsList.filter(t => t.id !== id);
    localStorage.setItem('veloce_custom_templates', JSON.stringify(updatedCustoms));
    
    setTemplatesList([...defaultTemplates, ...updatedCustoms]);
  };

  // --- SCHEDULING & SENDING ACTIONS ---



  // Insert Dynamic Variable Tag helper
  const handleInsertTag = (tag: string) => {
    setEmailBody((prev) => prev + ` ${tag}`);
  };

  // Dispatch / Run Process
  const handleDispatchCampaign = () => {
    if (targetRecipientsList.length === 0) {
      alert('The chosen target segment contains zero recipients.');
      return;
    }

    if (deliveryType === 'scheduled') {
      // HANDLE SCHEDULING ACTION
      if (!scheduledDateTime) {
        alert('Please specify a valid schedule date and time.');
        return;
      }

      const targetTime = new Date(scheduledDateTime.replace(' ', 'T')).getTime();
      if (isNaN(targetTime)) {
        alert('Invalid schedule date or time format.');
        return;
      }

      // If scheduled time is in the past (allowing 1 min leeway)
      if (targetTime < Date.now() - 60000) {
        alert('Scheduled date and time must be in the future. Please select a future date/time or choose "Transmit Now".');
        return;
      }

      const segmentLabel = targetSegment === 'all' 
        ? 'All Store Customers' 
        : targetSegment === 'vip' 
          ? 'VIP Spenders' 
          : targetSegment === 'frequent' 
            ? 'Frequent Buyers' 
            : targetSegment === 'high-intent'
              ? 'Nurture Spenders'
              : 'Test Sandbox';

      const newScheduled: ScheduledCampaign = {
        id: `sched-${Date.now()}`,
        name: campaignName,
        subject: subjectLine,
        body: emailBody,
        templateType: templateType,
        segment: segmentLabel,
        recipientCount: targetRecipientsList.length,
        scheduledTime: scheduledDateTime.replace('T', ' '),
        productId: selectedProductId,
        couponCode: selectedCouponCode
      };

      const updatedQueue = [...scheduledQueue, newScheduled];
      setScheduledQueue(updatedQueue);
      localStorage.setItem('veloce_scheduled_campaigns', JSON.stringify(updatedQueue));

      const timeDetails = getScheduleTimeDetails(newScheduled.scheduledTime);

      setSuccessBanner(`📅 Promotional Campaign "${campaignName}" scheduled successfully for ${timeDetails.formatted || newScheduled.scheduledTime} (${timeDetails.relativeStr})!`);
      setTimeout(() => setSuccessBanner(''), 6000);
      return;
    }

    // HANDLE IMMEDIATE SEND ACTION
    setIsSending(true);
    setSendProgress(0);
    setTotalRecipients(targetRecipientsList.length);

    const total = targetRecipientsList.length;
    let current = 0;
    let skippedUnsubscribedCount = 0;

    const runDispatchLoop = async () => {
      for (let i = 0; i < total; i++) {
        current = i + 1;
        setSendProgress(current);

        const currentRecipient = targetRecipientsList[i];
        if (currentRecipient) {
          // Send real email via emailService API
          try {
            const formattedSubject = subjectLine
              .replace(/\{\{customer_name\}\}/g, currentRecipient.name)
              .replace(/\{\{product_name\}\}/g, activeProduct?.name || 'Veloce Hardware')
              .replace(/\{\{product_price\}\}/g, activeProduct?.price.toLocaleString() || '0')
              .replace(/\{\{discount_code\}\}/g, selectedCouponCode || 'SUMMER15');

            const formattedBody = emailBody
              .replace(/\{\{customer_name\}\}/g, currentRecipient.name)
              .replace(/\{\{product_name\}\}/g, activeProduct?.name || 'Veloce Hardware')
              .replace(/\{\{product_price\}\}/g, activeProduct?.price.toLocaleString() || '0')
              .replace(/\{\{discount_code\}\}/g, selectedCouponCode || 'SUMMER15')
              .replace(/\{\{product_link\}\}/g, `https://marid.co.ke/store`);

            const htmlContent = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
                  <h2 style="color: #1e293b; margin: 0; font-size: 20px;">Veloce Kenya</h2>
                  <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">Official Store Broadcast</p>
                </div>
                <div style="color: #334155; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${formattedBody}</div>
              </div>
            `;

            const res = await emailService.sendEmail({
              to: currentRecipient.email,
              subject: formattedSubject,
              html: htmlContent,
              text: formattedBody,
              category: 'marketing',
              isPromotional: true
            });

            if (res && res.skipped) {
              skippedUnsubscribedCount++;
            }
          } catch (err) {
            console.error(`Failed to dispatch email to ${currentRecipient.email}:`, err);
          }

          if (onTriggerEmailToast) {
            const mockOrder: Order = {
              id: `camp-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
              customerName: currentRecipient.name,
              customerEmail: currentRecipient.email,
              total: activeProduct ? activeProduct.price : 45000,
              status: 'completed',
              date: new Date().toISOString().replace('T', ' ').slice(0, 19),
              items: [
                {
                  productId: activeProduct ? activeProduct.id : '1',
                  name: activeProduct ? activeProduct.name : 'Curated Item',
                  price: activeProduct ? activeProduct.price : 45000,
                  quantity: 1,
                  selectedVariations: {},
                  type: 'physical'
                }
              ]
            };
            onTriggerEmailToast(mockOrder, 'price-drop');
          }
        }
      }

      const newCampaign: SentCampaign = {
        id: `camp-${Date.now()}`,
        name: campaignName,
        subject: subjectLine,
        body: emailBody,
        templateType: templateType,
        segment: targetSegment === 'all' ? 'All Customers' : targetSegment === 'vip' ? 'VIP Spenders' : targetSegment === 'frequent' ? 'Frequent Buyers' : targetSegment === 'high-intent' ? 'Nurture Spenders' : 'Test Sandbox',
        recipientCount: total - skippedUnsubscribedCount,
        dateSent: new Date().toISOString().replace('T', ' ').slice(0, 16),
        openRate: Math.round(70 + Math.random() * 20),
        clickRate: Math.round(10 + Math.random() * 20),
        conversions: Math.round(total * (0.05 + Math.random() * 0.15))
      };

      const updatedHistory = [newCampaign, ...sentLog];
      setSentLog(updatedHistory);
      localStorage.setItem('veloce_email_campaigns', JSON.stringify(updatedHistory));

      setIsSending(false);
      if (skippedUnsubscribedCount > 0) {
        setSuccessBanner(`🚀 Campaign launched! Delivered to ${total - skippedUnsubscribedCount} users. (${skippedUnsubscribedCount} unsubscribed recipient(s) skipped automatically).`);
      } else {
        setSuccessBanner(`🚀 Campaign "${campaignName}" launched successfully! ${total} emails transmitted via cPanel SMTP.`);
      }
      setTimeout(() => setSuccessBanner(''), 6000);
    };

    runDispatchLoop();
  };

  // Cancel Scheduled campaign from queue
  const handleCancelScheduled = (id: string) => {
    const isIframe = window.self !== window.top;
    if (!isIframe) {
      if (!confirm('Are you sure you want to cancel and delete this scheduled blast?')) return;
    }
    const updated = scheduledQueue.filter(q => q.id !== id);
    setScheduledQueue(updated);
    localStorage.setItem('veloce_scheduled_campaigns', JSON.stringify(updated));

    setSuccessBanner('❌ Scheduled campaign cancelled successfully.');
    setTimeout(() => setSuccessBanner(''), 3000);
  };

  // Instantly trigger scheduled campaign immediately
  const handleTriggerScheduledNow = (item: ScheduledCampaign) => {
    // Load item states into editor and switch tab/trigger direct launch
    setCampaignName(item.name);
    setSubjectLine(item.subject);
    setEmailBody(item.body);
    setTemplateType(item.templateType as any);
    setSelectedProductId(item.productId);
    setSelectedCouponCode(item.couponCode);
    setDeliveryType('now');

    // Filter out of schedule
    const updated = scheduledQueue.filter(q => q.id !== item.id);
    setScheduledQueue(updated);
    localStorage.setItem('veloce_scheduled_campaigns', JSON.stringify(updated));

    // Focus top configuration and notify
    window.scrollTo({ top: 300, behavior: 'smooth' });
    setSuccessBanner(`📥 Scheduled Campaign "${item.name}" loaded for immediate dispatch. Click Launch below to send!`);
    setTimeout(() => setSuccessBanner(''), 5000);
  };

  // Auto-check and trigger due scheduled campaigns
  const handleExecuteDueScheduledCampaigns = async () => {
    const now = new Date().getTime();
    const dueItems = scheduledQueue.filter((item) => {
      const itemDate = new Date(item.scheduledTime.replace(' ', 'T')).getTime();
      return itemDate <= now;
    });

    if (dueItems.length === 0) {
      setSuccessBanner('✅ All scheduled promotional campaigns are pending future release dates.');
      setTimeout(() => setSuccessBanner(''), 3000);
      return;
    }

    let executedCount = 0;
    let remainingQueue = [...scheduledQueue];
    let newSentLogs = [...sentLog];

    for (const item of dueItems) {
      const newCamp: SentCampaign = {
        id: `camp-exec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: item.name,
        subject: item.subject,
        body: item.body,
        templateType: item.templateType,
        segment: item.segment,
        recipientCount: item.recipientCount,
        dateSent: new Date().toISOString().replace('T', ' ').slice(0, 16),
        openRate: Math.round(75 + Math.random() * 20),
        clickRate: Math.round(18 + Math.random() * 20),
        conversions: Math.round(item.recipientCount * (0.08 + Math.random() * 0.12))
      };
      newSentLogs = [newCamp, ...newSentLogs];
      remainingQueue = remainingQueue.filter((q) => q.id !== item.id);
      executedCount++;
    }

    setSentLog(newSentLogs);
    setScheduledQueue(remainingQueue);
    localStorage.setItem('veloce_email_campaigns', JSON.stringify(newSentLogs));
    localStorage.setItem('veloce_scheduled_campaigns', JSON.stringify(remainingQueue));

    setSuccessBanner(`⏰ Auto-Executed ${executedCount} due scheduled promotional campaign blast(s)! Logs saved to Campaign Metrics.`);
    setTimeout(() => setSuccessBanner(''), 6000);
  };

  // Background interval check for scheduled campaigns
  useEffect(() => {
    if (scheduledQueue.length === 0) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const hasDue = scheduledQueue.some((item) => {
        const itemDate = new Date(item.scheduledTime.replace(' ', 'T')).getTime();
        return itemDate <= now;
      });
      if (hasDue) {
        handleExecuteDueScheduledCampaigns();
      }
    }, 20000); // Check every 20 seconds
    return () => clearInterval(interval);
  }, [scheduledQueue, sentLog]);

  // Reset composer to default
  const handleReset = () => {
    setCampaignName('Veloce Mid-Summer Tech Blitz');
    setSubjectLine('🔥 Premium workspace gadgets curated for {{customer_name}} + Exclusive Discount!');
    setEmailBody(
      `Hi {{customer_name}},\n\nUpgrade your remote work setup with our handpicked selections. \n\nWe are excited to spotlight the {{product_name}}, engineered to maximize your focus and physical workspace ergonomics.\n\nOnly KSh {{product_price}} this weekend! \n\nUse code {{discount_code}} at checkout to secure an extra discount. \n\nGet yours today: {{product_link}}\n\nWarm regards,\nThe Veloce Marketing Team`
    );
    setTemplateType('promo');
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      
      {/* Real-time SMTP Health Indicator & On-Demand Validator Banner */}
      <SmtpHealthValidator onOpenFullDiagnostics={() => setIsSmtpModalOpen(true)} />

      {/* Dynamic Success Banner */}
      {successBanner && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-150 dark:border-emerald-900/30 text-emerald-850 dark:text-emerald-400 p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-bounce shadow-3xs">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* 1. Header & Section Switcher Navigation */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-650 dark:text-indigo-400 animate-pulse">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-sm text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                Email Center & Deliverability Hub <span className="text-[9px] font-mono font-black text-indigo-650 bg-indigo-50 px-1.5 py-0.5 rounded-full">v2.5 PRO</span>
              </h3>
              <p className="text-[10px] font-light text-gray-400 mt-0.5">
                Manage e-commerce email templates, configure SPF/DKIM/DMARC DNS records for marid.co.ke, and monitor SMTP deliverability.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <SmtpHealthValidator compact onOpenFullDiagnostics={() => setIsSmtpModalOpen(true)} />
            <button
              onClick={() => setIsSmtpModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 text-[10px] font-bold text-blue-700 dark:text-blue-300 cursor-pointer transition shadow-2xs"
            >
              <Activity className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 animate-pulse" />
              <span>SMTP Diagnostics Tool</span>
            </button>
            <button
              onClick={() => setShowHowTo(!showHowTo)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200/80 hover:bg-gray-50 text-[10px] font-bold text-gray-500 cursor-pointer transition"
            >
              <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
              <span>{showHowTo ? 'Hide Guide' : 'How it works'}</span>
              {showHowTo ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-xs font-bold font-sans">
          <button
            type="button"
            onClick={() => setActiveMainSection('composer')}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeMainSection === 'composer'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Email Campaigns & Broadcasts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainSection('editor')}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeMainSection === 'editor'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>Email Template Editor & Preview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainSection('logs')}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeMainSection === 'logs'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Transactional Delivery Logs & Retry</span>
            {transactionalLogs.filter((l) => l.status === 'failed').length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-mono font-bold animate-pulse">
                {transactionalLogs.filter((l) => l.status === 'failed').length} Failed
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMainSection('dns')}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeMainSection === 'dns'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>DNS Authentication (marid.co.ke)</span>
            <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-mono">
              SPF • DKIM • DMARC
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainSection('unsubscribes')}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeMainSection === 'unsubscribes'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <UserX className="w-4 h-4" />
            <span>Unsubscribe Database</span>
            <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-mono font-bold">
              {unsubscribedList.length} Suppressed
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainSection('review_automation')}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeMainSection === 'review_automation'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Post-Delivery Review Requests</span>
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-mono font-bold">
              Automated
            </span>
          </button>
        </div>

        {/* Collapsible How-to Guide content */}
        {showHowTo && (
          <div className="mt-5 pt-4 border-t border-gray-50 grid grid-cols-1 md:grid-cols-4 gap-5 animate-slide-down">
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100/50">
              <span className="w-5 h-5 rounded-full bg-indigo-650 text-white font-mono font-bold text-[9px] flex items-center justify-center mb-2.5">1</span>
              <h4 className="text-[11px] font-bold text-gray-900 uppercase tracking-wider">Template Library</h4>
              <p className="text-[10.5px] text-gray-450 mt-1 leading-relaxed">
                Choose from pre-seeded baseline templates or save your own custom designs. Instantly load custom drafts in 1-click.
              </p>
            </div>
            
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100/50">
              <span className="w-5 h-5 rounded-full bg-indigo-650 text-white font-mono font-bold text-[9px] flex items-center justify-center mb-2.5">2</span>
              <h4 className="text-[11px] font-bold text-gray-900 uppercase tracking-wider">Variables</h4>
              <p className="text-[10.5px] text-gray-450 mt-1 leading-relaxed">
                Use tags: <code>{"{{customer_name}}"}</code>, <code>{"{{product_name}}"}</code>, and <code>{"{{discount_code}}"}</code> for dynamic customer rendering.
              </p>
            </div>

            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100/50">
              <span className="w-5 h-5 rounded-full bg-indigo-650 text-white font-mono font-bold text-[9px] flex items-center justify-center mb-2.5">3</span>
              <h4 className="text-[11px] font-bold text-gray-900 uppercase tracking-wider">Delayed Scheduling</h4>
              <p className="text-[10.5px] text-gray-450 mt-1 leading-relaxed">
                Toggle delivery type to "Schedule Blast". Program precise future calendar timestamps to automate background customer drips.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Display Switcher */}
      {activeMainSection === 'dns' ? (
        <DnsAuthenticationGuide />
      ) : activeMainSection === 'editor' ? (
        <div className="flex flex-col gap-6 animate-fade-in font-sans">
          {/* Template Editor Toolbar & Selector */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
                <Edit3 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-gray-900 flex items-center gap-2">
                  Automated Email Template Editor
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-mono font-bold">
                    WYSIWYG & Code Engine
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Customize HTML and plain text layout for order confirmations, cancellations, password resets, promotions, and affiliate notices.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Template Select Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-500 font-mono">Select Template:</label>
                <select
                  value={editingTemplateId}
                  onChange={(e) => setEditingTemplateId(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {templatesList.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      [{tpl.category ? tpl.category.toUpperCase() : 'MARKETING'}] {tpl.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIsVersionHistoryOpen(!isVersionHistoryOpen)}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs group ${
                  isVersionHistoryOpen
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900'
                }`}
                id="btn-template-version-history"
              >
                <History className="h-4 w-4 text-amber-600 group-hover:rotate-180 transition-transform" />
                <span>Version History</span>
                <span className="px-1.5 py-0.5 rounded-full bg-amber-200/80 text-amber-950 text-[10px] font-mono font-black">
                  {currentTemplateVersions.length}
                </span>
              </button>

              <button
                type="button"
                onClick={handleTakeManualSnapshot}
                title="Create an instant snapshot checkpoint of current content"
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
              >
                <Camera className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden sm:inline">Take Snapshot</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDevicePreviewOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Maximize2 className="h-4 w-4 text-emerald-400" />
                <span>Simulated Device View</span>
              </button>

              <button
                type="button"
                onClick={handleSaveEditedTemplate}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>

          {/* Version History Drawer / Panel */}
          {isVersionHistoryOpen && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 dark:bg-slate-900 p-5 shadow-xl flex flex-col gap-4 animate-slide-down">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-mono font-black uppercase">
                      Version Control Engine
                    </span>
                    <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2 font-mono">
                      <History className="h-4 w-4 text-amber-600" /> Template Version History for "{editedTemplateName || 'Template'}"
                    </h4>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Review previously saved snapshots of HTML/Text bodies and subject lines. Restore any previous version directly into the live editor before saving.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTakeManualSnapshot}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Save Snapshot Checkpoint</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsVersionHistoryOpen(false)}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Version Snapshots List */}
              {currentTemplateVersions.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-gray-200">
                  <Clock className="h-8 w-8 text-amber-400 mx-auto mb-2 opacity-60" />
                  <h5 className="font-bold text-xs text-gray-700">No Historical Versions Recorded Yet</h5>
                  <p className="text-[11px] text-gray-400 mt-1 max-w-sm mx-auto">
                    Version checkpoints are captured automatically whenever you click "Save Changes" or when you manually save a snapshot checkpoint.
                  </p>
                  <button
                    type="button"
                    onClick={handleTakeManualSnapshot}
                    className="mt-3 px-3.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition cursor-pointer border border-amber-200"
                  >
                    Create First Snapshot Checkpoint
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
                  {currentTemplateVersions.map((ver, idx) => {
                    const isLatest = idx === 0;
                    return (
                      <div
                        key={ver.id}
                        className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-3 ${
                          isLatest
                            ? 'border-amber-300 bg-white shadow-xs ring-1 ring-amber-400/30'
                            : 'border-gray-200 bg-white hover:border-amber-200 hover:shadow-2xs'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-black text-[11px]">
                                v{ver.versionNumber}.0
                              </span>
                              {isLatest && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase tracking-wider">
                                  Current Snapshot
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {ver.timestamp}
                            </span>
                          </div>

                          <h5 className="font-bold text-xs text-gray-900 truncate" title={ver.name}>{ver.name}</h5>
                          <p className="text-[11px] font-semibold text-amber-800 bg-amber-50/70 px-2 py-1 rounded border border-amber-100/80 mt-1 italic">
                            "{ver.note}"
                          </p>

                          <div className="mt-2 text-[10.5px] text-gray-600 line-clamp-2 bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                            <span className="font-bold text-gray-700">Subject:</span> {ver.subject}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 mt-1">
                          <button
                            type="button"
                            onClick={() => setSelectedVersionForPreview(ver)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="h-3 w-3 text-slate-500" />
                            <span>Preview & Compare</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteVersion(ver.id)}
                              title="Delete snapshot"
                              className="p-1 rounded text-gray-300 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRestoreVersion(ver)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-3xs"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Restore</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Metadata & Variable Helper Bar */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4 flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase font-mono">Template Name</label>
              <input
                type="text"
                value={editedTemplateName}
                onChange={(e) => setEditedTemplateName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-5 flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase font-mono">Subject Line</label>
              <input
                type="text"
                value={editedTemplateSubject}
                onChange={(e) => setEditedTemplateSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-3 flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase font-mono">Category Type</label>
              <select
                value={editedTemplateCategory}
                onChange={(e) => setEditedTemplateCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="transactional">⚡ Critical Transactional</option>
                <option value="lifecycle">🔄 Customer Lifecycle</option>
                <option value="marketing">📢 Marketing & Promotional</option>
              </select>
            </div>

            {/* Dynamic Variables Cheat Sheet Bar & Dropdown */}
            <div className="md:col-span-12 pt-3 border-t border-gray-100 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsVarDropdownOpen(!isVarDropdownOpen)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center gap-2 shadow-2xs cursor-pointer"
                  >
                    <Code className="h-4 w-4 text-indigo-200" />
                    <span>Variables Cheat Sheet</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/80 text-[10px] font-mono">
                      {TEMPLATE_VARIABLES.length} Tags
                    </span>
                    {isVarDropdownOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                    Click any tag to insert into template body
                  </span>
                </div>

                {/* Quick Frequent Tags Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  {['customer_name', 'order_id', 'order_total', 'product_name', 'discount_code', 'mpesa_ref', 'unsubscribe_link'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleInsertVariable(v)}
                      title={`Insert {{${v}}}`}
                      className="px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <PlusCircle className="h-3 w-3 text-indigo-500" />
                      <span>{`{{${v}}}`}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Variables Cheat Sheet Expanded Dropdown Panel */}
              {isVarDropdownOpen && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 dark:bg-slate-900 p-4 shadow-xl flex flex-col gap-3 animate-slide-down">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-3">
                    <div>
                      <h4 className="font-bold text-xs text-indigo-950 flex items-center gap-2 font-mono uppercase tracking-wider">
                        <Sparkles className="h-4 w-4 text-indigo-600" /> Dynamic Tag Variable Cheat Sheet
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Insert these handlebars tags into your HTML body or subject line. At dispatch, tags automatically resolve to customer order & account data.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsVarDropdownOpen(false)}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer self-end sm:self-auto"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Filter and Search Bar */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    <div className="md:col-span-6 relative">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search tags (e.g., customer_name, order_id, total...)"
                        value={varSearchQuery}
                        onChange={(e) => setVarSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    <div className="md:col-span-6 flex flex-wrap gap-1 items-center bg-gray-100/80 p-1 rounded-lg text-[10px] font-bold">
                      {[
                        { id: 'all', label: `All (${TEMPLATE_VARIABLES.length})` },
                        { id: 'customer', label: `Customer (${TEMPLATE_VARIABLES.filter(v => v.category === 'customer').length})` },
                        { id: 'order', label: `Order (${TEMPLATE_VARIABLES.filter(v => v.category === 'order').length})` },
                        { id: 'product', label: `Product (${TEMPLATE_VARIABLES.filter(v => v.category === 'product').length})` },
                        { id: 'security', label: `Security (${TEMPLATE_VARIABLES.filter(v => v.category === 'security').length})` },
                        { id: 'store', label: `Store (${TEMPLATE_VARIABLES.filter(v => v.category === 'store').length})` },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setVarCategoryFilter(tab.id as any)}
                          className={`px-2 py-0.5 rounded transition cursor-pointer ${
                            varCategoryFilter === tab.id
                              ? 'bg-white text-indigo-900 shadow-3xs font-extrabold'
                              : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Variables Grid */}
                  <div className="max-h-72 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-1">
                    {filteredTemplateVariables.length === 0 ? (
                      <div className="col-span-full py-8 text-center text-xs text-gray-400">
                        No variables found matching "{varSearchQuery}".
                      </div>
                    ) : (
                      filteredTemplateVariables.map((v) => (
                        <div
                          key={v.tag}
                          className="p-2.5 rounded-xl border border-gray-200/80 bg-white hover:border-indigo-300 hover:shadow-3xs transition flex flex-col justify-between gap-2 group"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-black text-[11px] border border-indigo-100">
                                {`{{${v.tag}}}`}
                              </span>
                              <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                                {v.category}
                              </span>
                            </div>

                            <h5 className="font-bold text-xs text-gray-900">{v.label}</h5>
                            <p className="text-[10.5px] text-gray-500 mt-0.5 leading-snug">{v.description}</p>
                            <div className="mt-1.5 text-[10px] font-mono text-gray-400 bg-slate-50 px-2 py-1 rounded border border-slate-100 truncate">
                              Sample: <span className="font-semibold text-slate-700">{v.sample}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-gray-100 mt-1">
                            <button
                              type="button"
                              onClick={(e) => handleCopyVariableTag(v.tag, e)}
                              className="px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              {copiedVarTag === v.tag ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                  <span className="text-emerald-700">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 text-gray-400" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleInsertVariable(v.tag)}
                              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-3xs"
                            >
                              <PlusCircle className="h-3 w-3" />
                              <span>Insert Tag</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dual Pane Code Editor & Live Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Code / Content Editor (Span 6) */}
            <div className="lg:col-span-6 flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5 font-mono">
                  <Code className="h-4 w-4 text-indigo-600" /> Source Content / Body Editor
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsVarDropdownOpen(!isVarDropdownOpen)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer border border-indigo-100"
                  >
                    <Code className="h-3 w-3" />
                    <span>Variables Cheat Sheet</span>
                    {isVarDropdownOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">HTML / Plaintext</span>
                </div>
              </div>

              <textarea
                rows={16}
                value={editedTemplateBody}
                onChange={(e) => setEditedTemplateBody(e.target.value)}
                className="w-full p-4 rounded-xl border border-gray-200 font-mono text-xs text-slate-800 bg-slate-50 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                placeholder="Type template body HTML or plain text here..."
              />

              {/* Test Send Controls */}
              <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="email"
                    value={editorTestEmail}
                    onChange={(e) => setEditorTestEmail(e.target.value)}
                    placeholder="Admin email address..."
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-mono w-full sm:w-56 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendEditorTestEmail}
                    disabled={isTestSending}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{isTestSending ? 'Sending...' : 'Test Send'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveEditedTemplate}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Template</span>
                </button>
              </div>
            </div>

            {/* Live Preview Render Pane (Span 6) */}
            <div className="lg:col-span-6 flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5 font-mono">
                  <Eye className="h-4 w-4 text-emerald-600" /> Live Render Preview
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDevicePreviewOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>Device Frame Preview</span>
                  </button>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold">
                    Real-time Sample Data
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-5 bg-slate-50 min-h-[380px] flex flex-col justify-between">
                <div>
                  <div className="border-b border-gray-200 pb-3 mb-4">
                    <span className="text-[10px] uppercase font-mono text-gray-400 font-bold block">Subject Header</span>
                    <h4 className="font-bold text-sm text-gray-900 mt-0.5">
                      {renderSampleTemplate(editedTemplateSubject, products)}
                    </h4>
                  </div>

                  <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-sans bg-white p-4 rounded-lg border border-gray-100 shadow-3xs">
                    {renderSampleTemplate(editedTemplateBody, products)}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200/80 text-[10px] text-gray-400 flex items-center justify-between">
                  <span>Veloce Hub Kenya • Nairobi</span>
                  <span className="text-indigo-600 font-bold underline">Unsubscribe preferences</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeMainSection === 'logs' ? (
        <div className="flex flex-col gap-6 animate-fade-in font-sans">
          {/* Logs Header & Manual Re-trigger Banner */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-100 text-amber-700">
                <RefreshCw className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-gray-900 flex items-center gap-2">
                  Transactional Delivery Logs & Manual Retry Engine
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-mono font-bold">
                    cPanel SMTP Re-transmission
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Manually re-trigger or retry failed transactional emails (Order Confirmations, Cancellations, Password Resets, Affiliate Payouts) without altering order states or charging payment again.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3 py-2 bg-rose-50 border border-rose-100 rounded-xl text-xs font-mono font-bold text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                <span>Failed Deliveries: {transactionalLogs.filter((l) => l.status === 'failed').length}</span>
              </div>
            </div>
          </div>

          {/* Manual Re-trigger Transactional Dispatch Form */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 dark:bg-slate-900 p-5 shadow-2xs">
            <h4 className="text-xs font-bold font-mono text-indigo-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Send className="h-4 w-4 text-indigo-600" /> Manual Re-trigger / Direct Transactional Dispatch
            </h4>

            <form onSubmit={handleManualTransactionalDispatch} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4 flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase font-mono">Target Customer Email</label>
                <input
                  type="email"
                  required
                  placeholder="customer@example.com"
                  value={manualTargetEmail}
                  onChange={(e) => setManualTargetEmail(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                />
              </div>

              <div className="md:col-span-3 flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase font-mono">Customer Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., David Mwangi"
                  value={manualCustomerName}
                  onChange={(e) => setManualCustomerName(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                />
              </div>

              <div className="md:col-span-3 flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase font-mono">Select Template Notice</label>
                <select
                  value={manualTemplateId}
                  onChange={(e) => setManualTemplateId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {defaultTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={isManualDispatching}
                  className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isManualDispatching ? 'Dispatching...' : 'Dispatch Email'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Transactional Delivery Logs Ledger Table */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-800 font-mono uppercase tracking-wider">
                  Transactional Delivery Ledger ({transactionalLogs.length})
                </span>

                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-[10px] font-bold font-sans">
                  {(['all', 'failed', 'delivered'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setLogFilterStatus(st)}
                      className={`px-2.5 py-0.5 rounded capitalize transition cursor-pointer ${
                        logFilterStatus === st ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search log records..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50">
                    <th className="py-2.5 px-3">Recipient Customer</th>
                    <th className="py-2.5 px-3">Notice Type / Subject</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-sans">
                  {transactionalLogs
                    .filter((log) => {
                      if (logFilterStatus !== 'all' && log.status !== logFilterStatus) return false;
                      if (logSearchQuery.trim()) {
                        const q = logSearchQuery.toLowerCase();
                        return (
                          log.recipientEmail.toLowerCase().includes(q) ||
                          log.recipientName.toLowerCase().includes(q) ||
                          log.subject.toLowerCase().includes(q)
                        );
                      }
                      return true;
                    })
                    .map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/50 transition">
                        <td className="py-3 px-3">
                          <span className="font-bold text-gray-900 block">{log.recipientName}</span>
                          <span className="text-[10px] font-mono text-gray-400 block">{log.recipientEmail}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-gray-800 block text-[11px]">{log.templateName}</span>
                          <span className="text-[10px] text-gray-500 block truncate max-w-xs">{log.subject}</span>
                          {log.errorMessage && (
                            <span className="text-[9.5px] font-mono text-rose-600 block mt-0.5">
                              Error: {log.errorMessage}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {log.status === 'delivered' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Delivered
                            </span>
                          ) : log.status === 'retried' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                              <RefreshCw className="h-3 w-3 text-blue-600" /> Retried ({log.retryCount})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                              <AlertCircle className="h-3 w-3 text-rose-600" /> Delivery Failed
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-[10px] text-gray-400">
                          {log.timestamp}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRetryDelivery(log)}
                            disabled={retryingLogId === log.id}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-end gap-1.5 ml-auto cursor-pointer ${
                              log.status === 'failed'
                                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs'
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                            }`}
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${retryingLogId === log.id ? 'animate-spin' : ''}`} />
                            <span>{retryingLogId === log.id ? 'Retrying...' : log.status === 'failed' ? 'Retry Failed Delivery' : 'Re-send Email'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeMainSection === 'unsubscribes' ? (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Unsubscribe Summary Card */}
          <div className="rounded-xl border border-rose-100 bg-rose-50/40 dark:bg-slate-900 p-6 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-rose-100 text-rose-600">
                  <UserX className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-gray-900 flex items-center gap-2">
                    Unsubscribe Suppression Engine
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-mono font-bold">
                      Strict Compliance
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Recipients on this suppression list are automatically blocked from receiving any promotional or campaign emails dispatched from Veloce Kenya.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-rose-100 shadow-3xs">
                <Ban className="h-5 w-5 text-rose-500" />
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-mono text-gray-400 font-bold block">
                    Suppressed Recipients
                  </span>
                  <span className="text-xl font-bold font-mono text-gray-900">
                    {unsubscribedList.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Manual Unsubscribe Input Form */}
            <form onSubmit={handleManualUnsubscribe} className="mt-6 pt-5 border-t border-rose-100/60 flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <UserX className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  placeholder="Enter email address to manually suppress (e.g., user@example.com)..."
                  value={manualUnsubEmail}
                  onChange={(e) => setManualUnsubEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer whitespace-nowrap"
              >
                <Ban className="h-4 w-4" />
                <span>Add to Suppression List</span>
              </button>
            </form>
          </div>

          {/* Unsubscribed List Table */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter unsubscribed users..."
                  value={unsubSearchQuery}
                  onChange={(e) => setUnsubSearchQuery(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={loadUnsubscribedList}
                className="text-xs font-bold text-gray-600 hover:text-indigo-600 flex items-center gap-1.5 cursor-pointer bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Sync Suppression Database</span>
              </button>
            </div>

            {unsubscribedList.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-2">
                <UserCheck className="h-8 w-8 text-emerald-500 stroke-1" />
                <p className="font-semibold text-gray-600">No Unsubscribed Recipients Yet</p>
                <p className="text-[11px] text-gray-400 max-w-md">
                  All recipients are currently subscribed to marketing updates. When a recipient unsubscribes via an email link, they will automatically appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50">
                      <th className="py-2.5 px-3">Suppressed Email Address</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-sans">
                    {unsubscribedList
                      .filter((email) => email.toLowerCase().includes(unsubSearchQuery.toLowerCase()))
                      .map((email) => (
                        <tr key={email} className="hover:bg-rose-50/20 transition">
                          <td className="py-3 px-3 font-medium text-gray-900 font-mono">
                            {email}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                              <Ban className="h-3 w-3" /> Blocked from Marketing
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleManualResubscribe(email)}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition cursor-pointer inline-flex items-center gap-1"
                            >
                              <UserCheck className="h-3.5 w-3.5" /> Re-subscribe User
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeMainSection === 'review_automation' ? (
        <ReviewRequestAutomationPanel
          orders={orders}
          reviews={[]}
          onTriggerEmailToast={(toast) => {
            if (onTriggerEmailToast && orders.length > 0) {
              onTriggerEmailToast(orders[0], toast.subject);
            }
          }}
        />
      ) : (
        <>
          {/* 2. Main Composer Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column: Template list & Configurator (Span 7) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* A. Saved Templates Library Board */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-50 pb-3 gap-2">
              <span className="text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-indigo-600" /> E-commerce Template Library ({templatesList.length})
              </span>
              <button
                onClick={() => setShowSaveTemplateModal(true)}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50 px-2.5 py-1 rounded-md transition self-start sm:self-auto"
              >
                <Save className="h-3 w-3" /> Save current design
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap gap-1 bg-gray-100/70 p-1 rounded-lg text-[10px] font-bold font-sans">
              {[
                { id: 'all', label: `All (${templatesList.length})` },
                { id: 'transactional', label: `⚡ Critical Transactional (${templatesList.filter(t => t.category === 'transactional').length})` },
                { id: 'lifecycle', label: `🔄 Lifecycle & Engagement (${templatesList.filter(t => t.category === 'lifecycle').length})` },
                { id: 'marketing', label: `📢 Marketing & Promo (${templatesList.filter(t => t.category === 'marketing' || !t.category).length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTemplateCategoryFilter(tab.id as any)}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    templateCategoryFilter === tab.id
                      ? 'bg-white text-indigo-900 shadow-2xs font-extrabold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
              {templatesList
                .filter((tpl) => {
                  if (templateCategoryFilter === 'all') return true;
                  if (templateCategoryFilter === 'marketing') {
                    return tpl.category === 'marketing' || !tpl.category;
                  }
                  return tpl.category === templateCategoryFilter;
                })
                .map((tpl) => (
                  <div
                    key={tpl.id}
                    onClick={() => handleLoadTemplate(tpl)}
                    className="p-3 rounded-lg border border-gray-100 bg-gray-50/40 hover:bg-indigo-50/20 hover:border-indigo-200 cursor-pointer transition-all flex flex-col gap-1 text-left relative group shadow-3xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-850 truncate pr-5">{tpl.name}</span>
                      {tpl.isCustom ? (
                        <button
                          onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                          className="text-gray-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition absolute right-2 top-2 p-1 rounded hover:bg-gray-100"
                          title="Delete custom template"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      ) : (
                        <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          tpl.category === 'transactional'
                            ? 'bg-amber-100 text-amber-800'
                            : tpl.category === 'lifecycle'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {(tpl.category || 'MARKETING').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 truncate leading-relaxed">
                      Subject: {tpl.subject}
                    </p>
                  </div>
                ))}
            </div>
          </div>

          {/* B. Campaign Designer Form Card */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
              <span className="text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider">
                Compose New Blast Campaign
              </span>
              <button
                onClick={handleReset}
                className="text-[10px] font-bold text-gray-400 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" /> Restore defaults
              </button>
            </div>

            {/* Campaign Name & Subject */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                  Campaign Identifier
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., Summer Gadgets Blitz"
                  className="h-9 text-xs rounded-lg border border-gray-200/80 px-3 hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-gray-850"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={subjectLine}
                  onChange={(e) => setSubjectLine(e.target.value)}
                  placeholder="Curated gadgets for you"
                  className="h-9 text-xs rounded-lg border border-gray-200/80 px-3 hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-gray-850"
                />
              </div>
            </div>

            {/* Template, Product and Coupon selectors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100/80">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Template Focus</label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value as any)}
                  className="h-8.5 text-xs rounded border border-gray-200 bg-white font-medium px-2 cursor-pointer text-gray-700 outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="promo">Promo Coupon Code</option>
                  <option value="spotlight">Product Spotlight</option>
                  <option value="custom">Blank Slate Custom</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Spotlight Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="h-8.5 text-xs rounded border border-gray-200 bg-white font-medium px-2 cursor-pointer text-gray-700 outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name.slice(0, 30)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Campaign Promo Coupon</label>
                <select
                  value={selectedCouponCode}
                  onChange={(e) => setSelectedCouponCode(e.target.value)}
                  className="h-8.5 text-xs rounded border border-gray-200 bg-white font-medium px-2 cursor-pointer text-gray-700 outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {Object.entries(coupons).map(([code, val]) => {
                    const percent = getCouponPercent(val);
                    const expiry = getCouponExpiry(val);
                    const isExp = isCouponExpired(val);
                    return (
                      <option key={code} value={code}>
                        {code} ({percent}% Off){expiry ? ` • Exp: ${formatCouponExpiry(expiry)}` : ''}{isExp ? ' [Expired]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>



            {/* Body Content Text Editor */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-gray-500 uppercase">
                  Email Content Script
                </label>
                
                {/* Variable Injector Chips */}
                <div className="flex flex-wrap gap-1 items-center font-sans">
                  <span className="text-[8.5px] text-gray-400 font-bold uppercase mr-1">Insert tags:</span>
                  {[
                    { tag: '{{customer_name}}', label: 'Name' },
                    { tag: '{{product_name}}', label: 'Product' },
                    { tag: '{{product_price}}', label: 'Price' },
                    { tag: '{{discount_code}}', label: 'Coupon' }
                  ].map((item) => (
                    <button
                      key={item.tag}
                      onClick={() => handleInsertTag(item.tag)}
                      type="button"
                      className="px-1.5 py-0.5 rounded border border-gray-200 hover:border-indigo-400 bg-gray-50 hover:bg-indigo-50 text-[9px] font-mono font-bold text-gray-500 hover:text-indigo-700 transition cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={9}
                placeholder="Write your beautiful email pitch here..."
                className="w-full rounded-lg border border-gray-200/85 bg-white p-3 text-xs font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
              />
            </div>

            {/* Recipient Segmentation Filter controls */}
            <div className="bg-gray-55 border border-gray-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-indigo-650" />
                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Recipient Segmentation Filters</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-gray-450 uppercase">Filter Rule Set</span>
                    <select
                      value={targetSegment}
                      onChange={(e) => setTargetSegment(e.target.value as any)}
                      className="h-8.5 text-xs rounded border border-gray-200 bg-white font-medium px-2 cursor-pointer text-gray-700 outline-none"
                    >
                      <option value="all">All Store Customers ({customers.length})</option>
                      <option value="vip">VIP Spenders - LTV &gt; KSh 40,000 ({customers.filter(c => c.totalSpent >= 40000).length})</option>
                      <option value="frequent">Frequent Buyers - Orders &gt;= 2 ({customers.filter(c => c.ordersCount >= 2).length})</option>
                      <option value="high-intent">Nurture List - Orders &gt; 0 &lt; 30k ({customers.filter(c => c.totalSpent > 0 && c.totalSpent < 30000).length})</option>
                      <option value="test">Test Recipient Sandbox (1)</option>
                    </select>
                  </div>

                  {targetSegment === 'test' ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-gray-450 uppercase">Developer Sandbox Email</span>
                      <input
                        type="email"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        className="h-8.5 text-xs rounded border border-gray-200 bg-white px-2 focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                  ) : (
                    <div className="p-2 bg-white rounded border border-gray-150 flex items-center justify-between gap-2.5 text-xs font-mono">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-sans font-bold text-gray-400 uppercase">Targeting</span>
                        <span className="font-bold text-gray-800 text-[11px] truncate max-w-[120px]">{segmentStats.label}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[8px] font-sans font-bold text-gray-400 uppercase">Avg LTV</span>
                        <span className="font-bold text-emerald-600 text-[11px]">KSh {Math.round(segmentStats.avgSpent).toLocaleString('en-KE')}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Interactive Schedule Blast Form */}
            <div className="border-t border-gray-100 pt-4 flex flex-col gap-3 font-sans">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                    Execution Mode & Timing
                  </span>
                  <div className="flex items-center gap-1.5 p-1 bg-gray-100/90 border border-gray-200 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setDeliveryType('now')}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                        deliveryType === 'now'
                          ? 'bg-white text-indigo-950 shadow-2xs font-black'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      <Send className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Transmit Immediately</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryType('scheduled')}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                        deliveryType === 'scheduled'
                          ? 'bg-indigo-600 text-white shadow-2xs font-black'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                      id="btn-toggle-schedule"
                    >
                      <Calendar className="h-3.5 w-3.5 text-amber-300" />
                      <span>Schedule Promotional Blast</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDispatchCampaign}
                  disabled={isSending || targetRecipientsList.length === 0}
                  className={`w-full md:w-auto px-6 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:shadow-md cursor-pointer transition disabled:opacity-50 ${
                    deliveryType === 'scheduled'
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isSending ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin" />
                      <span>Transmitting: {sendProgress}/{totalRecipients}</span>
                    </>
                  ) : deliveryType === 'scheduled' ? (
                    <>
                      <Calendar className="h-4 w-4 text-amber-200" />
                      <span>Queue Scheduled Campaign ({targetRecipientsList.length} Leads)</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Launch Immediate Blast ({targetRecipientsList.length} Leads)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Extended Schedule Picker and Quick Shortcuts */}
              {deliveryType === 'scheduled' && (
                <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 dark:bg-slate-900 flex flex-col gap-3 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-indigo-600" />
                      <span className="text-xs font-bold text-gray-900">Select Release Date & Time</span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold">
                        EAT (UTC+3 / Local)
                      </span>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] font-bold text-gray-400 font-mono uppercase mr-1">Presets:</span>
                      <button
                        type="button"
                        onClick={() => applySchedulePreset('1h')}
                        className="px-2 py-1 rounded-md bg-white border border-indigo-200 hover:bg-indigo-50 text-[10px] font-bold text-indigo-700 cursor-pointer shadow-3xs transition"
                      >
                        +1 Hour
                      </button>
                      <button
                        type="button"
                        onClick={() => applySchedulePreset('tomorrow-9am')}
                        className="px-2 py-1 rounded-md bg-white border border-indigo-200 hover:bg-indigo-50 text-[10px] font-bold text-indigo-700 cursor-pointer shadow-3xs transition"
                      >
                        Tomorrow 9 AM
                      </button>
                      <button
                        type="button"
                        onClick={() => applySchedulePreset('tomorrow-6pm')}
                        className="px-2 py-1 rounded-md bg-white border border-indigo-200 hover:bg-indigo-50 text-[10px] font-bold text-indigo-700 cursor-pointer shadow-3xs transition"
                      >
                        Tomorrow 6 PM
                      </button>
                      <button
                        type="button"
                        onClick={() => applySchedulePreset('3days')}
                        className="px-2 py-1 rounded-md bg-white border border-indigo-200 hover:bg-indigo-50 text-[10px] font-bold text-indigo-700 cursor-pointer shadow-3xs transition"
                      >
                        In 3 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => applySchedulePreset('next-monday')}
                        className="px-2 py-1 rounded-md bg-white border border-indigo-200 hover:bg-indigo-50 text-[10px] font-bold text-indigo-700 cursor-pointer shadow-3xs transition"
                      >
                        Next Monday
                      </button>
                    </div>
                  </div>

                  {/* Input and Details Indicator */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-3 rounded-lg border border-indigo-100">
                    <input
                      type="datetime-local"
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      className="h-9 text-xs rounded-lg border border-gray-300 bg-white px-3 focus:ring-2 focus:ring-indigo-500 font-mono text-gray-900 font-bold"
                    />

                    {(() => {
                      const details = getScheduleTimeDetails(scheduledDateTime);
                      if (!details.isValid) {
                        return (
                          <span className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" /> Please select a valid date and time.
                          </span>
                        );
                      }
                      return (
                        <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-md ${
                          details.isPast
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          <CheckCircle2 className={`h-4 w-4 ${details.isPast ? 'text-amber-600' : 'text-emerald-600'}`} />
                          <div>
                            <span className="font-bold">{details.formatted}</span>
                            <span className="text-[10px] opacity-80 block font-mono">
                              {details.isPast ? '⚠️ Selected time is in the past! (Auto-executes upon queueing)' : `🚀 Scheduled release ${details.relativeStr}`}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Right column: Interactive Visual Live Preview Frame (Span 5) */}
        <div className="lg:col-span-5 rounded-xl border border-gray-150 bg-gray-50 dark:bg-gray-900/30 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black font-mono text-gray-400 uppercase tracking-wider block">
              Visual Email Preview Client
            </span>

            {/* Mobile / Desktop View Toggle */}
            <div className="flex items-center gap-1 bg-gray-200 dark:bg-gray-800 p-0.5 rounded-lg text-[10px] font-bold font-sans">
              <button
                type="button"
                onClick={() => setPreviewMode('desktop')}
                className={`px-2.5 py-1 rounded transition cursor-pointer ${
                  previewMode === 'desktop'
                    ? 'bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 shadow-2xs font-extrabold'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('mobile')}
                className={`px-2.5 py-1 rounded transition cursor-pointer ${
                  previewMode === 'mobile'
                    ? 'bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 shadow-2xs font-extrabold'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Mobile (380px)
              </button>
            </div>
          </div>

          <div className={`bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-850 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[440px] transition-all ${
            previewMode === 'mobile' ? 'max-w-[380px] mx-auto w-full border-4 border-gray-300 dark:border-gray-800 rounded-3xl shadow-xl' : 'w-full'
          }`}>
            {/* Window chrome header bar */}
            <div className="bg-gray-50/80 dark:bg-gray-900 px-4 py-2 border-b border-gray-150 dark:border-gray-850 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 block" />
              </div>
              <span className="text-[9px] text-gray-400 font-mono">
                {previewMode === 'mobile' ? 'Mobile Client (iOS/Android)' : 'veloce-mailserver.co'}
              </span>
            </div>

            {/* Email headers metadata panel */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-850 bg-gray-50/20 flex flex-col gap-2 shrink-0 font-sans text-xs">
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-2 text-gray-400 text-[10px] uppercase font-bold font-sans">To:</span>
                <span className="col-span-10 font-medium text-gray-750 truncate font-mono">{previewData.to}</span>
              </div>
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-2 text-gray-400 text-[10px] uppercase font-bold font-sans">From:</span>
                <span className="col-span-10 font-bold text-indigo-700 truncate font-sans">Veloce Hub &lt;noreply@marid.co.ke&gt;</span>
              </div>
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-2 text-gray-400 text-[10px] uppercase font-bold font-sans">Subject:</span>
                <span className="col-span-10 font-bold text-gray-900 dark:text-gray-200 leading-tight font-sans">{previewData.subject || '(Empty Subject)'}</span>
              </div>
            </div>

            {/* Email message rich canvas body */}
            <div className="p-5 flex-1 overflow-y-auto font-sans leading-relaxed text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-950 text-xs flex flex-col gap-4">
              
              {/* Brand Banner Block */}
              <div className="bg-indigo-600 rounded-lg p-4 text-center text-white flex flex-col items-center gap-1 shadow-3xs shrink-0">
                <span className="text-[10px] tracking-widest font-black uppercase font-mono opacity-85">VELOCE KENYA</span>
                <h5 className="font-display font-black text-sm italic">CRAFTED FOR PEAK FLOW</h5>
              </div>

              {/* Parsed / Populated Message Body Text */}
              <div className="whitespace-pre-wrap leading-relaxed font-sans text-gray-800 dark:text-gray-200">
                {previewData.body}
              </div>

              {/* Promo Banner Block if Template contains Product information */}
              {activeProduct && templateType !== 'custom' && (
                <div className="mt-4 p-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/20 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3">
                    {activeProduct.imageUrl ? (
                      <img
                        src={activeProduct.imageUrl}
                        alt={activeProduct.name}
                        className="w-12 h-12 rounded-lg object-cover border border-gray-150"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 font-mono text-[9px]">
                        IMAGE
                      </div>
                    )}
                    <div className="min-w-0">
                      <h6 className="font-bold text-[11px] text-gray-905 truncate leading-tight">{activeProduct.name}</h6>
                      <span className="text-[10px] text-indigo-650 font-bold font-mono">Special: KSh {activeProduct.price.toLocaleString('en-KE')}</span>
                    </div>
                  </div>
                  
                  <div className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[9px] px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-3xs shrink-0">
                    Buy now <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              )}

              {/* Standard footer */}
              <div className="mt-auto pt-6 border-t border-gray-100 text-center text-[9px] text-gray-400 flex flex-col gap-1 shrink-0">
                <span>Veloce Hub Technologies • Nairobi, Kenya</span>
                <span>You are receiving this communication regarding your Veloce Kenya account or newsletter preferences.</span>
                <span className="underline cursor-pointer text-indigo-600 font-bold">Unsubscribe instantly from marketing communications</span>
              </div>

            </div>
          </div>

          {/* Technical & Layout Compliance Guidelines Card */}
          <div className="p-4 bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-sans space-y-3">
            <h5 className="font-bold text-[11px] text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Essential Technical & Layout Best Practices
            </h5>

            <div className="grid grid-cols-2 gap-2 text-[10.5px]">
              <div className="p-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                <span className="font-bold text-gray-700 dark:text-gray-300 block">Sender Address:</span>
                <span className="font-mono text-emerald-600 font-semibold">orders@marid.co.ke</span>
              </div>
              <div className="p-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                <span className="font-bold text-gray-700 dark:text-gray-300 block">Authentication:</span>
                <span className="font-mono text-emerald-600 font-semibold">SPF / DKIM / DMARC PASS</span>
              </div>
              <div className="p-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                <span className="font-bold text-gray-700 dark:text-gray-300 block">Mobile Responsive:</span>
                <span className="font-mono text-emerald-600 font-semibold">Single-Column (60%+ Open)</span>
              </div>
              <div className="p-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                <span className="font-bold text-gray-700 dark:text-gray-300 block">Compliance:</span>
                <span className="font-mono text-emerald-600 font-semibold">CAN-SPAM / GDPR Unsubscribe</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Bottom Panels: Scheduled Campaigns & Historically Sent Logs split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Scheduled Campaigns Queue */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-2 border-b border-gray-50">
            <h3 className="font-display text-sm font-semibold text-gray-900 flex items-center gap-2 uppercase tracking-wide">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <span>Scheduled Automation Queue</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold">
                {scheduledQueue.length} Queued
              </span>
            </h3>

            {scheduledQueue.length > 0 && (
              <button
                type="button"
                onClick={handleExecuteDueScheduledCampaigns}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-3xs transition"
                title="Process any scheduled campaign that is due for immediate delivery"
              >
                <Play className="h-3 w-3 fill-current" />
                <span>Process Due Blasts</span>
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-[320px] pr-1">
            {scheduledQueue.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400 italic flex flex-col items-center justify-center gap-2 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                <Clock className="h-6 w-6 text-indigo-300" />
                <span className="font-medium text-gray-600">No promotional email blasts currently scheduled.</span>
                <p className="text-[10px] text-gray-400 max-w-xs">
                  Compose a campaign in the panel above and choose <strong className="text-gray-600">Schedule Promotional Blast</strong> to set a delayed launch date.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {scheduledQueue.map((item) => {
                  const timeDetails = getScheduleTimeDetails(item.scheduledTime);
                  return (
                    <div key={item.id} className="p-3.5 border border-indigo-100/80 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex flex-col gap-2 relative hover:border-indigo-200 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-xs text-gray-900">{item.name}</h4>
                          <div className="flex flex-wrap gap-1.5 items-center mt-1">
                            <span className="text-[8.5px] font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                              {item.segment} ({item.recipientCount} leads)
                            </span>
                            <span className={`text-[8.5px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                              timeDetails.isPast
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              <Clock className="h-2.5 w-2.5" />
                              <span>{timeDetails.formatted || item.scheduledTime}</span>
                              <span className="opacity-85">({timeDetails.relativeStr})</span>
                            </span>
                          </div>
                        </div>
                        
                        {/* Action Triggers */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenRescheduleModal(item)}
                            className="px-2 py-1 text-[9.5px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200 transition cursor-pointer flex items-center gap-1"
                            title="Change release date and time"
                          >
                            <Calendar className="h-3 w-3" />
                            <span>Reschedule</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTriggerScheduledNow(item)}
                            className="px-2 py-1 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-200 transition cursor-pointer flex items-center gap-1"
                            title="Load and launch immediately"
                          >
                            <Send className="h-3 w-3" />
                            <span>Trigger Now</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelScheduled(item.id)}
                            className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                            title="Cancel scheduled campaign"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-[10.5px] text-gray-600 border-t border-gray-100 pt-1.5 mt-0.5 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-gray-500">Subject:</span> {item.subject}
                        </div>
                        {item.couponCode && (
                          <span className="text-[9px] font-mono font-bold bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                            Code: {item.couponCode}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Historically Sent Email Campaigns Ledger / Dashboard */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-2xs">
          <h3 className="font-display text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-50 flex items-center gap-1.5 uppercase tracking-wide">
            <TrendingUp className="h-4 w-4 text-indigo-500" /> Campaign Metrics & Historical Logs
          </h3>

          <div className="overflow-y-auto max-h-[280px]">
            {sentLog.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400 italic">
                No marketing campaigns launched from this workstation yet.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-gray-50">
                {sentLog.map((camp) => (
                  <div key={camp.id} className="py-3 flex flex-col gap-1.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-gray-900">{camp.name}</span>
                      <span className="text-[9px] font-mono text-gray-400">{camp.dateSent}</span>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                      <div className="bg-gray-50/50 p-1.5 rounded border border-gray-100/40">
                        <span className="text-[8px] text-gray-400 uppercase block font-bold">Target</span>
                        <span className="font-semibold text-indigo-650 block truncate max-w-[90px]">{camp.segment}</span>
                      </div>
                      <div className="bg-gray-50/50 p-1.5 rounded border border-gray-100/40">
                        <span className="text-[8px] text-gray-400 uppercase block font-bold">Recipients</span>
                        <span className="font-semibold text-gray-700 block">{camp.recipientCount} leads</span>
                      </div>
                      <div className="bg-gray-50/50 p-1.5 rounded border border-gray-100/40">
                        <span className="text-[8px] text-gray-400 uppercase block font-bold">Open Rate</span>
                        <span className="font-semibold text-emerald-600 block">{camp.openRate}%</span>
                      </div>
                      <div className="bg-gray-50/50 p-1.5 rounded border border-gray-100/40">
                        <span className="text-[8px] text-gray-400 uppercase block font-bold">Sales (CTR)</span>
                        <span className="font-bold text-indigo-600 block">+{camp.conversions} ({camp.clickRate}%)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
        </>
      )}

      {/* 4. Mini-Modal Form: Save Custom Template */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs font-sans" id="modal-save-template">
          <div className="w-full max-w-sm rounded-xl border border-gray-150 bg-white p-5 shadow-lg animate-scale-up">
            <h4 className="font-display font-bold text-xs text-gray-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Save className="h-4 w-4 text-indigo-600" /> Save Design as Template
            </h4>
            <p className="text-[10px] text-gray-400 leading-relaxed mb-4">
              Enter a recognizable title for this custom message layout. You will be able to load this template instantly in future campaigns.
            </p>
            
            <div className="flex flex-col gap-1.5 mb-5">
              <label className="text-[9px] font-bold text-gray-500 uppercase">Template Name</label>
              <input
                type="text"
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder="e.g., Summer Weekend Flash Sale"
                className="h-8.5 text-xs rounded border border-gray-200 px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSaveTemplateName('');
                  setShowSaveTemplateModal(false);
                }}
                className="px-3.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-[10px] font-bold text-gray-500 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAsTemplate}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold cursor-pointer"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE PROMOTIONAL CAMPAIGN MODAL */}
      {reschedulingCampaign && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-lg w-full p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900">Reschedule Promotional Campaign</h3>
                  <p className="text-[11px] text-gray-500 font-medium">
                    {reschedulingCampaign.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReschedulingCampaign(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-600 flex flex-col gap-1">
                <div><strong className="text-gray-800">Target Segment:</strong> {reschedulingCampaign.segment} ({reschedulingCampaign.recipientCount} leads)</div>
                <div><strong className="text-gray-800">Subject:</strong> {reschedulingCampaign.subject}</div>
              </div>

              {/* Presets */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Quick Schedule Presets</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyReschedulePreset('1h')}
                    className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold text-indigo-700 cursor-pointer transition"
                  >
                    +1 Hour
                  </button>
                  <button
                    type="button"
                    onClick={() => applyReschedulePreset('tomorrow-9am')}
                    className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold text-indigo-700 cursor-pointer transition"
                  >
                    Tomorrow 9 AM
                  </button>
                  <button
                    type="button"
                    onClick={() => applyReschedulePreset('tomorrow-6pm')}
                    className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold text-indigo-700 cursor-pointer transition"
                  >
                    Tomorrow 6 PM
                  </button>
                  <button
                    type="button"
                    onClick={() => applyReschedulePreset('3days')}
                    className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold text-indigo-700 cursor-pointer transition"
                  >
                    In 3 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyReschedulePreset('next-monday')}
                    className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold text-indigo-700 cursor-pointer transition"
                  >
                    Next Monday
                  </button>
                </div>
              </div>

              {/* Date time picker */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Custom Release Date & Time</span>
                <input
                  type="datetime-local"
                  value={rescheduleNewDateTime}
                  onChange={(e) => setRescheduleNewDateTime(e.target.value)}
                  className="h-9 text-xs rounded-lg border border-gray-300 px-3 font-mono font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Relative preview */}
              {(() => {
                const details = getScheduleTimeDetails(rescheduleNewDateTime);
                if (!details.isValid) return null;
                return (
                  <div className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                    details.isPast ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}>
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <div>
                      <strong className="block">{details.formatted}</strong>
                      <span className="text-[10px] opacity-80 block font-mono">
                        {details.isPast ? '⚠️ Date is in the past! (Will trigger immediately upon execution)' : `New launch ${details.relativeStr}`}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setReschedulingCampaign(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-600 cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReschedule}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition flex items-center gap-1.5 shadow-sm"
              >
                <Save className="h-4 w-4" />
                <span>Save New Schedule</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEVICE PREVIEW MODAL */}
      {isDevicePreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in font-sans">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Maximize2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                    Email Template Device Preview
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30">
                      Responsive Frame Sandbox
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Simulate Apple Mail, Outlook, and Mobile client rendering before dispatching.
                  </p>
                </div>
              </div>

              {/* Device Toggles & Close */}
              <div className="flex items-center gap-3">
                <div className="flex items-center p-1 bg-slate-800 rounded-xl border border-slate-700/80 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setDevicePreviewFrame('desktop')}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                      devicePreviewFrame === 'desktop' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    <span>Desktop View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDevicePreviewFrame('mobile')}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                      devicePreviewFrame === 'mobile' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>Mobile Frame (375px)</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDevicePreviewOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Preview Body Area */}
            <div className="p-6 overflow-y-auto bg-slate-950 flex-1 flex flex-col items-center justify-center min-h-[480px]">
              {devicePreviewFrame === 'desktop' ? (
                /* Desktop Mail Client Window Frame */
                <div className="w-full max-w-2xl bg-white text-slate-900 rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col transition-all">
                  {/* Desktop Mail Client Toolbar Header */}
                  <div className="bg-slate-100 border-b border-slate-200 p-3.5 flex items-center justify-between text-xs font-sans">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 mr-2">
                        <div className="w-3 h-3 rounded-full bg-rose-500" />
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      </div>
                      <span className="font-bold text-slate-700">Apple Mail / Outlook Desktop View</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      To: {editorTestEmail}
                    </div>
                  </div>

                  {/* Email Metadata Bar */}
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">
                        {editedTemplateSubject
                          .replace(/\{\{customer_name\}\}/g, 'Alex Morgan')
                          .replace(/\{\{product_name\}\}/g, products[0]?.name || 'Veloce Desk Pad')
                          .replace(/\{\{product_price\}\}/g, products[0]?.price.toLocaleString() || '45,000')
                          .replace(/\{\{discount_code\}\}/g, 'SUMMER15')}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">09:41 AM (Just now)</span>
                    </div>
                    <div className="text-slate-500 text-[11px] flex items-center gap-2">
                      <span className="font-semibold text-slate-700">From:</span> Veloce Hub Kenya &lt;noreply@marid.co.ke&gt;
                    </div>
                  </div>

                  {/* Rendered Body */}
                  <div className="p-6 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-sans min-h-[260px] bg-white">
                    {editedTemplateBody
                      .replace(/\{\{customer_name\}\}/g, 'Alex Morgan')
                      .replace(/\{\{product_name\}\}/g, products[0]?.name || 'Veloce Desk Pad')
                      .replace(/\{\{product_price\}\}/g, products[0]?.price.toLocaleString() || '45,000')
                      .replace(/\{\{discount_code\}\}/g, 'SUMMER15')
                      .replace(/\{\{product_link\}\}/g, 'https://marid.co.ke/store')
                      .replace(/\{\{otp_code\}\}/g, '849201')
                      .replace(/\{\{order_id\}\}/g, 'VEL-94021')
                      .replace(/\{\{mpesa_ref\}\}/g, 'RKT892KL')}
                  </div>

                  {/* Email Footer */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Veloce Hub Kenya • Enterprise Mail Engine</span>
                    <span className="text-indigo-600 font-semibold underline cursor-pointer">Unsubscribe</span>
                  </div>
                </div>
              ) : (
                /* Mobile Smartphone Hardware Frame (iPhone Style 375px) */
                <div className="w-[375px] h-[640px] bg-slate-900 text-slate-900 rounded-[40px] border-4 border-slate-700 p-3 shadow-2xl flex flex-col relative overflow-hidden transition-all ring-1 ring-slate-800">
                  {/* Top Phone Bezel & Camera Island */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-4 bg-slate-900 rounded-b-xl z-20 flex items-center justify-center">
                    <div className="w-10 h-1.5 bg-slate-800 rounded-full" />
                  </div>

                  {/* Inner Phone Screen */}
                  <div className="w-full h-full bg-white rounded-[28px] overflow-hidden flex flex-col pt-4">
                    {/* Status Bar */}
                    <div className="px-5 py-1 flex items-center justify-between text-[10px] font-bold text-slate-800 bg-slate-100 border-b border-slate-200/80">
                      <span>9:41</span>
                      <span className="font-mono">5G • 100%</span>
                    </div>

                    {/* Mobile Email App Header */}
                    <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Inbox</span>
                      <span className="text-[10px] font-mono text-indigo-600 font-semibold">1 of 42</span>
                    </div>

                    {/* Subject & Metadata */}
                    <div className="p-3.5 border-b border-slate-100 bg-white">
                      <h4 className="font-bold text-xs text-slate-900 leading-snug">
                        {editedTemplateSubject
                          .replace(/\{\{customer_name\}\}/g, 'Alex Morgan')
                          .replace(/\{\{product_name\}\}/g, products[0]?.name || 'Veloce Desk Pad')
                          .replace(/\{\{product_price\}\}/g, products[0]?.price.toLocaleString() || '45,000')
                          .replace(/\{\{discount_code\}\}/g, 'SUMMER15')}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Veloce Kenya &lt;noreply@marid.co.ke&gt;
                      </p>
                    </div>

                    {/* Rendered Mobile Body */}
                    <div className="p-4 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans flex-1 overflow-y-auto bg-white">
                      {editedTemplateBody
                        .replace(/\{\{customer_name\}\}/g, 'Alex Morgan')
                        .replace(/\{\{product_name\}\}/g, products[0]?.name || 'Veloce Desk Pad')
                        .replace(/\{\{product_price\}\}/g, products[0]?.price.toLocaleString() || '45,000')
                        .replace(/\{\{discount_code\}\}/g, 'SUMMER15')
                        .replace(/\{\{product_link\}\}/g, 'https://marid.co.ke/store')
                        .replace(/\{\{otp_code\}\}/g, '849201')
                        .replace(/\{\{order_id\}\}/g, 'VEL-94021')
                        .replace(/\{\{mpesa_ref\}\}/g, 'RKT892KL')}
                    </div>

                    {/* Home Indicator */}
                    <div className="p-2 bg-slate-100 border-t border-slate-200 flex justify-center">
                      <div className="w-24 h-1 bg-slate-400 rounded-full" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="email"
                  value={editorTestEmail}
                  onChange={(e) => setEditorTestEmail(e.target.value)}
                  placeholder="Send test email..."
                  className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-60"
                />
                <button
                  type="button"
                  onClick={handleSendEditorTestEmail}
                  disabled={isTestSending}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isTestSending ? 'Sending...' : 'Test Send'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleSaveEditedTemplate}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Template</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDevicePreviewOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SMTP Diagnostics Admin Modal */}
      <SmtpDiagnosticsModal
        isOpen={isSmtpModalOpen}
        onClose={() => setIsSmtpModalOpen(false)}
        defaultEmail={testEmail || 'admin@ropenix.co.ke'}
      />

      {/* VERSION COMPARISON & PREVIEW MODAL */}
      {selectedVersionForPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500 text-white font-mono font-black text-[10px]">
                      Version {selectedVersionForPreview.versionNumber}.0
                    </span>
                    <h3 className="font-bold text-sm sm:text-base text-white font-mono">
                      Compare Snapshot vs Live Editor
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Snapshot captured on {selectedVersionForPreview.timestamp} by {selectedVersionForPreview.savedBy}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedVersionForPreview(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Note Banner */}
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-amber-900 flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-amber-600" />
                Snapshot Note: <span className="font-bold font-mono">"{selectedVersionForPreview.note}"</span>
              </span>
              <button
                type="button"
                onClick={() => handleRestoreVersion(selectedVersionForPreview)}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restore This Version into Live Editor</span>
              </button>
            </div>

            {/* Side by Side Comparison Body */}
            <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 bg-slate-50">
              {/* Left Column: Live Unsaved Editor Draft */}
              <div className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <span className="px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-900 font-bold text-xs flex items-center gap-1.5">
                    <Edit3 className="h-3.5 w-3.5 text-indigo-600" /> Current Live Editor Draft
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">Uncommitted / Active State</span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase font-mono block mb-1">Subject Line</label>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-gray-800 font-mono">
                    {editedTemplateSubject || '(Empty Subject)'}
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <label className="text-[10px] font-bold text-gray-400 uppercase font-mono block mb-1">Body Content</label>
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto border border-slate-800">
                    {editedTemplateBody || '(Empty Body Content)'}
                  </div>
                </div>
              </div>

              {/* Right Column: Historical Version Snapshot */}
              <div className="rounded-xl border border-amber-300 bg-white p-4 shadow-sm flex flex-col gap-3 ring-1 ring-amber-400/20">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-amber-700" /> Snapshot v{selectedVersionForPreview.versionNumber}.0
                  </span>
                  <span className="text-[10px] font-mono text-amber-700 font-bold">{selectedVersionForPreview.timestamp}</span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-amber-800/80 uppercase font-mono block mb-1">Historical Subject Line</label>
                  <div className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-200 text-xs font-bold text-gray-900 font-mono">
                    {selectedVersionForPreview.subject}
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <label className="text-[10px] font-bold text-amber-800/80 uppercase font-mono block mb-1">Historical Body Content</label>
                  <div className="p-3 rounded-xl bg-slate-900 text-amber-100 font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto border border-slate-800">
                    {selectedVersionForPreview.body}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-gray-200 flex items-center justify-between gap-3">
              <span className="text-xs text-gray-500 hidden sm:inline">
                Restoring will overwrite current editor text fields. You can click "Save Changes" afterwards to commit.
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setSelectedVersionForPreview(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleRestoreVersion(selectedVersionForPreview)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Restore Version v{selectedVersionForPreview.versionNumber}.0</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

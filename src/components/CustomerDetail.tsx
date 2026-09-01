import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  User,
  Building,
  Mail,
  Phone,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Receipt,
  Plus,
  Edit3,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileText,
  Briefcase,
  Layers,
  ChevronRight,
  Sparkles,
  Zap,
  Info,
  BadgeCheck,
  ExternalLink,
  MapPin
} from 'lucide-react';
import {
  getCustomer,
  createDeal,
  createOrder,
  createInvoice,
  CustomerDetailItem,
  CustomerDeal,
  CustomerOrder,
  CustomerInvoice,
} from '../api/customers';
import { CustomerForm } from './CustomerForm';
import { Order } from '../types';

interface CustomerDetailProps {
  customerId: string;
  onBack: () => void;
  onCustomerUpdated?: () => void;
  liveOrders?: Order[];
}

export const CustomerDetail: React.FC<CustomerDetailProps> = ({
  customerId,
  onBack,
  onCustomerUpdated,
  liveOrders = [],
}) => {
  const [customer, setCustomer] = useState<CustomerDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'deals' | 'orders' | 'invoices'>('deals');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Quick Action Modal States
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Form input states for new Deal
  const [dealTitle, setDealTitle] = useState('');
  const [dealValue, setDealValue] = useState('');
  const [dealStage, setDealStage] = useState<'prospecting' | 'negotiation' | 'won' | 'lost'>('prospecting');
  const [dealCloseDate, setDealCloseDate] = useState('');
  const [dealSubmitting, setDealSubmitting] = useState(false);
  const [dealError, setDealError] = useState<string | null>(null);

  // Form input states for new Order
  const [orderReference, setOrderReference] = useState('');
  const [orderTotal, setOrderTotal] = useState('');
  const [orderStatus, setOrderStatus] = useState('Processing');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Form input states for new Invoice
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState<'draft' | 'sent' | 'paid' | 'overdue'>('draft');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const fetchCustomerData = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getCustomer(customerId);
      setCustomer(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch customer profile.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  // Real-time synchronization of placed orders with backend records (Hook unconditionally rendered at top level)
  const allMergedOrders = React.useMemo(() => {
    if (!customer) return [];
    const backendOrders = customer.orders || [];

    const custEmail = customer.email?.trim().toLowerCase();
    const custName = (customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`).trim().toLowerCase();
    const custPhone = customer.phone?.trim();

    const matchedLiveOrders = (liveOrders || []).filter((o) => {
      const orderEmail = o.customerEmail?.trim().toLowerCase();
      const orderName = o.customerName?.trim().toLowerCase();
      const orderPhone = o.phone?.trim() || o.pickupContactPhone?.trim() || o.mpesaPhone?.trim();

      const emailMatch = Boolean(custEmail && orderEmail && custEmail === orderEmail);
      const nameMatch = Boolean(custName && orderName && (custName === orderName || custName.includes(orderName) || orderName.includes(custName)));
      const phoneMatch = Boolean(custPhone && orderPhone && (custPhone === orderPhone || custPhone.endsWith(orderPhone.slice(-9)) || orderPhone.endsWith(custPhone.slice(-9))));

      return emailMatch || (nameMatch && phoneMatch);
    });

    const combined: CustomerOrder[] = [...backendOrders];
    matchedLiveOrders.forEach((lo) => {
      const alreadyIn = combined.some((bo) => bo.id === lo.id || (bo.reference && (bo.reference.toUpperCase() === lo.id.toUpperCase() || bo.reference === lo.id)));
      if (!alreadyIn) {
        combined.push({
          id: lo.id,
          reference: lo.id.toUpperCase(),
          customer: customer.id,
          customer_name: lo.customerName,
          customer_email: lo.customerEmail,
          total: lo.total,
          status: lo.status ? (lo.status.charAt(0).toUpperCase() + lo.status.slice(1)) : 'Processing',
          placed_at: lo.date || new Date().toISOString(),
          created_at: lo.date || new Date().toISOString(),
        });
      }
    });

    return combined;
  }, [customer, liveOrders]);

  const effectiveOrdersCount = allMergedOrders.length;
  const effectiveTotalSpent = React.useMemo(() => {
    if (!customer) return 0;
    if (allMergedOrders.length === 0) return Number(customer.total_spent || 0);
    const sumOrders = allMergedOrders
      .filter((o) => o.status.toLowerCase() !== 'cancelled')
      .reduce((acc, o) => acc + Number(o.total || 0), 0);
    return Math.max(Number(customer.total_spent || 0), sumOrders);
  }, [allMergedOrders, customer]);

  const latestAddressFromOrders = (liveOrders || []).find((o) => {
    const custEmail = customer?.email?.trim().toLowerCase();
    return custEmail && o.customerEmail?.trim().toLowerCase() === custEmail && o.shippingAddress;
  })?.shippingAddress;

  const effectiveLocation = customer?.location || customer?.resolved_location || latestAddressFromOrders || 'Nairobi, Kenya';

  // Handle Create Deal
  const handleAddDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealTitle.trim()) {
      setDealError('Deal title is required');
      return;
    }
    if (!dealValue || isNaN(Number(dealValue)) || Number(dealValue) <= 0) {
      setDealError('Please enter a valid positive deal value');
      return;
    }

    setDealSubmitting(true);
    setDealError(null);
    try {
      await createDeal({
        customer: customerId,
        title: dealTitle.trim(),
        value: Number(dealValue),
        stage: dealStage,
        expected_close: dealCloseDate || null,
      });
      setIsDealModalOpen(false);
      setDealTitle('');
      setDealValue('');
      setDealStage('prospecting');
      setDealCloseDate('');
      await fetchCustomerData();
      if (onCustomerUpdated) onCustomerUpdated();
    } catch (err: any) {
      setDealError(err?.message || 'Failed to create deal.');
    } finally {
      setDealSubmitting(false);
    }
  };

  // Handle Create Order
  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderTotal || isNaN(Number(orderTotal)) || Number(orderTotal) <= 0) {
      setOrderError('Please enter a valid positive order total');
      return;
    }

    setOrderSubmitting(true);
    setOrderError(null);
    try {
      await createOrder({
        customer: customerId,
        total: Number(orderTotal),
        status: orderStatus,
        reference: orderReference.trim() || undefined,
      });
      setIsOrderModalOpen(false);
      setOrderReference('');
      setOrderTotal('');
      setOrderStatus('Processing');
      await fetchCustomerData();
      if (onCustomerUpdated) onCustomerUpdated();
    } catch (err: any) {
      setOrderError(err?.message || 'Failed to create order.');
    } finally {
      setOrderSubmitting(false);
    }
  };

  // Handle Create Invoice
  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceAmount || isNaN(Number(invoiceAmount)) || Number(invoiceAmount) <= 0) {
      setInvoiceError('Please enter a valid positive invoice amount');
      return;
    }

    setInvoiceSubmitting(true);
    setInvoiceError(null);
    try {
      await createInvoice({
        customer: customerId,
        amount: Number(invoiceAmount),
        status: invoiceStatus,
        due_date: invoiceDueDate || null,
      });
      setIsInvoiceModalOpen(false);
      setInvoiceAmount('');
      setInvoiceStatus('draft');
      setInvoiceDueDate('');
      await fetchCustomerData();
      if (onCustomerUpdated) onCustomerUpdated();
    } catch (err: any) {
      setInvoiceError(err?.message || 'Failed to issue invoice.');
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ACTIVE CLIENT
          </span>
        );
      case 'lead':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            SALES LEAD
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
            INACTIVE
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {status?.toUpperCase() || 'UNKNOWN'}
          </span>
        );
    }
  };

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'won':
        return <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">WON / CLOSED</span>;
      case 'negotiation':
        return <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/40">NEGOTIATION</span>;
      case 'prospecting':
        return <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">PROSPECTING</span>;
      case 'lost':
        return <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40">LOST</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{stage.toUpperCase()}</span>;
    }
  };

  const getInvoiceBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">PAID</span>;
      case 'sent':
        return <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">SENT</span>;
      case 'overdue':
        return <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40">OVERDUE</span>;
      case 'draft':
      default:
        return <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">DRAFT</span>;
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-12 text-center shadow-3xs">
        <Loader2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold font-mono text-gray-800 dark:text-gray-200 uppercase tracking-wider">Loading Customer Profile...</p>
        <p className="text-[11px] text-gray-400 mt-1">Retrieving deal history & billing records</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-gray-950 p-8 text-center shadow-3xs">
        <AlertCircle className="w-10 h-10 text-rose-600 dark:text-rose-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Customer Not Found</h3>
        <p className="text-xs text-gray-500 mb-4">{error || 'Unable to retrieve customer details from database.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Directory
        </button>
      </div>
    );
  }

  const deals = customer.deals || [];
  const invoices = customer.invoices || [];
  const orders = allMergedOrders;

  return (
    <div className="space-y-6 font-sans text-gray-900 dark:text-white">
      {/* Top Navigation / Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Back to Customers
        </button>

        <button
          type="button"
          onClick={() => setIsEditModalOpen(true)}
          className="px-4 py-1.5 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5" /> Edit Profile Details
        </button>
      </div>

      {/* Customer Header Summary Card */}
      <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-6 shadow-3xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold font-mono text-xl flex items-center justify-center shrink-0 shadow-3xs">
              {customer.first_name?.[0]?.toUpperCase() || 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {customer.name || `${customer.first_name} ${customer.last_name}`.trim() || customer.email}
                </h1>
                {getStatusBadge(customer.status)}
                {customer.is_registered ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/40">
                    <BadgeCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    REGISTERED USER {customer.user ? `(#${customer.user})` : ''}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                    <ShoppingBag className="w-3.5 h-3.5 text-gray-400" />
                    GUEST CUSTOMER
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                <div className="flex items-center gap-1.5 text-gray-900 dark:text-white font-medium bg-gray-100/80 dark:bg-gray-800/80 px-2.5 py-1 rounded-lg">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>{effectiveLocation}</span>
                </div>
                {customer.company && (
                  <span className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200 font-semibold">
                    <Building className="w-3.5 h-3.5 text-gray-400" />
                    {customer.company}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  {customer.email}
                </span>
                {customer.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    {customer.phone}
                  </span>
                )}
                {customer.is_registered && customer.user && (
                  <a
                    href={`/admin/auth/user/${customer.user}/change/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline font-mono text-[11px]"
                    title="Open Django User Record"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Django Auth User #{customer.user}
                  </a>
                )}
                <span className="flex items-center gap-1.5 font-mono text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  Joined {new Date(customer.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics KPI Badges: Spent, Orders, Pipeline */}
          <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-150 dark:border-emerald-900/40 rounded-xl text-right min-w-[140px] shadow-4xs">
              <span className="text-[10px] uppercase font-bold font-mono text-emerald-600 dark:text-emerald-400 tracking-wider block">
                Total Spent
              </span>
              <span className="text-base font-black font-display text-emerald-700 dark:text-emerald-300 font-mono">
                KSh {effectiveTotalSpent.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-150 dark:border-amber-900/40 rounded-xl text-right min-w-[110px] shadow-4xs">
              <span className="text-[10px] uppercase font-bold font-mono text-amber-600 dark:text-amber-400 tracking-wider block">
                Orders
              </span>
              <span className="text-base font-black font-display text-amber-700 dark:text-amber-300 font-mono">
                {effectiveOrdersCount}
              </span>
            </div>

            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-150 dark:border-indigo-900/40 rounded-xl text-right min-w-[140px] shadow-4xs">
              <span className="text-[10px] uppercase font-bold font-mono text-indigo-600 dark:text-indigo-400 tracking-wider block">
                Open Deals
              </span>
              <span className="text-base font-black font-display text-indigo-700 dark:text-indigo-300 font-mono">
                KSh {Number(customer.open_deal_value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>


        {/* Customer Notes banner */}
        {customer.notes && (
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-850 text-xs text-gray-600 dark:text-gray-300 flex items-start gap-2 bg-gray-50/50 dark:bg-gray-900/40 p-3 rounded-xl border border-gray-150 dark:border-gray-800/80">
            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-gray-900 dark:text-white font-mono uppercase text-[10px]">Internal CRM Notes: </span>
              {customer.notes}
            </div>
          </div>
        )}
      </div>

      {/* Tabbed Record Navigation */}
      <div className="overflow-hidden rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 shadow-3xs">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-850 px-6 pt-3 bg-gray-50/50 dark:bg-gray-900/30">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('deals')}
              className={`pb-3 px-4 text-xs font-bold font-mono uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'deals'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Deals
              <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full font-bold ${
                activeTab === 'deals' ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
              }`}>
                {deals.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`pb-3 px-4 text-xs font-bold font-mono uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'orders'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Orders
              <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full font-bold ${
                activeTab === 'orders' ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
              }`}>
                {orders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`pb-3 px-4 text-xs font-bold font-mono uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'invoices'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Receipt className="w-4 h-4" />
              Invoices
              <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full font-bold ${
                activeTab === 'invoices' ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
              }`}>
                {invoices.length}
              </span>
            </button>
          </div>

          {/* Tab Specific Quick Add Action */}
          <div>
            {activeTab === 'deals' && (
              <button
                type="button"
                onClick={() => setIsDealModalOpen(true)}
                className="mb-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Deal
              </button>
            )}
            {activeTab === 'orders' && (
              <button
                type="button"
                onClick={() => setIsOrderModalOpen(true)}
                className="mb-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Create Order
              </button>
            )}
            {activeTab === 'invoices' && (
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(true)}
                className="mb-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Issue Invoice
              </button>
            )}
          </div>
        </div>

        {/* Tab Content Panes */}
        <div className="p-6">
          {/* Deals Tab */}
          {activeTab === 'deals' && (
            <div>
              {deals.length === 0 ? (
                <div className="p-8 text-center text-gray-500 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                  <TrendingUp className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-200">No active deals found for this customer.</p>
                  <p className="text-[11px] text-gray-400 mt-1">Start tracking sales opportunities by adding a deal.</p>
                  <button
                    type="button"
                    onClick={() => setIsDealModalOpen(true)}
                    className="mt-4 px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add First Deal
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300">
                    <thead className="bg-gray-50/80 dark:bg-gray-900/80 text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-850">
                      <tr>
                        <th className="px-4 py-3">Deal Title</th>
                        <th className="px-4 py-3">Value</th>
                        <th className="px-4 py-3">Stage</th>
                        <th className="px-4 py-3">Expected Close</th>
                        <th className="px-4 py-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-850/60">
                      {deals.map((deal) => (
                        <tr key={deal.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Briefcase className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            {deal.title}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-white">
                            KSh {Number(deal.value).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3">{getStageBadge(deal.stage)}</td>
                          <td className="px-4 py-3 text-[11px] text-gray-500 font-mono">
                            {deal.expected_close ? new Date(deal.expected_close).toLocaleDateString('en-KE') : '—'}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-gray-400 font-mono">
                            {deal.created_at ? new Date(deal.created_at).toLocaleDateString('en-KE') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div>
              {orders.length === 0 ? (
                <div className="p-8 text-center text-gray-500 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                  <ShoppingBag className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-200">No orders recorded for this account.</p>
                  <p className="text-[11px] text-gray-400 mt-1">Create an order or link completed eCommerce purchases.</p>
                  <button
                    type="button"
                    onClick={() => setIsOrderModalOpen(true)}
                    className="mt-4 px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create Order
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300">
                    <thead className="bg-gray-50/80 dark:bg-gray-900/80 text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-850">
                      <tr>
                        <th className="px-4 py-3">Order Reference</th>
                        <th className="px-4 py-3">Total Amount</th>
                        <th className="px-4 py-3">Fulfillment Status</th>
                        <th className="px-4 py-3">Placed Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-850/60">
                      {orders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors">
                          <td className="px-4 py-3 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                            {ord.reference || ord.id.slice(0, 12)}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-white">
                            KSh {Number(ord.total).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                              {ord.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-gray-500 font-mono">
                            {ord.placed_at ? new Date(ord.placed_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <div>
              {invoices.length === 0 ? (
                <div className="p-8 text-center text-gray-500 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                  <Receipt className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-200">No invoices issued for this customer.</p>
                  <p className="text-[11px] text-gray-400 mt-1">Issue a billing invoice to collect payment.</p>
                  <button
                    type="button"
                    onClick={() => setIsInvoiceModalOpen(true)}
                    className="mt-4 px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Issue Invoice
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300">
                    <thead className="bg-gray-50/80 dark:bg-gray-900/80 text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-850">
                      <tr>
                        <th className="px-4 py-3">Invoice Number</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Payment Status</th>
                        <th className="px-4 py-3">Due Date</th>
                        <th className="px-4 py-3">Issued Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-850/60">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors">
                          <td className="px-4 py-3 font-mono text-[11px] font-bold text-gray-900 dark:text-white">
                            INV-#{inv.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-white">
                            KSh {Number(inv.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3">{getInvoiceBadge(inv.status)}</td>
                          <td className="px-4 py-3 text-[11px] text-gray-500 font-mono">
                            {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-KE') : '—'}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-gray-400 font-mono">
                            {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('en-KE') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Customer Profile Modal */}
      <CustomerForm
        isOpen={isEditModalOpen}
        customer={customer}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={async () => {
          await fetchCustomerData();
          if (onCustomerUpdated) onCustomerUpdated();
        }}
      />

      {/* Quick Add Deal Modal */}
      {isDealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-850 rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-850 mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Add Deal for {customer.name || customer.email}
              </h3>
              <button type="button" onClick={() => setIsDealModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddDeal} className="space-y-3.5">
              {dealError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {dealError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono mb-1">Deal Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise SLA Agreement"
                  value={dealTitle}
                  onChange={(e) => setDealTitle(e.target.value)}
                  className="h-10 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 px-3.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-gray-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-550"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono mb-1">Value (KSh) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="150000"
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    className="h-10 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 px-3.5 text-xs font-mono font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-gray-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-550"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono mb-1">Pipeline Stage</label>
                  <select
                    value={dealStage}
                    onChange={(e: any) => setDealStage(e.target.value)}
                    className="h-10 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-550 cursor-pointer"
                  >
                    <option value="prospecting">Prospecting</option>
                    <option value="negotiation">Negotiation</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono mb-1">Expected Close Date</label>
                <input
                  type="date"
                  value={dealCloseDate}
                  onChange={(e) => setDealCloseDate(e.target.value)}
                  className="h-10 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 px-3.5 text-xs font-mono text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-550"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-850">
                <button
                  type="button"
                  onClick={() => setIsDealModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dealSubmitting}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {dealSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Save Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Create Order Modal */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-850 rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-850 mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Create Order for {customer.name || customer.email}
              </h3>
              <button type="button" onClick={() => setIsOrderModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddOrder} className="space-y-3.5">
              {orderError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {orderError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono mb-1">Custom Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave blank for auto-generated ORD-XXXX"
                  value={orderReference}
                  onChange={(e) => setOrderReference(e.target.value)}
                  className="h-10 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 px-3.5 text-xs font-mono text-gray-900 dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-gray-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-550"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono mb-1">Total Amount (KSh) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="25000"
                    value={orderTotal}
                    onChange={(e) => setOrderTotal(e.target.value)}
                    className="h-10 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 px-3.5 text-xs font-mono font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-gray-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-550"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono mb-1">Fulfillment Status</label>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value)}
                    className="h-10 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-550 cursor-pointer"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Processing">Processing</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-850">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={orderSubmitting}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {orderSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Place Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Issue Invoice Modal */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-850 rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-850 mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Issue Invoice for {customer.name || customer.email}
              </h3>
              <button type="button" onClick={() => setIsInvoiceModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddInvoice} className="space-y-3.5">
              {invoiceError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {invoiceError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono mb-1">Invoice Amount (KSh) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="35000"
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                    className="h-10 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 px-3.5 text-xs font-mono font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-gray-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-550"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono mb-1">Billing Status</label>
                  <select
                    value={invoiceStatus}
                    onChange={(e: any) => setInvoiceStatus(e.target.value)}
                    className="h-10 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-550 cursor-pointer"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 font-mono mb-1">Payment Due Date</label>
                <input
                  type="date"
                  value={invoiceDueDate}
                  onChange={(e) => setInvoiceDueDate(e.target.value)}
                  className="h-10 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 px-3.5 text-xs font-mono text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-550"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-850">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={invoiceSubmitting}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {invoiceSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Issue Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

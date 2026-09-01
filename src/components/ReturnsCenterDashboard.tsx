import React, { useState, useMemo } from 'react';
import { 
  RefreshCw, 
  Package, 
  Clock, 
  TrendingUp, 
  CheckCircle, 
  X, 
  Search, 
  AlertCircle, 
  Check, 
  Copy, 
  DollarSign, 
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  ArrowRight,
  Truck,
  Zap,
  CheckSquare,
  Square,
  MinusSquare,
  ListChecks,
  Settings,
  Image as ImageIcon,
  Smartphone,
  CreditCard,
  Eye,
  FileText,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { ReturnRequest, Order, ReturnPolicy, ReturnStatus, ReturnReason, ConditionReported } from '../types';
import { CurrencyType, formatPrice } from '../lib/currency';

interface ReturnsCenterDashboardProps {
  returnRequests: ReturnRequest[];
  orders: Order[];
  onUpdateReturnRequestStatus: (
    requestId: string, 
    status: ReturnRequest['status'], 
    adminNote?: string, 
    trackingNumber?: string
  ) => void;
  currency?: CurrencyType;
}

const REASON_LABELS: Record<string, string> = {
  damaged_defective: 'Damaged / Defective',
  defective: 'Damaged / Defective',
  wrong_item: 'Wrong Item Sent',
  not_as_described: 'Item Not As Described',
  size_fit_issue: 'Wrong Size / Fit',
  bad_fit: 'Wrong Size / Fit',
  changed_mind: 'Changed Mind',
  better_price: 'Better Price Found',
  other: 'Other Reason'
};

const REASON_COLORS: Record<string, string> = {
  damaged_defective: '#f43f5e', // Rose
  defective: '#f43f5e',
  wrong_item: '#f59e0b',        // Amber
  not_as_described: '#eab308',  // Yellow
  size_fit_issue: '#6366f1',     // Indigo
  bad_fit: '#6366f1',
  changed_mind: '#10b981',      // Emerald
  better_price: '#06b6d4',      // Cyan
  other: '#8b5cf6'             // Purple
};

export default function ReturnsCenterDashboard({
  returnRequests,
  orders,
  onUpdateReturnRequestStatus,
  currency = 'KSh'
}: ReturnsCenterDashboardProps) {
  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '6m' | '1y'>('30d');
  const [quickActionToast, setQuickActionToast] = useState<string | null>(null);

  // Multi-Select Checkboxes State for Bulk Actions
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);

  // Detailed Ticket Inspection Modal
  const [inspectingRequest, setInspectingRequest] = useState<ReturnRequest | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Return Policy Configurator State
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policy, setPolicy] = useState<ReturnPolicy>({
    returnWindowDays: 7,
    excludedCategories: ['Underwear', 'Perishables', 'Custom Orders', 'Digital Software'],
    freeReturnReasons: ['damaged_defective', 'wrong_item', 'not_as_described'],
    requiresPhotoEvidence: true,
    autoApproveThresholdKes: 1500,
    customerPaysReturnShippingOnMindChange: true
  });

  // Action / Decision modal states
  const [selectedReturnRequest, setSelectedReturnRequest] = useState<ReturnRequest | null>(null);
  const [adminActionType, setAdminActionType] = useState<'approve' | 'reject' | 'resolve' | 'request_info' | 'inspect' | null>(null);
  const [adminActionNote, setAdminActionNote] = useState('');
  const [adminActionTracking, setAdminActionTracking] = useState('');
  const [mpesaB2cReference, setMpesaB2cReference] = useState('');

  // 1. Calculate Core KPIs
  const kpis = useMemo(() => {
    const totalRequests = returnRequests.length;
    const pendingCount = returnRequests.filter(r => r.status === 'pending' || r.status === 'pending_review').length;
    const approvedCount = returnRequests.filter(r => r.status === 'approved' || r.status === 'awaiting_shipment').length;
    const inTransitCount = returnRequests.filter(r => r.status === 'in_transit' || r.status === 'received' || r.status === 'inspecting').length;
    const resolvedCount = returnRequests.filter(r => r.status === 'resolved' || r.status === 'completed').length;
    const rejectedCount = returnRequests.filter(r => r.status === 'rejected').length;

    const totalValue = returnRequests.reduce((sum, req) => {
      const reqVal = req.items.reduce((iSum, item) => iSum + (item.price * item.quantity), 0);
      return sum + reqVal;
    }, 0);

    const refundValue = returnRequests
      .filter(r => (r.type === 'refund' || r.resolutionType === 'refund') && (r.status === 'resolved' || r.status === 'completed' || r.status === 'approved' || r.status === 'pending' || r.status === 'pending_review'))
      .reduce((sum, req) => {
        const reqVal = req.items.reduce((iSum, item) => iSum + (item.price * item.quantity), 0);
        return sum + reqVal;
      }, 0);

    const exchangeCount = returnRequests.filter(r => r.type === 'exchange' || r.resolutionType === 'replacement').length;
    const exchangePercentage = totalRequests > 0 ? Math.round((exchangeCount / totalRequests) * 100) : 0;

    const completedOrdersCount = orders.filter(o => o.status === 'completed' || o.status === 'shipped').length || 1;
    const returnRatePct = ((totalRequests / completedOrdersCount) * 100).toFixed(1);

    return {
      totalRequests,
      pendingCount,
      approvedCount,
      inTransitCount,
      resolvedCount,
      rejectedCount,
      totalValue,
      refundValue,
      exchangeCount,
      exchangePercentage,
      returnRatePct,
      avgTurnaroundDays: totalRequests > 0 ? 1.4 : 0
    };
  }, [returnRequests, orders]);

  // 2. Monthly Trend Data
  const trendData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map((month, idx) => {
      const baseRequests = Math.max(2, (returnRequests.length / 6) * (idx + 1));
      const refunds = Math.round(baseRequests * 0.65);
      const exchanges = Math.round(baseRequests * 0.35);
      const totalAmount = Math.round((kpis.totalValue / (returnRequests.length || 1)) * baseRequests);

      return {
        month,
        totalReturns: Math.round(baseRequests),
        refunds,
        exchanges,
        amount: totalAmount
      };
    });
  }, [returnRequests, kpis.totalValue]);

  // 3. Reasons Donut Chart Data
  const reasonsData = useMemo(() => {
    const counts: Record<string, number> = {
      damaged_defective: 0,
      wrong_item: 0,
      not_as_described: 0,
      size_fit_issue: 0,
      changed_mind: 0,
      other: 0
    };

    returnRequests.forEach(req => {
      const mappedKey = req.reason === 'defective' ? 'damaged_defective' : req.reason === 'bad_fit' ? 'size_fit_issue' : req.reason;
      if (counts[mappedKey] !== undefined) {
        counts[mappedKey]++;
      } else {
        counts.other++;
      }
    });

    if (returnRequests.length === 0) {
      return [
        { name: 'Damaged / Defective', value: 38, key: 'damaged_defective', color: REASON_COLORS.damaged_defective },
        { name: 'Wrong Item Sent', value: 24, key: 'wrong_item', color: REASON_COLORS.wrong_item },
        { name: 'Wrong Size / Fit', value: 20, key: 'size_fit_issue', color: REASON_COLORS.size_fit_issue },
        { name: 'Changed Mind', value: 12, key: 'changed_mind', color: REASON_COLORS.changed_mind },
        { name: 'Other Reason', value: 6, key: 'other', color: REASON_COLORS.other }
      ];
    }

    return Object.keys(counts).map(key => ({
      name: REASON_LABELS[key] || key,
      value: counts[key],
      key,
      color: REASON_COLORS[key] || '#888888'
    })).filter(item => item.value > 0);
  }, [returnRequests]);

  // 4. Processing Duration Bar Data
  const processingDurationData = [
    { duration: '< 24 Hours', count: Math.max(1, Math.round(kpis.totalRequests * 0.52)), sla: '98% SLA' },
    { duration: '1 - 2 Days', count: Math.max(1, Math.round(kpis.totalRequests * 0.32)), sla: '95% SLA' },
    { duration: '3 - 5 Days', count: Math.max(0, Math.round(kpis.totalRequests * 0.12)), sla: '88% SLA' },
    { duration: '> 5 Days', count: Math.max(0, Math.round(kpis.totalRequests * 0.04)), sla: 'Delayed' },
  ];

  // 5. Filtered Requests
  const filteredRequests = useMemo(() => {
    return returnRequests.filter(req => {
      const matchStatus = 
        statusFilter === 'all' || 
        req.status === statusFilter || 
        (statusFilter === 'pending' && (req.status === 'pending_review' || req.status === 'pending')) ||
        (statusFilter === 'resolved' && (req.status === 'completed' || req.status === 'resolved')) ||
        (statusFilter === 'received' && (req.status === 'in_transit' || req.status === 'received' || req.status === 'inspecting'));

      const matchReason = reasonFilter === 'all' || req.reason === reasonFilter;
      
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        req.id.toLowerCase().includes(q) ||
        req.orderId.toLowerCase().includes(q) ||
        req.customerName.toLowerCase().includes(q) ||
        req.customerEmail.toLowerCase().includes(q) ||
        req.status.toLowerCase().includes(q) ||
        (REASON_LABELS[req.reason] && REASON_LABELS[req.reason].toLowerCase().includes(q)) ||
        (req.reasonDetails && req.reasonDetails.toLowerCase().includes(q)) ||
        req.items.some(item => item.name.toLowerCase().includes(q));

      return matchStatus && matchReason && matchSearch;
    });
  }, [returnRequests, statusFilter, reasonFilter, searchQuery]);

  // Fraud detection helper
  const getCustomerReturnCount = (emailStr: string) => {
    return returnRequests.filter(r => r.customerEmail.toLowerCase() === emailStr.toLowerCase()).length;
  };

  // Handlers for modal actions
  const handleStartAction = (req: ReturnRequest, type: 'approve' | 'reject' | 'resolve' | 'request_info' | 'inspect') => {
    setSelectedReturnRequest(req);
    setAdminActionType(type);
    if (type === 'approve') {
      setAdminActionNote(`Return ticket approved. Prepaid pickup label generated via Kenya Reverse Logistics.`);
      setAdminActionTracking(`RET-KE-${Math.floor(100000 + Math.random() * 900000)}`);
    } else if (type === 'reject') {
      setAdminActionNote(`Regrettably, your return claim could not be approved as the item condition or date exceeds return policy terms.`);
      setAdminActionTracking('');
    } else if (type === 'request_info') {
      setAdminActionNote(`Merchant Operations requested additional photo evidence of item barcode tag or shipping package label.`);
      setAdminActionTracking('');
    } else {
      const b2cRef = `MPESA-B2C-${Math.floor(100000 + Math.random() * 900000)}`;
      setMpesaB2cReference(b2cRef);
      setAdminActionNote(`Returned item received and inspected. M-Pesa B2C refund payout executed (Ref: ${b2cRef}). Claim closed.`);
      setAdminActionTracking(req.trackingNumber || '');
    }
  };

  const handleConfirmActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturnRequest || !adminActionType) return;

    let targetStatus: ReturnRequest['status'] = 'pending';
    if (adminActionType === 'approve') targetStatus = 'approved';
    else if (adminActionType === 'reject') targetStatus = 'rejected';
    else if (adminActionType === 'request_info') targetStatus = 'request_info';
    else if (adminActionType === 'resolve') targetStatus = 'resolved';

    onUpdateReturnRequestStatus(
      selectedReturnRequest.id,
      targetStatus,
      adminActionNote.trim(),
      adminActionTracking.trim() || undefined
    );

    setSelectedReturnRequest(null);
    setAdminActionType(null);
    setAdminActionNote('');
    setAdminActionTracking('');
  };

  // Quick action
  const handleQuickStatusUpdate = (requestId: string, newStatus: ReturnRequest['status']) => {
    let note = '';
    let trackingNumber: string | undefined = undefined;

    if (newStatus === 'approved') {
      note = 'Quick action: Return request approved & reverse pickup scheduled.';
      trackingNumber = `RET-KE-${Math.floor(100000 + Math.random() * 900000)}`;
    } else if (newStatus === 'received' || newStatus === 'in_transit') {
      note = 'Quick action: Item marked received at central inspection facility.';
    } else if (newStatus === 'rejected') {
      note = 'Quick action: Claim rejected by merchant admin.';
    } else if (newStatus === 'resolved' || newStatus === 'completed') {
      note = 'Quick action: Return claim resolved and M-Pesa refund issued.';
    }

    onUpdateReturnRequestStatus(requestId, newStatus, note, trackingNumber);

    setQuickActionToast(`⚡ Return ticket #${requestId} status updated to ${newStatus.toUpperCase()}!`);
    setTimeout(() => {
      setQuickActionToast(null);
    }, 3500);
  };

  // Multi-Select Helpers
  const handleToggleSelectRequest = (id: string) => {
    setSelectedRequestIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isAllFilteredSelected = useMemo(() => {
    if (filteredRequests.length === 0) return false;
    return filteredRequests.every((req) => selectedRequestIds.includes(req.id));
  }, [filteredRequests, selectedRequestIds]);

  const handleToggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredIds = new Set(filteredRequests.map((r) => r.id));
      setSelectedRequestIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const filteredIds = filteredRequests.map((r) => r.id);
      setSelectedRequestIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleBulkApprove = () => {
    if (selectedRequestIds.length === 0) return;
    selectedRequestIds.forEach((id) => {
      onUpdateReturnRequestStatus(
        id,
        'approved',
        'Bulk Action: Return claim approved by store manager.',
        `RET-KE-${Math.floor(100000 + Math.random() * 900000)}`
      );
    });
    setQuickActionToast(`⚡ Approved ${selectedRequestIds.length} return claims!`);
    setSelectedRequestIds([]);
  };

  const handleBulkReject = () => {
    if (selectedRequestIds.length === 0) return;
    selectedRequestIds.forEach((id) => {
      onUpdateReturnRequestStatus(id, 'rejected', 'Bulk Action: Claim rejected by store manager.');
    });
    setQuickActionToast(`⚡ Rejected ${selectedRequestIds.length} claims.`);
    setSelectedRequestIds([]);
  };

  return (
    <div className="space-y-6 font-sans text-gray-900 dark:text-white">
      {/* Quick Toast */}
      {quickActionToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2.5 rounded-xl shadow-xl border border-gray-800 dark:border-gray-200 text-xs font-bold flex items-center gap-2 animate-bounce">
          <Zap className="h-4 w-4 text-amber-400 dark:text-amber-600 fill-amber-400" />
          <span>{quickActionToast}</span>
          <button onClick={() => setQuickActionToast(null)} className="ml-2 text-gray-400 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-850 pb-5">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 shadow-2xs">
            <RefreshCw className="h-6 w-6 animate-spin-slow" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                Product Returns & Reverse Logistics Spec
              </h2>
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-bold rounded-md">
                KENYA MARKET EDITION
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Structured reason analytics, M-Pesa B2C payouts, photo inspection panel, and return policy configuration.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPolicyModalOpen(true)}
            className="px-3.5 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-800 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
          >
            <Sliders className="h-4 w-4 text-indigo-600" /> Return Policy Settings
          </button>

          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200/60 dark:border-gray-800">
            {(['7d', '30d', '6m', '1y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer font-mono ${
                  timeRange === range
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-3xs font-bold'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">Return Rate</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-gray-900 dark:text-white">{kpis.returnRatePct}%</span>
            <span className="text-[10px] text-emerald-600 font-semibold font-mono">Industry standard &lt;3%</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">{kpis.totalRequests} claims against total orders</p>
        </div>

        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">Pending Review</span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400">{kpis.pendingCount}</span>
            <span className="text-[10px] text-amber-600 font-mono">Awaiting Inspection</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Requires admin approval or evidence check</p>
        </div>

        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">Total Return Value</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono tracking-tight text-gray-900 dark:text-white">{formatPrice(kpis.totalValue)}</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Refunded via M-Pesa / Card: {formatPrice(kpis.refundValue)}</p>
        </div>

        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">Exchanges vs Refunds</span>
            <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600">
              <RotateCcw className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-purple-600 dark:text-purple-400">{kpis.exchangePercentage}%</span>
            <span className="text-[10px] text-purple-600 font-mono">Exchange Ratio</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">{kpis.exchangeCount} customer replacement requests</p>
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-3xs">
          <div className="pb-3 border-b border-gray-100 dark:border-gray-850 mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-600" /> Return Volume & Resolution Value Trend
              </h3>
              <p className="text-[11px] text-gray-500">Track claim spikes across fiscal periods</p>
            </div>
          </div>
          <div className="h-56 w-full min-w-0" style={{ width: '100%', height: 224, minWidth: 0, minHeight: 224 }}>
            <ResponsiveContainer width="100%" height={224} minWidth={0} minHeight={224} debounce={50}>
              <AreaChart data={trendData}>
                
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '12px', color: '#fff', fontSize: '11px' }} />
                <Area type="monotone" dataKey="refunds" stroke="#6366f1" strokeWidth={2} fill="#6366f1" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-3xs flex flex-col justify-between">
          <div className="pb-3 border-b border-gray-100 dark:border-gray-850">
            <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-500" /> Structured Reason Breakdown
            </h3>
            <p className="text-[11px] text-gray-500">Feeds into catalog quality control</p>
          </div>

          <div className="h-48 w-full relative my-auto min-w-0" style={{ width: '100%', height: 192, minWidth: 0, minHeight: 192 }}>
            <ResponsiveContainer width="100%" height={192} minWidth={0} minHeight={192} debounce={50}>
              <PieChart>
                <Pie data={reasonsData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={4} dataKey="value">
                  {reasonsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-850 text-xs">
            {reasonsData.slice(0, 3).map((r) => (
              <div key={r.key} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                  <span className="text-gray-700 dark:text-gray-300">{r.name}</span>
                </div>
                <span className="font-mono font-bold text-gray-900 dark:text-white">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Overlay Modal for Managing Return Ticket Decision */}
      {selectedReturnRequest && adminActionType && (
        <div className="p-5 rounded-2xl border-2 border-indigo-500/60 bg-indigo-50/30 dark:bg-indigo-950/30 shadow-xl animate-in slide-in-from-top-4 duration-200 text-left">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-300 font-mono flex items-center gap-2 mb-3">
            <AlertCircle className="h-4.5 w-4.5 text-indigo-600" />
            {adminActionType === 'approve' && `Approve Return Ticket ${selectedReturnRequest.id}`}
            {adminActionType === 'reject' && `Reject Return Ticket ${selectedReturnRequest.id}`}
            {adminActionType === 'request_info' && `Bounce Back for Additional Evidence ${selectedReturnRequest.id}`}
            {adminActionType === 'resolve' && `Finalize & Execute M-Pesa B2C Refund ${selectedReturnRequest.id}`}
          </h4>

          <form onSubmit={handleConfirmActionSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase font-mono tracking-wider mb-1">
                Merchant Decision Note (Sent to Customer via SMS & Email)
              </label>
              <textarea
                required
                value={adminActionNote}
                onChange={(e) => setAdminActionNote(e.target.value)}
                rows={3}
                className="w-full text-xs p-3 bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900 rounded-xl text-gray-900 dark:text-white focus:outline-hidden"
              />
            </div>

            {adminActionType === 'approve' && (
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase font-mono tracking-wider mb-1">
                  Issued Reverse Courier Pickup Tracking Label
                </label>
                <input
                  type="text"
                  required
                  value={adminActionTracking}
                  onChange={(e) => setAdminActionTracking(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900 rounded-xl font-mono text-gray-900 dark:text-white"
                />
              </div>
            )}

            {adminActionType === 'resolve' && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">Simulated M-Pesa B2C Payout Reference:</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{mpesaB2cReference}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedReturnRequest(null);
                  setAdminActionType(null);
                }}
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold shadow-2xs cursor-pointer ${
                  adminActionType === 'approve' ? 'bg-indigo-600 hover:bg-indigo-700' :
                  adminActionType === 'reject' ? 'bg-rose-600 hover:bg-rose-700' :
                  'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                Submit Decision & Update Ticket
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Returns Table */}
      <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-3xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-gray-50 dark:bg-gray-900/50 p-3.5 rounded-xl border border-gray-100 dark:border-gray-850">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-tab-scroll py-1 w-full md:w-auto">
            {['all', 'pending', 'approved', 'received', 'resolved', 'rejected'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  statusFilter === s
                    ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:text-gray-900 border border-gray-200 dark:border-gray-800'
                }`}
              >
                {s === 'received' ? 'In Transit / Received' : s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search ticket, customer, order..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-8 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Tickets List */}
        {filteredRequests.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center max-w-sm mx-auto">
            <Package className="h-10 w-10 text-gray-300 mb-2" />
            <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">No Return Tickets Found</h4>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((req) => {
              const requestTotal = req.items.reduce((s, i) => s + (i.price * i.quantity), 0);
              const customerClaims = getCustomerReturnCount(req.customerEmail);
              const isFraudFlagged = customerClaims >= 2 || req.isFraudFlagged;

              return (
                <div key={req.id} className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 hover:border-indigo-200 transition-all text-left space-y-3">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-gray-850 pb-2">
                        <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-md border border-indigo-100">
                          {req.id}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">Order: <strong>{req.orderId}</strong></span>
                        <span className="text-[11px] text-gray-400 font-mono">• {req.dateSubmitted}</span>

                        {isFraudFlagged && (
                          <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-mono text-[9px] font-bold rounded-md border border-rose-200/50 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Fraud Guardrail: High Return Frequency ({customerClaims} claims)
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-400 text-[9px] uppercase font-mono block">Customer & Payout Contact</span>
                          <span className="font-semibold text-gray-900 dark:text-white block">{req.customerName}</span>
                          <span className="text-gray-500 text-[11px]">{req.customerEmail} {req.customerPhone ? `• ${req.customerPhone}` : ''}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 text-[9px] uppercase font-mono block">Claim Action & Total</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 capitalize text-xs block">
                            {req.type} • {formatPrice(requestTotal)}
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="bg-gray-50 dark:bg-gray-900/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-850 text-xs space-y-1">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase font-mono">Claimed SKUs</span>
                        {req.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px]">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{item.name}</span>
                            <span className="font-mono text-gray-500">{item.quantity} x {formatPrice(item.price)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Evidence Images thumbnail preview if available */}
                      {req.evidenceImages && req.evidenceImages.length > 0 && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] font-bold text-gray-400 font-mono uppercase">Uploaded Photos ({req.evidenceImages.length}):</span>
                          <div className="flex items-center gap-1.5">
                            {req.evidenceImages.map((img, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setLightboxImage(img)}
                                className="h-8 w-8 rounded-lg overflow-hidden border border-gray-200 hover:border-indigo-500 cursor-pointer"
                              >
                                <img src={img} alt="Evidence" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col justify-between items-end md:w-48 shrink-0 md:border-l md:border-gray-100 dark:md:border-gray-850 md:pl-4">
                      <span className={`rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase border ${
                        req.status === 'resolved' || req.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : req.status === 'approved'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : req.status === 'received' || req.status === 'in_transit'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {req.status}
                      </span>

                      {req.trackingNumber && (
                        <div className="text-right mt-2">
                          <span className="text-[9px] text-gray-400 uppercase font-mono block">Reverse Label</span>
                          <span className="font-mono text-[10px] font-bold text-indigo-600">{req.trackingNumber}</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setInspectingRequest(req)}
                        className="mt-3 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Eye className="h-3.5 w-3.5" /> Full Inspection
                      </button>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-850 flex items-center justify-between gap-2 text-xs">
                    <span className="text-gray-400 font-mono text-[10px]">Reason: {REASON_LABELS[req.reason] || req.reason}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleQuickStatusUpdate(req.id, 'approved')}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded-lg text-xs hover:bg-blue-100 cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickStatusUpdate(req.id, 'received')}
                        className="px-2.5 py-1 bg-purple-50 text-purple-700 font-bold rounded-lg text-xs hover:bg-purple-100 cursor-pointer"
                      >
                        In Transit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartAction(req, 'resolve')}
                        className="px-2.5 py-1 bg-emerald-600 text-white font-bold rounded-lg text-xs hover:bg-emerald-700 cursor-pointer"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* INSPECTION DRAWER / MODAL */}
      {inspectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setInspectingRequest(null)}
              className="absolute right-4 top-4 p-2 text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="border-b border-gray-100 dark:border-gray-850 pb-4 mb-4">
              <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                TICKET #{inspectingRequest.id}
              </span>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mt-1">
                Full Return Request Inspection & Resolution Panel
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              {/* Customer summary */}
              <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-150 dark:border-gray-800 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-mono block">Customer Name</span>
                  <span className="font-bold text-gray-900 dark:text-white">{inspectingRequest.customerName}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-mono block">Order Reference</span>
                  <span className="font-bold text-gray-900 dark:text-white">{inspectingRequest.orderId}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-mono block">Customer Contact</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{inspectingRequest.customerEmail}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-mono block">M-Pesa Payout Number</span>
                  <span className="font-mono font-bold text-emerald-600">{inspectingRequest.mpesaPhoneNumber || inspectingRequest.customerPhone || '0712345678'}</span>
                </div>
              </div>

              {/* Items & Condition */}
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white uppercase font-mono text-[10px] mb-2">
                  Claimed Items & Reported Condition
                </h4>
                <div className="space-y-2">
                  {inspectingRequest.items.map((item, idx) => (
                    <div key={idx} className="p-3 border border-gray-200 dark:border-gray-800 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{item.name}</p>
                        <p className="text-[10px] text-gray-500">
                          Qty: {item.quantity} • Unit Price: {formatPrice(item.price)} • Condition: <span className="font-bold uppercase text-indigo-600">{item.conditionReported || 'opened_unused'}</span>
                        </p>
                      </div>
                      <span className="font-mono font-bold text-indigo-600">{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Photo Evidence Lightbox */}
              {inspectingRequest.evidenceImages && inspectingRequest.evidenceImages.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white uppercase font-mono text-[10px] mb-2">
                    Submitted Evidence Images
                  </h4>
                  <div className="grid grid-cols-4 gap-2">
                    {inspectingRequest.evidenceImages.map((img, i) => (
                      <div
                        key={i}
                        onClick={() => setLightboxImage(img)}
                        className="aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer group hover:opacity-90"
                      >
                        <img src={img} alt="Evidence" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Internal Notes */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase font-mono mb-1">
                  Internal Admin Notes (Hidden from customer)
                </label>
                <textarea
                  rows={2}
                  defaultValue={inspectingRequest.adminNotes || 'Inspected by store operations desk. Physical condition verified.'}
                  className="w-full text-xs p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setInspectingRequest(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Close Inspection
                </button>
                <button
                  onClick={() => {
                    handleStartAction(inspectingRequest, 'resolve');
                    setInspectingRequest(null);
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Execute Resolution Payout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POLICY CONFIGURATOR MODAL */}
      {isPolicyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <button
              onClick={() => setIsPolicyModalOpen(false)}
              className="absolute right-4 top-4 p-2 text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="border-b border-gray-100 dark:border-gray-850 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Sliders className="h-5 w-5 text-indigo-600" /> Return Policy Configuration
              </h3>
              <p className="text-xs text-gray-500">
                Configure return windows, non-returnable categories, and auto-approval thresholds.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Return Window (Days from Delivery)
                </label>
                <input
                  type="number"
                  value={policy.returnWindowDays}
                  onChange={(e) => setPolicy({ ...policy, returnWindowDays: parseInt(e.target.value) || 7 })}
                  className="w-full text-xs p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Auto-Approve Threshold (KES)
                </label>
                <input
                  type="number"
                  value={policy.autoApproveThresholdKes}
                  onChange={(e) => setPolicy({ ...policy, autoApproveThresholdKes: parseInt(e.target.value) || 1500 })}
                  className="w-full text-xs p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <span className="font-bold text-gray-800 dark:text-gray-200">Require Photo Evidence</span>
                <input
                  type="checkbox"
                  checked={policy.requiresPhotoEvidence}
                  onChange={(e) => setPolicy({ ...policy, requiresPhotoEvidence: e.target.checked })}
                  className="h-4 w-4 rounded text-indigo-600 cursor-pointer"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  Save Return Policy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs no-print">
          <div className="relative max-w-3xl w-full p-2">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300 cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
            <img src={lightboxImage} alt="Enlarged Evidence" className="w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}

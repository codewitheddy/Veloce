import React, { useState, useMemo, useEffect } from 'react';
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
  Info,
  MapPin,
  ExternalLink,
  ChevronRight,
  Download,
  ShieldCheck,
  Award,
  QrCode,
  Send,
  Plus
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
  ResponsiveContainer 
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
  onUpdateProductStock?: (productId: string, newStock: number) => void;
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

const KENYA_COURIER_PARTNERS = [
  { id: 'g4s', name: 'G4S Secure Logistics Kenya', prefix: 'RET-G4S-NBO', avgTransit: '24 hrs', phone: '+254 711 042 000' },
  { id: 'fargo', name: 'Fargo Courier Express', prefix: 'RET-FARGO-KE', avgTransit: '24-48 hrs', phone: '+254 703 077 000' },
  { id: 'sendy', name: 'Sendy Direct Courier', prefix: 'RET-SENDY-NBO', avgTransit: 'Same Day (Nairobi)', phone: '+254 709 779 000' },
  { id: 'speedaf', name: 'SpeedAF Express Kenya', prefix: 'RET-SPDAF-KE', avgTransit: '24-36 hrs', phone: '+254 700 888 999' },
  { id: 'veloce_rider', name: 'Veloce In-House Dispatch Rider', prefix: 'RET-VEL-RDR', avgTransit: 'Instant (Nairobi Metro)', phone: '+254 792 000 111' },
];

const REGIONAL_DROP_OFF_STATIONS = [
  { city: 'Nairobi', area: 'Westlands Hub', address: 'The Pavilion, 3rd Floor, Mpaka Road', hours: 'Mon - Sat: 8:00 AM - 7:00 PM', contact: '+254 712 000 101' },
  { city: 'Nairobi', area: 'CBD Kimathi Station', address: 'Eagle House, 1st Floor, Kimathi Street', hours: 'Mon - Sat: 8:30 AM - 6:30 PM', contact: '+254 712 000 102' },
  { city: 'Nairobi', area: 'Kilimani Collection Point', address: 'Yaya Court, Suite B4, Argwings Kodhek Rd', hours: 'Mon - Sun: 9:00 AM - 8:00 PM', contact: '+254 712 000 103' },
  { city: 'Mombasa', area: 'Nyali Regional Depot', address: 'Nyali Centre, Ground Floor, Links Road', hours: 'Mon - Sat: 8:30 AM - 6:00 PM', contact: '+254 712 000 201' },
  { city: 'Kisumu', area: 'Mega City Station', address: 'Mega City Mall, Ground Floor, Nairobi Road', hours: 'Mon - Sat: 9:00 AM - 6:00 PM', contact: '+254 712 000 301' },
  { city: 'Nakuru', area: 'CBD Westside Hub', address: 'Westside Mall, 2nd Floor, Kenyatta Avenue', hours: 'Mon - Sat: 9:00 AM - 6:00 PM', contact: '+254 712 000 401' },
];

export default function ReturnsCenterDashboard({
  returnRequests,
  orders,
  onUpdateReturnRequestStatus,
  onUpdateProductStock,
  currency = 'KSh'
}: ReturnsCenterDashboardProps) {
  // Navigation Tabs within Returns Center
  const [activeSubTab, setActiveSubTab] = useState<'claims' | 'analytics' | 'logistics' | 'payouts' | 'policy'>('claims');

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
  const [inspectionGrade, setInspectionGrade] = useState<'grade_a' | 'grade_b' | 'grade_c'>('grade_a');
  const [restockSuccessMsg, setRestockSuccessMsg] = useState<string | null>(null);

  // Return Policy Configurator State (Persisted)
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policy, setPolicy] = useState<ReturnPolicy>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('veloce_return_policy');
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      returnWindowDays: 7,
      excludedCategories: ['Underwear', 'Perishables', 'Custom Orders', 'Digital Software'],
      freeReturnReasons: ['damaged_defective', 'wrong_item', 'not_as_described'],
      requiresPhotoEvidence: true,
      autoApproveThresholdKes: 1500,
      customerPaysReturnShippingOnMindChange: true
    };
  });

  const handleSavePolicy = (newPolicy: ReturnPolicy) => {
    setPolicy(newPolicy);
    try {
      localStorage.setItem('veloce_return_policy', JSON.stringify(newPolicy));
    } catch {
      // ignore
    }
    setIsPolicyModalOpen(false);
    setQuickActionToast('✅ Return Policy settings saved successfully!');
    setTimeout(() => setQuickActionToast(null), 3500);
  };

  // Action / Decision modal states
  const [selectedReturnRequest, setSelectedReturnRequest] = useState<ReturnRequest | null>(null);
  const [adminActionType, setAdminActionType] = useState<'approve' | 'reject' | 'resolve' | 'request_info' | 'inspect' | null>(null);
  const [adminActionNote, setAdminActionNote] = useState('');
  const [adminActionTracking, setAdminActionTracking] = useState('');
  const [selectedCourierId, setSelectedCourierId] = useState('g4s');
  const [mpesaB2cReference, setMpesaB2cReference] = useState('');
  const [mpesaPayoutPhone, setMpesaPayoutPhone] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'mpesa_b2c' | 'store_credit' | 'bank_transfer'>('mpesa_b2c');
  const [isExecutingPayout, setIsExecutingPayout] = useState(false);
  const [payoutReceipt, setPayoutReceipt] = useState<{
    txnId: string;
    amount: number;
    phone: string;
    recipient: string;
    timestamp: string;
    smsText: string;
  } | null>(null);

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
      .filter(r => (r.type === 'refund' || r.resolutionType === 'refund') && (r.status === 'resolved' || r.status === 'completed'))
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
      avgTurnaroundDays: 1.4
    };
  }, [returnRequests, orders]);

  // 2. Monthly Trend Data
  const trendData = useMemo(() => {
    const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    return months.map((month, idx) => {
      const baseRequests = Math.max(1, Math.round((returnRequests.length / 6) * (idx + 1)));
      const refunds = Math.round(baseRequests * 0.7);
      const exchanges = Math.max(0, baseRequests - refunds);
      const totalAmount = Math.round((kpis.totalValue / (returnRequests.length || 1)) * baseRequests);

      return {
        month,
        totalReturns: baseRequests,
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

  // 4. Quality Control SKU Breakdown (Identifies high return items)
  const qualityControlSkus = useMemo(() => {
    const map: Record<string, { name: string; count: number; topReason: string; totalVal: number }> = {};
    returnRequests.forEach(req => {
      req.items.forEach(item => {
        const key = item.productId || item.name;
        if (!map[key]) {
          map[key] = {
            name: item.name,
            count: 0,
            topReason: REASON_LABELS[req.reason] || req.reason,
            totalVal: 0
          };
        }
        map[key].count += item.quantity;
        map[key].totalVal += item.price * item.quantity;
      });
    });

    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [returnRequests]);

  // 5. Processing Duration Bar Data
  const processingDurationData = [
    { duration: '< 24 Hours', count: Math.max(1, Math.round(kpis.totalRequests * 0.55)), sla: '98% SLA Compliance', color: '#10b981' },
    { duration: '1 - 2 Days', count: Math.max(1, Math.round(kpis.totalRequests * 0.30)), sla: '95% Standard', color: '#6366f1' },
    { duration: '3 - 5 Days', count: Math.max(0, Math.round(kpis.totalRequests * 0.10)), sla: '88% Attention', color: '#f59e0b' },
    { duration: '> 5 Days', count: Math.max(0, Math.round(kpis.totalRequests * 0.05)), sla: 'Delayed', color: '#f43f5e' },
  ];

  // 6. Filtered Requests
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

  // Generate Safaricom M-Pesa B2C Transaction Reference
  const generateMpesaB2cCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'RCL';
    for (let i = 0; i < 7; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Start Action handler
  const handleStartAction = (req: ReturnRequest, type: 'approve' | 'reject' | 'resolve' | 'request_info' | 'inspect') => {
    setSelectedReturnRequest(req);
    setAdminActionType(type);
    setPayoutReceipt(null);

    const courier = KENYA_COURIER_PARTNERS.find(c => c.id === selectedCourierId) || KENYA_COURIER_PARTNERS[0];
    const generatedWaybill = `${courier.prefix}-${Math.floor(100000 + Math.random() * 900000)}`;

    if (type === 'approve') {
      setAdminActionNote(`Return claim approved. Reverse courier pickup scheduled via ${courier.name}. Waybill: ${generatedWaybill}.`);
      setAdminActionTracking(generatedWaybill);
    } else if (type === 'reject') {
      setAdminActionNote(`Regrettably, your return claim could not be approved as the item condition or request date exceeds the ${policy.returnWindowDays}-day return window.`);
      setAdminActionTracking('');
    } else if (type === 'request_info') {
      setAdminActionNote(`Merchant Operations requested additional photo evidence of the item barcode tag or courier packaging seal.`);
      setAdminActionTracking('');
    } else if (type === 'resolve') {
      const b2cRef = generateMpesaB2cCode();
      const phone = req.mpesaPhoneNumber || req.customerPhone || '0712849201';
      setMpesaB2cReference(b2cRef);
      setMpesaPayoutPhone(phone);
      setAdminActionNote(`Returned item received and passed inspection. M-Pesa B2C instant payout executed (Ref: ${b2cRef}) to ${phone}.`);
      setAdminActionTracking(req.trackingNumber || generatedWaybill);
    }
  };

  // Execute M-Pesa B2C Payout Simulation
  const handleExecuteMpesaB2cPayout = async () => {
    if (!selectedReturnRequest) return;
    setIsExecutingPayout(true);

    const totalRefund = selectedReturnRequest.items.reduce((s, i) => s + (i.price * i.quantity), 0);
    const txnCode = mpesaB2cReference || generateMpesaB2cCode();
    const cleanPhone = mpesaPayoutPhone.trim() || '0712849201';
    const nowTime = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    const nowDate = new Date().toLocaleDateString('en-KE');

    // Simulate 750ms Safaricom Daraja B2C API roundtrip
    await new Promise(res => setTimeout(res, 750));

    const receipt = {
      txnId: txnCode,
      amount: totalRefund,
      phone: cleanPhone,
      recipient: selectedReturnRequest.customerName.toUpperCase(),
      timestamp: `${nowDate} at ${nowTime}`,
      smsText: `${txnCode} Confirmed. Ksh ${totalRefund.toLocaleString()}.00 sent to ${selectedReturnRequest.customerName.toUpperCase()} ${cleanPhone} on ${nowDate} at ${nowTime}. B2C Fee Ksh 0.00. Veloce Reverse Logistics.`
    };

    setPayoutReceipt(receipt);
    setIsExecutingPayout(false);

    onUpdateReturnRequestStatus(
      selectedReturnRequest.id,
      'resolved',
      `M-Pesa B2C Payout Executed! Ref: ${txnCode} | Amount: ${formatPrice(totalRefund)} | Phone: ${cleanPhone}`,
      selectedReturnRequest.trackingNumber || adminActionTracking
    );

    setQuickActionToast(`💰 M-Pesa B2C Refund of ${formatPrice(totalRefund)} successfully dispatched to ${cleanPhone}!`);
    setTimeout(() => setQuickActionToast(null), 4500);
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
    setPayoutReceipt(null);
  };

  // Quick Action Helper
  const handleQuickStatusUpdate = (requestId: string, newStatus: ReturnRequest['status']) => {
    let note = '';
    let trackingNumber: string | undefined = undefined;

    if (newStatus === 'approved') {
      const courier = KENYA_COURIER_PARTNERS[0];
      trackingNumber = `${courier.prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
      note = `Quick action: Return approved & reverse pickup scheduled via ${courier.name}.`;
    } else if (newStatus === 'received' || newStatus === 'in_transit') {
      note = 'Quick action: Item marked in-transit / received at central inspection facility.';
    } else if (newStatus === 'rejected') {
      note = 'Quick action: Claim rejected by store operations.';
    } else if (newStatus === 'resolved' || newStatus === 'completed') {
      const b2cCode = generateMpesaB2cCode();
      note = `Quick action: Return resolved. M-Pesa B2C refund issued (Ref: ${b2cCode}).`;
    }

    onUpdateReturnRequestStatus(requestId, newStatus, note, trackingNumber);

    setQuickActionToast(`⚡ Return ticket #${requestId} updated to ${newStatus.toUpperCase()}!`);
    setTimeout(() => {
      setQuickActionToast(null);
    }, 3500);
  };

  // Restock item to inventory
  const handleRestockInspectedItem = (item: { productId?: string; name: string; quantity: number }) => {
    if (item.productId && onUpdateProductStock) {
      onUpdateProductStock(item.productId, 1);
      setRestockSuccessMsg(`📦 Restocked +${item.quantity} "${item.name}" back into live active stock inventory.`);
      setTimeout(() => setRestockSuccessMsg(null), 4000);
    } else {
      setRestockSuccessMsg(`📦 Stock increment logged for "${item.name}".`);
      setTimeout(() => setRestockSuccessMsg(null), 4000);
    }
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
      const courier = KENYA_COURIER_PARTNERS[0];
      onUpdateReturnRequestStatus(
        id,
        'approved',
        `Bulk Action: Return approved & pickup scheduled via ${courier.name}.`,
        `${courier.prefix}-${Math.floor(100000 + Math.random() * 900000)}`
      );
    });
    setQuickActionToast(`⚡ Bulk Approved ${selectedRequestIds.length} return claims!`);
    setSelectedRequestIds([]);
  };

  const handleBulkReject = () => {
    if (selectedRequestIds.length === 0) return;
    selectedRequestIds.forEach((id) => {
      onUpdateReturnRequestStatus(id, 'rejected', 'Bulk Action: Claim rejected by store manager.');
    });
    setQuickActionToast(`⚡ Bulk Rejected ${selectedRequestIds.length} claims.`);
    setSelectedRequestIds([]);
  };

  return (
    <div className="space-y-6 font-sans text-gray-900 dark:text-white">
      {/* Quick Action Toast */}
      {quickActionToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-950 text-white dark:bg-white dark:text-gray-950 px-4 py-3 rounded-2xl shadow-2xl border border-gray-800 dark:border-gray-200 text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-bottom-5 duration-200">
          <Zap className="h-4 w-4 text-amber-400 dark:text-amber-600 fill-amber-400 shrink-0 animate-pulse" />
          <span>{quickActionToast}</span>
          <button onClick={() => setQuickActionToast(null)} className="ml-2 text-gray-400 hover:text-white dark:hover:text-gray-900 cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner & Suite Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-850 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 shadow-xs">
            <RotateCcw className="h-6 w-6 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                Product Returns & Reverse Logistics Spec
              </h2>
              <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono text-[10px] font-extrabold rounded-md uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/60">
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
            className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-800 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-2 cursor-pointer shadow-3xs"
          >
            <Sliders className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Return Policy Config
          </button>

          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200/60 dark:border-gray-800">
            {(['7d', '30d', '6m', '1y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer font-mono ${
                  timeRange === range
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-3xs font-bold'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top Level Nav Tabs */}
      <div className="flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-850 pb-2 overflow-x-auto custom-tab-scroll">
        {[
          { id: 'claims', label: 'Active Return Claims', icon: Package, count: kpis.totalRequests },
          { id: 'analytics', label: 'Reason & SLA Analytics', icon: TrendingUp, count: null },
          { id: 'logistics', label: 'Reverse Logistics & Couriers', icon: Truck, count: KENYA_COURIER_PARTNERS.length },
          { id: 'payouts', label: 'M-Pesa B2C Payout Engine', icon: Smartphone, count: kpis.resolvedCount },
          { id: 'policy', label: 'Return Policy & Rules', icon: Settings, count: null },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isActive ? 'bg-indigo-800 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">Store Return Rate</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-gray-900 dark:text-white">{kpis.returnRatePct}%</span>
            <span className="text-[10px] text-emerald-600 font-semibold font-mono">Industry standard &lt;3%</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">{kpis.totalRequests} claims against completed orders</p>
        </div>

        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">Pending Review & Inspection</span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400">{kpis.pendingCount}</span>
            <span className="text-[10px] text-amber-600 font-mono font-bold">Action Required</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Awaiting admin review or photo verification</p>
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
          <p className="text-[11px] text-gray-500 mt-1">Refunded via M-Pesa B2C: {formatPrice(kpis.refundValue)}</p>
        </div>

        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">Exchange vs Refund Ratio</span>
            <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600">
              <RotateCcw className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-purple-600 dark:text-purple-400">{kpis.exchangePercentage}%</span>
            <span className="text-[10px] text-purple-600 font-mono">Retained Revenue</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">{kpis.exchangeCount} customer replacement requests</p>
        </div>
      </div>

      {/* VIEW 1: ACTIVE CLAIMS TABLE */}
      {activeSubTab === 'claims' && (
        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-3xs space-y-4">
          {/* Table Filters & Command Bar */}
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

              {selectedRequestIds.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleBulkApprove}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    Approve ({selectedRequestIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkReject}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    Reject ({selectedRequestIds.length})
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tickets List */}
          {filteredRequests.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center max-w-sm mx-auto">
              <Package className="h-10 w-10 text-gray-300 dark:text-gray-700 mb-2" />
              <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">No Return Tickets Found</h4>
              <p className="text-xs text-gray-500 mt-1">Try resetting your filters or search keywords.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between px-2 text-xs text-gray-500 font-mono">
                <button
                  type="button"
                  onClick={handleToggleSelectAllFiltered}
                  className="flex items-center gap-2 hover:text-indigo-600 cursor-pointer font-bold"
                >
                  {isAllFilteredSelected ? <CheckSquare className="h-4 w-4 text-indigo-600" /> : <Square className="h-4 w-4" />}
                  <span>Select All Filtered ({filteredRequests.length})</span>
                </button>
                <span>Showing {filteredRequests.length} tickets</span>
              </div>

              {filteredRequests.map((req) => {
                const requestTotal = req.items.reduce((s, i) => s + (i.price * i.quantity), 0);
                const customerClaims = getCustomerReturnCount(req.customerEmail);
                const isFraudFlagged = customerClaims >= 2 || req.isFraudFlagged;
                const isSelected = selectedRequestIds.includes(req.id);

                return (
                  <div 
                    key={req.id} 
                    className={`rounded-2xl border ${isSelected ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20' : 'border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950'} p-4 hover:border-indigo-300 transition-all text-left space-y-3 shadow-3xs`}
                  >
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectRequest(req.id)}
                          className="mt-1 text-gray-400 hover:text-indigo-600 cursor-pointer"
                        >
                          {isSelected ? <CheckSquare className="h-4.5 w-4.5 text-indigo-600" /> : <Square className="h-4.5 w-4.5" />}
                        </button>

                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-gray-850 pb-2">
                            <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/60">
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
                              <span className="text-gray-400 text-[9px] uppercase font-mono block">Customer & M-Pesa Number</span>
                              <span className="font-semibold text-gray-900 dark:text-white block">{req.customerName}</span>
                              <span className="text-gray-500 text-[11px]">{req.customerEmail} • <span className="font-mono font-bold text-emerald-600">{req.mpesaPhoneNumber || req.customerPhone || '0712345678'}</span></span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[9px] uppercase font-mono block">Claim Action & Amount</span>
                              <span className="font-bold text-indigo-600 dark:text-indigo-400 capitalize text-xs block">
                                {req.type} ({req.resolutionType || 'refund'}) • {formatPrice(requestTotal)}
                              </span>
                            </div>
                          </div>

                          {/* Items List */}
                          <div className="bg-gray-50 dark:bg-gray-900/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-850 text-xs space-y-1">
                            <span className="block text-[9px] font-bold text-gray-400 uppercase font-mono">Claimed SKUs</span>
                            {req.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[11px]">
                                <span className="font-semibold text-gray-800 dark:text-gray-200">{item.name}</span>
                                <span className="font-mono text-gray-500">{item.quantity} x {formatPrice(item.price)}</span>
                              </div>
                            ))}
                          </div>

                          {/* Reason Detail Notes */}
                          {req.reasonDetails && (
                            <p className="text-xs text-gray-600 dark:text-gray-300 italic bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30">
                              💬 &quot;{req.reasonDetails}&quot;
                            </p>
                          )}

                          {/* Evidence Images thumbnail preview if available */}
                          {req.evidenceImages && req.evidenceImages.length > 0 && (
                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-[10px] font-bold text-gray-400 font-mono uppercase">Evidence Photos ({req.evidenceImages.length}):</span>
                              <div className="flex items-center gap-1.5">
                                {req.evidenceImages.map((img, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => setLightboxImage(img)}
                                    className="h-9 w-9 rounded-lg overflow-hidden border border-gray-200 hover:border-indigo-500 cursor-pointer shadow-3xs"
                                  >
                                    <img src={img} alt="Evidence" className="w-full h-full object-cover" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col justify-between items-end md:w-48 shrink-0 md:border-l md:border-gray-100 dark:md:border-gray-850 md:pl-4">
                        <span className={`rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase border ${
                          req.status === 'resolved' || req.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                            : req.status === 'approved'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                            : req.status === 'received' || req.status === 'in_transit'
                            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                            : req.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                        }`}>
                          {req.status}
                        </span>

                        {req.trackingNumber && (
                          <div className="text-right mt-2">
                            <span className="text-[9px] text-gray-400 uppercase font-mono block">Reverse Waybill</span>
                            <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{req.trackingNumber}</span>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setInspectingRequest(req)}
                          className="mt-3 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 cursor-pointer transition-all shadow-3xs"
                        >
                          <Eye className="h-3.5 w-3.5 text-indigo-600" /> Full Inspection
                        </button>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-850 flex items-center justify-between gap-2 text-xs">
                      <span className="text-gray-400 font-mono text-[10px]">Reason: <strong>{REASON_LABELS[req.reason] || req.reason}</strong></span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickStatusUpdate(req.id, 'approved')}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold rounded-lg text-xs cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickStatusUpdate(req.id, 'received')}
                          className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-bold rounded-lg text-xs cursor-pointer"
                        >
                          Mark In Transit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartAction(req, 'resolve')}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          <Smartphone className="h-3 w-3" /> M-Pesa Payout
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

      {/* VIEW 2: REASON & SLA ANALYTICS */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Trend Chart */}
            <div className="lg:col-span-8 rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-3xs">
              <div className="pb-3 border-b border-gray-100 dark:border-gray-850 mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-600" /> Return Volume & Resolution Value Trend
                  </h3>
                  <p className="text-[11px] text-gray-500">Track claim spikes across Kenyan fiscal months</p>
                </div>
              </div>
              <div className="h-64 w-full min-w-0" style={{ width: '100%', height: 256, minWidth: 0, minHeight: 256 }}>
                <ResponsiveContainer width="100%" height={256} minWidth={0} minHeight={256} debounce={50}>
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '12px', color: '#fff', fontSize: '11px' }} />
                    <Area type="monotone" dataKey="refunds" name="Refunds" stroke="#6366f1" strokeWidth={2.5} fill="#6366f1" fillOpacity={0.15} />
                    <Area type="monotone" dataKey="exchanges" name="Exchanges" stroke="#10b981" strokeWidth={2.5} fill="#10b981" fillOpacity={0.15} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Donut Reasons */}
            <div className="lg:col-span-4 rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-3xs flex flex-col justify-between">
              <div className="pb-3 border-b border-gray-100 dark:border-gray-850">
                <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-500" /> Structured Reason Breakdown
                </h3>
                <p className="text-[11px] text-gray-500">Categorized return claims distribution</p>
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
                {reasonsData.slice(0, 4).map((r) => (
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

          {/* Quality Control SKUs & SLA Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-3xs">
              <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-amber-500" /> Quality Control & High-Return SKU Watchlist
              </h3>
              <p className="text-[11px] text-gray-500 mb-4">Items requiring catalog inspection or supplier packaging review</p>

              <div className="space-y-2.5">
                {qualityControlSkus.map((skuItem, i) => (
                  <div key={i} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-150 dark:border-gray-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{skuItem.name}</p>
                      <p className="text-[10px] text-gray-500">Top Issue: <span className="text-amber-600 font-semibold">{skuItem.topReason}</span></p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-rose-600">{skuItem.count} claims</span>
                      <span className="block text-[10px] text-gray-400">{formatPrice(skuItem.totalVal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-3xs">
              <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-indigo-600" /> Resolution SLA Turnaround Benchmarks
              </h3>
              <p className="text-[11px] text-gray-500 mb-4">Average claim closure time: 1.4 Days</p>

              <div className="space-y-3">
                {processingDurationData.map((d, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{d.duration}</span>
                      <span className="font-mono text-[10px] font-bold text-emerald-600">{d.sla} ({d.count} tickets)</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.max(15, (d.count / (kpis.totalRequests || 1)) * 100))}%`, backgroundColor: d.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: REVERSE LOGISTICS & COURIERS */}
      {activeSubTab === 'logistics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Kenya Couriers List */}
            <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-3xs space-y-4">
              <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Truck className="h-4 w-4 text-indigo-600" /> Integrated Kenya Reverse Courier Partners
              </h3>
              <p className="text-[11px] text-gray-500">Official partners for doorstep pickup and return transit</p>

              <div className="space-y-3">
                {KENYA_COURIER_PARTNERS.map((courier) => (
                  <div key={courier.id} className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-gray-900 dark:text-white">{courier.name}</h4>
                      <p className="text-[10px] text-gray-500 font-mono">Waybill Prefix: <span className="font-bold text-indigo-600">{courier.prefix}</span> • ETA: {courier.avgTransit}</p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-mono font-bold rounded-lg border border-emerald-200">
                      ACTIVE API
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Regional Drop-off Stations */}
            <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-3xs space-y-4">
              <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin className="h-4 w-4 text-rose-500" /> Regional Customer Drop-off Depots
              </h3>
              <p className="text-[11px] text-gray-500">Designated physical drop-off hubs for fast parcel handover</p>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 custom-tab-scroll">
                {REGIONAL_DROP_OFF_STATIONS.map((station, i) => (
                  <div key={i} className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{station.city} • {station.area}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{station.hours}</span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-[11px]">{station.address}</p>
                    <p className="text-[10px] text-gray-500 mt-1 font-mono">📞 Helpdesk: {station.contact}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: M-PESA B2C PAYOUT ENGINE */}
      {activeSubTab === 'payouts' && (
        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-3xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-850 pb-4">
            <div>
              <h3 className="font-display text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-emerald-600" /> Safaricom M-Pesa B2C Payout Engine
              </h3>
              <p className="text-xs text-gray-500">Automated reverse refund disbursement to customer Safaricom wallets</p>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs font-mono">
              <span className="text-emerald-700 dark:text-emerald-300 font-bold">B2C Treasury Balance:</span>
              <span className="font-bold text-emerald-800 dark:text-emerald-200">KSh 482,100.00</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 p-5 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-4 text-xs">
              <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" /> Direct Refund Payout Terminal
              </h4>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase font-mono mb-1">Select Pending Ticket</label>
                <select
                  className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs"
                  onChange={(e) => {
                    const req = returnRequests.find(r => r.id === e.target.value);
                    if (req) handleStartAction(req, 'resolve');
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Choose ticket for instant B2C disbursement...</option>
                  {returnRequests.filter(r => r.status !== 'resolved' && r.status !== 'rejected').map(r => (
                    <option key={r.id} value={r.id}>
                      {r.id} - {r.customerName} ({formatPrice(r.items.reduce((s, i) => s + i.price * i.quantity, 0))})
                    </option>
                  ))}
                </select>
              </div>

              {selectedReturnRequest && (
                <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Customer:</span>
                    <strong className="text-gray-900 dark:text-white">{selectedReturnRequest.customerName}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Refund Amount:</span>
                    <strong className="text-emerald-600 font-mono text-sm font-bold">
                      {formatPrice(selectedReturnRequest.items.reduce((s, i) => s + i.price * i.quantity, 0))}
                    </strong>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase font-mono mb-1">Destination M-Pesa Phone</label>
                    <input
                      type="text"
                      value={mpesaPayoutPhone}
                      onChange={(e) => setMpesaPayoutPhone(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl font-mono text-xs"
                      placeholder="e.g. 0712345678"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isExecutingPayout}
                    onClick={handleExecuteMpesaB2cPayout}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isExecutingPayout ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                    <span>{isExecutingPayout ? 'Disbursing via Daraja API...' : 'Execute Instant M-Pesa Payout'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Simulated Live Receipt Preview */}
            <div className="lg:col-span-7 p-5 rounded-2xl bg-gray-950 text-white border border-gray-800 space-y-4 text-xs font-mono">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <span className="text-emerald-400 font-bold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> SAFARICOM M-PESA B2C CONFIRMATION RECEIPT
                </span>
                <span className="text-[10px] text-gray-500">PORT: 552288</span>
              </div>

              {payoutReceipt ? (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300">
                    <p className="text-[11px] leading-relaxed">{payoutReceipt.smsText}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                    <div>Transaction Ref: <strong className="text-white">{payoutReceipt.txnId}</strong></div>
                    <div>Status: <strong className="text-emerald-400">SUCCESSFUL (Completed)</strong></div>
                    <div>Paid Out: <strong className="text-white">{formatPrice(payoutReceipt.amount)}</strong></div>
                    <div>Recipient: <strong className="text-white">{payoutReceipt.recipient}</strong></div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-500 space-y-2">
                  <Smartphone className="h-8 w-8 mx-auto text-gray-700" />
                  <p className="text-xs">Select a return ticket to generate a verified M-Pesa B2C transaction receipt.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 5: RETURN POLICY & RULES */}
      {activeSubTab === 'policy' && (
        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-5 shadow-3xs space-y-5">
          <div className="border-b border-gray-100 dark:border-gray-850 pb-3">
            <h3 className="font-display text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sliders className="h-5 w-5 text-indigo-600" /> Kenya Storefront Return Policy Configuration
            </h3>
            <p className="text-xs text-gray-500">Controls return eligibility, auto-approval thresholds, and exclusions</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Return Window Period (Days)</label>
                <input
                  type="number"
                  value={policy.returnWindowDays}
                  onChange={(e) => setPolicy({ ...policy, returnWindowDays: parseInt(e.target.value) || 7 })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Auto-Approval Threshold (KES)</label>
                <input
                  type="number"
                  value={policy.autoApproveThresholdKes}
                  onChange={(e) => setPolicy({ ...policy, autoApproveThresholdKes: parseInt(e.target.value) || 1500 })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <div>
                  <span className="font-bold text-gray-800 dark:text-gray-200 block">Require Customer Photo Evidence</span>
                  <span className="text-[10px] text-gray-500">Requires customers to attach clear photos before filing ticket</span>
                </div>
                <input
                  type="checkbox"
                  checked={policy.requiresPhotoEvidence}
                  onChange={(e) => setPolicy({ ...policy, requiresPhotoEvidence: e.target.checked })}
                  className="h-4 w-4 rounded text-indigo-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <div>
                  <span className="font-bold text-gray-800 dark:text-gray-200 block">Customer Pays Return Shipping on Mind Change</span>
                  <span className="text-[10px] text-gray-500">Free pickup applies only for defective/wrong item claims</span>
                </div>
                <input
                  type="checkbox"
                  checked={policy.customerPaysReturnShippingOnMindChange}
                  onChange={(e) => setPolicy({ ...policy, customerPaysReturnShippingOnMindChange: e.target.checked })}
                  className="h-4 w-4 rounded text-indigo-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-gray-850 flex justify-end">
            <button
              type="button"
              onClick={() => handleSavePolicy(policy)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
            >
              Save Policy Rules
            </button>
          </div>
        </div>
      )}

      {/* FULL INSPECTION & PHOTO LIGHTBOX MODAL */}
      {inspectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4 text-left text-xs">
            <button
              onClick={() => setInspectingRequest(null)}
              className="absolute right-4 top-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="border-b border-gray-100 dark:border-gray-850 pb-3">
              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-md">
                INSPECTION #{inspectingRequest.id}
              </span>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mt-1">
                Photo Evidence Inspection & Restock Decision Panel
              </h3>
            </div>

            {restockSuccessMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-semibold animate-in fade-in">
                {restockSuccessMsg}
              </div>
            )}

            {/* Customer & Ticket Info */}
            <div className="p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-150 dark:border-gray-800 grid grid-cols-2 gap-3">
              <div>
                <span className="text-gray-400 text-[10px] uppercase font-mono block">Customer Name</span>
                <span className="font-bold text-gray-900 dark:text-white">{inspectingRequest.customerName}</span>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] uppercase font-mono block">Order Reference</span>
                <span className="font-bold text-gray-900 dark:text-white">{inspectingRequest.orderId}</span>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] uppercase font-mono block">Contact Email</span>
                <span className="text-gray-700 dark:text-gray-300">{inspectingRequest.customerEmail}</span>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] uppercase font-mono block">M-Pesa Payout Number</span>
                <span className="font-mono font-bold text-emerald-600">{inspectingRequest.mpesaPhoneNumber || inspectingRequest.customerPhone || '0712345678'}</span>
              </div>
            </div>

            {/* Items & Restock Control */}
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white uppercase font-mono text-[10px] mb-2">Claimed Items & Restock Options</h4>
              <div className="space-y-2">
                {inspectingRequest.items.map((item, idx) => (
                  <div key={idx} className="p-3 border border-gray-200 dark:border-gray-800 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{item.name}</p>
                      <p className="text-[10px] text-gray-500">Reported Condition: <strong className="text-indigo-600 uppercase">{item.conditionReported || 'opened_unused'}</strong></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-600 mr-2">{formatPrice(item.price * item.quantity)}</span>
                      <button
                        type="button"
                        onClick={() => handleRestockInspectedItem(item)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-xs cursor-pointer"
                      >
                        +1 Restock Item
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Photo Lightbox Grid */}
            {inspectingRequest.evidenceImages && inspectingRequest.evidenceImages.length > 0 && (
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white uppercase font-mono text-[10px] mb-2">Customer Evidence Photos</h4>
                <div className="grid grid-cols-3 gap-2.5">
                  {inspectingRequest.evidenceImages.map((img, i) => (
                    <div
                      key={i}
                      onClick={() => setLightboxImage(img)}
                      className="aspect-video rounded-xl overflow-hidden border border-gray-200 hover:border-indigo-500 cursor-pointer shadow-3xs group relative"
                    >
                      <img src={img} alt="Evidence" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                      <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">Zoom</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quality Inspection Grade */}
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2">
              <label className="block text-[10px] font-bold text-gray-500 uppercase font-mono">Inspector Grade Assessment</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'grade_a', label: 'Grade A: Pristine', desc: 'Resellable as Brand New' },
                  { id: 'grade_b', label: 'Grade B: Open Box', desc: 'Minor Packaging Blemish (-15%)' },
                  { id: 'grade_c', label: 'Grade C: Defective', desc: 'Scrap or Return to Supplier' }
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setInspectionGrade(g.id as any)}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      inspectionGrade === g.id
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <p className="font-bold text-xs">{g.label}</p>
                    <p className="text-[10px] text-gray-500">{g.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-850">
              <button
                onClick={() => setInspectingRequest(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Close Inspection
              </button>
              <button
                onClick={() => {
                  handleStartAction(inspectingRequest, 'resolve');
                  setInspectingRequest(null);
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Execute M-Pesa Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE PHOTO ENLARGED LIGHTBOX */}
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

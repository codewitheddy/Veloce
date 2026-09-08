/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Truck,
  Briefcase,
  Layers,
  DollarSign,
  TrendingUp,
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Building,
  Mail,
  Phone,
  CreditCard,
  FileText,
  Eye,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  ChevronRight,
  Sliders,
  Check,
  X,
  PieChart,
  BarChart3,
  Percent,
  Receipt,
  ShieldCheck,
  Smartphone,
  Wallet,
  Coins
} from 'lucide-react';
import {
  Supplier,
  SupplierProduct,
  SupplierIntakeBatch,
  SupplierPayment,
  SupplierLedgerEntry,
  SupplierStatement,
  SupplierDashboardMetrics,
  SupplierReportData,
  SupplierPaymentStatus,
  SupplierPaymentTerms,
  SupplierPaymentMethod
} from '../types/supplier';
import { supplierApi } from '../services/supplierApi';

interface SupplierManagementPanelProps {
  darkMode?: boolean;
  currency?: string;
  onNavigateToProduct?: (productId: string) => void;
}

type PanelTab =
  | 'dashboard'
  | 'suppliers'
  | 'products'
  | 'intakes'
  | 'payments'
  | 'reports';

export default function SupplierManagementPanel({
  darkMode = false,
  currency = 'KSh',
  onNavigateToProduct
}: SupplierManagementPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('dashboard');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Primary Data Collections
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [intakes, setIntakes] = useState<SupplierIntakeBatch[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<SupplierDashboardMetrics | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');
  const [selectedPaymentStatusFilter, setSelectedPaymentStatusFilter] = useState<string>('all');
  const [selectedDateRangeFilter, setSelectedDateRangeFilter] = useState<string>('all');

  // Modals
  const [showAddSupplierModal, setShowAddSupplierModal] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierFormData, setSupplierFormData] = useState<Partial<Supplier>>({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    physical_address: '',
    tax_pin: '',
    payment_terms: 'Consignment Sale',
    bank_name: '',
    bank_account_number: '',
    mpesa_number: '',
    mpesa_account_name: '',
    status: 'Active',
    notes: ''
  });

  const [showIntakeModal, setShowIntakeModal] = useState<boolean>(false);
  const [intakeFormData, setIntakeFormData] = useState({
    supplier: '',
    product_name: '',
    product_sku: '',
    quantity_received: 10,
    unit_cost: 1500,
    delivery_note_ref: '',
    invoice_ref: '',
    notes: '',
    received_by: 'Warehouse Manager'
  });

  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentFormData, setPaymentFormData] = useState<{
    supplier: string;
    amount: number;
    payment_method: SupplierPaymentMethod;
    transaction_code: string;
    notes: string;
    processed_by: string;
  }>({
    supplier: '',
    amount: 0,
    payment_method: 'M-PESA',
    transaction_code: '',
    notes: '',
    processed_by: 'Finance Controller'
  });

  const [selectedStatementSupplier, setSelectedStatementSupplier] = useState<Supplier | null>(null);
  const [statementData, setStatementData] = useState<SupplierStatement | null>(null);
  const [isLoadingStatement, setIsLoadingStatement] = useState<boolean>(false);

  // Reports state
  const [selectedReportType, setSelectedReportType] = useState<string>('outstanding_balances');
  const [reportData, setReportData] = useState<SupplierReportData | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);

  // Load all initial data
  const loadAllData = async () => {
    try {
      setIsLoading(true);
      const [fetchedSuppliers, fetchedProducts, fetchedIntakes, fetchedPayments, metrics] =
        await Promise.all([
          supplierApi.getSuppliers(),
          supplierApi.getSupplierProducts(),
          supplierApi.getIntakeBatches(),
          supplierApi.getPayments(),
          supplierApi.getDashboardAnalytics()
        ]);

      setSuppliers(fetchedSuppliers);
      setSupplierProducts(fetchedProducts);
      setIntakes(fetchedIntakes);
      setPayments(fetchedPayments);
      setDashboardMetrics(metrics);
    } catch (err) {
      console.error('Error loading supplier data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAllData();
    setStatusMessage('Supplier ledger synchronized.');
    setTimeout(() => setStatusMessage(''), 3000);
  };

  // Supplier Statement Handler
  const handleOpenStatement = async (supplier: Supplier) => {
    setSelectedStatementSupplier(supplier);
    setIsLoadingStatement(true);
    try {
      const statement = await supplierApi.getSupplierStatement(supplier.id);
      setStatementData(statement);
    } catch (err) {
      console.error('Error fetching statement:', err);
    } finally {
      setIsLoadingStatement(false);
    }
  };

  // Generate Report Handler
  const handleGenerateReport = async (type: string, supId?: string) => {
    setSelectedReportType(type);
    setIsLoadingReport(true);
    try {
      const report = await supplierApi.getReport(type, supId === 'all' ? undefined : supId);
      setReportData(report);
    } catch (err) {
      console.error('Error loading report:', err);
    } finally {
      setIsLoadingReport(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') {
      handleGenerateReport(selectedReportType, selectedSupplierFilter);
    }
  }, [activeTab, selectedReportType, selectedSupplierFilter]);

  // Create or Update Supplier
  const handleSaveSupplier = async () => {
    if (!supplierFormData.name) return;
    try {
      if (editingSupplier) {
        const updated = await supplierApi.updateSupplier(editingSupplier.id, supplierFormData);
        setSuppliers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        setStatusMessage(`Supplier '${updated.name}' updated.`);
      } else {
        const created = await supplierApi.createSupplier(supplierFormData);
        setSuppliers((prev) => [created, ...prev]);
        setStatusMessage(`Supplier '${created.name}' registered.`);
      }
      setShowAddSupplierModal(false);
      setEditingSupplier(null);
      setSupplierFormData({
        name: '',
        company_name: '',
        email: '',
        phone: '',
        physical_address: '',
        tax_pin: '',
        payment_terms: 'Consignment Sale',
        bank_name: '',
        bank_account_number: '',
        mpesa_number: '',
        mpesa_account_name: '',
        status: 'Active',
        notes: ''
      });
      loadAllData();
      setTimeout(() => setStatusMessage(''), 3500);
    } catch (err: any) {
      console.error('Error saving supplier:', err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        (err?.response?.data && typeof err.response.data === 'object'
          ? Object.entries(err.response.data)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
              .join('; ')
          : null) ||
        err?.message ||
        'Failed to save supplier.';
      setStatusMessage(errMsg);
      setTimeout(() => setStatusMessage(''), 5000);
    }
  };

  // Delete Supplier
  const handleDeleteSupplier = async (supplier: Supplier) => {
    if (!window.confirm(`Are you sure you want to delete supplier "${supplier.name}" (${supplier.code})? This will remove all associated records.`)) {
      return;
    }
    try {
      await supplierApi.deleteSupplier(supplier.id);
      setSuppliers((prev) => prev.filter((s) => s.id !== supplier.id));
      setStatusMessage(`Supplier '${supplier.name}' deleted.`);
      loadAllData();
      setTimeout(() => setStatusMessage(''), 3500);
    } catch (err: any) {
      console.error('Error deleting supplier:', err);
      const errMsg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Failed to delete supplier.';
      setStatusMessage(errMsg);
      setTimeout(() => setStatusMessage(''), 5000);
    }
  };

  // Create Stock Intake (GRN)
  const handleSaveIntake = async () => {
    if (!intakeFormData.supplier || !intakeFormData.product_name) return;
    try {
      const created = await supplierApi.createIntakeBatch(intakeFormData);
      setIntakes((prev) => [created, ...prev]);
      setShowIntakeModal(false);
      setStatusMessage(`Stock intake ${created.batch_number} recorded.`);
      loadAllData();
      setTimeout(() => setStatusMessage(''), 3500);
    } catch (err: any) {
      console.error('Error recording stock intake:', err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        (err?.response?.data && typeof err.response.data === 'object'
          ? Object.entries(err.response.data)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
              .join('; ')
          : null) ||
        err?.message ||
        'Failed to record stock intake.';
      setStatusMessage(errMsg);
      setTimeout(() => setStatusMessage(''), 5000);
    }
  };

  // Create Supplier Payment
  const handleSavePayment = async () => {
    if (!paymentFormData.supplier || paymentFormData.amount <= 0) return;
    try {
      const created = await supplierApi.createPayment(paymentFormData);
      setPayments((prev) => [created, ...prev]);
      setShowPaymentModal(false);
      setStatusMessage(`Payout ${created.payment_reference} disbursed.`);
      loadAllData();
      setTimeout(() => setStatusMessage(''), 3500);
    } catch (err: any) {
      console.error('Error recording payout:', err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        (err?.response?.data && typeof err.response.data === 'object'
          ? Object.entries(err.response.data)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
              .join('; ')
          : null) ||
        err?.message ||
        'Failed to record disbursement.';
      setStatusMessage(errMsg);
      setTimeout(() => setStatusMessage(''), 5000);
    }
  };

  // Quick payout open helper
  const handleQuickPay = (supplier: Supplier) => {
    setPaymentFormData({
      supplier: supplier.id,
      amount: Math.round(supplier.outstanding_balance),
      payment_method: supplier.mpesa_number ? 'M-PESA' : 'Bank Transfer',
      transaction_code: '',
      notes: `Settlement for outstanding balance of KSh ${supplier.outstanding_balance.toLocaleString()}`,
      processed_by: 'Finance Controller'
    });
    setShowPaymentModal(true);
  };

  // Quick intake open helper
  const handleQuickIntake = (supplier: Supplier) => {
    setIntakeFormData({
      supplier: supplier.id,
      product_name: '',
      product_sku: '',
      quantity_received: 10,
      unit_cost: 1500,
      delivery_note_ref: '',
      invoice_ref: '',
      notes: '',
      received_by: 'Warehouse Manager'
    });
    setShowIntakeModal(true);
  };

  // Filtered Suppliers List
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tax_pin.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        selectedPaymentStatusFilter === 'all' ||
        s.payment_status === selectedPaymentStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [suppliers, searchQuery, selectedPaymentStatusFilter]);

  // Filtered Sourced Products
  const filteredProducts = useMemo(() => {
    return supplierProducts.filter((p) => {
      const matchesSearch =
        p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.product_sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.supplier_sku.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSupplier =
        selectedSupplierFilter === 'all' || p.supplier === selectedSupplierFilter;

      return matchesSearch && matchesSupplier;
    });
  }, [supplierProducts, searchQuery, selectedSupplierFilter]);

  // CSV Export Utility
  const handleExportCSV = (report: SupplierReportData) => {
    if (!report || !report.rows.length) return;
    const headers = report.columns.join(',');
    const rows = report.rows
      .map((row) =>
        Object.values(row)
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${report.report_type}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-gray-950 dark:text-white">
                Supplier &amp; Consignment Management Hub
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
                DRF v2.4 Live
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-light mt-0.5">
              Accurately track sourced products, consignment sales, disbursements, pending balances, and profit margins.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {statusMessage && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4" /> {statusMessage}
            </span>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Synchronize Ledger"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowIntakeModal(true)}
            className="px-3 py-1.5 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 text-gray-700 dark:text-gray-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Package className="h-3.5 w-3.5 text-indigo-600" />
            <span>Record Goods Intake (GRN)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPaymentModal(true)}
            className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Coins className="h-3.5 w-3.5 text-emerald-600" />
            <span>Record Supplier Payout</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingSupplier(null);
              setSupplierFormData({
                name: '',
                company_name: '',
                email: '',
                phone: '',
                physical_address: '',
                tax_pin: '',
                payment_terms: 'Consignment Sale',
                bank_name: '',
                bank_account_number: '',
                mpesa_number: '',
                mpesa_account_name: '',
                status: 'Active',
                notes: ''
              });
              setShowAddSupplierModal(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/60 px-4 scrollbar-none shrink-0">
        <div className="flex gap-1 py-2">
          {[
            { id: 'dashboard', label: 'Management Dashboard', icon: BarChart3 },
            { id: 'suppliers', label: 'Suppliers Directory', icon: Briefcase, badge: suppliers.length },
            { id: 'products', label: 'Sourced Products & Profitability', icon: Layers, badge: supplierProducts.length },
            { id: 'intakes', label: 'Goods Received Notes (GRN)', icon: Package, badge: intakes.length },
            { id: 'payments', label: 'Disbursements & Payouts', icon: DollarSign, badge: payments.length },
            { id: 'reports', label: '10 Management Reports', icon: FileText }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as PanelTab)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold border border-gray-200/80 dark:border-gray-700'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-mono font-bold ${
                      isActive
                        ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: MANAGEMENT DASHBOARD & OVERVIEW */}
        {/* ========================================================================= */}
        {activeTab === 'dashboard' && dashboardMetrics && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Top 8 Metric KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Suppliers */}
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                  <span className="text-xs font-semibold">Active Suppliers</span>
                  <Briefcase className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-black font-mono text-gray-950 dark:text-white">
                  {dashboardMetrics.metrics.total_suppliers}
                </div>
                <div className="text-[11px] text-gray-400 font-light flex items-center gap-1">
                  <span>{dashboardMetrics.metrics.total_products_sourced} sourced products</span>
                </div>
              </div>

              {/* Card 2: Total Sales Revenue */}
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                  <span className="text-xs font-semibold">Total Sourced Sales</span>
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black font-mono text-gray-950 dark:text-white">
                  {currency} {dashboardMetrics.metrics.total_sales_revenue.toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  {dashboardMetrics.metrics.total_units_sold} units sold
                </div>
              </div>

              {/* Card 3: Total Supplier Cost Owed (COGS) */}
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                  <span className="text-xs font-semibold">Total Cost Owed to Suppliers</span>
                  <Receipt className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                  {currency} {dashboardMetrics.metrics.total_supplier_costs.toLocaleString()}
                </div>
                <div className="text-[11px] text-gray-400 font-light">
                  Cumulative cost for sold items
                </div>
              </div>

              {/* Card 4: Total Paid to Suppliers */}
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                  <span className="text-xs font-semibold">Disbursements Made</span>
                  <CreditCard className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-black font-mono text-gray-950 dark:text-white">
                  {currency} {dashboardMetrics.metrics.total_paid_to_suppliers.toLocaleString()}
                </div>
                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                  Paid via M-PESA &amp; EFT
                </div>
              </div>

              {/* Card 5: Outstanding Balance */}
              <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-rose-700 dark:text-rose-300">
                  <span className="text-xs font-bold">Outstanding Supplier Balance</span>
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                </div>
                <div className="text-2xl font-black font-mono text-rose-700 dark:text-rose-400">
                  {currency} {dashboardMetrics.metrics.total_outstanding_balance.toLocaleString()}
                </div>
                <div className="text-[11px] text-rose-600/80 dark:text-rose-300 font-light">
                  Pending settlement payments
                </div>
              </div>

              {/* Card 6: Gross Profit */}
              <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                  <span className="text-xs font-bold">Gross Business Profit</span>
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                  {currency} {dashboardMetrics.metrics.total_gross_profit.toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-600/80 dark:text-emerald-300 font-light">
                  Revenue − Supplier Cost
                </div>
              </div>

              {/* Card 7: Overall Profit Margin */}
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                  <span className="text-xs font-semibold">Overall Profit Margin</span>
                  <Percent className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                  {dashboardMetrics.metrics.overall_profit_margin}%
                </div>
                <div className="text-[11px] text-gray-400 font-light">
                  Weighted margin on sourced goods
                </div>
              </div>

              {/* Card 8: Total Received Stock Value */}
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                  <span className="text-xs font-semibold">Total Goods Received (GRN)</span>
                  <Package className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-black font-mono text-gray-950 dark:text-white">
                  {currency} {dashboardMetrics.metrics.total_received_value.toLocaleString()}
                </div>
                <div className="text-[11px] text-gray-400 font-light">
                  {dashboardMetrics.metrics.total_units_received} total units supplied
                </div>
              </div>
            </div>

            {/* Visual Analytics & Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Financial Flow Breakdown */}
              <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xs space-y-4 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-950 dark:text-white flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-indigo-600" />
                    Consignment Financial Health &amp; Settlement Flow
                  </h3>
                  <span className="text-[11px] text-gray-400 font-mono">Consignment Model</span>
                </div>

                <p className="text-xs text-gray-500 font-light">
                  Comparison between total sales revenue generated, supplier cost owed, disbursements made, and retained gross profit.
                </p>

                <div className="space-y-3 pt-2">
                  {/* Revenue Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-gray-700 dark:text-gray-300">Sales Revenue</span>
                      <span className="font-mono font-bold text-gray-950 dark:text-white">
                        {currency} {dashboardMetrics.metrics.total_sales_revenue.toLocaleString()} (100%)
                      </span>
                    </div>
                    <div className="h-3.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full" style={{ width: '100%' }} />
                    </div>
                  </div>

                  {/* Supplier Cost Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-amber-700 dark:text-amber-300">Supplier Cost (COGS)</span>
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                        {currency} {dashboardMetrics.metrics.total_supplier_costs.toLocaleString()} (
                        {dashboardMetrics.metrics.total_sales_revenue > 0
                          ? Math.round((dashboardMetrics.metrics.total_supplier_costs / dashboardMetrics.metrics.total_sales_revenue) * 100)
                          : 0}
                        %)
                      </span>
                    </div>
                    <div className="h-3.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{
                          width: `${
                            dashboardMetrics.metrics.total_sales_revenue > 0
                              ? (dashboardMetrics.metrics.total_supplier_costs / dashboardMetrics.metrics.total_sales_revenue) * 100
                              : 0
                          }%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Gross Profit Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-emerald-700 dark:text-emerald-300">Retained Gross Profit</span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                        {currency} {dashboardMetrics.metrics.total_gross_profit.toLocaleString()} ({dashboardMetrics.metrics.overall_profit_margin}%)
                      </span>
                    </div>
                    <div className="h-3.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, dashboardMetrics.metrics.overall_profit_margin))}%`
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Settlement Progress Bar */}
                <div className="pt-3 border-t border-gray-150 dark:border-gray-800">
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Settlement Progress (Paid vs Pending Owed)</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                      {dashboardMetrics.metrics.total_supplier_costs > 0
                        ? Math.round((dashboardMetrics.metrics.total_paid_to_suppliers / dashboardMetrics.metrics.total_supplier_costs) * 100)
                        : 100}
                      % Settled
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-rose-100 dark:bg-rose-950/60 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-600 rounded-l-full"
                      style={{
                        width: `${
                          dashboardMetrics.metrics.total_supplier_costs > 0
                            ? (dashboardMetrics.metrics.total_paid_to_suppliers / dashboardMetrics.metrics.total_supplier_costs) * 100
                            : 100
                        }%`
                      }}
                      title={`Paid: ${currency} ${dashboardMetrics.metrics.total_paid_to_suppliers.toLocaleString()}`}
                    />
                  </div>
                </div>
              </div>

              {/* Settlement Status Distribution */}
              <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xs space-y-4">
                <h3 className="text-sm font-bold text-gray-950 dark:text-white flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-indigo-600" />
                  Supplier Payment Status
                </h3>

                <div className="space-y-3 pt-2">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Fully Paid / Clear</span>
                    </div>
                    <span className="font-mono font-bold text-sm text-emerald-800 dark:text-emerald-300">
                      {dashboardMetrics.status_distribution.Paid}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200">Partially Paid</span>
                    </div>
                    <span className="font-mono font-bold text-sm text-amber-800 dark:text-amber-300">
                      {dashboardMetrics.status_distribution['Partially Paid']}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                      <span className="text-xs font-bold text-rose-900 dark:text-rose-200">Pending / Unpaid</span>
                    </div>
                    <span className="font-mono font-bold text-sm text-rose-800 dark:text-rose-300">
                      {dashboardMetrics.status_distribution.Pending}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Profitable Sourced Products Table */}
            <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-950 dark:text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Top Most Profitable Sourced Products
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('products')}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  View all products <ChevronRight className="h-3 w-3" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Product Name / SKU</th>
                      <th className="py-2.5 px-3">Supplier Cost</th>
                      <th className="py-2.5 px-3">Selling Price</th>
                      <th className="py-2.5 px-3">Units Sold</th>
                      <th className="py-2.5 px-3">Total Sales</th>
                      <th className="py-2.5 px-3">Gross Profit</th>
                      <th className="py-2.5 px-3 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                    {dashboardMetrics.top_profitable_products.map((prod) => (
                      <tr key={prod.product_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-gray-950 dark:text-white">{prod.product_name}</div>
                          <span className="font-mono text-[10px] text-gray-400">{prod.sku}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-gray-600 dark:text-gray-300">
                          {currency} {prod.supplier_cost.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-gray-900 dark:text-white">
                          {currency} {prod.selling_price.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-gray-600 dark:text-gray-300">
                          {prod.quantity_sold}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                          {currency} {prod.revenue.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-emerald-600 dark:text-emerald-400 font-black">
                          {currency} {prod.gross_profit.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right font-bold text-emerald-600">
                          {prod.profit_margin}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SUPPLIERS DIRECTORY & BALANCES */}
        {/* ========================================================================= */}
        {activeTab === 'suppliers' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search suppliers by name, code, company, PIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-900 pl-9 pr-4 text-xs font-medium text-gray-950 dark:text-white placeholder:text-gray-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedPaymentStatusFilter}
                  onChange={(e) => setSelectedPaymentStatusFilter(e.target.value)}
                  className="h-9 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300"
                >
                  <option value="all">All Payment Statuses</option>
                  <option value="Pending">Pending / Unpaid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Paid">Fully Paid / Clear</option>
                </select>
              </div>
            </div>

            {/* Suppliers Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.map((supplier) => {
                const isPaid = supplier.payment_status === 'Paid';
                const isPartial = supplier.payment_status === 'Partially Paid';
                const isPending = supplier.payment_status === 'Pending';

                return (
                  <div
                    key={supplier.id}
                    className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-4"
                  >
                    <div>
                      {/* Supplier Card Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="text-sm font-bold text-gray-950 dark:text-white leading-tight">
                            {supplier.name}
                          </h4>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-light">
                            {supplier.company_name || 'Individual Supplier'}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : isPartial
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {supplier.payment_status.toUpperCase()}
                        </span>
                      </div>

                      {/* Contact & Terms Info */}
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-1 mb-3">
                        <div className="flex items-center gap-1.5">
                          <Building className="h-3.5 w-3.5 text-gray-400" />
                          <span>KRA PIN: {supplier.tax_pin || 'Not Set'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                          <span>Terms: {supplier.payment_terms}</span>
                        </div>
                        {supplier.phone && (
                          <div className="flex items-center gap-1.5 font-mono text-[10.5px]">
                            <Phone className="h-3.5 w-3.5 text-gray-400" />
                            <span>{supplier.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Financial Balance Summary Strip */}
                      <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-150 dark:border-gray-700/60 space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-gray-500">Sales Cost Owed:</span>
                          <span className="font-mono font-bold text-gray-900 dark:text-white">
                            {currency} {supplier.total_cost_owed.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-gray-500">Amount Paid:</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {currency} {supplier.total_amount_paid.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs pt-1 border-t border-gray-200 dark:border-gray-700">
                          <span className="font-bold text-gray-800 dark:text-gray-200">Outstanding Owed:</span>
                          <span
                            className={`font-mono font-black ${
                              supplier.outstanding_balance > 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {currency} {supplier.outstanding_balance.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Profitability metric */}
                      <div className="mt-2 flex items-center justify-between text-[11px] font-mono px-1">
                        <span className="text-gray-400">Gross Profit Contribution:</span>
                        <span className="font-bold text-emerald-600">
                          {currency} {supplier.gross_profit.toLocaleString()} ({supplier.profit_margin_percent}%)
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 pt-3 border-t border-gray-150 dark:border-gray-800">
                      <button
                        type="button"
                        onClick={() => handleOpenStatement(supplier)}
                        className="flex-1 py-1.5 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="View Full Ledger Statement"
                      >
                        <FileText className="h-3 w-3 text-indigo-600" />
                        <span>Statement</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickIntake(supplier)}
                        className="p-1.5 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 text-xs font-bold transition-colors cursor-pointer"
                        title="Record Stock Intake for this supplier"
                      >
                        <Package className="h-3.5 w-3.5 text-indigo-600" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickPay(supplier)}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        title="Disburse payment"
                      >
                        <Coins className="h-3 w-3" />
                        <span>Pay</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingSupplier(supplier);
                          setSupplierFormData(supplier);
                          setShowAddSupplierModal(true);
                        }}
                        className="p-1.5 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 text-xs transition-colors cursor-pointer"
                        title="Edit Supplier"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSupplier(supplier)}
                        className="p-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-600 hover:text-rose-700 text-xs transition-colors cursor-pointer"
                        title="Delete Supplier"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SOURCED PRODUCTS & PROFITABILITY MATRIX */}
        {/* ========================================================================= */}
        {activeTab === 'products' && (
          <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xs space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-950 dark:text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  Product Sourcing, Cost Owed &amp; Profitability Matrix
                </h3>
                <p className="text-xs text-gray-500 font-light mt-0.5">
                  Detailed product tracking: Supplier Unit Cost vs Retail Selling Price vs Revenue vs Gross Margin.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedSupplierFilter}
                  onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                  className="h-9 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  <option value="all">All Sourcing Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Product Name &amp; SKU</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3">Supplier Cost</th>
                    <th className="py-2.5 px-3">Selling Price</th>
                    <th className="py-2.5 px-3 text-center">Received / Sold / Left</th>
                    <th className="py-2.5 px-3">Cost Owed (COGS)</th>
                    <th className="py-2.5 px-3">Sales Revenue</th>
                    <th className="py-2.5 px-3">Gross Profit</th>
                    <th className="py-2.5 px-3 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                  {filteredProducts.map((sp) => (
                    <tr key={sp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-gray-950 dark:text-white">{sp.product_name}</div>
                        <span className="font-mono text-[10px] text-gray-400">{sp.product_sku}</span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-gray-800 dark:text-gray-200">
                        {suppliers.find((s) => s.id === sp.supplier)?.name || 'Artisan'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-gray-600 dark:text-gray-300">
                        {currency} {sp.agreed_cost_price.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-gray-900 dark:text-white">
                        {currency} {sp.selling_price.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        <span className="text-gray-600 dark:text-gray-300">{sp.quantity_received}</span>
                        <span className="text-gray-400"> / </span>
                        <span className="text-emerald-600 font-bold">{sp.quantity_sold}</span>
                        <span className="text-gray-400"> / </span>
                        <span className="text-indigo-600 font-bold">{sp.remaining_stock}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-amber-600 dark:text-amber-400 font-bold">
                        {currency} {sp.total_cost_owed.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                        {currency} {sp.total_sales_revenue.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-emerald-600 dark:text-emerald-400 font-black">
                        {currency} {sp.gross_profit.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right font-bold text-emerald-600">
                        {Math.round(sp.profit_margin_percent * 10) / 10}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: STOCK INTAKE & GOODS RECEIVED NOTES (GRN) */}
        {/* ========================================================================= */}
        {activeTab === 'intakes' && (
          <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xs space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-950 dark:text-white flex items-center gap-2">
                  <Package className="h-4 w-4 text-indigo-600" />
                  Goods Received Notes (GRN) &amp; Supply Batch Log
                </h3>
                <p className="text-xs text-gray-500 font-light mt-0.5">
                  Complete history of inventory batches received, inspection status, and warehouse arrival logs.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowIntakeModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Record Goods Received
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">GRN Batch #</th>
                    <th className="py-2.5 px-3">Arrival Date</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3">Product Name &amp; SKU</th>
                    <th className="py-2.5 px-3">Qty Received</th>
                    <th className="py-2.5 px-3">Unit Cost</th>
                    <th className="py-2.5 px-3">Total Batch Value</th>
                    <th className="py-2.5 px-3">Delivery Ref</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                  {intakes.map((batch) => (
                    <tr key={batch.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {batch.batch_number}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300 font-mono text-[11px]">
                        {new Date(batch.received_date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">
                        {batch.supplier_name || suppliers.find((s) => s.id === batch.supplier)?.name || 'Supplier'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-gray-900 dark:text-white">{batch.product_name}</div>
                        <span className="font-mono text-[10px] text-gray-400">{batch.product_sku}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-gray-900 dark:text-white">
                        {batch.quantity_received} units
                      </td>
                      <td className="py-2.5 px-3 font-mono text-gray-600 dark:text-gray-300">
                        {currency} {batch.unit_cost.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-gray-950 dark:text-white font-black">
                        {currency} {batch.total_cost.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-gray-500">
                        {batch.delivery_note_ref || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {batch.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: SUPPLIER DISBURSEMENTS & PAYOUTS */}
        {/* ========================================================================= */}
        {activeTab === 'payments' && (
          <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xs space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-950 dark:text-white flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  Supplier Payment Disbursements &amp; Settlements
                </h3>
                <p className="text-xs text-gray-500 font-light mt-0.5">
                  Audited record of all payouts to suppliers, payment methods, transaction codes, and settled dates.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowPaymentModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                <Coins className="h-3.5 w-3.5" /> Disburse Payment
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Payment Ref</th>
                    <th className="py-2.5 px-3">Disbursement Date</th>
                    <th className="py-2.5 px-3">Supplier Name</th>
                    <th className="py-2.5 px-3">Amount Paid</th>
                    <th className="py-2.5 px-3">Payment Method</th>
                    <th className="py-2.5 px-3">Transaction Code</th>
                    <th className="py-2.5 px-3">Processed By</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {p.payment_reference}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300 font-mono text-[11px]">
                        {new Date(p.payment_date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">
                        {p.supplier_name || suppliers.find((s) => s.id === p.supplier)?.name || 'Supplier'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-emerald-600 dark:text-emerald-400 font-black">
                        {currency} {p.amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-700 dark:text-gray-300">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 font-mono text-[10.5px]">
                          {p.payment_method === 'M-PESA' ? (
                            <Smartphone className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Building className="h-3 w-3 text-indigo-600" />
                          )}
                          {p.payment_method}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-gray-600 dark:text-gray-300">
                        {p.transaction_code || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 text-[11px]">{p.processed_by}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: 10 MANAGEMENT REPORTS ENGINE */}
        {/* ========================================================================= */}
        {activeTab === 'reports' && (
          <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xs space-y-5 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-150 dark:border-gray-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-950 dark:text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  Supplier &amp; Consignment Management Reports
                </h3>
                <p className="text-xs text-gray-500 font-light mt-0.5">
                  Generate and export detailed supplier statements, outstanding balances, payment audits, and profitability matrices.
                </p>
              </div>

              {reportData && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportCSV(reportData)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-50 cursor-pointer shadow-2xs"
                  >
                    <Download className="h-3.5 w-3.5 text-indigo-600" /> Export CSV
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                  >
                    <Printer className="h-3.5 w-3.5" /> Print Report
                  </button>
                </div>
              )}
            </div>

            {/* Report Type Selector Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {[
                { id: 'outstanding_balances', label: '1. Outstanding Balances' },
                { id: 'payment_history', label: '2. Payment History Audit' },
                { id: 'products_received', label: '3. Products Received (GRN)' },
                { id: 'products_sold', label: '4. Products Sold on Consignment' },
                { id: 'profitability_by_supplier', label: '5. Profitability by Supplier' },
                { id: 'profitability_by_product', label: '6. Profitability by Product' },
                { id: 'overall_profitability', label: '7. Overall Business Matrix' },
                { id: 'sales_by_supplier', label: '8. Sales by Supplier' },
                { id: 'outstanding_payments', label: '9. Actionable Settlements' },
                { id: 'supplier_statement', label: '10. Statement of Accounts' }
              ].map((rep) => {
                const isSelected = selectedReportType === rep.id;
                return (
                  <button
                    key={rep.id}
                    type="button"
                    onClick={() => handleGenerateReport(rep.id, selectedSupplierFilter)}
                    className={`p-2.5 rounded-xl text-left text-xs transition-all cursor-pointer border ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-200 font-bold ring-2 ring-indigo-500/20'
                        : 'border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {rep.label}
                  </button>
                );
              })}
            </div>

            {/* Report Table Display */}
            {isLoadingReport ? (
              <div className="py-12 text-center text-xs text-gray-400">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
                Compiling management report...
              </div>
            ) : reportData ? (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    {reportData.title}
                  </h4>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Generated: {new Date(reportData.generated_at).toLocaleString()}
                  </span>
                </div>

                <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 font-bold text-[10.5px]">
                        {reportData.columns.map((col, idx) => (
                          <th key={idx} className="py-2.5 px-3">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                      {reportData.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          {Object.values(row).map((val, cIdx) => (
                            <td key={cIdx} className="py-2.5 px-3 font-mono text-[11px]">
                              {typeof val === 'number'
                                ? val.toLocaleString()
                                : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT SUPPLIER */}
      {/* ========================================================================= */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-xl w-full p-5 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-3">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-indigo-600" />
                {editingSupplier ? 'Edit Supplier Profile' : 'Register New Sourcing Supplier'}
              </h4>
              <button
                type="button"
                onClick={() => setShowAddSupplierModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Contact Person / Artisan Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Keziah Mwangi"
                  value={supplierFormData.name || ''}
                  onChange={(e) => setSupplierFormData((p) => ({ ...p, name: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Company / Brand Entity Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nairobi Artisan Atelier Ltd"
                  value={supplierFormData.company_name || ''}
                  onChange={(e) => setSupplierFormData((p) => ({ ...p, company_name: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="artisan@domain.co.ke"
                  value={supplierFormData.email || ''}
                  onChange={(e) => setSupplierFormData((p) => ({ ...p, email: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Phone Hotline
                </label>
                <input
                  type="tel"
                  placeholder="+254 700 000 000"
                  value={supplierFormData.phone || ''}
                  onChange={(e) => setSupplierFormData((p) => ({ ...p, phone: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  KRA PIN / Tax ID
                </label>
                <input
                  type="text"
                  placeholder="P051987654Z"
                  value={supplierFormData.tax_pin || ''}
                  onChange={(e) => setSupplierFormData((p) => ({ ...p, tax_pin: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Payment Terms
                </label>
                <select
                  value={supplierFormData.payment_terms || 'Consignment Sale'}
                  onChange={(e) =>
                    setSupplierFormData((p) => ({
                      ...p,
                      payment_terms: e.target.value as SupplierPaymentTerms
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                >
                  <option value="Consignment Sale">Consignment Sale (Pay on Sale)</option>
                  <option value="Immediate">Immediate / Cash on Delivery</option>
                  <option value="Net 15">Net 15 Days</option>
                  <option value="Net 30">Net 30 Days</option>
                  <option value="Bi-weekly">Bi-weekly Settlement</option>
                  <option value="Monthly">Monthly Settlement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  M-PESA Number / Paybill Account
                </label>
                <input
                  type="text"
                  placeholder="303030 / Acc: ARTISAN or +254700000000"
                  value={supplierFormData.mpesa_number || ''}
                  onChange={(e) => setSupplierFormData((p) => ({ ...p, mpesa_number: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Bank Name &amp; Account Number
                </label>
                <input
                  type="text"
                  placeholder="NCBA Bank - 1004829148"
                  value={supplierFormData.bank_name ? `${supplierFormData.bank_name} ${supplierFormData.bank_account_number || ''}` : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSupplierFormData((p) => ({ ...p, bank_name: val, bank_account_number: val }));
                  }}
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Physical Workshop / Dispatch Hub Address
                </label>
                <input
                  type="text"
                  placeholder="Shed 14, Artisan Craft Village, Ngong Road, Nairobi"
                  value={supplierFormData.physical_address || ''}
                  onChange={(e) => setSupplierFormData((p) => ({ ...p, physical_address: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-150 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowAddSupplierModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSupplier}
                disabled={!supplierFormData.name}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {editingSupplier ? 'Save Supplier Changes' : 'Create Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD GOODS INTAKE (GRN) */}
      {/* ========================================================================= */}
      {showIntakeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-5 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-3">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Package className="h-4 w-4 text-indigo-600" />
                Record Goods Received Note (GRN)
              </h4>
              <button
                type="button"
                onClick={() => setShowIntakeModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Supplier *
                </label>
                <select
                  value={intakeFormData.supplier}
                  onChange={(e) => setIntakeFormData((p) => ({ ...p, supplier: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                >
                  <option value="">-- Select Sourcing Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.company_name || s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Silk Robe"
                    value={intakeFormData.product_name}
                    onChange={(e) => setIntakeFormData((p) => ({ ...p, product_name: e.target.value }))}
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SK-SILK-01"
                    value={intakeFormData.product_sku}
                    onChange={(e) => setIntakeFormData((p) => ({ ...p, product_sku: e.target.value }))}
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Quantity Received *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={intakeFormData.quantity_received}
                    onChange={(e) =>
                      setIntakeFormData((p) => ({
                        ...p,
                        quantity_received: parseInt(e.target.value, 10) || 1
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Agreed Unit Cost ({currency}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={intakeFormData.unit_cost}
                    onChange={(e) =>
                      setIntakeFormData((p) => ({
                        ...p,
                        unit_cost: parseFloat(e.target.value) || 0
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex justify-between items-center text-xs">
                <span className="text-gray-500">Total Batch Intake Value:</span>
                <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                  {currency} {(intakeFormData.quantity_received * intakeFormData.unit_cost).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-150 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowIntakeModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveIntake}
                disabled={!intakeFormData.supplier || !intakeFormData.product_name}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Save Goods Received
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD SUPPLIER PAYOUT */}
      {/* ========================================================================= */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-5 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-3">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-emerald-600" />
                Record Supplier Payment &amp; Disbursement
              </h4>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Recipient Supplier *
                </label>
                <select
                  value={paymentFormData.supplier}
                  onChange={(e) => {
                    const sId = e.target.value;
                    const selected = suppliers.find((s) => s.id === sId);
                    setPaymentFormData((p) => ({
                      ...p,
                      supplier: sId,
                      amount: selected ? Math.round(selected.outstanding_balance) : p.amount
                    }));
                  }}
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Pending Owed: {currency} {s.outstanding_balance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Amount to Disburse ({currency}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={paymentFormData.amount || ''}
                    onChange={(e) =>
                      setPaymentFormData((p) => ({
                        ...p,
                        amount: parseFloat(e.target.value) || 0
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentFormData.payment_method}
                    onChange={(e) =>
                      setPaymentFormData((p) => ({
                        ...p,
                        payment_method: e.target.value as SupplierPaymentMethod
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                  >
                    <option value="M-PESA">M-PESA (B2C / Paybill)</option>
                    <option value="Bank Transfer">Bank Transfer (EFT/RTGS)</option>
                    <option value="Cheque">Corporate Cheque</option>
                    <option value="Cash">Cash Voucher</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Transaction Code / Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. QHK8941829 or NCBA-TX-9981"
                  value={paymentFormData.transaction_code}
                  onChange={(e) => setPaymentFormData((p) => ({ ...p, transaction_code: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Settlement Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Settlement for September consignment sales"
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData((p) => ({ ...p, notes: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-150 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePayment}
                disabled={!paymentFormData.supplier || paymentFormData.amount <= 0}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Confirm Disbursement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUPPLIER STATEMENT & RUNNING BALANCE AUDIT */}
      {/* ========================================================================= */}
      {selectedStatementSupplier && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-3xl w-full p-6 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-gray-150 dark:border-gray-800 pb-4">
              <div>
                <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold block uppercase">
                  Statement of Account &amp; Financial Ledger
                </span>
                <h3 className="text-base font-bold text-gray-950 dark:text-white mt-0.5">
                  {selectedStatementSupplier.name} ({selectedStatementSupplier.company_name || selectedStatementSupplier.code})
                </h3>
                <div className="text-xs text-gray-500 font-light mt-1 flex gap-4">
                  <span>KRA PIN: {selectedStatementSupplier.tax_pin || 'P051987654Z'}</span>
                  <span>Terms: {selectedStatementSupplier.payment_terms}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStatementSupplier(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Financial Ledger Balance Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 space-y-1">
                <span className="text-[10px] text-gray-500 uppercase font-bold">Total Sales Cost Owed</span>
                <div className="text-base font-bold font-mono text-gray-900 dark:text-white">
                  {currency} {selectedStatementSupplier.total_cost_owed.toLocaleString()}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1">
                <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase font-bold">Total Amount Paid</span>
                <div className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  {currency} {selectedStatementSupplier.total_amount_paid.toLocaleString()}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-1">
                <span className="text-[10px] text-rose-800 dark:text-rose-300 uppercase font-bold">Closing Balance Owed</span>
                <div className="text-base font-bold font-mono text-rose-700 dark:text-rose-400">
                  {currency} {selectedStatementSupplier.outstanding_balance.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Statement Transactions Table */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-900 dark:text-white block">
                Chronological Audit Ledger &amp; Running Balance
              </span>

              {isLoadingStatement ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-indigo-600 mb-1" />
                  Loading ledger entries...
                </div>
              ) : statementData && statementData.transactions.length > 0 ? (
                <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 font-bold text-[10.5px]">
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Entry Type</th>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-right">Debit (Paid)</th>
                        <th className="py-2 px-3 text-right">Credit (Owed)</th>
                        <th className="py-2 px-3 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono text-[11px]">
                      {statementData.transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="py-2 px-3 text-gray-500">{new Date(tx.date).toLocaleDateString()}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 dark:bg-gray-800">
                              {tx.entry_type}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-sans text-gray-800 dark:text-gray-200">{tx.description}</td>
                          <td className="py-2 px-3 text-right text-emerald-600 font-bold">
                            {tx.debit > 0 ? `${currency} ${tx.debit.toLocaleString()}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right text-amber-600 font-bold">
                            {tx.credit > 0 ? `${currency} ${tx.credit.toLocaleString()}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-black text-gray-900 dark:text-white">
                            {currency} {tx.running_balance.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 text-center text-xs text-gray-500">
                  No individual ledger adjustments recorded outside primary intake batches.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-150 dark:border-gray-800">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-1.5 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Printer className="h-3.5 w-3.5 text-indigo-600" /> Print Statement
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatementSupplier(null)}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

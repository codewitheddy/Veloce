import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  Building,
  Mail,
  Phone,
  DollarSign,
  TrendingUp,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Edit3,
  Trash2,
  MapPin,
  ShoppingBag,
  BadgeCheck,
  CreditCard,
  UserCheck
} from 'lucide-react';
import { getCustomers, deleteCustomer, CustomerListItem } from '../api/customers';
import { CustomerForm } from './CustomerForm';
import { CustomerDetail } from './CustomerDetail';
import { Order } from '../types';

interface CustomerListProps {
  initialCustomerId?: string | null;
  liveOrders?: Order[];
}

export const CustomerList: React.FC<CustomerListProps> = ({ initialCustomerId, liveOrders = [] }) => {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [registrationFilter, setRegistrationFilter] = useState<'all' | 'registered' | 'guest'>('all');

  // Active Selected Customer for Detail View
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId || null);

  // Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerListItem | null>(null);

  // Helper to get real-time merged order metrics for each customer
  const getCustomerMetrics = useCallback((c: CustomerListItem) => {
    const custEmail = c.email?.trim().toLowerCase();
    const custName = c.name?.trim().toLowerCase() || `${c.first_name || ''} ${c.last_name || ''}`.trim().toLowerCase();
    const custPhone = c.phone?.trim();

    const matchedOrders = (liveOrders || []).filter((o) => {
      const orderEmail = o.customerEmail?.trim().toLowerCase();
      const orderName = o.customerName?.trim().toLowerCase();
      const orderPhone = o.phone?.trim() || o.pickupContactPhone?.trim() || o.mpesaPhone?.trim();

      const emailMatch = Boolean(custEmail && orderEmail && custEmail === orderEmail);
      const nameMatch = Boolean(custName && orderName && (custName === orderName || custName.includes(orderName) || orderName.includes(custName)));
      const phoneMatch = Boolean(custPhone && orderPhone && (custPhone === orderPhone || custPhone.endsWith(orderPhone.slice(-9)) || orderPhone.endsWith(custPhone.slice(-9))));

      return emailMatch || (nameMatch && phoneMatch);
    });

    const liveCount = matchedOrders.length;
    const backendCount = Number(c.orders_count || 0);
    const effectiveCount = Math.max(backendCount, liveCount);

    const liveTotalSpent = matchedOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.total || 0), 0);
    const backendTotalSpent = Number(c.total_spent || 0);
    const effectiveTotalSpent = Math.max(backendTotalSpent, liveTotalSpent);

    const latestOrderAddress = matchedOrders.find((o) => o.shippingAddress)?.shippingAddress;
    const effectiveLocation = c.location || c.resolved_location || latestOrderAddress || 'Nairobi, Kenya';

    return {
      ordersCount: effectiveCount,
      totalSpent: effectiveTotalSpent,
      location: effectiveLocation,
      matchedOrders,
    };
  }, [liveOrders]);

  // Fetch Customers from API with search, status, and is_registered filters
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (registrationFilter === 'registered') {
        params.is_registered = 'true';
      } else if (registrationFilter === 'guest') {
        params.is_registered = 'false';
      }

      const data = await getCustomers(params);
      const list = Array.isArray(data) ? data : data.results || [];
      setCustomers(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load customers from backend.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, registrationFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchCustomers]);

  // Handle Delete Customer
  const handleDeleteCustomer = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete customer "${name}" and all associated CRM records?`)) {
      try {
        await deleteCustomer(id);
        if (selectedCustomerId === id) {
          setSelectedCustomerId(null);
        }
        await fetchCustomers();
      } catch (err: any) {
        alert(err?.message || 'Failed to delete customer.');
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ACTIVE
          </span>
        );
      case 'lead':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            LEAD
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
            INACTIVE
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {status.toUpperCase()}
          </span>
        );
    }
  };

  const getRegistrationBadge = (isRegistered: boolean, userId?: number | null) => {
    if (isRegistered) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/40" title={`Linked Django Auth User #${userId || ''}`}>
          <BadgeCheck className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
          REG {userId ? `#${userId}` : ''}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
        <ShoppingBag className="w-3 h-3 text-gray-400" />
        GUEST
      </span>
    );
  };

  // If a customer is selected, render CustomerDetail
  if (selectedCustomerId) {
    return (
      <CustomerDetail
        customerId={selectedCustomerId}
        onBack={() => {
          setSelectedCustomerId(null);
          fetchCustomers();
        }}
        onCustomerUpdated={() => fetchCustomers()}
        liveOrders={liveOrders}
      />
    );
  }

  // Calculate high-level summary metrics with liveOrders synchronization
  const totalOpenDealsSum = customers.reduce((acc, c) => acc + Number(c.open_deal_value || 0), 0);
  const totalSpentSum = customers.reduce((acc, c) => acc + getCustomerMetrics(c).totalSpent, 0);
  const totalOrdersCount = customers.reduce((acc, c) => acc + getCustomerMetrics(c).ordersCount, 0);
  const registeredCount = customers.filter((c) => c.is_registered).length;

  return (
    <div className="space-y-6 font-sans text-gray-900 dark:text-white">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-850 pb-5">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 shadow-2xs">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                Customer Management & CRM Suite
              </h2>
              <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-mono text-[10px] font-bold rounded-md">
                LOCATION & SPEND ANALYTICS
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Review customer delivery locations, order histories, lifetime amount spent, deal pipeline, and invoices.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchCustomers()}
            disabled={loading}
            className="px-3.5 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
            title="Refresh list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} /> Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingCustomer(null);
              setIsFormOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> New Customer Profile
          </button>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs transition-all hover:border-indigo-200 dark:hover:border-indigo-800">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">Total Customers</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black font-display text-gray-900 dark:text-white">
            {customers.length}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{registeredCount}</span> registered / {customers.length - registeredCount} guests
          </div>
        </div>

        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs transition-all hover:border-emerald-200 dark:hover:border-emerald-800">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">Total Amount Spent</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black font-display text-emerald-600 dark:text-emerald-400 font-mono">
            KSh {totalSpentSum.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            Across {totalOrdersCount} fulfilled customer orders
          </div>
        </div>

        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs transition-all hover:border-amber-200 dark:hover:border-amber-800">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">Orders Placed</span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <ShoppingBag className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black font-display text-amber-600 dark:text-amber-400">
            {totalOrdersCount}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            Active order transactions logged
          </div>
        </div>

        <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs transition-all hover:border-indigo-200 dark:hover:border-indigo-800">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">Open Deals Pipeline</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black font-display text-gray-900 dark:text-white font-mono">
            KSh {totalOpenDealsSum.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 font-mono">
            Active prospecting & negotiation sum
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 p-4 shadow-3xs flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by name, company, email, location, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full pl-10 pr-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-gray-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all font-medium"
          />
        </div>

        {/* Dual Filter Controls: Registration Type & Lifecycle Status */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Registration Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase font-mono text-[10px]">Account:</span>
            <select
              value={registrationFilter}
              onChange={(e: any) => setRegistrationFilter(e.target.value)}
              className="h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all cursor-pointer"
            >
              <option value="all">All (Guest & Registered)</option>
              <option value="registered">Registered Users Only</option>
              <option value="guest">Guest Customers Only</option>
            </select>
          </div>

          {/* Status Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase font-mono text-[10px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-550 transition-all cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Clients</option>
              <option value="lead">Sales Leads</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customer Directory Table Card */}
      <div className="overflow-hidden rounded-2xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 shadow-3xs">
        {error && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-100 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <Loader2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold font-mono text-gray-800 dark:text-gray-200 uppercase tracking-wider">Loading Customer Directory...</p>
            <p className="text-[11px] text-gray-400 mt-1">Connecting to CRM database</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-gray-400 mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">No Customer Records Found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
              {searchQuery || statusFilter !== 'all' || registrationFilter !== 'all'
                ? 'No customer records match your current search and filter criteria.'
                : 'Get started by creating your first client or sales lead profile in the CRM.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingCustomer(null);
                setIsFormOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add New Customer
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300">
              <thead className="bg-gray-50/80 dark:bg-gray-900/80 text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-850">
                <tr>
                  <th className="px-4 py-3.5">Customer / Contact</th>
                  <th className="px-4 py-3.5">Location</th>
                  <th className="px-4 py-3.5">Orders</th>
                  <th className="px-4 py-3.5">Amount Spent</th>
                  <th className="px-4 py-3.5">Account & Status</th>
                  <th className="px-4 py-3.5">Open Deals</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-850/60">
                {customers.map((c) => {
                  const fullName = c.name || `${c.first_name} ${c.last_name}`.trim() || c.email;
                  const openDealVal = Number(c.open_deal_value || 0);
                  const metrics = getCustomerMetrics(c);
                  const totalSpent = metrics.totalSpent;
                  const ordersCount = metrics.ordersCount;
                  const displayLoc = metrics.location;

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors group"
                    >
                      {/* Customer Name & Email */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold text-xs font-mono flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-3xs">
                            {c.first_name?.[0]?.toUpperCase() || 'C'}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                              {fullName}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-gray-400" />
                                {c.email}
                              </span>
                              {c.company && (
                                <span className="flex items-center gap-1 text-gray-700 dark:text-gray-300 font-medium">
                                  <Building className="w-3 h-3 text-gray-400" />
                                  {c.company}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Location Details */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-gray-800 dark:text-gray-200 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>{displayLoc}</span>
                        </div>
                      </td>

                      {/* Orders Count */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                            ordersCount > 0
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                          }`}>
                            <ShoppingBag className="w-3 h-3" />
                            {ordersCount} {ordersCount === 1 ? 'order' : 'orders'}
                          </span>
                        </div>
                      </td>

                      {/* Amount Spent Details */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className={`font-mono text-xs font-bold ${totalSpent > 0 ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-gray-400'}`}>
                            KSh {totalSpent.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">lifetime spend</span>
                        </div>
                      </td>

                      {/* Account & Status */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          {getRegistrationBadge(c.is_registered, c.user)}
                          {getStatusBadge(c.status)}
                        </div>
                      </td>

                      {/* Open Deal Value */}
                      <td className="px-4 py-4">
                        <span className={`font-mono text-xs font-bold ${openDealVal > 0 ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-gray-400'}`}>
                          KSh {openDealVal.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerId(c.id)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition-colors cursor-pointer"
                            title="View Customer Profile"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCustomer(c);
                              setIsFormOpen(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                            title="Edit Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustomer(e, c.id, fullName)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer"
                            title="Delete Customer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Form Modal */}
      <CustomerForm
        isOpen={isFormOpen}
        customer={editingCustomer}
        onClose={() => {
          setIsFormOpen(false);
          setEditingCustomer(null);
        }}
        onSaved={async () => {
          await fetchCustomers();
        }}
      />
    </div>
  );
};

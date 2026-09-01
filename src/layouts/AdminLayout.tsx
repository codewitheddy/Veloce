/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import DjangoAdminLogin from '../components/DjangoAdminLogin';
import AdminOrderNotificationBanner from '../components/AdminOrderNotificationBanner';
import DashboardAnalytics from '../components/DashboardAnalytics';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Product, Order, InventoryAuditLog, ReturnRequest, CouponItem } from '../types';
import { CurrencyType } from '../lib/currency';

interface AdminLayoutProps {
  userRole: 'customer' | 'admin';
  setUserRole: (role: 'customer' | 'admin') => void;
  onNavigateToSite: (tab: string) => void;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  inventoryAuditLogs: InventoryAuditLog[];
  returnRequests: ReturnRequest[];
  coupons: Record<string, CouponItem>;
  promoBanner: { text: string; code: string; active: boolean; discountPercent?: number };
  onUpdatePromoBanner: (text: string, code: string, active: boolean) => void;
  lastBackupTime: number;
  currency: CurrencyType;
  darkMode: boolean;
  fontSize: string;
  onChangeFontSize: (size: string) => void;
  onAddProduct: (product: any) => void;
  onUpdateOrderStatus: (orderId: string, status: Order['status'], trackingNumber?: string) => void;
  onUpdateOrderPaymentStatus?: (orderId: string, paymentStatus: 'unpaid' | 'paid', paidNote?: string) => void;
  onDeleteProduct: (productId: string) => void;
  onUpdateProductStock: (productId: string, newStock: number, reason?: string, details?: string) => void;
  onUpdateProductSku: (productId: string, newSku: string) => void;
  onUpdateProductThreshold: (productId: string, newThreshold: number) => void;
  onUpdateProductPrice: (productId: string, newPrice: number) => void;
  onUpdateProductStatus: (productId: string, newStatus: Product['status']) => void;
  onUpdateProductPaymentRestriction: (productId: string, restriction: 'prepaid' | 'cod' | 'both') => void;
  onUpdateProductDetails: (productId: string, updates: Partial<Product>) => void;
  onAddCoupon: (code: string, percent: number, expiryDate?: string, desc?: string, active?: boolean) => void;
  onDeleteCoupon: (code: string) => void;
  onToggleCouponActive: (code: string) => void;
  onUpdateCoupon: (code: string, updates: Partial<CouponItem>) => void;
  onTriggerBackup: () => void;
  onAddOrder: (order: Order) => void;
  onUpdateReturnRequestStatus: (requestId: string, newStatus: ReturnRequest['status'], adminNotes?: string) => void;
  initialEditingProduct?: Product | null;
}

export default function AdminLayout({
  userRole,
  setUserRole,
  onNavigateToSite,
  products,
  setProducts,
  orders,
  setOrders,
  inventoryAuditLogs,
  returnRequests,
  coupons,
  promoBanner,
  onUpdatePromoBanner,
  lastBackupTime,
  currency,
  darkMode,
  fontSize,
  onChangeFontSize,
  onAddProduct,
  onUpdateOrderStatus,
  onUpdateOrderPaymentStatus,
  onDeleteProduct,
  onUpdateProductStock,
  onUpdateProductSku,
  onUpdateProductThreshold,
  onUpdateProductPrice,
  onUpdateProductStatus,
  onUpdateProductPaymentRestriction,
  onUpdateProductDetails,
  onAddCoupon,
  onDeleteCoupon,
  onToggleCouponActive,
  onUpdateCoupon,
  onTriggerBackup,
  onAddOrder,
  onUpdateReturnRequestStatus,
  initialEditingProduct,
}: AdminLayoutProps) {
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState<boolean>(false);

  useEffect(() => {
    if (!showLogoutConfirmModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLogoutConfirmModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutConfirmModal]);

  // If not logged in as admin, present the dedicated Django Superuser Login view
  if (userRole !== 'admin') {
    return (
      <div className={`min-h-screen bg-slate-950 text-white font-sans ${darkMode ? 'dark' : ''}`}>
        <DjangoAdminLogin
          onLoginSuccess={() => {
            setUserRole('admin');
            if (typeof window !== 'undefined' && window.history.pushState) {
              window.history.pushState({}, '', '/admin');
            }
          }}
          onCancel={() => onNavigateToSite('home')}
        />
      </div>
    );
  }

  return (
    <div className={`h-screen overflow-hidden flex flex-col bg-slate-900 text-slate-100 font-sans selection:bg-indigo-600 selection:text-white ${darkMode ? 'dark' : ''}`}>
      {/* Real-time Order Alert Notification Banner */}
      <AdminOrderNotificationBanner
        userRole={userRole}
        currentTab="admin"
        onNavigateToAdminOrders={(orderId) => {
          if (orderId) {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('veloce_select_admin_order', { detail: { orderId } }));
            }, 150);
          }
        }}
      />

      {/* Main Admin Dashboard Suite */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <ErrorBoundary>
          <DashboardAnalytics
            products={products}
            orders={orders}
            inventoryAuditLogs={inventoryAuditLogs}
            onAddProduct={onAddProduct}
            onUpdateOrderStatus={onUpdateOrderStatus}
            onUpdateOrderPaymentStatus={onUpdateOrderPaymentStatus}
            onDeleteProduct={onDeleteProduct}
            onUpdateProductStock={onUpdateProductStock}
            onUpdateProductSku={onUpdateProductSku}
            onUpdateProductThreshold={onUpdateProductThreshold}
            onUpdateProductPrice={onUpdateProductPrice}
            onUpdateProductStatus={onUpdateProductStatus}
            onUpdateProductPaymentRestriction={onUpdateProductPaymentRestriction}
            onUpdateProductDetails={onUpdateProductDetails}
            coupons={coupons}
            onAddCoupon={onAddCoupon}
            onDeleteCoupon={onDeleteCoupon}
            onToggleCouponActive={onToggleCouponActive}
            onUpdateCoupon={onUpdateCoupon}
            promoBanner={promoBanner}
            onUpdatePromoBanner={onUpdatePromoBanner}
            lastBackupTime={lastBackupTime}
            onTriggerBackup={onTriggerBackup}
            onAddOrder={onAddOrder}
            currency={currency}
            darkMode={darkMode}
            fontSize={fontSize}
            onChangeFontSize={onChangeFontSize}
            returnRequests={returnRequests}
            onUpdateReturnRequestStatus={onUpdateReturnRequestStatus}
            onProductsUpdated={setProducts}
            onOrdersUpdated={setOrders}
            onNavigateToSite={onNavigateToSite}
            onLogout={() => setShowLogoutConfirmModal(true)}
            initialEditingProduct={initialEditingProduct}
          />
        </ErrorBoundary>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-2">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">Logout Superuser?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              You will be logged out of the Django Administration Suite and returned to the customer storefront.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirmModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserRole('customer');
                  setShowLogoutConfirmModal(false);
                  onNavigateToSite('home');
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition cursor-pointer shadow-lg shadow-rose-600/30"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

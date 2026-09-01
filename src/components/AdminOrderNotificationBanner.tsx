/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  ShoppingBag, 
  X, 
  Volume2, 
  VolumeX, 
  ExternalLink, 
  CheckCircle2, 
  Sparkles, 
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  PackageCheck
} from 'lucide-react';
import { Order } from '../types';
import { 
  subscribeToOrderNotifications, 
  playNewOrderSound, 
  showDesktopNotification, 
  requestNotificationPermission 
} from '../lib/orderNotifications';

interface AdminOrderNotificationBannerProps {
  userRole: 'customer' | 'admin';
  currentTab?: string;
  onNavigateToAdminOrders: (orderId?: string) => void;
}

export default function AdminOrderNotificationBanner({
  userRole,
  currentTab = 'admin',
  onNavigateToAdminOrders,
}: AdminOrderNotificationBannerProps) {
  const [activeAlertOrder, setActiveAlertOrder] = useState<Order | null>(null);
  const [notificationHistory, setNotificationHistory] = useState<Order[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'denied';
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Subscribe to incoming orders (from current tab or different tabs/windows)
  useEffect(() => {
    const unsubscribe = subscribeToOrderNotifications((newOrder, isCrossTab) => {
      console.log('[AdminOrderNotificationBanner] New order payload received! Cross-tab:', isCrossTab, newOrder);

      // Play sound chime if enabled
      if (soundEnabled) {
        playNewOrderSound();
      }

      // Trigger native browser desktop window notification
      showDesktopNotification(newOrder);

      // Set active alert banner
      setActiveAlertOrder(newOrder);
      setUnreadCount((prev) => prev + 1);
      setNotificationHistory((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)].slice(0, 15));
    });

    // Check if permission is default and user is admin
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default' && userRole === 'admin') {
        setShowPermissionPrompt(true);
      }
    }

    return () => {
      unsubscribe();
    };
  }, [soundEnabled, userRole]);

  // Listen for navigation event triggered by desktop notification click
  useEffect(() => {
    const handleNavigateEvent = (e: any) => {
      const orderId = e.detail?.orderId;
      onNavigateToAdminOrders(orderId);
      setActiveAlertOrder(null);
    };

    window.addEventListener('veloce_navigate_admin_orders', handleNavigateEvent);
    return () => {
      window.removeEventListener('veloce_navigate_admin_orders', handleNavigateEvent);
    };
  }, [onNavigateToAdminOrders]);

  const handleEnablePermission = async () => {
    const result = await requestNotificationPermission();
    setPermissionStatus(result);
    setShowPermissionPrompt(false);
    if (result === 'granted') {
      // Send sample test notification to verify
      playNewOrderSound();
      const testOrder: Order = {
        id: 'VEL-TEST-' + Math.floor(1000 + Math.random() * 9000),
        customerName: 'Desktop Alert Test',
        customerEmail: 'test@veloce.io',
        total: 18500,
        status: 'pending',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'mpesa',
        items: [{ productId: 'test', name: 'Veloce Pulse Active Smartwatch', price: 18500, quantity: 1, selectedVariations: {}, type: 'physical' }]
      };
      showDesktopNotification(testOrder);
    }
  };

  const handleTestNotification = () => {
    if (soundEnabled) playNewOrderSound();
    const mockOrder: Order = {
      id: 'VEL-' + Math.floor(100 + Math.random() * 900) + '-LIVE',
      customerName: 'Amina Mohamed',
      customerEmail: 'amina.m@example.com',
      total: 32400,
      status: 'pending',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'mpesa',
      items: [
        { productId: 'pro-headphone-x1', name: 'Veloce Pro Wireless Headphones X1', price: 24500, quantity: 1, selectedVariations: {}, type: 'physical' },
        { productId: 'mag-stand', name: 'Veloce MagSafe Desk Stand', price: 7900, quantity: 1, selectedVariations: {}, type: 'physical' }
      ]
    };

    // Trigger cross-tab notification
    showDesktopNotification(mockOrder);
    setActiveAlertOrder(mockOrder);
    setUnreadCount((prev) => prev + 1);
    setNotificationHistory((prev) => [mockOrder, ...prev].slice(0, 15));
  };

  // The alert button and real-time notification banner are strictly visible in the admin page
  if (userRole !== 'admin' || currentTab !== 'admin') {
    return null;
  }

  return (
    <>
      {/* Top Admin Permission Bar Prompt (When Admin logged in & permission is default) */}
      {userRole === 'admin' && showPermissionPrompt && (
        <div className="bg-amber-600 text-white px-4 py-2 text-xs font-sans font-semibold flex flex-wrap items-center justify-between gap-3 shadow-xs border-b border-amber-500 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-300 animate-bounce shrink-0" />
            <span>
              <strong>Admin Desktop Alerts:</strong> Enable browser notifications to receive real-time popups when customers place orders from any tab or window.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleEnablePermission}
              className="px-3 py-1 bg-white text-gray-900 hover:bg-amber-100 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>Enable Window Notifications</span>
            </button>
            <button
              onClick={() => setShowPermissionPrompt(false)}
              aria-label="Dismiss notification prompt"
              className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Real-Time Order Toast Popup (Appears when a new order arrives) */}
      {activeAlertOrder && (
        <div className="fixed top-20 right-4 z-50 w-full max-w-md bg-white dark:bg-gray-900 border-2 border-indigo-500 dark:border-indigo-600 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <h4 className="font-extrabold text-sm tracking-tight font-sans text-white flex items-center gap-1.5">
                  <PackageCheck className="h-4 w-4 text-emerald-400" />
                  <span>NEW ORDER RECEIVED!</span>
                </h4>
                <span className="text-[10px] text-indigo-200 font-mono">
                  Order ID: #{activeAlertOrder.id}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setSoundEnabled((prev) => !prev)}
                aria-label={soundEnabled ? 'Mute Alert Sound' : 'Enable Alert Sound'}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title={soundEnabled ? 'Mute Alert Sound' : 'Enable Alert Sound'}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-300" /> : <VolumeX className="h-4 w-4 text-gray-400" />}
              </button>
              <button
                onClick={() => setActiveAlertOrder(null)}
                aria-label="Close order alert toast"
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between bg-indigo-50/70 dark:bg-gray-800/80 p-3 rounded-2xl border border-indigo-100 dark:border-gray-700">
              <div>
                <span className="text-xs font-bold text-gray-900 dark:text-white font-sans">
                  {activeAlertOrder.customerName || 'Guest Customer'}
                </span>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                  {activeAlertOrder.customerEmail || 'Direct Checkout'}
                </p>
              </div>

              <div className="text-right">
                <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                  KSh {(activeAlertOrder.total || 0).toLocaleString()}
                </span>
                <span className="block text-[10px] uppercase font-bold text-emerald-600 font-mono">
                  {(activeAlertOrder.paymentMethod || 'M-PESA').toUpperCase()}
                </span>
              </div>
            </div>

            <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
              <span className="font-bold uppercase text-[10px] tracking-wider text-gray-400 font-mono">Order Items:</span>
              <ul className="space-y-1 pl-1 max-h-24 overflow-y-auto">
                {activeAlertOrder.items?.map((item, idx) => (
                  <li key={idx} className="flex justify-between items-center text-[11px] font-mono">
                    <span className="truncate max-w-[220px]">{item.quantity}x {item.name}</span>
                    <span className="font-bold">KSh {(item.price * item.quantity).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 flex items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => {
                  onNavigateToAdminOrders(activeAlertOrder.id);
                  setActiveAlertOrder(null);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <span>View Order in Admin Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Quick Floating Bell Widget for Admin (Fixed Bottom Right) */}
      {userRole === 'admin' && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="p-3.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xl border-2 border-white dark:border-gray-800 transition-all cursor-pointer relative active:scale-95 group"
            title="Real-Time Order Notification Center"
          >
            <Bell className="h-5 w-5 group-hover:rotate-12 transition-transform" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-mono font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 animate-bounce">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Order Notifications Modal Drawer */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 text-indigo-300">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Real-Time Order Notifications</h3>
                  <p className="text-xs text-indigo-200/80">
                    Live system triggers for incoming store orders
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setUnreadCount(0);
                }}
                aria-label="Close Order Notifications History Modal"
                className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-indigo-50 dark:bg-gray-800/60 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 font-mono">
                <span className="text-gray-600 dark:text-gray-300">Desktop Alerts:</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                  permissionStatus === 'granted'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  {permissionStatus === 'granted' ? '✅ ACTIVE' : '⚠️ NOT ENABLED'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestNotification}
                  className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex items-center gap-1"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Send Test Alert</span>
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {notificationHistory.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <ShoppingBag className="h-10 w-10 text-gray-300 mx-auto" />
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">No new orders received in this session</p>
                  <p className="text-xs text-gray-400">
                    When customers place orders, live popups & desktop alerts will appear automatically.
                  </p>
                </div>
              ) : (
                notificationHistory.map((ord, idx) => (
                  <div
                    key={ord.id + idx}
                    onClick={() => {
                      onNavigateToAdminOrders(ord.id);
                      setShowHistoryModal(false);
                      setUnreadCount(0);
                    }}
                    className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 hover:border-indigo-500 transition-all cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                        #{ord.id}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        {ord.date || 'Just now'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-bold text-xs text-gray-900 dark:text-white">{ord.customerName}</h5>
                        <p className="text-[11px] text-gray-500 font-mono">{ord.items?.length || 1} item(s)</p>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-extrabold text-sm text-gray-900 dark:text-white">
                          KSh {(ord.total || 0).toLocaleString()}
                        </span>
                        <span className="block text-[10px] text-emerald-600 font-bold uppercase font-mono">
                          {ord.paymentMethod || 'mpesa'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <span className="text-xs font-mono text-gray-500">
                Total Received: {notificationHistory.length}
              </span>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setUnreadCount(0);
                }}
                className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

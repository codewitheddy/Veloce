/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Order, OrderStatusHistoryEntry } from '../types';
import { broadcastNewOrderEvent } from '../lib/orderNotifications';
import { ordersApi, mapBackendOrderToFrontend } from '../api/orders';
import api, { orderService, pushOrderToBackend } from '../services/api';

interface OrdersContextType {
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: Order['status'], note?: string) => void;
  cancelOrder: (orderId: string, reason?: string) => void;
  getOrderById: (orderId: string) => Order | undefined;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

const SEED_ORDERS: Order[] = [
  {
    id: 'VEL-894-SWIFT',
    customerName: 'Sarah Jenkins',
    customerEmail: 'sarah.j@example.com',
    total: 24500,
    status: 'shipped',
    date: '2026-07-20',
    shippingAddress: '42 Westlands Expressway, Nairobi, Kenya',
    paymentMethod: 'mpesa',
    items: [
      {
        productId: 'pro-headphone-x1',
        name: 'Veloce Pro Wireless Headphones X1',
        price: 24500,
        quantity: 1,
        selectedVariations: { Color: 'Matte Obsidian' },
        type: 'physical'
      }
    ],
    statusHistory: [
      { status: 'pending', timestamp: '2026-07-20T08:00:00Z', note: 'Order created via checkout' },
      { status: 'processing', timestamp: '2026-07-20T08:30:00Z', note: 'M-Pesa payment confirmed' },
      { status: 'shipped', timestamp: '2026-07-20T10:15:00Z', note: 'Dispatched via Fargo Express' }
    ]
  },
  {
    id: 'VEL-712-CORE',
    customerName: 'Marcus Chen',
    customerEmail: 'm.chen@techcorp.io',
    total: 18000,
    status: 'completed',
    date: '2026-07-18',
    shippingAddress: 'Building B, Kilimani Ridge, Nairobi',
    paymentMethod: 'cod',
    items: [
      {
        productId: 'smart-watch-v2',
        name: 'Veloce Pulse Active Smartwatch V2',
        price: 18000,
        quantity: 1,
        selectedVariations: { Strap: 'Sport Silicone' },
        type: 'physical'
      }
    ]
  }
];

export const OrdersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<Order[]>(SEED_ORDERS);

  // Fetch authoritative orders from Django Backend API on mount
  useEffect(() => {
    let isMounted = true;
    const fetchBackendOrders = async () => {
      try {
        const response = await orderService.getOrders();
        if (isMounted && Array.isArray(response) && response.length > 0) {
          const mapped = response.map(mapBackendOrderToFrontend);
          setOrders(mapped);
        }
      } catch (err) {
        console.warn('[OrdersContext] Could not fetch orders from Django backend API, fallback to initial state:', err);
      }
    };

    fetchBackendOrders();
    return () => {
      isMounted = false;
    };
  }, []);

  const addOrder = (order: Order) => {
    setOrders((prev) => [order, ...prev]);
    broadcastNewOrderEvent(order);

    // Push new order directly to Django backend
    pushOrderToBackend(order).catch((err) => {
      console.warn('[OrdersContext] Failed to push order to Django backend API:', err);
    });
  };

  const updateOrderStatus = (orderId: string, status: Order['status'], note?: string) => {
    // Persist status change to Django backend API
    api.put(`/orders/${orderId}/`, { status }).catch((err) => {
      console.warn('[OrdersContext] Failed to update order status on backend:', err);
    });

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id.toLowerCase() === orderId.toLowerCase()) {
          const historyStatus = status === 'completed' ? 'delivered' : status;
          const entry: OrderStatusHistoryEntry = {
            status: historyStatus,
            timestamp: new Date().toISOString(),
            note: note || `Status updated to ${status}`
          };
          const history = ord.statusHistory ? [...ord.statusHistory, entry] : [entry];
          return { ...ord, status, statusHistory: history };
        }
        return ord;
      })
    );
  };

  const cancelOrder = (orderId: string, reason?: string) => {
    updateOrderStatus(orderId, 'cancelled', reason || 'Customer requested cancellation');
  };

  const getOrderById = (orderId: string) => {
    return orders.find((o) => o.id.toLowerCase() === orderId.toLowerCase());
  };

  return (
    <OrdersContext.Provider
      value={{
        orders,
        addOrder,
        updateOrderStatus,
        cancelOrder,
        getOrderById
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
};

export const useOrders = (): OrdersContextType => {
  const ctx = useContext(OrdersContext);
  if (!ctx) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return ctx;
};

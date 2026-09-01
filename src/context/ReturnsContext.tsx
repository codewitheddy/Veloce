/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ReturnRequest } from '../types';

interface ReturnsContextType {
  returnRequests: ReturnRequest[];
  submitReturnRequest: (request: Omit<ReturnRequest, 'id' | 'dateSubmitted' | 'status'>) => void;
  updateReturnRequestStatus: (requestId: string, status: ReturnRequest['status'], adminNote?: string) => void;
  getReturnsByEmail: (email: string) => ReturnRequest[];
}

const ReturnsContext = createContext<ReturnsContextType | undefined>(undefined);

const SEED_RETURNS: ReturnRequest[] = [
  {
    id: 'RET-2026-901',
    orderId: 'VEL-894-SWIFT',
    customerName: 'Sarah Jenkins',
    customerEmail: 'sarah.j@example.com',
    items: [
      {
        productId: 'pro-headphone-x1',
        name: 'Veloce Pro Wireless Headphones X1',
        quantity: 1,
        price: 24500,
        selectedVariations: { Color: 'Matte Obsidian' }
      }
    ],
    type: 'refund',
    reason: 'defective',
    reasonDetails: 'Left audio driver has intermittent white noise.',
    status: 'approved',
    dateSubmitted: '2026-07-21',
    refundAmount: 24500,
    trackingNumber: 'RMA-901-FARGO'
  }
];

export const ReturnsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>(() => {
    const saved = localStorage.getItem('veloce_returns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return SEED_RETURNS;
  });

  useEffect(() => {
    localStorage.setItem('veloce_returns', JSON.stringify(returnRequests));
  }, [returnRequests]);

  const submitReturnRequest = (request: Omit<ReturnRequest, 'id' | 'dateSubmitted' | 'status'>) => {
    const newReq: ReturnRequest = {
      ...request,
      id: `RET-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      dateSubmitted: new Date().toISOString().split('T')[0],
      status: 'pending'
    };
    setReturnRequests((prev) => [newReq, ...prev]);
  };

  const updateReturnRequestStatus = (requestId: string, status: ReturnRequest['status'], adminNote?: string) => {
    setReturnRequests((prev) =>
      prev.map((req) =>
        req.id === requestId
          ? { ...req, status, adminNote: adminNote ?? req.adminNote }
          : req
      )
    );
  };

  const getReturnsByEmail = (email: string) => {
    return returnRequests.filter((r) => r.customerEmail.toLowerCase() === email.toLowerCase());
  };

  return (
    <ReturnsContext.Provider
      value={{
        returnRequests,
        submitReturnRequest,
        updateReturnRequestStatus,
        getReturnsByEmail
      }}
    >
      {children}
    </ReturnsContext.Provider>
  );
};

export const useReturns = (): ReturnsContextType => {
  const ctx = useContext(ReturnsContext);
  if (!ctx) {
    throw new Error('useReturns must be used within a ReturnsProvider');
  }
  return ctx;
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Deprecated: The old popup modal has been completely replaced by the dedicated OrderTrackingPage.
 */

import React, { useEffect } from 'react';
import { Order, Product } from '../types';
import { CurrencyType } from '../lib/currency';

export interface OrderStatusModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  orders?: Order[];
  products?: Product[];
  initialOrderId?: string | null;
  currency?: CurrencyType;
}

export default function OrderStatusModal({
  isOpen,
  onClose,
  initialOrderId,
}: OrderStatusModalProps) {
  useEffect(() => {
    if (isOpen) {
      if (typeof window !== 'undefined') {
        if (initialOrderId) {
          window.dispatchEvent(new CustomEvent('veloce_open_tracking', { detail: initialOrderId }));
        } else {
          window.dispatchEvent(new CustomEvent('veloce_navigate_tab', { detail: 'track' }));
        }
      }
      if (onClose) onClose();
    }
  }, [isOpen, initialOrderId, onClose]);

  return null;
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Order } from '../types';
import OrderReceiptPage, { OrderReceiptPageProps } from './OrderReceiptPage';

export default function OrderReceiptModal({
  order,
  onClose,
  autoPrint = false,
  shippingStatus,
  onReorder,
  allOrders,
  onUpdateOrderPaymentStatus,
}: OrderReceiptPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex flex-col bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-md overflow-y-auto"
    >
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <OrderReceiptPage
          order={order}
          onBack={onClose}
          onClose={onClose}
          autoPrint={autoPrint}
          shippingStatus={shippingStatus}
          onReorder={onReorder}
          allOrders={allOrders}
          onUpdateOrderPaymentStatus={onUpdateOrderPaymentStatus}
        />
      </div>
    </motion.div>
  );
}

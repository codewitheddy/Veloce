/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider } from './AuthContext';
import { OrdersProvider } from './OrdersContext';
import { ReturnsProvider } from './ReturnsContext';

export * from './AuthContext';
export * from './OrdersContext';
export * from './ReturnsContext';

export const AppStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      <OrdersProvider>
        <ReturnsProvider>{children}</ReturnsProvider>
      </OrdersProvider>
    </AuthProvider>
  );
};

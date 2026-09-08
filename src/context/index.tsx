/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider } from './AuthContext';
import { OrdersProvider } from './OrdersContext';
import { ReturnsProvider } from './ReturnsContext';
import { SiteSettingsProvider } from './SiteSettingsContext';

export * from './AuthContext';
export * from './OrdersContext';
export * from './ReturnsContext';
export * from './SiteSettingsContext';

export const AppStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SiteSettingsProvider>
      <AuthProvider>
        <OrdersProvider>
          <ReturnsProvider>{children}</ReturnsProvider>
        </OrdersProvider>
      </AuthProvider>
    </SiteSettingsProvider>
  );
};


/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { purgeUserQueriesOnLogout } from '../providers/QueryProvider';
import { clearAllStoredAuthTokens } from '../utils/authTokens';
import api from '../services/api';

export interface UserProfile {
  name: string;
  email: string;
  role: 'customer' | 'admin';
  phone?: string;
  shippingAddress?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, role?: 'customer' | 'admin', extra?: { name?: string; phone?: string; address?: string }) => void;
  logout: () => void;
  updateProfile: (updated: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('veloce_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) return parsed;
      } catch {
        // Fallback
      }
    }
    return null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('veloce_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('veloce_user');
    }
  }, [user]);

  const login = (email: string, role: 'customer' | 'admin' = 'customer', extra?: { name?: string; phone?: string; address?: string }) => {
    const cleanEmail = email.trim();
    const profile: UserProfile = {
      name: extra?.name || cleanEmail.split('@')[0],
      email: cleanEmail,
      role,
      phone: extra?.phone || '',
      shippingAddress: extra?.address || '',
      avatarUrl: ''
    };
    setUser(profile);
    localStorage.setItem('veloce_user', JSON.stringify(profile));
    localStorage.setItem('veloce_login_email', cleanEmail);
    if (extra?.name) localStorage.setItem('veloce_login_name', extra.name);
    if (extra?.phone) localStorage.setItem('veloce_login_phone', extra.phone);
    if (extra?.address) localStorage.setItem('veloce_login_address', extra.address);
    window.dispatchEvent(new CustomEvent('veloce_auth_changed', { detail: { action: 'login', user: profile } }));
  };

  const logout = () => {
    setUser(null);
    clearAllStoredAuthTokens();
    localStorage.removeItem('veloce_user');
    localStorage.removeItem('veloce_login_email');
    localStorage.removeItem('veloce_login_name');
    localStorage.removeItem('veloce_login_phone');
    localStorage.removeItem('veloce_login_address');
    localStorage.removeItem('veloce_auth_token');
    localStorage.removeItem('veloce_pending_wishlist_product_id');
    localStorage.removeItem('veloce_open_auth_mode');
    localStorage.removeItem('ropenix_login_email');
    localStorage.removeItem('customer_support_tickets');
    try {
      api.post('/auth/logout/').catch(() => {});
    } catch {}
    purgeUserQueriesOnLogout();
    window.dispatchEvent(new CustomEvent('veloce_auth_changed', { detail: { action: 'logout' } }));
  };

  const updateProfile = (updated: Partial<UserProfile>) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updated };
      localStorage.setItem('veloce_user', JSON.stringify(next));
      if (updated.email) localStorage.setItem('veloce_login_email', updated.email);
      if (updated.name) localStorage.setItem('veloce_login_name', updated.name);
      if (updated.phone) localStorage.setItem('veloce_login_phone', updated.phone);
      if (updated.shippingAddress) localStorage.setItem('veloce_login_address', updated.shippingAddress);
      window.dispatchEvent(new CustomEvent('veloce_auth_changed', { detail: { action: 'update', user: next } }));
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        login,
        logout,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};

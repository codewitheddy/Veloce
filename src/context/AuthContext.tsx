/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { purgeUserQueriesOnLogout } from '../providers/QueryProvider';

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
  login: (email: string, role?: 'customer' | 'admin') => void;
  logout: () => void;
  updateProfile: (updated: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('veloce_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return {
      name: 'Sarah Jenkins',
      email: 'sarah.j@example.com',
      role: 'customer',
      phone: '+254 712 345 678',
      shippingAddress: '42 Westlands Expressway, Nairobi, Kenya',
      avatarUrl: ''
    };
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('veloce_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('veloce_user');
    }
  }, [user]);

  const login = (email: string, role: 'customer' | 'admin' = 'customer') => {
    setUser({
      name: email.split('@')[0],
      email,
      role
    });
  };

  const logout = () => {
    setUser(null);
    purgeUserQueriesOnLogout();
  };

  const updateProfile = (updated: Partial<UserProfile>) => {
    setUser((prev) => (prev ? { ...prev, ...updated } : null));
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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { FullSiteSettings } from '../types/siteSettings';
import { siteSettingsApi, INITIAL_DEFAULT_SETTINGS, applyAppearanceToDom } from '../services/siteSettingsApi';

interface SiteSettingsContextType {
  settings: FullSiteSettings;
  isLoading: boolean;
  refreshSettings: () => Promise<FullSiteSettings>;
  updateSection: <K extends keyof FullSiteSettings>(
    section: K,
    data: Partial<FullSiteSettings[K]>
  ) => Promise<{ message: string; data: FullSiteSettings[K] }>;
}

const SiteSettingsContext = createContext<SiteSettingsContextType | undefined>(undefined);

export const SiteSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<FullSiteSettings>(() => {
    try {
      const cached = localStorage.getItem('veloce_site_settings_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.appearance) {
          applyAppearanceToDom(parsed.appearance);
        }
        return parsed;
      }
    } catch {
      // ignore parse errors
    }
    applyAppearanceToDom(INITIAL_DEFAULT_SETTINGS.appearance);
    return INITIAL_DEFAULT_SETTINGS;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const fresh = await siteSettingsApi.getSettings();
      if (fresh) {
        setSettings(fresh);
        if (fresh.appearance) {
          applyAppearanceToDom(fresh.appearance);
        }
      }
      return fresh;
    } catch (err) {
      console.warn('Failed to refresh site settings from API:', err);
      return settings;
    } finally {
      setIsLoading(false);
    }
  }, [settings]);

  const updateSection = useCallback(
    async <K extends keyof FullSiteSettings>(
      section: K,
      data: Partial<FullSiteSettings[K]>
    ) => {
      const res = await siteSettingsApi.updateSection(section, data);
      setSettings((prev) => {
        const updated = {
          ...prev,
          [section]: res.data
        };
        return updated;
      });
      return res;
    },
    []
  );

  // Initial load on boot
  useEffect(() => {
    refreshSettings();
  }, []);

  // Listen for local and cross-tab update events
  useEffect(() => {
    const handleSettingsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ section: keyof FullSiteSettings; data: any }>;
      if (customEvent.detail) {
        const { section, data } = customEvent.detail;
        setSettings((prev) => ({
          ...prev,
          [section]: data
        }));
        if (section === 'appearance' && data) {
          applyAppearanceToDom(data);
        }
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'veloce_site_settings_cache' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          setSettings(parsed);
          if (parsed.appearance) {
            applyAppearanceToDom(parsed.appearance);
          }
        } catch {}
      }
    };

    window.addEventListener('veloce_site_settings_updated', handleSettingsUpdated);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('veloce_site_settings_updated', handleSettingsUpdated);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <SiteSettingsContext.Provider
      value={{
        settings,
        isLoading,
        refreshSettings,
        updateSection
      }}
    >
      {children}
    </SiteSettingsContext.Provider>
  );
};

export const useSiteSettings = () => {
  const context = useContext(SiteSettingsContext);
  if (!context) {
    throw new Error('useSiteSettings must be used within a SiteSettingsProvider');
  }
  return context;
};

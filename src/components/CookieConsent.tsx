/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, Settings, X, Check, Eye, Lock, Sliders, AlertTriangle } from 'lucide-react';

export interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  personalization: boolean;
}

interface CookieConsentProps {
  forceOpen?: boolean;
  onCloseForceOpen?: () => void;
}

export default function CookieConsent({ forceOpen = false, onCloseForceOpen }: CookieConsentProps) {
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [prefs, setPrefs] = useState<CookiePreferences>({
    essential: true,
    analytics: true,
    marketing: true,
    personalization: true,
  });

  // Verify and load previous preferences
  useEffect(() => {
    const savedConsent = localStorage.getItem('veloce_cookie_consent') || localStorage.getItem('cookie_consent');
    if (savedConsent) {
      try {
        const parsed = JSON.parse(savedConsent);
        if (parsed && typeof parsed.preferences === 'object') {
          setPrefs({
            essential: true,
            analytics: !!parsed.preferences.analytics,
            marketing: !!parsed.preferences.marketing,
            personalization: !!parsed.preferences.personalization,
          });
          setShowBanner(false);
          return;
        }
      } catch (err) {
        console.error('Stale cookie consent configuration:', err);
      }
    } else {
      // Show consent banner after a short delay only if no valid consent is recorded
      const timer = setTimeout(() => {
        const checkAgain = localStorage.getItem('veloce_cookie_consent') || localStorage.getItem('cookie_consent');
        if (!checkAgain) {
          setShowBanner(true);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Sync if forceOpen is triggered from parent components
  useEffect(() => {
    if (forceOpen) {
      setShowModal(true);
    }
  }, [forceOpen]);

  const savePreferences = (updatedPrefs: CookiePreferences) => {
    const consentObject = {
      accepted: true,
      preferences: updatedPrefs,
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem('veloce_cookie_consent', JSON.stringify(consentObject));
      localStorage.setItem('cookie_consent', JSON.stringify(consentObject));
    } catch {
      // ignore
    }
    setPrefs(updatedPrefs);
    setShowBanner(false);
    setShowModal(false);
    if (onCloseForceOpen) onCloseForceOpen();

    // Fire custom event to notify other components
    window.dispatchEvent(new CustomEvent('veloce_cookie_consent_updated', { detail: updatedPrefs }));
  };

  const handleAcceptAll = () => {
    const allOn: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: true,
      personalization: true,
    };
    savePreferences(allOn);
  };

  const handleRejectOptional = () => {
    const essentialOnly: CookiePreferences = {
      essential: true,
      analytics: false,
      marketing: false,
      personalization: false,
    };
    savePreferences(essentialOnly);
  };

  const handleTogglePref = (key: keyof CookiePreferences) => {
    if (key === 'essential') return; // Cannot toggle essential
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCloseModal = () => {
    setShowModal(false);
    if (onCloseForceOpen) onCloseForceOpen();
  };

  // Keep listener active for reopening consent from elsewhere in the system
  useEffect(() => {
    const handleReopen = () => {
      setShowModal(true);
    };
    window.addEventListener('veloce_open_cookie_settings', handleReopen);
    return () => window.removeEventListener('veloce_open_cookie_settings', handleReopen);
  }, []);

  if (!showBanner && !showModal) return null;

  return (
    <>
      {/* Floating Bottom Banner */}
      {showBanner && !showModal && (
        <div
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-40 bg-gray-950 text-white border border-gray-900 rounded-xl p-5 shadow-2xl animate-in slide-in-from-bottom duration-300 font-sans"
          id="cookie-consent-banner"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full p-1.5 bg-gray-900 border border-gray-800 text-indigo-450 shrink-0">
              <Shield className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">
                Workspace Identity & Cookies
              </h3>
              <p className="text-[11px] text-gray-400 font-extralight mt-1.5 leading-relaxed">
                Ropenix Collections uses standard browser cookies and LocalStorage domains to secure affiliate program credits, remember your theme, and safely store order details locally.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              onClick={handleAcceptAll}
              className="flex-1 min-w-[100px] inline-flex items-center justify-center h-8 rounded bg-white text-gray-950 hover:bg-gray-100 text-[10px] font-bold transition-colors cursor-pointer"
              id="cookie-btn-accept-all"
            >
              Accept All
            </button>
            <button
              onClick={handleRejectOptional}
              className="flex-1 min-w-[100px] inline-flex items-center justify-center h-8 rounded bg-gray-900 border border-gray-850 text-gray-400 hover:text-white hover:bg-gray-850 text-[10px] font-bold transition-all cursor-pointer"
              id="cookie-btn-reject-optional"
            >
              Decline Optional
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex-1 min-w-[100px] inline-flex items-center justify-center h-8 rounded border border-gray-850 text-gray-300 hover:text-white hover:border-gray-700 text-[10px] font-medium transition-all cursor-pointer"
              id="cookie-btn-customize"
            >
              Customize
            </button>
          </div>
        </div>
      )}

      {/* Customizable Preferences Overlay Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 font-sans animate-in fade-in duration-200"
          id="cookie-preferences-modal"
        >
          <div className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-900 rounded-xl max-w-lg w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-650 dark:hover:text-gray-200 transition-colors cursor-pointer"
              title="Close Preferences"
              id="cookie-modal-close"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <Shield className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                Cookie Preferences
              </h3>
            </div>
            <p className="text-[11px] text-gray-550 dark:text-gray-400 font-extralight leading-relaxed mb-6">
              You maintain total authority over your private workspace data. Review cookie scopes below and configure settings to fit your requirements.
            </p>

            {/* Custom List of Toggles */}
            <div className="flex flex-col gap-4 mb-6 max-h-[280px] overflow-y-auto pr-1">
              
              {/* Essential */}
              <div className="flex items-start justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-900">
                <div className="min-w-0 flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-gray-900 dark:text-white">
                      Essential & Core Operations
                    </span>
                    <span className="rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-450 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider">
                      Required
                    </span>
                  </div>
                  <span className="block text-[10px] text-gray-500 mt-1 font-extralight leading-normal">
                    Prerequisite trackers for transaction states, shopping carts, visual color presets, access permissions, and session validation. Cannot be disabled.
                  </span>
                </div>
                <div className="shrink-0 flex items-center h-6">
                  <Lock className="h-4.5 w-4.5 text-gray-400" />
                </div>
              </div>

              {/* Traffic & Analytics */}
              <div className="flex items-start justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-900">
                <div className="min-w-0 flex-1 pr-4">
                  <span className="block text-[11px] font-semibold text-gray-900 dark:text-white">
                    Traffic Insights & Platform Diagnostics
                  </span>
                  <span className="block text-[10px] text-gray-500 mt-1 font-extralight leading-normal">
                    Assists Ropenix Collections' standby engineers in evaluating visual speed benchmarks, page interactions, and screen sizes. All records are completely anonymized.
                  </span>
                </div>
                <div className="shrink-0 flex items-center h-6">
                  <button
                    onClick={() => handleTogglePref('analytics')}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      prefs.analytics ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-800'
                    }`}
                    id="toggle-pref-analytics"
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        prefs.analytics ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Marketing & Partners */}
              <div className="flex items-start justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-900">
                <div className="min-w-0 flex-1 pr-4">
                  <span className="block text-[11px] font-semibold text-gray-900 dark:text-white">
                    Affiliate Network Attribution
                  </span>
                  <span className="block text-[10px] text-gray-500 mt-1 font-extralight leading-normal">
                    Allows us to trace back reference codes and affiliate click histories to accurately credit partner woodcrafters when executing orders.
                  </span>
                </div>
                <div className="shrink-0 flex items-center h-6">
                  <button
                    onClick={() => handleTogglePref('marketing')}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      prefs.marketing ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-800'
                    }`}
                    id="toggle-pref-marketing"
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        prefs.marketing ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Personalization */}
              <div className="flex items-start justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-900">
                <div className="min-w-0 flex-1 pr-4">
                  <span className="block text-[11px] font-semibold text-gray-900 dark:text-white">
                    Personalization & User Settings
                  </span>
                  <span className="block text-[10px] text-gray-500 mt-1 font-extralight leading-normal">
                    Preserves customized user settings, accessibility options (font sizes), and personalized campaign recommendations across active browse sessions.
                  </span>
                </div>
                <div className="shrink-0 flex items-center h-6">
                  <button
                    onClick={() => handleTogglePref('personalization')}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      prefs.personalization ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-800'
                    }`}
                    id="toggle-pref-personalization"
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        prefs.personalization ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

            </div>

            {/* Core Action Footer Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
              <button
                onClick={handleRejectOptional}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 px-4 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors cursor-pointer"
                id="pref-btn-reject-all"
              >
                Disable Optional Cookies
              </button>
              <button
                onClick={() => savePreferences(prefs)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-650 hover:bg-indigo-700 text-white px-5 text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                id="pref-btn-save"
              >
                <Check className="h-3.5 w-3.5" /> Save My Choices
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

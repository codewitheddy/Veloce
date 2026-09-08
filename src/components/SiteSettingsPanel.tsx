/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Palette,
  Percent,
  FileText,
  Shield,
  CreditCard,
  Bell,
  Search,
  Lock,
  History,
  Check,
  Save,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Plus,
  Calendar,
  Clock,
  QrCode,
  Globe,
  Smartphone,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Zap,
  Info,
  Sliders,
  RotateCcw,
  Building,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronRight,
  Database,
  Cloud,
  Image as ImageIcon,
  Loader2,
  CheckCircle
} from 'lucide-react';
import {
  FullSiteSettings,
  ThemePreset,
  BackupSnapshot,
  SettingsAuditLog,
  ETimsDiagnosticResult,
  TextScaleOption
} from '../types/siteSettings';
import {
  siteSettingsApi,
  INITIAL_DEFAULT_SETTINGS,
  INITIAL_THEME_PRESETS,
  applyAppearanceToDom
} from '../services/siteSettingsApi';
import {
  checkCloudinaryStatus,
  uploadImageToCloudinary,
  getOptimizedCloudinaryUrl,
  isCloudinaryUrl
} from '../lib/cloudinary';

type SettingsTab =
  | 'general'
  | 'appearance'
  | 'media'
  | 'tax'
  | 'receipts'
  | 'backup'
  | 'payments'
  | 'notifications'
  | 'seo'
  | 'access_control'
  | 'audit_logs';

export function SiteSettingsPanel() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [settings, setSettings] = useState<FullSiteSettings>(INITIAL_DEFAULT_SETTINGS);
  const [themePresets, setThemePresets] = useState<ThemePreset[]>(INITIAL_THEME_PRESETS);
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [auditLogs, setAuditLogs] = useState<SettingsAuditLog[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Cloudinary State & Diagnostics
  const [cloudinaryStatus, setCloudinaryStatus] = useState<{
    configured: boolean;
    cloudName?: string;
    source: 'backend' | 'client_preset' | 'none';
    message: string;
  }>({
    configured: false,
    source: 'none',
    message: 'Checking Cloudinary configuration...'
  });
  const [isCheckingCloudinary, setIsCheckingCloudinary] = useState(false);
  const [isTestingCloudinaryUpload, setIsTestingCloudinaryUpload] = useState(false);
  const [cloudinaryTestResult, setCloudinaryTestResult] = useState<{
    url: string;
    secureUrl: string;
    isCloudinary: boolean;
    width?: number;
    height?: number;
    bytes?: number;
    format?: string;
    optimizedUrl?: string;
  } | null>(null);
  const [cloudinaryTestError, setCloudinaryTestError] = useState<string | null>(null);
  const testFileInputRef = useRef<HTMLInputElement>(null);

  // Modals & Sub-states
  const [showNewThemeModal, setShowNewThemeModal] = useState(false);
  const [newTheme, setNewTheme] = useState<Partial<ThemePreset>>({
    name: '',
    description: '',
    primary_color: '#4f46e5',
    secondary_color: '#06b6d4',
    accent_color: '#f59e0b',
    background_color: '#0f172a',
    surface_color: '#1e293b',
    text_color: '#f8fafc'
  });

  const [selectedThemeForSchedule, setSelectedThemeForSchedule] = useState<ThemePreset | null>(null);
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');

  // eTIMS Diagnostics State
  const [etimsTesting, setEtimsTesting] = useState(false);
  const [etimsResult, setEtimsResult] = useState<ETimsDiagnosticResult | null>(null);

  // Backup Trigger State
  const [backupNote, setBackupNote] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Guard against StrictMode double-invocation of save calls
  const isSavingRef = useRef(false);

  // Password visibility toggles
  const [showEtimsSecret, setShowEtimsSecret] = useState(false);
  const [showMpesaSecret, setShowMpesaSecret] = useState(false);
  const [showMpesaPasskey, setShowMpesaPasskey] = useState(false);

  // Refresh Cloudinary status
  const refreshCloudinaryStatus = async () => {
    setIsCheckingCloudinary(true);
    try {
      const status = await checkCloudinaryStatus();
      setCloudinaryStatus(status);
    } catch {
      setCloudinaryStatus({
        configured: false,
        source: 'none',
        message: 'Could not contact Cloudinary diagnostic service.'
      });
    } finally {
      setIsCheckingCloudinary(false);
    }
  };

  useEffect(() => {
    refreshCloudinaryStatus();
  }, []);

  // Load initial settings from API / Local cache
  useEffect(() => {
    let mounted = true;
    const loadAll = async () => {
      setIsLoading(true);
      try {
        const [loadedSettings, loadedThemes, loadedBackups, loadedAudit] = await Promise.all([
          siteSettingsApi.getSettings(),
          siteSettingsApi.getThemePresets(),
          siteSettingsApi.getBackups(),
          siteSettingsApi.getAuditLogs()
        ]);
        if (mounted) {
          setSettings(loadedSettings || INITIAL_DEFAULT_SETTINGS);
          setThemePresets(Array.isArray(loadedThemes) ? loadedThemes : INITIAL_THEME_PRESETS);
          setBackups(Array.isArray(loadedBackups) ? loadedBackups : []);
          setAuditLogs(Array.isArray(loadedAudit) ? loadedAudit : []);
        }
      } catch (err) {
        console.error('Failed to load site settings:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    loadAll();
    return () => {
      mounted = false;
    };
  }, []);

  // Save current section to API
  const handleSaveCurrentSection = async (section: keyof FullSiteSettings) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const res = await siteSettingsApi.updateSection(section, settings[section]);
      setSaveStatus('success');
      setStatusMessage(res.message || 'Settings saved successfully.');
      // Refresh audit logs in background
      siteSettingsApi.getAuditLogs().then(setAuditLogs).catch(() => {});
      setTimeout(() => setSaveStatus('idle'), 3500);
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
      setStatusMessage('Failed to save settings. Please retry.');
      setTimeout(() => setSaveStatus('idle'), 3500);
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  };

  // Font Scale change handler
  const handleFontScaleChange = (scale: TextScaleOption) => {
    const scaleVal = scale === '87%' ? 0.875 : scale === '116%' ? 1.16 : scale === '130%' ? 1.3 : 1.0;
    const updatedAppearance = {
      ...settings.appearance,
      font_scale: scale,
      font_scale_value: scaleVal
    };
    setSettings((prev) => ({ ...prev, appearance: updatedAppearance }));
    applyAppearanceToDom(updatedAppearance);
  };

  // Direct color customizer handler
  const handleColorChange = (key: keyof typeof settings.appearance, value: any) => {
    const updatedAppearance = {
      ...settings.appearance,
      [key]: value
    };
    setSettings((prev) => ({ ...prev, appearance: updatedAppearance }));
    applyAppearanceToDom(updatedAppearance);
  };

  // Reset colors to default signature indigo
  const handleResetToDefaultTheme = () => {
    const defaultAppearance = {
      ...settings.appearance,
      active_theme: 'Ropenix Classic Indigo',
      primary_color: '#4f46e5',
      secondary_color: '#06b6d4',
      accent_color: '#f59e0b',
      background_color: '#0f172a',
      surface_color: '#1e293b',
      text_color: '#f8fafc'
    };
    setSettings((prev) => ({ ...prev, appearance: defaultAppearance }));
    applyAppearanceToDom(defaultAppearance);
  };

  // Theme activation handler
  const handleActivateTheme = async (themeId: string) => {
    try {
      const updatedAppearance = await siteSettingsApi.activateThemePreset(themeId);
      setSettings((prev) => ({ ...prev, appearance: updatedAppearance }));
      const updatedThemes = await siteSettingsApi.getThemePresets();
      setThemePresets(updatedThemes);
      const updatedLogs = await siteSettingsApi.getAuditLogs();
      setAuditLogs(updatedLogs);
      setSaveStatus('success');
      setStatusMessage(`Theme preset activated successfully.`);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setStatusMessage('Failed to activate theme preset.');
    }
  };

  // Theme schedule handler
  const handleSaveSchedule = async () => {
    if (!selectedThemeForSchedule || !scheduleStart || !scheduleEnd) return;
    try {
      await siteSettingsApi.scheduleThemePreset(
        selectedThemeForSchedule.id,
        scheduleStart,
        scheduleEnd
      );
      const updatedThemes = await siteSettingsApi.getThemePresets();
      setThemePresets(updatedThemes);
      setSelectedThemeForSchedule(null);
      setSaveStatus('success');
      setStatusMessage(`Theme schedule activated for ${selectedThemeForSchedule.name}.`);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setStatusMessage('Failed to save theme schedule.');
    }
  };

  // Create custom theme preset
  const handleCreateThemePreset = async () => {
    if (!newTheme.name) return;
    try {
      const created = await siteSettingsApi.createThemePreset(newTheme);
      setThemePresets((prev) => [...prev, created]);
      setShowNewThemeModal(false);
      setNewTheme({
        name: '',
        description: '',
        primary_color: '#4f46e5',
        secondary_color: '#06b6d4',
        accent_color: '#f59e0b',
        background_color: '#0f172a',
        surface_color: '#1e293b',
        text_color: '#f8fafc'
      });
      setSaveStatus('success');
      setStatusMessage(`Custom theme '${created.name}' created.`);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setStatusMessage('Failed to create theme.');
    }
  };

  // Test eTIMS Connection
  const handleRunETimsTest = async () => {
    setEtimsTesting(true);
    setEtimsResult(null);
    try {
      const res = await siteSettingsApi.testETimsConnection({
        kra_pin: settings.tax.kra_pin,
        client_id: settings.receipts.etims_client_id,
        client_secret: settings.receipts.etims_client_secret,
        environment: settings.receipts.etims_environment
      });
      setEtimsResult(res);
    } catch {
      setSaveStatus('error');
      setStatusMessage('eTIMS connection test failed.');
    } finally {
      setEtimsTesting(false);
    }
  };

  // Trigger manual backup
  const handleCreateBackupNow = async () => {
    setIsBackingUp(true);
    try {
      const snapshot = await siteSettingsApi.createBackup(backupNote || 'Manual admin snapshot');
      setBackups((prev) => [snapshot, ...prev]);
      setBackupNote('');
      setSaveStatus('success');
      setStatusMessage(`Backup snapshot '${snapshot.filename}' generated successfully.`);
      const updatedLogs = await siteSettingsApi.getAuditLogs();
      setAuditLogs(updatedLogs);
      setTimeout(() => setSaveStatus('idle'), 3500);
    } catch {
      setSaveStatus('error');
      setStatusMessage('Failed to generate backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Restore backup
  const handleRestoreBackup = async (id: string) => {
    setIsRestoring(true);
    try {
      const res = await siteSettingsApi.restoreBackup(id);
      setRestoreConfirmId(null);
      setSaveStatus('success');
      setStatusMessage(res.message || 'System state restored.');
      const updated = await siteSettingsApi.getSettings();
      setSettings(updated);
      const updatedLogs = await siteSettingsApi.getAuditLogs();
      setAuditLogs(updatedLogs);
      setTimeout(() => setSaveStatus('idle'), 3500);
    } catch {
      setSaveStatus('error');
      setStatusMessage('Failed to restore backup snapshot.');
    } finally {
      setIsRestoring(false);
    }
  };

  // Run Cloudinary Diagnostic Upload Test
  const handleRunCloudinaryDiagnostic = async (file: File) => {
    setCloudinaryTestError(null);
    setCloudinaryTestResult(null);

    if (!file.type.startsWith('image/')) {
      setCloudinaryTestError('Please select a valid image file (PNG, JPG, SVG, WebP, AVIF)');
      return;
    }

    setIsTestingCloudinaryUpload(true);
    try {
      const result = await uploadImageToCloudinary(file, {
        folder: 'ropenix_diagnostics',
        tags: ['diagnostic_test', 'system_check'],
      });

      if (result.success && result.url) {
        const optimized = getOptimizedCloudinaryUrl(result.url, { width: 600, quality: 'auto', format: 'auto' });
        setCloudinaryTestResult({
          url: result.url,
          secureUrl: result.secureUrl || result.url,
          isCloudinary: result.isCloudinary,
          width: result.width,
          height: result.height,
          bytes: result.bytes || file.size,
          format: result.format || file.type.split('/')[1] || 'jpg',
          optimizedUrl: optimized,
        });
      } else {
        setCloudinaryTestError(result.error || 'Diagnostic test upload failed.');
      }
    } catch (err: any) {
      setCloudinaryTestError(err.message || 'Error executing Cloudinary test upload.');
    } finally {
      setIsTestingCloudinaryUpload(false);
    }
  };

  const navTabs: { id: SettingsTab; label: string; icon: any; badge?: string }[] = [
    { id: 'general', label: 'General', icon: Building },
    { id: 'appearance', label: 'Appearance', icon: Palette, badge: settings.appearance.font_scale },
    { id: 'media', label: 'Media & CDN', icon: Cloud, badge: cloudinaryStatus.configured ? 'Cloud Active' : 'Fallback' },
    { id: 'tax', label: 'Tax & VAT', icon: Percent },
    { id: 'receipts', label: 'Receipts & eTIMS', icon: FileText, badge: 'KRA' },
    { id: 'backup', label: 'Backup & Recovery', icon: Database, badge: `${(Array.isArray(backups) ? backups : []).length}` },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'seo', label: 'SEO & Metadata', icon: Search },
    { id: 'access_control', label: 'Access Control', icon: Lock },
    { id: 'audit_logs', label: 'Audit Trail', icon: History, badge: `${(Array.isArray(auditLogs) ? auditLogs : []).length}` }
  ];

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">
          Loading Global Site Settings &amp; Schemas...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header Banner */}
      <div className="p-6 border-b border-gray-150 dark:border-gray-700 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Settings className="h-5 w-5 animate-spin-slow" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-gray-950 dark:text-white flex items-center gap-2">
              Site Settings &amp; Platform Configuration
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                DRF v2.4 Active
              </span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-light mt-0.5">
              Manage core branding, appearance scale, KRA eTIMS tax compliance, scheduled theme campaigns, automated backups, and access roles.
            </p>
          </div>
        </div>

        {/* Global Save Notice & Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {saveStatus === 'success' && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4" /> {statusMessage || 'Saved'}
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 flex items-center gap-1.5 animate-in fade-in">
              <AlertTriangle className="h-4 w-4" /> {statusMessage || 'Error'}
            </span>
          )}
          {activeTab !== 'audit_logs' && activeTab !== 'backup' && (
            <button
              type="button"
              onClick={() => handleSaveCurrentSection(activeTab as keyof FullSiteSettings)}
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer hover:scale-102"
            >
              {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>{isSaving ? 'Saving Changes...' : 'Save Section'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex overflow-x-auto border-b border-gray-150 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 px-4 scrollbar-none">
        <div className="flex gap-1 py-2">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold border border-gray-200/80 dark:border-gray-700'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-mono font-bold ${
                    isActive
                      ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="p-6">
        {/* ========================================================================= */}
        {/* TAB 1: GENERAL SETTINGS */}
        {/* ========================================================================= */}
        {activeTab === 'general' && (
          <div className="space-y-6 max-w-4xl animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Building className="h-4 w-4 text-indigo-600" />
                Store Identity &amp; Contact Details
              </h3>
              <p className="text-xs text-gray-500 font-light mt-0.5">
                Primary business identification, store name, default currency, and operational timezone.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Site &amp; Brand Name
                </label>
                <input
                  type="text"
                  value={settings.general.site_name}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      general: { ...p.general, site_name: e.target.value }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-medium text-gray-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Store Tagline / Slogan
                </label>
                <input
                  type="text"
                  value={settings.general.tagline}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      general: { ...p.general, tagline: e.target.value }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-medium text-gray-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Concierge &amp; Invoicing Email
                </label>
                <input
                  type="email"
                  value={settings.general.business_email}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      general: { ...p.general, business_email: e.target.value }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-medium text-gray-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Support Hotline / Phone
                </label>
                <input
                  type="tel"
                  value={settings.general.support_phone}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      general: { ...p.general, support_phone: e.target.value }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono text-gray-950 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Physical Dispatch Hub Address
                </label>
                <input
                  type="text"
                  value={settings.general.physical_address}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      general: { ...p.general, physical_address: e.target.value }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-medium text-gray-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Primary Base Currency
                </label>
                <select
                  value={settings.general.currency}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      general: {
                        ...p.general,
                        currency: e.target.value,
                        currency_symbol: e.target.value === 'KES' ? 'KSh' : '$'
                      }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono text-gray-950 dark:text-white"
                >
                  <option value="KES">KES - Kenyan Shilling (KSh)</option>
                  <option value="USD">USD - United States Dollar ($)</option>
                  <option value="EUR">EUR - Euro (€)</option>
                  <option value="GBP">GBP - British Pound (£)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Operational Timezone
                </label>
                <select
                  value={settings.general.timezone}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      general: { ...p.general, timezone: e.target.value }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono text-gray-950 dark:text-white"
                >
                  <option value="Africa/Nairobi">Africa/Nairobi (EAT, UTC+3)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                </select>
              </div>
            </div>

            {/* Maintenance Mode Controls */}
            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Storefront Maintenance Mode
                  </span>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-400 font-light mt-0.5">
                    When active, public visitors will see a maintenance notice while admin login remains accessible.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.general.maintenance_mode}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        general: { ...p.general, maintenance_mode: e.target.checked }
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600" />
                </label>
              </div>

              {settings.general.maintenance_mode && (
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                    Public Maintenance Notice Message
                  </label>
                  <input
                    type="text"
                    value={settings.general.maintenance_message}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        general: { ...p.general, maintenance_message: e.target.value }
                      }))
                    }
                    className="h-8 w-full rounded-lg border border-amber-300 dark:border-amber-800 px-3 text-xs bg-white dark:bg-gray-900 text-amber-950 dark:text-amber-100"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: APPEARANCE (FONT SCALE & THEME PRESETS + SCHEDULING) */}
        {/* ========================================================================= */}
        {activeTab === 'appearance' && (
          <div className="space-y-8 max-w-4xl animate-in fade-in duration-150">
            {/* 1. Font Size Accessibility Scaling */}
            <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-indigo-600" />
                    Platform Text-Size &amp; Font Scaling System
                  </h3>
                  <p className="text-xs text-gray-500 font-light mt-0.5">
                    Controls the global base font scale applied dynamically across all store pages via CSS variable <code className="font-mono text-indigo-600 dark:text-indigo-400">--font-scale</code>.
                  </p>
                </div>
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  Active: {settings.appearance.font_scale} ({settings.appearance.font_scale_value}x)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['87%', '100%', '116%', '130%'] as TextScaleOption[]).map((scale) => {
                  const isSelected = settings.appearance.font_scale === scale;
                  const labelMap: Record<string, string> = {
                    '87%': 'Small (87%)',
                    '100%': 'Default (100%)',
                    '116%': 'Large (116%)',
                    '130%': 'X-Large (130%)'
                  };
                  return (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => handleFontScaleChange(scale)}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/30 font-bold shadow-2xs'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xs block font-bold">{labelMap[scale]}</span>
                      <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                        scale: {scale === '87%' ? '0.875rem' : scale === '116%' ? '1.16rem' : scale === '130%' ? '1.30rem' : '1.00rem'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Visual Preview Box */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-gray-400 block font-bold">Typography Live Preview</span>
                  <p className="text-gray-850 dark:text-gray-100 font-sans font-medium mt-0.5">
                    "Ropenix Collections: Premium bespoke craftsmanship tailored for the modern connoisseur."
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-600">✓ Injected to :root</span>
              </div>
            </div>

            {/* 2. Theme Color Palette System & Presets */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Palette className="h-4 w-4 text-indigo-600" />
                    Theme Color Palettes &amp; Scheduled Campaigns
                  </h3>
                  <p className="text-xs text-gray-500 font-light mt-0.5">
                    Activate handcrafted theme palettes instantly or schedule them for holiday dates (e.g. Christmas Gala, Black Friday).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewThemeModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Create Custom Theme
                </button>
              </div>

              {/* Active Scheduled Theme Alert if any */}
              {settings.appearance.is_scheduled_theme_active && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-600" />
                    <span>
                      <strong>Scheduled Theme Active:</strong> <em>{settings.appearance.scheduled_theme_name}</em> is currently in effect and will automatically revert to default upon completion.
                    </span>
                  </div>
                </div>
              )}

              {/* Theme Preset Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(Array.isArray(themePresets) ? themePresets : INITIAL_THEME_PRESETS).map((preset) => {
                  const isActive = preset.is_active || (preset.is_scheduled && preset.is_currently_active);
                  return (
                    <div
                      key={preset.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                        isActive
                          ? 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/30 ring-2 ring-indigo-500/30 shadow-md'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h4 className="text-xs font-bold text-gray-950 dark:text-white flex items-center gap-1.5 truncate">
                            {preset.name}
                          </h4>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-600 text-white shrink-0">
                              ACTIVE
                            </span>
                          )}
                          {preset.is_scheduled && !isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500 text-white shrink-0">
                              SCHEDULED
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-light leading-relaxed line-clamp-2">
                          {preset.description}
                        </p>

                        {/* Color Swatch Preview Bar */}
                        <div className="mt-3 flex items-center gap-1.5 p-2 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                          <div className="h-6 flex-1 rounded-lg shadow-2xs flex items-center justify-center text-[9px] font-mono font-bold text-white" style={{ backgroundColor: preset.primary_color }} title={`Primary: ${preset.primary_color}`}>
                            P
                          </div>
                          <div className="h-6 flex-1 rounded-lg shadow-2xs flex items-center justify-center text-[9px] font-mono font-bold text-white" style={{ backgroundColor: preset.secondary_color }} title={`Secondary: ${preset.secondary_color}`}>
                            S
                          </div>
                          <div className="h-6 flex-1 rounded-lg shadow-2xs flex items-center justify-center text-[9px] font-mono font-bold text-white" style={{ backgroundColor: preset.accent_color }} title={`Accent: ${preset.accent_color}`}>
                            A
                          </div>
                          <div className="h-6 w-8 rounded-lg shadow-2xs border border-gray-400 flex items-center justify-center text-[9px] font-mono font-bold text-white" style={{ backgroundColor: preset.background_color }} title={`Bg: ${preset.background_color}`}>
                            BG
                          </div>
                        </div>

                        {/* Scheduled info if set */}
                        {preset.is_scheduled && preset.start_date && (
                          <div className="mt-2 text-[10px] font-mono text-amber-700 dark:text-amber-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(preset.start_date).toLocaleDateString()} &rarr; {preset.end_date ? new Date(preset.end_date).toLocaleDateString() : 'Indefinite'}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-gray-150 dark:border-gray-700">
                        <button
                          type="button"
                          onClick={() => handleActivateTheme(preset.id)}
                          disabled={isActive}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 cursor-default'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          {isActive ? '✓ Active Theme' : 'Activate Now'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedThemeForSchedule(preset);
                            setScheduleStart(preset.start_date ? preset.start_date.substring(0, 16) : '');
                            setScheduleEnd(preset.end_date ? preset.end_date.substring(0, 16) : '');
                          }}
                          className="px-2.5 py-1.5 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-100 cursor-pointer"
                          title="Schedule this theme for a date range"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Live Active Theme Color Customizer */}
            <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-150 dark:border-gray-700 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    Live Theme Color Customizer &amp; Palette Editor
                  </h3>
                  <p className="text-xs text-gray-500 font-light mt-0.5">
                    Customize the active theme colors in real time. Changes immediately update all primary buttons, badges, navigation highlights, and accents across the store.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetToDefaultTheme}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-250 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset to Classic Indigo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveCurrentSection('appearance')}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" /> Save Appearance Settings
                  </button>
                </div>
              </div>

              {/* Color Pickers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Primary Brand Color */}
                <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-700/80 space-y-2">
                  <label className="block text-xs font-bold text-gray-800 dark:text-gray-200">
                    Primary Brand Color (CTA &amp; Core)
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="color"
                      value={settings.appearance.primary_color || '#4f46e5'}
                      onChange={(e) => handleColorChange('primary_color', e.target.value)}
                      className="h-9 w-12 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600 p-0.5 bg-white dark:bg-gray-800"
                    />
                    <input
                      type="text"
                      value={settings.appearance.primary_color || '#4f46e5'}
                      onChange={(e) => handleColorChange('primary_color', e.target.value)}
                      className="h-9 flex-1 rounded-xl border border-gray-250 dark:border-gray-700 px-3 font-mono text-xs uppercase bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-light block">
                    Powers all primary buttons, brand logos, active tabs, and main focus rings.
                  </span>
                </div>

                {/* Secondary Accent Color */}
                <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-700/80 space-y-2">
                  <label className="block text-xs font-bold text-gray-800 dark:text-gray-200">
                    Secondary Accent Color (Electric Teal/Cyan)
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="color"
                      value={settings.appearance.secondary_color || '#06b6d4'}
                      onChange={(e) => handleColorChange('secondary_color', e.target.value)}
                      className="h-9 w-12 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600 p-0.5 bg-white dark:bg-gray-800"
                    />
                    <input
                      type="text"
                      value={settings.appearance.secondary_color || '#06b6d4'}
                      onChange={(e) => handleColorChange('secondary_color', e.target.value)}
                      className="h-9 flex-1 rounded-xl border border-gray-250 dark:border-gray-700 px-3 font-mono text-xs uppercase bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-light block">
                    Used for supplementary statistics, secondary buttons, and electric badges.
                  </span>
                </div>

                {/* Accent / Commercial CTA Color */}
                <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-700/80 space-y-2">
                  <label className="block text-xs font-bold text-gray-800 dark:text-gray-200">
                    Commercial Accent / CTA (Amber/Gold)
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="color"
                      value={settings.appearance.accent_color || '#f59e0b'}
                      onChange={(e) => handleColorChange('accent_color', e.target.value)}
                      className="h-9 w-12 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600 p-0.5 bg-white dark:bg-gray-800"
                    />
                    <input
                      type="text"
                      value={settings.appearance.accent_color || '#f59e0b'}
                      onChange={(e) => handleColorChange('accent_color', e.target.value)}
                      className="h-9 flex-1 rounded-xl border border-gray-250 dark:border-gray-700 px-3 font-mono text-xs uppercase bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-light block">
                    Used for sale ribbons, rating stars, promotional banners, and commercial CTAs.
                  </span>
                </div>

                {/* Background Tone */}
                <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-700/80 space-y-2">
                  <label className="block text-xs font-bold text-gray-800 dark:text-gray-200">
                    Background Color Tone
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="color"
                      value={settings.appearance.background_color || '#0f172a'}
                      onChange={(e) => handleColorChange('background_color', e.target.value)}
                      className="h-9 w-12 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600 p-0.5 bg-white dark:bg-gray-800"
                    />
                    <input
                      type="text"
                      value={settings.appearance.background_color || '#0f172a'}
                      onChange={(e) => handleColorChange('background_color', e.target.value)}
                      className="h-9 flex-1 rounded-xl border border-gray-250 dark:border-gray-700 px-3 font-mono text-xs uppercase bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-light block">
                    Base page backdrop tone applied for dark theme environments.
                  </span>
                </div>

                {/* Surface / Card Tone */}
                <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-700/80 space-y-2">
                  <label className="block text-xs font-bold text-gray-800 dark:text-gray-200">
                    Surface / Elevated Card Tone
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="color"
                      value={settings.appearance.surface_color || '#1e293b'}
                      onChange={(e) => handleColorChange('surface_color', e.target.value)}
                      className="h-9 w-12 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600 p-0.5 bg-white dark:bg-gray-800"
                    />
                    <input
                      type="text"
                      value={settings.appearance.surface_color || '#1e293b'}
                      onChange={(e) => handleColorChange('surface_color', e.target.value)}
                      className="h-9 flex-1 rounded-xl border border-gray-250 dark:border-gray-700 px-3 font-mono text-xs uppercase bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-light block">
                    Elevated card and modal surface base tone.
                  </span>
                </div>

                {/* Text / Foreground Tone */}
                <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-700/80 space-y-2">
                  <label className="block text-xs font-bold text-gray-800 dark:text-gray-200">
                    Text / Contrast Tone
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="color"
                      value={settings.appearance.text_color || '#f8fafc'}
                      onChange={(e) => handleColorChange('text_color', e.target.value)}
                      className="h-9 w-12 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600 p-0.5 bg-white dark:bg-gray-800"
                    />
                    <input
                      type="text"
                      value={settings.appearance.text_color || '#f8fafc'}
                      onChange={(e) => handleColorChange('text_color', e.target.value)}
                      className="h-9 flex-1 rounded-xl border border-gray-250 dark:border-gray-700 px-3 font-mono text-xs uppercase bg-white dark:bg-gray-800 text-gray-950 dark:text-white"
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-light block">
                    High contrast text for dark backdrops and primary badges.
                  </span>
                </div>
              </div>

              {/* Interactive Live Component Preview Bar */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-indigo-600" />
                    Live Component Color Response
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600 font-bold">
                    ● Real-Time DOM Binding Active
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all"
                  >
                    Primary Button CTA
                  </button>

                  <span className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200 text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                    Badge Soft Tint (Indigo-50)
                  </span>

                  <span className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold shadow-2xs">
                    Commercial Accent (Amber-500)
                  </span>

                  <div className="px-3 py-1.5 rounded-xl border-2 border-indigo-600 text-indigo-600 font-bold text-xs bg-white dark:bg-gray-800">
                    Border Accent Highlight
                  </div>
                </div>
              </div>
            </div>

            {/* Modal: Schedule Theme Window */}
            {selectedThemeForSchedule && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-5 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-3">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-indigo-600" />
                      Schedule Theme: {selectedThemeForSchedule.name}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setSelectedThemeForSchedule(null)}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 font-light">
                    This palette will automatically activate during the specified window and revert back to default once expired.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Campaign Start Date &amp; Time
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduleStart}
                        onChange={(e) => setScheduleStart(e.target.value)}
                        className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 font-mono text-gray-950 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Campaign End Date &amp; Time (Revert)
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduleEnd}
                        onChange={(e) => setScheduleEnd(e.target.value)}
                        className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 font-mono text-gray-950 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-150 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={() => setSelectedThemeForSchedule(null)}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSchedule}
                      className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Confirm Schedule
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Create Custom Theme */}
            {showNewThemeModal && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-5 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-3">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      Create Custom Theme Palette
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowNewThemeModal(false)}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Theme Preset Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Easter Spring Blossom"
                        value={newTheme.name}
                        onChange={(e) => setNewTheme((p) => ({ ...p, name: e.target.value }))}
                        className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-800 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Primary Brand Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={newTheme.primary_color}
                          onChange={(e) => setNewTheme((p) => ({ ...p, primary_color: e.target.value }))}
                          className="h-8 w-10 rounded cursor-pointer border border-gray-300"
                        />
                        <input
                          type="text"
                          value={newTheme.primary_color}
                          onChange={(e) => setNewTheme((p) => ({ ...p, primary_color: e.target.value }))}
                          className="h-8 flex-1 rounded-lg border border-gray-250 px-2 font-mono text-xs uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Secondary Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={newTheme.secondary_color}
                          onChange={(e) => setNewTheme((p) => ({ ...p, secondary_color: e.target.value }))}
                          className="h-8 w-10 rounded cursor-pointer border border-gray-300"
                        />
                        <input
                          type="text"
                          value={newTheme.secondary_color}
                          onChange={(e) => setNewTheme((p) => ({ ...p, secondary_color: e.target.value }))}
                          className="h-8 flex-1 rounded-lg border border-gray-250 px-2 font-mono text-xs uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Accent / CTA Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={newTheme.accent_color}
                          onChange={(e) => setNewTheme((p) => ({ ...p, accent_color: e.target.value }))}
                          className="h-8 w-10 rounded cursor-pointer border border-gray-300"
                        />
                        <input
                          type="text"
                          value={newTheme.accent_color}
                          onChange={(e) => setNewTheme((p) => ({ ...p, accent_color: e.target.value }))}
                          className="h-8 flex-1 rounded-lg border border-gray-250 px-2 font-mono text-xs uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Background Tone
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={newTheme.background_color}
                          onChange={(e) => setNewTheme((p) => ({ ...p, background_color: e.target.value }))}
                          className="h-8 w-10 rounded cursor-pointer border border-gray-300"
                        />
                        <input
                          type="text"
                          value={newTheme.background_color}
                          onChange={(e) => setNewTheme((p) => ({ ...p, background_color: e.target.value }))}
                          className="h-8 flex-1 rounded-lg border border-gray-250 px-2 font-mono text-xs uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-150 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={() => setShowNewThemeModal(false)}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateThemePreset}
                      disabled={!newTheme.name}
                      className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      Save Theme Preset
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MEDIA & CLOUDINARY CDN CONFIGURATION */}
        {/* ========================================================================= */}
        {activeTab === 'media' && (
          <div className="space-y-6 max-w-4xl animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Cloud className="h-4 w-4 text-cyan-500" />
                Cloudinary Media Hosting, Edge CDN &amp; Asset Delivery
              </h3>
              <p className="text-xs text-gray-500 font-light mt-0.5">
                Manage high-performance cloud asset storage, automatic next-gen AVIF/WebP image optimization, and global edge delivery.
              </p>
            </div>

            {/* Cloudinary Status Indicator Card */}
            <div className={`p-5 rounded-2xl border ${
              cloudinaryStatus.configured
                ? 'border-cyan-200 dark:border-cyan-900/60 bg-gradient-to-r from-cyan-50/60 via-white to-indigo-50/30 dark:from-cyan-950/30 dark:via-gray-900 dark:to-indigo-950/20'
                : 'border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20'
            } space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    cloudinaryStatus.configured
                      ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                      : 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  }`}>
                    <Cloud className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-950 dark:text-white">
                        Cloudinary Connection Status
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        cloudinaryStatus.configured
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}>
                        {cloudinaryStatus.configured ? '● CDN Active' : '○ Local Compression Fallback'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-light mt-0.5">
                      {cloudinaryStatus.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={refreshCloudinaryStatus}
                    disabled={isCheckingCloudinary}
                    className="px-3 py-1.5 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className={`h-3 w-3 ${isCheckingCloudinary ? 'animate-spin' : ''}`} />
                    <span>Re-check</span>
                  </button>
                  <a
                    href="https://cloudinary.com/console"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>Console</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* Status Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-200/60 dark:border-gray-800/60">
                <div className="p-3 rounded-xl bg-white/80 dark:bg-gray-800/60 border border-gray-150 dark:border-gray-700/60">
                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">
                    Cloud Name
                  </span>
                  <span className="text-xs font-bold font-mono text-gray-900 dark:text-white mt-0.5 block">
                    {cloudinaryStatus.cloudName || 'Not configured'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/80 dark:bg-gray-800/60 border border-gray-150 dark:border-gray-700/60">
                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">
                    Upload Architecture
                  </span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white mt-0.5 block">
                    {cloudinaryStatus.source === 'backend' ? 'Signed Backend Server Proxy' : cloudinaryStatus.source === 'client_preset' ? 'Client Unsigned Preset' : 'Client Canvas Fallback'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/80 dark:bg-gray-800/60 border border-gray-150 dark:border-gray-700/60">
                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">
                    Auto Format / Quality
                  </span>
                  <span className="text-xs font-bold font-mono text-cyan-600 dark:text-cyan-400 mt-0.5 block">
                    f_auto, q_auto, c_limit
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Cloudinary Upload & CDN Tester */}
            <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    Live CDN Transformation &amp; Upload Diagnostic Tester
                  </h4>
                  <p className="text-[11px] text-gray-500 font-light mt-0.5">
                    Upload a sample image to test end-to-end Cloudinary API transmission and inspect the resulting optimized WebP/AVIF CDN stream.
                  </p>
                </div>
              </div>

              <input
                type="file"
                ref={testFileInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleRunCloudinaryDiagnostic(e.target.files[0]);
                  }
                }}
              />

              <div
                onClick={() => testFileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-250 dark:border-gray-700 hover:border-cyan-500 dark:hover:border-cyan-500 rounded-xl p-6 text-center cursor-pointer transition-all bg-gray-50/40 dark:bg-gray-800/30 hover:bg-cyan-50/20 dark:hover:bg-cyan-950/20 flex flex-col items-center justify-center gap-2"
              >
                {isTestingCloudinaryUpload ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="h-6 w-6 text-cyan-500 animate-spin" />
                    <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                      Transmitting test payload to Cloudinary...
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="p-3 rounded-full bg-cyan-50 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
                      <Upload className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      Click to select a sample image file for diagnostic testing
                    </span>
                    <span className="text-[10px] text-gray-400 font-light">
                      Supports JPG, PNG, WebP, AVIF, SVG (up to 20MB)
                    </span>
                  </>
                )}
              </div>

              {cloudinaryTestError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{cloudinaryTestError}</span>
                </div>
              )}

              {cloudinaryTestResult && (
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4" />
                      Test Upload Completed Successfully
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 font-bold">
                      {cloudinaryTestResult.isCloudinary ? '☁️ Cloudinary CDN Verified' : 'Local Fallback'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 max-h-48 flex items-center justify-center p-2">
                      <img
                        src={cloudinaryTestResult.optimizedUrl || cloudinaryTestResult.url}
                        alt="Test output"
                        className="max-h-44 object-contain rounded"
                      />
                    </div>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-[10px] font-mono text-gray-400 uppercase">Dimensions:</span>
                        <p className="font-mono font-bold text-gray-900 dark:text-white">
                          {cloudinaryTestResult.width && cloudinaryTestResult.height
                            ? `${cloudinaryTestResult.width} × ${cloudinaryTestResult.height} px`
                            : 'Dynamic Vector / Responsive'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-gray-400 uppercase">Processed Size:</span>
                        <p className="font-mono font-bold text-gray-900 dark:text-white">
                          {Math.round((cloudinaryTestResult.bytes || 0) / 1024)} KB
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-gray-400 uppercase">CDN Delivery URL:</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <input
                            type="text"
                            readOnly
                            value={cloudinaryTestResult.optimizedUrl || cloudinaryTestResult.url}
                            className="h-7 w-full rounded border border-gray-250 dark:border-gray-700 px-2 text-[10px] font-mono bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 select-all"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(cloudinaryTestResult.optimizedUrl || cloudinaryTestResult.url);
                              alert('Cloudinary URL copied to clipboard!');
                            }}
                            className="h-7 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold shrink-0 cursor-pointer"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CDN Performance Architecture Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 space-y-1.5">
                <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  f_auto Format Negotiation
                </span>
                <p className="text-[11px] text-gray-500 font-light leading-relaxed">
                  Automatically delivers AVIF to Chrome/Edge and WebP to Safari/Firefox, cutting load times by up to 60%.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 space-y-1.5">
                <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                  q_auto Visual Fidelity
                </span>
                <p className="text-[11px] text-gray-500 font-light leading-relaxed">
                  Applies intelligent perceptual SSIM algorithms to eliminate invisible pixel bloat while preserving sharp product clarity.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 space-y-1.5">
                <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-500" />
                  100% Offline Resiliency
                </span>
                <p className="text-[11px] text-gray-500 font-light leading-relaxed">
                  Fallback canvas compression ensures the product catalog, checkout, and admin dashboard never fail even if credentials expire.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: TAX & VAT (KRA PIN & RATES) */}
        {/* ========================================================================= */}
        {activeTab === 'tax' && (
          <div className="space-y-6 max-w-4xl animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Percent className="h-4 w-4 text-indigo-600" />
                Taxation, VAT &amp; Kenyan Revenue Authority (KRA) Matrix
              </h3>
              <p className="text-xs text-gray-500 font-light mt-0.5">
                Configure Value Added Tax (VAT) registration, standard and reduced tax rates, and KRA PIN certification.
              </p>
            </div>

            {/* VAT Registration Status Banner */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  VAT Registration Status
                </span>
                <span className="text-[11px] text-gray-500 font-light block mt-0.5">
                  Enable when your business is officially registered for Value Added Tax under the VAT Act.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.tax.is_vat_registered}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      tax: { ...p.tax, is_vat_registered: e.target.checked }
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* KRA PIN */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                  <span>Official KRA Tax PIN <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] font-mono text-emerald-600 font-bold">11-Char Alpha-Numeric</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={11}
                    value={settings.tax.kra_pin}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        tax: { ...p.tax, kra_pin: e.target.value.toUpperCase() }
                      }))
                    }
                    placeholder="e.g. P051987654Z"
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono font-bold uppercase text-gray-950 dark:text-white"
                  />
                  <Key className="h-3.5 w-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Appears on official electronic tax invoices and eTIMS transmission packages.
                </p>
              </div>

              {/* Pricing Display Mode: Inclusive vs Exclusive */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Catalog Pricing Tax Display
                </label>
                <select
                  value={settings.tax.tax_pricing_type}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      tax: { ...p.tax, tax_pricing_type: e.target.value as 'inclusive' | 'exclusive' }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-medium text-gray-950 dark:text-white"
                >
                  <option value="inclusive">Tax-Inclusive (Displayed catalog prices include VAT)</option>
                  <option value="exclusive">Tax-Exclusive (VAT calculated and added at checkout)</option>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  Kenya standard retail mandates tax-inclusive pricing with transparent ledger receipts.
                </p>
              </div>

              {/* Standard VAT Rate */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Standard General VAT Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    max={100}
                    value={settings.tax.vat_rate}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        tax: { ...p.tax, vat_rate: Number(e.target.value) }
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono font-bold text-gray-950 dark:text-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-gray-400 font-bold">%</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Kenya standard VAT rate is 16.0%.</p>
              </div>

              {/* Reduced VAT Rate */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Reduced VAT Rate (%) (Special Commodities / Fuel)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    max={100}
                    value={settings.tax.reduced_vat_rate}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        tax: { ...p.tax, reduced_vat_rate: Number(e.target.value) }
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono font-bold text-gray-950 dark:text-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-gray-400 font-bold">%</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Standard reduced rate is 8.0%.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Tax Exemption &amp; Clearance Disclaimer
                </label>
                <input
                  type="text"
                  value={settings.tax.tax_exemption_note}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      tax: { ...p.tax, tax_exemption_note: e.target.value }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 text-gray-950 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: RECEIPTS & eTIMS ELECTRONIC INVOICING */}
        {/* ========================================================================= */}
        {activeTab === 'receipts' && (
          <div className="space-y-6 max-w-4xl animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" />
                Receipt Formatting &amp; KRA eTIMS Electronic Invoicing Integration
              </h3>
              <p className="text-xs text-gray-500 font-light mt-0.5">
                Ensure compliance with KRA's electronic invoicing system (eTIMS) requirements, automated invoice numbering patterns, and verified QR code signatures.
              </p>
            </div>

            {/* Invoicing Numbering & Business Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Invoice Number Format Template
                </label>
                <input
                  type="text"
                  value={settings.receipts.invoice_format}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      receipts: { ...p.receipts, invoice_format: e.target.value }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono font-bold text-gray-950 dark:text-white"
                />
                <p className="text-[10px] text-gray-400 mt-1">Variables: <code className="font-mono text-indigo-500">{'{YYYY}'}</code>, <code className="font-mono text-indigo-500">{'{SEQ:5}'}</code>, <code className="font-mono text-indigo-500">{'{MM}'}</code></p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Legal Registered Entity Name
                </label>
                <input
                  type="text"
                  value={settings.receipts.legal_business_name}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      receipts: { ...p.receipts, legal_business_name: e.target.value }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-medium text-gray-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Business Registration Number (BN/CPR)
                </label>
                <input
                  type="text"
                  value={settings.receipts.business_reg_number}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      receipts: { ...p.receipts, business_reg_number: e.target.value }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono text-gray-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Receipt Terms &amp; Return Policy Footer
                </label>
                <input
                  type="text"
                  value={settings.receipts.receipt_footer_text}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      receipts: { ...p.receipts, receipt_footer_text: e.target.value }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 text-gray-950 dark:text-white"
                />
              </div>
            </div>

            {/* KRA eTIMS API Integration Card */}
            <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-4">
              <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/50 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-600 text-white">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      KRA eTIMS Virtual Sales Control Unit (VSCU) Gateway
                    </h4>
                    <p className="text-[11px] text-indigo-800/80 dark:text-indigo-400 font-light">
                      Real-time cryptographic electronic fiscal invoicing and QR code generator.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.receipts.etims_enabled}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        receipts: { ...p.receipts, etims_enabled: e.target.checked }
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    eTIMS Client / Device App ID
                  </label>
                  <input
                    type="text"
                    value={settings.receipts.etims_client_id}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        receipts: { ...p.receipts, etims_client_id: e.target.value }
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono text-gray-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    eTIMS Client Secret Key
                  </label>
                  <div className="relative">
                    <input
                      type={showEtimsSecret ? 'text' : 'password'}
                      value={settings.receipts.etims_client_secret}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          receipts: { ...p.receipts, etims_client_secret: e.target.value }
                        }))
                      }
                      className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 pl-3 pr-9 text-xs bg-white dark:bg-gray-900 font-mono text-gray-950 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEtimsSecret((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showEtimsSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Gateway Environment
                  </label>
                  <select
                    value={settings.receipts.etims_environment}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        receipts: { ...p.receipts, etims_environment: e.target.value as 'sandbox' | 'production' }
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-medium text-gray-950 dark:text-white"
                  >
                    <option value="sandbox">Sandbox Test Environment</option>
                    <option value="production">Production Live VSCU Gateway</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900/60 mt-5">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    Auto-Submit Invoices to KRA
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.receipts.etims_auto_submit}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        receipts: { ...p.receipts, etims_auto_submit: e.target.checked }
                      }))
                    }
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Test eTIMS Diagnostic Trigger */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleRunETimsTest}
                  disabled={etimsTesting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Zap className={`h-3.5 w-3.5 ${etimsTesting ? 'animate-spin' : ''}`} />
                  {etimsTesting ? 'Testing eTIMS Handshake...' : 'Test eTIMS API Connection'}
                </button>

                {etimsResult && (
                  <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> {etimsResult.compliant_status} ({etimsResult.transmission_latency_ms}ms)
                  </span>
                )}
              </div>

              {/* Diagnostic Result Card */}
              {etimsResult && (
                <div className="p-3.5 rounded-xl bg-slate-900 text-white border border-slate-800 text-xs font-mono space-y-2 animate-in fade-in">
                  <div className="flex justify-between text-slate-400 text-[11px] border-b border-slate-800 pb-1.5">
                    <span>eTIMS Verification Result</span>
                    <span className="text-emerald-400 font-bold">{etimsResult.status.toUpperCase()}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">KRA PIN:</span>
                      <span className="text-white font-bold">{etimsResult.kra_pin}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Generated Invoice Reference:</span>
                      <span className="text-indigo-300 font-bold">{etimsResult.sample_invoice_number}</span>
                    </div>
                  </div>
                  <div className="pt-1 text-[10px] text-slate-400 break-all">
                    <span>QR Verification URL: </span>
                    <a href={etimsResult.qr_verification_url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                      {etimsResult.qr_verification_url}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: BACKUP & DATA RECOVERY */}
        {/* ========================================================================= */}
        {activeTab === 'backup' && (
          <div className="space-y-6 max-w-4xl animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Database className="h-4 w-4 text-indigo-600" />
                Automated Backups, Retention &amp; System Recovery Snapshots
              </h3>
              <p className="text-xs text-gray-500 font-light mt-0.5">
                Generate full system data snapshots, configure scheduled backup frequencies with retention policies, and perform one-click rollbacks.
              </p>
            </div>

            {/* Manual Backup Trigger Card */}
            <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-900 dark:text-white mb-1">
                    Manual Snapshot Notes / Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Pre-holiday promotional launch snapshot"
                    value={backupNote}
                    onChange={(e) => setBackupNote(e.target.value)}
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 text-gray-950 dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreateBackupNow}
                  disabled={isBackingUp}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50 sm:mt-5"
                >
                  <Download className={`h-4 w-4 ${isBackingUp ? 'animate-bounce' : ''}`} />
                  {isBackingUp ? 'Creating Snapshot...' : 'Backup Now'}
                </button>
              </div>

              {settings.backup.last_backup_time && (
                <p className="text-[11px] font-mono text-gray-400">
                  Last successful snapshot: {new Date(settings.backup.last_backup_time).toLocaleString()}
                </p>
              )}
            </div>

            {/* Scheduled Backup Policy Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Automated Frequency
                </label>
                <select
                  value={settings.backup.frequency}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      backup: { ...p.backup, frequency: e.target.value as any }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-medium"
                >
                  <option value="hourly">Hourly Continuous</option>
                  <option value="daily">Daily Midnight Snapshot</option>
                  <option value="weekly">Weekly Archival</option>
                  <option value="monthly">Monthly Snapshot</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Retention Window (Days)
                </label>
                <input
                  type="number"
                  min={7}
                  max={365}
                  value={settings.backup.retention_days}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      backup: { ...p.backup, retention_days: Number(e.target.value) }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono font-bold"
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 mt-5">
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  Cloud Replica Sync
                </span>
                <input
                  type="checkbox"
                  checked={settings.backup.cloud_sync_enabled}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      backup: { ...p.backup, cloud_sync_enabled: e.target.checked }
                    }))
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Backup Snapshots History Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider font-mono">
                Backup History Logs ({backups.length})
              </h4>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-mono text-[10.5px] border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="py-2.5 px-3">Filename / Notes</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Created</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 dark:divide-gray-800">
                    {(Array.isArray(backups) ? backups : []).map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-gray-900 dark:text-white block font-mono text-[11px]">{b.filename}</span>
                          <span className="text-[10px] text-gray-400 font-light block">{b.notes || 'No description'}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-gray-500 text-[11px]">
                          {(b.file_size_bytes / 1024).toFixed(1)} KB
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {b.backup_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-gray-500 text-[11px]">
                          {new Date(b.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(b));
                                const downloadAnchor = document.createElement('a');
                                downloadAnchor.setAttribute("href", dataStr);
                                downloadAnchor.setAttribute("download", b.filename);
                                document.body.appendChild(downloadAnchor);
                                downloadAnchor.click();
                                downloadAnchor.remove();
                              }}
                              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer"
                              title="Download JSON Snapshot"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRestoreConfirmId(b.id)}
                              className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[10.5px] font-bold hover:bg-amber-100 cursor-pointer flex items-center gap-1"
                              title="Rollback system to this snapshot"
                            >
                              <RotateCcw className="h-3 w-3" /> Restore
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Restore Confirmation Modal */}
            {restoreConfirmId && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-5 border border-rose-300 dark:border-rose-900 shadow-2xl space-y-3.5 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        Confirm System State Rollback?
                      </h4>
                      <p className="text-xs text-gray-500 font-light mt-0.5">
                        Restoring this snapshot will overwrite current settings with the saved snapshot values.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-150 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={() => setRestoreConfirmId(null)}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestoreBackup(restoreConfirmId)}
                      disabled={isRestoring}
                      className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {isRestoring ? 'Restoring System...' : 'Confirm Rollback'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: PAYMENTS & GATEWAYS */}
        {/* ========================================================================= */}
        {activeTab === 'payments' && (
          <div className="space-y-6 max-w-4xl animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-indigo-600" />
                Payment Gateways &amp; M-Pesa Daraja Configuration
              </h3>
              <p className="text-xs text-gray-500 font-light mt-0.5">
                Configure Safaricom M-Pesa Daraja 2.0 API credentials, Paybill / Till collection numbers, and Cash on Delivery rules.
              </p>
            </div>

            {/* M-Pesa Daraja 2.0 Card */}
            <div className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/50 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-600 text-white">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                      Safaricom M-Pesa Daraja 2.0 Express Checkout
                    </h4>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400 font-light">
                      Automated STK Push prompts and C2B payment validation.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.payments.mpesa_enabled}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        payments: { ...p.payments, mpesa_enabled: e.target.checked }
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Business Paybill / Till Number
                  </label>
                  <input
                    type="text"
                    value={settings.payments.mpesa_paybill}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        payments: { ...p.payments, mpesa_paybill: e.target.value }
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    M-Pesa Account Name / Reference
                  </label>
                  <input
                    type="text"
                    value={settings.payments.mpesa_account_name}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        payments: { ...p.payments, mpesa_account_name: e.target.value }
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Daraja Consumer Key
                  </label>
                  <input
                    type="text"
                    value={settings.payments.mpesa_consumer_key}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        payments: { ...p.payments, mpesa_consumer_key: e.target.value }
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Daraja Consumer Secret Key
                  </label>
                  <div className="relative">
                    <input
                      type={showMpesaSecret ? 'text' : 'password'}
                      value={settings.payments.mpesa_consumer_secret}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          payments: { ...p.payments, mpesa_consumer_secret: e.target.value }
                        }))
                      }
                      className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 pl-3 pr-9 text-xs bg-white dark:bg-gray-900 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMpesaSecret((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showMpesaSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Online Passkey (Lipa na M-Pesa Online)
                  </label>
                  <div className="relative">
                    <input
                      type={showMpesaPasskey ? 'text' : 'password'}
                      value={settings.payments.mpesa_passkey}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          payments: { ...p.payments, mpesa_passkey: e.target.value }
                        }))
                      }
                      className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 pl-3 pr-9 text-xs bg-white dark:bg-gray-900 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMpesaPasskey((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showMpesaPasskey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Cash on Delivery Controls */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Cash on Delivery (COD) Service
                </span>
                <span className="text-[11px] text-gray-500 font-light block mt-0.5">
                  Allow customers to pay via courier upon physical delivery inspection.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">Max Limit:</span>
                  <input
                    type="number"
                    value={settings.payments.cod_max_limit}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        payments: { ...p.payments, cod_max_limit: Number(e.target.value) }
                      }))
                    }
                    className="h-8 w-24 rounded-lg border border-gray-250 px-2 font-mono text-xs font-bold"
                  />
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.payments.cod_enabled}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        payments: { ...p.payments, cod_enabled: e.target.checked }
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: NOTIFICATIONS & SMTP */}
        {/* ========================================================================= */}
        {activeTab === 'notifications' && (
          <div className="space-y-6 max-w-4xl animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Bell className="h-4 w-4 text-indigo-600" />
                Email SMTP &amp; SMS Gateway Dispatch Notifications
              </h3>
              <p className="text-xs text-gray-500 font-light mt-0.5">
                Configure outgoing transaction receipts, dispatch SMS alerts, and operational event triggers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  SMTP Host Server
                </label>
                <input
                  type="text"
                  value={settings.notifications.smtp_host}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      notifications: { ...p.notifications, smtp_host: e.target.value }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  SMTP Port
                </label>
                <input
                  type="number"
                  value={settings.notifications.smtp_port}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      notifications: { ...p.notifications, smtp_port: Number(e.target.value) }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Sender Display Name
                </label>
                <input
                  type="text"
                  value={settings.notifications.sender_name}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      notifications: { ...p.notifications, sender_name: e.target.value }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Sender Email Address
                </label>
                <input
                  type="email"
                  value={settings.notifications.sender_email}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      notifications: { ...p.notifications, sender_email: e.target.value }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-medium"
                />
              </div>
            </div>

            {/* Event Trigger Toggles */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 space-y-3">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider font-mono">
                Automated Customer Trigger Events
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { key: 'notify_on_order_placed', label: 'Order Placement Confirmation' },
                  { key: 'notify_on_dispatched', label: 'Courier Dispatch Notice with Tracking' },
                  { key: 'notify_on_delivered', label: 'Delivery Completed Confirmation' },
                  { key: 'notify_on_refund', label: 'Refund & Credit Memo Notice' }
                ].map((item) => (
                  <label key={item.key} className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-pointer">
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={(settings.notifications as any)[item.key]}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          notifications: { ...p.notifications, [item.key]: e.target.checked }
                        }))
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 8: SEO & METADATA */}
        {/* ========================================================================= */}
        {activeTab === 'seo' && (
          <div className="space-y-6 max-w-4xl animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Search className="h-4 w-4 text-indigo-600" />
                Search Engine Optimization (SEO) &amp; Open Graph Preview
              </h3>
              <p className="text-xs text-gray-500 font-light mt-0.5">
                Manage global search engine snippets, meta descriptions, Open Graph preview assets, and Google Analytics.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Global Meta Title
                </label>
                <input
                  type="text"
                  value={settings.seo.meta_title}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      seo: { ...p.seo, meta_title: e.target.value }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Meta Description
                </label>
                <textarea
                  rows={3}
                  value={settings.seo.meta_description}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      seo: { ...p.seo, meta_description: e.target.value }
                    }))
                  }
                  className="w-full rounded-xl border border-gray-250 dark:border-gray-700 p-3 text-xs bg-white dark:bg-gray-900 text-gray-950 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Google Analytics 4 Measurement ID
                  </label>
                  <input
                    type="text"
                    placeholder="G-XXXXXXXXXX"
                    value={settings.seo.google_analytics_id}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        seo: { ...p.seo, google_analytics_id: e.target.value }
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Canonical Domain URL
                  </label>
                  <input
                    type="url"
                    value={settings.seo.canonical_base_url}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        seo: { ...p.seo, canonical_base_url: e.target.value }
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 9: ACCESS CONTROL & SECURITY */}
        {/* ========================================================================= */}
        {activeTab === 'access_control' && (
          <div className="space-y-6 max-w-4xl animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Lock className="h-4 w-4 text-indigo-600" />
                Access Control, Authentication Security &amp; Staff Roles
              </h3>
              <p className="text-xs text-gray-500 font-light mt-0.5">
                Enforce Two-Factor Authentication, configure session timeouts, restrict admin access by IP, and manage permissions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 2FA Enforcement */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-900 dark:text-white block">
                    Enforce 2FA for Staff
                  </span>
                  <span className="text-[11px] text-gray-500 font-light block mt-0.5">
                    Mandate Authenticator App TOTP verification for all admin logins.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.access_control.enforce_2fa}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        access_control: { ...p.access_control, enforce_2fa: e.target.checked }
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>

              {/* Guest Checkout Toggle */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-900 dark:text-white block">
                    Allow Guest Checkout
                  </span>
                  <span className="text-[11px] text-gray-500 font-light block mt-0.5">
                    Allow customers to place orders without creating a permanent account.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.access_control.allow_guest_checkout}
                    onChange={(e) =>
                      setSettings((p) => ({
                        ...p,
                        access_control: { ...p.access_control, allow_guest_checkout: e.target.checked }
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Admin Idle Session Timeout (Minutes)
                </label>
                <select
                  value={settings.access_control.session_timeout_minutes}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      access_control: { ...p.access_control, session_timeout_minutes: Number(e.target.value) }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono font-bold"
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={240}>240 Minutes (4 Hours)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Allowed Admin IP Whitelist
                </label>
                <input
                  type="text"
                  placeholder="e.g. 197.232.14.8, 102.215.88.0/24"
                  value={settings.access_control.allowed_ip_whitelist}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      access_control: { ...p.access_control, allowed_ip_whitelist: e.target.value }
                    }))
                  }
                  className="h-9 w-full rounded-xl border border-gray-250 dark:border-gray-700 px-3 text-xs bg-white dark:bg-gray-900 font-mono"
                />
              </div>
            </div>

            {/* Staff Role Permissions Matrix */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider font-mono">
                Staff Role &amp; Permission Matrix
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {settings.access_control.staff_roles.map((sr, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Key className="h-3.5 w-3.5 text-indigo-600" />
                        {sr.role}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        {sr.permissions.length} Scopes
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {sr.permissions.map((perm, pIdx) => (
                        <span key={pIdx} className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono font-semibold border border-indigo-200 dark:border-indigo-800">
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 10: AUDIT TRAIL LOGS */}
        {/* ========================================================================= */}
        {activeTab === 'audit_logs' && (
          <div className="space-y-4 max-w-4xl animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <History className="h-4 w-4 text-indigo-600" />
                  Site Settings Audit Trail &amp; Modification History
                </h3>
                <p className="text-xs text-gray-500 font-light mt-0.5">
                  Chronological record of who modified configuration sections, old vs new values, and source IP addresses.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const logs = await siteSettingsApi.getAuditLogs();
                  setAuditLogs(logs);
                }}
                className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh Logs
              </button>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-mono text-[10.5px] border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">User Email</th>
                    <th className="py-2.5 px-3">Section</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 dark:divide-gray-800 font-mono text-[11px]">
                  {(Array.isArray(auditLogs) ? auditLogs : []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-gray-400 font-sans">
                        No settings modifications recorded yet.
                      </td>
                    </tr>
                  ) : (
                    (Array.isArray(auditLogs) ? auditLogs : []).map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                        <td className="py-2.5 px-3 text-gray-500">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-gray-900 dark:text-white">
                          {log.user_email}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800 uppercase text-[10px]">
                            {log.section}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-3 text-gray-400 text-[10px]">
                          {log.ip_address || '127.0.0.1'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SiteSettingsPanel;

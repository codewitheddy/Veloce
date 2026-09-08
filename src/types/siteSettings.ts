/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GeneralSettings {
  site_name: string;
  tagline: string;
  business_email: string;
  support_phone: string;
  physical_address: string;
  currency: string;
  currency_symbol: string;
  timezone: string;
  maintenance_mode: boolean;
  maintenance_message: string;
}

export type TextScaleOption = '87%' | '100%' | '116%' | '130%';

export interface AppearanceSettings {
  font_scale: TextScaleOption;
  font_scale_value: number;
  active_theme: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  text_color?: string;
  dark_mode_default: boolean;
  is_scheduled_theme_active?: boolean;
  scheduled_theme_name?: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  text_color: string;
  is_active: boolean;
  is_scheduled: boolean;
  start_date?: string | null;
  end_date?: string | null;
  is_system_preset?: boolean;
  is_currently_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TaxSettings {
  is_vat_registered: boolean;
  vat_rate: number;
  reduced_vat_rate: number;
  zero_rated_enabled: boolean;
  tax_pricing_type: 'inclusive' | 'exclusive';
  kra_pin: string;
  tax_exemption_note: string;
}

export interface ReceiptsSettings {
  invoice_prefix: string;
  invoice_format: string;
  legal_business_name: string;
  business_reg_number: string;
  physical_address: string;
  contact_phone: string;
  contact_email: string;
  receipt_header_text: string;
  receipt_footer_text: string;
  etims_enabled: boolean;
  etims_client_id: string;
  etims_client_secret: string;
  etims_environment: 'sandbox' | 'production';
  etims_auto_submit: boolean;
  etims_qr_url_template: string;
}

export interface BackupSettings {
  auto_backup_enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  retention_days: number;
  include_media_files: boolean;
  cloud_sync_enabled: boolean;
  last_backup_time: string | null;
}

export interface BackupSnapshot {
  id: string;
  filename: string;
  file_size_bytes: number;
  backup_type: 'manual' | 'scheduled' | 'pre-update';
  status: 'completed' | 'in_progress' | 'failed';
  checksum?: string;
  created_by: string;
  notes?: string;
  created_at: string;
}

export interface PaymentSettings {
  mpesa_enabled: boolean;
  mpesa_environment: 'sandbox' | 'production';
  mpesa_paybill: string;
  mpesa_account_name: string;
  mpesa_account_number: string;
  mpesa_consumer_key: string;
  mpesa_consumer_secret: string;
  mpesa_passkey: string;
  card_enabled: boolean;
  card_provider: 'stripe' | 'flutterwave' | 'pesapal';
  cod_enabled: boolean;
  cod_max_limit: number;
  whatsapp_order_enabled?: boolean;
  whatsapp_number?: string;
}

export interface NotificationSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_use_tls: boolean;
  sender_name: string;
  sender_email: string;
  sms_enabled: boolean;
  sms_provider: 'africastalking' | 'twilio' | 'infobip';
  sms_sender_id: string;
  notify_on_order_placed: boolean;
  notify_on_dispatched: boolean;
  notify_on_delivered: boolean;
  notify_on_refund: boolean;
}

export interface SEOSettings {
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  og_image_url: string;
  canonical_base_url: string;
  google_analytics_id: string;
  google_tag_manager_id: string;
}

export interface StaffRolePermission {
  role: string;
  permissions: string[];
}

export interface AccessControlSettings {
  enforce_2fa: boolean;
  session_timeout_minutes: number;
  max_login_attempts: number;
  allowed_ip_whitelist: string;
  allow_guest_checkout: boolean;
  staff_roles: StaffRolePermission[];
}

export interface FullSiteSettings {
  id?: number;
  general: GeneralSettings;
  appearance: AppearanceSettings;
  tax: TaxSettings;
  receipts: ReceiptsSettings;
  backup: BackupSettings;
  payments: PaymentSettings;
  notifications: NotificationSettings;
  seo: SEOSettings;
  access_control: AccessControlSettings;
  updated_at?: string;
}

export interface SettingsAuditLog {
  id: string;
  user_email: string;
  section: string;
  action: string;
  old_state?: Record<string, any>;
  new_state?: Record<string, any>;
  changes_diff?: Record<string, { before: any; after: any }>;
  ip_address?: string;
  timestamp: string;
}

export interface ETimsDiagnosticResult {
  status: string;
  message: string;
  kra_pin: string;
  client_id: string;
  environment: string;
  sample_invoice_number: string;
  etims_signature: string;
  qr_verification_url: string;
  transmission_latency_ms: number;
  compliant_status: string;
}

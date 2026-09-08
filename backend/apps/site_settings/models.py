import json
import uuid
from django.db import models
from django.utils import timezone
from django.conf import settings

def generate_theme_id():
    return f"theme-{uuid.uuid4().hex[:8]}"

def generate_backup_id():
    return f"bkp-{uuid.uuid4().hex[:10]}"

def default_general_settings():
    return {
        "site_name": "Veloce Atelier",
        "tagline": "Luxury eCommerce & Affiliate Marketplace",
        "business_email": "concierge@veloce.co.ke",
        "support_phone": "+254 700 000 000",
        "physical_address": "Enterprise Road, Industrial Area, Nairobi, Kenya",
        "currency": "KES",
        "currency_symbol": "KSh",
        "timezone": "Africa/Nairobi",
        "maintenance_mode": False,
        "maintenance_message": "We are currently conducting scheduled upgrades. Please check back shortly."
    }

def default_appearance_settings():
    return {
        "font_scale": "100%",  # "87%", "100%", "116%", "130%"
        "font_scale_value": 1.0,
        "active_theme": "default",
        "primary_color": "#4f46e5",
        "secondary_color": "#06b6d4",
        "accent_color": "#f59e0b",
        "background_color": "#0f172a",
        "surface_color": "#1e293b",
        "dark_mode_default": True
    }

def default_tax_settings():
    return {
        "is_vat_registered": True,
        "vat_rate": 16.0,
        "reduced_vat_rate": 8.0,
        "zero_rated_enabled": True,
        "tax_pricing_type": "inclusive",  # "inclusive" or "exclusive"
        "kra_pin": "P051987654Z",
        "tax_exemption_note": "Tax Exempt certificates verified at transaction clearance"
    }

def default_receipts_settings():
    return {
        "invoice_prefix": "INV",
        "invoice_format": "INV-{YYYY}-{SEQ:5}",
        "legal_business_name": "Veloce Technologies Ltd",
        "business_reg_number": "CPR/2023/981244",
        "physical_address": "Veloce Hub, Ring Road Parklands, Westlands, Nairobi",
        "contact_phone": "+254 712 345 678",
        "contact_email": "invoicing@veloce.co.ke",
        "receipt_header_text": "Thank you for acquiring with Veloce Atelier.",
        "receipt_footer_text": "All items carry dynamic warranty certificates. Returns accepted within 14 days in original condition.",
        "etims_enabled": True,
        "etims_client_id": "ETIMS-VELOCE-LIVE-9042",
        "etims_client_secret": "sec_live_94819a8f27e6",
        "etims_environment": "sandbox",  # "sandbox" or "production"
        "etims_auto_submit": True,
        "etims_qr_url_template": "https://etims.kra.go.ke/verify?tax_pin={KRA_PIN}&inv_num={INVOICE_NUM}&amount={TOTAL}&date={DATE}"
    }

def default_backup_settings():
    return {
        "auto_backup_enabled": True,
        "frequency": "daily",  # "hourly", "daily", "weekly", "monthly"
        "retention_days": 30,
        "include_media_files": False,
        "cloud_sync_enabled": False,
        "last_backup_time": None
    }

def default_payments_settings():
    return {
        "mpesa_enabled": True,
        "mpesa_environment": "sandbox",
        "mpesa_paybill": "303030",
        "mpesa_account_name": "ROPENIX INVESTMENTS LTD",
        "mpesa_account_number": "2047728455",
        "mpesa_consumer_key": "vLc_key_live_2026",
        "mpesa_consumer_secret": "vLc_sec_99418294",
        "mpesa_passkey": "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
        "card_enabled": True,
        "card_provider": "stripe",
        "cod_enabled": True,
        "cod_max_limit": 50000
    }

def default_notifications_settings():
    return {
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "smtp_user": "notifications@veloce.co.ke",
        "smtp_use_tls": True,
        "sender_name": "Veloce Concierge",
        "sender_email": "concierge@veloce.co.ke",
        "sms_enabled": True,
        "sms_provider": "africastalking",
        "sms_sender_id": "VELOCE",
        "notify_on_order_placed": True,
        "notify_on_dispatched": True,
        "notify_on_delivered": True,
        "notify_on_refund": True
    }

def default_seo_settings():
    return {
        "meta_title": "Veloce Atelier | Premium eCommerce & Affiliate Marketplace",
        "meta_description": "Curated luxury fashion, artisan timepieces, cutting-edge technology and tailored bespoke garments in Nairobi, Kenya.",
        "meta_keywords": "luxury shopping, artisan fashion, watches, nairobi commerce, veloce, bespoke atelier",
        "og_image_url": "/src/assets/images/og_banner_default.jpg",
        "canonical_base_url": "https://veloce.co.ke",
        "google_analytics_id": "G-VELOCE2026",
        "google_tag_manager_id": "GTM-VLC9981"
    }

def default_access_control_settings():
    return {
        "enforce_2fa": False,
        "session_timeout_minutes": 60,
        "max_login_attempts": 5,
        "allowed_ip_whitelist": "",
        "allow_guest_checkout": True,
        "staff_roles": [
            {"role": "Super Admin", "permissions": ["all"]},
            {"role": "Store Manager", "permissions": ["products", "orders", "returns", "promotions", "shipping"]},
            {"role": "Fulfillment Operator", "permissions": ["orders", "shipping"]},
            {"role": "Content Editor", "permissions": ["products", "content", "hero_banners"]}
        ]
    }


class SiteSettings(models.Model):
    """
    Singleton configuration model storing partitioned site settings.
    """
    general = models.JSONField(default=default_general_settings)
    appearance = models.JSONField(default=default_appearance_settings)
    tax = models.JSONField(default=default_tax_settings)
    receipts = models.JSONField(default=default_receipts_settings)
    backup = models.JSONField(default=default_backup_settings)
    payments = models.JSONField(default=default_payments_settings)
    notifications = models.JSONField(default=default_notifications_settings)
    seo = models.JSONField(default=default_seo_settings)
    access_control = models.JSONField(default=default_access_control_settings)
    
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Site Settings'
        verbose_name_plural = 'Site Settings'

    def __str__(self):
        return f"Global Site Settings (Updated: {self.updated_at.strftime('%Y-%m-%d %H:%M')})"

    @classmethod
    def get_solo(cls):
        obj, created = cls.objects.get_or_create(id=1)
        return obj


class ThemePreset(models.Model):
    """
    Savable and schedulable theme color presets (e.g. Christmas, Black Friday).
    """
    id = models.CharField(max_length=64, primary_key=True, default=generate_theme_id)
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True, default='')
    primary_color = models.CharField(max_length=32, default='#4f46e5')
    secondary_color = models.CharField(max_length=32, default='#06b6d4')
    accent_color = models.CharField(max_length=32, default='#f59e0b')
    background_color = models.CharField(max_length=32, default='#0f172a')
    surface_color = models.CharField(max_length=32, default='#1e293b')
    text_color = models.CharField(max_length=32, default='#f8fafc')
    
    is_active = models.BooleanField(default=False)
    is_scheduled = models.BooleanField(default=False)
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    
    is_system_preset = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_active', 'name']

    def __str__(self):
        return f"{self.name} ({'Active' if self.is_active else 'Inactive'})"

    def is_currently_valid_schedule(self):
        if not self.is_scheduled or not self.start_date or not self.end_date:
            return False
        now = timezone.now()
        return self.start_date <= now <= self.end_date


class BackupSnapshot(models.Model):
    """
    Backup history snapshots.
    """
    id = models.CharField(max_length=64, primary_key=True, default=generate_backup_id)
    filename = models.CharField(max_length=255)
    file_size_bytes = models.BigIntegerField(default=0)
    backup_type = models.CharField(max_length=32, default='manual')  # 'manual', 'scheduled', 'pre-update'
    status = models.CharField(max_length=32, default='completed')  # 'completed', 'in_progress', 'failed'
    data_payload = models.JSONField(null=True, blank=True)
    checksum = models.CharField(max_length=128, blank=True, default='')
    created_by = models.CharField(max_length=150, default='system')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.filename} ({self.status}) - {self.created_at.strftime('%Y-%m-%d %H:%M')}"


class SettingsAuditLog(models.Model):
    """
    Audit log tracking who changed what in Site Settings.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_email = models.CharField(max_length=255, default='admin@veloce.co.ke')
    section = models.CharField(max_length=64)  # 'general', 'appearance', 'tax', 'receipts', etc.
    action = models.CharField(max_length=64, default='update')  # 'update', 'restore', 'theme_activate', 'backup'
    old_state = models.JSONField(null=True, blank=True)
    new_state = models.JSONField(null=True, blank=True)
    changes_diff = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M')}] {self.user_email} updated {self.section}"

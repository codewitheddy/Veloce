import uuid
from django.db import models
from django.contrib.auth.models import User

class AffiliateProfile(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('suspended', 'Suspended'),
    ]

    TIER_CHOICES = [
        ('Silver', 'Silver (10%)'),
        ('Gold', 'Gold (12%)'),
        ('Platinum', 'Platinum (15%)'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='affiliate_profiles')
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=30, blank=True, default='')
    affiliate_code = models.CharField(max_length=32, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    partner_tier = models.CharField(max_length=20, choices=TIER_CHOICES, default='Silver')
    payment_method = models.CharField(max_length=50, default='M-Pesa B2C')
    mpesa_number = models.CharField(max_length=30, blank=True, default='')
    bank_details = models.JSONField(default=dict, blank=True)
    total_earned = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    pending_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    paid_out = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    clicks_count = models.IntegerField(default=0)
    conversions_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Affiliate Profile'
        verbose_name_plural = 'Affiliate Profiles'
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['affiliate_code', 'status']),
        ]

    def __str__(self):
        return f"{self.name} ({self.affiliate_code}) - {self.partner_tier} [{self.status}]"


class CommissionEntry(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Hold'),
        ('approved', 'Approved'),
        ('paid', 'Paid Out'),
        ('voided', 'Voided'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE, related_name='commissions')
    affiliate_code = models.CharField(max_length=32, db_index=True)
    order_id = models.CharField(max_length=64, db_index=True)
    product_name = models.CharField(max_length=255, default='Veloce Store Item')
    order_total = models.DecimalField(max_digits=12, decimal_places=2)
    commission_rate_snapshot = models.CharField(max_length=50, default='10%')
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    pending_until = models.DateTimeField(null=True, blank=True)
    voided_reason = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Commission Entry'
        verbose_name_plural = 'Commission Entries'
        indexes = [
            models.Index(fields=['affiliate', 'status', '-created_at']),
            models.Index(fields=['affiliate_code', '-created_at']),
        ]


class AffiliateCampaign(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE, related_name='campaigns')
    campaign_name = models.CharField(max_length=255)
    target_url = models.URLField(max_length=1024, default='https://veloce.co.ke/')
    custom_slug = models.SlugField(max_length=100, unique=True, db_index=True)
    total_clicks = models.IntegerField(default=0)
    total_conversions = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Affiliate Campaign'
        verbose_name_plural = 'Affiliate Campaigns'

    def __str__(self):
        return f"Campaign: {self.campaign_name} ({self.custom_slug})"


class ClickLog(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    affiliate_code = models.CharField(max_length=32, db_index=True)
    campaign_slug = models.CharField(max_length=100, blank=True, default='')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')
    referrer = models.URLField(max_length=1024, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Affiliate Click Log'
        verbose_name_plural = 'Affiliate Click Logs'

    def __str__(self):
        return f"Click: {self.affiliate_code} @ {self.created_at.strftime('%Y-%m-%d %H:%M')}"


class PayoutRecord(models.Model):
    STATUS_CHOICES = [
        ('processed', 'Successfully Processed'),
        ('pending', 'Pending Transfer'),
        ('failed', 'Transfer Failed'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE, related_name='payouts')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=50, default='M-Pesa B2C')
    reference_number = models.CharField(max_length=100, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='processed')
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-processed_at']
        verbose_name = 'Payout Record'
        verbose_name_plural = 'Payout Records'

    def __str__(self):
        return f"Payout #{self.reference_number} - {self.affiliate.name} (KSh {self.amount})"

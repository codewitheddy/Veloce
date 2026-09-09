import uuid
from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    referral_code = models.CharField(max_length=32, unique=True, blank=True, null=True)
    partner_tier = models.CharField(max_length=50, default='Standard Member')
    loyalty_points = models.IntegerField(default=150)
    commission_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    is_affiliate = models.BooleanField(default=True)
    phone_number = models.CharField(max_length=30, blank=True, default='')
    avatar_url = models.URLField(max_length=1024, blank=True, default='')
    bio = models.TextField(blank=True, default='')
    address_line1 = models.CharField(max_length=255, blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='Nairobi')
    postal_code = models.CharField(max_length=20, blank=True, default='00100')
    country = models.CharField(max_length=50, default='Kenya')
    preferences = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.referral_code:
            self.referral_code = f"REF-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)


    class Meta:
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'

    def __str__(self):
        return f"{self.user.username} ({self.partner_tier})"


class LoyaltyPointsLedger(models.Model):
    TYPE_CHOICES = [
        ('earn', 'Points Earned'),
        ('redeem', 'Points Redeemed'),
        ('bonus', 'Promotional Bonus'),
        ('adjustment', 'Admin Adjustment'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='loyalty_ledger')
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='earn')
    points_amount = models.IntegerField(help_text="Positive for earned, negative for redeemed")
    description = models.CharField(max_length=255)
    order_id = models.CharField(max_length=64, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Loyalty Points Ledger Entry'
        verbose_name_plural = 'Loyalty Points Ledger Entries'

    def __str__(self):
        return f"{self.user.username}: {self.points_amount:+d} pts - {self.description}"


class UserNotification(models.Model):
    TYPE_CHOICES = [
        ('order', 'Order Status Alert'),
        ('affiliate', 'Affiliate Commission'),
        ('support', 'Support Ticket Update'),
        ('system', 'System Announcement'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='system')
    is_read = models.BooleanField(default=False)
    link_url = models.URLField(max_length=1024, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'User Notification'
        verbose_name_plural = 'User Notifications'

    def __str__(self):
        return f"Notification to {self.user.username}: {self.title} [{ 'Read' if self.is_read else 'Unread' }]"


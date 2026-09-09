from django.contrib import admin
from .models import UserProfile, LoyaltyPointsLedger, UserNotification

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'partner_tier', 'loyalty_points', 'commission_balance', 'is_affiliate', 'phone_number')
    list_filter = ('partner_tier', 'is_affiliate')
    search_fields = ('user__username', 'user__email', 'referral_code', 'phone_number')

@admin.register(LoyaltyPointsLedger)
class LoyaltyPointsLedgerAdmin(admin.ModelAdmin):
    list_display = ('user', 'transaction_type', 'points_amount', 'description', 'created_at')
    list_filter = ('transaction_type',)
    search_fields = ('user__username', 'description', 'order_id')

@admin.register(UserNotification)
class UserNotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'type', 'is_read', 'created_at')
    list_filter = ('type', 'is_read')
    search_fields = ('user__username', 'title', 'message')

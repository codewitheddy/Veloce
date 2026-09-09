from django.contrib import admin
from .models import (
    AffiliateProfile,
    CommissionEntry,
    AffiliateCampaign,
    ClickLog,
    PayoutRecord
)

@admin.register(AffiliateProfile)
class AffiliateProfileAdmin(admin.ModelAdmin):
    list_display = ('name', 'affiliate_code', 'partner_tier', 'status', 'total_earned', 'pending_balance', 'clicks_count', 'conversions_count')
    list_filter = ('status', 'partner_tier')
    search_fields = ('name', 'email', 'affiliate_code', 'phone_number')

@admin.register(CommissionEntry)
class CommissionEntryAdmin(admin.ModelAdmin):
    list_display = ('id', 'affiliate_code', 'order_id', 'order_total', 'commission_amount', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('affiliate_code', 'order_id', 'product_name')

@admin.register(AffiliateCampaign)
class AffiliateCampaignAdmin(admin.ModelAdmin):
    list_display = ('campaign_name', 'custom_slug', 'affiliate', 'total_clicks', 'total_conversions', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('campaign_name', 'custom_slug')

@admin.register(ClickLog)
class ClickLogAdmin(admin.ModelAdmin):
    list_display = ('affiliate_code', 'campaign_slug', 'ip_address', 'created_at')
    search_fields = ('affiliate_code', 'campaign_slug', 'ip_address')

@admin.register(PayoutRecord)
class PayoutRecordAdmin(admin.ModelAdmin):
    list_display = ('reference_number', 'affiliate', 'amount', 'payment_method', 'status', 'processed_at')
    list_filter = ('status', 'payment_method')
    search_fields = ('reference_number', 'affiliate__name', 'affiliate__affiliate_code')

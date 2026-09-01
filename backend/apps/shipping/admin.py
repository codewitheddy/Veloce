from django.contrib import admin
from .models import ShippingZone, ShippingMethod, HappyHourWindow, TaxRate

class ShippingMethodInline(admin.TabularInline):
    model = ShippingMethod
    extra = 1

@admin.register(ShippingZone)
class ShippingZoneAdmin(admin.ModelAdmin):
    list_display = ('name', 'min_distance_km', 'max_distance_km', 'base_fee', 'per_km_rate', 'estimated_delivery_time', 'is_active')
    list_editable = ('base_fee', 'per_km_rate', 'is_active')
    search_fields = ('name', 'description')
    inlines = [ShippingMethodInline]

@admin.register(HappyHourWindow)
class HappyHourWindowAdmin(admin.ModelAdmin):
    list_display = ('name', 'start_time', 'end_time', 'discount_percentage', 'is_active', 'created_at')
    list_editable = ('discount_percentage', 'is_active')

@admin.register(TaxRate)
class TaxRateAdmin(admin.ModelAdmin):
    list_display = ('country', 'tax_name', 'percentage', 'is_active')
    list_editable = ('percentage', 'is_active')

from django.contrib import admin
from .models import Order, OrderItem, ReturnRequest, ReturnStatusHistoryEntry

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer_name', 'customer_email', 'total', 'payment_method', 'status', 'created_at')
    list_filter = ('status', 'payment_method', 'created_at')
    search_fields = ('id', 'customer_name', 'customer_email', 'affiliate_code', 'tracking_number')
    inlines = [OrderItemInline]
    readonly_fields = ('id', 'created_at', 'updated_at')

class ReturnStatusHistoryInline(admin.TabularInline):
    model = ReturnStatusHistoryEntry
    extra = 1

@admin.register(ReturnRequest)
class ReturnRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'order_id_ref', 'customer_name', 'item_name', 'refund_amount', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('id', 'order_id_ref', 'customer_name', 'customer_email', 'tracking_number')
    inlines = [ReturnStatusHistoryInline]
    readonly_fields = ('id', 'created_at', 'updated_at')

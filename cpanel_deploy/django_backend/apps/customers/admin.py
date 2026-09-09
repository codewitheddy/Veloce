from django.contrib import admin
from .models import Customer, Deal, Invoice


class DealInline(admin.TabularInline):
    model = Deal
    extra = 0
    fields = ('title', 'value', 'stage', 'expected_close', 'created_at')
    readonly_fields = ('created_at',)


class InvoiceInline(admin.TabularInline):
    model = Invoice
    extra = 0
    fields = ('amount', 'status', 'due_date', 'issued_at')
    readonly_fields = ('issued_at',)


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'phone', 'company', 'status', 'open_deal_value_display', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('first_name', 'last_name', 'email', 'company', 'phone')
    inlines = [DealInline, InvoiceInline]

    def open_deal_value_display(self, obj):
        return f"KSh {obj.open_deal_value:,.2f}"
    open_deal_value_display.short_description = 'Open Deal Value'


@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = ('title', 'customer', 'value', 'stage', 'expected_close', 'created_at')
    list_filter = ('stage', 'created_at')
    search_fields = ('title', 'customer__first_name', 'customer__last_name', 'customer__company', 'customer__email')


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'amount', 'status', 'due_date', 'issued_at')
    list_filter = ('status', 'issued_at')
    search_fields = ('id', 'customer__first_name', 'customer__last_name', 'customer__company', 'customer__email')

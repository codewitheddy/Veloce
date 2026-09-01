from django.contrib import admin
from .models import (
    ProductCategory,
    Product,
    ProductReview,
    InventoryAuditLog,
    CustomClothingDesign
)

@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_active', 'display_order', 'created_at')
    list_editable = ('is_active', 'display_order')
    search_fields = ('name', 'description')
    prepopulated_fields = {'slug': ('name',)}

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'sku',
        'category',
        'price',
        'original_price',
        'stock',
        'stock_status',
        'status',
        'is_featured',
        'created_at'
    )
    list_filter = ('status', 'type', 'category', 'is_featured', 'track_stock')
    search_fields = ('name', 'sku', 'description', 'category', 'tags')
    list_editable = ('price', 'stock', 'status', 'is_featured')
    readonly_fields = ('id', 'created_at', 'updated_at', 'discount_display')
    ordering = ('-created_at',)
    save_on_top = True

    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'name', 'slug', 'sku', 'category', 'category_ref', 'type', 'status', 'description')
        }),
        ('Pricing & Cost', {
            'fields': ('price', 'original_price', 'cost_price', 'discount_display')
        }),
        ('Inventory & Stock', {
            'fields': ('stock', 'low_stock_threshold', 'track_stock')
        }),
        ('Digital & Variations', {
            'fields': ('variations', 'digital_file_url', 'download_limit')
        }),
        ('Media & Display Options', {
            'fields': ('image_url', 'gallery_images', 'is_featured', 'tags', 'metadata')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    actions = ['mark_as_active', 'mark_as_inactive', 'mark_as_archived']

    @admin.display(description='Discount %')
    def discount_display(self, obj):
        pct = obj.discount_percentage
        return f"{pct}% OFF" if pct > 0 else "None"

    @admin.display(description='Stock Status')
    def stock_status(self, obj):
        if not obj.is_in_stock:
            return "❌ Out of Stock"
        elif obj.is_low_stock:
            return "⚠️ Low Stock"
        return "✅ In Stock"

    @admin.action(description='Mark selected products as Active')
    def mark_as_active(self, request, queryset):
        count = queryset.update(status='Active')
        self.message_user(request, f"Successfully activated {count} product(s).")

    @admin.action(description='Mark selected products as Inactive')
    def mark_as_inactive(self, request, queryset):
        count = queryset.update(status='Inactive')
        self.message_user(request, f"Successfully deactivated {count} product(s).")

    @admin.action(description='Mark selected products as Archived')
    def mark_as_archived(self, request, queryset):
        count = queryset.update(status='Archived')
        self.message_user(request, f"Successfully archived {count} product(s).")

@admin.register(ProductReview)
class ProductReviewAdmin(admin.ModelAdmin):
    list_display = ('product', 'customer_name', 'rating', 'status', 'is_verified_purchase', 'created_at')
    list_filter = ('status', 'rating', 'is_verified_purchase')
    search_fields = ('customer_name', 'customer_email', 'comment')

@admin.register(InventoryAuditLog)
class InventoryAuditLogAdmin(admin.ModelAdmin):
    list_display = ('product_sku', 'product_name', 'previous_stock', 'new_stock', 'stock_change', 'reason', 'created_at')
    list_filter = ('reason',)
    search_fields = ('product_sku', 'product_name', 'details')

@admin.register(CustomClothingDesign)
class CustomClothingDesignAdmin(admin.ModelAdmin):
    list_display = ('customer_name', 'item_type', 'fabric_color', 'quantity', 'estimated_cost', 'status', 'created_at')
    list_filter = ('status', 'item_type')
    search_fields = ('customer_name', 'customer_email', 'custom_text')


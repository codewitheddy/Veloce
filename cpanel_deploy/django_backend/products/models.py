import uuid
from django.db import models
from django.contrib.auth.models import User


class ProductCategory(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=100, db_index=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='subcategories')
    description = models.TextField(blank=True, default='')
    image_url = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, default='Active')
    is_active = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0)
    previous_slugs = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['display_order', 'name']
        verbose_name = 'Product Category'
        verbose_name_plural = 'Product Categories'
        indexes = [
            models.Index(fields=['status', 'display_order']),
            models.Index(fields=['is_active']),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            base_slug = slugify(self.name) or f"category-{uuid.uuid4().hex[:6]}"
            candidate_slug = base_slug
            counter = 1
            while ProductCategory.objects.filter(slug=candidate_slug).exclude(id=self.id).exists():
                candidate_slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = candidate_slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Product(models.Model):
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
        ('Draft', 'Draft'),
        ('Archived', 'Archived'),
    ]

    TYPE_CHOICES = [
        ('physical', 'Physical Product'),
        ('digital', 'Digital Asset / Download'),
        ('service', 'Service / Custom Order'),
    ]

    # Primary Identifier
    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    sku = models.CharField(max_length=64, unique=True, db_index=True, help_text="Stock Keeping Unit")
    name = models.CharField(max_length=255, help_text="Product Display Name")
    slug = models.SlugField(max_length=280, blank=True, default='', help_text="URL-friendly slug")
    description = models.TextField(blank=True, default='', help_text="Detailed product description")
    category = models.CharField(max_length=100, default='General', db_index=True)
    category_ref = models.ForeignKey(ProductCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='physical')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active', db_index=True)

    # Pricing Schema
    price = models.DecimalField(max_digits=12, decimal_places=2, help_text="Current selling price in KSh")
    original_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text="MSRP or strikethrough price")
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text="Cost price for profit calculation")

    # Inventory & Stock Management
    stock = models.IntegerField(default=10, help_text="Current available inventory quantity")
    low_stock_threshold = models.IntegerField(default=5, help_text="Threshold to flag low stock warning")
    track_stock = models.BooleanField(default=True, help_text="Enforce inventory tracking on orders")

    # Rating & Engagement
    rating = models.FloatField(default=5.0)
    reviews_count = models.IntegerField(default=0)

    # Variations & Digital Delivery
    variations = models.JSONField(default=list, blank=True, help_text="List of variant options (e.g., Color, Size)")
    digital_file_url = models.URLField(max_length=1024, blank=True, default='', help_text="Secure digital file payload link")
    download_limit = models.IntegerField(default=5, help_text="Max downloads permitted per purchase")

    # Visual Assets & Metadata
    image_url = models.URLField(max_length=1024, blank=True, default='', help_text="Primary product thumbnail URL")
    gallery_images = models.JSONField(default=list, blank=True, help_text="List of additional image URLs")
    is_featured = models.BooleanField(default=False, help_text="Highlight product in storefront listings")
    tags = models.CharField(max_length=255, blank=True, default='', help_text="Comma-separated search tags")
    metadata = models.JSONField(default=dict, blank=True, help_text="Flexible JSON key-value store for extra attributes")

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Product'
        verbose_name_plural = 'Products'
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['status', 'category']),
            models.Index(fields=['status', 'price']),
            models.Index(fields=['is_featured']),
            models.Index(fields=['type']),
        ]

    def __str__(self):
        return f"{self.name} ({self.sku}) - KSh {self.price} [{self.status}]"

    @property
    def is_in_stock(self) -> bool:
        return self.stock > 0

    @property
    def is_low_stock(self) -> bool:
        return 0 < self.stock <= self.low_stock_threshold

    @property
    def discount_percentage(self) -> int:
        if self.original_price and self.original_price > self.price:
            discount = ((self.original_price - self.price) / self.original_price) * 100
            return int(round(discount))
        return 0


class ProductReview(models.Model):
    STATUS_CHOICES = [
        ('approved', 'Approved'),
        ('pending', 'Pending Approval'),
        ('rejected', 'Rejected'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviews')
    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField()
    rating = models.IntegerField(default=5)
    comment = models.TextField()
    is_verified_purchase = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='approved')
    helpful_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Product Review'
        verbose_name_plural = 'Product Reviews'
        indexes = [
            models.Index(fields=['product', 'status']),
            models.Index(fields=['rating']),
        ]

    def __str__(self):
        return f"Review ({self.rating}★) by {self.customer_name} on {self.product.name}"


class InventoryAuditLog(models.Model):
    REASON_CHOICES = [
        ('manual-update', 'Manual Adjustment'),
        ('order-placement', 'Order Sales Deduction'),
        ('restock', 'Inbound Restock'),
        ('system-init', 'System Initialization'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    product_sku = models.CharField(max_length=64, db_index=True)
    product_name = models.CharField(max_length=255)
    previous_stock = models.IntegerField()
    new_stock = models.IntegerField()
    stock_change = models.IntegerField()
    reason = models.CharField(max_length=30, choices=REASON_CHOICES, default='manual-update', db_index=True)
    details = models.TextField(blank=True, default='')
    timestamp = models.CharField(max_length=64, help_text="Human formatted timestamp")
    created_by = models.CharField(max_length=100, default='Admin Staff')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Inventory Audit Log'
        verbose_name_plural = 'Inventory Audit Logs'
        indexes = [
            models.Index(fields=['product_sku', '-created_at']),
            models.Index(fields=['reason', '-created_at']),
        ]

    def __str__(self):
        return f"Audit #{self.id[:8]} - {self.product_sku} ({self.previous_stock} -> {self.new_stock}) [{self.reason}]"


class CustomClothingDesign(models.Model):
    STATUS_CHOICES = [
        ('quote_requested', 'Quote Requested'),
        ('approved', 'Approved'),
        ('in_production', 'In Production'),
        ('shipped', 'Shipped'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='custom_designs')
    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=30, blank=True, default='')
    item_type = models.CharField(max_length=50, default='tshirt')
    fabric_color = models.CharField(max_length=50, default='Navy Blue')
    custom_text = models.CharField(max_length=255, blank=True, default='')
    text_color = models.CharField(max_length=50, default='#FFFFFF')
    print_position = models.CharField(max_length=50, default='Chest Center')
    logo_image_url = models.URLField(max_length=1024, blank=True, default='')
    quantity = models.IntegerField(default=1)
    estimated_cost = models.DecimalField(max_digits=12, decimal_places=2, default=1800.00)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='quote_requested')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Custom Clothing Design'
        verbose_name_plural = 'Custom Clothing Designs'

    def __str__(self):
        return f"Custom {self.item_type} - {self.customer_name} ({self.quantity} pcs)"

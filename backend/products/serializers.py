import uuid
from django.db.models import Q
from rest_framework import serializers
from .models import Product, ProductCategory


class ProductCategorySerializer(serializers.ModelSerializer):
    id = serializers.CharField(max_length=64, required=False)
    parentId = serializers.CharField(source='parent.id', read_only=True, allow_null=True)
    parent_id = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)
    imageUrl = serializers.CharField(source='image_url', required=False, allow_blank=True)
    displayOrder = serializers.IntegerField(source='display_order', required=False, default=0)
    previousSlugs = serializers.ListField(source='previous_slugs', child=serializers.CharField(), required=False, default=list)
    productCount = serializers.SerializerMethodField()

    class Meta:
        model = ProductCategory
        fields = [
            'id', 'name', 'slug', 'parent', 'parentId', 'parent_id', 'description',
            'image_url', 'imageUrl', 'status', 'is_active', 'display_order', 'displayOrder',
            'previous_slugs', 'previousSlugs', 'productCount', 'created_at'
        ]
        read_only_fields = ['created_at', 'productCount']

    def get_productCount(self, obj):
        return Product.objects.filter(Q(category__iexact=obj.name) | Q(category_ref=obj)).count()

    def create(self, validated_data):
        parent_id = self.initial_data.get('parentId') or self.initial_data.get('parent_id')
        if parent_id:
            try:
                validated_data['parent'] = ProductCategory.objects.get(id=parent_id)
            except ProductCategory.DoesNotExist:
                pass
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'parentId' in self.initial_data or 'parent_id' in self.initial_data:
            parent_id = self.initial_data.get('parentId') or self.initial_data.get('parent_id')
            if parent_id:
                try:
                    validated_data['parent'] = ProductCategory.objects.get(id=parent_id)
                except ProductCategory.DoesNotExist:
                    validated_data['parent'] = None
            else:
                validated_data['parent'] = None
        return super().update(instance, validated_data)

class ProductSerializer(serializers.ModelSerializer):
    price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    original_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, required=False, allow_null=True)
    cost_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, required=False, allow_null=True)
    stock = serializers.IntegerField(min_value=0, default=10)
    low_stock_threshold = serializers.IntegerField(min_value=0, default=5)
    sku = serializers.CharField(max_length=64, required=False, allow_blank=True)

    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'name', 'slug', 'description', 'category', 'type', 'status',
            'price', 'original_price', 'cost_price', 'stock', 'low_stock_threshold',
            'track_stock', 'image_url', 'gallery_images', 'is_featured', 'tags', 'metadata',
            'created_at', 'updated_at', 'is_in_stock', 'is_low_stock', 'discount_percentage'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_in_stock', 'is_low_stock', 'discount_percentage']

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Price cannot be negative.")
        return value

    def validate_cost_price(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Cost price must be greater than 0.")
        return value

    def validate_stock(self, value):
        if value < 0:
            raise serializers.ValidationError("Stock quantity cannot be negative.")
        return value

    def validate(self, attrs):
        # Auto-generate SKU if not provided or empty
        if not attrs.get('sku'):
            attrs['sku'] = f"SKU-{uuid.uuid4().hex[:8].upper()}"

        # Ensure cost_price is not greater than price warning or validation if required
        price = attrs.get('price')
        original_price = attrs.get('original_price')
        if original_price is not None and price is not None and original_price < price:
            # Strikethrough original price should ideally be greater than or equal to current selling price
            pass

        return attrs


class BulkActionSerializer(serializers.Serializer):
    product_ids = serializers.ListField(
        child=serializers.CharField(max_length=64),
        allow_empty=False,
        help_text="List of Product IDs to perform the batch action on."
    )
    action = serializers.ChoiceField(
        choices=['archive', 'delete', 'update_status'],
        help_text="Bulk action type: 'archive', 'delete', or 'update_status'."
    )
    status = serializers.ChoiceField(
        choices=['Active', 'Inactive', 'Draft', 'Archived'],
        required=False,
        help_text="New status required if action is 'update_status'."
    )

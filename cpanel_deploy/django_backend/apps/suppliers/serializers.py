from decimal import Decimal
from rest_framework import serializers
from products.models import Product
from .models import (
    Supplier,
    SupplierProduct,
    SupplierIntakeBatch,
    SupplierPayment,
    SupplierLedgerEntry,
    generate_supplier_code,
    generate_grn_code,
    generate_payment_ref
)


class SupplierProductSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_image_url = serializers.CharField(source='product.image_url', read_only=True)
    product_category = serializers.CharField(source='product.category', read_only=True)
    product_stock = serializers.IntegerField(source='product.stock', read_only=True)
    supplier_sku = serializers.CharField(required=False, allow_blank=True, default='')
    selling_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    
    remaining_stock = serializers.ReadOnlyField()
    total_cost_owed = serializers.ReadOnlyField()
    total_sales_revenue = serializers.ReadOnlyField()
    gross_profit = serializers.ReadOnlyField()
    profit_margin_percent = serializers.ReadOnlyField()

    class Meta:
        model = SupplierProduct
        fields = [
            'id',
            'supplier',
            'product',
            'product_name',
            'product_sku',
            'product_image_url',
            'product_category',
            'product_stock',
            'supplier_sku',
            'agreed_cost_price',
            'selling_price',
            'quantity_received',
            'quantity_sold',
            'remaining_stock',
            'total_cost_owed',
            'total_sales_revenue',
            'gross_profit',
            'profit_margin_percent',
            'lead_time_days',
            'is_primary_supplier',
            'created_at',
            'updated_at'
        ]

    def create(self, validated_data):
        supplier = validated_data.get('supplier')
        product = validated_data.get('product')
        if validated_data.get('selling_price') is None:
            if product and product.price:
                validated_data['selling_price'] = product.price
            else:
                cost = validated_data.get('agreed_cost_price', 0)
                validated_data['selling_price'] = Decimal(str(cost)) * Decimal('1.5')

        if supplier and product:
            existing = SupplierProduct.objects.filter(supplier=supplier, product=product).first()
            if existing:
                for key, val in validated_data.items():
                    setattr(existing, key, val)
                existing.save()
                return existing

        return super().create(validated_data)


class SupplierIntakeBatchSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_company = serializers.CharField(source='supplier.company_name', read_only=True)
    batch_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    total_cost = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)

    class Meta:
        model = SupplierIntakeBatch
        fields = [
            'id',
            'batch_number',
            'supplier',
            'supplier_name',
            'supplier_company',
            'product',
            'product_name',
            'product_sku',
            'quantity_received',
            'unit_cost',
            'total_cost',
            'received_date',
            'delivery_note_ref',
            'invoice_ref',
            'status',
            'notes',
            'received_by',
            'created_at'
        ]

    def create(self, validated_data):
        if not validated_data.get('batch_number'):
            validated_data['batch_number'] = generate_grn_code()
        if validated_data.get('total_cost') is None:
            qty = validated_data.get('quantity_received', 1)
            unit_cost = validated_data.get('unit_cost', Decimal('0.00'))
            validated_data['total_cost'] = Decimal(str(qty)) * Decimal(str(unit_cost))
        return super().create(validated_data)


class SupplierPaymentSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_company = serializers.CharField(source='supplier.company_name', read_only=True)
    payment_reference = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = SupplierPayment
        fields = [
            'id',
            'payment_reference',
            'supplier',
            'supplier_name',
            'supplier_company',
            'payment_date',
            'amount',
            'payment_method',
            'transaction_code',
            'settlement_period_start',
            'settlement_period_end',
            'allocated_batches_or_orders',
            'status',
            'receipt_attachment_url',
            'notes',
            'processed_by',
            'created_at'
        ]

    def create(self, validated_data):
        if not validated_data.get('payment_reference'):
            validated_data['payment_reference'] = generate_payment_ref()
        return super().create(validated_data)


class SupplierLedgerEntrySerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = SupplierLedgerEntry
        fields = [
            'id',
            'supplier',
            'supplier_name',
            'entry_type',
            'reference_id',
            'description',
            'debit_amount',
            'credit_amount',
            'running_balance',
            'created_at'
        ]


class SupplierSerializer(serializers.ModelSerializer):
    id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    code = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    email = serializers.EmailField(required=False, allow_blank=True, default='')

    # Dynamically aggregated financial statistics
    total_received_value = serializers.SerializerMethodField()
    total_sales_revenue = serializers.SerializerMethodField()
    total_cost_owed = serializers.SerializerMethodField()
    total_amount_paid = serializers.SerializerMethodField()
    outstanding_balance = serializers.SerializerMethodField()
    gross_profit = serializers.SerializerMethodField()
    profit_margin_percent = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    active_products_count = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = [
            'id',
            'code',
            'name',
            'company_name',
            'email',
            'phone',
            'physical_address',
            'tax_pin',
            'payment_terms',
            'bank_name',
            'bank_account_number',
            'mpesa_number',
            'mpesa_account_name',
            'status',
            'notes',
            'total_received_value',
            'total_sales_revenue',
            'total_cost_owed',
            'total_amount_paid',
            'outstanding_balance',
            'gross_profit',
            'profit_margin_percent',
            'payment_status',
            'active_products_count',
            'created_at',
            'updated_at'
        ]

    def create(self, validated_data):
        if not validated_data.get('code'):
            validated_data['code'] = generate_supplier_code()
        # Strip client-side temp id or blank id so model can assign a real UUID
        client_id = validated_data.get('id')
        if not client_id or (isinstance(client_id, str) and client_id.startswith('sup-')):
            validated_data.pop('id', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'code' in validated_data and not validated_data['code']:
            validated_data['code'] = instance.code
        if 'id' in validated_data:
            validated_data.pop('id', None)
        return super().update(instance, validated_data)

    def get_total_received_value(self, obj) -> float:
        intakes = obj.intake_batches.filter(status__in=['Received', 'Inspected'])
        return float(sum(batch.total_cost for batch in intakes))

    def get_total_sales_revenue(self, obj) -> float:
        products = obj.supplied_products.all()
        return float(sum(p.total_sales_revenue for p in products))

    def get_total_cost_owed(self, obj) -> float:
        products = obj.supplied_products.all()
        return float(sum(p.total_cost_owed for p in products))

    def get_total_amount_paid(self, obj) -> float:
        payments = obj.payments.filter(status='Completed')
        return float(sum(p.amount for p in payments))

    def get_outstanding_balance(self, obj) -> float:
        owed = self.get_total_cost_owed(obj)
        paid = self.get_total_amount_paid(obj)
        return max(0.0, float(owed - paid))

    def get_gross_profit(self, obj) -> float:
        revenue = self.get_total_sales_revenue(obj)
        cost = self.get_total_cost_owed(obj)
        return float(revenue - cost)

    def get_profit_margin_percent(self, obj) -> float:
        revenue = self.get_total_sales_revenue(obj)
        profit = self.get_gross_profit(obj)
        if revenue > 0:
            return round((profit / revenue) * 100.0, 2)
        return 0.0

    def get_payment_status(self, obj) -> str:
        balance = self.get_outstanding_balance(obj)
        paid = self.get_total_amount_paid(obj)
        owed = self.get_total_cost_owed(obj)
        
        if owed == 0 or balance <= 0.01:
            return 'Paid'
        elif paid > 0 and balance > 0:
            return 'Partially Paid'
        else:
            return 'Pending'

    def get_active_products_count(self, obj) -> int:
        return obj.supplied_products.count()


class SupplierDetailSerializer(SupplierSerializer):
    supplied_products = SupplierProductSerializer(many=True, read_only=True)
    intake_batches = SupplierIntakeBatchSerializer(many=True, read_only=True)
    payments = SupplierPaymentSerializer(many=True, read_only=True)
    ledger_entries = SupplierLedgerEntrySerializer(many=True, read_only=True)

    class Meta(SupplierSerializer.Meta):
        fields = SupplierSerializer.Meta.fields + [
            'supplied_products',
            'intake_batches',
            'payments',
            'ledger_entries'
        ]


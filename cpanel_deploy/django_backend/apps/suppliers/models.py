import uuid
from django.db import models
from django.utils import timezone


def generate_supplier_code():
    return f"SUP-{uuid.uuid4().hex[:6].upper()}"


def generate_grn_code():
    return f"GRN-{timezone.now().strftime('%Y%m')}-{uuid.uuid4().hex[:4].upper()}"


def generate_payment_ref():
    return f"SPAY-{timezone.now().strftime('%Y%m')}-{uuid.uuid4().hex[:4].upper()}"


class Supplier(models.Model):
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
        ('Suspended', 'Suspended'),
    ]

    PAYMENT_TERMS_CHOICES = [
        ('Consignment Sale', 'Consignment Sale (Pay on Sale)'),
        ('Immediate', 'Immediate / Cash on Delivery'),
        ('Net 15', 'Net 15 Days'),
        ('Net 30', 'Net 30 Days'),
        ('Bi-weekly', 'Bi-weekly Settlement'),
        ('Monthly', 'Monthly Settlement'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=64, unique=True, default=generate_supplier_code, db_index=True)
    name = models.CharField(max_length=255, help_text="Supplier or Artisan Name / Contact Person")
    company_name = models.CharField(max_length=255, blank=True, default='', help_text="Business / Legal Entity Name")
    email = models.EmailField(blank=True, default='', db_index=True)
    phone = models.CharField(max_length=50, blank=True, default='')
    physical_address = models.TextField(blank=True, default='')
    tax_pin = models.CharField(max_length=50, blank=True, default='', help_text="KRA PIN / VAT ID")
    
    payment_terms = models.CharField(max_length=50, choices=PAYMENT_TERMS_CHOICES, default='Consignment Sale')
    bank_name = models.CharField(max_length=100, blank=True, default='')
    bank_account_number = models.CharField(max_length=100, blank=True, default='')
    mpesa_number = models.CharField(max_length=50, blank=True, default='', help_text="M-PESA Paybill / Till or Phone")
    mpesa_account_name = models.CharField(max_length=100, blank=True, default='')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active', db_index=True)
    notes = models.TextField(blank=True, default='')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Supplier'
        verbose_name_plural = 'Suppliers'
        indexes = [
            models.Index(fields=['status', 'name']),
            models.Index(fields=['code']),
        ]

    def __str__(self):
        return f"{self.name} ({self.code}) - {self.company_name or 'Independent'}"


class SupplierProduct(models.Model):
    """
    Links a Product to a Supplier with agreed supplier cost, lead times, and sourcing history.
    """
    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='supplied_products')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='supplier_links')
    supplier_sku = models.CharField(max_length=64, blank=True, default='')
    
    agreed_cost_price = models.DecimalField(max_digits=12, decimal_places=2, help_text="Agreed cost per unit payable to supplier in KSh")
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Retail selling price in KSh")
    quantity_received = models.IntegerField(default=0, help_text="Cumulative units received from this supplier")
    quantity_sold = models.IntegerField(default=0, help_text="Cumulative units sold from this supplier")
    lead_time_days = models.IntegerField(default=3)
    is_primary_supplier = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('supplier', 'product')
        verbose_name = 'Supplier Product Link'
        verbose_name_plural = 'Supplier Product Links'
        indexes = [
            models.Index(fields=['supplier', 'product']),
        ]

    def __str__(self):
        return f"{self.supplier.name} -> {self.product.name} (Cost: KSh {self.agreed_cost_price})"

    @property
    def remaining_stock(self):
        return max(0, self.quantity_received - self.quantity_sold)

    @property
    def total_cost_owed(self):
        """Value owed for sold units under consignment terms"""
        return float(self.quantity_sold) * float(self.agreed_cost_price)

    @property
    def total_sales_revenue(self):
        return float(self.quantity_sold) * float(self.selling_price)

    @property
    def gross_profit(self):
        return self.total_sales_revenue - self.total_cost_owed

    @property
    def profit_margin_percent(self):
        if self.total_sales_revenue > 0:
            return (self.gross_profit / self.total_sales_revenue) * 100.0
        return 0.0


class SupplierIntakeBatch(models.Model):
    """
    Goods Received Note (GRN) tracking physical stock arriving from suppliers.
    """
    STATUS_CHOICES = [
        ('Received', 'Goods Received & Stocked'),
        ('Inspected', 'Quality Verified & Passed'),
        ('Returned', 'Partial / Full Return to Supplier'),
        ('Cancelled', 'Cancelled Batch'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    batch_number = models.CharField(max_length=64, unique=True, default=generate_grn_code, db_index=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='intake_batches')
    product = models.ForeignKey('products.Product', on_delete=models.SET_NULL, null=True, blank=True, related_name='intake_batches')
    product_name = models.CharField(max_length=255)
    product_sku = models.CharField(max_length=64, blank=True, default='')
    
    quantity_received = models.IntegerField(default=1)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2)
    
    received_date = models.DateTimeField(default=timezone.now)
    delivery_note_ref = models.CharField(max_length=100, blank=True, default='', help_text="Supplier Delivery Note #")
    invoice_ref = models.CharField(max_length=100, blank=True, default='', help_text="Supplier Invoice #")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Received')
    notes = models.TextField(blank=True, default='')
    received_by = models.CharField(max_length=100, default='Warehouse Manager')
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-received_date']
        verbose_name = 'Supplier Intake Batch'
        verbose_name_plural = 'Supplier Intake Batches'
        indexes = [
            models.Index(fields=['supplier', '-received_date']),
            models.Index(fields=['batch_number']),
        ]

    def __str__(self):
        return f"{self.batch_number} - {self.quantity_received}x {self.product_name} from {self.supplier.name}"

    def save(self, *args, **kwargs):
        if not self.total_cost:
            self.total_cost = float(self.quantity_received) * float(self.unit_cost)
        super().save(*args, **kwargs)


class SupplierPayment(models.Model):
    """
    Disbursements / settlements made to suppliers for sold goods or invoices.
    """
    PAYMENT_METHOD_CHOICES = [
        ('M-PESA', 'M-PESA Paybill / Till / Direct'),
        ('Bank Transfer', 'EFT / RTGS / Bank Wire'),
        ('Cheque', 'Corporate Bank Cheque'),
        ('Cash', 'Petty Cash Voucher'),
        ('Card', 'Debit / Credit Card'),
    ]

    STATUS_CHOICES = [
        ('Completed', 'Disbursed & Confirmed'),
        ('Pending', 'Pending Authorization'),
        ('Void', 'Void / Cancelled'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    payment_reference = models.CharField(max_length=64, unique=True, default=generate_payment_ref, db_index=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='payments')
    
    payment_date = models.DateTimeField(default=timezone.now)
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text="Amount disbursed in KSh")
    payment_method = models.CharField(max_length=50, choices=PAYMENT_METHOD_CHOICES, default='M-PESA')
    transaction_code = models.CharField(max_length=100, blank=True, default='', help_text="M-PESA confirmation or Bank Ref code")
    
    settlement_period_start = models.DateField(null=True, blank=True)
    settlement_period_end = models.DateField(null=True, blank=True)
    allocated_batches_or_orders = models.JSONField(default=list, blank=True, help_text="List of Order/GRN IDs settled")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Completed')
    receipt_attachment_url = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')
    processed_by = models.CharField(max_length=100, default='Finance Admin')
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-payment_date']
        verbose_name = 'Supplier Payment'
        verbose_name_plural = 'Supplier Payments'
        indexes = [
            models.Index(fields=['supplier', '-payment_date']),
            models.Index(fields=['payment_reference']),
            models.Index(fields=['transaction_code']),
        ]

    def __str__(self):
        return f"{self.payment_reference} - KSh {self.amount} to {self.supplier.name} ({self.status})"


class SupplierLedgerEntry(models.Model):
    """
    Immutable double-entry financial audit trail for running supplier balances.
    """
    ENTRY_TYPE_CHOICES = [
        ('STOCK_INTAKE', 'Stock Intake (GRN)'),
        ('SALE_PAYABLE', 'Product Sale (Payable Accrued)'),
        ('PAYMENT_DISBURSED', 'Supplier Payout (Balance Cleared)'),
        ('RETURN_DEBIT', 'Customer Return / Stock Return'),
        ('ADJUSTMENT', 'Manual Balance Adjustment'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='ledger_entries')
    entry_type = models.CharField(max_length=30, choices=ENTRY_TYPE_CHOICES)
    reference_id = models.CharField(max_length=64, db_index=True, help_text="Order ID, GRN ID, or SPAY ID")
    description = models.TextField()
    
    debit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Amount reducing debt (e.g. Payments)")
    credit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Amount increasing debt (e.g. Sales owed)")
    running_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Supplier Ledger Entry'
        verbose_name_plural = 'Supplier Ledger Entries'
        indexes = [
            models.Index(fields=['supplier', '-created_at']),
            models.Index(fields=['reference_id']),
            models.Index(fields=['entry_type']),
        ]

    def __str__(self):
        return f"{self.supplier.name} [{self.entry_type}]: Dr {self.debit_amount} / Cr {self.credit_amount} (Bal: {self.running_balance})"

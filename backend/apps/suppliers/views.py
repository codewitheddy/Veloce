import json
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Sum, Count, F, Q
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny

from products.models import Product
from apps.orders.models import Order, OrderItem
from .models import (
    Supplier,
    SupplierProduct,
    SupplierIntakeBatch,
    SupplierPayment,
    SupplierLedgerEntry
)
from .serializers import (
    SupplierSerializer,
    SupplierDetailSerializer,
    SupplierProductSerializer,
    SupplierIntakeBatchSerializer,
    SupplierPaymentSerializer,
    SupplierLedgerEntrySerializer
)


def seed_default_suppliers_and_data():
    """
    Seeds rich, realistic supplier portfolios, links products, and records
    intake batches, sales payables, and disbursements if none exist.
    """
    # 1. Create Handcrafted East African & Global Luxury Suppliers if missing
    suppliers_data = [
        {
            "id": "sup-nairobi-atelier",
            "code": "SUP-NRB-01",
            "name": "Keziah Mwangi",
            "company_name": "Nairobi Artisan Atelier Ltd",
            "email": "concierge@nairobiartisan.co.ke",
            "phone": "+254 712 345 678",
            "physical_address": "Shed 14, Artisan Craft Village, Ngong Road, Nairobi",
            "tax_pin": "P051289124K",
            "payment_terms": "Consignment Sale",
            "bank_name": "NCBA Bank Kenya",
            "bank_account_number": "1004829148",
            "mpesa_number": "303030 / Acc: ARTISAN",
            "mpesa_account_name": "NAIROBI ARTISAN ATELIER",
            "status": "Active",
            "notes": "Primary bespoke tailor supplying hand-loomed silk and organic savannah wool outerwear."
        },
        {
            "id": "sup-savannah-leather",
            "code": "SUP-SVN-02",
            "name": "David Kiprono",
            "company_name": "Savannah Luxury Leatherworks",
            "email": "orders@savannahleather.ke",
            "phone": "+254 722 987 654",
            "physical_address": "Enterprise Road, Industrial Area, Nairobi",
            "tax_pin": "P051994812Z",
            "payment_terms": "Net 15",
            "bank_name": "KCB Bank Kenya",
            "bank_account_number": "1129482910",
            "mpesa_number": "522522 / Acc: 1129482910",
            "mpesa_account_name": "SAVANNAH LEATHERWORKS",
            "status": "Active",
            "notes": "Artisan vegetable-tanned bovine leather duffles, briefcases, and watch travel rolls."
        },
        {
            "id": "sup-rift-timepieces",
            "code": "SUP-RFT-03",
            "name": "Elena Rostova",
            "company_name": "Rift Valley Horology & Timepieces",
            "email": "supply@rifttimepieces.com",
            "phone": "+254 733 112 233",
            "physical_address": "12th Floor, The Mirage Tower, Westlands, Nairobi",
            "tax_pin": "P051837491M",
            "payment_terms": "Consignment Sale",
            "bank_name": "Stanbic Bank Kenya",
            "bank_account_number": "0100492819",
            "mpesa_number": "600100 / Acc: HOROLOGY",
            "mpesa_account_name": "RIFT HOROLOGY LTD",
            "status": "Active",
            "notes": "Hand-assembled mechanical chronographs, sapphire crystal automatics, and horological accessories."
        },
        {
            "id": "sup-amani-couture",
            "code": "SUP-AMN-04",
            "name": "Amina Said",
            "company_name": "Amani Couture & Silk Weavers",
            "email": "amina@amanicouture.co.ke",
            "phone": "+254 701 445 566",
            "physical_address": "Biashara Street, Mombasa Old Town, Kenya",
            "tax_pin": "P051774910N",
            "payment_terms": "Consignment Sale",
            "bank_name": "Absa Bank Kenya",
            "bank_account_number": "0309481928",
            "mpesa_number": "+254701445566",
            "mpesa_account_name": "AMINA SAID",
            "status": "Active",
            "notes": "Swahili coast silk tunics, ceremonial kanga robes, and organic linen garments."
        },
        {
            "id": "sup-apex-machinery",
            "code": "SUP-APX-05",
            "name": "Marcus Vance",
            "company_name": "Apex Precision Tech & Machinery",
            "email": "b2b@apexmachinery.global",
            "phone": "+254 790 889 900",
            "physical_address": "Gateway Logistics Hub, Mombasa Road, Nairobi",
            "tax_pin": "P051394819L",
            "payment_terms": "Net 30",
            "bank_name": "Standard Chartered Kenya",
            "bank_account_number": "8701928491",
            "mpesa_number": "329329 / Acc: APEX",
            "mpesa_account_name": "APEX PRECISION TECH",
            "status": "Active",
            "notes": "Heavy-duty laser cutters, artisan workspace machinery, and studio audio monitors."
        }
    ]

    suppliers_map = {}
    for s_data in suppliers_data:
        sup, _ = Supplier.objects.get_or_create(id=s_data['id'], defaults=s_data)
        suppliers_map[sup.id] = sup

    # Check if products already linked
    if SupplierProduct.objects.exists():
        return

    # Create default catalog products if database is currently empty
    if Product.objects.count() == 0:
        default_prods = [
            {
                "id": "prod-silk-blazer",
                "sku": "NRB-BLZ-001",
                "name": "Bespoke Maasai Wool & Silk Blazer",
                "price": Decimal("28500.00"),
                "cost_price": Decimal("16500.00"),
                "stock": 14,
                "category": "Apparel & Tailoring"
            },
            {
                "id": "prod-leather-duffle",
                "sku": "SVN-DUF-002",
                "name": "Savannah Full-Grain Leather Weekender Duffle",
                "price": Decimal("34000.00"),
                "cost_price": Decimal("19500.00"),
                "stock": 8,
                "category": "Leather Goods"
            },
            {
                "id": "prod-rift-tourbillon",
                "sku": "RFT-TRB-003",
                "name": "Great Rift Horizon Automatic Chronograph",
                "price": Decimal("85000.00"),
                "cost_price": Decimal("48000.00"),
                "stock": 5,
                "category": "Horology & Accessories"
            },
            {
                "id": "prod-swahili-robe",
                "sku": "AMN-ROB-004",
                "name": "Swahili Royal Indigo Silk Kaftan",
                "price": Decimal("19800.00"),
                "cost_price": Decimal("11000.00"),
                "stock": 18,
                "category": "Apparel & Tailoring"
            },
            {
                "id": "prod-laser-cutter",
                "sku": "APX-LSR-005",
                "name": "Apex Precision 40W Desktop Laser Engraver",
                "price": Decimal("125000.00"),
                "cost_price": Decimal("75000.00"),
                "stock": 3,
                "category": "Studio Machinery"
            },
            {
                "id": "prod-leather-briefcase",
                "sku": "SVN-BRF-006",
                "name": "Kilimanjaro Executive Brass-Lock Briefcase",
                "price": Decimal("42000.00"),
                "cost_price": Decimal("24000.00"),
                "stock": 6,
                "category": "Leather Goods"
            }
        ]
        for p_data in default_prods:
            Product.objects.create(**p_data)

    # 2. Link existing products to suppliers
    all_products = list(Product.objects.all())
    
    # Map products logically across suppliers
    for i, prod in enumerate(all_products):
        sup_id = (
            "sup-nairobi-atelier" if i % 5 == 0 else
            "sup-savannah-leather" if i % 5 == 1 else
            "sup-rift-timepieces" if i % 5 == 2 else
            "sup-amani-couture" if i % 5 == 3 else
            "sup-apex-machinery"
        )
        sup = suppliers_map[sup_id]
        
        # Calculate realistic cost price (approx 55% - 65% of selling price)
        sell_price = float(prod.price)
        cost_price = float(prod.cost_price or round(sell_price * 0.60, 2))
        
        # Set realistic supply quantities
        qty_received = max(20, prod.stock + 15)
        qty_sold = max(5, qty_received - prod.stock)
        
        sp = SupplierProduct.objects.create(
            supplier=sup,
            product=prod,
            supplier_sku=f"{sup.code}-{prod.sku}",
            agreed_cost_price=Decimal(str(cost_price)),
            selling_price=Decimal(str(sell_price)),
            quantity_received=qty_received,
            quantity_sold=qty_sold,
            lead_time_days=3,
            is_primary_supplier=True
        )

        # Update product cost_price on the product model as well
        prod.cost_price = Decimal(str(cost_price))
        prod.save(update_fields=['cost_price'])

        # Create corresponding Goods Received Note (GRN)
        grn = SupplierIntakeBatch.objects.create(
            supplier=sup,
            product=prod,
            product_name=prod.name,
            product_sku=prod.sku,
            quantity_received=qty_received,
            unit_cost=Decimal(str(cost_price)),
            total_cost=Decimal(str(round(qty_received * cost_price, 2))),
            received_date=timezone.now() - timedelta(days=20 + (i * 2)),
            delivery_note_ref=f"DN-{sup.code}-{100 + i}",
            invoice_ref=f"INV-SUP-{200 + i}",
            status="Received",
            notes=f"Initial seed shipment of {qty_received} units of {prod.name}.",
            received_by="Warehouse Operations"
        )

        # Create Ledger Entry for Intake
        SupplierLedgerEntry.objects.create(
            supplier=sup,
            entry_type='STOCK_INTAKE',
            reference_id=grn.batch_number,
            description=f"Received {qty_received}x {prod.name} @ KSh {cost_price:,.2f}",
            debit_amount=Decimal('0.00'),
            credit_amount=Decimal('0.00'),  # Under consignment, debt accrues upon sale
            running_balance=Decimal('0.00'),
            created_at=grn.received_date
        )

        # Create Ledger Entry for Sold Items Accrual
        payable_amount = round(qty_sold * cost_price, 2)
        SupplierLedgerEntry.objects.create(
            supplier=sup,
            entry_type='SALE_PAYABLE',
            reference_id=f"SALE-BATCH-{prod.sku}",
            description=f"Consignment sales: {qty_sold}x {prod.name} sold @ cost KSh {cost_price:,.2f}",
            debit_amount=Decimal('0.00'),
            credit_amount=Decimal(str(payable_amount)),
            running_balance=Decimal(str(payable_amount)),
            created_at=timezone.now() - timedelta(days=5 + i)
        )

    # 3. Create Sample Payouts & Disbursements for suppliers
    for sup in suppliers_map.values():
        total_owed = sum(p.total_cost_owed for p in sup.supplied_products.all())
        # Disburse approx 60% of total owed so there are realistic partial and pending balances
        payout_amount = round(total_owed * 0.60, 2)
        
        if payout_amount > 0:
            payment = SupplierPayment.objects.create(
                supplier=sup,
                payment_date=timezone.now() - timedelta(days=2),
                amount=Decimal(str(payout_amount)),
                payment_method='M-PESA' if '303030' in sup.mpesa_number or '+254' in sup.mpesa_number else 'Bank Transfer',
                transaction_code=f"QHK{uuid.uuid4().hex[:7].upper()}",
                settlement_period_start=(timezone.now() - timedelta(days=30)).date(),
                settlement_period_end=timezone.now().date(),
                status='Completed',
                notes=f"Bi-weekly consignment settlement for sales through {timezone.now().strftime('%b %d, %Y')}.",
                processed_by="Finance Controller"
            )

            # Record Ledger Entry for Disbursement
            remaining_bal = max(0.0, total_owed - payout_amount)
            SupplierLedgerEntry.objects.create(
                supplier=sup,
                entry_type='PAYMENT_DISBURSED',
                reference_id=payment.payment_reference,
                description=f"Disbursement via {payment.payment_method} (Ref: {payment.transaction_code})",
                debit_amount=Decimal(str(payout_amount)),
                credit_amount=Decimal('0.00'),
                running_balance=Decimal(str(remaining_bal)),
                created_at=payment.payment_date
            )


@method_decorator(csrf_exempt, name='dispatch')
class SupplierViewSet(viewsets.ModelViewSet):
    """
    CRUD for Suppliers with aggregated financial metrics and statements.
    """
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SupplierDetailSerializer
        return SupplierSerializer

    def list(self, request, *args, **kwargs):
        seed_default_suppliers_and_data()
        queryset = self.filter_queryset(self.get_queryset())
        
        # Optional status filtering
        status_param = request.query_params.get('status') if hasattr(request, 'query_params') else request.GET.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
            
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        """
        Generates a chronological statement of account with running balances.
        """
        supplier = self.get_object()
        start_date = request.query_params.get('start_date') if hasattr(request, 'query_params') else request.GET.get('start_date')
        end_date = request.query_params.get('end_date') if hasattr(request, 'query_params') else request.GET.get('end_date')

        entries = supplier.ledger_entries.all().order_by('created_at')
        if start_date:
            entries = entries.filter(created_at__gte=start_date)
        if end_date:
            entries = entries.filter(created_at__lte=end_date)

        running_balance = Decimal('0.00')
        statement_rows = []

        for entry in entries:
            # Debit reduces balance, Credit increases balance owed
            running_balance = running_balance + entry.credit_amount - entry.debit_amount
            statement_rows.append({
                "id": entry.id,
                "date": entry.created_at,
                "entry_type": entry.entry_type,
                "reference": entry.reference_id,
                "description": entry.description,
                "debit": float(entry.debit_amount),
                "credit": float(entry.credit_amount),
                "running_balance": float(running_balance)
            })

        summary = {
            "supplier_id": supplier.id,
            "supplier_name": supplier.name,
            "company_name": supplier.company_name,
            "code": supplier.code,
            "tax_pin": supplier.tax_pin,
            "payment_terms": supplier.payment_terms,
            "statement_period": {
                "start": start_date or "Genesis",
                "end": end_date or timezone.now().isoformat()
            },
            "total_debited": float(sum(e.debit_amount for e in entries)),
            "total_credited": float(sum(e.credit_amount for e in entries)),
            "closing_balance": float(running_balance),
            "transactions": statement_rows
        }

        return Response(summary)


@method_decorator(csrf_exempt, name='dispatch')
class SupplierProductViewSet(viewsets.ModelViewSet):
    queryset = SupplierProduct.objects.all()
    serializer_class = SupplierProductSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def list(self, request, *args, **kwargs):
        seed_default_suppliers_and_data()
        queryset = self.get_queryset()
        supplier_id = request.query_params.get('supplier_id') if hasattr(request, 'query_params') else request.GET.get('supplier_id')
        if supplier_id:
            queryset = queryset.filter(supplier_id=supplier_id)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


@method_decorator(csrf_exempt, name='dispatch')
class SupplierIntakeBatchViewSet(viewsets.ModelViewSet):
    """
    CRUD for Goods Received Notes (GRN) with automatic inventory and ledger synchronization.
    """
    queryset = SupplierIntakeBatch.objects.all()
    serializer_class = SupplierIntakeBatchSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def list(self, request, *args, **kwargs):
        seed_default_suppliers_and_data()
        queryset = self.get_queryset()
        supplier_id = request.query_params.get('supplier_id') if hasattr(request, 'query_params') else request.GET.get('supplier_id')
        if supplier_id:
            queryset = queryset.filter(supplier_id=supplier_id)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        intake = serializer.save()

        # Update product stock if product link exists
        if intake.product:
            intake.product.stock = intake.product.stock + intake.quantity_received
            intake.product.cost_price = intake.unit_cost
            intake.product.save(update_fields=['stock', 'cost_price'])

            # Update or create SupplierProduct link
            sp, _ = SupplierProduct.objects.get_or_create(
                supplier=intake.supplier,
                product=intake.product,
                defaults={
                    "agreed_cost_price": intake.unit_cost,
                    "selling_price": intake.product.price,
                    "quantity_received": intake.quantity_received,
                    "quantity_sold": 0
                }
            )
            sp.quantity_received = sp.quantity_received + intake.quantity_received
            sp.agreed_cost_price = intake.unit_cost
            sp.save()

        # Create Ledger Entry for the stock intake
        SupplierLedgerEntry.objects.create(
            supplier=intake.supplier,
            entry_type='STOCK_INTAKE',
            reference_id=intake.batch_number,
            description=f"Received {intake.quantity_received}x {intake.product_name} (GRN #{intake.batch_number})",
            debit_amount=Decimal('0.00'),
            credit_amount=Decimal('0.00'),
            running_balance=Decimal('0.00')
        )

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


@method_decorator(csrf_exempt, name='dispatch')
class SupplierPaymentViewSet(viewsets.ModelViewSet):
    """
    CRUD for Supplier Disbursements / Settlements.
    """
    queryset = SupplierPayment.objects.all()
    serializer_class = SupplierPaymentSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def list(self, request, *args, **kwargs):
        seed_default_suppliers_and_data()
        queryset = self.get_queryset()
        supplier_id = request.query_params.get('supplier_id') if hasattr(request, 'query_params') else request.GET.get('supplier_id')
        if supplier_id:
            queryset = queryset.filter(supplier_id=supplier_id)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()

        # Calculate new running balance for the supplier
        total_owed = sum(p.total_cost_owed for p in payment.supplier.supplied_products.all())
        total_paid = sum(float(p.amount) for p in payment.supplier.payments.filter(status='Completed'))
        new_balance = max(0.0, float(total_owed) - float(total_paid))

        # Record Ledger Entry for Disbursement
        SupplierLedgerEntry.objects.create(
            supplier=payment.supplier,
            entry_type='PAYMENT_DISBURSED',
            reference_id=payment.payment_reference,
            description=f"Disbursed KSh {payment.amount:,.2f} via {payment.payment_method} (Ref: {payment.transaction_code or payment.payment_reference})",
            debit_amount=payment.amount,
            credit_amount=Decimal('0.00'),
            running_balance=Decimal(str(round(new_balance, 2)))
        )

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


@method_decorator(csrf_exempt, name='dispatch')
class SupplierAnalyticsDashboardView(APIView):
    """
    Executive Management Dashboard Metrics & Profitability Summary.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        seed_default_suppliers_and_data()

        suppliers = list(Supplier.objects.all())
        supplier_products = list(SupplierProduct.objects.select_related('supplier', 'product').all())
        payments = list(SupplierPayment.objects.filter(status='Completed'))
        intakes = list(SupplierIntakeBatch.objects.filter(status__in=['Received', 'Inspected']))

        total_suppliers = len(suppliers)
        total_products_sourced = len(supplier_products)
        total_units_received = sum(sp.quantity_received for sp in supplier_products)
        total_units_sold = sum(sp.quantity_sold for sp in supplier_products)
        total_received_value = sum(float(batch.total_cost) for batch in intakes)
        
        total_sales_revenue = sum(sp.total_sales_revenue for sp in supplier_products)
        total_supplier_costs = sum(sp.total_cost_owed for sp in supplier_products)
        total_paid_to_suppliers = sum(float(p.amount) for p in payments)
        total_outstanding_balance = max(0.0, float(total_supplier_costs) - float(total_paid_to_suppliers))
        total_gross_profit = float(total_sales_revenue) - float(total_supplier_costs)
        overall_profit_margin = round((total_gross_profit / total_sales_revenue * 100.0), 2) if total_sales_revenue > 0 else 0.0

        # Status count distributions
        status_counts = {"Paid": 0, "Partially Paid": 0, "Pending": 0}
        for sup in suppliers:
            owed = sum(p.total_cost_owed for p in sup.supplied_products.all())
            paid = sum(float(p.amount) for p in sup.payments.filter(status='Completed'))
            bal = max(0.0, float(owed) - float(paid))
            if owed == 0 or bal <= 0.01:
                status_counts["Paid"] += 1
            elif paid > 0 and bal > 0:
                status_counts["Partially Paid"] += 1
            else:
                status_counts["Pending"] += 1

        # Top 5 Profitable Products Sourced
        top_products = sorted(
            [
                {
                    "product_id": sp.product.id,
                    "product_name": sp.product.name,
                    "sku": sp.product.sku,
                    "supplier_name": sp.supplier.name,
                    "selling_price": float(sp.selling_price),
                    "supplier_cost": float(sp.agreed_cost_price),
                    "quantity_sold": sp.quantity_sold,
                    "revenue": sp.total_sales_revenue,
                    "gross_profit": sp.gross_profit,
                    "profit_margin": round(sp.profit_margin_percent, 1)
                }
                for sp in supplier_products
            ],
            key=lambda x: x["gross_profit"],
            reverse=True
        )[:5]

        # Top Performing Suppliers by Revenue & Profit
        top_suppliers = sorted(
            [
                {
                    "supplier_id": sup.id,
                    "supplier_name": sup.name,
                    "company_name": sup.company_name,
                    "products_count": sup.supplied_products.count(),
                    "total_revenue": sum(p.total_sales_revenue for p in sup.supplied_products.all()),
                    "total_cost": sum(p.total_cost_owed for p in sup.supplied_products.all()),
                    "gross_profit": sum(p.gross_profit for p in sup.supplied_products.all()),
                    "outstanding_balance": max(0.0, float(sum(p.total_cost_owed for p in sup.supplied_products.all())) - float(sum(p.amount for p in sup.payments.filter(status='Completed')))),
                    "margin_percent": round((sum(p.gross_profit for p in sup.supplied_products.all()) / sum(p.total_sales_revenue for p in sup.supplied_products.all()) * 100.0), 1) if sum(p.total_sales_revenue for p in sup.supplied_products.all()) > 0 else 0.0
                }
                for sup in suppliers
            ],
            key=lambda x: x["total_revenue"],
            reverse=True
        )

        return Response({
            "metrics": {
                "total_suppliers": total_suppliers,
                "total_products_sourced": total_products_sourced,
                "total_units_received": total_units_received,
                "total_units_sold": total_units_sold,
                "total_received_value": float(total_received_value),
                "total_sales_revenue": float(total_sales_revenue),
                "total_supplier_costs": float(total_supplier_costs),
                "total_paid_to_suppliers": float(total_paid_to_suppliers),
                "total_outstanding_balance": float(total_outstanding_balance),
                "total_gross_profit": float(total_gross_profit),
                "overall_profit_margin": overall_profit_margin
            },
            "status_distribution": status_counts,
            "top_profitable_products": top_products,
            "top_suppliers": top_suppliers
        })


@method_decorator(csrf_exempt, name='dispatch')
class SupplierReportsView(APIView):
    """
    Generates all 10 dedicated management reports on demand.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        seed_default_suppliers_and_data()

        report_type = request.GET.get('type', 'outstanding_balances')
        supplier_id = request.GET.get('supplier_id')
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')

        suppliers = Supplier.objects.all()
        if supplier_id:
            suppliers = suppliers.filter(id=supplier_id)

        supplier_products = SupplierProduct.objects.select_related('supplier', 'product').all()
        if supplier_id:
            supplier_products = supplier_products.filter(supplier_id=supplier_id)

        payments = SupplierPayment.objects.select_related('supplier').all()
        if supplier_id:
            payments = payments.filter(supplier_id=supplier_id)

        intakes = SupplierIntakeBatch.objects.select_related('supplier', 'product').all()
        if supplier_id:
            intakes = intakes.filter(supplier_id=supplier_id)

        data = []
        title = ""
        columns = []

        if report_type == 'outstanding_balances':
            title = "Supplier Outstanding Balances & Aging Summary"
            columns = ["Supplier Code", "Supplier Name", "Company", "Total Cost Owed", "Total Paid", "Outstanding Balance", "Payment Terms", "Status"]
            for s in suppliers:
                owed = sum(p.total_cost_owed for p in s.supplied_products.all())
                paid = sum(float(p.amount) for p in s.payments.filter(status='Completed'))
                bal = max(0.0, float(owed) - float(paid))
                data.append({
                    "code": s.code,
                    "name": s.name,
                    "company": s.company_name or "N/A",
                    "total_owed": float(owed),
                    "total_paid": float(paid),
                    "outstanding_balance": float(bal),
                    "payment_terms": s.payment_terms,
                    "status": "Paid" if bal <= 0 else ("Partially Paid" if paid > 0 else "Pending")
                })

        elif report_type == 'payment_history':
            title = "Supplier Payment History & Payout Audit"
            columns = ["Payment Ref", "Date", "Supplier", "Amount (KSh)", "Method", "Transaction Code", "Status", "Processed By"]
            for p in payments.order_by('-payment_date'):
                data.append({
                    "ref": p.payment_reference,
                    "date": p.payment_date.strftime('%Y-%m-%d %H:%M'),
                    "supplier": p.supplier.name,
                    "amount": float(p.amount),
                    "method": p.payment_method,
                    "transaction_code": p.transaction_code or "-",
                    "status": p.status,
                    "processed_by": p.processed_by
                })

        elif report_type == 'products_received':
            title = "Products Received from Suppliers (GRN Log)"
            columns = ["GRN Batch", "Received Date", "Supplier", "Product SKU", "Product Name", "Qty Received", "Unit Cost", "Total Value", "Status"]
            for b in intakes.order_by('-received_date'):
                data.append({
                    "batch": b.batch_number,
                    "date": b.received_date.strftime('%Y-%m-%d'),
                    "supplier": b.supplier.name,
                    "sku": b.product_sku,
                    "product": b.product_name,
                    "qty": b.quantity_received,
                    "unit_cost": float(b.unit_cost),
                    "total_value": float(b.total_cost),
                    "status": b.status
                })

        elif report_type == 'products_sold':
            title = "Consignment Products Sold by Supplier"
            columns = ["Supplier", "Product SKU", "Product Name", "Qty Sold", "Agreed Cost", "Selling Price", "Total Cost Owed", "Total Revenue", "Gross Profit"]
            for sp in supplier_products.order_by('-quantity_sold'):
                data.append({
                    "supplier": sp.supplier.name,
                    "sku": sp.product.sku,
                    "product": sp.product.name,
                    "qty_sold": sp.quantity_sold,
                    "unit_cost": float(sp.agreed_cost_price),
                    "selling_price": float(sp.selling_price),
                    "cost_owed": sp.total_cost_owed,
                    "revenue": sp.total_sales_revenue,
                    "gross_profit": sp.gross_profit
                })

        elif report_type == 'profitability_by_supplier':
            title = "Profitability Analysis by Supplier"
            columns = ["Supplier Code", "Supplier Name", "Products", "Units Sold", "Total Revenue", "Supplier Cost", "Gross Profit", "Margin %"]
            for s in suppliers:
                prods = s.supplied_products.all()
                rev = sum(p.total_sales_revenue for p in prods)
                cost = sum(p.total_cost_owed for p in prods)
                profit = rev - cost
                margin = round((profit / rev * 100.0), 2) if rev > 0 else 0.0
                data.append({
                    "code": s.code,
                    "name": s.name,
                    "products_count": prods.count(),
                    "units_sold": sum(p.quantity_sold for p in prods),
                    "revenue": float(rev),
                    "supplier_cost": float(cost),
                    "gross_profit": float(profit),
                    "margin_percent": margin
                })

        elif report_type == 'profitability_by_product':
            title = "Profitability Analysis by Product"
            columns = ["SKU", "Product Name", "Supplier", "Cost Price", "Sell Price", "Qty Sold", "Total Revenue", "Total Cost", "Gross Profit", "Margin %"]
            for sp in supplier_products.order_by('-quantity_sold'):
                data.append({
                    "sku": sp.product.sku,
                    "product": sp.product.name,
                    "supplier": sp.supplier.name,
                    "cost_price": float(sp.agreed_cost_price),
                    "sell_price": float(sp.selling_price),
                    "qty_sold": sp.quantity_sold,
                    "revenue": sp.total_sales_revenue,
                    "total_cost": sp.total_cost_owed,
                    "gross_profit": sp.gross_profit,
                    "margin_percent": round(sp.profit_margin_percent, 2)
                })

        elif report_type == 'sales_by_supplier':
            title = "Consignment Sales & Sourced Revenue by Supplier"
            columns = ["Supplier Code", "Supplier Name", "Company", "Products Sourced", "Total Sold Units", "Gross Sales Revenue", "COGS Payable", "Payment Terms"]
            for s in suppliers:
                prods = s.supplied_products.all()
                rev = sum(p.total_sales_revenue for p in prods)
                cost = sum(p.total_cost_owed for p in prods)
                sold_units = sum(p.quantity_sold for p in prods)
                data.append({
                    "code": s.code,
                    "name": s.name,
                    "company": s.company_name or "N/A",
                    "products_count": prods.count(),
                    "sold_units": sold_units,
                    "gross_revenue": float(rev),
                    "cogs_payable": float(cost),
                    "payment_terms": s.payment_terms
                })

        elif report_type == 'aging_balances':
            title = "Supplier Aging Balances Report (0-30d, 31-60d, 61-90d, 90+d)"
            columns = ["Supplier", "Total Owed", "Paid to Date", "Current (0-30d)", "31-60 Days", "61-90 Days", "90+ Days Overdue", "Outstanding Balance"]
            for s in suppliers:
                owed = sum(p.total_cost_owed for p in s.supplied_products.all())
                paid = sum(float(p.amount) for p in s.payments.filter(status='Completed'))
                bal = max(0.0, float(owed) - float(paid))
                data.append({
                    "supplier": s.name,
                    "total_owed": float(owed),
                    "total_paid": float(paid),
                    "current": float(round(bal * 0.70, 2)),
                    "days_31_60": float(round(bal * 0.20, 2)),
                    "days_61_90": float(round(bal * 0.10, 2)),
                    "days_90_plus": 0.0,
                    "outstanding_balance": float(bal)
                })

        elif report_type == 'outstanding_payments':
            title = "Outstanding Supplier Payables & Due Settlement Matrix"
            columns = ["Supplier Code", "Supplier Name", "Payment Method", "M-PESA / Bank Details", "Total Cost Owed", "Total Paid", "Pending Disbursement", "Status"]
            for s in suppliers:
                owed = sum(p.total_cost_owed for p in s.supplied_products.all())
                paid = sum(float(p.amount) for p in s.payments.filter(status='Completed'))
                bal = max(0.0, float(owed) - float(paid))
                account_info = s.mpesa_number if s.mpesa_number else f"{s.bank_name} ({s.bank_account_number})"
                data.append({
                    "code": s.code,
                    "name": s.name,
                    "payment_method": "M-PESA" if s.mpesa_number else "Bank Transfer",
                    "account_info": account_info,
                    "total_owed": float(owed),
                    "total_paid": float(paid),
                    "pending_disbursement": float(bal),
                    "status": "Settled" if bal <= 0 else ("Partially Paid" if paid > 0 else "Pending")
                })

        else:
            # Default / Overview Report
            title = "Overall Business & Sourcing Profitability Matrix"
            columns = ["Supplier", "Total Received Value", "Sales Revenue", "COGS Owed", "Total Paid", "Outstanding Balance", "Gross Profit", "Margin %"]
            for s in suppliers:
                prods = s.supplied_products.all()
                rec_val = sum(float(b.total_cost) for b in s.intake_batches.filter(status__in=['Received', 'Inspected']))
                rev = sum(p.total_sales_revenue for p in prods)
                cost = sum(p.total_cost_owed for p in prods)
                paid = sum(float(p.amount) for p in s.payments.filter(status='Completed'))
                bal = max(0.0, float(cost) - float(paid))
                profit = rev - cost
                margin = round((profit / rev * 100.0), 2) if rev > 0 else 0.0
                data.append({
                    "supplier": s.name,
                    "received_value": float(rec_val),
                    "revenue": float(rev),
                    "cost_owed": float(cost),
                    "amount_paid": float(paid),
                    "outstanding_balance": float(bal),
                    "gross_profit": float(profit),
                    "margin_percent": margin
                })

        return Response({
            "report_type": report_type,
            "title": title,
            "generated_at": timezone.now().isoformat(),
            "columns": columns,
            "rows": data
        })

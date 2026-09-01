from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from apps.orders.models import Order
from .models import Customer, Deal, Invoice
from .filters import CustomerFilter
from .serializers import (
    CustomerListSerializer,
    CustomerDetailSerializer,
    DealSerializer,
    InvoiceSerializer,
    CustomerOrderSerializer,
)


class CustomerViewSet(viewsets.ModelViewSet):
    """
    Customer Relationship Management ViewSet
    - List/Search: Lightweight CustomerListSerializer with computed open_deal_value, is_registered, and user
    - Retrieve (Detail): CustomerDetailSerializer with nested deals, orders, and invoices
    - Supports full search on first_name, last_name, email, company
    - Supports filtering by status (active, inactive, lead) and is_registered (true/false)
    """
    queryset = Customer.objects.all().select_related('user').prefetch_related('deals', 'orders', 'invoices').order_by('-created_at')
    permission_classes = [permissions.AllowAny]  # Or authenticated
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = CustomerFilter
    search_fields = ['first_name', 'last_name', 'email', 'company', 'phone', 'location']
    ordering_fields = ['created_at', 'first_name', 'last_name', 'company', 'status', 'location']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CustomerDetailSerializer
        return CustomerListSerializer


class DealViewSet(viewsets.ModelViewSet):
    """
    Deal Pipeline ViewSet
    - Independent CRUD operations for Deals
    - Filterable by customer ID and stage
    - Searchable by deal title and customer details
    """
    queryset = Deal.objects.all().select_related('customer').order_by('-created_at')
    serializer_class = DealSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['customer', 'stage']
    search_fields = ['title', 'customer__first_name', 'customer__last_name', 'customer__company', 'customer__email']
    ordering_fields = ['created_at', 'value', 'stage', 'expected_close']


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    Invoice Management ViewSet
    - Independent CRUD operations for Invoices
    - Filterable by customer ID, order ID, and status
    - Searchable by customer details
    """
    queryset = Invoice.objects.all().select_related('customer', 'order').order_by('-issued_at')
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['customer', 'order', 'status']
    search_fields = ['id', 'customer__first_name', 'customer__last_name', 'customer__company', 'customer__email']
    ordering_fields = ['issued_at', 'due_date', 'amount', 'status']


class CustomerOrderViewSet(viewsets.ModelViewSet):
    """
    Customer Order ViewSet
    - Create/List/Update customer orders linked to Customer FK
    - Filterable by customer ID and status
    - Searchable by reference / ID and customer details
    """
    queryset = Order.objects.all().select_related('customer').order_by('-created_at')
    serializer_class = CustomerOrderSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['customer', 'status']
    search_fields = ['id', 'reference', 'customer_name', 'customer_email', 'tracking_number']
    ordering_fields = ['created_at', 'total', 'status']

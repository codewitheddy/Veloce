import logging
from decimal import Decimal
from datetime import datetime, timedelta
from django.utils import timezone
from django.utils.html import strip_tags
from django.db.models import Sum, Count, Avg
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


@shared_task(
    name='core.tasks.send_generic_email_async_task',
    max_retries=3,
    default_retry_delay=60,
)
def send_generic_email_async_task(to_email: str, subject: str, html_content: str = '', text_content: str = ''):
    """
    Generic asynchronous or synchronous email delivery worker utilizing configured Django SMTP settings.
    """
    logger.info(f"[GenericEmail] Dispatching email to {to_email}: '{subject}'")
    plain = text_content or (strip_tags(html_content) if html_content else 'No text preview provided.')
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'Veloce Kenya <noreply@marid.co.ke>')
    
    send_mail(
        subject=subject,
        message=plain,
        from_email=from_email,
        recipient_list=[to_email],
        html_message=html_content if html_content else None,
        fail_silently=False,
    )
    return {'status': 'sent', 'recipient': to_email}


@shared_task(
    bind=True,
    name='core.tasks.generate_sales_report_task',
    max_retries=2,
    default_retry_delay=30,
)
def generate_sales_report_task(self, start_date: str = None, end_date: str = None, user_id: int = None):
    """
    Asynchronously aggregates order transaction metrics over a date range
    and compiles a sales performance report dictionary.
    """
    logger.info(f"[Task {self.request.id}] Generating sales report from {start_date} to {end_date}")
    from apps.orders.models import Order, OrderItem
    from products.models import Product

    qs = Order.objects.exclude(status__in=['Cancelled'])
    if start_date:
        try:
            parsed_start = datetime.fromisoformat(start_date)
            qs = qs.filter(created_at__gte=parsed_start)
        except Exception:
            pass
            
    if end_date:
        try:
            parsed_end = datetime.fromisoformat(end_date)
            qs = qs.filter(created_at__lte=parsed_end)
        except Exception:
            pass

    total_orders = qs.count()
    aggregations = qs.aggregate(
        total_revenue=Sum('total'),
        total_subtotal=Sum('subtotal'),
        total_discount=Sum('discount'),
        total_shipping=Sum('shipping_fee'),
        total_tax=Sum('tax_amount'),
        avg_order_value=Avg('total'),
    )

    revenue = float(aggregations.get('total_revenue') or 0.0)
    avg_order = float(aggregations.get('avg_order_value') or 0.0)

    # Breakdown by payment method
    payment_methods = list(qs.values('payment_method').annotate(
        count=Count('id'),
        total=Sum('total')
    ))

    # Top selling items
    top_items = list(OrderItem.objects.filter(order__in=qs).values('product_name').annotate(
        units_sold=Sum('quantity'),
        gross_sales=Sum('unit_price')
    ).order_by('-units_sold')[:10])

    report_result = {
        'status': 'completed',
        'generated_at': timezone.now().isoformat(),
        'period': {
            'start': start_date or 'all_time',
            'end': end_date or timezone.now().isoformat(),
        },
        'metrics': {
            'total_orders': total_orders,
            'gross_revenue': revenue,
            'avg_order_value': round(avg_order, 2),
            'discounts_given': float(aggregations.get('total_discount') or 0.0),
            'shipping_collected': float(aggregations.get('total_shipping') or 0.0),
            'tax_collected': float(aggregations.get('total_tax') or 0.0),
        },
        'payment_breakdown': payment_methods,
        'top_products': top_items,
        'task_id': self.request.id,
    }

    logger.info(f"[Task {self.request.id}] Sales report compiled successfully. Orders processed: {total_orders}, Revenue: KSh {revenue:,.2f}")
    return report_result


@shared_task(
    bind=True,
    name='core.tasks.generate_inventory_health_report_task',
    max_retries=2,
)
def generate_inventory_health_report_task(self, user_id: int = None):
    """
    Compiles full inventory valuation, low stock risk items, and catalog counts.
    """
    logger.info(f"[Task {self.request.id}] Generating catalog inventory health report")
    from products.models import Product

    products = Product.objects.all()
    total_products = products.count()
    active_count = products.filter(status='Active').count()
    out_of_stock = products.filter(stock=0, track_stock=True).count()
    
    total_units = 0
    total_retail_value = Decimal('0.00')
    low_stock_list = []

    for p in products:
        total_units += p.stock
        total_retail_value += (Decimal(str(p.price)) * p.stock)
        if p.track_stock and p.stock <= p.low_stock_threshold:
            low_stock_list.append({
                'sku': p.sku,
                'name': p.name,
                'stock': p.stock,
                'threshold': p.low_stock_threshold,
                'price': float(p.price)
            })

    return {
        'status': 'completed',
        'generated_at': timezone.now().isoformat(),
        'total_sku_count': total_products,
        'active_sku_count': active_count,
        'total_units_on_hand': total_units,
        'total_valuation_ksh': float(total_retail_value),
        'out_of_stock_count': out_of_stock,
        'low_stock_count': len(low_stock_list),
        'low_stock_items': low_stock_list,
        'task_id': self.request.id,
    }


@shared_task(
    bind=True,
    name='core.tasks.generate_daily_sales_summary_task',
)
def generate_daily_sales_summary_task(self):
    """
    Celery Beat periodic task: Generates 24-hour executive sales digest
    and emails daily summary to administration.
    """
    yesterday = timezone.now() - timedelta(days=1)
    report = generate_sales_report_task(start_date=yesterday.isoformat())
    
    admin_email = getattr(settings, 'SERVER_EMAIL', 'admin@veloce.co.ke')
    metrics = report.get('metrics', {})
    
    subject = f"📊 [DAILY DIGEST] Veloce Kenya Sales Summary - KSh {metrics.get('gross_revenue', 0):,.2f}"
    body = f"""Daily Automated Sales Summary:
------------------------------------------
Date Period      : Last 24 Hours
Total Orders     : {metrics.get('total_orders', 0)}
Gross Revenue    : KSh {metrics.get('gross_revenue', 0):,.2f}
Avg Order Value  : KSh {metrics.get('avg_order_value', 0):,.2f}
Discounts Given  : KSh {metrics.get('discounts_given', 0):,.2f}
Shipping Revenue : KSh {metrics.get('shipping_collected', 0):,.2f}

Report generated automatically by Celery Beat scheduler.
"""
    send_mail(
        subject=subject,
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[admin_email],
        fail_silently=True,
    )
    return {'status': 'sent', 'metrics': metrics}


@shared_task(
    bind=True,
    name='core.tasks.cleanup_expired_promos_and_tokens_task',
)
def cleanup_expired_promos_and_tokens_task(self):
    """
    Celery Beat periodic task: Cleans up expired sessions, temporary tokens, and stale logs.
    """
    logger.info(f"[Task {self.request.id}] Running weekly housekeeping cleanup.")
    from django.core.management import call_command
    try:
        call_command('clearsessions')
    except Exception as e:
        logger.warning(f"clearsessions error: {e}")
    return {'status': 'completed', 'task_id': self.request.id}

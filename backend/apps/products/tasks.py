import logging
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.db.models import F as models_f
from products.models import Product, InventoryAuditLog

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name='apps.products.tasks.check_low_stock_threshold_task',
    max_retries=2,
    default_retry_delay=60,
)
def check_low_stock_threshold_task(self):
    """
    Periodic & on-demand task to scan inventory across the catalog for low stock items
    and alert store managers before items sell out completely.
    """
    logger.info(f"[Task {self.request.id}] Executing scheduled low stock threshold audit.")
    
    # Query items with stock at or below threshold
    low_stock_products = Product.objects.filter(
        track_stock=True,
        status='Active',
    ).exclude(stock__gt=models_f('low_stock_threshold') if hasattr(Product, 'low_stock_threshold') else 5)
    
    # Alternative direct evaluation
    flagged = []
    for p in Product.objects.filter(track_stock=True, status='Active'):
        if p.stock <= p.low_stock_threshold:
            flagged.append({
                'sku': p.sku,
                'name': p.name,
                'stock': p.stock,
                'threshold': p.low_stock_threshold
            })

    if not flagged:
        logger.info(f"[Task {self.request.id}] Inventory healthy: No low stock products detected.")
        return {'status': 'healthy', 'count': 0}

    logger.warning(f"[Task {self.request.id}] Found {len(flagged)} low stock products: {[f['sku'] for f in flagged]}")

    admin_email = getattr(settings, 'SERVER_EMAIL', 'admin@ropenix.co.ke')
    items_list = "\n".join([f"- {f['sku']} ({f['name']}): Current Stock = {f['stock']} (Alert Level: {f['threshold']})" for f in flagged])
    
    subject = f"⚠️ [INVENTORY ALERT] {len(flagged)} Products Reached Low Stock Level | Ropenix Collections"
    body = f"""Attention Inventory & Fulfillment Team,

The following products have fallen to or below their configured stock safety thresholds:

{items_list}

Please review supplier reorder queues and restock as necessary.

Automated Inventory Monitor,
Ropenix Collections
"""

    send_mail(
        subject=subject,
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[admin_email],
        fail_silently=True,
    )

    return {'status': 'alerts_sent', 'low_stock_count': len(flagged), 'products': flagged}


@shared_task(
    bind=True,
    name='apps.products.tasks.process_product_bulk_update_task',
    max_retries=3,
    default_retry_delay=30,
)
def process_product_bulk_update_task(self, product_ids: list, action: str, value: str):
    """
    Asynchronously executes bulk catalog operations (e.g., status changes, archiving, category reassignment).
    """
    logger.info(f"[Task {self.request.id}] Processing bulk action '{action}' on {len(product_ids)} products.")
    
    updated_count = 0
    if action == 'update_status':
        updated_count = Product.objects.filter(id__in=product_ids).update(status=value)
    elif action == 'archive':
        updated_count = Product.objects.filter(id__in=product_ids).update(status='Archived')
    elif action == 'delete':
        deleted_count, _ = Product.objects.filter(id__in=product_ids).delete()
        updated_count = deleted_count

    logger.info(f"[Task {self.request.id}] Completed bulk action '{action}'. Affected items: {updated_count}")
    return {
        'status': 'completed',
        'action': action,
        'affected_count': updated_count,
        'task_id': self.request.id
    }

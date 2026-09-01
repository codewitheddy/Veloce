import logging
import urllib.parse
from celery import shared_task
from django.conf import settings
from apps.emails.service import send_transactional_email
from apps.emails.events import (
    ORDER_PLACED_CUSTOMER,
    ORDER_PLACED_ADMIN,
    ORDER_SHIPPED_CUSTOMER,
    ORDER_DELIVERED_CUSTOMER,
    ORDER_CANCELLED_CUSTOMER,
    PAYMENT_FAILED_CUSTOMER,
)

logger = logging.getLogger(__name__)


def _get_order_and_items(order_id: str):
    from apps.orders.models import Order
    try:
        return Order.objects.prefetch_related('items').get(id=order_id)
    except Order.DoesNotExist:
        logger.error(f"[Orders] Order #{order_id} not found in database.")
        return None


def _build_order_context(order, items=None) -> dict:
    """
    Assembles a complete, sanitized context dictionary for order transactional emails.
    """
    if items is None:
        items = list(order.items.all())

    subtotal = float(getattr(order, 'subtotal', 0) or 0)
    discount = float(getattr(order, 'discount', 0) or 0)
    shipping_fee = float(getattr(order, 'shipping_fee', 0) or 0)
    tax_amount = float(getattr(order, 'tax_amount', 0) or 0)
    grand_total = float(getattr(order, 'total', 0) or 0)

    items_data = []
    for item in items:
        unit_price = float(getattr(item, 'unit_price', 0) or 0)
        qty = int(getattr(item, 'quantity', 1) or 1)
        item_total = unit_price * qty
        vars_dict = getattr(item, 'selected_variations', {}) or {}
        var_text = ", ".join(f"{k}: {v}" for k, v in vars_dict.items()) if isinstance(vars_dict, dict) and vars_dict else ""
        
        items_data.append({
            'product_name': getattr(item, 'product_name', 'Product'),
            'product_sku': getattr(item, 'product_sku', '') or '',
            'quantity': qty,
            'unit_price': unit_price,
            'unit_price_formatted': f"{unit_price:,.2f}",
            'total': item_total,
            'total_formatted': f"{item_total:,.2f}",
            'selected_variations': var_text,
        })

    phone = getattr(order, 'customer_phone', '') or ''
    raw_phone = ''.join(c for c in phone if c.isdigit())
    if raw_phone.startswith('0'):
        wa_phone = '254' + raw_phone[1:]
    elif raw_phone.startswith('254'):
        wa_phone = raw_phone
    else:
        wa_phone = '254' + raw_phone if raw_phone else ''

    customer_name = getattr(order, 'customer_name', '') or 'Customer'
    order_id_str = str(order.id)
    order_short_id = order_id_str[:8].upper()

    whatsapp_link = (
        f"https://wa.me/{wa_phone}?text=Hello%20{urllib.parse.quote(customer_name)},"
        f"%20this%20is%20Veloce%20Kenya%20regarding%20order%20%23{order_short_id}"
        if wa_phone else None
    )

    shipping_addr = getattr(order, 'shipping_address', '') or ''
    maps_link = (
        f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(shipping_addr)}"
        if shipping_addr and 'Direct Customer Pickup' not in shipping_addr else None
    )

    is_pending_verification = str(getattr(order, 'status', '')).lower() == 'pending'

    return {
        'order_id': order_id_str,
        'order_short_id': order_short_id,
        'order_date': order.created_at.strftime('%d %b %Y, %H:%M UTC') if hasattr(order, 'created_at') and order.created_at else '',
        'customer_name': customer_name,
        'customer_email': getattr(order, 'customer_email', '') or '',
        'customer_phone': phone or 'Not provided',
        'status': order.status,
        'status_display': getattr(order, 'get_status_display', lambda: str(order.status))(),
        'is_pending_verification': is_pending_verification,
        'payment_method': getattr(order, 'payment_method', 'M-PESA') or 'M-PESA',
        'payment_reference': getattr(order, 'payment_reference', '') or '',
        'shipping_address': shipping_addr or 'Direct Store Hub Fulfillment',
        'affiliate_code': getattr(order, 'affiliate_code', '') or 'None',
        'notes': getattr(order, 'notes', '') or '',
        'account_badge': "Registered Member" if getattr(order, 'user_id', None) else "Guest Checkout",
        'tracking_number': getattr(order, 'tracking_number', '') or '',
        'items': items_data,
        'subtotal': subtotal,
        'subtotal_formatted': f"{subtotal:,.2f}",
        'discount': discount,
        'discount_formatted': f"{discount:,.2f}",
        'shipping_fee': shipping_fee,
        'shipping_fee_formatted': f"{shipping_fee:,.2f}",
        'tax_amount': tax_amount,
        'tax_amount_formatted': f"{tax_amount:,.2f}",
        'total': grand_total,
        'total_formatted': f"{grand_total:,.2f}",
        'whatsapp_link': whatsapp_link,
        'maps_link': maps_link,
    }


# ==============================================================================
# Customer Status Transition Router
# ==============================================================================
@shared_task(
    name='apps.orders.tasks.send_order_transition_email_task',
    max_retries=3,
    default_retry_delay=60,
)
def send_order_transition_email_task(order_id: str, old_status: str = None, new_status: str = 'pending', tracking_number: str = None):
    """
    Dispatches customer notifications via the centralized send_transactional_email engine.
    """
    logger.info(f"[OrderEmail] Routing transition '{old_status}' -> '{new_status}' for Order #{order_id}")

    order = _get_order_and_items(order_id)
    if not order:
        logger.error(f"[OrderEmail] Order #{order_id} not found.")
        return {'status': 'failed', 'reason': 'order_not_found', 'order_id': order_id}

    if not order.customer_email:
        logger.warning(f"[OrderEmail] Order #{order_id} has no customer_email; skipping customer notification.")
        return {'status': 'skipped', 'reason': 'missing_customer_email', 'order_id': order_id}

    normalized_status = str(new_status or '').strip().lower()
    context = _build_order_context(order)
    if tracking_number:
        context['tracking_number'] = tracking_number

    # Select event type
    if old_status is None:
        event_type = ORDER_PLACED_CUSTOMER
    elif normalized_status in ('pending', 'processing', 'confirmed', 'paid'):
        event_type = ORDER_PLACED_CUSTOMER
    elif normalized_status == 'shipped':
        event_type = ORDER_SHIPPED_CUSTOMER
    elif normalized_status in ('delivered', 'completed'):
        event_type = ORDER_DELIVERED_CUSTOMER
    elif normalized_status == 'cancelled':
        event_type = ORDER_CANCELLED_CUSTOMER
    elif normalized_status in ('failed', 'payment_failed'):
        event_type = PAYMENT_FAILED_CUSTOMER
    else:
        event_type = ORDER_PLACED_CUSTOMER

    # Dispatch through centralized transactional email service
    result = send_transactional_email(
        event_type=event_type,
        recipient=order.customer_email,
        context=context,
        async_send=False,  # Already in task context or sync fallback
    )

    # In-app user notification if registered user
    if order.user:
        try:
            from apps.users.models import UserNotification
            display_status = new_status.replace('-', ' ').title()
            order_prefix = str(order.id)[:8].upper()
            UserNotification.objects.create(
                user=order.user,
                title=f"Order #{order_prefix} ({display_status})",
                message=f"Order #{order_prefix} is now {display_status}.",
                type='order',
                link_url="/orders"
            )
        except Exception as err:
            logger.warning(f"[OrderEmail] Could not create UserNotification for user {order.user.id}: {err}")

    return result


@shared_task(
    name='apps.orders.tasks.send_order_confirmation_email_task',
    max_retries=3,
    default_retry_delay=60,
)
def send_order_confirmation_email_task(order_id: str):
    return send_order_transition_email_task(order_id, None, 'pending')


@shared_task(
    name='apps.orders.tasks.send_order_status_notification_task',
    max_retries=3,
    default_retry_delay=60,
)
def send_order_status_notification_task(order_id: str, new_status: str, tracking_number: str = None):
    return send_order_transition_email_task(order_id, 'in_progress', new_status, tracking_number)


# ==============================================================================
# Administrative New-Order Alert Task
# ==============================================================================
@shared_task(
    name='apps.orders.tasks.send_admin_new_order_alert_task',
    max_retries=3,
    default_retry_delay=60,
)
def send_admin_new_order_alert_task(order_id: str):
    """
    Dispatches admin notification alert to ropenixkenya@gmail.com with customer reply_to.
    Completely decoupled from customer notification pipeline.
    """
    logger.info(f"[AdminAlert] Preparing admin order alert for Order #{order_id}")

    order = _get_order_and_items(order_id)
    if not order:
        logger.error(f"[AdminAlert] Order #{order_id} not found.")
        return {'status': 'failed', 'reason': 'order_not_found'}

    admin_recipient = getattr(settings, 'ADMIN_EMAIL', 'ropenixkenya@gmail.com')
    context = _build_order_context(order)

    # Customer email used as reply_to so admin can hit "Reply" to message customer directly
    reply_to = order.customer_email if order.customer_email and '@' in order.customer_email else None

    result = send_transactional_email(
        event_type=ORDER_PLACED_ADMIN,
        recipient=admin_recipient,
        context=context,
        reply_to=reply_to,
        async_send=False,  # Task/direct context
    )

    logger.info(f"[AdminAlert] Admin order alert for Order #{order_id} result: {result.get('status')}")
    return result


# ==============================================================================
# Dispatch helper functions called by signals
# ==============================================================================
def dispatch_order_status_email(order_id: str, old_status: str, new_status: str, tracking_number: str = None):
    """
    Enqueues async Celery task for customer status notification with automatic synchronous fallback.
    """
    try:
        send_order_transition_email_task.delay(order_id, old_status, new_status, tracking_number)
        logger.info(f"[OrderEmail] Enqueued async task for Order #{order_id} ({old_status} -> {new_status})")
    except Exception as celery_err:
        logger.info(f"[OrderEmail] Celery offline ({celery_err}). Running synchronously for Order #{order_id}.")
        send_order_transition_email_task(order_id, old_status, new_status, tracking_number)


def dispatch_admin_order_notification(order_id: str):
    """
    Enqueues async Celery task for admin new-order alert with automatic synchronous fallback.
    """
    try:
        send_admin_new_order_alert_task.delay(order_id)
        logger.info(f"[AdminAlert] Enqueued async admin alert for Order #{order_id}")
    except Exception as celery_err:
        logger.info(f"[AdminAlert] Celery offline ({celery_err}). Running synchronously for Order #{order_id}.")
        send_admin_new_order_alert_task(order_id)

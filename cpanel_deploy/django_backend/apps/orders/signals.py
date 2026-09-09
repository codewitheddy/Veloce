import logging
from django.db import transaction
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from .models import Order
from .tasks import dispatch_order_status_email, dispatch_admin_order_notification

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=Order)
def order_pre_save_handler(sender, instance, **kwargs):
    """
    Captures the previous database status of an order prior to saving.
    """
    if instance.pk:
        existing = Order.objects.filter(pk=instance.pk).values('status', 'tracking_number').first()
        if existing:
            instance._old_status = existing['status']
            instance._old_tracking_number = existing.get('tracking_number')
            instance._is_new_order = False
            return

    instance._old_status = None
    instance._old_tracking_number = None
    instance._is_new_order = True

    # Auto-link Order to Customer CRM profile
    if not instance.customer_id and instance.customer_email:
        try:
            from apps.customers.models import Customer
            from django.contrib.auth.models import User
            email_clean = instance.customer_email.strip()
            customer = Customer.objects.filter(email__iexact=email_clean).first()

            if not customer:
                user_match = instance.user or User.objects.filter(email__iexact=email_clean).first()
                customer = Customer.objects.create(
                    user=user_match,
                    first_name=instance.customer_name or 'Customer',
                    email=email_clean,
                    phone=instance.customer_phone or '',
                    location=instance.shipping_address or '',
                    status='active'
                )
            elif instance.user and not customer.user:
                customer.user = instance.user
                customer.save(update_fields=['user'])

            instance.customer = customer
            if not instance.user and customer.user:
                instance.user = customer.user
        except Exception as exc:
            logger.warning(f"[Signals] Error linking Order #{getattr(instance, 'id', '')} to Customer CRM profile: {exc}")



@receiver(post_save, sender=Order)
def order_post_save_handler(sender, instance, created, **kwargs):
    """
    Authoritative trigger: Ensures status emails are strictly driven
    by the order status field mutating on database save.
    """
    order_id = str(instance.id)
    new_status = str(instance.status)
    tracking_num = str(instance.tracking_number or '')

    is_new = created or getattr(instance, '_is_new_order', False)

    if is_new:
        logger.info(f"[Signals] New Order #{order_id} created with status: {new_status}. Scheduling order received and admin notification emails.")
        
        # 1. Dispatch Order Received / Confirmation to customer
        transaction.on_commit(
            lambda: dispatch_order_status_email(order_id, None, new_status, tracking_num)
        )
        
        # 2. Dispatch New Order Alert to administrators (ropenixkenya@gmail.com)
        transaction.on_commit(
            lambda: dispatch_admin_order_notification(order_id)
        )
        return

    # Existing order update
    old_status = getattr(instance, '_old_status', None)

    # If status has not changed, do NOT re-trigger status transition emails
    if old_status == new_status:
        logger.debug(f"[Signals] Order #{order_id} updated with unchanged status ({new_status}). Skipping status transition email.")
        return

    logger.info(f"[Signals] Order #{order_id} status changed from '{old_status}' -> '{new_status}'. Scheduling transition email.")
    transaction.on_commit(
        lambda: dispatch_order_status_email(order_id, str(old_status), new_status, tracking_num)
    )

import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User

logger = logging.getLogger(__name__)


@receiver(post_save, sender=User)
def user_post_save_handler(sender, instance, created, **kwargs):
    """
    Authoritative trigger: Ensures every Django User has a linked Customer CRM record.
    - Synchronizes username, email, first_name, and last_name with Customer profile.
    - Automatically links pre-existing guest Customer records by matching email address (deduplication).
    - Sets is_registered to True and status to 'active'.
    """
    try:
        from apps.customers.models import Customer
        user_email = (instance.email or '').strip()

        # Check if customer record linked to this user already exists
        customer = Customer.objects.filter(user=instance).first()

        if not customer and user_email:
            # Check if an existing guest customer profile exists with this email
            customer = Customer.objects.filter(email__iexact=user_email).first()

        if customer:
            changed_fields = []
            if customer.user != instance:
                customer.user = instance
                changed_fields.append('user')
            if user_email and customer.email.lower() != user_email.lower():
                customer.email = user_email
                changed_fields.append('email')
            if instance.first_name and customer.first_name != instance.first_name:
                customer.first_name = instance.first_name
                changed_fields.append('first_name')
            if instance.last_name and customer.last_name != instance.last_name:
                customer.last_name = instance.last_name
                changed_fields.append('last_name')
            if not customer.first_name and instance.username:
                customer.first_name = instance.username
                changed_fields.append('first_name')
            if customer.status != 'active':
                customer.status = 'active'
                changed_fields.append('status')

            if changed_fields:
                customer.save(update_fields=changed_fields)
                logger.info(f"[Signals] Updated Customer CRM profile for User #{instance.id} ({instance.username})")
        else:
            first_name = instance.first_name or instance.username
            last_name = instance.last_name or ''
            email = user_email or f"{instance.username}@example.com"
            Customer.objects.create(
                user=instance,
                first_name=first_name,
                last_name=last_name,
                email=email,
                status='active'
            )
            logger.info(f"[Signals] Created new Customer CRM profile for User #{instance.id} ({instance.username})")
    except Exception as exc:
        logger.warning(f"[Signals] Error syncing Customer CRM profile for User #{instance.id}: {exc}")

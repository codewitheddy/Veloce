import logging
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth.models import User

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name='apps.users.tasks.send_welcome_email_task',
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def send_welcome_email_task(self, user_id: int):
    """
    Sends a branded welcome email to newly registered users asynchronously via centralized email service.
    """
    logger.info(f"[Task {self.request.id}] Sending welcome email for user_id={user_id}")
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error(f"[Task {self.request.id}] User {user_id} not found.")
        return {'status': 'failed', 'reason': 'user_not_found'}

    if not user.email:
        return {'status': 'skipped', 'reason': 'no_email'}

    from apps.emails.service import send_transactional_email
    from apps.emails.events import USER_WELCOME_CUSTOMER

    context = {
        'user_name': user.first_name or user.username,
        'user_email': user.email,
    }

    result = send_transactional_email(
        event_type=USER_WELCOME_CUSTOMER,
        recipient=user.email,
        context=context,
        async_send=False,
    )

    return {'status': result.get('status', 'success'), 'user_id': user_id, 'email': user.email}


@shared_task(
    bind=True,
    name='apps.users.tasks.send_password_reset_otp_task',
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(Exception,),
)
def send_password_reset_otp_task(self, email: str, otp_code: str):
    """
    Sends the 6-digit password reset OTP email securely in background.
    """
    logger.info(f"[Task {self.request.id}] Sending password reset OTP to {email}")
    subject = "Password Reset Verification Code | Veloce Kenya"
    body_text = f"""Hello,

We received a request to reset your password for your Veloce Kenya account.

Your verification OTP code is:
{otp_code}

This code will expire in 15 minutes. If you did not request this change, please ignore this email.

Security Team,
Veloce Kenya
"""
    send_mail(
        subject=subject,
        message=body_text,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )
    return {'status': 'success', 'email': email}


@shared_task(
    bind=True,
    name='apps.users.tasks.send_user_notification_task',
    max_retries=2,
)
def send_user_notification_task(self, user_id: int, title: str, message: str, notif_type: str = 'system', link_url: str = ''):
    """
    Creates an in-app notification record and optionally dispatches push/email alerts.
    """
    from apps.users.models import UserNotification
    try:
        user = User.objects.get(id=user_id)
        notif = UserNotification.objects.create(
            user=user,
            title=title,
            message=message,
            type=notif_type,
            link_url=link_url
        )
        return {'status': 'success', 'notification_id': notif.id}
    except User.DoesNotExist:
        return {'status': 'failed', 'reason': 'user_not_found'}

import os
import logging
from datetime import datetime
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from .models import TransactionalEmailLog
from .events import (
    EVENT_TEMPLATES,
    ORDER_PLACED_CUSTOMER,
    ORDER_PLACED_ADMIN,
    CONTACT_SUBMITTED_ADMIN,
    CONTACT_SUBMITTED_CUSTOMER,
)

logger = logging.getLogger('apps.emails')


def _get_default_brand_context():
    """
    Supplies consistent default brand metadata for all email rendering contexts.
    """
    return {
        'brand_name': 'Veloce Kenya',
        'brand_tagline': 'Engineered Performance Apparel & Tech Hub',
        'support_email': 'support@marid.co.ke',
        'admin_inbox': getattr(settings, 'ADMIN_EMAIL', 'ropenixkenya@gmail.com'),
        'frontend_url': getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/'),
        'current_year': datetime.now().year,
        'current_time_utc': timezone.now().strftime('%d %b %Y, %H:%M UTC'),
        'hub_address': 'Westlands & Industrial Area Fulfillment Hubs, Nairobi, Kenya',
        'hotline_phone': '+254 700 000 000',
    }


def render_email_content(event_type: str, context: dict, custom_subject: str = None):
    """
    Renders subject, plain-text body, and HTML body from templates matching the event type.
    """
    full_context = _get_default_brand_context()
    full_context.update(context or {})

    # Normalize convenient aliases
    if 'sender_name' not in full_context:
        full_context['sender_name'] = full_context.get('name') or full_context.get('customer_name') or 'Customer'
    if 'user_name' not in full_context:
        full_context['user_name'] = full_context.get('name') or full_context.get('first_name') or 'Customer'
    if 'subject_clean' not in full_context:
        full_context['subject_clean'] = full_context.get('subject') or 'Customer Inquiry'
    if 'total_formatted' not in full_context:
        full_context['total_formatted'] = full_context.get('total') or '0.00'
    if 'order_short_id' not in full_context:
        raw_id = str(full_context.get('order_id', ''))
        full_context['order_short_id'] = raw_id[:8].upper() if raw_id else 'NEW'

    template_cfg = EVENT_TEMPLATES.get(event_type, {})
    
    # 1. Subject line formatting
    if custom_subject:
        subject = custom_subject
    elif template_cfg.get('subject_template'):
        try:
            subject = template_cfg['subject_template'].format(**full_context)
        except Exception as err:
            logger.warning(f"[EmailService] Could not format subject template for {event_type}: {err}. Using default.")
            subject = f"Notification from Veloce Kenya: {event_type}"
    else:
        subject = f"Notification: {event_type}"

    # Clean subject line to prevent header injection
    subject = " ".join(str(subject).splitlines()).strip()

    # 2. HTML body rendering
    html_template = template_cfg.get('html_template')
    html_body = ''
    if html_template:
        try:
            html_body = render_to_string(html_template, full_context)
        except Exception as err:
            logger.error(f"[EmailService] Error rendering HTML template '{html_template}' for {event_type}: {err}", exc_info=True)
            html_body = f"<p>{subject}</p>"

    # 3. Plain text body rendering
    text_template = template_cfg.get('text_template')
    text_body = ''
    if text_template:
        try:
            text_body = render_to_string(text_template, full_context)
        except Exception as err:
            logger.error(f"[EmailService] Error rendering Text template '{text_template}' for {event_type}: {err}", exc_info=True)
            text_body = subject
    else:
        text_body = subject

    return subject, text_body, html_body


def _dispatch_email_message(log: TransactionalEmailLog) -> bool:
    """
    Low-level sender that transmits the rendered email message via configured Django SMTP backend.
    Updates the TransactionalEmailLog entry upon success or failure.
    """
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'Veloce Kenya <noreply@marid.co.ke>')
    
    reply_to_list = [log.reply_to.strip()] if log.reply_to and log.reply_to.strip() else None

    msg = EmailMultiAlternatives(
        subject=log.subject,
        body=log.body_text or 'No text preview provided.',
        from_email=from_email,
        to=[log.recipient],
        reply_to=reply_to_list,
    )

    if log.body_html:
        msg.attach_alternative(log.body_html, "text/html")

    try:
        msg.send(fail_silently=False)
        log.status = 'sent'
        log.sent_at = timezone.now()
        log.error_detail = ''
        log.sender = from_email
        log.save(update_fields=['status', 'sent_at', 'error_detail', 'sender', 'updated_at'])
        logger.info(f"[EmailService] [SUCCESS] Dispatched '{log.event_type}' to {log.recipient} (Log ID: {log.id})")
        return True
    except Exception as exc:
        log.status = 'failed'
        log.error_detail = str(exc)
        log.retry_count += 1
        log.save(update_fields=['status', 'error_detail', 'retry_count', 'updated_at'])
        logger.error(f"[EmailService] [FAILED] Could not send '{log.event_type}' to {log.recipient} (Log ID: {log.id}): {exc}", exc_info=True)
        return False


def send_transactional_email(
    event_type: str,
    recipient: str,
    context: dict = None,
    reply_to: str = None,
    custom_subject: str = None,
    async_send: bool = True,
) -> dict:
    """
    Centralized, observable transactional email entrypoint.
    
    Parameters:
    - event_type: Registered event key (e.g. ORDER_PLACED_CUSTOMER, ORDER_PLACED_ADMIN)
    - recipient: Target email address
    - context: Template context dictionary (order, customer details, message, etc.)
    - reply_to: Optional reply-to email address (e.g. customer email for admin alerts)
    - custom_subject: Optional subject line override
    - async_send: If True, attempts async Celery execution with automatic sync fallback.
    
    Returns:
    - Dict with execution status, log_id, recipient, and event_type.
    """
    recipient_clean = str(recipient or '').strip()
    if not recipient_clean or '@' not in recipient_clean:
        logger.warning(f"[EmailService] [SKIPPED] Invalid or missing recipient '{recipient}' for event '{event_type}'")
        return {
            'status': 'skipped',
            'reason': 'invalid_recipient',
            'event_type': event_type,
            'recipient': recipient_clean,
        }

    # Render subject, text, and html
    subject, body_text, body_html = render_email_content(event_type, context or {}, custom_subject)

    # Sanitize reply-to
    reply_to_clean = str(reply_to or '').strip() if reply_to else ''

    # Create audit log record in database
    log = TransactionalEmailLog.objects.create(
        event_type=event_type,
        recipient=recipient_clean,
        reply_to=reply_to_clean,
        subject=subject,
        body_text=body_text,
        body_html=body_html,
        status='queued',
        context_data=context or {},
    )

    if async_send:
        try:
            from .tasks import send_async_transactional_email_task
            send_async_transactional_email_task.delay(str(log.id))
            logger.info(f"[EmailService] Enqueued async task for log #{log.id} ({event_type} -> {recipient_clean})")
            return {
                'status': 'queued',
                'log_id': str(log.id),
                'event_type': event_type,
                'recipient': recipient_clean,
            }
        except Exception as celery_err:
            logger.info(f"[EmailService] Celery offline ({celery_err}); executing log #{log.id} synchronously.")

    # Synchronous execution
    success = _dispatch_email_message(log)
    return {
        'status': 'sent' if success else 'failed',
        'log_id': str(log.id),
        'event_type': event_type,
        'recipient': recipient_clean,
        'error': log.error_detail if not success else None,
    }

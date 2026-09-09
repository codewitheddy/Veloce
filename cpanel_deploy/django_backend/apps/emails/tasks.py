import logging
from celery import shared_task
from .models import TransactionalEmailLog

logger = logging.getLogger('apps.emails')


@shared_task(
    name='apps.emails.tasks.send_async_transactional_email_task',
    max_retries=3,
    default_retry_delay=60,
)
def send_async_transactional_email_task(log_id: str):
    """
    Celery asynchronous worker task to dispatch a queued TransactionalEmailLog entry.
    """
    from .service import _dispatch_email_message

    try:
        log = TransactionalEmailLog.objects.get(id=log_id)
    except TransactionalEmailLog.DoesNotExist:
        logger.error(f"[EmailTask] TransactionalEmailLog #{log_id} not found.")
        return {'status': 'failed', 'reason': 'log_not_found'}

    if log.status == 'sent':
        logger.info(f"[EmailTask] Log #{log_id} already marked as sent. Skipping duplicate dispatch.")
        return {'status': 'already_sent', 'log_id': log_id}

    success = _dispatch_email_message(log)
    return {
        'status': 'sent' if success else 'failed',
        'log_id': log_id,
        'recipient': log.recipient,
        'event_type': log.event_type,
    }

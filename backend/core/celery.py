import os
import logging
from celery import Celery

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

logger = logging.getLogger(__name__)

# Initialize the Celery application
app = Celery('veloce_ecommerce')

# Load task-related configuration from Django settings using the 'CELERY_' prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Redis Message Broker and Result Backend configuration mirroring .env settings
broker_url = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
result_backend = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/1')

app.conf.update(
    broker_url=broker_url,
    result_backend=result_backend,
    accept_content=['json'],
    task_serializer='json',
    result_serializer='json',
    timezone=os.getenv('CELERY_TIMEZONE', 'UTC'),
    enable_utc=True,
)

# Automatically discover tasks in all installed Django apps (tasks.py in each app directory)
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """
    Diagnostic task to verify Celery worker connectivity and message broker health.
    """
    logger.info(f"Celery Diagnostic Task executed successfully. Request: {self.request.id!r}")
    return f"Request: {self.request.id!r}"

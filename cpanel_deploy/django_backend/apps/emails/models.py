import uuid
from django.db import models
from .events import EVENT_CHOICES


class TransactionalEmailLog(models.Model):
    """
    Authoritative audit ledger for all transactional emails dispatched by the system.
    Tracks delivery status, retry counters, full rendered payloads, and error traces.
    """
    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('sent', 'Sent Successfully'),
        ('failed', 'Delivery Failed'),
        ('skipped', 'Skipped / Suppressed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=64, choices=EVENT_CHOICES, db_index=True)
    recipient = models.EmailField(db_index=True)
    sender = models.CharField(max_length=255, blank=True, default='')
    reply_to = models.CharField(max_length=255, blank=True, default='')
    subject = models.CharField(max_length=255)
    body_text = models.TextField(blank=True, default='')
    body_html = models.TextField(blank=True, default='')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued', db_index=True)
    error_detail = models.TextField(blank=True, default='', help_text="Detailed error traceback or failure rationale")
    retry_count = models.PositiveIntegerField(default=0)
    context_data = models.JSONField(default=dict, blank=True, help_text="Context payload used for rendering")
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Transactional Email Log'
        verbose_name_plural = 'Transactional Email Logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['event_type', '-created_at']),
            models.Index(fields=['recipient', '-created_at']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return f"[{self.status.upper()}] {self.event_type} -> {self.recipient} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"

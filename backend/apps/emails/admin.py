from django.contrib import admin
from .models import TransactionalEmailLog


@admin.register(TransactionalEmailLog)
class TransactionalEmailLogAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'recipient', 'status', 'created_at', 'sent_at', 'retry_count')
    list_filter = ('event_type', 'status', 'created_at')
    search_fields = ('recipient', 'subject', 'error_detail', 'id')
    readonly_fields = ('id', 'event_type', 'recipient', 'sender', 'reply_to', 'subject', 'body_text', 'body_html', 'status', 'error_detail', 'retry_count', 'context_data', 'created_at', 'sent_at', 'updated_at')
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False

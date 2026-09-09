from rest_framework import serializers
from .models import SiteSettings, ThemePreset, BackupSnapshot, SettingsAuditLog

class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = [
            'id',
            'general',
            'appearance',
            'tax',
            'receipts',
            'backup',
            'payments',
            'notifications',
            'seo',
            'access_control',
            'updated_at'
        ]
        read_only_fields = ['id', 'updated_at']


class ThemePresetSerializer(serializers.ModelSerializer):
    is_currently_active = serializers.SerializerMethodField()

    class Meta:
        model = ThemePreset
        fields = [
            'id',
            'name',
            'description',
            'primary_color',
            'secondary_color',
            'accent_color',
            'background_color',
            'surface_color',
            'text_color',
            'is_active',
            'is_scheduled',
            'start_date',
            'end_date',
            'is_system_preset',
            'is_currently_active',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_is_currently_active(self, obj):
        if obj.is_active:
            return True
        return obj.is_currently_valid_schedule()


class BackupSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = BackupSnapshot
        fields = [
            'id',
            'filename',
            'file_size_bytes',
            'backup_type',
            'status',
            'checksum',
            'created_by',
            'notes',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class SettingsAuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SettingsAuditLog
        fields = [
            'id',
            'user_email',
            'section',
            'action',
            'old_state',
            'new_state',
            'changes_diff',
            'ip_address',
            'timestamp'
        ]
        read_only_fields = ['id', 'timestamp']

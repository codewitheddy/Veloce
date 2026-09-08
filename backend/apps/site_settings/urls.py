from django.urls import path
from .views import (
    SiteSettingsAPIView,
    ThemePresetViewSet,
    BackupManagementAPIView,
    SettingsAuditLogListAPIView,
    ETimsDiagnosticAPIView
)

urlpatterns = [
    # Global Settings
    path('', SiteSettingsAPIView.as_view(), name='site_settings_root'),
    
    # Theme Presets
    path('themes/presets/', ThemePresetViewSet.as_view({'get': 'list', 'post': 'create'}), name='theme_presets_list'),
    path('themes/presets/<str:pk>/', ThemePresetViewSet.as_view({'get': 'retrieve', 'put': 'update', 'delete': 'destroy'}), name='theme_presets_detail'),
    path('themes/presets/<str:pk>/activate/', ThemePresetViewSet.as_view({'post': 'activate'}), name='theme_presets_activate'),
    path('themes/presets/<str:pk>/schedule/', ThemePresetViewSet.as_view({'post': 'schedule'}), name='theme_presets_schedule'),
    
    # Backups & Data Safety
    path('backups/create/', BackupManagementAPIView.as_view(), name='backup_create'),
    path('backups/list/', BackupManagementAPIView.as_view(), name='backup_list'),
    path('backups/<str:pk>/restore/', BackupManagementAPIView.as_view(), {'action_name': 'restore'}, name='backup_restore'),
    path('backups/<str:pk>/download/', BackupManagementAPIView.as_view(), name='backup_download'),
    path('backups/<str:pk>/delete/', BackupManagementAPIView.as_view(), name='backup_delete'),
    
    # Audit Logs
    path('audit-logs/list/', SettingsAuditLogListAPIView.as_view(), name='audit_logs_list'),
    
    # eTIMS KRA Diagnostic Test
    path('etims/test/', ETimsDiagnosticAPIView.as_view(), name='etims_test'),

    # Section-specific endpoint (must be last to not shadow themes/backups)
    path('<str:section>/', SiteSettingsAPIView.as_view(), name='site_settings_section'),
]

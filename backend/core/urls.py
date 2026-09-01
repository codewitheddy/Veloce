from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView
from apps.users.views import (
    RegisterView,
    SuperuserLoginView,
    CustomerLoginView,
    LogoutView,
    CookieTokenRefreshView,
)
from core.contact_views import ContactMessageView
from core.utility_views import (
    ValidatePaymentView,
    OrderTrackingView,
    VerifyPromoView,
    AuthorizeRefundView,
    PasswordResetView,
    EmailConfigView,
    SendEmailView,
    JobStatusView,
    AsyncSalesReportView,
    AsyncInventoryReportView,
    CustomAdminView,
)

urlpatterns = [
    # Contact Form API Endpoint (Public)
    path('api/contact/', ContactMessageView.as_view(), name='contact_message'),
    path('api/contact', ContactMessageView.as_view(), name='contact_message_no_slash'),

    # Custom Admin Page takes precedence over Django default admin
    path('admin/', CustomAdminView.as_view(), name='custom_admin'),
    path('admin/<path:subpath>', CustomAdminView.as_view(), name='custom_admin_subpath'),
    # Django Built-in Model Admin moved to /django-admin/
    path('django-admin/', admin.site.urls),

    # Auth JWT & Login Endpoints
    path('api/auth/login/', CustomerLoginView.as_view(), name='customer_login'),
    path('api/auth/superuser-login/', SuperuserLoginView.as_view(), name='superuser_login_slash'),
    path('api/auth/superuser-login', SuperuserLoginView.as_view(), name='superuser_login'),
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/logout/', LogoutView.as_view(), name='logout'),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/password-reset/', PasswordResetView.as_view(), name='password_reset'),

    # Core App Domains
    path('api/users/', include('apps.users.urls')),
    path('api/products/', include('products.urls')),
    path('api/orders/', include('apps.orders.urls')),
    path('api/shipping/', include('apps.shipping.urls')),
    path('api/affiliates/', include('apps.affiliates.urls')),
    path('api/content/', include('apps.content.urls')),
    path('api/hero-banners/', include('apps.content.urls_herobanners')),
    path('api/', include('apps.customers.urls')),

    # Security, Payment & Logistics API Utilities
    path('api/payments/validate', ValidatePaymentView.as_view(), name='validate_payment'),
    path('api/orders/track/<str:order_id>', OrderTrackingView.as_view(), name='track_order'),
    path('api/sensitive/verify-promo', VerifyPromoView.as_view(), name='verify_promo'),
    path('api/sensitive/authorize-refund', AuthorizeRefundView.as_view(), name='authorize_refund'),

    # Email Service
    path('api/email/config', EmailConfigView.as_view(), name='email_config'),
    path('api/email/send', SendEmailView.as_view(), name='send_email'),

    # Celery Background Job Status & Async Reports
    path('api/jobs/<str:job_id>/', JobStatusView.as_view(), name='celery_job_status'),
    path('api/reports/sales/', AsyncSalesReportView.as_view(), name='async_sales_report'),
    path('api/reports/inventory/', AsyncInventoryReportView.as_view(), name='async_inventory_report'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

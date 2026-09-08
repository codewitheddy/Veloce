from django.urls import path
from .views import InitiateMpesaStkPushView, MpesaCallbackWebhookView, CheckPaymentStatusView

urlpatterns = [
    path('mpesa/stk-push/', InitiateMpesaStkPushView.as_view(), name='mpesa_stk_push'),
    path('mpesa/callback/', MpesaCallbackWebhookView.as_view(), name='mpesa_callback'),
    path('status/', CheckPaymentStatusView.as_view(), name='payment_status'),
]

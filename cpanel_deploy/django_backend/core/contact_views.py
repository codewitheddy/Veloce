import logging
from django.conf import settings
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from apps.emails.service import send_transactional_email
from apps.emails.events import (
    CONTACT_SUBMITTED_ADMIN,
    CONTACT_SUBMITTED_CUSTOMER,
)

logger = logging.getLogger(__name__)


class ContactMessageView(APIView):
    """
    Public Contact Form Submission Endpoint.
    Validates input, suppresses spam bots via honeypot, and routes inquiries
    through the centralized transactional email engine to ropenixkenya@gmail.com
    (with customer reply_to) and issues an instant customer confirmation auto-reply.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'contact'

    def post(self, request):
        data = request.data or {}

        # 1. Honeypot Anti-Spam Check: If bot fills hidden honeypot field, pretend success without dispatching
        honeypot = data.get('hp_field') or data.get('website') or data.get('company_url')
        if honeypot:
            logger.info("[ContactForm] Honeypot field triggered by automated bot. Silently suppressing delivery.")
            return Response({
                'success': True,
                'message': 'Thank you! Your inquiry has been received.'
            }, status=status.HTTP_200_OK)

        # 2. Extract & Sanitize Form Fields
        name = str(data.get('name', '')).strip()
        email = str(data.get('email', '')).strip()
        phone = str(data.get('phone', '')).strip()
        subject_raw = str(data.get('subject', 'Customer Inquiry')).strip()
        message = str(data.get('message', '')).strip()

        # Sanitize single-line fields to prevent header injection
        name = " ".join(name.splitlines())
        email = "".join(email.splitlines())
        subject_clean = " ".join(subject_raw.splitlines()) or 'General Inquiry'

        # 3. Field Validation
        errors = {}
        if not name:
            errors['name'] = ['Your name is required.']
        if not email:
            errors['email'] = ['Email address is required.']
        else:
            try:
                validate_email(email)
            except ValidationError:
                errors['email'] = ['Please provide a valid email address.']
        if not message:
            errors['message'] = ['Inquiry message is required.']
        elif len(message) < 5:
            errors['message'] = ['Message must be at least 5 characters.']

        if errors:
            return Response({'success': False, 'errors': errors}, status=status.HTTP_400_BAD_REQUEST)

        # 4. Context Payload for Email Templates
        context = {
            'sender_name': name,
            'sender_email': email,
            'sender_phone': phone or '',
            'subject_clean': subject_clean,
            'message': message,
        }

        admin_email = getattr(settings, 'ADMIN_EMAIL', 'ropenixkenya@gmail.com')

        # 5. Dispatch Admin Notification via Centralized Email Service
        admin_result = send_transactional_email(
            event_type=CONTACT_SUBMITTED_ADMIN,
            recipient=admin_email,
            context=context,
            reply_to=email,
            async_send=True,
        )

        logger.info(f"[ContactForm] Dispatched admin alert to {admin_email} (Status: {admin_result.get('status')})")

        # 6. Dispatch Customer Auto-Reply Confirmation via Centralized Email Service
        cust_result = send_transactional_email(
            event_type=CONTACT_SUBMITTED_CUSTOMER,
            recipient=email,
            context=context,
            async_send=True,
        )

        logger.info(f"[ContactForm] Dispatched customer acknowledgment to {email} (Status: {cust_result.get('status')})")

        return Response({
            'success': True,
            'message': 'Thank you! Your message has been sent successfully. We will get back to you shortly.',
            'log_ref': admin_result.get('log_id'),
        }, status=status.HTTP_200_OK)

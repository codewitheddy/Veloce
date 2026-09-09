import hmac
import hashlib
import time
import logging

logger = logging.getLogger(__name__)


def verify_hmac_signature(payload_bytes: bytes, signature_header: str, secret: str, tolerance: int = 300) -> bool:
    """
    Validates HMAC-SHA256 webhook signatures with timestamp replay protection.
    
    Compatible with standard webhook signing formats (e.g. Stripe 't=...,v1=...', GitHub 'sha256=...').
    """
    if not signature_header or not secret:
        return False

    try:
        # Check for timestamped signature (e.g. t=1612345678,v1=...)
        if 't=' in signature_header and 'v1=' in signature_header:
            parts = dict(item.split('=', 1) for item in signature_header.split(','))
            timestamp = int(parts.get('t', 0))
            expected_sig = parts.get('v1', '')

            # Replay attack protection
            if abs(time.time() - timestamp) > tolerance:
                logger.warning("Webhook signature verification failed: Timestamp outside tolerance window.")
                return False

            signed_payload = f"{timestamp}.".encode('utf-8') + payload_bytes
            computed_sig = hmac.new(secret.encode('utf-8'), signed_payload, hashlib.sha256).hexdigest()
            return hmac.compare_digest(computed_sig, expected_sig)

        # Standard raw HMAC-SHA256 signature
        raw_sig = signature_header.replace('sha256=', '').strip()
        computed_sig = hmac.new(secret.encode('utf-8'), payload_bytes, hashlib.sha256).hexdigest()
        return hmac.compare_digest(computed_sig, raw_sig)

    except Exception as exc:
        logger.error(f"Error during webhook signature verification: {exc}")
        return False

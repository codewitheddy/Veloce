import logging
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name='apps.affiliates.tasks.process_affiliate_commission_task',
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def process_affiliate_commission_task(self, order_id: str, affiliate_code: str, order_total: float):
    """
    Computes commission for a partner upon qualifying order placement, logs ledger entry,
    and alerts the affiliate partner asynchronously.
    """
    logger.info(f"[Task {self.request.id}] Processing affiliate commission for Order #{order_id}, code '{affiliate_code}'")
    
    from apps.affiliates.models import AffiliateProfile, CommissionEntry
    
    try:
        affiliate = AffiliateProfile.objects.get(affiliate_code=affiliate_code.strip())
    except AffiliateProfile.DoesNotExist:
        logger.warning(f"[Task {self.request.id}] Affiliate profile for code '{affiliate_code}' not found.")
        return {'status': 'skipped', 'reason': 'code_not_found'}

    tier_rates = {
        'Silver': Decimal('0.10'),
        'Gold': Decimal('0.12'),
        'Platinum': Decimal('0.15'),
    }
    rate_multiplier = tier_rates.get(affiliate.partner_tier, Decimal('0.10'))
    calculated_commission = Decimal(str(order_total)) * rate_multiplier

    # Hold period for returns / chargeback clearance (14 days)
    maturity_date = timezone.now() + timedelta(days=14)

    commission = CommissionEntry.objects.create(
        affiliate=affiliate,
        affiliate_code=affiliate.affiliate_code,
        order_id=order_id,
        order_total=Decimal(str(order_total)),
        commission_rate_snapshot=f"{int(rate_multiplier * 100)}%",
        commission_amount=calculated_commission,
        status='pending',
        pending_until=maturity_date,
    )

    # Increment pending balances
    affiliate.pending_balance += calculated_commission
    affiliate.total_earned += calculated_commission
    affiliate.conversions_count += 1
    affiliate.save()

    # Send email notification to affiliate
    if affiliate.email:
        subject = f"💰 You Earned a New Commission: KSh {calculated_commission:,.2f} | Veloce Partner Portal"
        body = f"""Hello {affiliate.name},

Congratulations! A new order was placed using your partner referral code: {affiliate.affiliate_code}.

Commission Details:
- Order Ref: #{order_id[:8]}
- Order Total: KSh {order_total:,.2f}
- Commission Rate: {int(rate_multiplier * 100)}% ({affiliate.partner_tier} Tier)
- Commission Earned: KSh {calculated_commission:,.2f}
- Status: Pending Clearance (Held until {maturity_date.strftime('%Y-%m-%d')})

Log into your partner portal anytime to review performance analytics.

Best regards,
Veloce Kenya Partner Growth Team
"""
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[affiliate.email],
            fail_silently=True,
        )

    logger.info(f"[Task {self.request.id}] Commission of KSh {calculated_commission} credited to {affiliate.name}")
    return {
        'status': 'success',
        'affiliate_code': affiliate_code,
        'commission_id': commission.id,
        'amount': float(calculated_commission),
    }


@shared_task(
    bind=True,
    name='apps.affiliates.tasks.check_affiliate_commission_maturities_task',
    max_retries=2,
)
def check_affiliate_commission_maturities_task(self):
    """
    Scheduled job that unlocks commissions from 'pending' hold to 'approved' balance
    once the 14-day return window has safely elapsed.
    """
    from apps.affiliates.models import CommissionEntry
    now = timezone.now()
    maturing = CommissionEntry.objects.filter(status='pending', pending_until__lte=now)
    count = 0
    for comm in maturing:
        comm.status = 'approved'
        comm.save()
        count += 1
    logger.info(f"[Task {self.request.id}] Matured {count} affiliate commissions to 'approved'.")
    return {'status': 'success', 'matured_count': count}

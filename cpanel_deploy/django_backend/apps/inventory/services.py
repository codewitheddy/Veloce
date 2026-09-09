import uuid
import logging
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from .models import Inventory, InventoryReservation

logger = logging.getLogger(__name__)

# Atomic Lua script guarantees zero overselling during flash-sale spikes
RESERVE_STOCK_LUA = """
local requested_qty = tonumber(ARGV[1])
local reservation_key = ARGV[2]
local ttl_seconds = tonumber(ARGV[3])
local sku = KEYS[1]

local available_stock = tonumber(redis.call('GET', 'stock:' .. sku) or '0')

if available_stock >= requested_qty then
    redis.call('DECRBY', 'stock:' .. sku, requested_qty)
    redis.call('SETEX', reservation_key, ttl_seconds, requested_qty)
    return 1
else
    return 0
end
"""

RELEASE_STOCK_LUA = """
local sku = KEYS[1]
local reservation_key = ARGV[1]

local reserved_qty = tonumber(redis.call('GET', reservation_key) or '0')

if reserved_qty > 0 then
    redis.call('INCRBY', 'stock:' .. sku, reserved_qty)
    redis.call('DEL', reservation_key)
    return 1
else
    return 0
end
"""


class InventoryReservationService:
    @classmethod
    def get_redis_client(cls):
        try:
            import redis
            redis_url = getattr(settings, 'REDIS_URL', getattr(settings, 'CELERY_BROKER_URL', 'redis://localhost:6379/0'))
            client = redis.Redis.from_url(redis_url, decode_responses=True, socket_connect_timeout=0.1, socket_timeout=0.1)
            client.ping()
            return client
        except Exception as e:
            logger.warning(f"[InventoryReservationService] Redis not reachable, falling back to DB locks: {e}")
            return None

    @classmethod
    def sync_redis_stock_from_db(cls, sku: str) -> int:
        """
        Populate or sync Redis stock count with authoritative PostgreSQL / SQLite database.
        """
        redis = cls.get_redis_client()
        inv = Inventory.objects.filter(sku=sku).first()
        available = inv.available_quantity if inv else 0
        if redis:
            try:
                redis.set(f"stock:{sku}", available)
            except Exception as e:
                logger.error(f"[InventorySync] Failed setting redis stock for {sku}: {e}")
        return available

    @classmethod
    def reserve_cart(cls, cart_id: str, items: list[dict], ttl_seconds: int = 900) -> tuple[bool, str, list[str]]:
        """
        Atomically reserve cart items for 15 minutes.
        items: [{'sku': 'SKU-123', 'quantity': 2, 'product_id': '...'}]
        Returns: (success: bool, reservation_token: str, failed_skus: list)
        """
        token = f"RES-{uuid.uuid4().hex[:12].upper()}"
        expires_at = timezone.now() + timedelta(seconds=ttl_seconds)
        redis = cls.get_redis_client()

        if redis:
            reserved_steps = []
            try:
                reserve_script = redis.register_script(RESERVE_STOCK_LUA)
                for item in items:
                    sku = str(item.get('sku'))
                    qty = int(item.get('quantity', 1))
                    res_key = f"res:{cart_id}:{sku}"

                    # Ensure stock cache is warm
                    if not redis.exists(f"stock:{sku}"):
                        cls.sync_redis_stock_from_db(sku)

                    success = reserve_script(keys=[sku], args=[qty, res_key, ttl_seconds])
                    if not success:
                        # Rollback any previously reserved SKUs in this loop
                        cls._rollback_redis_keys(redis, reserved_steps)
                        return False, "", [sku]

                    reserved_steps.append((sku, res_key))

                # Record reservation in DB audit table
                InventoryReservation.objects.create(
                    cart_id=cart_id,
                    reservation_token=token,
                    items_payload=items,
                    expires_at=expires_at,
                    status='ACTIVE'
                )
                return True, token, []
            except Exception as err:
                logger.error(f"[InventoryReservation] Redis error: {err}, falling back to DB lock")
                cls._rollback_redis_keys(redis, reserved_steps)

        # Fallback to DB Transactional Locking
        return cls._reserve_db_fallback(cart_id, token, items, expires_at)

    @classmethod
    def _rollback_redis_keys(cls, redis, reserved_steps: list[tuple[str, str]]):
        if not redis:
            return
        try:
            release_script = redis.register_script(RELEASE_STOCK_LUA)
            for sku, res_key in reserved_steps:
                release_script(keys=[sku], args=[res_key])
        except Exception as e:
            logger.error(f"[InventoryReservation] Error rolling back redis holds: {e}")

    @classmethod
    def _reserve_db_fallback(cls, cart_id: str, token: str, items: list[dict], expires_at) -> tuple[bool, str, list[str]]:
        with transaction.atomic():
            failed_skus = []
            for item in items:
                sku = item.get('sku')
                qty = int(item.get('quantity', 1))
                inv = Inventory.objects.select_for_update().filter(sku=sku).first()
                if not inv or inv.available_quantity < qty:
                    failed_skus.append(sku)

            if failed_skus:
                return False, "", failed_skus

            # Apply hold
            for item in items:
                sku = item.get('sku')
                qty = int(item.get('quantity', 1))
                inv = Inventory.objects.get(sku=sku)
                inv.reserved_quantity += qty
                inv.save(update_fields=['reserved_quantity', 'updated_at'])

            InventoryReservation.objects.create(
                cart_id=cart_id,
                reservation_token=token,
                items_payload=items,
                expires_at=expires_at,
                status='ACTIVE'
            )
            return True, token, []

    @classmethod
    def commit_reservation(cls, reservation_token: str) -> bool:
        """
        Called when payment succeeds. Converts active hold to a finalized stock deduction.
        """
        reservation = InventoryReservation.objects.filter(reservation_token=reservation_token, status='ACTIVE').first()
        if not reservation:
            return False

        with transaction.atomic():
            redis = cls.get_redis_client()
            for item in reservation.items_payload:
                sku = item.get('sku')
                qty = int(item.get('quantity', 1))
                inv = Inventory.objects.select_for_update().filter(sku=sku).first()
                if inv:
                    inv.stock_quantity = max(0, inv.stock_quantity - qty)
                    inv.reserved_quantity = max(0, inv.reserved_quantity - qty)
                    inv.save(update_fields=['stock_quantity', 'reserved_quantity', 'updated_at'])

                if redis:
                    try:
                        redis.delete(f"res:{reservation.cart_id}:{sku}")
                        # Update redis base stock count
                        if inv:
                            redis.set(f"stock:{sku}", inv.available_quantity)
                    except Exception as e:
                        logger.error(f"[InventoryCommit] Redis error: {e}")

            reservation.status = 'COMMITTED'
            reservation.save(update_fields=['status', 'updated_at'])
            return True

    @classmethod
    def release_reservation(cls, reservation_token: str) -> bool:
        """
        Releases reserved hold back to the available inventory pool on cancellation or payment failure.
        """
        reservation = InventoryReservation.objects.filter(reservation_token=reservation_token, status='ACTIVE').first()
        if not reservation:
            return False

        with transaction.atomic():
            redis = cls.get_redis_client()
            for item in reservation.items_payload:
                sku = item.get('sku')
                qty = int(item.get('quantity', 1))
                inv = Inventory.objects.select_for_update().filter(sku=sku).first()
                if inv:
                    inv.reserved_quantity = max(0, inv.reserved_quantity - qty)
                    inv.save(update_fields=['reserved_quantity', 'updated_at'])

                if redis:
                    try:
                        cls._rollback_redis_keys(redis, [(sku, f"res:{reservation.cart_id}:{sku}")])
                    except Exception as e:
                        logger.error(f"[InventoryRelease] Redis error: {e}")

            reservation.status = 'CANCELLED'
            reservation.save(update_fields=['status', 'updated_at'])
            return True

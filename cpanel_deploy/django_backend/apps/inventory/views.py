from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from .services import InventoryReservationService
from .models import Inventory


class InventoryCheckView(APIView):
    """
    Get live availability for a SKU or list of SKUs.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        sku = request.query_params.get('sku')
        if sku:
            inv = Inventory.objects.filter(sku=sku).first()
            if not inv:
                return Response({"error": "SKU not found", "available": 0}, status=status.HTTP_404_NOT_FOUND)
            return Response({
                "sku": inv.sku,
                "stock_quantity": inv.stock_quantity,
                "reserved_quantity": inv.reserved_quantity,
                "available_quantity": inv.available_quantity,
                "in_stock": inv.available_quantity > 0,
            })
        
        # Multiple SKUs query: ?skus=SKU1,SKU2,SKU3
        skus_param = request.query_params.get('skus', '')
        sku_list = [s.strip() for s in skus_param.split(',') if s.strip()]
        inventories = Inventory.objects.filter(sku__in=sku_list)
        data = {
            inv.sku: {
                "available": inv.available_quantity,
                "in_stock": inv.available_quantity > 0
            }
            for inv in inventories
        }
        return Response(data)


class ReserveCheckoutInventoryView(APIView):
    """
    POST /api/v1/inventory/reserve/
    Atomically reserve cart items for 15 minutes before initiating payment.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        cart_id = request.data.get('cart_id')
        items = request.data.get('items', [])

        if not cart_id or not items:
            return Response(
                {"error": "Both 'cart_id' and non-empty 'items' list are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        success, token, failed_skus = InventoryReservationService.reserve_cart(cart_id, items)
        if not success:
            return Response({
                "success": False,
                "message": "Some items in your cart are currently out of stock or reserved by other shoppers.",
                "failed_skus": failed_skus
            }, status=status.HTTP_409_CONFLICT)

        return Response({
            "success": True,
            "reservation_token": token,
            "expires_in_seconds": 900,
            "message": "Inventory successfully reserved for 15 minutes."
        }, status=status.HTTP_200_OK)


class ReleaseReservationView(APIView):
    """
    POST /api/v1/inventory/release/
    Release a reservation hold back to the pool.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('reservation_token')
        if not token:
            return Response({"error": "'reservation_token' is required."}, status=status.HTTP_400_BAD_REQUEST)

        released = InventoryReservationService.release_reservation(token)
        return Response({
            "success": released,
            "message": "Reservation hold released successfully." if released else "Invalid or expired reservation token."
        })

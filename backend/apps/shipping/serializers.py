from rest_framework import serializers
from .models import ShippingZone, HappyHourWindow

class ShippingZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShippingZone
        fields = '__all__'


class HappyHourWindowSerializer(serializers.ModelSerializer):
    class Meta:
        model = HappyHourWindow
        fields = '__all__'

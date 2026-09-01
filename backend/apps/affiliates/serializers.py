from rest_framework import serializers
from .models import AffiliateProfile, CommissionEntry

class AffiliateProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = AffiliateProfile
        fields = '__all__'


class CommissionEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = CommissionEntry
        fields = '__all__'

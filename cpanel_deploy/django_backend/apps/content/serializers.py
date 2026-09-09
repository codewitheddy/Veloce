from rest_framework import serializers
from .models import (
    BlogPost,
    HeroBanner,
    EmailCampaign,
    CustomServiceRequest,
    SupportTicket,
    TicketMessage
)

class BlogPostSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlogPost
        fields = '__all__'

class HeroBannerSerializer(serializers.ModelSerializer):
    hero_image_full_url = serializers.SerializerMethodField()
    background_image_full_url = serializers.SerializerMethodField()

    class Meta:
        model = HeroBanner
        fields = [
            'id',
            'title',
            'subtitle',
            'description',
            'badge_text',
            'primary_button_text',
            'primary_button_url',
            'secondary_button_text',
            'secondary_button_url',
            'hero_image',
            'hero_image_url',
            'hero_image_full_url',
            'background_type',
            'background_color',
            'background_image',
            'background_image_url',
            'background_image_full_url',
            'background_position',
            'overlay_enabled',
            'overlay_color',
            'overlay_opacity',
            'text_color',
            'is_active',
            'display_order',
            'start_date',
            'end_date',
            'created_at',
            'updated_at',
        ]

    def get_hero_image_full_url(self, obj):
        if obj.hero_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.hero_image.url)
            return obj.hero_image.url
        return obj.hero_image_url or ''

    def get_background_image_full_url(self, obj):
        if obj.background_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.background_image.url)
            return obj.background_image.url
        return obj.background_image_url or ''

    def validate(self, attrs):
        start_date = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end_date = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({"end_date": "End date cannot be earlier than start date."})

        bg_type = attrs.get('background_type', getattr(self.instance, 'background_type', 'color'))
        bg_img = attrs.get('background_image', getattr(self.instance, 'background_image', None))
        bg_url = attrs.get('background_image_url', getattr(self.instance, 'background_image_url', ''))
        if bg_type == 'image' and not bg_img and not bg_url:
            raise serializers.ValidationError({"background_image": "A background image file or URL is required when background type is set to image."})

        return attrs

class EmailCampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailCampaign
        fields = '__all__'

class CustomServiceRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomServiceRequest
        fields = '__all__'

class TicketMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketMessage
        fields = '__all__'

class SupportTicketSerializer(serializers.ModelSerializer):
    messages = TicketMessageSerializer(many=True, read_only=True)

    class Meta:
        model = SupportTicket
        fields = '__all__'

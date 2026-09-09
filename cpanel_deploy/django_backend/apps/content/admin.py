from django.contrib import admin
from django.utils.html import mark_safe
from .models import (
    BlogPost,
    HeroBanner,
    EmailCampaign,
    CustomServiceRequest,
    SupportTicket,
    TicketMessage
)

@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'author', 'is_published', 'published_at')
    list_filter = ('is_published', 'category', 'published_at')
    search_fields = ('title', 'content', 'slug')
    prepopulated_fields = {'slug': ('title',)}

@admin.register(HeroBanner)
class HeroBannerAdmin(admin.ModelAdmin):
    list_display = (
        'thumbnail_preview',
        'title',
        'badge_preview',
        'background_type',
        'is_active',
        'display_order',
        'start_date',
        'end_date',
        'created_at'
    )
    list_editable = ('is_active', 'display_order')
    list_filter = ('is_active', 'background_type', 'overlay_enabled', 'start_date', 'end_date', 'created_at')
    search_fields = ('title', 'subtitle', 'description', 'badge_text', 'primary_button_text', 'secondary_button_text')
    readonly_fields = ('thumbnail_preview_large', 'created_at', 'updated_at')
    date_hierarchy = 'created_at'
    list_per_page = 25

    fieldsets = (
        ('1. Header & Text Content', {
            'fields': (
                'title',
                'subtitle',
                'description',
                'badge_text',
                'text_color',
            ),
            'description': 'Configure the main text, headline, description, and eyebrow badge for the left column.'
        }),
        ('2. Call To Action Buttons', {
            'fields': (
                ('primary_button_text', 'primary_button_url'),
                ('secondary_button_text', 'secondary_button_url'),
            ),
            'description': 'Configure primary and optional secondary action buttons and destination routes.'
        }),
        ('3. Right Column Product / Marketing Image', {
            'fields': (
                'hero_image',
                'hero_image_url',
                'thumbnail_preview_large',
            ),
            'description': 'Upload a product cutout or marketing artwork. Rendered with object-fit: contain.'
        }),
        ('4. Background & Overlay Customizer', {
            'fields': (
                'background_type',
                'background_color',
                'background_image',
                'background_image_url',
                'background_position',
                ('overlay_enabled', 'overlay_color', 'overlay_opacity'),
            ),
            'description': 'Choose between solid color or background image. Fine-tune overlay shade and opacity.'
        }),
        ('5. Scheduling & Visibility Order', {
            'fields': (
                ('is_active', 'display_order'),
                ('start_date', 'end_date'),
                ('created_at', 'updated_at'),
            ),
            'description': 'Control storefront activation, carousel slide ordering, and automated publishing dates.'
        }),
    )

    def thumbnail_preview(self, obj):
        img_src = ''
        if obj.hero_image:
            img_src = obj.hero_image.url
        elif obj.hero_image_url:
            img_src = obj.hero_image_url
        elif obj.background_image:
            img_src = obj.background_image.url
        elif obj.background_image_url:
            img_src = obj.background_image_url

        if img_src:
            return mark_safe(f'<img src="{img_src}" style="width: 60px; height: 38px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1;" />')
        
        bg_col = obj.background_color or '#0f172a'
        return mark_safe(f'<div style="width: 60px; height: 38px; background-color: {bg_col}; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 10px;">Solid</div>')
    
    thumbnail_preview.short_description = 'Preview'

    def badge_preview(self, obj):
        if not obj.badge_text:
            return mark_safe('<span style="color: #94a3b8;">—</span>')
        return mark_safe(f'<span style="background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold;">{obj.badge_text}</span>')
    
    badge_preview.short_description = 'Badge'

    def thumbnail_preview_large(self, obj):
        img_src = ''
        if obj.hero_image:
            img_src = obj.hero_image.url
        elif obj.hero_image_url:
            img_src = obj.hero_image_url

        if img_src:
            return mark_safe(f'<div style="margin: 10px 0;"><img src="{img_src}" style="max-height: 220px; max-width: 360px; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);" /></div>')
        return mark_safe('<span style="color: #64748b;">No hero image uploaded yet.</span>')
    
    thumbnail_preview_large.short_description = 'Uploaded Image Preview'

@admin.register(EmailCampaign)
class EmailCampaignAdmin(admin.ModelAdmin):
    list_display = ('title', 'subject', 'target_segment', 'status', 'recipient_count', 'created_at')
    list_filter = ('status', 'target_segment')

@admin.register(CustomServiceRequest)
class CustomServiceRequestAdmin(admin.ModelAdmin):
    list_display = ('service_type', 'name', 'email', 'estimated_budget', 'status', 'created_at')
    list_filter = ('status', 'service_type')
    search_fields = ('name', 'email', 'requirements')

class TicketMessageInline(admin.TabularInline):
    model = TicketMessage
    extra = 1

@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ('id', 'subject', 'customer_name', 'category', 'priority', 'status', 'updated_at')
    list_filter = ('status', 'priority', 'category')
    search_fields = ('subject', 'customer_name', 'customer_email')
    inlines = [TicketMessageInline]

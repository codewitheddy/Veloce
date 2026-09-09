import uuid
from django.db import models
from django.contrib.auth.models import User


class BlogPost(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=280, unique=True, db_index=True)
    excerpt = models.TextField(blank=True, default='')
    content = models.TextField(help_text="Full markdown or HTML article body")
    author = models.CharField(max_length=100, default='Veloce Editorial Team')
    category = models.CharField(max_length=100, default='E-commerce Guides')
    featured_image = models.URLField(max_length=1024, blank=True, default='')
    read_time = models.CharField(max_length=30, default='4 min read')
    is_published = models.BooleanField(default=True, db_index=True)
    tags = models.JSONField(default=list, blank=True)
    published_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-published_at']
        verbose_name = 'Blog Post'
        verbose_name_plural = 'Blog Posts'

    def __str__(self):
        return f"{self.title} ({self.category})"


from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator


class HeroBanner(models.Model):
    BACKGROUND_TYPE_CHOICES = [
        ('color', 'Solid Color'),
        ('image', 'Background Image'),
    ]

    BACKGROUND_POSITION_CHOICES = [
        ('center', 'Center'),
        ('top', 'Top'),
        ('bottom', 'Bottom'),
        ('left', 'Left'),
        ('right', 'Right'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    
    # Text Content
    title = models.CharField(max_length=255, help_text="Large, compelling primary headline")
    subtitle = models.TextField(blank=True, default='', help_text="Supporting sub-headline or description")
    description = models.TextField(blank=True, default='', help_text="Detailed supporting paragraph")
    badge_text = models.CharField(max_length=100, blank=True, default='', help_text="Optional eyebrow tag or promo badge")
    
    # Call To Action Buttons
    primary_button_text = models.CharField(max_length=100, default='Shop Collection', help_text="Primary CTA button text")
    primary_button_url = models.CharField(max_length=255, default='/products', help_text="Primary CTA destination link or tab")
    secondary_button_text = models.CharField(max_length=100, blank=True, default='', help_text="Optional secondary CTA button text")
    secondary_button_url = models.CharField(max_length=255, blank=True, default='', help_text="Optional secondary CTA destination link")
    
    # Hero/Product Image (Right Column)
    hero_image = models.ImageField(upload_to='hero_banners/', blank=True, null=True, help_text="Marketing or product cutout image")
    hero_image_url = models.URLField(max_length=1024, blank=True, default='', help_text="Fallback direct image URL")
    
    # Background Customization
    background_type = models.CharField(max_length=20, choices=BACKGROUND_TYPE_CHOICES, default='color', help_text="Solid color or background image")
    background_color = models.CharField(max_length=50, default='#0f172a', help_text="Solid background color (hex, e.g. #0f172a)")
    background_image = models.ImageField(upload_to='hero_backgrounds/', blank=True, null=True, help_text="Full background scenery image")
    background_image_url = models.URLField(max_length=1024, blank=True, default='', help_text="Fallback direct background image URL")
    background_position = models.CharField(max_length=50, choices=BACKGROUND_POSITION_CHOICES, default='center', help_text="Background image alignment")
    
    # Overlay Customization
    overlay_enabled = models.BooleanField(default=True, help_text="Enable dark/tint overlay on background image")
    overlay_color = models.CharField(max_length=50, default='#000000', help_text="Overlay color (hex, e.g. #000000)")
    overlay_opacity = models.FloatField(
        default=0.5,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Overlay opacity between 0.0 (transparent) and 1.0 (fully opaque)"
    )
    
    # Styling & Visibility
    text_color = models.CharField(max_length=50, default='#ffffff', help_text="Primary text color (hex, e.g. #ffffff)")
    is_active = models.BooleanField(default=True, db_index=True, help_text="Whether this banner is visible on the storefront")
    display_order = models.IntegerField(default=0, db_index=True, help_text="Display priority order (lowest number appears first)")
    
    # Scheduling
    start_date = models.DateTimeField(null=True, blank=True, help_text="Optional publish schedule start datetime")
    end_date = models.DateTimeField(null=True, blank=True, help_text="Optional publish schedule expiry datetime")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', '-created_at']
        verbose_name = 'Hero Banner'
        verbose_name_plural = 'Hero Banners'

    def __str__(self):
        status = "Active" if self.is_active else "Inactive"
        return f"Banner #{self.display_order}: {self.title} [{status}]"

    def clean(self):
        if self.start_date and self.end_date:
            if self.start_date > self.end_date:
                raise ValidationError({"end_date": "End date cannot be earlier than start date."})

        if self.background_type == 'image' and not self.background_image and not self.background_image_url:
            raise ValidationError({"background_image": "Please upload a background image or provide a background image URL when background type is set to 'Background Image'."})

        if self.overlay_opacity < 0.0 or self.overlay_opacity > 1.0:
            raise ValidationError({"overlay_opacity": "Overlay opacity must be between 0.0 and 1.0."})


class EmailCampaign(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('sent', 'Sent'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    subject = models.CharField(max_length=255)
    target_segment = models.CharField(max_length=100, default='All Active Customers')
    template_type = models.CharField(max_length=50, default='newsletter')
    body_content = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    recipient_count = models.IntegerField(default=0)
    open_rate = models.FloatField(default=0.0)
    click_rate = models.FloatField(default=0.0)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Email Campaign'
        verbose_name_plural = 'Email Campaigns'

    def __str__(self):
        return f"Email: {self.title} [{self.status}]"


class CustomServiceRequest(models.Model):
    STATUS_CHOICES = [
        ('new', 'New Request'),
        ('in_review', 'Under Review'),
        ('contacted', 'Client Contacted'),
        ('resolved', 'Resolved'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True, default='')
    service_type = models.CharField(max_length=100, default='Branded Uniform Printing')
    requirements = models.TextField()
    estimated_budget = models.DecimalField(max_digits=12, decimal_places=2, default=5000.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Custom Service Request'
        verbose_name_plural = 'Custom Service Requests'

    def __str__(self):
        return f"Service Req: {self.service_type} by {self.name}"


class SupportTicket(models.Model):
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]

    STATUS_CHOICES = [
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='support_tickets')
    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField()
    subject = models.CharField(max_length=255)
    category = models.CharField(max_length=100, default='Orders & Shipping')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'Support Ticket'
        verbose_name_plural = 'Support Tickets'

    def __str__(self):
        return f"Ticket #{self.id[:8]} - {self.subject} ({self.priority}) [{self.status}]"


class TicketMessage(models.Model):
    SENDER_TYPE_CHOICES = [
        ('customer', 'Customer'),
        ('support_agent', 'Support Agent'),
        ('system', 'Automated Bot'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='messages')
    sender_name = models.CharField(max_length=255)
    sender_type = models.CharField(max_length=20, choices=SENDER_TYPE_CHOICES, default='customer')
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']
        verbose_name = 'Ticket Message'
        verbose_name_plural = 'Ticket Messages'

    def __str__(self):
        return f"Msg by {self.sender_name} on Ticket #{self.ticket.id[:8]}"

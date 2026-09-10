from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from products.models import ProductCategory, Product, ProductReview, CustomClothingDesign
from apps.shipping.models import ShippingZone, HappyHourWindow, TaxRate
from apps.content.models import BlogPost, HeroBanner, SupportTicket

class Command(BaseCommand):
    help = 'Seeds SQLite database with default sample data for Ropenix Collections'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.SUCCESS("Starting Ropenix Collections SQLite Data Seeding..."))

        # 1. Superuser / Default User
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@ropenix.co.ke',
                'is_staff': True,
                'is_superuser': True
            }
        )
        if created:
            admin_user.set_password('admin123')
            admin_user.save()
            self.stdout.write(self.style.SUCCESS("  [+] Admin user created: admin / admin123"))

        # 2. Product Categories
        categories_data = [
            {'name': 'Footwear', 'slug': 'footwear', 'display_order': 1},
            {'name': 'Outerwear', 'slug': 'outerwear', 'display_order': 2},
            {'name': 'Accessories', 'slug': 'accessories', 'display_order': 3},
            {'name': 'Custom Apparel', 'slug': 'custom-apparel', 'display_order': 4},
        ]
        for c in categories_data:
            ProductCategory.objects.get_or_create(slug=c['slug'], defaults=c)

        # 3. Sample Products
        products_data = [
            {
                'sku': 'ROP-RUN-001',
                'name': 'Ropenix Pro Runner X',
                'slug': 'ropenix-pro-runner-x',
                'category': 'Footwear',
                'price': 12500.00,
                'original_price': 15000.00,
                'stock': 25,
                'rating': 4.9,
                'reviews_count': 128,
                'is_featured': True,
                'image_url': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
                'description': 'High-performance marathon running shoes with responsive carbon-fiber propulsion plate.'
            },
            {
                'sku': 'VEL-JKT-002',
                'name': 'Urban Techshell Waterproof Jacket',
                'slug': 'urban-techshell-waterproof-jacket',
                'category': 'Outerwear',
                'price': 8900.00,
                'original_price': 10500.00,
                'stock': 14,
                'rating': 4.8,
                'reviews_count': 94,
                'is_featured': True,
                'image_url': 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80',
                'description': 'All-weather breathable storm jacket engineered for extreme urban mobility.'
            },
            {
                'sku': 'VEL-ACC-003',
                'name': 'Tactical Minimalist Leather Wallet',
                'slug': 'tactical-minimalist-leather-wallet',
                'category': 'Accessories',
                'price': 3200.00,
                'original_price': 4000.00,
                'stock': 40,
                'rating': 4.7,
                'reviews_count': 62,
                'is_featured': False,
                'image_url': 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80',
                'description': 'RFID-blocking full-grain Kenyan leather wallet with quick card ejector mechanism.'
            }
        ]
        for p in products_data:
            Product.objects.get_or_create(sku=p['sku'], defaults=p)

        # 4. Shipping Zones
        ShippingZone.objects.get_or_create(
            name='Nairobi CBD & Metropolitan',
            defaults={
                'min_distance_km': 0.0,
                'max_distance_km': 15.0,
                'base_fee': 150.00,
                'per_km_rate': 20.00,
                'estimated_delivery_time': '30-45 mins'
            }
        )

        # 5. Happy Hour Window
        HappyHourWindow.objects.get_or_create(
            name='Midday Surge Rush 50% Off Delivery',
            defaults={
                'start_time': '14:00',
                'end_time': '16:00',
                'days_of_week': [1, 2, 3, 4, 5],
                'discount_percentage': 50,
                'description': '50% shipping fee discount during afternoon peak hours'
            }
        )

        # 6. Tax Rate
        TaxRate.objects.get_or_create(
            country='Kenya',
            defaults={
                'tax_name': 'Value Added Tax (VAT)',
                'percentage': 16.00
            }
        )

        # 7. Hero Banners
        HeroBanner.objects.get_or_create(
            title='Next-Gen Performance Gear',
            defaults={
                'subtitle': 'Discover precision-crafted footwear and tactical outerwear engineered for urban athletes.',
                'primary_button_text': 'Explore Best Sellers',
                'primary_button_url': '/products',
                'badge_text': 'NEW ARRIVALS 2026',
                'display_order': 1
            }
        )

        self.stdout.write(self.style.SUCCESS("SQLite Database Seeding Completed Successfully!"))

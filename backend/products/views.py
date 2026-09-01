from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from core.permissions import IsAdminOrReadOnly
from .models import Product, ProductCategory
from .serializers import ProductSerializer, BulkActionSerializer, ProductCategorySerializer


class ProductCategoryViewSet(viewsets.ModelViewSet):
    """
    API endpoint for ProductCategory CRUD and synchronization.
    """
    queryset = ProductCategory.objects.all().order_by('display_order', 'name')
    serializer_class = ProductCategorySerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = ProductCategory.objects.prefetch_related('subcategories').order_by('display_order', 'name')
        status_param = self.request.query_params.get('status', None)
        search_param = self.request.query_params.get('search', None)

        if status_param:
            queryset = queryset.filter(status__iexact=status_param)
        if search_param:
            queryset = queryset.filter(
                Q(name__icontains=search_param) |
                Q(slug__icontains=search_param) |
                Q(description__icontains=search_param)
            )
        return queryset

    def create(self, request, *args, **kwargs):
        # Support both custom ID and auto UUID
        data = request.data.copy()
        if not data.get('id'):
            import uuid
            data['id'] = f"cat_{uuid.uuid4().hex[:10]}"
        
        # If slug not provided, generate from name
        if not data.get('slug') and data.get('name'):
            from django.utils.text import slugify
            data['slug'] = slugify(data['name'])

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            {
                'message': 'Category created successfully.',
                'category': serializer.data
            },
            status=status.HTTP_201_CREATED,
            headers=headers
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'message': 'Category updated successfully.',
            'category': serializer.data
        }, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        cat_name = instance.name
        self.perform_destroy(instance)
        return Response({
            'message': f'Category "{cat_name}" deleted successfully.'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='bulk_sync')
    def bulk_sync(self, request):
        """
        Accepts a list of categories to synchronize with the backend database.
        """
        categories_data = request.data
        if not isinstance(categories_data, list):
            return Response({'error': 'Expected a list of categories.'}, status=status.HTTP_400_BAD_REQUEST)

        valid_ids = [str(item.get('id')) for item in categories_data if item.get('id')]
        from django.utils.text import slugify

        # 1. First pass: Upsert all categories without parent relation to prevent FK order errors
        for item in categories_data:
            cat_id = str(item.get('id', '')).strip()
            if not cat_id:
                continue

            raw_name = (item.get('name') or 'Uncategorized').strip()
            raw_slug = (item.get('slug') or slugify(raw_name) or f"cat-{uuid.uuid4().hex[:6]}").strip()

            # Ensure unique slug among records with different IDs
            candidate_slug = raw_slug
            counter = 1
            while ProductCategory.objects.filter(slug=candidate_slug).exclude(id=cat_id).exists():
                candidate_slug = f"{raw_slug}-{counter}"
                counter += 1

            ProductCategory.objects.update_or_create(
                id=cat_id,
                defaults={
                    'name': raw_name,
                    'slug': candidate_slug,
                    'description': item.get('description', '') or '',
                    'image_url': item.get('imageUrl') or item.get('image_url', '') or '',
                    'status': item.get('status', 'Active') or 'Active',
                    'is_active': (item.get('status', 'Active') == 'Active'),
                    'display_order': item.get('displayOrder') or item.get('display_order', 0) or 0,
                    'previous_slugs': item.get('previousSlugs') or item.get('previous_slugs', []) or [],
                }
            )

        # 2. Second pass: Assign parent relationships
        for item in categories_data:
            cat_id = str(item.get('id', '')).strip()
            parent_id = item.get('parentId') or item.get('parent_id')
            if cat_id and parent_id:
                parent_obj = ProductCategory.objects.filter(id=str(parent_id).strip()).first()
                ProductCategory.objects.filter(id=cat_id).update(parent=parent_obj)
            elif cat_id:
                ProductCategory.objects.filter(id=cat_id).update(parent=None)

        # 3. Clean up records deleted on frontend
        if valid_ids:
            ProductCategory.objects.exclude(id__in=valid_ids).delete()
        elif len(categories_data) == 0:
            ProductCategory.objects.all().delete()

        all_saved = ProductCategory.objects.all().order_by('display_order', 'name')
        return Response({
            'message': f'Synchronized {all_saved.count()} categories successfully.',
            'categories': ProductCategorySerializer(all_saved, many=True).data
        }, status=status.HTTP_200_OK)


class ProductViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows full CRUD operations (Create, Read, Update, Delete)
    for Product instances with proper request validation and bulk action support.
    """
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        from django.db.models import F
        queryset = Product.objects.select_related('category_ref').prefetch_related('reviews').order_by('-created_at')
        
        status_param = self.request.query_params.get('status', None)
        category_param = self.request.query_params.get('category', None)
        type_param = self.request.query_params.get('type', None)
        search_param = self.request.query_params.get('search', None)
        min_price = self.request.query_params.get('min_price', None)
        max_price = self.request.query_params.get('max_price', None)
        is_featured = self.request.query_params.get('is_featured', None)
        on_sale_param = self.request.query_params.get('on_sale', None) or self.request.query_params.get('onSale', None)

        if status_param:
            queryset = queryset.filter(status__iexact=status_param)
        if category_param and category_param.lower() != 'all':
            # Support category lookup by name, slug, or ID, including child subcategories
            cat_obj = ProductCategory.objects.filter(
                Q(name__iexact=category_param) | Q(slug__iexact=category_param) | Q(id=category_param)
            ).first()
            if cat_obj:
                sub_names = list(cat_obj.subcategories.values_list('name', flat=True))
                sub_ids = list(cat_obj.subcategories.values_list('id', flat=True))
                all_names = [cat_obj.name] + sub_names
                all_ids = [cat_obj.id] + sub_ids
                queryset = queryset.filter(
                    Q(category__in=all_names) | Q(category_ref_id__in=all_ids) | Q(category__iexact=category_param)
                )
            else:
                queryset = queryset.filter(category__iexact=category_param)
        if type_param and type_param.lower() != 'all':
            queryset = queryset.filter(type__iexact=type_param)
        if on_sale_param is not None and str(on_sale_param).lower() in ['true', '1', 'yes']:
            queryset = queryset.filter(
                Q(original_price__gt=F('price')) & Q(original_price__isnull=False) & Q(price__gt=0)
            )
        if search_param:
            queryset = queryset.filter(
                Q(name__icontains=search_param) |
                Q(sku__icontains=search_param) |
                Q(description__icontains=search_param) |
                Q(tags__icontains=search_param)
            )
        if min_price:
            try:
                queryset = queryset.filter(price__gte=float(min_price))
            except ValueError:
                pass
        if max_price:
            try:
                queryset = queryset.filter(price__lte=float(max_price))
            except ValueError:
                pass
        if is_featured is not None:
            queryset = queryset.filter(is_featured=(is_featured.lower() in ['true', '1']))

        return queryset

    def create(self, request, *args, **kwargs):
        """
        Create a new product record with request validation.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            {
                'message': 'Product created successfully.',
                'product': serializer.data
            },
            status=status.HTTP_201_CREATED,
            headers=headers
        )

    def update(self, request, *args, **kwargs):
        """
        Update an existing product (PUT / PATCH).
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'message': 'Product updated successfully.',
            'product': serializer.data
        }, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """
        Delete a product record.
        """
        instance = self.get_object()
        product_name = instance.name
        self.perform_destroy(instance)
        return Response({
            'message': f'Product "{product_name}" deleted successfully.'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='bulk_action')
    def bulk_action(self, request):
        """
        Perform batch operations on multiple selected products:
        - 'archive': set status to 'Archived'
        - 'delete': permanently delete selected items
        - 'update_status': set status to specified value
        """
        serializer = BulkActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product_ids = serializer.validated_data['product_ids']
        action_type = serializer.validated_data['action']
        new_status = serializer.validated_data.get('status')

        target_products = Product.objects.filter(id__in=product_ids)
        affected_count = target_products.count()

        if action_type == 'archive':
            target_products.update(status='Archived')
            return Response({
                'message': f'Successfully archived {affected_count} product(s).',
                'affected_count': affected_count,
                'action': 'archive'
            }, status=status.HTTP_200_OK)

        elif action_type == 'delete':
            deleted_info = target_products.delete()
            return Response({
                'message': f'Successfully deleted {affected_count} product(s).',
                'affected_count': affected_count,
                'action': 'delete',
                'details': deleted_info
            }, status=status.HTTP_200_OK)

        elif action_type == 'update_status':
            if not new_status:
                return Response(
                    {'error': "The 'status' field is required when performing 'update_status' action."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            target_products.update(status=new_status)
            return Response({
                'message': f'Successfully updated status to "{new_status}" for {affected_count} product(s).',
                'affected_count': affected_count,
                'action': 'update_status',
                'new_status': new_status
            }, status=status.HTTP_200_OK)

        return Response({'error': 'Unsupported bulk action.'}, status=status.HTTP_400_BAD_REQUEST)

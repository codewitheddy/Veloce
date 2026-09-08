from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAdminUser
from .meili import get_meilisearch_client, INDEX_NAME, configure_meilisearch_indexes
from .tasks import bulk_reindex_all_products_task


class MeiliProductSearchView(APIView):
    """
    GET /api/v1/search/products/?q=hoodie&category=clothing&min_price=1000
    Instant typo-tolerant faceted search.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        category = request.query_params.get('category')
        brand = request.query_params.get('brand')
        min_price = request.query_params.get('min_price')
        max_price = request.query_params.get('max_price')
        in_stock_only = request.query_params.get('in_stock')
        sort_by = request.query_params.get('sort', 'rating:desc')
        page = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 24)), 100)

        # Function for database fallback query
        def run_db_fallback():
            from products.models import Product
            from django.db.models import Q
            qs = Product.objects.filter(status='Active')
            if query:
                qs = qs.filter(Q(name__icontains=query) | Q(description__icontains=query) | Q(tags__icontains=query))
            if category:
                qs = qs.filter(Q(category__iexact=category) | Q(category_ref__slug=category))
            if min_price:
                try: qs = qs.filter(price__gte=float(min_price))
                except: pass
            if max_price:
                try: qs = qs.filter(price__lte=float(max_price))
                except: pass
            if in_stock_only in ('true', '1', 'True'):
                qs = qs.filter(stock__gt=0)
            total = qs.count()
            start = (page - 1) * page_size
            results = list(qs[start:start + page_size].values(
                'id', 'name', 'slug', 'sku', 'category', 'price', 'rating', 'reviews_count', 'image_url', 'stock'
            ))
            for r in results:
                r['brand'] = 'Veloce'
                r['price_kes'] = float(r.get('price') or 0.0)
                r['price_ugx'] = round(r['price_kes'] * 28.5, 2)
                r['price_tzs'] = round(r['price_kes'] * 20.0, 2)
                r['in_stock'] = (r.get('stock') or 0) > 0
            return Response({
                "hits": results,
                "totalHits": total,
                "page": page,
                "pageSize": page_size,
                "source": "database_fallback"
            })

        client = get_meilisearch_client()
        if not client:
            return run_db_fallback()

        # Build Meilisearch filter string
        filters = ['status = "Active"']
        if category:
            filters.append(f'category_slug = "{category}"')
        if brand:
            filters.append(f'brand = "{brand}"')
        if min_price:
            filters.append(f'price_kes >= {min_price}')
        if max_price:
            filters.append(f'price_kes <= {max_price}')
        if in_stock_only in ('true', '1', 'True'):
            filters.append('in_stock = true')

        filter_expr = " AND ".join(filters) if filters else None

        try:
            index = client.index(INDEX_NAME)
            search_res = index.search(query, {
                "filter": filter_expr,
                "facets": ["category_slug", "brand", "in_stock"],
                "sort": [sort_by] if sort_by else ["rating:desc"],
                "limit": page_size,
                "offset": (page - 1) * page_size,
            })
            return Response({
                "hits": search_res.get("hits", []),
                "totalHits": search_res.get("estimatedTotalHits", 0),
                "facetDistribution": search_res.get("facetDistribution", {}),
                "processingTimeMs": search_res.get("processingTimeMs", 0),
                "page": page,
                "pageSize": page_size,
                "source": "meilisearch"
            })
        except Exception:
            # Fallback to database on any connection or indexing error
            return run_db_fallback()


class TriggerReindexView(APIView):
    """
    POST /api/v1/search/reindex/
    Admin endpoint to trigger catalog re-indexing in Celery.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        task = bulk_reindex_all_products_task.delay()
        return Response({
            "success": True,
            "message": "Meilisearch catalog re-index job queued successfully.",
            "task_id": str(task.id)
        })

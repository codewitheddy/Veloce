import logging
from celery import shared_task
from .meili import get_meilisearch_client, INDEX_NAME

logger = logging.getLogger(__name__)


@shared_task(queue="indexing")
def sync_product_to_meilisearch_task(product_id: str):
    """
    Sync or update a single product document in Meilisearch.
    """
    from products.models import Product

    client = get_meilisearch_client()
    if not client:
        return {"status": "skipped_no_meili"}

    product = Product.objects.filter(id=product_id).first()
    index = client.index(INDEX_NAME)

    if not product or getattr(product, 'status', 'Active') != 'Active':
        try:
            index.delete_document(str(product_id))
            return {"status": "deleted", "product_id": product_id}
        except Exception:
            return {"status": "already_deleted", "product_id": product_id}

    # Extract prices
    price_val = float(getattr(product, 'price', 0.0) or 0.0)
    stock_val = int(getattr(product, 'stock', 0) or 0)
    cat_name = product.category.name if product.category else "Uncategorized"
    cat_slug = product.category.slug if product.category else "all"

    doc = {
        "id": str(product.id),
        "name": product.name,
        "slug": getattr(product, 'slug', str(product.id)),
        "sku": getattr(product, 'sku', f"SKU-{product.id}"),
        "brand": getattr(product, 'brand', "Veloce"),
        "category_name": cat_name,
        "category_slug": cat_slug,
        "description": getattr(product, 'description', '')[:500],
        "primary_image": getattr(product, 'image_url', ''),
        "rating": float(getattr(product, 'rating', 5.0) or 5.0),
        "reviews_count": int(getattr(product, 'reviews_count', 0) or 0),
        "is_featured": bool(getattr(product, 'is_featured', False)),
        "in_stock": stock_val > 0,
        "stock_count": stock_val,
        "price_kes": price_val,
        "price_ugx": round(price_val * 28.5, 2),  # Estimated regional rate
        "price_tzs": round(price_val * 20.0, 2),  # Estimated regional rate
        "tags": getattr(product, 'tags', []) if isinstance(getattr(product, 'tags', None), list) else [],
        "created_at": int(product.created_at.timestamp()) if hasattr(product, 'created_at') and product.created_at else 0,
        "status": getattr(product, 'status', 'Active')
    }

    try:
        index.add_documents([doc], primary_key="id")
        return {"status": "indexed", "product_id": product_id}
    except Exception as e:
        logger.error(f"[MeilisearchSync] Failed indexing product #{product_id}: {e}")
        return {"status": "error", "error": str(e)}


@shared_task(queue="indexing")
def bulk_reindex_all_products_task():
    """
    Full catalog reindex for Meilisearch.
    """
    from products.models import Product
    from .meili import configure_meilisearch_indexes

    configure_meilisearch_indexes()
    client = get_meilisearch_client()
    if not client:
        return {"status": "skipped"}

    products = Product.objects.filter(status='Active')
    index = client.index(INDEX_NAME)
    batch = []

    for product in products:
        price_val = float(getattr(product, 'price', 0.0) or 0.0)
        stock_val = int(getattr(product, 'stock', 0) or 0)
        cat_name = product.category.name if product.category else "Uncategorized"
        cat_slug = product.category.slug if product.category else "all"

        doc = {
            "id": str(product.id),
            "name": product.name,
            "slug": getattr(product, 'slug', str(product.id)),
            "sku": getattr(product, 'sku', f"SKU-{product.id}"),
            "brand": getattr(product, 'brand', "Veloce"),
            "category_name": cat_name,
            "category_slug": cat_slug,
            "description": getattr(product, 'description', '')[:500],
            "primary_image": getattr(product, 'image_url', ''),
            "rating": float(getattr(product, 'rating', 5.0) or 5.0),
            "reviews_count": int(getattr(product, 'reviews_count', 0) or 0),
            "is_featured": bool(getattr(product, 'is_featured', False)),
            "in_stock": stock_val > 0,
            "stock_count": stock_val,
            "price_kes": price_val,
            "price_ugx": round(price_val * 28.5, 2),
            "price_tzs": round(price_val * 20.0, 2),
            "tags": getattr(product, 'tags', []) if isinstance(getattr(product, 'tags', None), list) else [],
            "status": getattr(product, 'status', 'Active')
        }
        batch.append(doc)

        if len(batch) >= 1000:
            index.add_documents(batch, primary_key="id")
            batch = []

    if batch:
        index.add_documents(batch, primary_key="id")

    return {"status": "completed", "indexed_count": products.count()}

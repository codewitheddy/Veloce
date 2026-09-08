import logging
from django.conf import settings

logger = logging.getLogger(__name__)

INDEX_NAME = "products_v1"


def get_meilisearch_client():
    try:
        import meilisearch
        url = getattr(settings, 'MEILISEARCH_URL', 'http://localhost:7700')
        master_key = getattr(settings, 'MEILISEARCH_MASTER_KEY', 'meili_master_key_veloce_2026_secure')
        client = meilisearch.Client(url, master_key, timeout=5)
        return client
    except Exception as e:
        logger.warning(f"[Meilisearch] Could not initialize Meilisearch client: {e}")
        return None


def configure_meilisearch_indexes():
    """
    Configures typo tolerance, ranking rules, faceted filters, and search attributes
    tailored for up to 50,000 SKUs.
    """
    client = get_meilisearch_client()
    if not client:
        return False

    try:
        index = client.index(INDEX_NAME)

        # 1. Searchable attributes (ordered by ranking weight)
        index.update_searchable_attributes([
            "name",
            "brand",
            "category_name",
            "sku",
            "description",
            "tags"
        ])

        # 2. Filterable facets for instant drilldowns
        index.update_filterable_attributes([
            "category_slug",
            "brand",
            "price_kes",
            "price_ugx",
            "price_tzs",
            "in_stock",
            "is_featured",
            "status"
        ])

        # 3. Sortable attributes
        index.update_sortable_attributes([
            "price_kes",
            "price_ugx",
            "price_tzs",
            "rating",
            "created_at"
        ])

        # 4. Mobile Typo Tolerance Settings
        index.update_typo_tolerance({
            "enabled": True,
            "minWordSizeForTypos": {
                "oneTypo": 4,
                "twoTypos": 8
            },
            "disableOnWords": ["XL", "XXL", "XS", "KES", "UGX", "TZS"]
        })
        logger.info(f"[Meilisearch] Successfully configured index schema for '{INDEX_NAME}'")
        return True
    except Exception as e:
        logger.error(f"[Meilisearch] Failed configuring schema: {e}")
        return False

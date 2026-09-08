from django.urls import path
from .views import MeiliProductSearchView, TriggerReindexView

urlpatterns = [
    path('products/', MeiliProductSearchView.as_view(), name='search_products'),
    path('reindex/', TriggerReindexView.as_view(), name='search_reindex'),
]

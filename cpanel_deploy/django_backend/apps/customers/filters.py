import django_filters
from .models import Customer, Deal, Invoice


class CustomerFilter(django_filters.FilterSet):
    """
    Custom FilterSet for Customer Model
    - Supports is_registered boolean filter based on user__isnull
    - Supports status filter
    """
    is_registered = django_filters.BooleanFilter(method='filter_is_registered', label='Is Registered User')
    status = django_filters.ChoiceFilter(choices=Customer.STATUS_CHOICES)

    class Meta:
        model = Customer
        fields = ['status', 'is_registered']

    def filter_is_registered(self, queryset, name, value):
        if value is True:
            return queryset.filter(user__isnull=False)
        elif value is False:
            return queryset.filter(user__isnull=True)
        return queryset

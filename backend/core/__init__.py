# This will make sure the app is always imported when
# Django starts so that shared_task will use this app.
from .celery import app as celery_app

# Python 3.14 compatibility patch for Django BaseContext.__copy__
try:
    from django.template import context as _django_context
    def _patched_base_context_copy(self):
        obj = self.__class__.__new__(self.__class__)
        obj.__dict__.update(self.__dict__)
        obj.dicts = self.dicts[:]
        return obj
    _django_context.BaseContext.__copy__ = _patched_base_context_copy
except Exception:
    pass

__all__ = ('celery_app',)

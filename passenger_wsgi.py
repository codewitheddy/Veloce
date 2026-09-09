import os
import sys

# Ensure backend directory is in sys.path
root_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(root_dir, 'backend')

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if root_dir not in sys.path:
    sys.path.insert(1, root_dir)

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_project.settings')

# Import Django WSGI Application entrypoint
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()

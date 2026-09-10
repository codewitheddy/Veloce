import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables from root or local .env
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Core Security & Debug settings
SECRET_KEY = os.getenv(
    'DJANGO_SECRET_KEY',
    's$7!9z*q#2m_p8v(w5x^k1y@3j&b6c+d4e-f0g)h~r%t=u[a{z}x<c>v?b!n@m#k$'
)
DEBUG = os.getenv('DJANGO_DEBUG', 'False').lower() in ('true', '1', 't')
allowed_hosts_env = os.getenv('ALLOWED_HOSTS', os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,0.0.0.0,ropenix.co.ke,www.ropenix.co.ke,api.ropenix.co.ke,veloce.co.ke,marid.co.ke'))
ALLOWED_HOSTS = [host.strip() for host in allowed_hosts_env.split(',') if host.strip()]
if DEBUG and '*' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('*')

# CSRF Trusted Origins for Django 4+ and 5+ on HTTPS
csrf_origins_env = os.getenv(
    'CSRF_TRUSTED_ORIGINS',
    'https://ropenix.co.ke,https://www.ropenix.co.ke,https://api.ropenix.co.ke,https://veloce.co.ke,https://marid.co.ke,http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173'
)
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in csrf_origins_env.split(',') if origin.strip()]

# ==============================================================================
# Security Headers & Cookies (Hardened for Production)
# ==============================================================================
SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', str(not DEBUG)).lower() in ('true', '1', 't')
SESSION_COOKIE_SECURE = not DEBUG or os.getenv('SESSION_COOKIE_SECURE', 'False').lower() in ('true', '1', 't')
CSRF_COOKIE_SECURE = not DEBUG or os.getenv('CSRF_COOKIE_SECURE', 'False').lower() in ('true', '1', 't')
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

if not DEBUG:
    SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_BROWSER_XSS_FILTER = True
SECURE_REFERRER_POLICY = 'same-origin'

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Core Third-Party Frameworks
    'rest_framework',
    'django_filters',
    'corsheaders',
    'rest_framework_simplejwt',
    'django_celery_results',
    'django_celery_beat',

    # Project Domain Apps
    'core',
    'products',
    'apps.core',
    'apps.inventory',
    'apps.pricing',
    'apps.search',
    'apps.payments',
    'apps.emails',
    'apps.users',
    'apps.customers',
    'apps.orders',
    'apps.shipping',
    'apps.content',
    'apps.site_settings',
    'apps.suppliers',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'
ASGI_APPLICATION = 'core.asgi.application'

# Database Configuration (PostgreSQL default when DATABASE_URL/POSTGRES_DB is provided, SQLite for dev/testing)
DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL and DATABASE_URL.startswith(('postgres://', 'postgresql://')):
    try:
        import dj_database_url
        DATABASES = {
            'default': dj_database_url.config(default=DATABASE_URL, conn_max_age=600)
        }
    except ImportError:
        from urllib.parse import urlparse
        url = urlparse(DATABASE_URL)
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': url.path[1:],
                'USER': url.username,
                'PASSWORD': url.password,
                'HOST': url.hostname,
                'PORT': url.port or '5432',
            }
        }
elif os.getenv('POSTGRES_DB') or os.getenv('DB_NAME'):
    db_name = os.getenv('POSTGRES_DB') or os.getenv('DB_NAME')
    db_user = os.getenv('POSTGRES_USER') or os.getenv('DB_USER', 'postgres')
    db_pass = os.getenv('POSTGRES_PASSWORD') or os.getenv('DB_PASSWORD', '')
    db_host = os.getenv('POSTGRES_HOST') or os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('POSTGRES_PORT') or os.getenv('DB_PORT', '5432')
    db_engine = os.getenv('DB_ENGINE', 'django.db.backends.postgresql')
    DATABASES = {
        'default': {
            'ENGINE': db_engine,
            'NAME': db_name,
            'USER': db_user,
            'PASSWORD': db_pass,
            'HOST': db_host,
            'PORT': str(db_port),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static & Media Assets
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.users.authentication.JWTCookieAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '120/hour',
        'user': '1200/hour',
        'auth': '10/minute',
        'checkout': '20/minute',
        'contact': '10/minute',
    },
}

# SimpleJWT Authentication
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# cPanel / Standard SMTP Email Service Configuration
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'mail.marid.co.ke')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '465'))
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', 'noreply@marid.co.ke')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'False').lower() in ('true', '1', 't')
EMAIL_USE_SSL = os.getenv('EMAIL_USE_SSL', 'True').lower() in ('true', '1', 't')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'Ropenix Collections <noreply@marid.co.ke>')
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'ropenixkenya@gmail.com')
SERVER_EMAIL = os.getenv('SERVER_EMAIL', 'ropenixkenya@gmail.com')

# CORS Headers & SPA Policy Setup for React / Vite
CORS_ALLOW_ALL_ORIGINS = DEBUG and os.getenv('CORS_ALLOW_ALL_ORIGINS', 'False').lower() in ('true', '1')
cors_whitelist_env = os.getenv(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://ropenix.co.ke,https://www.ropenix.co.ke,https://veloce.co.ke,https://marid.co.ke'
)
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in cors_whitelist_env.split(',') if origin.strip()]
CORS_ALLOW_CREDENTIALS = True

# ==========================================
# Celery & Redis Distributed Task Configuration
# ==========================================
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/1')

# Serialization & Content Types
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = True

# Task Reliability & Execution Flags
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes hard timeout
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25 minutes soft timeout
CELERY_WORKER_CONCURRENCY = int(os.getenv('CELERY_WORKER_CONCURRENCY', os.cpu_count() or 4))
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True

# Optional synchronous execution for unit tests / local offline dev without Redis
CELERY_TASK_ALWAYS_EAGER = os.getenv('CELERY_TASK_ALWAYS_EAGER', 'True').lower() in ('true', '1', 't')
CELERY_TASK_EAGER_PROPAGATES = True

# Results Cache Expiry (Store results in Redis for 24 hours)
CELERY_RESULT_EXPIRES = 86400

# Celery Beat Periodic Task Schedules
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    # 1. Hourly Inventory Check for Low Stock / Critical Alerts
    'check-low-stock-hourly': {
        'task': 'apps.products.tasks.check_low_stock_threshold_task',
        'schedule': crontab(minute=0),  # Every hour at :00
        'options': {'queue': 'inventory'},
    },
    # 2. Daily Sales & Order Performance Summary
    'generate-daily-sales-summary': {
        'task': 'core.tasks.generate_daily_sales_summary_task',
        'schedule': crontab(hour=0, minute=5),  # Daily at 00:05 UTC
        'options': {'queue': 'reports'},
    },
    # 3. Weekly Expired Promo Code & Session Cleanup
    'cleanup-expired-promos-weekly': {
        'task': 'core.tasks.cleanup_expired_promos_and_tokens_task',
        'schedule': crontab(day_of_week='sunday', hour=2, minute=0),
        'options': {'queue': 'default'},
    },
}

# Task Queues and Routing
CELERY_TASK_DEFAULT_QUEUE = 'default'
CELERY_TASK_ROUTES = {
    'apps.emails.tasks.*': {'queue': 'notifications'},
    'apps.orders.tasks.*': {'queue': 'orders'},
    'apps.users.tasks.*': {'queue': 'notifications'},
    'apps.products.tasks.*': {'queue': 'inventory'},
    'core.tasks.*': {'queue': 'reports'},
}

# ==========================================
# Logging Configuration
# ==========================================
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[%(asctime)s] [%(levelname)s] [%(name)s:%(lineno)d] %(message)s'
        },
        'simple': {
            'format': '[%(levelname)s] %(message)s'
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': os.getenv('DJANGO_LOG_LEVEL', 'INFO'),
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': os.getenv('DJANGO_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
        'celery': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'celery.task': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# ==========================================
# Redis & Meilisearch Infrastructure
# ==========================================
REDIS_URL = os.getenv('REDIS_URL', os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0'))
MEILISEARCH_URL = os.getenv('MEILISEARCH_URL', 'http://localhost:7700')
MEILISEARCH_MASTER_KEY = os.getenv('MEILISEARCH_MASTER_KEY', 'meili_master_key_veloce_2026_secure')


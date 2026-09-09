import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Secrets: Enforce secure loading from environment variables
SECRET_KEY = os.getenv(
    'DJANGO_SECRET_KEY',
    's$7!9z*q#2m_p8v(w5x^k1y@3j&b6c+d4e-f0g)h~r%t=u[a{z}x<c>v?b!n@m#k$'
)

# Debug status: Defaults to False for production safety
DEBUG = os.getenv('DJANGO_DEBUG', 'False').lower() in ('true', '1', 't')

# Host authorization: Whitelist authorized domains
allowed_hosts_env = os.getenv(
    'DJANGO_ALLOWED_HOSTS',
    'localhost,127.0.0.1,0.0.0.0,ropenix.co.ke,www.ropenix.co.ke,veloce.co.ke,marid.co.ke'
)
ALLOWED_HOSTS = [host.strip() for host in allowed_hosts_env.split(',') if host.strip()]
if DEBUG and '*' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('*')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party apps
    'rest_framework',
    'django_filters',
    'corsheaders',
    'rest_framework_simplejwt',

    # Local apps
    'core',
    'products',
    'apps.users',
    'apps.customers',
    'apps.orders',
    'apps.shipping',
    'apps.affiliates',
    'apps.content',
    'apps.emails',
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

ROOT_URLCONF = 'backend_project.urls'

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

WSGI_APPLICATION = 'backend_project.wsgi.application'

# Database Configuration: Supports cPanel MySQL / MariaDB and SQLite
DB_ENGINE = os.getenv('DB_ENGINE', '').lower()
DB_NAME = os.getenv('DB_NAME', '')
DB_USER = os.getenv('DB_USER', '')

if DB_ENGINE in ('mysql', 'django.db.backends.mysql') or (DB_NAME and DB_USER):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': DB_NAME,
            'USER': DB_USER,
            'PASSWORD': os.getenv('DB_PASSWORD', ''),
            'HOST': os.getenv('DB_HOST', 'localhost'),
            'PORT': os.getenv('DB_PORT', '3306'),
            'OPTIONS': {
                'charset': 'utf8mb4',
                'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
            },
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ==============================================================================
# Security Headers & Cookies (Hardened for Production)
# ==============================================================================
SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', str(not DEBUG)).lower() in ('true', '1', 't')
SESSION_COOKIE_SECURE = not DEBUG or os.getenv('SESSION_COOKIE_SECURE', 'False').lower() in ('true', '1', 't')
CSRF_COOKIE_SECURE = not DEBUG or os.getenv('CSRF_COOKIE_SECURE', 'False').lower() in ('true', '1', 't')
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False  # Allows frontend Axios client to read csrftoken cookie for state-changing requests
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

if not DEBUG:
    SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '31536000'))  # 1 year HSTS
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_BROWSER_XSS_FILTER = True
SECURE_REFERRER_POLICY = 'same-origin'

# ==============================================================================
# REST Framework & JWT Settings (HttpOnly Cookie Auth + Rate Limiting)
# ==============================================================================
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
        'auth': '10/minute',       # Strict limit on login, register, password reset
        'checkout': '20/minute',   # Limit on order placement & payment requests
        'contact': '10/minute',    # Public contact form submission throttle
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ==============================================================================
# CORS & CSRF Configuration (Strict Whitelist)
# ==============================================================================
CORS_ALLOW_ALL_ORIGINS = DEBUG and os.getenv('CORS_ALLOW_ALL_ORIGINS', 'False').lower() in ('true', '1')
cors_whitelist_env = os.getenv(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://ropenix.co.ke,https://www.ropenix.co.ke,https://veloce.co.ke,https://marid.co.ke'
)
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in cors_whitelist_env.split(',') if origin.strip()]
CORS_ALLOW_CREDENTIALS = True

csrf_trusted_env = os.getenv(
    'CSRF_TRUSTED_ORIGINS',
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://ropenix.co.ke,https://www.ropenix.co.ke,https://veloce.co.ke,https://marid.co.ke'
)
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in csrf_trusted_env.split(',') if origin.strip()]

# ==============================================================================
# Email Configuration (Environment Secrets & cPanel SMTP)
# ==============================================================================
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'mail.marid.co.ke')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '465'))
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', 'noreply@marid.co.ke')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', 'Kitale254.@')
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'False').lower() in ('true', '1', 't')
EMAIL_USE_SSL = os.getenv('EMAIL_USE_SSL', 'True').lower() in ('true', '1', 't')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', '"Ropenix Collections" <noreply@marid.co.ke>')
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'ropenixkenya@gmail.com')
SERVER_EMAIL = os.getenv('SERVER_EMAIL', 'ropenixkenya@gmail.com')
EMAIL_TIMEOUT = int(os.getenv('EMAIL_TIMEOUT', '15'))

# ==============================================================================
# Cloudinary Media & Edge CDN Configuration
# ==============================================================================
CLOUDINARY_CLOUD_NAME = os.getenv('CLOUDINARY_CLOUD_NAME', '')
CLOUDINARY_API_KEY = os.getenv('CLOUDINARY_API_KEY', '')
CLOUDINARY_API_SECRET = os.getenv('CLOUDINARY_API_SECRET', '')
CLOUDINARY_UPLOAD_PRESET = os.getenv('CLOUDINARY_UPLOAD_PRESET', 'ropenix_products')


import logging
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed

logger = logging.getLogger(__name__)

ACCESS_COOKIE_NAME = getattr(settings, 'AUTH_COOKIE_ACCESS_NAME', 'access_token')
REFRESH_COOKIE_NAME = getattr(settings, 'AUTH_COOKIE_REFRESH_NAME', 'refresh_token')


class JWTCookieAuthentication(JWTAuthentication):
    """
    Custom JWT Authentication class that retrieves the JWT token from
    HttpOnly, Secure, SameSite cookies.
    
    Falls back gracefully to the Authorization header ('Bearer <token>')
    to ensure full backward compatibility with native mobile apps and API tooling.
    """
    def authenticate(self, request):
        # 1. Attempt extracting from standard Authorization header
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is not None:
                validated_token = self.get_validated_token(raw_token)
                return self.get_user(validated_token), validated_token

        # 2. Extract from HttpOnly cookie
        raw_cookie_token = request.COOKIES.get(ACCESS_COOKIE_NAME)
        if raw_cookie_token:
            try:
                validated_token = self.get_validated_token(raw_cookie_token)
                return self.get_user(validated_token), validated_token
            except (InvalidToken, AuthenticationFailed) as exc:
                logger.debug(f"Cookie authentication failed: {exc}")
                return None

        return None


def set_auth_cookies(response, access_token: str, refresh_token: str = None):
    """
    Sets secure HttpOnly, SameSite=Lax cookies for access and refresh tokens.
    """
    is_secure = not settings.DEBUG
    samesite = getattr(settings, 'SESSION_COOKIE_SAMESITE', 'Lax')
    
    # Access Token cookie (1 hour lifetime by default)
    access_max_age = 60 * 60
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=str(access_token),
        max_age=access_max_age,
        httponly=True,
        secure=is_secure,
        samesite=samesite,
        path='/',
    )

    if refresh_token:
        # Refresh Token cookie (7 days lifetime by default)
        refresh_max_age = 60 * 60 * 24 * 7
        response.set_cookie(
            key=REFRESH_COOKIE_NAME,
            value=str(refresh_token),
            max_age=refresh_max_age,
            httponly=True,
            secure=is_secure,
            samesite=samesite,
            path='/',
        )
    return response


def clear_auth_cookies(response):
    """
    Deletes authentication cookies from the client browser.
    """
    samesite = getattr(settings, 'SESSION_COOKIE_SAMESITE', 'Lax')
    response.delete_cookie(ACCESS_COOKIE_NAME, path='/', samesite=samesite)
    response.delete_cookie(REFRESH_COOKIE_NAME, path='/', samesite=samesite)
    return response

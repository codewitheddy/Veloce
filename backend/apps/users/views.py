import logging
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .serializers import UserSerializer, RegisterSerializer
from .models import UserProfile
from .authentication import set_auth_cookies, clear_auth_cookies, REFRESH_COOKIE_NAME

logger = logging.getLogger(__name__)


class SuperuserLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        username_or_email = str(request.data.get('username', '')).strip()
        password = str(request.data.get('password', ''))

        if not username_or_email or not password:
            return Response({'error': 'Username/email and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Allow login by email or username
        user = authenticate(request, username=username_or_email, password=password)
        if user is None and '@' in username_or_email:
            try:
                user_obj = User.objects.get(email__iexact=username_or_email)
                user = authenticate(request, username=user_obj.username, password=password)
            except User.DoesNotExist:
                pass

        if user is None:
            return Response({'error': 'Invalid username or password.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not (user.is_superuser or user.is_staff):
            return Response({'error': 'Access denied: User does not have Django Superuser or Staff privileges.'}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        user_data = UserSerializer(user).data

        response = Response({
            'success': True,
            'message': 'Superuser authenticated successfully.',
            'access': access_token,
            'refresh': refresh_token,
            'user': user_data
        }, status=status.HTTP_200_OK)

        # Attach secure HttpOnly cookies to response
        return set_auth_cookies(response, access_token, refresh_token)


class CustomerLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        username_or_email = str(request.data.get('username', '') or request.data.get('email', '')).strip()
        password = str(request.data.get('password', ''))

        if not username_or_email or not password:
            return Response({'error': 'Email/username and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, username=username_or_email, password=password)
        if user is None and '@' in username_or_email:
            try:
                user_obj = User.objects.get(email__iexact=username_or_email)
                user = authenticate(request, username=user_obj.username, password=password)
            except User.DoesNotExist:
                pass

        if user is None:
            return Response({'error': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        user_data = UserSerializer(user).data

        response = Response({
            'success': True,
            'message': 'Logged in successfully.',
            'access': access_token,
            'refresh': refresh_token,
            'user': user_data
        }, status=status.HTTP_200_OK)

        return set_auth_cookies(response, access_token, refresh_token)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            from django.db import transaction
            from .tasks import send_welcome_email_task

            user = serializer.save()
            user_id = user.id
            
            # Enqueue asynchronous welcome email task safely on transaction commit
            transaction.on_commit(
                lambda: send_welcome_email_task.delay(user_id)
            )

            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)
            user_data = UserSerializer(user).data
            
            response = Response({
                'message': 'User registered successfully.',
                'access': access_token,
                'refresh': refresh_token,
                'user': user_data
            }, status=status.HTTP_201_CREATED)

            return set_auth_cookies(response, access_token, refresh_token)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        response = Response({
            'success': True,
            'message': 'Logged out successfully. Authentication cookies cleared.'
        }, status=status.HTTP_200_OK)
        return clear_auth_cookies(response)


class CookieTokenRefreshView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        raw_refresh = request.data.get('refresh') or request.COOKIES.get(REFRESH_COOKIE_NAME)
        if not raw_refresh:
            return Response({'error': 'Refresh token not found in payload or cookies.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            refresh = RefreshToken(raw_refresh)
            access_token = str(refresh.access_token)
            
            response = Response({
                'access': access_token,
            }, status=status.HTTP_200_OK)

            return set_auth_cookies(response, access_token)
        except (InvalidToken, TokenError) as exc:
            return Response({'error': str(exc)}, status=status.HTTP_401_UNAUTHORIZED)


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Anti-IDOR Protection: Non-staff users can only query their own user record.
        """
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return User.objects.all()
        return User.objects.filter(id=user.id)

    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        user = request.user
        if request.method == 'GET':
            serializer = self.get_serializer(user)
            return Response(serializer.data)

        # PUT / PATCH handling
        first_name = request.data.get('first_name', user.first_name)
        last_name = request.data.get('last_name', user.last_name)
        email = request.data.get('email', user.email)

        user.first_name = first_name
        user.last_name = last_name
        user.email = email
        user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        phone = request.data.get('phone_number') or request.data.get('phone')
        if phone is not None:
            profile.phone_number = str(phone).strip()
        if 'avatar_url' in request.data:
            profile.avatar_url = request.data['avatar_url']
        address = request.data.get('address_line1') or request.data.get('address') or request.data.get('shipping_address') or request.data.get('location')
        if address is not None:
            profile.address_line1 = str(address).strip()
        profile.save()

        # Synchronize with Customer CRM
        try:
            from apps.customers.models import Customer
            customer = Customer.objects.filter(user=user).first() or Customer.objects.filter(email__iexact=user.email).first()
            if customer:
                customer_fields = []
                if phone is not None and customer.phone != str(phone).strip():
                    customer.phone = str(phone).strip()
                    customer_fields.append('phone')
                if address is not None and customer.location != str(address).strip():
                    customer.location = str(address).strip()
                    customer_fields.append('location')
                if customer_fields:
                    customer.save(update_fields=customer_fields)
        except Exception:
            pass

        serializer = self.get_serializer(user)
        return Response({
            'message': 'User profile updated successfully.',
            'user': serializer.data
        }, status=status.HTTP_200_OK)


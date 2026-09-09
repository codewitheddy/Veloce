from rest_framework import permissions


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom permission to allow read-only access (GET, HEAD, OPTIONS) to any user,
    while restricting write, modify, and delete operations strictly to Staff or Superuser admins.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and (request.user.is_staff or request.user.is_superuser))


class IsStaffOrSuperuser(permissions.BasePermission):
    """
    Requires the user to be authenticated and possess Staff or Superuser privileges.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.is_staff or request.user.is_superuser))


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Object-level permission allowing access if the user is a Staff admin,
    or if the object belongs to the requesting user.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff or request.user.is_superuser:
            return True
        
        # Check direct user relationship
        if hasattr(obj, 'user') and obj.user == request.user:
            return True

        # Check matching customer email
        if hasattr(obj, 'customer_email') and str(obj.customer_email).lower() == str(request.user.email).lower():
            return True

        return False

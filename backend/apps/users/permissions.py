from rest_framework import permissions
from .models import UserRole

class BaseOrganizationPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_active)


class IsAdminUserRole(BaseOrganizationPermission):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.is_admin


class CanManageUsers(BaseOrganizationPermission):
    """Only administrators can access user management."""
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.is_admin


class IsProductionManagerOrAdmin(BaseOrganizationPermission):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.role in (UserRole.ADMIN, UserRole.PRODUCTION_MANAGER) or request.user.is_superuser


class IsStorekeeperOrAbove(BaseOrganizationPermission):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.role in (UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.STOREKEEPER) or request.user.is_superuser


class CanAccessCostingReports(BaseOrganizationPermission):
    """Only Admin and Production Manager can view financial/costing data."""
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.role in (UserRole.ADMIN, UserRole.PRODUCTION_MANAGER) or request.user.is_superuser


class HasProductionOrderAccess(BaseOrganizationPermission):
    """
    Object-level permission for ProductionOrder:
    - Admin, Production Manager, Storekeeper, Viewer: access if in same organization
    - Operator: access only if currently actively assigned to the order
    """
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False

        if obj.organization_id != user.organization_id:
            return False

        if user.role in (UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.STOREKEEPER, UserRole.VIEWER) or user.is_superuser:
            # Read-only check for Viewer
            if user.role == UserRole.VIEWER and request.method not in permissions.SAFE_METHODS:
                return False
            return True

        if user.role == UserRole.OPERATOR:
            # Operator can only access if actively assigned
            is_assigned = obj.assignments.filter(user=user, is_active=True).exists()
            if not is_assigned:
                return False
            # Operator can only perform safe methods or specific reporting actions
            return True

        return False

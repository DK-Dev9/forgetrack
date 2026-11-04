from django.db import models
from django.contrib.auth import login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import generics, status, views, permissions
from rest_framework.response import Response
from .models import User, UserRole
from .serializers import (
    UserDetailSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    LoginSerializer
)
from .permissions import CanManageUsers, IsAdminUserRole
from apps.audit.services import log_audit_event

class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        login(request, user)

        log_audit_event(
            action="USER_LOGIN",
            entity_type="User",
            entity_id=str(user.id),
            actor=user,
            organization=user.organization,
            description=f"User {user.email} logged in successfully.",
            ip_address=request.META.get('REMOTE_ADDR')
        )

        return Response(UserDetailSerializer(user).data)


class LogoutView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        log_audit_event(
            action="USER_LOGOUT",
            entity_type="User",
            entity_id=str(user.id),
            actor=user,
            organization=user.organization,
            description=f"User {user.email} logged out.",
            ip_address=request.META.get('REMOTE_ADDR')
        )
        logout(request)
        return Response({"detail": "Successfully logged out."})


class MeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)


class UserListCreateView(generics.ListCreateAPIView):
    permission_classes = [CanManageUsers]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.filter(organization=user.organization).select_related('organization')
        
        # Search filter
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                models.Q(full_name__icontains=search) |
                models.Q(email__icontains=search) |
                models.Q(employee_code__icontains=search)
            )

        # Role filter
        role = self.request.query_params.get('role', '').strip()
        if role and role in UserRole.values:
            qs = qs.filter(role=role)

        # Active filter
        is_active = self.request.query_params.get('is_active')
        if is_active in ('true', 'false', '1', '0'):
            qs = qs.filter(is_active=(is_active in ('true', '1')))

        return qs

    def perform_create(self, serializer):
        user = serializer.save()
        log_audit_event(
            action="USER_CREATED",
            entity_type="User",
            entity_id=str(user.id),
            actor=self.request.user,
            organization=self.request.user.organization,
            description=f"Created user {user.full_name} ({user.email}) with role {user.role}",
            after_state={"email": user.email, "role": user.role, "is_active": user.is_active}
        )


class UserDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [CanManageUsers]
    lookup_field = 'id'

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return UserUpdateSerializer
        return UserDetailSerializer

    def get_queryset(self):
        return User.objects.filter(organization=self.request.user.organization)

    def perform_update(self, serializer):
        old_user = self.get_object()
        before_state = {
            "full_name": old_user.full_name,
            "role": old_user.role,
            "is_active": old_user.is_active,
            "department": old_user.department,
        }
        user = serializer.save()
        after_state = {
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
            "department": user.department,
        }
        log_audit_event(
            action="USER_UPDATED",
            entity_type="User",
            entity_id=str(user.id),
            actor=self.request.user,
            organization=self.request.user.organization,
            description=f"Updated details for user {user.full_name} ({user.email})",
            before_state=before_state,
            after_state=after_state
        )


class ToggleUserActiveView(views.APIView):
    permission_classes = [CanManageUsers]

    def post(self, request, id):
        try:
            target_user = User.objects.get(id=id, organization=request.user.organization)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if target_user.id == request.user.id:
            return Response({"detail": "You cannot activate or deactivate your own account."}, status=status.HTTP_400_BAD_REQUEST)

        target_user.is_active = not target_user.is_active
        target_user.save(update_fields=['is_active', 'updated_at'])

        action_name = "USER_ACTIVATED" if target_user.is_active else "USER_DEACTIVATED"
        log_audit_event(
            action=action_name,
            entity_type="User",
            entity_id=str(target_user.id),
            actor=request.user,
            organization=request.user.organization,
            description=f"{action_name.replace('_', ' ').title()}: {target_user.full_name} ({target_user.email})",
            after_state={"is_active": target_user.is_active}
        )

        return Response(UserDetailSerializer(target_user).data)

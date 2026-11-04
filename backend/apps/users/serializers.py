from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, UserRole
from apps.organizations.models import Organization

class OrganizationSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['id', 'name', 'slug', 'is_active']


class UserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'role']


class UserDetailSerializer(serializers.ModelSerializer):
    organization = OrganizationSummarySerializer(read_only=True)
    assigned_orders_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'full_name',
            'role',
            'employee_code',
            'department',
            'phone_number',
            'is_active',
            'organization',
            'assigned_orders_count',
            'last_login',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'last_login', 'created_at', 'updated_at', 'organization']

    def get_assigned_orders_count(self, obj) -> int:
        return obj.production_assignments.filter(is_active=True).count()


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'full_name',
            'role',
            'employee_code',
            'department',
            'phone_number',
            'is_active',
            'password',
        ]

    def validate_email(self, value):
        org = self.context['request'].user.organization
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email address already exists.")
        return value.lower()

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        request_user = self.context['request'].user
        user = User(
            organization=request_user.organization,
            **validated_data
        )
        if password:
            user.set_password(password)
        else:
            # Default dev password for convenience if not provided
            user.set_password("ForgeTrackDemo123!")
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'full_name',
            'role',
            'employee_code',
            'department',
            'phone_number',
            'is_active',
        ]


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get('email', '').lower()
        password = attrs.get('password')

        user = authenticate(
            request=self.context.get('request'),
            username=email,
            password=password
        )

        if not user:
            try:
                inactive_user = User.objects.get(email=email)
                if not inactive_user.is_active and inactive_user.check_password(password):
                    raise serializers.ValidationError("This user account has been deactivated.")
            except User.DoesNotExist:
                pass
            raise serializers.ValidationError("Invalid email or password.")

        attrs['user'] = user
        return attrs

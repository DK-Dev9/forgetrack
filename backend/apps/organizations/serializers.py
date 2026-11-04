from rest_framework import serializers
from .models import Organization

class OrganizationSerializer(serializers.ModelSerializer):
    users_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = ['id', 'name', 'slug', 'is_active', 'users_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'slug']

    def get_users_count(self, obj) -> int:
        return obj.users.count()

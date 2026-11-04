from rest_framework import serializers
from .models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.full_name', read_only=True)
    actor_email = serializers.CharField(source='actor.email', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'action',
            'entity_type',
            'entity_id',
            'actor',
            'actor_name',
            'actor_email',
            'description',
            'before_state',
            'after_state',
            'ip_address',
            'created_at',
        ]

import logging
from .models import AuditLog

logger = logging.getLogger(__name__)

def log_audit_event(
    action: str,
    entity_type: str,
    entity_id: str,
    actor=None,
    organization=None,
    description: str = "",
    before_state: dict = None,
    after_state: dict = None,
    ip_address: str = None
):
    try:
        org = organization
        if not org and actor and hasattr(actor, 'organization'):
            org = actor.organization

        return AuditLog.objects.create(
            organization=org,
            actor=actor if (actor and actor.is_authenticated) else None,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            description=description,
            before_state=before_state,
            after_state=after_state,
            ip_address=ip_address
        )
    except Exception as e:
        logger.error(f"Failed to record audit log: {e}")
        return None

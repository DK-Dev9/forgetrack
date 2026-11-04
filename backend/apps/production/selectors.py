from apps.production.models import ProductionOrder
from apps.users.models import UserRole

def get_authorized_production_orders(user):
    """
    Returns production orders scoped strictly to the user's role and organization.
    - Operator: only orders where user has an active assignment.
    - Storekeeper, Manager, Admin, Viewer: all organization orders.
    """
    if not user or not user.is_authenticated or not user.is_active:
        return ProductionOrder.objects.none()

    if user.is_superuser:
        return ProductionOrder.objects.all()

    if not user.organization_id:
        return ProductionOrder.objects.none()

    base_qs = ProductionOrder.objects.filter(organization_id=user.organization_id)

    if user.role == UserRole.OPERATOR:
        return base_qs.filter(
            assignments__user=user,
            assignments__is_active=True
        ).distinct()

    return base_qs

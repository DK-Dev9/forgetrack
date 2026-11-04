from decimal import Decimal
from django.db import models
from django.utils import timezone
from rest_framework import generics, views, status, permissions
from rest_framework.response import Response
from .models import (
    ProductionOrder,
    OrderStatus,
    OrderPriority,
    ProductionOrderAssignment,
    ProductionOrderComponent,
)
from .serializers import (
    ProductionOrderListSerializer,
    ProductionOrderDetailSerializer,
    ProductionOrderCreateSerializer,
    ProductionOrderAssignmentSerializer,
    ProductionConsumptionReportSerializer,
    ProductionOutputReportSerializer,
)
from .selectors import get_authorized_production_orders
from .services import ProductionService
from apps.users.permissions import (
    IsProductionManagerOrAdmin,
    IsStorekeeperOrAbove,
    HasProductionOrderAccess,
)
from apps.users.models import User, UserRole

class ProductionOrderListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ProductionOrderCreateSerializer
        return ProductionOrderListSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsProductionManagerOrAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = get_authorized_production_orders(self.request.user).select_related(
            'product', 'product__unit_of_measure', 'primary_assignee'
        )

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                models.Q(order_number__icontains=search) |
                models.Q(product__code__icontains=search) |
                models.Q(product__name__icontains=search)
            )

        status_param = self.request.query_params.get('status')
        if status_param and status_param in OrderStatus.values:
            qs = qs.filter(status=status_param)

        priority_param = self.request.query_params.get('priority')
        if priority_param and priority_param in OrderPriority.values:
            qs = qs.filter(priority=priority_param)

        assigned_to_me = self.request.query_params.get('assigned_to_me')
        if assigned_to_me in ('true', '1'):
            qs = qs.filter(assignments__user=self.request.user, assignments__is_active=True)

        overdue = self.request.query_params.get('overdue')
        if overdue in ('true', '1'):
            today = timezone.now().date()
            qs = qs.filter(
                due_date__lt=today
            ).exclude(status__in=[OrderStatus.COMPLETED, OrderStatus.CLOSED, OrderStatus.CANCELLED])

        return qs.distinct()


class ProductionOrderDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ProductionOrderDetailSerializer
    permission_classes = [HasProductionOrderAccess]
    lookup_field = 'id'

    def get_queryset(self):
        return get_authorized_production_orders(self.request.user).select_related(
            'product', 'warehouse', 'bom', 'creator', 'primary_assignee'
        ).prefetch_related(
            'order_components__item',
            'order_components__unit_of_measure',
            'assignments__user',
            'consumption_reports__component__item',
            'consumption_reports__operator',
            'output_reports__operator',
        )


class ReleaseProductionOrderView(views.APIView):
    permission_classes = [IsProductionManagerOrAdmin]

    def post(self, request, id):
        try:
            order = ProductionOrder.objects.get(id=id, organization=request.user.organization)
        except ProductionOrder.DoesNotExist:
            return Response({"detail": "Production order not found."}, status=status.HTTP_404_NOT_FOUND)

        order = ProductionService.release_order(order, actor=request.user)
        return Response(ProductionOrderDetailSerializer(order).data)


class AssignUserToOrderView(views.APIView):
    permission_classes = [IsProductionManagerOrAdmin]

    def post(self, request, id):
        try:
            order = ProductionOrder.objects.get(id=id, organization=request.user.organization)
        except ProductionOrder.DoesNotExist:
            return Response({"detail": "Production order not found."}, status=status.HTTP_404_NOT_FOUND)

        user_id = request.data.get('user_id')
        is_primary = bool(request.data.get('is_primary', False))
        notes = request.data.get('notes', '')

        try:
            target_user = User.objects.get(id=user_id, organization=request.user.organization)
        except User.DoesNotExist:
            return Response({"detail": "Target user not found in organization."}, status=status.HTTP_404_NOT_FOUND)

        assignment = ProductionService.assign_user(
            order=order,
            user=target_user,
            actor=request.user,
            is_primary=is_primary,
            notes=notes
        )

        return Response(ProductionOrderAssignmentSerializer(assignment).data, status=status.HTTP_201_CREATED)


class RemoveUserFromOrderView(views.APIView):
    permission_classes = [IsProductionManagerOrAdmin]

    def post(self, request, id, user_id):
        try:
            order = ProductionOrder.objects.get(id=id, organization=request.user.organization)
            target_user = User.objects.get(id=user_id, organization=request.user.organization)
        except (ProductionOrder.DoesNotExist, User.DoesNotExist):
            return Response({"detail": "Order or User not found."}, status=status.HTTP_404_NOT_FOUND)

        removed = ProductionService.remove_user(order, target_user, actor=request.user)
        return Response({"success": removed, "detail": f"Removed {target_user.full_name} from order."})


class IssueOrderMaterialView(views.APIView):
    permission_classes = [IsStorekeeperOrAbove]

    def post(self, request, id):
        try:
            order = ProductionOrder.objects.get(id=id, organization=request.user.organization)
        except ProductionOrder.DoesNotExist:
            return Response({"detail": "Production order not found."}, status=status.HTTP_404_NOT_FOUND)

        component_id = request.data.get('component_id')
        warehouse_id = request.data.get('warehouse_id') or (order.warehouse.id if order.warehouse else None)
        notes = request.data.get('notes', '')

        try:
            quantity = Decimal(str(request.data.get('quantity', '0')))
        except (ValueError, TypeError):
            return Response({"detail": "Invalid quantity."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            component = order.order_components.get(id=component_id)
            warehouse = order.organization.inventory_warehouses_set.get(id=warehouse_id)
        except (ProductionOrderComponent.DoesNotExist, Exception):
            return Response({"detail": "Component or Warehouse not found."}, status=status.HTTP_404_NOT_FOUND)

        txn = ProductionService.issue_materials(
            order=order,
            component=component,
            quantity=quantity,
            warehouse=warehouse,
            actor=request.user,
            notes=notes
        )

        return Response({
            "detail": f"Issued {quantity} {component.unit_of_measure.code} to {order.order_number}",
            "issued_quantity": str(component.issued_quantity),
            "order_status": order.status
        }, status=status.HTTP_201_CREATED)


class ReturnOrderMaterialView(views.APIView):
    permission_classes = [IsStorekeeperOrAbove]

    def post(self, request, id):
        try:
            order = ProductionOrder.objects.get(id=id, organization=request.user.organization)
        except ProductionOrder.DoesNotExist:
            return Response({"detail": "Production order not found."}, status=status.HTTP_404_NOT_FOUND)

        component_id = request.data.get('component_id')
        warehouse_id = request.data.get('warehouse_id') or (order.warehouse.id if order.warehouse else None)
        notes = request.data.get('notes', '')

        try:
            quantity = Decimal(str(request.data.get('quantity', '0')))
        except (ValueError, TypeError):
            return Response({"detail": "Invalid quantity."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            component = order.order_components.get(id=component_id)
            warehouse = order.organization.inventory_warehouses_set.get(id=warehouse_id)
        except (ProductionOrderComponent.DoesNotExist, Exception):
            return Response({"detail": "Component or Warehouse not found."}, status=status.HTTP_404_NOT_FOUND)

        txn = ProductionService.return_materials(
            order=order,
            component=component,
            quantity=quantity,
            warehouse=warehouse,
            actor=request.user,
            notes=notes
        )

        return Response({
            "detail": f"Returned {quantity} {component.unit_of_measure.code} from {order.order_number}",
            "returned_quantity": str(component.returned_quantity)
        }, status=status.HTTP_201_CREATED)


class RecordOrderConsumptionView(views.APIView):
    """
    Operator records actual material consumed and scrap generated.
    """
    def post(self, request, id):
        try:
            order = ProductionOrder.objects.get(id=id, organization=request.user.organization)
        except ProductionOrder.DoesNotExist:
            return Response({"detail": "Production order not found."}, status=status.HTTP_404_NOT_FOUND)

        # Enforce that operator must be assigned
        user = request.user
        if user.role == UserRole.OPERATOR:
            if not order.assignments.filter(user=user, is_active=True).exists():
                return Response(
                    {"detail": "You are not assigned to this production order."},
                    status=status.HTTP_403_FORBIDDEN
                )

        component_id = request.data.get('component_id')
        warehouse_id = request.data.get('warehouse_id')
        notes = request.data.get('notes', '')

        try:
            qty_consumed = Decimal(str(request.data.get('quantity_consumed', '0')))
            scrap_qty = Decimal(str(request.data.get('scrap_quantity', '0')))
        except (ValueError, TypeError):
            return Response({"detail": "Invalid quantities."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            component = order.order_components.get(id=component_id)
        except ProductionOrderComponent.DoesNotExist:
            return Response({"detail": "Component not found on this order."}, status=status.HTTP_404_NOT_FOUND)

        warehouse = None
        if warehouse_id:
            warehouse = order.organization.inventory_warehouses_set.filter(id=warehouse_id).first()

        report = ProductionService.record_consumption(
            order=order,
            component=component,
            quantity_consumed=qty_consumed,
            scrap_quantity=scrap_qty,
            operator=user,
            warehouse=warehouse,
            notes=notes
        )

        return Response(ProductionConsumptionReportSerializer(report).data, status=status.HTTP_201_CREATED)


class RecordOrderOutputView(views.APIView):
    """
    Operator records completed good finished units and rejected units.
    """
    def post(self, request, id):
        try:
            order = ProductionOrder.objects.get(id=id, organization=request.user.organization)
        except ProductionOrder.DoesNotExist:
            return Response({"detail": "Production order not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if user.role == UserRole.OPERATOR:
            if not order.assignments.filter(user=user, is_active=True).exists():
                return Response(
                    {"detail": "You are not assigned to this production order."},
                    status=status.HTTP_403_FORBIDDEN
                )

        warehouse_id = request.data.get('warehouse_id')
        notes = request.data.get('notes', '')

        try:
            good_qty = Decimal(str(request.data.get('good_quantity', '0')))
            rejected_qty = Decimal(str(request.data.get('rejected_quantity', '0')))
        except (ValueError, TypeError):
            return Response({"detail": "Invalid quantities."}, status=status.HTTP_400_BAD_REQUEST)

        warehouse = None
        if warehouse_id:
            warehouse = order.organization.inventory_warehouses_set.filter(id=warehouse_id).first()

        report = ProductionService.record_output(
            order=order,
            good_quantity=good_qty,
            rejected_quantity=rejected_qty,
            operator=user,
            warehouse=warehouse,
            notes=notes
        )

        return Response(ProductionOutputReportSerializer(report).data, status=status.HTTP_201_CREATED)


class CloseProductionOrderView(views.APIView):
    permission_classes = [IsProductionManagerOrAdmin]

    def post(self, request, id):
        try:
            order = ProductionOrder.objects.get(id=id, organization=request.user.organization)
        except ProductionOrder.DoesNotExist:
            return Response({"detail": "Production order not found."}, status=status.HTTP_404_NOT_FOUND)

        notes = request.data.get('notes', '')
        closed_order = ProductionService.close_order(order, actor=request.user, notes=notes)

        return Response(ProductionOrderDetailSerializer(closed_order).data)

import csv
from decimal import Decimal
from django.http import HttpResponse
from django.utils import timezone
from django.db import models
from rest_framework import views, permissions, status
from rest_framework.response import Response
from apps.production.models import (
    ProductionOrder,
    OrderStatus,
    ProductionOrderComponent,
    ProductionConsumptionReport,
    ProductionOutputReport,
)
from apps.production.selectors import get_authorized_production_orders
from apps.inventory.models import StockBalance, InventoryLedgerTransaction, Item
from apps.users.models import UserRole
from apps.users.permissions import CanAccessCostingReports
from apps.audit.models import AuditLog

class DashboardSummaryView(views.APIView):
    """
    Role-specific dashboard metrics and operational feed.
    """
    def get(self, request):
        user = request.user
        org = user.organization
        role = user.role
        today = timezone.now().date()

        authorized_orders = get_authorized_production_orders(user)

        data = {
            "role": role,
            "organization_name": org.name,
            "metrics": {},
            "recent_orders": [],
            "alerts": []
        }

        if role in (UserRole.ADMIN, UserRole.PRODUCTION_MANAGER):
            total_orders = authorized_orders.count()
            in_progress = authorized_orders.filter(status=OrderStatus.IN_PROGRESS).count()
            completed = authorized_orders.filter(status=OrderStatus.COMPLETED).count()
            overdue = authorized_orders.filter(
                due_date__lt=today
            ).exclude(status__in=[OrderStatus.COMPLETED, OrderStatus.CLOSED, OrderStatus.CANCELLED]).count()

            # Low stock items
            low_stock_items = []
            for item in Item.objects.filter(organization=org, is_active=True).prefetch_related('stock_balances'):
                avail = sum((b.available for b in item.stock_balances.all()), Decimal('0.0000'))
                if avail <= item.reorder_level and item.reorder_level > Decimal('0.0000'):
                    low_stock_items.append({
                        "id": str(item.id),
                        "code": item.code,
                        "name": item.name,
                        "available": str(avail),
                        "reorder_level": str(item.reorder_level),
                        "uom": item.base_uom.code
                    })

            data["metrics"] = {
                "total_orders": total_orders,
                "in_progress_orders": in_progress,
                "completed_orders": completed,
                "overdue_orders": overdue,
                "low_stock_count": len(low_stock_items)
            }
            data["alerts"] = low_stock_items[:5]

            # Orders by status breakdown
            status_counts = {}
            for st in OrderStatus.values:
                status_counts[st] = authorized_orders.filter(status=st).count()
            data["status_breakdown"] = status_counts

        elif role == UserRole.STOREKEEPER:
            low_stock_items = []
            for item in Item.objects.filter(organization=org, is_active=True).prefetch_related('stock_balances'):
                avail = sum((b.available for b in item.stock_balances.all()), Decimal('0.0000'))
                if avail <= item.reorder_level and item.reorder_level > Decimal('0.0000'):
                    low_stock_items.append({
                        "id": str(item.id),
                        "code": item.code,
                        "name": item.name,
                        "available": str(avail),
                        "reorder_level": str(item.reorder_level),
                        "uom": item.base_uom.code
                    })

            pending_issues_count = ProductionOrderComponent.objects.filter(
                order__organization=org,
                order__status__in=[OrderStatus.RELEASED, OrderStatus.IN_PROGRESS]
            ).filter(issued_quantity__lt=models.F('planned_quantity')).count()

            data["metrics"] = {
                "low_stock_count": len(low_stock_items),
                "pending_material_issues": pending_issues_count,
                "active_production_orders": authorized_orders.filter(status__in=[OrderStatus.RELEASED, OrderStatus.IN_PROGRESS]).count()
            }
            data["alerts"] = low_stock_items[:5]

        elif role == UserRole.OPERATOR:
            # Strictly operator's assigned orders
            my_orders = authorized_orders
            my_active = my_orders.filter(status=OrderStatus.IN_PROGRESS).count()
            my_completed = my_orders.filter(status__in=[OrderStatus.COMPLETED, OrderStatus.CLOSED]).count()
            my_overdue = my_orders.filter(
                due_date__lt=today
            ).exclude(status__in=[OrderStatus.COMPLETED, OrderStatus.CLOSED, OrderStatus.CANCELLED]).count()

            data["metrics"] = {
                "my_assigned_orders": my_orders.count(),
                "my_active_orders": my_active,
                "my_completed_orders": my_completed,
                "my_overdue_orders": my_overdue
            }

        else:  # Viewer
            data["metrics"] = {
                "total_orders": authorized_orders.count(),
                "in_progress_orders": authorized_orders.filter(status=OrderStatus.IN_PROGRESS).count(),
                "overdue_orders": 0,
                "low_stock_count": 0
            }

        # Recent orders list
        recent_qs = authorized_orders.select_related('product', 'product__unit_of_measure', 'primary_assignee')[:8]
        for o in recent_qs:
            order_dict = {
                "id": str(o.id),
                "order_number": o.order_number,
                "product_name": o.product.name,
                "product_code": o.product.code,
                "planned_quantity": str(o.planned_quantity),
                "completed_good_quantity": str(o.completed_good_quantity),
                "completion_percentage": str(o.completion_percentage),
                "status": o.status,
                "priority": o.priority,
                "due_date": o.due_date.isoformat() if o.due_date else None,
                "primary_assignee": o.primary_assignee.full_name if o.primary_assignee else None
            }
            if role in (UserRole.ADMIN, UserRole.PRODUCTION_MANAGER):
                order_dict["cost_per_good_unit"] = str(o.actual_cost_per_good_unit) if o.actual_cost_per_good_unit else None
            data["recent_orders"].append(order_dict)

        return Response(data)


class MaterialVarianceReportView(views.APIView):
    """
    Detailed variance report comparing planned vs actual consumption, scrap, and cost impact.
    """
    def get(self, request):
        user = request.user
        org = user.organization
        is_cost_authorized = user.role in (UserRole.ADMIN, UserRole.PRODUCTION_MANAGER) or user.is_superuser

        components_qs = ProductionOrderComponent.objects.filter(
            order__organization=org
        ).select_related('order', 'order__product', 'item', 'unit_of_measure')

        if user.role == UserRole.OPERATOR:
            components_qs = components_qs.filter(
                order__assignments__user=user,
                order__assignments__is_active=True
            )

        order_id = request.query_params.get('order_id')
        if order_id:
            components_qs = components_qs.filter(order_id=order_id)

        product_id = request.query_params.get('product_id')
        if product_id:
            components_qs = components_qs.filter(order__product_id=product_id)

        item_id = request.query_params.get('item_id')
        if item_id:
            components_qs = components_qs.filter(item_id=item_id)

        rows = []
        for c in components_qs:
            row = {
                "order_id": str(c.order.id),
                "order_number": c.order.order_number,
                "order_status": c.order.status,
                "product_name": c.order.product.name,
                "product_code": c.order.product.code,
                "item_id": str(c.item.id),
                "item_code": c.item.code,
                "item_name": c.item.name,
                "uom": c.unit_of_measure.code,
                "planned_quantity": str(c.planned_quantity),
                "issued_quantity": str(c.issued_quantity),
                "consumed_quantity": str(c.consumed_quantity),
                "returned_quantity": str(c.returned_quantity),
                "scrap_quantity": str(c.scrap_quantity),
                "variance_quantity": str(c.variance_quantity),
                "variance_percentage": str(c.variance_percentage),
            }

            if is_cost_authorized:
                row["unit_cost_snapshot"] = str(c.unit_cost_snapshot)
                row["planned_cost"] = str(c.planned_cost)
                row["actual_cost"] = str(c.actual_cost)
                row["cost_variance"] = str(c.actual_cost - c.planned_cost)

            rows.append(row)

        return Response(rows)


class MaterialVarianceExportCSVView(views.APIView):
    """
    Exports Material Variance Report to CSV with identical authorization checks.
    """
    def get(self, request):
        user = request.user
        org = user.organization
        is_cost_authorized = user.role in (UserRole.ADMIN, UserRole.PRODUCTION_MANAGER) or user.is_superuser

        components_qs = ProductionOrderComponent.objects.filter(
            order__organization=org
        ).select_related('order', 'order__product', 'item', 'unit_of_measure')

        if user.role == UserRole.OPERATOR:
            components_qs = components_qs.filter(
                order__assignments__user=user,
                order__assignments__is_active=True
            )

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="forgetrack_material_variance_{timezone.now():%Y%m%d_%H%M}.csv"'

        writer = csv.writer(response)
        headers = [
            "Order Number", "Order Status", "Product", "Component SKU", "Component Name",
            "UOM", "Planned Qty", "Issued Qty", "Consumed Qty", "Returned Qty",
            "Scrap Qty", "Variance Qty", "Variance %"
        ]
        if is_cost_authorized:
            headers.extend(["Unit Cost Snapshot (INR)", "Planned Cost", "Actual Cost", "Cost Variance"])

        writer.writerow(headers)

        for c in components_qs:
            row = [
                c.order.order_number,
                c.order.status,
                f"{c.order.product.name} ({c.order.product.code})",
                c.item.code,
                c.item.name,
                c.unit_of_measure.code,
                str(c.planned_quantity),
                str(c.issued_quantity),
                str(c.consumed_quantity),
                str(c.returned_quantity),
                str(c.scrap_quantity),
                str(c.variance_quantity),
                f"{c.variance_percentage}%"
            ]
            if is_cost_authorized:
                row.extend([
                    str(c.unit_cost_snapshot),
                    str(c.planned_cost),
                    str(c.actual_cost),
                    str(c.actual_cost - c.planned_cost)
                ])
            writer.writerow(row)

        return response


class ProductionCostReportView(views.APIView):
    """
    Production cost performance report (Restricted to Admin & Production Manager).
    """
    permission_classes = [CanAccessCostingReports]

    def get(self, request):
        org = request.user.organization
        orders = ProductionOrder.objects.filter(organization=org).select_related('product', 'product__unit_of_measure')

        rows = []
        for o in orders:
            rows.append({
                "id": str(o.id),
                "order_number": o.order_number,
                "product_name": o.product.name,
                "product_code": o.product.code,
                "uom": o.product.unit_of_measure.code,
                "status": o.status,
                "planned_quantity": str(o.planned_quantity),
                "completed_good_quantity": str(o.completed_good_quantity),
                "completed_rejected_quantity": str(o.completed_rejected_quantity),
                "completion_percentage": str(o.completion_percentage),
                "total_actual_material_cost": str(o.total_actual_material_cost),
                "actual_cost_per_good_unit": str(o.actual_cost_per_good_unit) if o.actual_cost_per_good_unit else None
            })

        return Response(rows)

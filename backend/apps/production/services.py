from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.inventory.services import InventoryService
from apps.audit.services import log_audit_event
from .models import (
    ProductionOrder,
    OrderStatus,
    ProductionOrderAssignment,
    ProductionOrderComponent,
    ProductionConsumptionReport,
    ProductionOutputReport,
)

ALLOWED_TRANSITIONS = {
    OrderStatus.DRAFT: {OrderStatus.PLANNED, OrderStatus.CANCELLED},
    OrderStatus.PLANNED: {OrderStatus.DRAFT, OrderStatus.RELEASED, OrderStatus.CANCELLED},
    OrderStatus.RELEASED: {OrderStatus.IN_PROGRESS, OrderStatus.ON_HOLD, OrderStatus.CANCELLED},
    OrderStatus.IN_PROGRESS: {OrderStatus.ON_HOLD, OrderStatus.COMPLETED, OrderStatus.CANCELLED},
    OrderStatus.ON_HOLD: {OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED},
    OrderStatus.COMPLETED: {OrderStatus.IN_PROGRESS, OrderStatus.CLOSED},
    OrderStatus.CLOSED: set(),
    OrderStatus.CANCELLED: set(),
}

class ProductionService:

    @classmethod
    def validate_transition(cls, current_status: str, new_status: str):
        allowed = ALLOWED_TRANSITIONS.get(current_status, set())
        if new_status not in allowed:
            raise ValidationError(
                f"Cannot transition order from {current_status} to {new_status}. "
                f"Allowed next states: {', '.join(allowed) if allowed else 'None (Terminal state)'}"
            )

    @classmethod
    @transaction.atomic
    def release_order(cls, order: ProductionOrder, actor=None) -> ProductionOrder:
        if order.status not in (OrderStatus.DRAFT, OrderStatus.PLANNED):
            raise ValidationError(f"Only DRAFT or PLANNED orders can be released. Current status: {order.status}")

        if not order.bom:
            raise ValidationError("A released BOM must be assigned before releasing a production order.")

        if order.bom.status != 'RELEASED':
            raise ValidationError(f"BOM version {order.bom.version} is not in RELEASED status.")

        if order.planned_quantity <= Decimal('0.0000'):
            raise ValidationError("Planned quantity must be greater than zero.")

        # Take immutable snapshot of BOM components onto ProductionOrderComponent
        existing_components = order.order_components.all()
        if not existing_components.exists():
            for bom_comp in order.bom.components.select_related('item', 'unit_of_measure'):
                gross_req = bom_comp.calculate_requirement_for(order.planned_quantity)
                ProductionOrderComponent.objects.create(
                    organization=order.organization,
                    order=order,
                    item=bom_comp.item,
                    unit_of_measure=bom_comp.unit_of_measure,
                    planned_quantity=gross_req,
                    unit_cost_snapshot=bom_comp.item.unit_cost
                )

        order.bom_snapshot_version = order.bom.version
        order.status = OrderStatus.RELEASED
        order.save(update_fields=['bom_snapshot_version', 'status', 'updated_at'])

        log_audit_event(
            action="ORDER_RELEASED",
            entity_type="ProductionOrder",
            entity_id=str(order.id),
            actor=actor,
            organization=order.organization,
            description=f"Released production order {order.order_number} using BOM {order.bom_snapshot_version}",
            after_state={"status": order.status, "bom_snapshot": order.bom_snapshot_version}
        )

        return order

    @classmethod
    @transaction.atomic
    def assign_user(
        cls,
        order: ProductionOrder,
        user,
        actor=None,
        is_primary: bool = False,
        notes: str = ""
    ) -> ProductionOrderAssignment:
        if user.organization_id != order.organization_id:
            raise ValidationError("Cannot assign a user from a different organization.")

        # Check existing active assignment
        existing = ProductionOrderAssignment.objects.filter(
            order=order,
            user=user,
            is_active=True
        ).first()

        if existing:
            if is_primary and not existing.is_primary:
                existing.is_primary = True
                existing.save(update_fields=['is_primary', 'updated_at'])
                order.primary_assignee = user
                order.save(update_fields=['primary_assignee', 'updated_at'])
            return existing

        if is_primary:
            ProductionOrderAssignment.objects.filter(order=order, is_primary=True).update(is_primary=False)
            order.primary_assignee = user
            order.save(update_fields=['primary_assignee', 'updated_at'])

        assignment = ProductionOrderAssignment.objects.create(
            organization=order.organization,
            order=order,
            user=user,
            assigned_by=actor,
            is_primary=is_primary,
            is_active=True,
            notes=notes
        )

        log_audit_event(
            action="ORDER_ASSIGNED",
            entity_type="ProductionOrder",
            entity_id=str(order.id),
            actor=actor,
            organization=order.organization,
            description=f"Assigned {user.full_name} ({user.email}) to {order.order_number} (Primary: {is_primary})",
            after_state={"user_id": str(user.id), "is_primary": is_primary}
        )

        return assignment

    @classmethod
    @transaction.atomic
    def remove_user(cls, order: ProductionOrder, user, actor=None) -> bool:
        assignments = ProductionOrderAssignment.objects.filter(
            order=order,
            user=user,
            is_active=True
        )
        if not assignments.exists():
            return False

        for a in assignments:
            a.is_active = False
            a.removed_at = timezone.now()
            a.save(update_fields=['is_active', 'removed_at', 'updated_at'])

        if order.primary_assignee_id == user.id:
            order.primary_assignee = None
            order.save(update_fields=['primary_assignee', 'updated_at'])

        log_audit_event(
            action="ORDER_UNASSIGNED",
            entity_type="ProductionOrder",
            entity_id=str(order.id),
            actor=actor,
            organization=order.organization,
            description=f"Removed {user.full_name} from {order.order_number}"
        )

        return True

    @classmethod
    @transaction.atomic
    def issue_materials(
        cls,
        order: ProductionOrder,
        component: ProductionOrderComponent,
        quantity: Decimal,
        warehouse,
        actor=None,
        notes: str = ""
    ):
        if quantity <= Decimal('0.0000'):
            raise ValidationError("Issue quantity must be greater than zero.")

        # Post inventory issue
        txn = InventoryService.issue_material(
            organization=order.organization,
            item=component.item,
            warehouse=warehouse,
            quantity=quantity,
            reference_number=order.order_number,
            source_document_type="PRODUCTION_ORDER",
            source_document_id=str(order.id),
            performed_by=actor,
            notes=notes
        )

        component.issued_quantity += quantity
        component.save(update_fields=['issued_quantity', 'updated_at'])

        if order.status == OrderStatus.RELEASED:
            order.status = OrderStatus.IN_PROGRESS
            if not order.actual_start_time:
                order.actual_start_time = timezone.now()
            order.save(update_fields=['status', 'actual_start_time', 'updated_at'])

        return txn

    @classmethod
    @transaction.atomic
    def return_materials(
        cls,
        order: ProductionOrder,
        component: ProductionOrderComponent,
        quantity: Decimal,
        warehouse,
        actor=None,
        notes: str = ""
    ):
        if quantity <= Decimal('0.0000'):
            raise ValidationError("Return quantity must be greater than zero.")

        available_to_return = component.issued_quantity - (component.consumed_quantity + component.returned_quantity)
        if quantity > available_to_return:
            raise ValidationError(
                f"Cannot return {quantity} {component.unit_of_measure.code}. "
                f"Issued: {component.issued_quantity}, Consumed: {component.consumed_quantity}, "
                f"Already returned: {component.returned_quantity}. Max returnable: {available_to_return}"
            )

        txn = InventoryService.return_material(
            organization=order.organization,
            item=component.item,
            warehouse=warehouse,
            quantity=quantity,
            reference_number=order.order_number,
            source_document_type="PRODUCTION_ORDER",
            source_document_id=str(order.id),
            performed_by=actor,
            notes=notes
        )

        component.returned_quantity += quantity
        component.save(update_fields=['returned_quantity', 'updated_at'])

        return txn

    @classmethod
    @transaction.atomic
    def record_consumption(
        cls,
        order: ProductionOrder,
        component: ProductionOrderComponent,
        quantity_consumed: Decimal,
        scrap_quantity: Decimal = Decimal('0.0000'),
        operator=None,
        warehouse=None,
        notes: str = ""
    ) -> ProductionConsumptionReport:
        if quantity_consumed <= Decimal('0.0000'):
            raise ValidationError("Consumed quantity must be greater than zero.")
        if scrap_quantity < Decimal('0.0000'):
            raise ValidationError("Scrap quantity cannot be negative.")

        wh = warehouse or order.warehouse
        if not wh:
            # Fall back to first warehouse in organization
            wh = component.item.organization.inventory_warehouses_set.filter(is_active=True).first()

        report = ProductionConsumptionReport.objects.create(
            organization=order.organization,
            order=order,
            component=component,
            operator=operator,
            quantity_consumed=quantity_consumed,
            scrap_quantity=scrap_quantity,
            notes=notes
        )

        component.consumed_quantity += quantity_consumed
        component.scrap_quantity += scrap_quantity
        component.save(update_fields=['consumed_quantity', 'scrap_quantity', 'updated_at'])

        if wh:
            InventoryService.record_production_consumption(
                organization=order.organization,
                item=component.item,
                warehouse=wh,
                quantity=quantity_consumed,
                reference_number=order.order_number,
                source_document_type="PRODUCTION_ORDER",
                source_document_id=str(order.id),
                performed_by=operator,
                notes=notes
            )

        if order.status in (OrderStatus.RELEASED, OrderStatus.ON_HOLD):
            order.status = OrderStatus.IN_PROGRESS
            if not order.actual_start_time:
                order.actual_start_time = timezone.now()
            order.save(update_fields=['status', 'actual_start_time', 'updated_at'])

        log_audit_event(
            action="CONSUMPTION_RECORDED",
            entity_type="ProductionOrder",
            entity_id=str(order.id),
            actor=operator,
            organization=order.organization,
            description=f"Consumed {quantity_consumed} (Scrap: {scrap_quantity}) of {component.item.code} for {order.order_number}"
        )

        return report

    @classmethod
    @transaction.atomic
    def record_output(
        cls,
        order: ProductionOrder,
        good_quantity: Decimal,
        rejected_quantity: Decimal = Decimal('0.0000'),
        operator=None,
        warehouse=None,
        notes: str = ""
    ) -> ProductionOutputReport:
        if good_quantity < Decimal('0.0000') or rejected_quantity < Decimal('0.0000'):
            raise ValidationError("Output quantities cannot be negative.")
        if good_quantity == 0 and rejected_quantity == 0:
            raise ValidationError("At least one output quantity must be greater than zero.")

        report = ProductionOutputReport.objects.create(
            organization=order.organization,
            order=order,
            operator=operator,
            good_quantity=good_quantity,
            rejected_quantity=rejected_quantity,
            notes=notes
        )

        order.completed_good_quantity += good_quantity
        order.completed_rejected_quantity += rejected_quantity

        # If product has linked finished good item and good_quantity > 0, post finished goods receipt
        wh = warehouse or order.warehouse or order.organization.inventory_warehouses_set.filter(is_active=True).first()
        if good_quantity > 0 and order.product.linked_item and wh:
            unit_cost = order.actual_cost_per_good_unit or order.product.linked_item.unit_cost
            InventoryService.record_finished_goods(
                organization=order.organization,
                finished_item=order.product.linked_item,
                warehouse=wh,
                quantity=good_quantity,
                unit_cost=unit_cost,
                reference_number=order.order_number,
                source_document_type="PRODUCTION_ORDER",
                source_document_id=str(order.id),
                performed_by=operator,
                notes=f"Completed production for {order.order_number}"
            )

        if order.status == OrderStatus.RELEASED:
            order.status = OrderStatus.IN_PROGRESS
            if not order.actual_start_time:
                order.actual_start_time = timezone.now()

        # Check if completed
        if order.completed_good_quantity >= order.planned_quantity and order.status == OrderStatus.IN_PROGRESS:
            order.status = OrderStatus.COMPLETED
            if not order.actual_end_time:
                order.actual_end_time = timezone.now()

        order.save(update_fields=[
            'completed_good_quantity',
            'completed_rejected_quantity',
            'status',
            'actual_start_time',
            'actual_end_time',
            'updated_at'
        ])

        log_audit_event(
            action="OUTPUT_RECORDED",
            entity_type="ProductionOrder",
            entity_id=str(order.id),
            actor=operator,
            organization=order.organization,
            description=f"Output reported for {order.order_number}: {good_quantity} good, {rejected_quantity} rejected"
        )

        return report

    @classmethod
    @transaction.atomic
    def close_order(cls, order: ProductionOrder, actor=None, notes: str = "") -> ProductionOrder:
        if order.status == OrderStatus.CLOSED:
            raise ValidationError("Order is already closed.")

        if order.status not in (OrderStatus.COMPLETED, OrderStatus.IN_PROGRESS):
            raise ValidationError(f"Only COMPLETED or IN_PROGRESS orders can be closed. Current: {order.status}")

        # Check material reconciliation: Issued vs (Consumed + Returned)
        unreconciled = []
        for comp in order.order_components.all():
            accounted = comp.consumed_quantity + comp.returned_quantity
            unaccounted = comp.issued_quantity - accounted
            if unaccounted > Decimal('0.0001'):
                unreconciled.append(
                    f"{comp.item.code}: {comp.issued_quantity} issued, but only {accounted} accounted ({comp.consumed_quantity} used, {comp.returned_quantity} returned). {unaccounted} pending."
                )

        if unreconciled:
            raise ValidationError(
                f"Cannot close order. Material reconciliation pending:\n" + "\n".join(unreconciled) +
                "\nPlease record return of unused material or report actual consumption/scrap before closing."
            )

        order.status = OrderStatus.CLOSED
        if not order.actual_end_time:
            order.actual_end_time = timezone.now()
        order.notes = f"{order.notes}\nClosed: {notes}".strip()
        order.save(update_fields=['status', 'actual_end_time', 'notes', 'updated_at'])

        log_audit_event(
            action="ORDER_CLOSED",
            entity_type="ProductionOrder",
            entity_id=str(order.id),
            actor=actor,
            organization=order.organization,
            description=f"Closed production order {order.order_number}. Final cost per good unit: ₹{order.actual_cost_per_good_unit or 'N/A'}"
        )

        return order

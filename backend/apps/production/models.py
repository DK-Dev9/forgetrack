import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.organizations.models import OrganizationBaseModel
from apps.products.models import Product, BillOfMaterials
from apps.inventory.models import Item, UnitOfMeasure, Warehouse

class OrderStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    PLANNED = 'PLANNED', 'Planned'
    RELEASED = 'RELEASED', 'Released'
    IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
    ON_HOLD = 'ON_HOLD', 'On Hold'
    COMPLETED = 'COMPLETED', 'Completed'
    CLOSED = 'CLOSED', 'Closed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class OrderPriority(models.TextChoices):
    LOW = 'LOW', 'Low'
    MEDIUM = 'MEDIUM', 'Medium'
    HIGH = 'HIGH', 'High'
    URGENT = 'URGENT', 'Urgent'


class ProductionOrder(OrganizationBaseModel):
    order_number = models.CharField(max_length=100, db_index=True)
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name='production_orders'
    )
    planned_quantity = models.DecimalField(max_digits=14, decimal_places=4)
    completed_good_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('0.0000')
    )
    completed_rejected_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('0.0000')
    )
    status = models.CharField(
        max_length=30,
        choices=OrderStatus.choices,
        default=OrderStatus.DRAFT,
        db_index=True
    )
    priority = models.CharField(
        max_length=20,
        choices=OrderPriority.choices,
        default=OrderPriority.MEDIUM
    )
    bom = models.ForeignKey(
        BillOfMaterials,
        on_delete=models.PROTECT,
        related_name='production_orders',
        null=True,
        blank=True
    )
    bom_snapshot_version = models.CharField(max_length=50, blank=True)
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name='production_orders',
        null=True,
        blank=True
    )
    planned_start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True, db_index=True)
    actual_start_time = models.DateTimeField(null=True, blank=True)
    actual_end_time = models.DateTimeField(null=True, blank=True)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_orders'
    )
    primary_assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='primary_assigned_orders'
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'production_orders'
        unique_together = ('organization', 'order_number')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.order_number}: {self.product.name} ({self.planned_quantity} {self.product.unit_of_measure.code}) [{self.status}]"

    @property
    def completion_percentage(self) -> Decimal:
        if self.planned_quantity <= Decimal('0.0000'):
            return Decimal('0.00')
        val = (self.completed_good_quantity / self.planned_quantity) * Decimal('100.0')
        return round(val, 2)

    @property
    def total_actual_material_cost(self) -> Decimal:
        total = Decimal('0.0000')
        for comp in self.order_components.all():
            total += comp.consumed_quantity * comp.unit_cost_snapshot
        return round(total, 4)

    @property
    def actual_cost_per_good_unit(self) -> Decimal | None:
        if self.completed_good_quantity <= Decimal('0.0000'):
            return None
        return round(self.total_actual_material_cost / self.completed_good_quantity, 4)


class ProductionOrderAssignment(OrganizationBaseModel):
    order = models.ForeignKey(
        ProductionOrder,
        on_delete=models.CASCADE,
        related_name='assignments'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='production_assignments'
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_others'
    )
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(default=timezone.now)
    removed_at = models.DateTimeField(null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'production_order_assignments'
        ordering = ['-assigned_at']

    def __str__(self):
        role_label = "Primary" if self.is_primary else "Team"
        status_label = "Active" if self.is_active else "Removed"
        return f"{self.user.full_name} -> {self.order.order_number} ({role_label}, {status_label})"


class ProductionOrderComponent(OrganizationBaseModel):
    order = models.ForeignKey(
        ProductionOrder,
        on_delete=models.CASCADE,
        related_name='order_components'
    )
    item = models.ForeignKey(
        Item,
        on_delete=models.PROTECT,
        related_name='order_components'
    )
    unit_of_measure = models.ForeignKey(
        UnitOfMeasure,
        on_delete=models.PROTECT
    )
    planned_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        help_text="Gross planned requirement including BOM scrap allowance"
    )
    issued_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('0.0000')
    )
    consumed_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('0.0000')
    )
    returned_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('0.0000')
    )
    scrap_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('0.0000')
    )
    unit_cost_snapshot = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('0.0000'),
        help_text="WAC cost snapshot captured at release"
    )

    class Meta:
        db_table = 'production_order_components'
        unique_together = ('order', 'item')
        ordering = ['item__code']

    def __str__(self):
        return f"{self.order.order_number} - {self.item.code}: Plan {self.planned_quantity}, Used {self.consumed_quantity}"

    @property
    def variance_quantity(self) -> Decimal:
        """Actual consumed - Planned consumption"""
        return self.consumed_quantity - self.planned_quantity

    @property
    def variance_percentage(self) -> Decimal:
        """(Actual consumed - Planned consumption) / Planned * 100"""
        if self.planned_quantity <= Decimal('0.0000'):
            return Decimal('0.00')
        val = ((self.consumed_quantity - self.planned_quantity) / self.planned_quantity) * Decimal('100.0')
        return round(val, 2)

    @property
    def actual_cost(self) -> Decimal:
        return self.consumed_quantity * self.unit_cost_snapshot

    @property
    def planned_cost(self) -> Decimal:
        return self.planned_quantity * self.unit_cost_snapshot


class ProductionConsumptionReport(OrganizationBaseModel):
    order = models.ForeignKey(
        ProductionOrder,
        on_delete=models.CASCADE,
        related_name='consumption_reports'
    )
    component = models.ForeignKey(
        ProductionOrderComponent,
        on_delete=models.CASCADE,
        related_name='consumption_reports'
    )
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reported_consumptions'
    )
    quantity_consumed = models.DecimalField(max_digits=14, decimal_places=4)
    scrap_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('0.0000')
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'production_consumption_reports'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.order.order_number}: {self.quantity_consumed} of {self.component.item.code}"


class ProductionOutputReport(OrganizationBaseModel):
    order = models.ForeignKey(
        ProductionOrder,
        on_delete=models.CASCADE,
        related_name='output_reports'
    )
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reported_outputs'
    )
    good_quantity = models.DecimalField(max_digits=14, decimal_places=4)
    rejected_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('0.0000')
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'production_output_reports'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.order.order_number}: +{self.good_quantity} good, {self.rejected_quantity} rejected"

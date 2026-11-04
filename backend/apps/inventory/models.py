import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings
from apps.organizations.models import OrganizationBaseModel

class ItemType(models.TextChoices):
    RAW_MATERIAL = 'RAW_MATERIAL', 'Raw Material'
    COMPONENT = 'COMPONENT', 'Component'
    FINISHED_GOOD = 'FINISHED_GOOD', 'Finished Good'
    CONSUMABLE = 'CONSUMABLE', 'Consumable'


class TransactionType(models.TextChoices):
    RECEIPT = 'RECEIPT', 'Stock Receipt'
    RESERVATION = 'RESERVATION', 'Reservation'
    RESERVATION_RELEASE = 'RESERVATION_RELEASE', 'Reservation Release'
    MATERIAL_ISSUE = 'MATERIAL_ISSUE', 'Material Issue to Production'
    MATERIAL_RETURN = 'MATERIAL_RETURN', 'Material Return from Production'
    TRANSFER_OUT = 'TRANSFER_OUT', 'Warehouse Transfer Out'
    TRANSFER_IN = 'TRANSFER_IN', 'Warehouse Transfer In'
    POSITIVE_ADJUSTMENT = 'POSITIVE_ADJUSTMENT', 'Positive Adjustment'
    NEGATIVE_ADJUSTMENT = 'NEGATIVE_ADJUSTMENT', 'Negative Adjustment'
    PRODUCTION_CONSUMPTION = 'PRODUCTION_CONSUMPTION', 'Production Consumption'
    FINISHED_GOODS_RECEIPT = 'FINISHED_GOODS_RECEIPT', 'Finished Goods Receipt'


class UnitOfMeasure(OrganizationBaseModel):
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=100)

    class Meta:
        db_table = 'inventory_uom'
        unique_together = ('organization', 'code')
        ordering = ['code']

    def __str__(self):
        return f"{self.name} ({self.code})"


class Warehouse(OrganizationBaseModel):
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'inventory_warehouses'
        unique_together = ('organization', 'code')
        ordering = ['code']

    def __str__(self):
        return f"{self.name} ({self.code})"


class Item(OrganizationBaseModel):
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    item_type = models.CharField(
        max_length=30,
        choices=ItemType.choices,
        default=ItemType.RAW_MATERIAL
    )
    base_uom = models.ForeignKey(
        UnitOfMeasure,
        on_delete=models.PROTECT,
        related_name='items'
    )
    unit_cost = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('0.0000'),
        help_text="Weighted Average Cost per base unit"
    )
    reorder_level = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('0.0000')
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'inventory_items'
        unique_together = ('organization', 'code')
        ordering = ['code']

    def __str__(self):
        return f"[{self.code}] {self.name} ({self.get_item_type_display()})"


class StockBalance(OrganizationBaseModel):
    item = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        related_name='stock_balances'
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name='stock_balances'
    )
    on_hand = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('0.0000')
    )
    reserved = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('0.0000')
    )
    issued_to_production = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('0.0000')
    )

    class Meta:
        db_table = 'inventory_stock_balances'
        unique_together = ('organization', 'item', 'warehouse')
        ordering = ['item__code', 'warehouse__code']

    def __str__(self):
        return f"{self.item.code} @ {self.warehouse.code}: On-hand {self.on_hand}, Avail {self.available}"

    @property
    def available(self) -> Decimal:
        return self.on_hand - self.reserved

    @property
    def is_low_stock(self) -> bool:
        return self.available <= self.item.reorder_level and self.item.reorder_level > 0


class InventoryLedgerTransaction(OrganizationBaseModel):
    item = models.ForeignKey(
        Item,
        on_delete=models.PROTECT,
        related_name='ledger_transactions'
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name='ledger_transactions'
    )
    transaction_type = models.CharField(
        max_length=40,
        choices=TransactionType.choices,
        db_index=True
    )
    quantity = models.DecimalField(max_digits=14, decimal_places=4)
    unit_cost = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('0.0000')
    )
    total_cost = models.DecimalField(
        max_digits=16,
        decimal_places=4,
        default=Decimal('0.0000')
    )
    balance_after = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('0.0000')
    )
    reference_number = models.CharField(max_length=100, blank=True, db_index=True)
    source_document_type = models.CharField(max_length=50, blank=True)
    source_document_id = models.CharField(max_length=100, blank=True)
    idempotency_key = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='performed_transactions'
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'inventory_ledger'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.created_at:%Y-%m-%d %H:%M}] {self.transaction_type}: {self.quantity} of {self.item.code} @ {self.warehouse.code}"

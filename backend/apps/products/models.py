import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings
from apps.organizations.models import OrganizationBaseModel
from apps.inventory.models import UnitOfMeasure, Item

class BOMStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    RELEASED = 'RELEASED', 'Released (Active)'
    ARCHIVED = 'ARCHIVED', 'Archived'


class Product(OrganizationBaseModel):
    code = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    unit_of_measure = models.ForeignKey(
        UnitOfMeasure,
        on_delete=models.PROTECT,
        related_name='products'
    )
    linked_item = models.OneToOneField(
        Item,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='product_profile',
        help_text="Corresponding finished good item in inventory"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'products_product'
        unique_together = ('organization', 'code')
        ordering = ['code']

    def __str__(self):
        return f"[{self.code}] {self.name}"


class BillOfMaterials(OrganizationBaseModel):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='boms'
    )
    version = models.CharField(max_length=50)
    status = models.CharField(
        max_length=30,
        choices=BOMStatus.choices,
        default=BOMStatus.DRAFT
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_boms'
    )

    class Meta:
        db_table = 'products_bom'
        unique_together = ('organization', 'product', 'version')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.product.code} - BOM {self.version} ({self.get_status_display()})"

    @property
    def is_released(self):
        return self.status == BOMStatus.RELEASED


class BOMComponent(OrganizationBaseModel):
    bom = models.ForeignKey(
        BillOfMaterials,
        on_delete=models.CASCADE,
        related_name='components'
    )
    item = models.ForeignKey(
        Item,
        on_delete=models.PROTECT,
        related_name='bom_usages'
    )
    quantity = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        help_text="Required quantity per 1 unit of finished product"
    )
    unit_of_measure = models.ForeignKey(
        UnitOfMeasure,
        on_delete=models.PROTECT,
        related_name='bom_components'
    )
    scrap_allowance_percent = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Planned scrap/waste allowance percentage (e.g. 5.00 for 5%)"
    )
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'products_bom_component'
        unique_together = ('bom', 'item')
        ordering = ['item__code']

    def __str__(self):
        return f"{self.item.code}: {self.quantity} {self.unit_of_measure.code} (+{self.scrap_allowance_percent}% scrap)"

    def calculate_requirement_for(self, order_quantity: Decimal) -> Decimal:
        """
        Calculates planned material requirement for a given order quantity:
        gross_quantity = base_required * (1 + scrap_allowance_percent / 100)
        """
        base = self.quantity * order_quantity
        factor = Decimal('1.0') + (self.scrap_allowance_percent / Decimal('100.0'))
        return base * factor

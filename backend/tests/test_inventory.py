import pytest
from decimal import Decimal
from django.core.exceptions import ValidationError
from apps.organizations.models import Organization
from apps.inventory.models import (
    UnitOfMeasure,
    Warehouse,
    Item,
    ItemType,
    StockBalance,
    InventoryLedgerTransaction,
    TransactionType,
)
from apps.inventory.services import InventoryService
from apps.users.models import User, UserRole

@pytest.fixture
def inv_setup(db):
    org = Organization.objects.create(name="Test Org", slug="test-org")
    uom = UnitOfMeasure.objects.create(organization=org, code="kg", name="Kilogram")
    wh1 = Warehouse.objects.create(organization=org, code="WH1", name="Main Warehouse")
    wh2 = Warehouse.objects.create(organization=org, code="WH2", name="Secondary Warehouse")
    item = Item.objects.create(
        organization=org,
        code="STEEL-TEST",
        name="Test Steel",
        base_uom=uom,
        unit_cost=Decimal('50.0000'),
        reorder_level=Decimal('100.0000')
    )
    user = User.objects.create_user(
        email="store@test.com",
        password="Pass",
        full_name="Store Guy",
        role=UserRole.STOREKEEPER,
        organization=org
    )
    return org, uom, wh1, wh2, item, user

@pytest.mark.django_db
class TestInventoryTransactions:

    def test_stock_receipt_and_wac_calculation(self, inv_setup):
        org, uom, wh1, wh2, item, user = inv_setup

        # Receipt 1: 100 kg @ ₹40
        txn1 = InventoryService.post_receipt(
            organization=org,
            item=item,
            warehouse=wh1,
            quantity=Decimal('100.0000'),
            unit_cost=Decimal('40.0000'),
            performed_by=user
        )
        bal = StockBalance.objects.get(organization=org, item=item, warehouse=wh1)
        assert bal.on_hand == Decimal('100.0000')
        assert bal.available == Decimal('100.0000')
        item.refresh_from_db()
        assert item.unit_cost == Decimal('40.0000')

        # Receipt 2: 100 kg @ ₹60 -> New WAC should be (100*40 + 100*60)/200 = ₹50
        txn2 = InventoryService.post_receipt(
            organization=org,
            item=item,
            warehouse=wh1,
            quantity=Decimal('100.0000'),
            unit_cost=Decimal('60.0000'),
            performed_by=user
        )
        bal.refresh_from_db()
        assert bal.on_hand == Decimal('200.0000')
        item.refresh_from_db()
        assert item.unit_cost == Decimal('50.0000')

    def test_reservations_affect_available_quantity(self, inv_setup):
        org, uom, wh1, wh2, item, user = inv_setup

        # Receive 100 kg
        InventoryService.post_receipt(
            organization=org,
            item=item,
            warehouse=wh1,
            quantity=Decimal('100.0000'),
            unit_cost=Decimal('40.0000'),
            performed_by=user
        )

        # Reserve 40 kg
        InventoryService.post_reservation(
            organization=org,
            item=item,
            warehouse=wh1,
            quantity=Decimal('40.0000'),
            performed_by=user
        )

        bal = StockBalance.objects.get(organization=org, item=item, warehouse=wh1)
        assert bal.on_hand == Decimal('100.0000')
        assert bal.reserved == Decimal('40.0000')
        assert bal.available == Decimal('60.0000')

        # Attempt to reserve 70 kg (Available is only 60) -> Must fail
        with pytest.raises(ValidationError):
            InventoryService.post_reservation(
                organization=org,
                item=item,
                warehouse=wh1,
                quantity=Decimal('70.0000'),
                performed_by=user
            )

        # Release 20 kg reservation
        InventoryService.release_reservation(
            organization=org,
            item=item,
            warehouse=wh1,
            quantity=Decimal('20.0000'),
            performed_by=user
        )
        bal.refresh_from_db()
        assert bal.reserved == Decimal('20.0000')
        assert bal.available == Decimal('80.0000')

    def test_warehouse_transfer(self, inv_setup):
        org, uom, wh1, wh2, item, user = inv_setup

        # Receive 100 kg in WH1
        InventoryService.post_receipt(
            organization=org,
            item=item,
            warehouse=wh1,
            quantity=Decimal('100.0000'),
            unit_cost=Decimal('40.0000'),
            performed_by=user
        )

        # Transfer 30 kg to WH2
        out_txn, in_txn = InventoryService.transfer_stock(
            organization=org,
            item=item,
            source_warehouse=wh1,
            target_warehouse=wh2,
            quantity=Decimal('30.0000'),
            performed_by=user
        )

        bal1 = StockBalance.objects.get(organization=org, item=item, warehouse=wh1)
        bal2 = StockBalance.objects.get(organization=org, item=item, warehouse=wh2)

        assert bal1.on_hand == Decimal('70.0000')
        assert bal2.on_hand == Decimal('30.0000')

    def test_idempotency_prevents_duplicate_movements(self, inv_setup):
        org, uom, wh1, wh2, item, user = inv_setup

        txn1 = InventoryService.post_receipt(
            organization=org,
            item=item,
            warehouse=wh1,
            quantity=Decimal('50.0000'),
            unit_cost=Decimal('40.0000'),
            idempotency_key="UNIQUE-KEY-12345",
            performed_by=user
        )

        # Re-posting with exact same idempotency key
        txn2 = InventoryService.post_receipt(
            organization=org,
            item=item,
            warehouse=wh1,
            quantity=Decimal('50.0000'),
            unit_cost=Decimal('40.0000'),
            idempotency_key="UNIQUE-KEY-12345",
            performed_by=user
        )

        assert txn1.id == txn2.id
        bal = StockBalance.objects.get(organization=org, item=item, warehouse=wh1)
        assert bal.on_hand == Decimal('50.0000')  # Not 100!

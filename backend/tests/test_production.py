import pytest
from decimal import Decimal
from django.core.exceptions import ValidationError
from apps.organizations.models import Organization
from apps.inventory.models import UnitOfMeasure, Warehouse, Item, ItemType
from apps.inventory.services import InventoryService
from apps.products.models import Product, BillOfMaterials, BOMComponent, BOMStatus
from apps.production.models import ProductionOrder, OrderStatus, OrderPriority
from apps.production.services import ProductionService
from apps.users.models import User, UserRole

@pytest.fixture
def prod_setup(db):
    org = Organization.objects.create(name="Mfg Org", slug="mfg-org")
    manager = User.objects.create_user(
        email="mgr@mfg.com", password="Pass", full_name="Mgr", role=UserRole.PRODUCTION_MANAGER, organization=org
    )
    operator = User.objects.create_user(
        email="op@mfg.com", password="Pass", full_name="Op", role=UserRole.OPERATOR, organization=org
    )
    uom_kg = UnitOfMeasure.objects.create(organization=org, code="kg", name="Kilogram")
    uom_pcs = UnitOfMeasure.objects.create(organization=org, code="pcs", name="Piece")
    wh = Warehouse.objects.create(organization=org, code="WH-SHOP", name="Shop Floor Depot")

    raw_mat = Item.objects.create(
        organization=org,
        code="RAW-MAT-1",
        name="Raw Steel",
        base_uom=uom_kg,
        unit_cost=Decimal('40.0000')
    )

    # Initial stock receipt
    InventoryService.post_receipt(
        organization=org,
        item=raw_mat,
        warehouse=wh,
        quantity=Decimal('1000.0000'),
        unit_cost=Decimal('40.0000'),
        performed_by=manager
    )

    product = Product.objects.create(
        organization=org,
        code="PROD-BENCH",
        name="Bench",
        unit_of_measure=uom_pcs
    )

    bom = BillOfMaterials.objects.create(
        organization=org,
        product=product,
        version="v1.0",
        status=BOMStatus.RELEASED,
        created_by=manager
    )

    # 2 kg required per unit, 5% planned scrap allowance -> Gross = 2.10 kg/unit
    BOMComponent.objects.create(
        organization=org,
        bom=bom,
        item=raw_mat,
        quantity=Decimal('2.0000'),
        unit_of_measure=uom_kg,
        scrap_allowance_percent=Decimal('5.00')
    )

    return org, manager, operator, wh, raw_mat, product, bom

@pytest.mark.django_db
class TestProductionWorkflowAndCosting:

    def test_bom_snapshot_immutability(self, prod_setup):
        org, manager, operator, wh, raw_mat, product, bom = prod_setup

        order = ProductionOrder.objects.create(
            organization=org,
            order_number="PO-TEST-1",
            product=product,
            bom=bom,
            warehouse=wh,
            planned_quantity=Decimal('10.0000'),
            creator=manager
        )
        ProductionService.release_order(order, actor=manager)

        comp = order.order_components.get(item=raw_mat)
        # 10 units * 2 kg * 1.05 = 21 kg
        assert comp.planned_quantity == Decimal('21.0000')

        # If later BOM changes in catalog, snapshot on order must NOT change
        bom_comp = bom.components.get(item=raw_mat)
        bom_comp.quantity = Decimal('100.0000')
        bom_comp.save()

        comp.refresh_from_db()
        assert comp.planned_quantity == Decimal('21.0000')

    def test_state_machine_invalid_transitions(self, prod_setup):
        org, manager, operator, wh, raw_mat, product, bom = prod_setup

        order = ProductionOrder.objects.create(
            organization=org,
            order_number="PO-TEST-2",
            product=product,
            bom=bom,
            warehouse=wh,
            planned_quantity=Decimal('10.0000'),
            status=OrderStatus.DRAFT,
            creator=manager
        )

        # Cannot jump from DRAFT directly to COMPLETED or CLOSED
        with pytest.raises(ValidationError):
            ProductionService.validate_transition(order.status, OrderStatus.COMPLETED)

        with pytest.raises(ValidationError):
            ProductionService.validate_transition(order.status, OrderStatus.CLOSED)

    def test_specification_variance_and_costing_calculation(self, prod_setup):
        """
        Exact specification example:
        Order plans 100 finished units. Each unit requires 2 kg with 5% planned allowance.
        Planned: 210 kg.
        Actual consumption: 215 kg @ ₹40/kg.
        Actual material cost: ₹8,600.
        Cost per good unit (100 good units): ₹86.
        Material variance: 5 kg above 210 kg (+2.38%).
        """
        org, manager, operator, wh, raw_mat, product, bom = prod_setup

        order = ProductionOrder.objects.create(
            organization=org,
            order_number="PO-SPEC-TEST",
            product=product,
            bom=bom,
            warehouse=wh,
            planned_quantity=Decimal('100.0000'),
            creator=manager
        )
        ProductionService.release_order(order, actor=manager)
        ProductionService.assign_user(order, operator, actor=manager, is_primary=True)

        comp = order.order_components.get(item=raw_mat)
        assert comp.planned_quantity == Decimal('210.0000')

        # Issue 215 kg
        ProductionService.issue_materials(order, comp, Decimal('215.0000'), wh, actor=manager)

        # Operator consumes 215 kg
        ProductionService.record_consumption(order, comp, Decimal('215.0000'), Decimal('5.0000'), operator, wh)

        # Operator completes 100 good units
        ProductionService.record_output(order, Decimal('100.0000'), Decimal('0.0000'), operator, wh)

        comp.refresh_from_db()
        order.refresh_from_db()

        assert comp.consumed_quantity == Decimal('215.0000')
        assert comp.variance_quantity == Decimal('5.0000')
        assert comp.variance_percentage == Decimal('2.38')
        assert order.total_actual_material_cost == Decimal('8600.0000')
        assert order.actual_cost_per_good_unit == Decimal('86.0000')

        # Close order safely
        closed_order = ProductionService.close_order(order, actor=manager)
        assert closed_order.status == OrderStatus.CLOSED

    def test_unreconciled_materials_block_order_close(self, prod_setup):
        org, manager, operator, wh, raw_mat, product, bom = prod_setup

        order = ProductionOrder.objects.create(
            organization=org,
            order_number="PO-RECON-FAIL",
            product=product,
            bom=bom,
            warehouse=wh,
            planned_quantity=Decimal('10.0000'),
            creator=manager
        )
        ProductionService.release_order(order, actor=manager)
        comp = order.order_components.get(item=raw_mat)

        # Issue 30 kg to production
        ProductionService.issue_materials(order, comp, Decimal('30.0000'), wh, actor=manager)

        # Only 20 kg consumed, 10 kg still floating with no return recorded
        ProductionService.record_consumption(order, comp, Decimal('20.0000'), Decimal('0.0000'), operator, wh)
        ProductionService.record_output(order, Decimal('10.0000'), Decimal('0.0000'), operator, wh)

        # Closing must be blocked because 10 kg is unreconciled
        with pytest.raises(ValidationError) as exc:
            ProductionService.close_order(order, actor=manager)
        assert "Material reconciliation pending" in str(exc.value)

        # Return remaining 10 kg to warehouse
        ProductionService.return_materials(order, comp, Decimal('10.0000'), wh, actor=manager)

        # Now closing succeeds
        closed = ProductionService.close_order(order, actor=manager)
        assert closed.status == OrderStatus.CLOSED

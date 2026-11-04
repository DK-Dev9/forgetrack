from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from apps.organizations.models import Organization
from apps.users.models import User, UserRole
from apps.inventory.models import UnitOfMeasure, Warehouse, Item, ItemType, StockBalance
from apps.inventory.services import InventoryService
from apps.products.models import Product, BillOfMaterials, BOMComponent, BOMStatus
from apps.production.models import ProductionOrder, OrderStatus, OrderPriority
from apps.production.services import ProductionService

class Command(BaseCommand):
    help = "Seeds ForgeTrack demo data with organization, roles, inventory, BOMs, and production workflows."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Starting ForgeTrack demo data seeding..."))

        # 1. Organization
        org, _ = Organization.objects.get_or_create(
            slug="apex-industrial",
            defaults={"name": "Apex Industrial Fabricators", "is_active": True}
        )
        self.stdout.write(f"Organization: {org.name} ({org.slug})")

        # 2. Users for all 5 roles
        demo_password = "ForgeTrackDemo123!"

        users_data = [
            ("admin@forgetrack.com", "Vikram Sharma", UserRole.ADMIN, "EMP-001", "Management", "+91 98765 43210"),
            ("manager@forgetrack.com", "Rajesh Patel", UserRole.PRODUCTION_MANAGER, "EMP-002", "Production", "+91 98765 43211"),
            ("store@forgetrack.com", "Amit Kumar", UserRole.STOREKEEPER, "EMP-003", "Warehouse & Inventory", "+91 98765 43212"),
            ("operator@forgetrack.com", "Suresh Verma", UserRole.OPERATOR, "EMP-004", "Fabrication Line A", "+91 98765 43213"),
            ("operator2@forgetrack.com", "Pooja Singh", UserRole.OPERATOR, "EMP-005", "Assembly Line B", "+91 98765 43214"),
            ("viewer@forgetrack.com", "Ananya Iyer", UserRole.VIEWER, "EMP-006", "Quality & Auditing", "+91 98765 43215"),
        ]

        users = {}
        for email, full_name, role, emp_code, dept, phone in users_data:
            user = User.objects.filter(email=email).first()
            if not user:
                user = User.objects.create_user(
                    email=email,
                    password=demo_password,
                    full_name=full_name,
                    role=role,
                    employee_code=emp_code,
                    department=dept,
                    phone_number=phone,
                    organization=org,
                    is_active=True
                )
                self.stdout.write(f"Created user: {user.full_name} ({user.email}) [{user.role}]")
            else:
                user.organization = org
                user.role = role
                user.set_password(demo_password)
                user.save()
            users[email] = user

        admin_user = users["admin@forgetrack.com"]
        manager_user = users["manager@forgetrack.com"]
        store_user = users["store@forgetrack.com"]
        op1_user = users["operator@forgetrack.com"]
        op2_user = users["operator2@forgetrack.com"]

        # 3. Units of Measure
        uoms_data = [
            ("kg", "Kilogram"),
            ("m", "Meter"),
            ("pcs", "Piece"),
            ("l", "Liter"),
        ]
        uoms = {}
        for code, name in uoms_data:
            uom, _ = UnitOfMeasure.objects.get_or_create(
                organization=org,
                code=code,
                defaults={"name": name}
            )
            uoms[code] = uom

        # 4. Warehouses
        wh_main, _ = Warehouse.objects.get_or_create(
            organization=org,
            code="MAIN-WH",
            defaults={"name": "Raw Materials Central Depot", "location": "Building A, Bay 1-4", "is_active": True}
        )
        wh_fg, _ = Warehouse.objects.get_or_create(
            organization=org,
            code="FG-WH",
            defaults={"name": "Finished Goods Warehouse", "location": "Building C, Bay 7", "is_active": True}
        )

        # 5. Items (Raw materials & finished goods)
        items_def = [
            ("RM-STEEL-01", "Mild Steel Sheet 2mm", ItemType.RAW_MATERIAL, "kg", Decimal('40.0000'), Decimal('500.0000')),
            ("RM-PIPE-01", "Structural Square Pipe 50x50", ItemType.RAW_MATERIAL, "m", Decimal('120.0000'), Decimal('200.0000')),
            ("COMP-FAST-01", "High Tensile M10 Bolt & Nut Set", ItemType.COMPONENT, "pcs", Decimal('15.0000'), Decimal('1000.0000')),
            ("RM-COAT-01", "Epoxy Industrial Primer", ItemType.RAW_MATERIAL, "l", Decimal('350.0000'), Decimal('50.0000')),
            ("RM-PIGMENT-01", "Zinc Phosphate Anti-Rust Powder", ItemType.RAW_MATERIAL, "kg", Decimal('280.0000'), Decimal('100.0000')),
            ("FG-TABLE-01", "Heavy Duty Industrial Workbench", ItemType.FINISHED_GOOD, "pcs", Decimal('3250.0000'), Decimal('10.0000')),
            ("FG-RACK-01", "Modular Cantilever Storage Rack", ItemType.FINISHED_GOOD, "pcs", Decimal('6800.0000'), Decimal('5.0000')),
        ]

        items = {}
        for code, name, itype, uom_code, cost, reorder in items_def:
            item, _ = Item.objects.get_or_create(
                organization=org,
                code=code,
                defaults={
                    "name": name,
                    "item_type": itype,
                    "base_uom": uoms[uom_code],
                    "unit_cost": cost,
                    "reorder_level": reorder,
                    "is_active": True
                }
            )
            items[code] = item

        # 6. Products
        prod_table, _ = Product.objects.get_or_create(
            organization=org,
            code="PROD-WORKBENCH-HD",
            defaults={
                "name": "Heavy Duty Industrial Workbench",
                "description": "Ergonomic 2000x900mm steel frame workbench with powder coating",
                "unit_of_measure": uoms["pcs"],
                "linked_item": items["FG-TABLE-01"],
                "is_active": True
            }
        )

        prod_rack, _ = Product.objects.get_or_create(
            organization=org,
            code="PROD-RACK-CANTILEVER",
            defaults={
                "name": "Modular Cantilever Storage Rack",
                "description": "Multi-tier structural pipe cantilever rack for raw material bars",
                "unit_of_measure": uoms["pcs"],
                "linked_item": items["FG-RACK-01"],
                "is_active": True
            }
        )

        # 7. Bill of Materials
        # Workbench BOM v1.0
        bom_table, _ = BillOfMaterials.objects.get_or_create(
            organization=org,
            product=prod_table,
            version="v1.0",
            defaults={
                "status": BOMStatus.RELEASED,
                "notes": "Standard manufacturing BOM with 5% cutting/process allowance",
                "created_by": manager_user
            }
        )
        if bom_table.status != BOMStatus.RELEASED:
            bom_table.status = BOMStatus.RELEASED
            bom_table.save()

        # Components for Workbench
        table_components = [
            (items["RM-STEEL-01"], Decimal('25.0000'), uoms["kg"], Decimal('5.00'), "Top plate and reinforcements"),
            (items["RM-PIPE-01"], Decimal('8.0000'), uoms["m"], Decimal('3.00'), "Legs and horizontal crossbars"),
            (items["COMP-FAST-01"], Decimal('24.0000'), uoms["pcs"], Decimal('0.00'), "Structural assembly fasteners"),
            (items["RM-COAT-01"], Decimal('1.5000'), uoms["l"], Decimal('5.00'), "Double-coat protective primer"),
        ]
        for itm, qty, uom, scrap, notes in table_components:
            BOMComponent.objects.get_or_create(
                organization=org,
                bom=bom_table,
                item=itm,
                defaults={"quantity": qty, "unit_of_measure": uom, "scrap_allowance_percent": scrap, "notes": notes}
            )

        # Cantilever Rack BOM v1.0
        bom_rack, _ = BillOfMaterials.objects.get_or_create(
            organization=org,
            product=prod_rack,
            version="v1.0",
            defaults={
                "status": BOMStatus.RELEASED,
                "notes": "High load structural storage rack BOM",
                "created_by": manager_user
            }
        )
        if bom_rack.status != BOMStatus.RELEASED:
            bom_rack.status = BOMStatus.RELEASED
            bom_rack.save()

        rack_components = [
            (items["RM-PIPE-01"], Decimal('18.0000'), uoms["m"], Decimal('4.00'), "Uprights and support arms"),
            (items["RM-STEEL-01"], Decimal('40.0000'), uoms["kg"], Decimal('5.00'), "Base plates and gussets"),
            (items["COMP-FAST-01"], Decimal('32.0000'), uoms["pcs"], Decimal('0.00'), "Anchor and joint bolts"),
        ]
        for itm, qty, uom, scrap, notes in rack_components:
            BOMComponent.objects.get_or_create(
                organization=org,
                bom=bom_rack,
                item=itm,
                defaults={"quantity": qty, "unit_of_measure": uom, "scrap_allowance_percent": scrap, "notes": notes}
            )

        # 8. Seed Stock Receipts (Inventory ledger movements)
        receipts_data = [
            (items["RM-STEEL-01"], wh_main, Decimal('3500.0000'), Decimal('40.0000'), "PO-REC-2026-01"),
            (items["RM-PIPE-01"], wh_main, Decimal('1200.0000'), Decimal('120.0000'), "PO-REC-2026-02"),
            (items["COMP-FAST-01"], wh_main, Decimal('5000.0000'), Decimal('15.0000'), "PO-REC-2026-03"),
            (items["RM-COAT-01"], wh_main, Decimal('250.0000'), Decimal('350.0000'), "PO-REC-2026-04"),
            # Low stock example: only 30 kg received, reorder level is 100 kg!
            (items["RM-PIGMENT-01"], wh_main, Decimal('30.0000'), Decimal('280.0000'), "PO-REC-2026-05"),
        ]

        for itm, wh, qty, cost, ref in receipts_data:
            if not itm.stock_balances.filter(warehouse=wh, on_hand__gt=0).exists():
                InventoryService.post_receipt(
                    organization=org,
                    item=itm,
                    warehouse=wh,
                    quantity=qty,
                    unit_cost=cost,
                    reference_number=ref,
                    performed_by=store_user,
                    notes="Initial warehouse inventory receipt"
                )
                self.stdout.write(f"Stock receipt: {qty} {itm.base_uom.code} of {itm.code} at {wh.code}")

        # 9. Production Orders
        today = timezone.now().date()

        # Order 1: Closed order with variance and costing (20 workbenches)
        order1 = ProductionOrder.objects.filter(organization=org, order_number="PO-0001").first()
        if not order1:
            order1 = ProductionOrder.objects.create(
                organization=org,
                order_number="PO-0001",
                product=prod_table,
                bom=bom_table,
                warehouse=wh_main,
                planned_quantity=Decimal('20.0000'),
                priority=OrderPriority.HIGH,
                status=OrderStatus.DRAFT,
                planned_start_date=today - timedelta(days=10),
                due_date=today - timedelta(days=2),
                creator=manager_user,
                notes="Standard production run for Q1 client stock."
            )
            # Release
            ProductionService.release_order(order1, actor=manager_user)
            # Assign op1
            ProductionService.assign_user(order1, op1_user, actor=manager_user, is_primary=True)

            # Issue materials
            for comp in order1.order_components.all():
                ProductionService.issue_materials(
                    order=order1,
                    component=comp,
                    quantity=comp.planned_quantity,
                    warehouse=wh_main,
                    actor=store_user,
                    notes=f"Full issue for {order1.order_number}"
                )

            # Record consumption with slight variance:
            # Steel: planned is 25 * 20 * 1.05 = 525 kg. Consumed = 535 kg (10 kg scrap/extra)
            steel_comp = order1.order_components.get(item=items["RM-STEEL-01"])
            ProductionService.record_consumption(
                order=order1,
                component=steel_comp,
                quantity_consumed=Decimal('535.0000'),
                scrap_quantity=Decimal('10.0000'),
                operator=op1_user,
                warehouse=wh_main,
                notes="Slight material variance due to sheet corner offcuts"
            )

            # Pipe: planned 8 * 20 * 1.03 = 164.8 m. Consumed = 165 m.
            pipe_comp = order1.order_components.get(item=items["RM-PIPE-01"])
            ProductionService.record_consumption(
                order=order1,
                component=pipe_comp,
                quantity_consumed=Decimal('165.0000'),
                scrap_quantity=Decimal('0.2000'),
                operator=op1_user,
                warehouse=wh_main
            )

            # Fasteners: planned 24 * 20 = 480. Consumed = 480.
            fast_comp = order1.order_components.get(item=items["COMP-FAST-01"])
            ProductionService.record_consumption(
                order=order1,
                component=fast_comp,
                quantity_consumed=Decimal('480.0000'),
                operator=op1_user,
                warehouse=wh_main
            )

            # Coat: planned 1.5 * 20 * 1.05 = 31.5 l. Consumed = 31.5 l.
            coat_comp = order1.order_components.get(item=items["RM-COAT-01"])
            ProductionService.record_consumption(
                order=order1,
                component=coat_comp,
                quantity_consumed=Decimal('31.5000'),
                operator=op1_user,
                warehouse=wh_main
            )

            # Output: 20 good units, 0 rejected
            ProductionService.record_output(
                order=order1,
                good_quantity=Decimal('20.0000'),
                rejected_quantity=Decimal('0.0000'),
                operator=op1_user,
                warehouse=wh_fg,
                notes="All 20 workbenches passed quality inspection"
            )

            # Close order
            ProductionService.close_order(order1, actor=manager_user, notes="Final QA passed and batch closed.")
            self.stdout.write(f"Created & Closed order {order1.order_number}: Cost/unit INR {order1.actual_cost_per_good_unit}")

        # Order 2: In Progress (30 Cantilever Racks)
        order2 = ProductionOrder.objects.filter(organization=org, order_number="PO-0002").first()
        if not order2:
            order2 = ProductionOrder.objects.create(
                organization=org,
                order_number="PO-0002",
                product=prod_rack,
                bom=bom_rack,
                warehouse=wh_main,
                planned_quantity=Decimal('30.0000'),
                priority=OrderPriority.URGENT,
                status=OrderStatus.DRAFT,
                planned_start_date=today - timedelta(days=3),
                due_date=today + timedelta(days=4),
                creator=manager_user,
                notes="Urgent fulfillment for warehouse expansion contract."
            )
            ProductionService.release_order(order2, actor=manager_user)
            ProductionService.assign_user(order2, op1_user, actor=manager_user, is_primary=True)
            ProductionService.assign_user(order2, op2_user, actor=manager_user, is_primary=False)

            # Partially issue materials
            for comp in order2.order_components.all():
                half_qty = comp.planned_quantity * Decimal('0.5')
                ProductionService.issue_materials(
                    order=order2,
                    component=comp,
                    quantity=round(half_qty, 4),
                    warehouse=wh_main,
                    actor=store_user,
                    notes="Partial batch issue (Phase 1)"
                )

            # Operator reports partial consumption and 10 finished good units
            pipe_c = order2.order_components.get(item=items["RM-PIPE-01"])
            ProductionService.record_consumption(
                order=order2,
                component=pipe_c,
                quantity_consumed=Decimal('200.0000'),
                scrap_quantity=Decimal('4.0000'),
                operator=op1_user,
                warehouse=wh_main,
                notes="Upright frames cut and deburred"
            )

            ProductionService.record_output(
                order=order2,
                good_quantity=Decimal('10.0000'),
                rejected_quantity=Decimal('1.0000'),
                operator=op1_user,
                warehouse=wh_fg,
                notes="10 units pre-assembled. 1 unit rejected due to weld imperfection."
            )
            self.stdout.write(f"Created In-Progress order {order2.order_number}")

        # Order 3: Released order (15 Workbenches), assigned to Operator 2
        order3 = ProductionOrder.objects.filter(organization=org, order_number="PO-0003").first()
        if not order3:
            order3 = ProductionOrder.objects.create(
                organization=org,
                order_number="PO-0003",
                product=prod_table,
                bom=bom_table,
                warehouse=wh_main,
                planned_quantity=Decimal('15.0000'),
                priority=OrderPriority.MEDIUM,
                status=OrderStatus.DRAFT,
                planned_start_date=today,
                due_date=today + timedelta(days=7),
                creator=manager_user,
                notes="Scheduled assembly run"
            )
            ProductionService.release_order(order3, actor=manager_user)
            ProductionService.assign_user(order3, op2_user, actor=manager_user, is_primary=True)
            self.stdout.write(f"Created Released order {order3.order_number}")

        # Order 4: Overdue Order for alert demonstration (5 Racks)
        order4 = ProductionOrder.objects.filter(organization=org, order_number="PO-0004").first()
        if not order4:
            order4 = ProductionOrder.objects.create(
                organization=org,
                order_number="PO-0004",
                product=prod_rack,
                bom=bom_rack,
                warehouse=wh_main,
                planned_quantity=Decimal('5.0000'),
                priority=OrderPriority.HIGH,
                status=OrderStatus.DRAFT,
                planned_start_date=today - timedelta(days=12),
                due_date=today - timedelta(days=3),
                creator=manager_user,
                notes="Delayed awaiting customer dimension confirmation"
            )
            ProductionService.release_order(order4, actor=manager_user)
            ProductionService.assign_user(order4, op1_user, actor=manager_user, is_primary=True)
            order4.status = OrderStatus.IN_PROGRESS
            order4.save(update_fields=['status'])
            self.stdout.write(f"Created Overdue order {order4.order_number}")

        # 10. Specification test case: Order with 100 finished units @ 2 kg/unit + 5% scrap
        # Planned: 210 kg. Actual: 215 kg @ ₹40/kg. Actual cost: ₹8,600. Cost/unit: ₹86. Variance: +5 kg (+2.38%)
        spec_order = ProductionOrder.objects.filter(organization=org, order_number="PO-SPEC-01").first()
        if not spec_order:
            # Create a simple test product & BOM matching the prompt example exactly
            spec_prod, _ = Product.objects.get_or_create(
                organization=org,
                code="SPEC-PROD-100",
                defaults={"name": "Specification Bench Test Unit", "unit_of_measure": uoms["pcs"], "is_active": True}
            )
            spec_bom, _ = BillOfMaterials.objects.get_or_create(
                organization=org,
                product=spec_prod,
                version="v1.0",
                defaults={"status": BOMStatus.RELEASED, "created_by": manager_user}
            )
            if spec_bom.status != BOMStatus.RELEASED:
                spec_bom.status = BOMStatus.RELEASED
                spec_bom.save()

            BOMComponent.objects.get_or_create(
                organization=org,
                bom=spec_bom,
                item=items["RM-STEEL-01"],
                defaults={
                    "quantity": Decimal('2.0000'),
                    "unit_of_measure": uoms["kg"],
                    "scrap_allowance_percent": Decimal('5.00'),
                    "notes": "2 kg base requirement with 5% allowance = 2.10 kg/unit"
                }
            )

            spec_order = ProductionOrder.objects.create(
                organization=org,
                order_number="PO-SPEC-01",
                product=spec_prod,
                bom=spec_bom,
                warehouse=wh_main,
                planned_quantity=Decimal('100.0000'),
                status=OrderStatus.DRAFT,
                creator=manager_user,
                notes="Prompt specification verification test order"
            )
            ProductionService.release_order(spec_order, actor=manager_user)
            ProductionService.assign_user(spec_order, op1_user, actor=manager_user, is_primary=True)

            spec_comp = spec_order.order_components.get(item=items["RM-STEEL-01"])
            # Issue 215 kg
            ProductionService.issue_materials(
                order=spec_order,
                component=spec_comp,
                quantity=Decimal('215.0000'),
                warehouse=wh_main,
                actor=store_user
            )
            # Record actual consumption = 215 kg
            ProductionService.record_consumption(
                order=spec_order,
                component=spec_comp,
                quantity_consumed=Decimal('215.0000'),
                scrap_quantity=Decimal('5.0000'),
                operator=op1_user,
                warehouse=wh_main
            )
            # Complete 100 good units
            ProductionService.record_output(
                order=spec_order,
                good_quantity=Decimal('100.0000'),
                operator=op1_user,
                warehouse=wh_fg
            )
            ProductionService.close_order(spec_order, actor=manager_user)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Specification Example Verified: Planned={spec_comp.planned_quantity}kg, "
                    f"Actual={spec_comp.consumed_quantity}kg, Cost=INR {spec_order.total_actual_material_cost}, "
                    f"Cost/unit=INR {spec_order.actual_cost_per_good_unit}, Variance={spec_comp.variance_quantity}kg ({spec_comp.variance_percentage}%)"
                )
            )

        self.stdout.write(self.style.SUCCESS("Demo data seeding completed successfully!"))

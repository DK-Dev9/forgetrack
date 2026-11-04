from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from .models import (
    StockBalance,
    InventoryLedgerTransaction,
    TransactionType,
    Item,
    Warehouse
)
from apps.audit.services import log_audit_event

class InventoryService:

    @staticmethod
    def get_or_create_stock_balance(organization, item, warehouse, lock=False) -> StockBalance:
        qs = StockBalance.objects
        if lock:
            qs = qs.select_for_update()
        try:
            return qs.get(organization=organization, item=item, warehouse=warehouse)
        except StockBalance.DoesNotExist:
            return StockBalance.objects.create(
                organization=organization,
                item=item,
                warehouse=warehouse,
                on_hand=Decimal('0.0000'),
                reserved=Decimal('0.0000'),
                issued_to_production=Decimal('0.0000')
            )

    @classmethod
    @transaction.atomic
    def post_receipt(
        cls,
        organization,
        item: Item,
        warehouse: Warehouse,
        quantity: Decimal,
        unit_cost: Decimal,
        reference_number: str = "",
        performed_by=None,
        notes: str = "",
        idempotency_key: str = None
    ) -> InventoryLedgerTransaction:
        if quantity <= 0:
            raise ValidationError("Receipt quantity must be greater than zero.")
        if unit_cost < 0:
            raise ValidationError("Unit cost cannot be negative.")

        if idempotency_key:
            existing = InventoryLedgerTransaction.objects.filter(
                organization=organization,
                idempotency_key=idempotency_key
            ).first()
            if existing:
                return existing

        balance = cls.get_or_create_stock_balance(organization, item, warehouse, lock=True)

        # Update Weighted Average Cost (WAC)
        total_current_value = balance.on_hand * item.unit_cost
        new_receipt_value = quantity * unit_cost
        new_on_hand = balance.on_hand + quantity
        
        if new_on_hand > 0:
            item.unit_cost = (total_current_value + new_receipt_value) / new_on_hand
            item.save(update_fields=['unit_cost', 'updated_at'])

        balance.on_hand = new_on_hand
        balance.save(update_fields=['on_hand', 'updated_at'])

        txn = InventoryLedgerTransaction.objects.create(
            organization=organization,
            item=item,
            warehouse=warehouse,
            transaction_type=TransactionType.RECEIPT,
            quantity=quantity,
            unit_cost=unit_cost,
            total_cost=quantity * unit_cost,
            balance_after=balance.on_hand,
            reference_number=reference_number,
            source_document_type="PURCHASE_RECEIPT",
            idempotency_key=idempotency_key,
            performed_by=performed_by,
            notes=notes
        )

        log_audit_event(
            action="STOCK_RECEIPT",
            entity_type="InventoryLedgerTransaction",
            entity_id=str(txn.id),
            actor=performed_by,
            organization=organization,
            description=f"Received {quantity} {item.base_uom.code} of {item.name} at {warehouse.name} @ {unit_cost} each",
            after_state={"on_hand": str(balance.on_hand), "wac": str(item.unit_cost)}
        )

        return txn

    @classmethod
    @transaction.atomic
    def post_reservation(
        cls,
        organization,
        item: Item,
        warehouse: Warehouse,
        quantity: Decimal,
        reference_number: str = "",
        source_document_type: str = "PRODUCTION_ORDER",
        source_document_id: str = "",
        performed_by=None,
        notes: str = ""
    ) -> InventoryLedgerTransaction:
        if quantity <= 0:
            raise ValidationError("Reservation quantity must be greater than zero.")

        balance = cls.get_or_create_stock_balance(organization, item, warehouse, lock=True)
        if balance.available < quantity:
            raise ValidationError(
                f"Insufficient available stock for item {item.code} at {warehouse.code}. "
                f"Requested: {quantity}, Available: {balance.available}"
            )

        balance.reserved += quantity
        balance.save(update_fields=['reserved', 'updated_at'])

        txn = InventoryLedgerTransaction.objects.create(
            organization=organization,
            item=item,
            warehouse=warehouse,
            transaction_type=TransactionType.RESERVATION,
            quantity=quantity,
            unit_cost=item.unit_cost,
            total_cost=quantity * item.unit_cost,
            balance_after=balance.available,
            reference_number=reference_number,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            performed_by=performed_by,
            notes=notes
        )

        return txn

    @classmethod
    @transaction.atomic
    def release_reservation(
        cls,
        organization,
        item: Item,
        warehouse: Warehouse,
        quantity: Decimal,
        reference_number: str = "",
        source_document_type: str = "PRODUCTION_ORDER",
        source_document_id: str = "",
        performed_by=None,
        notes: str = ""
    ) -> InventoryLedgerTransaction:
        if quantity <= 0:
            raise ValidationError("Release quantity must be greater than zero.")

        balance = cls.get_or_create_stock_balance(organization, item, warehouse, lock=True)
        release_qty = min(balance.reserved, quantity)
        balance.reserved -= release_qty
        balance.save(update_fields=['reserved', 'updated_at'])

        txn = InventoryLedgerTransaction.objects.create(
            organization=organization,
            item=item,
            warehouse=warehouse,
            transaction_type=TransactionType.RESERVATION_RELEASE,
            quantity=release_qty,
            unit_cost=item.unit_cost,
            total_cost=release_qty * item.unit_cost,
            balance_after=balance.available,
            reference_number=reference_number,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            performed_by=performed_by,
            notes=notes
        )

        return txn

    @classmethod
    @transaction.atomic
    def issue_material(
        cls,
        organization,
        item: Item,
        warehouse: Warehouse,
        quantity: Decimal,
        reference_number: str = "",
        source_document_type: str = "PRODUCTION_ORDER",
        source_document_id: str = "",
        performed_by=None,
        notes: str = ""
    ) -> InventoryLedgerTransaction:
        if quantity <= 0:
            raise ValidationError("Issue quantity must be greater than zero.")

        balance = cls.get_or_create_stock_balance(organization, item, warehouse, lock=True)
        if balance.on_hand < quantity:
            raise ValidationError(
                f"Insufficient on-hand stock for item {item.code} at {warehouse.code}. "
                f"Requested: {quantity}, On-hand: {balance.on_hand}"
            )

        # Release reservation if it was reserved for this
        if balance.reserved >= quantity:
            balance.reserved -= quantity
        else:
            balance.reserved = Decimal('0.0000')

        balance.on_hand -= quantity
        balance.issued_to_production += quantity
        balance.save(update_fields=['on_hand', 'reserved', 'issued_to_production', 'updated_at'])

        txn = InventoryLedgerTransaction.objects.create(
            organization=organization,
            item=item,
            warehouse=warehouse,
            transaction_type=TransactionType.MATERIAL_ISSUE,
            quantity=quantity,
            unit_cost=item.unit_cost,
            total_cost=quantity * item.unit_cost,
            balance_after=balance.on_hand,
            reference_number=reference_number,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            performed_by=performed_by,
            notes=notes
        )

        log_audit_event(
            action="MATERIAL_ISSUED",
            entity_type="ProductionOrder",
            entity_id=source_document_id,
            actor=performed_by,
            organization=organization,
            description=f"Issued {quantity} {item.base_uom.code} of {item.name} from {warehouse.name}",
            after_state={"on_hand": str(balance.on_hand), "issued": str(balance.issued_to_production)}
        )

        return txn

    @classmethod
    @transaction.atomic
    def return_material(
        cls,
        organization,
        item: Item,
        warehouse: Warehouse,
        quantity: Decimal,
        reference_number: str = "",
        source_document_type: str = "PRODUCTION_ORDER",
        source_document_id: str = "",
        performed_by=None,
        notes: str = ""
    ) -> InventoryLedgerTransaction:
        if quantity <= 0:
            raise ValidationError("Return quantity must be greater than zero.")

        balance = cls.get_or_create_stock_balance(organization, item, warehouse, lock=True)
        balance.on_hand += quantity
        balance.issued_to_production = max(Decimal('0.0000'), balance.issued_to_production - quantity)
        balance.save(update_fields=['on_hand', 'issued_to_production', 'updated_at'])

        txn = InventoryLedgerTransaction.objects.create(
            organization=organization,
            item=item,
            warehouse=warehouse,
            transaction_type=TransactionType.MATERIAL_RETURN,
            quantity=quantity,
            unit_cost=item.unit_cost,
            total_cost=quantity * item.unit_cost,
            balance_after=balance.on_hand,
            reference_number=reference_number,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            performed_by=performed_by,
            notes=notes
        )

        log_audit_event(
            action="MATERIAL_RETURNED",
            entity_type="ProductionOrder",
            entity_id=source_document_id,
            actor=performed_by,
            organization=organization,
            description=f"Returned {quantity} {item.base_uom.code} of {item.name} to {warehouse.name}",
            after_state={"on_hand": str(balance.on_hand)}
        )

        return txn

    @classmethod
    @transaction.atomic
    def record_production_consumption(
        cls,
        organization,
        item: Item,
        warehouse: Warehouse,
        quantity: Decimal,
        reference_number: str = "",
        source_document_type: str = "PRODUCTION_ORDER",
        source_document_id: str = "",
        performed_by=None,
        notes: str = ""
    ) -> InventoryLedgerTransaction:
        if quantity <= 0:
            raise ValidationError("Consumption quantity must be greater than zero.")

        balance = cls.get_or_create_stock_balance(organization, item, warehouse, lock=True)
        balance.issued_to_production = max(Decimal('0.0000'), balance.issued_to_production - quantity)
        balance.save(update_fields=['issued_to_production', 'updated_at'])

        txn = InventoryLedgerTransaction.objects.create(
            organization=organization,
            item=item,
            warehouse=warehouse,
            transaction_type=TransactionType.PRODUCTION_CONSUMPTION,
            quantity=quantity,
            unit_cost=item.unit_cost,
            total_cost=quantity * item.unit_cost,
            balance_after=balance.on_hand,
            reference_number=reference_number,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            performed_by=performed_by,
            notes=notes
        )

        return txn

    @classmethod
    @transaction.atomic
    def record_finished_goods(
        cls,
        organization,
        finished_item: Item,
        warehouse: Warehouse,
        quantity: Decimal,
        unit_cost: Decimal,
        reference_number: str = "",
        source_document_type: str = "PRODUCTION_ORDER",
        source_document_id: str = "",
        performed_by=None,
        notes: str = ""
    ) -> InventoryLedgerTransaction:
        if quantity <= 0:
            raise ValidationError("Finished goods quantity must be greater than zero.")

        balance = cls.get_or_create_stock_balance(organization, finished_item, warehouse, lock=True)
        balance.on_hand += quantity
        balance.save(update_fields=['on_hand', 'updated_at'])

        txn = InventoryLedgerTransaction.objects.create(
            organization=organization,
            item=finished_item,
            warehouse=warehouse,
            transaction_type=TransactionType.FINISHED_GOODS_RECEIPT,
            quantity=quantity,
            unit_cost=unit_cost,
            total_cost=quantity * unit_cost,
            balance_after=balance.on_hand,
            reference_number=reference_number,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            performed_by=performed_by,
            notes=notes
        )

        return txn

    @classmethod
    @transaction.atomic
    def transfer_stock(
        cls,
        organization,
        item: Item,
        source_warehouse: Warehouse,
        target_warehouse: Warehouse,
        quantity: Decimal,
        reference_number: str = "",
        performed_by=None,
        notes: str = ""
    ):
        if quantity <= 0:
            raise ValidationError("Transfer quantity must be greater than zero.")
        if source_warehouse == target_warehouse:
            raise ValidationError("Source and destination warehouses cannot be the same.")

        src_bal = cls.get_or_create_stock_balance(organization, item, source_warehouse, lock=True)
        if src_bal.available < quantity:
            raise ValidationError(
                f"Insufficient available stock at {source_warehouse.code}. "
                f"Available: {src_bal.available}, Requested: {quantity}"
            )

        tgt_bal = cls.get_or_create_stock_balance(organization, item, target_warehouse, lock=True)

        src_bal.on_hand -= quantity
        src_bal.save(update_fields=['on_hand', 'updated_at'])

        tgt_bal.on_hand += quantity
        tgt_bal.save(update_fields=['on_hand', 'updated_at'])

        out_txn = InventoryLedgerTransaction.objects.create(
            organization=organization,
            item=item,
            warehouse=source_warehouse,
            transaction_type=TransactionType.TRANSFER_OUT,
            quantity=quantity,
            unit_cost=item.unit_cost,
            total_cost=quantity * item.unit_cost,
            balance_after=src_bal.on_hand,
            reference_number=reference_number,
            source_document_type="TRANSFER",
            performed_by=performed_by,
            notes=f"Transfer to {target_warehouse.code}. {notes}"
        )

        in_txn = InventoryLedgerTransaction.objects.create(
            organization=organization,
            item=item,
            warehouse=target_warehouse,
            transaction_type=TransactionType.TRANSFER_IN,
            quantity=quantity,
            unit_cost=item.unit_cost,
            total_cost=quantity * item.unit_cost,
            balance_after=tgt_bal.on_hand,
            reference_number=reference_number,
            source_document_type="TRANSFER",
            performed_by=performed_by,
            notes=f"Transfer from {source_warehouse.code}. {notes}"
        )

        log_audit_event(
            action="STOCK_TRANSFER",
            entity_type="InventoryTransfer",
            entity_id=reference_number or str(out_txn.id),
            actor=performed_by,
            organization=organization,
            description=f"Transferred {quantity} {item.code} from {source_warehouse.code} to {target_warehouse.code}"
        )

        return out_txn, in_txn

    @classmethod
    @transaction.atomic
    def adjust_stock(
        cls,
        organization,
        item: Item,
        warehouse: Warehouse,
        delta_quantity: Decimal,
        reason: str,
        performed_by=None,
        notes: str = ""
    ) -> InventoryLedgerTransaction:
        if delta_quantity == 0:
            raise ValidationError("Adjustment quantity cannot be zero.")

        balance = cls.get_or_create_stock_balance(organization, item, warehouse, lock=True)
        new_on_hand = balance.on_hand + delta_quantity
        if new_on_hand < 0:
            raise ValidationError(
                f"Negative stock not allowed. Current on-hand is {balance.on_hand}, "
                f"adjustment delta is {delta_quantity}."
            )

        balance.on_hand = new_on_hand
        balance.save(update_fields=['on_hand', 'updated_at'])

        txn_type = TransactionType.POSITIVE_ADJUSTMENT if delta_quantity > 0 else TransactionType.NEGATIVE_ADJUSTMENT

        txn = InventoryLedgerTransaction.objects.create(
            organization=organization,
            item=item,
            warehouse=warehouse,
            transaction_type=txn_type,
            quantity=abs(delta_quantity),
            unit_cost=item.unit_cost,
            total_cost=abs(delta_quantity) * item.unit_cost,
            balance_after=balance.on_hand,
            reference_number=reason,
            source_document_type="STOCK_ADJUSTMENT",
            performed_by=performed_by,
            notes=notes
        )

        log_audit_event(
            action="STOCK_ADJUSTMENT",
            entity_type="InventoryAdjustment",
            entity_id=str(txn.id),
            actor=performed_by,
            organization=organization,
            description=f"Stock adjustment of {delta_quantity} for {item.code} at {warehouse.code}: {reason}",
            after_state={"on_hand": str(balance.on_hand)}
        )

        return txn

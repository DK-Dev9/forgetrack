from decimal import Decimal
from rest_framework import serializers
from .models import UnitOfMeasure, Warehouse, Item, StockBalance, InventoryLedgerTransaction, ItemType, TransactionType

class UnitOfMeasureSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitOfMeasure
        fields = ['id', 'code', 'name']

    def create(self, validated_data):
        user = self.context['request'].user
        return UnitOfMeasure.objects.create(organization=user.organization, **validated_data)


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ['id', 'code', 'name', 'location', 'is_active']

    def create(self, validated_data):
        user = self.context['request'].user
        return Warehouse.objects.create(organization=user.organization, **validated_data)


class ItemSerializer(serializers.ModelSerializer):
    base_uom_details = UnitOfMeasureSerializer(source='base_uom', read_only=True)
    total_on_hand = serializers.SerializerMethodField()
    total_available = serializers.SerializerMethodField()
    is_low_stock = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = [
            'id',
            'code',
            'name',
            'description',
            'item_type',
            'base_uom',
            'base_uom_details',
            'unit_cost',
            'reorder_level',
            'total_on_hand',
            'total_available',
            'is_low_stock',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'unit_cost']

    def get_total_on_hand(self, obj) -> str:
        balances = obj.stock_balances.all()
        return str(sum((b.on_hand for b in balances), Decimal('0.0000')))

    def get_total_available(self, obj) -> str:
        balances = obj.stock_balances.all()
        return str(sum((b.available for b in balances), Decimal('0.0000')))

    def get_is_low_stock(self, obj) -> bool:
        balances = obj.stock_balances.all()
        total_avail = sum((b.available for b in balances), Decimal('0.0000'))
        return total_avail <= obj.reorder_level and obj.reorder_level > Decimal('0.0000')

    def create(self, validated_data):
        user = self.context['request'].user
        return Item.objects.create(organization=user.organization, **validated_data)


class StockBalanceSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source='item.code', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_type = serializers.CharField(source='item.item_type', read_only=True)
    uom_code = serializers.CharField(source='item.base_uom.code', read_only=True)
    warehouse_code = serializers.CharField(source='warehouse.code', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    available = serializers.DecimalField(max_digits=14, decimal_places=4, read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = StockBalance
        fields = [
            'id',
            'item',
            'item_code',
            'item_name',
            'item_type',
            'uom_code',
            'warehouse',
            'warehouse_code',
            'warehouse_name',
            'on_hand',
            'reserved',
            'available',
            'issued_to_production',
            'is_low_stock',
            'updated_at',
        ]


class InventoryLedgerSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source='item.code', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    uom_code = serializers.CharField(source='item.base_uom.code', read_only=True)
    warehouse_code = serializers.CharField(source='warehouse.code', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    performed_by_name = serializers.CharField(source='performed_by.full_name', read_only=True)

    class Meta:
        model = InventoryLedgerTransaction
        fields = [
            'id',
            'item',
            'item_code',
            'item_name',
            'uom_code',
            'warehouse',
            'warehouse_code',
            'warehouse_name',
            'transaction_type',
            'quantity',
            'unit_cost',
            'total_cost',
            'balance_after',
            'reference_number',
            'source_document_type',
            'source_document_id',
            'performed_by',
            'performed_by_name',
            'notes',
            'created_at',
        ]


class StockReceiptCreateSerializer(serializers.Serializer):
    item_id = serializers.UUIDField()
    warehouse_id = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=14, decimal_places=4)
    unit_cost = serializers.DecimalField(max_digits=14, decimal_places=4)
    reference_number = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    idempotency_key = serializers.CharField(required=False, allow_blank=True, default=None)


class StockTransferCreateSerializer(serializers.Serializer):
    item_id = serializers.UUIDField()
    source_warehouse_id = serializers.UUIDField()
    target_warehouse_id = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=14, decimal_places=4)
    reference_number = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class StockAdjustmentCreateSerializer(serializers.Serializer):
    item_id = serializers.UUIDField()
    warehouse_id = serializers.UUIDField()
    delta_quantity = serializers.DecimalField(max_digits=14, decimal_places=4)
    reason = serializers.CharField(max_length=100)
    notes = serializers.CharField(required=False, allow_blank=True, default="")

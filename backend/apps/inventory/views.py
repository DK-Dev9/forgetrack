from decimal import Decimal
from django.db import models
from rest_framework import generics, views, status, permissions
from rest_framework.response import Response
from .models import (
    UnitOfMeasure,
    Warehouse,
    Item,
    StockBalance,
    InventoryLedgerTransaction,
    ItemType,
    TransactionType
)
from .serializers import (
    UnitOfMeasureSerializer,
    WarehouseSerializer,
    ItemSerializer,
    StockBalanceSerializer,
    InventoryLedgerSerializer,
    StockReceiptCreateSerializer,
    StockTransferCreateSerializer,
    StockAdjustmentCreateSerializer,
)
from .services import InventoryService
from apps.users.permissions import (
    IsStorekeeperOrAbove,
    IsProductionManagerOrAdmin,
    IsAdminUserRole
)

class UnitOfMeasureListCreateView(generics.ListCreateAPIView):
    serializer_class = UnitOfMeasureSerializer

    def get_queryset(self):
        return UnitOfMeasure.objects.filter(organization=self.request.user.organization)


class WarehouseListCreateView(generics.ListCreateAPIView):
    serializer_class = WarehouseSerializer

    def get_queryset(self):
        return Warehouse.objects.filter(organization=self.request.user.organization)


class ItemListCreateView(generics.ListCreateAPIView):
    serializer_class = ItemSerializer

    def get_queryset(self):
        qs = Item.objects.filter(
            organization=self.request.user.organization
        ).select_related('base_uom').prefetch_related('stock_balances')

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                models.Q(code__icontains=search) |
                models.Q(name__icontains=search) |
                models.Q(description__icontains=search)
            )

        item_type = self.request.query_params.get('item_type')
        if item_type and item_type in ItemType.values:
            qs = qs.filter(item_type=item_type)

        low_stock_only = self.request.query_params.get('low_stock')
        if low_stock_only in ('true', '1'):
            # Filter where total available <= reorder_level
            # Note: We can filter via python or annotations
            pass

        return qs


class ItemDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ItemSerializer
    lookup_field = 'id'

    def get_queryset(self):
        return Item.objects.filter(organization=self.request.user.organization)


class StockBalanceListView(generics.ListAPIView):
    serializer_class = StockBalanceSerializer

    def get_queryset(self):
        qs = StockBalance.objects.filter(
            organization=self.request.user.organization
        ).select_related('item', 'warehouse', 'item__base_uom')

        warehouse_id = self.request.query_params.get('warehouse')
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)

        item_id = self.request.query_params.get('item')
        if item_id:
            qs = qs.filter(item_id=item_id)

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                models.Q(item__code__icontains=search) |
                models.Q(item__name__icontains=search) |
                models.Q(warehouse__name__icontains=search)
            )

        return qs


class InventoryLedgerListView(generics.ListAPIView):
    serializer_class = InventoryLedgerSerializer

    def get_queryset(self):
        qs = InventoryLedgerTransaction.objects.filter(
            organization=self.request.user.organization
        ).select_related('item', 'warehouse', 'performed_by', 'item__base_uom')

        txn_type = self.request.query_params.get('transaction_type')
        if txn_type and txn_type in TransactionType.values:
            qs = qs.filter(transaction_type=txn_type)

        warehouse_id = self.request.query_params.get('warehouse')
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)

        item_id = self.request.query_params.get('item')
        if item_id:
            qs = qs.filter(item_id=item_id)

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                models.Q(reference_number__icontains=search) |
                models.Q(item__code__icontains=search) |
                models.Q(item__name__icontains=search)
            )

        return qs


class PostStockReceiptView(views.APIView):
    permission_classes = [IsStorekeeperOrAbove]

    def post(self, request):
        serializer = StockReceiptCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        org = request.user.organization
        try:
            item = Item.objects.get(id=data['item_id'], organization=org)
            warehouse = Warehouse.objects.get(id=data['warehouse_id'], organization=org)
        except (Item.DoesNotExist, Warehouse.DoesNotExist):
            return Response({"detail": "Item or Warehouse not found in this organization."}, status=status.HTTP_404_NOT_FOUND)

        txn = InventoryService.post_receipt(
            organization=org,
            item=item,
            warehouse=warehouse,
            quantity=data['quantity'],
            unit_cost=data['unit_cost'],
            reference_number=data.get('reference_number', ''),
            performed_by=request.user,
            notes=data.get('notes', ''),
            idempotency_key=data.get('idempotency_key')
        )

        return Response(InventoryLedgerSerializer(txn).data, status=status.HTTP_201_CREATED)


class PostStockTransferView(views.APIView):
    permission_classes = [IsStorekeeperOrAbove]

    def post(self, request):
        serializer = StockTransferCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        org = request.user.organization
        try:
            item = Item.objects.get(id=data['item_id'], organization=org)
            src_wh = Warehouse.objects.get(id=data['source_warehouse_id'], organization=org)
            tgt_wh = Warehouse.objects.get(id=data['target_warehouse_id'], organization=org)
        except (Item.DoesNotExist, Warehouse.DoesNotExist):
            return Response({"detail": "Item or Warehouse not found."}, status=status.HTTP_404_NOT_FOUND)

        out_txn, in_txn = InventoryService.transfer_stock(
            organization=org,
            item=item,
            source_warehouse=src_wh,
            target_warehouse=tgt_wh,
            quantity=data['quantity'],
            reference_number=data.get('reference_number', ''),
            performed_by=request.user,
            notes=data.get('notes', '')
        )

        return Response({
            "transfer_out": InventoryLedgerSerializer(out_txn).data,
            "transfer_in": InventoryLedgerSerializer(in_txn).data
        }, status=status.HTTP_201_CREATED)


class PostStockAdjustmentView(views.APIView):
    permission_classes = [IsProductionManagerOrAdmin]

    def post(self, request):
        serializer = StockAdjustmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        org = request.user.organization
        try:
            item = Item.objects.get(id=data['item_id'], organization=org)
            warehouse = Warehouse.objects.get(id=data['warehouse_id'], organization=org)
        except (Item.DoesNotExist, Warehouse.DoesNotExist):
            return Response({"detail": "Item or Warehouse not found."}, status=status.HTTP_404_NOT_FOUND)

        txn = InventoryService.adjust_stock(
            organization=org,
            item=item,
            warehouse=warehouse,
            delta_quantity=data['delta_quantity'],
            reason=data['reason'],
            performed_by=request.user,
            notes=data.get('notes', '')
        )

        return Response(InventoryLedgerSerializer(txn).data, status=status.HTTP_201_CREATED)


class StockReconciliationReportView(views.APIView):
    """Compares cached stock balances with append-only ledger transaction sums."""
    permission_classes = [IsStorekeeperOrAbove]

    def get(self, request):
        org = request.user.organization
        balances = StockBalance.objects.filter(organization=org).select_related('item', 'warehouse')
        report = []

        for bal in balances:
            # Calculate sum of transactions in ledger
            txns = InventoryLedgerTransaction.objects.filter(
                organization=org,
                item=bal.item,
                warehouse=bal.warehouse
            )

            calculated_on_hand = Decimal('0.0000')
            for t in txns:
                if t.transaction_type in (
                    TransactionType.RECEIPT,
                    TransactionType.MATERIAL_RETURN,
                    TransactionType.TRANSFER_IN,
                    TransactionType.POSITIVE_ADJUSTMENT,
                    TransactionType.FINISHED_GOODS_RECEIPT
                ):
                    calculated_on_hand += t.quantity
                elif t.transaction_type in (
                    TransactionType.MATERIAL_ISSUE,
                    TransactionType.TRANSFER_OUT,
                    TransactionType.NEGATIVE_ADJUSTMENT
                ):
                    calculated_on_hand -= t.quantity

            discrepancy = bal.on_hand - calculated_on_hand
            report.append({
                "item_id": str(bal.item.id),
                "item_code": bal.item.code,
                "item_name": bal.item.name,
                "warehouse_id": str(bal.warehouse.id),
                "warehouse_code": bal.warehouse.code,
                "cached_on_hand": str(bal.on_hand),
                "ledger_calculated_on_hand": str(calculated_on_hand),
                "discrepancy": str(discrepancy),
                "reconciled": discrepancy == Decimal('0.0000')
            })

        return Response(report)

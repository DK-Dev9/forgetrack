from django.urls import path
from .views import (
    UnitOfMeasureListCreateView,
    WarehouseListCreateView,
    ItemListCreateView,
    ItemDetailView,
    StockBalanceListView,
    InventoryLedgerListView,
    PostStockReceiptView,
    PostStockTransferView,
    PostStockAdjustmentView,
    StockReconciliationReportView,
)

urlpatterns = [
    path('uom/', UnitOfMeasureListCreateView.as_view(), name='uom-list-create'),
    path('warehouses/', WarehouseListCreateView.as_view(), name='warehouse-list-create'),
    path('items/', ItemListCreateView.as_view(), name='item-list-create'),
    path('items/<uuid:id>/', ItemDetailView.as_view(), name='item-detail'),
    path('balances/', StockBalanceListView.as_view(), name='stock-balance-list'),
    path('ledger/', InventoryLedgerListView.as_view(), name='inventory-ledger-list'),
    path('receipts/', PostStockReceiptView.as_view(), name='post-stock-receipt'),
    path('transfers/', PostStockTransferView.as_view(), name='post-stock-transfer'),
    path('adjustments/', PostStockAdjustmentView.as_view(), name='post-stock-adjustment'),
    path('reconciliation/', StockReconciliationReportView.as_view(), name='stock-reconciliation'),
]

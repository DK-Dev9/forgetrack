import { apiClient } from './client';
import {
  Item,
  UnitOfMeasure,
  Warehouse,
  StockBalance,
  InventoryLedgerTransaction,
  ReconciliationItem,
} from '../types';

export const inventoryApi = {
  getUOMs: async (): Promise<UnitOfMeasure[]> => {
    const res = await apiClient.get('/inventory/uom/');
    return res.data.results || res.data;
  },

  getWarehouses: async (): Promise<Warehouse[]> => {
    const res = await apiClient.get('/inventory/warehouses/');
    return res.data.results || res.data;
  },

  getItems: async (params?: { search?: string; item_type?: string }): Promise<Item[]> => {
    const res = await apiClient.get('/inventory/items/', { params });
    return res.data.results || res.data;
  },

  createItem: async (data: Partial<Item>): Promise<Item> => {
    const res = await apiClient.post<Item>('/inventory/items/', data);
    return res.data;
  },

  getBalances: async (params?: { warehouse?: string; item?: string; search?: string }): Promise<StockBalance[]> => {
    const res = await apiClient.get('/inventory/balances/', { params });
    return res.data.results || res.data;
  },

  getLedger: async (params?: { transaction_type?: string; warehouse?: string; item?: string; search?: string }): Promise<InventoryLedgerTransaction[]> => {
    const res = await apiClient.get('/inventory/ledger/', { params });
    return res.data.results || res.data;
  },

  postReceipt: async (data: {
    item_id: string;
    warehouse_id: string;
    quantity: string;
    unit_cost: string;
    reference_number?: string;
    notes?: string;
    idempotency_key?: string;
  }): Promise<InventoryLedgerTransaction> => {
    const res = await apiClient.post<InventoryLedgerTransaction>('/inventory/receipts/', data);
    return res.data;
  },

  postTransfer: async (data: {
    item_id: string;
    source_warehouse_id: string;
    target_warehouse_id: string;
    quantity: string;
    reference_number?: string;
    notes?: string;
  }) => {
    const res = await apiClient.post('/inventory/transfers/', data);
    return res.data;
  },

  postAdjustment: async (data: {
    item_id: string;
    warehouse_id: string;
    delta_quantity: string;
    reason: string;
    notes?: string;
  }): Promise<InventoryLedgerTransaction> => {
    const res = await apiClient.post<InventoryLedgerTransaction>('/inventory/adjustments/', data);
    return res.data;
  },

  getReconciliation: async (): Promise<ReconciliationItem[]> => {
    const res = await apiClient.get<ReconciliationItem[]>('/inventory/reconciliation/');
    return res.data;
  },
};

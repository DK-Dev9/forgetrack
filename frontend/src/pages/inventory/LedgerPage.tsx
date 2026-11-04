import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Search, Filter, ArrowUpRight, ArrowDownLeft, RefreshCcw } from 'lucide-react';
import { inventoryApi } from '../../api/inventoryApi';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { TransactionType } from '../../types';

export const LedgerPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [txnTypeFilter, setTxnTypeFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');

  const { data: ledger = [], isLoading, refetch } = useQuery({
    queryKey: ['ledger', { search, txnTypeFilter, warehouseFilter }],
    queryFn: () =>
      inventoryApi.getLedger({
        search: search || undefined,
        transaction_type: txnTypeFilter || undefined,
        warehouse: warehouseFilter || undefined,
      }),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: inventoryApi.getWarehouses,
  });

  const getTxnTypeBadge = (type: TransactionType) => {
    switch (type) {
      case 'RECEIPT':
        return <Badge variant="success">Receipt In</Badge>;
      case 'MATERIAL_ISSUE':
        return <Badge variant="info">Issue to Prod</Badge>;
      case 'MATERIAL_RETURN':
        return <Badge variant="warning">Return to Store</Badge>;
      case 'PRODUCTION_CONSUMPTION':
        return <Badge variant="neutral">Consumption</Badge>;
      case 'FINISHED_GOODS_RECEIPT':
        return <Badge variant="success">FG Inward</Badge>;
      case 'TRANSFER_IN':
        return <Badge variant="info">Transfer In</Badge>;
      case 'TRANSFER_OUT':
        return <Badge variant="warning">Transfer Out</Badge>;
      case 'POSITIVE_ADJUSTMENT':
        return <Badge variant="success">Adjust +</Badge>;
      case 'NEGATIVE_ADJUSTMENT':
        return <Badge variant="danger">Adjust -</Badge>;
      case 'RESERVATION':
        return <Badge variant="warning">Reserved</Badge>;
      case 'RESERVATION_RELEASE':
        return <Badge variant="neutral">Released</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Inventory Transaction Ledger</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable, append-only auditable log of all physical and reserved material movements
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
          Refresh Ledger
        </button>
      </div>

      {/* Filter Card */}
      <Card>
        <div className="p-4 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search reference numbers, SKUs, or document IDs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={txnTypeFilter}
              onChange={(e) => setTxnTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="">All Movement Types</option>
              <option value="RECEIPT">Stock Receipt</option>
              <option value="MATERIAL_ISSUE">Material Issue to Production</option>
              <option value="MATERIAL_RETURN">Material Return</option>
              <option value="PRODUCTION_CONSUMPTION">Production Consumption</option>
              <option value="FINISHED_GOODS_RECEIPT">Finished Goods Receipt</option>
              <option value="TRANSFER_IN">Warehouse Transfer In</option>
              <option value="TRANSFER_OUT">Warehouse Transfer Out</option>
              <option value="POSITIVE_ADJUSTMENT">Positive Adjustment</option>
              <option value="NEGATIVE_ADJUSTMENT">Negative Adjustment</option>
              <option value="RESERVATION">Reservation</option>
              <option value="RESERVATION_RELEASE">Reservation Release</option>
            </select>

            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="">All Locations</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Ledger Table */}
      <Card>
        <CardHeader
          title="Auditable Movement History"
          subtitle={`Total movements recorded: ${ledger.length}`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-6 py-3">Timestamp (UTC)</th>
                <th className="px-6 py-3">Movement Type</th>
                <th className="px-6 py-3">Item / SKU</th>
                <th className="px-6 py-3">Location</th>
                <th className="px-6 py-3 text-right">Movement Quantity</th>
                <th className="px-6 py-3 text-right">Unit Rate</th>
                <th className="px-6 py-3 text-right">Balance After</th>
                <th className="px-6 py-3">Reference / Source</th>
                <th className="px-6 py-3">Logged By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-400">
                    Loading ledger records...
                  </td>
                </tr>
              ) : ledger.length > 0 ? (
                ledger.map((txn) => {
                  const isPositive = [
                    'RECEIPT',
                    'MATERIAL_RETURN',
                    'TRANSFER_IN',
                    'POSITIVE_ADJUSTMENT',
                    'FINISHED_GOODS_RECEIPT',
                  ].includes(txn.transaction_type);

                  return (
                    <tr key={txn.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {new Date(txn.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5">{getTxnTypeBadge(txn.transaction_type)}</td>
                      <td className="px-6 py-3.5">
                        <span className="font-semibold text-slate-900 block">{txn.item_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{txn.item_code}</span>
                      </td>
                      <td className="px-6 py-3.5 font-medium text-slate-700">{txn.warehouse_code}</td>
                      <td className="px-6 py-3.5 text-right font-mono font-bold">
                        <span className={isPositive ? 'text-emerald-700' : 'text-slate-800'}>
                          {isPositive ? '+' : '-'}
                          {txn.quantity} {txn.uom_code}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-slate-600">
                        ₹{Number(txn.unit_cost).toFixed(2)}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-semibold text-slate-900">
                        {txn.balance_after} {txn.uom_code}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">
                        <div>
                          <span className="font-mono text-slate-800">{txn.reference_number || '-'}</span>
                          {txn.notes && (
                            <span className="text-[10px] text-slate-400 block line-clamp-1">
                              {txn.notes}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">{txn.performed_by_name || 'System'}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-400">
                    No ledger transactions found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

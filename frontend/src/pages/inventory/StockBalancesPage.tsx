import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Boxes, ArrowRightLeft, Search, AlertTriangle, Building2, Filter } from 'lucide-react';
import { inventoryApi } from '../../api/inventoryApi';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { StockBalance } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const StockBalancesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { isStorekeeper, isManager, isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');

  // Transfer modal
  const [transferBalance, setTransferBalance] = useState<StockBalance | null>(null);
  const [transferForm, setTransferForm] = useState({
    target_warehouse_id: '',
    quantity: '10',
    reference_number: '',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: balances = [], isLoading } = useQuery({
    queryKey: ['balances', { search, warehouseFilter }],
    queryFn: () =>
      inventoryApi.getBalances({
        search: search || undefined,
        warehouse: warehouseFilter || undefined,
      }),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: inventoryApi.getWarehouses,
  });

  const transferMutation = useMutation({
    mutationFn: inventoryApi.postTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      setTransferBalance(null);
    },
    onError: (err: any) => setFormError(err.message || 'Transfer failed'),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Current Stock Balances</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time multi-warehouse inventory breakdown, reservations, and issued work-in-progress
          </p>
        </div>
      </div>

      {/* Filter card */}
      <Card>
        <div className="p-4 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by SKU, item name, or warehouse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="w-full md:w-64">
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Balances Table */}
      <Card>
        <CardHeader
          title="Stock Ledger Balances"
          subtitle={`Showing ${balances.length} location records across facilities`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-6 py-3">Warehouse Location</th>
                <th className="px-6 py-3">Item / SKU</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3 text-right">Physical On-Hand</th>
                <th className="px-6 py-3 text-right">Reserved (Committed)</th>
                <th className="px-6 py-3 text-right">Available for Production</th>
                <th className="px-6 py-3 text-right">Issued to Shop Floor</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                    Loading stock balances...
                  </td>
                </tr>
              ) : balances.length > 0 ? (
                balances.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <div>
                          <span className="font-semibold text-slate-800 block">{b.warehouse_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{b.warehouse_code}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-medium text-slate-900 block">{b.item_name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{b.item_code}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge itemType={b.item_type} />
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold text-slate-900">
                      {b.on_hand} {b.uom_code}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-amber-700">
                      {b.reserved} {b.uom_code}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span
                        className={`font-mono font-bold text-xs ${
                          b.is_low_stock ? 'text-rose-600' : 'text-emerald-700'
                        }`}
                      >
                        {b.available} {b.uom_code}
                      </span>
                      {b.is_low_stock && (
                        <span className="block text-[10px] text-rose-500 font-semibold">Low Stock</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-indigo-700">
                      {b.issued_to_production} {b.uom_code}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {(isStorekeeper || isAdmin || isManager) && (
                        <button
                          onClick={() => {
                            setFormError(null);
                            setTransferBalance(b);
                            const otherWh = warehouses.find((w) => w.id !== b.warehouse);
                            if (otherWh) {
                              setTransferForm({
                                target_warehouse_id: otherWh.id,
                                quantity: Math.min(10, Number(b.available)).toString(),
                                reference_number: '',
                                notes: '',
                              });
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors"
                          title="Transfer to another warehouse"
                        >
                          <ArrowRightLeft className="w-3 h-3 text-brand-600" />
                          Transfer
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                    No balances found for criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Warehouse Transfer Modal */}
      {transferBalance && (
        <Modal
          isOpen={true}
          onClose={() => setTransferBalance(null)}
          title={`Inter-Warehouse Transfer`}
          description={`Transfer ${transferBalance.item_name} from ${transferBalance.warehouse_name}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              transferMutation.mutate({
                item_id: transferBalance.item,
                source_warehouse_id: transferBalance.warehouse,
                target_warehouse_id: transferForm.target_warehouse_id,
                quantity: transferForm.quantity,
                reference_number: transferForm.reference_number,
                notes: transferForm.notes,
              });
            }}
            className="space-y-4"
          >
            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-200">
                {formError}
              </div>
            )}

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex justify-between">
              <span>Source Available:</span>
              <span className="font-bold text-slate-900 font-mono">
                {transferBalance.available} {transferBalance.uom_code}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Destination Warehouse"
                value={transferForm.target_warehouse_id}
                onChange={(e) => setTransferForm({ ...transferForm, target_warehouse_id: e.target.value })}
              >
                {warehouses
                  .filter((w) => w.id !== transferBalance.warehouse)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
              </Select>

              <Input
                label={`Transfer Quantity (${transferBalance.uom_code})`}
                type="number"
                step="any"
                required
                value={transferForm.quantity}
                onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Transfer Reference / Dispatch Note"
                value={transferForm.reference_number}
                onChange={(e) => setTransferForm({ ...transferForm, reference_number: e.target.value })}
                placeholder="TR-2026-001"
              />
              <Input
                label="Notes"
                value={transferForm.notes}
                onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                placeholder="Vehicle number, reason..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setTransferBalance(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={transferMutation.isPending}>
                Execute Transfer
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

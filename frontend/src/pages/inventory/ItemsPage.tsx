import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PackageCheck,
  Plus,
  Search,
  ArrowDownToLine,
  Sliders,
  AlertTriangle,
  Boxes,
} from 'lucide-react';
import { inventoryApi } from '../../api/inventoryApi';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Item, ItemType } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const ItemsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { isStorekeeper, isManager, isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [receiptItem, setReceiptItem] = useState<Item | null>(null);
  const [adjustItem, setAdjustItem] = useState<Item | null>(null);

  // Form errors
  const [formError, setFormError] = useState<string | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    code: '',
    name: '',
    description: '',
    item_type: 'RAW_MATERIAL' as ItemType,
    base_uom: '',
    reorder_level: '100',
  });

  // Receipt form state
  const [receiptForm, setReceiptForm] = useState({
    warehouse_id: '',
    quantity: '100',
    unit_cost: '40',
    reference_number: '',
    notes: '',
  });

  // Adjustment form state
  const [adjustForm, setAdjustForm] = useState({
    warehouse_id: '',
    delta_quantity: '10',
    reason: 'Physical count adjustment',
    notes: '',
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items', { search, typeFilter }],
    queryFn: () =>
      inventoryApi.getItems({
        search: search || undefined,
        item_type: typeFilter || undefined,
      }),
  });

  const { data: uoms = [] } = useQuery({
    queryKey: ['uoms'],
    queryFn: inventoryApi.getUOMs,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: inventoryApi.getWarehouses,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: inventoryApi.createItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setIsCreateOpen(false);
      setCreateForm({
        code: '',
        name: '',
        description: '',
        item_type: 'RAW_MATERIAL',
        base_uom: '',
        reorder_level: '100',
      });
    },
    onError: (err: any) => setFormError(err.message || 'Failed to create item'),
  });

  const receiptMutation = useMutation({
    mutationFn: inventoryApi.postReceipt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      setReceiptItem(null);
    },
    onError: (err: any) => setFormError(err.message || 'Receipt failed'),
  });

  const adjustMutation = useMutation({
    mutationFn: inventoryApi.postAdjustment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      setAdjustItem(null);
    },
    onError: (err: any) => setFormError(err.message || 'Adjustment failed'),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Items & Raw Materials</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Material catalog, weighted average costs (WAC), and stock replenishment thresholds
          </p>
        </div>

        {(isAdmin || isManager || isStorekeeper) && (
          <Button
            onClick={() => {
              setFormError(null);
              if (uoms.length > 0 && !createForm.base_uom) {
                setCreateForm((prev) => ({ ...prev, base_uom: uoms[0].id }));
              }
              setIsCreateOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Item
          </Button>
        )}
      </div>

      {/* Filter card */}
      <Card>
        <div className="p-4 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by SKU / item code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="w-full md:w-56">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="">All Item Types</option>
              <option value="RAW_MATERIAL">Raw Materials</option>
              <option value="COMPONENT">Components & Fasteners</option>
              <option value="FINISHED_GOOD">Finished Goods</option>
              <option value="CONSUMABLE">Consumables</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader
          title="Item Master"
          subtitle={`Showing ${items.length} materials registered in catalog`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-6 py-3">Code / SKU</th>
                <th className="px-6 py-3">Item Name</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">UOM</th>
                <th className="px-6 py-3 text-right">Avg Unit Cost</th>
                <th className="px-6 py-3 text-right">Available Stock</th>
                <th className="px-6 py-3 text-right">Reorder Threshold</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                    Loading items...
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-mono font-semibold text-slate-900">
                      {item.code}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-medium text-slate-800 block">{item.name}</span>
                      {item.description && (
                        <span className="text-[10px] text-slate-400 block line-clamp-1">
                          {item.description}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge itemType={item.item_type} />
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-700">
                      {item.base_uom_details?.code || '-'}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold text-slate-900">
                      ₹{Number(item.unit_cost).toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span
                        className={`font-mono font-bold text-xs ${
                          item.is_low_stock ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        {item.total_available}
                      </span>
                      {item.is_low_stock && (
                        <span className="block text-[10px] text-rose-500 font-semibold">Low Stock</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-slate-500">
                      {item.reorder_level}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(isStorekeeper || isAdmin || isManager) && (
                          <button
                            onClick={() => {
                              setFormError(null);
                              setReceiptItem(item);
                              if (warehouses.length > 0) {
                                setReceiptForm((prev) => ({
                                  ...prev,
                                  warehouse_id: warehouses[0].id,
                                  unit_cost: item.unit_cost,
                                }));
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors"
                            title="Record Inward Receipt"
                          >
                            <ArrowDownToLine className="w-3 h-3 text-emerald-600" />
                            Receive
                          </button>
                        )}
                        {(isAdmin || isManager) && (
                          <button
                            onClick={() => {
                              setFormError(null);
                              setAdjustItem(item);
                              if (warehouses.length > 0) {
                                setAdjustForm((prev) => ({ ...prev, warehouse_id: warehouses[0].id }));
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors"
                            title="Adjust Stock"
                          >
                            <Sliders className="w-3 h-3 text-brand-600" />
                            Adjust
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                    No items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Item Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Material / Item"
        description="Define a new inventory SKU with base units and reorder thresholds"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(createForm);
          }}
          className="space-y-4"
        >
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Item Code / SKU"
              required
              value={createForm.code}
              onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. RM-ALUM-01"
            />
            <Input
              label="Item Name"
              required
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="Aluminum Extrusion Bar"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Item Type"
              value={createForm.item_type}
              onChange={(e) => setCreateForm({ ...createForm, item_type: e.target.value as ItemType })}
            >
              <option value="RAW_MATERIAL">Raw Material</option>
              <option value="COMPONENT">Component</option>
              <option value="FINISHED_GOOD">Finished Good</option>
              <option value="CONSUMABLE">Consumable</option>
            </Select>

            <Select
              label="Base UOM"
              value={createForm.base_uom}
              onChange={(e) => setCreateForm({ ...createForm, base_uom: e.target.value })}
            >
              {uoms.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </Select>

            <Input
              label="Reorder Alert Level"
              type="number"
              step="any"
              value={createForm.reorder_level}
              onChange={(e) => setCreateForm({ ...createForm, reorder_level: e.target.value })}
            />
          </div>

          <Input
            label="Description"
            value={createForm.description}
            onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            placeholder="Specifications, supplier details, dimensions..."
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Item
            </Button>
          </div>
        </form>
      </Modal>

      {/* Stock Receipt Modal */}
      {receiptItem && (
        <Modal
          isOpen={true}
          onClose={() => setReceiptItem(null)}
          title={`Stock Receipt: ${receiptItem.name}`}
          description={`Receive materials into inventory. Recalculates Weighted Average Cost automatically.`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              receiptMutation.mutate({
                item_id: receiptItem.id,
                warehouse_id: receiptForm.warehouse_id,
                quantity: receiptForm.quantity,
                unit_cost: receiptForm.unit_cost,
                reference_number: receiptForm.reference_number,
                notes: receiptForm.notes,
              });
            }}
            className="space-y-4"
          >
            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-200">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Destination Warehouse"
                value={receiptForm.warehouse_id}
                onChange={(e) => setReceiptForm({ ...receiptForm, warehouse_id: e.target.value })}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </Select>

              <Input
                label={`Quantity Received (${receiptItem.base_uom_details?.code || 'units'})`}
                type="number"
                step="any"
                required
                value={receiptForm.quantity}
                onChange={(e) => setReceiptForm({ ...receiptForm, quantity: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Purchase Unit Rate (INR)"
                type="number"
                step="any"
                required
                value={receiptForm.unit_cost}
                onChange={(e) => setReceiptForm({ ...receiptForm, unit_cost: e.target.value })}
              />

              <Input
                label="PO / Invoice Reference"
                value={receiptForm.reference_number}
                onChange={(e) => setReceiptForm({ ...receiptForm, reference_number: e.target.value })}
                placeholder="PO-2026-99"
              />
            </div>

            <Input
              label="Notes"
              value={receiptForm.notes}
              onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
              placeholder="Supplier name, batch number..."
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setReceiptItem(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="success" isLoading={receiptMutation.isPending}>
                Post Inward Receipt
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Stock Adjustment Modal */}
      {adjustItem && (
        <Modal
          isOpen={true}
          onClose={() => setAdjustItem(null)}
          title={`Adjust Stock: ${adjustItem.name}`}
          description="Adjust on-hand inventory balances. Use positive numbers to increase, negative to decrease."
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              adjustMutation.mutate({
                item_id: adjustItem.id,
                warehouse_id: adjustForm.warehouse_id,
                delta_quantity: adjustForm.delta_quantity,
                reason: adjustForm.reason,
                notes: adjustForm.notes,
              });
            }}
            className="space-y-4"
          >
            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-200">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Warehouse"
                value={adjustForm.warehouse_id}
                onChange={(e) => setAdjustForm({ ...adjustForm, warehouse_id: e.target.value })}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </Select>

              <Input
                label="Delta Quantity (e.g. +5 or -2)"
                type="number"
                step="any"
                required
                value={adjustForm.delta_quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, delta_quantity: e.target.value })}
              />
            </div>

            <Input
              label="Reason for Adjustment"
              required
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              placeholder="e.g. Physical inventory cycle count correction"
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setAdjustItem(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={adjustMutation.isPending}>
                Save Adjustment
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

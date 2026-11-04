import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle2,
  Calculator,
  Lock,
  AlertTriangle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { productsApi } from '../../api/productsApi';
import { inventoryApi } from '../../api/inventoryApi';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { BillOfMaterials, BOMComponent } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const BOMPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { isManager, isAdmin } = useAuth();
  const [selectedBOM, setSelectedBOM] = useState<BillOfMaterials | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [previewBOM, setPreviewBOM] = useState<BillOfMaterials | null>(null);
  const [previewQuantity, setPreviewQuantity] = useState('50');
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Create BOM form state
  const [newBOM, setNewBOM] = useState({
    product: '',
    version: 'v1.0',
    notes: '',
    components: [] as Array<{
      item: string;
      quantity: string;
      unit_of_measure: string;
      scrap_allowance_percent: string;
      notes: string;
    }>,
  });

  const { data: boms = [], isLoading } = useQuery({
    queryKey: ['boms'],
    queryFn: () => productsApi.getBOMs(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getProducts(),
  });

  const { data: items = [] } = useQuery({
    queryKey: ['items'],
    queryFn: () => inventoryApi.getItems(),
  });

  const { data: uoms = [] } = useQuery({
    queryKey: ['uoms'],
    queryFn: inventoryApi.getUOMs,
  });

  // Mutations
  const createBOMMutation = useMutation({
    mutationFn: productsApi.createBOM,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsCreateOpen(false);
    },
    onError: (err: any) => setFormError(err.message || 'Failed to create BOM'),
  });

  const releaseBOMMutation = useMutation({
    mutationFn: productsApi.releaseBOM,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (selectedBOM) {
        productsApi.getBOMDetail(selectedBOM.id).then(setSelectedBOM);
      }
    },
    onError: (err: any) => setFormError(err.message || 'Failed to release BOM'),
  });

  const handleAddComponentLine = () => {
    if (items.length === 0 || uoms.length === 0) return;
    const firstItem = items[0];
    setNewBOM((prev) => ({
      ...prev,
      components: [
        ...prev.components,
        {
          item: firstItem.id,
          quantity: '1.0',
          unit_of_measure: firstItem.base_uom || uoms[0].id,
          scrap_allowance_percent: '0.0',
          notes: '',
        },
      ],
    }));
  };

  const handleRemoveComponentLine = (index: number) => {
    setNewBOM((prev) => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index),
    }));
  };

  const handleComponentChange = (index: number, field: string, value: string) => {
    setNewBOM((prev) => {
      const updated = [...prev.components];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'item') {
        const itm = items.find((it) => it.id === value);
        if (itm) {
          updated[index].unit_of_measure = itm.base_uom;
        }
      }
      return { ...prev, components: updated };
    });
  };

  const handleRunPreview = async () => {
    if (!previewBOM) return;
    try {
      const res = await productsApi.previewBOMCalculation(previewBOM.id, previewQuantity);
      setPreviewResult(res);
    } catch (err: any) {
      setFormError(err.message || 'Simulation failed');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Bills of Materials (BOM) & Engineering
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Component ratios, scrap allowances, and immutable version release workflows
          </p>
        </div>

        {(isAdmin || isManager) && (
          <Button
            onClick={() => {
              setFormError(null);
              if (products.length > 0) {
                setNewBOM({
                  product: products[0].id,
                  version: 'v1.0',
                  notes: '',
                  components: [],
                });
                handleAddComponentLine();
              }
              setIsCreateOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create New BOM Version
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: BOM List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            Registered BOM Versions ({boms.length})
          </h3>
          <div className="space-y-2">
            {boms.map((bom) => {
              const isSelected = selectedBOM?.id === bom.id;
              return (
                <div
                  key={bom.id}
                  onClick={() => setSelectedBOM(bom)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-brand-50/50 border-brand-500 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-slate-900">{bom.product_name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        bom.status === 'RELEASED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : bom.status === 'ARCHIVED'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {bom.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono font-medium">{bom.version}</span>
                    <span>{bom.components?.length || 0} component lines</span>
                  </div>
                  {bom.notes && <p className="text-[11px] text-slate-400 mt-2 line-clamp-1">{bom.notes}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected BOM Workspace */}
        <div className="lg:col-span-2">
          {selectedBOM ? (
            <Card>
              <CardHeader
                title={
                  <div className="flex items-center gap-3">
                    <span>{selectedBOM.product_name}</span>
                    <span className="text-xs font-mono font-normal text-slate-400">
                      ({selectedBOM.product_code})
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        selectedBOM.status === 'RELEASED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedBOM.status === 'ARCHIVED'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {selectedBOM.status}
                    </span>
                  </div>
                }
                subtitle={`Version: ${selectedBOM.version} • Created by ${
                  selectedBOM.created_by_name || 'Engineering'
                }`}
                action={
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPreviewBOM(selectedBOM);
                        setPreviewResult(null);
                        handleRunPreview();
                      }}
                      leftIcon={<Calculator className="w-3.5 h-3.5 text-brand-600" />}
                    >
                      Simulate Batch
                    </Button>

                    {selectedBOM.status === 'DRAFT' && (isAdmin || isManager) && (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => releaseBOMMutation.mutate(selectedBOM.id)}
                        isLoading={releaseBOMMutation.isPending}
                        leftIcon={<Lock className="w-3.5 h-3.5" />}
                      >
                        Release BOM
                      </Button>
                    )}
                  </div>
                }
              />

              <div className="p-6">
                {selectedBOM.notes && (
                  <div className="p-3 mb-6 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    <span className="font-semibold text-slate-800 block mb-0.5">Engineering Notes:</span>
                    {selectedBOM.notes}
                  </div>
                )}

                <h4 className="text-xs font-semibold uppercase text-slate-500 tracking-wider mb-3">
                  Required Bill of Materials Components (per 1 unit)
                </h4>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                        <th className="px-4 py-2.5">Component SKU</th>
                        <th className="px-4 py-2.5">Material Name</th>
                        <th className="px-4 py-2.5 text-right">Base Required Qty</th>
                        <th className="px-4 py-2.5 text-right">Scrap Allowance</th>
                        <th className="px-4 py-2.5 text-right">Gross Needed / Unit</th>
                        <th className="px-4 py-2.5 text-right">Est. Unit Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedBOM.components && selectedBOM.components.length > 0 ? (
                        selectedBOM.components.map((comp) => {
                          const baseQty = Number(comp.quantity);
                          const scrapPct = Number(comp.scrap_allowance_percent);
                          const gross = baseQty * (1 + scrapPct / 100);

                          return (
                            <tr key={comp.id || comp.item} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                                {comp.item_code}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-900">
                                {comp.item_name}
                                {comp.notes && (
                                  <span className="block text-[10px] text-slate-400">{comp.notes}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-slate-800">
                                {comp.quantity} {comp.uom_code}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-amber-700">
                                +{comp.scrap_allowance_percent}%
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                                {gross.toFixed(4)} {comp.uom_code}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-slate-600">
                                ₹{Number(comp.unit_cost || 0).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                            No component lines configured for this BOM.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-white border border-slate-200 rounded-xl text-slate-400">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">Select a Bill of Materials</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Choose a BOM version from the list to view component lines, calculate batch requirements, or release for production.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create BOM Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Bill of Materials (BOM)"
        description="Add a new engineering BOM version with components and scrap allowances"
        maxWidth="4xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createBOMMutation.mutate(newBOM);
          }}
          className="space-y-4"
        >
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Product"
              value={newBOM.product}
              onChange={(e) => setNewBOM({ ...newBOM, product: e.target.value })}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </Select>

            <Input
              label="BOM Version Code"
              required
              value={newBOM.version}
              onChange={(e) => setNewBOM({ ...newBOM, version: e.target.value })}
              placeholder="e.g. v1.1"
            />

            <Input
              label="Engineering Notes"
              value={newBOM.notes}
              onChange={(e) => setNewBOM({ ...newBOM, notes: e.target.value })}
              placeholder="Changes, revisions..."
            />
          </div>

          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Component Lines (per 1 unit of product)
              </label>
              <Button type="button" size="sm" variant="outline" onClick={handleAddComponentLine}>
                <Plus className="w-3.5 h-3.5" /> Add Component
              </Button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto p-1">
              {newBOM.components.map((comp, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-3 text-xs"
                >
                  <div className="flex-1 w-full sm:w-auto">
                    <select
                      value={comp.item}
                      onChange={(e) => handleComponentChange(idx, 'item', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                    >
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} ({it.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full sm:w-32">
                    <input
                      type="number"
                      step="any"
                      placeholder="Qty"
                      value={comp.quantity}
                      onChange={(e) => handleComponentChange(idx, 'quantity', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>

                  <div className="w-full sm:w-32">
                    <input
                      type="number"
                      step="any"
                      placeholder="Scrap %"
                      value={comp.scrap_allowance_percent}
                      onChange={(e) =>
                        handleComponentChange(idx, 'scrap_allowance_percent', e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>

                  <div className="flex-1 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      value={comp.notes}
                      onChange={(e) => handleComponentChange(idx, 'notes', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveComponentLine(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-200/60"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createBOMMutation.isPending}>
              Save Draft BOM
            </Button>
          </div>
        </form>
      </Modal>

      {/* Batch Calculation / Shortage Simulation Modal */}
      {previewBOM && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewBOM(null)}
          title={`Batch Requirements Simulation: ${previewBOM.product_name}`}
          description={`Simulate gross components, stock availability, and material cost for ${previewBOM.version}`}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Production Order Quantity
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={previewQuantity}
                    onChange={(e) => setPreviewQuantity(e.target.value)}
                    className="w-36 px-3 py-1.5 text-sm font-bold font-mono bg-white border border-slate-300 rounded-lg"
                  />
                  <Button size="sm" onClick={handleRunPreview} leftIcon={<Sparkles className="w-3.5 h-3.5" />}>
                    Calculate Requirements
                  </Button>
                </div>
              </div>

              {previewResult && (
                <div className="text-right">
                  <span className="text-xs text-slate-500 block">Est. Total Material Cost:</span>
                  <span className="text-xl font-bold font-mono text-slate-900">
                    ₹{Number(previewResult.total_estimated_material_cost).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {previewResult && (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider">
                      <th className="px-4 py-2.5">Component</th>
                      <th className="px-4 py-2.5 text-right">Gross Needed</th>
                      <th className="px-4 py-2.5 text-right">Available in Stock</th>
                      <th className="px-4 py-2.5 text-right">Estimated Shortage</th>
                      <th className="px-4 py-2.5 text-right">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewResult.components.map((item: any) => (
                      <tr key={item.item_id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-800 block">{item.item_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.item_code}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          {item.gross_quantity_needed} {item.uom_code}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          {item.total_available_stock} {item.uom_code}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {item.has_shortage ? (
                            <span className="text-rose-600">
                              -{item.shortage} {item.uom_code}
                            </span>
                          ) : (
                            <span className="text-emerald-600">0 (Sufficient)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900">
                          ₹{Number(item.total_estimated_cost).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setPreviewBOM(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

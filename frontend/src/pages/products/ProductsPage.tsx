import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, Search, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productsApi } from '../../api/productsApi';
import { inventoryApi } from '../../api/inventoryApi';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Product } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const ProductsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { isManager, isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    unit_of_measure: '',
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', { search }],
    queryFn: () => productsApi.getProducts({ search: search || undefined }),
  });

  const { data: uoms = [] } = useQuery({
    queryKey: ['uoms'],
    queryFn: inventoryApi.getUOMs,
  });

  const createMutation = useMutation({
    mutationFn: productsApi.createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsCreateOpen(false);
      setForm({ code: '', name: '', description: '', unit_of_measure: '' });
    },
    onError: (err: any) => setFormError(err.message || 'Failed to create product'),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Products Catalog</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Finished manufactured goods, specifications, and linked BOM definitions
          </p>
        </div>

        {(isAdmin || isManager) && (
          <Button
            onClick={() => {
              setFormError(null);
              if (uoms.length > 0 && !form.unit_of_measure) {
                setForm((prev) => ({ ...prev, unit_of_measure: uoms[0].id }));
              }
              setIsCreateOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Product
          </Button>
        )}
      </div>

      {/* Filter Card */}
      <Card>
        <div className="p-4">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search manufactured products by code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader
          title="Manufactured Goods"
          subtitle={`Showing ${products.length} registered products`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-6 py-3">Product Code</th>
                <th className="px-6 py-3">Product Name & Specifications</th>
                <th className="px-6 py-3">Sales / Finished UOM</th>
                <th className="px-6 py-3">Active BOM Version</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Loading products...
                  </td>
                </tr>
              ) : products.length > 0 ? (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-mono font-semibold text-slate-900">
                      {p.code}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-semibold text-slate-900 block">{p.name}</span>
                      {p.description && (
                        <span className="text-[10px] text-slate-400 block line-clamp-1">
                          {p.description}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-700">
                      {p.unit_of_measure_details?.name} ({p.unit_of_measure_details?.code})
                    </td>
                    <td className="px-6 py-3.5">
                      {p.active_bom_version ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {p.active_bom_version} (Released)
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No active BOM</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        to={`/products/boms?product=${p.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Manage BOMs →
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Product Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Manufactured Product"
        description="Add a new finished product item to the engineering catalog."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
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
              label="Product Code"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="e.g. FG-DESK-01"
            />
            <Input
              label="Product Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Executive Standing Desk"
            />
          </div>

          <Select
            label="Finished Goods Unit of Measure"
            value={form.unit_of_measure}
            onChange={(e) => setForm({ ...form, unit_of_measure: e.target.value })}
          >
            {uoms.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.code})
              </option>
            ))}
          </Select>

          <Input
            label="Engineering Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Dimensions, materials, weight capacity..."
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Product
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

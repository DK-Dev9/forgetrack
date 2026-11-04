import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Factory,
  Plus,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';
import { productionApi } from '../../api/productionApi';
import { productsApi } from '../../api/productsApi';
import { inventoryApi } from '../../api/inventoryApi';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Tabs } from '../../components/ui/Tabs';
import { OrderStatus, OrderPriority } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const ProductionOrdersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { isManager, isAdmin, isOperator } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const statusParam = searchParams.get('status') || '';
  const assignedToMe = searchParams.get('assigned_to_me') === 'true';

  // Create Order modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newOrder, setNewOrder] = useState({
    product: '',
    planned_quantity: '25',
    priority: 'MEDIUM' as OrderPriority,
    warehouse: '',
    planned_start_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    notes: '',
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', { search, status: statusParam, priority: priorityFilter, assignedToMe }],
    queryFn: () =>
      productionApi.getOrders({
        search: search || undefined,
        status: statusParam || undefined,
        priority: priorityFilter || undefined,
        assigned_to_me: assignedToMe ? 'true' : undefined,
      }),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getProducts(),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => inventoryApi.getWarehouses(),
  });

  const createMutation = useMutation({
    mutationFn: productionApi.createOrder,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setIsCreateOpen(false);
    },
    onError: (err: any) => setFormError(err.message || 'Failed to create order'),
  });

  const tabs = [
    { id: '', label: 'All Orders' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'RELEASED', label: 'Released (Ready)' },
    { id: 'COMPLETED', label: 'Completed' },
    { id: 'CLOSED', label: 'Closed Batches' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {assignedToMe ? 'My Assigned Production Orders' : 'Production Orders'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track planned work, release bills of materials, record output, and manage shop floor execution
          </p>
        </div>

        {(isManager || isAdmin) && (
          <Button
            onClick={() => {
              setFormError(null);
              if (products.length > 0 && !newOrder.product) {
                setNewOrder((prev) => ({
                  ...prev,
                  product: products[0].id,
                  warehouse: warehouses[0]?.id || '',
                }));
              }
              setIsCreateOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Production Order
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={statusParam}
        onChange={(val) => {
          const next = new URLSearchParams(searchParams);
          if (val) next.set('status', val);
          else next.delete('status');
          setSearchParams(next);
        }}
      />

      {/* Search & Priority Filter Card */}
      <Card>
        <div className="p-4 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by order number (PO-...), product code, or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="URGENT">Urgent</option>
            </select>

            <button
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                if (assignedToMe) next.delete('assigned_to_me');
                else next.set('assigned_to_me', 'true');
                setSearchParams(next);
              }}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                assignedToMe
                  ? 'bg-brand-50 border-brand-300 text-brand-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              My Assignments
            </button>
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader
          title="Production Queue"
          subtitle={`Showing ${orders.length} orders matching criteria`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-6 py-3">Order #</th>
                <th className="px-6 py-3">Product Name</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Priority</th>
                <th className="px-6 py-3">Target Completion</th>
                <th className="px-6 py-3">Due Date</th>
                <th className="px-6 py-3">Primary Assignee</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                    Loading production orders...
                  </td>
                </tr>
              ) : orders.length > 0 ? (
                orders.map((o) => {
                  const isOverdue =
                    o.due_date &&
                    new Date(o.due_date) < new Date() &&
                    !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(o.status);

                  return (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3.5 font-mono font-bold text-slate-900">
                        {o.order_number}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-semibold text-slate-900 block">{o.product_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{o.product_code}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <Badge status={o.status} />
                      </td>
                      <td className="px-6 py-3.5">
                        <Badge priority={o.priority} />
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="w-32">
                          <div className="flex justify-between text-[11px] mb-1 font-medium text-slate-700">
                            <span>
                              {o.completed_good_quantity} / {o.planned_quantity} {o.uom_code}
                            </span>
                            <span>{o.completion_percentage}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-brand-600 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Number(o.completion_percentage))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`font-mono text-xs ${
                            isOverdue ? 'text-rose-600 font-bold flex items-center gap-1' : 'text-slate-600'
                          }`}
                        >
                          {isOverdue && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                          {o.due_date ? new Date(o.due_date).toLocaleDateString() : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">
                        {o.primary_assignee_name || (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <Link
                          to={`/production/${o.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded transition-colors"
                        >
                          Open Workspace →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                    No production orders found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Order Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Schedule New Production Order"
        description="Initialize an order for a manufactured product and assign required quantities"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(newOrder);
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
              label="Finished Product"
              value={newOrder.product}
              onChange={(e) => setNewOrder({ ...newOrder, product: e.target.value })}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </Select>

            <Input
              label="Planned Batch Quantity"
              type="number"
              step="any"
              min="1"
              required
              value={newOrder.planned_quantity}
              onChange={(e) => setNewOrder({ ...newOrder, planned_quantity: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Priority"
              value={newOrder.priority}
              onChange={(e) => setNewOrder({ ...newOrder, priority: e.target.value as OrderPriority })}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>

            <Select
              label="Default Storage / Issue Warehouse"
              value={newOrder.warehouse}
              onChange={(e) => setNewOrder({ ...newOrder, warehouse: e.target.value })}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Planned Start Date"
              type="date"
              value={newOrder.planned_start_date}
              onChange={(e) => setNewOrder({ ...newOrder, planned_start_date: e.target.value })}
            />

            <Input
              label="Due Date"
              type="date"
              value={newOrder.due_date}
              onChange={(e) => setNewOrder({ ...newOrder, due_date: e.target.value })}
            />
          </div>

          <Input
            label="Production Work Notes"
            value={newOrder.notes}
            onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
            placeholder="Special manufacturing instructions..."
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Order
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

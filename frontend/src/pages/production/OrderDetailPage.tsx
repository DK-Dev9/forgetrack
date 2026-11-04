import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Factory,
  Lock,
  UserPlus,
  Trash2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Sliders,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Users,
  Layers,
  Sparkles,
  TrendingDown,
  Building2,
} from 'lucide-react';
import { productionApi } from '../../api/productionApi';
import { usersApi } from '../../api/usersApi';
import { inventoryApi } from '../../api/inventoryApi';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Tabs } from '../../components/ui/Tabs';
import { useAuth } from '../../context/AuthContext';
import { ProductionOrderComponent } from '../../types';

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user, isOperator, isStorekeeper, isManager, isAdmin, canAccessCosts } = useAuth();

  const [activeTab, setActiveTab] = useState('requirements');

  // Modals state
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [issueComponent, setIssueComponent] = useState<ProductionOrderComponent | null>(null);
  const [returnComponent, setReturnComponent] = useState<ProductionOrderComponent | null>(null);
  const [consumeComponent, setConsumeComponent] = useState<ProductionOrderComponent | null>(null);
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const [isCloseOpen, setIsCloseOpen] = useState(false);

  // Form error
  const [actionError, setActionError] = useState<string | null>(null);

  // Form states
  const [assignForm, setAssignForm] = useState({
    user_id: '',
    is_primary: false,
    notes: '',
  });

  const [issueForm, setIssueForm] = useState({
    quantity: '10',
    notes: '',
  });

  const [returnForm, setReturnForm] = useState({
    quantity: '5',
    notes: '',
  });

  const [consumeForm, setConsumeForm] = useState({
    quantity_consumed: '10',
    scrap_quantity: '0',
    notes: '',
  });

  const [outputForm, setOutputForm] = useState({
    good_quantity: '10',
    rejected_quantity: '0',
    notes: '',
  });

  const [closeNotes, setCloseNotes] = useState('');

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', id],
    queryFn: () => productionApi.getOrderDetail(id!),
    enabled: !!id,
  });

  const { data: teamUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getUsers(),
    enabled: isManager || isAdmin,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => inventoryApi.getWarehouses(),
  });

  const refreshOrder = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['balances'] });
    queryClient.invalidateQueries({ queryKey: ['ledger'] });
  };

  // Mutations
  const releaseMutation = useMutation({
    mutationFn: () => productionApi.releaseOrder(id!),
    onSuccess: refreshOrder,
    onError: (err: any) => setActionError(err.message),
  });

  const assignMutation = useMutation({
    mutationFn: (data: any) => productionApi.assignUser(id!, data),
    onSuccess: () => {
      refreshOrder();
      setIsAssignOpen(false);
    },
    onError: (err: any) => setActionError(err.message),
  });

  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => productionApi.removeUser(id!, userId),
    onSuccess: refreshOrder,
    onError: (err: any) => setActionError(err.message),
  });

  const issueMutation = useMutation({
    mutationFn: (data: any) => productionApi.issueMaterial(id!, data),
    onSuccess: () => {
      refreshOrder();
      setIssueComponent(null);
    },
    onError: (err: any) => setActionError(err.message),
  });

  const returnMutation = useMutation({
    mutationFn: (data: any) => productionApi.returnMaterial(id!, data),
    onSuccess: () => {
      refreshOrder();
      setReturnComponent(null);
    },
    onError: (err: any) => setActionError(err.message),
  });

  const consumeMutation = useMutation({
    mutationFn: (data: any) => productionApi.recordConsumption(id!, data),
    onSuccess: () => {
      refreshOrder();
      setConsumeComponent(null);
    },
    onError: (err: any) => setActionError(err.message),
  });

  const outputMutation = useMutation({
    mutationFn: (data: any) => productionApi.recordOutput(id!, data),
    onSuccess: () => {
      refreshOrder();
      setIsOutputOpen(false);
    },
    onError: (err: any) => setActionError(err.message),
  });

  const closeMutation = useMutation({
    mutationFn: (notes: string) => productionApi.closeOrder(id!, notes),
    onSuccess: () => {
      refreshOrder();
      setIsCloseOpen(false);
    },
    onError: (err: any) => setActionError(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse max-w-7xl mx-auto">
        <div className="h-8 bg-slate-200 rounded w-1/4" />
        <div className="h-44 bg-slate-200 rounded-xl" />
        <div className="h-96 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 max-w-xl mx-auto mt-12">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h3 className="text-base font-semibold text-slate-900">Access Restricted or Order Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">
          {error instanceof Error ? error.message : 'You might not have permission to view this order.'}
        </p>
        <Link
          to="/production"
          className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Production Orders
        </Link>
      </div>
    );
  }

  const isAssignedToCurrent = order.assignments?.some(
    (a) => a.user === user?.id && a.is_active
  );
  const canReportProgress = (isOperator && isAssignedToCurrent) || isManager || isAdmin;

  const tabs = [
    { id: 'requirements', label: 'Material Requirements', count: order.components?.length },
    { id: 'assignments', label: 'Assigned Team', count: order.assignments?.length },
    { id: 'consumption', label: 'Consumption & Scrap', count: order.consumption_reports?.length },
    { id: 'output', label: 'Finished Output', count: order.output_reports?.length },
    ...(canAccessCosts ? [{ id: 'costing', label: 'Material Cost & Variance' }] : []),
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/production" className="hover:text-slate-800 flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Production Orders
        </Link>
        <span>/</span>
        <span className="font-mono font-semibold text-slate-800">{order.order_number}</span>
      </div>

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1 whitespace-pre-line">{actionError}</div>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Main Order Workspace Header Card */}
      <Card>
        <CardBody className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                  {order.order_number}
                </h2>
                <Badge status={order.status} />
                <Badge priority={order.priority} />
              </div>
              <p className="text-base font-semibold text-slate-800 mt-1">
                {order.product_name}{' '}
                <span className="text-xs font-mono font-normal text-slate-400">
                  ({order.product_code})
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                <span>
                  Planned: <strong className="text-slate-900">{order.planned_quantity} {order.uom_code}</strong>
                </span>
                <span>•</span>
                <span>
                  BOM Snapshot: <strong className="font-mono text-slate-900">{order.bom_snapshot_version || 'Not released'}</strong>
                </span>
                <span>•</span>
                <span>
                  Facility:{' '}
                  <strong className="text-slate-900">{order.warehouse_name || 'Central Shop Floor'}</strong>
                </span>
                {order.due_date && (
                  <>
                    <span>•</span>
                    <span>
                      Due Date: <strong className="text-slate-900">{new Date(order.due_date).toLocaleDateString()}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Lifecycle Operational Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {['DRAFT', 'PLANNED'].includes(order.status) && (isManager || isAdmin) && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setActionError(null);
                    releaseMutation.mutate();
                  }}
                  isLoading={releaseMutation.isPending}
                  leftIcon={<Lock className="w-4 h-4" />}
                >
                  Release Order & Snapshot BOM
                </Button>
              )}

              {['RELEASED', 'IN_PROGRESS', 'ON_HOLD'].includes(order.status) && (
                <>
                  {canReportProgress && (
                    <>
                      <Button
                        variant="primary"
                        onClick={() => {
                          setActionError(null);
                          setOutputForm({ good_quantity: '1', rejected_quantity: '0', notes: '' });
                          setIsOutputOpen(true);
                        }}
                        leftIcon={<CheckCircle2 className="w-4 h-4" />}
                      >
                        Record Output
                      </Button>
                    </>
                  )}

                  {['COMPLETED', 'IN_PROGRESS'].includes(order.status) && (isManager || isAdmin) && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setActionError(null);
                        setCloseNotes('');
                        setIsCloseOpen(true);
                      }}
                      leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    >
                      Close & Reconcile Order
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Quick Metrics Progress Bar Strip */}
          <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[11px] font-medium text-slate-500 block">Completion Rate</span>
              <span className="text-xl font-bold font-mono text-brand-600">
                {order.completion_percentage}%
              </span>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-brand-600 h-full rounded-full"
                  style={{ width: `${Math.min(100, Number(order.completion_percentage))}%` }}
                />
              </div>
            </div>

            <div>
              <span className="text-[11px] font-medium text-slate-500 block">Completed Good Output</span>
              <span className="text-xl font-bold font-mono text-emerald-700">
                {order.completed_good_quantity} / {order.planned_quantity} {order.uom_code}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">Finished good units</span>
            </div>

            <div>
              <span className="text-[11px] font-medium text-slate-500 block">Rejected Defective Output</span>
              <span className="text-xl font-bold font-mono text-rose-700">
                {order.completed_rejected_quantity} {order.uom_code}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">Scrapped or rework</span>
            </div>

            {canAccessCosts ? (
              <div>
                <span className="text-[11px] font-medium text-slate-500 block">Actual Material Cost / Good Unit</span>
                <span className="text-xl font-bold font-mono text-slate-900">
                  {order.actual_cost_per_good_unit ? `₹${Number(order.actual_cost_per_good_unit).toFixed(2)}` : 'N/A'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Total: ₹{Number(order.total_actual_material_cost || 0).toFixed(2)}
                </span>
              </div>
            ) : (
              <div>
                <span className="text-[11px] font-medium text-slate-500 block">Primary Assignee</span>
                <span className="text-sm font-semibold text-slate-800">
                  {order.primary_assignee_name || 'Unassigned'}
                </span>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Tabs Section */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab 1: Material Requirements (BOM Snapshot) */}
      {activeTab === 'requirements' && (
        <Card>
          <CardHeader
            title="BOM Component Requirements & Shop Floor Stock Status"
            subtitle="Immutable planned component snapshot, issued stock, consumed materials, and returns"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3">Material / SKU</th>
                  <th className="px-6 py-3 text-right">Planned (Gross)</th>
                  <th className="px-6 py-3 text-right">Issued from Store</th>
                  <th className="px-6 py-3 text-right">Consumed</th>
                  <th className="px-6 py-3 text-right">Returned</th>
                  <th className="px-6 py-3 text-right">Scrap Waste</th>
                  <th className="px-6 py-3 text-right">Variance</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.components && order.components.length > 0 ? (
                  order.components.map((c) => {
                    const varianceQty = Number(c.variance_quantity);
                    const isExcess = varianceQty > 0;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3.5">
                          <span className="font-semibold text-slate-900 block">{c.item_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{c.item_code}</span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-medium text-slate-900">
                          {c.planned_quantity} {c.uom_code}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-semibold text-indigo-700">
                          {c.issued_quantity} {c.uom_code}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                          {c.consumed_quantity} {c.uom_code}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-emerald-700">
                          {c.returned_quantity} {c.uom_code}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-amber-700">
                          {c.scrap_quantity} {c.uom_code}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono">
                          {Number(c.consumed_quantity) > 0 ? (
                            <span
                              className={`font-bold ${
                                isExcess ? 'text-rose-600' : 'text-emerald-700'
                              }`}
                            >
                              {isExcess ? '+' : ''}
                              {c.variance_quantity} ({c.variance_percentage}%)
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Storekeeper / Manager: Issue or Return Material */}
                            {(isStorekeeper || isManager || isAdmin) &&
                              ['RELEASED', 'IN_PROGRESS'].includes(order.status) && (
                                <>
                                  <button
                                    onClick={() => {
                                      setActionError(null);
                                      setIssueComponent(c);
                                      const unissued = Math.max(
                                        0,
                                        Number(c.planned_quantity) - Number(c.issued_quantity)
                                      );
                                      setIssueForm({
                                        quantity: (unissued > 0 ? unissued : 10).toString(),
                                        notes: '',
                                      });
                                    }}
                                    className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-[11px]"
                                    title="Issue material from warehouse to shop floor"
                                  >
                                    Issue
                                  </button>

                                  <button
                                    onClick={() => {
                                      setActionError(null);
                                      setReturnComponent(c);
                                      const returnable = Math.max(
                                        0,
                                        Number(c.issued_quantity) -
                                          (Number(c.consumed_quantity) + Number(c.returned_quantity))
                                      );
                                      setReturnForm({
                                        quantity: returnable.toString(),
                                        notes: '',
                                      });
                                    }}
                                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px]"
                                    title="Return unused material to warehouse"
                                  >
                                    Return
                                  </button>
                                </>
                              )}

                            {/* Operator / Manager: Record actual consumption */}
                            {canReportProgress && ['RELEASED', 'IN_PROGRESS'].includes(order.status) && (
                              <button
                                onClick={() => {
                                  setActionError(null);
                                  setConsumeComponent(c);
                                  setConsumeForm({
                                    quantity_consumed: '10',
                                    scrap_quantity: '0',
                                    notes: '',
                                  });
                                }}
                                className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium text-[11px]"
                                title="Report shop floor consumption"
                              >
                                Record Usage
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                      No BOM component requirements snapshot taken yet. Release the order to lock BOM.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Assigned Team */}
      {activeTab === 'assignments' && (
        <Card>
          <CardHeader
            title="Assigned Manufacturing Crew"
            subtitle="Operators authorized to view and report progress on this order"
            action={
              (isManager || isAdmin) && (
                <Button
                  size="sm"
                  onClick={() => {
                    setActionError(null);
                    if (teamUsers.length > 0) {
                      setAssignForm({ user_id: teamUsers[0].id, is_primary: false, notes: '' });
                    }
                    setIsAssignOpen(true);
                  }}
                  leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                >
                  Assign Operator
                </Button>
              )
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3">Team Member</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Assignment Type</th>
                  <th className="px-6 py-3">Assigned Timestamp</th>
                  <th className="px-6 py-3">Assigned By</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.assignments && order.assignments.length > 0 ? (
                  order.assignments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                            {a.user_details?.full_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block">
                              {a.user_details?.full_name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {a.user_details?.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <Badge role={a.user_details?.role} />
                      </td>
                      <td className="px-6 py-3.5">
                        {a.is_primary ? (
                          <span className="inline-flex items-center gap-1 text-brand-700 font-bold text-xs">
                            ★ Primary Lead
                          </span>
                        ) : (
                          <span className="text-slate-600">Assigned Operator</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 font-mono text-[11px]">
                        {new Date(a.assigned_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">
                        {a.assigned_by_name || 'System'}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {(isManager || isAdmin) && (
                          <button
                            onClick={() => removeUserMutation.mutate(a.user)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                            title="Remove assignment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      No team members currently assigned.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Consumption & Scrap Reports Log */}
      {activeTab === 'consumption' && (
        <Card>
          <CardHeader
            title="Reported Material Consumption & Waste Log"
            subtitle="Shop floor records of actual raw materials consumed and process scrap"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Component / Material</th>
                  <th className="px-6 py-3 text-right">Quantity Consumed</th>
                  <th className="px-6 py-3 text-right">Scrap Waste</th>
                  <th className="px-6 py-3">Reported By</th>
                  <th className="px-6 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.consumption_reports && order.consumption_reports.length > 0 ? (
                  order.consumption_reports.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3.5 font-mono text-[11px] text-slate-600">
                        {new Date(rep.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-semibold text-slate-800 block">
                          {rep.component_item_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {rep.component_item_code}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                        {rep.quantity_consumed} {rep.uom_code}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-amber-700">
                        {rep.scrap_quantity} {rep.uom_code}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">{rep.operator_name || 'Operator'}</td>
                      <td className="px-6 py-3.5 text-slate-500">{rep.notes || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      No consumption logs reported yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 4: Finished Output & Quality Log */}
      {activeTab === 'output' && (
        <Card>
          <CardHeader
            title="Manufactured Output & Inspection Records"
            subtitle="Completed finished goods added to inventory and rejected defect counts"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3">Inspection Timestamp</th>
                  <th className="px-6 py-3 text-right">Good Finished Output</th>
                  <th className="px-6 py-3 text-right">Rejected Defects</th>
                  <th className="px-6 py-3">Reported By</th>
                  <th className="px-6 py-3">Quality Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.output_reports && order.output_reports.length > 0 ? (
                  order.output_reports.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3.5 font-mono text-[11px] text-slate-600">
                        {new Date(rep.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-bold text-emerald-700">
                        +{rep.good_quantity} {order.uom_code}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-bold text-rose-700">
                        {rep.rejected_quantity} {order.uom_code}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">{rep.operator_name || 'Operator'}</td>
                      <td className="px-6 py-3.5 text-slate-500">{rep.notes || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                      No output batches recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 5: Cost & Variance Analysis (Admin / Manager only) */}
      {activeTab === 'costing' && canAccessCosts && (
        <Card>
          <CardHeader
            title="Manufacturing Material Costing & Variance Analysis"
            subtitle="Weighted Average Cost (WAC) calculations and planned vs actual financial performance"
          />
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500 block">Total Actual Material Cost:</span>
                <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                  ₹{Number(order.total_actual_material_cost || 0).toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">
                  Sum of (Actual Consumed × WAC Rate)
                </span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-xs text-emerald-800 block">Actual Cost Per Good Unit:</span>
                <span className="text-2xl font-bold font-mono text-emerald-900 mt-1 block">
                  {order.actual_cost_per_good_unit
                    ? `₹${Number(order.actual_cost_per_good_unit).toFixed(2)}`
                    : 'N/A'}
                </span>
                <span className="text-[11px] text-emerald-700 block mt-1">
                  Total Cost ÷ {order.completed_good_quantity} Good Units
                </span>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-xs text-blue-800 block">Completed Good Output:</span>
                <span className="text-2xl font-bold font-mono text-blue-900 mt-1 block">
                  {order.completed_good_quantity} / {order.planned_quantity} {order.uom_code}
                </span>
                <span className="text-[11px] text-blue-700 block mt-1">
                  Completion: {order.completion_percentage}%
                </span>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="px-4 py-3">Component Item</th>
                    <th className="px-4 py-3 text-right">Unit Rate Snapshot</th>
                    <th className="px-4 py-3 text-right">Planned Cost</th>
                    <th className="px-4 py-3 text-right">Actual Cost</th>
                    <th className="px-4 py-3 text-right">Cost Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.components?.map((c) => {
                    const costVar = Number(c.actual_cost) - Number(c.planned_cost);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-800 block">{c.item_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{c.item_code}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          ₹{Number(c.unit_cost_snapshot).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-slate-700">
                          ₹{Number(c.planned_cost).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          ₹{Number(c.actual_cost).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          <span className={costVar > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                            {costVar > 0 ? '+' : ''}₹{costVar.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Modal: Assign Operator */}
      <Modal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        title="Assign Operator to Production Order"
        description="Add a team member to this job so they can access it on their dashboard"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            assignMutation.mutate(assignForm);
          }}
          className="space-y-4"
        >
          <Select
            label="Select Team Member"
            value={assignForm.user_id}
            onChange={(e) => setAssignForm({ ...assignForm, user_id: e.target.value })}
          >
            {teamUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role}) - {u.email}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_primary"
              checked={assignForm.is_primary}
              onChange={(e) => setAssignForm({ ...assignForm, is_primary: e.target.checked })}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="is_primary" className="text-xs font-semibold text-slate-700">
              Set as Primary Lead Assignee
            </label>
          </div>

          <Input
            label="Assignment Notes"
            value={assignForm.notes}
            onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
            placeholder="Workstation / Line instructions..."
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsAssignOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={assignMutation.isPending}>
              Assign to Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Issue Material */}
      {issueComponent && (
        <Modal
          isOpen={true}
          onClose={() => setIssueComponent(null)}
          title={`Issue Material to Order: ${issueComponent.item_name}`}
          description={`Transfer raw material from warehouse inventory to production order ${order.order_number}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              issueMutation.mutate({
                component_id: issueComponent.id,
                quantity: issueForm.quantity,
                notes: issueForm.notes,
              });
            }}
            className="space-y-4"
          >
            <Input
              label={`Issue Quantity (${issueComponent.uom_code})`}
              type="number"
              step="any"
              required
              value={issueForm.quantity}
              onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })}
            />
            <Input
              label="Notes"
              value={issueForm.notes}
              onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })}
              placeholder="Material lot number, storage bin..."
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setIssueComponent(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={issueMutation.isPending}>
                Confirm Material Issue
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Return Material */}
      {returnComponent && (
        <Modal
          isOpen={true}
          onClose={() => setReturnComponent(null)}
          title={`Return Unused Material: ${returnComponent.item_name}`}
          description={`Return excess issued material back to warehouse storage from ${order.order_number}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              returnMutation.mutate({
                component_id: returnComponent.id,
                quantity: returnForm.quantity,
                notes: returnForm.notes,
              });
            }}
            className="space-y-4"
          >
            <Input
              label={`Return Quantity (${returnComponent.uom_code})`}
              type="number"
              step="any"
              required
              value={returnForm.quantity}
              onChange={(e) => setReturnForm({ ...returnForm, quantity: e.target.value })}
            />
            <Input
              label="Notes"
              value={returnForm.notes}
              onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
              placeholder="Reason for return..."
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setReturnComponent(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={returnMutation.isPending}>
                Confirm Material Return
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Record Consumption & Scrap */}
      {consumeComponent && (
        <Modal
          isOpen={true}
          onClose={() => setConsumeComponent(null)}
          title={`Report Consumption: ${consumeComponent.item_name}`}
          description={`Operator shop floor consumption report for order ${order.order_number}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              consumeMutation.mutate({
                component_id: consumeComponent.id,
                quantity_consumed: consumeForm.quantity_consumed,
                scrap_quantity: consumeForm.scrap_quantity,
                notes: consumeForm.notes,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={`Quantity Consumed (${consumeComponent.uom_code})`}
                type="number"
                step="any"
                required
                value={consumeForm.quantity_consumed}
                onChange={(e) => setConsumeForm({ ...consumeForm, quantity_consumed: e.target.value })}
              />

              <Input
                label={`Scrap / Process Waste (${consumeComponent.uom_code})`}
                type="number"
                step="any"
                value={consumeForm.scrap_quantity}
                onChange={(e) => setConsumeForm({ ...consumeForm, scrap_quantity: e.target.value })}
                helperText="Loss due to offcuts, chips, or process waste"
              />
            </div>

            <Input
              label="Operational Notes"
              value={consumeForm.notes}
              onChange={(e) => setConsumeForm({ ...consumeForm, notes: e.target.value })}
              placeholder="Machine code, shift details..."
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setConsumeComponent(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={consumeMutation.isPending}>
                Post Consumption
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Record Output */}
      <Modal
        isOpen={isOutputOpen}
        onClose={() => setIsOutputOpen(false)}
        title="Record Production Output & Quality Inspection"
        description={`Record completed manufactured units for ${order.product_name}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            outputMutation.mutate(outputForm);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={`Good Completed Units (${order.uom_code})`}
              type="number"
              step="any"
              required
              value={outputForm.good_quantity}
              onChange={(e) => setOutputForm({ ...outputForm, good_quantity: e.target.value })}
            />

            <Input
              label={`Rejected Defective Units (${order.uom_code})`}
              type="number"
              step="any"
              value={outputForm.rejected_quantity}
              onChange={(e) => setOutputForm({ ...outputForm, rejected_quantity: e.target.value })}
            />
          </div>

          <Input
            label="Quality & Inspection Remarks"
            value={outputForm.notes}
            onChange={(e) => setOutputForm({ ...outputForm, notes: e.target.value })}
            placeholder="Passed dimensional check, tolerance verification..."
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsOutputOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success" isLoading={outputMutation.isPending}>
              Report Output
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Close Order */}
      <Modal
        isOpen={isCloseOpen}
        onClose={() => setIsCloseOpen(false)}
        title="Close & Reconcile Production Order"
        description={`Perform final reconciliation checks on ${order.order_number} and lock costs.`}
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
            <p className="font-semibold text-slate-900">Reconciliation Policy Requirements:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>All materials issued to the shop floor must be fully accounted for.</li>
              <li>Issued Quantity must equal Consumed Quantity + Returned Quantity.</li>
              <li>Closing the order locks final variance and unit costing permanently.</li>
            </ul>
          </div>

          <Input
            label="Order Closure Notes"
            value={closeNotes}
            onChange={(e) => setCloseNotes(e.target.value)}
            placeholder="Batch closure approval..."
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsCloseOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              isLoading={closeMutation.isPending}
              onClick={() => closeMutation.mutate(closeNotes)}
            >
              Verify & Close Batch
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

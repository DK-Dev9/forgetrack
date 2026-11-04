import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Factory,
  Clock,
  AlertTriangle,
  Boxes,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  ClipboardList,
} from 'lucide-react';
import { reportingApi } from '../../api/reportingApi';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export const DashboardPage: React.FC = () => {
  const { user, isOperator, isStorekeeper } = useAuth();

  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: reportingApi.getDashboard,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <h3 className="text-base font-semibold text-slate-800">Unable to load dashboard</h3>
        <p className="text-xs text-slate-500 mt-1">
          {error instanceof Error ? error.message : 'Please check your connection and try again.'}
        </p>
      </div>
    );
  }

  const { metrics, alerts, recent_orders, status_breakdown } = dashboard;

  const chartData = status_breakdown
    ? Object.entries(status_breakdown).map(([status, count]) => ({
        status: status.replace('_', ' '),
        count,
      }))
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Welcome back, {user?.full_name}
            </h2>
            <Badge role={user?.role} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {dashboard.organization_name} • Operational overview and activity feed
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/production"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
          >
            <Factory className="w-3.5 h-3.5" />
            View Production Orders
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isOperator ? (
          <>
            <Card className="border-l-4 border-l-brand-500">
              <CardBody className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">My Assigned Orders</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {metrics.my_assigned_orders ?? 0}
                  </p>
                </div>
                <ClipboardList className="w-8 h-8 text-brand-500/30" />
              </CardBody>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardBody className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Orders In Progress</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">
                    {metrics.my_active_orders ?? 0}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-amber-500/30" />
              </CardBody>
            </Card>

            <Card className="border-l-4 border-l-emerald-500">
              <CardBody className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Completed Orders</p>
                  <p className="text-2xl font-bold text-emerald-700 mt-1">
                    {metrics.my_completed_orders ?? 0}
                  </p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-500/30" />
              </CardBody>
            </Card>

            <Card className="border-l-4 border-l-rose-500">
              <CardBody className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Overdue Deliveries</p>
                  <p className="text-2xl font-bold text-rose-700 mt-1">
                    {metrics.my_overdue_orders ?? 0}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-rose-500/30" />
              </CardBody>
            </Card>
          </>
        ) : isStorekeeper ? (
          <>
            <Card className="border-l-4 border-l-amber-500">
              <CardBody className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Low Stock Alerts</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">
                    {metrics.low_stock_count ?? 0}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-amber-500/30" />
              </CardBody>
            </Card>

            <Card className="border-l-4 border-l-brand-500">
              <CardBody className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Pending Material Issues</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {metrics.pending_material_issues ?? 0}
                  </p>
                </div>
                <Boxes className="w-8 h-8 text-brand-500/30" />
              </CardBody>
            </Card>

            <Card className="border-l-4 border-l-indigo-500">
              <CardBody className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Active Shop Floor Orders</p>
                  <p className="text-2xl font-bold text-indigo-700 mt-1">
                    {metrics.active_production_orders ?? 0}
                  </p>
                </div>
                <Factory className="w-8 h-8 text-indigo-500/30" />
              </CardBody>
            </Card>

            <Card className="border-l-4 border-l-teal-500">
              <CardBody className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Inventory Ledger Audit</p>
                  <Link to="/inventory/reconciliation" className="text-xs text-teal-600 font-semibold mt-1 block hover:underline">
                    Run Reconciliation →
                  </Link>
                </div>
                <CheckCircle2 className="w-8 h-8 text-teal-500/30" />
              </CardBody>
            </Card>
          </>
        ) : (
          <>
            <Card className="border-l-4 border-l-brand-500">
              <CardBody className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Total Production Orders</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {metrics.total_orders ?? 0}
                  </p>
                </div>
                <Factory className="w-8 h-8 text-brand-500/30" />
              </CardBody>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardBody className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Orders In Progress</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">
                    {metrics.in_progress_orders ?? 0}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-amber-500/30" />
              </CardBody>
            </Card>

            <Card className="border-l-4 border-l-rose-500">
              <CardBody className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Overdue Orders</p>
                  <p className="text-2xl font-bold text-rose-700 mt-1">
                    {metrics.overdue_orders ?? 0}
                  </p>
                </div>
                <ShieldAlert className="w-8 h-8 text-rose-500/30" />
              </CardBody>
            </Card>

            <Card className="border-l-4 border-l-emerald-500">
              <CardBody className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Low Stock Materials</p>
                  <p className="text-2xl font-bold text-emerald-700 mt-1">
                    {metrics.low_stock_count ?? 0}
                  </p>
                </div>
                <Boxes className="w-8 h-8 text-emerald-500/30" />
              </CardBody>
            </Card>
          </>
        )}
      </div>

      {/* Middle Section: Alerts and Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Breakdown Chart */}
        {chartData.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader
              title="Production Pipeline by Status"
              subtitle="Current operational queue and completed batches"
            />
            <CardBody className="p-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <XAxis dataKey="status" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        border: 'none',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Priority Alerts */}
        <Card className={chartData.length > 0 ? '' : 'lg:col-span-3'}>
          <CardHeader
            title="Material Alerts"
            subtitle="Items needing replenishment"
            action={
              <Link to="/inventory/items" className="text-xs font-semibold text-brand-600 hover:underline">
                View all
              </Link>
            }
          />
          <CardBody className="p-4">
            {alerts && alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-lg bg-amber-500/5 border border-amber-200/60 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{alert.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{alert.code}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-amber-700">
                        {alert.available} {alert.uom}
                      </span>
                      <p className="text-[10px] text-slate-400">Reorder: {alert.reorder_level}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                No material shortages or low-stock alerts.
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recent Production Orders Table */}
      <Card>
        <CardHeader
          title="Recent Production Work"
          subtitle="Orders actively processed or completed"
          action={
            <Link
              to="/production"
              className="text-xs font-semibold text-brand-600 hover:underline inline-flex items-center gap-1"
            >
              All orders <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-6 py-3">Order Number</th>
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Priority</th>
                <th className="px-6 py-3">Progress</th>
                <th className="px-6 py-3">Primary Assignee</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent_orders && recent_orders.length > 0 ? (
                recent_orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-slate-900 font-mono">
                      {order.order_number}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-medium text-slate-800 block">{order.product_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{order.product_code}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge status={order.status} />
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge priority={order.priority} />
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="w-32">
                        <div className="flex justify-between text-[11px] mb-1 font-medium">
                          <span>{order.completed_good_quantity} / {order.planned_quantity}</span>
                          <span>{order.completion_percentage}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-brand-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Number(order.completion_percentage))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">
                      {order.primary_assignee || <span className="text-slate-400 italic">Unassigned</span>}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        to={`/production/${order.id}`}
                        className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-700"
                      >
                        Open Workspace →
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No active production orders found.
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

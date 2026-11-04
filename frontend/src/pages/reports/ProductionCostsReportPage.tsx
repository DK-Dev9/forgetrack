import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingDown, Factory, CheckCircle2, ShieldAlert } from 'lucide-react';
import { reportingApi } from '../../api/reportingApi';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Link } from 'react-router-dom';

export const ProductionCostsReportPage: React.FC = () => {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['production-costs'],
    queryFn: reportingApi.getProductionCosts,
  });

  const totalCost = orders.reduce(
    (acc, o) => acc + Number(o.total_actual_material_cost || 0),
    0
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Production Costing & Unit Economics
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Actual material consumption costs, yield rates, and unit cost per completed good item
        </p>
      </div>

      {/* KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-brand-500">
          <CardBody className="p-4">
            <p className="text-xs font-medium text-slate-500">Total Material Cost Incurred</p>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
              ₹{totalCost.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Across all production orders</p>
          </CardBody>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardBody className="p-4">
            <p className="text-xs font-medium text-slate-500">Active Cost Trackers</p>
            <p className="text-2xl font-bold font-mono text-emerald-700 mt-1">{orders.length}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Orders with calculated cost snapshots</p>
          </CardBody>
        </Card>

        <Card className="border-l-4 border-l-indigo-500">
          <CardBody className="p-4">
            <p className="text-xs font-medium text-slate-500">Costing Methodology</p>
            <p className="text-sm font-bold text-slate-800 mt-1">Weighted Average Cost (WAC)</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Updated dynamically on stock receipt</p>
          </CardBody>
        </Card>
      </div>

      {/* Orders Cost Table */}
      <Card>
        <CardHeader
          title="Batch Cost Performance Summary"
          subtitle="Realized material expense and per-unit manufacturing cost"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-6 py-3">Order Number</th>
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Planned Batch</th>
                <th className="px-6 py-3 text-right">Completed Good Units</th>
                <th className="px-6 py-3 text-right">Total Actual Material Cost</th>
                <th className="px-6 py-3 text-right">Actual Cost / Good Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    Loading costing analytics...
                  </td>
                </tr>
              ) : orders.length > 0 ? (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3.5 font-mono font-bold text-slate-900">
                      <Link to={`/production/${o.id}`} className="text-brand-600 hover:underline">
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-semibold text-slate-900 block">{o.product_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{o.product_code}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge status={o.status} />
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-slate-700">
                      {o.planned_quantity} {o.uom}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-emerald-700">
                      {o.completed_good_quantity} {o.uom}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                      ₹{Number(o.total_actual_material_cost).toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-emerald-700 text-sm">
                      {o.actual_cost_per_good_unit
                        ? `₹${Number(o.actual_cost_per_good_unit).toFixed(2)}`
                        : <span className="text-slate-400 font-normal text-xs">Pending output</span>}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No production costing records found.
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

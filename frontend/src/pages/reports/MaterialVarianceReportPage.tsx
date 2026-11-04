import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Filter, Search, TrendingDown, AlertCircle } from 'lucide-react';
import { reportingApi } from '../../api/reportingApi';
import { productsApi } from '../../api/productsApi';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

export const MaterialVarianceReportPage: React.FC = () => {
  const { canAccessCosts } = useAuth();
  const [productFilter, setProductFilter] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['material-variance', { productFilter }],
    queryFn: () =>
      reportingApi.getMaterialVariance({
        product_id: productFilter || undefined,
      }),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getProducts(),
  });

  const handleExportCSV = () => {
    window.open(reportingApi.exportVarianceCSVUrl(), '_blank');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Material Consumption & Variance Report
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Identify which production orders exceeded planned material consumption, scrap waste, and cost variances
          </p>
        </div>

        <Button onClick={handleExportCSV} leftIcon={<Download className="w-4 h-4" />}>
          Export Variance CSV
        </Button>
      </div>

      {/* Filter Card */}
      <Card>
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="w-72">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Filter by Manufactured Product
            </label>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div className="text-right text-xs text-slate-500">
            Showing <strong className="text-slate-800">{rows.length}</strong> material line items
          </div>
        </div>
      </Card>

      {/* Variance Table */}
      <Card>
        <CardHeader
          title="Component Variance Breakdown"
          subtitle="Comparison of released BOM plan vs actual shop floor consumption"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-6 py-3">Order Number</th>
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">Component / Material</th>
                <th className="px-6 py-3 text-right">Planned Qty</th>
                <th className="px-6 py-3 text-right">Actual Consumed</th>
                <th className="px-6 py-3 text-right">Scrap Waste</th>
                <th className="px-6 py-3 text-right">Variance Qty</th>
                <th className="px-6 py-3 text-right">Variance %</th>
                {canAccessCosts && <th className="px-6 py-3 text-right">Cost Variance</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={canAccessCosts ? 9 : 8} className="px-6 py-8 text-center text-slate-400">
                    Loading variance reports...
                  </td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((row, idx) => {
                  const varQty = Number(row.variance_quantity);
                  const isUnfavorable = varQty > 0;

                  return (
                    <tr key={`${row.order_id}-${row.item_id}-${idx}`} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3.5 font-mono font-bold text-slate-900">
                        {row.order_number}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-medium text-slate-800 block">{row.product_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{row.product_code}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-semibold text-slate-900 block">{row.item_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{row.item_code}</span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-slate-700">
                        {row.planned_quantity} {row.uom}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                        {row.consumed_quantity} {row.uom}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-amber-700">
                        {row.scrap_quantity} {row.uom}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-bold">
                        {Number(row.consumed_quantity) > 0 ? (
                          <span className={isUnfavorable ? 'text-rose-600' : 'text-emerald-700'}>
                            {isUnfavorable ? '+' : ''}
                            {row.variance_quantity} {row.uom}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-bold">
                        {Number(row.consumed_quantity) > 0 ? (
                          <span className={isUnfavorable ? 'text-rose-600' : 'text-emerald-700'}>
                            {isUnfavorable ? '+' : ''}
                            {row.variance_percentage}%
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      {canAccessCosts && (
                        <td className="px-6 py-3.5 text-right font-mono font-bold">
                          {row.cost_variance ? (
                            <span className={Number(row.cost_variance) > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                              {Number(row.cost_variance) > 0 ? '+' : ''}₹{Number(row.cost_variance).toFixed(2)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={canAccessCosts ? 9 : 8} className="px-6 py-8 text-center text-slate-400">
                    No consumption variance recorded.
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

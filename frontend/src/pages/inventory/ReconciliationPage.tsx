import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, RefreshCcw, ShieldCheck } from 'lucide-react';
import { inventoryApi } from '../../api/inventoryApi';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export const ReconciliationPage: React.FC = () => {
  const { data: reconciliation = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['reconciliation'],
    queryFn: inventoryApi.getReconciliation,
  });

  const totalChecked = reconciliation.length;
  const totalReconciled = reconciliation.filter((r) => r.reconciled).length;
  const discrepanciesCount = totalChecked - totalReconciled;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Stock Balance vs Ledger Reconciliation
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit comparing cached fast-lookup stock balances against the mathematical sum of append-only ledger transactions
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          isLoading={isFetching}
          leftIcon={<RefreshCcw className="w-4 h-4" />}
        >
          Run Full Reconciliation
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-brand-500">
          <CardBody className="p-4">
            <p className="text-xs font-medium text-slate-500">Total Stock Accounts Inspected</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalChecked}</p>
          </CardBody>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardBody className="p-4">
            <p className="text-xs font-medium text-slate-500">100% Balanced Accounts</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{totalReconciled}</p>
          </CardBody>
        </Card>

        <Card className={`border-l-4 ${discrepanciesCount > 0 ? 'border-l-rose-500' : 'border-l-slate-300'}`}>
          <CardBody className="p-4">
            <p className="text-xs font-medium text-slate-500">Unbalanced Discrepancies</p>
            <p className={`text-2xl font-bold mt-1 ${discrepanciesCount > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
              {discrepanciesCount}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Reconciliation Table */}
      <Card>
        <CardHeader
          title="Account Balance Verification"
          subtitle="Real-time verification between inventory ledger movements and cached balances"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-6 py-3">Location</th>
                <th className="px-6 py-3">Item / SKU</th>
                <th className="px-6 py-3 text-right">Cached On-Hand</th>
                <th className="px-6 py-3 text-right">Sum of Ledger Movements</th>
                <th className="px-6 py-3 text-right">Discrepancy</th>
                <th className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    Calculating ledger sums...
                  </td>
                </tr>
              ) : reconciliation.length > 0 ? (
                reconciliation.map((row) => (
                  <tr key={`${row.item_id}-${row.warehouse_id}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-mono font-semibold text-slate-800">
                      {row.warehouse_code}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-semibold text-slate-900 block">{row.item_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{row.item_code}</span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-medium text-slate-900">
                      {row.cached_on_hand}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-medium text-slate-900">
                      {row.ledger_calculated_on_hand}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold">
                      <span className={row.discrepancy === '0.0000' ? 'text-slate-400' : 'text-rose-600'}>
                        {row.discrepancy}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {row.reconciled ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Reconciled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3.5 h-3.5" /> Discrepancy
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No balances currently registered to reconcile.
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

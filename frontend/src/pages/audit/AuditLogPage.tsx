import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Search, Filter, History, User } from 'lucide-react';
import { reportingApi } from '../../api/reportingApi';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export const AuditLogPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', { actionFilter }],
    queryFn: () => reportingApi.getAuditLogs({ action: actionFilter || undefined }),
  });

  const getActionBadge = (action: string) => {
    if (action.includes('CREATED') || action.includes('RECEIPT')) {
      return <Badge variant="success">{action}</Badge>;
    }
    if (action.includes('RELEASED') || action.includes('ASSIGNED')) {
      return <Badge variant="info">{action}</Badge>;
    }
    if (action.includes('CLOSED') || action.includes('DEACTIVATED')) {
      return <Badge variant="warning">{action}</Badge>;
    }
    if (action.includes('OUTPUT') || action.includes('CONSUMPTION')) {
      return <Badge variant="neutral">{action}</Badge>;
    }
    return <Badge variant="neutral">{action}</Badge>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Operational Audit Trail & Activity Log
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Immutable server-side event logs recording user actions, role assignments, inventory movements, and batch closures
        </p>
      </div>

      {/* Filter Card */}
      <Card>
        <div className="p-4 flex flex-col md:flex-row items-center gap-4">
          <div className="w-full md:w-72">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="">All Action Types</option>
              <option value="USER_LOGIN">User Logins</option>
              <option value="USER_CREATED">User Creations</option>
              <option value="USER_UPDATED">User Updates</option>
              <option value="USER_ACTIVATED">User Activations</option>
              <option value="USER_DEACTIVATED">User Deactivations</option>
              <option value="ORDER_RELEASED">Order Releases</option>
              <option value="ORDER_ASSIGNED">Order Assignments</option>
              <option value="ORDER_CLOSED">Order Closures</option>
              <option value="STOCK_RECEIPT">Stock Receipts</option>
              <option value="MATERIAL_ISSUED">Material Issues</option>
              <option value="MATERIAL_RETURNED">Material Returns</option>
              <option value="CONSUMPTION_RECORDED">Consumptions</option>
              <option value="OUTPUT_RECORDED">Outputs</option>
              <option value="BOM_RELEASED">BOM Releases</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader
          title="Audit Log Records"
          subtitle={`Showing ${logs.length} tracked operational transactions`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-6 py-3">Timestamp (UTC)</th>
                <th className="px-6 py-3">Actor / Performer</th>
                <th className="px-6 py-3">Event Action</th>
                <th className="px-6 py-3">Entity Type & ID</th>
                <th className="px-6 py-3">Audit Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                          {log.actor_name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800 block">
                            {log.actor_name || 'System / Auto'}
                          </span>
                          {log.actor_email && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {log.actor_email}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">{getActionBadge(log.action)}</td>
                    <td className="px-6 py-3.5 font-mono text-slate-700">
                      <span className="block font-semibold">{log.entity_type}</span>
                      <span className="text-[10px] text-slate-400 truncate max-w-[120px] block">
                        {log.entity_id}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-700 max-w-md">
                      <p className="line-clamp-2">{log.description}</p>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No audit records logged yet.
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

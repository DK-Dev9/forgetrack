import { apiClient } from './client';
import { DashboardSummary, MaterialVarianceRow, AuditLogItem } from '../types';

export const reportingApi = {
  getDashboard: async (): Promise<DashboardSummary> => {
    const res = await apiClient.get<DashboardSummary>('/reports/dashboard/');
    return res.data;
  },

  getMaterialVariance: async (params?: {
    order_id?: string;
    product_id?: string;
    item_id?: string;
  }): Promise<MaterialVarianceRow[]> => {
    const res = await apiClient.get<MaterialVarianceRow[]>('/reports/material-variance/', { params });
    return res.data;
  },

  getProductionCosts: async (): Promise<any[]> => {
    const res = await apiClient.get('/reports/production-costs/');
    return res.data;
  },

  exportVarianceCSVUrl: () => {
    const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    return `${base}/reports/material-variance/export/`;
  },

  getAuditLogs: async (params?: { action?: string; entity_type?: string }): Promise<AuditLogItem[]> => {
    const res = await apiClient.get('/audit/', { params });
    return res.data.results || res.data;
  },
};

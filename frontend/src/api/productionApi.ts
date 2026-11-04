import { apiClient } from './client';
import { ProductionOrder, ProductionOrderAssignment } from '../types';

export const productionApi = {
  getOrders: async (params?: {
    search?: string;
    status?: string;
    priority?: string;
    assigned_to_me?: string;
    overdue?: string;
  }): Promise<ProductionOrder[]> => {
    const res = await apiClient.get('/production/', { params });
    return res.data.results || res.data;
  },

  getOrderDetail: async (id: string): Promise<ProductionOrder> => {
    const res = await apiClient.get<ProductionOrder>(`/production/${id}/`);
    return res.data;
  },

  createOrder: async (data: any): Promise<ProductionOrder> => {
    const res = await apiClient.post<ProductionOrder>('/production/', data);
    return res.data;
  },

  releaseOrder: async (id: string): Promise<ProductionOrder> => {
    const res = await apiClient.post<ProductionOrder>(`/production/${id}/release/`);
    return res.data;
  },

  assignUser: async (id: string, data: { user_id: string; is_primary?: boolean; notes?: string }): Promise<ProductionOrderAssignment> => {
    const res = await apiClient.post<ProductionOrderAssignment>(`/production/${id}/assignments/`, data);
    return res.data;
  },

  removeUser: async (id: string, userId: string): Promise<void> => {
    await apiClient.post(`/production/${id}/assignments/${userId}/remove/`);
  },

  issueMaterial: async (id: string, data: { component_id: string; quantity: string; warehouse_id?: string; notes?: string }) => {
    const res = await apiClient.post(`/production/${id}/issues/`, data);
    return res.data;
  },

  returnMaterial: async (id: string, data: { component_id: string; quantity: string; warehouse_id?: string; notes?: string }) => {
    const res = await apiClient.post(`/production/${id}/returns/`, data);
    return res.data;
  },

  recordConsumption: async (id: string, data: { component_id: string; quantity_consumed: string; scrap_quantity?: string; warehouse_id?: string; notes?: string }) => {
    const res = await apiClient.post(`/production/${id}/consumption/`, data);
    return res.data;
  },

  recordOutput: async (id: string, data: { good_quantity: string; rejected_quantity?: string; warehouse_id?: string; notes?: string }) => {
    const res = await apiClient.post(`/production/${id}/output/`, data);
    return res.data;
  },

  closeOrder: async (id: string, notes?: string): Promise<ProductionOrder> => {
    const res = await apiClient.post<ProductionOrder>(`/production/${id}/close/`, { notes });
    return res.data;
  },
};

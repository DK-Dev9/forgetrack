import { apiClient } from './client';
import { Product, BillOfMaterials } from '../types';

export const productsApi = {
  getProducts: async (params?: { search?: string }): Promise<Product[]> => {
    const res = await apiClient.get('/products/', { params });
    return res.data.results || res.data;
  },

  createProduct: async (data: Partial<Product>): Promise<Product> => {
    const res = await apiClient.post<Product>('/products/', data);
    return res.data;
  },

  getBOMs: async (params?: { product?: string; status?: string }): Promise<BillOfMaterials[]> => {
    const res = await apiClient.get('/products/boms/', { params });
    return res.data.results || res.data;
  },

  getBOMDetail: async (id: string): Promise<BillOfMaterials> => {
    const res = await apiClient.get<BillOfMaterials>(`/products/boms/${id}/`);
    return res.data;
  },

  createBOM: async (data: any): Promise<BillOfMaterials> => {
    const res = await apiClient.post<BillOfMaterials>('/products/boms/', data);
    return res.data;
  },

  updateBOM: async (id: string, data: any): Promise<BillOfMaterials> => {
    const res = await apiClient.patch<BillOfMaterials>(`/products/boms/${id}/`, data);
    return res.data;
  },

  releaseBOM: async (id: string): Promise<BillOfMaterials> => {
    const res = await apiClient.post<BillOfMaterials>(`/products/boms/${id}/release/`);
    return res.data;
  },

  previewBOMCalculation: async (id: string, quantity: string, warehouseId?: string) => {
    const res = await apiClient.post(`/products/boms/${id}/preview/`, {
      quantity,
      warehouse_id: warehouseId,
    });
    return res.data;
  },
};

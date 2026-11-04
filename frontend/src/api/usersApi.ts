import { apiClient } from './client';
import { User, UserRole } from '../types';

export interface UserCreateParams {
  email: string;
  full_name: string;
  role: UserRole;
  employee_code?: string;
  department?: string;
  phone_number?: string;
  password?: string;
}

export interface UserUpdateParams {
  full_name?: string;
  role?: UserRole;
  employee_code?: string;
  department?: string;
  phone_number?: string;
  is_active?: boolean;
}

export const usersApi = {
  getUsers: async (params?: { search?: string; role?: string; is_active?: string }): Promise<User[]> => {
    const res = await apiClient.get('/users/', { params });
    return res.data.results || res.data;
  },

  createUser: async (data: UserCreateParams): Promise<User> => {
    const res = await apiClient.post<User>('/users/', data);
    return res.data;
  },

  updateUser: async (id: string, data: UserUpdateParams): Promise<User> => {
    const res = await apiClient.patch<User>(`/users/${id}/`, data);
    return res.data;
  },

  toggleUserActive: async (id: string): Promise<User> => {
    const res = await apiClient.post<User>(`/users/${id}/toggle-active/`);
    return res.data;
  },
};

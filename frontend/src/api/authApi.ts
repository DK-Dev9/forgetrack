import { apiClient } from './client';
import { User } from '../types';

export const authApi = {
  login: async (email: string, password: string): Promise<User> => {
    const res = await apiClient.post<User>('/auth/login/', { email, password });
    return res.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout/');
  },

  getCurrentUser: async (): Promise<User> => {
    const res = await apiClient.get<User>('/auth/me/');
    return res.data;
  },
};

import axios from 'axios';

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const csrfToken = getCookie('csrftoken');
  if (csrfToken && config.headers) {
    config.headers['X-CSRFToken'] = csrfToken;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Standardize error message extraction
    const detail =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      (typeof error.response?.data === 'string' ? error.response?.data : null) ||
      (typeof error.response?.data === 'object' ? JSON.stringify(error.response?.data) : null) ||
      error.message ||
      'An unexpected error occurred.';
    return Promise.reject(new Error(detail));
  }
);

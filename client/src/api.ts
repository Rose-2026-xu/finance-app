import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Request interceptor - attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
};

// Users
export const userAPI = {
  list: () => api.get('/users'),
  create: (data: any) => api.post('/users', data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
};

// Companies
export const companyAPI = {
  list: () => api.get('/companies'),
  create: (data: any) => api.post('/companies', data),
  update: (id: number, data: any) => api.put(`/companies/${id}`, data),
  delete: (id: number) => api.delete(`/companies/${id}`),
};

// Payment Types
export const paymentTypeAPI = {
  list: () => api.get('/payment-types'),
  create: (data: any) => api.post('/payment-types', data),
  update: (id: number, data: any) => api.put(`/payment-types/${id}`, data),
  delete: (id: number) => api.delete(`/payment-types/${id}`),
  reorder: (orders: { id: number; sort_order: number }[]) =>
    api.post('/payment-types/reorder', { orders }),
};

// Payments
export const paymentAPI = {
  list: (params?: any) => api.get('/payments', { params }),
  create: (data: any) => api.post('/payments', data),
  update: (id: number, data: any) => api.put(`/payments/${id}`, data),
  delete: (id: number) => api.delete(`/payments/${id}`),
  importFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/payments/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  downloadTemplate: () =>
    api.get('/payments/template', { responseType: 'blob' }),
  undoBatch: (batchId: string) => api.post(`/payments/undo-batch/${batchId}`),
};

// Dashboard
export const dashboardAPI = {
  get: (params?: any) => api.get('/dashboard', { params }),
};

// Receivables
export const receivableAPI = {
  list: (params?: any) => api.get('/receivables', { params }),
  create: (data: any) => api.post('/receivables', data),
  update: (id: number, data: any) => api.put(`/receivables/${id}`, data),
  delete: (id: number) => api.delete(`/receivables/${id}`),
};

export default api;

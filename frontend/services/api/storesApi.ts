import apiClient from './client';

export interface Store {
  id: string;
  code: string;
  name: string;
  timezone: string;
  isActive: boolean;
  emails: string[];
  createdAt: string;
  displayName: string;
}

export interface StoreCreateData {
  code: string;
  name: string;
  timezone?: string;
  isActive?: boolean;
  emails?: string;
}

export interface StoreUpdateData {
  code?: string;
  name?: string;
  timezone?: string;
  isActive?: boolean;
}

interface StoresResponse {
  success: boolean;
  data: Store[];
  count: number;
}

interface StoreResponse {
  success: boolean;
  data: Store;
  message?: string;
}

export interface StoresParams {
  active?: boolean;
}

export const storesApi = {
  getAll: (params?: StoresParams) => 
    apiClient.get<StoresResponse>('/stores', { params }),

  getById: (id: string) => 
    apiClient.get<StoreResponse>(`/stores/${id}`),

  create: (data: StoreCreateData) => 
    apiClient.post<StoreResponse>('/stores', data),

  update: (id: string, data: StoreUpdateData) => 
    apiClient.put<StoreResponse>(`/stores/${id}`, data),

  delete: (id: string) => 
    apiClient.delete<{ success: boolean; message: string }>(`/stores/${id}`),
};

export default storesApi;
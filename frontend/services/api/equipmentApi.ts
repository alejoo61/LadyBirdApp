import apiClient from './client';
import type { Store } from './storesApi';

export interface Equipment {
  id: string;
  storeId: string;
  equipmentCode: string;
  type: string;
  name: string;
  yearCode: string;
  seq: number;
  isDown: boolean;
  status: string;
  createdAt: string;
  fullName: string;
  store: Store | null;
}

export interface EquipmentCreateData {
  storeId: string;
  equipmentCode: string;
  type: string;
  name: string;
  yearCode?: string;
  seq?: number;
  isDown?: boolean;
}

export interface EquipmentUpdateData {
  storeId?: string;
  equipmentCode?: string;
  type?: string;
  name?: string;
  yearCode?: string;
  seq?: number;
  isDown?: boolean;
}

interface EquipmentResponse {
  success: boolean;
  data: Equipment[];
  count: number;
  filters?: {
    storeId?: string;
    type?: string;
    isDown?: boolean;
  };
}

interface SingleEquipmentResponse {
  success: boolean;
  data: Equipment;
  message?: string;
}

interface TypesResponse {
  success: boolean;
  data: string[];
  count: number;
}

interface EquipmentParams {
  storeId?: string;
  type?: string;
  isDown?: boolean;
}

export const equipmentApi = {
  getAll: (params?: EquipmentParams) => 
    apiClient.get<EquipmentResponse>('/equipment', { params }),

  getById: (id: string) => 
    apiClient.get<SingleEquipmentResponse>(`/equipment/${id}`),

  getByStore: (storeId: string) => 
    apiClient.get<EquipmentResponse>(`/stores/${storeId}/equipment`),

  getTypes: () => 
    apiClient.get<TypesResponse>('/equipment/types'),

  create: (data: EquipmentCreateData) => 
    apiClient.post<SingleEquipmentResponse>('/equipment', data),

  update: (id: string, data: EquipmentUpdateData) => 
    apiClient.put<SingleEquipmentResponse>(`/equipment/${id}`, data),

  delete: (id: string) => 
    apiClient.delete<{ success: boolean; message: string }>(`/equipment/${id}`),

  markAsDown: (id: string) => 
    apiClient.patch<SingleEquipmentResponse>(`/equipment/${id}/mark-down`),

  markAsOperational: (id: string) => 
    apiClient.patch<SingleEquipmentResponse>(`/equipment/${id}/mark-operational`),
};

export default equipmentApi;
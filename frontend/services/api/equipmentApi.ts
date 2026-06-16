// services/api/equipmentApi.ts
import apiClient from './client';

export interface Equipment {
  id:            string;
  storeId:       string;
  equipmentCode: string;
  type:          string;
  name:          string;
  yearCode:      string;
  seq:           number;
  isDown:        boolean;
  qrCodeText?:   string;
  status:        string;
  createdAt:     string;
  store?: { id: string; name: string; code: string; };
}

export interface EquipmentCreateData {
  storeId:        string;
  name:           string;
  type:           string;
  yearCode:       string;
  equipmentCode?: string;
}

export interface TransferHistory {
  id:            string;
  fromStore:     { id: string; name: string; code: string } | null;
  toStore:       { id: string; name: string; code: string } | null;
  reason:        string;
  isTemporary:   boolean;
  returnDate:    string | null;
  transferredBy: string | null;
  transferredAt: string;
}

export const equipmentApi = {
  getAll: (params?: { storeId?: string; type?: string; isDown?: boolean }) =>
    apiClient.get('/equipment', { params }),

  getById: (id: string) =>
    apiClient.get(`/equipment/${id}`),

  getByCode: (code: string) =>
    apiClient.get(`/equipment/qr/${code}`),

  create: (data: EquipmentCreateData) =>
    apiClient.post('/equipment', data),

  createBatch: (data: { storeId: string; name: string; type: string; yearCode: string; quantity: number }) =>
    apiClient.post('/equipment/batch', data),

  update: (id: string, data: Partial<EquipmentCreateData>) =>
    apiClient.put(`/equipment/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/equipment/${id}`),

  markAsDown: (id: string) =>
    apiClient.patch(`/equipment/${id}/mark-down`),

  markAsOperational: (id: string) =>
    apiClient.patch(`/equipment/${id}/mark-operational`),

  transfer: (id: string, data: { toStoreId: string; isTemporary: boolean; returnDate?: string; reason?: string; transferredBy?: string }) =>
    apiClient.post(`/equipment/${id}/transfer`, data),

  getHistory: (id: string) =>
    apiClient.get<{ success: boolean; data: TransferHistory[] }>(`/equipment/${id}/history`),

  getTypes: () =>
    apiClient.get<{ success: boolean; data: string[] }>('/equipment/types'),

  getTypeCatalog: () =>
    apiClient.get<{ success: boolean; data: { id: string; name: string; code: string }[] }>('/equipment/type-catalog'),
};

export default equipmentApi;
import apiClient from './client';

// Interfaz que representa un Equipo en el sistema
export interface Equipment {
  id: string;
  storeId: string;
  equipmentCode: string;
  type: string;
  name: string;
  yearCode: string;
  seq: number;
  isDown: boolean;
  qrCodeText?: string; 
  status: string;
  createdAt: string;
  store?: {
    id: string;
    name: string;
    code: string;
  };
}

// Datos necesarios para crear un equipo (el código es opcional porque lo genera el back)
export interface EquipmentCreateData {
  storeId: string;
  name: string;
  type: string;
  yearCode: string;
  equipmentCode?: string; 
}

// Objeto de la API con todos los métodos necesarios
export const equipmentApi = {
  getAll: (params?: { storeId?: string; type?: string; isDown?: boolean }) => 
    apiClient.get('/equipment', { params }),

  getById: (id: string) => 
    apiClient.get(`/equipment/${id}`),

  create: (data: EquipmentCreateData) => 
    apiClient.post('/equipment', data),

  update: (id: string, data: Partial<EquipmentCreateData>) => 
    apiClient.put(`/equipment/${id}`, data),

  delete: (id: string) => 
    apiClient.delete(`/equipment/${id}`),

  markAsDown: (id: string) => 
    apiClient.post(`/equipment/${id}/down`),

  markAsOperational: (id: string) => 
    apiClient.post(`/equipment/${id}/operational`),

  getTypes: () => 
    apiClient.get<{ success: boolean; data: string[] }>('/equipment/types'),
};

// EXPORTACIÓN POR DEFECTO (Esto es lo que arregla el error de la pantalla roja)
export default equipmentApi;
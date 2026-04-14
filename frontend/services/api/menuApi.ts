import apiClient from './client';

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  eventTypes: string[];
  description: string | null;
  price: number;
  isActive: boolean;
  sortOrder: number;
}

interface MenuItemsResponse {
  success: boolean;
  data: MenuItem[];
  count: number;
}

export const menuApi = {
  getAll: (params?: { category?: string; eventType?: string; isActive?: boolean }) =>
    apiClient.get<MenuItemsResponse>('/menu-items', { params }),

  getByEventType: (eventType: string) =>
    apiClient.get<MenuItemsResponse>(`/menu-items/event/${eventType}`),

  create: (data: Partial<MenuItem>) =>
    apiClient.post<{ success: boolean; data: MenuItem }>('/menu-items', data),

  update: (id: string, data: Partial<MenuItem>) =>
    apiClient.put<{ success: boolean; data: MenuItem }>(`/menu-items/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/menu-items/${id}`),
};

export default menuApi;
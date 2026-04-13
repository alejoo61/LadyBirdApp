import apiClient from './client';

export interface Formula {
  id: string;
  name: string;
  category: string;
  amountPerPerson: number;
  unit: string;
  utensil: string;
  smallPackage: string;
  smallPackageMax: number;
  largePackage: string | null;
  largePackageMax: number | null;
  tempType: string;
  eventTypes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FormulaCreateData = Omit<Formula, 'id' | 'createdAt' | 'updatedAt'>;
export type FormulaUpdateData = Partial<FormulaCreateData>;

interface FormulasResponse {
  success: boolean;
  data: Formula[];
  count: number;
}

interface FormulaResponse {
  success: boolean;
  data: Formula;
}

export const formulasApi = {
  getAll: (params?: { category?: string; eventType?: string; isActive?: boolean }) =>
    apiClient.get<FormulasResponse>('/formulas', { params }),

  getById: (id: string) =>
    apiClient.get<FormulaResponse>(`/formulas/${id}`),

  create: (data: FormulaCreateData) =>
    apiClient.post<FormulaResponse>('/formulas', data),

  update: (id: string, data: FormulaUpdateData) =>
    apiClient.put<FormulaResponse>(`/formulas/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/formulas/${id}`),
};

export default formulasApi;
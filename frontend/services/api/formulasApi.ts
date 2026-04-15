import apiClient from './client';

export interface Formula {
  id:              string;
  name:            string;
  canonicalName:   string;
  category:        string;
  categoryLabel:   string;
  amountPerPerson: number;
  unit:            string;
  utensil:         string;
  smallPackage:    string;
  smallPackageMax: number;
  largePackage:    string | null;
  largePackageMax: number | null;
  tempType:        string;
  eventType:       string | null;   // nuevo — singular
  eventTypes:      string[];        // legacy array
  isActive:        boolean;
  createdAt:       string;
}

export interface FormulaAlias {
  id:            string;
  canonicalName: string;
  alias:         string;
  createdAt:     string;
}

export type FormulaCreateData = {
  name:            string;
  canonicalName?:  string;
  category:        string;
  amountPerPerson: number;
  unit:            string;
  utensil?:        string;
  smallPackage?:   string;
  smallPackageMax?: number;
  largePackage?:   string;
  largePackageMax?: number | null;
  tempType?:       string;
  eventType?:      string | null;
  eventTypes?:     string[];
  isActive?:       boolean;
};

export type FormulaUpdateData = Partial<FormulaCreateData>;

interface FormulasResponse {
  success: boolean;
  data:    Formula[];
  count:   number;
}

interface FormulaResponse {
  success: boolean;
  data:    Formula;
}

interface AliasesResponse {
  success: boolean;
  data:    FormulaAlias[];
  count:   number;
}

export const formulasApi = {
  getAll: (params?: { category?: string; eventType?: string; canonicalName?: string; isActive?: boolean }) =>
    apiClient.get<FormulasResponse>('/formulas', { params }),

  getById: (id: string) =>
    apiClient.get<FormulaResponse>(`/formulas/${id}`),

  getCanonicalNames: () =>
    apiClient.get<{ success: boolean; data: string[] }>('/formulas/canonical-names'),

  create: (data: FormulaCreateData) =>
    apiClient.post<FormulaResponse>('/formulas', data),

  update: (id: string, data: FormulaUpdateData) =>
    apiClient.put<FormulaResponse>(`/formulas/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/formulas/${id}`),

  // Aliases
  getAliases: (canonicalName?: string) =>
    apiClient.get<AliasesResponse>('/formulas/aliases', { params: canonicalName ? { canonicalName } : {} }),

  createAlias: (canonicalName: string, alias: string) =>
    apiClient.post<{ success: boolean; data: FormulaAlias }>('/formulas/aliases', { canonicalName, alias }),

  deleteAlias: (id: string) =>
    apiClient.delete(`/formulas/aliases/${id}`),
};

export default formulasApi;
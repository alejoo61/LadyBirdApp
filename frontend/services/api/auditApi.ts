import apiClient from "./client";

export interface AuditLog {
  id:            string;
  orderId:       string;
  action:        string;
  actionLabel:   string;
  actor:         string;
  changes:       Record<string, { before: unknown; after: unknown }> | null;
  metadata:      Record<string, unknown> | null;
  createdAt:     string;
  // Solo en getAll
  clientName?:    string | null;
  displayNumber?: string | null;
}

interface AuditLogsResponse {
  success: boolean;
  data:    AuditLog[];
  count:   number;
}

export const auditApi = {
  getByOrderId: (orderId: string) =>
    apiClient.get<AuditLogsResponse>(`/audit/orders/${orderId}`),

  getAll: (params?: { actor?: string; action?: string; limit?: number; offset?: number }) =>
    apiClient.get<AuditLogsResponse>('/audit', { params }),
};

export default auditApi;
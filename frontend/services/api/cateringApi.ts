import apiClient from "./client";

export interface CateringOrderItem {
  guid: string;
  displayName: string;
  quantity: number;
  price: number;
  modifiers: {
    displayName: string;
    quantity: number;
    price: number;
  }[];
}

export interface CateringOrder {
  id: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  toastOrderGuid: string;
  displayNumber: string;
  eventType: string;
  eventTypeLabel: string;
  status: string;
  statusLabel: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  orderDate: string;
  estimatedFulfillmentDate: string;
  kitchenFinishTime: string;
  businessDate: number;
  deliveryMethod: string;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  driverName: string | null;
  items: CateringOrderItem[];
  guestCount: number;
  totalAmount: string | number;
  overrideData: Record<string, unknown>;
  overrideNotes: string | null;
  isUpcoming: boolean;
  createdAt: string;
  paymentStatus: string;
  paymentStatusLabel: string;
  isPaid: boolean;
  isHouseAccount: boolean;
  isSpaceRental: boolean;
  isManuallyEdited: boolean;
  pdfVersion: number;
  pdfNeedsUpdate: boolean;
  calendarNeedsUpdate: boolean;
}

export interface CateringOrdersParams {
  storeId?: string;
  eventType?: string;
  status?: string;
  deliveryMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentStatus?: string;
}

interface CateringOrdersResponse {
  success: boolean;
  data: CateringOrder[];
  count: number;
}

interface CateringOrderResponse {
  success: boolean;
  data: CateringOrder;
}

export const cateringApi = {
  getAll: (params?: CateringOrdersParams) =>
    apiClient.get<CateringOrdersResponse>("/catering/orders", { params }),

  getById: (id: string) =>
    apiClient.get<CateringOrderResponse>(`/catering/orders/${id}`),

  updateStatus: (id: string, status: string) =>
    apiClient.patch<CateringOrderResponse>(`/catering/orders/${id}/status`, { status }),

  updateOverride: (id: string, overrideData: Record<string, unknown>, overrideNotes: string) =>
    apiClient.patch<CateringOrderResponse>(`/catering/orders/${id}/override`, {
      overrideData,
      overrideNotes,
    }),

  createManual: (data: Partial<CateringOrder>) =>
    apiClient.post<CateringOrderResponse>("/catering/orders", data),

  updateManual: (id: string, data: Partial<CateringOrder>) =>
    apiClient.patch<CateringOrderResponse>(`/catering/orders/${id}/manual`, data),

  overridePaymentStatus: (id: string, paymentStatus: string) =>
    apiClient.patch<CateringOrderResponse>(`/catering/orders/${id}/payment-status`, { paymentStatus }),

  syncCalendar: (id: string) =>
    apiClient.post(`/catering/orders/${id}/sync-calendar`),
};

export default cateringApi;
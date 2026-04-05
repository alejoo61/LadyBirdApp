// src/services/ToastApiClient.js
const axios = require('axios');

class ToastApiClient {
  constructor(toastAuthService) {
    this.toastAuthService = toastAuthService;
    this.baseUrl          = process.env.TOAST_API_BASE_URL;
  }

  async _getHeaders(restaurantGuid) {
    const token = await this.toastAuthService.getAccessToken();
    return {
      'Authorization':                `Bearer ${token}`,
      'Toast-Restaurant-External-ID': restaurantGuid,
      'Content-Type':                 'application/json'
    };
  }

  async get(path, restaurantGuid, params = {}, attempt = 1) {
    try {
      const headers  = await this._getHeaders(restaurantGuid);
      const response = await axios.get(`${this.baseUrl}${path}`, { headers, params });
      return response.data;
    } catch (error) {
      const status = error.response?.status;

      if (status === 401 && attempt === 1) {
        console.warn('⚠️  Toast: token rechazado, forzando refresh...');
        this.toastAuthService._accessToken = null;
        return this.get(path, restaurantGuid, params, 2);
      }

      const message = error.response?.data?.message || error.message;
      throw new Error(`Toast API error [${status}]: ${message}`);
    }
  }

  // Devuelve objetos Order completos — máx 100 por página
  async getOrdersBulk(restaurantGuid, startDate, endDate, page = 1) {
    return this.get('/orders/v2/ordersBulk', restaurantGuid, {
      startDate,
      endDate,
      pageSize: 100,
      page
    });
  }

  // Devuelve el detalle de una orden por GUID
  async getOrderByGuid(restaurantGuid, orderGuid) {
    return this.get(`/orders/v2/orders/${orderGuid}`, restaurantGuid);
  }

  async getRestaurantInfo(restaurantGuid) {
    return this.get(`/restaurants/v1/restaurants/${restaurantGuid}`, restaurantGuid);
  }
}

module.exports = ToastApiClient;
// src/services/ToastAuthService.js
const axios = require('axios');

class ToastAuthService {
  constructor() {
    this.clientId     = process.env.TOAST_CLIENT_ID;
    this.clientSecret = process.env.TOAST_CLIENT_SECRET;
    this.baseUrl      = process.env.TOAST_API_BASE_URL;

    this._accessToken  = null;
    this._expiresAt    = null;
  }

  _isTokenValid() {
    if (!this._accessToken || !this._expiresAt) return false;
    return (this._expiresAt - Date.now()) > 60_000;
  }

  async getAccessToken() {
    if (this._isTokenValid()) {
      return this._accessToken;
    }

    console.log('🔑 Toast: solicitando nuevo token...');
    console.log('   URL:', `${this.baseUrl}/authentication/v1/authentication/login`);
    console.log('   clientId:', this.clientId);
    console.log('   clientSecret:', this.clientSecret ? '***SET***' : '❌ NOT SET');
    console.log('   baseUrl:', this.baseUrl ? this.baseUrl : '❌ NOT SET');

    try {
      const response = await axios.post(
        `${this.baseUrl}/authentication/v1/authentication/login`,
        {
          clientId:       this.clientId,
          clientSecret:   this.clientSecret,
          userAccessType: 'TOAST_MACHINE_CLIENT'
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      console.log('✅ Toast auth response:', JSON.stringify(response.data, null, 2));

      const { token } = response.data;

      this._accessToken = token.accessToken;
      this._expiresAt   = Date.now() + (token.expiresIn * 1000);

      console.log(`✅ Toast: token obtenido, expira en ${token.expiresIn}s`);

      return this._accessToken;

    } catch (error) {
      console.error('❌ Toast auth error status:', error.response?.status);
      console.error('❌ Toast auth error data:', JSON.stringify(error.response?.data, null, 2));
      throw error;
    }
  }
}

module.exports = ToastAuthService;
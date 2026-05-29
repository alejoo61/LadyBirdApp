import apiClient from './client';

interface RegisterData {
  email:      string;
  contrasena: string;
  nombre?:    string;
}

interface LoginData {
  email:      string;
  contrasena: string;
}

interface AuthResponse {
  mensaje:  string;
  token:    string;
  usuario: {
    id:     number;
    email:  string;
    nombre: string;
    role:   string;
  };
}

interface MeResponse {
  usuario: {
    id:     number;
    email:  string;
    nombre: string;
    role:   string;
  };
}

export const authApi = {
  registro: (data: RegisterData) =>
    apiClient.post<AuthResponse>('/auth/registro', data),

  login: (data: LoginData) =>
    apiClient.post<AuthResponse>('/auth/login', data),

  me: (token: string) =>
    apiClient.get<MeResponse>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, contrasena: string) =>
    apiClient.post('/auth/reset-password', { token, contrasena }),
};

export default authApi;
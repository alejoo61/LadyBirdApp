import apiClient from './client';

interface AuthCredentials {
  usuario: string;
  contrasena: string;
}

interface AuthResponse {
  mensaje: string;
  usuario: {
    id: number;
    usuario: string;
  };
}

export const authApi = {
  registro: (data: AuthCredentials) => 
    apiClient.post<AuthResponse>('/auth/registro', data),

  login: (data: AuthCredentials) => 
    apiClient.post<AuthResponse>('/auth/login', data),
};

export default authApi;
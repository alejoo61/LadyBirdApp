import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (para agregar tokens en el futuro)
apiClient.interceptors.request.use(
  (config) => {
    // Aquí podrías agregar tokens de autenticación
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor (para manejo de errores global)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Aquí podrías manejar errores globales
    if (error.response?.status === 401) {
      // Redirigir al login si no está autenticado
      console.log('Unauthorized');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
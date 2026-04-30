import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Inyectar usuario para auditoría
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('lb_user');
      if (stored) {
        try {
          const user = JSON.parse(stored);
          if (user?.usuario) {
            config.headers['x-user'] = user.usuario;
          }
        } catch { /* ignore */ }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log('Unauthorized');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — inyectar JWT y usuario para auditoría
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('lb_token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }

      const stored = localStorage.getItem('lb_user');
      if (stored) {
        try {
          const user = JSON.parse(stored);
          if (user?.email) {
            config.headers['x-user'] = user.email;
          }
        } catch { /* ignore */ }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — si el token expiró, limpiar sesión
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        const isAuthRoute = error.config?.url?.includes('/auth/');
        if (!isAuthRoute) {
          localStorage.removeItem('lb_token');
          localStorage.removeItem('lb_user');
          window.location.reload();
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
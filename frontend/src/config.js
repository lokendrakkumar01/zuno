const PROD_BACKEND_URL = 'https://zuno-backend-bevi.onrender.com';

const getApiBaseUrl = () => {
      const envUrl = import.meta.env.VITE_API_BASE_URL?.trim();
      if (envUrl) {
            return envUrl.replace(/\/+$/, '');
      }
      if (import.meta.env.DEV) {
            return 'http://localhost:5000';
      }
      return PROD_BACKEND_URL;
};

export const API_BASE_URL = getApiBaseUrl();
export const API_URL = `${API_BASE_URL}/api`;

// Export backend URL for socket connections
export const SOCKET_URL = API_BASE_URL;


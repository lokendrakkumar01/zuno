const PROD_BACKEND_URL = 'https://zuno-backend-bevi.onrender.com';
const PROD_APP_URL = 'https://zunoworld.tech';

const normalizeUrl = (value = '') => value.trim().replace(/\/+$/, '');

const getApiBaseUrl = () => {
      const envUrl = normalizeUrl(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '');
      if (envUrl) {
            return envUrl;
      }
      if (import.meta.env.DEV) {
            return 'http://localhost:5000';
      }
      return PROD_BACKEND_URL;
};

const getAppUrl = () => {
      const envUrl = normalizeUrl(import.meta.env.VITE_APP_URL || '');
      if (envUrl) {
            return envUrl;
      }
      if (typeof window !== 'undefined' && window.location?.origin) {
            return window.location.origin;
      }
      return PROD_APP_URL;
};

export const API_BASE_URL = getApiBaseUrl();
export const API_URL = `${API_BASE_URL}/api`;
export const SOCKET_URL = API_BASE_URL;
export const APP_URL = getAppUrl();
export const STREAM_POLL_INTERVAL_MS = Number(import.meta.env.VITE_STREAM_POLL_INTERVAL_MS || 10000);


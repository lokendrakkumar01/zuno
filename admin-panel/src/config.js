const PROD_BACKEND_URL = 'https://zuno-backend-bevi.onrender.com';

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

export const API_BASE_URL = getApiBaseUrl();
export const API_URL = `${API_BASE_URL}/api`;

export const resolveAdminAssetUrl = (url) => {
      const value = String(url || '').trim();
      if (!value) return '';
      if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
            return value;
      }

      return `${API_BASE_URL}${value.startsWith('/') ? value : `/${value}`}`;
};

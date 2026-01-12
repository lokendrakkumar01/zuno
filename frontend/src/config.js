// Use environment variable if set, otherwise use production URL, fallback to localhost for dev
const getApiBaseUrl = () => {
      if (import.meta.env.VITE_API_URL) {
            return import.meta.env.VITE_API_URL;
      }
      // Production URL - Render backend
      if (import.meta.env.PROD) {
            return 'https://zuno-backend-urim.onrender.com';
      }
      // Development
      return 'http://localhost:5000';
};

export const API_BASE_URL = getApiBaseUrl();
export const API_URL = `${API_BASE_URL}/api`;

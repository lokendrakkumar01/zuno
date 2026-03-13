const getApiBaseUrl = () => {
      // 1. Environment variable if set in Render
      if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
      // 2. Production fallback based on Render domain
      if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
            return 'https://zuno-backend-bevi.onrender.com/api';
      }
      // 3. Local development fallback
      return 'http://localhost:5000/api';
};

export const API_URL = getApiBaseUrl();

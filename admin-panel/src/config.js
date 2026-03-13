const getApiBaseUrl = () => {
      // 1. Production check based on domain (overrides potentially incorrect env vars)
      if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
            return 'https://zuno-backend-bevi.onrender.com/api';
      }
      
      // 2. Environment variable if set locally
      if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
      
      // 3. Local development fallback
      return 'http://localhost:5000/api';
};

export const API_URL = getApiBaseUrl();

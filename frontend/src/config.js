// Detect production by checking if we're on the Render domain
const getApiBaseUrl = () => {
      // Always prioritize the environment variable first (Set in Render Dashboard)
      if (import.meta.env.VITE_API_URL) {
            console.log('🌐 Using ENVIRONMENT API:', import.meta.env.VITE_API_URL);
            return import.meta.env.VITE_API_URL;
      }

      // Check if running on Render production domain as fallback
      if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
            console.log('🌐 Using PRODUCTION API:', 'https://zuno-backend-bevi.onrender.com');
            return 'https://zuno-backend-bevi.onrender.com';
      }

      // Development fallback
      const localUrl = import.meta.env?.DEV ? window.location.origin : 'http://localhost:5000';
      console.log('🌐 Using LOCAL API:', localUrl);
      return localUrl;
};

export const API_BASE_URL = getApiBaseUrl();
export const API_URL = `${API_BASE_URL}/api`;

console.log('📡 API Configuration:', { API_BASE_URL, API_URL });

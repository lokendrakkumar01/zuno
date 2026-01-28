// Detect production by checking if we're on the Render domain
const getApiBaseUrl = () => {
      // Check if running on Render production domain
      if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
            console.log('🌐 Using PRODUCTION API:', 'https://zuno-backend-urim.onrender.com');
            return 'https://zuno-backend-urim.onrender.com';
      }
      // Check for environment variable (for other deployments)
      if (import.meta.env.VITE_API_URL) {
            console.log('🌐 Using ENVIRONMENT API:', import.meta.env.VITE_API_URL);
            return import.meta.env.VITE_API_URL;
      }
      // Development fallback
      console.log('🌐 Using LOCAL API:', 'http://localhost:5000');
      return 'http://localhost:5000';
};

export const API_BASE_URL = getApiBaseUrl();
export const API_URL = `${API_BASE_URL}/api`;

console.log('📡 API Configuration:', { API_BASE_URL, API_URL });

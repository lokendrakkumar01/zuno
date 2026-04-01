// Detect production by checking hostname
const BACKEND_URL = 'https://zuno-backend-bevi.onrender.com';

const getApiBaseUrl = () => {
      // Always prioritize the environment variable first (Set in Render Dashboard)
      if (import.meta.env.VITE_API_URL) {
            return import.meta.env.VITE_API_URL;
      }

      if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;

            // Local development — use proxy
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                  return window.location.origin;
            }

            // Any live domain (zunoworld.tech, onrender.com, etc.) → backend URL
            return BACKEND_URL;
      }

      return BACKEND_URL;
};

export const API_BASE_URL = getApiBaseUrl();
export const API_URL = `${API_BASE_URL}/api`;

// Export backend URL for socket connections
export const SOCKET_URL = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? window.location.origin
      : BACKEND_URL;


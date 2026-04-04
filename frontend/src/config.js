// Detect production by checking hostname
const BACKEND_URL = 'https://zuno-backend-bevi.onrender.com';

const getApiBaseUrl = () => {
      // For APK (Mobile), window.location.hostname will not be localhost
      // We should use the live backend URL for the APK to work everywhere
      return BACKEND_URL;
};

export const API_BASE_URL = getApiBaseUrl();
export const API_URL = `${API_BASE_URL}/api`;

// Export backend URL for socket connections
export const SOCKET_URL = BACKEND_URL;


export const AUTH_TOKEN_STORAGE_KEY = 'zuno_token';
export const AUTH_REFRESH_TOKEN_STORAGE_KEY = 'zuno_refresh_token';
export const AUTH_USER_STORAGE_KEY = 'zuno_user';
export const AUTH_USER_SNAPSHOT_STORAGE_KEY = 'zuno_session_user';

const readJsonValue = (key, fallback = null) => {
      try {
            const rawValue = localStorage.getItem(key);
            return rawValue ? JSON.parse(rawValue) : fallback;
      } catch {
            return fallback;
      }
};

export const readStoredToken = () => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
export const readStoredRefreshToken = () => localStorage.getItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);

export const readStoredAuthUser = () => (
      readJsonValue(AUTH_USER_STORAGE_KEY, null)
      || readJsonValue(AUTH_USER_SNAPSHOT_STORAGE_KEY, null)
);

export const getUserHandle = (user) => {
      const username = String(user?.username || '').trim();
      if (username) return username;

      const email = String(user?.email || '').trim().toLowerCase();
      if (email.includes('@')) {
            return email.split('@')[0];
      }

      return '';
};

export const persistStoredAuthUser = (user) => {
      if (!user) {
            localStorage.removeItem(AUTH_USER_STORAGE_KEY);
            localStorage.removeItem(AUTH_USER_SNAPSHOT_STORAGE_KEY);
            return;
      }

      const serializedUser = JSON.stringify(user);
      localStorage.setItem(AUTH_USER_STORAGE_KEY, serializedUser);
      localStorage.setItem(AUTH_USER_SNAPSHOT_STORAGE_KEY, serializedUser);
};

export const persistStoredToken = (token) => {
      if (token) {
            localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
            return;
      }

      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
};

export const persistStoredRefreshToken = (refreshToken) => {
      if (refreshToken) {
            localStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, refreshToken);
            return;
      }

      localStorage.removeItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
};

export const persistStoredSession = ({ user, token, refreshToken }) => {
      persistStoredToken(token);
      persistStoredRefreshToken(refreshToken);
      persistStoredAuthUser(user);
};

export const clearStoredSession = () => {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      localStorage.removeItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      localStorage.removeItem(AUTH_USER_SNAPSHOT_STORAGE_KEY);
};

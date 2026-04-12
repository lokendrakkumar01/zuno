export const AUTH_TOKEN_STORAGE_KEY = 'zuno_token';
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

export const readStoredAuthUser = () => (
      readJsonValue(AUTH_USER_STORAGE_KEY, null)
      || readJsonValue(AUTH_USER_SNAPSHOT_STORAGE_KEY, null)
);

export const persistStoredAuthUser = (user) => {
      if (!user) return;

      const serializedUser = JSON.stringify(user);
      localStorage.setItem(AUTH_USER_STORAGE_KEY, serializedUser);
      localStorage.setItem(AUTH_USER_SNAPSHOT_STORAGE_KEY, serializedUser);
};

export const persistStoredToken = (token) => {
      if (token) {
            localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      }
};

export const persistStoredSession = ({ user, token }) => {
      if (token) {
            persistStoredToken(token);
      }

      if (user) {
            persistStoredAuthUser(user);
      }
};

export const clearStoredSession = () => {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      localStorage.removeItem(AUTH_USER_SNAPSHOT_STORAGE_KEY);
};

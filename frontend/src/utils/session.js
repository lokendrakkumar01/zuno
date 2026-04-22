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

export const getEntityId = (value) => {
      if (value == null) return '';

      if (typeof value === 'string' || typeof value === 'number') {
            return String(value).trim();
      }

      if (typeof value?.toHexString === 'function') {
            return value.toHexString();
      }

      if (typeof value?.$oid === 'string') {
            return value.$oid.trim();
      }

      if (value && typeof value === 'object') {
            if (value._id && value._id !== value) {
                  const nestedId = getEntityId(value._id);
                  if (nestedId) return nestedId;
            }

            if (value.id && value.id !== value) {
                  const nestedId = getEntityId(value.id);
                  if (nestedId) return nestedId;
            }
      }

      if (typeof value?.toString === 'function') {
            const normalized = String(value.toString()).trim();
            if (normalized && normalized !== '[object Object]') {
                  return normalized;
            }
      }

      return '';
};

export const sameEntityId = (left, right) => {
      const normalizedLeft = getEntityId(left);
      const normalizedRight = getEntityId(right);
      return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
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

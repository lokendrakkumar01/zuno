import { API_BASE_URL } from '../config';

export const resolveAssetUrl = (url) => {
      if (!url) return '';
      if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
            return url;
      }
      return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
};

export const getInitials = (value = '') => {
      const safeValue = String(value || '').trim();
      return safeValue ? safeValue.charAt(0).toUpperCase() : 'Z';
};

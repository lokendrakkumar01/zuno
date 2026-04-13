import { API_BASE_URL } from '../config';

const optimizeCloudinaryUrl = (value = '') => {
      if (!value.includes('res.cloudinary.com') || !value.includes('/upload/')) {
            return value;
      }

      if (value.includes('/upload/q_auto,f_auto/') || value.includes('/upload/f_auto,q_auto/')) {
            return value;
      }

      return value.replace('/upload/', '/upload/q_auto,f_auto/');
};

export const resolveAssetUrl = (url) => {
      if (!url) return '';
      if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
            return optimizeCloudinaryUrl(url);
      }
      return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
};

export const getInitials = (value = '') => {
      const safeValue = String(value || '').trim();
      return safeValue ? safeValue.charAt(0).toUpperCase() : 'Z';
};

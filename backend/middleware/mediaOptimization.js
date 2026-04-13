const CLOUDINARY_UPLOAD_SEGMENT = '/upload/';
const DEFAULT_TRANSFORMS = 'q_auto,f_auto';

const optimizeCloudinaryUrl = (url) => {
      const value = String(url || '');
      if (!value.includes('res.cloudinary.com') || !value.includes(CLOUDINARY_UPLOAD_SEGMENT)) {
            return value;
      }

      if (value.includes('/upload/q_auto,f_auto/') || value.includes('/upload/f_auto,q_auto/')) {
            return value;
      }

      return value.replace(CLOUDINARY_UPLOAD_SEGMENT, `${CLOUDINARY_UPLOAD_SEGMENT}${DEFAULT_TRANSFORMS}/`);
};

const optimizeMediaUrlsDeep = (value) => {
      if (!value) return value;

      if (typeof value === 'string') {
            return optimizeCloudinaryUrl(value);
      }

      if (Array.isArray(value)) {
            return value.map((entry) => optimizeMediaUrlsDeep(entry));
      }

      if (typeof value === 'object') {
            return Object.entries(value).reduce((accumulator, [key, entryValue]) => {
                  accumulator[key] = optimizeMediaUrlsDeep(entryValue);
                  return accumulator;
            }, {});
      }

      return value;
};

const optimizeResponseMediaUrls = (req, res, next) => {
      const originalJson = res.json.bind(res);

      res.json = (payload) => originalJson(optimizeMediaUrlsDeep(payload));

      next();
};

module.exports = {
      optimizeCloudinaryUrl,
      optimizeMediaUrlsDeep,
      optimizeResponseMediaUrls
};

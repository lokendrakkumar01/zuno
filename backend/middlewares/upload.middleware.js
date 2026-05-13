const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedMime = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime'
]);

const fileFilter = (req, file, cb) => {
  if (!allowedMime.has(file.mimetype)) {
    return cb(new Error('Only image and video uploads are allowed'));
  }
  return cb(null, true);
};

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: file.mimetype.startsWith('video/') ? 'zuno/videos' : 'zuno/images',
    resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov'],
    transformation: file.mimetype.startsWith('image/')
      ? [{ width: 800, crop: 'limit', fetch_format: 'auto', quality: 'auto' }]
      : []
  })
});

const upload = multer({
  storage: cloudinaryStorage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});

module.exports = {
  upload,
  uploadImage: upload,
  uploadMultiple: upload,
  MAX_FILE_SIZE
};

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: file.mimetype?.startsWith('video/') ? 'zuno/videos' : 'zuno/images',
    resource_type: file.mimetype?.startsWith('video/') ? 'video' : 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov'],
    transformation: file.mimetype?.startsWith('image/')
      ? [{ width: 800, crop: 'limit', fetch_format: 'auto', quality: 'auto' }]
      : undefined
  })
});

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime'
]);

const uploadToCloud = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter(req, file, cb) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('Only image and video uploads are allowed'));
    }
    return cb(null, true);
  }
});

module.exports = cloudinary;
module.exports.cloudinary = cloudinary;
module.exports.uploadToCloud = uploadToCloud;

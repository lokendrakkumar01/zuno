const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with environment variables
cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
});

// Create Cloudinary storage for multer
const storage = new CloudinaryStorage({
      cloudinary: cloudinary,
      params: async (req, file) => {
            // Determine resource type based on mimetype
            const isVideo = file.mimetype.startsWith('video');
            const isImage = file.mimetype.startsWith('image');

            return {
                  folder: 'zuno', // All uploads go to 'zuno' folder in Cloudinary
                  resource_type: isVideo ? 'video' : 'image',
                  allowed_formats: isVideo
                        ? ['mp4', 'webm', 'mov', 'avi', 'mkv']
                        : ['jpg', 'jpeg', 'png', 'gif', 'webp'],
                  transformation: isImage ? [
                        { width: 1200, height: 1200, crop: 'limit', quality: 'auto:good' }
                  ] : undefined,
                  // For videos, enable streaming
                  eager: isVideo ? [
                        { streaming_profile: 'full_hd', format: 'mp4' }
                  ] : undefined,
                  eager_async: true
            };
      }
});

// Create multer instance with Cloudinary storage
const uploadToCloud = multer({
      storage: storage,
      limits: {
            fileSize: 100 * 1024 * 1024 // 100MB max file size
      },
      fileFilter: (req, file, cb) => {
            // Accept images and videos only
            if (file.mimetype.startsWith('image') || file.mimetype.startsWith('video')) {
                  cb(null, true);
            } else {
                  cb(new Error('Only image and video files are allowed!'), false);
            }
      }
});

// Helper function to delete media from Cloudinary
const deleteFromCloud = async (publicId, resourceType = 'image') => {
      try {
            const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
            return result;
      } catch (error) {
            console.error('Error deleting from Cloudinary:', error);
            throw error;
      }
};

// Helper to extract public_id from Cloudinary URL
const getPublicIdFromUrl = (url) => {
      if (!url) return null;
      // Cloudinary URLs look like: https://res.cloudinary.com/cloud-name/image/upload/v123456/folder/filename.ext
      const matches = url.match(/\/v\d+\/(.+)\.\w+$/);
      return matches ? matches[1] : null;
};

module.exports = {
      cloudinary,
      uploadToCloud,
      deleteFromCloud,
      getPublicIdFromUrl
};

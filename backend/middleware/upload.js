const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const fs = require('fs');

// Configure storage
const storage = multer.diskStorage({
      destination: function (req, file, cb) {
            const folder = 'uploads/';

            // Ensure folder exists
            if (!fs.existsSync(folder)) {
                  fs.mkdirSync(folder, { recursive: true });
            }

            cb(null, folder);
      },
      filename: function (req, file, cb) {
            const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
            cb(null, uniqueName);
      }
});

// File filter
const fileFilter = (req, file, cb) => {
      // Allowed types
      const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];

      if (allowedImageTypes.includes(file.mimetype) || allowedVideoTypes.includes(file.mimetype)) {
            cb(null, true);
      } else {
            cb(new Error('Invalid file type. Only images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM, MOV) are allowed.'), false);
      }
};

// Upload configurations
const uploadImage = multer({
      storage: storage,
      limits: {
            fileSize: 10 * 1024 * 1024, // 10MB max for images
      },
      fileFilter: fileFilter
});

const uploadVideo = multer({
      storage: storage,
      limits: {
            fileSize: 100 * 1024 * 1024, // 100MB max for videos
      },
      fileFilter: fileFilter
});

const uploadMultiple = multer({
      storage: storage,
      limits: {
            fileSize: 10 * 1024 * 1024,
            files: 10 // Max 10 files
      },
      fileFilter: fileFilter
});

module.exports = {
      uploadImage,
      uploadVideo,
      uploadMultiple
};

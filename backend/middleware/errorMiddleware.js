/**
 * Centralized error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log for developer
  if (process.env.NODE_ENV === 'development') {
    console.error(`[Error] ${req.method} ${req.path}:`, err);
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = new Error(message);
    error.statusCode = 404;
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new Error('File is too large. Maximum size is 100MB.');
    error.statusCode = 400;
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    error = new Error('Too many files. Maximum is 10 files per upload.');
    error.statusCode = 400;
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = new Error('Unexpected file field. Please use the correct upload form.');
    error.statusCode = 400;
  }
  if (err.message && err.message.includes('Only image and video')) {
    error = new Error(err.message);
    error.statusCode = 400;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new Error(message);
    error.statusCode = 400;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = new Error(message);
    error.statusCode = 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Not authorized to access this route';
    error = new Error(message);
    error.statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Session expired, please login again';
    error = new Error(message);
    error.statusCode = 401;
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = errorHandler;

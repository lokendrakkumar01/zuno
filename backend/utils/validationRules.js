const { body } = require('express-validator');

/**
 * Validation rules for user registration
 */
const registerRules = () => {
  return [
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters')
      .matches(/^[a-zA-Z0-9_.]+$/).withMessage('Username can only contain letters, numbers, underscores and dots'),
    body('email')
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
    body('displayName')
      .optional()
      .trim()
      .isLength({ max: 50 }).withMessage('Display name cannot exceed 50 characters'),
  ];
};

/**
 * Validation rules for user login
 */
const loginRules = () => {
  return [
    body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ];
};

/**
 * Validation rules for content creation
 */
const contentRules = () => {
  return [
    body('contentType')
      .isIn(['photo', 'post', 'short-video', 'long-video', 'live', 'story', 'status', 'text-status'])
      .withMessage('Invalid content type'),
    body('title')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
    body('body')
      .optional()
      .trim()
      .isLength({ max: 5000 }).withMessage('Body cannot exceed 5000 characters'),
    body('visibility')
      .optional()
      .isIn(['public', 'private', 'community'])
      .withMessage('Invalid visibility'),
  ];
};

module.exports = {
  registerRules,
  loginRules,
  contentRules
};

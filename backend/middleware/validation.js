const { validationResult } = require('express-validator');

/**
 * Centralized validation middleware
 * Handles validation results from express-validator
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  
  const errorList = errors.array({ onlyFirstError: true });
  const extractedErrors = [];
  const fieldErrors = {};
  errorList.forEach((err) => {
    extractedErrors.push({ [err.path]: err.msg });
    fieldErrors[err.path] = err.msg;
  });

  return res.status(422).json({
    success: false,
    message: errorList[0]?.msg || 'Validation failed',
    errors: extractedErrors,
    fieldErrors,
  });
};

module.exports = {
  validate
};

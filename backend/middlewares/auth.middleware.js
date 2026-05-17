const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signAccessToken = (userId) => jwt.sign({ id: userId }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_ACCESS_EXPIRE || process.env.JWT_EXPIRE || '30m'
});

const signRefreshToken = (userId) => jwt.sign({ id: userId, type: 'refresh' }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
  expiresIn: '30d'
});

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('+refreshTokenHash');
    if (!user || !user.isActive) return res.status(401).json({ success: false, message: 'Invalid session' });
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before continuing.',
        requiresVerification: true,
        email: user.email,
        data: { requiresVerification: true, email: user.email }
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
  }
  return next();
};

module.exports = { protect, authorizeRoles, signAccessToken, signRefreshToken };

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
      let token;

      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            try {
                  token = req.headers.authorization.split(' ')[1];
                  const decoded = jwt.verify(token, process.env.JWT_SECRET);
                  req.user = await User.findById(decoded.id).select('-password');

                  if (!req.user) {
                        return res.status(401).json({ success: false, message: 'User not found' });
                  }

                  if (!req.user.isActive) {
                        return res.status(401).json({ success: false, message: 'Account is deactivated' });
                  }

                  return next();
            } catch (error) {
                  return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
            }
      }

      if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized, no token' });
      }
};

// Optional auth - attach user if token is valid, continue otherwise
const optionalProtect = async (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
      }

      try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');
            if (user && user.isActive) {
                  req.user = user;
            }
      } catch (error) {
            // Ignore invalid tokens for public endpoints.
      }

      return next();
};

// Admin only access
const adminOnly = (req, res, next) => {
      if (req.user && req.user.role === 'admin') {
            return next();
      } else {
            return res.status(403).json({ success: false, message: 'Admin access required' });
      }
};

// Moderator or Admin access
const moderatorAccess = (req, res, next) => {
      if (req.user && (req.user.role === 'admin' || req.user.role === 'moderator')) {
            return next();
      } else {
            return res.status(403).json({ success: false, message: 'Moderator access required' });
      }
};

// Creator, Moderator or Admin access
const creatorAccess = (req, res, next) => {
      const allowedRoles = ['admin', 'moderator', 'creator', 'mentor'];
      if (req.user && allowedRoles.includes(req.user.role)) {
            return next();
      } else {
            return res.status(403).json({ success: false, message: 'Creator access required' });
      }
};

module.exports = { protect, optionalProtect, adminOnly, moderatorAccess, creatorAccess };

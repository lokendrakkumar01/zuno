const express = require('express');
const User = require('../models/User');
const { protect } = require('../middlewares/auth.middleware');
const { uploadImage } = require('../middlewares/upload.middleware');

const router = express.Router();

const clean = (value, max = 200) => String(value || '').trim().replace(/[<>]/g, '').slice(0, max);

const optimizeCloudinaryUrl = (url) => {
  if (!url || !url.includes('/upload/')) return url || '';
  return url.replace('/upload/', '/upload/f_auto,q_auto,w_800,c_limit/');
};

router.get('/id/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        displayName: user.displayName || user.username,
        avatar: user.avatar,
        bio: user.bio || '',
        isVerified: Boolean(user.isVerified)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/search', protect, async (req, res) => {
  try {
    const q = clean(req.query.q, 80);
    const users = await User.find(q ? { $text: { $search: q }, isActive: true } : { isActive: true })
      .select('username displayName avatar bio isVerified')
      .limit(20)
      .lean();
    return res.json({ success: true, users: users.map((u) => ({ ...u, id: u._id.toString(), _id: undefined })) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/profile', protect, async (req, res) => {
  try {
    const updates = {
      displayName: clean(req.body.displayName, 50),
      bio: clean(req.body.bio, 200)
    };
    if (Array.isArray(req.body.interests)) {
      updates.interests = req.body.interests.map((item) => clean(item, 40)).filter(Boolean).slice(0, 10);
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true
    });
    return res.json({ success: true, data: { user: user.getAuthProfile() }, user: user.getAuthProfile() });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/profile/avatar', protect, uploadImage.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Avatar image is required' });

    req.user.avatar = optimizeCloudinaryUrl(req.file.path);
    req.user.cloudinaryAvatarId = req.file.filename || '';
    await req.user.save();

    return res.json({ success: true, data: { user: req.user.getAuthProfile() }, user: req.user.getAuthProfile(), avatar: req.user.avatar });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: clean(req.params.username, 30), isActive: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, user: user.getPublicProfile() });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

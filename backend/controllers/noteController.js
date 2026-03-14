const Note = require('../models/Note');

// @desc    Create a new note
// @route   POST /api/notes
// @access  Private
const createNote = async (req, res) => {
      try {
            const { text } = req.body;

            if (!text || text.trim().length === 0) {
                  return res.status(400).json({ success: false, message: 'Note text is required' });
            }

            if (text.length > 60) {
                  return res.status(400).json({ success: false, message: 'Note must be 60 characters or less' });
            }

            // Remove existing active note for this user if they are creating a new one
            await Note.deleteMany({ user: req.user.id });

            const note = await Note.create({
                  user: req.user.id,
                  text: text.trim()
            });

            await note.populate('user', 'username displayName avatar');

            res.status(201).json({
                  success: true,
                  data: { note }
            });
      } catch (error) {
            console.error('createNote error:', error);
            res.status(500).json({ success: false, message: 'Server Error' });
      }
};

// @desc    Get active notes from friends/all users
// @route   GET /api/notes
// @access  Private
const getNotes = async (req, res) => {
      try {
            // Find all notes that haven't expired
            const notes = await Note.find({ expiresAt: { $gt: new Date() } })
                  .populate('user', 'username displayName avatar')
                  .sort({ createdAt: -1 })
                  .limit(50); // Limit to recent 50 active notes for performance

            res.json({
                  success: true,
                  data: { notes }
            });
      } catch (error) {
            console.error('getNotes error:', error);
            res.status(500).json({ success: false, message: 'Server Error' });
      }
};

// @desc    Delete a note
// @route   DELETE /api/notes/:id
// @access  Private
const deleteNote = async (req, res) => {
      try {
            const note = await Note.findById(req.params.id);

            if (!note) {
                  return res.status(404).json({ success: false, message: 'Note not found' });
            }

            if (note.user.toString() !== req.user.id.toString()) {
                  return res.status(401).json({ success: false, message: 'Not authorized' });
            }

            await note.deleteOne();

            res.json({ success: true, message: 'Note removed' });
      } catch (error) {
            console.error('deleteNote error:', error);
            res.status(500).json({ success: false, message: 'Server Error' });
      }
};

module.exports = {
      createNote,
      getNotes,
      deleteNote
};

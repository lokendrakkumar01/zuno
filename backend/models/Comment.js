const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
      user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
      },
      content: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Content',
            required: true
      },
      text: {
            type: String,
            required: [true, 'Comment text is required'],
            trim: true,
            maxlength: [500, 'Comment cannot exceed 500 characters']
      }
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { createNote, getNotes, deleteNote } = require('../controllers/noteController');

router.use(protect);

router.route('/')
      .post(createNote)
      .get(getNotes);

router.route('/:id')
      .delete(deleteNote);

module.exports = router;

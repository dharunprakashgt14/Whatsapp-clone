const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Get all users (excluding a specific user - for chat list)
router.get('/', async (req, res) => {
  try {
    const { exclude } = req.query;
    const filter = exclude ? { _id: { $ne: exclude } } : {};
    const users = await User.find(filter).select('-password').sort({ name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
router.put('/:id', async (req, res) => {
  try {
    const { name, about, avatar, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { name, about, avatar, phone } },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('./mongo');

const JWT_SECRET = process.env.JWT_SECRET || 'website-domain-mgr-super-secret-key-2026';
const TOKEN_EXPIRY = '7d';

// Middleware to authenticate requests
async function requireAuth(req, res, next) {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User account not found in database.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    let { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    username = String(username).trim();
    password = String(password).trim();

    // Case-insensitive lookup for admin username
    const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const passwordValid = bcrypt.compareSync(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user._id.toString(), username: user.username },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: 'Login successful via MongoDB Atlas',
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        is_default_password: Boolean(user.is_default_password)
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during authentication.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully.' });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user._id.toString(),
      username: req.user.username,
      is_default_password: Boolean(req.user.is_default_password)
    }
  });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    let { currentPassword, newPassword, confirmPassword } = req.body;

    if (!newPassword || !String(newPassword).trim()) {
      return res.status(400).json({ error: 'New password is required.' });
    }

    currentPassword = currentPassword ? String(currentPassword).trim() : '';
    newPassword = String(newPassword).trim();
    confirmPassword = confirmPassword ? String(confirmPassword).trim() : '';

    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password confirmation does not match.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // If current password provided, verify it
    if (currentPassword) {
      const passwordValid = bcrypt.compareSync(currentPassword, user.password_hash);
      if (!passwordValid) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    user.password_hash = newHash;
    user.is_default_password = false;
    user.updated_at = new Date();
    await user.save();

    // Issue updated token
    const token = jwt.sign(
      { id: user._id.toString(), username: user.username },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: 'Password updated successfully in MongoDB Atlas!',
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        is_default_password: false
      }
    });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to update password in MongoDB.' });
  }
});

module.exports = {
  router,
  requireAuth
};

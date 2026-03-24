const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY || '';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || '';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'WhatsApp Clone';
const OTP_DEMO_MODE = process.env.OTP_DEMO_MODE === 'true';

const isValidPhone = (phone = '') => /^\+?[0-9]{10,15}$/.test(String(phone).trim());
const isValidEmail = (email = '') => /^\S+@\S+\.\S+$/.test(String(email).trim());
const toFast2SmsNumber = (phone = '') => String(phone).replace(/\D/g, '').slice(-10);
const getFast2SmsErrorMessage = (payload, statusCode) => {
  if (!payload) return `Fast2SMS request failed (HTTP ${statusCode})`;
  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload.message) && payload.message.length) return payload.message.join(', ');
  if (typeof payload.message === 'string') return payload.message;
  if (typeof payload.error === 'string') return payload.error;
  if (typeof payload.return === 'boolean' && payload.return === false) {
    return `Fast2SMS rejected the request (HTTP ${statusCode})`;
  }
  return `Fast2SMS request failed (HTTP ${statusCode})`;
};

const sendOtpViaFast2SMS = async (phone, otp) => {
  const number = toFast2SmsNumber(phone);
  if (!number || number.length !== 10) {
    throw new Error('Invalid Indian phone number for Fast2SMS');
  }

  const body = new URLSearchParams({
    route: 'otp',
    variables_values: otp,
    numbers: number,
  }).toString();

  const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: FAST2SMS_API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok || data.return === false) {
    throw new Error(getFast2SmsErrorMessage(data, response.status));
  }
  return data;
};

const sendOtpViaBrevo = async (email, otp, name = '') => {
  if (!BREVO_API_KEY) {
    throw new Error('Brevo API key is missing');
  }
  if (!BREVO_SENDER_EMAIL) {
    throw new Error('Brevo sender email is missing');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        email: BREVO_SENDER_EMAIL,
        name: BREVO_SENDER_NAME,
      },
      to: [{ email: String(email).trim(), name: String(name || '').trim() || undefined }],
      subject: 'Your WhatsApp Clone OTP',
      htmlContent: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#222">
          <h2 style="margin-bottom:8px">Verify your email</h2>
          <p style="margin-top:0">Your OTP is:</p>
          <div style="font-size:28px;font-weight:700;letter-spacing:6px;margin:12px 0">${otp}</div>
          <p>This OTP is valid for 5 minutes.</p>
        </div>
      `,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getFast2SmsErrorMessage(data, response.status));
  }
  return data;
};

// Send OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { phone, email, mode = 'login', name = '', channel } = req.body;
    if (!['login', 'register'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid OTP mode' });
    }

    const normalizedPhone = String(phone || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const selectedChannel = channel || (mode === 'register' ? 'email' : (normalizedEmail ? 'email' : 'sms'));

    if (selectedChannel === 'email') {
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ error: 'Enter a valid email address' });
      }
    } else if (!isValidPhone(normalizedPhone)) {
      return res.status(400).json({ error: 'Enter a valid phone number' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpKey = selectedChannel === 'email' ? `email:${normalizedEmail}` : `phone:${normalizedPhone}`;
    otpStore.set(otpKey, {
      otp,
      mode,
      name: String(name || '').trim(),
      phone: normalizedPhone,
      email: normalizedEmail,
      channel: selectedChannel,
      expiresAt: Date.now() + OTP_TTL_MS,
    });

    if (OTP_DEMO_MODE) {
      return res.json({
        message: 'OTP sent successfully (demo mode)',
        otp,
      });
    }

    if (selectedChannel === 'email') {
      await sendOtpViaBrevo(normalizedEmail, otp, name);
      return res.json({ message: 'OTP sent to email successfully' });
    }

    if (!FAST2SMS_API_KEY) {
      return res.status(500).json({ error: 'SMS provider is not configured' });
    }
    await sendOtpViaFast2SMS(normalizedPhone, otp);
    return res.json({ message: 'OTP sent to phone successfully' });
  } catch (err) {
    console.error('Send OTP error:', err.message || err);
    res.status(502).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

// Verify OTP + login/register
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, email, otp, mode = 'login', name = '', channel } = req.body;
    const normalizedPhone = String(phone || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const selectedChannel = channel || (mode === 'register' ? 'email' : (normalizedEmail ? 'email' : 'sms'));
    const otpKey = selectedChannel === 'email' ? `email:${normalizedEmail}` : `phone:${normalizedPhone}`;
    const rec = otpStore.get(otpKey);

    if (selectedChannel === 'email') {
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ error: 'Enter a valid email address' });
      }
    } else if (!isValidPhone(normalizedPhone)) {
      return res.status(400).json({ error: 'Enter a valid phone number' });
    }
    if (!rec || rec.expiresAt < Date.now()) {
      otpStore.delete(otpKey);
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }
    if (rec.otp !== String(otp || '').trim()) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    let user = null;
    if (mode === 'register') {
      user = await User.findOne({ email: normalizedEmail });
    } else {
      user = selectedChannel === 'email'
        ? await User.findOne({ email: normalizedEmail })
        : await User.findOne({ phone: normalizedPhone });
    }
    if (mode === 'register') {
      if (user) {
        return res.status(400).json({ error: 'Email already registered. Please sign in.' });
      }
      const finalName = String(name || rec.name || '').trim();
      if (!finalName || finalName.length < 2) {
        return res.status(400).json({ error: 'Name must be at least 2 characters' });
      }
      user = new User({
        name: finalName,
        email: normalizedEmail,
      });
      await user.save();
    } else if (!user) {
      return res.status(404).json({
        error: selectedChannel === 'email'
          ? 'No account found for this email. Please register first.'
          : 'No account found for this phone number. Please register first.',
      });
    }

    user.online = true;
    user.lastSeen = new Date();
    await user.save();

    otpStore.delete(otpKey);
    const token = generateToken(user._id);
    res.json({
      message: mode === 'register' ? 'Registration successful' : 'Login successful',
      user: user.toJSON(),
      token,
    });
  } catch (err) {
    console.error('Verify OTP error:', err.message || err);
    if (err?.code === 11000) {
      return res.status(400).json({ error: 'Account already exists. Please sign in.' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const user = new User({ name, email, password });
    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      message: 'User registered successfully',
      user: user.toJSON(),
      token,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ error: errors.join(', ') });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update online status
    user.online = true;
    user.lastSeen = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      token,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
router.post('/logout/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.online = false;
    user.lastSeen = new Date();
    await user.save();

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

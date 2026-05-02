const express = require('express'); // import express framework
const router = express.Router(); // create router instance
const User = require('../models/User'); // import user model
const { generateToken } = require('../middleware/auth'); // import JWT generator

const otpStore = new Map(); // in-memory store for OTPs
const OTP_TTL_MS = 5 * 60 * 1000; // OTP expiry time (5 mins)

const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY || ''; // SMS API key
const BREVO_API_KEY = process.env.BREVO_API_KEY || ''; // email API key
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || ''; // sender email
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'WhatsApp Clone'; // sender name
const OTP_DEMO_MODE = process.env.OTP_DEMO_MODE === 'true'; // demo mode flag

const isValidPhone = (phone = '') => /^\+?[0-9]{10,15}$/.test(String(phone).trim()); // validate phone
const isValidEmail = (email = '') => /^\S+@\S+\.\S+$/.test(String(email).trim()); // validate email
const toFast2SmsNumber = (phone = '') => String(phone).replace(/\D/g, '').slice(-10); // format phone for SMS

const getFast2SmsErrorMessage = (payload, statusCode) => { // extract error message
  if (!payload) return `Fast2SMS request failed (HTTP ${statusCode})`; // no payload case
  if (typeof payload === 'string') return payload; // string error
  if (Array.isArray(payload.message) && payload.message.length) return payload.message.join(', '); // array error
  if (typeof payload.message === 'string') return payload.message; // message field
  if (typeof payload.error === 'string') return payload.error; // error field
  if (typeof payload.return === 'boolean' && payload.return === false) { // API failure flag
    return `Fast2SMS rejected the request (HTTP ${statusCode})`;
  }
  return `Fast2SMS request failed (HTTP ${statusCode})`; // fallback
};

const sendOtpViaFast2SMS = async (phone, otp) => { // function to send OTP via SMS
  const number = toFast2SmsNumber(phone); // normalize number
  if (!number || number.length !== 10) { // validate number
    throw new Error('Invalid Indian phone number for Fast2SMS');
  }

  const body = new URLSearchParams({ // prepare request body
    route: 'otp',
    variables_values: otp,
    numbers: number,
  }).toString();

  const response = await fetch('https://www.fast2sms.com/dev/bulkV2', { // call SMS API
    method: 'POST',
    headers: {
      authorization: FAST2SMS_API_KEY, // auth header
      'Content-Type': 'application/x-www-form-urlencoded', // content type
    },
    body,
  });

  const raw = await response.text(); // get raw response
  let data = null; // init parsed data
  try {
    data = raw ? JSON.parse(raw) : null; // parse JSON
  } catch {
    data = raw; // fallback
  }

  if (!response.ok || data.return === false) { // check failure
    throw new Error(getFast2SmsErrorMessage(data, response.status));
  }
  return data; // return success
};

const sendOtpViaBrevo = async (email, otp, name = '') => { // send OTP via email
  if (!BREVO_API_KEY) { // check API key
    throw new Error('Brevo API key is missing');
  }
  if (!BREVO_SENDER_EMAIL) { // check sender
    throw new Error('Brevo sender email is missing');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', { // call email API
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY, // API key header
      'Content-Type': 'application/json', // content type
      Accept: 'application/json', // accept type
    },
    body: JSON.stringify({ // email payload
      sender: {
        email: BREVO_SENDER_EMAIL, // sender email
        name: BREVO_SENDER_NAME, // sender name
      },
      to: [{ email: String(email).trim(), name: String(name || '').trim() || undefined }], // receiver
      subject: 'Your WhatsApp Clone OTP', // subject
      htmlContent: `...`, // email content
    }),
  });

  const data = await response.json().catch(() => ({})); // parse response
  if (!response.ok) { // check failure
    throw new Error(getFast2SmsErrorMessage(data, response.status));
  }
  return data; // return success
};

// Send OTP
router.post('/send-otp', async (req, res) => { // route to send OTP
  try {
    const { phone, email, mode = 'login', name = '', channel } = req.body; // get inputs
    if (!['login', 'register'].includes(mode)) { // validate mode
      return res.status(400).json({ error: 'Invalid OTP mode' });
    }

    const normalizedPhone = String(phone || '').trim(); // clean phone
    const normalizedEmail = String(email || '').trim().toLowerCase(); // clean email
    const selectedChannel = channel || (mode === 'register' ? 'email' : (normalizedEmail ? 'email' : 'sms')); // choose channel

    if (selectedChannel === 'email') {
      if (!isValidEmail(normalizedEmail)) { // validate email
        return res.status(400).json({ error: 'Enter a valid email address' });
      }
    } else if (!isValidPhone(normalizedPhone)) { // validate phone
      return res.status(400).json({ error: 'Enter a valid phone number' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000)); // generate OTP
    const otpKey = selectedChannel === 'email' ? `email:${normalizedEmail}` : `phone:${normalizedPhone}`; // create key

    otpStore.set(otpKey, { // store OTP
      otp,
      mode,
      name: String(name || '').trim(),
      phone: normalizedPhone,
      email: normalizedEmail,
      channel: selectedChannel,
      expiresAt: Date.now() + OTP_TTL_MS, // expiry time
    });

    if (OTP_DEMO_MODE) { // demo mode
      return res.json({ message: 'OTP sent successfully (demo mode)', otp });
    }

    if (selectedChannel === 'email') {
      await sendOtpViaBrevo(normalizedEmail, otp, name); // send email OTP
      return res.json({ message: 'OTP sent to email successfully' });
    }

    if (!FAST2SMS_API_KEY) { // check SMS config
      return res.status(500).json({ error: 'SMS provider is not configured' });
    }

    await sendOtpViaFast2SMS(normalizedPhone, otp); // send SMS OTP
    return res.json({ message: 'OTP sent to phone successfully' });

  } catch (err) {
    console.error('Send OTP error:', err.message || err); // log error
    res.status(502).json({ error: 'Failed to send OTP. Please try again.' }); // response
  }
});

// Verify OTP + login/register
router.post('/verify-otp', async (req, res) => { // route to verify OTP
  try {
    const { phone, email, otp, mode = 'login', name = '', channel } = req.body; // inputs
    const normalizedPhone = String(phone || '').trim(); // clean phone
    const normalizedEmail = String(email || '').trim().toLowerCase(); // clean email
    const selectedChannel = channel || (mode === 'register' ? 'email' : (normalizedEmail ? 'email' : 'sms')); // channel
    const otpKey = selectedChannel === 'email' ? `email:${normalizedEmail}` : `phone:${normalizedPhone}`; // key
    const rec = otpStore.get(otpKey); // fetch OTP

    if (selectedChannel === 'email') {
      if (!isValidEmail(normalizedEmail)) { // validate email
        return res.status(400).json({ error: 'Enter a valid email address' });
      }
    } else if (!isValidPhone(normalizedPhone)) { // validate phone
      return res.status(400).json({ error: 'Enter a valid phone number' });
    }

    if (!rec || rec.expiresAt < Date.now()) { // check expiry
      otpStore.delete(otpKey); // remove OTP
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }

    if (rec.otp !== String(otp || '').trim()) { // match OTP
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    let user = null; // init user

    if (mode === 'register') {
      user = await User.findOne({ email: normalizedEmail }); // check existing
    } else {
      user = selectedChannel === 'email'
        ? await User.findOne({ email: normalizedEmail }) // find by email
        : await User.findOne({ phone: normalizedPhone }); // find by phone
    }

    if (mode === 'register') {
      if (user) { // already exists
        return res.status(400).json({ error: 'Email already registered. Please sign in.' });
      }

      const finalName = String(name || rec.name || '').trim(); // get name
      if (!finalName || finalName.length < 2) { // validate name
        return res.status(400).json({ error: 'Name must be at least 2 characters' });
      }

      user = new User({ name: finalName, email: normalizedEmail }); // create user
      await user.save(); // save
    } else if (!user) {
      return res.status(404).json({ error: 'No account found. Please register first.' }); // not found
    }

    user.online = true; // mark online
    user.lastSeen = new Date(); // update last seen
    await user.save(); // save

    otpStore.delete(otpKey); // remove OTP
    const token = generateToken(user._id); // generate token

    res.json({
      message: mode === 'register' ? 'Registration successful' : 'Login successful', // message
      user: user.toJSON(), // user data
      token, // token
    });

  } catch (err) {
    console.error('Verify OTP error:', err.message || err); // log error
    if (err?.code === 11000) { // duplicate error
      return res.status(400).json({ error: 'Account already exists. Please sign in.' });
    }
    res.status(500).json({ error: 'Server error' }); // fallback
  }
});

// Register
router.post('/register', async (req, res) => { // register route
  try {
    const { name, email, password } = req.body; // inputs

    if (!name || !email || !password) { // validation
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email }); // check existing
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const user = new User({ name, email, password }); // create user
    await user.save(); // save

    const token = generateToken(user._id); // generate token

    res.status(201).json({
      message: 'User registered successfully',
      user: user.toJSON(),
      token,
    });

  } catch (err) {
    if (err.name === 'ValidationError') { // validation error
      const errors = Object.values(err.errors).map((e) => e.message); // extract errors
      return res.status(400).json({ error: errors.join(', ') });
    }
    res.status(500).json({ error: 'Server error' }); // fallback
  }
});

// Login
router.post('/login', async (req, res) => { // login route
  try {
    const { email, password } = req.body; // inputs

    if (!email || !password) { // validation
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email }); // find user
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password); // compare password
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    user.online = true; // mark online
    user.lastSeen = new Date(); // update last seen
    await user.save(); // save

    const token = generateToken(user._id); // generate token

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      token,
    });

  } catch (err) {
    res.status(500).json({ error: 'Server error' }); // fallback
  }
});

// Logout
router.post('/logout/:userId', async (req, res) => { // logout route
  try {
    const user = await User.findById(req.params.userId); // find user

    if (!user) {
      return res.status(404).json({ error: 'User not found' }); // not found
    }

    user.online = false; // mark offline
    user.lastSeen = new Date(); // update last seen
    await user.save(); // save

    res.json({ message: 'Logged out successfully' }); // response

  } catch (err) {
    res.status(500).json({ error: 'Server error' }); // fallback
  }
});

module.exports = router; // export router

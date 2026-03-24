const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const uploadsRoot = path.join(__dirname, '..', 'uploads');
const docsDir = path.join(uploadsRoot, 'documents');
const voicesDir = path.join(uploadsRoot, 'voice');
const avatarsDir = path.join(uploadsRoot, 'avatars');

[uploadsRoot, docsDir, voicesDir, avatarsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const kind = req.query.kind || 'documents';
    if (kind === 'voice') return cb(null, voicesDir);
    if (kind === 'avatar') return cb(null, avatarsDir);
    return cb(null, docsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const safeBase = (path.basename(file.originalname || 'file', ext) || 'file').replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const normalizedPath = req.file.path.replace(/\\/g, '/');
  const relativePath = normalizedPath.split('/uploads/')[1];
  if (!relativePath) {
    return res.status(500).json({ error: 'Failed to resolve uploaded file path' });
  }

  return res.status(201).json({
    fileUrl: `/uploads/${relativePath}`,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
  });
});

module.exports = router;

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import File from '../models/File.js';
import Room from '../models/Room.js';
import { requireAuth } from '../middleware/auth.js';
import { isValidObjectId } from '../lib/validation.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '..', 'uploads');

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
];

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, allowedMimeTypes.includes(file.mimetype)),
});

async function canUseRoom(user, roomId) {
  const room = await Room.findById(roomId);
  if (!room) return false;
  return user.role === 'admin'
    || room.hostId?.toString() === user.id
    || room.participants.some((entry) => entry.userId?.toString() === user.id && entry.status === 'admitted')
    || (user.role === 'oso' && user.orgId && room.orgId?.toString() === user.orgId);
}

router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { roomId } = req.body;
    if (!isValidObjectId(roomId)) return res.status(400).json({ error: 'A valid roomId is required' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded or file type not allowed.' });

    const allowed = await canUseRoom(req.user, roomId);
    if (!allowed) return res.status(403).json({ error: 'Not authorized' });

    const file = await File.create({
      roomId,
      uploaderId: req.user.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    res.status(201).json({ file });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid file id' });
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });

    const allowed = await canUseRoom(req.user, file.roomId);
    if (!allowed) return res.status(403).json({ error: 'Not authorized' });

    res.download(file.path, file.originalName);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid file id' });
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });

    const allowed = await canUseRoom(req.user, file.roomId);
    if (!allowed) return res.status(403).json({ error: 'Not authorized' });

    // Delete from filesystem
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    await File.findByIdAndDelete(req.params.id);
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

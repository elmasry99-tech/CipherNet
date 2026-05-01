import express from 'express';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /users/me/public-key  — save this user's RSA public key (used by steganography)
router.post('/me/public-key', requireAuth, async (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey) {
      return res.status(400).json({ error: 'publicKey is required' });
    }

    await User.findByIdAndUpdate(req.user.id, { publicKey });

    res.json({ message: 'Public key saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users/:id/public-key  — fetch another user's public key to encrypt a steg message for them
router.get('/:id/public-key', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('publicKey name');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.publicKey) {
      return res.status(404).json({ error: 'User has not registered a public key yet' });
    }

    res.json({ publicKey: user.publicKey, name: user.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /users/:id/status  — OSO approves/disables a user (oso or sysadmin only)
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    if (!['oso', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { status } = req.body;
    if (!['active', 'disabled', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await AuditLog.create({
      actorId: req.user.id,
      action:  `user.status.${status}`,
      target:  user._id.toString(),
    });

    res.json({ message: `User status updated to ${status}`, user: { id: user._id, status: user.status } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users  — list users (filtered by orgId for oso, all for sysadmin)
router.get('/', requireAuth, async (req, res) => {
  try {
    if (!['oso', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const filter = req.user.role === 'oso' ? { orgId: req.user.orgId } : {};
    const users = await User.find(filter).select('-passwordHash -publicKey');

    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

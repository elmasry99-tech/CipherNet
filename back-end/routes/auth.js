import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// POST /auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, orgId } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password, and role are required' });
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters, include one uppercase letter and one special character.',
      });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // admin, oso, and general are auto-active; internal and guest require approval
    const autoActive = ['admin', 'oso', 'general'];
    const status = autoActive.includes(role) ? 'active' : 'pending';

    const user = await User.create({ name, email, passwordHash, role, orgId: orgId || null, status });

    res.status(201).json({
      message: status === 'pending'
        ? 'Account created. Waiting for approval.'
        : 'Account created.',
      userId: user._id,
      status: user.status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Account pending approval' });
    }
    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'Account disabled' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, orgId: user.orgId },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        orgId: user.orgId,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { isNonEmptyString, isStrongPassword, isValidEmail, isValidObjectId } from '../lib/validation.js';

const router = express.Router();

// POST /auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, orgId, orgName } = req.body;

    if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password) || !isNonEmptyString(role)) {
      return res.status(400).json({ error: 'name, email, password, and role are required' });
    }

    const ALLOWED_SIGNUP_ROLES = ['oso', 'internal', 'guest', 'general'];
    if (!ALLOWED_SIGNUP_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Allowed values: oso, internal, guest, general' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters, include one uppercase letter and one special character.',
      });
    }

    // Resolve organization: accept orgId (legacy) or orgName (free-text, find-or-create)
    let resolvedOrgId = orgId || null;
    if (['oso', 'internal'].includes(role)) {
      if (isNonEmptyString(orgName)) {
        const trimmedName = orgName.trim();
        let org = await Organization.findOne({ name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
        if (!org) {
          org = await Organization.create({ name: trimmedName });
        }
        resolvedOrgId = org._id;
      } else if (!isValidObjectId(orgId)) {
        return res.status(400).json({ error: 'Organization name is required for oso and internal sign-up' });
      }
    }

    const normalizedEmail = email.trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Admin, general, and guest are immediately active; OSO and internal accounts require approval.
    const autoActive = ['admin', 'general', 'guest', 'oso'];
    const status = autoActive.includes(role) ? 'active' : 'pending';

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
      orgId: resolvedOrgId,
      status,
    });

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

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
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
      {
        id: user._id,
        role: user.role,
        orgId: user.orgId,
        name: user.name,
        email: user.email,
      },
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

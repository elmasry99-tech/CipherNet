import express from 'express';
import { randomBytes } from 'crypto';
import Room from '../models/Room.js';
import AuditLog from '../models/AuditLog.js';
import { requireAuth } from '../middleware/auth.js';
import { isNonEmptyString, isValidObjectId } from '../lib/validation.js';

const router = express.Router();

function userCanManageRoom(user, room) {
  return user.role === 'admin'
    || user.role === 'oso'
    || room.hostId?.toString() === user.id;
}

function roomFilterFor(user) {
  const baseFilter = { status: { $ne: 'archived' } };
  if (user.role === 'admin') return baseFilter;
  if (user.orgId) {
    return {
      ...baseFilter,
      $or: [
        { orgId: user.orgId },
        { hostId: user.id },
        { 'participants.userId': user.id },
      ],
    };
  }
  return {
    ...baseFilter,
    $or: [
      { hostId: user.id },
      { 'participants.userId': user.id },
    ],
  };
}

async function generateRoomCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `CN-${randomBytes(3).toString('hex').toUpperCase()}`;
    const exists = await Room.exists({ code });
    if (!exists) return code;
  }
  throw new Error('Unable to generate a unique room code');
}

function serializeRoom(room) {
  return {
    id: room._id,
    code: room.code,
    name: room.name,
    orgId: room.orgId,
    hostId: room.hostId,
    participants: room.participants,
    status: room.status,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const rooms = await Room.find(roomFilterFor(req.user)).sort({ updatedAt: -1 });
    res.json({ rooms: rooms.map(serializeRoom) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, orgId, code } = req.body;
    if (!isNonEmptyString(name)) return res.status(400).json({ error: 'name is required' });
    if (orgId && !isValidObjectId(orgId)) return res.status(400).json({ error: 'Invalid orgId' });
    if (code && !/^CN-[A-Z0-9]{4,20}$/.test(code.trim().toUpperCase())) {
      return res.status(400).json({ error: 'Room code must match CN-XXXX format' });
    }

    const room = await Room.create({
      code: code ? code.trim().toUpperCase() : await generateRoomCode(),
      name: name.trim(),
      orgId: orgId || req.user.orgId || null,
      hostId: req.user.id,
      participants: [{ userId: req.user.id, name: req.user.name || 'Host', role: 'host', status: 'admitted' }],
    });

    await AuditLog.create({
      actorId: req.user.id,
      action: 'room.create',
      target: room._id.toString(),
    });

    res.status(201).json({ room: serializeRoom(room) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Room code already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid room id' });
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const allowed = userCanManageRoom(req.user, room)
      || room.participants.some((participant) => participant.userId?.toString() === req.user.id);
    if (!allowed) return res.status(403).json({ error: 'Not authorized' });

    res.json({ room: serializeRoom(room) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid room id' });
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!userCanManageRoom(req.user, room)) return res.status(403).json({ error: 'Not authorized' });

    const { name, status } = req.body;
    if (name !== undefined) {
      if (!isNonEmptyString(name)) return res.status(400).json({ error: 'name must be a non-empty string' });
      room.name = name.trim();
    }
    if (status) {
      if (!['open', 'closed', 'archived'].includes(status)) {
        return res.status(400).json({ error: 'Invalid room status' });
      }
      room.status = status;
    }
    await room.save();

    res.json({ room: serializeRoom(room) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid room id' });
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!userCanManageRoom(req.user, room)) return res.status(403).json({ error: 'Not authorized' });

    await Room.findByIdAndDelete(req.params.id);
    await AuditLog.create({ actorId: req.user.id, action: 'room.delete', target: req.params.id });

    res.json({ message: 'Room deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/join', requireAuth, async (req, res) => {
    let { code } = req.body;
    if (!isNonEmptyString(code)) return res.status(400).json({ error: 'code is required' });
    
    code = code.trim().toUpperCase();
    if (!code.startsWith('CN-') && code.length >= 4) {
      code = `CN-${code}`;
    }

    if (!/^CN-[A-Z0-9]{4,20}$/.test(code)) {
      return res.status(400).json({ error: 'Room code must match CN-XXXX format' });
    }

    const room = await Room.findOne({ code, status: 'open' });
    if (!room) return res.status(404).json({ error: 'Open room not found or inactive' });

    const existing = room.participants.find((participant) => participant.userId?.toString() === req.user.id);
    if (existing) {
      existing.status = existing.status === 'denied' ? 'waiting' : existing.status;
    } else {
      room.participants.push({
        userId: req.user.id,
        name: req.user.name || req.user.email || 'Participant',
        role: req.user.role === 'guest' ? 'guest' : 'participant',
        status: req.user.role === 'guest' ? 'waiting' : 'admitted',
      });
    }
    await room.save();

    res.json({ room: serializeRoom(room) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/admit', requireAuth, async (req, res) => {
  try {
    const { userId, status = 'admitted' } = req.body;
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid room id' });
    if (!isValidObjectId(userId)) return res.status(400).json({ error: 'userId is required' });
    if (!['admitted', 'denied'].includes(status)) return res.status(400).json({ error: 'Invalid admission status' });

    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!userCanManageRoom(req.user, room)) return res.status(403).json({ error: 'Not authorized' });

    const participant = room.participants.find((entry) => entry.userId?.toString() === userId);
    if (!participant) return res.status(404).json({ error: 'Participant not found' });

    participant.status = status;
    await room.save();
    await AuditLog.create({
      actorId: req.user.id,
      action: `room.participant.${status}`,
      target: room._id.toString(),
      meta: { userId },
    });

    res.json({ room: serializeRoom(room) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/participants/:userId', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid room id' });
    if (!isValidObjectId(req.params.userId)) return res.status(400).json({ error: 'Invalid userId' });

    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!userCanManageRoom(req.user, room)) return res.status(403).json({ error: 'Not authorized' });

    const participantIndex = room.participants.findIndex(
      (entry) => entry.userId?.toString() === req.params.userId,
    );
    if (participantIndex === -1) return res.status(404).json({ error: 'Participant not found' });

    // Prevent host from removing themselves
    if (room.participants[participantIndex].role === 'host') {
      return res.status(400).json({ error: 'Cannot remove the room host' });
    }

    room.participants.splice(participantIndex, 1);
    await room.save();
    await AuditLog.create({
      actorId: req.user.id,
      action: 'room.participant.removed',
      target: room._id.toString(),
      meta: { userId: req.params.userId },
    });

    res.json({ room: serializeRoom(room) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

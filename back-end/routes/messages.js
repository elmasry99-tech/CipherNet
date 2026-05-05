import express from 'express';
import Message from '../models/Message.js';
import Room from '../models/Room.js';
import { requireAuth } from '../middleware/auth.js';
import { isNonEmptyString, isValidObjectId, parsePositiveInteger } from '../lib/validation.js';

const router = express.Router();

async function canAccessRoom(user, roomId) {
  const room = await Room.findById(roomId);
  if (!room) return { allowed: false, room: null, status: 404 };
  const participant = room.participants.find((entry) => entry.userId?.toString() === user.id);
  console.log('[canAccessRoom]', {
    userId: user.id,
    userIdType: typeof user.id,
    hostId: room.hostId?.toString(),
    hostMatch: room.hostId?.toString() === user.id,
    participantFound: !!participant,
    participantStatus: participant?.status,
    role: user.role,
  });
  const allowed = user.role === 'admin'
    || room.hostId?.toString() === user.id
    || participant?.status === 'admitted'
    || (user.role === 'oso' && user.orgId && room.orgId?.toString() === user.orgId);
  return { allowed, room, status: allowed ? 200 : 403 };
}

router.get('/:roomId', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.roomId)) {
      return res.status(400).json({ error: 'Invalid room id' });
    }

    const { allowed, status } = await canAccessRoom(req.user, req.params.roomId);
    if (!allowed) return res.status(status).json({ error: status === 404 ? 'Room not found' : 'Not authorized' });

    const parsedLimit = parsePositiveInteger(req.query.limit, 50);
    const limit = Math.min(parsedLimit, 100);
    const messages = await Message.find({ roomId: req.params.roomId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderId', 'name email role');

    res.json({ messages: messages.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { roomId, content, type = 'text' } = req.body;
    if (!isValidObjectId(roomId)) return res.status(400).json({ error: 'A valid roomId is required' });
    if (!isNonEmptyString(content)) return res.status(400).json({ error: 'content is required' });
    if (!['text', 'steg', 'system', 'file'].includes(type)) return res.status(400).json({ error: 'Invalid message type' });

    const { allowed, status } = await canAccessRoom(req.user, roomId);
    if (!allowed) return res.status(status).json({ error: status === 404 ? 'Room not found' : 'Not authorized' });

    const message = await Message.create({ roomId, senderId: req.user.id, content, type });
    const populated = await message.populate('senderId', 'name email role');
    res.status(201).json({ message: populated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/room/:roomId', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.roomId)) return res.status(400).json({ error: 'Invalid room id' });
    const { allowed, status } = await canAccessRoom(req.user, req.params.roomId);
    if (!allowed) return res.status(status).json({ error: 'Not authorized' });

    // Only host/admin/oso can clear entire chat
    const room = await Room.findById(req.params.roomId);
    const canManage = req.user.role === 'admin' || req.user.role === 'oso' || room.hostId?.toString() === req.user.id;
    if (!canManage) return res.status(403).json({ error: 'Only hosts and security officers can clear chat history' });

    await Message.deleteMany({ roomId: req.params.roomId });
    res.json({ message: 'Chat history cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid message id' });
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const { allowed } = await canAccessRoom(req.user, message.roomId);
    if (!allowed) return res.status(403).json({ error: 'Not authorized' });

    // Can delete if sender OR if can manage room
    const room = await Room.findById(message.roomId);
    const canManage = req.user.role === 'admin' || req.user.role === 'oso' || room.hostId?.toString() === req.user.id;
    const isSender = message.senderId?.toString() === req.user.id;

    if (!canManage && !isSender) return res.status(403).json({ error: 'Not authorized to delete this message' });

    await Message.findByIdAndDelete(req.params.id);
    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

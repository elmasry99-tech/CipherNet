import jwt from 'jsonwebtoken';
import socketClusterServer from 'socketcluster-server';
import Message from './models/Message.js';
import Room from './models/Room.js';

function verifySocketUser(socket) {
  let token = null;
  if (socket.request && socket.request.url) {
    const url = new URL(socket.request.url, 'http://localhost');
    token = url.searchParams.get('token');
  }
  if (!token) return null;

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

async function canSendToRoom(user, roomId) {
  if (!user) return false;
  const room = await Room.findById(roomId);
  if (!room) return false;
  return user.role === 'admin'
    || room.hostId?.toString() === user.id
    || room.participants.some((entry) => entry.userId?.toString() === user.id && entry.status === 'admitted')
    || (user.role === 'oso' && user.orgId && room.orgId?.toString() === user.orgId);
}

function sendAck(request, payload) {
  if (request?.end) request.end(payload);
}

function sendError(request, message) {
  if (!request?.error) return;
  const error = new Error(message);
  error.name = 'RealtimeError';
  request.error(error);
}

let _agServer = null;

export function getAgServer() {
  return _agServer;
}

export function initRealtime(httpServer) {
  const agServer = socketClusterServer.attach(httpServer, {
    path: '/socketcluster/',
  });
  _agServer = agServer;

  agServer.setMiddleware(agServer.MIDDLEWARE_INBOUND, async (middlewareStream) => {
    for await (const action of middlewareStream) {
      if (action.type === 'subscribe' && action.channel?.startsWith('room-')) {
        const roomId = action.channel.slice('room-'.length);
        const user = action.socket.user || verifySocketUser(action.socket);
        action.socket.user = user;

        if (!await canSendToRoom(user, roomId)) {
          const error = new Error('Not authorized to subscribe to this room');
          error.name = 'UnauthorizedSubscribeError';
          action.block(error);
          continue;
        }
      }

      action.allow();
    }
  });

  (async () => {
    for await (const { socket } of agServer.listener('connection')) {
      const user = verifySocketUser(socket);
      socket.user = user;

      // Message: Send
      (async () => {
        for await (const request of socket.procedure('message:send')) {
          try {
            const { roomId, content, type = 'text' } = request.data || {};
            if (!roomId || !content) {
              sendError(request, 'roomId and content are required');
              continue;
            }
            if (!await canSendToRoom(user, roomId)) {
              sendError(request, 'Not authorized');
              continue;
            }

            const message = await Message.create({ roomId, senderId: user.id, content, type });
            const populated = await message.populate('senderId', 'name email role');

            const payload = {
              id: populated._id.toString(),
              roomId,
              senderId: populated.senderId._id.toString(),
              senderName: populated.senderId.name,
              content: populated.content,
              type: populated.type,
              createdAt: populated.createdAt.toISOString(),
            };

            agServer.exchange.transmitPublish(`room-${roomId}`, payload);
            sendAck(request, payload);
          } catch (err) {
            sendError(request, err.message);
          }
        }
      })();

      // Message: Delete
      (async () => {
        for await (const request of socket.procedure('message:delete')) {
          try {
            const { messageId } = request.data || {};
            if (!messageId) {
              sendError(request, 'messageId is required');
              continue;
            }
            const message = await Message.findById(messageId);
            if (!message) {
              sendError(request, 'Message not found');
              continue;
            }

            const room = await Room.findById(message.roomId);
            const canManage = user.role === 'admin' || user.role === 'oso' || room.hostId?.toString() === user.id;
            const isSender = message.senderId?.toString() === user.id;

            if (!canManage && !isSender) {
              sendError(request, 'Not authorized');
              continue;
            }

            await Message.findByIdAndDelete(messageId);
            agServer.exchange.transmitPublish(`room-${message.roomId}`, {
              event: 'message:delete',
              messageId,
            });
            sendAck(request, { messageId });
          } catch (err) {
            sendError(request, err.message);
          }
        }
      })();

      // Message: Clear
      (async () => {
        for await (const request of socket.procedure('message:clear')) {
          try {
            const { roomId } = request.data || {};
            if (!roomId) {
              sendError(request, 'roomId is required');
              continue;
            }
            const room = await Room.findById(roomId);
            if (!room) {
              sendError(request, 'Room not found');
              continue;
            }

            const canManage = user.role === 'admin' || user.role === 'oso' || room.hostId?.toString() === user.id;
            if (!canManage) {
              sendError(request, 'Not authorized');
              continue;
            }

            await Message.deleteMany({ roomId });
            agServer.exchange.transmitPublish(`room-${roomId}`, {
              event: 'message:clear',
              roomId,
            });
            sendAck(request, { roomId });
          } catch (err) {
            sendError(request, err.message);
          }
        }
      })();

      // User: Typing
      (async () => {
        for await (const data of socket.receiver('user:typing')) {
          const { roomId, isTyping = true } = data || {};
          if (!roomId || !await canSendToRoom(user, roomId)) continue;
          agServer.exchange.transmitPublish(`room-${roomId}`, {
            event: 'user:typing',
            roomId,
            userId: user.id,
            isTyping,
          });
        }
      })();

      // Presence
      (async () => {
        for await (const data of socket.receiver('presence')) {
          const { roomId, state = 'online' } = data || {};
          if (!roomId || !await canSendToRoom(user, roomId)) continue;
          agServer.exchange.transmitPublish(`room-${roomId}`, {
            event: 'presence',
            roomId,
            userId: user.id,
            state,
          });
        }
      })();
    }
  })();

  return agServer;
}

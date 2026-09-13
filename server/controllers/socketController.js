import { roomManager } from '../services/roomManager.js';
import { MemoryRateLimiter } from '../services/rateLimiter.js';
import { CONFIG } from '../config/constants.js';

const wsRateLimiter = new MemoryRateLimiter(
  CONFIG.WS_RATE_LIMIT_WINDOW_MS,
  CONFIG.WS_MAX_MESSAGES_PER_WINDOW
);

export function handleSocketConnection(ws, req) {
  ws.session = null;
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

  ws.on('message', (raw) => {
    try {
      // 1. Anti-abuse WebSocket rate limit check
      if (wsRateLimiter.isRateLimited(clientIp)) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          message: 'Rate limit exceeded: You are sending requests too quickly. Please slow down.'
        }));
        return;
      }

      const data = JSON.parse(raw);
      const { type, roomId } = data;

      // 2. Owner Join / Rejoin
      if (type === 'JOIN_OWNER') {
        const room = roomManager.getRoom(roomId);
        if (!room || room.ownerToken !== data.ownerToken) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid owner authorization or room destroyed.' }));
          return ws.close();
        }

        const result = roomManager.addOrRejoinOwner(
          roomId,
          ws,
          data.ownerToken,
          data.userId,
          data.username
        );

        ws.session = { roomId, participantId: result.participantId, isOwner: true };

        ws.send(JSON.stringify({
          type: 'JOIN_SUCCESS',
          participantId: result.participantId,
          username: data.username,
          messages: result.messages,
          isOwner: true
        }));
      }

      // 3. Guest knocking
      if (type === 'REQUEST_JOIN') {
        if (!roomManager.hasRoom(roomId)) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Room does not exist or was closed.' }));
          return ws.close();
        }

        const res = roomManager.requestJoin(roomId, ws, data.userId, data.username);
        if (res.status === 'BLOCKED') {
          ws.send(JSON.stringify({ type: 'REQUEST_BLOCKED', message: res.message }));
        } else if (res.status === 'WAITING') {
          ws.session = { roomId, isPending: true, requestId: res.requestId };
          ws.send(JSON.stringify({ type: 'WAITING_FOR_APPROVAL' }));
        }
      }

      // 4. Owner approval/denial
      if (type === 'DECIDE_JOIN') {
        const ok = roomManager.handleDecision(roomId, data.ownerToken, data.requestId, data.approved);
        if (!ok) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Could not resolve join request.' }));
        }
      }

      // 5. Send message with byte & FIFO checks
      if (type === 'SEND_MESSAGE') {
        const session = ws.session;
        if (!session || !session.participantId || !session.roomId) return;

        const room = roomManager.getRoom(session.roomId);
        if (!room) return;

        const participant = room.participants.get(session.participantId);
        if (!participant) return;

        const { message, error } = roomManager.addMessage(session.roomId, participant.username, data.content);

        if (error) {
          ws.send(JSON.stringify({ type: 'ERROR', message: error }));
          return;
        }

        roomManager.broadcast(session.roomId, { type: 'NEW_MESSAGE', message });
      }

      // 6. Explicit owner room destruction
      if (type === 'DESTROY_ROOM') {
        const room = roomManager.getRoom(roomId);
        if (!room || room.ownerToken !== data.ownerToken) return;
        roomManager.destroyRoom(roomId, 'Owner permanently destroyed the room.');
      }
    } catch (err) {
      console.error('Socket frame error:', err);
    }
  });

  ws.on('close', () => {
    if (!ws.session) return;
    const { roomId, participantId } = ws.session;
    if (participantId) {
      const { roomDestroyed, username, remainingCount } = roomManager.removeParticipant(roomId, participantId);
      if (!roomDestroyed && username) {
        roomManager.broadcast(roomId, {
          type: 'USER_LEFT',
          username,
          participantCount: remainingCount
        });
      }
    }
  });
}
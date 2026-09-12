import crypto from 'crypto';
import { WebSocket } from 'ws';
import { CONFIG, generateAnonymousHandle } from '../config/constants.js';

const MAX_JOIN_ATTEMPTS = 3;

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.initReaper();
  }

  createRoom(ownerUserId, ownerUsername) {
    const roomId = crypto.randomBytes(CONFIG.ROOM_ID_BYTES).toString('hex');
    const ownerToken = crypto.randomBytes(CONFIG.OWNER_TOKEN_BYTES).toString('hex');

    const room = {
      id: roomId,
      ownerToken,
      ownerUserId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      participants: new Map(),        // participantId -> { socket, userId, username, joinedAt, isOwner }
      pendingRequests: new Map(),     // requestId -> { socket, userId, username }
      requestAttempts: new Map(),     // userId -> count
      messages: []
    };

    this.rooms.set(roomId, room);
    return { roomId, ownerToken };
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  hasRoom(roomId) {
    return this.rooms.has(roomId);
  }

  // Request access to enter room
  requestJoin(roomId, socket, userId, username) {
    const room = this.rooms.get(roomId);
    if (!room) return { status: 'ERROR', message: 'Room not found.' };

    const attempts = room.requestAttempts.get(userId) || 0;
    if (attempts >= MAX_JOIN_ATTEMPTS) {
      return { status: 'BLOCKED', message: 'Maximum join requests exceeded for this room.' };
    }

    // Increment attempts
    room.requestAttempts.set(userId, attempts + 1);

    const requestId = crypto.randomBytes(8).toString('hex');
    room.pendingRequests.set(requestId, { socket, userId, username });

    // Notify the room owner
    this.notifyOwner(roomId, {
      type: 'JOIN_REQUEST',
      requestId,
      userId,
      username,
      attemptsLeft: MAX_JOIN_ATTEMPTS - (attempts + 1)
    });

    return { status: 'WAITING', requestId };
  }

  // Owner directly joins without knocking
  addOwnerParticipant(roomId, socket, userId, username) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const participantId = crypto.randomBytes(8).toString('hex');
    room.participants.set(participantId, {
      socket,
      userId,
      username,
      joinedAt: Date.now(),
      isOwner: true
    });
    room.lastActivity = Date.now();
    return { participantId, messages: room.messages };
  }

  // Owner decision
  handleDecision(roomId, ownerToken, requestId, approved) {
    const room = this.rooms.get(roomId);
    if (!room || room.ownerToken !== ownerToken) return false;

    const request = room.pendingRequests.get(requestId);
    if (!request) return false;

    room.pendingRequests.delete(requestId);

    if (approved) {
      const participantId = crypto.randomBytes(8).toString('hex');

      // Link the participantId directly to the guest's active socket session
      if (request.socket.session) {
        request.socket.session.participantId = participantId;
        request.socket.session.isPending = false;
      }

      room.participants.set(participantId, {
        socket: request.socket,
        userId: request.userId,
        username: request.username,
        joinedAt: Date.now(),
        isOwner: false
      });
      room.lastActivity = Date.now();

      if (request.socket.readyState === WebSocket.OPEN) {
        request.socket.send(JSON.stringify({
          type: 'JOIN_APPROVED',
          participantId,
          username: request.username,
          messages: room.messages
        }));
      }

      this.broadcast(roomId, {
        type: 'USER_JOINED',
        username: request.username,
        participantCount: room.participants.size
      });
    } else {
      if (request.socket.readyState === WebSocket.OPEN) {
        const attemptsUsed = room.requestAttempts.get(request.userId) || 0;
        request.socket.send(JSON.stringify({
          type: 'JOIN_DENIED',
          attemptsLeft: Math.max(0, MAX_JOIN_ATTEMPTS - attemptsUsed)
        }));
      }
    }

    return true;
  }

  removeParticipant(roomId, participantId) {
    const room = this.rooms.get(roomId);
    if (!room) return { roomDestroyed: false, username: null };

    const participant = room.participants.get(participantId);
    if (!participant) return { roomDestroyed: false, username: null };

    const isOwner = participant.isOwner;
    const username = participant.username;
    room.participants.delete(participantId);

    // Requirement 1: Room gets destroyed as the owner leaves
    if (isOwner) {
      this.destroyRoom(roomId, 'Room owner left the chat. Room closed.');
      return { roomDestroyed: true, username, wasOwner: true };
    }

    if (room.participants.size === 0) {
      this.destroyRoom(roomId, 'All participants left.');
      return { roomDestroyed: true, username, wasOwner: false };
    }

    return { roomDestroyed: false, username, wasOwner: false, remainingCount: room.participants.size };
  }

  notifyOwner(roomId, payload) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const [, p] of room.participants) {
      if (p.isOwner && p.socket.readyState === WebSocket.OPEN) {
        p.socket.send(JSON.stringify(payload));
      }
    }
  }

  addMessage(roomId, sender, content) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const sanitized = String(content || '').slice(0, CONFIG.MAX_MESSAGE_LENGTH).trim();
    if (!sanitized) return null;

    const message = {
      id: crypto.randomUUID(),
      sender,
      content: sanitized,
      timestamp: Date.now()
    };

    room.messages.push(message);
    room.lastActivity = Date.now();
    return message;
  }

  broadcast(roomId, payload) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const messageBuffer = JSON.stringify(payload);
    for (const [, participant] of room.participants) {
      if (participant.socket.readyState === WebSocket.OPEN) {
        participant.socket.send(messageBuffer);
      }
    }
  }

  destroyRoom(roomId, reason = 'Room permanently closed') {
    const room = this.rooms.get(roomId);
    if (!room) return;

    this.broadcast(roomId, { type: 'ROOM_DESTROYED', reason });

    // Notify any users still waiting in the knock queue
    for (const [, req] of room.pendingRequests) {
      if (req.socket.readyState === WebSocket.OPEN) {
        req.socket.send(JSON.stringify({ type: 'ROOM_DESTROYED', reason }));
        req.socket.terminate();
      }
    }

    for (const [, participant] of room.participants) {
      participant.socket.terminate();
    }

    room.participants.clear();
    room.pendingRequests.clear();
    room.requestAttempts.clear();
    room.messages = [];
    this.rooms.delete(roomId);
  }

  initReaper() {
    setInterval(() => {
      const now = Date.now();
      for (const [id, room] of this.rooms.entries()) {
        if (now - room.lastActivity > CONFIG.ROOM_TTL_MS) {
          this.destroyRoom(id, 'Room closed due to inactivity');
        }
      }
    }, CONFIG.REAPER_INTERVAL_MS);
  }
}

export const roomManager = new RoomManager();
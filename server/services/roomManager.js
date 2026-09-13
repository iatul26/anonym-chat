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
      ownerUsername,
      isOwnerPresent: false,
      destructionTimer: null,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      currentSizeBytes: 0,
      participants: new Map(),
      pendingRequests: new Map(),
      requestAttempts: new Map(),
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

  // Owner joins or rejoins during grace period
  addOrRejoinOwner(roomId, socket, ownerToken, userId, username) {
    const room = this.rooms.get(roomId);
    if (!room || room.ownerToken !== ownerToken) return null;

    // Cancel destruction timer if owner rejoined in time
    if (room.destructionTimer) {
      clearTimeout(room.destructionTimer);
      room.destructionTimer = null;
    }

    room.isOwnerPresent = true;
    room.lastActivity = Date.now();

    const participantId = crypto.randomBytes(8).toString('hex');
    room.participants.set(participantId, {
      socket,
      userId,
      username,
      joinedAt: Date.now(),
      isOwner: true
    });

    // Notify participants that the owner returned
    this.broadcast(roomId, {
      type: 'OWNER_STATUS_CHANGED',
      isOwnerPresent: true,
      message: 'The room owner has returned. Room timer cancelled.'
    });

    return { participantId, messages: room.messages, isOwner: true };
  }

  requestJoin(roomId, socket, userId, username) {
    const room = this.rooms.get(roomId);
    if (!room) return { status: 'ERROR', message: 'Room not found.' };

    const attempts = room.requestAttempts.get(userId) || 0;
    if (attempts >= MAX_JOIN_ATTEMPTS) {
      return { status: 'BLOCKED', message: 'Maximum join requests exceeded for this room.' };
    }

    room.requestAttempts.set(userId, attempts + 1);
    const requestId = crypto.randomBytes(8).toString('hex');
    room.pendingRequests.set(requestId, { socket, userId, username });

    this.notifyOwner(roomId, {
      type: 'JOIN_REQUEST',
      requestId,
      userId,
      username,
      attemptsLeft: MAX_JOIN_ATTEMPTS - (attempts + 1)
    });

    return { status: 'WAITING', requestId };
  }

  handleDecision(roomId, ownerToken, requestId, approved) {
    const room = this.rooms.get(roomId);
    if (!room || room.ownerToken !== ownerToken) return false;

    const request = room.pendingRequests.get(requestId);
    if (!request) return false;

    room.pendingRequests.delete(requestId);

    if (approved) {
      const participantId = crypto.randomBytes(8).toString('hex');
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

  addMessage(roomId, sender, content) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found.' };

    const rawString = String(content || '').trim();
    const byteSize = Buffer.byteLength(rawString, 'utf8');

    if (byteSize === 0) return { error: 'Message cannot be empty.' };
    if (byteSize > CONFIG.MAX_MESSAGE_BYTES) {
      return { error: `Message exceeds size limit of ${CONFIG.MAX_MESSAGE_BYTES} bytes.` };
    }

    const message = {
      id: crypto.randomUUID(),
      sender,
      content: rawString,
      timestamp: Date.now(),
      byteSize
    };

    // FIFO Automatic Message Purge
    while (room.messages.length > 0 && room.currentSizeBytes + byteSize > CONFIG.MAX_ROOM_BYTES) {
      const oldest = room.messages.shift();
      room.currentSizeBytes -= (oldest.byteSize || 0);
    }

    room.messages.push(message);
    room.currentSizeBytes += byteSize;
    room.lastActivity = Date.now();

    return { message };
  }

  removeParticipant(roomId, participantId) {
    const room = this.rooms.get(roomId);
    if (!room) return { roomDestroyed: false, username: null };

    const participant = room.participants.get(participantId);
    if (!participant) return { roomDestroyed: false, username: null };

    const { isOwner, username } = participant;
    room.participants.delete(participantId);

    // Feature 1: Owner leaves -> Grace period timer starts
    if (isOwner) {
      room.isOwnerPresent = false;

      // Start 1-minute grace period timer
      room.destructionTimer = setTimeout(() => {
        this.destroyRoom(roomId, 'Owner did not return within 1 minute. Room destroyed.');
      }, CONFIG.OWNER_GRACE_PERIOD_MS);

      this.broadcast(roomId, {
        type: 'OWNER_STATUS_CHANGED',
        isOwnerPresent: false,
        gracePeriodMs: CONFIG.OWNER_GRACE_PERIOD_MS,
        message: 'Owner disconnected. Room will self-destruct in 1 minute unless the owner returns.'
      });

      return { roomDestroyed: false, username, wasOwner: true, remainingCount: room.participants.size };
    }

    // If non-owner leaves and room is empty and owner is also gone, clean up
    if (room.participants.size === 0 && !room.isOwnerPresent) {
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

    if (room.destructionTimer) {
      clearTimeout(room.destructionTimer);
      room.destructionTimer = null;
    }

    this.broadcast(roomId, { type: 'ROOM_DESTROYED', reason });

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
    room.currentSizeBytes = 0;
    this.rooms.delete(roomId);
  }

  initReaper() {
    setInterval(() => {
      const now = Date.now();
      for (const [id, room] of this.rooms.entries()) {
        if (now - room.lastActivity > CONFIG.ROOM_TTL_MS) {
          this.destroyRoom(id, 'Room closed due to total inactivity');
        }
      }
    }, CONFIG.REAPER_INTERVAL_MS);
  }
}

export const roomManager = new RoomManager();
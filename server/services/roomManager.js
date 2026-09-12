import crypto from 'crypto';
import { WebSocket } from 'ws';
import { CONFIG, generateAnonymousHandle } from '../config/constants.js';

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.initReaper();
  }

  createRoom() {
    const roomId = crypto.randomBytes(CONFIG.ROOM_ID_BYTES).toString('hex');
    const ownerToken = crypto.randomBytes(CONFIG.OWNER_TOKEN_BYTES).toString('hex');

    const room = {
      id: roomId,
      ownerToken,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      participants: new Map(), // participantId -> { socket, username, joinedAt }
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

  addParticipant(roomId, socket) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const participantId = crypto.randomBytes(8).toString('hex');
    const username = generateAnonymousHandle();

    room.participants.set(participantId, { socket, username, joinedAt: Date.now() });
    room.lastActivity = Date.now();

    return { participantId, username, messages: room.messages };
  }

  removeParticipant(roomId, participantId) {
    const room = this.rooms.get(roomId);
    if (!room) return { roomDestroyed: false, username: null };

    const participant = room.participants.get(participantId);
    const username = participant ? participant.username : null;

    room.participants.delete(participantId);

    if (room.participants.size === 0) {
      this.destroyRoom(roomId, 'Last participant left');
      return { roomDestroyed: true, username };
    }

    return { roomDestroyed: false, username, remainingCount: room.participants.size };
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

    for (const [, participant] of room.participants) {
      participant.socket.terminate();
    }

    room.participants.clear();
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
import { roomManager } from '../services/roomManager.js';

export function handleSocketConnection(ws) {
  let session = null;

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);
      const { type, roomId } = data;

      if (type === 'JOIN') {
        if (!roomManager.hasRoom(roomId)) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Room does not exist or was closed' }));
          return ws.close();
        }

        const joinResult = roomManager.addParticipant(roomId, ws);
        session = { roomId, participantId: joinResult.participantId, username: joinResult.username };

        ws.send(JSON.stringify({
          type: 'JOIN_SUCCESS',
          participantId: joinResult.participantId,
          username: joinResult.username,
          messages: joinResult.messages
        }));

        roomManager.broadcast(roomId, {
          type: 'USER_JOINED',
          username: joinResult.username,
          participantCount: roomManager.getRoom(roomId).participants.size
        });
      }

      if (type === 'SEND_MESSAGE') {
        if (!session) return;
        const msg = roomManager.addMessage(session.roomId, session.username, data.content);
        if (msg) {
          roomManager.broadcast(session.roomId, { type: 'NEW_MESSAGE', message: msg });
        }
      }

      if (type === 'DESTROY_ROOM') {
        const room = roomManager.getRoom(roomId);
        if (!room || room.ownerToken !== data.ownerToken) {
          return ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized action.' }));
        }
        roomManager.destroyRoom(roomId, 'Destroyed by owner');
      }
    } catch (err) {
      console.error('WebSocket parsing error:', err);
    }
  });

  ws.on('close', () => {
    if (!session) return;
    const { roomId, participantId } = session;
    const { roomDestroyed, username, remainingCount } = roomManager.removeParticipant(roomId, participantId);

    if (!roomDestroyed && username) {
      roomManager.broadcast(roomId, {
        type: 'USER_LEFT',
        username,
        participantCount: remainingCount
      });
    }
  });
}
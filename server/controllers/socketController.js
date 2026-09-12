import { roomManager } from '../services/roomManager.js';

export function handleSocketConnection(ws) {
  // Attach session directly to ws instance
  ws.session = null;

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);
      const { type, roomId } = data;

      // 1. Owner joining their own newly created room
      if (type === 'JOIN_OWNER') {
        const room = roomManager.getRoom(roomId);
        if (!room || room.ownerToken !== data.ownerToken) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid owner authorization.' }));
          return ws.close();
        }

        const result = roomManager.addOwnerParticipant(roomId, ws, data.userId, data.username);
        ws.session = { roomId, participantId: result.participantId, isOwner: true };

        ws.send(JSON.stringify({
          type: 'JOIN_SUCCESS',
          participantId: result.participantId,
          username: data.username,
          messages: result.messages,
          isOwner: true
        }));
      }

      // 2. Guest knocking on the door
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

      // 3. Owner approving or denying the knock request
      if (type === 'DECIDE_JOIN') {
        const ok = roomManager.handleDecision(roomId, data.ownerToken, data.requestId, data.approved);
        if (!ok) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Could not resolve join request.' }));
        }
      }

      // 4. Regular messaging
      if (type === 'SEND_MESSAGE') {
        if (!ws.session || !ws.session.participantId) return;
        const room = roomManager.getRoom(roomId);
        const participant = room?.participants.get(ws.session.participantId);
        if (participant) {
          const msg = roomManager.addMessage(ws.session.roomId, participant.username, data.content);
          if (msg) roomManager.broadcast(ws.session.roomId, { type: 'NEW_MESSAGE', message: msg });
        }
      }

      // 5. Owner explicit destroy
      if (type === 'DESTROY_ROOM') {
        const room = roomManager.getRoom(roomId);
        if (!room || room.ownerToken !== data.ownerToken) return;
        roomManager.destroyRoom(roomId, 'Owner closed the room.');
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
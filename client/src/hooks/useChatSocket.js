import { useState, useRef, useEffect, useCallback } from 'react';

export function useChatSocket(roomId, ownerToken, onTerminated) {
  const [messages, setMessages] = useState([]);
  const [username, setUsername] = useState('');
  const [participantCount, setParticipantCount] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'JOIN', roomId }));
    };

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);

      switch (payload.type) {
        case 'JOIN_SUCCESS':
          setUsername(payload.username);
          setMessages(payload.messages || []);
          setIsConnected(true);
          break;
        case 'NEW_MESSAGE':
          setMessages((prev) => [...prev, payload.message]);
          break;
        case 'USER_JOINED':
        case 'USER_LEFT':
          setParticipantCount(payload.participantCount);
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              system: true,
              content: `${payload.username} ${payload.type === 'USER_JOINED' ? 'joined' : 'left'} the room.`
            }
          ]);
          break;
        case 'ROOM_DESTROYED':
          onTerminated(payload.reason);
          break;
        default:
          break;
      }
    };

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [roomId, onTerminated]);

  const sendMessage = useCallback((content) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'SEND_MESSAGE', content }));
    }
  }, []);

  const destroyRoom = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN && ownerToken) {
      socketRef.current.send(JSON.stringify({ type: 'DESTROY_ROOM', roomId, ownerToken }));
    }
  }, [roomId, ownerToken]);

  return { messages, username, participantCount, isConnected, sendMessage, destroyRoom };
}
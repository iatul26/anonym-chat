import { useState, useRef, useEffect, useCallback } from 'react';

export function useChatSocket(roomId, ownerToken, userInfo, onTerminated) {
  const [messages, setMessages] = useState([]);
  const [participantCount, setParticipantCount] = useState(1);
  const [status, setStatus] = useState('IDLE'); // IDLE | WAITING | JOINED | BLOCKED | DENIED
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [joinRequests, setJoinRequests] = useState([]);

  const socketRef = useRef(null);
  const roomIdRef = useRef(roomId);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !userInfo) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      if (ownerToken) {
        socket.send(
          JSON.stringify({
            type: 'JOIN_OWNER',
            roomId,
            ownerToken,
            userId: userInfo.userId,
            username: userInfo.username
          })
        );
      } else {
        setStatus('WAITING');
        socket.send(
          JSON.stringify({
            type: 'REQUEST_JOIN',
            roomId,
            userId: userInfo.userId,
            username: userInfo.username
          })
        );
      }
    };

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);

      switch (payload.type) {
        case 'JOIN_SUCCESS':
        case 'JOIN_APPROVED':
          setStatus('JOINED');
          setMessages(payload.messages || []);
          break;

        case 'JOIN_DENIED':
          setStatus('DENIED');
          setAttemptsLeft(payload.attemptsLeft);
          break;

        case 'REQUEST_BLOCKED':
          setStatus('BLOCKED');
          break;

        case 'JOIN_REQUEST':
          setJoinRequests((prev) => [...prev, payload]);
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
          setStatus('IDLE');
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
  }, [roomId, ownerToken, userInfo, onTerminated]);

  const decideRequest = useCallback(
    (requestId, approved) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'DECIDE_JOIN',
            roomId: roomIdRef.current,
            ownerToken,
            requestId,
            approved
          })
        );
        setJoinRequests((prev) => prev.filter((r) => r.requestId !== requestId));
      }
    },
    [ownerToken]
  );

  const sendMessage = useCallback((content) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'SEND_MESSAGE',
          roomId: roomIdRef.current,
          content
        })
      );
    }
  }, []);

  const destroyRoom = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN && ownerToken) {
      socketRef.current.send(
        JSON.stringify({
          type: 'DESTROY_ROOM',
          roomId: roomIdRef.current,
          ownerToken
        })
      );
    }
  }, [ownerToken]);

  return {
    messages,
    participantCount,
    status,
    attemptsLeft,
    joinRequests,
    decideRequest,
    sendMessage,
    destroyRoom
  };
}
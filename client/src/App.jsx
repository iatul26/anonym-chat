import React, { useState, useCallback } from 'react';
import Lobby from './components/Lobby';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import { useChatSocket } from './hooks/useChatSocket';

export default function App() {
  const [activeRoomId, setActiveRoomId] = useState('');
  const [ownerToken, setOwnerToken] = useState(null);
  const [error, setError] = useState('');

  const handleTerminated = useCallback((reason) => {
    alert(reason || 'Room destroyed.');
    setActiveRoomId('');
    setOwnerToken(null);
  }, []);

  const { messages, username, participantCount, sendMessage, destroyRoom } = useChatSocket(
    activeRoomId,
    ownerToken,
    handleTerminated
  );

  const createRoom = async () => {
    try {
      const res = await fetch('/api/rooms', { method: 'POST' });
      const data = await res.json();
      setOwnerToken(data.ownerToken);
      setActiveRoomId(data.roomId);
      setError('');
    } catch {
      setError('Failed to create room. Server unreachable.');
    }
  };

  const joinRoom = async (roomId) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/verify`);
      if (!res.ok) throw new Error();
      setActiveRoomId(roomId);
      setError('');
    } catch {
      setError('Room ID not found or already deleted.');
    }
  };

  const leaveRoom = () => {
    setActiveRoomId('');
    setOwnerToken(null);
  };

  return (
    <div className="container py-5" style={{ maxWidth: '640px' }}>
      {!activeRoomId ? (
        <Lobby onCreateRoom={createRoom} onJoinRoom={joinRoom} error={error} />
      ) : (
        <div className="card shadow-sm border-0">
          <ChatHeader
            roomId={activeRoomId}
            username={username}
            count={participantCount}
            isOwner={Boolean(ownerToken)}
            onDestroy={destroyRoom}
            onLeave={leaveRoom}
          />
          <MessageList messages={messages} currentUsername={username} />
          <MessageInput onSend={sendMessage} />
        </div>
      )}
    </div>
  );
} 
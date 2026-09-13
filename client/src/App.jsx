import React, { useState, useEffect, useCallback } from 'react';
import Lobby from './components/Lobby';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import { useChatSocket } from './hooks/useChatSocket';

function getOrCreateUserIdentity() {
  let userId = sessionStorage.getItem('anon_uid');
  let username = sessionStorage.getItem('anon_uname');

  if (!userId) {
    userId = 'uid-' + Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem('anon_uid', userId);
  }

  if (!username) {
    const animals = ['Otter', 'Falcon', 'Lynx', 'Panda', 'Badger', 'Wolf', 'Fox', 'Hawk'];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    username = `Anon ${animal} #${Math.floor(1000 + Math.random() * 9000)}`;
    sessionStorage.setItem('anon_uname', username);
  }

  return { userId, username };
}

export default function App() {
  const [userInfo, setUserInfo] = useState(null);
  const [activeRoomId, setActiveRoomId] = useState(() => sessionStorage.getItem('anon_active_room') || '');
  const [ownerToken, setOwnerToken] = useState(() => sessionStorage.getItem('anon_owner_token') || null);
  const [savedOwnerRoom, setSavedOwnerRoom] = useState(() => sessionStorage.getItem('anon_owner_room') || null);
  const [error, setError] = useState('');

  useEffect(() => {
    setUserInfo(getOrCreateUserIdentity());
  }, []);

  const handleTerminated = useCallback((reason) => {
    alert(reason || 'Room closed.');
    setActiveRoomId('');
    setOwnerToken(null);
    setSavedOwnerRoom(null);
    sessionStorage.removeItem('anon_active_room');
    sessionStorage.removeItem('anon_owner_token');
    sessionStorage.removeItem('anon_owner_room');
  }, []);

  const {
    messages,
    participantCount,
    status,
    attemptsLeft,
    joinRequests,
    ownerNotice,
    errorMessage,
    decideRequest,
    sendMessage,
    destroyRoom
  } = useChatSocket(activeRoomId, ownerToken, userInfo, handleTerminated);

  const createRoom = async () => {
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userInfo)
      });
      const data = await res.json();
      setOwnerToken(data.ownerToken);
      setActiveRoomId(data.roomId);
      setSavedOwnerRoom(data.roomId);
      sessionStorage.setItem('anon_active_room', data.roomId);
      sessionStorage.setItem('anon_owner_token', data.ownerToken);
      sessionStorage.setItem('anon_owner_room', data.roomId);
      setError('');
    } catch {
      setError('Failed to create room.');
    }
  };

  const rejoinAsOwner = () => {
    if (savedOwnerRoom && ownerToken) {
      setActiveRoomId(savedOwnerRoom);
      sessionStorage.setItem('anon_active_room', savedOwnerRoom);
    }
  };

  const joinRoom = async (roomId) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/verify`);
      if (!res.ok) throw new Error();
      setActiveRoomId(roomId);
      sessionStorage.setItem('anon_active_room', roomId);
      setError('');
    } catch {
      setError('Room ID not found or already closed.');
    }
  };

  const leaveRoom = () => {
    setActiveRoomId('');
    sessionStorage.removeItem('anon_active_room');
  };

  if (!userInfo) return null;

  return (
    <div className="container py-4" style={{ maxWidth: '640px' }}>
      {/* Toast Alert for Rate Limits or Oversized Messages */}
      {errorMessage && (
        <div className="alert alert-warning py-2 text-center shadow-sm position-sticky top-0 z-3">
          {errorMessage}
        </div>
      )}

      {!activeRoomId ? (
        <>
          {savedOwnerRoom && ownerToken && (
            <div className="alert alert-info d-flex justify-content-between align-items-center mb-3">
              <div>
                <strong>You own an active room:</strong> <code>{savedOwnerRoom}</code>
                <div className="small text-muted">Rejoin within the 1-minute grace window if you left.</div>
              </div>
              <button onClick={rejoinAsOwner} className="btn btn-primary btn-sm">
                Rejoin My Room
              </button>
            </div>
          )}
          <Lobby userInfo={userInfo} onCreateRoom={createRoom} onJoinRoom={joinRoom} error={error} />
        </>
      ) : status === 'WAITING' ? (
        <div className="card shadow-sm p-4 text-center">
          <div className="spinner-border text-primary mx-auto mb-3" role="status"></div>
          <h5>Knocking on Room {activeRoomId}...</h5>
          <p className="text-muted small">Waiting for the room owner to approve your entry request.</p>
          <button onClick={leaveRoom} className="btn btn-outline-secondary btn-sm mt-2">
            Cancel Request
          </button>
        </div>
      ) : status === 'DENIED' ? (
        <div className="card shadow-sm p-4 text-center">
          <h5 className="text-danger">Entry Denied by Owner</h5>
          <p className="text-muted small">You have {attemptsLeft} attempt(s) remaining for this room.</p>
          <button onClick={leaveRoom} className="btn btn-primary btn-sm">
            Back to Lobby
          </button>
        </div>
      ) : status === 'BLOCKED' ? (
        <div className="card shadow-sm p-4 text-center">
          <h5 className="text-danger">Access Blocked</h5>
          <p className="text-muted small">You have reached the maximum of 3 join requests for this room.</p>
          <button onClick={leaveRoom} className="btn btn-secondary btn-sm">
            Back to Lobby
          </button>
        </div>
      ) : (
        <div className="card shadow-sm border-0">
          <ChatHeader
            roomId={activeRoomId}
            username={userInfo.username}
            count={participantCount}
            isOwner={Boolean(ownerToken)}
            onDestroy={destroyRoom}
            onLeave={leaveRoom}
          />

          {/* Owner Disconnect Grace Banner */}
          {ownerNotice && (
            <div className="alert alert-warning py-2 mb-0 border-0 rounded-0 text-center small fw-semibold">
              ⚠️ {ownerNotice}
            </div>
          )}

          {/* Pending Requests Panel */}
          {ownerToken && joinRequests.length > 0 && (
            <div className="bg-light border-bottom p-2">
              <div className="fw-bold small text-muted mb-1">Pending Entry Requests:</div>
              {joinRequests.map((req) => (
                <div key={req.requestId} className="d-flex justify-content-between align-items-center bg-white p-2 mb-1 rounded border">
                  <div>
                    <span className="fw-semibold">{req.username}</span>{' '}
                    <span className="text-muted small">({req.userId})</span>
                  </div>
                  <div>
                    <button
                      onClick={() => decideRequest(req.requestId, true)}
                      className="btn btn-success btn-sm me-2 py-0 px-2"
                    >
                      Allow
                    </button>
                    <button
                      onClick={() => decideRequest(req.requestId, false)}
                      className="btn btn-danger btn-sm py-0 px-2"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <MessageList messages={messages} currentUsername={userInfo.username} />
          <MessageInput onSend={sendMessage} />
        </div>
      )}
    </div>
  );
}
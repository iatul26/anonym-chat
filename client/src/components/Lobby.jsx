import React, { useState } from 'react';

export default function Lobby({ onCreateRoom, onJoinRoom, error }) {
  const [inputRoomId, setInputRoomId] = useState('');

  const handleJoin = (e) => {
    e.preventDefault();
    if (inputRoomId.trim()) onJoinRoom(inputRoomId.trim());
  };

  return (
    <div className="card shadow-sm p-4 border-0">
      <div className="text-center mb-4">
        <h4 className="fw-bold">Start an Anonymous Chat</h4>
        <p className="text-muted small">No accounts. Instant setup. Ephemeral memory.</p>
      </div>

      {error && <div className="alert alert-danger py-2 text-center">{error}</div>}

      <button onClick={onCreateRoom} className="btn btn-primary btn-lg w-100 mb-3">
        Create Private Room
      </button>

      <div className="position-relative text-center my-3">
        <hr />
        <span className="bg-white px-2 text-muted small position-absolute top-50 start-50 translate-middle">
          OR JOIN EXISTING
        </span>
      </div>

      <form onSubmit={handleJoin}>
        <div className="input-group">
          <input
            type="text"
            className="form-control"
            placeholder="Enter Room ID"
            value={inputRoomId}
            onChange={(e) => setInputRoomId(e.target.value)}
          />
          <button className="btn btn-outline-secondary" type="submit">
            Join
          </button>
        </div>
      </form>
    </div>
  );
}
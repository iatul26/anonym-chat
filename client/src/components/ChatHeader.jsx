import React from 'react';

export default function ChatHeader({ roomId, username, count, isOwner, onDestroy, onLeave }) {
  return (
    <div className="card-header bg-light d-flex justify-content-between align-items-center py-2">
      <div>
        <span className="badge bg-dark font-monospace me-2">Room: {roomId}</span>
        <span className="small text-muted">
          You: <strong>{username}</strong> ({count} active)
        </span>
      </div>
      <div>
        {isOwner && (
          <button onClick={onDestroy} className="btn btn-danger btn-sm me-2">
            Destroy Room
          </button>
        )}
        <button onClick={onLeave} className="btn btn-outline-secondary btn-sm">
          Leave
        </button>
      </div>
    </div>
  );
}
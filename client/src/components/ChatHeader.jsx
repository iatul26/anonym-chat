import React, { useState } from 'react';

export default function ChatHeader({ roomId, username, count, isOwner, onDestroy, onLeave }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    // Generate direct shareable invite link with query param
    const inviteUrl = `${window.location.origin}/?room=${roomId}`;

    // Use native mobile share tray if supported
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my private anonymous chat',
          text: `Join my ephemeral chat room. Room ID: ${roomId}`,
          url: inviteUrl
        });
        return;
      } catch (err) {
        // Fallback to clipboard if user dismissed share tray
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback: Clipboard copy
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Manual fallback prompt
      window.prompt('Copy invite link:', inviteUrl);
    }
  };

  return (
    <div className="card-header bg-light d-flex justify-content-between align-items-center py-2 flex-wrap gap-2">
      <div className="d-flex align-items-center flex-wrap gap-2">
        <span className="badge bg-dark font-monospace">Room: {roomId}</span>
        <button
          onClick={handleShare}
          className={`btn btn-sm ${copied ? 'btn-success' : 'btn-outline-primary'} py-0 px-2`}
          title="Share Invite Link"
        >
          {copied ? '✓ Link Copied' : '🔗 Share Link'}
        </button>
        <span className="small text-muted ms-1">
          You: <strong>{username}</strong> ({count} active)
        </span>
      </div>

      <div className="d-flex align-items-center gap-2">
        {isOwner && (
          <button onClick={onDestroy} className="btn btn-danger btn-sm">
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
import React, { useState } from 'react';

export default function MessageInput({ onSend }) {
  const [content, setContent] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSend(content);
    setContent('');
  };

  return (
    <form onSubmit={handleSubmit} className="card-footer bg-white d-flex gap-2 p-2">
      <input
        type="text"
        className="form-control"
        placeholder="Type an anonymous message..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={2000}
      />
      <button className="btn btn-primary px-4" type="submit">
        Send
      </button>
    </form>
  );
}
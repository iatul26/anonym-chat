import React, { useEffect, useRef } from 'react';

export default function MessageList({ messages, currentUsername }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="card-body overflow-auto p-3" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
      {messages.map((m) =>
        m.system ? (
          <div key={m.id} className="text-center text-muted small my-1 fst-italic">
            {m.content}
          </div>
        ) : (
          <div
            key={m.id}
            className={`mb-2 p-2 rounded ${
              m.sender === currentUsername ? 'bg-primary text-white ms-auto' : 'bg-light text-dark me-auto'
            }`}
            style={{ maxWidth: '75%', wordBreak: 'break-word' }}
          >
            <div className="fw-bold" style={{ fontSize: '0.7rem', opacity: 0.85 }}>
              {m.sender}
            </div>
            <div>{m.content}</div>
          </div>
        )
      )}
      <div ref={scrollRef} />
    </div>
  );
}
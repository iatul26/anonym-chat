export const CONFIG = {
  // Room & Identity Tokens
  ROOM_ID_BYTES: 4,
  OWNER_TOKEN_BYTES: 32,

  // Grace Period & Lifecycles
  OWNER_GRACE_PERIOD_MS: parseInt(process.env.OWNER_GRACE_PERIOD_MS || '60000', 10), // 1 minute
  ROOM_TTL_MS: parseInt(process.env.ROOM_TTL_MS || '7200000', 10), // 2 hours idle
  REAPER_INTERVAL_MS: 15 * 60 * 1000,

  // Memory & Message Limits
  MAX_MESSAGE_BYTES: parseInt(process.env.MAX_MESSAGE_BYTES || '2048', 10), // 2 KB per message
  MAX_ROOM_BYTES: parseInt(process.env.MAX_ROOM_BYTES || '262144', 10), // 256 KB max message pool per room

  // Rate Limiting (WebSocket & API)
  WS_RATE_LIMIT_WINDOW_MS: 5000, // 5-second window
  WS_MAX_MESSAGES_PER_WINDOW: 10, // Max 2 msgs/sec burst
  HTTP_MAX_ROOM_CREATIONS_PER_IP: 15, // Per 15 min

  ANIMALS: ['Otter', 'Falcon', 'Lynx', 'Panda', 'Badger', 'Wolf', 'Fox', 'Hawk', 'Raven', 'Bison']
};

export function generateAnonymousHandle() {
  const animal = CONFIG.ANIMALS[Math.floor(Math.random() * CONFIG.ANIMALS.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `Anon ${animal} #${num}`;
}

export const CONFIG = {
  ROOM_ID_BYTES: 6, // Generates 12-char hex string
  OWNER_TOKEN_BYTES: 32, // 256-bit entropy token
  MAX_MESSAGE_LENGTH: 2000,
  ROOM_TTL_MS: 2 * 60 * 60 * 1000, // 2 hours of inactivity
  REAPER_INTERVAL_MS: 15 * 60 * 1000, // Check every 15 mins
  ANIMALS: ['Otter', 'Falcon', 'Lynx', 'Panda', 'Badger', 'Wolf', 'Fox', 'Hawk', 'Raven', 'Bison']
};

export function generateAnonymousHandle() {
  const animal = CONFIG.ANIMALS[Math.floor(Math.random() * CONFIG.ANIMALS.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `Anon ${animal} #${num}`;
}
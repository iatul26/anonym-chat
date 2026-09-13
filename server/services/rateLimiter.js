export class MemoryRateLimiter {
  constructor(windowMs, maxTokens) {
    this.windowMs = windowMs;
    this.maxTokens = maxTokens;
    this.hits = new Map();

    // Cleanup stale entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, timestamps] of this.hits.entries()) {
        const valid = timestamps.filter((ts) => now - ts < this.windowMs);
        if (valid.length === 0) {
          this.hits.delete(key);
        } else {
          this.hits.set(key, valid);
        }
      }
    }, 5 * 60 * 1000);
  }

  isRateLimited(key) {
    const now = Date.now();
    const timestamps = this.hits.get(key) || [];
    const valid = timestamps.filter((ts) => now - ts < this.windowMs);

    if (valid.length >= this.maxTokens) {
      this.hits.set(key, valid);
      return true;
    }

    valid.push(now);
    this.hits.set(key, valid);
    return false;
  }
}
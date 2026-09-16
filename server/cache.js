export class MemoryStore {
  constructor(max = 1000) {
    this.entries = new Map();
    this.controls = new Map();
    this.max = max;
  }
  bucket(key) {
    return /^(client|budget|cooldown):/.test(key)
      ? this.controls
      : this.entries;
  }
  reserveControl(key) {
    if (this.controls.has(key) || this.controls.size < 10000) return;
    for (const [id, entry] of this.controls)
      if (entry.expires <= Date.now()) this.controls.delete(id);
    if (this.controls.size >= 10000)
      throw new Error("Quota storage capacity exceeded");
  }
  async get(key) {
    const bucket = this.bucket(key);
    const entry = bucket.get(key);
    if (!entry || entry.expires <= Date.now()) {
      bucket.delete(key);
      return null;
    }
    return entry.value;
  }
  async set(key, value, seconds) {
    const bucket = this.bucket(key);
    if (bucket === this.controls) this.reserveControl(key);
    bucket.delete(key);
    bucket.set(key, { value, expires: Date.now() + seconds * 1000 });
    if (this.entries.size > this.max)
      this.entries.delete(this.entries.keys().next().value);
  }
  async increment(key, seconds) {
    // No await between read and write: concurrent requests must increment atomically.
    const bucket = this.bucket(key);
    if (bucket === this.controls) this.reserveControl(key);
    const entry = bucket.get(key);
    const valid = entry && entry.expires > Date.now();
    const value = (valid ? entry.value : 0) + 1;
    const expires = valid ? entry.expires : Date.now() + seconds * 1000;
    bucket.set(key, { value, expires });
    if (this.entries.size > this.max)
      this.entries.delete(this.entries.keys().next().value);
    return value;
  }
}

export class CacheUnavailableError extends Error {
  constructor() {
    super("Shared cache is temporarily unavailable. Please retry shortly.");
    this.name = "CacheUnavailableError";
    this.code = "CACHE_UNAVAILABLE";
  }
}

// Bound both queued/in-flight commands and connection lifecycle operations.
// Abort timed-out commands so they cannot remain queued for a later reconnect.
export async function boundedCacheOperation(operation, timeoutMs = 2000) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new CacheUnavailableError());
          controller.abort();
        }, timeoutMs);
      }),
    ]);
  } catch {
    // Never expose Redis connection strings or upstream error details.
    throw new CacheUnavailableError();
  } finally {
    clearTimeout(timer);
  }
}

export async function createStore(url) {
  if (!url) return new MemoryStore();
  const { createClient } = await import("redis");
  const client = createClient({
    url,
    disableOfflineQueue: true,
    commandsQueueMaxLength: 1000,
    socket: {
      connectTimeout: 2000,
      reconnectStrategy: (retries) =>
        retries >= 3 ? new CacheUnavailableError() : 100 * 2 ** retries,
    },
  });
  client.on("error", () => console.error("Shared cache unavailable"));
  try {
    await boundedCacheOperation(() => client.connect(), 10000);
  } catch (error) {
    if (client.isOpen) client.destroy();
    throw error;
  }
  const command = (operation) =>
    boundedCacheOperation((abortSignal) =>
      operation(client.withCommandOptions({ abortSignal })),
    );
  return {
    get: (key) =>
      command(async (connection) => {
        const value = await connection.get(key);
        return value === null ? null : JSON.parse(value);
      }),
    set: (key, value, seconds) =>
      command((connection) =>
        connection.set(key, JSON.stringify(value), { EX: seconds }),
      ),
    increment: (key, seconds) =>
      command((connection) =>
        connection.eval(
          "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return n",
          { keys: [key], arguments: [String(seconds)] },
        ),
      ),
    close: async () => {
      // The HTTP server drains requests before calling this. Destroy immediately
      // so shutdown cannot wait for an unreachable Redis server to acknowledge.
      if (client.isOpen) client.destroy();
    },
  };
}

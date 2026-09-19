import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { MemoryStore } from './cache.js';

// Single-process disk cache. Mount persistent storage in production; use Redis for replicas.
// Persists provider responses and quota counters, never API credentials or client IPs.
export async function createPersistentStore(directory) {
  await mkdir(directory, { recursive:true });
  const file = path.join(directory, 'market-cache.json');
  const store = new MemoryStore();
  try {
    const saved = JSON.parse(await readFile(file,'utf8'));
    for (const [key, entry] of saved) {
      if (/^(marketstack:|budget:marketstack:|cooldown:marketstack:)/.test(key) && entry.expires > Date.now())
        store.bucket(key).set(key, entry);
    }
  } catch (err) { if (err.code !== 'ENOENT') throw new Error('Market cache could not be read safely.'); }
  let queue = Promise.resolve();
  function persist(key) {
    if (!/^(marketstack:|budget:marketstack:|cooldown:marketstack:)/.test(key)) return Promise.resolve();
    const work = queue.then(async () => {
      const rows = [...store.entries, ...store.controls].filter(([id, entry]) => /^(marketstack:|budget:marketstack:|cooldown:marketstack:)/.test(id) && entry.expires > Date.now());
      await writeFile(file + '.tmp', JSON.stringify(rows), { mode:0o600 });
      await rename(file + '.tmp', file);
    });
    queue = work.catch(() => {});
    return work;
  }
  return {
    get: key => store.get(key),
    async set(key,value,ttl) { await store.set(key,value,ttl); await persist(key); },
    async increment(key,ttl) { const n = await store.increment(key,ttl); await persist(key); return n; },
    close: () => queue,
  };
}

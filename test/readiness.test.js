import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/index.js";
import { MemoryStore, CacheUnavailableError } from "../server/cache.js";

test("readiness requires configured credentials and writable cache", async (t) => {
  for (const scenario of [
    { configured: false, writable: true, status: 503 },
    { configured: true, writable: true, status: 200 },
    { configured: true, writable: false, status: 503 },
  ]) {
    await t.test(JSON.stringify(scenario), async (t) => {
      const store = new MemoryStore();
      if (!scenario.writable)
        store.set = async () => {
          throw new CacheUnavailableError();
        };
      const app = createApp({
        store,
        market: {},
        configured: scenario.configured,
      });
      await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
      t.after(() => new Promise((resolve) => app.close(resolve)));
      const base = `http://127.0.0.1:${app.address().port}`;
      assert.equal((await fetch(base + "/healthz")).status, 200);
      const result = await fetch(base + "/readyz");
      assert.equal(result.status, scenario.status);
      if (!scenario.writable)
        assert.equal((await result.json()).error.code, "CACHE_UNAVAILABLE");
    });
  }
});

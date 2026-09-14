import test from "node:test";
import assert from "node:assert/strict";
import { Watchlists } from "../assets/watchlists.js";
function storage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
  };
}
test("guest lists persist without allowing private notes or private stocks", async () => {
  storage();
  const lists = new Watchlists(null);
  await lists.init();
  await lists.toggle("AAPL.US");
  assert.equal(lists.has("AAPL.US"), true);
  const next = new Watchlists(null);
  await next.init();
  assert.equal(next.has("AAPL.US"), true);
  await assert.rejects(next.toggle("AAPL.US", "private"), {
    code: "AUTH_REQUIRED",
  });
  await assert.rejects(next.note("AAPL.US", "private"));
  await next.toggle("AAPL.US");
  assert.equal(next.rows.length, 0);
});
test("failed persistence never claims a stock was saved", async () => {
  storage();
  localStorage.setItem = () => {
    throw Error();
  };
  const lists = new Watchlists(null);
  await lists.init();
  await assert.rejects(lists.toggle("AAPL.US"));
  assert.equal(lists.rows.length, 0);
});
test("private data from an old session cannot populate a signed-out list", async () => {
  let release;
  const wait = new Promise((r) => (release = r));
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return wait;
    },
  };
  const lists = new Watchlists({ from: () => query });
  lists.user = { id: "user-A" };
  const loading = lists.load();
  lists.user = null;
  release({
    data: [{ symbol: "AAPL.US", list_kind: "private", note: "private text" }],
    error: null,
  });
  await loading;
  assert.deepEqual(lists.rows, []);
});
test("account query errors do not silently fall back to a guest list", async () => {
  storage();
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    order() {
      return this;
    },
    limit: async () => ({ error: Error("RLS failure") }),
  };
  const lists = new Watchlists({ from: () => query });
  lists.user = { id: "user-A" };
  await assert.rejects(lists.load());
  assert.ok(lists.error);
  assert.deepEqual(lists.rows, []);
});

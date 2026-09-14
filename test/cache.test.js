import test from "node:test";
import assert from "node:assert/strict";
import {
  boundedCacheOperation,
  CacheUnavailableError,
} from "../server/cache.js";

test("stalled cache operations fail within a bound and abort pending work", { timeout: 1000 }, async () => {
  let signal;
  await assert.rejects(
    boundedCacheOperation((abortSignal) => {
      signal = abortSignal;
      return new Promise(() => {});
    }, 10),
    (error) => error instanceof CacheUnavailableError && error.code === "CACHE_UNAVAILABLE",
  );
  assert.equal(signal.aborted, true);
});

test("cache rejections become recognizable errors without upstream secrets", async () => {
  await assert.rejects(
    boundedCacheOperation(() => Promise.reject(new Error("redis://private-secret@cache"))),
    (error) =>
      error instanceof CacheUnavailableError &&
      error.code === "CACHE_UNAVAILABLE" &&
      !error.message.includes("private-secret"),
  );
  await assert.rejects(
    boundedCacheOperation(() => { throw new Error("connection closed"); }),
    { name: "CacheUnavailableError", code: "CACHE_UNAVAILABLE" },
  );
});

test("successful cache operations return values unchanged", async () => {
  assert.equal(await boundedCacheOperation(async () => 42), 42);
  assert.equal(await boundedCacheOperation(async () => null), null);
});

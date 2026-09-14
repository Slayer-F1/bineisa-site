import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../server/cache.js";
import {
  createMarket,
  number,
  quote,
  fundamentals,
  ticker,
  safeUrl,
} from "../server/market.js";
import { createApp } from "../server/index.js";
import { csvCell } from "../assets/market-ui.js";
const response = (data) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
const options = (fetcher, key = "test-secret") => ({
  key,
  store: new MemoryStore(),
  fetcher,
});
test("invalid provider payloads never poison the cache", async () => {
  let calls = 0;
  const m = createMarket(
    options(async () =>
      response(
        ++calls === 1 ? {} : { General: { Code: "TEST", Name: "Recovered" } },
      ),
    ),
  );
  await assert.rejects(m.detail("TEST.US"), { code: "INVALID_PROVIDER_DATA" });
  const r = await m.detail("TEST.US");
  assert.equal(r.data.name, "Recovered");
  assert.equal(calls, 2);
});
test("market cache pressure cannot reset quota controls", async () => {
  const store = new MemoryStore(2);
  await store.increment("budget:provider", 60);
  await store.set("cooldown:provider", true, 60);
  for (let i = 0; i < 5; i++) await store.set("market:" + i, { data: [] }, 60);
  assert.equal(await store.increment("budget:provider", 60), 2);
  assert.equal(await store.get("cooldown:provider"), true);
  assert.equal(store.entries.size, 2);
});
test("parallel rate-limit increments cannot lose requests", async () => {
  const store = new MemoryStore();
  const counts = await Promise.all(
    Array.from({ length: 100 }, () => store.increment("limit", 60)),
  );
  assert.equal(new Set(counts).size, 100);
  assert.equal(await store.get("limit"), 100);
});

test("missing financial data stays null; real zero and negative values survive", () => {
  for (const v of [null, undefined, "", "NA", false, Infinity])
    assert.equal(number(v), null);
  assert.equal(number("0"), 0);
  assert.equal(number("-142.2"), -142.2);
});
test("symbols are exchange-qualified and reject path/query injection", () => {
  assert.equal(ticker("brk-b.us"), "BRK-B.US");
  for (const s of ["AAPL", "../private", "AAPL.US?key=x", "AAPL.US/../foo", ""])
    assert.throws(() => ticker(s));
});
test("publisher and company links reject unsafe URL schemes", () => {
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("https://example.com/a"), "https://example.com/a");
});
test("quotes retain provider time rather than substituting fetch time", () => {
  const q = quote(
    { close: 0, timestamp: 1700000000, change_p: null },
    "AAPL.US",
  );
  assert.equal(q.price, 0);
  assert.equal(q.asOf, "2023-11-14T22:13:20.000Z");
  assert.equal(q.changePercent, null);
  assert.equal(quote({}, "AAPL.US").asOf, null);
});
test("fundamentals handle incomplete statements and preserve period currency", () => {
  const c = fundamentals(
    {
      General: {
        Name: "Example",
        CurrencyCode: "USD",
        WebURL: "javascript:bad",
      },
      Financials: {
        Income_Statement: {
          currency_symbol: "EUR",
          yearly: {
            a: { date: "2024-12-31", totalRevenue: "0" },
            b: { date: "2025-12-31", netIncome: "-42" },
          },
        },
      },
    },
    "TEST.US",
  );
  assert.equal(c.financials.Income_Statement.currency, "EUR");
  assert.equal(c.financials.Income_Statement.yearly[0].netIncome, -42);
  assert.equal(c.financials.Income_Statement.yearly[0].totalRevenue, null);
  assert.equal(c.financials.Income_Statement.yearly[1].totalRevenue, 0);
  assert.equal(c.website, null);
  assert.deepEqual(c.financials.Cash_Flow.quarterly, []);
});
test("unconfigured feed never requests or fabricates market data", async () => {
  let calls = 0;
  const m = createMarket(
    options(() => {
      calls++;
    }, ""),
  );
  await assert.rejects(m.quotes(["AAPL.US"]), { code: "DATA_NOT_CONFIGURED" });
  assert.equal(calls, 0);
});
test("duplicate quote requests share one upstream request and cached metadata preserves freshness", async () => {
  let calls = 0;
  const m = createMarket(
    options(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return response({ code: "AAPL.US", close: 12, timestamp: 1700000000 });
    }),
  );
  const [a, b] = await Promise.all([
    m.quotes(["AAPL.US"]),
    m.quotes(["AAPL.US"]),
  ]);
  const c = await m.quotes(["AAPL.US"]);
  assert.equal(calls, 1);
  assert.deepEqual(a.data, b.data);
  assert.equal(c.meta.cached, true);
  assert.equal(c.meta.retrievedAt, a.meta.retrievedAt);
  assert.equal(c.meta.freshness, "delayed");
  assert.ok(!JSON.stringify(c).includes("test-secret"));
});
test("provider 403 is an entitlement error without leaking provider response", async () => {
  const m = createMarket(
    options(async () => new Response("secret test-secret", { status: 403 })),
  );
  await assert.rejects(
    m.detail("AAPL.US"),
    (err) =>
      err.code === "DATA_ENTITLEMENT" && !err.message.includes("test-secret"),
  );
});
test("rate-limit responses create a short shared upstream cooldown", async () => {
  let calls = 0;
  const m = createMarket(
    options(async () => {
      calls++;
      return new Response("limited", { status: 429 });
    }),
  );
  await assert.rejects(m.quotes(["AAPL.US"]));
  await assert.rejects(m.quotes(["TSLA.US"]), { code: "PROVIDER_BUSY" });
  assert.equal(calls, 1);
});
test("unsupported exchange and overlarge batches do not call upstream", async () => {
  let calls = 0;
  const m = createMarket(
    options(async () => {
      calls++;
      return response([]);
    }),
  );
  await assert.rejects(m.quotes(["AAPL.LSE"]), { code: "MARKET_DISABLED" });
  await assert.rejects(
    m.quotes(Array.from({ length: 21 }, (_, i) => `X${i}.US`)),
    { code: "INVALID_SYMBOLS" },
  );
  assert.equal(calls, 0);
});
test("screener uses documented filters, currency_symbol, date and pagination", async () => {
  let url;
  const m = createMarket(
    options(async (u) => {
      url = new URL(u);
      return response({
        data: Array.from({ length: 20 }, () => ({
          code: "TEST",
          name: "Example",
          currency_symbol: "$",
          adjusted_close: 0,
          refund_1d_p: -2,
          last_day_data_date: "2026-08-10",
        })),
      });
    }),
  );
  const r = await m.screener({
    exchange: "US",
    sector: "Financial Services",
    industry: "Banks",
    offset: 20,
  });
  assert.equal(r.hasMore, true);
  assert.equal(r.data[0].currency, "$");
  assert.equal(r.data[0].asOf, "2026-08-10");
  assert.equal(r.data[0].price, 0);
  assert.equal(url.searchParams.get("offset"), "20");
  assert.deepEqual(JSON.parse(url.searchParams.get("filters")), [
    ["exchange", "=", "US"],
    ["sector", "match", "Financial Services"],
    ["industry", "match", "Banks"],
  ]);
});
test("history filters malformed bars and retains real adjusted daily prices", async () => {
  const m = createMarket(
    options(async () =>
      response([
        { date: "2026-08-01", adjusted_close: 12, close: 24 },
        { date: "wrong", adjusted_close: 4 },
        { date: "2026-08-02", adjusted_close: null },
      ]),
    ),
  );
  const r = await m.history("AAPL.US", "1M");
  assert.deepEqual(r.data, [{ date: "2026-08-01", close: 12, volume: null }]);
  assert.equal(r.meta.freshness, "end-of-day");
  await assert.rejects(m.history("AAPL.US", "1D"), { code: "INVALID_RANGE" });
});
test("news exposes linked headlines without full copyrighted bodies or unsafe URLs", async () => {
  const m = createMarket(
    options(async () =>
      response([
        {
          title: "S&amp;P &quot;Story&quot;",
          date: "2026-08-01",
          link: "https://example.com/news?a=1&amp;b=2",
          content: "Full body",
          sentiment: { polarity: 0 },
          symbols: ["AAPL.US"],
        },
        { title: "Bad", link: "javascript:bad" },
      ]),
    ),
  );
  const r = await m.news({});
  assert.equal(r.data.length, 1);
  assert.equal(r.data[0].title, 'S&P "Story"');
  assert.equal(r.data[0].url, "https://example.com/news?a=1&b=2");
  assert.equal(r.data[0].sentiment, 0);
  assert.equal(r.data[0].content, undefined);
});
test("CSV export protects formula-like text while keeping negative financial numbers", () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell(-42), '"-42"');
  assert.equal(csvCell(null), '""');
});
test("HTTP routes serve app pages and deny internal files; API errors are structured", async (t) => {
  const store = new MemoryStore();
  const app = createApp({ store, market: createMarket({ store, key: "" }) });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => app.close(r)));
  const base = `http://127.0.0.1:${app.address().port}`;
  for (const p of [
    "/",
    "/stocks",
    "/stocks/AAPL.US",
    "/reports/AAPL.US",
    "/private-watchlist",
    "/auth/login",
    "/legal/privacy",
  ]) {
    const r = await fetch(base + p);
    assert.equal(r.status, 200, p);
    assert.match(
      r.headers.get("content-security-policy"),
      /frame-ancestors 'none'/,
    );
  }
  for (const p of [
    "/.env",
    "/server/index.js",
    "/supabase/migrations/20260910_stock_watchlists.sql",
    "/package.json",
    "/made-up",
  ])
    assert.equal((await fetch(base + p)).status, 404, p);
  const r = await fetch(base + "/api/quotes?symbols=AAPL.US");
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error.code, "DATA_NOT_CONFIGURED");
  assert.equal((await fetch(base + "/api/stocks?offset=-1")).status, 400);
  assert.equal((await fetch(base + "/api/stocks?sort=arbitrary")).status, 400);
  assert.equal(
    (await fetch(base + "/api/status", { method: "POST" })).status,
    405,
  );
});

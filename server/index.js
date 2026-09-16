import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import { createStore } from "./cache.js";
import { createMarket, ApiError } from "./market.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const csp =
  "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://images.unsplash.com; connect-src 'self' https://rnbomgxmurdnwmvgklru.supabase.co wss://rnbomgxmurdnwmvgklru.supabase.co; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";
const publicFiles = new Set([
  "index.html",
  "company.html",
  "404.html",
  "auth/login.html",
  "auth/register.html",
  "account/index.html",
  "legal/privacy.html",
  "legal/terms.html",
  "legal/cookies.html",
]);
const appRoutes =
  /^\/(?:stocks(?:\/[A-Za-z0-9.-]+)?|reports(?:\/[A-Za-z0-9.-]+)?|news|watchlist|private-watchlist|search|data-sources)\/?$/;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};

export function createApp({
  market,
  store,
  configured = false,
  demo = false,
  trustProxy = false,
  defaultExchange = "US",
}) {
  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    );
    res.setHeader("Content-Security-Policy", csp);
    if (process.env.NODE_ENV === "production")
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    const json = (status, body) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(body));
    };
    try {
      if (!["GET", "HEAD"].includes(req.method)) {
        res.setHeader("Allow", "GET, HEAD");
        throw new ApiError(
          405,
          "METHOD_NOT_ALLOWED",
          "This endpoint is read-only.",
        );
      }
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/healthz")
        return json(200, {
          status: "ok",
          marketData: configured ? "configured" : "not-configured",
        });
      if (url.pathname === "/readyz") {
        // Reads alone can succeed when Redis noeviction rejects quota writes.
        await store.set("health:ready", Date.now(), 10);
        await store.get("health:ready");
        return json(configured ? 200 : 503, {
          status: configured ? "ready" : "not-ready",
          marketData: configured ? "configured" : "not-configured",
        });
      }
      if (url.pathname.startsWith("/api/")) {
        const ip = trustProxy
          ? String(req.headers["x-forwarded-for"] || req.socket.remoteAddress)
              .split(",")[0]
              .trim()
          : req.socket.remoteAddress;
        const id = createHash("sha256")
          .update(ip || "unknown")
          .digest("hex")
          .slice(0, 24);
        if ((await store.increment(`client:${id}`, 60)) > 120) {
          res.setHeader("Retry-After", "60");
          throw new ApiError(
            429,
            "RATE_LIMITED",
            "Too many requests. Please retry in a minute.",
          );
        }
        const q = url.searchParams;
        if (req.url.length > 2000)
          throw new ApiError(
            400,
            "INVALID_REQUEST",
            "The request is too long.",
          );
        const offset = Number(q.get("offset") || 0);
        if (!Number.isInteger(offset) || offset < 0 || offset > 9999)
          throw new ApiError(400, "INVALID_PAGE", "Invalid result offset.");
        const text = (name, max = 80) => {
          const s = (q.get(name) || "").trim();
          if (s.length > max)
            throw new ApiError(
              400,
              "INVALID_FILTER",
              "The filter is too long.",
            );
          return s;
        };
        const exchange = text("exchange", 12) || defaultExchange;
        let result;
        switch (url.pathname) {
          case "/api/status":
            result = {
              data: {
                configured,
                demo,
                provider: "EODHD",
                defaultExchange,
                quoteType: "delayed",
                delayMinutes: "15–20",
              },
            };
            break;
          case "/api/exchanges":
            result = await market.exchanges();
            break;
          case "/api/search":
            result = await market.search(text("q"), exchange);
            break;
          case "/api/stocks": {
            const sort = text("sort") || "market_capitalization.desc";
            if (
              ![
                "market_capitalization.desc",
                "market_capitalization.asc",
                "adjusted_close.desc",
                "adjusted_close.asc",
                "refund_1d_p.desc",
                "refund_1d_p.asc",
              ].includes(sort)
            )
              throw new ApiError(
                400,
                "INVALID_SORT",
                "Unsupported sort order.",
              );
            result = await market.screener({
              exchange,
              sector: text("sector"),
              industry: text("industry"),
              country: text("country"),
              offset,
              sort,
            });
            break;
          }
          case "/api/quotes":
            result = await market.quotes(text("symbols", 700).split(","));
            break;
          case "/api/company":
            result = await market.detail(text("symbol", 40));
            break;
          case "/api/history":
            result = await market.history(
              text("symbol", 40),
              text("range", 2) || "1Y",
            );
            break;
          case "/api/news":
            result = await market.news({
              symbol: text("symbol", 40),
              topic: text("topic"),
              offset,
            });
            break;
          default:
            throw new ApiError(404, "NOT_FOUND", "API endpoint not found.");
        }
        return json(200, result);
      }
      let pathname = decodeURIComponent(url.pathname);
      let file = pathname.replace(/^\//, "");
      if (pathname === "/" || appRoutes.test(pathname)) file = "index.html";
      if (pathname === "/account" || pathname === "/account/")
        file = "account/index.html";
      if (
        /^\/(auth\/(login|register)|legal\/(privacy|terms|cookies))$/.test(
          pathname,
        )
      )
        file = pathname.slice(1) + ".html";
      if (
        !publicFiles.has(file) &&
        !/^assets\/[a-zA-Z0-9_-]+\.(css|js|svg|png|jpg|woff2)$/.test(file)
      )
        file = "404.html";
      let status = file === "404.html" ? 404 : 200;
      const target = path.join(root, file);
      let data;
      try {
        if (!(await stat(target)).isFile()) throw Error();
        data = await readFile(target);
      } catch {
        status = 404;
        data = await readFile(path.join(root, "404.html"));
        file = "404.html";
      }
      res.writeHead(status, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        // Assets have stable filenames, so revalidate after every deployment.
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch (error) {
      const known = error instanceof ApiError;
      const cacheUnavailable = error.name === "CacheUnavailableError";
      if (!known) console.error("Request failed:", error.name);
      json(known ? error.status : cacheUnavailable ? 503 : 500, {
        error: {
          code: known
            ? error.code
            : cacheUnavailable
              ? "CACHE_UNAVAILABLE"
              : "INTERNAL_ERROR",
          message: known
            ? error.message
            : "The service is temporarily unavailable. Please try again.",
        },
      });
    }
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const key = process.env.EODHD_API_KEY?.trim();
  const demo = key?.toLowerCase() === "demo";
  if (demo && process.env.NODE_ENV === "production")
    throw Error("Demo credentials are forbidden in production.");
  const exchanges = (process.env.MARKET_EXCHANGES || "US")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z0-9]{1,12}$/.test(s));
  if (!exchanges.length) throw Error("Configure at least one market exchange.");
  const store = await createStore(process.env.REDIS_URL);
  const market = createMarket({
    key,
    exchanges,
    store,
    budget: Number(process.env.PROVIDER_REQUESTS_PER_MINUTE) || 120,
  });
  const app = createApp({
    market,
    store,
    configured: !!key,
    demo,
    defaultExchange: exchanges[0],
    trustProxy: process.env.TRUST_PROXY === "1",
  });
  app.listen(
    Number(process.env.PORT) || 3000,
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        `BIN EISA Stocks listening on port ${Number(process.env.PORT) || 3000}; market data ${key ? "configured" : "not configured"}`,
      ),
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () =>
      app.close(async () => {
        await store.close?.();
        process.exit(0);
      }),
    );
}

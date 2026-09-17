# Production setup

Target repository: `Slayer-F1/bineisa-site`. Target domain: `bineisastocks.com`. Corporate destination: `https://bineisa.com/`.

## 1. Market-data subscription

Configure a BIN EISA EODHD subscription with public website display rights and access to exchanges, search, screener, delayed quotes, EOD history, company fundamentals, financial statements and news. Personal access and a public demo token are not a production public-display agreement. Confirm rights and exchange coverage directly with the provider; this implementation does not purchase a plan.

Provider documentation:

- [Coverage and endpoint differences](https://eodhd.com/financial-apis/quick-start-with-our-financial-data-apis)
- [Delayed stock quote feed](https://eodhd.com/financial-apis/live-ohlcv-stocks-api)
- [Company fundamentals](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds)
- [Stock screener](https://eodhd.com/financial-apis/stock-market-screener-api)
- [Search](https://eodhd.com/financial-apis/search-api-for-stocks-etfs-mutual-funds)
- [Financial news](https://eodhd.com/financial-apis/stock-market-financial-news-api)

Set `EODHD_API_KEY` in the host's server environment. `.env` is ignored by Git and the Docker build. The browser receives only normalized data from same-origin `/api/*` endpoints. `assets/config.js` contains a Supabase **publishable** key, not a market-data secret or Supabase service-role key.

`MARKET_EXCHANGES=US` is the initial market. Additional EODHD exchange codes can be enabled after their entitlements are verified. Do not advertise DFM/ADX or any other market merely because a provider offers market-hours data for that exchange. Coverage must be checked separately for quotes, history, fundamentals and news.

## 2. Supabase

Apply `supabase/migrations/20260910_stock_watchlists.sql` once to the existing project `rnbomgxmurdnwmvgklru`. The migration is additive and creates only the stock-list table, ownership policies and capacity trigger. It does not replace the existing profiles or insights tables.

Private rows have `user_id = auth.uid()` policies for select, insert, update and delete, with no anonymous access. Both list types are owner-only in the database. The combined account limit is 200 rows, and each private note is limited to 2,000 characters. Private notes are never sent to the market-data provider.

Keep the existing email OTP provider and branded email templates. Verify custom SMTP delivery using a real authorized test account. Permit these exact production redirect paths in Supabase auth settings, including their `next` query values:

```text
https://bineisastocks.com/auth/login.html**
https://bineisastocks.com/auth/login**
```

Use equivalent localhost redirects only in development. Do not enable cross-domain single sign-on: Shopify and stock-research accounts remain separate.

Acceptance checks after applying the migration:

1. User A saves ordinary and private stocks, edits a private note, reloads and signs in on another device.
2. User B cannot read or modify user A's records, including by direct Supabase REST requests.
3. Anonymous requests cannot read the table. Sign-out immediately clears private content from the screen.
4. A failed database write leaves the interface showing failure rather than claiming a save.

### Recovering a sign-in connection failure

On September 17, the configured hostname `rnbomgxmurdnwmvgklru.supabase.co` returned DNS name-not-found both locally and through Cloudflare's public resolver. The live browser configuration and CSP matched this hostname; the authentication health endpoint could not be reached. This prevents registration, login and account-backed lists before any email-provider request can be completed.

Sign in to the existing Supabase project dashboard and inspect its status. If it is paused, restore that same project and wait for its API hostname to resolve. If the project URL has changed, obtain the correct Project URL and publishable key from the owner; update `assets/config.js`, `server/index.js` and every HTML `connect-src` policy together. Do not substitute a service-role key. Changing Coolify environment variables alone does not override the current browser configuration.

After connectivity returns, verify the authentication health endpoint, email-provider configuration, allowed redirect URLs and an owner-authorized signup. The user-facing network error now explains that the sign-in service cannot be reached; this message is not evidence that the service has been restored.

## 3. Application hosting

This is now a Node service, not a static nginx-only image. The Docker image retains **port 80** and runs as the `node` user. Existing deployments must rebuild the Dockerfile; uploading only HTML and CSS will not provide `/api/*` routes.

```powershell
docker compose up --build -d
```

The supplied Compose setup publishes only `127.0.0.1:3000`, with Redis internal to the Compose network. Use `nginx.conf` as a host reverse-proxy example. Add the host's managed HTTPS certificate and HTTP-to-HTTPS redirect. Preserve or configure TLS through the existing hosting platform rather than replacing its certificate configuration.

Compose sets `TRUST_PROXY=1` because its host port is loopback-only and the supplied nginx config overwrites `X-Forwarded-For`. Never enable that setting on an application port directly reachable by untrusted clients. With a different ingress, restrict direct backend access and make the ingress replace the header with the verified client address.

`/healthz` is liveness and is used by the Docker healthcheck. This keeps the website and account pages routable while data activation is pending. `/readyz` separately requires configured provider credentials and a readable/writable cache; it does not perform billable provider requests. Monitor this stricter endpoint for data availability. A key being configured does not prove that every dataset is entitled—run the data acceptance checks below. Configure your host to alert/restart on unhealthy instances; Docker's `restart: unless-stopped` alone does not restart a running but unhealthy container.

### Existing Coolify GitHub application

Use `Slayer-F1/bineisa-site`, branch `main`, the **Dockerfile** build pack, Dockerfile `/Dockerfile`, and internal port **80**. Preserve the existing domain and HTTPS configuration. For a Coolify-managed healthcheck, use HTTP, host **127.0.0.1**, port **80**, path **/healthz**. Keep healthchecks enabled. The image also includes its own IPv4 healthcheck and installs `curl` for Coolify versions that generate a `localhost` probe. Alpine's bundled `wget` can select IPv6 localhost without falling back to the application's IPv4 listener.

Add `EODHD_API_KEY` as a runtime environment secret after the licensed subscription is available, with `MARKET_EXCHANGES=US` initially. Set `REDIS_URL` only when a reachable Redis service has been provisioned; leaving it unset uses the single-instance memory store. Do not use the public demo token in production. Leave `TRUST_PROXY` unset until the ingress client-IP handling has been verified. Multiple replicas require the shared Redis configuration described below.

Enable Auto Deploy for push-triggered updates, or use Deploy manually after updating `main`. The repository update alone cannot verify that the Coolify webhook ran or that its build pack, branch and environment are correct. Confirm the deployed commit in Coolify and check `/healthz`, `/readyz` and a stock detail page after deployment. Missing market credentials intentionally leave data endpoints unavailable while the website remains accessible.

Reference: [Coolify health checks](https://coolify.io/docs/applications/configuration/health-checks).

## 4. Scaling and limits

All application instances must share the same `REDIS_URL` to share cached data, quota counters and provider cooldown. Local single-process development uses bounded memory storage. In-memory control counters are kept separate from evictable data responses. The Redis instance uses `noeviction`, so cache pressure cannot silently reset rate limits. Cache or quota failures return service-unavailable responses; they do not fall through to unlimited provider requests.

Quotes are cached for 60 seconds; search, screener and news for five minutes; historical prices for one hour; fundamentals for six hours; exchange metadata for one day. Provider dates remain distinct from cache retrieval times. Invalid top-level provider payloads are rejected before caching. Concurrent identical requests on one process are coalesced; different instances rely on the shared cache and global request budget.

The client budget is 120 requests/minute per verified IP. `PROVIDER_REQUESTS_PER_MINUTE` defaults to 120 upstream HTTP requests/minute globally. It is a request budget, **not a monetary cap or a provider-credit budget**: batched quotes and fundamentals have different provider billing weights. Set the value to fit the subscription and configure provider-side usage alerts. A provider 429/5xx creates a short shared cooldown. Provider responses time out after ten seconds. Redis operations are separately bounded and offline queuing is disabled; exhausted reconnect attempts require a process restart.

Monitor cache memory, readiness, provider 401/403/429, request latency, and auth delivery before increasing replica count. The code is designed for shared caching but has not been load-tested at production traffic levels.

## 5. BIN EISA ecosystem

All stocks-site Invest Now links point directly to `https://bineisa.com/`. Contact details are `info@bineisa.com`, `+971 54 336 6554`, Instagram `@bineisa.ae`, and TikTok `@bineisa_ae`.

Install `integrations/bineisa-stocks-nav.liquid` in the Shopify theme for bineisa.com and render it in the header and/or footer:

```liquid
{% render 'bineisa-stocks-nav' %}
```

This creates the reverse link to the stocks site. The live Shopify theme has not been changed from this repository. The main site's currently published email was observed as `info@bineisa.ae`; the stocks platform uses the user-requested `info@bineisa.com`. Update the Shopify contact block as part of the main-site change if both should match.

## 6. Final data acceptance

With the actual BIN EISA provider key, verify exchange discovery, a company-name search, a paged/sorted screener, a symbol from each enabled market, quote timestamps, five chart ranges, annual and quarterly financial reports, CSV export, news and private-list persistence. Search and full-screeners cannot be accepted using EODHD's limited public demo key. No fallback static prices are included.

Shariah classifications, purification percentages, custom intrinsic-value models and editorial investment recommendations are not supplied by this implementation. Adding those requires separately licensed data or a reviewed research methodology; the reference site's content must not be copied.

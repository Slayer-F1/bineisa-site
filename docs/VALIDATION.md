# Validation record

Local verification completed September 14, 2026. This records development acceptance, not a production launch or full AliStocks feature-parity certification.

## Automated checks

- `node --test`: 29 passing tests (26 top-level tests and three readiness cases).
- `node scripts/check.mjs`: syntax checks for 18 JavaScript modules and ecosystem-link checks.
- Provider tests cover actual documented request shapes, normalization, timestamps, absent values, safe links, entitlement errors, cooldowns, request coalescing and invalid-payload rejection before caching.
- Cache tests cover atomic concurrent quota increments, quota retention under data-cache pressure, bounded command failure and sanitized errors. Readiness requires both configured credentials and cache writes; liveness remains available during a cache failure.
- HTTP tests exercise app routes, structured errors, input validation and denial of internal files.
- Watchlist tests cover guest persistence, failed writes, signed-out private-data races and account errors. These use controlled storage doubles; they do not replace a live database ownership test.
- CSV tests verify formula-like text is escaped while negative financial numbers remain numeric text.

## Browser and real-provider checks

Used Chromium through the Codex browser against the local Node service, including EODHD's explicit public demo token. No hard-coded prices or local response fixtures were substituted in these browser checks.

- AAPL.US detail loaded a delayed quote with provider timestamp, company profile, fundamentals, analyst metrics and daily adjusted price history.
- Annual and quarterly financial tables rendered; switching reporting periods changed the statements. Financial-table overflow remained inside its scroll container.
- Chart range selection worked; the chart exposes an accessible daily-price slider and provider/source labels.
- Saving AAPL.US updated the button to **Watching**. Navigating to Watchlist preserved the saved symbol and loaded its delayed quote. Removal and re-saving worked.
- Company news loaded real publisher headlines and sentiment. Saving a headline and opening **Saved on this device** displayed the saved story.
- Search submitted the company query and exchange to the server. The demo's missing search entitlement produced the explicit subscription error state rather than false results. Full search/screener/report-library success still requires the licensed key.
- Private stocks correctly showed the sign-in gate when signed out.
- Sign-in page, research-account copy, links back to the home page, shared footer and registration links were inspected. No OTP was sent to another person's email address.
- At a 390 × 844 viewport, stock details, navigation, watchlist, news and sign-in were inspected. Watchlist and news measured document `scrollWidth = clientWidth = 375` (browser scrollbar accounts for the remaining width). Arabic watchlist switched to RTL with the same no-overflow measurement.
- Phone navigation includes search, stocks, reports, news, watchlist, private stocks and account. Invest Now remains accessible and points to `https://bineisa.com/`.
- Footer links include the official email, phone, Instagram and TikTok destinations. The viewport override was reset after testing.

## Reference comparison

The public home, stock directory, reports, news, stock overview and navigation were compared with AliStocks. Account and private-list prompts were inspected without submitting personal details. The fair-value route was revisited on September 14 and returned a guest prompt and stock-not-found state, so its calculation could not be verified. See [REFERENCE-COMPARISON.md](REFERENCE-COMPARISON.md) for the feature matrix and unsupported proprietary features.

## Still required before launch

1. Configure the licensed BIN EISA EODHD key with confirmed public-display rights and endpoint entitlements; accept search, screening, pagination and all enabled-market datasets against that subscription.
2. Apply the additive Supabase migration and run real-account, cross-device and two-user RLS isolation checks. Confirm branded OTP delivery and allowed redirect URLs.
3. Build and run the production container with Redis on the target host. The local Docker daemon was initially unavailable; the subsequent September 16 container checks below passed. Live Redis integration and production load testing remain outstanding.
4. Test on physical iPhone/Safari and Android/Chrome. Responsive Chromium checks do not certify device-specific behavior or WebKit.
5. Deploy to bineisastocks.com and install the supplied reverse-link snippet in the bineisa.com Shopify theme. Neither live site was changed during local verification.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the exact configuration and acceptance steps.

## Coolify healthcheck regression — September 16

The deployment log for commit `7b482ec` showed a generated `localhost:80/healthz` probe failing, despite Node listening on port 80. Rebuilt that image locally with Docker 29.5.3 and reproduced the failure: Alpine `wget` against `localhost` returned connection refused, while `127.0.0.1` returned HTTP 200 with `marketData: not-configured`.

The corrected Dockerfile installs Alpine's `curl` package and uses an explicit IPv4 liveness probe. A new image built successfully, and a temporary container tested with the same curl-first localhost probe became **healthy**, with consecutive exit-code-zero healthchecks. Verbose curl confirmed that localhost resolved to `::1` and `127.0.0.1`; after the IPv6 connection was refused, it connected successfully to IPv4 and received HTTP 200. The image's own `127.0.0.1:80/healthz` probe also passed.

This verifies the container correction without disabling healthchecks or requiring market-data credentials. Redeploy the new commit in Coolify so it builds the corrected image; a deployment pinned to the old commit may reuse the failing cached image.

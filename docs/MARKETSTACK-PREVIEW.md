# Marketstack local preview — September 19, 2026

The owner initially chose a local preview, then explicitly requested public deployment using the free plan after being informed of its non-commercial designation. No subscription was purchased or upgraded. This instruction does not change the provider’s terms or establish commercial rights.

## Start

The owner's key is stored only in the ignored `.env.marketstack.local` file on this machine. It is excluded from Git and Docker builds and never sent to the frontend.

```powershell
npm run preview:marketstack
```

Open `http://127.0.0.1:3005`. For this Windows environment use `C:\Program Files\nodejs\npm.cmd` if the PowerShell npm shim is unavailable. The server binds to loopback only. If the preview is already running, use it instead of starting a second instance.

For a different machine create the ignored `.env.marketstack.local` with these values and enter the key locally:

```dotenv
MARKET_PROVIDER=marketstack
MARKETSTACK_API_KEY=
MARKETSTACK_CACHE_SECONDS=604800
MARKETSTACK_MONTHLY_BUDGET=80
MARKET_CACHE_DIR=./artifacts/market-cache
NODE_ENV=development
HOST=127.0.0.1
PORT=3005
```

## Reference universe

AliStocks' visible `/analytics` table showed **1–7 of 7** results on September 19: AMD, APPF, ARLO, AVGO, AZZ, BCC, BHE. These public identifiers select the collection; this does not claim access to any additional private directory. Names, OHLC prices, volumes, dates and currency come from the Marketstack v2 API, not AliStocks. No prices, company names, financials, screening labels or editorial analysis are copied into source files.

## Actual coverage

- Seven company pages, search by provider name/symbol, closing prices, daily adjusted returns, volume, exchange and currency.
- One year of adjusted daily history; 1M/3M/6M/1Y charts, historical range, 50/200-session moving averages, price reports, CSV and print/PDF.
- Guest watchlists, existing account/private-list UI, black/gold identity, English/Arabic and Invest Now links.
- Financial statements, market cap, analyst targets, intrinsic valuation, sector/industry screening, news and Sharia-screening data are **not supplied by this connection**. The UI states these limits and does not fabricate replacements.

## Quota and persistence

Marketstack's [free plan](https://marketstack.com/pricing) shows 100 requests/month, one year of history, and non-commercial use. [Each requested symbol counts as a request](https://marketstack.com/contact). The adapter fetches a company's one-year series once and derives the quote, chart, table and price report from it. Requests are coalesced; browsing cached data does not contact Marketstack again.

Each company refreshes on demand after seven days. Seven weekly company requests ordinarily use roughly 28–35 units/month, excluding initial testing and requests from other clients using the same account. An internal 80-request monthly cap leaves headroom. The provider's own billing window and other API clients may differ from this application's calendar-month counter.

Single-process data and quota persistence uses `artifacts/market-cache/market-cache.json`, written atomically. Do not delete it to refresh the website: doing so also discards the local quota history. The cache contains data and hashed key namespaces, not credentials. It is not a substitute for shared Redis when running replicas. The UI displays actual price dates and weekly refresh timing; these are not live prices.

## Public deployment

Set MARKET_PROVIDER=marketstack and store MARKETSTACK_API_KEY as a runtime-only secret in Coolify. Set MARKET_CACHE_DIR=/app/artifacts/market-cache and mount a named persistent volume there. Run one replica with the default weekly refresh and 80-request monthly cap. The EODHD adapter remains available via MARKET_PROVIDER=eodhd. Public activation does not add financial/news/Sharia datasets or establish commercial data rights.

Registration email delivery and the Supabase watchlist migration remain separate outstanding setup work from the earlier deployment; this preview does not certify signed-in acceptance.

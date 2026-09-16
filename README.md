# BIN EISA Stocks

Stock research platform for **bineisastocks.com**, in **Slayer-F1/bineisa-site**. The main business website is **https://bineisa.com/**. Every Invest Now link leads there.

The existing vanilla HTML/CSS/JavaScript stack and Supabase passwordless accounts are retained. A Node.js backend now supplies authenticated, cached EODHD data. The former corporate homepage is preserved in `company.html`.

## Run locally

Requires Node.js 22 or later.

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

Open http://127.0.0.1:3000. Without a provider key, the application displays an explicit unavailable state; it does not invent stock data. Set `EODHD_API_KEY` in `.env` or the deployment's secret manager. Never put it in `assets/config.js`.

EODHD's public `demo` token may be used explicitly in local development for its permitted symbols. Search, exchange discovery and full screeners require an account entitlement. A demo token is rejected when `NODE_ENV=production`. There is no automatic demo fallback.

## Features

- Market screener with provider search, sector, industry, listing-country and exchange filters, sorting and pagination.
- Stock detail URLs with delayed quotes, daily adjusted price history, company profiles, key metrics and analyst consensus.
- Annual and quarterly income statements, balance sheets and cash flows; CSV and browser print/PDF export.
- Provider news with publisher links, sentiment filters, device-local saving and sharing.
- Device-local guest watchlist, account-backed watchlists, and private research lists with notes.
- English/Arabic navigation, RTL layouts, mobile navigation and horizontally scrollable financial tables.
- Official BIN EISA contacts and social links, persistent Invest Now actions, and a Shopify snippet for the reverse link on bineisa.com.

## Verification

```powershell
npm test
npm run check
```

See [deployment instructions](docs/DEPLOYMENT.md), [reference comparison](docs/REFERENCE-COMPARISON.md), and [validation record](docs/VALIDATION.md).

## Launch status

The application code and provider adapter are implemented. Production activation still requires a commercial provider credential and confirmed dataset entitlements, applying the Supabase watchlist migration, and deployment to the existing host. The reverse link on Shopify is prepared but is not installed by this repository. A full licensed-data and signed-in acceptance run remains required before claiming launch completion.

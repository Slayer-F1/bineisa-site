# AliStocks reference comparison

Public pages were inspected during September 10–14, 2026. AliStocks is used as a functional reference, not as a content, logo or data source. Its public focus is US equities. Its guest/account prompts limit what can be verified beyond public previews. The fair-value route returned a guest prompt and stock-not-found state on the final revisit, so no calculation parity is claimed.

| Area | Reference observation | BIN EISA implementation / remaining limit |
|---|---|---|
| Home | Search-led landing page, stock entry points, reports and platform navigation | Original black/gold research homepage, provider search, market overview, research shortcuts and Invest Now links |
| Stocks (`/analytics`) | Symbol/company table; sector, industry and country filters; prices, exchange, cap, analyst target and purification fields; paging | `/stocks` provider screener with sector/industry/market filters, sorting, paging and timestamped prices. Country means **listing country** under the chosen API; it does not infer issuer domicile. Analyst consensus is on detail pages. Purification is not invented. |
| Stock overview (`/stock/ALAB/overview`) | Company/sector/exchange, price, market cap, technical metrics, 52-week range, analyst target and third-party screening | `/stocks/{symbol.exchange}` with quote, history, company profile, fundamentals, technical fields and analyst tab. Reference screening and AI-written summaries are not copied. |
| Stock tabs | Overview, fair value, platform reports, analyst articles, analyst ratings, news and charts | Overview with chart; financials/reports; analyst consensus; company news. These group related tasks into four tabs. No unsupported intrinsic-value output or proprietary editorial report is fabricated. |
| Reports (`/reports`) | Financial-analysis cards with recommendation, date, numerical score and pagination | Provider company-report library; annual and quarterly income, balance and cash-flow tables; CSV and print/PDF. No unsourced recommendation scores. Full library access requires screener entitlement. |
| News (`/news`) | Headlines, sentiment filtering, save/share and paging | Provider headlines, publisher links, sentiment, page filtering, device-local saving, sharing and paging |
| Search | Company/ticker search and quick symbol entry | Server-side provider search by company, symbol or ISIN with exchange filter |
| Watchlist | Access prompts require login | Guest list on device; account list stored in Supabase after migration |
| Private stocks | Same login prompt; private records cannot be inspected anonymously | Owner-only personal collection of listed stocks with private notes; Supabase RLS migration required. No claim of an unlisted-securities marketplace. |
| Account/login | Registration/sign-in gate in the reference | Existing Supabase email-code authentication retained, return-to-list behavior added and account links connected |
| Mobile | Navigation and tabular stock research | Responsive navigation, sticky Invest Now, scrollable data/financial tables, responsive chart, Arabic/RTL layouts. Device-width checks are recorded in VALIDATION.md. |
| Branding/ecosystem | AliStocks-specific identity and screening content | BIN EISA typography, colors and existing BE monogram; official requested contacts/social links; direct links to bineisa.com. Reverse Shopify link supplied separately. |

## Completion boundary

The new code implements the requested research workflows and a real provider adapter. It is not yet a fully launched replacement: full data entitlement, deployed Supabase migration, real-account acceptance testing, host deployment and the Shopify reverse link remain external activation work. This document intentionally does not certify full feature parity with inaccessible private screens or with the reference's proprietary analysis and Shariah data.

## September 19: free local preview

The owner supplied a Marketstack Free key and explicitly chose local preview only. The visible AliStocks analytics table showed 1–7 of 7 symbols: AMD, APPF, ARLO, AVGO, AZZ, BCC and BHE. The preview uses exactly these identifiers, with all names and market values obtained independently from Marketstack. This verifies the visible collection, not any undisclosed or private stocks.

The preview keeps BIN EISA black/gold branding and the existing research navigation. It adds seven homepage stock shortcuts, a volume/exchange/closing-price table, provider-backed search, individual price charts, calculated price statistics and downloadable price reports. Unlike the broader EODHD implementation, the free preview does not claim financial statements, market cap, analyst targets, news or Sharia-screening coverage. Those missing sources prevent full functional parity with AliStocks. See [Marketstack preview](MARKETSTACK-PREVIEW.md).

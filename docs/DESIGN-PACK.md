# BIN EISA design pack — how it is applied here

This repository is **bineisastocks.com**, the research platform. The design pack (delivered October 2026 as
`Plans-UP.zip`, `Images.zip`, `BinEisa_website_Logo brand.zip`, plus a Figma file) is primarily the layout for the main
website, **bineisa.com**, which is hosted on Shopify and is not part of this repository. The visual language,
photography, logo and page structure were applied here so the two sites read as one brand.

## What the pack contained

| Source | Contents | Used here |
|---|---|---|
| `Images.zip` (twice, identical) | `hero.png` (1020×720), `approach.png` (700×490) | Yes — re-cut from the 1536×1024 originals embedded in the PDF exports, which are larger |
| `BinEisa_website_Logo brand.zip` → `Website/` | Four flattened Figma PDF exports: Home and Product (Starter plan), each at 1440 and 390 | Home layout, tokens, photography |
| `BinEisa_website_Logo brand.zip` → `Plans/` | Six plan-card SVGs (outlined paths, no live text) | Not used |
| `Plans-UP.zip` | Six plan-card PNGs (740×840) | Not used (see below) |
| Figma file "BIN EISA Investment — Concept 2" (public view link) | Page "Home — Concept 2": Home and Product frames (desktop and mobile), six plan badge cards, a mobile sticky "Invest" bar, and the **Logo** frame. Page "Tokens & Components": icon set, button, plan card, step, tile, FAQ row, nav item | Logo frame and palette; frames confirmed against the PDFs |

The archives contain no `.fig` source and no logo files; the logo only exists in the Figma file. The Figma link is
view-only without an account, so the inspect panel (font names, exact spacing) was not available: typefaces were matched
by eye, and colours were read from the canvas and from the PDF colour operators.

## Logo and layout (Figma Home frame)

The Figma file is the source of truth and is edited live. With a signed-in view the Properties panel gives exact values;
the ones used here were read on 15 Oct 2026:

| Element | Figma value |
|---|---|
| Logo | "Typographic logo BIN EISA (Inter Bold / Helvetica Bold look, navy)", 139 × 33 px, preceded by a small three-bar gold glyph |
| Header | 96 px, logo at x=118, menu gap 36 px, actions 38 px high with 14 px gap, transparent over the hero |
| Hero | 1440 × 720, photo 1020 wide from x=420, fade 420 wide from x=410, copy block at top 170 / left 100 |
| Hero type | Heading: Cormorant Garamond 600, 80 px, line-height 98 %; eyebrow: Montserrat 600, 11 px, 18 % tracking; body: Montserrat 400, 14 px, 160 % |
| Buttons | Radius 3 px, 48 px high in the hero, gap 10 px |
| Sections | Padding 96 px top and bottom, 100 px sides (stat strip 30 / 120); heights: stats 122, approach 622, cycle 413, businesses 556, FAQ 523, closing band 520, footer 193 |
| Page tokens | `surface/page #F7F7F5`, `surface/alt #F0F0ED`, `surface/card #FFFFFF`, `text/heading #101826` |

Implemented in the override block at the end of `assets/stocks.css` ("Figma layout"). The header lockup is the Home
frame's glyph plus Inter Bold wordmark, with a small tracked product label ("STOCKS", "GENERAL TRADING") added after a
hairline. The serif **B** mark from the Logo frame (`assets/logo-avatar.svg`, `assets/favicon.svg`,
`assets/apple-touch-icon.png`) is kept for the sign-in emblem, favicon and touch icon, as the Logo frame specifies.

The closing band uses the pack's suited-man photograph (`assets/cta-*.jpg`) with a neutral "Find your next company"
message; none of the offering copy that accompanies it in the pack is used.

The logo SVGs that remain (`logo-mark.svg`, `logo-wordmark.svg`, `logo-avatar.svg`) are traces of the Logo frame, not the
designer's exports.

## Tokens

The brand sheet palette is: Navy `#15293A`, Bronze `#BA9E68`, Deep bronze `#A2834F`, Cream `#F7F4EE`, Sand `#E9E1D2`,
Stone `#6B7680`. The website frames use a slightly different set, which is what the page CSS follows:

| Role | Value | Where |
|---|---|---|
| Page | `#F7F7F5` | `--bg` |
| Alternate section / hover | `#F0F0ED` | `--panel-2` |
| Card | `#FFFFFF` | `--panel` |
| Hairline | `#E2E2DE` | `--line` |
| Navy (headings, primary button, CTA band) | `#101826` / `#0E1B2C` (buttons) | `--navy`, `--navy-2` |
| Brand gold (lines, icons, large type) | `#A8844F` | `--gold-brand` |
| Light gold | `#C9A66B` | `--gold-light` |
| Pale gold | `#E9DFCF` | `--gold-soft` |
| Body grey | `#4A5160` | `--body` |
| Stone (product label under the wordmark) | `#6B7680` | `--stone` |

The logo keeps the brand-sheet colours; page chrome keeps the frame colours. The frame button fill was sampled from the
Figma canvas as `#0E1B2C`.

Two adjustments were made for legibility, because the pack's values fall short of WCAG AA for small text on the
light page: small gold text uses `#8A6A35` (`--gold`, 4.7:1) instead of `#A8844F` (3.2:1), and muted text uses
`#5F6673` (`--muted`, 5.4:1) instead of `#7A808B` (3.7:1). The exact brand values are still used for borders, icons
and large type.

Fonts (matched by eye): **Cormorant Garamond** (display), **Montserrat** (interface), **Tajawal** (Arabic body),
**Amiri** (Arabic display). Prices and metrics use lining numerals, because Cormorant's default old-style figures make
a price such as `608.10` easy to misread.

## Page mapping

| Pack element (Home, desktop) | Implementation |
|---|---|
| Header: wordmark, centred navigation, navy "Invest now" button, search and account icons | `.market-header`: transparent over the hero, solid after scrolling; the button is a neutral "Main website ↗" link |
| Hero: eyebrow, serif title, one line of copy, button, photo fading into the page | `.home-hero` with `hero-*.jpg`; the fade is mirrored in RTL |
| Three-item strip: minimum investment, period, target return | `.stat-strip`: coverage, data source and freshness, saved lists |
| "Choose your plan": six priced cards | Not built (see below) |
| "Our approach": image and text | `.approach` with `approach-*.jpg`, linking to Data & methodology |
| "Your investment cycle": five steps joined by arrows | `.process`: four research steps joined by arrows — search, review, save, revisit |
| "Real businesses. Real opportunities.": six photo tiles | `.group` / `.biz-grid`: four tiles — car import, global product imports, digital businesses, technology |
| FAQ: six questions about returns and withdrawals | `.faq-section`: four questions written for a research platform; the answers fill in the live provider and quote label |
| "Ready to invest?" band over the suited-man photo | `.cta-band`: solid navy, one button to search, no photograph |
| Footer: wordmark, links, social icons, legal row | `ecosystem.js`: four columns with the logo lockup; Instagram `@bineisa.ae` and TikTok `@bineisa_ae` as round icon links, plus `info@bineisa.com` and `+971 54 336 6554` |
| Mobile sticky "Invest" bar | Not built (see below) |

The inner pages (stock list, detail, reports, news, watchlists, account, sign-in, legal) have no counterpart in the
pack; they take the same tokens, header, buttons and footer.

## Not implemented, deliberately

The pack's bineisa.com pages are an investment-offering funnel, and none of it was built on this site:

- six priced plan cards, AED 1,000 to AED 50,000, each with "6 months" and "3% target monthly return";
- the "investment cycle" row, which promises a 3% return and "your original capital remains secure";
- the Starter product page: a month-by-month growth example (AED 1,000 → AED 1,194.05, "19.41%"), "capital
  security", "risk level: moderate" and plan-comparison details;
- every "Invest now", "Get started" and "Ready to invest?" call to action, including the mobile sticky bar;
- the "Finance & Investment" (handshake) and "UAE Real Estate Plans" (villa) business tiles, and the suited-man,
  handshake and villa photographs;
- the six returns-and-withdrawals FAQ questions.

The stocks platform is a research product that executes no trades and holds no funds. Offering and promoting an
investment product to the public in the UAE is a licensed activity, and putting plan prices and return targets beside
live market data would lend that offer a credibility this site cannot back. The earlier "Invest Now" buttons on this
site were replaced by a neutral "Main website" link.

## Assets

`assets/hero-{600,900,1536}.jpg` (black supercar at Dubai Marina), `assets/approach-{700,1200}.jpg` (desk above the
skyline), `assets/tile-{car,port,digital,tech}.jpg` (800 px, cropped to 3:2) — JPEG, quality 78, progressive, 834 KB
in total, generated from the PDF-embedded originals with `PIL`. The server only serves flat files under `assets/` with
the extensions `css|js|svg|png|jpg|woff2`, which is why the images are JPEGs in a single directory and the logo files
sit beside them.

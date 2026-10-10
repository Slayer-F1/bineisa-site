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

## Logo

The Figma **Logo** frame defines the mark: a hand-drawn, high-contrast serif **B** in navy with **three bronze bars**
stepping up to it ("navy for trust, bronze for value, cream for calm"). The frame also shows an on-navy version, a
one-colour version, an app icon, a social avatar / favicon (64 / 32 / 16) and a horizontal lockup: mark, hairline rule,
serif **BIN EISA** wordmark, and a small tracked label (the sheet says "INVESTMENT · UAE"; this site uses "STOCKS").

| File | Use |
|---|---|
| `assets/logo-mark.svg` | Header and footer lockup (navy B, bronze gradient bars) |
| `assets/logo-wordmark.svg` | The serif BIN EISA wordmark |
| `assets/logo-avatar.svg`, `assets/favicon.svg` | Navy circle, cream B, bronze bars — sign-in emblem and browser favicon |
| `assets/apple-touch-icon.png` | 180 × 180 full-bleed navy square for iOS home screens |

**Provenance:** the SVGs are sub-pixel traces of the Figma canvas (mark at 160 % zoom, wordmark at 330 %), not the
designer's exported vectors, because the file was view-only. Colours and proportions are measured from the sheet; the
bar gradient is Bronze `#BA9E68` to Deep bronze `#A2834F` over each bar's own height. Replace the four SVGs with
exports from the Figma Logo frame when available; the file names and viewBox aspect ratios can stay the same.

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
| Header: wordmark, centred navigation, navy "Invest now" button, search and account icons | `.market-header` with the logo lockup; the button is a neutral "Main website ↗" link |
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

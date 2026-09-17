# Latte with Lata

**Real Conversations. Built on Purpose.**

The website for Latte with Lata: a podcast cafe where mission-driven leaders sit down for candid, unhurried conversation, hosted by founder Lata Singh.

This is a zero-build static site. There is no framework and no bundler: plain HTML, CSS and ES modules, with GSAP 3.13 and Splide 4 vendored locally.

## Run it locally

```bash
node serve.cjs 5178
```

Then open http://localhost:5178/. Any static file server works too; ES modules need HTTP, so opening `index.html` from disk will not run the animations.

## How the page is put together

| Path | What it is |
|---|---|
| `index.html` | The assembled page. Generated, do not hand-edit. |
| `sections/NN-name.html` | One fragment per section, the source of truth for markup. |
| `build-index.cjs` | Regenerates `index.html` from the fragments: `node build-index.cjs` |
| `css/tokens.css`, `css/base.css`, `css/fonts.css` | Brand tokens, shared layout and type roles, Creato Display faces. |
| `css/sections/`, `js/sections/` | One stylesheet and one module per section. |
| `js/core.js`, `js/carousel.js`, `js/main.js` | Shared motion helpers, carousel engine, page bootstrap. |
| `content/site.json` | All site copy in one place. `content/COPY.md` is the readable version and lists every placeholder. |
| `assets/brand/` | Logo marks and lockups, Creato Display fonts, founder photo. See `LOGO-USAGE.md` and `BRAND.md`. |
| `vendor/` | GSAP 3.13 (core, ScrollTrigger, SplitText, ScrollToPlugin) and Splide 4.1.4. |

To change copy: edit the text in the matching `sections/*.html` fragment (and `content/site.json` to keep the source of truth in sync), then run `node build-index.cjs`.

## Brand

- Typeface: Creato Display (SIL Open Font License), self-hosted.
- Colours: espresso `#502506`, caramel `#81532e`, white `#ffffff`.
- Mark: the cup-with-LATA logo in brown, white and black variants.

Full token sheet and usage rules are in `BRAND.md` and `LOGO-USAGE.md`.

## Before going live

These are placeholders in the current build and need real values:

- Booking, directions, podcast platform, social and episode links are `#`.
- The newsletter form has no endpoint.
- Address, phone, email, opening hours, menu prices and the six episodes are sample content (`content/COPY.md` lists them all).
- The hero video ships as WebM only; add an H.264 MP4 for older iOS Safari.
- `og:image` is site-relative until the production domain is known.

## Photo and video credits

Photography and the hero clip come from Wikimedia Commons under CC0, CC BY and CC BY-SA licences. Attribution is required for the CC BY items; every file, author, licence and a ready-to-paste credit line is in `ASSETS.md`. The founder portrait and the logo files are the property of Latte with Lata.

Latte with Lata is a personal platform and is independent of any employer or institution.

Site by Agora Data Driven.

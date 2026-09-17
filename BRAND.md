# Latte with Lata - brand design tokens (2026-09-17)

The client's brand kit (`assets/brand/`) is the design system. This sheet is the contract every lane reads;
the live values are in `css/tokens.css` (colour, type, logo sizes, motion, focus, z-index), the faces in
`css/fonts.css`, the roles in `css/base.css` section 3 / 10 / 11 / 17. Old token names from the study rebuild
(`--colNero`, `--colBianco`, `--colContrasto`, `--colGrigioLeggero`, ...) survive as aliases - see tokens.css section 3.

## 1. Colour

Contrast = WCAG 2.x relative-luminance ratio `(L1 + 0.05) / (L2 + 0.05)`, L from sRGB channels linearised with
`c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ^ 2.4`, weighted `0.2126 R + 0.7152 G + 0.0722 B`
(scratch `brand-run/tokens/contrast.py`; the Playwright probe confirmed the computed colours on the page).

| Token | Hex | Use | On white | On `--colBrand` |
|---|---|---|---|---|
| `--colBrand` | `#502506` | espresso brown, primary: titles, strong, header plate, drawer, dark bands (`--colNero` alias), buttons, footer wordmark, stamp on light bands | **13.06:1** | - |
| `--colAccent` | `#81532e` | caramel brown, the single accent: 07 manifesto band, link hover, submit, card hover panel, focus ring (`--colContrasto` alias) | **6.54:1** (AA text) | 2.00:1 (non-text only, never text on brand) |
| `--colBg` / `--colBianco` | `#ffffff` | page background, "white" everywhere (the old cream `#faf6f0` is gone) | - | 13.06:1 |
| `--colOnBrand` | `#ffffff` | text and marks on brand / accent / deep | - | 13.06:1 (on accent 6.54:1, on deep 16.97:1) |
| `--colBrandDeep` | `#2f1604` | hero overlay gradient stop, shadows, frosted card base (`--colOverlay` rgb 47 22 4 / .5, `--colOverlayStrong` / .6) | - | - |
| `--colBrandSoft` | `#f6efe7` | menu band (cream-2, `--colGrigioLeggero` alias), soft panels | - | `--colText` on it 9.50:1, `--colTextMuted` 4.76:1, `--colBrand` 11.45:1, `--colAccent` 5.74:1 |
| `--colBrandLine` | `#e6d9cc` | hairlines on white (`--colHr`), input rules - decorative | 1.39:1 (non-text) | - |
| `--colText` | `#4a3a30` | body copy on white / soft | **10.83:1** (AAA) | - |
| `--colTextMuted` | `#7a6658` | captions, meta, consent lines (`--colGrigioScuro` alias) | **5.43:1** (AA) | - |
| `--colAccentTint` | `#c9a98f` | 07 colour-scrub START tint (transient, tweens to white) | - | on accent 2.98:1 - transient only |
| `--colContrastoScuro` | `#674225` | pressed / submit hover (accent -20%) | 8.81:1 | - |
| `--colLineOnBrand` | `rgb(255 255 255 / .25)` | hairlines on brown bands | - | non-text |
| `--colTextOnBrandMuted` | `rgb(255 255 255 / .8)` | secondary text on brown bands | - | ~10.7:1 |

Band classes: `.bg-band-cream2` = soft, `.bg-band-accent` = accent + white text, `.bg-band-black` / `.bg-band-brand` = brand +
white text. On the brand and accent bands the tokens `--colTitle`, `--colStamp`, `--colStrong`, `--colFocus` flip to white and
`--colHr` to `--colLineOnBrand` automatically.

Single-accent rule: `--colAccent` is the only accent. No orange, no gold, no second brown for emphasis.

## 2. Type - Creato Display only (SIL OFL, self-hosted woff2 + otf fallback, `font-display: swap`)

Weights shipped: 300, 400, 500, 700, 800 + 400/700 italic (`assets/brand/fonts/creato_display/*.woff2`, ~19 KB each).
Preload Regular + Bold. A `font-weight: 600` request resolves to 700. Fraunces and Noto Sans are retired.

| Role | Selector(s) | Weight | Size (unchanged clamps) | Line-height | Tracking | Case |
|---|---|---|---|---|---|---|
| Hero wordmark | `.hero__wordmark` | 800 | `clamp(48px, 14vw, 232px)` (201.6 @1440, 54.6 @390) | .9 | -.02em | upper |
| Footer wordmark | `.footer-wordmark span` | 800 | `clamp(48px, 11vw, 170px)` | .9 | -.02em | upper |
| Section title | `.strip__title1` (h1/h2) | 700 | `clamp(33.3px, 6vw, 60px)` | 1 | -.01em | upper |
| Title 2-5 | `.strip__title2..5` | 700 | PZ clamps (30-50, ...) | 1 | -.01em | upper |
| Drawer link | `#menu-container .menu__main` | 700 | `clamp(35.3px, 4vw, 60px)` | 1 | -.01em | upper |
| Marquee | `#s-08-podcast .marquee` | 700 | `clamp(64px, 10vw, 160px)` | 1 | -.01em | upper |
| Card title | `.episode-card__title` | 700 | `clamp(18px, 1.6vw, 24px)` | 1 | -.01em | upper |
| Twin-card title | `.twin-card__title` | 700 | `clamp(32px, 3.5vw, 51px)` | 1 | -.01em | upper |
| Header wordmark text | `.header__wordmark` | 700 | 15px (hidden below 36em: mark only) | 1 | .12em | upper |
| Manifesto / quote | `.text-decorated` (07, 11) | 500 | `clamp(37.5px, 5.5vw, 50px)` | 1.15 | -.01em | upper (`.text-decorated--sentence` opt-in) |
| Lead | `.podcast__lead`, `.lead` | 500 | `clamp(20px, 1.8vw, 26px)` | 1.25 | -.01em | sentence |
| Eyebrow | `.eyebrow` | 500 | 12px | 1 | .14em | upper |
| Body | `body`, `main p` | 400 | 16px; **17px at >= 60em** (plain `main p` only) | 1.6 | 0 | sentence |
| Caption / meta | `.caption`, `figcaption`, card blurb + meta | 400 | 14px | 1.5 (cards 1.2) | 0 | sentence |
| Button / read-more | `.button`, `.read-more`, `#book-pill` | 700 | .9em | 1.2 / inherit | .08em | upper |
| Tagline | `.hero__tagline` | 500 | 16px | 1.5 | .08em | upper |

`--titleSize` is now `3.75rem` (was `3.75em`) so the title clamps stay at the same px with the 17px body.

## 3. Spacing recap (unchanged Paszkowski ladder)

`--vpad` 1.6rem < 36em, 2.7rem >= 36em, 3.3rem >= 48em, 3.6rem >= 60em (57.6px @1440, 25.6px @390); `.mt/.mb/.pt/.pb-{xs,sm,md,lg}` =
vpad/4, /2, x1, x2; container 75rem + 2 x vpad; narrow 56.25rem; xnarrow 37.5rem; 24-col grid 12/12 at >= 50em; title margins
vpad/2 above, vpad/4 below. Touch targets: `--tapMin` 44px (buttons, read-mores via padding + negative margin, carousel arrows,
burger, header lockup link 47 / 62px tall, socials, pill). Focus: `--focusRing` 2px solid `--colFocus` (accent; white on brand bands), offset 2px, `:focus-visible` only.
Motion tiers: `--aniFast` .3s links, `--aniSlow` .6s reveals/buttons, `--aniUi` .2s hover feedback; `prefers-reduced-motion` kills all.

## 4. Logo

Files: `assets/brand/logo/latte_with_lata_{brown,white,black}.svg` (+ PNG), page mark `assets/svg/mark.svg` (currentColor, used by
`.strip--stamp::after` via mask: brown on light bands, white on brand bands through `--colStamp`). Sizes in tokens: `--markHeader` 44px
(56px >= 60em, white, wordmark text beside it, mark only below 36em; the header bar is burger left + this lockup right, one link home -
there is no "Book a table" link in the bar since UPDATE-3, booking lives in the drawer, the mobile pill and the page CTAs), `--markDrawer` 72px white, `--markHero` clamp(96px, 9vw, 128px)
white above the wordmark, `--markFooter` 120px brown + tagline, favicon brown on white. Clear space = the saucer height on every
side (`--markClear`). Tagline "Real Conversations. Built on Purpose." lives in the hero, the footer, the meta description and og:title only.

## 5. Do / don't

- Do use `--colBrand` for every "black" and `--colOnBrand` for text on it; do use `--colAccent` only as the one accent.
- Do keep body text `--colText` on white / soft; `--colTextMuted` only where the ratio holds (white 5.4:1, soft 4.8:1) - never on brown.
- Do keep uppercase Bold for titles and Medium for quotes / leads; do keep the existing size clamps.
- Do reach 44px hit boxes with padding + equal negative margin so nothing moves.
- Don't stretch, recolour (outside brown / white / black) or put the brown mark on brown; don't add Fraunces / Noto / Playfair / Karla back.
- Don't put `--colAccent` text on `--colBrand` (2:1) or `--colAccentTint` as static text on the accent band (3:1).
- Don't set `--aniTime` globally (it collapses the two motion tiers); scope it.

## 6. Documented exceptions and decisions (brand pass finish, 2026-09-17)

1. **Stacked list links are 28-39 px tall, not 44 px** (12 platforms x4, 13 follow links x5, footer legal / sitemap / listen x13).
   Their hit boxes are padded so they MEET across the list gap (never overlap) and every one is >= 24 px, so WCAG 2.5.8 (AA target
   size) passes under its spacing exception; the brief's 44 px rule would need 44 px rows, which changes the list rhythm and the section
   heights (structure rule). Inline links inside sentences (photo credits, privacy) are exempt by the same criterion.
2. **Brown stamp over photography** (04 column-1 stamp on the barista photo, 05 stamp on the street photo): the Paszkowski stamp geometry
   straddles the white band and the photo by design (half above, half below the seam), so neither the brown nor the white variant works
   on both halves. Kept brown (decorative, no text, pointer-events none); the LOGO-USAGE "overlay first" rule is waived for these two
   instances. The footer seam stamp (instance 4) is OFF instead (brown mark half on the brown 13 band; the 120 px footer mark is the logo).
3. **Quote role = sentence case** in both 07 (manifesto) and 11 (live quote): Medium 500, lh 1.15, size clamp unchanged, "sentence
   case allowed" per the kit. The uppercase version is one class away (`.text-decorated` without `--sentence`).
4. **Tagline case = sentence case everywhere** (hero live text 16 px Medium ls .02em, footer 14 px Regular, `<title>`, og:title, meta
   description). No CSS uppercase on the tagline.
5. **Meta description** = tagline + `brand.metaShort` (158 chars): "Real Conversations. Built on Purpose. A podcast cafe in Harrowfield:
   coffee all week and, Thursday nights, a candid conversation with a mission-driven leader." (`brand.shortDescription` is the fallback).
6. **Focus ring** is drawn as `outline: 2px solid var(--colFocus)` in base.css; the band classes flip `--colFocus` to white, so no section
   needs an override. `--focusRing` stays in tokens.css for reference only (a custom property resolves `var()` where it is declared).
7. **Motion controls** (UPDATE-3, 2026-09-17, client decision): there is NO visible pause / play control anywhere on the site - not on
   the hero video, not on the home 08 ticker, not on the podcast page ticker (08 listen). What stays: the hero video autoplays muted,
   pauses when scrolled off screen and never plays under prefers-reduced-motion or Save-Data (poster shown); both tickers move only
   while on screen (home: ScrollTrigger play / pause of the GSAP loop + the glow class; podcast page: IntersectionObserver toggling
   `.is-paused` on the CSS loop) and are a static white line under prefers-reduced-motion or without JS. The moving copies are
   `aria-hidden`; the sentence is read once from a `.visual-hide` line. Accepted trade-off: WCAG 2.2.2 (Pause, Stop, Hide, level A)
   asks for a pause mechanism on moving content longer than 5 s; the operating system's reduced-motion setting is now the only way
   to stop the tickers.

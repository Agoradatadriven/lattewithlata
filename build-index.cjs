#!/usr/bin/env node
/* ==========================================================================
   Latte with Lata - build-index.cjs (integrator)
   Regenerates index.html from the fifteen section fragments so the fragments stay the source of truth.
     node build-index.cjs            -> writes index.html next to this file
     node build-index.cjs --check    -> only validates the fragments and reports what would be written
   Zero dependencies. Fragments are inlined VERBATIM (their leading comments included) between marker comments.
   Head data comes from content/site.json (brand.name / brand.tagline / brand.shortDescription) and the
   og-image entry of content/assets-manifest.json.
   Skeleton: BUILD-SPEC G4 (load order), G6 (`#page-content` main wrapper, `#top`), Paszkowski rendered.html:99-188
   (body > a.skip-main + header + main#page-content.page__content + footer), Iceberg head pattern for og/twitter tags.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CHECK_ONLY = process.argv.includes('--check');

/* section order = the file contract (00 header, 01-13 inside <main>, 14 footer after it) */
const SECTIONS = [
    '00-header', '01-hero', '02-intro', '03-gallery', '04-story-a', '05-strip', '06-menu', '07-manifesto',
    '08-podcast', '09-episodes', '10-hosts', '11-live', '12-visit-listen', '13-newsletter', '14-footer'
];
const HEADER = SECTIONS[0], FOOTER = SECTIONS[SECTIONS.length - 1];
const MAIN_SECTIONS = SECTIONS.slice(1, -1);

/* expected root element per fragment (single-root contract) */
function expectedRoot(name) {
    if (name === HEADER) return { tag: 'header', id: 'page-header' };
    if (name === FOOTER) return { tag: 'footer', id: 'page-footer' };
    return { tag: 'section', id: 's-' + name };
}

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

/* ---- content (title / description / og image) ---- */
const site = JSON.parse(read('content/site.json'));
const manifest = exists('content/assets-manifest.json') ? JSON.parse(read('content/assets-manifest.json')) : {};
const brand = site.brand || {};
const title = `${brand.name || 'Latte with Lata'} - ${brand.tagline || 'A cafe with a microphone'}`;   // copy.md: brand.name + " - " + brand.tagline
/* brand contract: the tagline opens the meta description; brand.metaShort (<= 120 chars) keeps the whole line <= 160 chars (falls back to shortDescription) */
const description = [brand.tagline, brand.metaShort || brand.shortDescription].filter(Boolean).join(' ');
/* deploy: SITE_ORIGIN=https://example.com node build-index.cjs -> absolute og:image / twitter:image + og:url + canonical (README swap 4) */
const ORIGIN = String(process.env.SITE_ORIGIN || '').replace(/\/+$/, '');
const THEME_COLOR = '#502506';   // = tokens.css --colBrand (the header plate colour)
const OG_IMAGE = 'assets/images/og-image.jpg';
const og = manifest[OG_IMAGE] || { w: 1200, h: 630, alt: '' };
const OG_URL = ORIGIN ? `${ORIGIN}/${OG_IMAGE}` : OG_IMAGE;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---- fragments ---- */
const problems = [];
function loadFragment(name) {
    const rel = `sections/${name}.html`;
    if (!exists(rel)) { problems.push(`${rel} is missing`); return `<!-- ${rel} MISSING -->`; }
    let html = read(rel).replace(/\r\n/g, '\n').replace(/\s+$/, '');
    /* validate the single-root contract: the first tag after the leading comments must be the expected root */
    const stripped = html.replace(/<!--[\s\S]*?-->/g, '').trim();
    const want = expectedRoot(name);
    const rootRe = new RegExp(`^<${want.tag}\\b[^>]*\\bid="${want.id}"`, 'i');
    if (!rootRe.test(stripped)) problems.push(`${rel}: first element is not <${want.tag} id="${want.id}"> (got: ${stripped.slice(0, 60).replace(/\n/g, ' ')}...)`);
    /* every id must be unique across the page (comments excluded) */
    const ids = [...stripped.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    ids.forEach((id) => { if (seenIds.has(id)) problems.push(`duplicate id "${id}" in ${rel} (first seen in ${seenIds.get(id)})`); else seenIds.set(id, rel); });
    return html;
}
const seenIds = new Map();
const fragments = Object.fromEntries(SECTIONS.map((n) => [n, loadFragment(n)]));

/* required static files (load order, G4) */
const CSS = ['css/fonts.css', 'css/tokens.css', 'css/base.css', 'vendor/splide-core.min.css', ...SECTIONS.map((n) => `css/sections/${n}.css`)];
const VENDOR_JS = ['vendor/gsap.min.js', 'vendor/ScrollTrigger.min.js', 'vendor/SplitText.min.js', 'vendor/ScrollToPlugin.min.js', 'vendor/splide.min.js'];
const FONTS = ['assets/brand/fonts/creato_display/CreatoDisplay-Regular.woff2', 'assets/brand/fonts/creato_display/CreatoDisplay-Bold.woff2'];   // brand pass: preload the two Creato faces the first paint needs (css/fonts.css); Fraunces / Noto are retired
[...CSS, ...VENDOR_JS, ...FONTS, 'js/main.js', 'assets/svg/favicon.svg', OG_IMAGE].forEach((p) => { if (!exists(p)) problems.push(`referenced file missing: ${p}`); });
SECTIONS.forEach((n) => { if (!exists(`js/sections/${n}.js`)) problems.push(`js/sections/${n}.js is missing (main.js imports it)`); });

const marker = (name) => `<!-- ===== sections/${name}.html ===== -->`;

/* ---- the page ---- */
const html = `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<!-- no-js -> js-ok before first paint (PZ pattern: .no-js in inline-critical, rendered.html:1 <html class="js-ok ...">); the section CSS carries html:not(.js-ok) fallbacks -->
<script>document.documentElement.classList.replace("no-js","js-ok")</script>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="${THEME_COLOR}">${ORIGIN ? `\n<link rel="canonical" href="${ORIGIN}/">\n<meta property="og:url" content="${ORIGIN}/">` : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(brand.name || '')}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${OG_URL}">
<meta property="og:image:width" content="${og.w}">
<meta property="og:image:height" content="${og.h}">
<meta property="og:image:alt" content="${esc(og.alt || '')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${OG_URL}">
<link rel="icon" href="assets/svg/favicon.svg" type="image/svg+xml">
<link rel="preload" href="${FONTS[0]}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${FONTS[1]}" as="font" type="font/woff2" crossorigin>
${CSS.map((p) => `<link rel="stylesheet" href="${p}">`).join('\n')}
</head>
<body id="top">
<a class="skip-main" href="#page-content">Skip to main content</a>

${marker(HEADER)}
${fragments[HEADER]}

<main id="page-content" class="page__content">
${MAIN_SECTIONS.map((n) => `${marker(n)}\n${fragments[n]}`).join('\n\n')}
</main>

${marker(FOOTER)}
${fragments[FOOTER]}

${VENDOR_JS.map((p) => `<script src="${p}"></script>`).join('\n')}
<script type="module" src="js/main.js"></script>
</body>
</html>
`;

if (problems.length) {
    console.error('build-index: problems found');
    problems.forEach((p) => console.error('  - ' + p));
}
if (CHECK_ONLY) {
    console.log(`build-index --check: ${SECTIONS.length} fragments, ${html.length} bytes would be written${problems.length ? ', ' + problems.length + ' problem(s)' : ''}`);
    process.exit(problems.length ? 1 : 0);
}
fs.writeFileSync(path.join(ROOT, 'index.html'), html, 'utf8');
console.log(`build-index: wrote index.html (${html.length} bytes, ${SECTIONS.length} fragments)${problems.length ? ' WITH ' + problems.length + ' problem(s) - see above' : ''}`);
process.exit(problems.length ? 1 : 0);

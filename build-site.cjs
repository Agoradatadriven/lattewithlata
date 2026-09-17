#!/usr/bin/env node
/* ==========================================================================
   Latte with Lata - build-site.cjs (SHELL lane, PAGES-SPEC 2)
   Zero-dependency assembler for the whole site. Fragments stay the source of truth and are inlined VERBATIM (leading comments
   included) between marker comments.

     node build-site.cjs                 -> index.html + every sub-page whose folder has fragments + admin.html
     node build-site.cjs cafe menu       -> only those outputs ("home" / "index" = index.html, "admin" = admin.html)
     node build-site.cjs --check [...]   -> validate + report, write nothing (exit 1 when a problem is found)
     SITE_ORIGIN=https://your.domain node build-site.cjs   -> absolute og:image / twitter:image + og:url + canonical on every page

   index.html   <- sections/NN-name.html            (the fifteen home fragments; same output contract as the old build-index.cjs)
   <page>.html  <- pages/<page>/NN-name.html        (cafe menu podcast episodes events contact book; any other folder = an extra page)
                   shell: sections/00-header.html + <main id="page-content"> fragments + sections/13-newsletter.html </main>
                          + sections/14-footer.html, <body data-page="<page>">, js/page.js
   admin.html   <- pages/admin/NN-name.html          (own bare shell: no site header / footer, robots noindex, css/admin.css, js/admin/main.js)

   A page whose folder is missing or empty is SKIPPED with a warning (the page lanes add their folders later); warnings never fail the build.
   Head data: home = content/site.json (brand.*); sub-pages = content/pages.json -> <page>.meta.{title,description[,image]} (the CONTENT lane's
   shape: page keys at the top level; a { pages: { <page>: ... } } wrapper is read too) when present, else the defaults below. og:image is the
   branded assets/images/og-image.jpg unless meta.image names an existing file (sizes / alt from content/assets-manifest.json).
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const argv = process.argv.slice(2);
const CHECK_ONLY = argv.includes('--check');
const ONLY = argv.filter((a) => !a.startsWith('--')).map((a) => a.replace(/\.html$/i, '').toLowerCase()).map((a) => (a === 'index' ? 'home' : a));

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---- the file contract ---- */
const HOME_SECTIONS = [
    '00-header', '01-hero', '02-intro', '03-gallery', '04-story-a', '05-strip', '06-menu', '07-manifesto',
    '08-podcast', '09-episodes', '10-hosts', '11-live', '12-visit-listen', '13-newsletter', '14-footer'
];
const HEADER = '00-header', NEWSLETTER = '13-newsletter', FOOTER = '14-footer';
const PUBLIC_PAGES = ['cafe', 'menu', 'podcast', 'episodes', 'events', 'contact', 'book'];   // PAGES-SPEC 2 (order = the navigation map)
const ADMIN = 'admin';
const KNOWN_OUTPUTS = new Set(['index', ...PUBLIC_PAGES, ADMIN]);

/* sensible defaults when content/pages.json has no meta for a page (the CONTENT lane's copy wins when it exists) */
const PAGE_DEFAULTS = {
    cafe:     { label: 'The Cafe',     description: 'The cafe behind the podcast: specialty coffee, a kitchen that bakes every morning and a room built for real conversations in Harrowfield.' },
    menu:     { label: 'Menu',         description: 'Coffee, tea, bakes and plates at Latte with Lata. See what is on the counter this week and book a table.' },
    podcast:  { label: 'The Podcast',  description: 'Latte with Lata is a weekly conversation with mission-driven leaders, recorded live in the cafe every Thursday night. Meet the host, Lata Singh.' },
    episodes: { label: 'Episodes',     description: 'Every episode of Latte with Lata: candid conversations with people building careers, organizations and movements around purpose.' },
    events:   { label: 'Events',       description: 'Thursday recording nights and what is on at Latte with Lata. Doors 6:30 pm. Reserve a seat for the next live conversation.' },
    contact:  { label: 'Contact',      description: 'Find Latte with Lata in Harrowfield: address, opening hours, directions, and a message form that reaches the team.' },
    book:     { label: 'Book a table', description: 'Book a table at Latte with Lata or reserve a seat at a Thursday recording. Instant confirmation, easy to change or cancel.' },
    admin:    { label: 'Front of house', description: 'Latte with Lata bookings and guests.' }
};

const CSS_BASE = ['css/fonts.css', 'css/tokens.css', 'css/base.css'];
const CSS_SPLIDE = 'vendor/splide-core.min.css';
const VENDOR_JS = ['vendor/gsap.min.js', 'vendor/ScrollTrigger.min.js', 'vendor/SplitText.min.js', 'vendor/ScrollToPlugin.min.js', 'vendor/splide.min.js'];
const FONTS = ['assets/brand/fonts/creato_display/CreatoDisplay-Regular.woff2', 'assets/brand/fonts/creato_display/CreatoDisplay-Bold.woff2'];   // the two faces the first paint needs
const THEME_COLOR = '#502506';   // = tokens.css --colBrand (the header plate colour)
const OG_IMAGE = 'assets/images/og-image.jpg';
const ORIGIN = String(process.env.SITE_ORIGIN || '').replace(/\/+$/, '');

/* ---- content ---- */
function readJson(p, fallback) {
    if (!exists(p)) return fallback;
    try { return JSON.parse(read(p)); } catch (e) { warnings.push(`${p} is not valid JSON (${e.message}) - defaults used`); return fallback; }
}
const warnings = [];
const site = readJson('content/site.json', {});
const pagesJson = readJson('content/pages.json', {});
const manifest = readJson('content/assets-manifest.json', {});
const brand = site.brand || {};
/** content/pages.json entry of a page: top-level key (CONTENT lane) or under "pages" */
const pageContent = (page) => (pagesJson.pages && pagesJson.pages[page]) || pagesJson[page] || {};
const BRAND_NAME = brand.name || 'Latte with Lata';

/* ---- fragment validation ---- */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const IMPLIED_END = new Set(['li', 'p', 'option', 'optgroup', 'td', 'th', 'tr', 'thead', 'tbody', 'tfoot', 'dt', 'dd', 'colgroup', 'caption']);

/** Walks the tags of a fragment (comments, <script> and <style> bodies removed) and returns its top-level elements + structural problems. */
function scanFragment(html) {
    const src = html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, (m, tag) => `<${tag}></${tag}>`);
    const roots = [];            // [{ tag, attrs }]
    const issues = [];
    const stack = [];
    const tagRe = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
    let last = 0, m;
    while ((m = tagRe.exec(src))) {
        const between = src.slice(last, m.index);
        if (!stack.length && between.trim()) issues.push(`text outside the root element: "${between.trim().slice(0, 40)}"`);
        last = tagRe.lastIndex;
        const closing = m[1] === '/', tag = m[2].toLowerCase(), attrs = m[3] || '';
        const selfClosed = /\/\s*$/.test(attrs);
        if (closing) {
            const at = stack.lastIndexOf(tag);
            if (at === -1) { issues.push(`stray </${tag}>`); continue; }
            const dropped = stack.splice(at).slice(1).filter((t) => !IMPLIED_END.has(t));
            if (dropped.length) issues.push(`<${dropped.join('>, <')}> not closed before </${tag}>`);
            continue;
        }
        if (!stack.length) roots.push({ tag, attrs });
        if (!VOID.has(tag) && !selfClosed) stack.push(tag);
    }
    if (!stack.length && src.slice(last).trim()) issues.push(`text outside the root element: "${src.slice(last).trim().slice(0, 40)}"`);
    const open = stack.filter((t) => !IMPLIED_END.has(t));
    if (open.length) issues.push(`unclosed <${open.join('>, <')}>`);
    return { roots, issues, stripped: src };
}
const attr = (attrs, name) => { const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs); return m ? m[1] : null; };
const hasAttr = (attrs, name) => new RegExp(`(^|\\s)${name}(\\s|=|$)`, 'i').test(attrs);

/**
 * loadFragment(rel, want, state) - reads one fragment, validates it, records its ids.
 * want: { tag, id, roots: 'single' | 'first', classes?: [..], attrs?: [..] }
 */
function loadFragment(rel, want, state) {
    if (!exists(rel)) { state.problems.push(`${rel} is missing`); return `<!-- ${rel} MISSING -->`; }
    const html = read(rel).replace(/\r\n/g, '\n').replace(/\s+$/, '');
    const { roots, issues, stripped } = scanFragment(html);
    issues.forEach((i) => state.problems.push(`${rel}: ${i}`));
    const first = roots[0];
    if (!first) {
        state.problems.push(`${rel}: no root element`);
    } else {
        const gotId = attr(first.attrs, 'id');
        if (want.tag && first.tag !== want.tag) state.problems.push(`${rel}: root is <${first.tag}>, expected <${want.tag}${want.id ? ` id="${want.id}"` : ''}>`);
        if (want.id && gotId !== want.id) state.problems.push(`${rel}: root id is "${gotId || ''}", expected "${want.id}"`);
        (want.classes || []).forEach((c) => { if (!(` ${attr(first.attrs, 'class') || ''} `).includes(` ${c} `)) state.problems.push(`${rel}: root is missing class "${c}"`); });
        (want.attrs || []).forEach((a) => { if (!hasAttr(first.attrs, a)) state.problems.push(`${rel}: root is missing the ${a} attribute`); });
        if (want.roots === 'single' && roots.length !== 1) state.problems.push(`${rel}: ${roots.length} top-level elements (<${roots.map((r) => r.tag).join('>, <')}>) - the contract is ONE root`);
    }
    /* every id must be unique across the page (comments excluded) */
    [...stripped.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]).forEach((id) => {
        if (state.ids.has(id)) state.problems.push(`duplicate id "${id}" in ${rel} (first seen in ${state.ids.get(id)})`);
        else state.ids.set(id, rel);
    });
    /* local page links must point at a page this build knows (warning only: another lane may add it later) */
    [...stripped.matchAll(/\shref="([a-z0-9_-]+)\.html(?:[#?][^"]*)?"/gi)].forEach((x) => {
        if (!KNOWN_OUTPUTS.has(x[1].toLowerCase()) && !extraPages.includes(x[1].toLowerCase())) state.warnings.push(`${rel}: link to unknown page "${x[1]}.html"`);
    });
    return html;
}
const requireFiles = (list, state) => list.forEach((p) => { if (!exists(p)) state.problems.push(`referenced file missing: ${p}`); });
const marker = (rel) => `<!-- ===== ${rel} ===== -->`;

/* ---- head ---- */
function ogFor(image) {
    const rel = image && exists(image) ? image : OG_IMAGE;
    const m = manifest[rel] || {};
    return { rel, url: ORIGIN ? `${ORIGIN}/${rel}` : rel, w: m.w || 1200, h: m.h || 630, alt: m.alt || '' };
}
function head({ title, description, file, og, css, robots }) {
    const url = ORIGIN ? `${ORIGIN}/${file === 'index.html' ? '' : file}` : '';
    return `<head>
<meta charset="utf-8">
<!-- no-js -> js-ok before first paint (PZ pattern: .no-js in inline-critical, rendered.html:1 <html class="js-ok ...">); the section CSS carries html:not(.js-ok) fallbacks -->
<script>document.documentElement.classList.replace("no-js","js-ok")</script>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">${robots ? `\n<meta name="robots" content="${robots}">` : ''}
<meta name="theme-color" content="${THEME_COLOR}">${url ? `\n<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">` : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(BRAND_NAME)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${og.url}">
<meta property="og:image:width" content="${og.w}">
<meta property="og:image:height" content="${og.h}">
<meta property="og:image:alt" content="${esc(og.alt || '')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${og.url}">
<link rel="icon" href="assets/svg/favicon.svg" type="image/svg+xml">
<link rel="preload" href="${FONTS[0]}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${FONTS[1]}" as="font" type="font/woff2" crossorigin>
${css.map((p) => `<link rel="stylesheet" href="${p}">`).join('\n')}
</head>`;
}

/* ---- page folders ---- */
const FRAGMENT_RE = /^(\d{2})-([a-z0-9][a-z0-9-]*)\.html$/i;
function fragmentFiles(page) {
    const dir = path.join(ROOT, 'pages', page);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
    const all = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.html')).sort();
    const bad = all.filter((f) => !FRAGMENT_RE.test(f));
    bad.forEach((f) => warnings.push(`pages/${page}/${f}: ignored (fragment names are NN-name.html)`));
    return all.filter((f) => FRAGMENT_RE.test(f));
}
/* extra page folders (anything under pages/ that is not a known page or admin, e.g. a temporary pages/_demo) build to <folder>.html */
const extraPages = fs.existsSync(path.join(ROOT, 'pages'))
    ? fs.readdirSync(path.join(ROOT, 'pages'), { withFileTypes: true })
        .filter((d) => d.isDirectory() && /^[a-z0-9_-]+$/i.test(d.name) && !PUBLIC_PAGES.includes(d.name) && d.name !== ADMIN && d.name !== 'index' && d.name !== 'home')
        .map((d) => d.name.toLowerCase())
    : [];

/* ---- builders: each returns { file, html, problems, warnings, fragments } or null (skipped) ---- */
function buildHome() {
    const state = { problems: [], warnings: [], ids: new Map() };
    const want = (n) => (n === HEADER ? { tag: 'header', id: 'page-header', roots: 'first' }
        : n === FOOTER ? { tag: 'footer', id: 'page-footer', roots: 'single' }
        : { tag: 'section', id: 's-' + n, roots: 'single' });
    const frag = Object.fromEntries(HOME_SECTIONS.map((n) => [n, loadFragment(`sections/${n}.html`, want(n), state)]));
    const css = [...CSS_BASE, CSS_SPLIDE, ...HOME_SECTIONS.map((n) => `css/sections/${n}.css`)];
    requireFiles([...css, ...VENDOR_JS, ...FONTS, 'js/main.js', 'js/lib/api.js', 'assets/svg/favicon.svg', OG_IMAGE], state);
    HOME_SECTIONS.forEach((n) => { if (!exists(`js/sections/${n}.js`)) state.problems.push(`js/sections/${n}.js is missing (main.js imports it)`); });

    const title = `${BRAND_NAME} - ${brand.tagline || 'A cafe with a microphone'}`;                       // copy.md: brand.name + " - " + brand.tagline
    const description = [brand.tagline, brand.metaShort || brand.shortDescription].filter(Boolean).join(' ');   // brand contract: the tagline opens the description (<= 160 chars)
    const main = HOME_SECTIONS.slice(1, -1);
    const html = `<!doctype html>
<html lang="en" class="no-js">
${head({ title, description, file: 'index.html', og: ogFor(OG_IMAGE), css })}
<body id="top" data-page="home">
<a class="skip-main" href="#page-content">Skip to main content</a>

${marker(`sections/${HEADER}.html`)}
${frag[HEADER]}

<main id="page-content" class="page__content">
${main.map((n) => `${marker(`sections/${n}.html`)}\n${frag[n]}`).join('\n\n')}
</main>

${marker(`sections/${FOOTER}.html`)}
${frag[FOOTER]}

${VENDOR_JS.map((p) => `<script src="${p}"></script>`).join('\n')}
<script type="module" src="js/main.js"></script>
</body>
</html>
`;
    return { file: 'index.html', html, fragments: HOME_SECTIONS.length, ...state };
}

function buildPage(page) {
    const files = fragmentFiles(page);
    if (!files || !files.length) { warnings.push(`pages/${page}/ is ${files ? 'empty' : 'missing'} - ${page}.html skipped`); return null; }
    const state = { problems: [], warnings: [], ids: new Map() };
    const header = loadFragment(`sections/${HEADER}.html`, { tag: 'header', id: 'page-header', roots: 'first' }, state);
    const body = files.map((f) => {
        const [, nn, name] = FRAGMENT_RE.exec(f);
        const isHero = nn === '01';
        const want = { tag: 'section', id: `p-${page}-${nn}-${name.toLowerCase()}`, roots: 'single' };
        if (isHero) { want.classes = ['page-hero']; want.attrs = ['data-banner']; if (name.toLowerCase() !== 'hero') state.problems.push(`pages/${page}/${f}: the 01 fragment must be 01-hero.html (the page hero)`); }
        return { rel: `pages/${page}/${f}`, html: loadFragment(`pages/${page}/${f}`, want, state) };
    });
    if (!files.some((f) => /^01-/.test(f))) state.problems.push(`pages/${page}/: 01-hero.html is missing (every sub-page opens with .page-hero[data-banner])`);
    const newsletter = loadFragment(`sections/${NEWSLETTER}.html`, { tag: 'section', id: 's-' + NEWSLETTER, roots: 'single' }, state);
    const footer = loadFragment(`sections/${FOOTER}.html`, { tag: 'footer', id: 'page-footer', roots: 'single' }, state);

    const pageCss = `css/pages/${page}.css`, pageJs = `js/pages/${page}.js`;
    const hasCss = exists(pageCss), hasJs = exists(pageJs);
    if (!hasCss) state.warnings.push(`${pageCss} not found - stylesheet link left out`);
    if (!hasJs) state.warnings.push(`${pageJs} not found - js/page.js will not import a page module (data-page-module="false")`);
    const css = [...CSS_BASE, CSS_SPLIDE, `css/sections/${HEADER}.css`, `css/sections/${NEWSLETTER}.css`, `css/sections/${FOOTER}.css`, 'css/pages/_shell.css', ...(hasCss ? [pageCss] : [])];
    requireFiles([...css, ...VENDOR_JS, ...FONTS, 'js/page.js', 'js/lib/api.js', 'assets/svg/favicon.svg', OG_IMAGE], state);

    const meta = pageContent(page).meta || {};
    const def = PAGE_DEFAULTS[page] || { label: page.replace(/^[_-]+/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), description: brand.metaShort || brand.shortDescription || '' };
    const title = meta.title || `${def.label} - ${BRAND_NAME}`;
    const description = meta.description || def.description;
    const robots = page.startsWith('_') ? 'noindex' : '';

    const html = `<!doctype html>
<html lang="en" class="no-js">
${head({ title, description, file: `${page}.html`, og: ogFor(meta.image), css, robots })}
<body id="top" data-page="${esc(page)}" data-page-module="${hasJs}">
<a class="skip-main" href="#page-content">Skip to main content</a>

${marker(`sections/${HEADER}.html`)}
${header}

<main id="page-content" class="page__content">
${body.map((b) => `${marker(b.rel)}\n${b.html}`).join('\n\n')}

${marker(`sections/${NEWSLETTER}.html`)}
${newsletter}
</main>

${marker(`sections/${FOOTER}.html`)}
${footer}

${VENDOR_JS.map((p) => `<script src="${p}"></script>`).join('\n')}
<script type="module" src="js/page.js"></script>
</body>
</html>
`;
    return { file: `${page}.html`, html, fragments: files.length + 3, ...state };
}

function buildAdmin() {
    const files = fragmentFiles(ADMIN);
    if (!files || !files.length) { warnings.push(`pages/${ADMIN}/ is ${files ? 'empty' : 'missing'} - admin.html skipped`); return null; }
    const state = { problems: [], warnings: [], ids: new Map() };
    const body = files.map((f) => ({ rel: `pages/${ADMIN}/${f}`, html: loadFragment(`pages/${ADMIN}/${f}`, { roots: 'single' }, state) }));
    const css = [...CSS_BASE, 'css/admin.css'];
    requireFiles([...css, ...FONTS, 'js/admin/main.js', 'assets/svg/favicon.svg'], state);
    const meta = pageContent(ADMIN).meta || {};
    const title = meta.title || `${PAGE_DEFAULTS.admin.label} - ${BRAND_NAME}`;
    const hasMain = body.some((b) => /<main\b/i.test(b.html.replace(/<!--[\s\S]*?-->/g, '')));   // the ADMIN lane may bring its own <main>; otherwise the shell supplies the landmark
    const inner = body.map((b) => `${marker(b.rel)}\n${b.html}`).join('\n\n');
    const html = `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<script>document.documentElement.classList.replace("no-js","js-ok")</script>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="same-origin">
<meta name="theme-color" content="${THEME_COLOR}">
<link rel="icon" href="assets/svg/favicon.svg" type="image/svg+xml">
<link rel="preload" href="${FONTS[0]}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${FONTS[1]}" as="font" type="font/woff2" crossorigin>
${css.map((p) => `<link rel="stylesheet" href="${p}">`).join('\n')}
</head>
<body id="top" class="admin" data-page="admin">
${hasMain ? inner : `<main id="page-content" class="admin__content">\n${inner}\n</main>`}

<script type="module" src="js/admin/main.js"></script>
</body>
</html>
`;
    return { file: 'admin.html', html, fragments: files.length, ...state };
}

/* ---- run ---- */
const targets = [
    ['home', buildHome],
    ...PUBLIC_PAGES.map((p) => [p, () => buildPage(p)]),
    ...extraPages.map((p) => [p, () => buildPage(p)]),
    [ADMIN, buildAdmin]
].filter(([name]) => !ONLY.length || ONLY.includes(name));
ONLY.forEach((n) => { if (!['home', ADMIN, ...PUBLIC_PAGES, ...extraPages].includes(n)) warnings.push(`unknown target "${n}" (known: home ${PUBLIC_PAGES.join(' ')} admin${extraPages.length ? ' ' + extraPages.join(' ') : ''})`); });

const label = CHECK_ONLY ? 'build-site --check' : 'build-site';
let problemCount = 0;
const done = [];
for (const [, build] of targets) {
    const out = build();
    if (!out) continue;
    problemCount += out.problems.length;
    out.warnings.forEach((w) => warnings.push(w));
    if (out.problems.length) {
        console.error(`${label}: ${out.file} - ${out.problems.length} problem(s)`);
        out.problems.forEach((p) => console.error('  - ' + p));
    }
    if (!CHECK_ONLY) fs.writeFileSync(path.join(ROOT, out.file), out.html, 'utf8');
    done.push(out);
    console.log(`${label}: ${CHECK_ONLY ? 'would write' : 'wrote'} ${out.file} (${out.html.length} bytes, ${out.fragments} fragments)${out.problems.length ? ' WITH ' + out.problems.length + ' problem(s) - see above' : ''}`);
}
[...new Set(warnings)].forEach((w) => console.warn(`${label}: warning - ${w}`));
console.log(`${label}: ${done.length} file(s)${CHECK_ONLY ? ' checked' : ' written'}, ${problemCount} problem(s), ${new Set(warnings).size} warning(s)`);
process.exit(problemCount ? 1 : 0);

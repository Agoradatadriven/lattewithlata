# Latte with Lata - site copy (human-readable, brand pass + social copy pass 2026-09-17)

Source of truth: `content/site.json` (this file mirrors it, section by section, with notes). If the two ever disagree, `site.json` wins - fix this file, not the JSON.

**Brand.** Latte with Lata is a conversational podcast with mission-driven leaders (nonprofit, healthcare, public sector, social impact), recorded live in a real cafe. The brand kit's tagline is **Real Conversations. Built on Purpose.** and it appears in exactly four places: the hero (under the wordmark), the footer (under the mark), the meta description / og:title, and nowhere else (`brand.tagline` and `hero.tagline` are the only JSON keys that carry it). Source: `assets/brand/brand-position.txt`; the paper's draft taglines are superseded by the kit.

**Voice.** Warm, unhurried, substantive, candid, grounded, independent (the five attributes in the position paper). Short sentences. Specific about coffee (grinder, hopper, flat white) and specific about the work (waiting rooms, grants, shifts, forms, boards). Guests are people, not job titles; the questions are about cost, doubt and decisions, never career highlight reels. No marketing words: no "elevate", "curated", "journey", "unforgettable", no hustle-culture framing. Titles are uppercase display type (Creato Display Bold 700); body copy is sentence case (Creato Display Regular 400). Read-more labels are short noun phrases; the two verb labels "Discover the story" (04) and "Join the conversation" (10) are the client's own tile CTAs (social copy pass 2026-09-17) and are the only exceptions.

**Placeholders (invented brand facts - confirm with the client before launch).** Everything in this list is fiction chosen for consistency across the page. The founder's name, role, employer description and doctoral study come from the brand position paper and are NOT placeholders:

| Fact | Value used everywhere | Where it appears |
|---|---|---|
| Founder / host | Lata Singh, founder and host (real; `hosts.name`, `hosts.role`) | intro, story A, podcast, hosts |
| Host credibility | senior operating leader in one of the country's largest safety-net healthcare networks (operations, quality, workforce, finance); doctoral study in leadership and innovation (real, from the paper; employer deliberately unnamed) | hosts |
| Independence line | "Latte with Lata is a personal platform and is independent of any employer or institution." (required by the paper) | footer legal |
| Producer | none named (the earlier "Ravi Menon" line is gone; the third hosts paragraph is now why she opened a cafe with a microphone) | - |
| Opened | spring 2024 | story A |
| Podcast | recorded live at the corner table, Thursday evenings from 6:30 pm; new episode every Thursday; first episode January 2025 (so episode 88 on 2026-09-10) | podcast, episodes, live, listen, visit note, footer hours |
| Content pillars | The Origin Story · The Hard Trade-off · What No One Tells You · The Coffee Break (named once, lowercase, as "the same four parts" in the podcast paragraph; the live quote no longer refers to them - social copy pass 2026-09-17) | podcast, episode titles |
| Address | 27 Bellwood Street, corner of Fenwick Lane, Harrowfield (fictional town, no postcode) | visit, footer |
| Phone | (555) 014-2024 (`tel:+15550142024`) - 555 is a reserved fictional exchange | visit, footer |
| Email | hello@lattewithlata.example (`.example` is a reserved, non-routable domain) | footer |
| Hours | Mon-Thu 7:00 am-6:00 pm; Fri 7:00 am-10:00 pm; Sat 8:00 am-10:00 pm; Sun 8:00 am-3:00 pm; Thursdays reopen 6:30 pm for the recording | visit, footer |
| Currency / prices | $ (single currency); $4.00-$18.00 | menu |
| Roaster / bakery | "a roaster two streets over"; croissants baked in-house at six | menu |
| Guests | Marisol Vega, Dr Kwame Boateng, Hannah Lindgren, Elias Okonkwo, Rosa Delgado, Grace Mbeki - all fictional, as are their organisations (Harrowfield Food Bank, Second Shift, Fenwick Tenants' Union, St Oswin's Hospice) | episodes |
| Booking URL | `#book` | header, drawer, menu, visit, mobile pill |
| Platform / social URLs | `#` (Spotify, Apple Podcasts, YouTube, RSS, Instagram) | header, listen, newsletter, footer |
| Future-page CTAs | `#cafe`, `#menu`, `#episodes`, `#hosts`, `#events`, `#directions` - dead anchors until those pages exist | story A, menu, episodes, hosts, live, visit |
| Episode / newsletter endpoints | `#` | episodes, newsletter |
| Credit line | "Site by Agora Data Driven" (unchanged) | footer |

---

## 00 - Header, drawer, mobile pill

- Wordmark (two lines, for the hero and the drawer logo): **LATTE** / **WITH LATA**
- `<title>` suffix / og:title: **Real Conversations. Built on Purpose.** (`brand.tagline`)
- Meta description (155 chars, one sentence): A podcast cafe in Harrowfield: good coffee all week, and every Thursday night a candid, unhurried conversation with a mission-driven leader, recorded live.
- Drawer links (display type, in order): The Cafe · Menu · The Podcast · Episodes · Hosts · Events · Contact
- Outlined square CTA (header on desktop, drawer, mobile pill): **Book a table** -> `#book`
- "Listen on" icon row (drawer): Spotify · Apple Podcasts · YouTube · RSS (icons `i-spotify`, `i-apple`, `i-youtube`, `i-rss`)
- Header side link (drawer, "Tools" nav) is `newsletter.eyebrow`, which is now **Stay for the conversation** (social copy pass 2026-09-17; was "First to know", before that "Stay tuned" - see 13).

Note: nav labels use Title Case ("The Cafe"); the drawer renders them uppercase via CSS, so keep the JSON as written. The header wordmark text "LATTE WITH LATA" next to the mark is `footer.wordmark` / `brand.name` uppercased - no new key.

## 01 - Hero

- Wordmark rolls up in two rows: **LATTE** / **WITH LATA** (the brand mark sits above it - lane C)
- Tagline (live text, fades in at +2 s, 37 chars): **Real Conversations. Built on Purpose.**
- Screen-reader description of the video/poster: Latte with Lata. A short, silent video of milk being poured into a latte at the counter of a warm, sunlit cafe.

Tone: the kit's tagline, verbatim, with its two full stops and Title Case. Do not uppercase it via CSS (it is a sentence, not a title) and do not repeat it in 02.

## 02 - Title strip + intro

- h1: **A CAFE WITH A MICROPHONE** (renders on two lines: A CAFE WITH / A MICROPHONE)
- Paragraph 1: Thoughtful conversations with people building careers, organizations, and movements around purpose.
- Paragraph 2: Pull up a chair and discover the stories behind mission-driven work.
- Read-more: **The cafe** -> `#s-04-story-a` (scrolls to the story row; label unchanged)

Two sentences total (guard: 2), 22 words - the Tile 1 eyebrow and support line of the client's social set, verbatim (social copy pass 2026-09-17; the US spelling "organizations" is the client's). Paragraph 2 is the line to keep if the block ever needs to shrink. The h1 is unchanged: it no longer duplicates the tagline, so it can stay.

## 03 - Cafe gallery rail (6 portraits)

Unchanged. Alt text placeholders (the asset researcher's `assets-manifest.json` overrides these when present):

1. `gallery-01.jpg` - The cafe room in the morning: wooden tables, a long bench under the window and light on the floor.
2. `gallery-02.jpg` - Steamed milk being poured into a latte at the counter.
3. `gallery-03.jpg` - Croissants and slices of cake lined up in the pastry cabinet.
4. `gallery-04.jpg` - The corner table with two microphones on stands and a pair of headphones.
5. `gallery-05.jpg` - A latte with a rosetta poured into the foam, seen from above.
6. `gallery-06.jpg` - The counter, the grinder and the espresso machine with cups stacked on top.

## 04 - Story row A (cream)

- h2: **FROM FIRST POUR TO LAST WORD** (two lines: FROM FIRST POUR / TO LAST WORD)
- Paragraph 1: Lata Singh opened the doors in the spring of 2024 with a second-hand espresso machine, a borrowed oven and one rule: the music stays quiet enough to talk over.
- Paragraph 2: The talking turned out to be the point. By autumn there were microphones on the corner table, and the people she had spent a career alongside, in clinics, councils and charities, started coming in to say what they could not say at a podium.
- Paragraph 3: The machine has since been replaced. The rule has not.
- Read-more: **Discover the story** -> `#cafe` (placeholder for a future cafe page; label = the Tile 2 CTA, social copy pass 2026-09-17)
- Image 1 (`story-a-1.jpg`, column 1, carries the stamp): A barista tamping a portafilter at the espresso machine.
- Image 2 (`story-a-2.jpg`, under the text): A table by the window with two cups, a saucer of crumbs and a folded newspaper.

83 words across the three paragraphs (guard: 90). Paragraph 3 is the punchline; keep it on its own line. "Clinics, councils and charities" is the audience in three words (healthcare, public sector, nonprofit).

## 05 - Wide parallax strip

- `strip-wide.jpg` alt: The cafe from the street in daylight, door open, a few tables outside under the awning.

No text on this section. Unchanged.

## 06 - Menu band (cream 2 = brand-soft)

- h2: **ON THE MENU**
- Paragraph: Espresso from a roaster two streets over, croissants baked at six, and brunch until the kitchen runs out. The prices are for a cup at the counter; a seat by the window, or at the corner table, costs the same.
- Carousel items (name · price · alt) - unchanged:
  1. **Espresso** · $4.00 · A double espresso in a small white cup on a saucer.
  2. **Cappuccino** · $5.50 · A cappuccino with thick foam, dusted with chocolate.
  3. **Butter croissant** · $5.00 · A butter croissant on a plate, torn open to show the layers.
  4. **Cardamom cake** · $7.50 · A slice of cardamom cake with a fork on a small plate.
  5. **Eggs, greens, sourdough** · $18.00 · A brunch plate: fried eggs, greens and grilled sourdough.
  6. **Cold brew** · $6.50 · A tall glass of cold brew over ice on a wooden table.
- Closing read-mores (centred, two): **See the menu** -> `#menu` · **Book a table** -> `#book`

Tone: the second sentence is still the joke; "or at the corner table" ties the menu to the recording without a sales pitch.

## 07 - Manifesto interlude (accent band #81532e, colour-scrub, white text)

One sentence, 23 words (guard 18-28; 24 tokens if the dash is counted):

> Behind every organization, movement and meaningful career are difficult decisions, unexpected lessons, doubts and defining moments - we bring those stories to the table.

The Tile 2 body + kicker of the client's social set, lightly joined with the ASCII dash the JSON uses everywhere (social copy pass 2026-09-17). Renders on 7 lines at 1440 (band 806 px) and 11 lines at 390 (band 654 px); the last line is "the table." (two words, `text-wrap: pretty`). Builders: SplitText to words then chars; no ellipse scribble; the JSON is sentence case - the brand kit sets this slot in Creato Display Medium 500, sentence case, so do NOT uppercase it via CSS.

## 08 - Podcast band opener (brand espresso band)

- Ticker (marquee, display type; the builder duplicates the string and inserts a separator between copies) - UNCHANGED on purpose so the glow-char timing stays measured: **LATTE WITH LATA - NEW EPISODE EVERY THURSDAY**
- Eyebrow: There's more behind every mission (the Tile 2 headline, social copy pass 2026-09-17)
- Paragraph (52 words, guard 60; social copy pass 2026-09-17 - the Tile 3 body + the four pillars): Join Latte with Lata for candid, unhurried conversations with mission-driven leaders about the decisions and experiences that shaped their work. Recorded at the corner table on Thursday nights, every episode has the same four parts: the origin story, the hard trade-off, what no one tells you, and a coffee break to finish.
- Previous paragraph (brand pass, 59 words, kept for reference): Latte with Lata is a weekly conversation with mission-driven leaders, recorded at the corner table of the cafe on Thursday nights. Lata Singh talks with the people running nonprofits, safety-net clinics, public agencies and social enterprises about the decisions behind the work: the origin story, the hard trade-off, what no one tells you, and a coffee break to finish.

The four content pillars are still named once, in the last clause, in the paper's order and lowercase (they are segments, not brands); the audience list moved to the 12 LISTEN intro. Optional avatar next to a "Hosted by Lata Singh" line: lane C's call; if used, the image is `hosts.images[0]` and the text is `hosts.name` / `hosts.role`.

## 09 - Episodes rail (6 cards, newest first)

Card anatomy unchanged: cover image (67%) + panel (33%) with uppercase title, hidden blurb (slides up on hover; always visible on touch), meta lines guest / duration / date. Dates are Thursdays; the newest is 2026-09-10. One guest per audience segment, one pillar per title.

| # | Title (panel, uppercase) | Pillar | Guest | Role | Length | Date | Blurb (hover line) | Cover |
|---|---|---|---|---|---|---|---|---|
| 88 | The grant we turned down | The Hard Trade-off | Marisol Vega | Executive director, Harrowfield Food Bank | 44 min | 2026-09-10 | Marisol said no to the biggest cheque in her nonprofit's history. On strings, dignity, and the board meeting that followed. | `episode-01.jpg` |
| 87 | What no one tells you about a waiting room | What No One Tells You | Dr Kwame Boateng | Medical director, safety-net community clinic | 47 min | 2026-09-03 | Kwame runs a clinic where nobody is turned away. On the maths of a Tuesday morning, and the lesson no residency teaches. | `episode-02.jpg` |
| 86 | Fixing a form nobody could finish | The Hard Trade-off | Hannah Lindgren | Chief innovation officer, city government | 39 min | 2026-08-27 | Hannah rebuilt a benefits form that failed half the people who started it. On slow change inside government, and who decides it worked. | `episode-03.jpg` |
| 85 | The origin story is not the pitch | The Origin Story | Elias Okonkwo | Founder, Second Shift social enterprise | 42 min | 2026-08-20 | Elias hires people on the day they leave prison. On the phone call that started it, a first year of losses, and keeping the door open. | `episode-04.jpg` |
| 84 | Showing up is the whole strategy | What No One Tells You | Rosa Delgado | Community organiser, Fenwick Tenants' Union | 36 min | 2026-08-13 | Rosa has knocked on more doors than she can count. On patience, small wins, and what a street knows that a strategy deck does not. | `episode-05.jpg` |
| 83 | Who stays when everyone is leaving | The Coffee Break | Grace Mbeki | Director of nursing, St Oswin's Hospice | 51 min | 2026-08-06 | Grace kept a hospice team together through the hardest three years in nursing. On staying, and the coffee break that saved a shift. | `episode-06.jpg` |

All blurbs are 120-135 characters (guard 140). Every `href` is `#` (placeholder for the episode page / player). Roles are now "title, organisation" and a little longer than before (up to 45 chars): builders should let the guest meta line wrap to two lines on the card rather than truncate. Suggested meta line format: `Marisol Vega, Executive director, Harrowfield Food Bank` / `44 min` / `10 Sep 2026`.

- Closing read-more: **All episodes** -> `#episodes` (placeholder for the episodes page)

## 10 - Story row B, "Meet Lata" (brand espresso band, inverted)

- h2: **MEET LATA**
- New keys: `hosts.name` = **Lata Singh**, `hosts.role` = **Founder and host** (for the caption under the portrait, the 08 avatar line and any `<figcaption>`/aria text; not a new visible slot unless lane C adds one)
- Paragraph 1: Lata Singh is the founder and host. By day she is a senior operating leader in one of the country's largest safety-net healthcare networks, responsible for operations, quality, workforce and finance at a scale where every decision has a waiting room attached.
- Paragraph 2: She is also partway through doctoral study in leadership and innovation, which is why the questions here go one layer deeper than the highlight reel: what did it cost, who disagreed, and what would you do differently.
- Paragraph 3: She opened a cafe with a microphone because the most honest things leaders ever told her were said over coffee, after the meeting, with nothing left to prove. Latte with Lata is that conversation, with the microphone switched on.
- Read-more: **Join the conversation** -> `#hosts` (placeholder for the hosts page; label = the Tile 4 CTA, social copy pass 2026-09-17; was "About Lata", before that "The hosts")
- Image 1 (`assets/brand/lata-singh.jpg`, column 1, bleeds left; object-fit cover, object-position 50% 20%): Lata Singh, founder and host of Latte with Lata, seated in her office and looking at the camera.
- Image 2 (`host-corner.jpg`, under the text): The recording corner: two microphones on boom arms, a small mixer and a lamp on a wooden table.

The employer is never named (the paper describes it; the footer disclaimer separates the platform from it). Paragraph 3 answers "why a cafe with a microphone" and is the only place that phrase recurs after the h1.

## 11 - Live sessions mosaic

- Eyebrow: Pull up a chair (the Tile 3 headline, social copy pass 2026-09-17; the 6:30 pm fact moved into the quote - the visit note and footer hours still carry it)
- Quote (24 words, guard 40; display type, sentence case; also the hidden Phase-2 caption): Coffee. Leadership. Purpose. Real conversation. Thursday nights from 6:30 pm the chairs turn to face the corner table, and there is one for you.
- Previous quote (brand pass, 35 words, kept for reference): On Thursdays the chairs turn to face the corner, the grinder goes quiet at half past six, and a leader who is used to a podium gets an hour, a cup and four honest questions.
- Mosaic alts - unchanged:
  1. `mosaic-01.jpg` - The cafe at night from the street, windows glowing and every table taken.
  2. `mosaic-02.jpg` - People at small tables leaning in to listen, cups and glasses in front of them.
  3. `mosaic-03.jpg` - Lata and a guest talking at the corner table, microphones between them. (centre image - the one that zooms)
  4. `mosaic-04.jpg` - A microphone on a stand under a warm lamp, the room out of focus behind it.
  5. `mosaic-05.jpg` - The audience seen from the corner table, faces lit by the window lights.
- Read-more: **What's on** -> `#events` (placeholder for the events page)

The Tile 3 sub is the quote's first line; "there is one for you" answers the eyebrow. The pillars are named in 08 only.

## 12 - Visit / Listen twin cards

### VISIT (solid accent card)
- Title: **VISIT**
- Hours (4 rows) - unchanged: Mon - Thu · 7:00 am - 6:00 pm / Fri · 7:00 am - 10:00 pm / Sat · 8:00 am - 10:00 pm / Sun · 8:00 am - 3:00 pm
- Note under the table (optional line, key `visit.note`): Thursdays we reopen at 6:30 pm for the recording. Free, first come first seated, and the guest stays for a coffee afterwards.
- Address: 27 Bellwood Street / Corner of Fenwick Lane / Harrowfield
- Phone: (555) 014-2024 (`tel:+15550142024`)
- Read-more: **Book a table** -> `#book`; text link **Get directions** -> `#directions` (the label is the builder's, not in the JSON)

### LISTEN (frosted card)
- Title: **LISTEN**
- Intro (25 words; the Tile 4 body = the audience, + one listening line, social copy pass 2026-09-17): For leaders, aspiring leaders, professionals, and anyone searching for more meaning in the work they do. A new conversation every Thursday, wherever you already listen.
- Platforms: Spotify · Apple Podcasts · YouTube · RSS (all `#`, icons as in the header)
- Latest episode line: **The grant we turned down** · 44 min -> `#` (must always equal `episodes[0]`)

## 13 - Newsletter + follow (brand espresso band)

- Eyebrow: **Stay for the conversation** (the Tile 5 headline, social copy pass 2026-09-17; was "First to know", before that "Stay tuned"; the drawer side link that mirrors this key changes with it)
- Paragraph (25 words, guard 30; the Tile 5 sub + body condensed, with the one-email-a-week promise kept): The conversation doesn't end with the podcast. Follow along for meaningful moments, leadership insights, guest stories and upcoming conversations. One email a week, never more.
- Previous paragraph (brand pass, 29 words, kept for reference): First to know about new episodes, who is at the corner table next Thursday, and what the kitchen is doing with the season. One email a week, never more.
- Floating label: Your email
- Consent checkbox: Yes, send me the Thursday email from Latte with Lata. I have read the privacy policy.
- Submit (aria-label / visually-hidden text; the button shows the arrow): Subscribe
- Success state: You are on the list. See you Thursday.
- Error state (not colour-only): That address did not go through. Check it and try once more.
- Endpoint: `#` (replace with the real provider URL)
- Right column, "Follow" links: Spotify · Apple Podcasts · YouTube · RSS · Instagram (all `#`)

"Privacy policy" inside the consent line is plain text in the JSON; the builder may wrap those two words in a link to `#privacy`.

## 14 - Footer + wordmark + back-to-top

- Column 1: brown brand mark (120px) + tagline **Real Conversations. Built on Purpose.** (`brand.tagline`, set under the mark by lane C) + legal: Copyright 2026 Latte with Lata. All rights reserved. Latte with Lata is a personal platform and is independent of any employer or institution.
- Column 2 - address: Latte with Lata / 27 Bellwood Street / Corner of Fenwick Lane / Harrowfield / (555) 014-2024 / hello@lattewithlata.example
- Column 2 - hours: Mon - Thu 7:00 am - 6:00 pm / Fri 7:00 am - 10:00 pm / Sat 8:00 am - 10:00 pm / Sun 8:00 am - 3:00 pm / Thursday recordings: doors 6:30 pm
- Column 3 - sitemap: The Cafe · Menu · The Podcast · Episodes · Hosts · Events · Contact (same anchors as the drawer)
- Column 4 - heading **Follow us on our socials** (the Tile 5 CTA as the column title, social copy pass 2026-09-17; was "Listen & follow" - a hard-coded builder label, not a JSON key); listen: Spotify · Apple Podcasts · YouTube · RSS; socials: Instagram (`i-instagram`) · YouTube (`i-youtube`)
- Legal row credit: Site by Agora Data Driven (unchanged)
- Back-to-top disc label (visually hidden / aria-label): Back to top
- Cropped wordmark (edge to edge, cut at the bottom): **LATTE WITH LATA**

The legal line is two sentences in one string; builders may break it after "All rights reserved." with a `<br>` so the disclaimer reads as its own line. The word "Copyright" is used rather than the symbol so the JSON stays ASCII-safe; builders may swap in the symbol.

## Brand pass finish (2026-09-17) - addenda to the contract

- `brand.metaShort` (new key, 120 chars) = the second half of the meta description; the page's `<meta name="description">` is
  `brand.tagline + " " + brand.metaShort` (158 chars) so the tagline leads the description as the brand contract asks. `brand.shortDescription`
  stays as the long form / fallback.
- Tagline slots on the page: hero (`.hero__tagline`, sentence case, live text), footer column 1 (`.footer__tagline`, from `brand.tagline`),
  `<title>`, og:title / twitter:title, meta description. Nowhere else.
- Footer legal row: sentence 1 of `footer.legal` on line 1 (with the Photo credits toggle), sentence 2 (the independence disclaimer) on
  its own line below (`.footer__disclaimer`).
- The 11 live quote and the 07 manifesto are both rendered in sentence case (quote role); no copy change.
- Typography niceties applied in the fragments only (not in the JSON): curly quotes around the photo-credit titles, `&nbsp;` between
  numbers and units ("44&nbsp;min", "6:30&nbsp;pm").

## Social copy pass (2026-09-17) - addenda

Source: `assets/brand/social-copy.md` (five client-approved social tiles + slot map). Structure rule kept: 15 sections, markup, geometry,
motion and the brand system untouched; only text inside existing copy slots (and two read-more labels) changed. The fragments carry the
same strings as `site.json` (with `&nbsp;` before "pm" in 11, per the brand-pass addenda). Verification: `verify/social-copy-pass.md`.

| Slot | Tile | Words / guard |
|---|---|---|
| `intro.paragraphs` | 1 eyebrow + support, verbatim | 2 sentences / 2 |
| `storyA.cta.label` | 2 CTA "Discover the story" | - |
| `manifesto.sentence` | 2 body + kicker, adapted | 23 / 18-28 |
| `podcast.eyebrow` | 2 headline "There's more behind every mission" | - |
| `podcast.paragraph` | 3 body + the four pillars | 52 / 60 |
| `hosts.cta.label` | 4 CTA "Join the conversation" | - |
| `live.eyebrow` | 3 headline "Pull up a chair" | - |
| `live.quote` | 3 sub + one Thursday-night line | 24 / 40 |
| `listen.intro` | 4 body (audience) + one listening line | 25 (no guard) |
| `newsletter.eyebrow` | 5 headline "Stay for the conversation" (mirrored by the drawer side link) | - |
| `newsletter.paragraph` | 5 sub + body condensed | 25 / 30 |
| footer column-4 heading | 5 CTA "Follow us on our socials" (fragment-only label, no JSON key) | - |

Not used: Tile 1 headline "Meet Latte with Lata" and CTA "Discover Latte with Lata" (no slot: the h1 stays "A CAFE WITH A MICROPHONE");
Tile 3 CTA "Subscribe on YouTube" (the platform labels are the platform names); Tile 4 kicker (the 08 lead already covers it).
Unchanged on purpose: hero tagline, every title, ticker, episode blurbs, hosts paragraphs, story A paragraphs, menu, visit, consent /
success / error strings, all hrefs.

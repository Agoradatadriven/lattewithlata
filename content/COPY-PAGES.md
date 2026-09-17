# Latte with Lata - sub-page copy (human-readable; pages pass + UPDATE-3 content pass, 2026-09-17)

Source of truth: `content/pages.json`. This file is rendered from it (scratch `update3/L4/gen-copy-md.cjs`, based on `pages-run/content/gen-copy-md.cjs`), section by section, so the two cannot disagree. If you change copy, change the JSON and re-render; if you cannot re-render, change both by hand. The home page copy stays in `content/site.json` / `content/COPY.md` (which also holds the single-value fact table).

**Brand.** Every line follows `assets/brand/brand-position.txt`: Latte with Lata is a conversational podcast with mission-driven leaders (nonprofit, healthcare, public sector, social impact), warm and unhurried, candid, grounded and independent, recorded live at the corner table of the cafe on Thursday nights. The cafe copy serves that purpose: a room built for honest conversation, not a food pitch.

**Voice.** Warm, substantive, candid, grounded, independent (brand position paper, section 5). Short sentences. Specific about coffee and specific about the work. No marketing words (no "elevate", "curated", "journey", "unforgettable", "spot"), no hustle framing. Client-approved social-tile lines are reused verbatim where they fit: podcast hero title (Tile 3 headline), podcast hero intro (Tile 3 sub), `podcast#about` title / lead / third paragraph / kicker (Tile 2 headline, Tile 1 eyebrow, Tile 2 body + kicker, Tile 1 support), `podcast#audience` title / lead / kicker (Tile 4), `podcast#host` CTA label (Tile 4 CTA), `events#recording-night` lead (= `site.json live.quote`, Tile 3 sub). The `podcast#host` pull quote is the paper's positioning line (section 2), attributed to the show.

**Host.** Lata Singh is "Host" everywhere; the word "founder" never describes her. Her facts come only from the brand paper: senior operating leader in one of the country's largest safety-net healthcare networks (operations, quality, workforce, finance), hands-on fluency in compliance, funding structures, workforce and public accountability, doctoral study in leadership and innovation. Her employer is never named, she did not open or own the cafe, and no quotation is put in her mouth. Two fictional guests keep their own title "Founder, ..." (episode 85 Elias Okonkwo, episode 71 Henry Tso). The asset paths `assets/images/founder-*.jpg` are file names, not copy.

**Conventions.** Titles are stored uppercase-ready. Text is ASCII (straight quotes, " - " for a dash); builders may add `&nbsp;` before am / pm / min and curly quotes in the fragments. Dates are ISO plus a `dateLabel` in the site format (Thu 24 Sep 2026, also on the home cards since UPDATE-3); times are shown as "6:30 pm". Guest roles are "title, Organisation" and always name the organisation. Pillar names are always written in full, Title Case, in the paper's order. Tokens in braces are replaced at runtime: `{reference}` `{date}` `{time}` `{party}` `{n}` `{count}`. `placeholder: true` marks invented facts. `itemsFrom` means the section renders the named page-level array (`episodes.items`, `menu.featured`); `events#upcoming` carries its items inline AND at `events.upcoming` (the API reads the latter; both are generated from one list and are identical).

## Change log

**2026-09-17 - UPDATE-3 content pass (lane L4 CONTENT).** Audit against the brand paper + consistency pass against the server defaults (`lib/settings.cjs`, `lib/events.cjs`). Hand-off: `verify/handoff-update3/L4.md`.

- `cafe.meta.description`, `cafe.hero.intro`: the cafe is introduced as the room where Latte with Lata is recorded (was a breakfast-first description).
- `cafe#story` paragraphs 1-5: Lata no longer "opened the doors", "spent a career" in councils and charities or "borrowed a recorder" (invented biography that also made her the cafe's founder). The story is the cafe's own; paragraph 4 ends "and Latte with Lata had a home"; paragraph 5 centres an unhurried conversation instead of "the most important thing we make is breakfast". Paragraphs 1-2 stay identical to `site.json storyA`.
- `podcast#about` Length fact: "35 to 50 minutes" -> "About 40 minutes" (the 18 episodes run 33 to 51 min, mean 41); `podcast#how-it-works` step 4: "about 45 minutes" -> "about 40 minutes".
- `podcast#host`: image alt = the UPDATE-3 alt, fallback = `assets/brand/lata-singh-podcast.jpg`; pull quote = the paper's positioning line "Real leadership lessons come out over coffee, not in a boardroom.", attributed to Latte with Lata (was an invented first-person statement); independence text now opens with the site's one independence sentence.
- `episodes.items`: roles name their organisation - ep 87 "Medical director, Eastgate Community Clinic" (was "safety-net community clinic", which echoed the host's employer description), ep 86 "Chief innovation officer, City of Harrowfield", ep 73 "Grants manager, Marlow County Health Department"; ep 71 organisation "Spoke and Chain Youth Bike Project" (was "Bike Workshop", read as a shop). Ids, numbers, dates and covers unchanged.
- `events#upcoming.labels.full` and `book#booking.availability.recordingFull`: the server lets all 40 recording seats be reserved, so a full night now says "walk in anyway: reserved seats still empty at 6:50 pm go to the room" (was a promise of separate walk-in seats); `book#booking` recording explainer no longer says "most seats are first come".
- `events#other-events` private hire: the show's corner-table microphones are no longer offered for hire; the room is pitched for a board evening, a team away-day or a community meeting.
- `book#booking`: title "RESERVE YOUR SPOT" -> "A TABLE OR A SEAT"; table hint adds Saturday evenings (the server opens Fri and Sat until 10 pm); timezone note = the server's "All times are local cafe time.".
- `contact#credits`: "portrait of Lata Singh" -> "photo of Lata Singh" (the new client photo).
- This file re-rendered from the JSON (it had drifted: episode covers 82-71, `seatOne` / `seatMany`, `textRecording`, `partyTokenNote`).

**2026-09-17 - pages pass.** First version of `pages.json` and this file (seven sub-pages).

## Placeholders - confirm with the client before launch

Everything below is invented for the study build. Real, from the brand paper and NOT placeholders: the host's name and role, her credibility (senior operating leader in a large safety-net healthcare network; operations, quality, workforce, finance; doctoral study in leadership and innovation; employer never named), the audience, the voice, the four pillars, the positioning line used as the pull quote, the independence statement, and the five social tiles. The host photo (`assets/brand/lata-singh-podcast.jpg`) is client-supplied.

| # | Placeholder | Where |
|---|---|---|
| 1 | Town, address, phone, email, hours (inherited from site.json; the server reads the hours and contact from site.json) | every page; `shared.contact`, `shared.hours` |
| 2 | Cafe history: opened spring 2024, the quiet-music rule, how the microphones arrived (a food bank director's late conversation, a shoebox of microphones). It is the cafe's story, not Lata Singh's | `cafe#story` (= `site.json storyA` 1-2) |
| 3 | Values claims: roaster two streets over, in-house baking at six, living wage, shared tips | `cafe#values`, `menu#notes` |
| 4 | Room: about 40 seats inside, 8 outside, corner table seats 4, wifi, payment methods | `cafe#room` |
| 5 | Accessibility: step-free entry, accessible toilet, high chairs, changing table, dogs outside, assistance dogs, large-print menus, accessible parking bay | `cafe#room`, `cafe#faqs`, `events#faqs`, `contact#find-us` |
| 6 | Policies: laptop hours, pram folding, walk-in tables, private hire Mon-Wed evenings for up to 40 | `cafe#faqs`, `events#other-events` |
| 7 | The whole menu: 36 dishes, descriptions, prices, dietary tags, milk surcharge, service times, Friday / Saturday evening plates, sourcing (free-range eggs, Saturday market), tax and tipping lines | `menu` |
| 8 | All 18 episodes: guests, titles, organisations, durations, blurbs, notes, quotes (all fictional people and organisations; the dataset stops at episode 88 on Thu 10 Sep 2026) | `episodes.items` |
| 9 | Episode archive note (episodes 1 to 70 on the platforms), "88 episodes so far" and the length fact "About 40 minutes" | `episodes#all-episodes`, `podcast#about`, `podcast#how-it-works` |
| 10 | No audio files: every `audio` is null; Spotify / Apple Podcasts / YouTube / RSS / map links are `#` | `episodes`, `podcast#listen`, `contact#find-us` |
| 11 | All 8 upcoming recording nights: guests, titles, organisations, blurbs (all fictional; the list starts Thu 24 Sep 2026) | `events.upcoming` |
| 12 | Recording-night details beyond the brief: reserved seats released at 6:50 pm, a short break halfway, lock-up around 9:30 pm, episodes cut to about 40 minutes and released the next Thursday | `events#recording-night`, `events#house-rules`, `podcast#how-it-works`, `book#booking` |
| 13 | Open table (first Saturday, 9:00 am to 10:30 am) and its next three dates | `events#other-events` |
| 14 | Directions: Market Square, buses 4 and 11, Harrowfield Central, bike stands, 2-hour parking | `contact#find-us` |
| 15 | Recording-night seat model: all 40 seats can be reserved online (server `recordingSeats` 40, up to 4 per reservation); walk-ins take unreserved seats and the 6:50 pm releases. Confirm whether the client wants seats held back for walk-ins | `events#recording-night`, `events#upcoming`, `book#booking` |
| 16 | Press line: Lata speaks in a personal capacity only and declines requests about her day job (follows the paper's independence position; confirm the wording) | `contact#press-guests` |
| 17 | Privacy summary: a TEMPLATE for legal review. Only the 12-month booking retention comes from the brief; message retention (12 months), 30-day completion, cookie statement are proposals | `contact#privacy` |
| 18 | Booking rules shown in copy (equal to the server defaults in lib/settings.cjs): 60-day window, 30-minute slots, 90-minute sittings, 15-minute hold (copy only), max 8 online (4 for recording nights), cancel up to 2 hours before | `book` |
| 19 | Confirmation email line (`success.emailLine`): do NOT show until emails are really sent; the build only writes to data/outbox.json | `book#booking` |
| 20 | Photo alt text for page-*.jpg, cafe-01..04, menu-01..12, event-01..04 describes the BRIEFED subject; `content/assets-manifest.json` alt wins once the ASSETS lane delivers | every hero, `cafe#gallery`, `menu.featured`, `events.upcoming` |

Placeholder notes carried inside the JSON (`placeholderNote`):

- `cafe#story` - Cafe history (spring 2024, the quiet-music rule, how the microphones arrived) is brand fiction for the study build. It is the cafe's story, not Lata Singh's biography: her facts come only from the brand position paper. Confirm or replace with the client.
- `cafe#values` - Roaster, in-house baking, living-wage and tip-sharing claims are placeholders. Confirm each with the client before launch.
- `cafe#room` - Seat counts and every accessibility line are placeholders until the client confirms the real premises.
- `cafe#faqs` - Laptop hours, dog, pram and private-hire policies are placeholders.
- `menu#notes` - Every dish, price, tag and sourcing claim is a placeholder menu for the study build. The client must supply the real menu and an allergen matrix before launch.
- `podcast#listen` - Platform URLs are # until the show's real feeds exist.
- `episodes#all-episodes` - Every guest, organization, title, quote and note is fictional. Replace with real episodes before launch.
- `episodes#audio` - No audio files exist yet. Every episode has audio: null and the platform links are #.
- `events#recording-night` - The 6:50 pm release time and the 9:30 pm close are placeholders. Price, doors, recording and kitchen times come from the brief.
- `events#upcoming` - Every upcoming guest and organization is fictional.
- `events#other-events` - Open table and private hire details are placeholders.
- `contact#find-us` - Address, phone, email, hours and every direction line are fictional placeholders (Harrowfield does not exist; 555 numbers and .example domains cannot be reached).
- `contact#privacy` - Retention for messages (12 months), the 30-day completion time and the cookie statement are proposals. Only the 12-month booking retention comes from the brief.

---

## shared

- **apiFallback** (static-hosting notice; builders link the phone with `tel:+15550142024` and the email with `mailto:hello@lattewithlata.example`): Online booking and messages are switched off on this copy of the site. Call (555) 014-2024 or email hello@lattewithlata.example and we will sort it out by hand.
- **apiFallbackTitle:** This form is not connected
- **independence:** Latte with Lata is a personal platform and is independent of any employer or institution.
- **pillarNote:** Every episode has all four parts. The tag marks the part the conversation leaned on most.
- **hours (sub-page table, Thursday split out):**
  - Mon - Wed · 7:00 am - 6:00 pm
  - Thu · 7:00 am - 6:00 pm · Reopens 6:30 pm for the recording
  - Fri · 7:00 am - 10:00 pm
  - Sat · 8:00 am - 10:00 pm
  - Sun · 8:00 am - 3:00 pm
- **kitchen:** Breakfast until 11:30 am. Brunch and lunch 11:30 am to 3:00 pm. Cakes, pastry and drinks until close.
- **pillars:** The Origin Story (`origin-story`) · The Hard Trade-off (`hard-trade-off`) · What No One Tells You (`what-no-one-tells-you`) · The Coffee Break (`coffee-break`)
- **labels:** Book a table · Reserve a seat · See the menu · All episodes · What's on · Get directions · Manage a booking · Write to us · Required · Optional · Sending... · Try again

---

## cafe.html

- `<title>`: The Cafe | Latte with Lata (26 chars)
- Meta description (151 chars): The cafe where Latte with Lata is recorded: a neighbourhood room in Harrowfield built for honest conversation, with good coffee and breakfast all week.

### 01 hero

- Eyebrow: The cafe
- h1: **A ROOM BUILT FOR TALKING** (24 chars)
- Intro (134 chars): Good coffee, music quiet enough to talk over, and the corner table where Latte with Lata is recorded. 27 Bellwood Street, Harrowfield.
- Image: `assets/images/page-cafe.jpg` - alt: The cafe room in daylight: wooden tables, a long bench under the window and the counter at the back.

### 02 #story (story) - PLACEHOLDER CONTENT

- **eyebrow:** Our story
- **title:** FROM FIRST POUR TO LAST WORD
- **paragraphs:**
  1. The cafe opened in the spring of 2024 with a second-hand espresso machine, a borrowed oven and one rule: the music stays quiet enough to talk over.
  2. The talking turned out to be the point. By autumn there were microphones on the corner table, and leaders from clinics, councils and charities were coming in to say what they could not say at a podium.
  3. The microphones were not part of the plan. One Thursday a food bank director stayed past closing to talk through a decision she could not raise at her own board table, and the tables around her went quiet to listen. The week after, people came back for the next conversation.
  4. So the chairs were turned to face the corner. Two second-hand microphones arrived in a shoebox, then a small mixer, then a lamp, and Latte with Lata had a home. Nobody has asked for the corner table back.
  5. It is still a cafe first. Most of the week the corner table is just a table, and the room belongs to anyone who wants a good coffee and an unhurried conversation. On Thursday nights it is where someone with a hard job says what it actually took.
  6. The machine has since been replaced. The rule has not.
- **images:**
  - src: assets/images/story-a-1.jpg | alt: A barista tamping a portafilter at the espresso machine.
  - src: assets/images/host-corner.jpg | alt: The recording corner: two microphones on boom arms, a small mixer and a lamp on a wooden table.

### 03 #values (values) - PLACEHOLDER CONTENT

- **eyebrow:** How we run the place
- **title:** WHAT WE CARE ABOUT
- **intro:** Four things. None of them are complicated. All of them cost a little more than the alternative.
- **items:**
  - title: Coffee from two streets over | body: Our beans come from a small roaster two streets away. We buy what they are roasting that week, so the filter coffee changes with it. It is fresh, the supply line is a short walk, and there is someone to talk to when a bag is not right.
  - title: A kitchen that does breakfast properly | body: Eggs cooked to order. Croissants baked at six. Porridge that was started before you woke up. The kitchen is small, so the menu is short. We would rather do a dozen things well than thirty things quickly.
  - title: A room built for talking | body: No speakers over the tables. Soft surfaces, quiet music and chairs you can sit in for an hour. If you cannot hear the person across from you, we have done something wrong.
  - title: A living wage for the team | body: Everyone who works here is paid at least the local living wage, and tips are shared evenly across the shift. It adds a little to the price of a cup. We think that is the right price.

### 04 #room (room) - PLACEHOLDER CONTENT

- **eyebrow:** The room
- **title:** SEATS ABOUT FORTY
- **paragraphs:**
  1. The room seats about 40. There is a long bench under the window, a dozen small tables, four stools at the counter and a few tables outside under the awning.
  2. The corner table is the one with the microphones. Most of the week it is the best seat in the house for two people and a long conversation. On Thursday nights the other chairs turn to face it.
  3. Order at the counter and find a seat. We bring everything to you.
- **facts:**
  - label: Seats | value: About 40 inside, 8 outside
  - label: The corner table | value: Seats 4. Yours any day but Thursday night.
  - label: Wifi | value: Free. Ask at the counter.
  - label: Payment | value: Card, contactless and cash
- **accessibility:**
  - **title:** Getting in and getting comfortable
  - **items:**
    1. Step-free entry from Bellwood Street
    2. Accessible toilet on the ground floor
    3. High chairs and a baby-changing table
    4. Dogs welcome at the outside tables, with a water bowl by the door
    5. Assistance dogs welcome everywhere
    6. Large-print menus at the counter
  - **note:** If something would make your visit easier, tell us when you book or call ahead. We will do what we can.
- **image:**
  - `src` assets/images/gallery-01.jpg
  - `alt` The cafe room in the morning: wooden tables, a long bench under the window and light on the floor.

### 05 #gallery (gallery)

- **eyebrow:** Around the room
- **title:** A LOOK INSIDE
- **images:**
  - src: assets/images/cafe-01.jpg | alt: The long bench under the front window with small wooden tables and morning light. | caption: The window bench. Best light before ten.
  - src: assets/images/cafe-02.jpg | alt: The counter with the espresso machine, the grinder and the cake cabinet. | caption: The counter. Order here, then find a seat.
  - src: assets/images/cafe-03.jpg | alt: A corner table with two chairs, a lamp and cups, the rest of the room behind it. | caption: The corner table. Most of the week, just a table.
  - src: assets/images/cafe-04.jpg | alt: Tables and chairs outside the cafe on the pavement, under the awning. | caption: Outside on Bellwood Street. Dogs welcome.
- **altNote:** Alt text describes the briefed subject. If content/assets-manifest.json carries an alt for the delivered photo, the manifest wins.

### 06 #faqs (faq) - PLACEHOLDER CONTENT

**QUESTIONS PEOPLE ASK** - Good to know

- **Can I work here on a laptop?** Yes, on weekdays. The wifi is free and there are sockets along the window bench. At weekends between 10:00 am and 2:00 pm we ask you to keep laptops closed so the tables can turn.
- **Can I bring my dog?** Dogs are welcome at the outside tables, and there is a water bowl by the door. Inside, assistance dogs only.
- **Is there room for a pram?** Yes. The entry is step-free and there is space to park a pram by the window bench. We have high chairs and a changing table. When the room is full we may ask you to fold it.
- **Do I need to book?** No. We always keep some tables for walk-ins. If you want to be sure, book online. We hold a table for 15 minutes and sittings are 90 minutes. For more than 8 people, call or email us. [Book a table -> `book.html`]
- **How do you handle allergens?** Tell us when you order. The menu marks vegetarian, vegan, gluten-free and dairy-free dishes and anything that contains nuts, and the kitchen will talk you through any plate. It is one small kitchen that handles nuts, gluten, dairy and eggs, so we cannot promise a dish is free of traces. [See the menu -> `menu.html`]
- **Can I hire the room?** Yes. The room is available on Monday, Tuesday and Wednesday evenings from 6:30 pm, for up to 40 seated. Write to us with your date and numbers and we will reply within 2 working days. [Ask about private hire -> `contact.html?topic=events`]

### 07 #visit (visit)

- **eyebrow:** Visit
- **title:** COME IN
- **hours:**
  - days: Mon - Wed | open: 7:00 am | close: 6:00 pm
  - days: Thu | open: 7:00 am | close: 6:00 pm | note: Reopens 6:30 pm for the recording
  - days: Fri | open: 7:00 am | close: 10:00 pm
  - days: Sat | open: 8:00 am | close: 10:00 pm
  - days: Sun | open: 8:00 am | close: 3:00 pm
- **hoursNote:** Thursdays we reopen at 6:30 pm for the recording. Free, first come first seated, and the guest stays for a coffee afterwards.
- **address:**
  - `name` Latte with Lata
  - `line1` 27 Bellwood Street
  - `line2` Corner of Fenwick Lane
  - `city` Harrowfield
- **phone:** (555) 014-2024
- **tel:** tel:+15550142024
- **email:** hello@lattewithlata.example
- **mailto:** mailto:hello@lattewithlata.example
- **directions:**
  - `label` Get directions
  - `href` contact.html#find-us
- **ctas:**
  - label: See the menu | href: menu.html
  - label: Book a table | href: book.html

---

## menu.html

- `<title>`: Menu | Latte with Lata (22 chars)
- Meta description (149 chars): Coffee from a roaster two streets over, breakfast until 11:30, brunch and lunch, cakes baked in house, and a few plates on Thursday recording nights.

### 01 hero

- Eyebrow: Eat and drink
- h1: **ON THE MENU** (11 chars)
- Intro (105 chars): Espresso from a roaster two streets over, croissants baked at six, and brunch until the kitchen runs out.
- Image: `assets/images/page-menu.jpg` - alt: A cafe table from above with coffee cups, a croissant and a brunch plate.

Tag legend: V = Vegetarian · VG = Vegan · GF = Gluten-free ingredients · DF = Dairy-free · N = Contains nuts. Vegan dishes are also vegetarian; they carry VG only.

### 02 #intro (intro)

- **title:** A SHORT MENU, DONE WELL
- **paragraphs:**
  1. Espresso from a roaster two streets over, croissants baked at six, and brunch until the kitchen runs out. The prices are for a cup at the counter; a seat by the window, or at the corner table, costs the same.
  2. The kitchen is small, so the list is short and it changes with the season. What is printed here is what we cook most weeks. The board by the counter has today's soup, today's filter coffee and anything new.
- **serviceTimes:**
  - label: Breakfast | value: Opening until 11:30 am
  - label: Brunch and lunch | value: 11:30 am to 3:00 pm
  - label: Cakes, pastry and drinks | value: All day
  - label: Thursday night plates | value: Recording nights, 6:30 pm to 8:30 pm. Also Friday and Saturday evenings until 9:00 pm.
- **tagLegendTitle:** How to read the tags
- **categoryNav:**
  - label: Coffee | href: #coffee
  - label: Not coffee | href: #not-coffee
  - label: Breakfast until 11:30 | href: #breakfast
  - label: Brunch and lunch | href: #brunch-lunch
  - label: Cakes and pastry | href: #cakes-pastry
  - label: Thursday night plates | href: #thursday-plates

### 03 #featured (menu-featured)

**WHAT PEOPLE ORDER** - From the counter. Twelve plates and cups that leave the counter most often.

| # | Item | Price | Image | Alt |
|---|---|---|---|---|
| 1 | Flat white | $5.50 | `assets/images/menu-01.jpg` | A flat white in a ceramic cup with a fern poured into the foam. |
| 2 | Latte | $5.50 | `assets/images/menu-02.jpg` | A tall latte with a rosetta in the foam, on a wooden table. |
| 3 | Batch filter | $4.50 | `assets/images/menu-03.jpg` | Filter coffee being poured from a glass server into a cup. |
| 4 | Masala chai | $5.50 | `assets/images/menu-04.jpg` | A cup of spiced milk tea with whole spices beside it. |
| 5 | Butter croissant | $5.00 | `assets/images/menu-05.jpg` | A golden butter croissant on a small plate. |
| 6 | Cardamom cake | $7.50 | `assets/images/menu-06.jpg` | A slice of loaf cake with a pale glaze and a fork. |
| 7 | Bircher muesli | $11.00 | `assets/images/menu-07.jpg` | A bowl of bircher muesli topped with apple, almonds and honey. |
| 8 | Eggs on toast | $12.00 | `assets/images/menu-08.jpg` | Two poached eggs on buttered sourdough toast. |
| 9 | Avocado on rye | $16.00 | `assets/images/menu-09.jpg` | Smashed avocado on dark rye with pickled onion and seeds. |
| 10 | Eggs, greens, sourdough | $18.00 | `assets/images/menu-10.jpg` | A brunch plate of fried eggs, greens and grilled sourdough. |
| 11 | Soup of the day | $12.00 | `assets/images/menu-11.jpg` | A bowl of vegetable soup with a slice of bread and butter. |
| 12 | Cheese board | $19.00 | `assets/images/menu-12.jpg` | A wooden board with three cheeses, walnuts, quince paste and crackers. |

### 04 #coffee (menu-category)

**COFFEE** - Double shots as standard. Oat, soy or lactose-free milk add $0.80. Decaf costs the same.

| Item | Description | Price | Tags | Photo |
|---|---|---|---|---|
| Espresso | A double shot of the house blend. Cocoa, a little orange, no sugar needed. | $4.00 | vg gf df |  |
| Macchiato | A double espresso marked with a spoon of milk foam. | $4.50 | v gf |  |
| Long black | A double shot over hot water. Ask for it short if you like it stronger. | $4.50 | vg gf df |  |
| Flat white | Double shot, steamed milk, thin foam. The cup most regulars order. | $5.50 | v gf | `menu-01.jpg` |
| Cappuccino | Equal parts espresso, milk and thick foam, dusted with chocolate. | $5.50 | v gf |  |
| Latte | The namesake. A double shot and a tall pour of steamed milk. | $5.50 | v gf | `menu-02.jpg` |
| Batch filter | A single-origin filter, brewed fresh every hour. Today's origin is on the board. | $4.50 | vg gf df | `menu-03.jpg` |
| Cold brew | Steeped for 16 hours and served over ice. Milk on the side if you ask. | $6.50 | vg gf df |  |

### 05 #not-coffee (menu-category)

**NOT COFFEE** - For the people who came for the conversation.

| Item | Description | Price | Tags | Photo |
|---|---|---|---|---|
| Masala chai | Black tea simmered with ginger, cardamom and clove. Made in a pot, not from syrup. | $5.50 | v gf | `menu-04.jpg` |
| Pot of tea | Loose leaf: breakfast, Earl Grey, green, peppermint or chamomile. | $5.00 | vg gf df |  |
| Hot chocolate | Dark chocolate melted into steamed milk. Not too sweet. | $5.50 | v gf |  |
| Fresh orange juice | Squeezed to order. Nothing else in the glass. | $6.50 | vg gf df |  |
| House lemonade | Lemon, mint and sparkling water, made each morning. | $5.50 | vg gf df |  |

### 06 #breakfast (menu-category)

**BREAKFAST UNTIL 11:30** - Served from opening until 11:30 am, every day.

| Item | Description | Price | Tags | Photo |
|---|---|---|---|---|
| Sourdough toast | Two thick slices with salted butter and house jam or marmalade. | $7.00 | v |  |
| Porridge with brown sugar | Steel-cut oats cooked in oat milk, with this week's stewed fruit. | $10.00 | vg df |  |
| Bircher muesli | Oats soaked overnight with apple and yoghurt, topped with almonds and honey. | $11.00 | v n | `menu-07.jpg` |
| Eggs on toast | Two eggs, poached, fried or scrambled, on buttered sourdough. | $12.00 | v | `menu-08.jpg` |
| Bacon and egg roll | Smoked bacon, a fried egg and tomato relish in a soft milk bun. | $13.00 | - |  |
| Masala omelette | Three eggs with onion, green chilli, tomato and coriander. Toast on the side. | $15.00 | v |  |

### 07 #brunch-lunch (menu-category)

**BRUNCH AND LUNCH** - From 11:30 am until 3:00 pm, or until the kitchen runs out.

| Item | Description | Price | Tags | Photo |
|---|---|---|---|---|
| Eggs, greens, sourdough | Two fried eggs, garlicky greens, chilli oil and grilled sourdough. | $18.00 | v | `menu-10.jpg` |
| Avocado on rye | Smashed avocado, lemon, pickled red onion and seeds on dark rye. | $16.00 | vg df | `menu-09.jpg` |
| Mushrooms on toast | Roast field mushrooms, thyme, ricotta and a poached egg on sourdough. | $17.00 | v |  |
| Smoked trout plate | Hot-smoked trout, potato salad, a soft egg, pickles and rye crisps. | $19.00 | - |  |
| Soup of the day | Made each morning and always vegetarian. Comes with bread and butter. | $12.00 | v | `menu-11.jpg` |
| Toasted cheese sandwich | Sharp cheddar, leek and mustard on sourdough, pressed until it crackles. | $13.00 | v |  |
| Grain bowl | Brown rice, roast pumpkin, chickpeas, greens, tahini and toasted seeds. | $17.00 | vg gf df |  |

### 08 #cakes-pastry (menu-category)

**CAKES AND PASTRY** - In the cabinet from opening. When it is gone, it is gone.

| Item | Description | Price | Tags | Photo |
|---|---|---|---|---|
| Butter croissant | Baked at six each morning. Usually gone by eleven. | $5.00 | v | `menu-05.jpg` |
| Almond croissant | Yesterday's croissant, filled with almond cream and baked again. | $6.50 | v n |  |
| Cheese scone | Cheddar and chive, served warm with butter. | $5.50 | v |  |
| Cardamom cake | A soft, spiced loaf cake with a lemon glaze. On the counter since day one. | $7.50 | v | `menu-06.jpg` |
| Flourless chocolate cake | Dense and dark, made with ground almonds instead of flour. | $8.00 | v gf n |  |
| Oat and date slice | Oats, dates, coconut oil and a pinch of salt. | $5.50 | vg df |  |

### 09 #thursday-plates (menu-category)

**THURSDAY NIGHT PLATES** - Recording nights from 6:30 pm, last plates at 8:30 pm. Order before 7:00 pm, at the break, or after the recording. Also served Friday and Saturday evenings until 9:00 pm.

| Item | Description | Price | Tags | Photo |
|---|---|---|---|---|
| Olives and warm bread | Marinated olives, olive oil and a quarter loaf from the oven. | $9.00 | vg df |  |
| Hummus and flatbread | Hummus, chilli oil, pickled vegetables and warm flatbread. | $12.00 | vg df |  |
| Toastie of the night | Whatever the kitchen built that afternoon. Ask at the counter. | $13.00 | - |  |
| Cheese board | Three cheeses, quince paste, walnuts and crackers. Enough for two. | $19.00 | v n | `menu-12.jpg` |

### 10 #notes (notes) - PLACEHOLDER CONTENT

- **title:** BEFORE YOU ORDER
- **items:**
  - id: allergens | title: Allergens | body: Tell us about any allergy when you order, every time. One small kitchen handles nuts, gluten, dairy, eggs, sesame and fish, so we cannot promise that any dish is free of traces. GF means made with gluten-free ingredients, not made in a gluten-free kitchen.
  - id: sourcing | title: Where it comes from | body: Coffee from a roaster two streets over. Bread, croissants and cakes baked here each morning. Eggs are free range. Vegetables come from the Saturday market when the season allows.
  - id: prices | title: Prices at the counter | body: The prices are for a cup at the counter. A seat by the window, or at the corner table, costs the same. Prices include tax. There is no service charge, and tips are shared evenly across the team.
  - id: groups | title: Large groups | body: We can seat up to 8 on one booking. For a bigger group, call or email us a few days ahead and we will plan the tables and, if you like, a set menu.

### 11 #book (cta)

- **title:** HUNGRY?
- **text:** Walk in any time, or book a table and we will keep one for you.
- **ctas:**
  - label: Book a table | href: book.html
  - label: Large group? Write to us | href: contact.html?topic=booking

---

## podcast.html

- `<title>`: The Podcast | Latte with Lata (29 chars)
- Meta description (151 chars): Candid, unhurried conversations with mission-driven leaders about the decisions that shaped their work. Recorded live in the cafe every Thursday night.

### 01 hero

- Eyebrow: The podcast
- h1: **PULL UP A CHAIR** (15 chars)
- Intro (112 chars): Coffee. Leadership. Purpose. Real conversation. A new episode every Thursday, recorded live at the corner table.
- Image: `assets/images/page-podcast.jpg` - alt: Two microphones on a cafe table with coffee cups, the room softly lit behind them.

### 02 #about (text)

- **eyebrow:** What the show is
- **title:** THERE'S MORE BEHIND EVERY MISSION
- **lead:** Thoughtful conversations with people building careers, organizations, and movements around purpose.
- **paragraphs:**
  1. Latte with Lata is a conversational podcast with mission-driven leaders: people who have built careers, organizations or movements around purpose rather than profit alone. It has the warmth and pace of a conversation over coffee, and the substance of a real discussion about leadership, impact and the decisions that shape the work.
  2. Most leadership shows are about scale, growth and metrics. This one is about the person behind the mission: their motivations, their doubts, and the human decisions behind the work. Real leadership lessons come out over coffee, not in a boardroom.
  3. Behind every organization, movement, and meaningful career are difficult decisions, unexpected lessons, doubts, and defining moments. Latte with Lata brings those stories to the table.
- **kicker:** Pull up a chair and discover the stories behind mission-driven work.
- **facts:**
  - label: New episode | value: Every Thursday
  - label: Length | value: About 40 minutes
  - label: Recorded | value: Live, at the corner table
  - label: Episodes so far | value: 88

### 03 #audience (list)

- **eyebrow:** Who it is for
- **title:** FOR PEOPLE BUILDING WITH PURPOSE
- **lead:** For leaders, aspiring leaders, professionals, and anyone searching for more meaning in the work they do.
- **items:**
  1. Current and aspiring leaders in nonprofit, healthcare, public sector and social-impact organizations.
  2. Professionals working out a career shift toward more purpose-driven work.
  3. Listeners who prefer a long, honest conversation to polished expert content.
  4. People who like leadership content but are tired of growth hacks and hustle.
- **kicker:** Latte with Lata is a space for conversations about leadership, impact, purpose, and the realities of mission-driven work.

### 04 #pillars (pillars)

- **eyebrow:** The format
- **title:** THE SAME FOUR PARTS, EVERY WEEK
- **intro:** Every conversation moves through the same four parts. Guests know them in advance. They do not get the questions.
- **items:**
  - n: 1 | id: origin-story | title: The Origin Story | short: What actually pulled this leader into mission-driven work. | body: We start with what actually pulled the guest into this work, which is rarely the version in the annual report. It is usually a person, a phone call or a bad week.
  - n: 2 | id: hard-trade-off | title: The Hard Trade-off | short: A real decision where mission and practicality were in tension. | body: One real decision where the mission and the practical answer pulled in different directions. We ask what it cost, who disagreed, and whether they would make the same call again.
  - n: 3 | id: what-no-one-tells-you | title: What No One Tells You | short: An honest, unpolished lesson from the work. | body: The honest, unpolished lesson: the thing the guest wishes someone had said in year one. No frameworks, just what happened and what they do differently now.
  - n: 4 | id: coffee-break | title: The Coffee Break | short: A lighter, personal closing segment. | body: We finish lighter. What they are reading, how they take their coffee, and what they do when they are not doing this.
- **note:** Every episode has all four parts. The tag marks the part the conversation leaned on most.

### 05 #how-it-works (steps)

- **eyebrow:** Thursday nights
- **title:** HOW AN EPISODE WORKS
- **intro:** Every episode is recorded live in the cafe, in front of whoever turns up. There is no studio and no second take.
- **steps:**
  - time: 6:30 pm | title: Doors | body: The cafe reopens and the chairs turn to face the corner table. It is free. Seats are first come, first seated, or you can reserve one.
  - time: 7:00 pm | title: Recording | body: One guest, one conversation, four parts, with a short break halfway. We finish by 8:15 pm. No slides, no panel, no pitch.
  - time: 8:15 pm | title: The guest stays for a coffee | body: There is no question time on the recording. The guest stays in the room afterwards, so ask them in person.
  - time: The next Thursday | title: The episode comes out | body: We cut the evening down to about 40 minutes. The coughs come out and the pauses stay in. It is on every platform the following Thursday morning.
- **ctas:**
  - label: What's on | href: events.html
  - label: Reserve a seat | href: book.html?type=recording

### 06 #host (host)

- **eyebrow:** The host
- **title:** MEET LATA
- **name:** Lata Singh
- **role:** Host
- **image:**
  - `src` assets/images/founder-portrait.jpg
  - `fallback` assets/brand/lata-singh-podcast.jpg
  - `alt` Lata Singh, host of Latte with Lata, at a cafe table with a podcast microphone and a latte
- **paragraphs:**
  1. Lata Singh hosts Latte with Lata. She comes to these conversations as a practitioner, not as an outside observer.
  2. By day she is a senior operating leader in one of the country's largest safety-net healthcare networks, overseeing operations, quality, workforce and finance at scale. That work has given her hands-on fluency in what mission-driven organizations deal with every day: compliance, funding structures, workforce and public accountability.
  3. She is also pursuing doctoral study in leadership and innovation, which brings an academic and reflective lens to the table alongside the operational one.
  4. That is the edge of the show. She is fluent in the pressures, the trade-offs and the quiet victories that come with running a purpose-built organization, and those are the things she asks about.
- **credentials:**
  1. Senior operating leader in one of the country's largest safety-net healthcare networks: operations, quality, workforce and finance at scale.
  2. Hands-on fluency in compliance, funding structures, workforce and public accountability.
  3. Doctoral study in leadership and innovation.
- **pullQuote:**
  - **text:** Real leadership lessons come out over coffee, not in a boardroom.
  - **attribution:** Latte with Lata
  - **context:** On why the show exists
  - **kind:** positioning
  - **placeholderNote:** Not invented: the positioning line of the brand position paper (section 2), used as the pull quote. It is the show's line, not a quotation from Lata Singh, so it is attributed to Latte with Lata.
- **independence:**
  - `title` A personal platform
  - `text` Latte with Lata is a personal platform and is independent of any employer or institution. Nothing said here is official communication on anyone's behalf.
- **cta:**
  - `label` Join the conversation
  - `href` episodes.html

### 07 #guest (cta-block)

- **eyebrow:** The other chair
- **title:** BE A GUEST, OR SUGGEST ONE
- **paragraphs:**
  1. We look for people who run something built around a mission: a clinic, a council service, a charity, a school, a social enterprise. Job title matters less than whether you have a decision you are willing to talk about honestly.
  2. You do not need media training or a book to promote. You need an evening, an origin story and one hard trade-off.
- **checklist:**
  1. Who you are, or who you are suggesting, and what they run.
  2. The decision or lesson you think is worth an hour.
  3. Thursdays you could be in Harrowfield.
- **note:** We read everything and reply within 2 working days. We cannot say yes to everyone, and nobody pays to be on the show.
- **cta:**
  - `label` Suggest a guest
  - `href` contact.html?topic=podcast-guest

### 08 #listen (platforms) - PLACEHOLDER CONTENT

- **eyebrow:** Listen
- **title:** WHEREVER YOU ALREADY LISTEN
- **intro:** A new conversation every Thursday, wherever you already listen.
- **platforms:**
  - name: Spotify | href: # | icon: i-spotify | placeholder: true
  - name: Apple Podcasts | href: # | icon: i-apple | placeholder: true
  - name: YouTube | href: # | icon: i-youtube | placeholder: true
  - name: RSS | href: # | icon: i-rss | placeholder: true

### 09 #episodes-cta (cta)

- **title:** START WITH THE LATEST
- **text:** Episode 88: The grant we turned down, with Marisol Vega.
- **latest:**
  - **n:** 88
  - **title:** The grant we turned down
  - **guest:** Marisol Vega
  - **duration:** 44 min
  - **href:** episodes.html#ep-88
- **ctas:**
  - label: All episodes | href: episodes.html
  - label: Come to a recording | href: events.html

---

## episodes.html

- `<title>`: Episodes | Latte with Lata (26 chars)
- Meta description (145 chars): Every recent episode of Latte with Lata: mission-driven leaders on origin stories, hard trade-offs and what no one tells you. New every Thursday.

### 01 hero

- Eyebrow: Episodes
- h1: **THE CONVERSATIONS** (17 chars)
- Intro (115 chars): Eighty-eight Thursdays so far. Here are the most recent, with notes on what each guest was willing to say out loud.
- Image: `assets/images/page-episodes.jpg` - alt: Headphones and a cup of coffee beside a notebook on a wooden cafe table.

### 02 #latest (episode-feature)

- **eyebrow:** Latest episode
- **title:** THIS WEEK
- **episodeId:** ep-88
- **itemsFrom:** episodes.items[0]
- **cta:**
  - `label` Read the notes
  - `href` #ep-88

### 03 #all-episodes (episode-list) - PLACEHOLDER CONTENT

**ALL EPISODES** - Episodes 71 to 88. Every episode has all four parts. The tag marks the part the conversation leaned on most.

Filters: All · The Origin Story · The Hard Trade-off · What No One Tells You · The Coffee Break. Empty state: No episodes under that part yet. Try another. Count: {count} episodes

Labels: Guest · Length · Released · In this episode · From the conversation · Listen on your platform · Show notes · Hide notes · Episode

Archive note: Episodes 1 to 70 are on your podcast platform. The notes for them are being added here in batches.

| # | Title | Pillar | Guest | Role | Org | Length | Date | Cover |
|---|---|---|---|---|---|---|---|---|
| 88 | The grant we turned down | The Hard Trade-off | Marisol Vega | Executive director, Harrowfield Food Bank | Harrowfield Food Bank | 44 min | Thu 10 Sep 2026 | `episode-01.jpg` |
| 87 | What no one tells you about a waiting room | What No One Tells You | Dr Kwame Boateng | Medical director, Eastgate Community Clinic | Eastgate Community Clinic | 47 min | Thu 3 Sep 2026 | `episode-02.jpg` |
| 86 | Fixing a form nobody could finish | The Hard Trade-off | Hannah Lindgren | Chief innovation officer, City of Harrowfield | City of Harrowfield | 39 min | Thu 27 Aug 2026 | `episode-03.jpg` |
| 85 | The origin story is not the pitch | The Origin Story | Elias Okonkwo | Founder, Second Shift social enterprise | Second Shift | 42 min | Thu 20 Aug 2026 | `episode-04.jpg` |
| 84 | Showing up is the whole strategy | What No One Tells You | Rosa Delgado | Community organiser, Fenwick Tenants' Union | Fenwick Tenants' Union | 36 min | Thu 13 Aug 2026 | `episode-05.jpg` |
| 83 | Who stays when everyone is leaving | The Coffee Break | Grace Mbeki | Director of nursing, St Oswin's Hospice | St Oswin's Hospice | 51 min | Thu 6 Aug 2026 | `episode-06.jpg` |
| 82 | The budget line nobody wanted to own | The Hard Trade-off | Tomasz Wieczorek | Finance director, Northgate Housing Trust | Northgate Housing Trust | 41 min | Thu 30 Jul 2026 | `gallery-04.jpg` |
| 81 | I came for a summer job | The Origin Story | Leilani Kahale | Director, Riverbend Youth Works | Riverbend Youth Works | 38 min | Thu 23 Jul 2026 | `cafe-05.jpg` |
| 80 | What no one tells you about a merger | What No One Tells You | Anjali Varma | Chief executive, Two Rivers Family Services | Two Rivers Family Services | 46 min | Thu 16 Jul 2026 | `cafe-04.jpg` |
| 79 | The night shift taught me to lead | The Origin Story | Mateus Figueira | Operations manager, Harrowfield Ambulance Service | Harrowfield Ambulance Service | 40 min | Thu 9 Jul 2026 | `gallery-06.jpg` |
| 78 | Closing the programme that worked | The Hard Trade-off | Naledi Khumalo | Head of programmes, Open Book Literacy Trust | Open Book Literacy Trust | 43 min | Thu 2 Jul 2026 | `story-a-2.jpg` |
| 77 | Late fees, long walks and lending a book twice | The Coffee Break | Eleanor Whitcombe | City librarian, Harrowfield Public Library | Harrowfield Public Library | 34 min | Thu 25 Jun 2026 | `host-corner.jpg` |
| 76 | Nobody trains you to be your friends' boss | What No One Tells You | Daniyal Hashmi | Principal, Fenwick Lane Community School | Fenwick Lane Community School | 45 min | Thu 18 Jun 2026 | `cafe-03.jpg` |
| 75 | We said yes to the contract | The Hard Trade-off | Emiko Tanabe | Executive director, Harbourside Shelter | Harbourside Shelter | 48 min | Thu 11 Jun 2026 | `story-a-1.jpg` |
| 74 | My mother's kitchen table | The Origin Story | Beatriz Fonseca | Director, Mesa Larga Advice Centre | Mesa Larga Advice Centre | 37 min | Thu 4 Jun 2026 | `cafe-01.jpg` |
| 73 | What no one tells you about public money | What No One Tells You | Farid Haidari | Grants manager, Marlow County Health Department | Marlow County Health Department | 42 min | Thu 28 May 2026 | `event-02.jpg` |
| 72 | A choir, a van and a very old dog | The Coffee Break | Siobhan Keane | Volunteer coordinator, Bellwood Community Kitchen | Bellwood Community Kitchen | 33 min | Thu 21 May 2026 | `gallery-01.jpg` |
| 71 | Starting again at fifty | The Origin Story | Henry Tso | Founder, Spoke and Chain Youth Bike Project | Spoke and Chain Youth Bike Project | 40 min | Thu 14 May 2026 | `cafe-06.jpg` |

**88 - The grant we turned down** (`#ep-88`)

- Blurb (123): Marisol said no to the biggest cheque in her nonprofit's history. On strings, dignity, and the board meeting that followed.
- Note: Why the largest grant on offer came with terms that would have changed who the food bank could serve.
- Note: How she took the decision to her board, and what the vote looked like.
- Note: What she now tells other directors: read the conditions before you read the amount.
- Quote (87): "The cheque was real. So were the strings. I had to decide which one we could live with." - Marisol Vega

**87 - What no one tells you about a waiting room** (`#ep-87`)

- Blurb (120): Kwame runs a clinic where nobody is turned away. On the maths of a Tuesday morning, and the lesson no residency teaches.
- Note: The arithmetic of a walk-in clinic: forty chairs, two doctors and a Tuesday morning.
- Note: Why he stopped judging a day by how fast the room empties.
- Note: The lesson no residency teaches: people need to feel they were right to come.
- Quote (86): "Nobody trains you for the waiting room. It is where most of the care actually happens." - Dr Kwame Boateng

**86 - Fixing a form nobody could finish** (`#ep-86`)

- Blurb (135): Hannah rebuilt a benefits form that failed half the people who started it. On slow change inside government, and who decides it worked.
- Note: A benefits form that half of all applicants gave up on, and how her team found out where.
- Note: Trading a fast relaunch for six months of testing with the people who fill it in.
- Note: Who gets to say a public service worked: the department, the auditor or the applicant.
- Quote (95): "We asked people to prove they were struggling in forty-one questions. We got it down to twelve." - Hannah Lindgren

**85 - The origin story is not the pitch** (`#ep-85`)

- Blurb (134): Elias hires people on the day they leave prison. On the phone call that started it, a first year of losses, and keeping the door open.
- Note: The phone call from a former colleague that started Second Shift.
- Note: A first year of losses, and the month he nearly closed the doors.
- Note: Why he hires on release day, before anyone has a reference.
- Quote (88): "The pitch says we had a vision. The truth is a man called me and needed a job by Monday." - Elias Okonkwo

**84 - Showing up is the whole strategy** (`#ep-84`)

- Blurb (130): Rosa has knocked on more doors than she can count. On patience, small wins, and what a street knows that a strategy deck does not.
- Note: What knocking on doors teaches you that a survey never will.
- Note: Why small wins, like a fixed stairwell light, build a union faster than big demands.
- Note: How she handles burnout, her own and other people's.
- Quote (87): "A street knows things no strategy deck will tell you. You just have to keep turning up." - Rosa Delgado

**83 - Who stays when everyone is leaving** (`#ep-83`)

- Blurb (131): Grace kept a hospice team together through the hardest three years in nursing. On staying, and the coffee break that saved a shift.
- Note: How she kept a hospice team together while nurses were leaving the profession.
- Note: The ten-minute coffee break she made compulsory, and what it did for a shift.
- Note: A lighter close: night-shift snacks, bad pens and the playlist in her car.
- Quote (74): "I could not pay them more. I could make sure nobody ate lunch standing up." - Grace Mbeki

**82 - The budget line nobody wanted to own** (`#ep-82`)

- Blurb (133): Tomasz had to choose between fixing roofs and keeping rents flat. On spreadsheets with people in them, and telling tenants the truth.
- Note: Why a housing trust could not afford repairs and a rent freeze in the same year, and how he showed the board.
- Note: The tenant meeting where he put the real numbers on the wall.
- Note: What finance people owe the front line: plain words, early.
- Quote (99): "Every line in that budget was somebody's kitchen ceiling. You cannot hide behind the word variance." - Tomasz Wieczorek

**81 - I came for a summer job** (`#ep-81`)

- Blurb (129): Leilani took a summer job at a youth centre and never left. On being needed at nineteen, and learning to run the place at thirty.
- Note: The summer job that was meant to last ten weeks.
- Note: What changed when she went from youth worker to the person who signs the payroll.
- Note: Why she still runs the Friday drop-in herself.
- Quote (97): "I did not choose the sector. A fourteen-year-old asked if I was coming back on Monday, and I was." - Leilani Kahale

**80 - What no one tells you about a merger** (`#ep-80`)

- Blurb (137): Anjali merged two charities that had competed for twenty years. On grief in the staff room, and the logo row that was never about a logo.
- Note: Why two organizations with the same mission spent twenty years competing for the same grants.
- Note: The staff-room grief nobody put in the merger plan.
- Note: What she would do in the first ninety days if she did it again.
- Quote (102): "Nobody warned me a merger is a bereavement. People were mourning a letterhead, and they were right to." - Anjali Varma

**79 - The night shift taught me to lead** (`#ep-79`)

- Blurb (130): Mateus spent eleven years on an ambulance before he ran the roster. On what 3 am teaches about calm, and why he still rides along.
- Note: Eleven years on the road, and the call that made him apply for the office job.
- Note: Building a roster that treats sleep as a safety issue.
- Note: Why he still works one night shift a month.
- Quote (97): "At 3 am nobody cares about your title. They care whether you are calm. I try to manage like that." - Mateus Figueira

**78 - Closing the programme that worked** (`#ep-78`)

- Blurb (132): Naledi closed a reading programme with strong results and no funding. On ending things well, and telling forty volunteers the truth.
- Note: How a programme can hit every target and still lose its funding.
- Note: The choice between stretching it thin and closing it properly.
- Note: How to tell forty volunteers, and what she handed over to the schools.
- Quote (91): "It worked, and we still had to stop. Those two facts sat at the same table for a long time." - Naledi Khumalo

**77 - Late fees, long walks and lending a book twice** (`#ep-77`)

- Blurb (136): Eleanor scrapped late fees and watched the books come back. A lighter one: walking to work, conference coffee, and what she lends twice.
- Note: What happened to returns in the year after the library dropped late fees.
- Note: Her forty-minute walk to work, and why she will not give it up.
- Note: The three books she presses on people, and the one she stopped recommending.
- Quote (84): "A library is the last place you can sit all day and nobody asks what you are buying." - Eleanor Whitcombe

**76 - Nobody trains you to be your friends' boss** (`#ep-76`)

- Blurb (138): Daniyal went from the staff room to the principal's office in one summer. On lonely lunches, hard reviews, and keeping friendships honest.
- Note: Going from colleague to principal over one summer holiday.
- Note: The first performance review he had to give a friend.
- Note: Where a school leader finds peers when the staff room is no longer his.
- Quote (95): "The day I got the job, the staff room went quiet when I walked in. Nobody tells you about that." - Daniyal Hashmi

**75 - We said yes to the contract** (`#ep-75`)

- Blurb (137): Emiko took a public contract that doubled her shelter's beds and its paperwork. On what the money changed, and what she would sign again.
- Note: Why she said yes to a contract her own staff were split on.
- Note: What reporting requirements did to the front desk, and how they fixed it.
- Note: The clause she would negotiate harder next time.
- Quote (98): "We got forty more beds and four hundred more pages. I would still sign it. I would read it slower." - Emiko Tanabe

**74 - My mother's kitchen table** (`#ep-74`)

- Blurb (134): Beatriz grew up translating letters for her neighbours. On turning a kitchen table into an advice centre, and the first case she lost.
- Note: Translating official letters for neighbours at nine years old.
- Note: From a kitchen table to a registered advice centre with four staff.
- Note: The first case she lost, and what it changed about how she promises help.
- Quote (91): "I was nine, reading a landlord's letter to a grown man. That was the first day of this job." - Beatriz Fonseca

**73 - What no one tells you about public money** (`#ep-73`)

- Blurb (140): Farid hands out public money for a living and says the job is mostly listening. On audits, trust, and the application he still thinks about.
- Note: What a grants manager actually does between the deadline and the decision.
- Note: Why audits are not the enemy, and when they are.
- Note: The application he turned down and still thinks about.
- Quote (97): "Public money comes with a thousand rules and one question: could you explain this to a neighbour?" - Farid Haidari

**72 - A choir, a van and a very old dog** (`#ep-72`)

- Blurb (134): Siobhan coordinates ninety volunteers and sings alto on Tuesdays. A lighter one: the delivery van, her old dog, and never saying busy.
- Note: How she keeps ninety volunteers turning up, and why she learns every name.
- Note: The delivery van that has outlasted three coordinators.
- Note: Choir on Tuesdays, and why she has banned the word busy.
- Quote (90): "Volunteers do not leave because of the work. They leave because nobody learned their name." - Siobhan Keane

**71 - Starting again at fifty** (`#ep-71`)

- Blurb (130): Henry left a bank at fifty to teach teenagers to fix bikes. On a pay cut, a cold garage, and the first kid who came back to teach.
- Note: Leaving a thirty-year banking career without a plan B.
- Note: The first winter in an unheated garage with six teenagers and four bikes.
- Note: What it meant when a former trainee came back as an instructor.
- Quote (95): "I spent thirty years moving numbers. Now a kid rides off on something we fixed. I can see that." - Henry Tso

### 04 #audio (notice) - PLACEHOLDER CONTENT

- **title:** AUDIO IS COMING TO THIS PAGE
- **text:** We are still wiring the player. Until then, every episode is on your podcast platform: search for Latte with Lata, or use the links below.
- **platforms:**
  - name: Spotify | href: # | icon: i-spotify | placeholder: true
  - name: Apple Podcasts | href: # | icon: i-apple | placeholder: true
  - name: YouTube | href: # | icon: i-youtube | placeholder: true
  - name: RSS | href: # | icon: i-rss | placeholder: true

### 05 #next (cta)

- **title:** HEAR THE NEXT ONE IN THE ROOM
- **text:** Every episode is recorded live on a Thursday night. It is free, and there is a chair for you.
- **ctas:**
  - label: What's on | href: events.html
  - label: Suggest a guest | href: contact.html?topic=podcast-guest

---

## events.html

- `<title>`: Events | Latte with Lata (24 chars)
- Meta description (146 chars): Thursday recording nights at Latte with Lata: free, doors 6:30 pm, recording from 7:00 pm. See who is at the corner table next and reserve a seat.

### 01 hero

- Eyebrow: What's on
- h1: **THURSDAY NIGHTS, LIVE** (21 chars)
- Intro (110 chars): Every Thursday the chairs turn to face the corner table. Free, doors at 6:30 pm, and there is a chair for you.
- Image: `assets/images/page-events.jpg` - alt: The cafe at night, tables full and warm light in the windows.

### 02 #recording-night (explainer) - PLACEHOLDER CONTENT

- **eyebrow:** Every Thursday
- **title:** THE RECORDING NIGHT
- **lead:** Coffee. Leadership. Purpose. Real conversation. Thursday nights from 6:30 pm the chairs turn to face the corner table, and there is one for you.
- **paragraphs:**
  1. Every episode of the podcast is recorded live in the cafe on a Thursday night, in front of whoever turns up. One guest, one conversation, four parts, with a short break halfway.
  2. It is free. Seats are first come, first seated. If you want to be sure of a chair, reserve one online and we will hold it until 6:50 pm.
  3. The kitchen runs a short list of plates until 8:30 pm and the counter stays open. When the recording ends the guest stays for a coffee, and so can you.
- **facts:**
  - label: Price | value: Free
  - label: Seats | value: 40. First come, first seated, or reserve to be sure.
  - label: Doors | value: 6:30 pm
  - label: Recording | value: 7:00 pm to 8:15 pm
  - label: Kitchen | value: Night plates until 8:30 pm
- **timeline:**
  - time: 6:00 pm | label: The cafe closes for half an hour while we turn the room.
  - time: 6:30 pm | label: Doors. Find a seat, order a drink, order a plate.
  - time: 6:50 pm | label: Reserved seats that are still empty go to the room.
  - time: 7:00 pm | label: Recording starts. Phones on silent. There is a short break halfway.
  - time: 8:15 pm | label: Recording ends. The guest stays for a coffee.
  - time: 8:30 pm | label: Last plates from the kitchen.
  - time: 9:30 pm | label: We lock up, give or take a conversation.
- **ctas:**
  - label: Reserve a seat | href: book.html?type=recording
  - label: See the night plates | href: menu.html#thursday-plates

### 03 #upcoming (event-list) - PLACEHOLDER CONTENT

**AT THE CORNER TABLE NEXT** - Coming up. The next eight Thursdays. Guests sometimes change at short notice; this page is always the current list.

Labels: `doors` Doors · `guest` Guest · `seatsLeft` {n} seats left · `full` Fully reserved. Walk in anyway: reserved seats still empty at 6:50 pm go to the room. · `free` Free · `reserve` Reserve a seat · `part` Leans on. Empty state: No recording nights are listed right now. Check back on Monday.

| Date | id | Title | Guest | Role | Pillar | Image |
|---|---|---|---|---|---|---|
| Thu 24 Sep 2026 | `rec-2026-09-24` | The clinic between the dryers | Dr Laila Mansour | Family physician and co-director, Washday Health Project | The Origin Story | `event-01.jpg` |
| Thu 1 Oct 2026 | `rec-2026-10-01` | A living wage on a charity budget | Jerome Baptiste | Chief executive, Harrowfield Disability Alliance | The Hard Trade-off | `event-02.jpg` |
| Thu 8 Oct 2026 | `rec-2026-10-08` | What no one tells you about your first board | Mei-Ling Zhou | Board chair, Lantern Arts Trust | What No One Tells You | `event-03.jpg` |
| Thu 15 Oct 2026 | `rec-2026-10-15` | Allotments, marathons and a terrible first boss | Tobias Engel | Director, Greenway Parks Conservancy | The Coffee Break | `event-04.jpg` |
| Thu 22 Oct 2026 | `rec-2026-10-22` | From the classroom to the council chamber | Renata Kowalczyk | City councillor and former teacher, Harrowfield | The Origin Story | `event-01.jpg` |
| Thu 29 Oct 2026 | `rec-2026-10-29` | When the funder is wrong | Arjun Pillai | Executive director, Clearwater Rivers Trust | The Hard Trade-off | `event-02.jpg` |
| Thu 5 Nov 2026 | `rec-2026-11-05` | What no one tells you about leaving | Ruth Abernathy | Outgoing director, Fenwick Women's Refuge | What No One Tells You | `event-03.jpg` |
| Thu 12 Nov 2026 | `rec-2026-11-12` | A school in a church hall | Ibrahim Saleh | Head teacher, Open Door Community School | The Origin Story | `event-04.jpg` |

- **Thu 24 Sep 2026** - Laila started seeing patients in a laundromat because that is where people already were. On going to the waiting room instead of building one. (doors 6:30 pm, 40 seats, Free; reserve -> `book.html?type=recording&date=2026-09-24`)
- **Thu 1 Oct 2026** - Jerome raised every wage to a living wage and cut a programme to pay for it. On the sums, the board, and the letter he wrote to families. (doors 6:30 pm, 40 seats, Free; reserve -> `book.html?type=recording&date=2026-10-01`)
- **Thu 8 Oct 2026** - Mei-Ling joined a board at twenty-eight and chaired it at thirty-four. On reading accounts, asking the obvious question, and when to resign. (doors 6:30 pm, 40 seats, Free; reserve -> `book.html?type=recording&date=2026-10-08`)
- **Thu 15 Oct 2026** - Tobias looks after eleven parks and one stubborn allotment. A lighter evening: on running slowly, growing leeks, and the boss who taught him what not to do. (doors 6:30 pm, 40 seats, Free; reserve -> `book.html?type=recording&date=2026-10-15`)
- **Thu 22 Oct 2026** - Renata taught history for fifteen years before she stood for election. On the pothole that started it, and what a classroom teaches about a chamber. (doors 6:30 pm, 40 seats, Free; reserve -> `book.html?type=recording&date=2026-10-22`)
- **Thu 29 Oct 2026** - Arjun told his largest funder their flagship project would not work. On evidence, nerve, and keeping the relationship after the meeting. (doors 6:30 pm, 40 seats, Free; reserve -> `book.html?type=recording&date=2026-10-29`)
- **Thu 5 Nov 2026** - Ruth is handing over the refuge she has run for nineteen years. On succession, staying out of the way, and what she is afraid of missing. (doors 6:30 pm, 40 seats, Free; reserve -> `book.html?type=recording&date=2026-11-05`)
- **Thu 12 Nov 2026** - Ibrahim opened a school with thirty pupils, borrowed chairs and no playground. On the first inspection, and the parents who stayed. (doors 6:30 pm, 40 seats, Free; reserve -> `book.html?type=recording&date=2026-11-12`)

### 04 #house-rules (list)

- **eyebrow:** In the room
- **title:** HOUSE RULES
- **intro:** There are not many.
- **items:**
  - title: Phones on silent | body: The microphones hear everything. So does the person next to you.
  - title: Applause is welcome | body: So is laughing. It is a live room and it should sound like one.
  - title: You may appear in photos | body: We record audio and sometimes take photos for the show. We say so at the door. If you would rather stay out of frame, tell a member of staff and we will seat you accordingly.
  - title: Be seated by 6:50 pm | body: Reserved seats are released at 6:50 pm. Once the recording starts we seat latecomers at the back, between parts.
  - title: Save your questions for afterwards | body: There is no question time on the recording. The guest stays for a coffee, so ask them in person.

### 05 #other-events (cards) - PLACEHOLDER CONTENT

- **eyebrow:** Also on
- **title:** OTHER WAYS TO USE THE ROOM
- **items:**
  - Open table
    - **id:** open-table
    - **title:** Open table
    - **when:** First Saturday of the month, 9:00 am to 10:30 am
    - **body:** No guest and no microphones. One long table, a pot of filter coffee and one question about work on a card in the middle. Free. Just turn up and buy your own breakfast.
    - **next:**
      - date: 2026-10-03 | dateLabel: Sat 3 Oct 2026
      - date: 2026-11-07 | dateLabel: Sat 7 Nov 2026
      - date: 2026-12-05 | dateLabel: Sat 5 Dec 2026
    - **cta:**
      - `label` Ask about Open table
      - `href` contact.html?topic=events
  - Private hire
    - **id:** private-hire
    - **title:** Private hire
    - **when:** Monday to Wednesday evenings, from 6:30 pm
    - **body:** The room seats up to 40 for a board evening, a team away-day or a community meeting: somewhere a group can talk properly. We can run the night plates or a set menu.
    - **cta:**
      - `label` Ask about private hire
      - `href` contact.html?topic=events

### 06 #faqs (faq)

**BEFORE YOU COME** - Good to know

- **Do I need a ticket?** No. It is free and you can walk in. If you want to be sure of a seat, reserve one online. Reserved seats are held until 6:50 pm.
- **Can I bring children?** Yes, if they can sit through an hour of grown-up conversation. The talk is for adults and sometimes covers illness, prison, loss and money.
- **Is the room accessible?** Entry is step-free and there is an accessible toilet. Tell us what you need when you reserve and we will hold a seat that works, including space for a wheelchair.
- **Will I be on the recording?** You will be heard clapping and laughing with everyone else. We never record audience conversations, and we say at the door when photos are being taken.

### 07 #reserve (cta)

- **title:** THERE IS A CHAIR FOR YOU
- **text:** Reserve a seat for a recording night, or catch up on the conversations you missed.
- **ctas:**
  - label: Reserve a seat | href: book.html?type=recording
  - label: All episodes | href: episodes.html

---

## contact.html

- `<title>`: Contact | Latte with Lata (25 chars)
- Meta description (152 chars): Find Latte with Lata at 27 Bellwood Street, Harrowfield. Opening hours, directions, and how to write to us about bookings, events, press or the podcast.

### 01 hero

- Eyebrow: Contact
- h1: **COME AND FIND US** (16 chars)
- Intro (80 chars): 27 Bellwood Street, on the corner of Fenwick Lane. Call, write, or just walk in.
- Image: `assets/images/page-contact.jpg` - alt: The front of the cafe from the street, door open and tables outside.

### 02 #find-us (find-us) - PLACEHOLDER CONTENT

- **eyebrow:** Find us
- **title:** WHERE WE ARE
- **address:**
  - `name` Latte with Lata
  - `line1` 27 Bellwood Street
  - `line2` Corner of Fenwick Lane
  - `city` Harrowfield
- **phone:** (555) 014-2024
- **tel:** tel:+15550142024
- **email:** hello@lattewithlata.example
- **mailto:** mailto:hello@lattewithlata.example
- **directions:**
  - mode: On foot | icon: walk | text: Five minutes from Harrowfield Market Square. Walk north up Bellwood Street and we are on the corner of Fenwick Lane, under the brown awning. | placeholder: true
  - mode: By bus or train | icon: transit | text: Buses 4 and 11 stop at Fenwick Lane, right outside. Harrowfield Central station is a 12-minute walk. | placeholder: true
  - mode: By bike | icon: bike | text: There are six bike stands on Fenwick Lane, beside the side door. | placeholder: true
  - mode: By car | icon: parking | text: Street parking on Bellwood Street is free for 2 hours. The Market Square car park is five minutes away. There is one accessible bay outside the door. | placeholder: true
- **map:**
  - **label:** Open in maps
  - **href:** #
  - **note:** No map embed. Link the real map URL when the address is real.
- **hoursTitle:** Opening hours
- **hours:**
  - days: Mon - Wed | open: 7:00 am | close: 6:00 pm
  - days: Thu | open: 7:00 am | close: 6:00 pm | note: Reopens 6:30 pm for the recording
  - days: Fri | open: 7:00 am | close: 10:00 pm
  - days: Sat | open: 8:00 am | close: 10:00 pm
  - days: Sun | open: 8:00 am | close: 3:00 pm
- **hoursNote:** Thursdays we reopen at 6:30 pm for the recording. Free, first come first seated, and the guest stays for a coffee afterwards.
- **kitchenNote:** Breakfast until 11:30 am. Brunch and lunch 11:30 am to 3:00 pm. Cakes, pastry and drinks until close.
- **ctas:**
  - label: Book a table | href: book.html
  - label: What's on | href: events.html

### 03 #write (contact-form)

- **eyebrow:** Write to us
- **title:** SEND A MESSAGE
- **intro:** Pick what it is about so it reaches the right person. We reply within 2 working days.
- **responsePromise:** We reply to every message within 2 working days, Monday to Friday. If it is about a booking today, call us instead.
- **topicParam:** topic
- **topics:**
  - value: general | label: A general question | hint: Opening hours, lost property, anything that does not fit below.
  - value: booking | label: A booking or a large group | hint: Parties over 8, changes to a booking, accessibility needs.
  - value: events | label: Events and private hire | hint: Recording nights, Open table, or hiring the room.
  - value: podcast-guest | label: Be a guest or suggest one | hint: Tell us who, what they run, and the decision worth an hour.
  - value: press | label: Press and partnerships | hint: Interviews, features, images and speaking requests.
  - value: other | label: Something else | hint: Feedback, a complaint, or a kind word for the kitchen.
- **fields:**
  - **name:**
    - `label` Your name
    - `autocomplete` name
  - **email:**
    - `label` Email
    - `autocomplete` email
    - `inputmode` email
    - `help` We only use it to reply.
  - **phone:**
    - `label` Phone (optional)
    - `autocomplete` tel
    - `inputmode` tel
  - **topic:**
    - `label` What is it about?
    - `placeholder` Choose a topic
  - **message:**
    - **label:** Your message
    - **help:** A few sentences is plenty. 2,000 characters at most.
    - **maxLength:** 2000
- **consent:** I agree that Latte with Lata may store this message and my contact details so it can reply. I have read the privacy summary.
- **consentLink:**
  - `label` privacy summary
  - `href` #privacy
- **submitLabel:** Send message
- **sendingLabel:** Sending...
- **success:**
  - `title` Message sent
  - `text` Thank you. It is in, and we will reply within 2 working days. For anything about a booking today, call (555) 014-2024.
- **validation:**
  - **name:**
    - `required` Tell us your name.
    - `invalid` Use at least 2 characters.
  - **email:**
    - `required` We need an email address to reply to.
    - `invalid` That email does not look right. Check it and try again.
  - **phone:**
    - `invalid` Enter a phone number with 7 to 15 digits, or leave it blank.
  - **topic:**
    - `required` Choose what your message is about.
  - **message:**
    - `required` Write your message.
    - `tooShort` Give us a little more to go on: at least 10 characters.
    - `tooLong` Keep it under 2,000 characters.
  - **consent:**
    - `required` Please tick the box so we can store and answer your message.
- **errors:**
  - `validation` Some of the form needs another look. The details are next to each field.
  - `rate_limited` That is a lot of messages in a short time. Wait a few minutes and try again.
  - `server_error` Something went wrong on our side and your message was not sent. Try again, or email hello@lattewithlata.example.
  - `unavailable` We could not send your message just now. Try again, or email hello@lattewithlata.example.
  - `network` You seem to be offline. Check your connection and try again.
- **fallback:** Online booking and messages are switched off on this copy of the site. Call (555) 014-2024 or email hello@lattewithlata.example and we will sort it out by hand.

### 04 #press-guests (guidance)

- **eyebrow:** Press and guests
- **title:** PITCHING US
- **columns:**
  - Press
    - **title:** Press
    - **paragraphs:**
      1. For interviews, features or images, choose Press and partnerships and tell us your outlet, your deadline and what you need. We can supply photos of the room, the logo and a short description of the show.
      2. Lata speaks about the podcast in a personal capacity only. She does not comment on behalf of any employer or institution, and requests about her day job will be declined.
    - **cta:**
      - `label` Write to us about press
      - `href` contact.html?topic=press#write
  - Guests
    - **title:** Guests
    - **paragraphs:**
      1. We look for people who run something built around a mission and have a decision they are willing to talk about honestly. Tell us who they are, what they run, and the origin story or trade-off that is worth an hour.
      2. Please do not send a press kit. Three sentences is enough. Nobody pays to appear, and we do not take pitches for products.
    - **cta:**
      - `label` Suggest a guest
      - `href` contact.html?topic=podcast-guest#write

### 05 #privacy (legal) - PLACEHOLDER CONTENT

- **eyebrow:** Privacy
- **title:** WHAT WE DO WITH YOUR DETAILS
- **template:** true
- **reviewNote:** Template for legal review. Written in plain language for the study build; it has not been checked by a lawyer and must be reviewed against local privacy law before launch.
- **intro:** This is a plain summary of what this site collects, why, and how long we keep it. We collect as little as we can.
- **blocks:**
  - title: Who we are | body: Latte with Lata, 27 Bellwood Street, Harrowfield. For anything about your data, email hello@lattewithlata.example or ask at the counter.
  - title: When you book a table or reserve a seat | body: We collect your name, email, phone number, the date, time and size of your party, and any occasion or notes you choose to add. We use them to hold your table, to contact you if something changes, and to recognise you if you book again. We keep booking records for 12 months after the date of the booking, then delete them.
  - title: When you send us a message | body: We collect your name, email, phone number if you give one, the topic and your message. We use them to reply. We keep messages for 12 months after our last reply, then delete them.
  - title: When you join the newsletter | body: We collect your email address, the date you agreed and the page you signed up on. We use it to send one email a week. We keep it until you unsubscribe, which you can do from any email or by asking us.
  - title: Marketing | body: We only send marketing email if you tick the box. Booking without ticking it changes nothing about your booking.
  - title: Who sees it | body: Cafe staff who need it to run bookings and answer messages. We do not sell your details, share them with advertisers or pass them to the host's employer or any other institution.
  - title: Cookies | body: The public site sets no advertising or tracking cookies. The staff sign-in to the booking system uses one essential cookie.
  - title: Recording nights | body: Thursday recordings are audio-recorded and sometimes photographed. We say so at the door. Tell a member of staff if you would rather stay out of photos.
  - title: Asking us to delete or correct something | body: Email hello@lattewithlata.example from the address you used, or ask at the counter. Tell us what you want removed: a booking, a message, your newsletter sign-up or everything. We confirm within 2 working days and finish within 30 days. We may need to keep anything the law requires us to keep.
- **retention:**
  - data: Bookings | period: 12 months after the booking date
  - data: Messages | period: 12 months after our last reply
  - data: Newsletter sign-ups | period: Until you unsubscribe
- **updated:** Last updated 17 Sep 2026

### 06 #credits (credits)

- **eyebrow:** Photo credits
- **title:** WHO TOOK THE PHOTOS
- **text:** Apart from the photo of Lata Singh, which is her own, the photos and the home-page video on this site are licensed images from Wikimedia Commons, used under CC0, CC BY or CC BY-SA terms. Every photographer, licence and source link is listed in the site's asset register (ASSETS.md) and in the Photo credits panel in the footer.
- **note:** Spotted a missing or wrong credit? Write to us and we will fix it within 2 working days.
- **cta:**
  - `label` Report a credit
  - `href` contact.html?topic=other#write

---

## book.html

- `<title>`: Book a Table | Latte with Lata (30 chars)
- Meta description (150 chars): Book a table at Latte with Lata in Harrowfield, or reserve a free seat at a Thursday recording night. It takes about a minute. No deposit, no account.

### 01 hero

- Eyebrow: Bookings
- h1: **BOOK A TABLE** (12 chars)
- Intro (108 chars): Pick a day, a time and a party size. It takes about a minute, and you get a booking reference straight away.
- Image: `assets/images/page-book.jpg` - alt: A set table by the cafe window with two cups and a small reserved sign.

### 02 #booking (booking-form)

- **eyebrow:** Book online
- **title:** A TABLE OR A SEAT
- **intro:** No deposit and no account. Walk-ins are always welcome too; booking just means the table is waiting.
- **typeToggle:**
  - **legend:** What would you like to book?
  - **options:**
    - value: table | label: A table | hint: Breakfast, lunch, coffee or a Friday or Saturday evening. Up to 8 people.
    - value: recording | label: A seat at the recording | hint: Thursday nights. Free. Doors at 6:30 pm. Up to 4 seats.
  - **recordingExplainer:**
    - **title:** About recording nights
    - **text:** Every Thursday we record the podcast live at the corner table. It is free: walk in, or reserve up to 4 seats and we will hold them until 6:50 pm. Doors open at 6:30 pm, the recording runs from 7:00 pm to 8:15 pm, and the kitchen serves plates until 8:30 pm.
    - **link:**
      - `label` See who is on
      - `href` events.html#upcoming
- **steps:**
  - id: when | n: 1 | label: When | title: Pick a day | help: We take bookings up to 60 days ahead. Days we are closed or full are greyed out. | helpRecording: Recording nights are Thursdays. Pick one from the list.
  - id: time | n: 2 | label: Time | title: Pick a time | help: Times are shown in 30-minute steps. A sitting is 90 minutes. Greyed-out times are full. | helpRecording: Doors open at 6:30 pm. Be seated by 6:50 pm.
  - id: party | n: 3 | label: Party | title: How many of you? | help: Up to 8 online. For a bigger group, call or email and we will plan the tables. | helpRecording: Up to 4 seats on one reservation, so there is room for everyone. Count children too. | max: 8 | maxRecording: 4
  - id: details | n: 4 | label: Your details | title: Who is it for? | help: We use these to hold the booking and to reach you if something changes. Nothing else.
  - id: confirm | n: 5 | label: Confirm | title: Check and confirm | help: Have a last look. You can cancel online up to 2 hours before.
- **fields:**
  - **date:**
    - `label` Date
  - **time:**
    - `label` Time
  - **party:**
    - `label` Number of people
    - `inputmode` numeric
    - `decrease` One fewer
    - `increase` One more
    - `unitOne` person
    - `unitMany` people
    - `seatOne` seat
    - `seatMany` seats
  - **name:**
    - `label` Name for the booking
    - `autocomplete` name
  - **email:**
    - `label` Email
    - `autocomplete` email
    - `inputmode` email
    - `help` You need this, with your reference, to change or cancel.
  - **phone:**
    - `label` Mobile number
    - `autocomplete` tel
    - `inputmode` tel
    - `help` Only used if something changes on the day.
  - **occasion:**
    - `label` Occasion (optional)
    - `placeholder` No occasion
  - **notes:**
    - **label:** Anything we should know? (optional)
    - **help:** Allergies, a high chair, step-free seating, a quiet corner. 500 characters at most.
    - **maxLength:** 500
- **occasions:**
  - value: none | label: No occasion
  - value: birthday | label: Birthday
  - value: meeting | label: Work meeting
  - value: date | label: Date
  - value: recording-guest | label: Here for the recording night
  - value: other | label: Something else
- **availability:**
  - **loading:** Checking the book...
  - **closed:** We are closed that day. Pick another date.
  - **noSlots:** Nothing left for that party size on this day. Try another day, or call us.
  - **seatsLeft:** {n} seats left
  - **lastFew:** Last few
  - **full:** Full
  - **recordingFull:** This night is fully reserved. Walk in anyway: reserved seats still empty at 6:50 pm go to the room.
  - **timezoneNote:** All times are local cafe time.
  - **reasons:**
    - `invalid_date` That date does not look right. Pick another.
    - `past` That date has passed. Pick today or later.
    - `too_far` We take bookings up to 60 days ahead. Pick an earlier date.
    - `blocked` We are not taking bookings on that date. Pick another, or call us.
    - `closed` We are closed that day. Pick another date.
    - `not_recording_night` Recording nights are Thursdays, doors at 6:30 pm. Pick a Thursday.
    - `too_late_today` Online booking has closed for today. Call us and we will do our best.
    - `full` We are fully booked for that party size on this date. Try another day, or call us.
- **summary:**
  - `title` Your booking
  - `type` Booking
  - `typeTable` A table
  - `typeRecording` Seats at the recording
  - `date` Date
  - `time` Time
  - `party` Party
  - `name` Name
  - `email` Email
  - `phone` Phone
  - `occasion` Occasion
  - `notes` Notes
  - `edit` Change
- **consent:** I agree that Latte with Lata may store these details to manage my booking. I have read the privacy summary.
- **consentLink:**
  - `label` privacy summary
  - `href` contact.html#privacy
- **marketingOptIn:** Also send me the Thursday email: who is at the corner table next, and what the kitchen is doing. One email a week, unsubscribe any time.
- **buttons:**
  - `next` Next
  - `back` Back
  - `confirm` Confirm booking
  - `confirmRecording` Reserve my seats
  - `sending` Booking...
  - `startOver` Start again
- **validation:**
  - **type:**
    - `required` Choose a table or a seat at the recording.
  - **date:**
    - `required` Pick a date.
    - `invalid` That date does not look right.
    - `past` That date has passed. Pick today or later.
    - `tooFar` We take bookings up to 60 days ahead.
    - `closed` We are closed that day. Pick another date.
    - `notRecordingNight` Recording nights are Thursdays. Pick a Thursday.
  - **time:**
    - `required` Pick a time.
    - `invalid` Pick one of the times shown.
    - `unavailable` That time has just been taken. Pick another.
  - **party:**
    - `required` Tell us how many people are coming.
    - `invalid` Enter a number from 1 to 8.
    - `min` A booking needs at least 1 person.
    - `max` Online bookings go up to 8. For a bigger group, call or email us.
    - `maxRecording` Recording night seats are limited to 4 per reservation.
  - **name:**
    - `required` Tell us the name for the booking.
    - `invalid` Use at least 2 characters.
    - `tooLong` Keep the name under 80 characters.
  - **email:**
    - `required` We need an email so you can find or cancel your booking.
    - `invalid` That email does not look right. Check it and try again.
  - **phone:**
    - `required` We need a number in case something changes on the day.
    - `invalid` Enter a phone number with 7 to 15 digits.
  - **occasion:**
    - `invalid` Choose an occasion from the list, or leave it blank.
  - **notes:**
    - `tooLong` Keep notes under 500 characters.
  - **consent:**
    - `required` Please tick the box so we can hold the booking.
- **errors:**
  - `validation` Some details need another look. The messages are next to each field.
  - `slot_full` Someone just took the last table at that time. Pick another time and we will hold it for you.
  - `duplicate` You already have a booking at that time under this email. Use Manage a booking to check or cancel it.
  - `rate_limited` That is a lot of attempts in a short time. Wait a few minutes and try again, or call us.
  - `unavailable` The booking system is not answering right now. Try again in a minute, or call (555) 014-2024.
  - `party_too_large` Online bookings go up to 8. For a bigger group, call (555) 014-2024 or email hello@lattewithlata.example.
  - `closed` We are closed at that time. Pick another day or time.
  - `tonight_closed` Online booking for tonight has closed. Come to the door: walk-ins are seated if there is room.
  - `server_error` Something went wrong on our side. Your booking was not made. Try again, or call (555) 014-2024.
  - `network` You seem to be offline. Check your connection and try again.
- **success:**
  - **title:** You are booked
  - **titleRecording:** Your seats are reserved
  - **text:** A table for {party} on {date} at {time}. Your reference is {reference}.
  - **textRecording:** {party} at the recording on {date}. Doors open at {time}. Your reference is {reference}.
  - **partyTokenNote:** {party} is always a counted label, never a bare number: '1 person' / '2 people' for a table, '1 seat' / '2 seats' for a recording night (fields.party.unitOne / unitMany / seatOne / seatMany). The same rule applies to the manage copy.
  - **referenceLabel:** Booking reference
  - **keep:** Keep this reference. You need it, with your email, to change or cancel the booking.
  - **hold:** We hold tables for 15 minutes. If you are running late, call (555) 014-2024.
  - **holdRecording:** Reserved seats are held until 6:50 pm, then released to the room.
  - **pending:** Your request is in, and we will confirm it shortly. Your reference is {reference}.
  - **emailLine:** We have also sent these details to your email.
  - **emailLineNote:** Show emailLine only once confirmation emails are really sent. The study build writes to an outbox file and sends nothing.
  - **actions:**
    - label: See the menu | href: menu.html
    - label: Manage this booking | href: #manage
    - label: Book another | href: #booking
- **fallback:** Online booking and messages are switched off on this copy of the site. Call (555) 014-2024 or email hello@lattewithlata.example and we will sort it out by hand.

### 03 #policy (list)

- **eyebrow:** The small print
- **title:** HOW BOOKINGS WORK
- **items:**
  - id: hold | title: We hold your table for 15 minutes | body: After that it goes back to the room. Call if you are running late and we will do what we can.
  - id: sitting | title: Sittings are 90 minutes | body: Long enough for breakfast and a second coffee. If nobody is waiting, stay as long as you like.
  - id: large | title: Parties over 8: call or email | body: We plan big tables by hand. Call (555) 014-2024 or email hello@lattewithlata.example a few days ahead.
  - id: cancel | title: Cancel up to 2 hours before | body: Use Manage a booking with your reference and email. Inside 2 hours, please call so the table can go to someone else.
  - id: free | title: No deposit, no card | body: Booking is free. Recording nights are free too.
- **contact:**
  - `phone` (555) 014-2024
  - `tel` tel:+15550142024
  - `email` hello@lattewithlata.example
  - `mailto` mailto:hello@lattewithlata.example

### 04 #manage (manage-booking)

- **eyebrow:** Already booked?
- **title:** MANAGE A BOOKING
- **intro:** Enter your booking reference and the email you booked with.
- **fields:**
  - **reference:**
    - `label` Booking reference
    - `placeholder` LWL-XXXXXX
    - `help` Six characters after LWL-. It was shown when you booked.
    - `autocomplete` off
  - **email:**
    - `label` Email
    - `autocomplete` email
    - `inputmode` email
- **submitLabel:** Find my booking
- **searchingLabel:** Looking...
- **found:**
  - **title:** Your booking
  - **text:** {party} on {date} at {time}. Reference {reference}.
  - **statusLabel:** Status
  - **statuses:**
    - `pending` Waiting for confirmation
    - `confirmed` Confirmed
    - `seated` Seated
    - `completed` Completed
    - `cancelled` Cancelled
    - `no_show` Missed
- **cancel:**
  - `button` Cancel this booking
  - `confirmTitle` Cancel this booking?
  - `confirmText` Your booking for {party} on {date} at {time} will be cancelled. This cannot be undone.
  - `confirmYes` Yes, cancel it
  - `confirmNo` Keep my booking
  - `done` Booking {reference} is cancelled. Thank you for letting us know.
  - `tooLate` It is less than 2 hours before your booking, so it cannot be cancelled online. Please call (555) 014-2024.
  - `alreadyCancelled` This booking has already been cancelled.
- **change:** To change the day, time or party size, cancel this booking and make a new one, or call us and we will move it for you.
- **validation:**
  - **reference:**
    - `required` Enter your booking reference.
    - `invalid` A reference looks like LWL-ABC123.
  - **email:**
    - `required` Enter the email you booked with.
    - `invalid` That email does not look right. Check it and try again.
- **errors:**
  - `not_found` We could not find a booking with that reference and email. Check both and try again.
  - `too_late` It is less than 2 hours before your booking, so it cannot be cancelled online. Please call (555) 014-2024.
  - `not_cancellable` This booking can no longer be cancelled online. Please call (555) 014-2024.
  - `already_cancelled` This booking has already been cancelled.
  - `server_error` Something went wrong on our side. Nothing was changed. Try again, or call (555) 014-2024.
  - `rate_limited` That is a lot of attempts in a short time. Wait a few minutes and try again.
  - `unavailable` The booking system is not answering right now. Try again in a minute, or call (555) 014-2024.
  - `network` You seem to be offline. Check your connection and try again.

### 05 #help (cta)

- **title:** RATHER TALK TO A PERSON?
- **text:** Call (555) 014-2024 during opening hours, or write to us and we will reply within 2 working days.
- **ctas:**
  - label: Call (555) 014-2024 | href: tel:+15550142024
  - label: Write to us | href: contact.html?topic=booking


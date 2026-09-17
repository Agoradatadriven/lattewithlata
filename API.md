# Latte with Lata - booking + CRM API

`server.cjs` serves the static site **and** a JSON API under `/api`. Zero npm dependencies (Node built-ins only), data in
JSON files under `data/`. `serve.cjs` stays as the static-only server. Contract source: `PAGES-SPEC.md` section 4.

```
node server.cjs                 # http://localhost:5178/   (PORT env or first numeric argument changes the port)
node server.cjs 5402
node server.cjs --seed          # clearly-marked DEMO data (demo: true, fictional names, @example.com, 555 numbers)
node server.cjs --reset         # prints, then deletes, every data file (keeps admin-token.txt; --reset --all removes it too)
node server.cjs --help
node test/api.test.cjs          # 59 tests, boots its own server on 5402 (TEST_PORT env changes it) with a temp data dir
```

| Env | Meaning |
|---|---|
| `PORT` | listen port (default 5178; an argv port wins) |
| `HOST` | bind address (default `127.0.0.1`; use `0.0.0.0` on a host / in a container) |
| `DATA_DIR` | data folder (default `./data`) |
| `ADMIN_TOKEN` | CRM sign-in token. Unset: a token is generated at first start, saved to `data/admin-token.txt`, printed as `Admin token: ...` |
| `TRUST_PROXY=1` | number of reverse proxies in front (`1`, `2` ...): trust `X-Forwarded-For` / `X-Forwarded-Host` for rate limits, the login lockout and the admin Origin check. The client is the entry the outermost proxy **appended** (the Nth from the right), never the left-most one a client can spoof. Set it behind a proxy only, never when exposed directly |
| `LWL_CSP_RELAXED=1` | escape hatch: allow all inline scripts instead of hash-listed ones |
| `LWL_QUIET=1` | no per-request log line |

## Conventions

- JSON in, JSON out, UTF-8. Every `/api` response has `Cache-Control: no-store`.
- Dates `YYYY-MM-DD`, times `HH:MM` (24 h). **All times are the server's local time** - run the server in the cafe's time zone (`TZ=...`).
- Errors: `{ "error": "<code>", "message": "human sentence", "fields": { "<name>": "message for that input" } }` (`fields` only on validation errors).

| Status | `error` | When |
|---|---|---|
| 400 | `validation` | one or more fields are wrong - show `fields[name]` next to the input |
| 400 | `invalid_json` | body is not a JSON object |
| 401 | `unauthorized` / `invalid_token` | admin route without a session / wrong token |
| 403 | `forbidden` | public POST without `X-Requested-With: fetch`; cross-origin admin write |
| 404 | `not_found` | unknown route, booking, customer, message, subscriber |
| 405 | `method_not_allowed` | wrong verb (see `Allow` header) |
| 409 | `slot_full` | not enough seats left (`seatsLeft` is included) |
| 409 | `duplicate` | same email + date + time already booked (and not cancelled) |
| 409 | `too_late` / `not_cancellable` | guest cancel inside 2 hours / booking already seated, completed or no-show |
| 413 | `payload_too_large` | body over 20 KB |
| 429 | `rate_limited` | see `Retry-After` header and `retryAfter` (seconds) |
| 500 | `server_error` | unexpected |

**Public POST rules**: header `X-Requested-With: fetch` (403 without), body <= 20 KB, `consent: true`, and the hidden honeypot
field `website` must be empty. A filled honeypot gets a fake success (201, plausible body) and **nothing is stored**.
Rate limit: 10 POSTs / minute and 60 / hour per IP. Booking lookups: 30 / minute per IP.

---

## Public routes

### `GET /api/health`
```json
{ "ok": true, "version": "1.0.0", "time": "2026-09-17T06:19:44.735Z" }
```
If this fails (static hosting), forms must show the call / email fallback instead of pretending to work.

### `GET /api/config`
```json
{
  "hours": { "mon": { "open": "07:00", "close": "18:00" }, "tue": {...}, "wed": {...}, "thu": {...},
             "fri": { "open": "07:00", "close": "22:00" }, "sat": { "open": "08:00", "close": "22:00" }, "sun": { "open": "08:00", "close": "15:00" } },
  "slotMinutes": 30, "turnMinutes": 90, "lastSeatingMinutes": 90,
  "maxParty": 8,
  "largePartyNote": "For parties of more than 8, please call us on (555) 014-2024 or email hello@lattewithlata.example and we will set the room up for you.",
  "recording": { "weekday": 4, "doors": "18:30", "seats": 40, "maxParty": 4 },
  "blockedDates": [], "hoursOverrides": {},
  "timezoneNote": "All times are local cafe time.",
  "leadDays": 60, "minLeadMinutes": 60, "cancelCutoffMinutes": 120,
  "today": "2026-09-17",
  "contact": { "phone": "(555) 014-2024", "phoneHref": "tel:+15550142024", "email": "hello@lattewithlata.example", "address": { "line1": "27 Bellwood Street", "line2": "Corner of Fenwick Lane", "city": "Harrowfield" } }
}
```
A closed weekday is `null`. `hoursOverrides` is `{ "YYYY-MM-DD": { open, close } | null }` (null = closed that date). Hours are seeded
from `content/site.json` `visit.hours` on first start and then live in `data/settings.json`.

### `GET /api/availability?date=YYYY-MM-DD&party=N&type=table|recording[&excludeRef=LWL-XXXXXX]`
`type` defaults to `table`, `party` to 2 (1 for recording).
```json
{ "date": "2026-09-21", "type": "table", "party": 2, "open": true, "hours": { "open": "07:00", "close": "18:00" },
  "slots": [ { "time": "07:00", "available": true, "seatsLeft": 28 },
             { "time": "12:00", "available": false, "seatsLeft": 1, "reason": "full" },
             { "time": "16:30", "available": true, "seatsLeft": 28 } ] }
```
- Slots run every 30 minutes from opening to **90 minutes before closing**. A booking holds its seats for 90 minutes (its slot and
  the next two); `seatsLeft` is the tightest of those three slots; `available` = `seatsLeft >= party` and the slot is at least
  60 minutes away. An unavailable slot carries `reason`: `"full"` or `"past"`.
- Not bookable that day: `{ "open": false, "reason": "The cafe is closed on that day.", "reasonCode": "closed", "slots": [] }`.
  `reason` is a sentence you can show; `reasonCode` is one of `past | too_far | blocked | closed | not_recording_night | invalid_date`.
  When the day is open but nothing is bookable, `reasonCode` is `full` or `too_late_today` (slots are still listed).
- `type=recording`: only Thursdays; exactly one slot at doors: `"slots": [ { "time": "18:30", "available": true, "seatsLeft": 36 } ]`.
- 400 `validation`: bad `date`, `party` < 1, `party` > 8 (`fields.party` = the large-party note), recording `party` > 4.
- `excludeRef` (**staff only**): "count the seats as if this booking did not exist" - the CRM sends it while a booking is being edited, so
  the booking's own seats are not counted against it (the same rule `PATCH /api/admin/bookings/:reference` applies). Case-insensitive; an
  unknown reference changes nothing. It is honoured **only when the request carries a valid admin session cookie** and silently ignored
  otherwise - on the public endpoint it would let anyone test whether a reference exists and how large that party is.

### `POST /api/bookings`
```json
{ "type": "table", "date": "2026-09-21", "time": "12:00", "party": 4, "name": "Marisol Vega", "email": "marisol@example.com",
  "phone": "+1 555 010 0199", "occasion": "birthday", "notes": "Window table if possible", "marketingOptIn": true, "consent": true, "website": "" }
```
201:
```json
{ "reference": "LWL-7KQ2MD", "status": "confirmed",
  "booking": { "reference": "LWL-7KQ2MD", "type": "table", "date": "2026-09-21", "time": "12:00", "party": 4, "status": "confirmed",
               "name": "Marisol Vega", "email": "marisol@example.com", "phone": "+1 555 010 0199", "occasion": "birthday",
               "notes": "Window table if possible", "marketingOptIn": true, "createdAt": "...", "updatedAt": "...",
               "cancellable": true, "cancelBy": "2026-09-21T02:00:00.000Z" } }
```
Field rules (each failure is reported under its own key in `fields`):

| Field | Rule |
|---|---|
| `type` | `table` (default) or `recording` |
| `date` | real ISO date; today .. today + 60 days; not blocked; open that day; recording = Thursdays only |
| `time` | `HH:MM` on that day's slot grid and at least 60 minutes ahead. Recording: ignored / forced to doors (`18:30`) |
| `party` | whole number; table 1-8 (above 8: `fields.party` = large-party note), recording 1-4 |
| `name` | 2-80 characters |
| `email` | valid address (stored lower-cased) |
| `phone` | 7-20 characters: digits, spaces, `+` (also tolerated: `( ) - .`), 7-15 digits |
| `occasion` | `none` (default) `birthday` `meeting` `date` `recording-guest` `other` |
| `notes` | <= 500 characters |
| `marketingOptIn` | boolean; `true` also adds the email to the newsletter list (source `booking`) |
| `consent` | must be `true` |
| `website` | honeypot - must be empty |

Tables auto-confirm while capacity allows, otherwise 409 `slot_full` `{ "error": "slot_full", "message": "...", "seatsLeft": 2 }`.
Same email + date + time (not cancelled) -> 409 `duplicate`. References are `LWL-` + 6 characters from
`23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (no 0 / O / 1 / I). The capacity check and the write run inside the datastore's single
write queue, so parallel requests cannot overbook (tested with 10 simultaneous requests).

### `GET /api/bookings/lookup?reference=LWL-XXXXXX&email=guest@example.com`
Both are case-insensitive. -> `{ "booking": { ...guest view as above... } }`. Wrong reference **or** wrong email -> the same 404 `not_found`.
Missing parameters -> 400 with `fields.reference` / `fields.email`.

### `POST /api/bookings/cancel` `{ "reference", "email" }`
-> `{ "booking": { ..., "status": "cancelled", "cancellable": false } }`. Rules: only `pending` / `confirmed` bookings, and not inside
2 hours of the booking time (409 `too_late`; 409 `not_cancellable` for seated / completed / no-show). Cancelling an already
cancelled booking returns 200 with the booking (idempotent). 404 when reference + email do not match.

### `GET /api/events`
Upcoming recording nights from `content/pages.json` -> `events.upcoming` (only dates >= today). If that file / key is missing or has no
upcoming entry, the next 8 Thursdays are generated with the title "Thursday recording night" (`generated: true`, other copy fields `null`).
```json
{ "events": [ { "id": "rec-2026-09-24", "date": "2026-09-24", "doors": "18:30", "title": "The clinic between the dryers",
                "guest": "Dr Laila Mansour", "role": "Family physician ...", "pillar": "The Origin Story", "blurb": "...",
                "image": "assets/images/event-01.jpg", "imageAlt": "...", "seats": 40, "seatsLeft": 36,
                "bookable": true, "bookableReason": null, "type": "recording", "maxParty": 4,
                "dateLabel": "Thu 24 Sep 2026", "start": "19:00", "...": "every other key of the content entry passes through" } ] }
```
`seats` / `doors` always come from the booking settings (single source of truth), `seatsLeft` from live bookings. To RSVP:
`POST /api/bookings` with `type: "recording"`, the event `date`, `party` 1-4.

### `POST /api/contact`
`{ name, email, phone?, topic, message, consent, website }` - `topic`: `general | booking | events | podcast-guest | press | other`
(default `general`); `message` 10-2000 characters. -> 201 `{ "id": "msg_1a2b3c4d5e6f" }`.

### `POST /api/subscribe`
`{ email, consent, source, website }` - `source` is a short free label (`footer`, `newsletter`, `events` ...; default `newsletter`).
-> **201** `{ "ok": true, "status": "subscribed" }` for a new address, **200** `{ "ok": true, "status": "already_subscribed" }` after that.
Consent time and source are stored with the row.

---

## Admin routes (CRM)

Sign in with the token; the server sets `lwl_admin` (HttpOnly, SameSite=Strict, Path=/, Max-Age 12 h, `Secure` when
`X-Forwarded-Proto: https`). Sessions live in memory (a restart signs everyone out). **Every `/api/admin/*` path except login
answers 401 `{ "error": "unauthorized" }` without a valid session.** Admin writes with an `Origin` header that does not match
`Host` are refused (403). `X-Requested-With` is not required on admin routes. Use `fetch(..., { credentials: "same-origin" })`.

| Route | Request | Response |
|---|---|---|
| `POST /api/admin/login` | `{ "token": "..." }` | 200 `{ ok, authenticated: true, expiresAt }` + cookie; 401 `invalid_token`; **5 failed attempts / 15 min per IP -> 429** with `Retry-After` |
| `GET /api/admin/session` | - | `{ ok: true, authenticated: true, expiresAt }` (401 when signed out) |
| `POST /api/admin/logout` | - | `{ ok: true, authenticated: false }`, cookie cleared |
| `GET /api/admin/summary` | - | see below |
| `GET /api/admin/bookings` | `?from=&to=&status=&type=&q=&customerId=&sort=desc` | `{ bookings: [...], total, covers }` sorted by date + time. `status` takes a comma list. `q` searches name, email, phone (digits too) and reference |
| `POST /api/admin/bookings` | `{ type?, date, time, party, name, email?, phone?, occasion?, notes?, internalNotes?, table?, source: "phone"\|"walk-in"\|"admin", status?, force? }` | 201 `{ reference, status, booking }`. Email **or** phone is enough; no consent box; any party size that fits; no lead-time rule. `status`: `pending \| confirmed` (default) `\| seated \| completed` |
| `GET /api/admin/bookings/:reference` | reference is case-insensitive | `{ booking }` = the full staff record (see below); 404 `not_found`. There is **no public by-reference route** - guests always need reference + email (`/api/bookings/lookup`) |
| `PATCH /api/admin/bookings/:reference` | any of `{ status, date, time, party, table, notes, internalNotes, name, phone, occasion, force }` | `{ booking }`. Changing date / time / party (or re-activating a cancelled / no-show booking) re-runs the availability check -> 400 `validation` (closed, off-grid ...) or 409 `slot_full` |
| `GET /api/admin/customers` | `?q=&vip=1&tag=&optin=1` | `{ customers: [...], total }` newest `lastSeen` first |
| `GET /api/admin/customers/:id` | - | `{ customer, bookings: [history, newest first], messages: [...], subscriber, subscribed }` |
| `PATCH /api/admin/customers/:id` | `{ tags?, notes?, vip?, name?, phone?, marketingOptIn? }` | `{ customer }` (tags: <= 12, lower-cased, <= 24 chars; notes <= 2000) |
| `GET /api/admin/messages` | `?status=&topic=&q=` | `{ messages: [...], total, counts: { new, open, done } }` newest first |
| `PATCH /api/admin/messages/:id` | `{ status?: "new"\|"open"\|"done", internalNotes? }` | `{ message }` |
| `GET /api/admin/subscribers` | `?q=` | `{ subscribers: [ { id, email, source, consent, consentAt, createdAt, customerId } ], total }` |
| `DELETE /api/admin/subscribers/id/:id` | the row's `id` (`sub_...`) | `{ ok: true, removed: "<email>", id }`; 404 `not_found` if no such row. Also sets the customer's `marketingOptIn` to false. **Preferred**: no personal data in the URL (or in a proxy / access log). The CRM uses this one |
| `DELETE /api/admin/subscribers/:email` | email URL-encoded | same response and side effects, for API clients that only know the address. 404 if not on the list |
| `GET /api/admin/settings` | - | the settings object at the top level **and** again under `settings` |
| `PUT /api/admin/settings` | any of `{ capacityPerSlot, recordingSeats, blockedDates, hoursOverrides, hours, maxParty, leadDays }` | same shape as GET. Only the keys you send change |
| `GET /api/admin/activity` | `?reference=&who=` | `{ activity: [ { id, at, who, action, reference, detail? } ], total }` latest 500, newest first |
| `GET /api/admin/export?kind=bookings\|customers\|messages\|subscribers` | bookings accept the list filters | CSV download (`text/csv; charset=utf-8`, UTF-8 BOM, CRLF, RFC 4180 quoting, `Content-Disposition: attachment; filename="lwl-<kind>-YYYY-MM-DD.csv"`). Every cell whose text starts with `= + - @`, TAB or CR is prefixed with `'` (CSV / formula-injection guard, no exceptions: `+1 555 ...` phone numbers and negative numbers get it too) |

`force: true` (admin create / PATCH only) skips **every** availability rule - capacity, opening hours / slot grid, blocked dates,
past dates. The booking is stored with `forced: true`. Without `force` staff still get: open day, slot grid, capacity; they are
exempt from the 60-minute lead time, the 60-day window and the online party limits. Messages are written for the person reading
them, never for a developer: a refused staff booking on a past date answers `fields.date` = "That date has already passed. Staff can
still record it with the override." (the CRM's "Book anyway" / override checkbox is what sends `force: true`); a full slot answers 409
`slot_full` with "We only have N seats left at 12:00 pm ..." and `seatsLeft`.

Booking statuses: `pending | confirmed | seated | completed | cancelled | no_show`. `cancelled` and `no_show` free their seats.

Settings validation: `capacityPerSlot` 1-500 (not below `maxParty`), `recordingSeats` 1-500, `maxParty` 1-50, `leadDays` 1-365,
`blockedDates` = array of ISO dates, `hoursOverrides` = `{ "YYYY-MM-DD": { "open": "HH:MM", "close": "HH:MM" } | null }`
(an array of `{ date, open, close }` / `{ date, closed: true }` is accepted too and normalised to the map), `hours` = `{ mon..sun: { open, close } | null }`.

### Full booking record (admin views, `data/bookings.json`)
```json
{ "id": "bkg_ab38ad1670d9", "reference": "LWL-ZJ9DV4", "type": "table", "date": "2026-09-21", "time": "14:30", "party": 3,
  "status": "confirmed", "name": "...", "email": "...", "phone": "...", "occasion": "none", "notes": "", "marketingOptIn": false,
  "consent": true, "consentAt": "...", "table": "", "internalNotes": "", "source": "web | phone | walk-in | admin", "forced": false,
  "customerId": "cus_1bec5c7ff68c", "createdAt": "...", "updatedAt": "...", "cancelledAt": "...", "cancelledBy": "guest | admin", "demo": true }
```

### Customer record (the CRM core, `data/customers.json`)
Upserted on every booking, contact message and newsletter sign-up, keyed by lower-cased email (phone digits when staff take a
booking without an email; the record adopts the email if that phone later books online).
```json
{ "id": "cus_7e5e7345b5db", "key": "basil@example.com", "name": "...", "email": "...", "phone": "...",
  "firstSeen": "...", "lastSeen": "...", "bookings": 2, "covers": 7, "cancellations": 0, "noShows": 0, "upcoming": 1,
  "lastVisit": "2026-09-09", "nextVisit": "2026-09-21", "marketingOptIn": true, "tags": ["regular"], "notes": "", "vip": true }
```
`bookings` = bookings that were not cancelled; `covers` = guests on bookings that were neither cancelled nor no-show;
`lastVisit` = latest seated / completed date; `upcoming` = pending / confirmed bookings still ahead. Aggregates are recomputed
on every booking change and again at read time (so `upcoming` never goes stale).

### `GET /api/admin/summary`
```json
{ "generatedAt": "...",
  "today": { "date": "2026-09-17", "bookings": 3, "covers": 9, "pending": 0, "confirmed": 1, "seated": 1, "completed": 1, "cancelled": 0, "noShows": 0, "list": [ ...today's bookings by time... ] },
  "next7Days": { "from": "2026-09-17", "to": "2026-09-23", "bookings": 14, "covers": 41,
                 "days": [ { "date": "2026-09-17", "bookings": 3, "covers": 9, "tableCovers": 6, "recordingSeats": 3, "closed": false } ] },
  "covers": { "today": 9, "next7Days": 41, "last30Days": 88 },
  "newMessages": 2, "openMessages": 2, "newSubscribers": 5, "subscribers": 15, "customers": 25,
  "noShowRate": 0.083, "noShows": { "count": 2, "outOf": 24, "windowDays": 90 },
  "topGuests": [ { "id", "name", "email", "phone", "bookings", "covers", "noShows", "lastVisit", "vip", "tags" } ],
  "nextRecording": { "date": "2026-09-17", "doors": "18:30", "seats": 40, "seatsLeft": 36 } }
```
`newSubscribers` = joined in the last 7 days. `noShowRate` = no-shows / (seated + completed + no-show) over the last 90 days (0-1).

---

## Data files (`data/`, all gitignored)

| File | Content |
|---|---|
| `bookings.json` | every booking (all statuses) |
| `customers.json` | CRM records |
| `messages.json` | contact-form messages `{ id, name, email, phone, topic, message, status, internalNotes, consentAt, createdAt, updatedAt, customerId }` |
| `subscribers.json` | newsletter list with `consentAt` + `source` |
| `settings.json` | hours, capacity, blocked dates, overrides (written on first start from `content/site.json`) |
| `activity.json` | audit log, newest last, capped at 5000: `{ id, at, who: guest\|admin, action, reference, detail? }` |
| `outbox.json` | emails that *would* have been sent: `{ id, to, subject, text, at, kind, reference, sent: false }`, capped at 2000 |
| `admin-token.txt` | generated admin token (only when `ADMIN_TOKEN` is unset) |
| `*.json.bak`, `*.corrupt-<ts>` | previous good version / an unreadable file moved aside |

Writes are atomic (temp file -> fsync -> rename) and serialised through one queue; an unreadable file is moved aside and the
`.bak` (or an empty default) is used, with a line on stderr.

Activity actions: `booking.created`, `booking.cancelled`, `booking.<status>`, `booking.updated`, `customer.updated`, `message.received`,
`message.<status>`, `message.updated`, `subscriber.added`, `subscriber.removed` (address masked), `settings.updated`, `admin.login`.

## Email: the swap-in point

**No email is sent.** Confirmations, cancellations, change notices, contact acknowledgements and newsletter welcomes are appended to
`data/outbox.json`. The single place to change is `queueMail()` in `lib/activity.cjs` (marked `EMAIL SWAP-IN POINT`): call your
provider's HTTPS API there (Postmark, SES, Resend, Mailgun ...) or run a small worker that drains `outbox.json` and flips `sent`.
Deliver after the data write and never let a delivery failure fail the booking. The message bodies are built by the functions
right below it (`bookingConfirmation`, `bookingCancellation`, `bookingUpdate`, `contactAcknowledgement`, `subscribeWelcome`).

## Security model

- Static handler: path-traversal safe (decoded, `..` / backslash / NUL / drive-colon refused, resolved path must stay inside the
  site root); `data/`, `lib/`, `test/`, `verify/` (internal QA reports), `node_modules/`, any dotfile or dot-folder (`.git`, `.env`,
  `.claude` ...), `*.cjs`, `*.md` (API.md, PAGES-SPEC.md and the other internal docs), `*.log`, `*.bak`, `*.tmp`, `*.env` and whatever
  `DATA_DIR` points at are never served (403), case-insensitively and including Windows aliases (`data.`, `DATA~1`).
- Headers on every response: `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`,
  `Cross-Origin-Opener-Policy`, `Permissions-Policy`, and a CSP: `default-src 'self'`; scripts from the site only, plus the
  page's own inline `<script>` blocks allowed **by sha256 hash** (computed from the HTML file, so no `unsafe-inline`; inline event
  handlers such as `onclick=""` are blocked - use `addEventListener`); inline styles allowed (GSAP / Splide write `style=""`);
  images `'self' data: blob:`; media `'self' data: blob:`; fonts `'self' data:`; `connect-src 'self'`; frames: self,
  OpenStreetMap and Google Maps embeds; `object-src 'none'`; `frame-ancestors 'none'`. API responses use `default-src 'none'`.
- Public writes: custom header `X-Requested-With: fetch` (blocks cross-site form posts and `text/plain` "simple" requests: 403), honeypot, consent flag, 20 KB limit, per-IP rate limits, strict
  validation, control characters stripped. Lookups need reference **and** email and are rate limited.
- Admin: token compared in constant time (sha256 + `timingSafeEqual`), 5 failed attempts / 15 min per IP (a spoofed `X-Forwarded-For` does not reset it), random 256-bit session id
  in an HttpOnly SameSite=Strict cookie, 12 h expiry, same-origin check on writes, everything else 401.
- Logs: one line per API request - method, path (no query string), status, duration. No personal data.
- Put HTTPS in front of it (the cookie gets `Secure` automatically via `X-Forwarded-Proto`), set `TRUST_PROXY=1` there and keep
  `ADMIN_TOKEN` in the host's secret store.

## Deploying

The booking system needs a **Node host** (Node 18+; nothing to install): a small VPS, Render, Railway, Fly.io, a container ...
`HOST=0.0.0.0 PORT=$PORT ADMIN_TOKEN=... TZ=<cafe time zone> node server.cjs`, with a **persistent disk** mounted at `DATA_DIR`.
Static hosts (GitHub Pages, Netlify static, S3) cannot run it: there `GET /api/health` fails and the pages show their call / email
fallback. One process only - the datastore is a single-writer JSON store (sessions and rate limits are in memory); for more
than one instance swap `lib/store.cjs` for a database, the rest of the code only uses `store.read()` / `store.transaction()`.

## Privacy

`data/` holds personal data (names, emails, phone numbers, notes, the audit log, the outbox). It is gitignored (`data/*`, only
`.gitkeep` is tracked), is never served over HTTP and must not be committed, copied into the repo or pasted into tickets.
Retention guidance: delete or anonymise bookings and their outbox entries 12-24 months after the visit, contact messages 12 months
after they are closed, and remove subscribers on request straight away (`DELETE /api/admin/subscribers/id/:id`; the audit log
keeps only a masked address). Consent time is stored for every booking, message and subscriber. Back up `data/` encrypted.
Demo data (`--seed`) is marked `demo: true` on every record and is removed by seeding again or by `--reset`.

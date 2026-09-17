/* ==========================================================================
   Latte with Lata CRM - views/today.js (#/today, the default view)
   KPI tiles from GET /api/admin/summary, today's bookings as a timeline grouped by slot with quick actions (each a PATCH; No-show and
   Cancel ask first), the next recording night's seats, the week ahead and the most frequent guests.
   ========================================================================== */
import { formatDate, formatTime } from "../../lib/api.js";
import { data } from "../data.js";
import { h, clear, icon, load, statusChip, typeTag, demoBadge, vipBadge, emptyState, percent, plural, OCCASION_LABEL, SOURCE_LABEL } from "../dom.js";
import { confirmDialog, toast, toastError, busy } from "../ui.js";

const QUICK = {
    pending: [["confirmed", "Confirm", "primary"], ["cancelled", "Cancel", "danger"]],
    confirmed: [["seated", "Seat", "primary"], ["no_show", "No-show", "ghost"], ["cancelled", "Cancel", "danger"]],
    seated: [["completed", "Complete", "primary"]],
    completed: [], cancelled: [], no_show: []
};
const DONE_TEXT = { confirmed: "confirmed", seated: "seated", completed: "completed", no_show: "marked as a no-show", cancelled: "cancelled" };

function kpi({ label, value, sub, href, iconName }) {
    const inner = [
        h("p", { class: "kpi__label" }, icon(iconName), label),
        h("p", { class: "kpi__value" }, String(value)),
        h("p", { class: "kpi__sub" }, sub || "")
    ];
    return href ? h("a", { class: "kpi kpi--link", href }, inner) : h("div", { class: "kpi" }, inner);
}

export default function render(root, ctx) {
    const head = h("header", { class: "view__head" },
        h("div", { class: "view__titles" },
            h("p", { class: "a-eyebrow", id: "today-date" }, "Front of house"),
            h("h1", { class: "view__title" }, "Today")),
        h("div", { class: "view__actions" },
            h("button", { type: "button", class: "a-btn a-btn--ghost", onclick: () => ctx.addBooking({ source: "walk-in" }) }, icon("user"), "Walk-in"),
            h("button", { type: "button", class: "a-btn a-btn--primary", onclick: () => ctx.addBooking({ source: "phone" }) }, icon("plus"), "Add booking")));
    const content = h("div", { class: "today" });
    root.appendChild(head);
    root.appendChild(content);

    async function act(b, status, label, button) {
        if (status === "cancelled" || status === "no_show") {
            const yes = await confirmDialog(status === "cancelled"
                ? { title: "Cancel this booking?", text: `${b.name}, ${formatTime(b.time)}, party of ${b.party}. The seats are released${b.email ? " and a cancellation notice is queued for the guest" : ""}.`, confirmLabel: "Cancel booking", cancelLabel: "Keep booking" }
                : { title: "Mark as no-show?", text: `${b.name}, ${formatTime(b.time)}, party of ${b.party}. The seats are released and the no-show counts on the guest's record.`, confirmLabel: "Mark no-show", cancelLabel: "Not yet" });
            if (!yes) return;
        }
        busy(button, true);
        try {
            await data.patchBooking(b.reference, { status });
            toast(`${b.name} ${DONE_TEXT[status] || label}.`);
            await refresh(b.reference);
        } catch (err) {
            busy(button, false);
            toastError(err, "That change could not be saved.");
        }
    }

    function bookingItem(b) {
        const meta = [plural(b.party, "guest"), b.table ? "Table " + b.table : null, b.occasion && b.occasion !== "none" ? OCCASION_LABEL[b.occasion] : null, b.source && b.source !== "web" ? SOURCE_LABEL[b.source] : null].filter(Boolean).join(" · ");
        const actions = h("div", { class: "tl__actions" });
        (QUICK[b.status] || []).forEach(([status, label, kind]) => {
            actions.appendChild(h("button", {
                type: "button", class: `a-btn a-btn--sm a-btn--${kind === "danger" ? "danger-ghost" : kind}`,
                "aria-label": `${label}: ${b.name}, ${formatTime(b.time)}`,
                onclick: (e) => act(b, status, label, e.currentTarget)
            }, label));
        });
        return h("li", { class: `tl__item tl__item--${b.status}` },
            h("div", { class: "tl__main" },
                h("div", { class: "tl__line" },
                    h("button", { type: "button", class: "tl__name", dataset: { ref: b.reference }, onclick: () => ctx.openBooking(b.reference, b) }, b.name),
                    typeTag(b.type), b.forced ? h("span", { class: "a-tag" }, "Override") : null, b.demo ? demoBadge(true) : null),
                h("p", { class: "tl__meta" }, meta, h("span", { class: "tl__ref" }, b.reference)),
                b.notes ? h("p", { class: "tl__notes" }, icon("note"), h("span", null, b.notes)) : null,
                b.internalNotes ? h("p", { class: "tl__notes tl__notes--staff" }, icon("user"), h("span", null, "Staff: " + b.internalNotes)) : null),
            h("div", { class: "tl__side" }, statusChip(b.status), actions));
    }

    function timeline(list, nowHHMM) {
        if (!list.length) {
            return emptyState("No bookings today", "Phone bookings and walk-ins you add will show up here.",
                h("button", { type: "button", class: "a-btn a-btn--primary", onclick: () => ctx.addBooking() }, icon("plus"), "Add booking"));
        }
        const groups = new Map();
        list.forEach((b) => { if (!groups.has(b.time)) groups.set(b.time, []); groups.get(b.time).push(b); });
        const ol = h("ol", { class: "tl" });
        [...groups.keys()].sort().forEach((time) => {
            const rows = groups.get(time);
            const active = rows.filter((b) => b.status !== "cancelled" && b.status !== "no_show");
            const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
            const isNow = mins(nowHHMM) >= mins(time) && mins(nowHHMM) < mins(time) + 30;
            ol.appendChild(h("li", { class: "tl__slot" + (isNow ? " is-now" : "") },
                h("div", { class: "tl__time" },
                    h("h3", { class: "tl__clock" }, formatTime(time)),
                    h("p", { class: "tl__sum" }, `${plural(active.length, "booking")} · ${plural(active.reduce((n, b) => n + b.party, 0), "guest")}`),
                    isNow ? h("span", { class: "a-tag a-tag--solid" }, "Now") : null),
                h("ul", { class: "tl__list" }, rows.map(bookingItem))));
        });
        return ol;
    }

    function recordingCard(r) {
        const taken = Math.max(0, r.seats - r.seatsLeft);
        const pct = r.seats ? Math.min(100, Math.round((taken / r.seats) * 100)) : 0;
        const bar = h("div", { class: "meter", role: "img", "aria-label": `${taken} of ${r.seats} seats taken` }, h("span", { class: "meter__fill" }));
        bar.firstChild.style.width = pct + "%";
        return h("section", { class: "a-card", "aria-labelledby": "today-rec" },
            h("div", { class: "a-card__head" }, h("h2", { class: "a-subtitle", id: "today-rec" }, icon("mic"), "Next recording night")),
            h("p", { class: "rec__date" }, formatDate(r.date)),
            h("p", { class: "a-note" }, `Doors ${formatTime(r.doors)}`),
            bar,
            h("div", { class: "rec__nums" },
                h("p", null, h("strong", null, String(taken)), " seats taken"),
                h("p", null, h("strong", null, String(r.seatsLeft)), " left of " + r.seats)),
            h("button", { type: "button", class: "a-btn a-btn--ghost a-btn--block a-btn--sm", onclick: () => ctx.addBooking({ type: "recording", date: r.date }) }, icon("plus"), "Add a recording RSVP"));
    }

    function weekCard(week) {
        const max = Math.max(1, ...week.days.map((d) => d.covers));
        return h("section", { class: "a-card", "aria-labelledby": "today-week" },
            h("div", { class: "a-card__head" }, h("h2", { class: "a-subtitle", id: "today-week" }, icon("calendar"), "Next 7 days"), h("a", { class: "a-link", href: "#/bookings" }, "All bookings")),
            h("ul", { class: "week" }, week.days.map((d) => {
                const fill = h("span", { class: "week__fill" });
                fill.style.width = Math.round((d.covers / max) * 100) + "%";
                return h("li", { class: "week__row" },
                    h("span", { class: "week__day" }, formatDate(d.date).replace(/ \d{4}$/, "")),
                    h("span", { class: "week__bar", "aria-hidden": "true" }, fill),
                    h("span", { class: "week__num" }, d.closed ? "Closed" : `${plural(d.bookings, "booking")} · ${d.covers} covers`));
            })));
    }

    function guestsCard(guests) {
        return h("section", { class: "a-card", "aria-labelledby": "today-guests" },
            h("div", { class: "a-card__head" }, h("h2", { class: "a-subtitle", id: "today-guests" }, icon("users"), "Top guests"), h("a", { class: "a-link", href: "#/customers" }, "All customers")),
            guests.length
                ? h("ul", { class: "guests" }, guests.map((g) => h("li", null,
                    h("a", { class: "guests__name", href: "#/customers/" + encodeURIComponent(g.id) }, g.name || g.email || "Guest"), g.vip ? vipBadge() : null,
                    h("span", { class: "guests__num" }, `${plural(g.bookings, "visit")} · ${g.covers} covers`))))
                : h("p", { class: "a-note" }, "Guests appear here after their first booking."));
    }

    function paint(s) {
        const t = s.today;
        const now = new Date(s.generatedAt || Date.now());
        const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const dateEl = head.querySelector("#today-date");
        dateEl.textContent = formatDate(t.date);
        const anyDemo = t.list.some((b) => b.demo);
        const toCome = t.pending + t.confirmed;
        clear(content);
        content.appendChild(h("section", { class: "kpis", "aria-label": "Key numbers" },
            kpi({ label: "Bookings today", value: t.bookings, sub: `${t.seated} seated · ${toCome} to come`, href: "#/bookings", iconName: "calendar" }),
            kpi({ label: "Covers today", value: s.covers.today, sub: `${s.covers.last30Days} in the last 30 days`, iconName: "users" }),
            kpi({ label: "Next 7 days", value: s.next7Days.bookings, sub: `${s.next7Days.covers} covers booked`, href: "#/bookings", iconName: "today" }),
            kpi({ label: "New messages", value: s.newMessages, sub: `${s.openMessages} open`, href: "#/messages", iconName: "mail" }),
            kpi({ label: "New sign-ups", value: s.newSubscribers, sub: `last 7 days · ${s.subscribers} in total`, href: "#/subscribers", iconName: "at" }),
            kpi({ label: "No-show rate", value: percent(s.noShowRate), sub: `${s.noShows.count} of ${s.noShows.outOf} in ${s.noShows.windowDays} days`, iconName: "alert" })));
        content.appendChild(h("div", { class: "today__grid" },
            h("section", { class: "a-card a-card--flush today__timeline", "aria-labelledby": "today-tl" },
                h("div", { class: "a-card__head" },
                    h("div", { class: "a-card__headline" }, h("h2", { class: "a-subtitle", id: "today-tl" }, icon("today"), "Today's bookings"), anyDemo ? demoBadge() : null),
                    h("span", { class: "a-card__meta" }, [t.completed ? `${t.completed} completed` : "", t.cancelled ? `${t.cancelled} cancelled` : "", t.noShows ? plural(t.noShows, "no-show") : ""].filter(Boolean).join(" · "))),
                timeline(t.list, nowHHMM)),
            h("div", { class: "today__side" }, recordingCard(s.nextRecording), weekCard(s.next7Days), guestsCard(s.topGuests || []))));
    }

    let first = true;
    async function refresh(focusRef) {
        const hadFocus = content.contains(document.activeElement) ? document.activeElement : null;
        const ref = focusRef || (hadFocus && hadFocus.closest(".tl__item") && hadFocus.closest(".tl__item").querySelector("[data-ref]") || {}).dataset;
        const wanted = typeof ref === "string" ? ref : (ref && ref.ref) || "";
        await load(content, () => data.summary(), (s) => { paint(s); }, { quiet: !first, alive: ctx.alive, kind: "page", rows: 5 });
        first = false;
        if (wanted && ctx.alive()) {
            const el = content.querySelector(`[data-ref="${wanted.replace(/[^A-Za-z0-9-]/g, "")}"]`);
            if (el && !document.querySelector("dialog[open]")) el.focus({ preventScroll: true });
        }
        ctx.refreshCounts();
    }

    refresh();
    const timer = setInterval(() => { if (!document.hidden && !document.querySelector("dialog[open]") && ctx.alive()) refresh(); }, 60000);
    return { refresh: () => refresh(), cleanup: () => clearInterval(timer) };
}

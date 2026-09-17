/* ==========================================================================
   Latte with Lata CRM - js/admin/booking-drawer.js (ADMIN lane)
   The booking detail drawer (<dialog id="dlg-booking">): every field, the status stepper (pending -> confirmed -> seated -> completed, plus
   cancel / no-show with confirmation), change date / time / party / table with the availability errors inline, guest notes vs internal
   notes (autosave on blur), the link to the customer profile and the booking's activity trail.
   All user content is written with textContent (dom.js h()).
   ========================================================================== */
import api, { formatDate, formatTime } from "../lib/api.js";
import { data } from "./data.js";
import { h, clear, icon, statusChip, typeTag, demoBadge, formatDateTime, skeleton, errorState, telHref, nextId, plural, cleanMessage, cleanFields, STATUS_LABEL, SOURCE_LABEL, OCCASION_LABEL } from "./dom.js";
import { openDialog, closeDialog, confirmDialog, toast, toastError, busy, saveState } from "./ui.js";

const $ = (id) => document.getElementById(id);
const STEPS = ["pending", "confirmed", "seated", "completed"];
const HARD_CLOSED = ["closed", "blocked", "past", "not_recording_night", "invalid_date"];
let session = { seq: 0 };

export const ACTION_LABEL = {
    "booking.created": "Booking created", "booking.updated": "Booking changed", "booking.pending": "Set to pending", "booking.confirmed": "Confirmed",
    "booking.seated": "Seated", "booking.completed": "Completed", "booking.cancelled": "Cancelled", "booking.no_show": "Marked as no-show",
    "customer.updated": "Customer updated", "message.received": "Message received", "message.new": "Message set to new", "message.open": "Message opened",
    "message.done": "Message done", "message.updated": "Message notes edited", "subscriber.added": "Subscriber joined", "subscriber.removed": "Subscriber removed",
    "settings.updated": "Settings changed", "admin.login": "Staff signed in"
};

/** "date: Thu 24 Sep -> Fri 25 Sep, party: 2 -> 4" from an activity row's detail */
export function describeActivity(a) {
    const d = a && a.detail;
    if (!d || typeof d !== "object") return "";
    const parts = [];
    const show = (k, v) => (k === "date" ? formatDate(v) : k === "time" ? formatTime(v) : k === "status" ? (STATUS_LABEL[v] || v) : (v === "" || v === null || v === undefined ? "none" : String(v)));
    if (d.changes && typeof d.changes === "object") {
        Object.keys(d.changes).forEach((k) => {
            const c = d.changes[k];
            parts.push(Array.isArray(c) ? `${k}: ${show(k, c[0])} -> ${show(k, c[1])}` : `${k} ${c}`);
        });
    }
    if (Array.isArray(d.changed)) parts.push("changed: " + d.changed.join(", "));
    if (d.date && d.time && !d.changes) parts.push(`${formatDate(d.date)} at ${formatTime(d.time)}`);
    if (d.party && !d.changes) parts.push(plural(d.party, "guest"));
    if (d.source && !d.changes) parts.push("via " + (SOURCE_LABEL[d.source] || d.source));
    if (d.topic) parts.push("topic: " + d.topic);
    return parts.join(" · ");
}

function section(title, ...children) {
    const id = nextId("bd-sec");
    return h("section", { class: "bd-sec", "aria-labelledby": id }, h("h3", { class: "a-subtitle", id }, title), children);
}

function row(label, value) { return h("div", { class: "a-kv__row" }, h("dt", null, label), h("dd", null, value === "" || value === null || value === undefined ? h("span", { class: "a-dim" }, "-") : value)); }

/** openBooking(reference, booking?, { ctx, onChange }) */
export async function openBooking(reference, booking, opts) {
    const o = opts || {};
    const seq = ++session.seq;
    const dlg = $("dlg-booking");
    const body = $("dlg-booking-body");
    const title = $("dlg-booking-title");
    const eyebrow = $("dlg-booking-eyebrow");
    const alive = () => seq === session.seq && dlg.open;
    let b = booking || null;
    let changed = false;

    eyebrow.textContent = "Booking " + reference;
    title.textContent = b ? b.name : "Loading...";
    clear(body);
    if (!b) body.appendChild(skeleton(6, "rows"));
    openDialog(dlg, {
        onClose: () => { session.seq++; if (changed && typeof o.onChange === "function") o.onChange(b); },
        returnFocus: () => document.querySelector(`#view [data-ref="${String(reference).replace(/[^A-Za-z0-9-]/g, "")}"]`)
    });

    const changedNow = () => { changed = true; if (o.ctx) o.ctx.reload(); };

    async function patch(bodyPatch, okMessage) {
        const res = await data.patchBooking(reference, bodyPatch);
        b = res.booking;
        changedNow();
        if (okMessage) toast(okMessage);
        return b;
    }

    /* ---- status ---- */
    async function setStatus(status, button, force) {
        if (!b || status === b.status) return;
        if (status === "cancelled" || status === "no_show") {
            const yes = await confirmDialog(status === "cancelled"
                ? { title: "Cancel this booking?", text: `${b.name}, ${formatDate(b.date)} at ${formatTime(b.time)}, party of ${b.party}. The seats are released${b.email ? " and a cancellation notice is queued for the guest" : ""}.`, confirmLabel: "Cancel booking", cancelLabel: "Keep booking" }
                : { title: "Mark as no-show?", text: `${b.name}, ${formatDate(b.date)} at ${formatTime(b.time)}, party of ${b.party}. The seats are released and the no-show counts on the guest's record.`, confirmLabel: "Mark no-show", cancelLabel: "Not yet" });
            if (!yes || !alive()) return;
        }
        busy(button, true);
        try {
            await patch(force ? { status, force: true } : { status }, `${b.name}: ${STATUS_LABEL[status]}.`);
            if (alive()) render(`[data-step="${status}"], [data-status-action="${status}"]`);
        } catch (err) {
            busy(button, false);
            if (err.status === 401 || !alive()) return;
            const box = body.querySelector("#bd-status-notice");
            if (box && (err.code === "slot_full" || err.code === "validation")) {
                clear(box);
                box.className = "notice notice--error";
                box.hidden = false;
                box.appendChild(h("div", null,
                    h("p", { class: "notice__title" }, "This booking cannot be re-opened as it is"),
                    h("p", null, cleanMessage(err.message)),
                    h("p", null, h("button", { type: "button", class: "a-btn a-btn--ghost a-btn--sm", onclick: (e) => setStatus(status, e.currentTarget, true) }, `Set to ${STATUS_LABEL[status]} anyway`))));
                const retry = box.querySelector("button");
                if (retry) retry.focus();
            } else toastError(err);
        }
    }

    function statusBlock() {
        const inactive = b.status === "cancelled" || b.status === "no_show";
        const at = STEPS.indexOf(b.status);
        const list = h("ol", { class: "stepper" + (inactive ? " stepper--inactive" : "") });
        STEPS.forEach((s, i) => {
            const isCurrent = s === b.status;
            const done = !inactive && i < at;
            list.appendChild(h("li", { class: "stepper__item" + (isCurrent ? " is-current" : "") + (done ? " is-done" : "") },
                h("button", {
                    type: "button", class: "stepper__btn", dataset: { step: s }, "aria-current": isCurrent ? "step" : null, "aria-disabled": isCurrent ? "true" : null,
                    "aria-label": isCurrent ? `${STATUS_LABEL[s]} (current status)` : `Set status to ${STATUS_LABEL[s]}`,
                    onclick: (e) => setStatus(s, e.currentTarget)
                }, h("span", { class: "stepper__dot", "aria-hidden": "true" }, done ? icon("check") : String(i + 1)), h("span", { class: "stepper__label" }, STATUS_LABEL[s]))));
        });
        const actions = h("div", { class: "bd-status-actions" });
        if (inactive) {
            actions.appendChild(h("p", { class: "a-note" }, b.status === "cancelled"
                ? `Cancelled${b.cancelledBy ? " by " + (b.cancelledBy === "guest" ? "the guest" : "staff") : ""}${b.cancelledAt ? " on " + formatDateTime(b.cancelledAt) : ""}. Choose a step above to re-open it (availability is checked again).`
                : "Marked as a no-show. Choose a step above if the guest did arrive."));
        } else {
            if (b.status !== "completed") actions.appendChild(h("button", { type: "button", class: "a-btn a-btn--ghost a-btn--sm", dataset: { statusAction: "no_show" }, onclick: (e) => setStatus("no_show", e.currentTarget) }, "Mark no-show"));
            actions.appendChild(h("button", { type: "button", class: "a-btn a-btn--danger-ghost a-btn--sm", dataset: { statusAction: "cancelled" }, onclick: (e) => setStatus("cancelled", e.currentTarget) }, "Cancel booking"));
        }
        return section("Status", list, actions, h("div", { class: "notice", id: "bd-status-notice", role: "alert", hidden: true }));
    }

    /* ---- change date / time / party / table ---- */
    function changeBlock() {
        const ids = { date: nextId("bd-date"), time: nextId("bd-time"), party: nextId("bd-party"), table: nextId("bd-table"), force: nextId("bd-force") };
        const date = h("input", { class: "input", id: ids.date, name: "date", type: "date", value: b.date, required: true });
        const time = h("select", { class: "select", id: ids.time, name: "time" });
        const party = h("input", { class: "input", id: ids.party, name: "party", type: "number", inputmode: "numeric", min: "1", max: "500", step: "1", value: String(b.party), required: true });
        const table = h("input", { class: "input", id: ids.table, name: "table", type: "text", maxlength: "20", autocomplete: "off", value: b.table || "" });
        const force = h("input", { id: ids.force, name: "force", type: "checkbox" });
        const notice = h("p", { class: "notice", role: "alert", hidden: true });
        const save = h("button", { type: "submit", class: "a-btn a-btn--primary" }, "Save changes");
        const hint = h("p", { class: "field__hint" }, b.type === "recording" ? "Recording nights have one time: doors." : "");
        let avail = null, availSeq = 0;

        function fillTimes() {
            clear(time);
            const times = avail && avail.open ? (avail.slots || []).map((s) => s.time) : [];
            const wanted = time.dataset.value || b.time;
            if (!times.includes(wanted)) time.appendChild(h("option", { value: wanted }, `${formatTime(wanted)}${times.length ? " (not on that day's grid)" : ""}`));
            (avail && avail.open ? avail.slots : []).forEach((s) => time.appendChild(h("option", { value: s.time }, `${formatTime(s.time)} - ${s.seatsLeft > 0 ? s.seatsLeft + " seats left" : "full"}`)));
            time.value = wanted;
            time.disabled = b.type === "recording";
        }
        async function loadTimes() {
            const seqA = ++availSeq;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value)) return;
            try {
                const a = await data.availability({ date: date.value, party: 1, type: b.type, excludeRef: reference });   // seats as if this booking were not there yet
                if (seqA !== availSeq) return;
                avail = a;
                fillTimes();
                api.clearFieldErrors(form, "date");
                if (!a.open && HARD_CLOSED.includes(a.reasonCode) && date.value !== b.date) api.showFieldErrors(form, { date: a.reason });
                else if (b.type === "recording" && a.open && a.slots[0]) hint.textContent = `Doors ${formatTime(a.slots[0].time)} - ${a.slots[0].seatsLeft} places left that night.`;
            } catch (_) { avail = null; fillTimes(); }
        }
        date.addEventListener("change", loadTimes);
        time.addEventListener("change", () => { time.dataset.value = time.value; });

        const form = h("form", { class: "form bd-change", novalidate: true },
            h("div", { class: "form__row form__row--2" },
                h("div", { class: "field" }, h("label", { class: "field__label", for: ids.date }, "Date"), date, h("p", { class: "field__error", "aria-live": "polite" })),
                h("div", { class: "field" }, h("label", { class: "field__label", for: ids.time }, "Time"), time, hint, h("p", { class: "field__error", "aria-live": "polite" }))),
            h("div", { class: "form__row form__row--2" },
                h("div", { class: "field" }, h("label", { class: "field__label", for: ids.party }, "Party size"), party, h("p", { class: "field__error", "aria-live": "polite" })),
                h("div", { class: "field" }, h("label", { class: "field__label", for: ids.table }, "Table"), table, h("p", { class: "field__error", "aria-live": "polite" }))),
            h("div", { class: "checkbox" }, force, h("label", { for: ids.force }, "Override availability (closed day, full slot) and mark the booking as forced")),
            notice,
            h("div", { class: "form__actions" }, save));

        form.addEventListener("submit", async (ev) => {
            ev.preventDefault();
            api.clearFieldErrors(form);
            api.setNotice(notice, null);
            const n = Number(party.value);
            const next = { date: date.value, time: time.value, party: n, table: table.value.trim() };
            const local = {};
            if (!/^\d{4}-\d{2}-\d{2}$/.test(next.date)) local.date = "Choose a date.";
            if (!Number.isInteger(n) || n < 1) local.party = "Enter a whole number of guests.";
            if (Object.keys(local).length) { api.showFieldErrors(form, local); return; }
            const payload = {};
            ["date", "time", "party", "table"].forEach((k) => { if (next[k] !== (k === "table" ? (b.table || "") : b[k])) payload[k] = next[k]; });
            if (b.type === "recording") delete payload.time;
            if (!Object.keys(payload).length) { api.setNotice(notice, "info", "Nothing has changed."); return; }
            const moved = "date" in payload || "time" in payload || "party" in payload;
            if (moved && !force.checked && avail && avail.date === next.date && !avail.open && HARD_CLOSED.includes(avail.reasonCode)) {
                /* the day is closed / blocked / in the past: the API would answer 400 with this same sentence - show it without the round trip */
                api.showFieldErrors(form, { date: `${avail.reason} Tick the override below to save it anyway.` });
                return;
            }
            if (force.checked && moved) payload.force = true;
            busy(save, true);
            try {
                await patch(payload, `Booking ${reference} updated.`);
                if (alive()) render(".bd-change button[type=submit]");
            } catch (err) {
                busy(save, false);
                if (err.status === 401 || !alive()) return;
                if (err.code === "slot_full") api.showFieldErrors(form, { time: `${err.message} Tick the override below to seat them anyway.` });
                else if (!api.showFieldErrors(form, cleanFields(err.fields))) api.setNotice(notice, "error", cleanMessage(err.message) || "The change could not be saved.");
            }
        });
        fillTimes();
        loadTimes();
        return section("Change booking", form);
    }

    /* ---- notes (autosave on blur) ---- */
    function notesBlock() {
        const make = (key, label, hintText, max) => {
            const id = nextId("bd-" + key);
            const stateEl = h("span", { class: "a-save", role: "status", "aria-live": "polite" });
            const area = h("textarea", { class: "textarea textarea--sm", id, rows: "3", maxlength: String(max) });
            area.value = b[key] || "";
            const err = h("p", { class: "field__error", "aria-live": "polite" });
            area.addEventListener("input", () => saveState(stateEl, "dirty"));
            area.addEventListener("blur", async () => {
                const value = area.value.trim();
                if (value === (b[key] || "")) { saveState(stateEl, ""); return; }
                saveState(stateEl, "saving");
                err.textContent = "";
                try { await patch({ [key]: value }); saveState(stateEl, "saved"); refreshTrail(); }
                catch (e2) { if (e2.status === 401) return; saveState(stateEl, "error"); err.textContent = (e2.fields && e2.fields[key]) || e2.message || "Could not save."; }
            });
            return h("div", { class: "field" }, h("div", { class: "a-field-head" }, h("label", { class: "field__label", for: id }, label), stateEl), area, h("p", { class: "field__hint" }, hintText), err);
        };
        return section("Notes",
            make("notes", "Guest notes", "What the guest asked for. Shown on their booking.", 500),
            make("internalNotes", "Internal notes", "Staff only. Never shown to the guest.", 2000));
    }

    /* ---- activity trail ---- */
    let trailBox = null;
    async function refreshTrail() {
        if (!trailBox) return;
        try {
            const res = await data.activity({ reference });
            if (!alive()) return;
            clear(trailBox);
            const rows = res.activity || [];
            if (!rows.length) { trailBox.appendChild(h("p", { class: "a-note" }, "No activity recorded yet.")); return; }
            const list = h("ol", { class: "trail" });
            rows.forEach((a) => list.appendChild(h("li", { class: "trail__item" },
                h("span", { class: "trail__dot", "aria-hidden": "true" }),
                h("div", null,
                    h("p", { class: "trail__what" }, ACTION_LABEL[a.action] || a.action, h("span", { class: "trail__who" }, a.who === "guest" ? "guest" : "staff")),
                    describeActivity(a) ? h("p", { class: "trail__detail" }, describeActivity(a)) : null,
                    h("p", { class: "trail__when" }, formatDateTime(a.at))))));
            trailBox.appendChild(list);
        } catch (err) {
            if (!alive() || err.status === 401) return;
            clear(trailBox);
            trailBox.appendChild(errorState(err, refreshTrail));
        }
    }

    function render(focusSelector) {
        title.textContent = b.name;
        clear(body);
        const meta = h("div", { class: "bd-meta" }, statusChip(b.status), typeTag(b.type), b.forced ? h("span", { class: "a-tag" }, "Override") : null, b.demo ? demoBadge() : null);
        const when = h("p", { class: "bd-when" }, `${formatDate(b.date)} · ${formatTime(b.time)} · ${plural(b.party, "guest")}${b.table ? " · table " + b.table : ""}`);
        const guest = h("dl", { class: "a-kv" },
            row("Name", b.name),
            row("Email", b.email ? h("a", { href: "mailto:" + b.email }, b.email) : ""),
            row("Phone", b.phone ? h("a", { href: telHref(b.phone) }, b.phone) : ""),
            row("Occasion", OCCASION_LABEL[b.occasion] || b.occasion),
            row("Source", SOURCE_LABEL[b.source] || b.source),
            row("Newsletter", b.marketingOptIn ? "Opted in with this booking" : "No"),
            row("Created", formatDateTime(b.createdAt)),
            row("Last change", formatDateTime(b.updatedAt)));
        const profile = b.customerId ? h("p", { class: "bd-profile" }, h("a", { class: "a-link", href: "#/customers/" + encodeURIComponent(b.customerId), onclick: () => closeDialog(dlg, "nav") }, icon("user"), "Open customer profile")) : null;
        trailBox = h("div", { class: "bd-trail" }, skeleton(3, "rows"));
        body.appendChild(h("div", { class: "bd-top" }, meta, when));
        body.appendChild(statusBlock());
        body.appendChild(section("Guest", guest, profile));
        body.appendChild(changeBlock());
        body.appendChild(notesBlock());
        body.appendChild(section("Activity", trailBox));
        refreshTrail();
        /* focus follows the control that was used; the current step is aria-disabled (still focusable), never disabled */
        if (focusSelector) { const el = body.querySelector(focusSelector); if (el && !el.disabled) el.focus({ preventScroll: true }); else title.focus({ preventScroll: true }); }
    }

    try {
        if (!b) b = await data.bookingByReference(reference);
        if (!alive()) return;
        if (!b) { clear(body); body.appendChild(errorState({ message: "No booking with that reference." })); title.textContent = "Not found"; return; }
        render();
    } catch (err) {
        if (!alive() || err.status === 401) return;
        clear(body);
        body.appendChild(errorState(err, () => openBookingRetry()));
    }
    function openBookingRetry() { closeDialog(dlg, "retry"); openBooking(reference, null, o); }
}

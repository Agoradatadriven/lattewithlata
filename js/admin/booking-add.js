/* ==========================================================================
   Latte with Lata CRM - js/admin/booking-add.js (ADMIN lane)
   "Add booking" (phone / walk-in). The dialog markup is static (pages/admin/03-dialogs.html); this module fills the time chips from
   GET /api/availability for the chosen date + type and posts to POST /api/admin/bookings.

   Staff rules (API.md): no lead time, no 60-day window, any party that fits; still open day + slot grid + capacity - unless
   `force: true` ("Book anyway"), which skips every availability rule and is stored as forced.
   The availability call is made with party = 1 so the raw seatsLeft comes back for every slot (the public endpoint refuses parties above
   the online limit); "does this party fit" is then seatsLeft >= party, worked out here. A slot that does not fit stays selectable: picking
   it switches the dialog to the override path, so the failing request is never sent first.
   ========================================================================== */
import api, { formatDate, formatTime, todayISO } from "../lib/api.js";
import { data } from "./data.js";
import { h, clear, debounce, plural, cleanMessage, cleanFields } from "./dom.js";
import { openDialog, closeDialog, toast, busy } from "./ui.js";

const $ = (id) => document.getElementById(id);
let wired = false;
let current = { opts: {}, availability: null, seq: 0, serverForce: false };

const els = () => ({
    dlg: $("dlg-add"), form: $("ab-form"), date: $("ab-date"), party: $("ab-party"), time: $("ab-time"), slots: $("ab-slots"),
    timeMeta: $("ab-time-meta"), timeField: $("ab-time-field"), free: $("ab-free-time"), freeInput: $("ab-time-free"),
    override: $("ab-override"), notice: $("ab-notice"), submit: $("ab-submit"), seated: $("ab-seated")
});

const typeOf = (form) => (form.elements.type.value === "recording" ? "recording" : "table");
const partyOf = (e) => { const n = Number(e.party.value); return Number.isInteger(n) && n > 0 ? n : 0; };

function nowSlot() {                                                       // the half-hour slot that is running now (walk-ins)
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${d.getMinutes() < 30 ? "00" : "30"}`;
}

/** the state that decides between "Add booking" and "Book anyway" */
function overrideReason(e) {
    const a = current.availability;
    const party = partyOf(e);
    if (current.serverForce) return current.serverForce;
    if (!a) return "";
    if (!a.open && ["closed", "blocked", "past", "not_recording_night"].includes(a.reasonCode)) return a.reason || "That day is not open for bookings.";
    const slot = (a.slots || []).find((s) => s.time === e.time.value);
    if (slot && party && slot.seatsLeft < party) {
        return slot.seatsLeft > 0
            ? `${formatTime(slot.time)} has ${plural(slot.seatsLeft, "seat")} left for a party of ${party}.`
            : `${formatTime(slot.time)} is full.`;
    }
    return "";
}

function syncOverride(e) {
    const why = overrideReason(e);
    clear(e.override);
    if (why) {
        e.override.className = "notice notice--info";
        e.override.appendChild(h("div", null,
            h("p", { class: "notice__title" }, "Staff override"),
            h("p", null, why + " You can still take it: \"Book anyway\" skips the availability rules and marks the booking as forced.")));
    }
    e.override.hidden = !why;
    e.submit.textContent = why ? "Book anyway" : "Add booking";
    e.submit.dataset.force = why ? "1" : "";
}

function selectSlot(e, time) {
    e.time.value = time || "";
    e.slots.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.time === time)));
    api.clearFieldErrors(e.form, "time");
    current.serverForce = false;
    syncOverride(e);
}

function renderSlots(e) {
    const a = current.availability;
    const party = partyOf(e);
    clear(e.slots);
    e.free.hidden = true;
    e.timeMeta.textContent = "";
    if (!a) return;
    if (!a.open || !(a.slots || []).length) {
        /* closed / blocked / past / not a recording night: nothing on the grid. A forced booking may carry any time. */
        const forced = ["closed", "blocked", "past", "not_recording_night"].includes(a.reasonCode);
        e.slots.appendChild(h("p", { class: "ab-closed" }, a.reason || "No times are available on that day."));
        if (forced || a.reasonCode === "too_far") {
            e.free.hidden = false;
            if (!e.freeInput.value) e.freeInput.value = a.type === "recording" ? "18:30" : "12:00";
            e.time.value = e.freeInput.value;
        } else e.time.value = "";
        syncOverride(e);
        return;
    }
    const keep = e.time.value;
    a.slots.forEach((s) => {
        const fits = party ? s.seatsLeft >= party : s.seatsLeft > 0;
        const small = s.seatsLeft <= 0 ? "Full" : (fits ? `${s.seatsLeft} left` : `Only ${s.seatsLeft} left`);
        e.slots.appendChild(h("button", {
            type: "button", class: "radio-chip" + (fits ? "" : " is-short"), "aria-pressed": "false", dataset: { time: s.time },
            onclick: () => selectSlot(e, s.time)
        }, formatTime(s.time), h("small", null, small)));
    });
    const times = a.slots.map((s) => s.time);
    let pick = times.includes(keep) ? keep : "";
    if (!pick && a.type === "recording") pick = times[0];
    if (!pick && a.date === todayISO()) pick = times.includes(nowSlot()) ? nowSlot() : (times.find((t) => t >= nowSlot()) || "");
    e.timeMeta.textContent = a.type === "recording" ? "doors" : `${plural(times.length, "time")} on the grid`;
    selectSlot(e, pick);
    const pressed = e.slots.querySelector('[aria-pressed="true"]');
    if (pressed && pressed.scrollIntoView) pressed.scrollIntoView({ block: "nearest" });
}

async function loadAvailability(e) {
    const seq = ++current.seq;
    const date = e.date.value;
    current.serverForce = false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { current.availability = null; renderSlots(e); syncOverride(e); return; }
    e.slots.setAttribute("aria-busy", "true");
    try {
        const a = await data.availability({ date, party: 1, type: typeOf(e.form) });
        if (seq !== current.seq) return;
        current.availability = a;
        api.clearFieldErrors(e.form, "date");
        renderSlots(e);
    } catch (err) {
        if (seq !== current.seq) return;
        current.availability = null;
        clear(e.slots);
        e.slots.appendChild(h("p", { class: "ab-closed" }, (err && err.message) || "Times could not be loaded."));
        e.slots.appendChild(h("button", { type: "button", class: "a-btn a-btn--ghost a-btn--sm", onclick: () => loadAvailability(e) }, "Try again"));
    } finally {
        if (seq === current.seq) e.slots.removeAttribute("aria-busy");
    }
}

async function onSubmit(ev) {
    ev.preventDefault();
    const e = els();
    api.clearFieldErrors(e.form);
    api.setNotice(e.notice, null);
    if (!e.free.hidden) e.time.value = e.freeInput.value;
    const f = api.formData(e.form);
    const type = typeOf(e.form);
    const local = {};
    if (!f.date) local.date = "Choose a date.";
    if (!partyOf(e)) local.party = "Enter how many people are coming.";
    if (type === "table" && !f.time) local.time = "Choose a time.";
    if (!f.name || f.name.length < 2) local.name = "Enter the guest's name.";
    if (!f.phone && !f.email) local.phone = "Enter a phone number or an email address for the guest.";
    if (Object.keys(local).length) { api.showFieldErrors(e.form, local); return; }

    const force = e.submit.dataset.force === "1";
    const body = {
        type, date: f.date, time: f.time || undefined, party: partyOf(e), name: f.name, phone: f.phone, email: f.email,
        occasion: f.occasion || "none", notes: f.notes, internalNotes: f.internalNotes, table: f.table,
        source: f.source === "walk-in" ? "walk-in" : "phone", status: f.seatNow ? "seated" : "confirmed"
    };
    if (force) body.force = true;
    busy(e.submit, true);
    try {
        const res = await data.createBooking(body);
        const b = res.booking || {};
        toast(`Booking ${res.reference} added: ${b.name || f.name}, ${formatDate(b.date || f.date)} at ${formatTime(b.time || f.time)}${force ? " (override)" : ""}.`);
        closeDialog(e.dlg, "saved");
        if (current.opts.ctx) { current.opts.ctx.reload(); current.opts.ctx.refreshCounts(); }
        if (typeof current.opts.onSaved === "function") current.opts.onSaved(b);
    } catch (err) {
        if (err.status === 401) return;
        if (err.code === "slot_full") {
            current.serverForce = err.message || "That time has just filled up.";
            syncOverride(e);
            e.override.scrollIntoView({ block: "nearest" });
            e.submit.focus();
            loadAvailabilityQuiet(e);
        } else if (err.code === "validation" && (err.fields.date || err.fields.time) && !force) {
            const fields = cleanFields(err.fields);
            api.showFieldErrors(e.form, fields);
            current.serverForce = fields.date || fields.time;
            syncOverride(e);
        } else if (!api.showFieldErrors(e.form, cleanFields(err.fields))) {
            api.setNotice(e.notice, "error", cleanMessage(err.message) || "The booking could not be saved.");
        }
    } finally {
        busy(e.submit, false);
    }
}

/** after a slot_full answer: refresh the seat counts on the chips without losing the override state */
async function loadAvailabilityQuiet(e) {
    try {
        const a = await data.availability({ date: e.date.value, party: 1, type: typeOf(e.form) });
        const keepForce = current.serverForce;
        current.availability = a;
        renderSlots(e);
        current.serverForce = keepForce;
        syncOverride(e);
    } catch (_) { /* the chips keep their last known numbers */ }
}

function wire() {
    if (wired) return;
    wired = true;
    const e = els();
    const reload = debounce(() => loadAvailability(e), 200);
    e.date.addEventListener("change", reload);
    e.party.addEventListener("input", () => { current.serverForce = false; renderSlots(e); });
    e.form.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener("change", () => {
        const recording = typeOf(e.form) === "recording";
        e.form.elements.occasion.value = recording ? "recording-guest" : "none";
        e.time.value = "";
        loadAvailability(e);
    }));
    e.form.querySelectorAll('input[name="source"]').forEach((r) => r.addEventListener("change", () => {
        const walkIn = e.form.elements.source.value === "walk-in";
        e.seated.checked = walkIn;
        if (walkIn && e.date.value !== todayISO()) { e.date.value = todayISO(); loadAvailability(e); }
    }));
    e.freeInput.addEventListener("change", () => { e.time.value = e.freeInput.value; });
    e.form.addEventListener("submit", onSubmit);
}

/** openAddBooking({ ctx, onSaved }, { date?, type?, source?, name?, phone?, email? }) */
export function openAddBooking(opts, defaults) {
    wire();
    const e = els();
    const d = defaults || {};
    current = { opts: opts || {}, availability: null, seq: current.seq, serverForce: false };
    e.form.reset();
    api.clearFieldErrors(e.form);
    api.setNotice(e.notice, null);
    e.override.hidden = true;
    e.freeInput.value = "";
    e.time.value = "";
    e.date.value = d.date || todayISO();
    if (d.type === "recording") e.form.elements.type.value = "recording";
    if (d.source === "walk-in") { e.form.elements.source.value = "walk-in"; e.seated.checked = true; }
    if (d.name) e.form.elements.name.value = d.name;
    if (d.phone) e.form.elements.phone.value = d.phone;
    if (d.email) e.form.elements.email.value = d.email;
    if (d.type === "recording") e.form.elements.occasion.value = "recording-guest";
    e.submit.textContent = "Add booking";
    e.submit.dataset.force = "";
    clear(e.slots);
    openDialog(e.dlg, { focus: e.form.querySelector('input[name="source"]:checked') });
    loadAvailability(e);
}

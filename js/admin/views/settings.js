/* ==========================================================================
   Latte with Lata CRM - views/settings.js (#/settings)
   capacityPerSlot, recordingSeats, blockedDates (add / remove) and hoursOverrides per date. One explicit Save (PUT /api/admin/settings with
   those four keys); the API's validation messages are shown next to the matching control. These settings change what the public booking
   page offers the moment they are saved - the view says so.
   ========================================================================== */
import api, { formatDate, formatTime, todayISO } from "../../lib/api.js";
import { data } from "../data.js";
import { h, clear, icon, load, plural } from "../dom.js";
import { toast, busy, confirmDialog } from "../ui.js";

const DAYS = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

export default function render(root, ctx) {
    const head = h("header", { class: "view__head" },
        h("div", { class: "view__titles" }, h("p", { class: "a-eyebrow" }, "Capacity and closures"), h("h1", { class: "view__title" }, "Settings")));
    const content = h("div", { class: "settings" });
    root.appendChild(head);
    root.appendChild(content);

    let saved = null;                                                   // last server state
    let draft = null;                                                   // { capacityPerSlot, recordingSeats, blockedDates: [], hoursOverrides: {} }
    let form = null;

    const snapshot = (s) => ({ capacityPerSlot: s.capacityPerSlot, recordingSeats: s.recordingSeats, blockedDates: [...(s.blockedDates || [])].sort(), hoursOverrides: JSON.parse(JSON.stringify(s.hoursOverrides || {})) });
    const isDirty = () => JSON.stringify(snapshotOfDraft()) !== JSON.stringify(snapshot(saved));
    function snapshotOfDraft() {
        const keys = Object.keys(draft.hoursOverrides).sort();
        const map = {}; keys.forEach((k) => { map[k] = draft.hoursOverrides[k]; });
        return { capacityPerSlot: draft.capacityPerSlot, recordingSeats: draft.recordingSeats, blockedDates: [...draft.blockedDates].sort(), hoursOverrides: map };
    }

    function paint() {
        clear(content);
        const cap = h("input", { class: "input", id: "st-capacity", name: "capacityPerSlot", type: "number", inputmode: "numeric", min: "1", max: "500", step: "1", value: String(draft.capacityPerSlot), required: true, "aria-describedby": "st-capacity-hint st-capacity-error" });
        const rec = h("input", { class: "input", id: "st-recording", name: "recordingSeats", type: "number", inputmode: "numeric", min: "1", max: "500", step: "1", value: String(draft.recordingSeats), required: true, "aria-describedby": "st-recording-hint st-recording-error" });
        const dirtyEl = h("span", { class: "a-save", role: "status", "aria-live": "polite" });
        const notice = h("p", { class: "notice", role: "alert", hidden: true });
        const save = h("button", { type: "submit", class: "a-btn a-btn--primary" }, "Save settings");
        const discard = h("button", { type: "button", class: "a-btn a-btn--ghost" }, "Discard changes");
        const blockedList = h("ul", { class: "set-list", "aria-label": "Blocked dates" });
        const blockedError = h("p", { class: "field__error", id: "st-blocked-error", "aria-live": "polite" });
        const overrideList = h("ul", { class: "set-list", "aria-label": "Hours on single dates" });
        const overrideError = h("p", { class: "field__error", id: "st-override-error", "aria-live": "polite" });

        const markDirty = () => { const d = isDirty(); dirtyEl.dataset.state = d ? "dirty" : ""; dirtyEl.textContent = d ? "Unsaved changes" : ""; discard.disabled = !d; };
        cap.addEventListener("input", () => { draft.capacityPerSlot = cap.value === "" ? "" : Number(cap.value); markDirty(); });
        rec.addEventListener("input", () => { draft.recordingSeats = rec.value === "" ? "" : Number(rec.value); markDirty(); });

        /* blocked dates */
        const blockDate = h("input", { class: "input", id: "st-block-date", type: "date", min: todayISO(), "aria-describedby": "st-blocked-error" });
        const blockAdd = h("button", { type: "button", class: "a-btn a-btn--ghost" }, icon("plus"), "Block date");
        function paintBlocked(focusIndex) {
            clear(blockedList);
            if (!draft.blockedDates.length) blockedList.appendChild(h("li", { class: "a-note" }, "No dates are blocked."));
            draft.blockedDates.sort().forEach((d, i) => blockedList.appendChild(h("li", { class: "set-list__item" },
                h("span", { class: "set-list__main" }, h("strong", null, formatDate(d)), h("span", { class: "a-note" }, "No bookings taken")),
                h("button", { type: "button", class: "a-btn a-btn--sm a-btn--quiet", "aria-label": `Unblock ${formatDate(d)}`, onclick: () => { draft.blockedDates = draft.blockedDates.filter((x) => x !== d); paintBlocked(Math.min(i, draft.blockedDates.length - 1)); markDirty(); } }, icon("close"), "Remove"))));
            if (focusIndex !== undefined) { const btns = blockedList.querySelectorAll("button"); (btns[focusIndex] || blockDate).focus(); }
        }
        blockAdd.addEventListener("click", () => {
            blockedError.textContent = "";
            if (!isDate(blockDate.value)) { blockedError.textContent = "Choose a date to block."; blockDate.focus(); return; }
            if (draft.blockedDates.includes(blockDate.value)) { blockedError.textContent = `${formatDate(blockDate.value)} is already blocked.`; blockDate.focus(); return; }
            draft.blockedDates.push(blockDate.value);
            blockDate.value = "";
            paintBlocked();
            markDirty();
            blockDate.focus();
        });

        /* hours overrides */
        const ovDate = h("input", { class: "input", id: "st-ov-date", type: "date", min: todayISO(), "aria-describedby": "st-override-error" });
        const ovClosed = h("input", { id: "st-ov-closed", type: "checkbox" });
        const ovOpen = h("input", { class: "input", id: "st-ov-open", type: "time", step: "1800", value: "08:00" });
        const ovClose = h("input", { class: "input", id: "st-ov-close", type: "time", step: "1800", value: "14:00" });
        const ovAdd = h("button", { type: "button", class: "a-btn a-btn--ghost" }, icon("plus"), "Add hours");
        ovClosed.addEventListener("change", () => { ovOpen.disabled = ovClosed.checked; ovClose.disabled = ovClosed.checked; });
        function paintOverrides(focusIndex) {
            clear(overrideList);
            const keys = Object.keys(draft.hoursOverrides).sort();
            if (!keys.length) overrideList.appendChild(h("li", { class: "a-note" }, "Every date follows the weekly hours."));
            keys.forEach((d, i) => {
                const v = draft.hoursOverrides[d];
                overrideList.appendChild(h("li", { class: "set-list__item" },
                    h("span", { class: "set-list__main" }, h("strong", null, formatDate(d)), h("span", { class: "a-note" }, v ? `${formatTime(v.open)} to ${formatTime(v.close)}` : "Closed all day")),
                    h("button", { type: "button", class: "a-btn a-btn--sm a-btn--quiet", "aria-label": `Remove the hours for ${formatDate(d)}`, onclick: () => { delete draft.hoursOverrides[d]; paintOverrides(Math.min(i, keys.length - 2)); markDirty(); } }, icon("close"), "Remove")));
            });
            if (focusIndex !== undefined) { const btns = overrideList.querySelectorAll("button"); (btns[focusIndex] || ovDate).focus(); }
        }
        ovAdd.addEventListener("click", () => {
            overrideError.textContent = "";
            if (!isDate(ovDate.value)) { overrideError.textContent = "Choose the date these hours apply to."; ovDate.focus(); return; }
            if (!ovClosed.checked) {
                if (!ovOpen.value || !ovClose.value) { overrideError.textContent = "Enter an opening and a closing time, or tick Closed all day."; ovOpen.focus(); return; }
                if (ovOpen.value >= ovClose.value) { overrideError.textContent = "The opening time must be before the closing time."; ovOpen.focus(); return; }
            }
            draft.hoursOverrides[ovDate.value] = ovClosed.checked ? null : { open: ovOpen.value.slice(0, 5), close: ovClose.value.slice(0, 5) };
            ovDate.value = "";
            paintOverrides();
            markDirty();
            ovDate.focus();
        });

        const weekly = h("dl", { class: "a-kv a-kv--tight" }, DAYS.map(([k, label]) => {
            const v = saved.hours && saved.hours[k];
            return h("div", { class: "a-kv__row" }, h("dt", null, label), h("dd", null, v ? `${formatTime(v.open)} to ${formatTime(v.close)}` : "Closed"));
        }));

        form = h("form", { class: "form settings__form", novalidate: true },
            h("div", { class: "notice notice--info settings__live", role: "note" }, h("div", null, h("p", { class: "notice__title" }, "These settings are live"),
                h("p", null, "Saving changes what guests can book on the website straight away. Bookings that already exist are never moved or cancelled."))),
            h("section", { class: "a-card", "aria-labelledby": "st-cap-title" }, h("div", { class: "a-card__head" }, h("h2", { class: "a-subtitle", id: "st-cap-title" }, icon("users"), "Capacity")),
                h("div", { class: "form__row form__row--2" },
                    h("div", { class: "field" }, h("label", { class: "field__label", for: "st-capacity" }, "Seats per 30-minute slot"), cap,
                        h("p", { class: "field__hint", id: "st-capacity-hint" }, `A table holds its seats for ${saved.turnMinutes || 90} minutes. Not lower than the largest online party (${saved.maxParty || 8}).`),
                        h("p", { class: "field__error", id: "st-capacity-error", "aria-live": "polite" })),
                    h("div", { class: "field" }, h("label", { class: "field__label", for: "st-recording" }, "Seats on a recording night"), rec,
                        h("p", { class: "field__hint", id: "st-recording-hint" }, `Thursdays, doors ${formatTime((saved.recording && saved.recording.doors) || "18:30")}.`),
                        h("p", { class: "field__error", id: "st-recording-error", "aria-live": "polite" })))),
            h("section", { class: "a-card", "aria-labelledby": "st-blocked-title" }, h("div", { class: "a-card__head" }, h("h2", { class: "a-subtitle", id: "st-blocked-title" }, icon("calendar"), "Blocked dates"), h("span", { class: "a-card__meta" }, "Private hire, holidays")),
                blockedList,
                h("div", { class: "set-add" }, h("div", { class: "field" }, h("label", { class: "field__label", for: "st-block-date" }, "Date to block"), blockDate), blockAdd),
                blockedError),
            h("section", { class: "a-card", "aria-labelledby": "st-ov-title" }, h("div", { class: "a-card__head" }, h("h2", { class: "a-subtitle", id: "st-ov-title" }, icon("today"), "Hours on a single date"), h("span", { class: "a-card__meta" }, "Overrides the weekly hours")),
                overrideList,
                h("div", { class: "set-add set-add--hours" },
                    h("div", { class: "field" }, h("label", { class: "field__label", for: "st-ov-date" }, "Date"), ovDate),
                    h("div", { class: "field" }, h("label", { class: "field__label", for: "st-ov-open" }, "Opens"), ovOpen),
                    h("div", { class: "field" }, h("label", { class: "field__label", for: "st-ov-close" }, "Closes"), ovClose),
                    h("div", { class: "checkbox" }, ovClosed, h("label", { for: "st-ov-closed" }, "Closed all day")),
                    ovAdd),
                overrideError),
            h("section", { class: "a-card", "aria-labelledby": "st-week-title" }, h("div", { class: "a-card__head" }, h("h2", { class: "a-subtitle", id: "st-week-title" }, icon("cup"), "Weekly hours"), h("span", { class: "a-card__meta" }, "From the website content - read only here")), weekly),
            notice,
            h("div", { class: "settings__bar" }, dirtyEl, discard, save));

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            api.clearFieldErrors(form);
            blockedError.textContent = ""; overrideError.textContent = "";
            api.setNotice(notice, null);
            const local = {};
            if (!Number.isInteger(draft.capacityPerSlot) || draft.capacityPerSlot < 1) local.capacityPerSlot = "Enter a whole number of seats (1 to 500).";
            if (!Number.isInteger(draft.recordingSeats) || draft.recordingSeats < 1) local.recordingSeats = "Enter a whole number of seats (1 to 500).";
            if (Object.keys(local).length) { api.showFieldErrors(form, local); return; }
            if (!isDirty()) { api.setNotice(notice, "info", "Nothing has changed."); return; }
            const lower = draft.capacityPerSlot < saved.capacityPerSlot || draft.recordingSeats < saved.recordingSeats || draft.blockedDates.some((d) => !(saved.blockedDates || []).includes(d));
            if (lower) {
                const yes = await confirmDialog({ title: "Reduce what guests can book?", text: "This lowers capacity or blocks a date on the public booking page from the moment you save. Existing bookings stay as they are.", confirmLabel: "Save settings", cancelLabel: "Go back", danger: false });
                if (!yes) return;
            }
            busy(save, true);
            try {
                const res = await data.saveSettings(snapshotOfDraft());
                saved = res.settings || res;
                draft = snapshot(saved);
                toast("Settings saved. Public availability is updated.");
                paint();
                const again = content.querySelector("button[type=submit]");
                if (again) again.focus();
            } catch (err) {
                busy(save, false);
                if (err.status === 401) return;
                const fields = err.fields || {};
                const inline = {};
                ["capacityPerSlot", "recordingSeats"].forEach((k) => { if (fields[k]) inline[k] = fields[k]; });
                const placed = api.showFieldErrors(form, inline);
                if (fields.blockedDates) { blockedError.textContent = fields.blockedDates; if (!placed) blockDate.focus(); }
                if (fields.hoursOverrides) { overrideError.textContent = fields.hoursOverrides; if (!placed && !fields.blockedDates) ovDate.focus(); }
                const rest = Object.keys(fields).filter((k) => !["capacityPerSlot", "recordingSeats", "blockedDates", "hoursOverrides"].includes(k)).map((k) => fields[k]);
                if (rest.length || !Object.keys(fields).length) api.setNotice(notice, "error", rest.join(" ") || err.message || "The settings could not be saved.");
            }
        });
        discard.addEventListener("click", () => { draft = snapshot(saved); paint(); toast("Changes discarded.", { kind: "info" }); const first = content.querySelector("#st-capacity"); if (first) first.focus(); });

        content.appendChild(form);
        paintBlocked();
        paintOverrides();
        markDirty();
        const summary = `${plural(draft.blockedDates.length, "blocked date")} · ${plural(Object.keys(draft.hoursOverrides).length, "date")} with special hours`;
        head.querySelector(".a-eyebrow").textContent = "Capacity and closures · " + summary;
    }

    load(content, () => data.settings(), (res) => { saved = res.settings || res; draft = snapshot(saved); paint(); }, { alive: ctx.alive, kind: "page", rows: 4 });
    return { refresh: () => { /* a booking added from the top bar does not touch the settings: keep the draft */ } };
}

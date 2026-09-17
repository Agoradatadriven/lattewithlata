/* ==========================================================================
   Latte with Lata CRM - views/customer.js (#/customers/<id>)
   Profile: contact details, aggregates, tags editor (chips, add / remove), VIP toggle, staff notes (autosave on blur with a saved state),
   the full booking history (opens the drawer) and the messages sent from the same email.
   ========================================================================== */
import { formatDate, formatTime } from "../../lib/api.js";
import { data } from "../data.js";
import { h, clear, icon, load, statusChip, messageChip, typeTag, demoBadge, vipBadge, formatDateTime, formatDay, telHref, plural, TOPIC_LABEL } from "../dom.js";
import { toast, toastError, saveState } from "../ui.js";

export default function render(root, ctx) {
    const id = ctx.params[0];
    const back = h("a", { class: "a-back", href: "#/customers" }, icon("arrow-left"), "All customers");
    const titleEl = h("h1", { class: "view__title" }, "Customer");
    const badges = h("span", { class: "view__badges" });
    const head = h("header", { class: "view__head view__head--profile" },
        h("div", { class: "view__titles" }, back, h("div", { class: "view__titleline" }, titleEl, badges)),
        h("div", { class: "view__actions" }));
    const content = h("div", { class: "profile" });
    root.appendChild(head);
    root.appendChild(content);

    let c = null;

    function paintHead() {
        titleEl.textContent = c.name || c.email || c.phone || "Guest";
        ctx.setTitle(titleEl.textContent);
        clear(badges);
        if (c.vip) badges.appendChild(vipBadge());
        if (c.demo) badges.appendChild(demoBadge());
        const actions = head.querySelector(".view__actions");
        clear(actions);
        actions.appendChild(h("button", { type: "button", class: "a-btn a-btn--primary", onclick: () => ctx.addBooking({ name: c.name, phone: c.phone, email: c.email }) }, icon("plus"), "Book for this guest"));
    }

    async function save(patch, okText) {
        const res = await data.patchCustomer(id, patch);
        c = res.customer;
        paintHead();
        if (okText) toast(okText);
        return c;
    }

    function stat(label, value, sub) { return h("div", { class: "stat" }, h("p", { class: "stat__label" }, label), h("p", { class: "stat__value" }, String(value)), sub ? h("p", { class: "stat__sub" }, sub) : null); }
    function kv(label, value) { return h("div", { class: "a-kv__row" }, h("dt", null, label), h("dd", null, value === "" || value === null || value === undefined ? h("span", { class: "a-dim" }, "-") : value)); }

    /* ---- VIP switch ---- */
    function vipSwitch() {
        const btn = h("button", { type: "button", class: "a-switch", role: "switch", "aria-checked": String(!!c.vip), id: "cu-vip-switch" }, h("span", { class: "a-switch__track", "aria-hidden": "true" }, h("span", { class: "a-switch__thumb" })), h("span", { class: "a-switch__text" }, "VIP guest"));
        btn.addEventListener("click", async () => {
            const next = btn.getAttribute("aria-checked") !== "true";
            btn.setAttribute("aria-checked", String(next));           // optimistic: a flag flip is safe to show at once ...
            btn.disabled = true;
            try { await save({ vip: next }, next ? "Marked as VIP." : "VIP removed."); }
            catch (err) { btn.setAttribute("aria-checked", String(!next)); toastError(err, "The VIP flag could not be saved."); }   // ... and is rolled back if the server refuses
            finally { btn.disabled = false; btn.focus(); }
        });
        return btn;
    }

    /* ---- tags editor ---- */
    function tagsEditor() {
        const listEl = h("ul", { class: "tag-editor__list", "aria-label": "Tags" });
        const input = h("input", { class: "input", id: "cu-tag-new", type: "text", maxlength: "24", autocomplete: "off", autocapitalize: "off", spellcheck: "false", placeholder: "e.g. regular, window-seat", "aria-describedby": "cu-tag-hint cu-tag-error" });
        const add = h("button", { type: "submit", class: "a-btn a-btn--ghost" }, icon("plus"), "Add tag");
        const error = h("p", { class: "field__error", id: "cu-tag-error", "aria-live": "polite" });
        const form = h("form", { class: "tag-editor__form", novalidate: true },
            h("div", { class: "field" }, h("label", { class: "field__label", for: "cu-tag-new" }, "Add a tag"), h("div", { class: "tag-editor__row" }, input, add),
                h("p", { class: "field__hint", id: "cu-tag-hint" }, "Up to 12 tags, 24 characters each. Saved as lower case."), error));

        function paintTags(focusIndex) {
            clear(listEl);
            const tags = c.tags || [];
            if (!tags.length) listEl.appendChild(h("li", { class: "a-note" }, "No tags yet."));
            tags.forEach((t, i) => listEl.appendChild(h("li", { class: "tag-chip" }, h("span", null, t),
                h("button", { type: "button", class: "tag-chip__x", "aria-label": `Remove tag ${t}`, onclick: () => change(tags.filter((x) => x !== t), Math.min(i, tags.length - 2)) }, icon("close")))));
            if (focusIndex !== undefined) {
                const btns = listEl.querySelectorAll(".tag-chip__x");
                (btns[focusIndex] || input).focus();
            }
        }
        async function change(next, focusIndex) {
            error.textContent = "";
            try { await save({ tags: next }); paintTags(focusIndex); }
            catch (err) { if (err.status === 401) return; error.textContent = (err.fields && err.fields.tags) || err.message || "The tags could not be saved."; }
        }
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const value = input.value.trim().toLowerCase();
            error.textContent = "";
            if (!value) { error.textContent = "Type a tag first."; input.focus(); return; }
            if ((c.tags || []).includes(value)) { error.textContent = "That tag is already on this guest."; input.select(); return; }
            add.disabled = true;
            await change([...(c.tags || []), value]);
            add.disabled = false;
            if (!error.textContent) input.value = "";
            input.focus();
        });
        paintTags();
        return h("div", { class: "tag-editor" }, listEl, form);
    }

    /* ---- staff notes: autosave on blur ---- */
    function notesEditor() {
        const stateEl = h("span", { class: "a-save", role: "status", "aria-live": "polite" });
        const area = h("textarea", { class: "textarea", id: "cu-notes", rows: "5", maxlength: "2000", "aria-describedby": "cu-notes-hint cu-notes-error" });
        const error = h("p", { class: "field__error", id: "cu-notes-error", "aria-live": "polite" });
        area.value = c.notes || "";
        area.addEventListener("input", () => saveState(stateEl, "dirty"));
        area.addEventListener("blur", async () => {
            const value = area.value.trim();
            if (value === (c.notes || "")) { saveState(stateEl, ""); return; }
            saveState(stateEl, "saving");
            error.textContent = "";
            try { await save({ notes: value }); saveState(stateEl, "saved", "Saved " + formatTime(new Date().toTimeString().slice(0, 5))); }
            catch (err) { if (err.status === 401) return; saveState(stateEl, "error"); error.textContent = (err.fields && err.fields.notes) || err.message || "The notes could not be saved."; }
        });
        return h("div", { class: "field" }, h("div", { class: "a-field-head" }, h("label", { class: "field__label", for: "cu-notes" }, "Staff notes"), stateEl), area,
            h("p", { class: "field__hint", id: "cu-notes-hint" }, "Preferences, allergies, the usual table. Saved when you leave the field. Never shown to the guest."), error);
    }

    function historyCard(bookings) {
        const body = bookings.length
            ? h("ul", { class: "history" }, bookings.map((b) => h("li", { class: "history__item" },
                h("div", { class: "history__main" },
                    h("button", { type: "button", class: "a-rowlink", dataset: { ref: b.reference }, onclick: () => ctx.openBooking(b.reference, b), "aria-label": `Open booking ${b.reference}` }, `${formatDate(b.date)} · ${formatTime(b.time)}`),
                    h("p", { class: "history__meta" }, `${plural(b.party, "guest")}${b.table ? " · table " + b.table : ""} · ${b.reference}`)),
                h("div", { class: "history__side" }, typeTag(b.type), statusChip(b.status)))))
            : h("p", { class: "a-note" }, "No bookings on this record yet.");
        return h("section", { class: "a-card", "aria-labelledby": "cu-history" }, h("div", { class: "a-card__head" }, h("h2", { class: "a-subtitle", id: "cu-history" }, icon("calendar"), "Booking history"), h("span", { class: "a-card__meta" }, plural(bookings.length, "booking"))), body);
    }

    function messagesCard(messages) {
        const body = messages.length
            ? h("ul", { class: "history" }, messages.map((m) => h("li", { class: "history__item history__item--msg" },
                h("div", { class: "history__main" },
                    h("p", { class: "history__title" }, TOPIC_LABEL[m.topic] || m.topic, h("span", { class: "history__when" }, formatDateTime(m.createdAt))),
                    h("p", { class: "history__text" }, m.message)),
                h("div", { class: "history__side" }, messageChip(m.status)))))
            : h("p", { class: "a-note" }, "No messages from this guest.");
        return h("section", { class: "a-card", "aria-labelledby": "cu-messages" }, h("div", { class: "a-card__head" }, h("h2", { class: "a-subtitle", id: "cu-messages" }, icon("mail"), "Messages"), messages.length ? h("a", { class: "a-link", href: "#/messages" }, "Open inbox") : null), body);
    }

    function paint(res) {
        c = res.customer;
        paintHead();
        clear(content);
        content.appendChild(h("section", { class: "stats", "aria-label": "Guest numbers" },
            stat("Visits", c.bookings || 0, "bookings not cancelled"), stat("Covers", c.covers || 0), stat("No-shows", c.noShows || 0), stat("Cancellations", c.cancellations || 0),
            stat("Upcoming", c.upcoming || 0, c.nextVisit ? "next " + formatDate(c.nextVisit) : ""), stat("Last visit", c.lastVisit ? formatDate(c.lastVisit).replace(/ \d{4}$/, "") : "-", c.lastVisit ? c.lastVisit.slice(0, 4) : "")));
        content.appendChild(h("div", { class: "profile__grid" },
            h("div", { class: "profile__col" },
                h("section", { class: "a-card", "aria-labelledby": "cu-contact" }, h("div", { class: "a-card__head" }, h("h2", { class: "a-subtitle", id: "cu-contact" }, icon("user"), "Contact")),
                    h("dl", { class: "a-kv" },
                        kv("Email", c.email ? h("a", { href: "mailto:" + c.email }, c.email) : ""),
                        kv("Phone", c.phone ? h("a", { href: telHref(c.phone) }, c.phone) : ""),
                        kv("Newsletter", res.subscribed ? `Subscribed${res.subscriber && res.subscriber.consentAt ? " since " + formatDay(res.subscriber.consentAt) : ""}` : (c.marketingOptIn ? "Opted in" : "Not subscribed")),
                        kv("First seen", formatDay(c.firstSeen)), kv("Last seen", formatDay(c.lastSeen))),
                    h("div", { class: "profile__vip" }, vipSwitch())),
                h("section", { class: "a-card", "aria-labelledby": "cu-tags" }, h("div", { class: "a-card__head" }, h("h2", { class: "a-subtitle", id: "cu-tags" }, icon("star"), "Tags")), tagsEditor()),
                h("section", { class: "a-card", "aria-labelledby": "cu-notes-title" }, h("div", { class: "a-card__head" }, h("h2", { class: "a-subtitle", id: "cu-notes-title" }, icon("note"), "Notes")), notesEditor())),
            h("div", { class: "profile__col" }, historyCard(res.bookings || []), messagesCard(res.messages || []))));
    }

    const fetchProfile = (quiet) => load(content, () => data.customer(id), (res) => { paint(res); }, { quiet, alive: ctx.alive, kind: "page", rows: 5 });
    fetchProfile();
    /* a refresh from the drawer / add-booking must not wipe a note that is being typed */
    return { refresh: () => { const a = document.activeElement; if (a && content.contains(a) && /^(TEXTAREA|INPUT)$/.test(a.tagName)) return; fetchProfile(true); } };
}

/* ==========================================================================
   Latte with Lata CRM - views/messages.js (#/messages)
   Inbox for the contact form: status filters (all / new / open / done) with counts, a list + detail pane (one column on phones: the
   detail replaces the list, with a back button), status change, internal notes (autosave on blur) and a mailto reply link.
   ========================================================================== */
import { data } from "../data.js";
import { h, clear, icon, load, messageChip, demoBadge, emptyState, formatDateTime, telHref, TOPIC_LABEL, MESSAGE_STATUS_LABEL } from "../dom.js";
import { toast, toastError, saveState, exportCsv } from "../ui.js";

const memory = { status: "", selected: "" };

export default function render(root, ctx) {
    const f = memory;
    let rows = [];
    let counts = { new: 0, open: 0, done: 0 };

    const head = h("header", { class: "view__head" },
        h("div", { class: "view__titles" }, h("p", { class: "a-eyebrow" }, "From the contact form"), h("h1", { class: "view__title" }, "Messages")),
        h("div", { class: "view__actions" }, h("button", { type: "button", class: "a-btn a-btn--ghost", onclick: (e) => exportCsv("messages", null, e.currentTarget) }, icon("download"), "Export CSV")));
    const tabs = h("div", { class: "a-seg", role: "group", "aria-label": "Filter by status" });
    const demoSlot = h("span", { class: "a-listmeta__badge" });
    const listEl = h("div", { class: "inbox__list" });
    const detail = h("section", { class: "inbox__detail", "aria-label": "Message", tabindex: "-1" });
    const split = h("div", { class: "inbox" }, listEl, detail);
    root.appendChild(head);
    root.appendChild(h("div", { class: "a-listbar a-listbar--tabs" }, tabs, demoSlot));
    root.appendChild(split);

    function paintTabs() {
        clear(tabs);
        const total = counts.new + counts.open + counts.done;
        [["", "All", total], ["new", "New", counts.new], ["open", "Open", counts.open], ["done", "Done", counts.done]].forEach(([value, label, n]) => {
            tabs.appendChild(h("button", { type: "button", class: "a-seg__btn", "aria-pressed": String(f.status === value), dataset: { status: value || "all" }, onclick: () => { f.status = value; paintTabs(); paintList(); } },
                label, h("span", { class: "a-seg__count" }, String(n))));
        });
    }

    const visible = () => rows.filter((m) => !f.status || m.status === f.status);

    function paintList() {
        const out = visible();
        clear(demoSlot);
        if (out.some((m) => m.demo)) demoSlot.appendChild(demoBadge());
        clear(listEl);
        if (!out.length) {
            listEl.appendChild(emptyState(rows.length ? `No ${MESSAGE_STATUS_LABEL[f.status] ? MESSAGE_STATUS_LABEL[f.status].toLowerCase() + " " : ""}messages` : "The inbox is empty", rows.length ? "Pick another status above." : "Messages from the contact page land here."));
            paintDetail(null);
            return;
        }
        const ul = h("ul", { class: "inbox__items" });
        out.forEach((m) => {
            const on = m.id === f.selected;
            ul.appendChild(h("li", null, h("button", { type: "button", class: "inbox__item" + (on ? " is-selected" : "") + (m.status === "new" ? " is-new" : ""), "aria-current": on ? "true" : null, dataset: { id: m.id }, onclick: () => select(m.id, true) },
                h("span", { class: "inbox__row" }, h("span", { class: "inbox__from" }, m.name || m.email), h("span", { class: "inbox__when" }, formatDateTime(m.createdAt).replace(/ \d{4},/, ","))),
                h("span", { class: "inbox__row" }, h("span", { class: "inbox__topic" }, TOPIC_LABEL[m.topic] || m.topic), messageChip(m.status)),
                h("span", { class: "inbox__snippet" }, m.message))));
        });
        listEl.appendChild(ul);
        if (!out.some((m) => m.id === f.selected)) { f.selected = ""; }
        const wide = window.matchMedia("(min-width: 60em)").matches;
        if (!f.selected && wide) f.selected = out[0].id;
        if (f.selected) { const btn = listEl.querySelector(`[data-id="${f.selected}"]`); if (btn) { btn.classList.add("is-selected"); btn.setAttribute("aria-current", "true"); } }
        paintDetail(rows.find((m) => m.id === f.selected) || null);
    }

    function select(id, moveFocus) {
        f.selected = id;
        listEl.querySelectorAll(".inbox__item").forEach((b) => { const on = b.dataset.id === id; b.classList.toggle("is-selected", on); if (on) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); });
        paintDetail(rows.find((m) => m.id === id) || null);
        if (moveFocus) { const t = detail.querySelector("h2"); if (t) t.focus({ preventScroll: false }); }
    }

    async function setStatus(m, status, button) {
        if (m.status === status) return;
        button.disabled = true;
        try {
            const res = await data.patchMessage(m.id, { status });
            Object.assign(m, res.message);
            counts = rows.reduce((acc, x) => { acc[x.status] = (acc[x.status] || 0) + 1; return acc; }, { new: 0, open: 0, done: 0 });
            toast(`Message from ${m.name || m.email} marked ${MESSAGE_STATUS_LABEL[status].toLowerCase()}.`);
            paintTabs();
            paintList();
            const again = detail.querySelector(`[data-set="${status}"]`);
            if (again) again.focus();
            ctx.refreshCounts();
        } catch (err) { button.disabled = false; toastError(err, "The status could not be saved."); }
    }

    function paintDetail(m) {
        clear(detail);
        split.classList.toggle("has-selection", !!m);
        if (!m) { detail.appendChild(h("p", { class: "a-note inbox__placeholder" }, rows.length ? "Choose a message to read it." : "")); return; }
        const stateEl = h("span", { class: "a-save", role: "status", "aria-live": "polite" });
        const notes = h("textarea", { class: "textarea textarea--sm", id: "msg-notes", rows: "4", maxlength: "2000" });
        const notesError = h("p", { class: "field__error", "aria-live": "polite" });
        notes.value = m.internalNotes || "";
        notes.addEventListener("input", () => saveState(stateEl, "dirty"));
        notes.addEventListener("blur", async () => {
            const value = notes.value.trim();
            if (value === (m.internalNotes || "")) { saveState(stateEl, ""); return; }
            saveState(stateEl, "saving");
            notesError.textContent = "";
            try { const res = await data.patchMessage(m.id, { internalNotes: value }); Object.assign(m, res.message); saveState(stateEl, "saved"); }
            catch (err) { if (err.status === 401) return; saveState(stateEl, "error"); notesError.textContent = (err.fields && err.fields.internalNotes) || err.message || "The notes could not be saved."; }
        });
        const subject = "Re: your message to Latte with Lata";
        detail.appendChild(h("div", { class: "inbox__detail-inner" },
            h("button", { type: "button", class: "a-back inbox__back", onclick: () => { const id = f.selected; f.selected = ""; paintList(); const btn = listEl.querySelector(`[data-id="${id}"]`); if (btn) btn.focus(); } }, icon("arrow-left"), "Back to the inbox"),
            h("header", { class: "inbox__head" },
                h("div", null, h("p", { class: "a-eyebrow" }, TOPIC_LABEL[m.topic] || m.topic), h("h2", { class: "inbox__title", tabindex: "-1" }, m.name || m.email), h("p", { class: "a-note" }, formatDateTime(m.createdAt))),
                h("div", { class: "inbox__badges" }, messageChip(m.status), m.demo ? demoBadge(true) : null)),
            h("dl", { class: "a-kv a-kv--tight" },
                h("div", { class: "a-kv__row" }, h("dt", null, "Email"), h("dd", null, h("a", { href: "mailto:" + m.email }, m.email))),
                m.phone ? h("div", { class: "a-kv__row" }, h("dt", null, "Phone"), h("dd", null, h("a", { href: telHref(m.phone) }, m.phone))) : null),
            h("div", { class: "inbox__body" }, h("p", null, m.message)),
            h("div", { class: "inbox__actions" },
                h("a", { class: "a-btn a-btn--primary", href: `mailto:${m.email}?subject=${encodeURIComponent(subject)}` }, icon("mail"), "Reply by email"),
                m.customerId ? h("a", { class: "a-btn a-btn--ghost", href: "#/customers/" + encodeURIComponent(m.customerId) }, icon("user"), "Customer profile") : null),
            h("div", { class: "inbox__status" }, h("p", { class: "field__label", id: "msg-status-label" }, "Status"),
                h("div", { class: "a-seg a-seg--sm", role: "group", "aria-labelledby": "msg-status-label" }, ["new", "open", "done"].map((s) =>
                    h("button", { type: "button", class: "a-seg__btn", "aria-pressed": String(m.status === s), dataset: { set: s }, onclick: (e) => setStatus(m, s, e.currentTarget) }, MESSAGE_STATUS_LABEL[s])))),
            h("div", { class: "field" }, h("div", { class: "a-field-head" }, h("label", { class: "field__label", for: "msg-notes" }, "Internal notes"), stateEl), notes,
                h("p", { class: "field__hint" }, "Staff only. Saved when you leave the field."), notesError)));
    }

    const fetchRows = (quiet) => load(listEl, () => data.messages(), (res) => { rows = res.messages || []; counts = res.counts || counts; paintTabs(); paintList(); }, { quiet, alive: ctx.alive, rows: 5 });
    paintTabs();
    fetchRows();
    return { refresh: () => { const a = document.activeElement; if (a && a.tagName === "TEXTAREA" && detail.contains(a)) return; fetchRows(true); } };
}

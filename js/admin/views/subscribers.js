/* ==========================================================================
   Latte with Lata CRM - views/subscribers.js (#/subscribers)
   Newsletter list: email, source, consent date; remove with confirmation (DELETE /api/admin/subscribers/id/:id - by row id, so the address
   never goes into a URL).
   ========================================================================== */
import { data } from "../data.js";
import { h, clear, icon, load, debounce, demoBadge, emptyState, formatDateTime, formatDay, plural, cmpText } from "../dom.js";
import { dataTable, nextSort } from "../table.js";
import { confirmDialog, toast, toastError, exportCsv } from "../ui.js";

const memory = { q: "", sort: { key: "consentAt", dir: "desc" } };

export default function render(root, ctx) {
    const f = memory;
    let rows = [];
    const head = h("header", { class: "view__head" },
        h("div", { class: "view__titles" }, h("p", { class: "a-eyebrow" }, "The Thursday email"), h("h1", { class: "view__title" }, "Subscribers")),
        h("div", { class: "view__actions" }, h("button", { type: "button", class: "a-btn a-btn--ghost", onclick: (e) => exportCsv("subscribers", null, e.currentTarget) }, icon("download"), "Export CSV")));
    const q = h("input", { class: "input input--search", id: "su-q", type: "search", autocomplete: "off", spellcheck: "false", placeholder: "Email or source" });
    const filters = h("form", { class: "a-filters a-filters--single", role: "search", "aria-label": "Filter subscribers", novalidate: true }, h("div", { class: "field a-filters__search" }, h("label", { class: "field__label", for: "su-q" }, "Search"), q));
    filters.addEventListener("submit", (e) => e.preventDefault());
    const summary = h("p", { class: "a-listmeta", role: "status", "aria-live": "polite" });
    const demoSlot = h("span", { class: "a-listmeta__badge" });
    const list = h("div", { class: "a-list" });
    root.appendChild(head);
    root.appendChild(filters);
    root.appendChild(h("div", { class: "a-listbar" }, summary, demoSlot));
    root.appendChild(list);

    async function remove(s, button) {
        const yes = await confirmDialog({ title: "Remove this subscriber?", text: `${s.email} will stop receiving the newsletter and the guest's opt-in is switched off. This cannot be undone here - they would have to sign up again.`, confirmLabel: "Remove subscriber", cancelLabel: "Keep subscriber" });
        if (!yes) return;
        button.disabled = true;
        try {
            await data.removeSubscriber(s);
            rows = rows.filter((x) => x.id !== s.id);
            toast("Subscriber removed.");
            paint();
            const next = list.querySelector("button[data-remove]") || q;
            next.focus();
        } catch (err) { button.disabled = false; toastError(err, "The subscriber could not be removed."); }
    }

    const sorters = { email: (a, b) => cmpText(a.email, b.email), source: (a, b) => cmpText(a.source, b.source), consentAt: (a, b) => cmpText(a.consentAt, b.consentAt) };
    const columns = [
        { key: "email", label: "Email", sortable: true, cls: "a-col-main", cell: (s) => h("span", { class: "a-cell-main" }, h("span", { class: "a-cell-line" },
            s.customerId ? h("a", { class: "a-rowlink", href: "#/customers/" + encodeURIComponent(s.customerId) }, s.email) : h("span", { class: "a-strong" }, s.email), s.demo ? demoBadge(true) : null)) },
        { key: "source", label: "Source", sortable: true, cell: (s) => h("span", { class: "a-tag" }, s.source || "newsletter") },
        { key: "consentAt", label: "Consent given", sortable: true, cls: "a-col-2 a-nowrap", cell: (s) => h("span", { title: formatDateTime(s.consentAt) }, formatDay(s.consentAt)) },
        { key: "actions", label: "Actions", cls: "a-col-actions", cell: (s) => h("button", { type: "button", class: "a-btn a-btn--sm a-btn--danger-ghost", dataset: { remove: "1" }, "aria-label": `Remove ${s.email}`, onclick: (e) => remove(s, e.currentTarget) }, "Remove") }
    ];

    function paint() {
        const needle = f.q.trim().toLowerCase();
        const out = rows.filter((s) => !needle || String(s.email).toLowerCase().includes(needle) || String(s.source || "").toLowerCase().includes(needle));
        const cmp = sorters[f.sort.key] || sorters.consentAt;
        out.sort((a, b) => (f.sort.dir === "asc" ? 1 : -1) * cmp(a, b));
        summary.textContent = `${plural(out.length, "subscriber")}${out.length !== rows.length ? ` of ${rows.length}` : ""}`;
        clear(demoSlot);
        if (out.some((s) => s.demo)) demoSlot.appendChild(demoBadge());
        clear(list);
        if (!out.length) { list.appendChild(emptyState(rows.length ? "No subscriber matches" : "No subscribers yet", rows.length ? "Try part of the address." : "Sign-ups from the footer, the booking form and the events page appear here.")); return; }
        list.appendChild(dataTable({ label: "Newsletter subscribers", columns, rows: out, sort: f.sort, pageSize: 25,
            onSort: (key) => { f.sort = nextSort(f.sort, key, { consentAt: "desc" }); paint(); const btn = list.querySelector(".a-th-btn.is-active"); if (btn) btn.focus(); } }));
    }

    const onSearch = debounce(() => { f.q = q.value; paint(); }, 220);
    q.addEventListener("input", onSearch);
    q.value = f.q;
    const fetchRows = (quiet) => load(list, () => { if (!quiet) { summary.textContent = ""; clear(demoSlot); } return data.subscribers(); }, (res) => { rows = res.subscribers || []; paint(); }, { quiet, alive: ctx.alive, rows: 8 });
    fetchRows();
    return { refresh: () => fetchRows(true), cleanup: () => onSearch.cancel() };
}

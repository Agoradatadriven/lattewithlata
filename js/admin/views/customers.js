/* ==========================================================================
   Latte with Lata CRM - views/customers.js (#/customers)
   Searchable guest list with visits, covers, no-shows, last visit, upcoming, opt-in, VIP and tags. One GET /api/admin/customers; search,
   the VIP / opt-in / tag filters and the sorting run in the browser (no personal data in a URL). A row opens #/customers/<id>.
   ========================================================================== */
import { formatDate } from "../../lib/api.js";
import { data } from "../data.js";
import { h, clear, icon, load, debounce, demoBadge, vipBadge, emptyState, plural, cmpText, cmpNum } from "../dom.js";
import { dataTable, nextSort } from "../table.js";
import { exportCsv } from "../ui.js";

const digits = (s) => String(s || "").replace(/\D+/g, "");
const memory = { q: "", vip: false, optin: false, tag: "", sort: { key: "lastSeen", dir: "desc" } };

export default function render(root, ctx) {
    const f = memory;
    let rows = [];

    const head = h("header", { class: "view__head" },
        h("div", { class: "view__titles" }, h("p", { class: "a-eyebrow" }, "Everyone who booked, wrote or subscribed"), h("h1", { class: "view__title" }, "Customers")),
        h("div", { class: "view__actions" }, h("button", { type: "button", class: "a-btn a-btn--ghost", onclick: (e) => exportCsv("customers", null, e.currentTarget) }, icon("download"), "Export CSV")));

    const q = h("input", { class: "input input--search", id: "cu-q", type: "search", autocomplete: "off", spellcheck: "false", placeholder: "Name, email, phone, tag or note" });
    const tag = h("select", { class: "select", id: "cu-tag" });
    const vip = h("input", { id: "cu-vip", type: "checkbox" });
    const optin = h("input", { id: "cu-optin", type: "checkbox" });
    const filters = h("form", { class: "a-filters a-filters--customers", role: "search", "aria-label": "Filter customers", novalidate: true },
        h("div", { class: "field a-filters__search" }, h("label", { class: "field__label", for: "cu-q" }, "Search"), q),
        h("div", { class: "field" }, h("label", { class: "field__label", for: "cu-tag" }, "Tag"), tag),
        h("div", { class: "a-filters__checks" },
            h("div", { class: "checkbox" }, vip, h("label", { for: "cu-vip" }, "VIP only")),
            h("div", { class: "checkbox" }, optin, h("label", { for: "cu-optin" }, "Newsletter opt-in only"))));
    filters.addEventListener("submit", (e) => e.preventDefault());

    const summary = h("p", { class: "a-listmeta", role: "status", "aria-live": "polite" });
    const demoSlot = h("span", { class: "a-listmeta__badge" });
    const list = h("div", { class: "a-list" });
    root.appendChild(head);
    root.appendChild(filters);
    root.appendChild(h("div", { class: "a-listbar" }, summary, demoSlot));
    root.appendChild(list);

    const sorters = {
        name: (a, b) => cmpText(a.name, b.name), bookings: (a, b) => cmpNum(a.bookings, b.bookings), covers: (a, b) => cmpNum(a.covers, b.covers),
        noShows: (a, b) => cmpNum(a.noShows, b.noShows), lastVisit: (a, b) => cmpText(a.lastVisit, b.lastVisit), upcoming: (a, b) => cmpNum(a.upcoming, b.upcoming),
        lastSeen: (a, b) => cmpText(a.lastSeen, b.lastSeen)
    };
    const columns = [
        { key: "name", label: "Guest", sortable: true, cls: "a-col-main", cell: (c) => h("span", { class: "a-cell-main" },
            h("span", { class: "a-cell-line" }, h("a", { class: "a-rowlink", href: "#/customers/" + encodeURIComponent(c.id) }, c.name || c.email || c.phone || "Guest"), c.vip ? vipBadge() : null, c.demo ? demoBadge(true) : null),
            (c.tags || []).length ? h("span", { class: "a-tags" }, c.tags.map((t) => h("span", { class: "a-tag" }, t))) : null) },
        { key: "contact", label: "Contact", cls: "a-col-3", cell: (c) => h("span", { class: "a-contact" }, c.email ? h("span", null, c.email) : null, c.phone ? h("span", null, c.phone) : null) },
        { key: "bookings", label: "Visits", sortable: true, num: true, cell: (c) => String(c.bookings || 0) },
        { key: "covers", label: "Covers", sortable: true, num: true, cell: (c) => String(c.covers || 0) },
        { key: "noShows", label: "No-shows", sortable: true, num: true, cell: (c) => String(c.noShows || 0) },
        { key: "lastVisit", label: "Last visit", sortable: true, cls: "a-col-2 a-nowrap", cell: (c) => (c.lastVisit ? formatDate(c.lastVisit) : "") },
        { key: "upcoming", label: "Upcoming", sortable: true, num: true, cell: (c) => (c.upcoming ? h("span", { class: "a-cell-stack" }, String(c.upcoming), c.nextVisit ? h("small", null, formatDate(c.nextVisit).replace(/ \d{4}$/, "")) : null) : "0") },
        { key: "optin", label: "Opt-in", cell: (c) => (c.marketingOptIn ? h("span", { class: "a-yes" }, icon("check"), "Yes") : h("span", { class: "a-dim" }, "No")) }
    ];

    function visibleRows() {
        const needle = f.q.trim().toLowerCase();
        const nd = digits(needle);
        let out = rows.filter((c) => (!f.vip || c.vip) && (!f.optin || c.marketingOptIn) && (!f.tag || (c.tags || []).includes(f.tag)));
        if (needle) out = out.filter((c) => [c.name, c.email, c.phone, c.notes, (c.tags || []).join(" ")].some((v) => String(v || "").toLowerCase().includes(needle)) || (nd.length >= 3 && digits(c.phone).includes(nd)));
        const cmp = sorters[f.sort.key] || sorters.lastSeen;
        out.sort((a, b) => (f.sort.dir === "asc" ? 1 : -1) * (cmp(a, b) || cmpText(a.name, b.name)));
        return out;
    }

    function paintTags() {
        const all = [...new Set(rows.flatMap((c) => c.tags || []))].sort(cmpText);
        clear(tag);
        tag.appendChild(h("option", { value: "" }, "Any tag"));
        all.forEach((t) => tag.appendChild(h("option", { value: t }, t)));
        if (f.tag && !all.includes(f.tag)) f.tag = "";
        tag.value = f.tag;
    }

    function paint() {
        const out = visibleRows();
        summary.textContent = `${plural(out.length, "customer")}${out.length !== rows.length ? ` of ${rows.length}` : ""} · ${out.filter((c) => c.vip).length} VIP`;
        clear(demoSlot);
        if (out.some((c) => c.demo)) demoSlot.appendChild(demoBadge());
        clear(list);
        if (!out.length) {
            list.appendChild(emptyState(rows.length ? "No customer matches" : "No customers yet", rows.length ? "Try a different spelling or clear the filters." : "A record is created with the first booking, message or newsletter sign-up.",
                rows.length ? h("button", { type: "button", class: "a-btn a-btn--ghost", onclick: () => { Object.assign(f, { q: "", vip: false, optin: false, tag: "" }); q.value = ""; vip.checked = false; optin.checked = false; tag.value = ""; paint(); } }, "Clear filters") : null));
            return;
        }
        list.appendChild(dataTable({
            label: "Customers", columns, rows: out, sort: f.sort, pageSize: 25,
            onSort: (key) => { f.sort = nextSort(f.sort, key, { name: "asc", bookings: "desc", covers: "desc", noShows: "desc", lastVisit: "desc", upcoming: "desc" }); paint(); const btn = list.querySelector(".a-th-btn.is-active"); if (btn) btn.focus(); },
            onRow: (c) => ctx.navigate("#/customers/" + encodeURIComponent(c.id))
        }));
    }

    const onSearch = debounce(() => { f.q = q.value; paint(); }, 220);
    q.addEventListener("input", onSearch);
    tag.addEventListener("change", () => { f.tag = tag.value; paint(); });
    vip.addEventListener("change", () => { f.vip = vip.checked; paint(); });
    optin.addEventListener("change", () => { f.optin = optin.checked; paint(); });
    q.value = f.q; vip.checked = f.vip; optin.checked = f.optin;

    const fetchRows = (quiet) => load(list, () => { if (!quiet) { summary.textContent = ""; clear(demoSlot); } return data.customers(); }, (res) => { rows = res.customers || []; paintTags(); paint(); }, { quiet, alive: ctx.alive, rows: 8 });
    fetchRows();
    return { refresh: () => fetchRows(true), cleanup: () => onSearch.cancel() };
}

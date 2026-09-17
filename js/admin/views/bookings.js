/* ==========================================================================
   Latte with Lata CRM - views/bookings.js (#/bookings)
   Date range + status + type filters (sent to GET /api/admin/bookings), text search over name / email / phone / reference (debounced, run
   in the browser over the returned rows so no personal data goes into a URL), sortable columns, incremental "Show more", status chips with
   text labels, row -> the detail drawer, CSV export of the current filter.
   ========================================================================== */
import { formatDate, formatTime, todayISO, addDaysISO } from "../../lib/api.js";
import { data } from "../data.js";
import { h, clear, icon, load, debounce, statusChip, typeTag, demoBadge, emptyState, plural, cmpText, cmpNum, STATUS_LABEL, SOURCE_LABEL } from "../dom.js";
import { dataTable, nextSort } from "../table.js";
import { exportCsv } from "../ui.js";

const STATUS_ORDER = ["pending", "confirmed", "seated", "completed", "no_show", "cancelled"];
const digits = (s) => String(s || "").replace(/\D+/g, "");

/* the filter state survives leaving and re-entering the view during one session (memory only) */
const memory = { range: "upcoming", from: "", to: "", status: "", type: "", q: "", sort: { key: "when", dir: "asc" } };

function rangeDates(range, today) {
    if (range === "today") return { from: today, to: today };
    if (range === "next7") return { from: today, to: addDaysISO(today, 6) };
    if (range === "upcoming") return { from: today, to: "" };
    if (range === "past30") return { from: addDaysISO(today, -30), to: addDaysISO(today, -1) };
    return { from: "", to: "" };
}

export default function render(root, ctx) {
    const today = todayISO();
    const f = memory;
    if (f.range !== "custom") Object.assign(f, rangeDates(f.range, today));
    let rows = [];

    const exportBtn = h("button", { type: "button", class: "a-btn a-btn--ghost", onclick: (e) => exportCsv("bookings", { from: f.from, to: f.to, status: f.status, type: f.type }, e.currentTarget) }, icon("download"), "Export CSV");
    const head = h("header", { class: "view__head" },
        h("div", { class: "view__titles" }, h("p", { class: "a-eyebrow" }, "Tables and recording nights"), h("h1", { class: "view__title" }, "Bookings")),
        h("div", { class: "view__actions" }, exportBtn,
            h("button", { type: "button", class: "a-btn a-btn--primary", onclick: () => ctx.addBooking() }, icon("plus"), "Add booking")));

    /* ---- filters ---- */
    const range = h("select", { class: "select", id: "bk-range", name: "range" },
        [["upcoming", "Today and upcoming"], ["today", "Today"], ["next7", "Next 7 days"], ["past30", "Last 30 days"], ["all", "All dates"], ["custom", "Custom range"]]
            .map(([v, t]) => h("option", { value: v }, t)));
    const from = h("input", { class: "input", id: "bk-from", name: "from", type: "date" });
    const to = h("input", { class: "input", id: "bk-to", name: "to", type: "date" });
    const status = h("select", { class: "select", id: "bk-status", name: "status" }, h("option", { value: "" }, "Any status"),
        h("option", { value: "pending,confirmed,seated" }, "Active (pending, confirmed, seated)"),
        STATUS_ORDER.map((s) => h("option", { value: s }, STATUS_LABEL[s])));
    const type = h("select", { class: "select", id: "bk-type", name: "type" }, h("option", { value: "" }, "Any type"), h("option", { value: "table" }, "Tables"), h("option", { value: "recording" }, "Recording nights"));
    const q = h("input", { class: "input input--search", id: "bk-q", name: "q", type: "search", autocomplete: "off", spellcheck: "false", placeholder: "Name, email, phone or reference" });
    const reset = h("button", { type: "button", class: "a-btn a-btn--quiet a-btn--sm" }, "Reset filters");
    const field = (label, control, cls) => h("div", { class: "field " + (cls || "") }, h("label", { class: "field__label", for: control.id }, label), control);
    const filters = h("form", { class: "a-filters", role: "search", "aria-label": "Filter bookings", novalidate: true },
        field("Search", q, "a-filters__search"), field("Dates", range, "a-filters__wide"), field("From", from), field("To", to), field("Status", status), field("Type", type));
    filters.addEventListener("submit", (e) => e.preventDefault());

    const summary = h("p", { class: "a-listmeta", role: "status", "aria-live": "polite" });
    const demoSlot = h("span", { class: "a-listmeta__badge" });
    const list = h("div", { class: "a-list" });
    root.appendChild(head);
    root.appendChild(filters);
    root.appendChild(h("div", { class: "a-listbar" }, summary, reset, demoSlot));
    root.appendChild(list);

    function syncControls() {
        range.value = f.range; from.value = f.from; to.value = f.to; status.value = f.status; type.value = f.type; q.value = f.q;
    }

    /* ---- table ---- */
    const sorters = {
        when: (a, b) => cmpText(a.date + a.time, b.date + b.time),
        name: (a, b) => cmpText(a.name, b.name),
        party: (a, b) => cmpNum(a.party, b.party),
        status: (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
        type: (a, b) => cmpText(a.type, b.type),
        created: (a, b) => cmpText(a.createdAt, b.createdAt)
    };
    const columns = [
        { key: "when", label: "Date and time", sortable: true, cls: "a-col-2", cell: (b) => h("span", { class: "a-when" }, h("strong", null, formatDate(b.date)), h("span", null, formatTime(b.time))) },
        { key: "name", label: "Guest", sortable: true, cls: "a-col-main", cell: (b) => h("span", { class: "a-cell-main" },
            h("button", { type: "button", class: "a-rowlink", dataset: { ref: b.reference }, onclick: () => ctx.openBooking(b.reference, b), "aria-label": `Open booking ${b.reference}, ${b.name}` }, b.name),
            h("small", null, b.reference, b.demo ? demoBadge(true) : null)) },
        { key: "party", label: "Party", sortable: true, num: true, cell: (b) => String(b.party) },
        { key: "type", label: "Type", sortable: true, cls: "a-col-2", cell: (b) => typeTag(b.type) },
        { key: "table", label: "Table", cell: (b) => b.table || "" },
        { key: "status", label: "Status", sortable: true, cls: "a-col-2", cell: (b) => statusChip(b.status) },
        { key: "source", label: "Source", cell: (b) => SOURCE_LABEL[b.source] || b.source || "" }
    ];

    function visibleRows() {
        const needle = f.q.trim().toLowerCase();
        const nd = digits(needle);
        const phoneSearch = nd.length >= 3 && /^[\d\s+().-]+$/.test(needle);
        let out = !needle ? rows.slice() : rows.filter((b) => [b.name, b.email, b.phone, b.reference].some((v) => String(v || "").toLowerCase().includes(needle)) || (phoneSearch && digits(b.phone).includes(nd)));
        const cmp = sorters[f.sort.key] || sorters.when;
        out.sort((a, b) => (f.sort.dir === "asc" ? 1 : -1) * (cmp(a, b) || cmpText(a.date + a.time + a.createdAt, b.date + b.time + b.createdAt)));
        return out;
    }

    function paint() {
        const out = visibleRows();
        const covers = out.filter((b) => b.status !== "cancelled" && b.status !== "no_show").reduce((n, b) => n + b.party, 0);
        summary.textContent = `${plural(out.length, "booking")} · ${covers} covers${f.q.trim() ? ` matching "${f.q.trim()}"` : ""}`;
        clear(demoSlot);
        if (out.some((b) => b.demo)) demoSlot.appendChild(demoBadge());
        clear(list);
        if (!out.length) {
            list.appendChild(emptyState(rows.length ? "No booking matches that search" : "No bookings in this range",
                rows.length ? "Check the spelling, or search by the LWL reference." : "Change the dates or the status filter, or add a booking.",
                h("button", { type: "button", class: "a-btn a-btn--ghost", onclick: () => reset.click() }, "Reset filters")));
            return;
        }
        list.appendChild(dataTable({
            label: "Bookings", columns, rows: out, sort: f.sort, pageSize: 25,
            onSort: (key) => { f.sort = nextSort(f.sort, key, { when: "asc", party: "desc", created: "desc" }); paint(); const btn = list.querySelector(".a-th-btn.is-active"); if (btn) btn.focus(); },
            onRow: (b) => ctx.openBooking(b.reference, b)
        }));
    }

    function fetchRows(quiet) {
        if (!quiet) { summary.textContent = ""; clear(demoSlot); }     // never leave the previous count above a skeleton or an error
        return load(list, () => data.bookings({ from: f.from, to: f.to, status: f.status, type: f.type }), (res) => { rows = res.bookings || []; paint(); }, { quiet, alive: ctx.alive, rows: 8 });
    }

    range.addEventListener("change", () => {
        f.range = range.value;
        if (f.range !== "custom") Object.assign(f, rangeDates(f.range, today));
        syncControls();
        fetchRows();
    });
    const onDate = () => { f.range = "custom"; f.from = from.value; f.to = to.value; if (f.from && f.to && f.to < f.from) { f.to = f.from; } syncControls(); fetchRows(); };
    from.addEventListener("change", onDate);
    to.addEventListener("change", onDate);
    status.addEventListener("change", () => { f.status = status.value; fetchRows(); });
    type.addEventListener("change", () => { f.type = type.value; fetchRows(); });
    const onSearch = debounce(() => { f.q = q.value; paint(); }, 220);
    q.addEventListener("input", onSearch);
    reset.addEventListener("click", () => {
        Object.assign(f, { range: "upcoming", status: "", type: "", q: "", sort: { key: "when", dir: "asc" } }, rangeDates("upcoming", today));
        syncControls();
        fetchRows();
    });

    syncControls();
    fetchRows();
    return { refresh: () => fetchRows(true), cleanup: () => onSearch.cancel() };
}

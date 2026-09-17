/* ==========================================================================
   Latte with Lata CRM - views/activity.js (#/activity)
   The audit log: who, action, reference, when (latest 500 from GET /api/admin/activity), filter by action and by who. A booking reference
   opens the drawer, a customer id opens the profile.
   ========================================================================== */
import { data } from "../data.js";
import { h, clear, load, demoBadge, emptyState, formatDateTime, plural, cmpText } from "../dom.js";
import { dataTable } from "../table.js";
import { ACTION_LABEL, describeActivity } from "../booking-drawer.js";

const memory = { action: "", who: "" };

export default function render(root, ctx) {
    const f = memory;
    let rows = [];
    let total = 0;
    const head = h("header", { class: "view__head" },
        h("div", { class: "view__titles" }, h("p", { class: "a-eyebrow" }, "Audit log"), h("h1", { class: "view__title" }, "Activity")));
    const action = h("select", { class: "select", id: "ac-action" });
    const who = h("select", { class: "select", id: "ac-who" }, h("option", { value: "" }, "Anyone"), h("option", { value: "admin" }, "Staff"), h("option", { value: "guest" }, "Guests"));
    const filters = h("form", { class: "a-filters a-filters--pair", "aria-label": "Filter activity", novalidate: true },
        h("div", { class: "field" }, h("label", { class: "field__label", for: "ac-action" }, "Action"), action),
        h("div", { class: "field" }, h("label", { class: "field__label", for: "ac-who" }, "Who"), who));
    filters.addEventListener("submit", (e) => e.preventDefault());
    const summary = h("p", { class: "a-listmeta", role: "status", "aria-live": "polite" });
    const demoSlot = h("span", { class: "a-listmeta__badge" });
    const list = h("div", { class: "a-list" });
    root.appendChild(head);
    root.appendChild(filters);
    root.appendChild(h("div", { class: "a-listbar" }, summary, demoSlot));
    root.appendChild(list);

    function referenceCell(a) {
        const ref = String(a.reference || "");
        if (/^LWL-[A-Z0-9]{6}$/.test(ref)) return h("button", { type: "button", class: "a-rowlink a-rowlink--mono", dataset: { ref }, onclick: () => ctx.openBooking(ref, null), "aria-label": `Open booking ${ref}` }, ref);
        if (/^cus_[A-Za-z0-9]+$/.test(ref)) return h("a", { class: "a-rowlink a-rowlink--mono", href: "#/customers/" + encodeURIComponent(ref) }, ref);
        return h("span", { class: "a-mono" }, ref);
    }

    const columns = [
        { key: "at", label: "When", cls: "a-col-2 a-nowrap", cell: (a) => formatDateTime(a.at) },
        { key: "who", label: "Who", cell: (a) => h("span", { class: "a-tag" + (a.who === "admin" ? " a-tag--solid" : "") }, a.who === "admin" ? "Staff" : "Guest") },
        { key: "action", label: "Action", cls: "a-col-main", cell: (a) => h("span", { class: "a-cell-main" }, h("span", { class: "a-strong" }, ACTION_LABEL[a.action] || a.action), describeActivity(a) ? h("small", null, describeActivity(a)) : null) },
        { key: "reference", label: "Reference", cls: "a-col-3", cell: (a) => h("span", { class: "a-cell-line" }, referenceCell(a), a.demo ? demoBadge(true) : null) }
    ];

    function paintActions() {
        const all = [...new Set(rows.map((a) => a.action))].sort(cmpText);
        clear(action);
        action.appendChild(h("option", { value: "" }, "Every action"));
        all.forEach((k) => action.appendChild(h("option", { value: k }, ACTION_LABEL[k] || k)));
        if (f.action && !all.includes(f.action)) f.action = "";
        action.value = f.action;
        who.value = f.who;
    }

    function paint() {
        const out = rows.filter((a) => (!f.action || a.action === f.action) && (!f.who || a.who === f.who));
        summary.textContent = `${plural(out.length, "entry", "entries")}${out.length !== rows.length ? ` of ${rows.length}` : ""}${total > rows.length ? ` (latest ${rows.length} of ${total})` : ""}`;
        clear(demoSlot);
        if (out.some((a) => a.demo)) demoSlot.appendChild(demoBadge());
        clear(list);
        if (!out.length) { list.appendChild(emptyState(rows.length ? "Nothing matches those filters" : "No activity yet", rows.length ? "Choose another action or person." : "Bookings, messages and changes made here are logged automatically.")); return; }
        list.appendChild(dataTable({ label: "Activity log", columns, rows: out, pageSize: 50 }));
    }

    action.addEventListener("change", () => { f.action = action.value; paint(); });
    who.addEventListener("change", () => { f.who = who.value; paint(); });
    const fetchRows = (quiet) => load(list, () => { if (!quiet) { summary.textContent = ""; clear(demoSlot); } return data.activity(); }, (res) => { rows = res.activity || []; total = res.total || rows.length; paintActions(); paint(); }, { quiet, alive: ctx.alive, rows: 10 });
    fetchRows();
    return { refresh: () => fetchRows(true) };
}

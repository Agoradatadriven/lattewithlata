/* ==========================================================================
   Latte with Lata CRM - js/admin/table.js (ADMIN lane)
   A sortable, incrementally revealed table that collapses to stacked cards on phones (css/admin.css ".a-table").
     dataTable({ label, columns, rows, sort: { key, dir }, onSort(key), onRow(row), pageSize })
     column: { key, label, sortable?, num?, cls?, cell(row) -> Node | string }
   Keyboard: the sort controls are real buttons inside the <th> (aria-sort on the header); a row's primary action is the button the
   view puts in its first cell - the whole-row click is only a pointer convenience.
   ========================================================================== */
import { h, icon, append } from "./dom.js";

export function dataTable({ label, columns, rows, sort, onSort, onRow, pageSize = 25 }) {
    const wrap = h("div", { class: "a-table__wrap" });
    const table = h("table", { class: "a-table" + (onRow ? " a-table--rows" : "") });
    table.appendChild(h("caption", { class: "visual-hide" }, label));

    const headRow = h("tr");
    columns.forEach((col) => {
        const active = sort && sort.key === col.key;
        const th = h("th", { scope: "col", class: (col.num ? "is-num " : "") + (col.cls || "") });
        if (col.sortable && onSort) {
            th.setAttribute("aria-sort", active ? (sort.dir === "asc" ? "ascending" : "descending") : "none");
            th.appendChild(h("button", { type: "button", class: "a-th-btn" + (active ? " is-active" : ""), onclick: () => onSort(col.key) },
                h("span", null, col.label),
                icon(active ? (sort.dir === "asc" ? "sort-up" : "sort-down") : "sort"),
                h("span", { class: "visual-hide" }, active ? (sort.dir === "asc" ? ", sorted ascending" : ", sorted descending") : ", sort")));
        } else th.textContent = col.label;
        headRow.appendChild(th);
    });
    table.appendChild(h("thead", null, headRow));

    const tbody = h("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);

    let shown = 0;
    const foot = h("div", { class: "a-table__foot" });
    const count = h("p", { class: "a-table__count", role: "status" });
    const more = h("button", { type: "button", class: "a-btn a-btn--ghost" }, "Show more");
    foot.appendChild(count);
    foot.appendChild(more);
    wrap.appendChild(foot);

    function addRows(n, focusFirst) {
        const slice = rows.slice(shown, shown + n);
        let firstNew = null;
        slice.forEach((row) => {
            const tr = h("tr");
            columns.forEach((col) => {
                const td = h("td", { class: (col.num ? "is-num " : "") + (col.cls || ""), "data-label": col.label });
                const content = col.cell(row);
                append(td, [content === undefined || content === null || content === "" ? h("span", { class: "a-dim" }, "-") : content]);
                tr.appendChild(td);
            });
            if (onRow) {
                tr.addEventListener("click", (e) => {
                    if (e.target.closest("a, button, input, select, textarea, label")) return;
                    if (String(window.getSelection && window.getSelection()) !== "") return;   // selecting text in a row is not a click on it
                    onRow(row, tr);
                });
            }
            tbody.appendChild(tr);
            if (!firstNew) firstNew = tr;
        });
        shown += slice.length;
        count.textContent = rows.length ? `Showing ${shown} of ${rows.length}` : "";
        more.hidden = shown >= rows.length;
        if (!more.hidden) more.textContent = `Show ${Math.min(pageSize, rows.length - shown)} more`;
        if (focusFirst && firstNew) { const target = firstNew.querySelector("button, a"); if (target) target.focus(); }
    }
    more.addEventListener("click", () => addRows(pageSize, true));
    addRows(pageSize, false);
    return wrap;
}

/** toggles asc / desc on the same key, otherwise starts with the column's natural direction */
export function nextSort(current, key, defaults) {
    if (current && current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
    return { key, dir: (defaults && defaults[key]) || "asc" };
}

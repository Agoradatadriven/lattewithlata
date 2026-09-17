/* ==========================================================================
   Latte with Lata CRM - js/admin/dom.js (ADMIN lane)
   Tiny DOM + formatting helpers. RULE OF THE LANE: user content only ever reaches the page through textContent / createTextNode /
   setAttribute - there is no innerHTML with data anywhere in js/admin/**.
   ========================================================================== */
import { formatDate, formatTime } from "../lib/api.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const BOOL_PROPS = new Set(["hidden", "disabled", "checked", "selected", "required", "readOnly", "multiple", "open"]);

/** h("div", { class: "x", onclick: fn, "aria-label": "..." }, child, "text", [more]) -> Element. Strings become text nodes. */
export function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
        Object.keys(attrs).forEach((key) => {
            const v = attrs[key];
            if (v === undefined || v === null || v === false) return;
            if (key === "class") el.className = v;
            else if (key === "text") el.textContent = String(v);
            else if (key === "dataset") Object.keys(v).forEach((d) => { if (v[d] !== undefined && v[d] !== null) el.dataset[d] = String(v[d]); });
            else if (key === "value") el.value = v;
            else if (key.startsWith("on") && typeof v === "function") el.addEventListener(key.slice(2).toLowerCase(), v);
            else if (BOOL_PROPS.has(key)) el[key] = !!v;
            else el.setAttribute(key, v === true ? "" : String(v));
        });
    }
    append(el, children);
    return el;
}

export function append(el, children) {
    children.forEach((c) => {
        if (c === undefined || c === null || c === false || c === "") return;
        if (Array.isArray(c)) append(el, c);
        else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return el;
}

export function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }

/** icon("calendar") -> <svg class="a-icon" aria-hidden="true"><use href="#ai-calendar"></use></svg> (sprite: pages/admin/00-icons.html) */
export function icon(name, cls) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "a-icon" + (cls ? " " + cls : ""));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", "#ai-" + name);
    svg.appendChild(use);
    return svg;
}

export function debounce(fn, ms) {
    let t = 0;
    const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    wrapped.cancel = () => clearTimeout(t);
    return wrapped;
}

let uid = 0;
export const nextId = (prefix) => `${prefix || "a"}-${++uid}`;

/* ---- formatting ---- */
export { formatDate, formatTime };

const pad = (n) => String(n).padStart(2, "0");
/** ISO timestamp -> "Thu 17 Sep 2026, 2:05 pm" in the browser's local time */
export function formatDateTime(iso) {
    const d = new Date(iso);
    if (!iso || isNaN(d)) return "";
    return `${formatDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)}, ${formatTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}`;
}
/** ISO timestamp -> "Thu 17 Sep 2026" (local) */
export function formatDay(iso) {
    const d = new Date(iso);
    if (!iso || isNaN(d)) return "";
    return formatDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
}
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;
export const percent = (rate) => `${(Math.round((Number(rate) || 0) * 1000) / 10).toFixed(1).replace(/\.0$/, "")}%`;

export const STATUS_LABEL = { pending: "Pending", confirmed: "Confirmed", seated: "Seated", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" };
export const TYPE_LABEL = { table: "Table", recording: "Recording night" };
export const SOURCE_LABEL = { web: "Website", phone: "Phone", "walk-in": "Walk-in", admin: "Staff" };
export const OCCASION_LABEL = { none: "None", birthday: "Birthday", meeting: "Meeting", date: "Date", "recording-guest": "Here for the recording night", other: "Something else" };
export const TOPIC_LABEL = { general: "General", booking: "Booking", events: "Events", "podcast-guest": "Podcast guest", press: "Press", other: "Other" };
export const MESSAGE_STATUS_LABEL = { new: "New", open: "Open", done: "Done" };

/** status chip: a text label plus a shape glyph (never colour alone) */
export function statusChip(status) {
    return h("span", { class: `st st--${String(status).replace(/[^a-z_]/g, "")}` }, h("span", { class: "st__glyph", "aria-hidden": "true" }), STATUS_LABEL[status] || String(status));
}
export function messageChip(status) {
    return h("span", { class: `st st--msg-${String(status).replace(/[^a-z]/g, "")}` }, h("span", { class: "st__glyph", "aria-hidden": "true" }), MESSAGE_STATUS_LABEL[status] || String(status));
}
export function typeTag(type) {
    return h("span", { class: "a-tag a-tag--type" }, icon(type === "recording" ? "mic" : "cup"), TYPE_LABEL[type] || String(type));
}
export const demoBadge = (small) => h("span", { class: "a-demo" + (small ? " a-demo--sm" : ""), title: "Seeded demo record - not a real guest" }, small ? "Demo" : "Demo data");
export const vipBadge = () => h("span", { class: "a-vip" }, icon("star"), "VIP");

/* ---- list states: loading skeleton, empty, error with retry ---- */
export function skeleton(rows = 6, kind = "rows") {
    const box = h("div", { class: `a-skel a-skel--${kind}`, role: "status", "aria-label": "Loading" });
    for (let i = 0; i < rows; i++) box.appendChild(h("div", { class: "a-skel__row" }, h("span"), h("span"), h("span")));
    return box;
}
export function emptyState(title, text, action) {
    return h("div", { class: "a-state" },
        h("div", { class: "a-state__icon", "aria-hidden": "true" }, icon("cup")),
        h("p", { class: "a-state__title" }, title),
        text ? h("p", { class: "a-state__text" }, text) : null,
        action || null);
}
export function errorState(err, retry) {
    return h("div", { class: "a-state a-state--error", role: "alert" },
        h("div", { class: "a-state__icon", "aria-hidden": "true" }, icon("alert")),
        h("p", { class: "a-state__title" }, "That did not load"),
        h("p", { class: "a-state__text" }, (err && err.message) || "Something went wrong."),
        retry ? h("button", { type: "button", class: "a-btn a-btn--ghost", onclick: retry }, icon("refresh"), "Try again") : null);
}

/**
 * load(container, loader, render): shows the skeleton, awaits loader(), then render(data) (which returns a Node or fills the container itself).
 * A 401 is left alone (main.js swaps to the sign-in view). Returns the promise so callers can chain.
 */
export async function load(container, loader, render, opts) {
    const o = opts || {};
    if (!o.quiet) { clear(container); container.appendChild(skeleton(o.rows || 6, o.kind || "rows")); }
    container.setAttribute("aria-busy", "true");
    try {
        const data = await loader();
        if (o.alive && !o.alive()) return null;
        const out = render(data);
        if (out instanceof Node) { clear(container); container.appendChild(out); }
        return data;
    } catch (err) {
        if (o.alive && !o.alive()) return null;
        if (err && err.status === 401) return null;
        clear(container);
        container.appendChild(errorState(err, () => load(container, loader, render, opts)));
        return null;
    } finally {
        container.removeAttribute("aria-busy");
    }
}

/** staff messages from the API are shown as they are ("... Staff can still record it with the override."); an older server added the
    developer hint "Send force: true to record it anyway." - that one is still stripped */
export const cleanMessage = (text) => String(text || "").replace(/\s*Send force: true[^.]*\./i, "").trim();
export function cleanFields(fields) {
    const out = {};
    Object.keys(fields || {}).forEach((k) => { out[k] = cleanMessage(fields[k]); });
    return out;
}

/** phone digits for a tel: link */
export const telHref = (phone) => "tel:" + String(phone || "").replace(/[^\d+]/g, "");

/** compare helpers for the sortable tables */
export const cmpText = (a, b) => String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base", numeric: true });
export const cmpNum = (a, b) => (Number(a) || 0) - (Number(b) || 0);

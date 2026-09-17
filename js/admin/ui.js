/* ==========================================================================
   Latte with Lata CRM - js/admin/ui.js (ADMIN lane)
   Dialogs (native <dialog>.showModal(): the browser makes the rest of the page inert = focus trap, Escape closes), focus return,
   confirmation prompts, toasts (aria-live regions) and the CSV download trigger.
   ========================================================================== */
import { h, icon, clear } from "./dom.js";
import { data, exportUrl } from "./data.js";

const $ = (id) => document.getElementById(id);

/* ---- dialogs ---- */
const openStack = [];

function syncModalClass() {
    const root = document.documentElement;
    const lock = openStack.length > 0;
    if (lock && !root.classList.contains("a-modal-open")) {
        const bar = window.innerWidth - root.clientWidth;               // classic scrollbar width (0 with overlay scrollbars)
        root.style.paddingRight = bar > 0 ? bar + "px" : "";
    }
    if (!lock) root.style.paddingRight = "";
    root.classList.toggle("a-modal-open", lock);
    placeToasts();
}

/** openDialog(dialog, { focus?: Element|selector, onClose?: fn, returnFocus?: () => Element }) - remembers the opener and returns focus to it when the dialog closes */
export function openDialog(dlg, opts) {
    const o = opts || {};
    if (!dlg || dlg.open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dlg.showModal();
    openStack.push(dlg);
    syncModalClass();
    const target = typeof o.focus === "string" ? dlg.querySelector(o.focus) : o.focus;
    const fallback = dlg.querySelector(".a-dialog__title[tabindex]") || dlg.querySelector("button, [href], input, select, textarea");
    const el = target || fallback;
    if (el) el.focus({ preventScroll: true });
    const body = dlg.querySelector(".a-dialog__body");
    if (body) body.scrollTop = 0;

    const onClose = () => {
        dlg.removeEventListener("close", onClose);
        const i = openStack.indexOf(dlg);
        if (i !== -1) openStack.splice(i, 1);
        syncModalClass();
        if (typeof o.onClose === "function") o.onClose(dlg.returnValue);
        /* focus return: the opener; if the view re-rendered it meanwhile, whatever the caller points at (the same row in the fresh list); else the page */
        let back = opener && opener.isConnected && opener.getClientRects().length ? opener : null;
        if (!back && typeof o.returnFocus === "function") back = o.returnFocus();
        if (!back) back = openStack[openStack.length - 1] || $("page-content");
        if (back && back.focus) back.focus({ preventScroll: true });
    };
    dlg.addEventListener("close", onClose);
}

export function closeDialog(dlg, value) { if (dlg && dlg.open) dlg.close(value || ""); }

/** one-time wiring for every <dialog class="a-dialog">: close buttons + click on the backdrop */
export function initDialogs(root) {
    (root || document).querySelectorAll("dialog.a-dialog").forEach((dlg) => {
        if (dlg.dataset.wired) return;
        dlg.dataset.wired = "1";
        /* showModal() already makes the page inert; this keeps Tab from wandering to the browser chrome at either end: last -> first, first -> last */
        dlg.addEventListener("keydown", (e) => {
            if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
            const stops = Array.from(dlg.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'))
                .filter((el) => !el.disabled && el.type !== "hidden" && el.tabIndex >= 0 && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
            if (!stops.length) { e.preventDefault(); return; }
            const first = stops[0], last = stops[stops.length - 1];
            const current = document.activeElement;
            const group = (el) => (el && el.type === "radio" && el.name ? el.name : null);   // a radio group is one Tab stop
            const sameGroup = (a, b) => !!group(a) && group(a) === group(b);
            const inside = current && dlg.contains(current) && current !== dlg;
            const beforeFirst = inside && stops.indexOf(current) === -1 && !!(current.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING);   // e.g. the focused title
            if (e.shiftKey && (!inside || current === first || sameGroup(current, first) || beforeFirst)) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && (!inside || current === last || sameGroup(current, last))) { e.preventDefault(); first.focus(); }
        });
        let downOnBackdrop = false;
        dlg.addEventListener("mousedown", (e) => { downOnBackdrop = e.target === dlg; });
        dlg.addEventListener("click", (e) => {
            if (e.target === dlg && downOnBackdrop && !dlg.hasAttribute("data-static")) closeDialog(dlg, "dismiss");   // a press that STARTED on the backdrop (a text selection dragged out of a field never closes it)
            const closer = e.target.closest && e.target.closest("[data-dialog-close]");
            if (closer && dlg.contains(closer)) { e.preventDefault(); closeDialog(dlg, "dismiss"); }
        });
    });
}

/** confirmDialog({ title, text, confirmLabel, cancelLabel, danger }) -> Promise<boolean> */
export function confirmDialog({ title, text, confirmLabel, cancelLabel, danger = true }) {
    const dlg = $("dlg-confirm");
    const ok = $("dlg-confirm-ok");
    const cancel = dlg.querySelector("[data-dialog-close]");
    $("dlg-confirm-title").textContent = title;
    $("dlg-confirm-text").textContent = text || "";
    ok.textContent = confirmLabel || "Confirm";
    ok.className = "a-btn " + (danger ? "a-btn--danger" : "a-btn--primary");
    cancel.textContent = cancelLabel || "Keep it";
    return new Promise((resolve) => {
        const onOk = () => closeDialog(dlg, "ok");
        ok.addEventListener("click", onOk);
        openDialog(dlg, {
            focus: cancel,                                             // the safe choice has the focus: Enter never destroys by accident
            onClose: (value) => { ok.removeEventListener("click", onOk); resolve(value === "ok"); }
        });
    });
}

/* ---- toasts ---- */
function placeToasts() {
    const host = $("toasts");
    if (!host) return;
    const top = openStack[openStack.length - 1];
    const parent = top || $("crm-layer");
    if (parent && host.parentNode !== parent) parent.appendChild(host);   // a modal dialog lives in the top layer: the toasts ride inside the top-most one so they stay visible and announced
}

/** toast("Saved", { kind: "success" | "error" | "info" }) */
export function toast(message, opts) {
    const o = opts || {};
    const kind = o.kind || "success";
    const region = $(kind === "error" ? "toasts-alert" : "toasts-polite");
    if (!region) return;
    placeToasts();
    const close = h("button", { type: "button", class: "a-toast__close", "aria-label": "Dismiss" }, icon("close"));
    const el = h("div", { class: `a-toast a-toast--${kind}` },
        h("span", { class: "a-toast__glyph", "aria-hidden": "true" }, icon(kind === "error" ? "alert" : "check")),
        h("p", { class: "a-toast__text" }, String(message)),
        close);
    let timer = 0;
    const remove = () => { clearTimeout(timer); if (el.isConnected) el.remove(); };
    const arm = () => { clearTimeout(timer); timer = setTimeout(remove, kind === "error" ? 9000 : 5000); };
    close.addEventListener("click", remove);
    el.addEventListener("mouseenter", () => clearTimeout(timer));
    el.addEventListener("mouseleave", arm);
    el.addEventListener("focusin", () => clearTimeout(timer));
    el.addEventListener("focusout", arm);
    region.appendChild(el);
    while (region.children.length > 4) region.firstElementChild.remove();
    arm();
    return remove;
}

export function clearToasts() { ["toasts-polite", "toasts-alert"].forEach((id) => { const r = $(id); if (r) clear(r); }); }

/** report a failed request as a toast (a 401 is handled globally: no toast) */
export function toastError(err, fallback) {
    if (err && err.status === 401) return;
    toast((err && err.message) || fallback || "Something went wrong. Please try again.", { kind: "error" });
}

/* ---- CSV export ---- */
const KIND_LABEL = { bookings: "Bookings", customers: "Customers", messages: "Messages", subscribers: "Subscribers" };

/** exportCsv("bookings", { from, to, status, type }): checks the session first (so an expired session never downloads an error page), then lets the browser download the file */
export async function exportCsv(kind, filters, button) {
    if (button) { button.disabled = true; button.setAttribute("aria-busy", "true"); }
    try {
        await data.summary();                                          // guarded call: a 401 here returns the UI to sign-in instead of downloading JSON
        const a = h("a", { href: exportUrl(kind, filters), download: "", hidden: true });
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast(`${KIND_LABEL[kind] || "CSV"} export is downloading.`);
    } catch (err) {
        toastError(err, "The export could not start.");
    } finally {
        if (button) { button.disabled = false; button.removeAttribute("aria-busy"); }
    }
}

/** small "Saving... / Saved / Could not save" indicator used by the autosave fields */
export function saveState(el, state, text) {
    if (!el) return;
    el.dataset.state = state || "";
    el.textContent = text || ({ saving: "Saving...", saved: "Saved", error: "Could not save", dirty: "Unsaved changes" }[state] || "");
}

/** busy(button, on): disabled + aria-busy + spinner class */
export function busy(button, on) {
    if (!button) return;
    button.disabled = !!on;
    button.classList.toggle("is-busy", !!on);
    if (on) button.setAttribute("aria-busy", "true"); else button.removeAttribute("aria-busy");
}

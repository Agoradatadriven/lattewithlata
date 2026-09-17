/* ==========================================================================
   Latte with Lata CRM - js/admin/main.js (ADMIN lane, PAGES-SPEC 2 + 4)
   Front-of-house CRM: sign-in (token -> HttpOnly cookie session), a tiny hash router and the app chrome.
     #/today  #/bookings  #/customers  #/customers/<id>  #/messages  #/subscribers  #/settings  #/activity
   Vanilla ES modules, no dependencies, all data through js/lib/api.js (js/admin/data.js). Strict CSP: no inline scripts or handlers.

   Session: the token is only ever POSTed to /api/admin/login - it is never written to localStorage / sessionStorage / a cookie by this
   code. The only thing kept in localStorage is a HINT (the session's expiry time) so a signed-out visit shows the sign-in form without
   first probing GET /api/admin/session (which answers 401 and would print a network error in the console).
   Any 401 from an admin call returns the UI to the sign-in view and remembers the route the user wanted.
   ========================================================================== */
import api, { isUnavailable } from "../lib/api.js";
import { data, onUnauthorized } from "./data.js";
import { clear, h, skeleton } from "./dom.js";
import { initDialogs, openDialog, closeDialog, toast, clearToasts, exportCsv, busy } from "./ui.js";
import { openAddBooking } from "./booking-add.js";
import { openBooking } from "./booking-drawer.js";

const $ = (id) => document.getElementById(id);
const HINT_KEY = "lwl-admin-session-until";      // an expiry timestamp, NOT a credential
const DEFAULT_ROUTE = "#/today";

const ROUTES = [
    { re: /^#\/today$/, name: "today", nav: "today", title: "Today", load: () => import("./views/today.js") },
    { re: /^#\/bookings$/, name: "bookings", nav: "bookings", title: "Bookings", load: () => import("./views/bookings.js") },
    { re: /^#\/customers$/, name: "customers", nav: "customers", title: "Customers", load: () => import("./views/customers.js") },
    { re: /^#\/customers\/([A-Za-z0-9_-]{1,64})$/, name: "customer", nav: "customers", title: "Customer", load: () => import("./views/customer.js") },
    { re: /^#\/messages$/, name: "messages", nav: "messages", title: "Messages", load: () => import("./views/messages.js") },
    { re: /^#\/subscribers$/, name: "subscribers", nav: "subscribers", title: "Subscribers", load: () => import("./views/subscribers.js") },
    { re: /^#\/settings$/, name: "settings", nav: "settings", title: "Settings", load: () => import("./views/settings.js") },
    { re: /^#\/activity$/, name: "activity", nav: "activity", title: "Activity", load: () => import("./views/activity.js") }
];

const state = { signedIn: false, intended: null, renderSeq: 0, cleanup: null, refresh: null, current: null };

/* ---- session hint ---- */
const hint = {
    get() { try { const v = Number(localStorage.getItem(HINT_KEY)); return v && v > Date.now() ? v : 0; } catch (_) { return 0; } },
    set(expiresAt) { try { localStorage.setItem(HINT_KEY, String(new Date(expiresAt).getTime() || Date.now() + 12 * 3600 * 1000)); } catch (_) { /* private mode: every visit starts at sign-in */ } },
    clear() { try { localStorage.removeItem(HINT_KEY); } catch (_) { /* ignore */ } }
};

/* ---- sign-in view ---- */
function showSignIn(message) {
    state.signedIn = false;
    if (typeof state.cleanup === "function") { try { state.cleanup(); } catch (_) { /* ignore */ } }
    state.cleanup = null;
    state.refresh = null;
    document.querySelectorAll("dialog[open]").forEach((d) => closeDialog(d, "dismiss"));
    clearToasts();
    clear($("view"));
    $("app").hidden = true;
    $("signin").hidden = false;
    document.title = "Sign in - Front of house - Latte with Lata";
    const form = $("signin-form");
    form.reset();
    api.clearFieldErrors(form);
    api.setNotice($("signin-notice"), message ? "info" : null, message || "");
    $("signin-token").focus();
}

function showApp() {
    state.signedIn = true;
    $("signin").hidden = true;
    $("app").hidden = false;
    const want = state.intended && matchRoute(state.intended) ? state.intended : (matchRoute(location.hash) ? location.hash : DEFAULT_ROUTE);
    state.intended = null;
    if (location.hash !== want) location.hash = want;             // the hashchange listener renders
    else route();
    refreshCounts();
}

async function onSignIn(e) {
    e.preventDefault();
    const form = $("signin-form");
    const input = $("signin-token");
    const button = $("signin-submit");
    const notice = $("signin-notice");
    api.clearFieldErrors(form);
    api.setNotice(notice, null);
    const token = input.value.trim();
    if (!token) { api.showFieldErrors(form, { token: "Enter the staff token." }); return; }
    busy(button, true);
    button.textContent = "Signing in...";
    try {
        const res = await data.login(token);
        input.value = "";                                              // the token leaves the DOM as soon as the cookie is set
        hint.set(res.expiresAt);
        showApp();
    } catch (err) {
        input.value = "";
        if (err.code === "invalid_token") api.showFieldErrors(form, { token: err.message || "That token is not right." });
        else if (err.code === "rate_limited") {
            const wait = Number(err.body && err.body.retryAfter) || 0;
            const mins = Math.max(1, Math.ceil(wait / 60));
            api.setNotice(notice, "error", `${err.message || "Too many sign-in attempts."} Sign-in is locked for about ${mins} minute${mins === 1 ? "" : "s"}.`);
            input.focus();
        } else if (isUnavailable(err)) {
            api.setNotice(notice, "error", "The booking server is not running here, so the CRM cannot sign you in. Start it with: node server.cjs");
        } else {
            api.setNotice(notice, "error", err.message || "Sign-in failed. Please try again.");
            input.focus();
        }
    } finally {
        busy(button, false);
        button.textContent = "Sign in";
    }
}

async function signOut() {
    try { await data.logout(); } catch (_) { /* already signed out: same result */ }
    hint.clear();
    state.intended = null;
    showSignIn("You are signed out.");
}

onUnauthorized(() => {
    if (!state.signedIn) return;
    hint.clear();
    state.intended = matchRoute(location.hash) ? location.hash : null;   // come back to the same view after signing in again
    showSignIn("Your session has ended. Sign in again to carry on.");
});

/* ---- router ---- */
function matchRoute(hash) {
    for (const r of ROUTES) { const m = r.re.exec(String(hash || "")); if (m) return { route: r, params: m.slice(1) }; }
    return null;
}

function markNav(nav, title) {
    document.querySelectorAll("[data-nav]").forEach((el) => {
        const on = el.dataset.nav === nav;
        if (el.tagName === "A") { if (on) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current"); }
        el.classList.toggle("is-current", on);
    });
    const more = document.querySelector('.crm__tabs [data-nav="more"]');
    if (more) more.classList.toggle("is-current", ["subscribers", "settings", "activity"].includes(nav));
    $("crm-top-title").textContent = title;
    document.title = `${title} - Front of house - Latte with Lata`;
}

const ctx = {
    navigate(hash) { if (location.hash === hash) route(); else location.hash = hash; },
    /** after a change made outside the view (add booking, drawer edit): let the view re-fetch in place, or re-render it */
    reload() { if (typeof state.refresh === "function") state.refresh(); else route(); },
    openBooking(reference, booking, opts) { openBooking(reference, booking, Object.assign({ ctx }, opts || {})); },
    addBooking(defaults, opts) { openAddBooking(Object.assign({ ctx }, opts || {}), defaults || {}); },
    refreshCounts,
    setTitle(title) { $("crm-top-title").textContent = title; document.title = `${title} - Front of house - Latte with Lata`; }
};

async function route(opts) {
    if (!state.signedIn) return;
    const hit = matchRoute(location.hash);
    if (!hit) { location.replace(location.pathname + location.search + DEFAULT_ROUTE); return; }
    const seq = ++state.renderSeq;
    const view = $("view");
    if (typeof state.cleanup === "function") { try { state.cleanup(); } catch (_) { /* ignore */ } }
    state.cleanup = null;
    state.refresh = null;
    closeDialog($("dlg-more"), "dismiss");
    markNav(hit.route.nav, hit.route.title);
    clear(view);
    view.appendChild(skeleton(5, "page"));
    try {
        const mod = await hit.route.load();
        if (seq !== state.renderSeq || !state.signedIn) return;
        const root = h("div", { class: `view__inner view--${hit.route.name}` });
        const alive = () => seq === state.renderSeq && state.signedIn;
        /* a view builds its chrome synchronously, starts its own loading (skeleton -> rows / empty / error) and may return { refresh, cleanup } */
        const hooks = (await mod.default(root, Object.assign({ alive, params: hit.params }, ctx))) || {};
        if (!alive()) { if (typeof hooks.cleanup === "function") hooks.cleanup(); return; }
        state.cleanup = hooks.cleanup || null;
        state.refresh = hooks.refresh || null;
        clear(view);
        view.appendChild(root);
        state.current = hit.route.name;
        window.scrollTo(0, 0);
        const title = root.querySelector("h1");
        if (title && !(opts && opts.keepFocus)) { title.setAttribute("tabindex", "-1"); title.focus({ preventScroll: true }); }
    } catch (err) {
        if (seq !== state.renderSeq || (err && err.status === 401)) return;
        clear(view);
        view.appendChild(h("div", { class: "a-state a-state--error", role: "alert" },
            h("p", { class: "a-state__title" }, "This view could not be opened"),
            h("p", { class: "a-state__text" }, (err && err.message) || "Something went wrong."),
            h("button", { type: "button", class: "a-btn a-btn--ghost", onclick: () => route() }, "Try again")));
    }
}

/** the "new messages" badge on the nav */
async function refreshCounts() {
    if (!state.signedIn) return;
    try {
        const res = await data.messages();
        const n = (res.counts && res.counts.new) || 0;
        document.querySelectorAll('[data-count="messages"]').forEach((el) => {
            el.hidden = n === 0;
            clear(el);
            if (n) { el.appendChild(document.createTextNode(String(n))); el.appendChild(h("span", { class: "visual-hide" }, n === 1 ? " new message" : " new messages")); }
        });
    } catch (_) { /* the badge is a nicety */ }
}

/* ---- chrome actions ---- */
function onAction(e) {
    const el = e.target.closest && e.target.closest("[data-action], [data-export]");
    if (!el) return;
    if (el.dataset.export) { exportCsv(el.dataset.export, null, el); return; }
    const action = el.dataset.action;
    if (action === "signout") { closeDialog($("dlg-more"), "dismiss"); signOut(); }
    else if (action === "export") { closeDialog($("dlg-more"), "dismiss"); openDialog($("dlg-export")); }
    else if (action === "more") openDialog($("dlg-more"), { focus: $("dlg-more").querySelector("a, button:not([data-dialog-close])") });
    else if (action === "add-booking") ctx.addBooking();
}

async function boot() {
    initDialogs(document);
    $("signin-form").addEventListener("submit", onSignIn);
    document.addEventListener("click", onAction);
    document.querySelectorAll("#dlg-more a").forEach((a) => a.addEventListener("click", () => closeDialog($("dlg-more"), "dismiss")));
    window.addEventListener("hashchange", () => {
        if (state.signedIn) route();
        else if (matchRoute(location.hash)) state.intended = location.hash;
    });
    /* skip link: move focus into <main> without touching the hash route */
    const skip = document.querySelector(".a-skip");
    if (skip) skip.addEventListener("click", (e) => { e.preventDefault(); $("page-content").focus(); });

    if (matchRoute(location.hash)) state.intended = location.hash;
    if (hint.get()) {
        try { const s = await data.session(); hint.set(s.expiresAt); showApp(); return; }
        catch (_) { hint.clear(); }
    }
    showSignIn();
}

boot();

export { ctx, toast };

/* ==========================================================================
   Latte with Lata CRM - js/admin/data.js (ADMIN lane)
   Every request of the CRM goes through js/lib/api.js (JSON, same-origin cookie session). This module only adds:
     - one place that notices a 401 (session gone) and tells main.js to return to the sign-in view
     - named calls so the views read like the API contract (API.md "Admin routes")
   Privacy: names, emails and phone numbers are never put into query strings from here - the text search of the list views runs in the
   browser over the rows the server returned for the non-personal filters (dates, status, type). Subscribers are removed by row id
   (DELETE /api/admin/subscribers/id/:id), so no address is ever part of a URL.
   ========================================================================== */
import api from "../lib/api.js";

const unauthorizedListeners = new Set();
export function onUnauthorized(fn) { unauthorizedListeners.add(fn); return () => unauthorizedListeners.delete(fn); }

async function guard(promise) {
    try { return await promise; }
    catch (err) {
        if (err && err.status === 401 && err.code !== "invalid_token") unauthorizedListeners.forEach((fn) => { try { fn(err); } catch (_) { /* listener errors never mask the 401 */ } });
        throw err;
    }
}

const A = "/api/admin/";

export const data = {
    /* session */
    login: (token) => api.post(A + "login", { token }),                       // 401 invalid_token / 429 rate_limited are shown by the sign-in form
    session: () => api.get(A + "session"),                                    // not guarded: the boot probe handles its own 401
    logout: () => api.post(A + "logout", {}),

    summary: () => guard(api.get(A + "summary")),

    bookings: (filters) => guard(api.get(A + "bookings", filters)),           // { from, to, status, type, customerId, sort } - never a name / email
    bookingByReference: async (reference) => {                                // GET /api/admin/bookings/:reference -> the full staff record, null when unknown
        try { return (await guard(api.get(A + "bookings/" + encodeURIComponent(reference)))).booking || null; }
        catch (err) { if (err && err.status === 404 && err.code === "not_found") return null; throw err; }
    },
    createBooking: (body) => guard(api.post(A + "bookings", body)),
    patchBooking: (reference, body) => guard(api.patch(A + "bookings/" + encodeURIComponent(reference), body)),

    customers: () => guard(api.get(A + "customers")),
    customer: (id) => guard(api.get(A + "customers/" + encodeURIComponent(id))),
    patchCustomer: (id, body) => guard(api.patch(A + "customers/" + encodeURIComponent(id), body)),

    messages: () => guard(api.get(A + "messages")),
    patchMessage: (id, body) => guard(api.patch(A + "messages/" + encodeURIComponent(id), body)),

    subscribers: () => guard(api.get(A + "subscribers")),
    removeSubscriber: (subscriber) => {                                       // by row id - the address never goes into a URL
        const id = subscriber && subscriber.id;
        if (!id) return Promise.reject(new api.ApiError("This row has no id. Refresh the list and try again.", { status: 0, code: "missing_id" }));
        return guard(api.del(A + "subscribers/id/" + encodeURIComponent(id)));
    },

    settings: () => guard(api.get(A + "settings")),
    saveSettings: (body) => guard(api.put(A + "settings", body)),

    activity: (query) => guard(api.get(A + "activity", query)),

    /* public routes the CRM reads. With a staff session `excludeRef` leaves that booking out of the seat count (editing a booking must not
       count its own seats against it); the server ignores the parameter for anyone who is not signed in. */
    availability: (query) => api.get("/api/availability", query),
    config: () => api.get("/api/config")
};

/** /api/admin/export?kind=...: the cookie rides along; bookings accept the list's non-personal filters */
export function exportUrl(kind, filters) {
    const qs = new URLSearchParams({ kind });
    Object.keys(filters || {}).forEach((k) => { const v = filters[k]; if (v !== undefined && v !== null && v !== "") qs.set(k, String(v)); });
    return "/api/admin/export?" + qs.toString();
}

export default data;

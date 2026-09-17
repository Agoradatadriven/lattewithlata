/* ==========================================================================
   00-header - plate / hide-show triggers (M1, M2), drawer toggle (M3), --hH, mobile pill (M28)
   Sources: PS = PZ/source/js/modules/_page-scroll.beautified.js
            MN = PZ/source/js/modules/_menu.beautified.js
            IB = IC(eberg)/source/js/D51_WxQ5.beautified.js
   ctx = { gsap, ScrollTrigger, SplitText, reduceMotion, isTouch, isMouse, mm, refresh, initCarousel }
   Header triggers stay active under reduceMotion (PS:284 returns AFTER this block).
   ========================================================================== */
export default function init(ctx) {
    const header = document.getElementById("page-header");
    if (!header || header.dataset.init) return;
    header.dataset.init = "header";

    const { gsap, ScrollTrigger, reduceMotion, mm } = ctx;
    const html = document.documentElement;
    const body = document.body;
    const main = document.getElementById("main") || document.querySelector("main") || body;   // np_root.page.content (= main.page__content)
    const hero = () => document.getElementById("s-01-hero");                                 // np_root.page.banner (= .banner)
    const heroHeight = () => (hero() ? hero().offsetHeight : 0);                             // banner.height()

    /* ---- --hH: measured header height as a unitless number - PS:167-170 (runs again on resize like the source's r[] stack) ---- */
    const setHH = () => {
        const t = header.offsetHeight, e = header.offsetWidth;
        html.style.setProperty("--hH", String(t < e ? t : e));                                // i = t < e ? t : e
    };
    setHH();
    window.addEventListener("resize", setHH);

    /* ---- M3 drawer - MN:11-14 ---- */
    const drawer = document.getElementById("menu-container");
    const burger = header.querySelector("button.js-menu-switcher");
    const setOpen = (open) => {
        const was = html.classList.contains("m-open");
        html.classList.toggle("m-open", open);                                                // o.addClass/removeClass("m-open")
        if (burger) burger.setAttribute("aria-expanded", open ? "true" : "false");           // a11y - INFERRED
        if (drawer) drawer.setAttribute("aria-hidden", open ? "false" : "true");
        // INFERRED (DD s7 accessibility; verify-A gate 6 "focus trap"): closing returns focus to the burger when it was inside
        // the drawer, so keyboard users are not dropped on a hidden link (the source has no focus management - MN:11-14).
        if (was && !open && burger && drawer && drawer.contains(document.activeElement)) burger.focus({ preventScroll: true });
    };
    header.querySelectorAll(".js-menu-switcher").forEach((el) => {
        el.addEventListener("click", (e) => {                                                 // MN:11-12
            e.preventDefault();
            setOpen(!html.classList.contains("m-open"));
        });
    });
    /* focus trap - INFERRED (not in the source): while html.m-open, Tab / Shift+Tab cycle through the burger + the drawer's
       focusable links only; focus can never land on the page behind the screen (which would also scroll it: gate 6). */
    const trapList = () => {
        const inDrawer = drawer ? Array.from(drawer.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')) : [];
        return [burger].concat(inDrawer).filter((el) => el && el.getClientRects().length);
    };
    body.addEventListener("keydown", (e) => {                                                 // MN:13-14 (27 === n.which)
        if (e.key === "Escape" || e.keyCode === 27) { setOpen(false); return; }
        if (e.key !== "Tab" || !html.classList.contains("m-open")) return;
        const list = trapList();
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        // every Tab step is driven here (the header's own book/logo links sit outside the list and under the screen)
        const next = e.shiftKey
            ? (i <= 0 ? list[list.length - 1] : list[i - 1])                                  // Shift+Tab: burger (or outside) -> last drawer link
            : (i === -1 || i === list.length - 1 ? list[0] : list[i + 1]);                   // Tab: past the last link (or outside) -> burger
        e.preventDefault();
        next.focus({ preventScroll: true });
    });
    if (drawer) {
        // INFERRED: same-page anchors close the drawer so the browser can scroll to the section
        // (the source reloads for "#!" routes - MN:16-19 - which does not apply to a one-page site)
        drawer.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", () => setOpen(false)));
    }

    /* ---- M1 plate - PS:183-195: start = banner.height()/4 (225 desktop / 211 mobile), fallback 300 ---- */
    ScrollTrigger.create({                                                                    // gsap.to("body", {scrollTrigger: {...}}) in the source; a bare trigger is equivalent
        trigger: main,                                                                        // PS:185 (np_root.page.content)
        start: () => (hero() ? heroHeight() / 4 * 1 : 300),                                   // PS:186
        onEnter: () => body.classList.add("opaque"),                                          // PS:187-189
        onLeaveBack: () => body.classList.remove("opaque"),                                   // PS:190-192
        refreshPriority: 1500,                                                                // PS:193
        invalidateOnRefresh: true                                                             // PS:194
    });

    /* ---- M2 hide/show - PS:196-210: start = banner.height()/2 (450 / 422), |dy| > 10 ---- */
    let a = 0;                                                                                // last scrollTop (PS var a)
    ScrollTrigger.create({
        trigger: main,                                                                        // PS:198
        start: () => (hero() ? heroHeight() / 2 * 1 : 500),                                   // PS:199
        onUpdate: (t) => {                                                                    // PS:200-204
            const e = window.pageYOffset;                                                     // np_root.page.win.scrollTop()
            if (t.direction > 0) { if (Math.abs(a - e) > 10) body.classList.add("header-up"); }
            else if (Math.abs(e - a) > 10) body.classList.remove("header-up");
            a = e;
        },
        onLeaveBack: () => body.classList.remove("header-up"),                               // PS:205-207
        refreshPriority: -100,                                                                // PS:208
        invalidateOnRefresh: true                                                             // PS:209
    });

    /* ---- M28 mobile pill - IB:1603-1617 (isMobile "(max-width: 767px)") ----
       Port: trigger = #main (BUILD-SPEC 00 (d)); start = the hero's height so the pill appears "from the title strip down"
       (BEST-PARTS Pick 18 "Change") and never sits over the hero tagline - INFERRED start offset; the spec's literal "top top"
       would show it over the hero. end "bottom bottom" (IB:1607). */
    const wrap = document.getElementById("book-pill-wrap");
    if (wrap && main !== body) {
        if (reduceMotion) {
            gsap.set(wrap, { opacity: 1, visibility: "visible" });                            // DD Pick 19: end state, no trigger - INFERRED
        } else {
            mm.add("(max-width: 767px)", () => {                                              // IB:1598 isMobile
                gsap.timeline({
                    scrollTrigger: {
                        trigger: main,                                                        // IB:1604 (".home-about" -> #main)
                        start: () => "top+=" + heroHeight() + " top",                         // IB:1605 "top top" + hero offset (see note above)
                        end: () => "bottom bottom",                                           // IB:1606
                        toggleActions: "play reverse play reverse",                           // IB:1607
                        invalidateOnRefresh: true                                             // function-valued start/end (BUILD-SPEC M30)
                    }
                }).fromTo(wrap, { opacity: 0, visibility: "hidden" },                         // IB:1609-1612
                    { opacity: 1, visibility: "visible", duration: .6, ease: "power2.out" }); // IB:1613-1616
                /* brand pass (review POLISH 5): park the pill while 12 VISIT / LISTEN is in view - it carries its own "Book a table"
                   and the pill was sliding over the twin-card titles; html.pill-away is CSS-only (00-header.css), no tween - INFERRED */
                const visit = document.getElementById("s-12-visit-listen");
                if (visit) {
                    const away = ScrollTrigger.create({
                        trigger: visit, start: "top 85%", end: "bottom 15%",
                        onToggle: (e) => html.classList.toggle("pill-away", e.isActive)
                    });
                    return () => { away.kill(); html.classList.remove("pill-away"); };   // mm cleanup when the query stops matching
                }
            });
        }
    }
}

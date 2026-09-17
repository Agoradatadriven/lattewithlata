/* ==========================================================================
   10-hosts - section module (file contract: export default function init(ctx))
   Every engine of this row is a foundation helper (spec 10 (d): M10, M16, M18 + M11), called here in Paszkowski's init order so the
   section is self-sufficient; all four are idempotent (data-init marks), so the integrator's initAll() is a no-op on this root.
   PS = teardowns/2026-09-14-caffepaszkowski-com/source/js/modules/_page-scroll.beautified.js
     M10 word rise    h2.strip__title1 -> SplitText words in span.word-wrapper; fromTo yPercent 110 -> 0, opacity 1, stagger .05, delay .1,
                      1.2s power2.inOut, start "top bottom-=50px", toggleActions "play none none reset"          - PS:28, 149-153, 340-359 (core initSplitTitles)
     M11 reveals      col1 .anima--left-in / col2 .anima--right-in class flip .waiting -> .animated (col2 +.5s)  - PS:554-568 (core initReveals)
                      (rendered.html [280]/[281] carry these classes - kept although spec 10 (d) says "no anima--")
     M18 stamp        col1 .strip--stamp: --stamp-y -25% -> 25%, start "top bottom", end "top top", scrub .75    - PS:992-1006 (core initStamps)
                      (the mark itself is display:none in 10-hosts.css - DD Pick 13 four-instance cap; the tween is harmless)
     M16 zoom-settle  .js-image-anime -> .strip__image img: gsap.from {scale 1.2, yPercent -40}, trigger = the column,
                      start "top min(offsetTop/innerHeight*100,100)%" (= "top 100%" below the fold), end "bottom top", scrub 1
                      loading="lazy" stripped first (PS:143-145)                                                  - PS:1031-1046 (core initImageAnime)
                      Runtime note (spec 10 (d)): the source tween never completed because its page ended at 8705; here 11-14 follow, so
                      "bottom top" is reachable and no end clamp is needed.
   Reduced motion: each helper gsap.set()s its end state / skips its trigger (DD Pick 19).

   PAGES update 2026-09-17 (lane FOUNDER):
     DELIBERATE EXCEPTION to M16 for ONE image - the host portrait in column 1. Same trigger, start, scrub and refreshPriority as
     core.initImageAnime, but (1) the tween starts at scale 1.06 / yPercent -3 about the top edge (PORTRAIT_FROM / PORTRAIT_ORIGIN;
     was -12 about the centre until the final home check) instead of 1.2 / -40: the client circled
     the old crop as too close, and a 1.2 zoom on a face is a close-up again; (2) it ENDS at "top 25%" (PORTRAIT_END) instead of
     "bottom top": the source photo has only 3% of headroom above her hair, so with the stock end the settle would finish after the
     figure has left the screen and the top of her head would be trimmed the whole time it is in view. Ending when the column top reaches
     a quarter of the viewport means the photo is at rest (scale 1, y 0 = whole head, hair and both shoulders) once she is on screen.
     Column 1 is claimed here (data-init "anime") BEFORE the core sweep so core never adds its 1.2 tween to it; if the core got there
     first, its tween on the photo is killed and replaced.
     Column 2 (the recording-corner photo) keeps the stock M16 through core.initImageAnime.
     Trigger count of the row is unchanged: split 1 + reveals 4 + stamp 1 + image-anime 2 = 8.

     DROP-IN SLOT for a real podcast photograph: figure.hosts__stage[data-podcast-photo]. Empty (the default) = nothing happens, no request.
     Set to a path (assets/images/founder-podcast.jpg): an Image() probe loads it; on load the figure image swaps to it (4:5 cover,
     optional data-podcast-focus = object-position) and .hosts__stage--photo hides the drawn microphone; on error the portrait stays.

     Overlay animations (CSS) are paused while the figure is off screen (.hosts__stage--idle via IntersectionObserver).
   ========================================================================== */
import { initSplitTitles, initReveals, initStamps, initImageAnime } from "../core.js";

/* FINAL home check 2026-09-17: was { scale 1.06, yPercent -12 } about the centre. The integrated sweep measured the top of her hair
   trimmed while the figure entered (81 / 55 / 95 / 52 px at 1440 / 1024 / 768 / 390; still 12 px at 390 with her eyes already on screen).
   Scaling from the TOP edge with a -3% lift keeps the hair line inside the window at every progress (hair top = 3% of the photo:
   .03 x 1.06 - .03 >= 0) and the face where it was (eyes 27-33%, mouth 42-50%, x <= 74.4%); the settle still reads as a gentle zoom-out. */
const PORTRAIT_FROM = { scale: 1.06, yPercent: -3 };                // core M16 = { scale: 1.2, yPercent: -40 }
const PORTRAIT_ORIGIN = "50% 0%";                                   // core M16 = centre
const PORTRAIT_END = "top 25%";                                     // core M16 = "bottom top"

export default function init(ctx = {}) {
    const root = document.getElementById("s-10-hosts");
    if (!root) return null;                                        // section absent -> nothing to do (file contract)
    if (root.dataset.init) return { root };                        // idempotent
    root.dataset.init = "hosts";

    const stage = root.querySelector(".hosts__stage");
    const photo = stage && stage.querySelector(".hosts__portrait img");
    const col1 = photo && photo.closest(".js-image-anime");

    initSplitTitles(root);                                         // PS:340-359 (runs after document.fonts.ready - onReady guarantees it)
    initReveals(root);                                             // PS:554-568
    initStamps(root);                                              // PS:992-1006
    const coreWasFirst = col1 ? !claim(col1, "anime") : false;     // keep core's 1.2 / -40 tween off the host portrait
    initImageAnime(root);                                          // PS:1031-1046 (column 2 only - column 1 is claimed)
    if (photo) initPortraitZoom(ctx, col1, photo, coreWasFirst);

    if (stage) {
        initPodcastPhoto(stage, photo, ctx);
        initIdlePause(stage);
    }
    return { root, stage };
}

/* same data-init token scheme as core.js mark(): returns false when the token was already there */
function claim(el, key) {
    const have = (el.dataset.init || "").split(" ").filter(Boolean);
    if (have.includes(key)) return false;
    have.push(key);
    el.dataset.init = have.join(" ");
    return true;
}

/* M16 with the reduced start values and the early end - trigger / start / scrub / refreshPriority copied from core.initImageAnime (PS:1031-1046) */
function initPortraitZoom(ctx, wrapper, img, coreWasFirst) {
    const gsap = ctx.gsap || window.gsap;
    const ScrollTrigger = ctx.ScrollTrigger || window.ScrollTrigger;
    const reduce = "reduceMotion" in ctx ? ctx.reduceMotion : window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!gsap || !ScrollTrigger || !wrapper) return;
    img.removeAttribute("loading");                                // PS:143-145
    if (coreWasFirst) {                                            // the sweep ran before this module: drop its close-up tween on the photo
        ScrollTrigger.getAll().forEach((st) => {
            const a = st.animation;
            if (a && a.targets && a.targets().includes(img)) { st.kill(); a.kill(); }
        });
        gsap.set(img, { clearProps: "transform" });
    }
    if (reduce) return;                                            // DD Pick 19: no scrubbed trigger under reduced motion
    const strips = document.querySelectorAll(".strip");
    const strip = wrapper.closest(".strip");
    const priority = 1000 - 10 * Math.max(0, Array.prototype.indexOf.call(strips, strip));   // core stripPriority (PS:1042)
    gsap.set(img, { transformOrigin: PORTRAIT_ORIGIN });
    gsap.from(img, {
        scale: PORTRAIT_FROM.scale, yPercent: PORTRAIT_FROM.yPercent,
        scrollTrigger: {
            trigger: wrapper,                                       // PS:1039
            start: () => `top ${Math.min((wrapper.getBoundingClientRect().top + window.pageYOffset) / window.innerHeight * 100, 100)}%`,   // PS:1040
            end: () => PORTRAIT_END,                                // exception (2) - PS:1041 has "bottom top"
            refreshPriority: priority,                              // PS:1042
            scrub: 1                                                // PS:1043
        }
    });
}

/* drop-in slot: empty attribute = no request; a path = probe, then swap (never a console error: a failed probe is handled here) */
function initPodcastPhoto(stage, photo, ctx) {
    const src = (stage.dataset.podcastPhoto || "").trim();
    if (!src || !photo) return;
    const probe = new Image();
    probe.onload = () => {
        if (!probe.naturalWidth) return;
        photo.src = src;
        photo.width = probe.naturalWidth;                           // the CSS locks the 4:5 window, these only keep the attributes truthful
        photo.height = probe.naturalHeight;
        const focus = (stage.dataset.podcastFocus || "").trim();
        if (focus) stage.style.setProperty("--hosts-focus", focus);
        stage.classList.add("hosts__stage--photo");
        if (ctx.refresh) ctx.refresh();
    };
    probe.onerror = () => { stage.dataset.podcastPhotoMissing = "true"; };
    probe.src = src;
}

/* pause the overlay loops while the figure is out of view */
function initIdlePause(stage) {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => stage.classList.toggle("hosts__stage--idle", !e.isIntersecting));
    }, { rootMargin: "80px 0px" });
    io.observe(stage);
}

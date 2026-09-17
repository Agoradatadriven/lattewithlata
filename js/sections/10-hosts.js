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
   ========================================================================== */
import { initSplitTitles, initReveals, initStamps, initImageAnime } from "../core.js";

export default function init(ctx = {}) {
    const root = document.getElementById("s-10-hosts");
    if (!root) return null;                                        // section absent -> nothing to do (file contract)
    if (root.dataset.init) return { root };                        // idempotent
    root.dataset.init = "hosts";

    initSplitTitles(root);                                         // PS:340-359 (runs after document.fonts.ready - onReady guarantees it)
    initReveals(root);                                             // PS:554-568
    initStamps(root);                                              // PS:992-1006
    initImageAnime(root);                                          // PS:1031-1046

    return { root };
}

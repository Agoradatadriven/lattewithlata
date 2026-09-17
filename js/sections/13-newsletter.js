/* ==========================================================================
   13-newsletter - arrow swap on the square submit (BUILD-SPEC M25), floating label, submit handling
   Engine ported from IC = teardowns/2026-09-14-icebergdoc-org/source/js/ZNMh4Fg5.beautified.js:909-935
   (Vue footer-newsletter component: paused gsap timeline restarted on mouseenter AND mouseleave).
   Floating label: the source toggled .is-focused / .has-value through Vue state (inline-scoped.beautified.css:3212-3218);
   submit: the source posted to Google Forms with mode "no-cors" (ZNMh4Fg5:893-896) - NOT copied (DD Pick 12 "Change").
   ctx = { gsap, ScrollTrigger, SplitText, reduceMotion, isTouch, isMouse, mm, refresh, initCarousel }
   ========================================================================== */
export default function init(ctx) {
    const root = document.getElementById("s-13-newsletter");
    if (!root) return;
    const { gsap, reduceMotion } = ctx;

    const form = root.querySelector(".newsletter__form");
    const field = root.querySelector(".newsletter__field");
    const input = root.querySelector(".newsletter__input");
    const consent = root.querySelector("#nl-consent");
    const button = root.querySelector(".newsletter__submit");
    const errorEl = root.querySelector(".newsletter__error");
    const successEl = root.querySelector(".newsletter__success");

    /* ---- M25 arrow swap - IC:917-934 ---- */
    if (button && !reduceMotion) {                                   // DD Pick 19: skip the decorative timeline under reduced motion
        const span1 = button.querySelector("span:nth-child(1)");     // IC:919  e.selector("... span:nth-child(1)")
        const span2 = button.querySelector("span:nth-child(2)");     // IC:927  e.selector("... span:nth-child(2)")
        if (span1 && span2) {
            const tl = gsap.timeline({ paused: true })               // IC:917-918  _.timeline({ paused: !0 })
                .fromTo(span1, { xPercent: 0, opacity: 1 }, {        // IC:919-921
                    xPercent: 50, opacity: 0,                        // IC:923-924
                    duration: .3, ease: "power2.inOut"               // IC:925-926
                })
                .fromTo(span2, { xPercent: -50, opacity: 0 }, {      // IC:927-929
                    xPercent: 0, opacity: 1,                         // IC:931-932
                    duration: .3, ease: "power2.inOut"               // IC:933-934
                }, "<");                                             // IC:934  "<"
            button.addEventListener("mouseenter", () => tl.restart());   // IC:909-911  b = () => w.value.restart()
            button.addEventListener("mouseleave", () => tl.restart());   // IC:912-914  x = () => w.value.restart()
            button.addEventListener("focus", () => tl.restart());        // keyboard parity - INFERRED (DD s7 Accessibility)
        }
    }

    /* ---- floating label - .is-focused on focus/blur, .has-value on input (source: Vue state, inline-scoped:3212) ---- */
    if (field && input) {
        const sync = () => field.classList.toggle("has-value", input.value.trim().length > 0);
        input.addEventListener("focus", () => field.classList.add("is-focused"));
        input.addEventListener("blur", () => { field.classList.remove("is-focused"); sync(); });
        input.addEventListener("input", () => { sync(); field.classList.remove("is-error"); hide(errorEl); });
        input.addEventListener("change", sync);
        sync();                                                      // autofill / bfcache restore
        window.addEventListener("pageshow", sync, { once: true });
    }

    /* ---- submit: validate (real <label>s, visible error text - copy.md), post to the site's own endpoint ---- */
    if (form && input) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            hide(errorEl); hide(successEl);
            const emailOk = input.value.trim().length > 0 && input.validity.valid;
            const consentOk = !consent || consent.checked;
            if (!emailOk || !consentOk) {
                field && field.classList.add("is-error");
                show(errorEl, form.dataset.error || "That address did not go through. Check it and try once more.");
                (emailOk ? consent : input).focus();
                return;
            }
            const action = (form.getAttribute("action") || "").trim();
            button && (button.disabled = true);
            try {
                if (action && action !== "#") {                      // placeholder endpoint "#" (newsletter.endpoint) -> no network call
                    const res = await fetch(action, { method: (form.getAttribute("method") || "post").toUpperCase(), body: new FormData(form) });
                    if (!res.ok) throw new Error("HTTP " + res.status);
                }
                show(successEl, form.dataset.success || "You are on the list. See you Thursday.", true);
                form.reset();
                field && field.classList.remove("has-value", "is-error");
            } catch (err) {
                field && field.classList.add("is-error");
                show(errorEl, form.dataset.error || "That address did not go through. Check it and try once more.");
            } finally {
                button && (button.disabled = false);
            }
        });
    }

    function show(el, text, withCheck) {
        if (!el) return;
        el.textContent = "";
        if (withCheck) {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("class", "icon");
            svg.setAttribute("aria-hidden", "true");
            const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
            use.setAttribute("href", "assets/svg/icons.svg#i-check");
            svg.appendChild(use);
            el.appendChild(svg);
        }
        el.appendChild(document.createTextNode(text));
        el.hidden = false;
    }
    function hide(el) { if (el) { el.hidden = true; } }
}

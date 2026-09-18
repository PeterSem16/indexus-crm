---
name: Pulse fullscreen modal verification
description: Why approved canvas designs need real-component fullscreen browser tests.
---

Verify graduated Pulse modals using the production component, production CSS, and the fullscreen ancestor attribute, not only the canvas or an unauthenticated login screenshot.

Assert key computed visual properties as well as interaction and viewport bounds for approved modal designs. Measure bounds only after entrance animations settle.

**Why:** Successful click tests can still hide a shared-dialog utility overriding the intended width, rounding, padding, or backdrop under lazy CSS loading. An in-progress entrance animation can also produce a false mobile overflow failure.

**How to apply:** Include the approved width, surface color, rounding, and backdrop in the real-component verification; do not treat a passing interaction test alone as visual parity.

**Why:** Broad fullscreen header hiding removed the Priority Builder title and Add group control while the standalone canvas looked correct. Dialog defaults and unconstrained button widths also changed the approved layout.

**How to apply:** Exercise visible controls and preset hydration with intercepted API data in a test-only fixture, and verify desktop/mobile bounds. Distinguish fixture verification from inspection of a user's actual live callback.

Preserve the approved canvas source during graduation. If a user says the design differs, inspect its history before asserting that the current canvas file is the approved reference.

**Why:** The original Priority Builder had a dark INDEXUS sidebar, colored groups and a detailed live-result panel. Its backing mockup was overwritten with a simpler pink modal during implementation, so comparisons to the current mockup falsely appeared to confirm fidelity.

**How to apply:** Keep the original reference unchanged; compare rendered images at the same viewport and distinguish original, current canvas, and application screenshots explicitly.

Bounded picker tests need both minimum readable height and maximum viewport bounds, with a realistically large populated list.

**Why:** flex shrinking can reduce hundreds of options to a single visible row while every overflow/within-modal assertion still passes.

**How to apply:** inspect the populated state, verify multiple visible rows, scroll to the final option, and keep Save and close controls reachable on mobile as well as desktop.

Graduation must preserve the entire approved shell, not merely add search and sorting to the legacy modal.

**Why:** Functionally correct toolbar changes still left the wrong palette, dimensions, filter hierarchy and rows. Checking navigation alone missed that the user was seeing an unapproved design; an empty Calls tab also concealed pending messages.

**How to apply:** Compare populated and genuinely empty production dialogs to the unchanged approved reference. Use real App/provider tests with intercepted APIs, check cross-channel defaults, and inspect screenshots for occlusion: an element can pass isVisible while a high-z-index preview notice covers its title.
---
name: Pulse fullscreen modal verification
description: Why approved canvas designs need real-component fullscreen browser tests.
---

Verify graduated Pulse modals using the production component, production CSS, and the fullscreen ancestor attribute, not only the canvas or an unauthenticated login screenshot.

**Why:** Broad fullscreen header hiding removed the Priority Builder title and Add group control while the standalone canvas looked correct. Dialog defaults and unconstrained button widths also changed the approved layout.

**How to apply:** Exercise visible controls and preset hydration with intercepted API data in a test-only fixture, and verify desktop/mobile bounds. Distinguish fixture verification from inspection of a user's actual live callback.

Preserve the approved canvas source during graduation. If a user says the design differs, inspect its history before asserting that the current canvas file is the approved reference.

**Why:** The original Priority Builder had a dark INDEXUS sidebar, colored groups and a detailed live-result panel. Its backing mockup was overwritten with a simpler pink modal during implementation, so comparisons to the current mockup falsely appeared to confirm fidelity.

**How to apply:** Keep the original reference unchanged; compare rendered images at the same viewport and distinguish original, current canvas, and application screenshots explicitly.
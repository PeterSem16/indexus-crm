---
name: Pulse fullscreen modal verification
description: Why approved canvas designs need real-component fullscreen browser tests.
---

Verify graduated Pulse modals using the production component, production CSS, and the fullscreen ancestor attribute, not only the canvas or an unauthenticated login screenshot.

**Why:** Broad fullscreen header hiding removed the Priority Builder title and Add group control while the standalone canvas looked correct. Dialog defaults and unconstrained button widths also changed the approved layout.

**How to apply:** Exercise visible controls and preset hydration with intercepted API data in a test-only fixture, and verify desktop/mobile bounds. Distinguish fixture verification from inspection of a user's actual live callback.
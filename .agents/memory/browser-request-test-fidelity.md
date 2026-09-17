---
name: Browser request test fidelity
description: Why fetch instrumentation must not alter native browser invocation semantics.
---

Keep native browser request behavior in at least one end-to-end test. A debugging arrow-function wrapper around `window.fetch` can mask a receiver-binding error in a class that stores fetch as a member.

**Why:** a writer failed with the native browser request implementation but started working under logging instrumentation; Node-side request mocks did not reproduce the browser constraint.

**How to apply:** remove debugging fetch wrappers before trusting browser test results. Test request injection with an implementation that verifies its receiver, and mock HTTP responses at the browser routing layer instead.
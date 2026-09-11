---
name: Mockup preview first-load timing
description: Avoid treating a transient blank isolated-mockup preview as a component failure immediately after its Vite server restarts.
---

An isolated mockup preview can briefly render an empty frame while its dynamic component module is loading immediately after a Vite restart, even when the component is valid.

**Why:** The sandbox's preview renderer starts without a selected component and resolves the requested component asynchronously.

**How to apply:** Before changing a design iframe to a failed state, repeat the preview check after the module has loaded and inspect the browser DOM or console when available. Mark it failed only if the retry still reports a real rendering or import error.
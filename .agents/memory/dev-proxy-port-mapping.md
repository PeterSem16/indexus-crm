---
name: Dev proxy port mapping
description: Replit development URL 502 despite a healthy app process and workflow.
---

When the development URL returns an immediate 502 but the app answers on its container IP, inspect the external port 80 mapping before changing application code. The webview workflow can report its expected port open while the dev domain still routes to a different, inactive local port.

**Why:** A stale secondary port mapping shadowed the active web server; restarting the workflow did not repair the route.

**How to apply:** Compare the actual listening port, workflow port, and `.replit` external port 80 target. Point port 80 at the active webview listener and remove only the stale conflicting mapping.
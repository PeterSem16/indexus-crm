---
name: Canvas redesign source fidelity
description: Source-of-truth rule for visual redesigns of existing Agent Workspace surfaces.
---

When redesigning an existing CRM window on Canvas, use the production component or a user-provided screenshot of the live UI as the source. Earlier `pulse-unified-*`, `pulse-faithful-*`, `Current`, and other proposal/extraction files are not authoritative unless verified against the live UI.

**Why:** The live Agent Workspace Queue is the full-screen **Scheduled queue** (time/type sidebar, sortable contact table, Only assigned, row actions), not the separate Mission contacts/Referral surface. Proposal-on-proposal redesigns repeatedly targeted the wrong window.

**How to apply:** For Queue work, verify against the Scheduled queue implementation and latest live screenshot. Inventory every visible control/state, then redesign without changing the information architecture. Compare the result against the screenshot before presenting it.
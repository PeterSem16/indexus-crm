---
name: Pulse gate escape
description: Product rule for mandatory NEXUS Pulse readiness checks.
---

The NEXUS Pulse readiness check may block Agent Workspace, but it must never trap the user; always provide a clear route back to the normal authenticated INDEXUS interface.

**Why:** The user explicitly confirmed the mandatory readiness approach, then identified that a failed check without an exit leaves agents stuck. The audience benefits from friendly, visually guided diagnostics rather than a technical checklist.

**How to apply:** Keep critical checks mandatory for entering Pulse, preserve a non-bypass return action to INDEXUS, and favor simple visual states and reassuring copy for all supported locales.
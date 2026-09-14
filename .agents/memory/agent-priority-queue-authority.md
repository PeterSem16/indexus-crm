---
name: Agent priority queue authority
description: Rules for personal Nexus Pulse contact ordering and protected built-in presets.
---

Apply a saved personal priority view only after campaign assignment and eligibility filters. The resulting first-match queue, including an unmatched eligible fallback, is authoritative for the desktop sidebar, mobile contacts, Auto, and Next.

**Why:** Applying the view directly to all pending contacts can expose contacts excluded by per-agent campaign rules, while separate queue consumers make displayed order differ from actual dialing order.

**How to apply:** Derive one eligible input pool, then one ordered queue shared by every contact-selection path. Search may inspect the complete eligible pool for direct access. Validate built-in preset IDs against canonical server-owned definitions.
---
name: Canvas redesign source fidelity
description: Source-of-truth rule for visual redesigns of existing Agent Workspace surfaces.
---

When redesigning an existing CRM window on Canvas, use the production component or its verified extracted `Current` copy as the source. Earlier `pulse-unified-*`, `pulse-faithful-*`, and other proposal files are not originals and must not be used as the baseline.

**Why:** Proposal-on-proposal redesigns preserved invented structures instead of the real Queue and PriorityBuilder controls, causing repeated mismatch with the user's request to change only the visual design.

**How to apply:** First identify the production mount and component, inventory every visible control and state, then create a separate visual variant that preserves that inventory. Compare the finished variant against the production source before presenting it.
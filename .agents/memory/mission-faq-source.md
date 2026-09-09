---
name: Mission FAQ source
description: Rules for sharing, defaulting, and safely saving Mission FAQ data.
---

Mission FAQ has one campaign-aware read contract across the settings editor and every agent-facing panel. An absent `faq` property uses the localized legacy defaults, while an explicitly saved empty array means intentionally empty and must never restore defaults.

**Why:** The original agent panel rendered hard-coded localized questions while the Mission editor used campaign settings, so edits were invisible and original questions could not be managed. Submitting a stale full settings snapshot could also revert unrelated concurrent Mission changes.

**How to apply:** Preserve FAQ categories during normalization. Save through a manager-authorized FAQ-specific endpoint that atomically updates only the FAQ property against current server state. Invalidate campaign detail, list, and assigned-campaign caches after saving.
---
name: Call player visibility
description: User-rejected player clipping and the required short-window verification.
---

Do not constrain Calls & Transcripts to a small fixed-height detail viewport just to keep both columns on screen. The entire player, waveform, lower controls, and transcript must remain reachable; a deep list selection must reveal the selected player without requiring a manual return to the top.

**Why:** The user rejected the bounded two-pane layout because it cut off the player on a short desktop window. Tests passed by checking partial intersection and the play button, missing the inaccessible lower content.

**How to apply:** Preserve natural detail height and independent list scrolling. Verify the complete player rectangle against the viewport and every clipping ancestor at a short desktop height, not merely a visible play button or a partially intersecting container. Also verify reaching the transcript and selecting another deep-list call after scrolling. Account for the recording loading asynchronously.

Manager call-review cards must leave playback and seek controls accessible on desktop; dock the review beside the naturally sized player rather than placing a sheet over its controls. Keep the current contact/status-list state distinct from the changes captured for the particular call.

**Why:** Quality review happens while listening, and a sheet covered the player's controls even though audio continued. Current status can change after the call, so it is not evidence of what the agent entered during that recording.

**How to apply:** When adding call-review information, retain the call-specific checklist snapshot separately, label live status as current, and check a short desktop viewport as well as a narrow desktop width.
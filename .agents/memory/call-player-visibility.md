---
name: Call player visibility
description: User-rejected player clipping and the required short-window verification.
---

Do not constrain Calls & Transcripts to a small fixed-height detail viewport just to keep both columns on screen. The entire player, waveform, lower controls, and transcript must remain reachable; a deep list selection must reveal the selected player without requiring a manual return to the top.

**Why:** The user rejected the bounded two-pane layout because it cut off the player on a short desktop window. Tests passed by checking partial intersection and the play button, missing the inaccessible lower content.

**How to apply:** Preserve natural detail height and independent list scrolling. Verify the complete player rectangle against the viewport and every clipping ancestor at a short desktop height, not merely a visible play button or a partially intersecting container. Also verify reaching the transcript and selecting another deep-list call after scrolling. Account for the recording loading asynchronously.
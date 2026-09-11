---
name: Nexus Pulse notification boundary
description: Which Nexus Pulse notifications use the Focused Status presentation and chime.
---

All ordinary Nexus Pulse workflow confirmations, warnings, and errors use the Focused Status notification presentation with the short Pulse chime. This includes actions taken in Agent Workspace and its embedded contact forms, plus normal softphone outcomes such as setup, dialing, and unanswered calls.

Active-call diagnostics must retain the existing visual presentation and remain silent: audio playback, microphone-device changes, media/RTP/network health, and hold-signaling failures.

**Why:** The user explicitly approved one consistent visual system for normal operational feedback, while preserving the familiar unobtrusive treatment of real-time call-quality diagnostics.

**How to apply:** When adding a Pulse notice, classify whether it describes an agent workflow outcome or a live-call technical health condition. Use Focused Status only for the first category; keep the second category on the legacy diagnostic path.
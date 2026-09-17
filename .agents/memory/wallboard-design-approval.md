---
name: Wallboard design approval
description: User-approved visual direction for the Mission wallboard.
---
The user liked the dark, high-contrast wallboard design with large agent-state cards and separate single-Mission and all-Missions scopes.

**Why:** the user explicitly confirmed this visual direction; future implementation should not restart design exploration without a new request.

**How to apply:** preserve this visual direction when extending the implemented Wallboard. The user subsequently authorized implementation; the original canvas concept remains a visual reference.

For projected Wallboards, disclose agent identity and operational state, but not contact identities or telephone numbers. A queue shared by multiple Missions is not sufficient evidence that a call belongs to the selected Mission.

**Why:** the display is intended for a room-sized audience, and broad queue or campaign-assignment fallbacks can expose unrelated Mission data.

**How to apply:** require exact call attribution and current shift membership; omit ambiguous calls. Card-work presence is an expiring UI hint only, never authority for telephony or recording.
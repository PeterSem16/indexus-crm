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

Wallboard Mission time means logged-in session participation, including breaks, not productive work or foreground time in a particular contact. For a multi-Mission session, participation applies to its selected Missions; the all-Missions total must union overlapping intervals rather than add per-Mission totals.

**Why:** session membership does not provide a historical Mission-switch ledger, so it cannot support claims of precise foreground time per Mission. The requested metric is time logged into Mission.

**How to apply:** clip totals to the Bratislava calendar day. Keep ended sessions historical/offline, never live. A disconnected unclosed session can provide only its last recorded activity, not an exact disconnect timestamp; stop estimated accrual there rather than letting abandoned sessions accrue indefinitely.

Personal alarm history represents an open browser's observations, not a central incident monitor. Lost telemetry, sleeping browsers, and missing final writes cannot prove that an alarm recovered.

**Why:** supervisors asked for retrospective observations without authorizing background monitoring. Extending durations beyond confirmed observation would misrepresent coverage.

**How to apply:** preserve the distinction between recovery and observation stopping in future reports/exports. Historical aggregate Mission access must be checked against current permissions, not merely the permissions at collection time.
---
name: Wallboard alarm boundaries
description: Product boundaries and verification lessons for supervisor wallboard alarms.
---
Wallboard alarm configuration is a viewer's personal monitoring preference, not a shared Mission policy. Being allowed to view a wallboard can therefore permit editing one's own alarms without permitting edits to that Mission.

**Why:** one supervisor's display settings must not change another supervisor's alarms or relax operational Mission permissions.

**How to apply:** retain both viewer ownership and authorized wallboard scope when adding configuration features. Browser sound permission and incident acknowledgement are not shared server notification settings.

Unknown telemetry is not evidence of inactivity. A queue with ambiguous Mission attribution must not be treated as an empty queue merely to keep alarms evaluating.

**Why:** otherwise an unavailable or deliberately omitted source generates convincing but false operational alarms.

**How to apply:** suspend dependent rules when evidence is missing, while letting independently reliable sources continue.

Alarm verification must cover the event lifecycle in the actual data query and the specific field control in the editor, not only the evaluator's synthetic snapshot.

**Why:** active-only call queries can look correct until a call ends; a broad assertion for any seconds/minutes selector can pass because the delay field has units while the threshold field is wrong.

**How to apply:** exercise ended-call history and canonical threshold persistence. Render dialog tests with the real application utility stylesheet so fixed positioning and scroll limits are actually tested.
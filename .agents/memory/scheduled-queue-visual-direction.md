---
name: Scheduled queue visual direction
description: Approved visual and interaction direction for the Scheduled queue redesign.
---

Use a compact, modern agenda-card layout in the same blue tonal system as the CRM’s other modal windows. Avoid green as the dominant palette.

The rescheduler must present date and time separately, show current and proposed values clearly, and offer quick date choices that skip weekends. Custom date selection must not accept Saturday or Sunday. Preset time chips are shortcuts only; agents must also be able to enter any exact time through a design-matched 24-hour hour/minute control. Do not use the browser-native time picker.

Queue actions must distinguish campaign-contact, contact-session, and inbound-callback records before rescheduling or cancelling. Schedule display, weekday checks, future-time validation, and UTC conversion must all use Europe/Bratislava wall time.

**Why:** The user rejected green styling as inconsistent with the established modal system and found the old scheduling control unclear. Different queue sources use different mutation targets, and browser-local time can move appointments to a different day or hour.

**How to apply:** Preserve all existing queue data, badges, filters, sorting, and actions while implementing or refining the selected agenda-card design. Route mutations by the row’s authoritative source and validate the final Bratislava instant immediately before saving.
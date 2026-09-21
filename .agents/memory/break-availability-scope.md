---
name: Break availability scope
description: Defines how configurable agent breaks are matched to Nexus Pulse shift scope.
---

A break type with no assigned Missions or inbound queues is global. Once any scope is assigned, it is available when the active shift contains at least one assigned Mission **or** one assigned inbound queue.

**Why:** Agents can log into multiple Missions and inbound queues in one shift. Requiring every selected scope to match would incorrectly hide breaks intended for any one of those work areas.

**How to apply:** Filter the displayed break list by the active shift and enforce the same rule server-side when starting a break. Keep stored icon and color authoritative in desktop and mobile menus.
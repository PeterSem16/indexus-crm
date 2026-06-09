---
name: Queue cache invalidation
description: Reschedule/cancel in ScheduledQueuePanel must invalidate by the item's own campaign ID, not the page-level selectedCampaignId.
---

## Rule
In ScheduledQueuePanel reschedule and cancel handlers, always invalidate:
- `["/api/agent/scheduled-queue"]` — always
- `["/api/campaigns", campaignId, "contacts"]` — use `campaignId` param (reschedule) or `item.campaignId` (cancel), NOT the outer `selectedCampaignId` closure

**Why:** `selectedCampaignId` is the campaign currently selected in the left panel. When the queue modal shows items from OTHER campaigns (agent scheduled callbacks from past sessions), invalidating by `selectedCampaignId` silently fails to refresh the correct campaign contacts list.

## Inbound callbacks routing
For items with `isOutsideMission: true` and `inboundCallbackId`:
- Reschedule → `PATCH /api/agent/inbound-callbacks/:id` with `{ callbackDate: newDate }`
- Cancel → `DELETE /api/agent/inbound-callbacks/:id`
- Invalidate `["/api/agent/inbound-callbacks"]` and `["/api/agent/scheduled-queue"]`

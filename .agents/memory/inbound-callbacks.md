---
name: Inbound callbacks (Mimo misie)
description: Out-of-mission inbound callbacks — created when an inbound caller is not in any campaign contact list and agent schedules a callback during disposition.
---

## Rule
When `handleDisposition` fires with:
- `!effectiveCampaignContactId` (no campaign contact match)
- `wasInboundCallRef.current === true` (was an inbound call)
- `callbackDateTime` set

→ POST to `/api/agent/inbound-callbacks` to create a callback record.

**Why:** Inbound callers not in any campaign miss the normal disposition mutation path (`if (effectiveCampaignContactId && effectiveCampaignId)`). Without this, the callback is lost.

## Data model
Table: `inbound_callbacks` — fields: id, userId, assignedTo, customerId, phone, name, campaignId, callbackDate, notes, calledBack, createdAt.

## Frontend
- `InboundCb` interface in agent-workspace.tsx (near `ScheduledItem`)
- `agentInboundCallbacks` query: `/api/agent/inbound-callbacks`, 30s poll
- Left panel: "Mimo misie" collapsible group in TaskListPanel (outside `selectedCampaignId` block)
- Queue modal: items appear with `isOutsideMission: true`, orange "Mimo misie" badge in campaign column
- Mark done: PATCH `calledBack: true` via ✓ button in left panel or cancel in queue modal

## Backend
- `GET /api/agent/inbound-callbacks` — returns non-called-back for userId/assignedTo
- `POST /api/agent/inbound-callbacks` — create
- `PATCH /api/agent/inbound-callbacks/:id` — update (callbackDate, notes, calledBack, assignedTo)
- `DELETE /api/agent/inbound-callbacks/:id` — delete
- `/api/agent/scheduled-queue` merges inbound callbacks with `isOutsideMission: true` and `inboundCallbackId`

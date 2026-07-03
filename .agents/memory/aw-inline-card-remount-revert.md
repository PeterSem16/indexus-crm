---
name: Agent-workspace inline card save reverts on remount
description: Why a just-saved clinic/customer field visually disappears in the agent-workspace contact card even though the server persisted it, and how unread badges / history dedup must work.
---

# Inline entity edit card in agent-workspace: saved value reverts on remount

The inline clinic/hospital/collaborator/customer edit card only renders while
`phoneSubTab === "card"`. Switching subtab or channel UNMOUNTS it; returning
REMOUNTS it and rebuilds the form from the parent's state object
(`currentClinicData` / `currentHospitalData` / `currentCollaboratorData` for
entities, `currentContact` for customers).

**The trap:** the server DOES persist the edit (e.g. clinic `email2`/`email3` via
`db.update(clinics).set(body)`), but the inline `onSuccess` originally only pushed
`phone` back up. So the parent state stayed stale, and on the next remount the form
rebuilt from stale data → the just-saved value "vanishes" and the user concludes it
didn't save.

**Rule:** after ANY inline save in the contact card, refetch the entity and push the
fresh object back into the parent state that feeds the card. Entities use a
`onEntityRefetched(type, data)` callback → `setCurrentClinicData/...` + merge into
`currentContact`. Customers do the same inside `updateContactMutation.onSuccess`
(refetch `/api/customers/:id`, `setCurrentContact({...prev, ...fresh})`).
When merging individual fields into `currentContact`, use
`data.x !== undefined ? data.x : prev.x` (NOT `??`) so a CLEARED field (server
returns `null`) actually propagates as cleared instead of keeping the stale value.

**Why:** email/phone pickers in compose read from `currentContact` + the entity data
props; stale parent state both reverts the form and shows deleted emails as
selectable recipients.

## Related contact-card behaviors (same file)

- **Compose recipient list:** build the TO checkbox list from a deduped union of
  `contact.email/email2/email3` + entity data emails; the clinic `virtualCustomer`
  mapping must include `email2`/`email3` or they never appear.
- **History duplicate bubbles:** optimistic timeline entries (ids `email-<ts>`/
  `sms-<ts>`) never reconcile with persisted history (`msg-<id>`) by id. Dedup by
  matching an optimistic email/sms to a persisted twin with same type+direction and
  normalized-content within ~10min, then collapse near-identical persisted dupes in
  small (~15-30s) time buckets. Include recipient in the key to protect multi-send.
- **Unread EMAIL/SMS badges:** read-state (`readEmailIds`/`readSmsIds`) must be
  persisted in localStorage keyed by `user+channel+contact` and reloaded on contact
  change; otherwise every reopen resets to empty and the badge counts ALL inbound as
  unread. Mark-read (merge + persist) happens when the agent opens that channel tab.
- **Card close ("X") must also drop the task:** the card header close calls
  `onClearContact`, which originally only nulled the contact — leaving the entry in
  the Tasks list and `activeTaskId` set. It must ALSO remove the active task from
  `tasks` (filter by `activeTaskId`) and clear `activeTaskId`/notes/timeline/phone
  override, mirroring `handleCancelTask`. Both ContactCard render sites (mobile +
  desktop) share the same inline handler — keep them in sync.
- **SMS recipient list = same union as email:** build the "To" checkboxes from a
  deduped union of the contact's phones + entity-data phones. Field names differ per
  entity: clinics/hospitals use phone/phone2/phone3; collaborators/customers use
  phone/mobile/mobile2.
- **"My Shift" feed = one combined list keyed by `itemType`:** the panel
  (MyActivityPanel) renders a single array from `GET /api/agent/today-activity`
  discriminated by `itemType` (call/email/sms/break/session). To add a category you
  must touch BOTH ends: push the new items into the endpoint's `combined` array AND
  add a matching filter + render branch in MyActivityPanel. Session (login/logout)
  items come from `agent_sessions` (startedAt/endedAt); active-session duration is
  computed client-side from `Date.now()` since the panel refetches every 30s.

---
name: Status-list ccId null for outbound
description: Why outbound calls can't save status-list state, and how to fix the red end-call button on the checklist tab
---

## Problem
`effectiveCampaignContactId` returns null for outbound calls when the contact was loaded via inbound lookup or manual search (not via `handleSelectCampaignContact`). In those cases `currentContactType` stays `"customer"` (the default), so the primary lookup checks `cc.customerId` — but if the campaign contact is a hospital/clinic/collaborator, that field is null and the lookup fails.

## Fix
After the primary type-based lookup, add a fallback that tries all four fields:
```ts
if (!matched) {
  matched = rawCampaignContacts.find((cc: any) =>
    String(cc.hospitalId) === contactIdStr ||
    String(cc.clinicId)    === contactIdStr ||
    String(cc.collaboratorId) === contactIdStr ||
    String(cc.customerId)  === contactIdStr
  );
}
```

**Why:** `currentContactType` is only set by `handleSelectCampaignContact` (campaign panel click). Inbound lookup via `setupCallContext` for customer type, and manual search contact loads, leave it as `"customer"` even for hospital entities.

## End-call button on checklist tab
The compact header call-state buttons (`isActive`, `isConnecting`) were `disabled` — agents on the checklist tab had no way to end an active/connecting call. 

**Fix:** keep the disabled status indicator, but add a separate red `PhoneOff` icon button next to it that calls `onEndCall?.()`. Both `isActive` and `isConnecting` cases get this treatment.

## Warning banner
When `campaignContactId` is null but `dbStatusList.length > 0`, show an amber `AlertTriangle` banner in the checklist tab header area:
> "Tento kontakt nie je prepojený s touto kampaňou. Uloženie stavu nie je k dispozícii."

Handlers `handleSlRunAction` / `handleSlOptionSelect` silently return on null ccId (no toast — the banner already communicates the state).

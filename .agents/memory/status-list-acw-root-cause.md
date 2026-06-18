---
name: Status-list ACW root cause
description: Why ACW banner never appeared for outbound/all calls in status_list mode; three-part fix.
---

# Status-list ACW — Root Cause & Fix

## Root Cause 1: preventAutoReset blocks idle timer
When `agentSession.isSessionActive = true` (agent is logged into a shift), a useEffect at line ~7417 calls `callContext.setPreventAutoReset(true)`. In sip-phone.tsx, the 3-second timer that transitions `callState: "ended" → "idle"` is gated on `!preventAutoReset`. So the timer never fires, `callState` stays "ended", `hasCall = true`, and the ACW banner (condition: `acwStartedAt && !hasCall`) never shows.

**Fix**: Change ACW banner condition to:
```jsx
{acwStartedAt && !["active", "ringing", "connecting", "on_hold"].includes(callState) && (
```
This shows the banner even when `callState === "ended"`.

## Root Cause 2: setAcwStartedAt gated behind isInboundCall || currentCampaignContactId
`campSettings` parsing and `setAcwStartedAt` were nested inside:
```js
if (isInboundCall || (currentContact && currentCampaignContactId)) { ... }
```
For outbound calls where `isInboundCall = false` and `currentCampaignContactId` is null, the inner condition is false → ACW never starts.

**Fix**: Hoist `campSettings` out and make status_list check the first branch:
```js
const campSettings = ...;
if (campSettings.workflowMode === "status_list") {
  setAcwStartedAt(Date.now());
} else if (isInboundCall || (currentContact && currentCampaignContactId)) {
  // normal disposition
}
```

## Root Cause 3: SIP state stuck at "ended" when agent clicks "Ukončiť task"
Since `preventAutoReset = true` blocks the idle timer, `callState` is still "ended" when the agent clicks the ACW close button. `handleCloseAcwTask` cleared the card but left SIP state inconsistent.

**Fix**: Call `callContext.forceResetCallFn.current?.()` at start of `handleCloseAcwTask` when `callState === "ended"`.

## Bonus: Options appearing twice in checklist
`dbVisibleItems` filter included all non-hidden items including options (`itemType === "option"`). Options were also rendered in the MOŽNOSTI panel. Fix: add `&& i.itemType !== "option"` to `dbVisibleItems` filter.

**Why:** `agentSession.isSessionActive` drives `preventAutoReset` for BO mode. Status-list campaigns run inside agent sessions too, so they also get `preventAutoReset = true`. The ACW banner must not depend on `callState === "idle"` because that transition is blocked.

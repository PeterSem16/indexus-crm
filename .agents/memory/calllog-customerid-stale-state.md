---
name: Call-log customerId must come from the ref, not state
description: Why the SIP call log's customerId is written from localCustomerIdRef.current, not localCustomerId state
---

The outbound SipPhone `makeCall` is a no-arg callback that reads
`localCustomerId` **state**, and it is fired from the pendingCall effect via
`setTimeout(makeCall, 100)` — which captures a **stale closure**. The call
log's DB `customerId` is written exactly once, at creation
(`createCallLogMutation`). If that read stale/empty state, the log got the
wrong/null customerId and the contact-history endpoint (which fetches call
logs by customerId) could never find it.

**Rule:** for the SIP call log's `customerId` (both the DB write at creation
and the cache-invalidation param on status updates), use
`localCustomerIdRef.current`, never the `localCustomerId` state.

**Why:** `localCustomerIdRef` is updated synchronously at every set site
(init, identity updater, inbound resolve, pendingCall effect), so it is
always current when the deferred/async mutation actually fires; the state
variable lags behind inside stale closures.

**How to apply:** any new place that persists or attributes a call log — or
any new outbound trigger path — must read the ref. Only canceled calls
exposed this originally, because answered calls still leave a disposition
(campaignContactHistory) entry that shows in history regardless of the call
log's customerId.

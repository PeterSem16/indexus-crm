---
name: Outbound call-log identity must come from refs, not state
description: Why exact-call customer and Mission attribution must use synchronously updated refs during deferred SIP dialing
---

The outbound SipPhone `makeCall` is a no-arg callback that reads
`localCustomerId` **state**, and it is fired from the pendingCall effect via
`setTimeout(makeCall, 100)` — which captures a **stale closure**. The call
log's DB `customerId` is written exactly once, at creation
(`createCallLogMutation`). If that read stale/empty state, the log got the
wrong/null customerId and the contact-history endpoint (which fetches call
logs by customerId) could never find it.

**Rule:** exact-call identity used by deferred outbound dialing must come from
the synchronously updated refs. This includes customer attribution and Mission
attribution; never persist their lagging React state values from `makeCall`.

**Why:** the refs are updated synchronously at every set site, so they are
current when the deferred/async mutation fires. State variables can still
belong to the previous render. A missing customer loses history attribution;
a missing Mission ID also makes trusted Mission recording fail closed even
when the pending-call context contained an active policy snapshot.

**How to apply:** any new place that persists or attributes a call log — or
any new outbound trigger path — must read the ref. Only canceled calls
exposed this originally, because answered calls still leave a disposition
(campaignContactHistory) entry that shows in history regardless of the call
log's customerId.

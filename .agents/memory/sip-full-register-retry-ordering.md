---
name: SIP full-register retry ordering
description: Preventing automatic SIP recovery from silently stopping after a failed full UserAgent rebuild.
---

When a full SIP registration attempt fails, clear the in-flight/connecting guard before scheduling the next retry. A reconnect attempt is successful only after the Registerer reaches `Registered`, not merely when `register()` finishes sending the request. Never rebuild or stop a UserAgent that owns an Established dialog.

**Why:** Scheduling from the registration catch block while the connecting guard was still set caused the scheduler to reject the retry. Rebuilding the UserAgent after a temporary network outage also disposed the still-live call exactly when connectivity returned.

**How to apply:** Defer retry scheduling to post-cleanup/finalization, continue retries with bounded backoff while the session is eligible, cancel pending retries immediately after confirmed registration, and stop them only for an intentional disconnect or offline browser. Recover transport and REGISTER on the existing UserAgent during a call; if its Registerer is terminated, create one identity-guarded replacement on that same UserAgent. Recheck for active dialogs immediately before every automatic stop.
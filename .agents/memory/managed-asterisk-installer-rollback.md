---
name: Managed Asterisk installer rollback
description: Safe rollback ownership and post-reload verification rules for managed Asterisk fragments.
---

A managed Asterisk installer may remove fragment files during rollback only if
the current invocation actually created them. Preflight failures must leave an
existing installation untouched, and post-reload registration visibility is a
warning rather than a rollback trigger.

**Why:** An existing-installation preflight rejection once entered the generic
rollback path and deleted already-managed O2 fragments. A later simulated
repair also showed that registration can be temporarily absent immediately
after reload even when fragment generation and both reloads succeeded.

**How to apply:** Track write ownership explicitly, distinguish repair from
fresh install, and reserve destructive rollback for failed writes/reloads.
Treat immediate registration and informational dialplan checks as nonfatal.

The O2 IMS password must be present inline in the managed PJSIP auth section;
do not rely on a nested password-file include.

**Why:** The primary relative PJSIP include loaded, but its nested absolute
secret include was reported as nonexistent even though the file existed and the
Asterisk service account could read it. The auth object was retained from stale
state while the registration, AOR, and endpoint were not created.

**How to apply:** Generate `password="..."` inside `[o2-ims-auth]`; migrate an
existing protected password copy into the fragment without printing it, and
check every expected object after reload rather than treating a visible auth
object as proof that the whole fragment loaded.
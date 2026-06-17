---
name: Back Office Agenda role permission
description: How the per-role "Back Office Agenda" toggle is modeled and why every BO entry point must be gated, not just the visible button.
---

The per-role "Back Office Agenda" toggle reuses the existing `CRM_MODULES` RBAC
system (a module with `defaultAccess: "hidden"`), so the role editor's
visible/hidden Switch *is* the requested checkbox and `canAccessModule(key)`
reads it. No new DB column / API was needed.

**Why hidden-by-default:** the requirement was "if not enabled, the option must
not appear at all". `canAccessModule` returns true for admin/legacy-admin, and
for everyone else falls back to the module's `defaultAccess` when no explicit
permission row exists — so `hidden` means roles without the box checked never see
it, while admins still do.

**The non-obvious gotcha (cost a FAIL in review):** Back Office is a *mode*, not a
route. Gating only the visible entry button is insufficient — you must gate every
path that flips the mode state, including programmatic switches and
event/sessionStorage-driven handlers, AND the render itself:
- the visible toggle/card
- the session-start path
- the manual "switch to BO" handler
- the toast/custom-event/`sessionStorage` auto-open handler — this one fires from
  a closure, so check the permission via a **ref kept in sync each render**
  (`canBackOfficeAgendaRef.current`), not the captured value, because the
  permission loads async (roleData query) and may be false at mount.
- the active-session tab bar + the panel render (final safety net so stale state
  can't render the panel)
- reset the local "mode" state to off when the permission flips false.

**How to apply:** any future "feature flag that enables a workspace mode" should
follow the same checklist — gate all enabling paths + the render, and use a ref
for permission checks inside long-lived event handlers/effects.

This is UI/RBAC gating only; the BO *task data* endpoints have their own
country-based authorization. If BO data itself ever needs this permission, add a
server-side check independently.

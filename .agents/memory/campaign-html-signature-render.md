---
name: Campaign-authored HTML rendered to other agents
description: Rules for per-campaign HTML reply signatures configured by managers but rendered/sent by agents.
---

# Per-campaign HTML reply signature

Campaign managers can configure a per-campaign HTML email-reply signature. It is stored in the campaign `settings` JSON (key `replyEmailSignatureHtml`) — NOT a new DB column, because prod deploy does not run db:push. Variables like `{{user.*}}` are filled at reply-open time via the existing client-side `replaceTemplateVars`.

## Rule: sanitize campaign-authored HTML before render/send
**Why:** the signature is authored by a campaign manager but rendered (dangerouslySetInnerHTML) and emailed on behalf of *other* agents — privilege-crossing stored XSS, not self-XSS. Stripping only `<script>` (the existing personal-signature pattern) is not enough for this cross-user path.
**How to apply:** before storing campaign HTML into the shared reply-signature state, strip script/iframe/object/embed/link/meta tags, `on*=` event handlers, and `javascript:` URLs. No sanitizer lib is installed and prod skips npm install, so use a regex sanitizer (or a Node built-in), never add a new dep.

## Rule: resolve the reply campaign from the email entry, and fetch settings FRESH
**Why:** the reply modal read the signature from the currently-*selected* campaign via the `/api/campaigns` react-query list, which uses `staleTime: Infinity` — a just-saved signature never appeared, and the selected campaign can be null or a different campaign than the email belongs to. Result: "signature applied nothing."
**How to apply:** at reply-open resolve `replyCampaignId = entry.campaignId || selectedCampaignId`, then raw-`fetch('/api/campaigns/:id')` (bypasses the stale list cache) and read `settings.replyEmailSignatureHtml`. NOTE the timeline builder (`persistentAsTimeline`) drops `campaignId` when mapping ContactHistory→TimelineEntry — you must add `campaignId` to both the TimelineEntry interface and the mapping or `entry.campaignId` is always undefined.

## Rule: harden the sanitizer for unquoted/data URLs; share one function
**Why:** the original regex only neutralized *quoted* `javascript:` in href/src; unquoted (`href=javascript:...`) and `data:text/html` survived on this cross-agent render path. Architect flagged it as still-exploitable stored XSS.
**How to apply:** use the shared `sanitizeSignatureHtml` in `client/src/lib/sanitize-html.ts` at every sink (preview render, reply render/send) to avoid drift. Block `javascript:`/`vbscript:` on href+src (quoted, unquoted, entity/whitespace-prefixed, case-insensitive) and `data:` on href only — `data:image` base64 in `<img src>` is legitimate in signatures and cannot execute script.

## Rule: cache the personal-signature fallback in its own state
**Why:** if the effective signature state is only refetched "when null", opening reply in Campaign A (with a signature) then Campaign B (without one) reuses A's rendered signature — the fallback is skipped because state is no longer null. Cross-campaign leak.
**How to apply:** keep a separate `personalReplySignature` cache; on every reply-open recompute deterministically — campaign signature if present, else the cached personal signature (fetch once). Never reuse the previously-rendered campaign signature as the fallback.

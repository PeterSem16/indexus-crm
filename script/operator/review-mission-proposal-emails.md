# Reviewed historical proposal-email batch

The user approved attribution of **38 currently unassigned proposal-email records
for 34 clinics** to Medical Partner Cooperation, using the exact reviewed subject
and the production summary supplied on 2026-11-02.

This is not evidence of 38 unique provider transmissions. The 38 informational
records and the one already-bound proposal record are outside this batch.

## Before applying

Deploy and restart the application release that distinguishes `sent_at` from
record creation, including `timestampKind: "recorded"` in report details and
exports. The previous application release coalesces the two dates and must not
render the newly attributed records before this correction is active.

The tool's source check is an additional guard, not proof that PM2 has restarted.
Use the normal pinned, isolated-build promotion; never pull the whole workspace.

## Preview and apply

Run locally in `/var/www/indexus-crm`, using the existing application environment:

```
node script/operator/review-mission-proposal-emails.cjs --check
node script/operator/review-mission-proposal-emails.cjs --apply CHECK_FINGERPRINT
```

Use the exact fingerprint returned by the check. Any changed source value,
country conflict, second Mission membership, duplicate enrollment, previous
conflicting review, changed count, timestamp or transport marker aborts the batch.
The write transaction changes only `communication_messages.campaign_id` and adds
review audit events. It never sends, ticks Status List, edits content, changes
sender identity or fills in `sent_at`. A repeat with the same fingerprint is
idempotent.

The application shows reviewed records as direct evidence, preserves their real
record date separately and leaves first sending time unknown. They cannot be
counted in a specific sending-time attainment window without a dated source.

Do not obtain or print connection strings, recipients, message bodies or mailbox
tokens. Output includes only counts, a fingerprint and operation status.

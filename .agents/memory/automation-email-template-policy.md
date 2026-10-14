---
name: Automation email template approval
description: Approval and integration scope for the new Automatizácia email-template category.
---

New playful, animated HTML email templates for the category “Automatizácia”
must be presented for approval before being added to Configurator or connected
to automatic sending.

**Why:** The user explicitly requested “prosim najprv na schvalenie”.

**How to apply:** Keep visual proposals separate from live template records and
email dispatch until the user approves them. Do not treat approval of a visual
proposal as permission to deploy to CORPCRM01.

The approved visual family is Nová úloha (blue), Potrebná akcia (apricot),
Úspešne dokončené (mint), Pripomienka termínu (purple), Zmena údajov, and Dôležitá
informácia. Preserve that family when extending email templates, including
non-Task notifications.

**Why:** The user approved the four Task designs and both additional non-Task designs.

**How to apply:** New designs still require approval before live integration.

Personal sending means the rule author's personal mailbox, not the event actor's.
Default newly created email actions to this selected personal mode; keep existing
legacy rules unchanged until their email action is explicitly edited.

**Why:** The user selected the author's personal mailbox.

**How to apply:** Never infer a different author from an event or client payload.

## Approved multilingual catalog scope

The user approved equivalent EN, CS, HU, RO, IT and DE versions of the six
approved automation email designs and seven default Task templates. Other
legacy Slovak email templates are outside that approved translation scope.
Keep the Slovak originals and existing manager edits unchanged.

**Why:** The user explicitly selected “6 e-mailových automatizácií + 7 Task
šablón” rather than all Slovak email templates.

**How to apply:** Extend the same approved visual family across languages,
not a new design family or a bulk rewrite of the entire email catalog.

The user also requested both email and Task templates for inbound and outbound
calls. Extend the same approved design family and language coverage; catalog
templates do not themselves activate rules or initiate calls.

**Why:** The user asked to extend both template types for inbound/outbound calls.

**How to apply:** Keep the original privacy-preserving variants unchanged.
The later explicit request for detailed activity variants allows identities,
phone numbers, source times and AI findings in consciously selected templates;
see [Detailed activity templates](automation-activity-template-policy.md).
This does not authorize adding PII to automatic external task notifications.

All HTML email templates must have a consistent rounded design matching
“Je pripravená nová úloha”, not just newly added templates.

**Why:** The user explicitly requested uniform rounded corners across all HTML
templates so they look consistent.

**How to apply:** Reuse the approved reference frame when extending the catalog
and align existing template frames without changing their copy, variables,
recipients or stored rule snapshots. Task templates remain plain text.

The user approved direct Configurator integration of the multilingual Task-event
templates using the already approved design, without another preview round.

**Why:** They chose “Rovno zaradiť podľa schváleného dizajnu”.

**How to apply:** This approval covers the Task-event extension in that existing
visual family, not unrelated new designs or production deployment.

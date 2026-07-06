---
name: Salutation/gender template vars resolve synchronously client-side
description: Why {{*.salutation*}} template variables must be computed with client-side rule mirror, not the async AI endpoint
---

# Salutation template variables (Nexus Pulse / agent compose)

Template variables like `{{clinic.doctorSalutationFull}}`, `{{customer.salutationFull}}`,
`{{hospital.contactPersonSalutationDoc}}` are resolved by a **synchronous** client-side
salutation computation (rule-based gender + salutation tables) — NOT by calling the
async `/api/ai/detect-gender` endpoint.

**Why:** the compose flow's `replaceTemplateVars` runs at template-apply time and writes
its result straight into the editable message state; anything left unresolved is stripped
by a trailing `replace(/\{\{[^}]+\}\}/g, "")`. An async gender lookup would resolve AFTER
the body was already composed/stripped, so the salutation would never land in the sent
body. The server's own "AI" detection is ~95% rule-based and only defaults to OpenAI
(male on failure) for ambiguous names, so a client-side rule mirror matches it for the
vast majority of Slovak/Czech names.

**How to apply:**
- Keep the client salutation gender rules + salutation tables (short/full/doc across
  sk/cz/cs/hu/ro/it/en/de) in **lockstep** with the server detect-gender implementation;
  changing one requires changing the other.
- Empty name → empty salutation (better than a "Vážený/á" placeholder). Unknown gender
  defaults male (mirrors server OpenAI-fallback default).
- Template language must be read from a ref set at every apply site (email + both SMS
  paths) BEFORE substitution, because setState wouldn't be visible in the same
  synchronous apply call.
- Known accepted gap: ambiguous names needing the server's OpenAI fallback (e.g. Czech
  female first names ending in -e with a non-ová surname) resolve male client-side.

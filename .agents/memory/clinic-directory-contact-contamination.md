---
name: Clinic directory contact contamination
description: Migrated clinic contact fields can contain directory-operator contacts rather than facility contacts.
---

Do not treat a shared directory-operator email or phone as evidence that two clinics are the same facility. Identify unusually frequent contact values and verify their owner before using them as deduplication signals.

**Why:** A production clinic export contained the Zzz.sk operator email copied across unrelated facilities. Treating that value as a clinic identifier generated large numbers of false duplicate warnings. Public directory pages also contain unrelated nearby facilities and site-wide footer contacts.

**How to apply:** Preserve the original value in an audit note when removing a verified portal-owned email from contact fields, exclude it from matching, and rerun comparisons. A contaminated email alone must never deactivate the clinic: require facility-specific evidence of closure. When enriching from public sources, bind every phone, address and identifier to the named facility, not the footer or another listing. An e‑VÚC facility identifier is ID ZZ, not automatically the application's PZS code.
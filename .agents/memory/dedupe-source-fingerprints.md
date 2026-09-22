---
name: Dedupe source fingerprints
description: Non-obvious normalization requirement for collaborator and facility dedupe plan/apply fingerprints.
---

Source fingerprints must be computed from persisted database fields only, using the same stable serialization during plan generation and apply verification. Facility discovery adds a synthetic `kind` discriminator to clinic and hospital rows; that field must not participate in the fingerprint because direct apply reads do not contain it.

**Why:** A reviewed facility plan repeatedly failed closed in production even during a maintenance window. No row had changed; the dry-run fingerprint included synthetic `kind`, while the apply fingerprint used the physical table row.

**How to apply:** Any new discovery-only metadata must be excluded from source fingerprints. Cover both person and facility operations with a real PostgreSQL plan/apply integration test, not only unit-level hash comparisons.
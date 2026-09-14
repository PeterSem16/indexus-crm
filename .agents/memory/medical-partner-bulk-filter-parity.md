---
name: Medical partner bulk filter parity
description: Why list filters and representative-assignment filters must share semantics and preview identity.
---

Clinic/hospital list filters and representative-assignment filters must use one field definition and matching implementation, including AND/OR and enrichment-dependent fields.

**Why:** Reusing only the filter drawer is not enough: the old list ignored OR, so a separately implemented bulk matcher selected a different population from the same visible rules.

**How to apply:** Change definitions/evaluation for both consumers together. Preserve dynamic laboratory/representative options and reject invalid fixed-domain values even for negative operators. Confirm must bind the current entity, mode, source, target, country scope, criteria, and complete previewed ID set; never assign from just the visible page.
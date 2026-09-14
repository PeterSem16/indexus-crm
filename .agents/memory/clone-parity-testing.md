---
name: Clone parity test semantics
description: Identity and persisted-shape checks needed when comparing Mission configuration clones
---

Clone parity tests must assert fresh local IDs separately from normalized content equality, using the actual persisted representation.

**Why:** Normalizing script IDs made a text-column script that was copied verbatim look correct, despite the object-only remapper never running. Schema parsing can also silently inject defaults into an otherwise equivalent clone.

**How to apply:** For future configuration cloning tests, compare database round-trips, verify source/clone identity disjointness, and compare content after only intentional identity normalization. Do not let schema defaults mask unwanted content changes.
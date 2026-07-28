---
name: translations.ts scripted key insertion
description: How to safely insert i18n keys into the huge translations.ts without corrupting other namespaces
---

Rule: when scripting insertions into `client/src/i18n/translations.ts`, never anchor on a key name alone (e.g. `allCountries: '` or `amount: '`) — most key names repeat across namespaces AND some already exist in the target namespace, so blind anchors insert into wrong locales/namespaces and blind strips delete legit keys elsewhere.

**Why:** an `allCountries`-anchored insert landed pricing keys in 4 different en namespaces and starved cs/hu/... ; a key-name-based strip deleted legit `amount`/`dueDate` keys from other namespaces (recovered via `git checkout HEAD -- file` + structural re-insert).

**How to apply:**
- Walk the file structurally: track top-level locale (`^  xx: {`) and 4-space namespace (`^    ns: {`); insert only when inside the target namespace of each locale; interface = 2-space namespace blocks before the first locale.
- Before adding keys, grep whether they already exist in the target namespace (pricing already had ruleLowVolume/ruleContamination/ruleFlatFee/appliesTo).
- Verify with a runtime check: `npx tsx -e "require('./client/src/i18n/translations.ts')"` asserting every key in all 7 locales; the file has ~200 PRE-EXISTING duplicate-key tsc/vite warnings — compare error counts against a git baseline before blaming your change.

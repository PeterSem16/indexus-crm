---
name: Full i18n for every new feature
description: Every new UI label/text must be localized into all 7 INDEXUS languages — never hardcode strings in components.
---

# Full i18n required for every new UI feature

## The rule
Every new user-visible string must have a translation key added to **all 7 languages** in `client/src/i18n/translations.ts`, plus the TypeScript interface. Components must reference `t.section.key`, never hardcoded text.

**Why:** INDEXUS operates in 7 countries (SK, CZ, HU, RO, IT, DE, + EN base). Hardcoded Slovak or English strings break all other country interfaces. The user explicitly flagged this as a non-negotiable requirement.

## The 7 languages and their approximate line anchors
Use `phoneForNotificationsHint` pattern (grep for it) to find each language block:
- **EN** (base): ~line 7935
- **SK**: ~line 14497
- **CS**: ~line 21039
- **HU**: ~line 27501
- **RO**: ~line 33846
- **IT**: ~line 40190
- **DE**: ~line 46535

Line numbers shift with each file edit — always grep for a nearby unique anchor before editing.

## How to apply
1. Add the TypeScript interface field(s) to the `interface` block (~line 1180).
2. Add the actual string to all 7 language blocks — grep for a nearby unique string in each block to get precise line numbers.
3. In the component, use `t.section.key` (never hardcode).
4. For label + description pairs, use `key` + `keyHint` convention (e.g. `position` + `positionHint`).

## Translations for sections added so far
`users.position` / `users.positionHint` — added in all 7 languages (SK/CS/HU/RO/IT/DE/EN).

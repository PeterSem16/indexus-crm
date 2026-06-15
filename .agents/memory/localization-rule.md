---
name: INDEXUS Localization Rule
description: Always add full translations to all 7 INDEXUS locales whenever adding new UI strings
---

INDEXUS supports 7 locales: `en`, `sk`, `cs`, `hu`, `ro`, `it`, `de` (defined in `client/src/i18n/translations.ts` as `type Locale`).

**Rule:** Whenever adding new UI strings (buttons, labels, messages, placeholders), always add translations to ALL 7 locales. No hardcoded strings in Slovak or English only.

**How to apply:**
- Add type definition in the `Translations` interface (first 600 lines of translations.ts)
- Find each locale's matching section using the line-number pattern (sections are ~6500-7000 lines apart)
- The file is ~50000 lines — use Python scripts for edits, never the edit tool directly on large blocks
- `description2:` is the last key in the standalone `tasks:` section for each locale — use it as an insertion anchor
- Locale `tasks:` standalone sections (0-indexed line positions): EN≈6946, SK≈13344, CS≈19700, HU≈25976, RO≈32212, IT≈38370, DE≈44529 (these shift after each insertion)

**Why:** User explicitly requested "vždy pri nových veciach dodržuj lokalizáciu do všetkých jazykov INDEXUS" (always maintain localization to all INDEXUS languages for new features). Failure to do so requires follow-up fix requests.

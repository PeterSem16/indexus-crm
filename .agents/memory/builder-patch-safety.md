---
name: Builder patch script safety
description: Python scripts that crash mid-run leave files unchanged — verify applied patches before trusting "success" prints.
---

When a Python patch script reads a file, applies multiple replacements in memory, then writes at the end — if it crashes (e.g. "anchor not found") before the write, the file retains its ORIGINAL state even though earlier patches printed "✓".

**Why:** The `with open(..., 'w') as f: f.write(c)` only runs at the end. A crash in patch 5 means patches 1–4 are discarded.

**How to apply:** After any large Python patch session, always grep for newly introduced symbols (function names, const names, state fields) to verify they actually landed in the file. Never trust "✓ patch N" without reading the result. If in doubt, use the edit tool instead — it writes immediately and atomically.

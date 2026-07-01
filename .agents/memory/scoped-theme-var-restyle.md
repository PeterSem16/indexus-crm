---
name: Scoped theme-var restyle for shadcn modals
description: How to restyle an entire shadcn/Radix modal to a fixed palette without editing every element — scope the theme CSS variables on the modal root.
---

# Restyle a whole shadcn modal by scoping theme CSS vars on its root

## The technique
To force an entire shadcn/Radix modal (Sheet/Dialog) into a fixed palette (e.g. the
Nexus Pulse "stone & terracotta" look) WITHOUT touching dozens of inline colors:
define a `CSSProperties` object of theme variables in raw `H S% L%` form (matching
`client/src/index.css`) and pass it as `style={...}` on the `SheetContent` /
`DialogContent`. Every descendant — Tailwind `bg-background`/`text-foreground`,
shadcn Button/Input/Textarea tokens, and inline `hsl(var(--card))` styles — resolves
against the nearest inherited custom properties, so the whole subtree shifts palette.

**Why:** far less error-prone than rewriting every element's classes, and it survives
future markup changes inside the modal.

## Gotchas (learned the hard way)
- **Override the interaction tokens too, or dark mode leaks in.** Color vars alone
  aren't enough: the hover/elevate/outline system reads `--elevate-1`, `--elevate-2`,
  `--button-outline`, `--badge-outline`, `--opaque-button-border-intensity` (see the
  `.dark` block in index.css). If you force the modal light but leave these, hover/
  border behavior looks wrong when the app is in dark mode. Set them to the light
  values (`rgba(0,0,0,.03/.08/.10/.05)`, intensity `-8`).
- **Portaled content does NOT inherit.** Radix `Popover`/`Select`/`DateTimePicker`
  content opened from inside the modal mounts under `document.body`, outside the
  modal subtree, so it stays default-themed. Acceptable for "style the modal window"
  tasks; if dropdowns/calendars must match, pass a portal container inside the modal.
- **Type assertion:** `@types/react` removed the CSSProperties index signature, so
  `{ "--x": "..." } as CSSProperties` is the correct/documented escape hatch (Vite
  dev won't catch a bad cast — only the prod `npm run build` tsc will).
- Keep semantic status colors (blue/green/red action badges, per-disposition
  accentHex) as-is — they carry meaning and already appear on the NexusPulseView tiles.

# INDEXUS automation email state icons

This small, hand-drawn icon family extends the approved B Human Message illustration language: warm cream faces, soft mint fields, deep-green outlines, with restrained coral and marigold signals. Expressions use clear, simplified linework so they remain legible at 24–28 px. Status marks sit inside compact circular badges.

## Assets

| File | Meaning |
| --- | --- |
| `state-happy.png` | Warm, positive response |
| `state-neutral.png` | Neutral or informational state |
| `state-concerned.png` | Concern or an issue to review |
| `state-angry.png` | Strongly negative response |
| `state-calm.png` | Calm, reassuring state |
| `state-urgent.png` | Urgent attention required |
| `state-pending.png` | Waiting for action (clock) |
| `state-progress.png` | Work in progress (progress mark) |
| `state-completed.png` | Completed successfully (check) |
| `state-cancelled.png` | Cancelled (cross) |

All delivered images are standalone transparent 64×64 PNGs. `state-icons.json` is the machine-readable manifest; `state-icons.svg` is the source artwork. Email clients should reference the PNG assets as ordinary image attachments/CIDs or hosted image URLs, never embed the SVG source.

## Rasterization

To regenerate the PNGs, render each symbol from `state-icons.svg` at 64×64 with a transparent page background using Chromium (Playwright). Keep the output PNG dimensions and transparency intact. The SVG is source artwork only; PNGs are the email-compatible deliverables.

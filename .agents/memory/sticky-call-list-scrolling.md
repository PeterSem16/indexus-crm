---
name: Sticky call-list scrolling
description: Scroll containment and viewport sizing for the call-review split view.
---

A sticky list inside a tab cannot follow the app's scrolling pane if any intervening tab container has `overflow: hidden`: that container becomes the nearest sticky scroll ancestor even though it does not itself scroll. For the call-review tab, keep those intervening containers overflow-visible while retaining overflow constraints for unrelated tabs. Size the sticky list against the actual app scrollport, allowing for its header and padding, not just the raw browser viewport.

**Why:** Merely increasing the list height left a blank region when the user scrolled the page. A browser layout check reproduced the problem: with hidden-overflow tab ancestors the list left the viewport; with visible-overflow ancestors it remained anchored while its own entries could still scroll.

**How to apply:** When changing nested tab layouts, identify which element actually scrolls, check every ancestor between it and the sticky item for overflow, and verify both page scrolling and the list's internal scrolling before declaring the panel fixed.
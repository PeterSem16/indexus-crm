---
name: Pulse fullscreen modal verification
description: Why approved canvas designs need real-component fullscreen browser tests.
---

Verify graduated Pulse modals using the production component, production CSS, and the fullscreen ancestor attribute, not only the canvas or an unauthenticated login screenshot.

Assert key computed visual properties as well as interaction and viewport bounds for approved modal designs. Measure bounds only after entrance animations settle.

**Why:** Successful click tests can still hide a shared-dialog utility overriding the intended width, rounding, padding, or backdrop under lazy CSS loading. An in-progress entrance animation can also produce a false mobile overflow failure.

**How to apply:** Include the approved width, surface color, rounding, and backdrop in the real-component verification; do not treat a passing interaction test alone as visual parity.

**Why:** Broad fullscreen header hiding removed the Priority Builder title and Add group control while the standalone canvas looked correct. Dialog defaults and unconstrained button widths also changed the approved layout.

**How to apply:** Exercise visible controls and preset hydration with intercepted API data in a test-only fixture, and verify desktop/mobile bounds. Distinguish fixture verification from inspection of a user's actual live callback.

Preserve the approved canvas source during graduation. If a user says the design differs, inspect its history before asserting that the current canvas file is the approved reference.

**Why:** The original Priority Builder had a dark INDEXUS sidebar, colored groups and a detailed live-result panel. Its backing mockup was overwritten with a simpler pink modal during implementation, so comparisons to the current mockup falsely appeared to confirm fidelity.

**How to apply:** Keep the original reference unchanged; compare rendered images at the same viewport and distinguish original, current canvas, and application screenshots explicitly.

Bounded picker tests need both minimum readable height and maximum viewport bounds, with a realistically large populated list.

**Why:** flex shrinking can reduce hundreds of options to a single visible row while every overflow/within-modal assertion still passes.

**How to apply:** inspect the populated state, verify multiple visible rows, scroll to the final option, and keep Save and close controls reachable on mobile as well as desktop.

Graduation must preserve the entire approved shell, not merely add search and sorting to the legacy modal.

**Why:** Functionally correct toolbar changes still left the wrong palette, dimensions, filter hierarchy and rows. Checking navigation alone missed that the user was seeing an unapproved design; an empty Calls tab also concealed pending messages.

**How to apply:** Compare populated and genuinely empty production dialogs to the unchanged approved reference. Use real App/provider tests with intercepted APIs, check cross-channel defaults, and inspect screenshots for occlusion: an element can pass isVisible while a high-z-index preview notice covers its title.

Responsive communication layouts must follow the card's available width,
not merely the browser width. Desktop workspace sidebars can leave a very
narrow conversation card even at a nominal desktop viewport.

**Why:** Window-only breakpoints let form sidebars squeeze conversation text
and the SMS textarea into narrow columns while send controls were clipped.
The mobile workspace is a separate interface; shrinking a desktop test below
its breakpoint can unmount the communication card rather than test its layout.

**How to apply:** Use card/container-aware layout, test compact desktop cards
with both workspace sidebars visible, and separately test portalled dialogs
on phones. Modal max-height and vertical position must both account for the
development preview banner; shifting the center alone still clips tall dialogs.

Verify the complete bounds of bottom compose actions, not just viewport intersection.
Also wait for the desktop canvas to become visible after resizing back from phone
width before asserting restored focus.

**Why:** A partially clipped Send button passes `toBeInViewport`; the preview notice
can leave a full-height workspace taller than the remaining viewport. Responsive
canvas visibility settles independently of the portalled dialog.

**How to apply:** Compare the button's bottom edge against viewport height and
exercise realistic short windows. Keep the preview notice accounted for without
changing production sizing when no notice exists.

When compact communication panels lose their footer, inspect the flex line's
cross-axis height as well as the editor's own height. An overflowing form sidebar
can make the entire wrapped line taller than its frame, clipping a correctly
configured editor. Constrain both form and composer to the frame. For an outer
canvas that should never scroll, `overflow: hidden` still permits browser-driven
scrolling when an input is focused; use non-scrollable clipping to keep the
visible column stable as widths change.

**Why:** A long HTML compose exposed a hidden footer despite an apparently
bounded editor. Narrow-viewport focus then shifted an overflow-hidden ancestor
horizontally, cutting off SMS actions even after the height was corrected.

**How to apply:** Test a populated HTML body and SMS draft at wide and compact
desktop widths, including resizing between them. Check every action's full
rectangle against clipping ancestors and hit-testing, not just visibility.
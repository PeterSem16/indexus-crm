---
name: Mobile interactive JSX variables
description: JSX variables with onClick/state are unreliable on mobile — use named sub-components instead.
---

# Mobile interactive JSX variables

## Rule
Never store an interactive React element (one with `onClick` handlers or state-dependent rendering) in a JSX variable inside a parent component and then place it in the JSX tree as `{variable}`. On mobile browsers (iOS Safari, Android Chrome) the click handlers may not fire reliably.

**Why:** JSX variables are just React element objects computed once per render. On mobile, scroll containers with `overflow: auto` can intercept touch events before they synthesize a click. A named sub-component with its own `useState` is managed by React's reconciler independently and gets reliable touch/click handling.

## How to apply
- Any card, accordion, or collapsible section with its own toggle state → extract to a named function component defined outside the parent.
- Add `WebkitTapHighlightColor: "transparent"` to interactive buttons inside the sub-component for instant tap response.
- The sub-component manages `showHistory`, `showNotes`, etc. internally — parent does not need those states.

## Example (mobile-agent-workspace.tsx)
`MobileContactInfoCards` was extracted from a JSX variable `contactInfoSection`. After extraction, the Call history and Notes expand buttons work reliably on mobile.

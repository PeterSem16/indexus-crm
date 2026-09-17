---
name: Moving pages into nested settings tabs
description: Non-obvious integration boundaries when existing standalone pages become nested settings tabs.
---

# Moving pages into nested settings tabs

When an existing standalone page moves into a nested settings tab, the tab URL becomes canonical. Old routes and external callback redirects must route to that tab while preserving relevant query parameters, and callback cleanup must remove only transient parameters rather than the nested-tab selector.

**Why:** Keeping the old pages rendered separately created duplicate destinations, while an OAuth callback and its cleanup could send the user out of the new tab or make reload return to the parent default.

**How to apply:** Give the nested tab a durable deep-link parameter, redirect legacy routes and callbacks to it, preserve unrelated parameters, and synchronize parent plus child tab state on reload and browser history changes.

Embedded pages must use the same authorization predicate as their server API and adapt page-level headers and controls for narrow containers.

**Why:** A former sidebar module gate can be broader than the endpoint's role restriction, and desktop standalone layouts can overflow when nested.

**How to apply:** Match tab visibility to server authorization, retain server enforcement, and test long localized controls in the embedded width.
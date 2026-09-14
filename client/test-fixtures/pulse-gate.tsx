import React from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../src/i18n";
import { PulseGate } from "../src/features/nexus-pulse-preflight/PulsePreflightProvider";
import "../src/index.css";

createRoot(document.getElementById("root")!).render(
  <I18nProvider><PulseGate><div data-testid="workspace-retained">Workspace</div></PulseGate></I18nProvider>,
);
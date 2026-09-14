import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../src/i18n";
import { PulseDiagnostics } from "../src/features/nexus-pulse-preflight/PulseDiagnostics";
import "../src/index.css";

document.documentElement.setAttribute("data-agent-fullscreen", "true");

function Fixture() {
  const [open, setOpen] = useState(true);
  return <I18nProvider>
    <PulseDiagnostics open={open} required userId="readiness-fixture"
      onClose={() => setOpen(false)} onExit={() => setOpen(false)}
      onReady={() => setOpen(false)} />
    {!open && <p data-testid="returned-to-indexus">Returned to INDEXUS</p>}
  </I18nProvider>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
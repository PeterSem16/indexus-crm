import React, { useState } from "react";

export function PulseDiagnostics(p: { open: boolean; autoStartRequest: number; onReady: () => void }) {
  const [done, setDone] = useState(false);
  if (!p.open) return null;
  return <div data-testid="test-diagnostics">
    <span data-testid="run-state">{done ? "OLD READY" : p.autoStartRequest ? "FRESH RUN" : "INITIAL"}</span>
    <button onClick={() => { setDone(true); p.onReady(); }}>Complete fixture test</button>
  </div>;
}
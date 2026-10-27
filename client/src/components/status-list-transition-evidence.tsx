import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  compareTransitionExports, TRANSITION_EXPORT_MAX_BYTES, verifyTransitionExport, type TransitionExport,
} from "@shared/status-list-transition-export";
import { getTransitionEvidenceCopy } from "./status-list-transition-evidence-copy";

export function StatusListTransitionEvidence({ campaignId, locale, refreshKey, disabled }: {
  campaignId: string; locale: string; refreshKey: number; disabled: boolean;
}) {
  const copy = getTransitionEvidenceCopy(locale);
  const [current, setCurrent] = useState<TransitionExport | null>(null);
  const [previous, setPrevious] = useState<TransitionExport | null>(null);
  const [error, setError] = useState<"error" | "exportError" | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  const epoch = useRef(0);
  const reset = () => {
    epoch.current++;
    setCurrent(null); setPrevious(null); setError(null); setBusy(false);
  };
  useEffect(() => { reset(); }, [campaignId, refreshKey, disabled]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);
  const diff = useMemo(() => current ? compareTransitionExports(current, previous, now) : null, [current, previous, now]);
  const label = (kind: string) => {
    const key = kind.replace(/^dependency:/, "");
    return copy[(key === "source" ? "sourceKind" : key) as keyof typeof copy] || copy.unknownState;
  };
  async function importFile(file: File | undefined, slot: "current" | "previous") {
    const version = ++epoch.current;
    setError(null); setBusy(true);
    if (slot === "current") setCurrent(null); else setPrevious(null);
    try {
      if (!file || file.size > TRANSITION_EXPORT_MAX_BYTES) throw new Error("size");
      const value = await verifyTransitionExport(JSON.parse(await file.text()));
      if (value.campaignId !== campaignId) throw new Error("mission");
      if (version !== epoch.current) return;
      if (slot === "current") setCurrent(value); else setPrevious(value);
      setNow(Date.now());
    } catch {
      if (version === epoch.current) { setCurrent(null); setPrevious(null); setError("error"); }
    } finally { if (version === epoch.current) setBusy(false); }
  }
  async function download() {
    const version = ++epoch.current;
    setCurrent(null); setPrevious(null); setError(null); setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/status-list-workflows/transition-export`, {
        credentials: "include", cache: "no-store",
      });
      if (!response.ok) throw new Error("export");
      const blob = await response.blob();
      if (blob.size > TRANSITION_EXPORT_MAX_BYTES) throw new Error("size");
      const value = await verifyTransitionExport(JSON.parse(await blob.text()));
      if (value.campaignId !== campaignId) throw new Error("mission");
      if (version !== epoch.current) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `status-list-${campaignId}-${value.capturedAt.replace(/[:.]/g, "-")}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setCurrent(value); setNow(Date.now());
    } catch {
      if (version === epoch.current) setError("exportError");
    } finally { if (version === epoch.current) setBusy(false); }
  }
  const unavailable = disabled || busy;
  return <section className="slt-inventory" data-testid="transition-evidence">
    <header><strong>{copy.title}</strong></header>
    <p className="px-3 py-2 text-xs">{copy.hint}</p>
    <div className="slt-actions">
      <Button variant="outline" size="sm" onClick={() => void download()} disabled={unavailable} data-testid="transition-export">{copy.export}</Button>
      <Button variant="ghost" size="sm" onClick={reset}>{copy.refresh}</Button>
    </div>
    <div className="slt-controls">
      {(["current", "previous"] as const).map(slot => <label className="slt-field" key={slot}>{copy[slot]}
        <input type="file" accept=".json,application/json" disabled={unavailable} data-testid={`transition-import-${slot}`}
          onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importFile(file, slot); }}/>
      </label>)}
    </div>
    {error && <p className="slt-warning" role="alert">{copy[error]}</p>}
    <p className="slt-warning" data-testid="transition-evidence-blocked">{copy.blocked}</p>
    {current && diff && <div className="p-3 space-y-3 text-xs" data-testid="transition-evidence-result">
      <p>{copy.source}</p>
      <p className="break-all">{current.source.instance} / {current.source.commit || copy.unknownState} / {current.source.runtime === "unknown" ? copy.unknownState : copy[current.source.runtime]}</p>
      <p>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Bratislava" }).format(new Date(current.capturedAt))}</p>
      <code className="block break-all">{current.fingerprint}</code>
      <ul>{diff.blockers.map(blocker => <li key={blocker}>{copy[blocker]}</li>)}</ul>
      <details open data-testid="transition-evidence-dependencies"><summary>{copy.dependencies} ({current.dependencies.filter(row => row.state !== "present").length})</summary>
        {current.dependencies.filter(row => row.state !== "present").slice(0, 200).map((row, index) => <p key={index} className="break-all">
          {label(row.kind)} · {row.state === "missing" ? copy.missing : copy.unknownState} · {row.owner}{row.target ? ` → ${row.target}` : ""}
        </p>)}
        {current.dependencies.filter(row => row.state !== "present").length > 200 && <p>{copy.limit}</p>}
      </details>
      {previous && <p className="break-all">{copy.previous}: {previous.capturedAt} · {previous.fingerprint}</p>}
      {previous && <div data-testid="transition-evidence-diff">
        <strong>{copy.changes} ({diff.changes.length})</strong>
        {!diff.changes.length && <p>{copy.noChanges}</p>}
        {diff.changes.slice(0, 200).map((row, index) => <p key={index} className="break-all">{copy[row.change]} · {label(row.kind)} · {row.id}</p>)}
        {diff.changes.length > 200 && <p>{copy.limit}</p>}
      </div>}
    </div>}
  </section>;
}

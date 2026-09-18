import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Check, ChevronDown, Coffee, Headphones, Pause, Play, X } from "lucide-react";
import "../_source.css";
import "../_group.css";

const duration = (seconds: number) => [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, "0")).join(":");

export function BreakPreview({ overdue = false }: { overdue?: boolean }) {
  const [active, setActive] = useState(true);
  const [open, setOpen] = useState(true);
  const [elapsed, setElapsed] = useState(overdue ? 1934 : 754);
  const startedAt = useRef(Date.now() - elapsed * 1000);
  const dialog = useRef<HTMLDialogElement>(null);
  const statusButton = useRef<HTMLButtonElement>(null);
  const exceeded = elapsed > 1800;
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => {
    if (open && active) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open, active]);

  const hide = () => {
    setOpen(false);
    requestAnimationFrame(() => statusButton.current?.focus());
  };
  const finish = () => {
    setActive(false);
    hide();
  };
  const start = () => {
    startedAt.current = Date.now();
    setElapsed(0);
    setActive(true);
    setOpen(true);
  };

  return <div className="pb-preview">
    <header className="pb-top">
      <span className="pb-brand"><Headphones size={18} /> NEXUS <b>Pulse</b></span>
      <span className="pb-design-label">INTERAKTÍVNY NÁVRH</span>
    </header>
    <div className="pb-toolbar-demo">
      <div className="agent-toolbar-unified">
        <div className="pta-surface">
          {/* Same status-control structure as the production toolbar. */}
          <button ref={statusButton} className={`pta-control pta-status pta-status-${active ? "break" : "available"}`}
            onClick={() => active ? setOpen(true) : start()} aria-label={active ? "Prestávka — otvoriť detail" : "Dostupný — začať ukážkovú prestávku"}>
            <span className="pta-status-dot" />
            <span className="pta-control-copy"><strong>{active ? "Prestávka" : "Dostupný"}</strong></span>
            <ChevronDown size={15} />
          </button>
          <span className="pb-toolbar-caption">Žiadny ďalší blok s časovačom v lište.</span>
        </div>
      </div>
    </div>
    <main className="pb-background-content">
      <div className="pb-background-symbol">{active ? <Pause size={28} /> : <Check size={28} />}</div>
      <h1>{active ? "Prestávka pokračuje" : "Ste späť v práci"}</h1>
      <p>{active ? "Detail a návrat do práce nájdete pod stavom Prestávka." : "Prestávka je ukončená. V lište sa obnovil stav Dostupný."}</p>
      <button className="pb-reopen" onClick={() => active ? setOpen(true) : start()}>
        {active ? "Otvoriť detail prestávky" : "Vyskúšať prestávku znova"} <ArrowRight size={15} />
      </button>
    </main>
    <div className="pb-demo-note">Ukážka správania · nemení skutočnú smenu ani prestávku</div>
    <dialog ref={dialog} className={`pb-dialog ${exceeded ? "pb-overdue" : ""}`}
      aria-labelledby="pb-title" aria-describedby="pb-description"
      onCancel={event => { event.preventDefault(); hide(); }}>
      <div className="pb-dialog-top">
        <span className="pb-eyebrow"><span /> PRESTÁVKA PREBIEHA</span>
        <button className="pb-close" aria-label="Skryť okno, prestávka pokračuje" title="Skryť okno, prestávka pokračuje" onClick={hide}><X size={19} /></button>
      </div>
      <div className="pb-hero">
        <div className="pb-coffee"><Coffee size={28} strokeWidth={1.65} /></div>
        <h2 id="pb-title">Obed</h2>
        <p id="pb-description">Váš čas na prestávku.</p>
        <div className="pb-clock" role="timer" aria-label={`Trvanie prestávky ${duration(elapsed)}`}>{duration(elapsed)}</div>
        <span className="pb-clock-caption">OD ZAČIATKU PRESTÁVKY</span>
      </div>
      <div className="pb-timing">
        <div className="pb-time-row"><span>Odporúčaná dĺžka</span><strong>30 minút</strong></div>
        <progress value={Math.min(elapsed, 1800)} max={1800} aria-label="Priebeh odporúčanej dĺžky prestávky" />
        {exceeded
          ? <div className="pb-warning"><AlertTriangle size={17} /><div><strong>Odporúčaný čas bol prekročený</strong><span>O {duration(elapsed - 1800)} · prestávka naďalej beží.</span></div></div>
          : <div className="pb-time-row pb-remaining"><span>Do odporúčaného konca</span><strong>{duration(1800 - elapsed)}</strong></div>}
      </div>
      <div className="pb-actions">
        <button autoFocus className="pb-primary" onClick={finish}><Play size={17} fill="currentColor" /> Ukončiť prestávku a pokračovať</button>
        <button className="pb-secondary" onClick={hide}>Skryť okno <span>· prestávka pokračuje</span></button>
      </div>
      <footer className="pb-footnote">Prestávka sa ukončí až vaším potvrdením.</footer>
    </dialog>
  </div>;
}
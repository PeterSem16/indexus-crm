import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Coffee, Headphones, Play, X } from "lucide-react";
import "./BreakModal.css";

function formatTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function BreakModal() {
  const [active, setActive] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [elapsed, setElapsed] = useState(754);
  const startedAt = useRef(Date.now() - 754000);

  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [active]);

  const finishBreak = () => {
    setActive(false);
    setHidden(true);
  };

  const restartBreak = () => {
    startedAt.current = Date.now();
    setElapsed(0);
    setActive(true);
    setHidden(false);
  };

  return (
    <main className="break-demo">
      <header className="break-demo__header">
        <span className="break-demo__brand"><Headphones size={17} /> NEXUS <b>Pulse</b></span>
        <span className="break-demo__caption">PRESTÁVKA · INTERAKTÍVNY NÁVRH</span>
      </header>

      <section className="break-demo__toolbar">
        <button className={`break-demo__status ${active ? "is-break" : "is-ready"}`} onClick={() => setHidden(false)}>
          <span className="break-demo__dot" />
          <strong>{active ? "Prestávka" : "Dostupný"}</strong>
          <span className="break-demo__chevron">⌄</span>
        </button>
        <span className="break-demo__hint">Časovač je v okne, nie v hornej lište</span>
      </section>

      <section className="break-demo__empty">
        <div className="break-demo__empty-icon">{active ? <Coffee size={26} /> : <Headphones size={26} />}</div>
        <h1>{active ? "Prestávka pokračuje" : "Ste späť v práci"}</h1>
        <p>{active ? "Otvorte detail cez stav Prestávka. Skrytie okna prestávku neukončí." : "Stav Dostupný je obnovený."}</p>
        <button className="break-demo__reopen" onClick={() => active ? setHidden(false) : restartBreak()}>
          {active ? "Otvoriť detail prestávky" : "Vyskúšať prestávku znova"}
        </button>
      </section>

      <p className="break-demo__note">Ukážka správania · nemení skutočnú smenu ani prestávku</p>

      {active && !hidden && (
        <div className="break-modal-layer" role="presentation">
          <section className="break-modal" role="dialog" aria-modal="true" aria-labelledby="break-title">
            <div className="break-modal__topline">
              <span><i /> PRESTÁVKA PREBIEHA</span>
              <button className="break-modal__close" onClick={() => setHidden(true)} aria-label="Skryť okno"><X size={18} /></button>
            </div>
            <div className="break-modal__hero">
              <div className="break-modal__icon"><Coffee size={27} /></div>
              <h2 id="break-title">Obed</h2>
              <p>Váš čas na prestávku.</p>
              <strong className="break-modal__clock">{formatTime(elapsed)}</strong>
              <span className="break-modal__clock-caption">OD ZAČIATKU PRESTÁVKY</span>
            </div>
            <div className="break-modal__timing">
              <div><span>Odporúčaná dĺžka</span><b>30 minút</b></div>
              <progress value={Math.min(elapsed, 1800)} max={1800} />
              <div className="break-modal__remaining"><span>Do odporúčaného konca</span><b>{formatTime(Math.max(0, 1800 - elapsed))}</b></div>
            </div>
            <div className="break-modal__actions">
              <button className="break-modal__primary" onClick={finishBreak}><Play size={16} fill="currentColor" /> Ukončiť prestávku a pokračovať</button>
              <button className="break-modal__secondary" onClick={() => setHidden(true)}>Skryť okno <span>· prestávka pokračuje</span></button>
            </div>
            <footer>Prestávka sa ukončí až vaším potvrdením.</footer>
          </section>
        </div>
      )}

      {!active && <div className="break-demo__success"><span>✓</span> Prestávka ukončená · stav Dostupný</div>}
    </main>
  );
}
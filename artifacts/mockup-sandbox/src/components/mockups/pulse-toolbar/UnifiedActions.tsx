import { useState } from "react";
import { BellOff, ChevronDown, Clock3, History, Inbox, Mail, MessageSquare, PhoneMissed, PhoneCall, Power, Radio } from "lucide-react";
import "./_group.css";
import "./unified-actions.css";

export function UnifiedActions() {
  const [opened, setOpened] = useState<"missed" | "shift" | "status" | null>(null);
  return (
    <main className="pta-stage">
      <div className="pta-eyebrow">NEXUS PULSE <span>/</span> AGENT CONTROL BAR</div>
      <section className="pta-surface">
        <div className="pta-toolbar pta-control-row" role="group" aria-label="Agent controls">
          <button className="pta-control pta-status" onClick={() => setOpened(opened === "status" ? null : "status")} aria-expanded={opened === "status"}>
            <span className="pta-status-dot" />
            <span className="pta-control-copy"><strong>Available</strong><span>Ready for contacts</span></span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          <button className="pta-control pta-end" onClick={() => setOpened("status")}>
            <Power size={17} aria-hidden="true" />
            <span className="pta-control-copy"><strong>End shift</strong><span>Close today’s session</span></span>
          </button>
          <button className="pta-icon-control" aria-label="Mute notifications"><BellOff size={18} /></button>
          <span className="pta-divider" aria-hidden="true" />
          <div className="pta-timer"><Clock3 size={16} /><strong>00:08:50</strong><span>on shift</span></div>
          <div className="pta-micro-counts" aria-label="Current workload">
            <span><PhoneCall size={14} /> <b>0/2</b></span>
            <span><Mail size={14} /> <b>0/1</b></span>
            <span className="pta-micro-pending"><MessageSquare size={14} /> <b>0/8</b></span>
          </div>
          <button className="pta-queue" onClick={() => setOpened("status")} aria-label="Queue, 10 waiting">
            <Radio size={18} /><span className="pta-control-copy"><strong>Queue</strong><span>Inbound line</span></span><b>10</b>
          </button>
        </div>
        <div className="pta-shortcuts">
        <button className={`pta-button pta-missed ${opened === "missed" ? "pta-selected" : ""}`}
          onClick={() => setOpened(opened === "missed" ? null : "missed")}
          aria-label="Missed communications: 0 calls, 0 emails, 16 SMS">
          <span className="pta-symbol"><Inbox size={21} strokeWidth={1.7} /></span>
          <span className="pta-copy"><strong>Missed communications</strong><span>Calls, emails &amp; SMS</span></span>
          <span className="pta-counts" aria-hidden="true">
            <span className="pta-counter" title="0 missed calls"><PhoneMissed size={14} /><b>0</b></span>
            <span className="pta-counter" title="0 unanswered emails"><Mail size={14} /><b>0</b></span>
            <span className="pta-counter pta-pending" title="16 unanswered SMS"><MessageSquare size={14} /><b>16</b></span>
          </span>
          <span className="pta-open-indicator">Open</span>
        </button>
        <button className={`pta-button pta-shift ${opened === "shift" ? "pta-selected" : ""}`}
          onClick={() => setOpened(opened === "shift" ? null : "shift")}>
          <span className="pta-symbol"><History size={21} strokeWidth={1.7} /></span>
          <span className="pta-copy"><strong>My Shift</strong><span>Today’s activity</span></span>
          <span className="pta-open-indicator">Open</span>
        </button>
        </div>
      </section>
      <div className="pta-explanation" aria-live="polite">
        {opened === "missed" ? "Otvorí spoločný zoznam zmeškaných hovorov, e-mailov a SMS."
          : opened === "shift" ? "Otvorí existujúci prehľad Moja smena."
          : "Návrh zjednocuje ovládanie smeny, frontu a komunikácií do jedného pokojného pracovného panela."}
        <span>Vizuálny návrh · bez zmien v aplikácii</span>
      </div>
    </main>
  );
}
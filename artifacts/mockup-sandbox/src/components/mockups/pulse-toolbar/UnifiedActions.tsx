import { useState } from "react";
import { Inbox, History, PhoneMissed, Mail, MessageSquare, ArrowUpRight } from "lucide-react";
import "./_group.css";
import "./unified-actions.css";

export function UnifiedActions() {
  const [opened, setOpened] = useState<"missed" | "shift" | null>(null);
  return (
    <main className="pta-stage">
      <div className="pta-eyebrow">NEXUS PULSE <span>/</span> QUICK ACCESS</div>
      <div className="pta-toolbar" role="group" aria-label="Workspace shortcuts">
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
          <ArrowUpRight className="pta-arrow" size={15} aria-hidden="true" />
        </button>
        <button className={`pta-button pta-shift ${opened === "shift" ? "pta-selected" : ""}`}
          onClick={() => setOpened(opened === "shift" ? null : "shift")}>
          <span className="pta-symbol"><History size={21} strokeWidth={1.7} /></span>
          <span className="pta-copy"><strong>My Shift</strong><span>Today’s activity</span></span>
          <ArrowUpRight className="pta-arrow" size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="pta-explanation" aria-live="polite">
        {opened === "missed" ? "Otvorí spoločný zoznam zmeškaných hovorov, e-mailov a SMS."
          : opened === "shift" ? "Otvorí existujúci prehľad Moja smena."
          : "Nulové počty sú neutrálne. Zvýraznené zostáva iba to, čo čaká na vybavenie."}
        <span>Vizuálny návrh · bez zmien v aplikácii</span>
      </div>
    </main>
  );
}
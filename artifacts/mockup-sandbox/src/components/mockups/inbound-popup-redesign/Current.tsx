import { AlertTriangle, Clock3, Phone, PhoneIncoming, PhoneMissed, PhoneOff, X } from "lucide-react";
import "./_group.css";

export function Current() {
  return (
    <main className="inbound-preview">
      <section className="inbound-shell" aria-label="Aktuálne okno prichádzajúceho hovoru">
        <header className="inbound-titlebar">
          <span><PhoneIncoming size={17} /> Incoming Calls</span>
          <small>1 call</small>
        </header>
        <article className="current-card">
          <div className="current-row">
            <div className="current-avatar">DD</div>
            <div>
              <div className="current-name">
                Drahoslava Drastíková
                <span className="current-badge">Customer</span>
                <span className="current-badge">+2</span>
              </div>
              <div className="current-meta">
                <span>Inbound Medical Partner Cooperation</span>
                <span>+421 918 751 470</span>
                <span><Clock3 size={12} /> 00:08</span>
              </div>
              <div className="current-stats">
                <span><PhoneIncoming size={12} /> Today: 10 calls</span>
                <span className="missed"><PhoneMissed size={12} /> 4 missed</span>
              </div>
            </div>
            <div className="current-actions">
              <button><Phone size={14} /> Accept</button>
              <button className="icon" aria-label="Reject"><PhoneOff size={14} /></button>
              <button className="icon close" aria-label="Dismiss"><X size={15} /></button>
            </div>
          </div>
          <div className="current-alert">
            <AlertTriangle size={16} />
            <div>
              <strong>Urgent — repeated caller</strong>
              This caller has called 11 times today and the last call was not handled. Answer this call as a priority.
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
import { ArrowRight, Building2, Phone, PhoneIncoming, Sparkles, User } from "lucide-react";
import "./_group.css";

const phone = "+421918751470";

export function Current() {
  return (
    <div className="caller-card-current">
      <div className="cc-backdrop" aria-label="Incoming call contact selection">
        <section className="cc-dialog" role="dialog" aria-modal="true" aria-labelledby="cc-title">
          <header className="cc-header">
            <h1 id="cc-title" className="cc-title">
              <span className="cc-incoming-icon"><PhoneIncoming size={20} /></span>
              Vyberte kontakt pre hovor
            </h1>
            <p className="cc-description">
              Číslo {phone} je priradené viacerým kontaktom. Vyberte, ku komu chcete tento hovor priradiť.
            </p>
            <span className="cc-number"><Phone /><code>{phone}</code></span>
          </header>

          <div className="cc-list">
            <div className="cc-remembered">
              <Sparkles size={16} />
              Pri tomto čísle ste naposledy otvorili túto kartu.
            </div>

            <button type="button" className="cc-match is-remembered">
              <span className="cc-recommended"><Sparkles size={12} /> Posledná otvorená karta</span>
              <span className="cc-avatar clinic"><Building2 size={18} /></span>
              <span className="cc-match-copy">
                <span className="cc-name">Tes Klinika Viva</span>
                <span className="cc-subtype">MUDr. Peter Seman</span>
              </span>
              <span className="cc-badge clinic">Klinika</span>
              <ArrowRight className="cc-arrow" size={16} />
            </button>

            <button type="button" className="cc-match">
              <span className="cc-avatar customer"><User size={18} /></span>
              <span className="cc-match-copy">
                <span className="cc-name">Drahoslava Drastíková</span>
              </span>
              <span className="cc-badge customer">Zákazník</span>
              <ArrowRight className="cc-arrow" size={16} />
            </button>
          </div>

          <footer className="cc-footer">
            <button type="button" className="cc-skip">Preskočiť</button>
          </footer>
        </section>
      </div>
    </div>
  );
}
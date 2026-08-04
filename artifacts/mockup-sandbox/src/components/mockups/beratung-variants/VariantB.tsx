// Variant B — Clinical Card
// Concept: structured medical report feel. Teal header, grid metadata, clean sections.
// Translations get flag-labeled rows in a unified table-like layout.

const DATA = {
  fromName: "A1 MOBILBOX",
  fromAddress: "vms@a1.net",
  received: "3. 8. 2026 · 12:57",
  subject: "Neue Nachricht von +421 917 861 041",
  aiSummary: "Michele Kolar volá z nemocnice Santa Maria Maggiore v Miláne. Dnes ráno o 5:00 sa uskutočnil pôrod — žiada rýchly transport. Upozorňuje, aby sa preprava nezdržovala ako naposledy.",
  transcript: "Dobrý večer, volám sa Michele Kolar, volám z nemocnice Santa Maria Maggiore v Miláne a dnes ráno o 5:00 sme mali pôrod, takže čakáme na rýchlu prepravu. Prosím, snažte sa nečakať ďalšie dva dni, ako sme to urobili naposledy. Ďakujem pekne.",
  audioName: "2026-08-03_12-57_+421917861041.mp3",
  de: "Mobilboxbenachrichtigung\n\nSie haben eine neue Nachricht in Ihrer A1 Mobilbox.\n\nVon: +421917861041 · An: +436643059080\nDatum: 03.08.2026 12:57 · Dauer: 20 Sek.\n\nIhr A1 Team",
  sk: "Mobilboxová notifikácia\n\nMáte novú správu vo svojej A1 mobilnej schránke.\n\nOd: +421917861041 · Do: +436643059080\nDátum: 03.08.2026 12:57 · Dĺžka: 20 sek.\n\nVáš A1 tím",
  cs: "Mobilboxová zpráva\n\nMáte novou zprávu ve své A1 mobilní schránce.\n\nOd: +421917861041 · Komu: +436643059080\nDatum: 03.08.2026 12:57 · Délka: 20 sek.\n\nVáš tím A1",
};

const pre = { whiteSpace: "pre-wrap" as const };

function MetaRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #f0faf9" }}>
      <div style={{ width: 80, flexShrink: 0, padding: "9px 12px 9px 0", fontSize: 10, fontWeight: 700, color: "#5eead4", textTransform: "uppercase" as const, letterSpacing: 0.6 }}>{label}</div>
      <div style={{ padding: "9px 0", fontSize: 12.5, color: "#0f172a", fontWeight: 600 }}>
        {value}{sub && <span style={{ fontSize: 11, fontWeight: 400, color: "#64748b", marginLeft: 8 }}>{sub}</span>}
      </div>
    </div>
  );
}

export function VariantB() {
  return (
    <div style={{ background: "#ecfdf5", minHeight: "100vh", padding: "32px 16px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 20px rgba(0,180,120,0.10)" }}>

          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #0d9488 0%, #0891b2 100%)", padding: "22px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Logo mark */}
                <div style={{ width: 40, height: 40, background: "rgba(255,255,255,0.15)", borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>ix</span>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: -0.3 }}>indexus</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: 500, letterSpacing: 0.4, marginTop: 1 }}>BERATUNG MONITOR</div>
                </div>
              </div>
              <div style={{ textAlign: "right" as const }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#a7f3d0", textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 2 }}>Status</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", padding: "3px 10px", borderRadius: 20 }}>✓ Preposlané</div>
              </div>
            </div>
          </div>

          {/* Subject banner */}
          <div style={{ background: "#f0fdfa", borderBottom: "1px solid #ccfbf1", padding: "14px 28px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0d9488", textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 4 }}>Predmet správy</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>{DATA.subject}</div>
          </div>

          {/* Meta grid */}
          <div style={{ padding: "4px 28px 0" }}>
            <MetaRow label="Od" value={DATA.fromName} sub={DATA.fromAddress} />
            <MetaRow label="Prijaté" value={DATA.received} />
            <MetaRow label="Súbor" value={DATA.audioName} />
          </div>

          {/* AI Analysis */}
          <div style={{ margin: "16px 28px 0", background: "#f0fdfa", border: "1.5px solid #5eead4", borderRadius: 10 }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #ccfbf1", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 22, height: 22, background: "linear-gradient(135deg,#0d9488,#0891b2)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 900, color: "#fff", letterSpacing: -0.3 }}>ix</div>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#0d9488", textTransform: "uppercase" as const, letterSpacing: 0.8 }}>Analýza hlasovej správy</span>
            </div>
            <div style={{ padding: "12px 16px", fontSize: 13, lineHeight: 1.65, color: "#134e4a" }}>{DATA.aiSummary}</div>
          </div>

          {/* Transcript */}
          <div style={{ margin: "12px 28px 0" }}>
            <div style={{ border: "1px solid #fde68a", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ background: "#fefce8", padding: "8px 14px", borderBottom: "1px solid #fde68a", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 6, height: 6, background: "#f59e0b", borderRadius: "50%" }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase" as const, letterSpacing: 0.7 }}>Prepis hlasovej správy</span>
              </div>
              <div style={{ padding: "12px 16px", fontSize: 12.5, lineHeight: 1.65, color: "#78350f", ...pre }}>{DATA.transcript}</div>
            </div>
          </div>

          {/* Translations — unified card with language tabs */}
          <div style={{ margin: "16px 28px 20px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 8 }}>Preklady</div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
              {[
                { lang: "DE", flag: "🇩🇪", label: "Originál · Nemčina", text: DATA.de, accent: "#475569", bg: "#f8fafc", italic: true },
                { lang: "SK", flag: "🇸🇰", label: "Slovenčina", text: DATA.sk, accent: "#7c3aed", bg: "#faf5ff", italic: false },
                { lang: "CS", flag: "🇨🇿", label: "Čeština", text: DATA.cs, accent: "#0369a1", bg: "#eff6ff", italic: false },
              ].map(({ lang, flag, label, text, accent, bg, italic }, i, arr) => (
                <div key={lang} style={{ borderBottom: i < arr.length - 1 ? "1px solid #e2e8f0" : "none" }}>
                  <div style={{ background: bg, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{flag}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: accent }}>{lang}</span>
                    <span style={{ fontSize: 10.5, color: "#94a3b8" }}>·</span>
                    <span style={{ fontSize: 10.5, color: "#64748b" }}>{label}</span>
                  </div>
                  <div style={{ padding: "10px 16px 12px 16px", fontSize: 12, lineHeight: 1.65, color: "#334155", fontStyle: italic ? "italic" as const : "normal" as const, ...pre }}>{text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "12px 28px 14px", borderTop: "2px solid #f0fdfa", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: "#94a3b8" }}>indexus · beratung@cordbloodcenter.com</span>
            <span style={{ fontSize: 10, color: "#cbd5e1" }}>03.08.2026, 13:04</span>
          </div>
        </div>
      </div>
    </div>
  );
}

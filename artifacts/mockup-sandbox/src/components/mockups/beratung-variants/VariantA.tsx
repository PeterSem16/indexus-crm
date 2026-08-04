// Variant A — Inbox Clean
// Concept: ultra-readable transactional email. No dark headers, no heavy color blocks.
// Single blue accent. Languages as clean pill-labeled sections with thin left-rule only.

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

export function VariantA() {
  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", padding: "32px 16px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>

        {/* Logo row above card */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, padding: "0 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, background: "#1d4ed8", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: "#fff", letterSpacing: -0.3 }}>IX</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>indexus</span>
            <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>/ Beratung Monitor</span>
          </div>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>3. 8. 2026, 13:04</span>
        </div>

        {/* Main card */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>

          {/* Blue top stripe */}
          <div style={{ height: 3, background: "linear-gradient(90deg, #1d4ed8, #3b82f6)" }} />

          {/* Subject + sender block */}
          <div style={{ padding: "24px 28px 20px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a", lineHeight: 1.3, flex: 1 }}>
                {DATA.subject}
              </h1>
              <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "3px 10px", borderRadius: 20 }}>
                ✓ PREPOSLANÉ
              </span>
            </div>

            {/* Sender + date chips */}
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "5px 10px" }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: "#1d4ed8" }}>A1</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#1e293b" }}>{DATA.fromName}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>{DATA.fromAddress}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "5px 10px" }}>
                <span style={{ fontSize: 13 }}>🕐</span>
                <div style={{ fontSize: 11, color: "#475569" }}>{DATA.received}</div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "#f1f5f9", margin: "0 28px" }} />

          {/* AI Summary */}
          <div style={{ padding: "20px 28px" }}>
            <div style={{ borderLeft: "3px solid #1d4ed8", paddingLeft: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div style={{ width: 18, height: 18, background: "#1d4ed8", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7.5, fontWeight: 900, color: "#fff", letterSpacing: -0.3 }}>ix</div>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" as const, letterSpacing: 0.8 }}>Zhrnutie hlasovej správy</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: "#1e293b" }}>{DATA.aiSummary}</p>
            </div>
          </div>

          {/* Transcript */}
          <div style={{ padding: "0 28px 20px" }}>
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "7px 14px", borderBottom: "1px solid #fde68a", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12 }}>🎙</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase" as const, letterSpacing: 0.6 }}>Prepis · {DATA.audioName}</span>
              </div>
              <div style={{ padding: "12px 16px", fontSize: 12.5, lineHeight: 1.65, color: "#78350f", ...pre }}>{DATA.transcript}</div>
            </div>
          </div>

          {/* Translations */}
          <div style={{ background: "#f8fafc", padding: "16px 28px 20px", borderTop: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 12 }}>
              Preklady
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
              {[
                { lang: "DE", label: "Originál · Nemčina", text: DATA.de, accent: "#64748b", italic: true },
                { lang: "SK", label: "Slovenčina", text: DATA.sk, accent: "#7c3aed", italic: false },
                { lang: "CS", label: "Čeština", text: DATA.cs, accent: "#0369a1", italic: false },
              ].map(({ lang, label, text, accent, italic }) => (
                <div key={lang} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{ display: "inline-block", padding: "1px 7px", background: accent + "18", border: `1px solid ${accent}40`, borderRadius: 4, fontSize: 9.5, fontWeight: 800, color: accent, letterSpacing: 0.5 }}>{lang}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: "#64748b" }}>{label}</span>
                  </div>
                  <div style={{ padding: "10px 14px", fontSize: 12, lineHeight: 1.6, color: "#334155", fontStyle: italic ? "italic" as const : "normal" as const, ...pre }}>{text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "12px 28px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#cbd5e1" }}>indexus Beratung · beratung@cordbloodcenter.com</span>
            <span style={{ fontSize: 10, color: "#cbd5e1" }}>03.08.2026, 13:04</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Variant C — Messenger Thread
// Concept: each language translation = a chat bubble with a flag avatar.
// Dark left sidebar holds all metadata. Right panel is a clean message thread.
// AI summary = a special "ix assistant" bubble at the top.

const DATA = {
  fromName: "A1 MOBILBOX",
  fromAddress: "vms@a1.net",
  received: "3. 8. 2026 · 12:57",
  subject: "Neue Nachricht von +421 917 861 041",
  aiSummary: "Michele Kolar volá z nemocnice Santa Maria Maggiore v Miláne. Dnes ráno o 5:00 sa uskutočnil pôrod — žiada rýchly transport. Upozorňuje, aby sa preprava nezdržovala ako naposledy.",
  transcript: "Dobrý večer, volám sa Michele Kolar, volám z nemocnice Santa Maria Maggiore v Miláne a dnes ráno o 5:00 sme mali pôrod, takže čakáme na rýchlu prepravu. Prosím, snažte sa nečakať ďalšie dva dni, ako sme to urobili naposledy. Ďakujem pekne.",
  audioName: "+421917861041.mp3",
  de: "Mobilboxbenachrichtigung\n\nSie haben eine neue Nachricht in Ihrer A1 Mobilbox.\n\nVon: +421917861041 · An: +436643059080\nDatum: 03.08.2026 12:57 · Dauer: 20 Sek.\n\nIhr A1 Team",
  sk: "Mobilboxová notifikácia\n\nMáte novú správu vo svojej A1 mobilnej schránke.\n\nOd: +421917861041 · Do: +436643059080\nDátum: 03.08.2026 12:57 · Dĺžka: 20 sek.\n\nVáš A1 tím",
  cs: "Mobilboxová zpráva\n\nMáte novou zprávu ve své A1 mobilní schránce.\n\nOd: +421917861041 · Komu: +436643059080\nDatum: 03.08.2026 12:57 · Délka: 20 sek.\n\nVáš tím A1",
};

const pre = { whiteSpace: "pre-wrap" as const };

function Avatar({ emoji, size = 32, bg }: { emoji: string; size?: number; bg: string }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2.5, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.48, flexShrink: 0 }}>
      {emoji}
    </div>
  );
}

function Bubble({ children, accent, bg, light }: { children: React.ReactNode; accent: string; bg: string; light?: boolean }) {
  return (
    <div style={{ background: bg, border: `1px solid ${accent}30`, borderRadius: "4px 14px 14px 14px", padding: "12px 16px", flex: 1 }}>
      {children}
    </div>
  );
}

export function VariantC() {
  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", padding: "28px 16px", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 620, margin: "0 auto", background: "#1e293b", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 40px rgba(0,0,0,0.5)" }}>

        {/* Top bar */}
        <div style={{ background: "#0f172a", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e293b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#fff", letterSpacing: -0.3 }}>ix</div>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>indexus</span>
              <span style={{ fontSize: 10, color: "#475569", marginLeft: 6 }}>/ Beratung</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, background: "#22c55e", borderRadius: "50%", display: "inline-block" }} />
            <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>Preposlané</span>
          </div>
        </div>

        {/* Meta strip */}
        <div style={{ background: "#0f172a", padding: "14px 24px 16px", borderBottom: "1px solid #334155" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.3, marginBottom: 10 }}>{DATA.subject}</div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
            {[
              { icon: "📨", text: `${DATA.fromName} · ${DATA.fromAddress}` },
              { icon: "🕐", text: DATA.received },
              { icon: "🎙", text: DATA.audioName },
            ].map(({ icon, text }) => (
              <span key={text} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#94a3b8", background: "#1e293b", border: "1px solid #334155", padding: "3px 9px", borderRadius: 20 }}>
                <span style={{ fontSize: 11 }}>{icon}</span> {text}
              </span>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column" as const, gap: 16 }}>

          {/* ix assistant bubble — AI summary */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#fff", flexShrink: 0, letterSpacing: -0.3 }}>ix</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", textTransform: "uppercase" as const, letterSpacing: 0.7, marginBottom: 5 }}>Indexus · Zhrnutie hlasovej správy</div>
              <div style={{ background: "linear-gradient(135deg, #1e1b4b, #312e81)", border: "1px solid #4338ca40", borderRadius: "4px 14px 14px 14px", padding: "12px 16px" }}>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: "#c7d2fe" }}>{DATA.aiSummary}</p>
              </div>
            </div>
          </div>

          {/* Transcript bubble */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Avatar emoji="🎙" size={32} bg="#292524" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase" as const, letterSpacing: 0.7, marginBottom: 5 }}>Prepis hlasovej správy</div>
              <div style={{ background: "#1c1917", border: "1px solid #d9770620", borderRadius: "4px 14px 14px 14px", padding: "12px 16px" }}>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: "#a8a29e", ...pre }}>{DATA.transcript}</p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: "#1e293b" }} />
            <span style={{ fontSize: 10, color: "#334155", fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase" as const }}>Preklady</span>
            <div style={{ flex: 1, height: 1, background: "#1e293b" }} />
          </div>

          {/* Language bubbles */}
          {[
            { emoji: "🇩🇪", lang: "DE", label: "Originál · Nemčina", text: DATA.de, nameColor: "#94a3b8", bubbleBg: "#0f172a", textColor: "#64748b", italic: true },
            { emoji: "🇸🇰", lang: "SK", label: "Slovenčina", text: DATA.sk, nameColor: "#a78bfa", bubbleBg: "#1a1035", textColor: "#c4b5fd", italic: false },
            { emoji: "🇨🇿", lang: "CS", label: "Čeština", text: DATA.cs, nameColor: "#60a5fa", bubbleBg: "#0c1929", textColor: "#93c5fd", italic: false },
          ].map(({ emoji, lang, label, text, nameColor, bubbleBg, textColor, italic }) => (
            <div key={lang} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Avatar emoji={emoji} size={32} bg="#1e293b" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: nameColor, textTransform: "uppercase" as const, letterSpacing: 0.7, marginBottom: 5 }}>
                  {lang} <span style={{ fontWeight: 400, color: "#475569" }}>· {label}</span>
                </div>
                <div style={{ background: bubbleBg, border: "1px solid #334155", borderRadius: "4px 14px 14px 14px", padding: "12px 16px" }}>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: textColor, fontStyle: italic ? "italic" as const : "normal", ...pre }}>{text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 24px 16px", borderTop: "1px solid #1e293b", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, color: "#334155" }}>indexus · beratung@cordbloodcenter.com</span>
          <span style={{ fontSize: 10, color: "#334155" }}>03.08.2026, 13:04</span>
        </div>
      </div>
    </div>
  );
}

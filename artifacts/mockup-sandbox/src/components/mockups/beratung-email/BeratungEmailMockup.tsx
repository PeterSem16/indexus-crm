export default function BeratungEmailMockup() {
  const fromName = "A1 MOBILBOX";
  const fromAddress = "vms@a1.net";
  const receivedStr = "3. 8. 2026 o 12:57:24";
  const subject = "Neue Nachricht von +421917861041";
  const forwardedAt = "03.08.2026, 13:04";

  const compactText = (t: string) => t.replace(/(\n){3,}/g, "\n\n").trim();

  const originalDE = compactText(`Mobilboxbenachrichtigung\n\nSie haben eine neue Nachricht in Ihrer A1 Mobilbox.\n\nVon: +421917861041\nAn: +436643059080\nDatum: 03/08/2026 12:57 hod.\nDauer: 20.48 Sekunden\n\nIhr A1 Team`);
  const translatedSK = compactText(`Mobilboxová notifikácia\n\nMáte novú správu vo svojej A1 mobilnej schránke.\n\nOd: +421917861041\nDo: +436643059080\nDátum: 03/08/2026 12:57 hod.\nDĺžka: 20.48 sekúnd\n\nVáš A1 tím`);
  const translatedCS = compactText(`Mobilboxová zpráva\n\nMáte novou zprávu ve své A1 mobilní schránce.\n\nOd: +421917861041\nKomu: +436643059080\nDatum: 03/08/2026 12:57 hod.\nDélka: 20.48 sekund\n\nVáš tím A1`);
  const aiSummary = "Michele Kolar volá z nemocnice Santa Maria Maggiore v Miláne, kde sa dnes ráno o 5:60 uskutočnil pôrod. Žiada o rýchly transport a upozorňuje, aby sa preprava nezdržovala, ako to bolo pri poslednej príležitosti.";
  const transcript = "Dobrý večer, volám sa Michele Kolar, volám z nemocnice Santa Maria Maggiore v Miláne a dnes ráno o 5:60 sme mali pôrod, takže čakáme na rýchlu prepravu. Prosím, snažte sa nečakať ďalšie dva dni, ako sme to urobili naposledy. Ďakujem pekne.";
  const audioName = "2026-08-03_12-57-13_+421917861041.mp3";

  const cardStyle = (border: string, bg: string) => ({
    borderRadius: 10, overflow: "hidden" as const, border: `1px solid ${border}`, marginBottom: 0,
  });
  const headerStyle = (bg: string, border: string) => ({
    background: bg, padding: "8px 14px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 8,
  });
  const dot = (color: string) => (
    <span style={{ display: "inline-block", width: 6, height: 6, background: color, borderRadius: "50%", flexShrink: 0 }} />
  );
  const label = (color: string, text: string, sub?: string) => (
    <span style={{ fontSize: 9.5, fontWeight: 700, color, textTransform: "uppercase" as const, letterSpacing: 0.8 }}>
      {text}{sub && <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 8 }}>{sub}</span>}
    </span>
  );
  const body = (color: string, border: string, text: string, italic?: boolean) => (
    <div style={{ padding: "12px 14px 12px 18px", fontSize: 12.5, lineHeight: 1.5, color, borderLeft: `3px solid ${border}`, fontStyle: italic ? "italic" : "normal", whiteSpace: "pre-wrap" as const }}>
      {text}
    </div>
  );

  return (
    <div style={{ background: "#f4f4f5", minHeight: "100vh", padding: "28px 12px", fontFamily: "'Segoe UI', system-ui, -apple-system, Arial, sans-serif" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", background: "#ffffff", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.08)" }}>

        {/* RED STRIPE */}
        <div style={{ background: "linear-gradient(90deg,#e11d48 0%,#f43f5e 50%,#fb7185 100%)", height: 4 }} />

        {/* HEADER */}
        <div style={{ background: "#111827", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>indexus</span>
            <span style={{ display: "inline-block", marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#f43f5e", background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.3)", padding: "2px 9px", borderRadius: 20, letterSpacing: 0.4 }}>BERATUNG</span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", padding: "3px 12px", borderRadius: 20, letterSpacing: 0.6 }}>PREPOSLANÉ</span>
        </div>

        {/* META */}
        <div style={{ padding: "18px 24px 14px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ paddingBottom: 8, paddingRight: 12, verticalAlign: "top", whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.7 }}>Od</span>
                </td>
                <td style={{ paddingBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{fromName}</span>
                  <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>{fromAddress}</span>
                </td>
              </tr>
              <tr>
                <td style={{ paddingBottom: 8, paddingRight: 12, whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.7 }}>Dátum</span>
                </td>
                <td style={{ paddingBottom: 8, fontSize: 12, color: "#6b7280" }}>{receivedStr}</td>
              </tr>
              <tr>
                <td style={{ paddingRight: 12, verticalAlign: "top", whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.7 }}>Predmet</span>
                </td>
                <td style={{ fontSize: 15, fontWeight: 700, color: "#111827", lineHeight: 1.4 }}>{subject}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* AI SUMMARY — "ix" badge */}
        <div style={{ padding: "0 24px 4px" }}>
          <div style={{ background: "linear-gradient(135deg,#fff1f2 0%,#fce7f3 100%)", border: "1px solid #fda4af", borderRadius: 12, padding: "14px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ flexShrink: 0, width: 32, height: 32, background: "linear-gradient(135deg,#e11d48,#be185d)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>ix</div>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: "#be185d", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>indexus · Zhrnutie hlasovej správy</div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: "#4c0519" }}>{aiSummary}</div>
            </div>
          </div>
        </div>

        {/* TRANSCRIPT — amber card, same style as language cards */}
        <div style={{ padding: "8px 24px 0" }}>
          <div style={cardStyle("#fef3c7", "#fffbeb")}>
            <div style={headerStyle("#fffbeb", "#fef3c7")}>
              {dot("#f59e0b")}
              {label("#92400e", "Hlasová správa · Prepis", audioName)}
            </div>
            {body("#78350f", "#fcd34d", transcript)}
          </div>
        </div>

        {/* TRANSLATIONS HEADER */}
        <div style={{ padding: "16px 24px 0" }}>
          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8 }}>Preklady</span>
            <span style={{ fontSize: 10, color: "#d1d5db" }}>DE · SK · CS</span>
          </div>
        </div>

        {/* DE */}
        <div style={{ padding: "12px 24px 0" }}>
          <div style={cardStyle("#f3f4f6", "#f9fafb")}>
            <div style={headerStyle("#f9fafb", "#f3f4f6")}>
              {dot("#9ca3af")}
              {label("#9ca3af", "Originál · DE")}
            </div>
            {body("#6b7280", "#e5e7eb", originalDE, true)}
          </div>
        </div>

        {/* SK */}
        <div style={{ padding: "10px 24px 0" }}>
          <div style={cardStyle("#ede9fe", "#f5f3ff")}>
            <div style={headerStyle("#f5f3ff", "#ede9fe")}>
              {dot("#8b5cf6")}
              {label("#7c3aed", "Slovenčina · SK")}
            </div>
            {body("#4c1d95", "#8b5cf6", translatedSK)}
          </div>
        </div>

        {/* CS */}
        <div style={{ padding: "10px 24px 0" }}>
          <div style={cardStyle("#fce7f3", "#fdf2f8")}>
            <div style={headerStyle("#fdf2f8", "#fce7f3")}>
              {dot("#ec4899")}
              {label("#be185d", "Čeština · CS")}
            </div>
            {body("#831843", "#ec4899", translatedCS)}
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ padding: "20px 24px 22px" }}>
          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10.5, color: "#9ca3af" }}>
              <span style={{ fontWeight: 700, color: "#6b7280" }}>indexus</span> Beratung Monitor · beratung@cordbloodcenter.com
            </span>
            <span style={{ fontSize: 10, color: "#d1d5db", whiteSpace: "nowrap" }}>{forwardedAt}</span>
          </div>
        </div>

      </div>
    </div>
  );
}

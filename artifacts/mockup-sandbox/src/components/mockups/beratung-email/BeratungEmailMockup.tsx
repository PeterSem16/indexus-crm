export default function BeratungEmailMockup() {
  const fromName = "Müller Consulting GmbH";
  const fromAddress = "info@mueller-consulting.de";
  const receivedStr = "3. 8. 2026 o 09:14 (SEČ)";
  const subject = "Anfrage Nabelschnurblut-Lagerung für unser Kind";
  const forwardedAt = "03.08.2026, 09:31";

  const originalDE = `Sehr geehrte Damen und Herren,\n\nwir erwarten im Oktober unser erstes Kind und interessieren uns für die Möglichkeit, das Nabelschnurblut einlagern zu lassen. Könnten Sie uns bitte Informationen über Ihre Leistungen, Kosten und den Ablauf zusenden?\n\nMit freundlichen Grüßen,\nFamilie Müller`;
  const translatedSK = `Vážená pani, vážený pán,\n\nv októbri čakáme naše prvé dieťa a zaujímame sa o možnosť uloženia pupočníkovej krvi. Mohli by ste nám prosím zaslať informácie o vašich službách, cenách a postupe?\n\nS pozdravom,\nRodina Müllerová`;
  const translatedCS = `Vážená paní, vážený pane,\n\nv říjnu očekáváme naše první dítě a zajímáme se o možnost uložení pupečníkové krve. Mohli byste nám prosím zaslat informace o vašich službách, cenách a postupu?\n\nS pozdravem,\nRodina Müllerová`;
  const aiSummary = "Rodina Müllerových čaká prvé dieťa v októbri a má záujem o uloženie pupočníkovej krvi. Žiadajú informácie o službách, cenách a procese. Vhodné pre priamy kontakt konzultanta SK.";
  const transcript = "Dobrý deň, volám ohľadom uloženia pupočníkovej krvi. Chceli by sme vedieť viac o vašich balíčkoch a cenách. Dcéra sa narodí v októbri, takže nám veľmi záleží na rýchlej odpovedi. Ďakujem.";

  return (
    <div style={{ background: "#f4f4f5", minHeight: "100vh", padding: "28px 12px", fontFamily: "'Segoe UI', system-ui, -apple-system, Arial, sans-serif" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", background: "#ffffff", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.08)" }}>

        {/* RED ACCENT STRIPE */}
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
                <td style={{ paddingBottom: 9, paddingRight: 12, verticalAlign: "top", whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.7 }}>Od</span>
                </td>
                <td style={{ paddingBottom: 9 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{fromName}</span>
                  <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>{fromAddress}</span>
                </td>
              </tr>
              <tr>
                <td style={{ paddingBottom: 9, paddingRight: 12, verticalAlign: "top", whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.7 }}>Dátum</span>
                </td>
                <td style={{ paddingBottom: 9, fontSize: 12, color: "#6b7280" }}>{receivedStr}</td>
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

        {/* AI SUMMARY */}
        <div style={{ padding: "0 24px 4px" }}>
          <div style={{ background: "linear-gradient(135deg,#fff1f2 0%,#fce7f3 100%)", border: "1px solid #fda4af", borderRadius: 12, padding: "16px 20px", display: "flex", gap: 14 }}>
            <div style={{ flexShrink: 0, width: 34, height: 34, background: "linear-gradient(135deg,#e11d48,#be185d)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff", letterSpacing: -0.3 }}>AI</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#be185d", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Zhrnutie hlasovej správy</div>
              <div style={{ fontSize: 13, lineHeight: 1.65, color: "#4c0519" }}>{aiSummary}</div>
            </div>
          </div>
        </div>

        {/* TRANSCRIPT */}
        <div style={{ padding: "8px 24px 0" }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ background: "#f9fafb", padding: "10px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-block", width: 8, height: 8, background: "#e11d48", borderRadius: "50%" }} />
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.8 }}>Prepis hlasovej správy</span>
            </div>
            <div style={{ padding: "14px 16px 14px 20px", fontSize: 12.5, lineHeight: 1.75, color: "#6b7280", borderLeft: "3px solid #e5e7eb", whiteSpace: "pre-wrap" }}>{transcript}</div>
          </div>
        </div>

        {/* DIVIDER */}
        <div style={{ padding: "16px 24px 0" }}>
          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8 }}>Preklady</span>
            <span style={{ fontSize: 10, color: "#d1d5db" }}>DE · SK · CS</span>
          </div>
        </div>

        {/* ORIGINAL DE */}
        <div style={{ padding: "12px 24px 0" }}>
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #f3f4f6" }}>
            <div style={{ background: "#f9fafb", padding: "8px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-block", width: 6, height: 6, background: "#9ca3af", borderRadius: "50%" }} />
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8 }}>Originál · DE</span>
            </div>
            <div style={{ padding: "14px 16px 14px 20px", fontSize: 13, lineHeight: 1.75, color: "#6b7280", fontStyle: "italic", borderLeft: "3px solid #e5e7eb", whiteSpace: "pre-wrap" }}>{originalDE}</div>
          </div>
        </div>

        {/* SK */}
        <div style={{ padding: "10px 24px 0" }}>
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #ede9fe" }}>
            <div style={{ background: "#f5f3ff", padding: "8px 14px", borderBottom: "1px solid #ede9fe", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-block", width: 6, height: 6, background: "#8b5cf6", borderRadius: "50%" }} />
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 0.8 }}>Slovenčina · SK</span>
            </div>
            <div style={{ padding: "14px 16px 14px 20px", fontSize: 13, lineHeight: 1.75, color: "#4c1d95", borderLeft: "3px solid #8b5cf6", whiteSpace: "pre-wrap" }}>{translatedSK}</div>
          </div>
        </div>

        {/* CS */}
        <div style={{ padding: "10px 24px 0" }}>
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #fce7f3" }}>
            <div style={{ background: "#fdf2f8", padding: "8px 14px", borderBottom: "1px solid #fce7f3", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-block", width: 6, height: 6, background: "#ec4899", borderRadius: "50%" }} />
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#be185d", textTransform: "uppercase", letterSpacing: 0.8 }}>Čeština · CS</span>
            </div>
            <div style={{ padding: "14px 16px 14px 20px", fontSize: 13, lineHeight: 1.75, color: "#831843", borderLeft: "3px solid #ec4899", whiteSpace: "pre-wrap" }}>{translatedCS}</div>
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

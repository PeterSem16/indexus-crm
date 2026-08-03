/**
 * Beratung Email — Redesigned forwarded email template
 * Shows what the forwarded HTML email will look like in a mail client.
 */

export default function BeratungEmailMockup() {
  return (
    <div style={{ background: "#f1f5f9", minHeight: "100vh", padding: "32px 16px", fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
      <div style={{ maxWidth: 660, margin: "0 auto" }}>

        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%)",
          borderRadius: "16px 16px 0 0",
          padding: "24px 32px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>indexus</span>
              <span style={{
                fontSize: 11, fontWeight: 600, color: "#93c5fd",
                background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
                padding: "2px 10px", borderRadius: 20,
              }}>Beratung Monitor</span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#bfdbfe", opacity: 0.8 }}>beratung@cordbloodcenter.com</p>
          </div>
          <div style={{
            background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.5)",
            color: "#6ee7b7", fontSize: 11, fontWeight: 700,
            padding: "5px 14px", borderRadius: 20, letterSpacing: "0.5px",
          }}>
            ✉ PREPOSLANÉ
          </div>
        </div>

        {/* ─── Meta card ───────────────────────────────────────────────────── */}
        <div style={{ background: "#fff", padding: "20px 32px 16px", borderLeft: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["Od", "Müller Consulting GmbH", "#1e293b", 600],
                ["Adresa", "info@mueller-consulting.de", "#3b82f6", 400],
                ["Dátum", "3. 8. 2026 o 09:14 (SEČ)", "#475569", 400],
                ["Predmet", "Anfrage Nabelschnurblut-Lagerung für unser Kind", "#0f172a", 700],
              ].map(([label, value, color, weight]) => (
                <tr key={String(label)}>
                  <td style={{ paddingRight: 20, paddingBottom: 6, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", verticalAlign: "top", whiteSpace: "nowrap" }}>
                    {label}
                  </td>
                  <td style={{ paddingBottom: 6, fontSize: 13.5, fontWeight: Number(weight), color: String(color) }}>
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ─── Language pills ──────────────────────────────────────────────── */}
        <div style={{
          background: "#fff", padding: "0 32px",
          borderLeft: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0",
        }}>
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 14, paddingBottom: 14, display: "flex", gap: 8 }}>
            {[
              { flag: "🇩🇪", label: "Originál (DE)", active: false, bg: "#f8fafc", border: "#e2e8f0", text: "#475569" },
              { flag: "🇸🇰", label: "Slovenčina",   active: true,  bg: "#eff6ff", border: "#3b82f6", text: "#1d4ed8" },
              { flag: "🇨🇿", label: "Čeština",      active: false, bg: "#fef2f2", border: "#dc2626", text: "#b91c1c" },
            ].map(p => (
              <div key={p.label} style={{
                fontSize: 11.5, fontWeight: p.active ? 700 : 500,
                color: p.text, background: p.bg,
                border: `1.5px solid ${p.border}`,
                borderRadius: 8, padding: "4px 12px",
                display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
                boxShadow: p.active ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}>
                <span style={{ fontSize: 14 }}>{p.flag}</span> {p.label}
              </div>
            ))}
          </div>
        </div>

        {/* ─── Original (DE) ───────────────────────────────────────────────── */}
        <div style={{
          background: "#f8fafc", padding: "20px 32px",
          borderLeft: "4px solid #94a3b8", borderRight: "1px solid #e2e8f0",
          borderTop: "1px solid #e2e8f0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>🇩🇪</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Originálny text
            </span>
          </div>
          {/* Blockquote styling */}
          <div style={{
            borderLeft: "3px solid #cbd5e1", paddingLeft: 16, margin: 0,
            fontStyle: "italic", fontSize: 13.5, lineHeight: 1.75, color: "#374151",
          }}>
            <p style={{ margin: "0 0 10px" }}>Sehr geehrte Damen und Herren,</p>
            <p style={{ margin: "0 0 10px" }}>
              wir erwarten im Oktober unser erstes Kind und interessieren uns für die Möglichkeit,
              das Nabelschnurblut einlagern zu lassen. Könnten Sie uns bitte Informationen
              über Ihre Leistungen, Kosten und den Ablauf zusenden?
            </p>
            <p style={{ margin: 0 }}>Mit freundlichen Grüßen,<br />Familie Müller</p>
          </div>
        </div>

        {/* ─── SK Translation ──────────────────────────────────────────────── */}
        <div style={{
          background: "#eff6ff", padding: "20px 32px",
          borderLeft: "4px solid #3b82f6", borderRight: "1px solid #e2e8f0",
          borderTop: "1px solid #dbeafe",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>🇸🇰</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Preklad — slovenčina
            </span>
          </div>
          <div style={{
            borderLeft: "3px solid #93c5fd", paddingLeft: 16,
            fontSize: 13.5, lineHeight: 1.75, color: "#1e3a8a",
          }}>
            <p style={{ margin: "0 0 10px" }}>Vážená pani, vážený pán,</p>
            <p style={{ margin: "0 0 10px" }}>
              v októbri čakáme naše prvé dieťa a zaujímame sa o možnosť uloženia pupočníkovej krvi.
              Mohli by ste nám prosím zaslať informácie o vašich službách, cenách a postupe?
            </p>
            <p style={{ margin: 0 }}>S pozdravom,<br />Rodina Müllerová</p>
          </div>
        </div>

        {/* ─── CS Translation ──────────────────────────────────────────────── */}
        <div style={{
          background: "#fef2f2", padding: "20px 32px",
          borderLeft: "4px solid #dc2626", borderRight: "1px solid #e2e8f0",
          borderTop: "1px solid #fecaca",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>🇨🇿</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#b91c1c", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Překlad — čeština
            </span>
          </div>
          <div style={{
            borderLeft: "3px solid #fca5a5", paddingLeft: 16,
            fontSize: 13.5, lineHeight: 1.75, color: "#7f1d1d",
          }}>
            <p style={{ margin: "0 0 10px" }}>Vážená paní, vážený pane,</p>
            <p style={{ margin: "0 0 10px" }}>
              v říjnu očekáváme naše první dítě a zajímáme se o možnost uložení pupečníkové krve.
              Mohli byste nám prosím zaslat informace o vašich službách, cenách a postupu?
            </p>
            <p style={{ margin: 0 }}>S pozdravem,<br />Rodina Müllerová</p>
          </div>
        </div>

        {/* ─── Voicemail / transcript section (sample) ─────────────────────── */}
        <div style={{
          background: "#fffbeb", padding: "20px 32px",
          borderLeft: "4px solid #f59e0b", borderRight: "1px solid #e2e8f0",
          borderTop: "1px solid #fde68a",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>🎙️</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Hlasová správa — prepis
            </span>
          </div>

          {/* AI summary chip */}
          <div style={{
            background: "#fef3c7", border: "1px solid #fcd34d",
            borderRadius: 10, padding: "10px 14px", marginBottom: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309", marginBottom: 5 }}>
              💡 Zhrnutie (AI)
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: "#78350f" }}>
              Rodina zavolala ohľadom ceny skladovania a chcela vedieť, či je možné uzatvoriť zmluvu aj online bez návštevy pobočky.
            </div>
          </div>

          {/* Full transcript blockquote */}
          <div style={{ borderTop: "1px dashed #fcd34d", paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>
              📝 Kompletný prepis
            </div>
            <div style={{
              fontSize: 12.5, lineHeight: 1.8, color: "#92400e",
              background: "#fff8e6", borderRadius: 8, padding: "10px 14px",
              borderLeft: "3px solid #fbbf24",
              fontStyle: "italic",
            }}>
              „Dobrý deň, volám ohľadne vašej služby pupočníkovej krvi. Zaujíma ma cena a tiež
              či je možné vybaviť všetko online bez toho, aby sme museli niekam osobne prísť.
              Ďakujem, čakám na vaše vyjadrenie."
            </div>
          </div>
        </div>

        {/* ─── Footer ──────────────────────────────────────────────────────── */}
        <div style={{
          background: "#0f172a", padding: "16px 32px",
          borderRadius: "0 0 16px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 11, color: "#64748b" }}>
            Automaticky preposlané systémom <strong style={{ color: "#94a3b8" }}>indexus</strong>
          </span>
          <span style={{ fontSize: 10, color: "#475569" }}>
            3. 8. 2026 · 09:16
          </span>
        </div>

      </div>
    </div>
  );
}

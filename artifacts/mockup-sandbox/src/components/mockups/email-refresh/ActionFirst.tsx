import { useState, type ReactNode } from "react";

const ink = "#173f49";
const teal = "#087e78";
const pale = "#eaf5f1";
const border = "#d8e7e2";
const muted = "#617b7d";

type EmailProps = {
  label: string;
  subject: string;
  accent: string;
  children: ReactNode;
  preheader: string;
  onConfirm: () => void;
  ctaLabel: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

function EmailFrame({ label, subject, accent, children, preheader, onConfirm, ctaLabel, secondaryLabel, onSecondary }: EmailProps) {
  return (
    <section className="af-email-block">
      <div className="af-subjectline">
        <span className="af-subject-label">PREDMET</span>
        <span className="af-subject">{subject}</span>
      </div>
      <div className="af-mail-paper">
        <div className="af-preheader">{preheader}</div>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse", fontFamily: "Arial, Helvetica, sans-serif", color: ink }}>
          <tbody>
            <tr>
              <td style={{ padding: "20px 26px 17px", borderBottom: `1px solid ${border}` }}>
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                  <tbody><tr>
                    <td style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1.1, color: ink }}>INDEXUS<span style={{ color: accent }}> /</span></td>
                    <td align="right" style={{ color: muted, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>{label}</td>
                  </tr></tbody>
                </table>
              </td>
            </tr>
            <tr><td style={{ padding: "23px 26px 26px" }}>{children}</td></tr>
            <tr>
              <td style={{ padding: "15px 26px 18px", background: "#f4f8f6", borderTop: `1px solid ${border}`, fontSize: 11, lineHeight: "17px", color: muted }}>
                Automatické upozornenie z INDEXUS · Akcia sa vykoná po otvorení záznamu v aplikácii.
              </td>
            </tr>
          </tbody>
        </table>
        <div className="af-cta-action">
          <div className="af-cta-row">
            <button type="button" className="af-mail-cta" style={{ backgroundColor: accent }} onClick={onConfirm}>
              {ctaLabel} <span aria-hidden="true">↗</span>
            </button>
            {secondaryLabel && <button type="button" className="af-secondary-cta" onClick={onSecondary}>{secondaryLabel}</button>}
          </div>
          <span className="af-cta-note">Bez odoslania ani navigácie</span>
        </div>
      </div>
    </section>
  );
}

function Eyebrow({ children, color = teal }: { children: ReactNode; color?: string }) {
  return <div style={{ color, fontSize: 11, fontWeight: 800, letterSpacing: 1.25, textTransform: "uppercase", marginBottom: 8 }}>{children}</div>;
}

function DetailPair({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <td className="af-detail-cell" valign="top">
      <div className="af-detail-label">{label}</div>
      <div className="af-detail-value" style={emphasis ? { color: ink, fontWeight: 750 } : undefined}>{value}</div>
    </td>
  );
}

function Companion({ family, sms, notice }: { family: string; sms: string; notice: string }) {
  return (
    <div className="af-companion">
      <div className="af-companion-family">{family}</div>
      <div className="af-companion-grid">
        <div className="af-channel">
          <div className="af-channel-label"><span className="af-channel-mark sms-mark">S</span> SMS · obyčajný text</div>
          <p>{sms}</p>
        </div>
        <div className="af-channel inapp-channel">
          <div className="af-channel-label"><span className="af-channel-mark app-mark">I</span> Upozornenie v INDEXUS</div>
          <strong>{notice}</strong>
        </div>
      </div>
    </div>
  );
}

export function ActionFirst() {
  const [confirmation, setConfirmation] = useState("");

  const confirm = (what: string) => setConfirmation(`${what}: ukážka potvrdená. Nič sa neodoslalo a aplikácia sa neotvorila.`);

  return (
    <main className="af-review">
        <style>{`
        .af-review{--af-ink:${ink};--af-muted:${muted};--af-line:${border};min-height:100vh;background:#f1f6f2;color:${ink};font-family:'DM Sans',sans-serif;padding:38px 20px 72px;box-sizing:border-box}
        .af-review *{box-sizing:border-box}
        .af-wrap{max-width:820px;margin:0 auto}
        .af-topline{display:flex;align-items:center;gap:10px;color:#587775;font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase}
        .af-mark{width:29px;height:29px;border-radius:9px;background:#d4ebe3;display:grid;place-items:center;color:${teal};font:800 13px Manrope,sans-serif}
        .af-header{padding:3px 0 28px}
        .af-header h1{font:800 clamp(30px,6vw,48px)/1.04 Manrope,sans-serif;letter-spacing:-1.8px;margin:24px 0 11px;color:${ink};max-width:650px}
        .af-header p{font-size:15px;line-height:1.65;color:#587274;max-width:610px;margin:0}
        .af-header-rule{height:1px;background:#d9e7e0;margin-top:26px}
        .af-sample-meta{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:22px 0 9px}
        .af-kicker{font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:${teal}}
        .af-illustrative{font-size:11px;color:#687e79;background:#e6efea;padding:6px 10px;border-radius:999px}
        .af-email-block{margin-bottom:34px}
        .af-subjectline{display:flex;gap:12px;align-items:baseline;margin:0 0 10px;padding:0 2px}
        .af-subject-label{font-size:10px;letter-spacing:1.2px;font-weight:800;color:#73908a;flex:none}
        .af-subject{font-size:14px;font-weight:700;color:${ink};line-height:1.45}
        .af-mail-paper{max-width:700px;margin:0 auto;background:#fff;border:1px solid #d6e4de;border-radius:15px;overflow:hidden;box-shadow:0 8px 24px rgba(30,72,66,.055)}
        .af-preheader{height:0;overflow:hidden;display:none}
        .af-cta-action{padding:0 26px 23px}
        .af-cta-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .af-mail-cta{border:0;border-radius:8px;color:#fff;padding:12px 16px;font:700 13px 'DM Sans',sans-serif;cursor:pointer}
        .af-mail-cta span{margin-left:9px}
        .af-secondary-cta{border:1px solid #d1e0da;border-radius:8px;background:#fff;color:${ink};padding:11px 14px;font:700 12px 'DM Sans',sans-serif;cursor:pointer}
        .af-cta-note{margin-left:11px;color:#738a87;font-size:10px}
        .af-detail-row{background:#f1f7f4;border:1px solid ${border};border-radius:10px}
        .af-detail-cell{padding:12px 13px;width:50%}
        .af-detail-cell + .af-detail-cell{border-left:1px solid ${border}}
        .af-detail-label{font-size:10px;line-height:15px;color:#6b8580;text-transform:uppercase;letter-spacing:.8px;font-weight:800}
        .af-detail-value{font-size:13px;line-height:19px;color:${ink};margin-top:3px}
        .af-tasksignal{border-left:3px solid #d58b39;background:#fff7e9;padding:12px 14px;border-radius:0 8px 8px 0;margin-top:15px;font-size:13px;line-height:1.55;color:#516d6e}
        .af-spark{display:inline-block;width:37px;height:37px;border-radius:12px;background:#e9f4ee;color:${teal};text-align:center;line-height:37px;font-size:17px;margin-bottom:14px}
        .af-task-title{font:800 25px/1.15 Manrope,sans-serif;letter-spacing:-.8px;color:${ink};margin:0 0 8px}
        .af-copy{font-size:14px;line-height:1.65;color:#536e70;margin:0 0 17px}
        .af-steps{display:flex;gap:10px;align-items:flex-start;margin-top:15px}
        .af-stepno{width:22px;height:22px;flex:none;border-radius:7px;background:#dceee6;color:#23766f;text-align:center;font-size:11px;line-height:22px;font-weight:800}
        .af-stepcopy{font-size:12px;line-height:1.5;color:#5f7979}
        .af-stepcopy b{display:block;color:${ink};font-size:13px;margin-bottom:1px}
        .af-call-layout{border:1px solid #e8d5cb;background:#fff8f4;border-radius:12px;padding:14px 15px;display:flex;align-items:center;gap:13px;margin:17px 0}
        .af-call-glyph{width:43px;height:43px;flex:none;border-radius:50%;display:grid;place-items:center;background:#f3ddd2;color:#a44f3d;font-size:17px}
        .af-call-who{font-size:14px;font-weight:800;color:${ink}}
        .af-call-caption{font-size:11px;color:#7f7069;margin-top:3px;line-height:1.45}
        .af-call-findings{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}
        .af-finding{border-radius:7px;padding:7px 10px;font-size:11px;font-weight:700}
        .af-finding-sentiment{background:#fff0de;color:#9a6032}
        .af-finding-tone{background:#f4e8ee;color:#86576a}
        .af-call-summary{border-top:1px solid #eadfd9;padding-top:13px;color:#566c6d;font-size:13px;line-height:1.6}
        .af-deadline-panel{background:#fbf3e4;border:1px solid #ecd9b6;border-radius:11px;padding:16px;margin:17px 0}
        .af-deadline-date{font:800 20px/1.25 Manrope,sans-serif;color:#765323;letter-spacing:-.4px}
        .af-deadline-time{font-size:12px;color:#806b4e;margin-top:4px}
        .af-softflag{display:inline-block;background:#f3e3c7;color:#8b6126;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:800;letter-spacing:.4px}
        .af-meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:26px 0 0}
        .af-meta-card{padding:14px 15px;background:#e7efea;border-radius:10px}
        .af-meta-label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#718781;font-weight:800}
        .af-meta-value{font-size:11px;line-height:1.55;color:#496660;margin-top:6px}
        .af-section-title{display:flex;align-items:center;gap:13px;margin:51px 0 18px}
        .af-section-title h2{font:800 22px Manrope,sans-serif;letter-spacing:-.6px;margin:0}
        .af-section-title span{font-size:10px;letter-spacing:1.1px;color:#718981;font-weight:800}
        .af-section-title:after{content:'';height:1px;background:#d5e2db;flex:1}
        .af-companion{border-top:1px solid #d8e4dd;padding:18px 0 21px}
        .af-companion-family{font-size:12px;font-weight:800;color:#365d5b;margin-bottom:12px}
        .af-companion-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .af-channel{background:#fff;border:1px solid #dce7e1;border-radius:10px;padding:13px 14px}
        .af-channel-label{display:flex;align-items:center;gap:8px;font-size:10px;color:#6d8580;font-weight:800;letter-spacing:.3px}
        .af-channel-mark{width:20px;height:20px;display:grid;place-items:center;border-radius:6px;font-size:10px}
        .sms-mark{background:#e5eee9;color:#467168}
        .app-mark{background:#dcefeb;color:#167b72}
        .af-channel p{font-size:12px;line-height:1.55;color:#3f5e5d;margin:11px 0 0}
        .af-channel strong{display:block;font-size:13px;line-height:1.5;margin-top:10px;color:${ink}}
        .af-toast{position:sticky;bottom:14px;z-index:3;margin:18px auto 0;max-width:700px;background:#174d4b;color:white;border-radius:10px;padding:12px 15px;font-size:12px;line-height:1.5;box-shadow:0 8px 22px rgba(23,63,73,.2)}
        .af-footnote{font-size:11px;color:#78908a;line-height:1.6;margin:30px 0 0}
        @media(max-width:560px){
          .af-review{padding:22px 14px 48px}
          .af-header h1{letter-spacing:-1.2px;margin-top:19px}
          .af-subjectline{display:block}
          .af-subject-label{display:block;margin-bottom:4px}
          .af-mail-paper{border-radius:12px}
          .af-detail-cell{display:block;width:100%;padding:9px 11px}
          .af-detail-cell + .af-detail-cell{border-left:0;border-top:1px solid ${border}}
          .af-call-layout{align-items:flex-start}
          .af-companion-grid{grid-template-columns:1fr}
          .af-cta-action{padding:0 17px 19px}
          .af-mail-cta{width:100%}
          .af-secondary-cta{width:100%}
          .af-cta-note{display:block;margin:9px 0 0;text-align:center}
          .af-meta{gap:7px}
        }
      `}</style>
      <div className="af-wrap">
        <div className="af-topline"><span className="af-mark">I</span> INDEXUS · návrh automatických správ</div>
        <header className="af-header">
          <h1>Najprv ďalší krok.<br />Potom všetko ostatné.</h1>
          <p>Jedna správa, jedno jasné rozhodnutie. Predmety hovoria ľudskou rečou; zdroj a čas sú poruke, nie zahrabané v systémových poliach.</p>
          <div className="af-header-rule" />
        </header>

        <div className="af-sample-meta">
          <span className="af-kicker">A · Jasný ďalší krok</span>
          <span className="af-illustrative">Ilustračné údaje · Bratislava</span>
        </div>

        <EmailFrame
          label="Nová úloha"
          subject="Nová úloha: Faktúra za služby Ambulancie TestClinic"
          accent="#087e78"
          preheader="Michaela, skontrolujte faktúru a pripravte odpoveď do 15. októbra."
          onConfirm={() => confirm("Otvoriť úlohu")}
          ctaLabel="Otvoriť úlohu"
        >
          <Eyebrow>Čaká na vás nový krok</Eyebrow>
          <h2 className="af-task-title">Skontrolujte faktúru a pripravte odpoveď</h2>
          <p className="af-copy">Michaela, Lucia Kováčová vám pridelila úlohu k faktúre za služby Ambulancie TestClinic. Najprv si overte podklady, potom pripravte odpoveď ambulancii.</p>
          <div className="af-spark" aria-hidden="true">↗</div>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <tbody>
              <tr className="af-detail-row">
                <DetailPair label="Priradené" value="Michaela Nováková" emphasis />
                <DetailPair label="Termín" value="15. októbra 2026 · 15:00" emphasis />
              </tr>
              <tr><td colSpan={2} style={{ height: 8 }} /></tr>
              <tr className="af-detail-row">
                <DetailPair label="Priorita" value="Vysoká" />
                <DetailPair label="Pridelené od" value="Lucia Kováčová" />
              </tr>
            </tbody>
          </table>
          <div className="af-tasksignal"><b>Čo urobiť:</b> Otvorte zadanie, skontrolujte faktúru a zaznamenajte ďalší postup.</div>
          <div className="af-steps">
            <span className="af-stepno">1</span>
            <div className="af-stepcopy"><b>Otvorte zadanie</b>Celý kontext a súvisiace podklady nájdete pri úlohe.</div>
          </div>
          <p style={{ fontSize: 10, color: muted, margin: "17px 0 0" }}>Pridelené 14. októbra 2026 o 13:21</p>
        </EmailFrame>
        <div className="af-meta">
          <div className="af-meta-card"><div className="af-meta-label">Ukážka · úloha</div><div className="af-meta-value">Údaje vychádzajú zo zadania a vzorových hodnôt. Identita zadávateľky, čas, pridelenie aj termín sú zachované.</div></div>
          <div className="af-meta-card"><div className="af-meta-label">Použité zdroje</div><div className="af-meta-value">activity.title · activity.occurredAt · newValues.description · assignedUserId · createdByUserId · dueDate · priority</div></div>
        </div>

        <div className="af-section-title"><span>02 / KOMUNIKÁCIA</span><h2>Hovor, ktorý si vyžaduje pozornosť</h2></div>
        <div className="af-sample-meta">
          <span className="af-kicker" style={{ color: "#a45442" }}>Dokončený prichádzajúci hovor</span>
          <span className="af-illustrative">Fiktívny príklad · analyzovaný hovor</span>
        </div>
        <EmailFrame
          label="Hovor"
          subject="Zhrnutie hovoru s Janou Polákovou"
          accent="#a45442"
          preheader="Hovor je dokončený. Pozrite si zhrnutie a zistenia analýzy."
          onConfirm={() => confirm("Otvoriť detail hovoru")}
          ctaLabel="Otvoriť detail hovoru"
          secondaryLabel="Prehrať záznam"
          onSecondary={() => confirm("Prehrať záznam hovoru")}
        >
          <Eyebrow color="#a45442">Dokončené · prichádzajúci hovor</Eyebrow>
          <h2 className="af-task-title" style={{ fontSize: 23 }}>Jana Poláková volala o podpore ambulancie</h2>
          <p className="af-copy">Hovor prijala Michaela Nováková v rámci kampane Kontrola spokojnosti ambulancií. Tu je stručný prehľad pred ďalším kontaktom.</p>
          <div className="af-call-layout">
            <div className="af-call-glyph" aria-hidden="true">↙</div>
            <div>
              <div className="af-call-who">Jana Poláková <span style={{ fontWeight: 500, color: muted }}>· +421 9•• •• 4821</span></div>
              <div className="af-call-caption">Prichádzajúci hovor · 14. októbra 2026, 10:42 – 10:46 · 4 min 18 s</div>
            </div>
          </div>
          <div className="af-call-findings">
            <span className="af-finding af-finding-sentiment">Sentiment: negatívny</span>
            <span className="af-finding af-finding-tone">Tón: znepokojený</span>
          </div>
          <div className="af-call-summary"><b style={{ color: ink }}>Zistenie analýzy</b><br />Volajúca opísala opakované meškanie odpovede na požiadavku. Ocenila by potvrdenie prijatia a jasný termín, kedy sa jej tím ozve.</div>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ marginTop: 15, borderCollapse: "separate", borderSpacing: 0 }}>
            <tbody><tr className="af-detail-row">
              <DetailPair label="Volajúca" value="Jana Poláková" />
              <DetailPair label="Prijala" value="Michaela Nováková" />
            </tr></tbody>
          </table>
          <p style={{ fontSize: 10, lineHeight: "16px", color: muted, margin: "13px 0 0" }}>Záznam je dostupný po prihlásení do INDEXUS. Zhrnutie a označenia sú výsledkom dokončenej analýzy.</p>
        </EmailFrame>
        <div className="af-meta">
          <div className="af-meta-card"><div className="af-meta-label">Ukážka · hovor</div><div className="af-meta-value">Fiktívna osoba, maskované telefónne číslo aj vymyslená kampaň. Žiadne skutočné volanie ani nahrávka.</div></div>
          <div className="af-meta-card"><div className="af-meta-label">Použité zdroje</div><div className="af-meta-value">senderName · senderPhone · recipientName · direction · campaignName · startedAt · endedAt · durationSeconds · analysis.summary / sentiment / tone</div></div>
        </div>

        <div className="af-section-title"><span>03 / TERMÍN</span><h2>Pripomenutie bez zbytočného alarmu</h2></div>
        <div className="af-sample-meta">
          <span className="af-kicker" style={{ color: "#936a2e" }}>Blíži sa termín úlohy</span>
          <span className="af-illustrative">Ilustračné údaje · Bratislava</span>
        </div>
        <EmailFrame
          label="Termín úlohy"
          subject="Termín úlohy: Faktúra za služby Ambulancie TestClinic"
          accent="#9b702f"
          preheader="Úloha má termín 15. októbra o 15:00. Skontrolujte, čo ešte zostáva."
          onConfirm={() => confirm("Otvoriť úlohu")}
          ctaLabel="Skontrolovať úlohu"
        >
          <Eyebrow color="#936a2e">Termín máte na dosah</Eyebrow>
          <h2 className="af-task-title">Dokončite kontrolu faktúry</h2>
          <p className="af-copy">Michaela, úloha k faktúre za služby Ambulancie TestClinic má stanovený termín. Ak ešte nie je hotová, teraz je vhodný čas skontrolovať zadanie a naplánovať odpoveď.</p>
          <div className="af-deadline-panel">
            <span className="af-softflag">TERMÍN ÚLOHY</span>
            <div className="af-deadline-date" style={{ marginTop: 12 }}>15. októbra 2026</div>
            <div className="af-deadline-time">15:00 · miestny čas v Bratislave</div>
          </div>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <tbody><tr className="af-detail-row">
              <DetailPair label="Zodpovedná osoba" value="Michaela Nováková" />
              <DetailPair label="Zadanie vytvorila" value="Lucia Kováčová" />
            </tr></tbody>
          </table>
          <div className="af-tasksignal" style={{ background: "#f7f3eb", borderColor: "#bd9150" }}><b>Ďalší krok:</b> Pozrite si stav úlohy a pokračujte podľa zadania. Toto upozornenie uvádza termín, nie odhad zostávajúceho času.</div>
          <p style={{ fontSize: 10, color: muted, margin: "15px 0 0" }}>Pripomenutie vytvorené 14. októbra 2026 o 09:10</p>
        </EmailFrame>
        <div className="af-meta">
          <div className="af-meta-card"><div className="af-meta-label">Ukážka · termín</div><div className="af-meta-value">Referenčný dátum: 14. október 2026, Bratislava. Zobrazený je presný termín bez odpočítavania.</div></div>
          <div className="af-meta-card"><div className="af-meta-label">Dôraz v tejto verzii</div><div className="af-meta-value">Jasný termín a pokojný pokyn. Bez tvrdenia, že úloha je po termíne alebo že zostáva konkrétny počet hodín.</div></div>
        </div>

        <div className="af-section-title"><span>04 / KRATŠIE KANÁLY</span><h2>Rovnaký kontext, kratšia správa</h2></div>
        <Companion family="Nová úloha" sms="INDEXUS: Michaela, nová úloha „Faktúra za služby Ambulancie TestClinic“. Termín: 15. 10. 2026 o 15:00. Pridelila Lucia Kováčová." notice="Nová úloha: skontrolovať faktúru · termín 15. 10. o 15:00" />
        <Companion family="Dokončený prichádzajúci hovor" sms="INDEXUS: Hovor s Janou Polákovou je zhrnutý. Sentiment: negatívny. Tón: znepokojený. Zhrnutie je v detaile hovoru." notice="Hovor zhrnutý · Jana Poláková · negatívny sentiment, znepokojený tón" />
        <Companion family="Upozornenie na termín" sms="INDEXUS: Úloha „Faktúra za služby Ambulancie TestClinic“ má termín 15. 10. 2026 o 15:00. Skontrolujte ďalší postup." notice="Termín úlohy: 15. 10. 2026 o 15:00 · skontrolujte ďalší postup" />

        <p className="af-footnote">Návrh e-mailového obsahu v jednoduchom tabuľkovom rozložení pre lepšiu kompatibilitu poštových klientov. Ukážkové CTA je bezpečná lokálna simulácia; odkazy neotvárajú záznam, nič sa neodosiela. Nejde o test v konkrétnom Outlooku ani Gmaili.</p>
        {confirmation && <div className="af-toast" role="status">{confirmation}</div>}
      </div>
    </main>
  );
}

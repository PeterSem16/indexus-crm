import { useState, type ReactNode } from "react";

const C = {
  ink: "#173c3a",
  muted: "#587371",
  cream: "#fffaf0",
  paper: "#fffefb",
  line: "#dce9df",
  green: "#c9edcf",
  deep: "#176b5d",
  coral: "#e8745e",
  yellow: "#f3c95e",
  lilac: "#d9d0f1",
};

function LocalCta({ children }: { children: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="hm-cta-row">
      <button className="hm-cta" onClick={() => setDone(true)} type="button">{children}<span aria-hidden="true"> ↗</span></button>
      {done && <span className="hm-local-confirm" role="status">Ukážka odkazu — nič sa neodoslalo.</span>}
    </div>
  );
}

function ReviewCaption({ number, title, family, variables }: { number: string; title: string; family: string; variables: string }) {
  return <div className="hm-caption">
    <div className="hm-caption-top"><span className="hm-index">{number}</span><strong>{title}</strong><span className="hm-family">{family}</span></div>
    <p>Ilustračné údaje · premenné: {variables}</p>
  </div>;
}

function MailShell({ children, subject, preheader, skin = "" }: { children: ReactNode; subject: string; preheader: string; skin?: string }) {
  return <div className={`hm-mail ${skin}`}>
    <div className="hm-mail-meta">
      <div><span className="hm-meta-label">PREDMET</span><strong>{subject}</strong></div>
      <span className="hm-inbox-pill">INDEXUS · správa</span>
    </div>
    <div className="hm-preheader">{preheader}</div>
    {children}
    <footer className="hm-footer">INDEXUS <span>•</span> menej hľadania, viac porozumenia<br /><small>Túto správu ste dostali na základe udalosti vo vašom pracovnom priestore.</small></footer>
  </div>;
}

function TaskIllustration() {
  return <div className="hm-illustration" aria-hidden="true">
    <svg viewBox="0 0 150 120" role="img">
      <path d="M28 20h67l20 20v61H28z" fill="#fffefb" stroke="#176b5d" strokeWidth="2.5" />
      <path d="M95 20v21h20" fill="none" stroke="#176b5d" strokeWidth="2.5" />
      <path d="M45 58h46M45 70h36M45 82h26" stroke="#b5cec3" strokeWidth="4" strokeLinecap="round" />
      <circle cx="104" cy="84" r="23" fill="#f3c95e" />
      <path d="m94 84 7 7 14-16" fill="none" stroke="#173c3a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m25 31-8-5m115 16 8-5M30 101l-7 6" stroke="#e8745e" strokeWidth="3" strokeLinecap="round" />
      <circle cx="126" cy="91" r="4" fill="#d9d0f1" /><circle cx="19" cy="53" r="4" fill="#c9edcf" />
    </svg>
  </div>;
}

function CallIllustration() {
  return <div className="hm-call-art" aria-hidden="true">
    <svg viewBox="0 0 150 115" role="img">
      <circle cx="76" cy="57" r="45" fill="#f5d7c9" />
      <path d="M50 45c0-9 7-16 16-16h20c9 0 16 7 16 16v23c0 9-7 16-16 16H75l-15 11V83c-6-3-10-8-10-15z" fill="#fffaf0" stroke="#176b5d" strokeWidth="2.5" />
      <path d="M65 56h2m9 0h2m9 0h2" stroke="#e8745e" strokeWidth="5" strokeLinecap="round" />
      <path d="M67 68c5 4 11 4 16 0" fill="none" stroke="#176b5d" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M119 24v14m-7-7h14M24 82v12m-6-6h12" stroke="#e8745e" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  </div>;
}

function DeadlineMark() {
  return <div className="hm-deadline-mark" aria-hidden="true"><span>15</span><small>OKT</small></div>;
}

export function HumanMessage() {
  return <main className="hm-review">
    <style>{`
      .hm-review{--ink:${C.ink};--muted:${C.muted};--deep:${C.deep};--paper:${C.paper};--line:${C.line};min-height:100dvh;background:#eef5ef;color:var(--ink);padding:34px clamp(16px,4vw,56px) 72px;font-family:'DM Sans',sans-serif;box-sizing:border-box}
      .hm-review *{box-sizing:border-box}
      .hm-wrap{width:min(100%,860px);margin:0 auto}
      .hm-topline{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #d2e1d7;padding:0 0 18px;margin-bottom:28px;color:#52716b;font-size:11px;letter-spacing:.14em;font-weight:700}
      .hm-wordmark{font:800 17px 'Manrope',sans-serif;letter-spacing:.13em;color:#176b5d}
      .hm-intro{padding:12px 0 34px;max-width:730px}
      .hm-kicker{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#b35b49}
      .hm-intro h1{font:800 clamp(34px,6vw,58px)/1.02 'Manrope',sans-serif;letter-spacing:-.055em;margin:13px 0 14px;max-width:680px}
      .hm-intro p{font-size:16px;line-height:1.6;color:#50706b;margin:0;max-width:650px}
      .hm-principle{display:inline-flex;gap:9px;align-items:center;margin-top:19px;color:#176b5d;font-size:12px;font-weight:700}
      .hm-principle:before{content:"";width:22px;height:2px;background:#e8745e}
      .hm-caption{margin:26px 0 10px}
      .hm-caption-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .hm-index{font:700 12px 'Manrope',sans-serif;color:#c05f4f;letter-spacing:.08em}
      .hm-caption strong{font:700 18px 'Manrope',sans-serif}
      .hm-family{border:1px solid #cbded1;border-radius:20px;padding:5px 9px;color:#54736d;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
      .hm-caption p{font-size:11px;color:#69817c;margin:6px 0 0 31px}
      .hm-mail{background:var(--paper);border:1px solid #dce8df;border-radius:20px;overflow:hidden;box-shadow:0 14px 38px rgba(34,83,70,.08);width:100%;max-width:700px;margin:0 auto}
      .hm-mail-meta{padding:18px 22px 15px;background:#f8fbf7;border-bottom:1px solid #e8efe8;display:flex;align-items:center;justify-content:space-between;gap:12px}
      .hm-mail-meta>div{min-width:0;display:grid;gap:4px}
      .hm-meta-label{font-size:9px;letter-spacing:.14em;color:#82958c;font-weight:700}
      .hm-mail-meta strong{font-size:13px;line-height:1.4;font-weight:600;overflow-wrap:anywhere}
      .hm-inbox-pill{white-space:nowrap;border-radius:16px;background:#e4f1e6;color:#337468;padding:6px 9px;font-size:10px;font-weight:700}
      .hm-preheader{height:1px;overflow:hidden;opacity:0;font-size:1px}
      .hm-email-inner{padding:26px clamp(18px,5vw,38px) 27px}
      .hm-brandline{display:flex;align-items:center;justify-content:space-between;color:#66817a;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
      .hm-brandline b{font:800 13px 'Manrope',sans-serif;letter-spacing:.14em;color:#176b5d}
      .hm-task-hero{display:grid;grid-template-columns:minmax(0,1fr) 116px;align-items:center;gap:12px;padding:26px 0 18px}
      .hm-eyebrow{font-size:10px;color:#bd604e;text-transform:uppercase;letter-spacing:.14em;font-weight:700}
      .hm-task-hero h2,.hm-call-copy h2,.hm-deadline-copy h2{font:800 clamp(24px,4.2vw,36px)/1.12 'Manrope',sans-serif;letter-spacing:-.045em;margin:8px 0 10px}
      .hm-task-hero p,.hm-call-copy p,.hm-deadline-copy p{font-size:14px;line-height:1.65;color:#52706b;margin:0}
      .hm-illustration{width:112px;height:98px;border-radius:28px 15px 28px 15px;background:#e8f4e6;display:grid;place-items:center;transform:rotate(2deg)}
      .hm-illustration svg{width:104px}
      .hm-detail-strip{border-top:1px solid #e5eee7;border-bottom:1px solid #e5eee7;display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;padding:15px 0;margin:4px 0 17px}
      .hm-detail{padding:0 13px;border-right:1px solid #e5eee7;min-width:0}
      .hm-detail:first-child{padding-left:0}.hm-detail:last-child{border:0;padding-right:0}
      .hm-detail small{display:block;color:#80948d;font-size:9px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;margin-bottom:5px}
      .hm-detail strong{font-size:12px;line-height:1.4;display:block;font-weight:700;overflow-wrap:anywhere}
      .hm-task-note{border-radius:12px;background:#f5f8f1;padding:13px 15px;color:#41635c;font-size:13px;line-height:1.5}
      .hm-task-note b{color:#173c3a}
      .hm-cta-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:19px}
      .hm-cta{appearance:none;border:0;border-radius:9px;background:#176b5d;color:#fff;font:700 13px 'DM Sans',sans-serif;padding:12px 17px;cursor:pointer;transition:transform .18s ease,opacity .18s ease}
      .hm-cta:hover{transform:translateY(-2px);opacity:.92}
      .hm-local-confirm{font-size:11px;color:#59736d}
      .hm-footer{background:#f8fbf7;border-top:1px solid #edf2ed;padding:15px 22px;color:#638078;font-size:10px;line-height:1.6}
      .hm-footer span{color:#e8745e;padding:0 4px}.hm-footer small{font-size:9px;color:#91a19a}
      .hm-call-layout{padding:25px clamp(18px,5vw,38px) 28px;display:grid;grid-template-columns:112px minmax(0,1fr);gap:22px;align-items:start}
      .hm-call-art{height:104px;width:112px;background:#faeae2;border-radius:18px 32px 18px 32px;display:grid;place-items:center;transform:rotate(-2deg);margin-top:10px}
      .hm-call-art svg{width:105px}
      .hm-call-copy .hm-eyebrow{color:#a94e47}
      .hm-call-copy h2{font-size:clamp(23px,3.8vw,32px);margin-top:9px}
      .hm-call-meta{display:flex;flex-wrap:wrap;gap:7px;margin:13px 0 15px}
      .hm-chip{display:inline-flex;border:1px solid #ead6cc;border-radius:14px;padding:5px 9px;font-size:10px;font-weight:700;color:#765d56;background:#fffaf6}
      .hm-finding{background:#fff8e9;border-left:3px solid #e8745e;padding:13px 15px;margin:14px 0 0;border-radius:0 10px 10px 0}
      .hm-finding-label{display:flex;gap:8px;align-items:center;font-size:9px;color:#93634d;text-transform:uppercase;letter-spacing:.12em;font-weight:700}
      .hm-finding p{font-size:13px;color:#4e625c;line-height:1.55;margin:6px 0 0}
      .hm-call-results{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      .hm-result-badge{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid transparent}
      .hm-result-badge small{font-size:9px;letter-spacing:.06em;text-transform:uppercase;opacity:.78;font-weight:800}
      .hm-result-sentiment{background:#fff0e5;border-color:#f3d2bf;color:#93503c}
      .hm-result-tone{background:#f2edfb;border-color:#ded4f0;color:#695486}
      .hm-result-dot{width:7px;height:7px;border-radius:50%;background:currentColor;flex:none}
      .hm-call-actions{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:17px}
      .hm-text-link{border:0;background:none;padding:7px 0;color:#176b5d;font:700 12px 'DM Sans',sans-serif;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
      .hm-deadline{padding:24px clamp(18px,5vw,38px) 28px}
      .hm-deadline-head{display:flex;align-items:center;gap:8px;color:#a45642;font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:700}
      .hm-deadline-main{display:grid;grid-template-columns:minmax(0,1fr) 84px;align-items:center;gap:14px;padding:18px 0}
      .hm-deadline-copy h2{font-size:clamp(24px,4vw,34px)}
      .hm-deadline-mark{width:72px;height:76px;border-radius:20px 20px 15px 15px;background:#f8df9f;color:#694e2d;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(3deg);box-shadow:0 5px 0 #eacb80}
      .hm-deadline-mark span{font:800 29px 'Manrope',sans-serif;line-height:1}
      .hm-deadline-mark small{font-size:9px;font-weight:700;letter-spacing:.14em;margin-top:4px}
      .hm-due-line{display:flex;gap:10px;align-items:center;background:#fff6df;border-radius:11px;padding:12px 14px;margin:10px 0 14px;color:#705535}
      .hm-due-line b{font-size:14px}.hm-due-line span{font-size:11px;color:#8d714a}
      .hm-review-band{margin:30px auto 0;max-width:700px;border:1px solid #d4e3d9;border-radius:16px;padding:17px 20px;background:rgba(255,255,255,.45)}
      .hm-review-band h3{font:700 12px 'Manrope',sans-serif;letter-spacing:.1em;text-transform:uppercase;margin:0 0 7px;color:#497168}
      .hm-review-band p{font-size:12px;line-height:1.55;color:#648079;margin:0}
      .hm-companions{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin:20px auto 0;max-width:700px}
      .hm-companion{background:#fafff9;border:1px solid #dce9df;border-radius:14px;padding:16px 18px}
      .hm-companion-head{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#b15f4d;font-weight:700;margin-bottom:10px}
      .hm-companion p{white-space:pre-line;font-size:12px;line-height:1.65;color:#355a53;margin:0}
      @media(max-width:520px){
        .hm-review{padding:20px 13px 48px}.hm-topline{margin-bottom:18px}.hm-intro{padding-top:5px}
        .hm-mail{border-radius:14px}.hm-mail-meta{padding:14px 15px;align-items:flex-start}.hm-inbox-pill{font-size:9px}
        .hm-email-inner{padding:21px 17px 23px}.hm-task-hero{grid-template-columns:minmax(0,1fr) 74px;gap:8px;padding-top:22px}
        .hm-illustration{width:72px;height:72px;border-radius:20px 11px 20px 11px}.hm-illustration svg{width:70px}
        .hm-detail-strip{grid-template-columns:1fr 1fr;row-gap:14px}.hm-detail:nth-child(2){border:0}.hm-detail:nth-child(3){padding-left:0}
        .hm-call-layout{grid-template-columns:1fr;gap:4px;padding:21px 17px 23px}.hm-call-art{width:76px;height:68px;margin:0 0 12px}.hm-call-art svg{width:72px}
        .hm-deadline{padding:21px 17px 23px}.hm-deadline-main{grid-template-columns:minmax(0,1fr) 62px}.hm-deadline-mark{width:58px;height:64px}
        .hm-companions{grid-template-columns:1fr}.hm-caption p{margin-left:0}.hm-footer{padding:14px 16px}
      }
      @media(prefers-reduced-motion:reduce){.hm-cta{transition:none}}
    `}</style>
    <div className="hm-wrap">
      <div className="hm-topline"><span className="hm-wordmark">INDEXUS</span><span>ŠTÚDIO SPRÁV · KONCEPT B</span></div>
      <header className="hm-intro">
        <div className="hm-kicker">B · Hravá správa</div>
        <h1>Nie ďalšie systémové upozornenie. Správa, ktorej rozumiete.</h1>
        <p>Zdroj, súvislosť a ďalší krok v jednej ľudskej vete. Tri situácie z pracovného dňa, tri rôzne spôsoby, ako sa nestratiť v detaile.</p>
        <div className="hm-principle">Osobné, vecné, pripravené konať</div>
      </header>

      <ReviewCaption number="01" title="Nová úloha" family="akcia vpredu" variables="activity.title · occurredAt · newValues.createdByUserId · assignedUserId · dueDate · priority · description" />
      <MailShell subject="Michaela, nová úloha k faktúre Ambulancie TestClinic" preheader="Lucia vám dnes o 13:21 pridelila kontrolu faktúry. Termín: 15. októbra o 15:00.">
        <div className="hm-email-inner">
          <div className="hm-brandline"><b>INDEXUS</b><span>Od Lucie Kováčovej</span></div>
          <div className="hm-task-hero">
            <div>
              <div className="hm-eyebrow">Nové pridelenie · 14. októbra, 13:21</div>
              <h2>Michaela, pozriete sa na túto faktúru?</h2>
              <p>Lucia Kováčová vám pridala úlohu k faktúre za služby Ambulancie TestClinic. Zadaním je skontrolovať faktúru a pripraviť odpoveď ambulancii.</p>
            </div>
            <TaskIllustration />
          </div>
          <div className="hm-detail-strip">
            <div className="hm-detail"><small>Pridelené</small><strong>Michaela Nováková</strong></div>
            <div className="hm-detail"><small>Termín</small><strong>15. októbra · 15:00</strong></div>
            <div className="hm-detail"><small>Priorita</small><strong>Vysoká</strong></div>
          </div>
          <div className="hm-task-note"><b>Ďalší krok:</b> otvorte zadanie, skontrolujte faktúru a doplňte postup.</div>
          <LocalCta>Otvoriť úlohu</LocalCta>
        </div>
      </MailShell>

      <ReviewCaption number="02" title="Prichádzajúci hovor · analýza dokončená" family="zdroj vpredu · fiktívny príklad" variables="senderName · senderPhone · recipientName · direction · campaignName · startedAt · endedAt · durationSeconds · analysis.summary / sentiment / tone · detailUrl · playbackUrl" />
      <MailShell subject="Eva Moravcová volala Nine Bielikovej · Kontrola po konzultácii" preheader="Hovor trval 6 minút. Analýza zachytila nespokojný sentiment a znepokojený tón." skin="hm-call-mail">
        <div className="hm-call-layout">
          <CallIllustration />
          <div className="hm-call-copy">
            <div className="hm-brandline"><b>INDEXUS</b><span>Zdroj: prichádzajúci hovor</span></div>
            <div className="hm-eyebrow" style={{ marginTop: 23 }}>14. októbra 2026 · 12:48 – 12:54</div>
            <h2>Eva Moravcová sa dovolala Nine Bielikovej.</h2>
            <p>Hovor prišiel v rámci kampane <b>Kontrola po konzultácii</b>. Volajúce číslo <b>+421 9•• ••• 284</b> · dĺžka hovoru <b>6 min 12 s</b>.</p>
            <div className="hm-finding">
              <div className="hm-finding-label">Zistenie po analýze <span>·</span> dokončené</div>
              <p>„Volajúca opisuje zhoršenie ťažkostí a žiada skorší termín.“</p>
            </div>
            <div className="hm-call-results" role="group" aria-label="Výsledky dokončenej analýzy hovoru">
              <span className="hm-result-badge hm-result-sentiment"><i className="hm-result-dot" aria-hidden="true" /><small>Sentiment</small>Negatívny</span>
              <span className="hm-result-badge hm-result-tone"><i className="hm-result-dot" aria-hidden="true" /><small>Tón hlasu</small>Znepokojený</span>
            </div>
            <div className="hm-call-actions">
              <LocalCta>Otvoriť hovor</LocalCta>
              <button className="hm-text-link" type="button" onClick={(event) => {
                const target = event.currentTarget;
                target.textContent = "Ukážka prehrávania — nič sa neprehráva";
              }}>Prejsť na prehrávanie</button>
            </div>
          </div>
        </div>
      </MailShell>

      <ReviewCaption number="03" title="Blížiaci sa termín úlohy" family="prehľad vpredu" variables="activity.title · occurredAt · dueDate · assignedUserId · priority" />
      <MailShell subject="Termín faktúry Ambulancie TestClinic je zajtra o 15:00" preheader="Úloha je pridelená Michaele Novákovej. Presný termín: 15. októbra 2026 o 15:00.">
        <div className="hm-deadline">
          <div className="hm-brandline"><b>INDEXUS</b><span>Pre Michaelu Novákovú</span></div>
          <div className="hm-deadline-main">
            <div className="hm-deadline-copy">
          <div className="hm-deadline-head">Malé pripomenutie · 14. októbra 2026</div>
              <h2>Faktúra Ambulancie TestClinic má termín zajtra.</h2>
              <p>Úloha je stále vo vašom zozname. Ak ste sa k nej ešte nedostali, teraz je dobrý čas pozrieť zadanie a naplánovať ďalší krok.</p>
            </div>
            <DeadlineMark />
          </div>
          <div className="hm-due-line"><b>Štvrtok 15. októbra 2026 · 15:00</b><span>presný termín</span></div>
          <div className="hm-task-note"><b>Ďalší krok:</b> skontrolujte faktúru a pripravte odpoveď ambulancii.</div>
          <LocalCta>Skontrolovať úlohu</LocalCta>
        </div>
      </MailShell>

      <div className="hm-review-band">
        <h3>Rovnaká informácia, primeraný kanál</h3>
        <p>Krátka správa necháva len to, čo sa zmestí do rýchleho pohľadu. Notifikácia v aplikácii má vlastnú, kompaktnejšiu hierarchiu — nie je to zmenšený email.</p>
      </div>
      <div className="hm-companions">
        <section className="hm-companion"><div className="hm-companion-head">SMS · jednoduchý text</div><p>Michaela, Lucia vám pridelila úlohu: skontrolovať faktúru Ambulancie TestClinic a pripraviť odpoveď. Termín: 15. 10. o 15:00. Otvorte INDEXUS a pozrite zadanie.</p></section>
        <section className="hm-companion"><div className="hm-companion-head">Notifikácia v aplikácii</div><p><b>Nová úloha od Lucie Kováčovej</b>{"\n"}Faktúra Ambulancie TestClinic · pre Michaelu Novákovú{"\n"}Termín 15. 10. 2026 o 15:00{"\n"}Ďalší krok: otvoriť zadanie a skontrolovať faktúru.</p></section>
      </div>
      <div className="hm-review-band">
        <h3>Čo tento smer mení</h3>
        <p>Žiadne interné identifikátory ani surové stavové kľúče. Pri úlohe vedie príbeh od kolegyne k jasnému kroku; pri hovore najprv pomenuje zdroj a až potom oddelí zistený sentiment od tónu hlasu; pri termíne ukáže konkrétny dátum bez vymysleného odpočítavania. Ilustrácie sú malé a majú statickú podobu.</p>
      </div>
    </div>
  </main>;
}

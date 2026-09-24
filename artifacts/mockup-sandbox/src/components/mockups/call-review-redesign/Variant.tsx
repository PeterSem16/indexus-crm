import { useEffect, useRef, useState } from "react";
import { CalendarClock, Check, ChevronDown, ClipboardCheck, Clock3, FileText, Mail, MapPin, Phone, UserRound, X } from "lucide-react";
import "./_group.css";

interface SelectedOption {
  id: string;
  label: string;
  note: string | null;
  selectedAt: string;
}

interface Reschedule {
  date: string;
  note: string | null;
  setAt: string;
}

interface ReviewContact {
  type: "customer" | "clinic" | "hospital" | "collaborator";
  name: string;
  fields: Record<string, string | null>;
  campaignContactId: string | null;
  selectedOptions: SelectedOption[];
  reschedule: Reschedule | null;
}

const contact: ReviewContact = {
  type: "customer",
  name: "Drahoslava Drastíková",
  fields: {
    firstName: "Drahoslava",
    lastName: "Drastíková",
    phone: "+421 918 751 470",
    phone2: "+421 2 5555 0184",
    mobile: "+421 905 441 280",
    email: "drahoslava.drastikova@example.sk",
    address: "Hlavná 28",
    city: "Bratislava",
    postalCode: "811 01",
    country: "Slovensko",
    status: "Záujemca",
    notes: "Preferuje kontaktovať poobede.",
  },
  campaignContactId: "campaign-contact-2048",
  selectedOptions: [
    {
      id: "option-consultation",
      label: "Dohodnúť osobnú konzultáciu",
      note: "Zákazníčka chce prebrať možnosti aj s partnerom.",
      selectedAt: "2025-01-17T09:42:00.000Z",
    },
    {
      id: "option-email-info",
      label: "Poslať informačné materiály e-mailom",
      note: "Poslať cenník a prehľad balíkov.",
      selectedAt: "2025-01-17T09:44:00.000Z",
    },
    {
      id: "option-follow-up",
      label: "Zavolať späť po preštudovaní ponuky",
      note: "Dohodnutý následný telefonát.",
      selectedAt: "2025-01-17T09:46:00.000Z",
    },
  ],
  reschedule: {
    date: "2025-01-22T13:30:00.000Z",
    note: "Volanie presunuté na stredu po 13:00, zákazníčka bude dostupná.",
    setAt: "2025-01-17T09:47:00.000Z",
  },
};

const translations = {
  callAnalysis: {
    reviewContactTitle: "Kontrola kontaktu",
    reviewReadOnly: "Prehľad údajov o kontakte a výberov zaznamenaných počas hovoru.",
    reviewDoctor: "Lekár",
    reviewContactPerson: "Kontaktná osoba",
    reviewMobile: "Mobil",
    reviewContactDetails: "ÚDAJE O KONTAKTE",
    reviewSelectedOptions: "Vybrané možnosti",
    reviewUnavailable: "Údaje o kontakte nie sú k dispozícii.",
    reviewNoOptions: "Počas hovoru neboli vybrané žiadne možnosti.",
    reviewNoStatus: "Pre tento kontakt nie je zaznamenaný žiadny stav.",
    reviewPickedAt: "Vybrané",
    reviewReschedule: "Dohodnuté spätné volanie",
    reviewSetAt: "Nastavené",
  },
  customers: {
    firstName: "Meno",
    lastName: "Priezvisko",
    address: "Adresa",
    city: "Mesto",
    postalCode: "PSČ",
    notes: "Poznámky",
  },
  common: {
    name: "Názov",
    phone: "Telefón",
    email: "E-mail",
    country: "Krajina",
    status: "Stav",
    close: "Zavrieť",
    noData: "Žiadne údaje.",
  },
};

function useI18n() {
  return { t: translations, locale: "sk-SK" };
}

function useQuery<T>(_options: unknown): { data: T | undefined; isLoading: boolean; isError: boolean } {
  return { data: contact as unknown as T, isLoading: false, isError: false };
}

export function Variant() {
  const { t, locale } = useI18n();
  const ca = t.callAnalysis;
  const [reviewOpen, setReviewOpen] = useState(true);
  const [entityOpen, setEntityOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(() => {});
  const onClose = () => setReviewOpen(false);
  onCloseRef.current = onClose;
  const { data, isLoading, isError } = useQuery<ReviewContact>({
    queryKey: ["/api/call-logs", "mock-call-log", "review-contact"],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => contact,
  });

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const labels: Record<string, string> = {
    firstName: t.customers.firstName,
    lastName: t.customers.lastName,
    doctorName: ca.reviewDoctor,
    contactPerson: ca.reviewContactPerson,
    fullName: t.common.name,
    phone: t.common.phone,
    phone2: `${t.common.phone} 2`,
    phone3: `${t.common.phone} 3`,
    mobile: ca.reviewMobile,
    mobile2: `${ca.reviewMobile} 2`,
    email: t.common.email,
    email2: `${t.common.email} 2`,
    email3: `${t.common.email} 3`,
    address: t.customers.address,
    city: t.customers.city,
    postalCode: t.customers.postalCode,
    country: t.common.country,
    notes: t.customers.notes,
    status: t.common.status,
  };
  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString(locale || undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };
  const fieldEntries = Object.entries(data?.fields ?? {}).filter(
    ([key]) => key !== "name" && key !== "firstName" && key !== "lastName" && key !== "fullName",
  );

  return (
    <main className="call-review-current">
      <style>{`
        /* The player is intentionally kept as the same player surface; this
           preview uses a softer review-room treatment instead of the old black
           block so the transcript can be read at a glance. */
        .call-review-current .cr-workspace { background: #f1f0f2; }
        .call-review-current .cr-player-context {
          color: #26262c;
          background: #f1f0f2;
          border-right: 1px solid #dfdde2;
        }
        .call-review-current .cr-eyebrow { color: #86828d; }
        .call-review-current .cr-player-meta { color: #77737e; }
        .call-review-current .cr-player-meta span { color: #b7b3bb; }
        .call-review-current .cr-waveform {
          border-color: #dfdce3;
          background: #e9e7eb;
        }
        .call-review-current .cr-waveform i { background: #9274bd; }
        .call-review-current .cr-waveform i:nth-child(n + 27) { background: #c4becb; }
        .call-review-current .cr-player-controls { color: #6d6874; }
        .call-review-current .cr-player-controls .cr-muted { color: #aaa5ae; }
        .call-review-current .cr-transcript {
          border-color: #dedbe2;
          color: #5c5863;
          background: #faf9fa;
          box-shadow: 0 8px 22px rgb(59 48 70 / 5%);
        }
        .call-review-current .cr-transcript-title { color: #393540; }
        .call-review-current .cr-transcript-title svg { color: #8665ae; }
        .call-review-current .cr-transcript p {
          display: grid;
          grid-template-columns: 66px 1fr;
          gap: 8px;
          align-items: start;
          padding: 8px 9px;
        }
        .call-review-current .cr-transcript p b {
          display: inline-flex;
          width: fit-content;
          margin: 0;
          padding: 2px 6px;
          border-radius: 5px;
          color: #6f567f;
          background: #eee8f4;
          font-size: 9px;
          letter-spacing: .01em;
        }
        .call-review-current .cr-transcript .cr-transcript-active {
          border-left-color: #8665ae;
          color: #34303a;
          background: #f1ebf7;
        }
        .call-review-current .cr-transcript .cr-transcript-active b {
          color: #995b48;
          background: #f9e9e2;
        }
        .call-review-current .cr-player-controls button {
          box-shadow: 0 5px 12px rgb(120 77 153 / 18%);
        }
        .call-review-current .contact-identity {
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          margin: -2px 0 1px;
          padding: 7px 10px;
          border: 1px solid #e1dce7;
          border-radius: 12px;
          background: linear-gradient(135deg, #fff 0%, #faf7fc 100%);
          box-shadow: 0 5px 15px rgb(78 55 96 / 5%);
        }
        .call-review-current .contact-avatar {
          display: grid;
          width: 32px;
          height: 32px;
          place-items: center;
          border-radius: 11px;
          color: #76538f;
          background: #eee7f5;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .02em;
        }
        .call-review-current .contact-kicker {
          margin: 0 0 2px;
          color: #938b99;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .13em;
          text-transform: uppercase;
        }
        .call-review-current .contact-name {
          margin: 0;
          color: #302b34;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -.025em;
          line-height: 1.15;
        }
        .call-review-current .player-contact-name {
          display: inline;
          padding: 0;
          border: 0;
          color: inherit;
          background: transparent;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }
        .call-review-current .player-contact-name:hover {
          color: #76538f;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .call-review-current .entity-drawer-backdrop {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          justify-content: flex-end;
          background: rgb(32 25 38 / 24%);
        }
        .call-review-current .entity-drawer {
          width: min(430px, 100%);
          height: 100%;
          overflow-y: auto;
          padding: 20px;
          color: #302b34;
          background: #fff;
          box-shadow: -18px 0 42px rgb(42 28 54 / 18%);
        }
        .call-review-current .entity-drawer-head {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e7e1eb;
        }
        .call-review-current .entity-drawer-avatar {
          display: grid;
          width: 42px;
          height: 42px;
          flex: none;
          place-items: center;
          border-radius: 13px;
          color: #76538f;
          background: #eee7f5;
          font-size: 12px;
          font-weight: 800;
        }
        .call-review-current .entity-drawer-kicker {
          margin: 0 0 3px;
          color: #967fa2;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .13em;
          text-transform: uppercase;
        }
        .call-review-current .entity-drawer-title {
          margin: 0;
          color: #302b34;
          font-size: 19px;
          font-weight: 800;
          letter-spacing: -.035em;
          line-height: 1.1;
        }
        .call-review-current .entity-drawer-close {
          margin-left: auto;
          padding: 7px;
          border: 1px solid #e3dce8;
          border-radius: 8px;
          color: #776d7d;
          background: #faf8fc;
          cursor: pointer;
        }
        .call-review-current .entity-drawer-close:hover { background: #f1eaf6; color: #4d3e58; }
        .call-review-current .entity-drawer-section {
          margin-top: 17px;
        }
        .call-review-current .entity-drawer-section h4 {
          margin: 0 0 8px;
          color: #776b80;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .13em;
          text-transform: uppercase;
        }
        .call-review-current .entity-record-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .call-review-current .entity-record-field {
          min-width: 0;
          padding: 10px;
          border: 1px solid #e7e1eb;
          border-radius: 9px;
          background: #fcfbfd;
        }
        .call-review-current .entity-record-field-wide { grid-column: 1 / -1; }
        .call-review-current .entity-record-label {
          color: #9b8da4;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .call-review-current .entity-record-value {
          margin-top: 4px;
          overflow-wrap: anywhere;
          color: #38313d;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.35;
        }
        .call-review-current .entity-drawer-note {
          padding: 11px 12px;
          border: 1px solid #e5ddec;
          border-radius: 10px;
          color: #665674;
          background: #faf7fc;
          font-size: 11px;
          line-height: 1.45;
        }
        .call-review-current .entity-drawer-note strong {
          display: block;
          margin-bottom: 3px;
          color: #8c759a;
          font-size: 8px;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .call-review-current .player-contact-name:focus-visible {
          outline: 2px solid #8665ae;
          outline-offset: 3px;
          border-radius: 3px;
        }
        .call-review-current .contact-type {
          align-self: start;
          padding: 4px 7px;
          border: 1px solid #dfd1e9;
          border-radius: 999px;
          color: #76538f;
          background: #f6f0fa;
          font-size: 8px;
          font-weight: 800;
          white-space: nowrap;
        }
        .call-review-current .contact-facts {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin: 5px 0 7px 42px;
        }
        .call-review-current .contact-fact {
          display: inline-flex;
          min-width: 0;
          align-items: center;
          gap: 4px;
          padding: 3px 6px;
          border: 1px solid #e5e2e7;
          border-radius: 6px;
          color: #69636e;
          background: #fff;
          font-size: 8px;
          line-height: 1.2;
        }
        .call-review-current .contact-fact svg {
          flex: none;
          color: #9678aa;
        }
        .call-review-current .contact-details {
          overflow: hidden;
          border: 1px solid #ded7e6;
          border-radius: 12px;
          background: linear-gradient(180deg, #fff 0%, #faf8fc 100%);
          box-shadow: 0 5px 15px rgb(78 55 96 / 4%);
        }
        .call-review-current .contact-details summary {
          padding: 12px 13px;
          background: #f7f2fa;
          color: #5d496a;
          transition: background .2s ease;
        }
        .call-review-current .contact-details summary:hover {
          background: #f1eaf6;
        }
        .call-review-current .contact-details .contact-details-label {
          color: #655d6b;
          letter-spacing: .13em;
        }
        .call-review-current .contact-details .contact-details-body {
          padding: 10px;
          background: #fcfbfd;
        }
        .call-review-current .contact-details .contact-field {
          border-color: #e7e1eb;
          background: #fff;
          box-shadow: 0 2px 6px rgb(78 55 96 / 3%);
        }
        .call-review-current .contact-details .contact-field-label {
          color: #9b8da4;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .call-review-current .contact-details .contact-field-value {
          color: #38313d;
          font-weight: 600;
        }
        .call-review-current .result-note {
          display: flex;
          align-items: flex-start;
          gap: 5px;
          margin-top: 4px;
          padding: 4px 6px;
          border: 1px solid #dfe8df;
          border-radius: 6px;
          color: #526258;
          background: #f7fbf7;
          font-size: 9px;
          line-height: 1.35;
        }
        .call-review-current .result-note svg {
          flex: none;
          margin-top: 1px;
          color: #699176;
        }
        .call-review-current .result-note-label {
          margin-right: 3px;
          color: #46644f;
          font-weight: 800;
        }
        .call-review-current .contact-note {
          display: flex;
          align-items: flex-start;
          gap: 7px;
          margin: 0 0 1px 42px;
          padding: 5px 7px;
          border: 1px solid #e5ddec;
          border-radius: 8px;
          color: #665674;
          background: #faf7fc;
          font-size: 9px;
          line-height: 1.35;
        }
        .call-review-current .contact-note svg {
          flex: none;
          margin-top: 1px;
          color: #9678aa;
        }
        .call-review-current .contact-note-label {
          display: block;
          margin-bottom: 2px;
          color: #8c759a;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        @media (max-width: 700px) {
          .call-review-current .cr-player-context { border-right: 0; border-bottom: 1px solid #dfdde2; }
        }
      `}</style>
      <section className="cr-desktop-frame" aria-label="Review contact panel beside call player">
        <header className="cr-appbar">
          <span className="cr-appmark"><ClipboardCheck size={15} /></span>
          <span className="cr-app-title">Calls &amp; Transcripts</span>
          <span className="cr-app-context">Hovory <span>/</span> Kontrola kontaktu</span>
          <span className="cr-app-user">JD</span>
        </header>
        <div className="cr-workspace">
          <section className="cr-player-context" aria-label="Call player">
            <div className="cr-player-heading">
              <div>
                <p className="cr-eyebrow">PREHRÁVAČ HOVORU</p>
                <h1>
                  <button
                    type="button"
                    className="player-contact-name"
                    onClick={() => setEntityOpen(true)}
                    aria-label={`Otvoriť úplnú kartu kontaktu: ${contact.name}`}
                  >
                    {contact.name}
                  </button>
                </h1>
                <p className="cr-player-meta">+421 918 751 470 <span>·</span> 17. jan 2025 <span>·</span> 04:38</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReviewOpen(true)}
                  className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[9px] font-semibold text-zinc-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Otvoriť kartu kontaktu"
                >
                  Otvoriť kartu kontaktu
                </button>
                <span className="cr-call-status">Dokončený</span>
              </div>
            </div>
            <div className="cr-waveform" aria-hidden="true">
              {Array.from({ length: 64 }, (_, index) => (
                <i key={index} style={{ height: `${9 + Math.abs(Math.sin(index * 1.47) * 29)}px` }} />
              ))}
            </div>
            <div className="cr-player-controls">
              <span>01:24 <span className="cr-muted">/ 04:38</span></span>
              <button type="button" aria-label="Prehrať hovor">▶</button>
              <span>1.0×</span>
            </div>
            <div className="cr-transcript">
              <div className="cr-transcript-title"><FileText size={14} /> Prepis hovoru</div>
              <p><b>Agent</b><span>Dobrý deň, volám vám ohľadom našej ponuky.</span></p>
              <p className="cr-transcript-active"><b>Zákazníčka</b><span>Áno, ďakujem. Mala by som záujem o ďalšie informácie.</span></p>
              <p><b>Agent</b><span>Rád vám pošlem podrobnosti a môžeme si dohodnúť konzultáciu.</span></p>
            </div>
          </section>

           {reviewOpen && <aside role="dialog" aria-label={ca.reviewContactTitle} aria-modal="false"
            className="fixed inset-0 z-[9994] flex min-w-0 flex-col overflow-hidden border-l border-zinc-200 bg-[#fbfbfa] text-zinc-900 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 lg:sticky lg:top-2 lg:z-auto lg:h-[calc(100dvh-1rem)] lg:w-[45%] lg:shrink-0 lg:self-start lg:rounded-l-xl lg:shadow-none"
            data-testid="call-contact-review-drawer">
            <header className="shrink-0 border-b border-zinc-200 bg-white px-5 py-3.5 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold tracking-tight">{ca.reviewContactTitle}</h2>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{ca.reviewReadOnly}</p>
                </div>
                <button ref={closeRef} type="button" onClick={onClose} aria-label={t.common.close}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-zinc-800"
                  data-testid="close-call-contact-review">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {isLoading ? (
                <div className="space-y-3" aria-busy="true" aria-label={ca.reviewContactTitle}>
                  <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-48 animate-pulse rounded-xl bg-muted/70" />
                  <div className="h-28 animate-pulse rounded-xl bg-muted/70" />
                </div>
              ) : isError || !data ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-foreground" role="alert">
                  <p>{ca.reviewUnavailable}</p>
                </div>
              ) : (
                <div className="space-y-4">
                   <div className="contact-identity">
                     <div className="contact-avatar" aria-hidden="true">DD</div>
                     <div className="min-w-0">
                       <p className="contact-kicker">{ca.reviewContactDetails}</p>
                       <h3 className="contact-name break-words">{data.name}</h3>
                     </div>
                     <span className="contact-type">Zákazníčka</span>
                   </div>
                   <div className="contact-facts" aria-label="Rýchle údaje o kontakte">
                     <span className="contact-fact"><Phone size={10} aria-hidden="true" />{data.fields.phone}</span>
                     <span className="contact-fact"><Mail size={10} aria-hidden="true" />{data.fields.email}</span>
                     <span className="contact-fact"><MapPin size={10} aria-hidden="true" />{data.fields.city}</span>
                   </div>
                    {data.fields.notes && (
                      <div className="contact-note" aria-label="Poznámka ku kontaktu">
                        <FileText size={12} aria-hidden="true" />
                        <span><span className="contact-note-label">Poznámka ku kontaktu</span>{data.fields.notes}</span>
                      </div>
                    )}

                  <section data-testid="review-selected-options" className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/25">
                    <div className="flex items-center gap-2 border-b border-emerald-200 px-3.5 py-2.5 text-emerald-900 dark:border-emerald-900 dark:text-emerald-200">
                      <ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <h3 className="flex-1 text-sm font-bold">{ca.reviewSelectedOptions}</h3>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold dark:bg-emerald-900">{data.selectedOptions.length}</span>
                    </div>
                    {data.selectedOptions.length === 0 ? (
                      <p className="px-3.5 py-4 text-sm leading-relaxed text-muted-foreground">
                        {data.campaignContactId ? ca.reviewNoOptions : ca.reviewNoStatus}
                      </p>
                    ) : (
                      <ol className="divide-y divide-emerald-200 dark:divide-emerald-900">
                        {data.selectedOptions.map((option) => (
                           <li key={option.id} className="flex gap-2 px-3.5 py-2">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950">
                              <Check className="h-3 w-3" aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-[13px] font-semibold leading-snug">{option.label}</p>
                              {option.note && <p className="result-note"><FileText size={11} aria-hidden="true" /><span><span className="result-note-label">Poznámka:</span>{option.note}</span></p>}
                              <time dateTime={option.selectedAt} className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                                <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                                {ca.reviewPickedAt}: {formatDate(option.selectedAt)}
                              </time>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>

                  {data.reschedule && (
                    <section data-testid="review-reschedule" className="rounded-xl border border-l-4 border-amber-300 border-l-amber-500 bg-amber-50 p-3.5 text-amber-950 dark:border-amber-800 dark:border-l-amber-400 dark:bg-amber-950/30 dark:text-amber-100">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                        <h3 className="text-sm font-bold">{ca.reviewReschedule}</h3>
                      </div>
                      <time dateTime={data.reschedule.date} className="mt-2 block break-words text-lg font-extrabold leading-tight tracking-tight">{formatDate(data.reschedule.date)}</time>
                      <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-200">{ca.reviewSetAt}: <time dateTime={data.reschedule.setAt}>{formatDate(data.reschedule.setAt)}</time></p>
                      {data.reschedule.note && <p className="mt-2 flex gap-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-amber-950/80 dark:text-amber-100/80"><FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span>{data.reschedule.note}</span></p>}
                    </section>
                  )}

                   <details className="contact-details group" data-testid="review-contact-fields">
                     <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold uppercase tracking-wider marker:hidden hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-zinc-300 [&::-webkit-details-marker]:hidden">
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                       <span className="contact-details-label">{ca.reviewContactDetails}</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    {fieldEntries.length === 0 ? (
                       <p className="px-3 pb-3 text-sm text-muted-foreground">{t.common.noData}</p>
                    ) : (
                       <div className="contact-details-body grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {fieldEntries.map(([key, value]) => (
                           <div key={key} className="contact-field min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
                            <div className="contact-field-label">{labels[key] || key}</div>
                            <div className="contact-field-value mt-1 break-words whitespace-pre-wrap text-sm">{value || "—"}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>
                </div>
              )}
            </div>
           </aside>}
          {entityOpen && (
            <div className="entity-drawer-backdrop" role="presentation">
              <aside className="entity-drawer" role="dialog" aria-modal="true" aria-label={`Úplná karta kontaktu: ${contact.name}`}>
                <div className="entity-drawer-head">
                  <div className="entity-drawer-avatar" aria-hidden="true">DD</div>
                  <div className="min-w-0">
                    <p className="entity-drawer-kicker">ÚPLNÁ KARTA ZÁKAZNÍČKY</p>
                    <h2 className="entity-drawer-title">{contact.name}</h2>
                  </div>
                  <button type="button" className="entity-drawer-close" onClick={() => setEntityOpen(false)} aria-label="Zavrieť úplnú kartu kontaktu">
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <section className="entity-drawer-section">
                  <h4>Základné údaje</h4>
                  <div className="entity-record-grid">
                    <div className="entity-record-field"><div className="entity-record-label">Meno</div><div className="entity-record-value">{data?.fields.firstName || "—"}</div></div>
                    <div className="entity-record-field"><div className="entity-record-label">Priezvisko</div><div className="entity-record-value">{data?.fields.lastName || "—"}</div></div>
                    <div className="entity-record-field"><div className="entity-record-label">Telefón</div><div className="entity-record-value">{data?.fields.phone || "—"}</div></div>
                    <div className="entity-record-field"><div className="entity-record-label">E-mail</div><div className="entity-record-value">{data?.fields.email || "—"}</div></div>
                  </div>
                </section>
                <section className="entity-drawer-section">
                  <h4>Adresa</h4>
                  <div className="entity-record-grid">
                    <div className="entity-record-field entity-record-field-wide"><div className="entity-record-label">Ulica</div><div className="entity-record-value">{data?.fields.address || "—"}</div></div>
                    <div className="entity-record-field"><div className="entity-record-label">Mesto</div><div className="entity-record-value">{data?.fields.city || "—"}</div></div>
                    <div className="entity-record-field"><div className="entity-record-label">PSČ</div><div className="entity-record-value">{data?.fields.postalCode || "—"}</div></div>
                  </div>
                </section>
                {data?.fields.notes && (
                  <section className="entity-drawer-section">
                    <h4>Poznámky</h4>
                    <div className="entity-drawer-note"><strong>Poznámka ku kontaktu</strong>{data.fields.notes}</div>
                  </section>
                )}
              </aside>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
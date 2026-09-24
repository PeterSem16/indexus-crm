import { CalendarDays, Check, ClipboardCheck, FileText, UserRound, X } from "lucide-react";
import "./_group.css";

interface SelectedOption {
  id: string;
  label: string;
  note: string | null;
  selectedAt: string;
}

interface ReviewContact {
  type: "customer" | "clinic" | "hospital" | "collaborator";
  name: string;
  fields: Record<string, string | null>;
  campaignContactId: string | null;
  selectedOptions: SelectedOption[];
  reschedule: { date: string; note: string | null } | null;
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
  },
};

const ca = {
  reviewContactTitle: "Kontrola kontaktu",
  reviewReadOnly: "Prehľad údajov o kontakte a výberov zaznamenaných počas hovoru.",
  reviewDoctor: "Lekár",
  reviewContactPerson: "Kontaktná osoba",
  reviewMobile: "Mobil",
  reviewContactDetails: "ÚDAJE O KONTAKTE",
  reviewSelectedOptions: "Vybrané možnosti",
  reviewDuringCall: "Počas hovoru",
  reviewAgentNote: "Poznámka agenta",
  reviewReschedule: "Dohodnuté spätné volanie",
};

const common = {
  firstName: "Meno",
  lastName: "Priezvisko",
  name: "Názov",
  phone: "Telefón",
  email: "E-mail",
  address: "Adresa",
  city: "Mesto",
  postalCode: "PSČ",
  country: "Krajina",
  notes: "Poznámky",
  status: "Stav",
  close: "Zavrieť",
};

const labels: Record<string, string> = {
  firstName: common.firstName,
  lastName: common.lastName,
  doctorName: ca.reviewDoctor,
  contactPerson: ca.reviewContactPerson,
  fullName: common.name,
  phone: common.phone,
  phone2: `${common.phone} 2`,
  phone3: `${common.phone} 3`,
  mobile: ca.reviewMobile,
  mobile2: `${ca.reviewMobile} 2`,
  email: common.email,
  email2: `${common.email} 2`,
  email3: `${common.email} 3`,
  address: common.address,
  city: common.city,
  postalCode: common.postalCode,
  country: common.country,
  notes: common.notes,
  status: common.status,
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("sk-SK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function Current() {
  const fieldEntries = Object.entries(contact.fields).filter(
    ([key]) => key !== "name" && key !== "firstName" && key !== "lastName",
  );

  return (
    <main className="call-review-current">
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
                <h1>{contact.name}</h1>
                <p className="cr-player-meta">+421 918 751 470 <span>·</span> 17. jan 2025 <span>·</span> 04:38</p>
              </div>
              <span className="cr-call-status">Dokončený</span>
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
              <p><b>Agent</b> Dobrý deň, volám vám ohľadom našej ponuky.</p>
              <p className="cr-transcript-active"><b>Zákazníčka</b> Áno, ďakujem. Mala by som záujem o ďalšie informácie.</p>
              <p><b>Agent</b> Rád vám pošlem podrobnosti a môžeme si dohodnúť konzultáciu.</p>
            </div>
          </section>

          <aside role="dialog" aria-label={ca.reviewContactTitle} aria-modal="false"
            className="fixed inset-0 z-[9994] flex min-w-0 flex-col overflow-hidden border-l border-border/80 bg-background shadow-2xl shadow-slate-950/10 lg:sticky lg:top-2 lg:z-auto lg:h-[calc(100dvh-1rem)] lg:w-[45%] lg:shrink-0 lg:self-start lg:rounded-l-2xl lg:shadow-none"
            data-testid="call-contact-review-drawer">
            <header className="shrink-0 border-b border-border/70 bg-muted/20 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                  <UserRound className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold tracking-tight">{ca.reviewContactTitle}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ca.reviewReadOnly}</p>
                </div>
                <button type="button" aria-label={common.close}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  data-testid="close-call-contact-review">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-7">
                <section className="space-y-3" data-testid="review-contact-fields">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{ca.reviewContactDetails}</p>
                      <h3 className="mt-1 truncate text-xl font-semibold tracking-tight">{contact.name}</h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {fieldEntries.map(([key, value]) => (
                      <div key={key} className="min-w-0 rounded-xl border border-border/70 bg-muted/20 px-3.5 py-3">
                        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{labels[key] || key}</div>
                        <div className="mt-1 break-words whitespace-pre-wrap text-sm">{value || "—"}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section data-testid="review-selected-options" className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h3 className="text-sm font-semibold">{ca.reviewSelectedOptions}</h3>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{contact.selectedOptions.length}</span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border/70">
                    {contact.selectedOptions.map((option, index) => (
                      <div key={option.id} className={`flex gap-3 bg-emerald-50/40 px-4 py-3.5 dark:bg-emerald-950/10 ${index ? "border-t border-border/60" : ""}`}>
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-snug">{option.label}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{ca.reviewDuringCall} · {formatDate(option.selectedAt)}</p>
                          {option.note && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/80"><span className="font-medium">{ca.reviewAgentNote}:</span> {option.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {contact.reschedule && (
                  <section data-testid="review-reschedule" className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/15">
                    <div className="flex gap-3">
                      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold">{ca.reviewReschedule}</h3>
                        <p className="mt-1 text-sm font-medium">{formatDate(contact.reschedule.date)}</p>
                        {contact.reschedule.note && <p className="mt-2 flex gap-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground"><FileText className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" /><span><span className="font-medium text-foreground/80">{ca.reviewAgentNote}:</span> {contact.reschedule.note}</span></p>}
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
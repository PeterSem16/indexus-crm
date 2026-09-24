import { useEffect, useRef, useState } from "react";
import { CalendarClock, Check, ChevronDown, ClipboardCheck, Clock3, FileText, UserRound, X } from "lucide-react";
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
              <p><b>Agent</b> Dobrý deň, volám vám ohľadom našej ponuky.</p>
              <p className="cr-transcript-active"><b>Zákazníčka</b> Áno, ďakujem. Mala by som záujem o ďalšie informácie.</p>
              <p><b>Agent</b> Rád vám pošlem podrobnosti a môžeme si dohodnúť konzultáciu.</p>
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
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{ca.reviewContactDetails}</p>
                    <h3 className="mt-1 break-words text-xl font-bold leading-tight tracking-tight">{data.name}</h3>
                  </div>

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
                          <li key={option.id} className="flex gap-2.5 px-3.5 py-3">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950">
                              <Check className="h-3 w-3" aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm font-semibold leading-snug">{option.label}</p>
                              {option.note && <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-snug text-emerald-950/70 dark:text-emerald-100/70">{option.note}</p>}
                              <time dateTime={option.selectedAt} className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                                <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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

                  <details className="group border-t border-zinc-200 pt-1 dark:border-zinc-700" data-testid="review-contact-fields">
                    <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-xs font-bold uppercase tracking-wider text-zinc-600 marker:hidden hover:text-foreground focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-zinc-300 [&::-webkit-details-marker]:hidden">
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                      {ca.reviewContactDetails}
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    {fieldEntries.length === 0 ? (
                      <p className="py-3 text-sm text-muted-foreground">{t.common.noData}</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 pb-3 sm:grid-cols-2">
                        {fieldEntries.map(([key, value]) => (
                          <div key={key} className="min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{labels[key] || key}</div>
                            <div className="mt-1 break-words whitespace-pre-wrap text-sm">{value || "—"}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>
                </div>
              )}
            </div>
          </aside>}
        </div>
      </section>
    </main>
  );
}
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BookOpen, CircleHelp, X } from "lucide-react";
import type { MissionFunnelCopy } from "@/i18n/mission-funnel-translations";
import type { Locale } from "@/i18n/translations";
import {
  missionFunnelHelpChapterIds,
  missionFunnelHelpTranslations,
  type MissionFunnelHelpChapter,
} from "./mission-funnel-help-translations";
import { funnelSources, funnelSteps, type FunnelException } from "../../../../shared/mission-funnel";

interface Props {
  locale: string;
  copy: MissionFunnelCopy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialChapter?: MissionFunnelHelpChapter;
}

const QUALITY_KEYS = ["clinics", "cohort", "withoutAttempt", "provisional", "orphanCalls", "duplicateEnrollments", "stateOnly", "unknownProposal"] as const;
const BASIS_KEYS = ["call", "history", "state", "derived", "current"] as const;
const EXCEPTION_KEYS: FunnelException[] = ["unqualified", "refused", "unreachable", "absent", "wrongNumber", "notWorking"];

export default function MissionFunnelHelp({ locale, copy, open, onOpenChange, initialChapter = "scope" }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState<MissionFunnelHelpChapter>("scope");
  const guide = missionFunnelHelpTranslations[locale as Locale] ?? missionFunnelHelpTranslations.en;
  const focusableSelector = "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
  const chapterIndex = missionFunnelHelpChapterIds.indexOf(chapter);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setChapter(initialChapter);
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-help-close]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      previousFocus.current?.focus();
    }
  }, [open, initialChapter]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [chapter]);

  const sourceIds = funnelSources.filter(source => source !== "activeWith");

  const onDialogKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      if ((event.target as HTMLElement).closest("[data-help-chapter-nav] button")) {
        event.preventDefault();
        const next = (chapterIndex + 1) % missionFunnelHelpChapterIds.length;
        setChapter(missionFunnelHelpChapterIds[next]);
        dialogRef.current?.querySelectorAll<HTMLButtonElement>("[data-help-chapter-nav] button")[next]?.focus();
      }
    } else if ((event.key === "ArrowUp" || event.key === "ArrowLeft") && (event.target as HTMLElement).closest("[data-help-chapter-nav] button")) {
      event.preventDefault();
      const next = (chapterIndex + missionFunnelHelpChapterIds.length - 1) % missionFunnelHelpChapterIds.length;
      setChapter(missionFunnelHelpChapterIds[next]);
      dialogRef.current?.querySelectorAll<HTMLButtonElement>("[data-help-chapter-nav] button")[next]?.focus();
    } else if (event.key === "Tab") {
      const items = dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector);
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const chapterContent = guide.content[chapter];
  return (
    <dialog
      ref={dialogRef}
      data-testid="mission-funnel-help-dialog"
      aria-labelledby="mission-funnel-help-title"
      aria-describedby="mission-funnel-help-intro"
      onCancel={event => { event.preventDefault(); onOpenChange(false); }}
      onClose={() => { onOpenChange(false); previousFocus.current?.focus(); }}
      onKeyDown={onDialogKeyDown}
      className="mission-funnel-help-dialog fixed inset-0 m-auto max-h-[min(90dvh,900px)] w-[min(1120px,calc(100vw-24px))] max-w-none overflow-hidden rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl backdrop:bg-slate-950/55 dark:backdrop:bg-black/70"
    >
      <div className="flex max-h-[min(90dvh,900px)] min-h-[min(650px,85dvh)] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-border bg-card px-5 py-4 sm:px-7 sm:py-5">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-teal-800 dark:text-teal-300">INDEXUS · MISSION</p>
            <h2 id="mission-funnel-help-title" className="text-lg font-semibold tracking-tight sm:text-xl">{guide.title}</h2>
            <p id="mission-funnel-help-intro" className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{guide.intro}</p>
          </div>
          <button type="button" data-help-close aria-label={guide.close} onClick={() => onOpenChange(false)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[250px_minmax(0,1fr)]">
          <nav data-help-chapter-nav aria-label={guide.contents}
            className="border-b border-border bg-muted/25 p-3 lg:overflow-y-auto lg:border-b-0 lg:border-r sm:p-4">
            <label className="block lg:hidden">
              <span className="sr-only">{guide.contents}</span>
              <select data-testid="mission-funnel-help-mobile-chapter" value={chapter} onChange={event => setChapter(event.target.value as MissionFunnelHelpChapter)}
                className="h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {missionFunnelHelpChapterIds.map((id, index) => <option key={id} value={id}>{index + 1}. {guide.chapters[id]}</option>)}
              </select>
            </label>
            <div className="hidden lg:block">
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">{guide.contents}</p>
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
              {missionFunnelHelpChapterIds.map((id, index) => (
                <button key={id} type="button" data-testid={`mission-funnel-help-chapter-${id}`}
                  aria-current={chapter === id ? "page" : undefined}
                  onClick={() => setChapter(id)}
                  className={`min-h-10 rounded-lg px-3 py-2 text-left text-xs font-medium leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm ${
                    chapter === id ? "bg-teal-800 text-white dark:bg-teal-300 dark:text-teal-950" : "text-muted-foreground hover:bg-card hover:text-foreground"
                  }`}>
                  <span className="mr-2 font-mono text-[10px] opacity-65">{String(index + 1).padStart(2, "0")}</span>{guide.chapters[id]}
                </button>
              ))}
            </div>
            </div>
          </nav>
          <div ref={contentRef} data-testid="mission-funnel-help-content" className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-7">
            <article aria-labelledby={`help-section-${chapter}`} className="mx-auto max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-teal-800 dark:text-teal-300">{String(chapterIndex + 1).padStart(2, "0")} / {String(missionFunnelHelpChapterIds.length).padStart(2, "0")}</p>
              <h3 id={`help-section-${chapter}`} className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{guide.chapters[chapter]}</h3>
              <div className="mt-5 space-y-4">
                {chapterContent.map((paragraph, index) => (
                  <p key={`${chapter}-paragraph-${index}`} className="text-sm leading-7 text-foreground/85 sm:text-[15px]">{paragraph}</p>
                ))}
              </div>
              {chapter === "contact-contract" && (
                <section className="mt-7" aria-label={copy.funnel}>
                  <h4 className="mb-3 text-sm font-semibold">{copy.funnel}</h4>
                  <dl className="divide-y divide-border rounded-xl border border-border bg-card">
                    {funnelSteps.map(step => (
                      <div key={step} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(180px,.8fr)_minmax(0,1.5fr)] sm:gap-5">
                        <dt className="text-sm font-semibold">{copy.stepLabels[step]}</dt>
                        <dd className="text-sm leading-relaxed text-muted-foreground">{guide.stages[step]}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
              {chapter === "exceptions-quality" && (
                <>
                  <section className="mt-7">
                    <h4 className="mb-3 text-sm font-semibold">{copy.exceptions}</h4>
                    <dl className="divide-y divide-border rounded-xl border border-border bg-card">
                      {EXCEPTION_KEYS.map(key => <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(180px,.8fr)_minmax(0,1.5fr)] sm:gap-5">
                        <dt className="text-sm font-semibold">{copy.exceptionLabels[key]}</dt><dd className="text-sm leading-relaxed text-muted-foreground">{guide.exceptions[key]}</dd>
                      </div>)}
                    </dl>
                  </section>
                  <section className="mt-7">
                    <h4 className="mb-3 text-sm font-semibold">{copy.quality}</h4>
                    <dl className="divide-y divide-border rounded-xl border border-border bg-card">
                      {QUALITY_KEYS.map(key => <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(180px,.8fr)_minmax(0,1.5fr)] sm:gap-5">
                        <dt className="text-sm font-semibold">{copy[key]}</dt><dd data-quality-key={key} className="text-sm leading-relaxed text-muted-foreground">{guide.quality[key]}</dd>
                      </div>)}
                    </dl>
                  </section>
                </>
              )}
              {chapter === "evidence" && (
                  <section className="mt-7">
                    <h4 className="mb-3 text-sm font-semibold">{copy.basis}</h4>
                    <dl className="grid gap-2 sm:grid-cols-2">
                      {BASIS_KEYS.map(key => <div key={key} className="rounded-lg border border-border bg-card px-4 py-3">
                        <dt className="text-sm font-semibold">{copy.basisLabels[key]}</dt>
                        <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{guide.basis[key]}</dd>
                      </div>)}
                    </dl>
                  </section>
              )}
              {chapter === "sources" && (
                <>
                  <h4 className="mb-3 mt-7 text-sm font-semibold">{guide.chapters.sources}</h4>
                  <dl className="divide-y divide-border rounded-xl border border-border bg-card">
                    {sourceIds.map(source => <div key={source} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(190px,.8fr)_minmax(0,1.5fr)] sm:gap-5">
                      <dt className="text-sm font-semibold">{copy.sourceLabels[source]}</dt><dd className="text-sm leading-relaxed text-muted-foreground">{guide.sources[source]}</dd>
                    </div>)}
                  </dl>
                  <p className="mt-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                    {copy.sourceLabels.activeWith}: {guide.sources.activeWith}
                  </p>
                </>
              )}
            </article>
          </div>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-6">
          <button type="button" aria-label={guide.previous} onClick={() => setChapter(missionFunnelHelpChapterIds[Math.max(0, chapterIndex - 1)])}
            disabled={chapterIndex === 0} className="min-h-10 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {guide.previous}
          </button>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{chapterIndex + 1} / {missionFunnelHelpChapterIds.length}</span>
          <button type="button" aria-label={guide.next} onClick={() => setChapter(missionFunnelHelpChapterIds[Math.min(missionFunnelHelpChapterIds.length - 1, chapterIndex + 1)])}
            disabled={chapterIndex === missionFunnelHelpChapterIds.length - 1} className="min-h-10 rounded-lg bg-teal-800 px-3 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-40 dark:bg-teal-300 dark:text-teal-950 dark:hover:bg-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {guide.next}
          </button>
        </footer>
      </div>
    </dialog>
  );
}

export function MissionFunnelHelpButton({ locale, onClick }: { locale: string; onClick: () => void }) {
  const guide = missionFunnelHelpTranslations[locale as Locale] ?? missionFunnelHelpTranslations.en;
  return (
    <button type="button" data-testid="mission-funnel-help" aria-haspopup="dialog" onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <BookOpen aria-hidden="true" className="h-4 w-4 text-teal-800 dark:text-teal-300" />
      {guide.button}
    </button>
  );
}

export function MissionFunnelHelpLink({ locale, chapter, onSelect }: {
  locale: string; chapter: MissionFunnelHelpChapter; onSelect: (chapter: MissionFunnelHelpChapter) => void;
}) {
  const guide = missionFunnelHelpTranslations[locale as Locale] ?? missionFunnelHelpTranslations.en;
  const label = `${guide.button}: ${guide.chapters[chapter]}`;
  return <button type="button" data-testid={`mission-funnel-help-context-${chapter}`} aria-label={label} title={label}
    onClick={() => onSelect(chapter)}
    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-teal-800 hover:bg-teal-700/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-teal-300">
    <CircleHelp aria-hidden="true" className="h-4 w-4" />
  </button>;
}

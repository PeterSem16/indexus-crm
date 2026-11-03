import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, ShieldCheck } from "lucide-react";
import type { MissionFunnelCopy } from "@/i18n/mission-funnel-translations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MissionFunnelHelpLink } from "./MissionFunnelHelp";
import type { MissionFunnelHelpChapter } from "./mission-funnel-help-translations";
import type { EmailPurpose } from "@shared/email-purpose";
import { emailPurposes } from "@shared/email-purpose";
import MissionMaterialPackageMapping from "./MissionMaterialPackageMapping";
import { materialPackageCopy, cooperationRuleCopy, standaloneCooperationCopy } from "./mission-material-package-copy";
import {
  configurableFunnelSources,
  effectiveFunnelEmailSteps,
  effectiveFunnelEmailPurposes,
  funnelSteps,
  type FunnelConfig,
  type FunnelSource,
  type FunnelStep,
  type MissionFunnelReport,
} from "../../../../shared/mission-funnel";

interface Props {
  locale: string;
  onHelp?: (chapter: MissionFunnelHelpChapter) => void;
  report: MissionFunnelReport;
  config: FunnelConfig;
  copy: MissionFunnelCopy;
  saving: boolean;
  saveMessage: "saved" | "error" | "";
  onUpdateSource: (source: FunnelSource, itemId: string, checked: boolean) => void;
  onAbsenceQuestionChange: (value: string | null) => void;
  onSave: () => void;
  onMaterialsChange?: (value: NonNullable<FunnelConfig["materials"]>) => void;
  onEmailPurposesChange?: (value: NonNullable<FunnelConfig["emailPurposes"]>) => void;
  onEmailFunnelStepsChange?: (value: FunnelStep[]) => void;
}

const TABS = [
  { id: "contact", title: "mappingContactTab", sources: ["qualified", "agreed"] },
  { id: "contract", title: "mappingContractTab", sources: ["proposalAccepted", "proposalUnaccepted", "proposalOther", "email", "sent", "received", "returned", "validated"] },
  { id: "materials", title: "mappingMaterialsTab", sources: ["activeWithout", "materials17", "materials18", "materials19"] },
  { id: "exceptions", title: "mappingExceptionsTab", sources: ["unqualified", "refused", "absent", "wrongNumber", "notWorking"] },
] as const;

export default function MissionFunnelMapping({
  report, config, copy, saving, saveMessage, onUpdateSource, onAbsenceQuestionChange, onSave, locale, onHelp, onMaterialsChange, onEmailPurposesChange, onEmailFunnelStepsChange,
}: Props) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("contact");
  const [activeSource, setActiveSource] = useState<FunnelSource>("qualified");
  const [search, setSearch] = useState("");
  const packageCopy = materialPackageCopy[locale as keyof typeof materialPackageCopy] ?? materialPackageCopy.en;
  const rules = cooperationRuleCopy[locale as keyof typeof cooperationRuleCopy] ?? cooperationRuleCopy.en;
  const compositeConfigured = config.sources.agreed.length > 0 && config.sources.proposalUnaccepted.length > 0;
  const visibleSources = (TABS.find(tab => tab.id === activeTab)?.sources ?? TABS[0].sources)
    .filter(source => activeTab !== "materials" || source === "activeWithout" || !config.materials?.packageSent.length);
  const selectedSource = visibleSources.includes(activeSource as never) ? activeSource : visibleSources[0] as FunnelSource;
  const selectedIds = config.sources[selectedSource];
  const items = report.items ?? [];
  const selectedItems = selectedIds.map(id => items.find(item => item.id === id) ?? { id, label: id, stepId: "" });
  const filteredItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    const selected = new Set(selectedIds);
    return items.filter(item => {
      const matches = !needle || `${item.label} ${item.stepId}`.toLocaleLowerCase().includes(needle);
      return matches && !selected.has(item.id);
    });
  }, [items, search, selectedIds]);
  const legacyMaterials = ["materials17", "materials18", "materials19"] as const;
  const packageConfigured = Boolean(config.materials?.packageSent.length) ||
    legacyMaterials.every(key => config.sources[key].length > 0 || Boolean(config.materials?.excluded[key].length));
  const independentSources = configurableFunnelSources.filter(source => source !== "activeWithout" && !legacyMaterials.includes(source as any));
  const sourceConfigured = (source: FunnelSource) => config.sources[source].length > 0 ||
      source === "email" && effectiveFunnelEmailSteps(config).length > 0;
  const configuredCount = independentSources.filter(sourceConfigured).length + Number(packageConfigured);
  const editableCount = independentSources.length + 1;

  return (
    <section className="mission-funnel-mapping overflow-hidden rounded-xl border border-border bg-card shadow-sm" data-testid="mission-funnel-mapping">
      <details>
        <summary data-testid="mission-funnel-config-expand" className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 marker:hidden sm:px-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-700/10 text-teal-800 dark:bg-teal-300/10 dark:text-teal-300">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{copy.configuration}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{copy.configurationSavedNote}</span>
          </span>
          <span className="shrink-0 rounded-full border border-border bg-muted/45 px-2.5 py-1 font-mono text-xs tabular-nums text-muted-foreground">
            {configuredCount}/{editableCount}
          </span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
        </summary>
        <div className="border-t border-border">
          <div className="flex items-start gap-2 px-4 pt-4 sm:px-5">
            <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{rules.without}</p>
            {onHelp && <MissionFunnelHelpLink locale={locale} chapter="configuration" onSelect={onHelp} />}
          </div>
          <Tabs value={activeTab} onValueChange={value => {
            const tab = TABS.find(entry => entry.id === value);
            if (!tab) return;
            setActiveTab(tab.id);
            setActiveSource(tab.sources[0] as FunnelSource);
          }} className="grid gap-0 lg:grid-cols-[minmax(180px,0.72fr)_minmax(0,1.8fr)]">
            <nav aria-label={copy.configuration} className="border-b border-border bg-muted/20 p-3 lg:border-b-0 lg:border-r sm:p-4">
              <TabsList aria-label={copy.configuration} className="grid h-auto grid-cols-2 gap-2 rounded-none bg-transparent p-0 lg:grid-cols-1">
                {TABS.map(tab => {
                  const sources = tab.sources as readonly FunnelSource[];
                  const configured = tab.id === "materials" ? Number(compositeConfigured) + Number(packageConfigured) :
                    sources.filter(source => sourceConfigured(source)).length;
                  return (
                    <TabsTrigger key={tab.id} value={tab.id} data-testid={`mapping-tab-${tab.id}`}
                      className={`flex min-h-12 min-w-0 w-full items-center justify-between gap-2 whitespace-normal rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        activeTab === tab.id ? "border-teal-700/35 bg-teal-700/[0.07] font-semibold text-foreground shadow-none dark:border-teal-300/30 dark:bg-teal-300/[0.07]" : "border-transparent bg-transparent text-muted-foreground shadow-none hover:border-border hover:bg-card"
                      }`}>
                      <span className="min-w-0 break-words">{copy[tab.title]}</span>
                      <span className={`shrink-0 font-mono text-[11px] tabular-nums ${configured === (tab.id === "materials" ? 2 : sources.length) ? "text-teal-800 dark:text-teal-300" : ""}`}>{configured}/{tab.id === "materials" ? 2 : sources.length}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              <div className="mt-4 rounded-lg border border-border/80 bg-card/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">{copy.mappingCoverage}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{configuredCount} / {editableCount}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.mappingCoverageHelp}</p>
              </div>
            </nav>

            <TabsContent value={activeTab} className="m-0 min-w-0 p-4 sm:p-5">
              {selectedSource === "email" && onEmailFunnelStepsChange && (() => {
                const selectedSteps = effectiveFunnelEmailSteps(config);
                const selectedPurposes = effectiveFunnelEmailPurposes(config).filter(purpose => purpose !== "unspecified") as Exclude<EmailPurpose, "unspecified">[];
                return <section className="mb-5 max-w-3xl rounded-lg border border-border/80 bg-muted/20 p-3 sm:p-4" data-testid="mission-funnel-email-purpose-settings">
                  <h3 className="text-sm font-semibold">{copy.funnelEmailPurposeLabel}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.funnelEmailStepsHelp}</p>
                  <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {funnelSteps.map(step => <label key={step} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-border/70 bg-background px-2.5 py-1.5 text-sm hover:bg-muted/50">
                      <input type="checkbox" data-testid={`mission-funnel-email-step-${step}`} checked={selectedSteps.includes(step)}
                        onChange={event => onEmailFunnelStepsChange(event.target.checked
                          ? selectedSteps.concat(step)
                          : selectedSteps.filter(value => value !== step))}
                        className="h-4 w-4 accent-teal-800 dark:accent-teal-300" />
                      <span>{copy.stepLabels[step]}</span>
                    </label>)}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {copy.funnelEmailStepsCount.replace("{selected}", String(selectedSteps.length)).replace("{total}", String(funnelSteps.length))}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{copy.funnelEmailNoOtherMilestones}</p>
                  <details className="mt-3 border-t border-border/70 pt-2" data-testid="mission-funnel-legacy-email-purpose-settings">
                    <summary className="cursor-pointer text-xs font-semibold">{copy.funnelEmailLegacyLabel}</summary>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{copy.funnelEmailPurposeHelp}</p>
                    {onEmailPurposesChange && <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {emailPurposes.filter(value => value !== "unspecified").map(value => {
                        const purpose = value as Exclude<EmailPurpose, "unspecified">;
                        const checked = selectedPurposes.includes(purpose);
                        return <label key={value} className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md border border-border/70 bg-background px-2.5 py-1.5 text-xs hover:bg-muted/50">
                          <input type="checkbox" data-testid={`mission-funnel-email-purpose-${value}`} checked={checked}
                            onChange={event => onEmailPurposesChange(event.target.checked
                              ? selectedPurposes.concat(purpose)
                              : selectedPurposes.filter(selected => selected !== purpose))}
                            className="h-3.5 w-3.5 accent-teal-800 dark:accent-teal-300" />
                          <span>{copy.emailPurposeLabels[value]}</span>
                        </label>;
                      })}
                    </div>}
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{copy.emailPurposePostalBoundary}</p>
                  </details>
                </section>;
              })()}
              {activeTab === "materials" && onMaterialsChange && <MissionMaterialPackageMapping
                config={config} report={report} locale={locale} copy={copy} onChange={onMaterialsChange} />}
              <div className="mb-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">{copy.mappingChooseSource}</p>
                <div className="flex flex-wrap gap-2">
                  {visibleSources.map(source => (
                    <button key={source} type="button" data-testid={`mission-funnel-source-select-${source}`}
                      aria-pressed={selectedSource === source} onClick={() => setActiveSource(source)}
                      className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selectedSource === source ? "border-teal-700/35 bg-teal-700/[0.07] font-semibold text-foreground dark:border-teal-300/30 dark:bg-teal-300/[0.07]" : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                      }`}>
                      <span>{copy.sourceLabels[source]}</span>
                      <span className="font-mono tabular-nums">{source === "activeWithout" ? packageCopy.and : config.sources[source].length}</span>
                    </button>
                  ))}
                </div>
              </div>
          {selectedSource === "activeWithout" ? <section className="rounded-lg border border-border bg-muted/20 p-4" data-testid="without-contract-computed">
            <h3 className="text-sm font-semibold">{copy.sourceLabels.activeWithout}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{packageCopy.computed}</p>
            {(["agreed", "proposalUnaccepted"] as const).map((key, index) => <div key={key} className="mt-3">
              {index > 0 && <p className="mb-2 text-xs font-bold">{packageCopy.and}</p>}
              <p className="text-sm font-medium">{copy.sourceLabels[key]}</p>
              <p className="mt-1 text-xs text-muted-foreground">{config.sources[key].map(id => items.find(item => item.id === id)?.label ?? id).join(" · ") || packageCopy.none}</p>
            </div>)}
          </section> : <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">{copy.sourceLabels[selectedSource]}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{copy.mappingSourceHelp}</p>
            </div>
            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ${
              selectedIds.length ? "bg-teal-700/10 text-teal-900 dark:bg-teal-300/10 dark:text-teal-200" : "bg-amber-500/10 text-amber-900 dark:text-amber-200"
            }`}>
              {selectedIds.length ? `${selectedIds.length} ${copy.selected}` : copy.mappingMissingChoice}
            </span>
          </div>

          <div className="mb-4 flex flex-wrap gap-2" aria-label={copy.mappingSelectedChoices} data-testid="mission-funnel-mapping-selected">
            {selectedItems.length ? selectedItems.map(item => (
              <button key={item.id} type="button" onClick={() => onUpdateSource(selectedSource, item.id, false)}
                data-testid={`mapping-remove-${item.id}`}
                aria-label={`${copy.mappingRemoveChoice}: ${item.label}`}
                className="group inline-flex min-w-0 max-w-full items-center gap-2 rounded-md border border-teal-700/20 bg-teal-700/[0.06] px-2.5 py-1.5 text-left text-xs text-foreground hover:border-destructive/40 hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-teal-300/20 dark:bg-teal-300/[0.06]">
                <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-teal-800 dark:text-teal-300" />
                <span className="truncate">{item.label}</span>
                <span aria-hidden="true" className="font-semibold text-muted-foreground group-hover:text-destructive">×</span>
              </button>
            )) : <p className="rounded-md border border-dashed border-amber-600/30 bg-amber-500/[0.045] px-3 py-2 text-xs text-muted-foreground">{copy.mappingNoSelection}</p>}
          </div>

          <label className="mb-2 flex max-w-xl items-center gap-2 rounded-lg border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder={copy.searchItems}
              aria-label={copy.searchItems} className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            {search && <button type="button" onClick={() => setSearch("")} className="rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted">{copy.clearSearch}</button>}
          </label>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>{filteredItems.length} {copy.mappingAvailableChoices}</span>
            <span>{selectedIds.length} {copy.selected}</span>
          </div>
          <div className="max-h-[22rem] space-y-1 overflow-y-auto rounded-lg border border-border/80 bg-background p-1.5" data-testid={`mapping-source-${selectedSource}`}>
            {filteredItems.map(item => (
              <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted/55 focus-within:ring-2 focus-within:ring-ring">
                <input type="checkbox" data-testid={`mapping-item-${item.id}`} checked={false} onChange={event => onUpdateSource(selectedSource, item.id, event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-teal-800 dark:accent-teal-300" />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-medium text-foreground">{item.label}</span>
                  <span className="mt-0.5 block break-all font-mono text-[10px] text-muted-foreground">{item.stepId}</span>
                </span>
                <span className="shrink-0 self-center text-xs text-muted-foreground">{copy.addChoice}</span>
              </label>
            ))}
            {filteredItems.length === 0 && <p className="p-5 text-center text-sm text-muted-foreground">{search ? copy.noMatchingItems : copy.mappingAllSelected}</p>}
          </div>

          </>}
          {activeTab === "exceptions" && (
            <div className="mt-5 max-w-2xl rounded-lg border border-border/80 bg-muted/20 p-3 sm:p-4">
              <label htmlFor="mission-funnel-absence-return-question" className="block text-sm font-semibold">{copy.absenceReturnQuestion}</label>
              <select id="mission-funnel-absence-return-question" value={config.absenceReturnQuestionId ?? ""}
                onChange={event => onAbsenceQuestionChange(event.target.value || null)}
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">{copy.noDate}</option>
                {config.absenceReturnQuestionId && !(report.dateQuestions ?? []).some(question => question.id === config.absenceReturnQuestionId) && (
                  <option value={config.absenceReturnQuestionId}>{config.absenceReturnQuestionId}</option>
                )}
                {(report.dateQuestions ?? []).map(question => <option key={question.id} value={question.id}>{question.label}</option>)}
              </select>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{copy.absenceReturnQuestionHelp}</p>
            </div>
          )}

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{rules.contract} {rules.without} {rules.materials}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground" data-testid="cooperation-standalone-policy">
            {standaloneCooperationCopy[locale as keyof typeof standaloneCooperationCopy] ?? standaloneCooperationCopy.en}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <button type="button" data-testid="mission-funnel-config-save" disabled={saving} onClick={onSave}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-300 dark:text-teal-950 dark:hover:bg-teal-200">
              {saveMessage === "saved" ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
              {saving ? copy.saving : copy.saveConfiguration}
            </button>
            {saveMessage && <p role={saveMessage === "error" ? "alert" : "status"} className={`text-sm ${saveMessage === "error" ? "text-destructive" : "text-teal-800 dark:text-teal-300"}`}>{saveMessage === "saved" ? copy.saved : copy.saveError}</p>}
          </div>
            </TabsContent>
          </Tabs>
        </div>
      </details>
    </section>
  );
}

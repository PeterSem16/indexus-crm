import { automationOverviewTranslations } from "./_indexus-translations";
import { actionLabels, countries, demoRules, eventLabels, moduleLabels } from "./_fixtures";
import type { OverviewCatalog, OverviewRun } from "./_indexus-model";

// These are explicit preview-only provider/API boundaries. The displayed
// components and their CSS are copied from the real automation workspace.
export type Locale = "en" | "sk" | "cs" | "hu" | "ro" | "it" | "de";
export const useI18n = () => ({
  locale: "sk" as Locale,
  t: {
    automationOverview: automationOverviewTranslations.sk,
    automationServices: {
      servicesTab: "Služby", choose: "Vybrať automatizáciu",
      names: actionLabels, editorCatalog: { moduleLabels, eventLabels },
    },
    automationDraft: { button: "AI návrh" },
  },
});
export const previewCatalog: OverviewCatalog = {
  countries,
  modules: Object.entries(moduleLabels).map(([value, label]) => ({ value, label })),
  eventTypes: Object.entries(eventLabels).map(([value, label]) => ({ value, label })),
  actionTypes: Object.entries(actionLabels).map(([value, label]) => ({ value, label })),
};
const runFixtures: OverviewRun[] = [
  { id: "preview-success", ruleId: "invoice-inbox",
    status: "success", startedAt: "2026-10-14T07:41:00Z", finishedAt: "2026-10-14T07:41:01Z", error: null, skippedReason: null },
  { id: "preview-skipped", ruleId: "negative-mail",
    status: "skipped", startedAt: "2026-10-14T07:35:00Z", finishedAt: "2026-10-14T07:35:00.200Z", error: null, skippedReason: "condition_false" },
  { id: "preview-failed", ruleId: "missed-call",
    status: "failed", startedAt: "2026-10-14T07:29:00Z", finishedAt: "2026-10-14T07:29:01Z",
    error: "Ukážka: cieľová skupina nie je dostupná.", skippedReason: null },
  { id: "preview-yesterday", ruleId: "daily-summary",
    status: "success", startedAt: "2026-10-13T14:00:00Z", finishedAt: "2026-10-13T14:00:02Z", error: null, skippedReason: null },
];
function previewResponse(queryKey: readonly unknown[]) {
  const argument = queryKey[1];
  if (typeof argument !== "string") {
    const ruleId = (argument as { ruleId?: string } | undefined)?.ruleId;
    return runFixtures.filter(run => !ruleId || run.ruleId === ruleId);
  }
  const run = runFixtures.find(item => item.id === argument);
  if (!run) throw new Error("Unknown illustrative run");
  const rule = demoRules.find(item => item.id === run.ruleId);
  return {
    run, event: { module: rule?.module || "task", entityType: rule?.module || "task",
      eventType: rule?.trigger.eventType || "schedule" },
    actions: run.status === "skipped" ? [] : (rule?.actions || []).map((action, actionIndex) => ({
      id: `${run.id}-action-${actionIndex}`, actionIndex, actionType: action.type,
      status: run.status, error: run.error, output: { previewOnly: true },
    })),
  };
}
export function useQuery<T>({ queryKey, enabled = true }: {
  queryKey: readonly unknown[]; enabled?: boolean;
  queryFn?: (context: { queryKey: readonly unknown[] }) => Promise<T>;
  [key: string]: unknown;
}) {
  const data = enabled ? previewResponse(queryKey) as T : undefined;
  return { data, isLoading: false, isFetching: false, isError: false,
    refetch: async () => ({ data }) };
}
export const getQueryFn = <T,>(_options: unknown) => async (
  context: { queryKey: readonly unknown[] },
) => previewResponse(context.queryKey) as T;

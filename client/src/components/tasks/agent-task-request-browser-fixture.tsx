import { useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider, useI18n } from "@/i18n";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AgentTaskRequestContext,
  AgentTaskRequestEditor,
} from "@/components/tasks/agent-task-request-editor";
import {
  applyTaskRequestCategory,
  composeTaskRequestDescription,
} from "@/components/tasks/task-request-description";
import { getTaskRequestBrief } from "@/lib/task-request-brief";

function ProductionEditorFixture() {
  const { locale, t } = useI18n();
  const [open] = useState(true);
  const [form, setForm] = useState({ title: "", description: "", category: "" });
  const [submittedRequest, setSubmittedRequest] = useState("");
  const entityName = "Mila Novak";
  const categoryId = "wrong_address";
  const categoryLabel = t.quickCreate.catWrongAddress;
  const categoryPhrase = t.quickCreate.reqWrongAddress;

  const selectAddressCategory = () => {
    setForm((previous) =>
      applyTaskRequestCategory(previous, categoryId, `${categoryLabel} — ${entityName}`),
    );
  };

  const submit = () => {
    const fullDescription = composeTaskRequestDescription(
      entityName,
      form.category === categoryId ? categoryPhrase : undefined,
      form.description,
    );
    setSubmittedRequest(getTaskRequestBrief(fullDescription, locale).request);
  };

  return (
    <Sheet open={open}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[860px] p-0 flex flex-col gap-0 bg-[#f7fbfe] dark:bg-slate-950 border-l border-[#caddeb] dark:border-slate-700"
      >
        <SheetHeader className="shrink-0 px-5 py-4 space-y-0 bg-[#f8fbfe] dark:bg-slate-900 border-b border-[#dce8f2] dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#e5f0fa] dark:bg-blue-950 border border-[#c9deef] dark:border-blue-800 flex items-center justify-center shrink-0">
              <span className="h-5 w-5 rounded bg-[#2d6fba]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-[#173452] dark:text-slate-100 text-lg font-bold leading-tight">
                {t.quickCreate.newTask}
              </SheetTitle>
              <SheetDescription className="text-[#69809a] dark:text-slate-400 text-xs leading-snug">
                {t.quickCreate.newTaskDesc}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5" data-testid="fixture-form-grid">
            <div className="md:col-span-2">
              <AgentTaskRequestContext
                title={t.tasks.taskRequestContextTitle}
                hint={t.tasks.taskRequestContextHint}
                entityTypeLabel={t.customers.title}
                entityName={entityName}
                categoryPhrase={form.category === categoryId ? categoryPhrase : undefined}
              />
            </div>

            <div className="space-y-5 min-w-0">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  {t.quickCreate.taskCategory}
                </label>
                <button
                  type="button"
                  onClick={selectAddressCategory}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-medium text-left transition-all ${
                    form.category === categoryId
                      ? "bg-[#2d6fba] border-[#2d6fba] text-white shadow-md"
                      : "bg-white dark:bg-slate-900 border-[#c7d8e7] dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#5a94ca] hover:shadow-sm"
                  }`}
                  data-testid="fixture-change-category"
                >
                  {categoryLabel}
                </button>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  {t.quickCreate.taskTitle}
                </label>
                <input
                  className="w-full rounded-xl bg-white dark:bg-slate-900 border border-[#c7d8e7] dark:border-slate-700 px-3 py-2 text-sm text-[#233c54] dark:text-slate-100"
                  readOnly
                  value={form.title || entityName}
                />
              </div>
              <AgentTaskRequestEditor
                value={form.description}
                onChange={(description) => setForm((previous) => ({ ...previous, description }))}
                agentTitle={t.tasks.taskAgentRequestTitle}
                agentHint={t.tasks.taskAgentRequestHint}
              />
            </div>

            <div className="space-y-5 min-w-0">
              <div className="rounded-xl border border-[#dce8f2] bg-[#f3f8fb] p-4 text-xs text-[#69809a] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                {t.quickCreate.priority}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-[#dce8f2] dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={submit}
            className="rounded-lg px-5 py-2 font-semibold bg-gradient-to-b from-[#3b7ec5] to-[#2d6fba] text-white border-0 shadow-md"
            data-testid="fixture-submit"
          >
            {t.quickCreate.sendTask}
          </button>
        </div>
        {submittedRequest && (
          <output data-testid="fixture-submitted-request" data-request={submittedRequest} className="sr-only">
            {submittedRequest}
          </output>
        )}
      </SheetContent>
    </Sheet>
  );
}

createRoot(document.getElementById("root")!).render(
  <I18nProvider userCountries={[]}>
    <ProductionEditorFixture />
  </I18nProvider>,
);